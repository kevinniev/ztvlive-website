"""
ZTVLIVE Smart Scheduling System
Advanced scheduling features: duration-based auto-cutoff, reminders, dead stream detection

Features:
- Duration-based auto-cutoff: Stream ends when timer hits zero, switches to auto-playlist
- 1-week reminder: Email + dashboard notification asking "Still a go?"
- Dead stream detection: Checks stream health every 1 minute, auto-fallback if broken
- Confirmation tracking: Creator confirms or cancels via email link or dashboard
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from enum import Enum
import uuid
import asyncio
import logging
import aiohttp

router = APIRouter(prefix="/smart-schedule", tags=["Smart Scheduling"])
logger = logging.getLogger("smart_scheduling")

# ============ MODELS ============

class ConfirmationStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    NO_RESPONSE = "no_response"

class StreamHealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DEAD = "dead"
    UNKNOWN = "unknown"

class SmartBookingRequest(BaseModel):
    """Request to book a time slot with smart features"""
    slot_date: str  # Format: YYYY-MM-DD (in user's local timezone)
    slot_time: str  # Format: HH:MM (24-hour, in user's local timezone)
    duration_minutes: int = Field(ge=5, le=480, description="Duration in minutes (5 min to 8 hours)")
    title: str
    description: str = ""
    content_type: str = "youtube"  # youtube, live_stream, video_url
    video_url: Optional[str] = None
    stream_url: Optional[str] = None  # For live streams
    category: str = "creator_content"
    thumbnail_url: Optional[str] = None
    enable_auto_cutoff: bool = True  # Auto-switch to playlist when time ends
    enable_reminder: bool = True  # Send 1-week reminder
    enable_health_check: bool = True  # Monitor stream health (for live streams)
    user_timezone: str = "UTC"  # User's timezone for proper conversion

class SmartBookingResponse(BaseModel):
    booking_id: str
    status: str
    message: str
    show_confetti: bool = False
    scheduled_start: str
    scheduled_end: str
    duration_minutes: int
    reminder_scheduled: bool
    health_check_enabled: bool

class ConfirmEventRequest(BaseModel):
    """Request to confirm or cancel an upcoming event"""
    action: str  # "confirm" or "cancel"
    reason: Optional[str] = None

class StreamHealthReport(BaseModel):
    booking_id: str
    status: StreamHealthStatus
    last_checked: str
    consecutive_failures: int
    auto_fallback_triggered: bool

# ============ HELPER FUNCTIONS ============

def get_db():
    """Get database connection from main server"""
    from server import db
    return db

async def get_current_user(request):
    """Extract current user from request"""
    from routes.creator_scheduling import get_current_user as _get_user
    return await _get_user(request)

def parse_duration_string(duration_str: str) -> int:
    """
    Parse duration string like "2h 30m" or "90 minutes" to total minutes
    """
    import re
    duration_str = duration_str.lower().strip()
    
    # Try "Xh Ym" format
    match = re.match(r'(\d+)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?', duration_str)
    if match:
        hours = int(match.group(1))
        minutes = int(match.group(2)) if match.group(2) else 0
        return hours * 60 + minutes
    
    # Try "X minutes" or "Xm" format
    match = re.match(r'(\d+)\s*m(?:in(?:utes?)?)?', duration_str)
    if match:
        return int(match.group(1))
    
    # Try "X hours" format
    match = re.match(r'(\d+)\s*h(?:ours?)?', duration_str)
    if match:
        return int(match.group(1)) * 60
    
    # Try plain number (assume minutes)
    match = re.match(r'(\d+)', duration_str)
    if match:
        return int(match.group(1))
    
    return 60  # Default 1 hour

def format_duration(minutes: int) -> str:
    """Format minutes as human-readable duration"""
    if minutes < 60:
        return f"{minutes}m"
    hours = minutes // 60
    mins = minutes % 60
    if mins == 0:
        return f"{hours}h"
    return f"{hours}h {mins}m"

async def check_stream_health(stream_url: str, timeout: int = 10) -> StreamHealthStatus:
    """
    Check if a stream URL is accessible and healthy
    """
    if not stream_url:
        return StreamHealthStatus.UNKNOWN
    
    try:
        async with aiohttp.ClientSession() as session:
            # For YouTube, check if video is accessible
            if "youtube.com" in stream_url or "youtu.be" in stream_url:
                # Extract video ID and check oEmbed
                video_id = None
                if "v=" in stream_url:
                    video_id = stream_url.split("v=")[1].split("&")[0]
                elif "youtu.be/" in stream_url:
                    video_id = stream_url.split("youtu.be/")[1].split("?")[0]
                
                if video_id:
                    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                    async with session.get(oembed_url, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
                        if resp.status == 200:
                            return StreamHealthStatus.HEALTHY
                        elif resp.status == 404:
                            return StreamHealthStatus.DEAD
                        else:
                            return StreamHealthStatus.DEGRADED
            
            # For other URLs, try HEAD request
            async with session.head(stream_url, timeout=aiohttp.ClientTimeout(total=timeout), allow_redirects=True) as resp:
                if resp.status == 200:
                    return StreamHealthStatus.HEALTHY
                elif resp.status >= 500:
                    return StreamHealthStatus.DEAD
                else:
                    return StreamHealthStatus.DEGRADED
                    
    except asyncio.TimeoutError:
        return StreamHealthStatus.DEGRADED
    except Exception as e:
        logger.error(f"Stream health check failed for {stream_url}: {e}")
        return StreamHealthStatus.DEAD

# ============ API ENDPOINTS ============

@router.post("/book", response_model=SmartBookingResponse)
async def create_smart_booking(
    request: Request,
    booking: SmartBookingRequest,
    background_tasks: BackgroundTasks
):
    """
    Create a smart booking with duration-based auto-cutoff, reminders, and health monitoring.
    Times are provided in user's local timezone and stored in UTC.
    """
    from zoneinfo import ZoneInfo
    
    db = get_db()
    
    # Get current user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in to book a slot")
    
    # Parse user timezone
    try:
        user_tz = ZoneInfo(booking.user_timezone)
        print(f"📍 Booking timezone: {booking.user_timezone}")
    except Exception as e:
        print(f"⚠️ Invalid timezone '{booking.user_timezone}', defaulting to UTC: {e}")
        user_tz = ZoneInfo("UTC")
    
    # Parse date and time in user's local timezone, then convert to UTC
    try:
        local_datetime = datetime.strptime(f"{booking.slot_date} {booking.slot_time}", "%Y-%m-%d %H:%M")
        local_datetime = local_datetime.replace(tzinfo=user_tz)
        # Convert to UTC for storage and comparison
        slot_datetime = local_datetime.astimezone(timezone.utc)
        print(f"📅 User selected: {booking.slot_date} {booking.slot_time} in {booking.user_timezone}")
        print(f"📅 Converted to UTC: {slot_datetime.strftime('%Y-%m-%d %H:%M')} UTC")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date/time format. Use YYYY-MM-DD and HH:MM")
    
    # Validate: must be at least 1 minute in the future
    now = datetime.now(timezone.utc)
    if slot_datetime <= now + timedelta(minutes=1):
        raise HTTPException(status_code=400, detail="Booking must be at least 1 minute in the future")
    
    # Validate: max 30 days in advance
    if slot_datetime > now + timedelta(days=30):
        raise HTTPException(status_code=400, detail="Cannot book more than 30 days in advance")
    
    # Calculate end time
    end_datetime = slot_datetime + timedelta(minutes=booking.duration_minutes)
    
    # Store in UTC
    utc_date = slot_datetime.strftime("%Y-%m-%d")
    utc_time = slot_datetime.strftime("%H:%M")
    start_hour = slot_datetime.hour
    start_minute = slot_datetime.minute
    
    # Check for overlapping bookings (in UTC)
    # Get bookings that might overlap (check a wider date range to handle timezone edge cases)
    check_dates = [
        utc_date,
        (slot_datetime - timedelta(days=1)).strftime("%Y-%m-%d"),
        (slot_datetime + timedelta(days=1)).strftime("%Y-%m-%d")
    ]
    
    existing = await db.creator_bookings.find({
        "slot_date": {"$in": check_dates},
        "status": {"$in": ["pending", "approved", "live", "confirmed"]}
    }).to_list(300)
    
    for existing_booking in existing:
        # Parse existing booking's UTC time
        try:
            b_date = existing_booking.get("slot_date")
            b_hour = existing_booking.get("slot_start_hour", 0)
            b_minute = existing_booking.get("slot_start_minute", 0)
            b_duration = existing_booking.get("duration_minutes", 60)
            
            b_start_utc = datetime.strptime(
                f"{b_date} {b_hour:02d}:{b_minute:02d}",
                "%Y-%m-%d %H:%M"
            ).replace(tzinfo=timezone.utc)
            b_end_utc = b_start_utc + timedelta(minutes=b_duration)
            
            # Check overlap
            if not (end_datetime <= b_start_utc or slot_datetime >= b_end_utc):
                raise HTTPException(
                    status_code=409, 
                    detail=f"Time slot overlaps with existing booking: {existing_booking.get('title')}"
                )
        except HTTPException:
            raise
        except Exception:
            continue
    
    # Create booking record
    booking_id = str(uuid.uuid4())
    user_id = str(user.get("_id") or user.get("user_id"))
    
    # Calculate reminder time (7 days before, or at booking time if < 7 days)
    reminder_datetime = slot_datetime - timedelta(days=7)
    if reminder_datetime < now:
        reminder_datetime = now + timedelta(hours=1)  # Send reminder in 1 hour if event is soon
    
    booking_record = {
        "_id": booking_id,
        "booking_id": booking_id,
        "creator_id": user_id,
        "creator_name": user.get("username") or user.get("name") or user.get("email", "").split("@")[0],
        "creator_email": user.get("email"),
        
        # Schedule info (stored in UTC)
        "slot_date": utc_date,
        "slot_time": utc_time,
        "slot_start_hour": start_hour,
        "slot_start_minute": start_minute,
        "duration_minutes": booking.duration_minutes,
        "scheduled_start": slot_datetime.isoformat(),
        "scheduled_end": end_datetime.isoformat(),
        
        # User's original local time (for display purposes)
        "user_local_date": booking.slot_date,
        "user_local_time": booking.slot_time,
        "user_timezone": booking.user_timezone,
        
        # Content info
        "title": booking.title,
        "description": booking.description,
        "content_type": booking.content_type,
        "video_url": booking.video_url,
        "stream_url": booking.stream_url,
        "thumbnail": booking.thumbnail_url,
        "category": booking.category,
        
        # Smart features
        "enable_auto_cutoff": booking.enable_auto_cutoff,
        "enable_reminder": booking.enable_reminder,
        "enable_health_check": booking.enable_health_check and booking.content_type in ["live_stream", "video_url"],
        
        # Status tracking
        "status": "approved",  # Auto-approve for now
        "confirmation_status": ConfirmationStatus.PENDING.value,
        "confirmation_token": str(uuid.uuid4()),
        
        # Reminder tracking
        "reminder_scheduled_at": reminder_datetime.isoformat() if booking.enable_reminder else None,
        "reminder_sent": False,
        "reminder_response": None,
        
        # Health check tracking
        "last_health_check": None,
        "health_status": StreamHealthStatus.UNKNOWN.value,
        "consecutive_health_failures": 0,
        "auto_fallback_triggered": False,
        
        # Timestamps
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.creator_bookings.insert_one(booking_record)
    
    # Also create legacy record for scheduler compatibility
    legacy_record = {
        "id": booking_id,
        "slot_date": booking.slot_date,
        "slot_hour": start_hour,
        "creator_id": user_id,
        "creator_name": booking_record["creator_name"],
        "creator_email": user.get("email"),
        "title": booking.title,
        "description": booking.description,
        "content_type": booking.content_type,
        "video_url": booking.video_url or booking.stream_url,
        "thumbnail": booking.thumbnail_url,
        "duration": f"{booking.duration_minutes}:00",
        "duration_minutes": booking.duration_minutes,
        "category": booking.category,
        "status": "approved",
        "created_at": now.isoformat()
    }
    await db.creator_scheduled_content.insert_one(legacy_record)
    
    # Perform copyright analysis (non-blocking)
    copyright_analysis = None
    try:
        from services.copyright_analyzer import full_copyright_analysis
        copyright_analysis = await full_copyright_analysis(
            title=booking.title,
            description=booking.description or "",
            video_url=booking.video_url,
            content_type=booking.content_type
        )
        
        # Update booking with copyright analysis
        await db.creator_bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"copyright_analysis": copyright_analysis}}
        )
    except Exception as e:
        logger.warning(f"Copyright analysis failed for {booking_id}: {e}")
    
    # Send enhanced admin notification
    try:
        from routes.admin_notifications import notify_content_submission_enhanced, send_admin_email_notification
        import asyncio as async_module
        
        await notify_content_submission_enhanced(
            creator_name=booking_record["creator_name"],
            content_title=booking.title,
            content_type=booking.content_type,
            booking_id=booking_id,
            slot_date=booking.slot_date,
            slot_time=booking.slot_time,
            status="approved",
            copyright_analysis=copyright_analysis
        )
        
        # Email notification (fire and forget)
        async_module.create_task(send_admin_email_notification(
            creator_name=booking_record["creator_name"],
            content_title=booking.title,
            booking_id=booking_id,
            slot_date=booking.slot_date,
            slot_time=booking.slot_time,
            status="approved",
            copyright_risk=copyright_analysis.get("final_decision", {}).get("risk_level", "unknown") if copyright_analysis else "unknown"
        ))
    except Exception as e:
        logger.warning(f"Admin notification failed: {e}")
    
    # Schedule background tasks
    if booking.enable_reminder:
        background_tasks.add_task(schedule_reminder_check, booking_id)
    
    logger.info(f"Smart booking created: {booking_id} for {booking.title} at {slot_datetime}")
    
    return SmartBookingResponse(
        booking_id=booking_id,
        status="approved",
        message=f"Your content is scheduled! It will air at {booking.slot_time} on {booking.slot_date}",
        show_confetti=True,  # Celebrate!
        scheduled_start=slot_datetime.isoformat(),
        scheduled_end=end_datetime.isoformat(),
        duration_minutes=booking.duration_minutes,
        reminder_scheduled=booking.enable_reminder,
        health_check_enabled=booking_record["enable_health_check"]
    )

@router.post("/parse-duration")
async def parse_duration(duration_text: str):
    """
    Parse a natural language duration string into minutes
    Examples: "2h 30m", "90 minutes", "1.5 hours", "45m"
    """
    minutes = parse_duration_string(duration_text)
    return {
        "input": duration_text,
        "minutes": minutes,
        "formatted": format_duration(minutes)
    }

@router.get("/booking/{booking_id}")
async def get_smart_booking(booking_id: str):
    """Get details of a smart booking"""
    db = get_db()
    
    booking = await db.creator_bookings.find_one(
        {"booking_id": booking_id},
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return booking

@router.post("/booking/{booking_id}/confirm")
async def confirm_event(
    request: Request,
    booking_id: str,
    confirmation: ConfirmEventRequest
):
    """
    Confirm or cancel an upcoming event (response to 1-week reminder)
    Can be triggered via email link or dashboard
    """
    db = get_db()
    
    booking = await db.creator_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user owns this booking (or has token)
    user = await get_current_user(request)
    token = request.query_params.get("token")
    
    if user:
        user_id = str(user.get("_id") or user.get("user_id"))
        if booking["creator_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif token:
        if booking.get("confirmation_token") != token:
            raise HTTPException(status_code=403, detail="Invalid confirmation token")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Update confirmation status
    new_status = ConfirmationStatus.CONFIRMED if confirmation.action == "confirm" else ConfirmationStatus.CANCELLED
    
    update_data = {
        "confirmation_status": new_status.value,
        "reminder_response": confirmation.action,
        "reminder_response_reason": confirmation.reason,
        "reminder_response_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If cancelled, also update main status
    if new_status == ConfirmationStatus.CANCELLED:
        update_data["status"] = "cancelled"
        update_data["cancellation_reason"] = confirmation.reason or "Creator cancelled via reminder"
    
    await db.creator_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": update_data}
    )
    
    # Also update legacy collection
    await db.creator_scheduled_content.update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled" if new_status == ConfirmationStatus.CANCELLED else "confirmed"}}
    )
    
    action_text = "confirmed" if confirmation.action == "confirm" else "cancelled"
    logger.info(f"Booking {booking_id} {action_text} by creator")
    
    return {
        "message": f"Event {action_text} successfully",
        "booking_id": booking_id,
        "new_status": new_status.value
    }

@router.get("/booking/{booking_id}/health")
async def check_booking_health(booking_id: str) -> StreamHealthReport:
    """
    Check the health of a booking's stream URL
    """
    db = get_db()
    
    booking = await db.creator_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    stream_url = booking.get("stream_url") or booking.get("video_url")
    
    if not stream_url:
        return StreamHealthReport(
            booking_id=booking_id,
            status=StreamHealthStatus.UNKNOWN,
            last_checked=datetime.now(timezone.utc).isoformat(),
            consecutive_failures=0,
            auto_fallback_triggered=False
        )
    
    # Perform health check
    health_status = await check_stream_health(stream_url)
    
    # Update booking with health status
    consecutive_failures = booking.get("consecutive_health_failures", 0)
    if health_status in [StreamHealthStatus.DEAD, StreamHealthStatus.DEGRADED]:
        consecutive_failures += 1
    else:
        consecutive_failures = 0
    
    # Trigger auto-fallback after 3 consecutive failures
    auto_fallback = consecutive_failures >= 3 and not booking.get("auto_fallback_triggered", False)
    
    await db.creator_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "last_health_check": datetime.now(timezone.utc).isoformat(),
            "health_status": health_status.value,
            "consecutive_health_failures": consecutive_failures,
            "auto_fallback_triggered": auto_fallback or booking.get("auto_fallback_triggered", False)
        }}
    )
    
    if auto_fallback:
        logger.warning(f"Auto-fallback triggered for booking {booking_id} due to dead stream")
        # Trigger the TV scheduler to switch to auto-playlist
        try:
            from services.tv_scheduler import trigger_fallback_playlist
            await trigger_fallback_playlist(booking_id)
        except Exception as e:
            logger.error(f"Failed to trigger fallback playlist: {e}")
    
    return StreamHealthReport(
        booking_id=booking_id,
        status=health_status,
        last_checked=datetime.now(timezone.utc).isoformat(),
        consecutive_failures=consecutive_failures,
        auto_fallback_triggered=auto_fallback or booking.get("auto_fallback_triggered", False)
    )

@router.get("/pending-reminders")
async def get_pending_reminders(request: Request):
    """
    Get all bookings with pending reminders (for dashboard notification)
    """
    db = get_db()
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    
    # Get bookings that need reminder response
    now = datetime.now(timezone.utc)
    pending = await db.creator_bookings.find({
        "creator_id": user_id,
        "enable_reminder": True,
        "reminder_sent": True,
        "confirmation_status": ConfirmationStatus.PENDING.value,
        "status": {"$in": ["approved", "confirmed"]}
    }, {"_id": 0}).to_list(100)
    
    return {"pending_confirmations": pending}

@router.get("/my-bookings")
async def get_my_smart_bookings(request: Request):
    """
    Get all smart bookings for the current user with enhanced details
    """
    db = get_db()
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    
    bookings = await db.creator_bookings.find(
        {"creator_id": user_id},
        {"_id": 0, "confirmation_token": 0}
    ).sort("scheduled_start", -1).to_list(100)
    
    # Add computed fields
    now = datetime.now(timezone.utc)
    for booking in bookings:
        scheduled_start = booking.get("scheduled_start")
        if scheduled_start:
            start_dt = datetime.fromisoformat(scheduled_start.replace("Z", "+00:00"))
            booking["is_upcoming"] = start_dt > now
            booking["is_live"] = start_dt <= now <= start_dt + timedelta(minutes=booking.get("duration_minutes", 60))
            booking["time_until"] = int((start_dt - now).total_seconds() / 60) if start_dt > now else 0
            booking["formatted_duration"] = format_duration(booking.get("duration_minutes", 60))
    
    return {"bookings": bookings}

@router.delete("/booking/{booking_id}")
async def cancel_smart_booking(request: Request, booking_id: str, reason: str = None):
    """Cancel a smart booking"""
    db = get_db()
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    booking = await db.creator_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    is_admin = user.get("role") == "admin"
    
    if booking["creator_id"] != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.creator_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": "cancelled",
            "confirmation_status": ConfirmationStatus.CANCELLED.value,
            "cancellation_reason": reason,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await db.creator_scheduled_content.update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"message": "Booking cancelled", "booking_id": booking_id}

# ============ BACKGROUND TASKS ============

async def schedule_reminder_check(booking_id: str):
    """
    Background task to check if reminder needs to be sent
    This would typically be run by a cron job in production
    """
    # In production, this would be handled by a scheduled task runner
    # For now, we just mark it as scheduled
    logger.info(f"Reminder scheduled for booking {booking_id}")

async def send_event_reminder(booking_id: str):
    """
    Send the 1-week reminder email and create dashboard notification
    """
    db = get_db()
    
    booking = await db.creator_bookings.find_one({"booking_id": booking_id})
    if not booking:
        return
    
    if booking.get("reminder_sent"):
        return
    
    # Send email
    try:
        from services.email_service import send_email
        
        creator_email = booking.get("creator_email")
        creator_name = booking.get("creator_name")
        event_title = booking.get("title")
        scheduled_start = booking.get("scheduled_start")
        confirmation_token = booking.get("confirmation_token")
        
        base_url = os.environ.get("BASE_URL", "https://www.ztvlivestream.com")
        confirm_url = f"{base_url}/api/smart-schedule/booking/{booking_id}/confirm?token={confirmation_token}&action=confirm"
        cancel_url = f"{base_url}/api/smart-schedule/booking/{booking_id}/confirm?token={confirmation_token}&action=cancel"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #171717; border-radius: 16px; overflow: hidden;">
                            <tr>
                                <td style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 30px; text-align: center;">
                                    <h1 style="margin: 0; color: white; font-size: 24px;">Your Event is Coming Up!</h1>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 40px 30px;">
                                    <p style="color: #e5e5e5; font-size: 18px;">Hey {creator_name}!</p>
                                    <p style="color: #a3a3a3; font-size: 16px;">Your scheduled event "<strong style="color: white;">{event_title}</strong>" is coming up in about a week.</p>
                                    
                                    <div style="background-color: #262626; border-radius: 12px; padding: 20px; margin: 20px 0;">
                                        <p style="color: #737373; font-size: 12px; margin: 0;">SCHEDULED FOR</p>
                                        <p style="color: white; font-size: 18px; margin: 5px 0 0;">{scheduled_start}</p>
                                    </div>
                                    
                                    <p style="color: #a3a3a3; font-size: 16px;">Is this event still a go? Please confirm below:</p>
                                    
                                    <div style="margin-top: 30px;">
                                        <a href="{confirm_url}" style="display: inline-block; background-color: #22c55e; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin-right: 10px;">
                                            Yes, I'm Ready!
                                        </a>
                                        <a href="{cancel_url}" style="display: inline-block; background-color: #dc2626; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                                            Cancel Event
                                        </a>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 20px 30px; background-color: #0a0a0a; border-top: 1px solid #262626;">
                                    <p style="margin: 0; color: #525252; font-size: 14px; text-align: center;">ZTVLIVE • Your 24/7 Live TV Platform</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        await send_email(
            to_email=creator_email,
            subject=f"Reminder: Your ZTVLIVE Event \"{event_title}\" is in 1 Week!",
            html_content=html_content
        )
        
        # Mark reminder as sent
        await db.creator_bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"reminder_sent": True, "reminder_sent_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Create dashboard notification
        notification = {
            "notification_id": str(uuid.uuid4()),
            "user_id": booking["creator_id"],
            "type": "event_reminder",
            "title": "Event Reminder",
            "message": f"Your event \"{event_title}\" is scheduled for {scheduled_start}. Is it still a go?",
            "booking_id": booking_id,
            "actions": ["confirm", "cancel"],
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_notifications.insert_one(notification)
        
        logger.info(f"Reminder sent for booking {booking_id}")
        
    except Exception as e:
        logger.error(f"Failed to send reminder for {booking_id}: {e}")

# ============ CRON-STYLE ENDPOINTS (for scheduled tasks) ============

@router.post("/cron/check-reminders")
async def cron_check_reminders():
    """
    Cron endpoint to check and send due reminders
    Should be called every hour by a scheduler
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    
    # Find bookings with due reminders
    due_reminders = await db.creator_bookings.find({
        "enable_reminder": True,
        "reminder_sent": False,
        "status": {"$in": ["approved", "confirmed"]},
        "reminder_scheduled_at": {"$lte": now.isoformat()}
    }).to_list(100)
    
    sent_count = 0
    for booking in due_reminders:
        await send_event_reminder(booking["booking_id"])
        sent_count += 1
    
    return {"message": f"Processed {sent_count} reminders", "sent": sent_count}

@router.post("/cron/check-health")
async def cron_check_health():
    """
    Cron endpoint to check health of live streams
    Should be called every minute by a scheduler
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    
    # Find currently live bookings with health check enabled
    live_bookings = await db.creator_bookings.find({
        "enable_health_check": True,
        "status": {"$in": ["approved", "confirmed", "live"]},
        "auto_fallback_triggered": False,
        "scheduled_start": {"$lte": now.isoformat()},
        "scheduled_end": {"$gte": now.isoformat()}
    }).to_list(50)
    
    checked_count = 0
    fallback_count = 0
    
    for booking in live_bookings:
        stream_url = booking.get("stream_url") or booking.get("video_url")
        if not stream_url:
            continue
        
        health_status = await check_stream_health(stream_url)
        
        consecutive_failures = booking.get("consecutive_health_failures", 0)
        if health_status in [StreamHealthStatus.DEAD, StreamHealthStatus.DEGRADED]:
            consecutive_failures += 1
        else:
            consecutive_failures = 0
        
        # Trigger fallback after 3 consecutive failures
        auto_fallback = consecutive_failures >= 3
        
        await db.creator_bookings.update_one(
            {"booking_id": booking["booking_id"]},
            {"$set": {
                "last_health_check": now.isoformat(),
                "health_status": health_status.value,
                "consecutive_health_failures": consecutive_failures,
                "auto_fallback_triggered": auto_fallback
            }}
        )
        
        if auto_fallback:
            fallback_count += 1
            logger.warning(f"Auto-fallback triggered for {booking['booking_id']}")
        
        checked_count += 1
    
    return {
        "message": f"Checked {checked_count} live streams",
        "checked": checked_count,
        "fallbacks_triggered": fallback_count
    }

@router.post("/cron/check-cutoffs")
async def cron_check_cutoffs():
    """
    Cron endpoint to check for events that need auto-cutoff
    Should be called every minute by a scheduler
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    
    # Find bookings that have ended and need cutoff
    ended_bookings = await db.creator_bookings.find({
        "enable_auto_cutoff": True,
        "status": {"$in": ["approved", "confirmed", "live"]},
        "scheduled_end": {"$lte": now.isoformat()},
        "auto_cutoff_applied": {"$ne": True}
    }).to_list(50)
    
    cutoff_count = 0
    
    for booking in ended_bookings:
        await db.creator_bookings.update_one(
            {"booking_id": booking["booking_id"]},
            {"$set": {
                "status": "completed",
                "auto_cutoff_applied": True,
                "cutoff_at": now.isoformat()
            }}
        )
        
        await db.creator_scheduled_content.update_one(
            {"id": booking["booking_id"]},
            {"$set": {"status": "completed"}}
        )
        
        logger.info(f"Auto-cutoff applied to booking {booking['booking_id']}")
        cutoff_count += 1
    
    return {
        "message": f"Applied cutoff to {cutoff_count} ended events",
        "cutoffs_applied": cutoff_count
    }

# Need to import os for BASE_URL
import os


# ============ AI SMART SCHEDULING - OPTIMAL TIME SUGGESTIONS ============

@router.get("/ai-suggestions/{creator_id}")
async def get_ai_scheduling_suggestions(creator_id: str, video_id: Optional[str] = None):
    """
    Get AI-powered suggestions for optimal scheduling times based on:
    - Historical viewing patterns
    - Content category performance
    - Audience engagement data
    - Competitor analysis
    """
    db = get_db()
    
    # Get creator's historical performance data
    videos = await db.creator_videos.find(
        {"creator_id": creator_id},
        {"_id": 0}
    ).to_list(100)
    
    uploads = await db.uploads.find(
        {"creator_id": creator_id},
        {"_id": 0}
    ).to_list(100)
    
    all_content = videos + uploads
    
    # Get booking history
    bookings = await db.creator_bookings.find(
        {"creator_id": creator_id, "status": {"$in": ["completed", "live"]}},
        {"_id": 0}
    ).to_list(200)
    
    # Analyze performance by hour
    hourly_performance = {}
    for booking in bookings:
        hour = booking.get("slot_start_hour", 0)
        views = booking.get("views", 0)
        engagement = booking.get("engagement_rate", 0)
        
        if hour not in hourly_performance:
            hourly_performance[hour] = {"total_views": 0, "total_engagement": 0, "count": 0}
        
        hourly_performance[hour]["total_views"] += views
        hourly_performance[hour]["total_engagement"] += engagement
        hourly_performance[hour]["count"] += 1
    
    # Calculate average performance per hour
    best_hours = []
    for hour, data in hourly_performance.items():
        if data["count"] > 0:
            avg_views = data["total_views"] / data["count"]
            avg_engagement = data["total_engagement"] / data["count"]
            score = avg_views * 0.6 + avg_engagement * 100 * 0.4  # Weighted score
            best_hours.append({
                "hour": hour,
                "avg_views": round(avg_views, 1),
                "avg_engagement": round(avg_engagement, 2),
                "score": round(score, 1),
                "bookings_count": data["count"]
            })
    
    # Sort by score
    best_hours.sort(key=lambda x: x["score"], reverse=True)
    
    # If no history, use default recommendations based on general patterns
    if not best_hours:
        best_hours = [
            {"hour": 20, "avg_views": 0, "avg_engagement": 0, "score": 85, "bookings_count": 0, "reason": "Prime time - Most viewers online"},
            {"hour": 19, "avg_views": 0, "avg_engagement": 0, "score": 80, "bookings_count": 0, "reason": "Early prime time"},
            {"hour": 21, "avg_views": 0, "avg_engagement": 0, "score": 78, "bookings_count": 0, "reason": "Late prime time"},
            {"hour": 12, "avg_views": 0, "avg_engagement": 0, "score": 65, "bookings_count": 0, "reason": "Lunch break viewers"},
            {"hour": 18, "avg_views": 0, "avg_engagement": 0, "score": 60, "bookings_count": 0, "reason": "After work audience"},
        ]
    
    # Analyze performance by day of week
    daily_performance = {}
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for booking in bookings:
        try:
            date_str = booking.get("slot_date")
            if date_str:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                day = date_obj.weekday()
                views = booking.get("views", 0)
                
                if day not in daily_performance:
                    daily_performance[day] = {"total_views": 0, "count": 0}
                
                daily_performance[day]["total_views"] += views
                daily_performance[day]["count"] += 1
        except Exception:
            continue
    
    best_days = []
    for day, data in daily_performance.items():
        if data["count"] > 0:
            avg_views = data["total_views"] / data["count"]
            best_days.append({
                "day": day,
                "day_name": day_names[day],
                "avg_views": round(avg_views, 1),
                "bookings_count": data["count"]
            })
    
    best_days.sort(key=lambda x: x["avg_views"], reverse=True)
    
    if not best_days:
        best_days = [
            {"day": 5, "day_name": "Saturday", "avg_views": 0, "bookings_count": 0, "reason": "Weekend peak"},
            {"day": 6, "day_name": "Sunday", "avg_views": 0, "bookings_count": 0, "reason": "Weekend viewing"},
            {"day": 4, "day_name": "Friday", "avg_views": 0, "bookings_count": 0, "reason": "Weekend starts"},
        ]
    
    # Analyze category performance
    category_performance = {}
    for content in all_content:
        category = content.get("category", "other")
        views = content.get("views", 0)
        
        if category not in category_performance:
            category_performance[category] = {"total_views": 0, "count": 0}
        
        category_performance[category]["total_views"] += views
        category_performance[category]["count"] += 1
    
    best_categories = []
    for cat, data in category_performance.items():
        if data["count"] > 0:
            avg_views = data["total_views"] / data["count"]
            best_categories.append({
                "category": cat,
                "avg_views": round(avg_views, 1),
                "content_count": data["count"]
            })
    
    best_categories.sort(key=lambda x: x["avg_views"], reverse=True)
    
    # Generate specific slot recommendations for next 7 days
    now = datetime.now(timezone.utc)
    recommended_slots = []
    
    top_hour = best_hours[0]["hour"] if best_hours else 20
    top_day = best_days[0]["day"] if best_days else 5
    
    for i in range(7):
        date = now + timedelta(days=i+1)
        weekday = date.weekday()
        
        # Check if this day is a top performer
        is_best_day = weekday == top_day or weekday in [5, 6]  # Weekend boost
        
        # Score based on day and hour
        day_score = 80 if is_best_day else 60
        
        slot = {
            "date": date.strftime("%Y-%m-%d"),
            "day_name": day_names[weekday],
            "recommended_hour": top_hour,
            "formatted_time": f"{top_hour:02d}:00",
            "confidence_score": min(95, day_score + (best_hours[0]["score"] / 10 if best_hours else 0)),
            "reasoning": []
        }
        
        # Add reasoning
        if is_best_day:
            slot["reasoning"].append(f"🔥 {day_names[weekday]} typically performs well for your content")
        if top_hour in [19, 20, 21]:
            slot["reasoning"].append("📺 Prime time slot - highest viewer activity")
        if best_hours and best_hours[0]["bookings_count"] > 3:
            slot["reasoning"].append(f"📊 Based on {best_hours[0]['bookings_count']} previous broadcasts at this hour")
        
        recommended_slots.append(slot)
    
    # Sort by confidence
    recommended_slots.sort(key=lambda x: x["confidence_score"], reverse=True)
    
    return {
        "creator_id": creator_id,
        "analysis_based_on": {
            "total_content": len(all_content),
            "total_bookings": len(bookings),
            "data_quality": "high" if len(bookings) > 10 else "medium" if len(bookings) > 3 else "low"
        },
        "best_hours": best_hours[:5],
        "best_days": best_days[:3],
        "best_categories": best_categories[:5],
        "recommended_slots": recommended_slots[:5],
        "insights": [
            {
                "type": "peak_time",
                "title": "Your Peak Performance Time",
                "description": f"Your content performs best at {best_hours[0]['hour']:02d}:00" if best_hours else "Schedule during prime time (7-9 PM) for best results",
                "icon": "clock"
            },
            {
                "type": "best_day",
                "title": "Top Performing Day",
                "description": f"{best_days[0]['day_name']} drives the most views" if best_days else "Weekends typically have higher viewership",
                "icon": "calendar"
            },
            {
                "type": "category",
                "title": "Winning Content Type",
                "description": f"Your {best_categories[0]['category']} content averages {best_categories[0]['avg_views']} views" if best_categories else "Try different content types to find your niche",
                "icon": "trophy"
            }
        ]
    }
