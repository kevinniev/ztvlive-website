"""
OBS Scene Controller API
=========================
Provides scene switching information for OBS automation.
Monitors playback state and recommends which scene OBS should display.

Scene Rotation:
- LIVE: Main content is playing normally
- PROMO: Show promo videos (gaps, static, black screen)
- GAME: Show game feed (transition between promo and live)

Rotation Flow: When issues detected → PROMO → GAME → LIVE
               When going back to normal → check GAME first → LIVE

OBS can poll this endpoint every 2-3 seconds to get the current recommended scene.
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging
import random

logger = logging.getLogger(__name__)

obs_router = APIRouter(prefix="/api/obs", tags=["OBS Controller"])

# Will be set from server.py
db = None

def set_database(database):
    global db
    db = database


# =============================================================================
# PLAYBACK STATE TRACKING
# =============================================================================

class PlaybackState:
    def __init__(self):
        self.last_video_change = datetime.now(timezone.utc)
        self.current_video_id = None
        self.current_scene = "LIVE"
        self.previous_scene = None
        self.static_detected = False
        self.black_screen_detected = False
        self.last_healthy_timestamp = datetime.now(timezone.utc)
        self.error_count = 0
        self.promo_count = 0  # How many promos played in current gap
        self.scene_start_time = datetime.now(timezone.utc)
        self.transition_phase = "stable"  # stable, promo, game, returning
        
playback_state = PlaybackState()


# =============================================================================
# SCENE ROTATION LOGIC
# =============================================================================

def get_next_scene_in_rotation(current_scene: str, is_live_ready: bool) -> dict:
    """
    Determine the next scene based on rotation logic.
    
    Rotation when issues detected:
    LIVE → PROMO (show 2 promos) → GAME (15s) → back to LIVE when ready
    
    Rotation when returning to normal:
    PROMO → GAME (transition) → LIVE
    """
    global playback_state
    
    now = datetime.now(timezone.utc)
    time_in_current = (now - playback_state.scene_start_time).total_seconds()
    
    # PROMO SCENE LOGIC
    if current_scene == "PROMO":
        # After 2 promos (roughly 16-24 seconds), transition to GAME
        if playback_state.promo_count >= 2 or time_in_current >= 20:
            return {
                "scene": "GAME",
                "reason": "Transitioning through game scene",
                "duration_hint": 15
            }
        else:
            # Stay on promo
            return {
                "scene": "PROMO",
                "reason": f"Playing promo {playback_state.promo_count + 1}/2",
                "duration_hint": 10
            }
    
    # GAME SCENE LOGIC
    elif current_scene == "GAME":
        # After 10-15 seconds on game, check if we can go to LIVE
        if time_in_current >= 10:
            if is_live_ready:
                return {
                    "scene": "LIVE",
                    "reason": "Live content ready, returning",
                    "duration_hint": 60
                }
            else:
                # Live not ready, go back to promo
                return {
                    "scene": "PROMO",
                    "reason": "Live not ready, showing more promos",
                    "duration_hint": 10
                }
        else:
            # Stay on game
            return {
                "scene": "GAME",
                "reason": "Game transition scene",
                "duration_hint": int(15 - time_in_current)
            }
    
    # LIVE SCENE LOGIC
    else:  # LIVE
        if is_live_ready:
            return {
                "scene": "LIVE",
                "reason": "Normal playback",
                "duration_hint": 60
            }
        else:
            # Issues detected, go to promo
            return {
                "scene": "PROMO",
                "reason": "Live content issue, showing promos",
                "duration_hint": 10
            }


# =============================================================================
# API ENDPOINTS
# =============================================================================

@obs_router.get("/scene")
async def get_recommended_scene():
    """
    Get the recommended OBS scene based on current playback state.
    
    Scene Rotation: LIVE ↔ PROMO → GAME → LIVE
    
    Returns:
    - scene: "LIVE" | "PROMO" | "GAME"
    - reason: Why this scene is recommended
    - duration_hint: Suggested time on this scene (seconds)
    - rotation_phase: Current phase in rotation
    - promo_count: Number of promos played in current gap
    """
    global playback_state
    
    try:
        from services.tv_scheduler import get_current_program
        
        now = datetime.now(timezone.utc)
        content = get_current_program()
        
        # Determine if LIVE content is ready
        is_live_ready = False
        remaining = 0
        elapsed = 0
        
        if content:
            remaining = content.get("remaining_seconds", 0)
            elapsed = content.get("elapsed_seconds", 0)
            
            # LIVE is ready if:
            # 1. Video has been playing for at least 5 seconds (past potential ads)
            # 2. Video has more than 10 seconds remaining (not about to end)
            # 3. No errors detected
            is_live_ready = (
                elapsed >= 5 and 
                remaining >= 10 and 
                playback_state.error_count == 0
            )
        
        # Get the recommended scene based on rotation
        current_scene = playback_state.current_scene
        recommendation = get_next_scene_in_rotation(current_scene, is_live_ready)
        
        # Build response
        response = {
            "scene": recommendation["scene"],
            "reason": recommendation["reason"],
            "duration_hint": recommendation["duration_hint"],
            "rotation_phase": playback_state.transition_phase,
            "promo_count": playback_state.promo_count,
            "current_scene": current_scene,
            "is_live_ready": is_live_ready,
            "timestamp": now.isoformat()
        }
        
        # Add content info if available
        if content:
            response["current_video"] = content.get("title", "Unknown")
            response["video_id"] = content.get("video_id")
            response["remaining_seconds"] = remaining
            response["elapsed_seconds"] = elapsed
        
        return response
        
    except Exception as e:
        logger.error(f"OBS scene check error: {e}")
        return {
            "scene": "PROMO",
            "reason": f"Error: {str(e)}",
            "duration_hint": 15,
            "promo_count": playback_state.promo_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


@obs_router.post("/scene-change")
async def notify_scene_change(
    scene: str,
    reason: Optional[str] = None
):
    """
    Notify when OBS changes scenes.
    Call this AFTER switching to update state tracking.
    """
    global playback_state
    
    now = datetime.now(timezone.utc)
    
    # Track scene transition
    playback_state.previous_scene = playback_state.current_scene
    playback_state.current_scene = scene
    playback_state.scene_start_time = now
    
    # Update state based on scene
    if scene == "LIVE":
        playback_state.last_healthy_timestamp = now
        playback_state.static_detected = False
        playback_state.black_screen_detected = False
        playback_state.promo_count = 0
        playback_state.error_count = 0
        playback_state.transition_phase = "stable"
        
    elif scene == "PROMO":
        playback_state.promo_count += 1
        playback_state.transition_phase = "promo"
        
    elif scene == "GAME":
        playback_state.transition_phase = "game"
    
    logger.info(f"OBS scene: {playback_state.previous_scene} → {scene} ({reason})")
    
    return {
        "acknowledged": True,
        "scene": scene,
        "promo_count": playback_state.promo_count,
        "timestamp": now.isoformat()
    }


@obs_router.post("/report-issue")
async def report_playback_issue(
    issue_type: str = Query(..., description="Type: black_screen, static, ad_detected, overlay_detected, audio_issue"),
    details: Optional[str] = None
):
    """
    Report a playback issue from OBS.
    This will trigger scene switching to PROMO.
    """
    global playback_state
    
    now = datetime.now(timezone.utc)
    playback_state.error_count += 1
    
    if issue_type == "black_screen":
        playback_state.black_screen_detected = True
    elif issue_type == "static":
        playback_state.static_detected = True
    
    logger.warning(f"OBS issue reported: {issue_type} - {details}")
    
    return {
        "acknowledged": True,
        "recommended_scene": "PROMO",
        "error_count": playback_state.error_count,
        "timestamp": now.isoformat()
    }


@obs_router.get("/status")
async def get_obs_status():
    """
    Get full OBS integration status for debugging.
    """
    global playback_state
    
    try:
        from services.tv_scheduler import get_current_program
        content = get_current_program()
    except:
        content = None
    
    now = datetime.now(timezone.utc)
    time_in_scene = (now - playback_state.scene_start_time).total_seconds()
    
    return {
        "current_scene": playback_state.current_scene,
        "previous_scene": playback_state.previous_scene,
        "time_in_scene_seconds": round(time_in_scene, 1),
        "transition_phase": playback_state.transition_phase,
        "promo_count": playback_state.promo_count,
        "error_count": playback_state.error_count,
        "static_detected": playback_state.static_detected,
        "black_screen_detected": playback_state.black_screen_detected,
        "last_healthy_timestamp": playback_state.last_healthy_timestamp.isoformat(),
        "current_content": {
            "title": content.get("title") if content else None,
            "video_id": content.get("video_id") if content else None,
            "remaining_seconds": content.get("remaining_seconds") if content else None,
            "elapsed_seconds": content.get("elapsed_seconds") if content else None,
        } if content else None,
        "timestamp": now.isoformat()
    }


@obs_router.get("/promo-playlist")
async def get_promo_playlist():
    """
    Get promo videos from database for OBS playback.
    Falls back to local files if database is unavailable.
    """
    global db
    
    promos = []
    
    # Try to fetch from database first
    if db is not None:
        try:
            # Query creator_videos collection for promo-tagged videos
            cursor = db.creator_videos.find({
                "$or": [
                    {"tags": {"$in": ["promo", "PROMO", "ad", "advertisement"]}},
                    {"category": {"$in": ["promo", "advertisement", "commercial"]}},
                    {"is_promo": True},
                    {"title": {"$regex": "promo|ZTVLIVE", "$options": "i"}}
                ],
                "status": "approved"
            }).limit(20)
            
            async for video in cursor:
                promos.append({
                    "id": str(video.get("id", video.get("_id"))),
                    "title": video.get("title", "ZTVLIVE Promo"),
                    "video_url": video.get("video_url", ""),
                    "thumbnail": video.get("thumbnail", ""),
                    "duration": video.get("duration_seconds", 15),
                    "source": "database"
                })
            
            logger.info(f"Loaded {len(promos)} promos from database")
            
        except Exception as e:
            logger.warning(f"Could not fetch promos from database: {e}")
    
    # Add local file promos as fallback/supplement
    local_promos = [
        {"id": "premium", "title": "ZTVLIVE - Create. Stream. Earn.", "file": "/ztvlive_promo_premium.mp4", "duration": 12},
        {"id": "events", "title": "Stream Your Events Live", "file": "/ztvlive_events_promo.mp4", "duration": 8},
        {"id": "gaming", "title": "ZTVLIVE Gaming", "file": "/ztvlive_gaming_promo.mp4", "duration": 8},
        {"id": "schedule", "title": "Schedule & Share", "file": "/ztvlive_schedule_promo.mp4", "duration": 8},
        {"id": "music", "title": "ZTVLIVE Music", "file": "/ztvlive_music_promo.mp4", "duration": 8},
        {"id": "notification", "title": "Never Miss a Moment", "file": "/ztvlive_notification_promo.mp4", "duration": 8},
        {"id": "podcast", "title": "ZTVLIVE Podcasts", "file": "/ztvlive_podcast_promo.mp4", "duration": 8},
        {"id": "install", "title": "Download on Any Device", "file": "/ztvlive_app_install_promo.mp4", "duration": 8},
        {"id": "social", "title": "Viral Highlights", "file": "/ztvlive_social_ad.mp4", "duration": 8}
    ]
    
    # Mark local files
    for p in local_promos:
        p["source"] = "local"
    
    # Combine: database promos first, then local fallbacks
    all_promos = promos + local_promos
    
    # Shuffle for variety
    random.shuffle(all_promos)
    
    return {
        "playlist": all_promos,
        "database_count": len(promos),
        "local_count": len(local_promos),
        "total_count": len(all_promos),
        "shuffle": True,
        "loop": True
    }


@obs_router.get("/rotation-config")
async def get_rotation_config():
    """
    Get the scene rotation configuration for OBS scripts.
    """
    return {
        "scenes": {
            "LIVE": {
                "description": "Main live content feed",
                "browser_url": "/obs-creator",
                "priority": 1
            },
            "PROMO": {
                "description": "Promo video loop",
                "browser_url": "/obs-promo",
                "priority": 2,
                "min_duration_seconds": 8,
                "max_promos_before_game": 2
            },
            "GAME": {
                "description": "Game show transition scene",
                "browser_url": "/game",
                "priority": 3,
                "duration_seconds": 15
            }
        },
        "rotation_flow": {
            "on_issue": ["LIVE", "PROMO", "GAME", "LIVE"],
            "on_recovery": ["PROMO", "GAME", "LIVE"]
        },
        "poll_interval_seconds": 3,
        "version": "2.0.0"
    }
