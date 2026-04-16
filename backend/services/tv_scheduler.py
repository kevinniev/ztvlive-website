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
        'duration_seconds': 86400,
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
        'duration_seconds': 86400,
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
        'duration_seconds': 86400,
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
        'duration_seconds': 86400,
    },
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
            if h < 3:
                schedule[h] = "Late Night"
            elif h < 6:
                schedule[h] = "Early Morning"
            elif h < 9:
                schedule[h] = "Morning Show"
            elif h < 12:
                schedule[h] = "Mid-Morning"
            elif h < 15:
                schedule[h] = "Afternoon Live"
            elif h < 17:
                schedule[h] = "Caribbean Afternoon"
            elif h < 19:
                schedule[h] = "Evening News"
            elif h < 22:
                schedule[h] = "Prime Time"
            else:
                schedule[h] = "Night Session"
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
VIEWER_BASE = 143000
VIEWER_VARIANCE = 50000


def _get_current_feed():
    """Get the current feed based on time rotation (30-min slots).
    
    If we have a loaded schedule (48 slots from clean_schedule.json),
    use slot_index directly to pick from the schedule.
    Otherwise, rotate through CLEAN_FEEDS.
    """
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
            'category': slot_data.get('category', 'NEWS'),
            'source': slot_data.get('source', 'ZTV'),
            'stream_type': slot_data.get('stream_type', 'hls'),
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
            'category': slot_data.get('category', 'NEWS'),
            'stream_type': slot_data.get('stream_type', 'hls'),
            'video_url': slot_data.get('video_url', ''),
        }
    else:
        return CLEAN_FEEDS[next_slot % len(CLEAN_FEEDS)]


def _detect_stream_type(feed):
    """Detect whether feed is HLS or YouTube embed based on URL patterns."""
    url = feed.get('video_url', '')
    explicit_type = feed.get('stream_type', '')

    if explicit_type == 'hls' or url.endswith('.m3u8'):
        return 'hls'
    if 'youtube.com/embed' in url or 'youtu.be' in url:
        return 'youtube'
    if explicit_type:
        return explicit_type
    return 'hls'


def get_live_sync():
    """Primary 24/7 Sync Hub.
    
    Serves the current feed (HLS or YouTube) to the frontend WatchPageV2.
    The response structure is designed to work with UniversalPlayer which
    checks stream_type to decide between HLSPlayer and YouTubePlayer.
    """
    current, slot_index, now = _get_current_feed()
    next_feed = _get_next_feed(slot_index)

    slot_start_minute = (now.minute // 30) * 30
    elapsed_seconds = (now.minute - slot_start_minute) * 60 + now.second
    remaining_seconds = 1800 - elapsed_seconds
    viewer_count = VIEWER_BASE + random.randint(0, VIEWER_VARIANCE)

    hour = now.hour
    program_name = current.get('program_block') or TV_PROGRAM_SCHEDULE.get(hour, "ZTV Live")

    stream_type = _detect_stream_type(current)
    video_url = current.get('video_url', '')
    fallback_url = current.get('fallback_url', '')

    # For YouTube embeds: set embed_url to the YouTube URL.
    # For HLS: embed_url = video_url (the .m3u8)
    if stream_type == 'youtube':
        embed_url = video_url
    else:
        embed_url = video_url

    return {
        "video_url": video_url,
        "embed_url": embed_url,
        "fallback_url": fallback_url,
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
            "video_url": video_url,
            "embed_url": embed_url,
            "fallback_url": fallback_url,
            "thumbnail": current.get('thumbnail', ''),
            "source": current.get('source', 'ZTV'),
            "stream_type": stream_type,
            "description": current.get('description', ''),
            "duration_seconds": current.get('duration_seconds', 1800),
            "playback_duration": current.get('duration_seconds', 1800),
            "elapsed_seconds": elapsed_seconds,
            "remaining_seconds": remaining_seconds,
            "progress_percent": round((elapsed_seconds / 1800) * 100, 2),
            "is_live": True,
            "is_creator_content": False,
            "is_fallback": False,
            "fallback_reason": None,
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
        next_slot = (slot_index + i) % 48
        if _USING_JSON_SCHEDULE and _LOADED_SCHEDULE:
            idx = next_slot % len(_LOADED_SCHEDULE)
            slot_data = _LOADED_SCHEDULE[idx]
            upcoming.append({
                "id": slot_data.get('id', f'slot_{idx}'),
                "title": slot_data.get('title', 'ZTV Live'),
                "category": slot_data.get('category', 'NEWS'),
                "stream_type": slot_data.get('stream_type', 'hls'),
                "video_url": slot_data.get('video_url', ''),
                "starts_in_minutes": i * 30,
            })
        else:
            feed = CLEAN_FEEDS[next_slot % len(CLEAN_FEEDS)]
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
    if _USING_JSON_SCHEDULE and _LOADED_SCHEDULE:
        slots = []
        for slot_data in _LOADED_SCHEDULE:
            slots.append({
                "slot": slot_data.get('slot', 0),
                "hour": slot_data.get('hour', 0),
                "half": slot_data.get('half', 0),
                "title": slot_data.get('title', ''),
                "category": slot_data.get('category', ''),
                "stream_type": slot_data.get('stream_type', 'hls'),
                "video_url": slot_data.get('video_url', ''),
                "program_block": slot_data.get('program_block', 'ZTV Live'),
                "source": slot_data.get('source', 'ZTV'),
                "description": slot_data.get('description', ''),
            })
        return slots

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


def reload_schedule():
    """Hot-reload the schedule from clean_schedule.json without restart."""
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
    clear_all_caches()
    return {
        "success": True,
        "using_json": using_json,
        "feeds": len(CLEAN_FEEDS),
        "slots": len(_LOADED_SCHEDULE),
    }


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
