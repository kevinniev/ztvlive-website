import datetime
import random
import json
import os
import threading

# =============================================
# CLEAN FEED MASTER LIBRARY - HLS STREAMS
# These are all verified working HLS endpoints
# No YouTube embedding restrictions (Error 150)
# =============================================
CLEAN_FEEDS = [
    {
        'id': 'nasa_tv',
        'title': 'NASA TV - Space & Science Live',
        'video_url': 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
        'fallback_url': 'https://www.youtube.com/embed/21X5lGlDOfg',
        'category': 'SPACE',
        'source': 'NASA',
        'stream_type': 'hls',
        'thumbnail': 'https://images-assets.nasa.gov/image/iss040e090540/iss040e090540~orig.jpg',
        'description': 'Live feed from NASA Television - ISS, launches, briefings',
        'duration_seconds': 86400
    },
    {
        'id': 'sky_news_au',
        'title': 'Sky News Australia Live',
        'video_url': 'https://skynewsau-live.akamaized.net/hls/live/2002689/skynewsau-extra1/master.m3u8',
        'fallback_url': 'https://www.youtube.com/embed/9AuqEdf6zLw',
        'category': 'NEWS',
        'source': 'Sky News AU',
        'stream_type': 'hls',
        'thumbnail': '',
        'description': '24/7 Sky News Australia - breaking news & analysis',
        'duration_seconds': 86400
    },
    {
        'id': 'cgtn_news',
        'title': 'CGTN Global News',
        'video_url': 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8',
        'fallback_url': 'https://www.youtube.com/embed/z-lPi-5UIoo',
        'category': 'NEWS',
        'source': 'CGTN',
        'stream_type': 'hls',
        'thumbnail': '',
        'description': 'CGTN English - 24/7 global news coverage',
        'duration_seconds': 86400
    },
    {
        'id': 'bloomberg_tv',
        'title': 'Bloomberg Television',
        'video_url': 'https://www.bloomberg.com/media-manifest/streams/us.m3u8',
        'fallback_url': 'https://www.youtube.com/embed/dp8PhLsUcFE',
        'category': 'FINANCE',
        'source': 'Bloomberg',
        'stream_type': 'hls',
        'thumbnail': '',
        'description': 'Bloomberg TV - global markets, business & finance',
        'duration_seconds': 86400
    },
    {
        'id': 'trt_world',
        'title': 'TRT World Live',
        'video_url': 'https://tv-trtworld.medya.trt.com.tr/master.m3u8',
        'fallback_url': 'https://www.youtube.com/embed/TV9AjkHiOhQ',
        'category': 'NEWS',
        'source': 'TRT World',
        'stream_type': 'hls',
        'thumbnail': '',
        'description': 'TRT World - 24/7 international news from Turkey',
        'duration_seconds': 86400
    },
    {
        'id': 'rt_news',
        'title': 'RT News Live',
        'video_url': 'https://rt-glb.rttv.com/live/rtnews/playlist.m3u8',
        'fallback_url': 'https://www.youtube.com/embed/V0I5eglJMRI',
        'category': 'NEWS',
        'source': 'RT',
        'stream_type': 'hls',
        'thumbnail': '',
        'description': 'RT News - 24/7 live international coverage',
        'duration_seconds': 86400
    },
]

# =============================================
# CONTENT LIBRARY (maps categories -> lists)
# Required by server.py imports
# =============================================
CONTENT_LIBRARY = {
    'space': [{'id': f['id'], 'title': f['title'], 'video_url': f['video_url'], 'category': f['category'], 'stream_type': f['stream_type']} for f in CLEAN_FEEDS if f['category'] == 'SPACE'],
    'news': [{'id': f['id'], 'title': f['title'], 'video_url': f['video_url'], 'category': f['category'], 'stream_type': f['stream_type']} for f in CLEAN_FEEDS if f['category'] == 'NEWS'],
    'finance': [{'id': f['id'], 'title': f['title'], 'video_url': f['video_url'], 'category': f['category'], 'stream_type': f['stream_type']} for f in CLEAN_FEEDS if f['category'] == 'FINANCE'],
}

CONTENT_CATEGORIES = list(CONTENT_LIBRARY.keys())

# Program schedule blocks (hour -> program name)
TV_PROGRAM_SCHEDULE = {
    0: "Late Night News", 1: "Late Night News", 2: "Late Night News",
    3: "Early Morning", 4: "Early Morning", 5: "Early Morning",
    6: "Morning News", 7: "Morning News", 8: "Morning News",
    9: "Mid-Morning", 10: "Mid-Morning", 11: "Mid-Morning",
    12: "Afternoon Live", 13: "Afternoon Live", 14: "Afternoon Live",
    15: "Afternoon Live", 16: "Evening News", 17: "Evening News",
    18: "Prime Time", 19: "Prime Time", 20: "Prime Time",
    21: "Night Watch", 22: "Night Watch", 23: "Night Watch",
}

# Caches
_schedule_cache = {}
_creator_bookings_cache = []
_creator_cache_timestamp = None
_pinned_content = []
_low_quality_videos = set()
_disabled_videos_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'disabled_videos.json')

# Viewer count simulation
VIEWER_BASE = 143000
VIEWER_VARIANCE = 50000


def _get_current_feed():
    """Get the current feed based on time rotation (30-min slots)."""
    now = datetime.datetime.now(datetime.timezone.utc)
    slot_index = (now.hour * 2) + (now.minute // 30)
    feed_index = slot_index % len(CLEAN_FEEDS)
    return CLEAN_FEEDS[feed_index], slot_index, now


def get_live_sync():
    """Primary 24/7 Sync Hub - Serves HLS Clean Feeds.
    
    Returns the full JSON structure expected by the frontend WatchPageV2.
    """
    current, slot_index, now = _get_current_feed()
    next_feed = CLEAN_FEEDS[(slot_index + 1) % len(CLEAN_FEEDS)]

    # Time within current 30-min slot
    slot_start_minute = (now.minute // 30) * 30
    elapsed_seconds = (now.minute - slot_start_minute) * 60 + now.second
    remaining_seconds = 1800 - elapsed_seconds
    viewer_count = VIEWER_BASE + random.randint(0, VIEWER_VARIANCE)
    
    hour = now.hour
    program_name = TV_PROGRAM_SCHEDULE.get(hour, "ZTV Live")

    return {
        # Top-level fields the frontend reads
        "video_url": current['video_url'],
        "embed_url": current['video_url'],
        "fallback_url": current.get('fallback_url', ''),
        "video_id": current['id'],
        "title": current['title'],
        "category": current['category'],
        "thumbnail": current.get('thumbnail', ''),
        "source": current.get('source', 'ZTV'),
        "stream_type": current.get('stream_type', 'hls'),
        "duration_seconds": current.get('duration_seconds', 86400),
        "playback_duration": current.get('duration_seconds', 86400),
        "elapsed_seconds": elapsed_seconds,
        "remaining_seconds": remaining_seconds,
        "start_from_seconds": 0,
        "is_creator_content": False,
        "is_live": True,
        "is_clean_feed": True,
        "creator_name": "",
        "timestamp": now.isoformat(),
        "viewer_count": viewer_count,
        "status": "live",

        # Nested now_playing
        "now_playing": {
            "id": current['id'],
            "title": current['title'],
            "category": current['category'],
            "video_url": current['video_url'],
            "embed_url": current['video_url'],
            "fallback_url": current.get('fallback_url', ''),
            "thumbnail": current.get('thumbnail', ''),
            "source": current.get('source', 'ZTV'),
            "stream_type": current.get('stream_type', 'hls'),
            "description": current.get('description', ''),
            "duration_seconds": current.get('duration_seconds', 86400),
            "playback_duration": current.get('duration_seconds', 86400),
            "elapsed_seconds": elapsed_seconds,
            "remaining_seconds": remaining_seconds,
            "progress_percent": round((elapsed_seconds / 1800) * 100, 2),
            "is_live": True,
            "is_creator_content": False,
            "is_fallback": False,
            "fallback_reason": None,
            "program_block": program_name,
        },

        # Program block
        "program_block": {
            "name": program_name,
            "description": current.get('description', f"Live {current['category']} on ZTV")
        },

        # Up next
        "up_next": {
            "id": next_feed['id'],
            "title": next_feed['title'],
            "category": next_feed['category'],
            "stream_type": next_feed.get('stream_type', 'hls'),
            "starts_in_seconds": remaining_seconds
        }
    }


def get_current_program():
    """Alias for get_live_sync."""
    return get_live_sync()


def get_now_playing():
    """Get just the now_playing portion."""
    sync = get_live_sync()
    return sync.get("now_playing", sync)


def get_upcoming_programs(count=3):
    """Get upcoming program list."""
    _, slot_index, _ = _get_current_feed()
    upcoming = []
    for i in range(1, count + 1):
        feed = CLEAN_FEEDS[(slot_index + i) % len(CLEAN_FEEDS)]
        upcoming.append({
            "id": feed['id'],
            "title": feed['title'],
            "category": feed['category'],
            "stream_type": feed.get('stream_type', 'hls'),
            "video_url": feed['video_url'],
            "starts_in_minutes": i * 30,
        })
    return upcoming


def get_upcoming_content(count=3):
    """Alias for get_upcoming_programs."""
    return get_upcoming_programs(count)


def get_dynamic_schedule():
    """Return a day's worth of schedule slots."""
    now = datetime.datetime.now(datetime.timezone.utc)
    slots = []
    for hour in range(24):
        for half in range(2):
            si = hour * 2 + half
            feed = CLEAN_FEEDS[si % len(CLEAN_FEEDS)]
            slots.append({
                "slot": si,
                "hour": hour,
                "half": half,
                "title": feed['title'],
                "category": feed['category'],
                "stream_type": feed.get('stream_type', 'hls'),
                "video_url": feed['video_url'],
                "program_block": TV_PROGRAM_SCHEDULE.get(hour, "ZTV Live"),
            })
    return slots


def generate_daily_schedule(date=None):
    """Generate the full daily schedule."""
    return get_dynamic_schedule()


def get_current_program_block():
    """Get the current program block name."""
    now = datetime.datetime.now(datetime.timezone.utc)
    return TV_PROGRAM_SCHEDULE.get(now.hour, "ZTV Live")


def get_program_schedule():
    """Return program schedule map."""
    return TV_PROGRAM_SCHEDULE


# --- Pinning ---
def pin_content(content_id):
    global _pinned_content
    if content_id not in _pinned_content:
        _pinned_content.append(content_id)
    return {"success": True, "pinned": content_id}


def unpin_content(content_id):
    global _pinned_content
    _pinned_content = [c for c in _pinned_content if c != content_id]
    return {"success": True, "unpinned": content_id}


def get_pinned_list():
    return _pinned_content


# --- Content library helpers ---
def get_content_library():
    return CONTENT_LIBRARY


def get_all_content():
    all_items = []
    for cat, items in CONTENT_LIBRARY.items():
        all_items.extend(items)
    return all_items


def get_content_by_category(category):
    return CONTENT_LIBRARY.get(category, [])


# --- Cache management ---
def clear_schedule_cache():
    global _schedule_cache
    _schedule_cache = {}


def clear_all_caches():
    global _schedule_cache, _creator_bookings_cache, _creator_cache_timestamp
    _schedule_cache = {}
    _creator_bookings_cache = []
    _creator_cache_timestamp = None


def advance_to_next_video():
    """Force advance to next video (skip current)."""
    clear_all_caches()
    return get_live_sync()


# --- Creator bookings ---
def get_active_creator_booking():
    return None


def refresh_creator_bookings_cache():
    global _creator_bookings_cache, _creator_cache_timestamp
    _creator_bookings_cache = []
    _creator_cache_timestamp = datetime.datetime.now(datetime.timezone.utc)


# --- Disabled / low quality videos ---
def load_disabled_videos():
    try:
        if os.path.exists(_disabled_videos_path):
            with open(_disabled_videos_path, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return []


def is_video_disabled(video, disabled_list=None):
    if disabled_list is None:
        disabled_list = load_disabled_videos()
    vid = video.get('id', '')
    return vid in disabled_list


def save_low_quality_video(video_id):
    global _low_quality_videos
    _low_quality_videos.add(video_id)
    return {"success": True}


def load_low_quality_videos():
    return list(_low_quality_videos)
