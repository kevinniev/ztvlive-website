"""
ZTVLIVE Big Screen Show Scheduler
Schedules and manages the 30-minute "Unusual Fun Game Show" broadcasts

Features:
- Scheduled show triggers (e.g., 11:45 AM, 10:00 PM)
- 30-minute show duration with 3 rounds
- 5-minute cooldown after game ends
- Auto-return to playlist (checks for creator schedules first)
- Roku/Fire TV feed integration
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
import uuid
import asyncio
import logging

router = APIRouter(prefix="/bigscreen-show", tags=["Big Screen Show"])
logger = logging.getLogger("bigscreen_show")

# ============ SHOW CONFIGURATION ============

SHOW_CONFIG = {
    "name": "ZTVLIVE Unusual Fun Game Show",
    "duration_minutes": 30,
    "cooldown_minutes": 5,
    "rounds": 3,
    "round_duration_minutes": 10,
    "prizes": {
        1: {"amount": 5, "label": "$5 DoorDash"},
        2: {"amount": 10, "label": "$10 DoorDash"},
        3: {"amount": 15, "label": "$15 DoorDash"}
    },
    "intro_duration_seconds": 120,  # 2 minutes for intro
    "outro_duration_seconds": 120,  # 2 minutes for outro/cooldown
}

# ============ SHOW STATE ============

# Active show state
active_show: Dict = None

# Scheduled shows
scheduled_shows: List[Dict] = []

# Show history
show_history: List[Dict] = []

# ============ MODELS ============

class ScheduleShowRequest(BaseModel):
    """Request to schedule a Big Screen show"""
    show_time: str  # Format: HH:MM (24-hour, UTC)
    show_date: Optional[str] = None  # Format: YYYY-MM-DD (defaults to today)
    recurring: bool = False  # Daily recurring show
    push_to_roku: bool = True
    push_to_firetv: bool = True
    priority: int = Field(default=10, ge=1, le=100, description="Priority over other content")

class ShowStatus(BaseModel):
    """Current show status"""
    is_live: bool
    show_id: Optional[str]
    phase: Optional[str]  # intro, round_1, round_2, round_3, cooldown, ended
    current_round: Optional[int]
    time_remaining_seconds: Optional[int]
    players_count: Optional[int]
    round_winners: Optional[List[Dict]]

# ============ HELPER FUNCTIONS ============

def get_utc_now():
    return datetime.now(timezone.utc)

def parse_show_time(time_str: str, date_str: Optional[str] = None) -> datetime:
    """Parse show time string to UTC datetime"""
    now = get_utc_now()
    
    # Parse time
    hour, minute = map(int, time_str.split(":"))
    
    # Parse date or use today
    if date_str:
        year, month, day = map(int, date_str.split("-"))
        show_dt = datetime(year, month, day, hour, minute, tzinfo=timezone.utc)
    else:
        show_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        # If time has passed today, schedule for tomorrow
        if show_dt < now:
            show_dt += timedelta(days=1)
    
    return show_dt

async def check_creator_schedule(start_time: datetime) -> Optional[Dict]:
    """Check if a creator is scheduled during/after the show"""
    # Import here to avoid circular imports
    try:
        from routes.smart_scheduling import active_bookings
        
        show_end = start_time + timedelta(minutes=SHOW_CONFIG["duration_minutes"] + SHOW_CONFIG["cooldown_minutes"])
        
        for booking_id, booking in active_bookings.items():
            booking_start = datetime.fromisoformat(booking["scheduled_start"].replace("Z", "+00:00"))
            # Check if creator is scheduled within 10 minutes of show end
            if booking_start <= show_end + timedelta(minutes=10) and booking_start >= start_time:
                return booking
        
        return None
    except Exception as e:
        logger.error(f"Error checking creator schedule: {e}")
        return None

async def notify_roku_feed(show_data: Dict, action: str):
    """Notify Roku feed of show start/end"""
    logger.info(f"[ROKU] {action}: {show_data.get('show_id', 'unknown')}")
    # In production, this would call Roku Direct Publisher API
    # For now, we update the TV scheduler to prioritize the show
    return True

async def notify_firetv_feed(show_data: Dict, action: str):
    """Notify Fire TV feed of show start/end"""
    logger.info(f"[FIRETV] {action}: {show_data.get('show_id', 'unknown')}")
    # In production, this would call Amazon Fire TV API
    return True

# ============ SHOW LIFECYCLE ============

async def start_show(show_id: str):
    """Start the Big Screen show"""
    global active_show
    
    logger.info(f"[SHOW] Starting show: {show_id}")
    
    # Find scheduled show
    show = next((s for s in scheduled_shows if s["show_id"] == show_id), None)
    if not show:
        logger.error(f"[SHOW] Show not found: {show_id}")
        return
    
    # Set as active
    active_show = {
        **show,
        "status": "live",
        "phase": "intro",
        "current_round": 0,
        "started_at": get_utc_now().isoformat(),
        "players_count": 0,
        "round_winners": []
    }
    
    # Notify streaming platforms
    if show.get("push_to_roku"):
        await notify_roku_feed(active_show, "START")
    if show.get("push_to_firetv"):
        await notify_firetv_feed(active_show, "START")
    
    # Start intro phase (2 minutes)
    await asyncio.sleep(SHOW_CONFIG["intro_duration_seconds"])
    
    # Run 3 rounds
    for round_num in range(1, SHOW_CONFIG["rounds"] + 1):
        if not active_show or active_show.get("status") != "live":
            break
        
        active_show["phase"] = f"round_{round_num}"
        active_show["current_round"] = round_num
        
        logger.info(f"[SHOW] Starting Round {round_num}")
        
        # Run round (10 minutes = 600 seconds)
        round_duration = SHOW_CONFIG["round_duration_minutes"] * 60
        
        # In production, this would trigger the actual game via game_show.py
        # For now, simulate the round
        await asyncio.sleep(round_duration)
        
        # Record mock winner (in production, comes from game_show.py)
        active_show["round_winners"].append({
            "round": round_num,
            "winner": f"Player_{round_num}",
            "prize": SHOW_CONFIG["prizes"][round_num]["label"]
        })
    
    # End show, start cooldown
    await end_show(show_id)

async def end_show(show_id: str):
    """End the show and start cooldown"""
    global active_show
    
    if not active_show or active_show.get("show_id") != show_id:
        return
    
    logger.info(f"[SHOW] Ending show: {show_id}")
    
    active_show["phase"] = "cooldown"
    active_show["status"] = "cooldown"
    
    # 5-minute cooldown
    await asyncio.sleep(SHOW_CONFIG["cooldown_minutes"] * 60)
    
    # Check for upcoming creator schedule
    creator_booking = await check_creator_schedule(get_utc_now())
    
    if creator_booking:
        logger.info(f"[SHOW] Creator scheduled next: {creator_booking.get('title', 'Unknown')}")
        active_show["next_content"] = "creator"
        active_show["next_creator"] = creator_booking.get("title")
    else:
        logger.info("[SHOW] Returning to auto-playlist")
        active_show["next_content"] = "auto_playlist"
    
    # Notify platforms
    if active_show.get("push_to_roku"):
        await notify_roku_feed(active_show, "END")
    if active_show.get("push_to_firetv"):
        await notify_firetv_feed(active_show, "END")
    
    # Archive show
    active_show["status"] = "ended"
    active_show["ended_at"] = get_utc_now().isoformat()
    show_history.append(active_show.copy())
    
    # Clear active show
    active_show = None

async def cancel_show(show_id: str):
    """Cancel a scheduled or active show"""
    global active_show, scheduled_shows
    
    # Cancel if active
    if active_show and active_show.get("show_id") == show_id:
        active_show["status"] = "cancelled"
        active_show = None
    
    # Remove from scheduled
    scheduled_shows = [s for s in scheduled_shows if s["show_id"] != show_id]
    
    logger.info(f"[SHOW] Cancelled: {show_id}")

# ============ API ENDPOINTS ============

@router.post("/schedule")
async def schedule_show(request: ScheduleShowRequest):
    """Schedule a Big Screen show"""
    show_id = f"show_{uuid.uuid4().hex[:8]}"
    
    show_time = parse_show_time(request.show_time, request.show_date)
    show_end = show_time + timedelta(minutes=SHOW_CONFIG["duration_minutes"])
    cooldown_end = show_end + timedelta(minutes=SHOW_CONFIG["cooldown_minutes"])
    
    show = {
        "show_id": show_id,
        "show_name": SHOW_CONFIG["name"],
        "scheduled_start": show_time.isoformat(),
        "scheduled_end": show_end.isoformat(),
        "cooldown_end": cooldown_end.isoformat(),
        "status": "scheduled",
        "recurring": request.recurring,
        "push_to_roku": request.push_to_roku,
        "push_to_firetv": request.push_to_firetv,
        "priority": request.priority,
        "created_at": get_utc_now().isoformat()
    }
    
    scheduled_shows.append(show)
    
    # Calculate seconds until show starts
    seconds_until = (show_time - get_utc_now()).total_seconds()
    
    if seconds_until > 0:
        # Schedule the show to start
        asyncio.create_task(schedule_show_trigger(show_id, seconds_until))
        logger.info(f"[SHOW] Scheduled {show_id} for {show_time.isoformat()} ({seconds_until:.0f}s from now)")
    else:
        logger.warning(f"[SHOW] Show time is in the past: {show_time}")
    
    return {
        "success": True,
        "show_id": show_id,
        "scheduled_start": show_time.isoformat(),
        "scheduled_end": show_end.isoformat(),
        "cooldown_end": cooldown_end.isoformat(),
        "message": f"Show scheduled for {show_time.strftime('%Y-%m-%d %H:%M')} UTC",
        "seconds_until_start": max(0, int(seconds_until))
    }

async def schedule_show_trigger(show_id: str, delay_seconds: float):
    """Wait and then trigger the show"""
    await asyncio.sleep(delay_seconds)
    await start_show(show_id)

@router.get("/status")
async def get_show_status() -> Dict:
    """Get current show status"""
    if active_show:
        # Calculate time remaining
        if active_show.get("phase", "").startswith("round_"):
            # Rough estimate - in production, get from game_show.py
            time_remaining = SHOW_CONFIG["round_duration_minutes"] * 60
        elif active_show.get("phase") == "intro":
            time_remaining = SHOW_CONFIG["intro_duration_seconds"]
        elif active_show.get("phase") == "cooldown":
            time_remaining = SHOW_CONFIG["cooldown_minutes"] * 60
        else:
            time_remaining = 0
        
        return {
            "is_live": active_show.get("status") == "live",
            "show_id": active_show.get("show_id"),
            "phase": active_show.get("phase"),
            "current_round": active_show.get("current_round"),
            "time_remaining_seconds": time_remaining,
            "players_count": active_show.get("players_count", 0),
            "round_winners": active_show.get("round_winners", []),
            "started_at": active_show.get("started_at"),
            "next_content": active_show.get("next_content")
        }
    else:
        return {
            "is_live": False,
            "show_id": None,
            "phase": None,
            "current_round": None,
            "time_remaining_seconds": None,
            "players_count": None,
            "round_winners": None
        }

@router.get("/scheduled")
async def get_scheduled_shows():
    """Get list of scheduled shows"""
    return {
        "scheduled_shows": scheduled_shows,
        "count": len(scheduled_shows)
    }

@router.get("/history")
async def get_show_history():
    """Get show history"""
    return {
        "history": show_history[-20:],  # Last 20 shows
        "total_shows": len(show_history)
    }

@router.post("/cancel/{show_id}")
async def api_cancel_show(show_id: str):
    """Cancel a scheduled or active show"""
    await cancel_show(show_id)
    return {"success": True, "message": f"Show {show_id} cancelled"}

@router.post("/start-now")
async def start_show_immediately():
    """Start the Big Screen show immediately (for testing)"""
    show_id = f"show_{uuid.uuid4().hex[:8]}"
    now = get_utc_now()
    
    show = {
        "show_id": show_id,
        "show_name": SHOW_CONFIG["name"],
        "scheduled_start": now.isoformat(),
        "scheduled_end": (now + timedelta(minutes=SHOW_CONFIG["duration_minutes"])).isoformat(),
        "cooldown_end": (now + timedelta(minutes=SHOW_CONFIG["duration_minutes"] + SHOW_CONFIG["cooldown_minutes"])).isoformat(),
        "status": "scheduled",
        "recurring": False,
        "push_to_roku": True,
        "push_to_firetv": True,
        "priority": 100,
        "created_at": now.isoformat()
    }
    
    scheduled_shows.append(show)
    
    # Start immediately
    asyncio.create_task(start_show(show_id))
    
    return {
        "success": True,
        "show_id": show_id,
        "message": "Show starting now!",
        "scheduled_start": now.isoformat()
    }

@router.get("/config")
async def get_show_config():
    """Get show configuration"""
    return SHOW_CONFIG
