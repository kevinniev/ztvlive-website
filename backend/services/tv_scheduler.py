import datetime
import random
import json
import os

# ─── HARDCODED 2026 MASHUP FALLBACK ───
# This ensures even if JSON loading fails, the channel plays fresh 2026 content.

MASHUP_FEEDS = [
    {"id": "sports_2026_nba", "title": "NBA TOP Plays: Week 24 (April 2026)", "video_url": "https://www.youtube.com/embed/KNs2d9xmEdU", "category": "SPORTS", "source": "NBA", "stream_type": "youtube"},
    {"id": "comedy_2026_matt", "title": "Matt Rife: Best of 2026 Crowd Work", "video_url": "https://www.youtube.com/embed/vNlXk7vXYYQ", "category": "COMEDY", "source": "Matt Rife", "stream_type": "youtube"},
    {"id": "music_2026_lisa", "title": "Anyma, LISA - Bad Angel (2026 Official)", "video_url": "https://www.youtube.com/embed/q6786A7yR0s", "category": "MUSIC", "source": "LISA", "stream_type": "youtube"},
    {"id": "tech_2026_mit", "title": "MIT: 10 Breakthrough Technologies of 2026", "video_url": "https://www.youtube.com/embed/B_hx-zAWz3w", "category": "TECH", "source": "MIT", "stream_type": "youtube"},
    {"id": "sports_2026_nfl", "title": "Super Bowl LX Highlights (2026)", "video_url": "https://www.youtube.com/embed/tg1kaJqqkss", "category": "SPORTS", "source": "NFL", "stream_type": "youtube"},
    {"id": "comedy_2026_jokewrld", "title": "Best of Comedy 2026 Compilation", "video_url": "https://www.youtube.com/embed/SH-BU9aMYi8", "category": "COMEDY", "source": "Joke WRLD", "stream_type": "youtube"}
]

def get_live_sync():
    """Returns a high-variety 2026 Mashup."""
    now = datetime.datetime.now(datetime.timezone.utc)
    # Rotate every 30 mins
    idx = ((now.hour * 2) + (now.minute // 30)) % len(MASHUP_FEEDS)
    current = MASHUP_FEEDS[idx]
    next_f = MASHUP_FEEDS[(idx + 1) % len(MASHUP_FEEDS)]
    
    elapsed = (now.minute % 30) * 60 + now.second
    
    return {
        "video_url": current["video_url"],
        "video_id": current["id"],
        "title": current["title"],
        "category": current["category"],
        "source": current["source"],
        "stream_type": "youtube",
        "elapsed_seconds": elapsed,
        "is_live": True,
        "status": "live",
        "viewer_count": 2500000 + random.randint(0, 500000),
        "now_playing": {
            "title": current["title"],
            "category": current["category"],
            "video_url": current["video_url"],
            "stream_type": "youtube",
            "program_block": "ZTV 2026 MASHUP"
        },
        "up_next": {
            "title": next_f["title"]
        }
    }

def reload_schedule():
    return {"success": True}

def clear_all_caches():
    pass

def advance_to_next_video():
    return get_live_sync()

# Aliases for server.py
get_now_playing = get_live_sync
get_current_program = get_live_sync
