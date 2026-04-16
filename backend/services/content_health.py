"""
Content Health Monitor for ZTVLIVE
Checks video embeddability and manages disabled videos
"""

import os
import json
import asyncio
import aiohttp
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
import re

# File to store disabled videos
DISABLED_VIDEOS_FILE = "/app/backend/data/disabled_videos.json"

# Health check cache
_health_cache = {}
_last_scan = None
_scan_history = []

def get_video_id_from_url(url: str) -> Optional[str]:
    """Extract YouTube video ID from various URL formats"""
    if not url:
        return None
    
    patterns = [
        r'youtube\.com\/embed\/([^?&]+)',
        r'youtube\.com\/watch\?v=([^&]+)',
        r'youtu\.be\/([^?]+)',
        r'youtube\.com\/v\/([^?&]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

async def check_video_embeddable(session: aiohttp.ClientSession, video_id: str) -> Dict:
    """Check if a YouTube video is embeddable using oembed API"""
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status == 200:
                data = await resp.json()
                return {
                    "video_id": video_id,
                    "embeddable": True,
                    "title": data.get("title", ""),
                    "author": data.get("author_name", ""),
                    "error": None
                }
            elif resp.status == 401:
                return {
                    "video_id": video_id,
                    "embeddable": False,
                    "title": None,
                    "author": None,
                    "error": "Embedding disabled by owner"
                }
            elif resp.status == 404:
                return {
                    "video_id": video_id,
                    "embeddable": False,
                    "title": None,
                    "author": None,
                    "error": "Video not found or private"
                }
            else:
                return {
                    "video_id": video_id,
                    "embeddable": False,
                    "title": None,
                    "author": None,
                    "error": f"HTTP {resp.status}"
                }
    except asyncio.TimeoutError:
        return {
            "video_id": video_id,
            "embeddable": False,
            "title": None,
            "author": None,
            "error": "Timeout"
        }
    except Exception as e:
        return {
            "video_id": video_id,
            "embeddable": False,
            "title": None,
            "author": None,
            "error": str(e)
        }

async def check_content_library_health(content_library: Dict) -> Dict:
    """Check health of all videos in the content library"""
    global _health_cache, _last_scan, _scan_history
    
    results = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "total_videos": 0,
        "embeddable": 0,
        "not_embeddable": 0,
        "categories": {},
        "healthy_videos": [],
        "unhealthy_videos": []
    }
    
    async with aiohttp.ClientSession() as session:
        for category, videos in content_library.items():
            category_results = {
                "total": len(videos),
                "healthy": 0,
                "unhealthy": 0,
                "videos": []
            }
            
            for video in videos:
                video_id = get_video_id_from_url(video.get("video_url", ""))
                if not video_id:
                    continue
                
                results["total_videos"] += 1
                check = await check_video_embeddable(session, video_id)
                
                video_info = {
                    "id": video.get("id"),
                    "title": video.get("title"),
                    "video_id": video_id,
                    "embeddable": check["embeddable"],
                    "error": check.get("error")
                }
                
                if check["embeddable"]:
                    results["embeddable"] += 1
                    category_results["healthy"] += 1
                    results["healthy_videos"].append(video_info)
                else:
                    results["not_embeddable"] += 1
                    category_results["unhealthy"] += 1
                    results["unhealthy_videos"].append(video_info)
                
                category_results["videos"].append(video_info)
            
            results["categories"][category] = category_results
    
    _health_cache = results
    _last_scan = datetime.now(timezone.utc)
    _scan_history.append({
        "timestamp": _last_scan.isoformat(),
        "total": results["total_videos"],
        "healthy": results["embeddable"],
        "unhealthy": results["not_embeddable"]
    })
    
    # Keep only last 10 scans
    if len(_scan_history) > 10:
        _scan_history = _scan_history[-10:]
    
    return results

# Alias for compatibility
check_content_health = check_content_library_health

async def quick_check_video(video_url: str) -> Dict:
    """Quick check for a single video"""
    video_id = get_video_id_from_url(video_url)
    if not video_id:
        return {"error": "Could not extract video ID", "embeddable": False}
    
    async with aiohttp.ClientSession() as session:
        return await check_video_embeddable(session, video_id)

async def validate_video_for_embedding(video_url: str) -> bool:
    """Simple validation check"""
    result = await quick_check_video(video_url)
    return result.get("embeddable", False)

async def batch_validate_videos(video_urls: List[str]) -> List[Dict]:
    """Validate multiple videos at once"""
    results = []
    async with aiohttp.ClientSession() as session:
        for url in video_urls:
            video_id = get_video_id_from_url(url)
            if video_id:
                check = await check_video_embeddable(session, video_id)
                results.append({**check, "url": url})
    return results

def load_disabled_videos() -> List[str]:
    """Load list of disabled video IDs"""
    try:
        if os.path.exists(DISABLED_VIDEOS_FILE):
            with open(DISABLED_VIDEOS_FILE, "r") as f:
                data = json.load(f)
                return data.get("disabled_video_ids", [])
    except Exception:
        pass
    return []

def save_disabled_videos(video_ids: List[str]) -> bool:
    """Save list of disabled video IDs"""
    try:
        data = {
            "disabled_video_ids": list(set(video_ids)),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        with open(DISABLED_VIDEOS_FILE, "w") as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving disabled videos: {e}")
        return False

def disable_video(video_id: str) -> bool:
    """Add a video to the disabled list"""
    disabled = load_disabled_videos()
    if video_id not in disabled:
        disabled.append(video_id)
        return save_disabled_videos(disabled)
    return True

def enable_video(video_id: str) -> bool:
    """Remove a video from the disabled list"""
    disabled = load_disabled_videos()
    if video_id in disabled:
        disabled.remove(video_id)
        return save_disabled_videos(disabled)
    return True

def get_disabled_videos() -> Set[str]:
    """Get set of disabled video IDs"""
    return set(load_disabled_videos())

def get_health_summary() -> Dict:
    """Get a quick summary of content health"""
    disabled = load_disabled_videos()
    
    # AUTO-REPLENISHMENT: Check if we need to add fresh content
    needs_replenishment = len(disabled) > 50
    replenishment_result = None
    
    if needs_replenishment:
        try:
            from services.content_replenisher import check_and_replenish
            replenishment_result = check_and_replenish()
        except Exception as e:
            print(f"Auto-replenishment error: {e}")
            replenishment_result = {"error": str(e)}
    
    return {
        "status": "healthy" if len(disabled) < 50 else "degraded",
        "disabled_count": len(disabled),
        "disabled_videos": disabled,
        "last_scan": _last_scan.isoformat() if _last_scan else None,
        "cached_results": _health_cache if _health_cache else None,
        "scan_history": _scan_history,
        "auto_replenishment": replenishment_result
    }

def clear_health_cache() -> Dict:
    """Clear the health check cache"""
    global _health_cache, _last_scan
    _health_cache = {}
    _last_scan = None
    return {"status": "cleared", "timestamp": datetime.now(timezone.utc).isoformat()}
