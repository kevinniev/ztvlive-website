"""
ZTVLIVE Creator Scheduling System
Allows verified creators to book time slots on the 24/7 live TV schedule.

Features:
- Time slot booking (30min - 2hr slots)
- Video upload or YouTube URL
- Hybrid approval (auto for verified, manual for new)
- TV Guide view with available slots
- Integration with live playout
- Shareable invite links for creators
- Push notifications for scheduled events
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import uuid
import os
import secrets
import shutil

router = APIRouter(prefix="/creator-schedule", tags=["Creator Scheduling"])

# Upload directory for creator videos
UPLOAD_DIR = "/app/backend/uploads/creator_videos"
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def get_youtube_video_duration(video_url: str) -> Optional[int]:
    """
    Get YouTube video duration in seconds using oEmbed and page scraping fallback.
    Returns None if unable to determine duration.
    """
    import httpx
    import re
    
    # Extract video ID
    video_id = None
    if "youtube.com/watch?v=" in video_url:
        video_id = video_url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in video_url:
        video_id = video_url.split("youtu.be/")[1].split("?")[0]
    elif "youtube.com/embed/" in video_url:
        video_id = video_url.split("embed/")[1].split("?")[0]
    
    if not video_id:
        return None
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Try YouTube's oembed API first (doesn't have duration, but confirms video exists)
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            oembed_response = await client.get(oembed_url)
            
            if oembed_response.status_code != 200:
                print(f"YouTube video {video_id} not accessible via oEmbed")
                return None
            
            # Try to get duration from YouTube page (scraping fallback)
            watch_url = f"https://www.youtube.com/watch?v={video_id}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            page_response = await client.get(watch_url, headers=headers, follow_redirects=True)
            
            if page_response.status_code == 200:
                content = page_response.text
                
                # Look for duration in various formats
                # Pattern 1: "lengthSeconds":"123"
                match = re.search(r'"lengthSeconds"\s*:\s*"(\d+)"', content)
                if match:
                    duration = int(match.group(1))
                    print(f"YouTube video {video_id} duration: {duration}s")
                    return duration
                
                # Pattern 2: approxDurationMs
                match = re.search(r'"approxDurationMs"\s*:\s*"(\d+)"', content)
                if match:
                    duration = int(match.group(1)) // 1000
                    print(f"YouTube video {video_id} duration: {duration}s (from approxDurationMs)")
                    return duration
            
            print(f"Could not determine duration for YouTube video {video_id}")
            return None
            
    except Exception as e:
        print(f"Error getting YouTube duration: {e}")
        return None

# ============ MODELS ============

class SlotBookingRequest(BaseModel):
    """Request to book a time slot"""
    slot_date: str  # Format: YYYY-MM-DD (in user's local timezone)
    slot_start_hour: int  # 0-23 (in user's local timezone)
    slot_start_minute: int = 0  # 0, 15, 30, or 45
    duration_minutes: int = 60  # 15, 30, 45, 60, 90, or 120
    title: str
    description: str
    content_type: str = "youtube"  # youtube, upload
    video_url: Optional[str] = None  # YouTube URL
    category: str = "creator_content"
    thumbnail_url: Optional[str] = None
    user_timezone: str = "UTC"  # User's timezone for conversion

class SlotBookingResponse(BaseModel):
    booking_id: str
    status: str
    message: str
    slot_details: dict

class AvailableSlot(BaseModel):
    date: str
    start_hour: int
    start_minute: int
    end_hour: int
    end_minute: int
    is_available: bool
    booked_by: Optional[str] = None
    content_title: Optional[str] = None

class CreateInviteRequest(BaseModel):
    """Request to create a creator invite"""
    creator_email: str
    creator_name: Optional[str] = None
    message: Optional[str] = None
    expires_in_days: int = 7

class NotificationSubscription(BaseModel):
    """Subscribe to notifications for a booking"""
    booking_id: str
    notification_type: str = "push"  # push, email

# ============ HELPER FUNCTIONS ============

def get_db():
    """Get database connection from main server"""
    from server import db
    return db

async def get_current_user(request):
    """Extract current user from request using session token (matches main auth)"""
    from server import db
    from datetime import datetime, timezone
    import logging
    
    logger = logging.getLogger("creator_scheduling")
    
    if not request:
        return None
    
    token = None
    
    # Try Authorization header first
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
    
    # Try cookie fallback
    if not token:
        token = request.cookies.get("session_token")
    
    if not token:
        logger.warning("No token found in request")
        return None
    
    logger.info(f"Looking up session token: {token[:30]}...")
    
    # Find session in user_sessions collection
    session_doc = await db.user_sessions.find_one(
        {"session_token": token},
        {"_id": 0}
    )
    
    if not session_doc:
        logger.warning("No session found with token")
        return None
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at and expires_at < datetime.now(timezone.utc):
        logger.warning("Session expired")
        await db.user_sessions.delete_one({"session_token": token})
        return None
    
    # Get user by user_id from session
    user_id = session_doc.get("user_id")
    logger.info(f"Session found, user_id: {user_id}")
    
    user_doc = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if user_doc:
        logger.info(f"Found user: {user_doc.get('email')}")
        # Add _id equivalent for compatibility
        user_doc["_id"] = user_id
    else:
        logger.warning(f"No user found with user_id: {user_id}")
    
    return user_doc

async def is_verified_creator(user_id: str) -> bool:
    """Check if a creator is verified (auto-approval)"""
    db = get_db()
    
    # Try to find by user_id field first (format: user_xxx)
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        # Fallback: try as ObjectId if it looks like one
        if len(user_id) == 24:
            try:
                user = await db.users.find_one({"_id": ObjectId(user_id)})
            except Exception:
                pass
    
    if not user:
        return False
    
    # Check verification status
    if user.get("is_verified_creator", False) or user.get("is_verified", False):
        return True
    
    # Admin users are auto-verified
    if user.get("role") == "admin":
        return True
    
    # Check if they've had 3+ approved bookings
    approved_count = await db.creator_bookings.count_documents({
        "creator_id": user_id,
        "status": {"$in": ["approved", "completed"]}
    })
    
    return approved_count >= 3

async def check_slot_availability(slot_date: str, start_hour: int, start_minute: int, duration_minutes: int) -> dict:
    """Check if a time slot is available for booking"""
    db = get_db()
    
    # Calculate slot end time
    start_minutes_total = start_hour * 60 + start_minute
    end_minutes_total = start_minutes_total + duration_minutes
    
    # Check for overlapping bookings
    existing = await db.creator_bookings.find({
        "slot_date": slot_date,
        "status": {"$in": ["pending", "approved", "live"]}
    }).to_list(100)
    
    for booking in existing:
        b_start = booking["slot_start_hour"] * 60 + booking.get("slot_start_minute", 0)
        b_end = b_start + booking.get("duration_minutes", 60)
        
        # Check overlap
        if not (end_minutes_total <= b_start or start_minutes_total >= b_end):
            return {
                "available": False,
                "reason": "Time slot overlaps with existing booking",
                "conflicting_booking": {
                    "title": booking.get("title"),
                    "creator": booking.get("creator_name"),
                    "time": f"{booking['slot_start_hour']:02d}:{booking.get('slot_start_minute', 0):02d}"
                }
            }
    
    # Validate booking window (1 minute to 30 days in advance)
    now = datetime.now(timezone.utc)
    slot_datetime = datetime.strptime(f"{slot_date} {start_hour:02d}:{start_minute:02d}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    
    min_advance = timedelta(minutes=1)  # Changed from 24 hours to 1 minute
    max_advance = timedelta(days=30)
    
    if slot_datetime < now + min_advance:
        return {
            "available": False,
            "reason": "Cannot book slots in the past"
        }
    
    if slot_datetime > now + max_advance:
        return {
            "available": False,
            "reason": "Slots can only be booked up to 30 days in advance"
        }
    
    return {"available": True}

# ============ API ENDPOINTS ============

@router.get("/available-slots")
async def get_available_slots(
    date: str = None,
    days_ahead: int = 7,
    user_timezone: str = "UTC"
):
    """
    Get available time slots for booking.
    Returns a TV Guide style grid with 30-minute increments.
    Times are displayed in the user's local timezone but stored in UTC.
    """
    from zoneinfo import ZoneInfo
    
    db = get_db()
    
    # Validate and get user timezone
    try:
        user_tz = ZoneInfo(user_timezone)
    except Exception:
        user_tz = ZoneInfo("UTC")
    
    # Get current time in user's timezone
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(user_tz)
    
    if not date:
        date = now_local.strftime("%Y-%m-%d")
    
    # Get slots for the next N days (in user's local timezone)
    start_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=user_tz)
    slots = []
    
    for day_offset in range(days_ahead):
        current_date_local = start_date + timedelta(days=day_offset)
        date_str = current_date_local.strftime("%Y-%m-%d")
        
        # Get existing bookings for this date (stored in UTC)
        # We need to check bookings that overlap with this local date
        day_start_utc = current_date_local.replace(hour=0, minute=0, second=0).astimezone(timezone.utc)
        day_end_utc = current_date_local.replace(hour=23, minute=59, second=59).astimezone(timezone.utc)
        
        # Query bookings - they're stored with UTC date/hour
        # Get bookings for the UTC date range that overlaps with user's local day
        bookings = await db.creator_bookings.find({
            "status": {"$in": ["pending", "approved", "live"]}
        }).to_list(500)
        
        # Build lookup of booked UTC time slots
        booked_utc_slots = {}  # key: UTC datetime, value: booking info
        for b in bookings:
            # Parse booking time as UTC
            booking_date = b.get("slot_date")
            booking_hour = b.get("slot_start_hour", 0)
            booking_minute = b.get("slot_start_minute", 0)
            duration = b.get("duration_minutes", 60)
            
            try:
                booking_start_utc = datetime.strptime(
                    f"{booking_date} {booking_hour:02d}:{booking_minute:02d}",
                    "%Y-%m-%d %H:%M"
                ).replace(tzinfo=timezone.utc)
                
                # Mark all 15-min slots covered by this booking
                for offset in range(0, duration, 15):
                    slot_utc = booking_start_utc + timedelta(minutes=offset)
                    booked_utc_slots[slot_utc.isoformat()] = {
                        "creator_name": b.get("creator_name", "Creator"),
                        "title": b.get("title", "Scheduled Content"),
                        "status": b.get("status"),
                        "booking_id": b.get("booking_id")
                    }
            except Exception:
                continue
        
        # Generate 15-minute slots for the day in user's local time
        day_slots = []
        for hour in range(24):
            for minute in [0, 15, 30, 45]:
                # Create slot time in user's local timezone
                slot_local = current_date_local.replace(hour=hour, minute=minute, second=0, microsecond=0)
                # Convert to UTC to check bookings
                slot_utc = slot_local.astimezone(timezone.utc)
                
                slot_utc_key = slot_utc.isoformat()
                is_booked = slot_utc_key in booked_utc_slots
                
                slot = {
                    "date": date_str,
                    "hour": hour,
                    "minute": minute,
                    "time_display": f"{hour:02d}:{minute:02d}",
                    "time_utc": slot_utc.isoformat(),
                    "is_available": not is_booked,
                    "is_past": False
                }
                
                # Check if slot is in the past (must be at least 1 minute in the future)
                if slot_utc < now_utc + timedelta(minutes=1):
                    slot["is_available"] = False
                    slot["is_past"] = True
                
                if is_booked:
                    booking_info = booked_utc_slots[slot_utc_key]
                    slot["booked_by"] = booking_info["creator_name"]
                    slot["content_title"] = booking_info["title"]
                    slot["booking_status"] = booking_info["status"]
                    slot["booking_id"] = booking_info.get("booking_id")
                
                day_slots.append(slot)
        
        slots.append({
            "date": date_str,
            "day_name": current_date_local.strftime("%A"),
            "slots": day_slots
        })
    
    return {
        "available_slots": slots,
        "user_timezone": user_timezone,
        "server_time_utc": now_utc.isoformat(),
        "booking_rules": {
            "min_duration_minutes": 15,
            "max_duration_minutes": 120,
            "min_advance_minutes": 1,
            "max_advance_days": 30,
            "allowed_durations": [15, 30, 45, 60, 90, 120],
            "slot_interval_minutes": 15
        }
    }

@router.post("/book-slot")
async def book_time_slot(
    request: Request,
    booking: SlotBookingRequest
):
    """
    Book a time slot for creator content.
    Requires authentication.
    Times are provided in user's local timezone and stored in UTC.
    """
    from server import db
    from zoneinfo import ZoneInfo
    
    # Get current user (requires login)
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Please log in to book a time slot")
    
    # Validate duration
    if booking.duration_minutes not in [30, 60, 90, 120]:
        raise HTTPException(status_code=400, detail="Duration must be 30, 60, 90, or 120 minutes")
    
    # Validate content
    if booking.content_type == "youtube" and not booking.video_url:
        raise HTTPException(status_code=400, detail="YouTube URL is required")
    
    if booking.video_url and "youtube.com" not in booking.video_url and "youtu.be" not in booking.video_url:
        raise HTTPException(status_code=400, detail="Please provide a valid YouTube URL")
    
    # Parse user timezone
    try:
        user_tz = ZoneInfo(booking.user_timezone)
    except Exception:
        user_tz = ZoneInfo("UTC")
    
    # Convert local time to UTC for storage
    local_datetime = datetime.strptime(
        f"{booking.slot_date} {booking.slot_start_hour:02d}:{booking.slot_start_minute:02d}",
        "%Y-%m-%d %H:%M"
    ).replace(tzinfo=user_tz)
    
    utc_datetime = local_datetime.astimezone(timezone.utc)
    utc_date = utc_datetime.strftime("%Y-%m-%d")
    utc_hour = utc_datetime.hour
    utc_minute = utc_datetime.minute
    
    # Check slot availability (in UTC)
    availability = await check_slot_availability(
        utc_date,
        utc_hour,
        utc_minute,
        booking.duration_minutes
    )
    
    if not availability["available"]:
        raise HTTPException(status_code=409, detail=availability["reason"])
    
    # Determine approval status
    user_id = str(user["_id"])
    is_verified = await is_verified_creator(user_id)
    
    # Perform copyright analysis
    copyright_analysis = None
    can_auto_approve = is_verified
    
    try:
        from services.copyright_analyzer import full_copyright_analysis
        copyright_analysis = await full_copyright_analysis(
            title=booking.title,
            description=booking.description,
            video_url=booking.video_url,
            content_type=booking.content_type
        )
        
        # Auto-approve if copyright analysis passes AND creator is verified
        # OR if copyright analysis shows very low risk
        final_decision = copyright_analysis.get("final_decision", {})
        copyright_safe = final_decision.get("can_auto_approve", False)
        risk_level = final_decision.get("risk_level", "unknown")
        
        if is_verified and copyright_safe:
            can_auto_approve = True
        elif not is_verified and copyright_safe and risk_level == "low":
            # Even non-verified creators can get auto-approval for clearly safe content
            can_auto_approve = True
        else:
            can_auto_approve = False
            
    except Exception as e:
        print(f"Copyright analysis failed: {e}")
        # If analysis fails, require manual review for non-verified
        can_auto_approve = is_verified
    
    initial_status = "approved" if can_auto_approve else "pending"
    
    # Extract YouTube video ID for thumbnail
    thumbnail = booking.thumbnail_url
    if not thumbnail and booking.video_url:
        # Extract video ID from YouTube URL
        video_id = None
        if "youtube.com/watch?v=" in booking.video_url:
            video_id = booking.video_url.split("v=")[1].split("&")[0]
        elif "youtu.be/" in booking.video_url:
            video_id = booking.video_url.split("youtu.be/")[1].split("?")[0]
        elif "youtube.com/embed/" in booking.video_url:
            video_id = booking.video_url.split("embed/")[1].split("?")[0]
        
        if video_id:
            thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
    
    # Fetch actual video duration
    trt_seconds = None
    
    if booking.video_url and booking.content_type == "youtube":
        # YouTube video - fetch from YouTube API/scraping
        try:
            trt_seconds = await get_youtube_video_duration(booking.video_url)
            if trt_seconds:
                print(f"Fetched YouTube TRT for '{booking.title}': {trt_seconds}s ({trt_seconds//60}m {trt_seconds%60}s)")
        except Exception as e:
            print(f"Failed to fetch YouTube duration: {e}")
    elif booking.content_type == "upload" and booking.video_url:
        # Uploaded video - get duration from upload record
        try:
            # Extract file_id from URL or video_url field
            file_id = None
            if "/video/" in booking.video_url:
                file_id = booking.video_url.split("/video/")[-1].split("?")[0]
            elif booking.video_url.startswith("vid_"):
                file_id = booking.video_url
            
            if file_id:
                upload = await db.creator_video_uploads.find_one({"file_id": file_id})
                if upload and upload.get("duration_seconds"):
                    trt_seconds = upload["duration_seconds"]
                    print(f"Using uploaded video TRT for '{booking.title}': {trt_seconds}s ({trt_seconds//60}m {trt_seconds%60}s)")
        except Exception as e:
            print(f"Failed to get upload duration: {e}")
    
    # Create booking record (stored in UTC)
    booking_id = str(uuid.uuid4())
    booking_record = {
        "_id": booking_id,
        "booking_id": booking_id,
        "creator_id": user_id,
        "creator_name": user.get("username") or user.get("name") or user.get("email", "").split("@")[0],
        "creator_email": user.get("email"),
        "slot_date": utc_date,  # UTC date
        "slot_start_hour": utc_hour,  # UTC hour
        "slot_start_minute": utc_minute,  # UTC minute
        "slot_datetime_utc": utc_datetime.isoformat(),  # Full UTC datetime
        "user_local_date": booking.slot_date,  # Original user's local date
        "user_local_hour": booking.slot_start_hour,  # Original user's local hour
        "user_timezone": booking.user_timezone,  # User's timezone
        "duration_minutes": booking.duration_minutes,
        "trt_seconds": trt_seconds,  # Actual video duration from YouTube
        "title": booking.title,
        "description": booking.description,
        "content_type": booking.content_type,
        "video_url": booking.video_url,
        "thumbnail": thumbnail,
        "category": booking.category,
        "status": initial_status,
        "is_verified_creator": is_verified,
        "copyright_analysis": copyright_analysis,  # Store full copyright analysis
        "auto_approved": can_auto_approve,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Also create in legacy creator_scheduled_content collection for scheduler compatibility
    legacy_record = {
        "id": booking_id,
        "slot_date": utc_date,
        "slot_hour": utc_hour,
        "creator_id": user_id,
        "creator_name": booking_record["creator_name"],
        "creator_email": user.get("email"),
        "title": booking.title,
        "description": booking.description,
        "content_type": booking.content_type,
        "video_url": booking.video_url,
        "thumbnail": thumbnail,
        "duration": f"{booking.duration_minutes}:00",
        "category": booking.category,
        "status": initial_status,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.creator_bookings.insert_one(booking_record)
    await db.creator_scheduled_content.insert_one(legacy_record)
    
    # Send admin notification for new content submission
    try:
        from routes.admin_notifications import notify_content_submission_enhanced, send_admin_email_notification
        
        # In-app notification
        await notify_content_submission_enhanced(
            creator_name=booking_record["creator_name"],
            content_title=booking.title,
            content_type=booking.content_type,
            booking_id=booking_id,
            slot_date=booking.slot_date,
            slot_time=f"{booking.slot_start_hour:02d}:{booking.slot_start_minute:02d}",
            status=initial_status,
            copyright_analysis=copyright_analysis
        )
        
        # Email notification (async - don't wait)
        import asyncio
        asyncio.create_task(send_admin_email_notification(
            creator_name=booking_record["creator_name"],
            content_title=booking.title,
            booking_id=booking_id,
            slot_date=booking.slot_date,
            slot_time=f"{booking.slot_start_hour:02d}:{booking.slot_start_minute:02d}",
            status=initial_status,
            copyright_risk=copyright_analysis.get("final_decision", {}).get("risk_level", "unknown") if copyright_analysis else "unknown"
        ))
    except Exception as e:
        print(f"Failed to send admin notification: {e}")
    
    # Calculate slot time display
    end_minutes = booking.slot_start_hour * 60 + booking.slot_start_minute + booking.duration_minutes
    end_hour = (end_minutes // 60) % 24
    end_minute = end_minutes % 60
    
    # Build response with celebration data for frontend
    response_message = ""
    show_confetti = False
    
    if initial_status == "approved":
        response_message = "Your content has been scheduled! It will air at the top of your selected hour."
        show_confetti = True
    else:
        response_message = "Your slot is pending review. We'll notify you once it's approved!"
    
    return {
        "booking_id": booking_id,
        "status": initial_status,
        "message": response_message,
        "show_confetti": show_confetti,
        "slot_details": {
            "date": booking.slot_date,
            "start_time": f"{booking.slot_start_hour:02d}:{booking.slot_start_minute:02d}",
            "end_time": f"{end_hour:02d}:{end_minute:02d}",
            "duration_minutes": booking.duration_minutes,
            "title": booking.title
        },
        "copyright_analysis": {
            "risk_level": copyright_analysis.get("final_decision", {}).get("risk_level", "unknown") if copyright_analysis else "not_analyzed",
            "auto_approved": can_auto_approve
        },
        "requires_approval": initial_status == "pending"
    }

@router.get("/my-bookings")
async def get_my_bookings(request: Request):
    """Get all bookings for the current logged-in creator"""
    from server import db
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in to view your bookings")
    
    user_id = str(user["_id"])
    
    bookings = await db.creator_bookings.find({
        "creator_id": user_id
    }).sort("slot_date", -1).to_list(100)
    
    # Clean ObjectId for JSON serialization
    result = []
    for b in bookings:
        b.pop("_id", None)
        result.append(b)
    
    return {"bookings": result}

@router.delete("/cancel/{booking_id}")
async def cancel_booking(request: Request, booking_id: str):
    """Cancel a booking (must be owner or admin)"""
    from server import db
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    booking = await db.creator_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check ownership or admin
    user_id = str(user["_id"])
    is_admin = user.get("role") == "admin"
    
    if booking["creator_id"] != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
    
    # Update status
    await db.creator_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
    )
    
    await db.creator_scheduled_content.update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Booking cancelled successfully", "booking_id": booking_id}

@router.get("/tv-guide")
async def get_tv_guide(date: str = None):
    """
    Get the full TV Guide showing all scheduled content.
    Combines AI programming blocks with creator bookings.
    """
    from server import db
    from services.tv_scheduler import TV_PROGRAM_SCHEDULE, get_program_schedule
    
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get creator bookings for this date
    bookings = await db.creator_bookings.find({
        "slot_date": date,
        "status": {"$in": ["pending", "approved", "live"]}
    }).to_list(100)
    
    # Build the TV guide
    guide = []
    
    for hour in range(24):
        # Check if there's a creator booking for this hour
        creator_content = None
        for b in bookings:
            if b["slot_start_hour"] == hour:
                creator_content = {
                    "type": "creator",
                    "booking_id": b["booking_id"],
                    "title": b["title"],
                    "description": b["description"],
                    "creator_name": b["creator_name"],
                    "thumbnail": b.get("thumbnail"),
                    "duration_minutes": b.get("duration_minutes", 60),
                    "status": b["status"],
                    "content_type": b.get("content_type", "youtube")
                }
                break
        
        if creator_content:
            guide.append({
                "hour": hour,
                "time_display": f"{hour:02d}:00",
                "content": creator_content
            })
        else:
            # Get AI program block
            program_block = None
            for block in TV_PROGRAM_SCHEDULE:
                block_hour = block["hour"]
                next_hour = (block_hour + 2) % 24
                
                if block_hour <= hour < next_hour or (next_hour < block_hour and (hour >= block_hour or hour < next_hour)):
                    program_block = block
                    break
            
            if program_block:
                guide.append({
                    "hour": hour,
                    "time_display": f"{hour:02d}:00",
                    "content": {
                        "type": "ai",
                        "program_name": program_block["name"],
                        "description": program_block["desc"],
                        "categories": program_block["categories"]
                    }
                })
    
    return {
        "date": date,
        "guide": guide,
        "creator_bookings_count": len(bookings)
    }

# ============ ADMIN ENDPOINTS ============

@router.get("/admin/pending")
async def get_pending_bookings(request: Request):
    """Get all pending bookings for admin review"""
    from server import db
    
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    bookings = await db.creator_bookings.find({
        "status": "pending"
    }).sort("created_at", 1).to_list(100)
    
    result = []
    for b in bookings:
        b.pop("_id", None)
        result.append(b)
    
    return {"pending_bookings": result}

@router.post("/admin/approve/{booking_id}")
async def approve_booking(request: Request, booking_id: str):
    """Approve a pending booking"""
    from server import db
    
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.creator_bookings.update_one(
        {"booking_id": booking_id, "status": "pending"},
        {"$set": {"status": "approved", "approved_by": str(user["_id"]), "approved_at": datetime.now(timezone.utc)}}
    )
    
    await db.creator_scheduled_content.update_one(
        {"id": booking_id},
        {"$set": {"status": "approved"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found or already processed")
    
    return {"message": "Booking approved", "booking_id": booking_id}

@router.post("/admin/reject/{booking_id}")
async def reject_booking(request: Request, booking_id: str, reason: str = "Does not meet content guidelines"):
    """Reject a pending booking"""
    from server import db
    
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.creator_bookings.update_one(
        {"booking_id": booking_id, "status": "pending"},
        {"$set": {
            "status": "rejected",
            "rejected_by": str(user["_id"]),
            "rejected_at": datetime.now(timezone.utc),
            "rejection_reason": reason
        }}
    )
    
    await db.creator_scheduled_content.update_one(
        {"id": booking_id},
        {"$set": {"status": "rejected"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found or already processed")
    
    return {"message": "Booking rejected", "booking_id": booking_id, "reason": reason}


@router.post("/admin/update-trt/{booking_id}")
async def update_booking_trt(request: Request, booking_id: str):
    """Update a booking with actual YouTube video duration (TRT)"""
    from server import db
    
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    booking = await db.creator_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    video_url = booking.get("video_url")
    if not video_url:
        raise HTTPException(status_code=400, detail="Booking has no video URL")
    
    # Get actual duration from YouTube
    trt_seconds = await get_youtube_video_duration(video_url)
    
    if not trt_seconds:
        raise HTTPException(status_code=400, detail="Could not determine video duration")
    
    # Update booking with actual TRT
    await db.creator_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "trt_seconds": trt_seconds,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Also update legacy collection
    await db.creator_scheduled_content.update_one(
        {"id": booking_id},
        {"$set": {"trt_seconds": trt_seconds}}
    )
    
    return {
        "message": "TRT updated successfully",
        "booking_id": booking_id,
        "trt_seconds": trt_seconds,
        "trt_formatted": f"{trt_seconds // 60}m {trt_seconds % 60}s"
    }


@router.post("/admin/refresh-all-trt")
async def refresh_all_booking_trt(request: Request):
    """Update all bookings with actual YouTube video duration (TRT)"""
    from server import db
    
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    bookings = await db.creator_bookings.find({
        "video_url": {"$exists": True, "$ne": None, "$ne": ""},
        "trt_seconds": {"$exists": False}
    }).to_list(100)
    
    updated = 0
    failed = 0
    
    for booking in bookings:
        try:
            trt_seconds = await get_youtube_video_duration(booking.get("video_url"))
            if trt_seconds:
                await db.creator_bookings.update_one(
                    {"booking_id": booking.get("booking_id")},
                    {"$set": {"trt_seconds": trt_seconds}}
                )
                await db.creator_scheduled_content.update_one(
                    {"id": booking.get("booking_id")},
                    {"$set": {"trt_seconds": trt_seconds}}
                )
                updated += 1
                print(f"Updated TRT for '{booking.get('title')}': {trt_seconds}s")
            else:
                failed += 1
        except Exception as e:
            print(f"Failed to update TRT for {booking.get('booking_id')}: {e}")
            failed += 1
    
    return {
        "message": f"Updated {updated} bookings, {failed} failed",
        "updated_count": updated,
        "failed_count": failed
    }


@router.post("/admin/end-booking/{booking_id}")
async def end_booking_now(request: Request, booking_id: str):
    """
    Immediately end a booking by setting its TRT to elapsed time.
    This causes the system to switch back to regular programming.
    """
    from server import db
    from services.tv_scheduler import refresh_creator_bookings_cache
    
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find the booking
    booking = await db.creator_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Calculate elapsed seconds since booking started
    now = datetime.now(timezone.utc)
    slot_date = booking.get("slot_date")
    slot_hour = booking.get("slot_start_hour", 0)
    slot_minute = booking.get("slot_start_minute", 0)
    
    # Calculate booking start time
    booking_start = datetime.strptime(f"{slot_date} {slot_hour:02d}:{slot_minute:02d}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    
    # Set TRT to 1 second so it immediately ends
    # (Or set to elapsed time if you want to mark exactly when it was stopped)
    elapsed_seconds = max(1, int((now - booking_start).total_seconds()))
    
    # Update booking with TRT set to elapsed time (so it's "ended")
    await db.creator_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "trt_seconds": elapsed_seconds,
            "ended_early": True,
            "ended_at": now.isoformat()
        }}
    )
    
    # Also update the scheduled content collection
    await db.creator_scheduled_content.update_one(
        {"id": booking_id},
        {"$set": {"trt_seconds": elapsed_seconds, "ended_early": True}}
    )
    
    # Refresh cache immediately
    try:
        await refresh_creator_bookings_cache()
    except Exception as e:
        print(f"Cache refresh error: {e}")
    
    return {
        "message": f"Booking ended. Elapsed time was {elapsed_seconds}s ({elapsed_seconds//60}m {elapsed_seconds%60}s)",
        "booking_id": booking_id,
        "elapsed_seconds": elapsed_seconds,
        "ended_at": now.isoformat()
    }


@router.post("/admin/set-trt/{booking_id}")
async def set_booking_trt(request: Request, booking_id: str, trt_seconds: int):
    """
    Manually set the TRT (actual video duration) for a booking.
    This is useful for uploaded videos where auto-detection doesn't work.
    """
    from server import db
    from services.tv_scheduler import refresh_creator_bookings_cache
    
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if trt_seconds < 1:
        raise HTTPException(status_code=400, detail="TRT must be at least 1 second")
    
    # Update booking
    result = await db.creator_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"trt_seconds": trt_seconds}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Also update scheduled content
    await db.creator_scheduled_content.update_one(
        {"id": booking_id},
        {"$set": {"trt_seconds": trt_seconds}}
    )
    
    # Refresh cache
    try:
        await refresh_creator_bookings_cache()
    except Exception as e:
        print(f"Cache refresh error: {e}")
    
    return {
        "message": f"TRT set to {trt_seconds}s ({trt_seconds//60}m {trt_seconds%60}s)",
        "booking_id": booking_id,
        "trt_seconds": trt_seconds
    }


@router.post("/video-ended")
async def report_video_ended(request: Request):
    """
    Called by client (OBS player, Watch page) when a creator video actually ends.
    This allows real-time TRT correction if the video ends before expected.
    """
    from server import db
    from services.tv_scheduler import refresh_creator_bookings_cache
    
    try:
        body = await request.json()
    except:
        body = {}
    
    booking_id = body.get("booking_id")
    video_id = body.get("video_id")
    actual_duration = body.get("actual_duration_seconds")
    
    if not booking_id and not video_id:
        # Try to find currently playing content
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")
        current_hour = now.hour
        
        booking = await db.creator_bookings.find_one({
            "slot_date": today,
            "slot_start_hour": current_hour,
            "status": {"$in": ["approved", "confirmed", "live"]}
        })
        
        if booking:
            booking_id = booking.get("booking_id")
    
    if not booking_id:
        return {"message": "No active booking found", "action": "none"}
    
    # Calculate actual elapsed time
    booking = await db.creator_bookings.find_one({"booking_id": booking_id})
    if not booking:
        return {"message": "Booking not found", "action": "none"}
    
    now = datetime.now(timezone.utc)
    slot_date = booking.get("slot_date")
    slot_hour = booking.get("slot_start_hour", 0)
    slot_minute = booking.get("slot_start_minute", 0)
    
    try:
        booking_start = datetime.strptime(f"{slot_date} {slot_hour:02d}:{slot_minute:02d}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        elapsed_seconds = int((now - booking_start).total_seconds())
    except:
        elapsed_seconds = actual_duration or 60
    
    # Use provided actual_duration or elapsed time
    final_trt = actual_duration if actual_duration and actual_duration > 0 else elapsed_seconds
    
    # Update booking with actual TRT
    await db.creator_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "trt_seconds": final_trt,
            "video_ended_naturally": True,
            "ended_at": now.isoformat()
        }}
    )
    
    await db.creator_scheduled_content.update_one(
        {"id": booking_id},
        {"$set": {"trt_seconds": final_trt}}
    )
    
    # Refresh cache immediately
    try:
        await refresh_creator_bookings_cache()
    except Exception as e:
        print(f"Cache refresh error: {e}")
    
    print(f"✅ Video ended signal received for '{booking.get('title')}' - TRT updated to {final_trt}s")
    
    return {
        "message": "Video end recorded",
        "booking_id": booking_id,
        "trt_seconds": final_trt,
        "action": "switched_to_game_feed"
    }

@router.post("/admin/verify-creator/{user_id}")
async def verify_creator(request: Request, user_id: str):
    """Mark a creator as verified (auto-approval for future bookings)"""
    from server import db
    
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_verified_creator": True, "verified_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Creator verified successfully", "user_id": user_id}


# ============ SHAREABLE INVITE LINKS ============

@router.post("/invite/create")
async def create_invite_link(request: Request, invite_data: CreateInviteRequest):
    """Create a shareable invite link for a specific creator"""
    from server import db
    
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Generate unique invite token
    invite_token = secrets.token_urlsafe(32)
    
    # Calculate expiry
    expires_at = datetime.now(timezone.utc) + timedelta(days=invite_data.expires_in_days)
    
    invite_record = {
        "invite_token": invite_token,
        "creator_email": invite_data.creator_email,
        "creator_name": invite_data.creator_name,
        "message": invite_data.message,
        "created_by": str(user.get("_id") or user.get("user_id")),
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
        "used": False,
        "used_at": None,
        "used_by_user_id": None
    }
    
    await db.creator_invites.insert_one(invite_record)
    
    # Get base URL from environment
    base_url = os.environ.get("BASE_URL", "https://ztvlivestream.com")
    invite_url = f"{base_url}/schedule-slot?invite={invite_token}"
    
    return {
        "invite_token": invite_token,
        "invite_url": invite_url,
        "expires_at": expires_at.isoformat(),
        "creator_email": invite_data.creator_email,
        "message": f"Share this link with {invite_data.creator_name or invite_data.creator_email}"
    }

@router.get("/invite/{token}")
async def validate_invite(token: str):
    """Validate an invite token and return invite details"""
    from server import db
    
    invite = await db.creator_invites.find_one({"invite_token": token})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite link")
    
    if invite.get("used"):
        raise HTTPException(status_code=400, detail="This invite has already been used")
    
    expires_at = invite.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This invite has expired")
    
    return {
        "valid": True,
        "creator_email": invite.get("creator_email"),
        "creator_name": invite.get("creator_name"),
        "message": invite.get("message"),
        "expires_at": expires_at.isoformat()
    }

@router.post("/invite/{token}/accept")
async def accept_invite(request: Request, token: str):
    """Accept an invite (marks it as used) and queue starter pack rewards"""
    from server import db
    import httpx
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in or create an account first")
    
    # Validate invite
    invite = await db.creator_invites.find_one({"invite_token": token, "used": False})
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or already used invite")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    user_email = user.get("email", "")
    
    # Mark invite as used
    await db.creator_invites.update_one(
        {"invite_token": token},
        {"$set": {
            "used": True,
            "used_at": datetime.now(timezone.utc),
            "used_by_user_id": user_id
        }}
    )
    
    # Optionally auto-verify the creator
    await db.users.update_one(
        {"user_id": user.get("user_id")},
        {"$set": {"invited_creator": True, "invite_token": token}}
    )
    
    # Queue the New Player Starter Pack rewards
    rewards_queued = False
    try:
        # Check if user already has rewards
        existing_reward = await db.user_rewards.find_one({"user_id": user_id})
        if not existing_reward:
            reward_record = {
                "reward_id": str(uuid.uuid4()),
                "user_id": user_id,
                "user_email": user_email,
                "rewards": ["REWARD_DDASH_5_USD", "REWARD_ZTV_3M_PRO"],
                "status": "PENDING_ACTIVATION",
                "referred_by": invite.get("created_by"),
                "invite_token": token,
                "queued_at": datetime.now(timezone.utc),
                "activated_at": None,
                "dispatched_at": None,
                "transaction_id": None,
                "first_poll_id": None
            }
            await db.user_rewards.insert_one(reward_record)
            rewards_queued = True
    except Exception as e:
        print(f"Failed to queue rewards: {e}")
    
    return {
        "message": "Invite accepted! You can now schedule your content.",
        "redirect_to": "/schedule-slot",
        "rewards_queued": rewards_queued,
        "starter_pack_hint": "Complete your first poll to unlock your $5 DoorDash credit + 3-month Pro Pass!" if rewards_queued else None
    }

@router.get("/admin/invites")
async def list_invites(request: Request):
    """List all invites (admin only)"""
    from server import db
    
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    invites = await db.creator_invites.find().sort("created_at", -1).to_list(100)
    
    result = []
    for inv in invites:
        inv.pop("_id", None)
        result.append(inv)
    
    return {"invites": result}

# ============ VIDEO FILE UPLOAD ============

@router.post("/upload-video")
async def upload_creator_video(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form("creator_content")
):
    """Upload a video file for scheduling"""
    from server import db
    import subprocess
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in to upload videos")
    
    # Validate file type
    allowed_types = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: MP4, WebM, MOV, AVI")
    
    # Limit file size (500MB)
    max_size = 500 * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum 500MB")
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1] or ".mp4"
    file_id = f"vid_{uuid.uuid4().hex[:12]}"
    filename = f"{file_id}{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Detect video duration using ffprobe
    duration_seconds = None
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", 
             "-of", "default=noprint_wrappers=1:nokey=1", filepath],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            duration_seconds = int(float(result.stdout.strip()))
            print(f"Detected video duration: {duration_seconds}s ({duration_seconds//60}m {duration_seconds%60}s)")
    except Exception as e:
        print(f"ffprobe duration detection failed: {e}")
    
    # Create upload record
    upload_record = {
        "file_id": file_id,
        "filename": filename,
        "filepath": filepath,
        "original_name": file.filename,
        "content_type": file.content_type,
        "size_bytes": len(contents),
        "title": title,
        "description": description,
        "category": category,
        "duration_seconds": duration_seconds,  # Actual video duration
        "uploader_id": str(user.get("_id") or user.get("user_id")),
        "uploader_name": user.get("username") or user.get("name") or user.get("email", "").split("@")[0],
        "uploaded_at": datetime.now(timezone.utc),
        "status": "ready"
    }
    
    await db.creator_video_uploads.insert_one(upload_record)
    
    return {
        "file_id": file_id,
        "filename": filename,
        "title": title,
        "duration_seconds": duration_seconds,
        "duration_formatted": f"{duration_seconds // 60}m {duration_seconds % 60}s" if duration_seconds else None,
        "message": "Video uploaded successfully! You can now use this in your scheduled slot."
    }

@router.get("/my-uploads")
async def get_my_uploads(request: Request):
    """Get all uploaded videos for the current user"""
    from server import db
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    uploads = await db.creator_video_uploads.find(
        {"uploader_id": user_id}
    ).sort("uploaded_at", -1).to_list(100)
    
    result = []
    for u in uploads:
        u.pop("_id", None)
        u.pop("filepath", None)  # Don't expose server path
        result.append(u)
    
    return {"uploads": result}

@router.get("/video/{file_id}")
async def serve_creator_video(file_id: str):
    """Serve an uploaded video file"""
    from server import db
    
    upload = await db.creator_video_uploads.find_one({"file_id": file_id})
    if not upload:
        raise HTTPException(status_code=404, detail="Video not found")
    
    filepath = upload.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Video file not found")
    
    return FileResponse(
        filepath,
        media_type=upload.get("content_type", "video/mp4"),
        filename=upload.get("original_name", f"{file_id}.mp4")
    )


@router.get("/upload/{file_id}")
async def get_upload_info(request: Request, file_id: str):
    """Get info about an uploaded video including duration"""
    from server import db
    
    upload = await db.creator_video_uploads.find_one({"file_id": file_id}, {"_id": 0})
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return {
        "file_id": upload.get("file_id"),
        "title": upload.get("title"),
        "duration_seconds": upload.get("duration_seconds"),
        "content_type": upload.get("content_type"),
        "original_name": upload.get("original_name"),
        "status": upload.get("status")
    }


@router.post("/detect-trt")
async def detect_video_trt(request: Request):
    """
    Detect TRT (Total Running Time) of a video from URL.
    Works for YouTube videos and uploaded videos.
    """
    from server import db
    import subprocess
    
    try:
        body = await request.json()
    except:
        body = {}
    
    video_url = body.get("video_url", "")
    file_id = body.get("file_id")
    
    if not video_url and not file_id:
        raise HTTPException(status_code=400, detail="video_url or file_id required")
    
    trt_seconds = None
    source = None
    
    # Try YouTube detection
    if video_url and ("youtube.com" in video_url or "youtu.be" in video_url):
        trt_seconds = await get_youtube_video_duration(video_url)
        source = "youtube"
    
    # Try uploaded video
    elif file_id or (video_url and ("/video/" in video_url or video_url.startswith("vid_"))):
        if not file_id and video_url:
            if "/video/" in video_url:
                file_id = video_url.split("/video/")[1].split("?")[0]
            elif video_url.startswith("vid_"):
                file_id = video_url
        
        if file_id:
            upload = await db.creator_video_uploads.find_one({"file_id": file_id})
            if upload:
                if upload.get("duration_seconds"):
                    trt_seconds = upload["duration_seconds"]
                    source = "upload_record"
                elif upload.get("filepath") and os.path.exists(upload["filepath"]):
                    # Try ffprobe
                    try:
                        result = subprocess.run(
                            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                             "-of", "default=noprint_wrappers=1:nokey=1", upload["filepath"]],
                            capture_output=True, text=True, timeout=30
                        )
                        if result.returncode == 0 and result.stdout.strip():
                            trt_seconds = int(float(result.stdout.strip()))
                            source = "ffprobe"
                            
                            # Update upload record with detected duration
                            await db.creator_video_uploads.update_one(
                                {"file_id": file_id},
                                {"$set": {"duration_seconds": trt_seconds}}
                            )
                    except Exception as e:
                        print(f"ffprobe detection failed: {e}")
    
    if trt_seconds and trt_seconds > 0:
        return {
            "success": True,
            "trt_seconds": trt_seconds,
            "trt_formatted": f"{trt_seconds // 60}m {trt_seconds % 60}s",
            "source": source
        }
    else:
        return {
            "success": False,
            "trt_seconds": None,
            "message": "Could not detect video duration"
        }

# ============ NOTIFICATION SUBSCRIPTIONS ============

@router.post("/notify/subscribe")
async def subscribe_to_notification(request: Request, subscription: NotificationSubscription):
    """Subscribe to notifications for a scheduled program"""
    from server import db
    
    # Get booking details
    booking = await db.creator_bookings.find_one({"booking_id": subscription.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get subscriber info (can be anonymous with just player_id)
    user = await get_current_user(request)
    user_id = str(user.get("_id") or user.get("user_id")) if user else None
    
    # Get OneSignal player_id from header or body
    player_id = request.headers.get("X-OneSignal-Player-Id") or request.headers.get("player_id")
    email = user.get("email") if user else None
    
    if not player_id and not email:
        raise HTTPException(status_code=400, detail="Push notification requires OneSignal player ID or email")
    
    # Create subscription
    sub_id = f"sub_{uuid.uuid4().hex[:12]}"
    subscription_record = {
        "subscription_id": sub_id,
        "booking_id": subscription.booking_id,
        "booking_title": booking.get("title"),
        "scheduled_date": booking.get("slot_date"),
        "scheduled_hour": booking.get("slot_start_hour"),
        "scheduled_minute": booking.get("slot_start_minute", 0),
        "user_id": user_id,
        "email": email,
        "player_id": player_id,
        "notification_type": subscription.notification_type,
        "created_at": datetime.now(timezone.utc),
        "notified": False
    }
    
    # Check for existing subscription
    existing = await db.schedule_notifications.find_one({
        "booking_id": subscription.booking_id,
        "$or": [
            {"player_id": player_id} if player_id else {"email": email}
        ]
    })
    
    if existing:
        return {"message": "Already subscribed to this program", "subscription_id": existing.get("subscription_id")}
    
    await db.schedule_notifications.insert_one(subscription_record)
    
    return {
        "subscription_id": sub_id,
        "message": f"You'll be notified before '{booking.get('title')}' starts!",
        "scheduled_time": f"{booking.get('slot_date')} at {booking.get('slot_start_hour'):02d}:{booking.get('slot_start_minute', 0):02d}"
    }

@router.delete("/notify/unsubscribe/{subscription_id}")
async def unsubscribe_from_notification(subscription_id: str):
    """Unsubscribe from a notification"""
    from server import db
    
    result = await db.schedule_notifications.delete_one({"subscription_id": subscription_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return {"message": "Unsubscribed successfully"}

@router.get("/notify/my-subscriptions")
async def get_my_notification_subscriptions(request: Request):
    """Get all notification subscriptions for current user"""
    from server import db
    
    user = await get_current_user(request)
    player_id = request.headers.get("X-OneSignal-Player-Id")
    
    query = {}
    if user:
        user_id = str(user.get("_id") or user.get("user_id"))
        query["$or"] = [{"user_id": user_id}]
        if player_id:
            query["$or"].append({"player_id": player_id})
    elif player_id:
        query["player_id"] = player_id
    else:
        return {"subscriptions": []}
    
    subs = await db.schedule_notifications.find(query).sort("created_at", -1).to_list(50)
    
    result = []
    for s in subs:
        s.pop("_id", None)
        result.append(s)
    
    return {"subscriptions": result}

@router.get("/booking/{booking_id}/subscribers")
async def get_booking_subscriber_count(booking_id: str):
    """Get the number of people subscribed to notifications for a booking"""
    from server import db
    
    count = await db.schedule_notifications.count_documents({"booking_id": booking_id})
    
    return {"booking_id": booking_id, "subscriber_count": count}
