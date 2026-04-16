"""
ZTVLIVE Creator Live Status System
Real-time notifications and countdown for creators when their content goes live.

Features:
- Countdown banner showing time until content goes live
- Real-time "Your content is LIVE!" notification
- Join Live button to watch their content playing
- WebSocket notifications for schedule changes
"""

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
import uuid
import asyncio
import logging
import json

router = APIRouter(prefix="/creator-live", tags=["Creator Live Status"])
logger = logging.getLogger("creator_live")

# Database reference - will be set from server.py
db = None

def set_database(database):
    global db
    db = database

# Active WebSocket connections for live updates
_live_connections: Dict[str, List[WebSocket]] = {}  # creator_id -> [websockets]


# ============ MODELS ============

class LiveStatusResponse:
    def __init__(self, is_live: bool, is_upcoming: bool, countdown_seconds: int,
                 booking_id: str, title: str, message: str, watch_url: str = None):
        self.is_live = is_live
        self.is_upcoming = is_upcoming
        self.countdown_seconds = countdown_seconds
        self.booking_id = booking_id
        self.title = title
        self.message = message
        self.watch_url = watch_url


# ============ HELPER FUNCTIONS ============

async def get_current_user(request):
    """Extract current user from request - handles both JWT and session tokens"""
    import jwt
    import os
    
    if request is None:
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
        return None
    
    # First try JWT decode
    try:
        secret = os.environ.get("JWT_SECRET", "your-secret-key")
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if user_id:
            # Fetch user from database
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
            if user:
                return user
    except jwt.InvalidTokenError:
        pass
    except Exception:
        pass
    
    # Fall back to session token lookup
    try:
        session_doc = await db.user_sessions.find_one(
            {"session_token": token},
            {"_id": 0}
        )
        
        if session_doc:
            from datetime import datetime, timezone
            expires_at = session_doc.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if not expires_at or expires_at > datetime.now(timezone.utc):
                return session_doc
    except Exception:
        pass
    
    return None


async def get_creator_upcoming_booking(creator_id: str) -> Optional[Dict]:
    """Get the next upcoming booking for a creator within 24 hours"""
    if db is None:
        return None
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Find upcoming approved bookings
    bookings = await db.creator_bookings.find({
        "creator_id": creator_id,
        "slot_date": {"$in": [today, tomorrow]},
        "status": {"$in": ["approved", "confirmed", "live"]}
    }).sort("slot_date", 1).sort("slot_start_hour", 1).to_list(10)
    
    for booking in bookings:
        # Parse booking time
        slot_date = booking.get("slot_date")
        slot_hour = booking.get("slot_start_hour", 0)
        slot_minute = booking.get("slot_start_minute", 0)
        duration_minutes = booking.get("duration_minutes", 60)
        
        try:
            booking_start = datetime.strptime(
                f"{slot_date} {slot_hour:02d}:{slot_minute:02d}",
                "%Y-%m-%d %H:%M"
            ).replace(tzinfo=timezone.utc)
            booking_end = booking_start + timedelta(minutes=duration_minutes)
            
            # Check if this booking is upcoming or currently live
            if now < booking_end:
                booking["_parsed_start"] = booking_start
                booking["_parsed_end"] = booking_end
                return booking
        except Exception as e:
            logger.error(f"Error parsing booking time: {e}")
            continue
    
    return None


async def get_creator_live_booking(creator_id: str) -> Optional[Dict]:
    """Get booking that is currently live for a creator"""
    if db is None:
        return None
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    current_hour = now.hour
    current_minute = now.minute
    
    # Find bookings for current time
    bookings = await db.creator_bookings.find({
        "creator_id": creator_id,
        "slot_date": today,
        "status": {"$in": ["approved", "confirmed", "live"]}
    }).to_list(10)
    
    for booking in bookings:
        slot_hour = booking.get("slot_start_hour", 0)
        slot_minute = booking.get("slot_start_minute", 0)
        duration_minutes = booking.get("duration_minutes", 60)
        
        # Calculate booking time range in minutes
        booking_start_minutes = slot_hour * 60 + slot_minute
        booking_end_minutes = booking_start_minutes + duration_minutes
        current_minutes = current_hour * 60 + current_minute
        
        # Check if we're within the booking time
        if booking_start_minutes <= current_minutes < booking_end_minutes:
            return booking
    
    return None


# ============ API ENDPOINTS ============

@router.get("/my-status")
async def get_my_live_status(request: Request):
    """
    Get the current live status for the logged-in creator.
    Returns countdown info if content is upcoming, or live status if content is playing.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    creator_id = str(user.get("_id") or user.get("user_id"))
    now = datetime.now(timezone.utc)
    
    # Check if currently live
    live_booking = await get_creator_live_booking(creator_id)
    if live_booking:
        # Calculate remaining time
        slot_hour = live_booking.get("slot_start_hour", 0)
        slot_minute = live_booking.get("slot_start_minute", 0)
        duration_minutes = live_booking.get("duration_minutes", 60)
        
        slot_date = live_booking.get("slot_date")
        booking_start = datetime.strptime(
            f"{slot_date} {slot_hour:02d}:{slot_minute:02d}",
            "%Y-%m-%d %H:%M"
        ).replace(tzinfo=timezone.utc)
        booking_end = booking_start + timedelta(minutes=duration_minutes)
        
        remaining_seconds = int((booking_end - now).total_seconds())
        elapsed_seconds = int((now - booking_start).total_seconds())
        
        return {
            "status": "live",
            "is_live": True,
            "is_upcoming": False,
            "booking_id": live_booking.get("booking_id"),
            "title": live_booking.get("title"),
            "thumbnail": live_booking.get("thumbnail"),
            "video_url": live_booking.get("video_url"),
            "started_at": booking_start.isoformat(),
            "ends_at": booking_end.isoformat(),
            "elapsed_seconds": elapsed_seconds,
            "remaining_seconds": remaining_seconds,
            "duration_minutes": duration_minutes,
            "watch_url": "/watch",
            "message": f"Your content '{live_booking.get('title')}' is LIVE NOW! 🔴",
            "banner": {
                "type": "live",
                "title": "🔴 YOU'RE LIVE!",
                "subtitle": f"'{live_booking.get('title')}' is streaming to viewers right now!",
                "cta_text": "Watch Live",
                "cta_url": "/watch",
                "remaining_formatted": f"{remaining_seconds // 60}:{remaining_seconds % 60:02d} remaining"
            }
        }
    
    # Check for upcoming booking
    upcoming = await get_creator_upcoming_booking(creator_id)
    if upcoming:
        booking_start = upcoming.get("_parsed_start")
        if not booking_start:
            slot_date = upcoming.get("slot_date")
            slot_hour = upcoming.get("slot_start_hour", 0)
            slot_minute = upcoming.get("slot_start_minute", 0)
            booking_start = datetime.strptime(
                f"{slot_date} {slot_hour:02d}:{slot_minute:02d}",
                "%Y-%m-%d %H:%M"
            ).replace(tzinfo=timezone.utc)
        
        countdown_seconds = int((booking_start - now).total_seconds())
        
        # Format countdown
        if countdown_seconds < 60:
            countdown_text = f"{countdown_seconds} seconds"
        elif countdown_seconds < 3600:
            minutes = countdown_seconds // 60
            seconds = countdown_seconds % 60
            countdown_text = f"{minutes}:{seconds:02d}"
        else:
            hours = countdown_seconds // 3600
            minutes = (countdown_seconds % 3600) // 60
            countdown_text = f"{hours}h {minutes}m"
        
        # Determine banner urgency
        if countdown_seconds <= 30:
            banner_type = "imminent"
            banner_title = "⏰ GOING LIVE IN SECONDS!"
        elif countdown_seconds <= 60:
            banner_type = "soon"
            banner_title = "⏰ GOING LIVE IN 1 MINUTE!"
        elif countdown_seconds <= 300:
            banner_type = "soon"
            banner_title = f"⏰ GOING LIVE IN {countdown_seconds // 60} MINUTES!"
        else:
            banner_type = "upcoming"
            banner_title = "📅 Scheduled"
        
        return {
            "status": "upcoming",
            "is_live": False,
            "is_upcoming": True,
            "booking_id": upcoming.get("booking_id"),
            "title": upcoming.get("title"),
            "thumbnail": upcoming.get("thumbnail"),
            "video_url": upcoming.get("video_url"),
            "scheduled_start": booking_start.isoformat(),
            "countdown_seconds": countdown_seconds,
            "countdown_formatted": countdown_text,
            "message": f"Your content goes live in {countdown_text}!",
            "banner": {
                "type": banner_type,
                "title": banner_title,
                "subtitle": f"'{upcoming.get('title')}' starts in {countdown_text}",
                "countdown_seconds": countdown_seconds,
                "cta_text": "Get Ready",
                "cta_url": "/watch"
            }
        }
    
    # No upcoming or live content
    return {
        "status": "idle",
        "is_live": False,
        "is_upcoming": False,
        "booking_id": None,
        "title": None,
        "message": "No scheduled content in the next 24 hours",
        "banner": None,
        "cta": {
            "text": "Schedule Content",
            "url": "/creator/schedule"
        }
    }


@router.get("/booking/{booking_id}/status")
async def get_booking_live_status(booking_id: str):
    """
    Get the live status for a specific booking.
    Can be used by anyone to check if a scheduled show is currently live.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    booking = await db.creator_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    now = datetime.now(timezone.utc)
    slot_date = booking.get("slot_date")
    slot_hour = booking.get("slot_start_hour", 0)
    slot_minute = booking.get("slot_start_minute", 0)
    duration_minutes = booking.get("duration_minutes", 60)
    
    try:
        booking_start = datetime.strptime(
            f"{slot_date} {slot_hour:02d}:{slot_minute:02d}",
            "%Y-%m-%d %H:%M"
        ).replace(tzinfo=timezone.utc)
        booking_end = booking_start + timedelta(minutes=duration_minutes)
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid booking time format")
    
    if now < booking_start:
        # Upcoming
        countdown_seconds = int((booking_start - now).total_seconds())
        return {
            "status": "upcoming",
            "is_live": False,
            "countdown_seconds": countdown_seconds,
            "scheduled_start": booking_start.isoformat(),
            "title": booking.get("title"),
            "creator_name": booking.get("creator_name")
        }
    elif booking_start <= now < booking_end:
        # Live
        elapsed = int((now - booking_start).total_seconds())
        remaining = int((booking_end - now).total_seconds())
        return {
            "status": "live",
            "is_live": True,
            "elapsed_seconds": elapsed,
            "remaining_seconds": remaining,
            "watch_url": "/watch",
            "title": booking.get("title"),
            "creator_name": booking.get("creator_name")
        }
    else:
        # Ended
        return {
            "status": "ended",
            "is_live": False,
            "ended_at": booking_end.isoformat(),
            "title": booking.get("title"),
            "creator_name": booking.get("creator_name")
        }


@router.get("/currently-live")
async def get_currently_live_creator():
    """
    Get information about what creator content (if any) is currently live.
    Used by the watch page to show creator spotlight.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    current_hour = now.hour
    current_minute = now.minute
    current_minutes = current_hour * 60 + current_minute
    
    # Find all approved bookings for today
    bookings = await db.creator_bookings.find({
        "slot_date": today,
        "status": {"$in": ["approved", "confirmed", "live"]}
    }).to_list(50)
    
    for booking in bookings:
        slot_hour = booking.get("slot_start_hour", 0)
        slot_minute = booking.get("slot_start_minute", 0)
        duration_minutes = booking.get("duration_minutes", 60)
        
        booking_start_minutes = slot_hour * 60 + slot_minute
        booking_end_minutes = booking_start_minutes + duration_minutes
        
        if booking_start_minutes <= current_minutes < booking_end_minutes:
            # This booking is live
            booking_start = datetime.strptime(
                f"{today} {slot_hour:02d}:{slot_minute:02d}",
                "%Y-%m-%d %H:%M"
            ).replace(tzinfo=timezone.utc)
            booking_end = booking_start + timedelta(minutes=duration_minutes)
            
            elapsed = int((now - booking_start).total_seconds())
            remaining = int((booking_end - now).total_seconds())
            
            return {
                "is_creator_content_live": True,
                "booking_id": booking.get("booking_id"),
                "title": booking.get("title"),
                "description": booking.get("description"),
                "thumbnail": booking.get("thumbnail"),
                "video_url": booking.get("video_url"),
                "creator_name": booking.get("creator_name"),
                "creator_id": booking.get("creator_id"),
                "elapsed_seconds": elapsed,
                "remaining_seconds": remaining,
                "duration_minutes": duration_minutes,
                "progress_percent": round((elapsed / (duration_minutes * 60)) * 100, 1),
                "banner_message": f"Now Playing: {booking.get('title')} by {booking.get('creator_name')}"
            }
    
    return {
        "is_creator_content_live": False,
        "message": "No creator content currently live"
    }


@router.get("/upcoming-shows")
async def get_upcoming_shows(limit: int = 5):
    """
    Get upcoming scheduled creator shows for the next 24 hours.
    Used to display "Coming Up Next" on the watch page.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    current_hour = now.hour
    current_minute = now.minute
    
    # Get bookings for today and tomorrow
    bookings = await db.creator_bookings.find({
        "slot_date": {"$in": [today, tomorrow]},
        "status": {"$in": ["approved", "confirmed"]}
    }).to_list(50)
    
    upcoming = []
    for booking in bookings:
        slot_date = booking.get("slot_date")
        slot_hour = booking.get("slot_start_hour", 0)
        slot_minute = booking.get("slot_start_minute", 0)
        
        try:
            booking_start = datetime.strptime(
                f"{slot_date} {slot_hour:02d}:{slot_minute:02d}",
                "%Y-%m-%d %H:%M"
            ).replace(tzinfo=timezone.utc)
            
            # Only include future shows
            if booking_start > now:
                countdown = int((booking_start - now).total_seconds())
                upcoming.append({
                    "booking_id": booking.get("booking_id"),
                    "title": booking.get("title"),
                    "thumbnail": booking.get("thumbnail"),
                    "creator_name": booking.get("creator_name"),
                    "scheduled_start": booking_start.isoformat(),
                    "countdown_seconds": countdown,
                    "duration_minutes": booking.get("duration_minutes", 60)
                })
        except Exception:
            continue
    
    # Sort by start time and limit
    upcoming.sort(key=lambda x: x["countdown_seconds"])
    
    return {
        "upcoming_shows": upcoming[:limit],
        "total_upcoming": len(upcoming)
    }


# ============ WEBSOCKET FOR REAL-TIME UPDATES ============

@router.websocket("/ws/{creator_id}")
async def creator_live_websocket(websocket: WebSocket, creator_id: str):
    """
    WebSocket connection for real-time live status updates for a creator.
    Sends countdown updates and live notifications.
    """
    await websocket.accept()
    
    # Add to connections
    if creator_id not in _live_connections:
        _live_connections[creator_id] = []
    _live_connections[creator_id].append(websocket)
    
    try:
        while True:
            # Send status update every second when close to going live
            upcoming = await get_creator_upcoming_booking(creator_id)
            live = await get_creator_live_booking(creator_id)
            
            now = datetime.now(timezone.utc)
            
            if live:
                # Content is live
                slot_date = live.get("slot_date")
                slot_hour = live.get("slot_start_hour", 0)
                slot_minute = live.get("slot_start_minute", 0)
                duration_minutes = live.get("duration_minutes", 60)
                
                booking_start = datetime.strptime(
                    f"{slot_date} {slot_hour:02d}:{slot_minute:02d}",
                    "%Y-%m-%d %H:%M"
                ).replace(tzinfo=timezone.utc)
                booking_end = booking_start + timedelta(minutes=duration_minutes)
                
                remaining = int((booking_end - now).total_seconds())
                
                await websocket.send_json({
                    "type": "live",
                    "title": live.get("title"),
                    "remaining_seconds": remaining,
                    "watch_url": "/watch"
                })
                
                await asyncio.sleep(5)  # Update every 5 seconds when live
                
            elif upcoming:
                booking_start = upcoming.get("_parsed_start")
                if booking_start:
                    countdown = int((booking_start - now).total_seconds())
                    
                    # Determine update frequency based on countdown
                    if countdown <= 30:
                        sleep_time = 1  # Every second when imminent
                    elif countdown <= 60:
                        sleep_time = 5
                    elif countdown <= 300:
                        sleep_time = 10
                    else:
                        sleep_time = 30
                    
                    await websocket.send_json({
                        "type": "countdown",
                        "title": upcoming.get("title"),
                        "countdown_seconds": countdown,
                        "imminent": countdown <= 30
                    })
                    
                    await asyncio.sleep(sleep_time)
                else:
                    await asyncio.sleep(30)
            else:
                # No upcoming content
                await websocket.send_json({
                    "type": "idle",
                    "message": "No upcoming content"
                })
                await asyncio.sleep(60)  # Check every minute when idle
                
    except WebSocketDisconnect:
        # Remove from connections
        if creator_id in _live_connections:
            _live_connections[creator_id].remove(websocket)
            if not _live_connections[creator_id]:
                del _live_connections[creator_id]
    except Exception as e:
        logger.error(f"WebSocket error for {creator_id}: {e}")
        if creator_id in _live_connections and websocket in _live_connections[creator_id]:
            _live_connections[creator_id].remove(websocket)


async def notify_creator_going_live(creator_id: str, booking: Dict):
    """Send notification to creator when their content goes live"""
    if creator_id in _live_connections:
        for ws in _live_connections[creator_id]:
            try:
                await ws.send_json({
                    "type": "going_live",
                    "title": booking.get("title"),
                    "message": f"Your content '{booking.get('title')}' is NOW LIVE!",
                    "watch_url": "/watch"
                })
            except Exception:
                pass


# ============ SCHEDULE CHECKER (Called by background scheduler) ============

async def check_and_mark_live_bookings():
    """
    Background task to mark bookings as 'live' when their time comes.
    Also triggers notifications to creators AND fans (email + push).
    Uses actual TRT (video duration) when available instead of booked duration.
    """
    if db is None:
        return
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    current_hour = now.hour
    current_minute = now.minute
    current_second = now.second
    current_total_seconds = (current_hour * 60 + current_minute) * 60 + current_second
    
    # Find approved bookings that should be live now but aren't marked as live
    bookings = await db.creator_bookings.find({
        "slot_date": today,
        "status": {"$in": ["approved", "live"]}
    }).to_list(50)
    
    for booking in bookings:
        slot_hour = booking.get("slot_start_hour", 0)
        slot_minute = booking.get("slot_start_minute", 0)
        
        # Use actual TRT if available, otherwise use duration_minutes
        trt_seconds = booking.get("trt_seconds") or booking.get("video_duration_seconds")
        if trt_seconds and trt_seconds > 0:
            duration_seconds = trt_seconds
        else:
            duration_seconds = booking.get("duration_minutes", 60) * 60
        
        booking_start_seconds = (slot_hour * 60 + slot_minute) * 60
        booking_end_seconds = booking_start_seconds + duration_seconds
        
        if booking.get("status") == "approved" and booking_start_seconds <= current_total_seconds < booking_end_seconds:
            # Mark as live
            await db.creator_bookings.update_one(
                {"booking_id": booking.get("booking_id")},
                {"$set": {"status": "live", "went_live_at": now.isoformat()}}
            )
            
            # Notify creator via WebSocket
            await notify_creator_going_live(booking.get("creator_id"), booking)
            
            # Notify fans via email AND push notifications
            try:
                from routes.fan_notifications import notify_fans_content_live
                result = await notify_fans_content_live(
                    creator_id=booking.get("creator_id"),
                    creator_name=booking.get("creator_name", "Creator"),
                    content_title=booking.get("title", "Live Content"),
                    watch_url=f"https://www.ztvlivestream.com/watch?event={booking.get('booking_id')}",
                    thumbnail=booking.get("thumbnail")
                )
                logger.info(f"Fan notifications sent for booking {booking.get('booking_id')}: {result}")
            except Exception as e:
                logger.error(f"Failed to notify fans: {e}")
            
            logger.info(f"Booking {booking.get('booking_id')} marked as LIVE (TRT: {duration_seconds}s)")
        
        elif booking.get("status") == "live" and current_total_seconds >= booking_end_seconds:
            # Mark as completed - the video has ended based on TRT
            await db.creator_bookings.update_one(
                {"booking_id": booking.get("booking_id")},
                {"$set": {"status": "completed", "completed_at": now.isoformat()}}
            )
            logger.info(f"Booking {booking.get('booking_id')} marked as COMPLETED (ended after {duration_seconds}s)")
