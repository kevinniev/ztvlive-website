"""
ZTVLIVE Background Scheduler
Runs periodic tasks including content health scans every 6 hours.
Auto-disables unavailable videos from rotation.
"""

import asyncio
import logging
import json
import os
from datetime import datetime, timezone
from typing import Dict, List, Set
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Path to disabled videos file
DISABLED_VIDEOS_FILE = "/app/backend/disabled_videos.json"

# Global state
_scheduler: AsyncIOScheduler = None
_disabled_videos: Set[str] = set()
_last_scan_result: Dict = {}
_scan_history: List[Dict] = []

def _load_disabled_videos():
    """Load disabled videos from JSON file."""
    global _disabled_videos
    try:
        if os.path.exists(DISABLED_VIDEOS_FILE):
            with open(DISABLED_VIDEOS_FILE, "r") as f:
                data = json.load(f)
                _disabled_videos = set(data.get("disabled_video_ids", []))
                logger.info(f"Loaded {len(_disabled_videos)} disabled videos from file")
    except Exception as e:
        logger.error(f"Error loading disabled videos: {e}")

def _save_disabled_videos():
    """Save disabled videos to JSON file."""
    try:
        with open(DISABLED_VIDEOS_FILE, "w") as f:
            json.dump({
                "disabled_video_ids": list(_disabled_videos),
                "last_updated": datetime.now(timezone.utc).isoformat()
            }, f, indent=2)
        logger.info(f"Saved {len(_disabled_videos)} disabled videos to file")
    except Exception as e:
        logger.error(f"Error saving disabled videos: {e}")

# Load disabled videos on module import
_load_disabled_videos()

def get_disabled_videos() -> Set[str]:
    """Get set of disabled video IDs."""
    return _disabled_videos.copy()

def is_video_disabled(video_id: str) -> bool:
    """Check if a video is disabled."""
    return video_id in _disabled_videos

def disable_video(video_id: str, reason: str = "unavailable") -> Dict:
    """Manually disable a video and persist to file."""
    _disabled_videos.add(video_id)
    _save_disabled_videos()
    logger.info(f"Disabled video {video_id}: {reason}")
    return {"status": "disabled", "video_id": video_id, "reason": reason}

def enable_video(video_id: str) -> Dict:
    """Re-enable a disabled video and persist to file."""
    _disabled_videos.discard(video_id)
    _save_disabled_videos()
    logger.info(f"Re-enabled video {video_id}")
    return {"status": "enabled", "video_id": video_id}

def get_scan_status() -> Dict:
    """Get current scan status and history."""
    return {
        "disabled_videos": list(_disabled_videos),
        "disabled_count": len(_disabled_videos),
        "last_scan": _last_scan_result,
        "scan_history": _scan_history[-10:],  # Last 10 scans
        "scheduler_running": _scheduler.running if _scheduler else False,
        "next_scan": str(_scheduler.get_jobs()[0].next_run_time) if _scheduler and _scheduler.get_jobs() else None
    }


async def run_health_scan():
    """
    Run a full content health scan and auto-disable unavailable videos.
    This is called by the scheduler every 6 hours.
    """
    global _last_scan_result
    
    logger.info("Starting scheduled content health scan...")
    scan_start = datetime.now(timezone.utc)
    
    try:
        # Import here to avoid circular imports
        from services.content_health import check_content_library_health, clear_health_cache
        from services.tv_scheduler import CONTENT_LIBRARY
        
        # Clear cache before scanning
        clear_health_cache()
        
        # Run the scan
        results = await check_content_library_health(CONTENT_LIBRARY)
        
        # Process unavailable videos
        newly_disabled = []
        for item in results.get("unavailable", []):
            video_id = item.get("video_id")
            if video_id and video_id not in _disabled_videos:
                _disabled_videos.add(video_id)
                newly_disabled.append({
                    "video_id": video_id,
                    "title": item.get("title"),
                    "category": item.get("category"),
                    "error": item.get("health", {}).get("error")
                })
        
        # Check if any previously disabled videos are now available
        re_enabled = []
        for item in results.get("available", []):
            video_id = item.get("video_id")
            if video_id and video_id in _disabled_videos:
                _disabled_videos.discard(video_id)
                re_enabled.append({
                    "video_id": video_id,
                    "title": item.get("title")
                })
        
        scan_end = datetime.now(timezone.utc)
        duration_seconds = (scan_end - scan_start).total_seconds()
        
        _last_scan_result = {
            "scan_time": scan_end.isoformat(),
            "duration_seconds": duration_seconds,
            "total_checked": results.get("total_checked", 0),
            "available": len(results.get("available", [])),
            "unavailable": len(results.get("unavailable", [])),
            "unknown": len(results.get("unknown", [])),
            "newly_disabled": newly_disabled,
            "re_enabled": re_enabled,
            "total_disabled": len(_disabled_videos)
        }
        
        # Add to history
        _scan_history.append(_last_scan_result)
        if len(_scan_history) > 100:
            _scan_history.pop(0)
        
        logger.info(f"Health scan completed in {duration_seconds:.1f}s: "
                   f"{len(results.get('available', []))} available, "
                   f"{len(results.get('unavailable', []))} unavailable, "
                   f"{len(newly_disabled)} newly disabled, "
                   f"{len(re_enabled)} re-enabled")
        
        if newly_disabled:
            logger.warning(f"Disabled {len(newly_disabled)} videos: "
                          f"{[v['title'][:30] for v in newly_disabled]}")
        
        return _last_scan_result
        
    except Exception as e:
        logger.error(f"Health scan failed: {e}")
        _last_scan_result = {
            "scan_time": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "total_disabled": len(_disabled_videos)
        }
        return _last_scan_result


def start_scheduler():
    """Start the background scheduler."""
    global _scheduler
    
    if _scheduler and _scheduler.running:
        logger.info("Scheduler already running")
        return
    
    _scheduler = AsyncIOScheduler()
    
    # Schedule health scan every 6 hours
    _scheduler.add_job(
        run_health_scan,
        trigger=IntervalTrigger(hours=6),
        id="content_health_scan",
        name="Content Health Scan",
        replace_existing=True,
        max_instances=1
    )
    
    _scheduler.start()
    logger.info("Background scheduler started - health scan every 6 hours")
    
    # Run initial scan after 30 seconds (let the server fully start first)
    asyncio.get_event_loop().call_later(30, lambda: asyncio.create_task(run_health_scan()))


def stop_scheduler():
    """Stop the background scheduler."""
    global _scheduler
    
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Background scheduler stopped")


def trigger_scan_now():
    """Manually trigger an immediate scan."""
    asyncio.create_task(run_health_scan())
    return {"status": "scan_triggered", "message": "Health scan started in background"}
