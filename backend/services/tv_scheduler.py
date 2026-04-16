import datetime
import random
import json
import os
import threading

# =============================================
# SCHEDULE LOADER
# Loads from backend/data/clean_schedule.json if available,
# otherwise falls back to built-in CLEAN_FEEDS.
# =============================================

_SCHEDULE_JSON_PATH = os.path.join(
    os.path.dirname(__file__), '..', 'data', 'clean_schedule.json'
)

# Emergency Promo Loop Feeds
PROMO_FEEDS = [
    {
        "id": "promo_revolution_final",
        "title": "ZTVLIVE - The Revolution",
        "video_url": "/api/static/promo/ztvlive_70_revolution_FINAL.mp4",
        "category": "PROMO",
        "source": "ZTV",
        "stream_type": "mp4",
        "duration_seconds": 60
    },
    {
        "id": "promo_intro",
        "title": "Welcome to ZTVLIVE",
        "video_url": "/api/static/promo/01_revolution_intro.mp4",
        "category": "PROMO",
        "source": "ZTV",
        "stream_type": "mp4",
        "duration_seconds": 30
    },
    {
        "id": "promo_sports_news",
        "title": "Sports & News on ZTV",
        "video_url": "/api/static/promo/02_sports_news_tech.mp4",
        "category": "PROMO",
        "source": "ZTV",
        "stream_type": "mp4",
        "duration_seconds": 30
    },
    {
        "id": "promo_revenue",
        "title": "70% Revenue Share",
        "video_url": "/api/static/promo/03_creator_revenue.mp4",
        "category": "PROMO",
        "source": "ZTV",
        "stream_type": "mp4",
        "duration_seconds": 30
    },
    {
        "id": "promo_logo_cta",
        "title": "Join ZTVLIVE Now",
        "video_url": "/api/static/promo/04_logo_cta.mp4",
        "category": "PROMO",
        "source": "ZTV",
        "stream_type": "mp4",
        "duration_seconds": 15
    }
]

# Built-in fallback feeds (HLS news/space only)
_FALLBACK_FEEDS = [
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
        'duration_seconds': 86400,
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
        'duration_seconds': 86400,
    }
]


def _load_schedule_json():
    """Load clean_schedule.json and return (feeds_list, schedule_list, program_blocks)."""
    try:
        if os.path.exists(_SCHEDULE_JSON_PATH):
            with open(_SCHEDULE_JSON_PATH, 'r') as f:
                data = json.load(f)
            feeds = data.get('feeds', [])
            schedule = data.get('schedule', [])
            blocks = data.get('program_blocks', {})
            if feeds and schedule:
                return feeds, schedule, blocks
    except Exception as e:
        print(f"[tv_scheduler] Warning: Failed to load clean_schedule.json: {e}")
    return None, None, None


def _init_feeds():
    """Initialize CLEAN_FEEDS and SCHEDULE from JSON or fallback."""
    feeds, schedule, blocks = _load_schedule_json()
    if feeds and schedule:
        return feeds, schedule, blocks, True
    return _FALLBACK_FEEDS, [], {}, False


CLEAN_FEEDS, _LOADED_SCHEDULE, _LOADED_BLOCKS, _USING_JSON_SCHEDULE = _init_feeds()


# =============================================
# CONTENT LIBRARY (maps categories -> lists)
# Required by server.py imports
# =============================================
def _build_content_library(feeds):
    lib = {}
    for f in feeds:
        cat = f.get('category', 'OTHER').lower()
        if cat not in lib:
            lib[cat] = []
        lib[cat].append({
            'id': f['id'],
            'title': f['title'],
            'video_url': f['video_url'],
            'category': f['category'],
            'stream_type': f.get('stream_type', 'hls'),
        })
    return lib


CONTENT_LIBRARY = _build_content_library(CLEAN_FEEDS)
CONTENT_CATEGORIES = list(CONTENT_LIBRARY.keys())


# Program schedule blocks (hour -> program name)
def _build_program_schedule(blocks):
    """Build hour -> program name mapping from loaded blocks."""
    schedule = {}
    if blocks:
        for name, info in blocks.items():
            for h in info.get('hours', []):
                schedule[h] = name
    # Fill any missing hours
    for h in range(24):
        if h not in schedule:
            schedule[h] = "ZTV Live Hits"
    return schedule


TV_PROGRAM_SCHEDULE = _build_program_schedule(_LOADED_BLOCKS)


# Caches
_schedule_cache = {}
_creator_bookings_cache = []
_creator_cache_timestamp = None
_pinned_content = []
_low_quality_videos = set()
_disabled_videos_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'disabled_videos.json')

# Viewer count simulation
VIEWER_BASE = 2430000
VIEWER_VARIANCE = 500000


def _get_current_feed():
    """Get the current feed based on time rotation (30-min slots)."""
    now = datetime.datetime.now(datetime.timezone.utc)
    slot_index = (now.hour * 2) + (now.minute // 30)

    if _USING_JSON_SCHEDULE and _LOADED_SCHEDULE:
        idx = slot_index % len(_LOADED_SCHEDULE)
        slot_data = _LOADED_SCHEDULE[idx]
        feed = {
            'id': slot_data.get('id', f'slot_{idx}'),
            'title': slot_data.get('title', 'ZTV Live'),
            'video_url': slot_data.get('video_url', ''),
            'fallback_url': slot_data.get('fallback_url', ''),
            'category': slot_data.get('category', 'HITS'),
            'source': slot_data.get('source', 'ZTV'),
            'stream_type': slot_data.get('stream_type', 'youtube'),
            'thumbnail': slot_data.get('thumbnail', ''),
            'description': slot_data.get('description', ''),
            'duration_seconds': slot_data.get('duration_seconds', 1800),
            'program_block': slot_data.get('program_block', ''),
        }
        return feed, slot_index, now
    else:
        feed_index = slot_index % len(CLEAN_FEEDS)
        return CLEAN_FEEDS[feed_index], slot_index, now


def _get_next_feed(slot_index):
    """Get the next feed after the given slot index."""
    next_slot = (slot_index + 1) % 48
    if _USING_JSON_SCHEDULE and _LOADED_SCHEDULE:
        idx = next_slot % len(_LOADED_SCHEDULE)
        slot_data = _LOADED_SCHEDULE[idx]
        return {
            'id': slot_data.get('id', f'slot_{idx}'),
            'title': slot_data.get('title', 'ZTV Live'),
            'category': slot_data.get('category', 'HITS'),
            'stream_type': slot_data.get('stream_type', 'youtube'),
            'video_url': slot_data.get('video_url', ''),
        }
    else:
        return CLEAN_FEEDS[next_slot % len(CLEAN_FEEDS)]


def _detect_stream_type(feed):
    """Detect whether feed is HLS, YouTube, or MP4."""
    url = feed.get('video_url', '')
    explicit_type = feed.get('stream_type', '')

    if explicit_type == 'hls' or url.endswith('.m3u8'):
        return 'hls'
    if explicit_type == 'mp4' or url.endswith('.mp4'):
        return 'mp4'
    if 'youtube.com/embed' in url or 'youtu.be' in url:
        return 'youtube'
    return explicit_type or 'hls'


def get_live_sync():
    """Primary 24/7 Sync Hub. Fallback to promo loop on fatal errors."""
    try:
        current, slot_index, now = _get_current_feed()
        next_feed = _get_next_feed(slot_index)

        slot_start_minute = (now.minute // 30) * 30
        elapsed_seconds = (now.minute - slot_start_minute) * 60 + now.second
        remaining_seconds = 1800 - elapsed_seconds
        viewer_count = VIEWER_BASE + random.randint(0, VIEWER_VARIANCE)

        hour = now.hour
        program_name = current.get('program_block') or TV_PROGRAM_SCHEDULE.get(hour, "ZTV Live Hits")

        stream_type = _detect_stream_type(current)
        
        return {
            "video_url": current.get('video_url', ''),
            "embed_url": current.get('video_url', ''),
            "fallback_url": current.get('fallback_url', PROMO_FEEDS[0]['video_url']),
            "video_id": current.get('id', ''),
            "title": current.get('title', 'ZTV Live'),
            "category": current.get('category', 'GENERAL'),
            "thumbnail": current.get('thumbnail', ''),
            "source": current.get('source', 'ZTV'),
            "stream_type": stream_type,
            "duration_seconds": current.get('duration_seconds', 1800),
            "playback_duration": current.get('duration_seconds', 1800),
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

            "now_playing": {
                "id": current.get('id', ''),
                "title": current.get('title', 'ZTV Live'),
                "category": current.get('category', 'GENERAL'),
                "video_url": current.get('video_url', ''),
                "stream_type": stream_type,
                "description": current.get('description', ''),
                "duration_seconds": current.get('duration_seconds', 1800),
                "elapsed_seconds": elapsed_seconds,
                "remaining_seconds": remaining_seconds,
                "is_live": True,
                "program_block": program_name,
            },

            "program_block": {
                "name": program_name,
                "description": current.get('description', f"Live {current.get('category', '')} on ZTV"),
            },

            "up_next": {
                "id": next_feed.get('id', ''),
                "title": next_feed.get('title', ''),
                "category": next_feed.get('category', ''),
                "stream_type": _detect_stream_type(next_feed),
                "starts_in_seconds": remaining_seconds,
            },
        }
    except Exception as e:
        # Emergency Promo Fallback
        now = datetime.datetime.now(datetime.timezone.utc)
        promo = PROMO_FEEDS[now.minute % len(PROMO_FEEDS)]
        return {
            "video_url": promo['video_url'],
            "embed_url": promo['video_url'],
            "video_id": promo['id'],
            "title": promo['title'],
            "category": "PROMO",
            "stream_type": "mp4",
            "is_live": True,
            "status": "emergency_promo",
            "viewer_count": 1000000
        }


def get_current_program():
    return get_live_sync()

def get_now_playing():
    sync = get_live_sync()
    return sync.get("now_playing", sync)

def get_upcoming_programs(count=3):
    _, slot_index, _ = _get_current_feed()
    upcoming = []
    for i in range(1, count + 1):
        next_slot = (slot_index + i) % 48
        feed = _get_next_feed(next_slot - 1)
        upcoming.append({
            "id": feed['id'],
            "title": feed['title'],
            "category": feed['category'],
            "stream_type": _detect_stream_type(feed),
            "video_url": feed['video_url'],
            "starts_in_minutes": i * 30,
        })
    return upcoming

def get_dynamic_schedule():
    slots = []
    for hour in range(24):
        for half in range(2):
            si = hour * 2 + half
            # Mock picking for schedule view
            feed_idx = si % len(CLEAN_FEEDS)
            feed = CLEAN_FEEDS[feed_idx]
            slots.append({
                "slot": si,
                "hour": hour,
                "half": half,
                "title": feed['title'],
                "category": feed['category'],
                "stream_type": _detect_stream_type(feed),
                "video_url": feed['video_url'],
                "program_block": TV_PROGRAM_SCHEDULE.get(hour, "ZTV Live"),
            })
    return slots

def generate_daily_schedule(date=None):
    return get_dynamic_schedule()

def get_current_program_block():
    now = datetime.datetime.now(datetime.timezone.utc)
    return TV_PROGRAM_SCHEDULE.get(now.hour, "ZTV Live Hits")

def get_program_schedule():
    return TV_PROGRAM_SCHEDULE

def reload_schedule():
    global CLEAN_FEEDS, _LOADED_SCHEDULE, _LOADED_BLOCKS, _USING_JSON_SCHEDULE
    global CONTENT_LIBRARY, CONTENT_CATEGORIES, TV_PROGRAM_SCHEDULE
    feeds, schedule, blocks, using_json = _init_feeds()
    CLEAN_FEEDS = feeds
    _LOADED_SCHEDULE = schedule
    _LOADED_BLOCKS = blocks
    _USING_JSON_SCHEDULE = using_json
    CONTENT_LIBRARY = _build_content_library(CLEAN_FEEDS)
    CONTENT_CATEGORIES = list(CONTENT_LIBRARY.keys())
    TV_PROGRAM_SCHEDULE = _build_program_schedule(_LOADED_BLOCKS)
    return {"success": True, "using_json": using_json}

def pin_content(content_id):
    global _pinned_content
    if content_id not in _pinned_content: _pinned_content.append(content_id)
    return {"success": True}

def unpin_content(content_id):
    global _pinned_content
    _pinned_content = [c for c in _pinned_content if c != content_id]
    return {"success": True}

def get_pinned_list():
    return _pinned_content

def get_content_library():
    return CONTENT_LIBRARY

def get_all_content():
    all_items = []
    for cat, items in CONTENT_LIBRARY.items(): all_items.extend(items)
    return all_items

def get_content_by_category(category):
    return CONTENT_LIBRARY.get(category, [])

def clear_all_caches():
    global _schedule_cache
    _schedule_cache = {}

def advance_to_next_video():
    return get_live_sync()

def get_active_creator_booking():
    return None

def load_disabled_videos():
    return []

def is_video_disabled(video, disabled_list=None):
    return False

def save_low_quality_video(video_id):
    return {"success": True}

def load_low_quality_videos():
    return []
