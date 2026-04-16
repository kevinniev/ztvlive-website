"""
ZTVLIVE Dynamic TV Scheduler
24/7 Professional Broadcasting Network
Version: 18.0 - NO REPEAT SYSTEM - April 2026

Features:
- TRUE LIVE TV: All viewers see the same content at the same time
- NO REPEATS: Videos won't repeat for at least 6 hours
- Time-based content selection (morning music, evening entertainment, etc.)
- Massive embeddable video library
- Auto-skip for blocked/static videos
- oEmbed verification for embed availability
"""

import random
import os
import hashlib
import json
import requests
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Set

import logging
NEWS_API_KEY = os.environ.get('ZTV_API_KEY', '')

# Initialize logger
logger = logging.getLogger(__name__)

# Cache for embed checks (avoid repeated API calls)
_embed_check_cache = {}  # {video_id: (is_embeddable, timestamp)}
EMBED_CACHE_TTL = 3600  # Cache results for 1 hour


def check_video_embeddable(video_id: str) -> bool:
    """
    Check if a YouTube video is embeddable using oEmbed API.
    Results are cached to avoid repeated API calls.
    """
    global _embed_check_cache
    
    # Check cache first
    now = datetime.now(timezone.utc).timestamp()
    if video_id in _embed_check_cache:
        cached_result, cached_time = _embed_check_cache[video_id]
        if now - cached_time < EMBED_CACHE_TTL:
            return cached_result
    
    # Query YouTube oEmbed API
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        response = requests.get(url, timeout=3)
        is_embeddable = response.status_code == 200 and "title" in response.text
        
        # Cache the result
        _embed_check_cache[video_id] = (is_embeddable, now)
        
        if not is_embeddable:
            logger.warning(f"[EMBED CHECK] Video {video_id} is NOT embeddable")
        
        return is_embeddable
    except Exception as e:
        logger.error(f"[EMBED CHECK] Error checking {video_id}: {e}")
        # On error, assume it's embeddable to avoid blocking
        return True

# ============ DJ-STYLE AUTO-TRIM SYSTEM ============
# Automatically trim videos to cut before promotional end cards
# This creates smooth transitions like a professional DJ
# UNIVERSAL 5-SECOND TRIM + source-specific additional trim

# Universal trim applied to ALL videos (cuts dead air at end)
UNIVERSAL_TRIM_SECONDS = 5

# Default trim seconds per source/region (cuts off end cards, branding, "Subscribe" screens)
DJ_TRIM_CONFIG = {
    # Indian labels - VERY aggressive (they have 15-30s end cards with view counts, logos)
    "T-Series": 25,
    "Sony Music India": 22,
    "Zee Music": 22,
    "Zee Music Company": 22,
    "Sony Music": 18,
    "Times Music": 20,
    "Saregama": 20,
    "YRF": 20,            # Yash Raj Films
    "Tips Official": 22,
    "Eros Now": 22,
    "Desi Music Factory": 20,
    "Speed Records": 18,
    "White Hill Music": 18,
    "Shemaroo": 20,
    
    # Latin labels
    "Sony Music Latin": 18,
    "Universal Music Latino": 15,
    
    # K-Pop labels (often have end cards)
    "HYBE": 15,
    "JYP Entertainment": 15,
    "SM Entertainment": 15,
    "YG Entertainment": 15,
    
    # Default and Western
    "default": 10,        # Default additional trim (on top of universal 5s)
    "western": 5,         # Western labels - just universal trim is enough
}

def get_trim_seconds(source: str) -> int:
    """Get the number of seconds to trim from end of video based on source.
    Always includes UNIVERSAL_TRIM_SECONDS (5s) + source-specific trim.
    """
    # Start with universal trim
    base_trim = UNIVERSAL_TRIM_SECONDS
    
    # Check for specific labels first (exact or partial match)
    source_lower = source.lower()
    
    for label, trim in DJ_TRIM_CONFIG.items():
        if label.lower() in source_lower:
            return base_trim + trim
    
    # Check if it's a western/international source
    western_sources = ["Warner", "Universal", "Atlantic", "Interscope", 
                       "Capitol", "Republic", "RCA", "Columbia", "Epic", "Def Jam",
                       "Island", "Parlophone", "EMI", "Virgin", "Polydor"]
    for ws in western_sources:
        if ws.lower() in source_lower:
            return base_trim + DJ_TRIM_CONFIG["western"]
    
    return base_trim + DJ_TRIM_CONFIG["default"]

# ============ RECENTLY PLAYED TRACKER ============
# Tracks videos that have been played to prevent repeats
RECENTLY_PLAYED_FILE = "/app/backend/data/recently_played.json"
REPEAT_COOLDOWN_HOURS = 24  # Don't repeat videos for at least 24 hours

def load_recently_played() -> Dict:
    """Load recently played videos with timestamps"""
    try:
        if os.path.exists(RECENTLY_PLAYED_FILE):
            with open(RECENTLY_PLAYED_FILE, "r") as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading recently played: {e}")
    return {"played": {}}

def save_recently_played(data: Dict):
    """Save recently played videos"""
    try:
        os.makedirs(os.path.dirname(RECENTLY_PLAYED_FILE), exist_ok=True)
        with open(RECENTLY_PLAYED_FILE, "w") as f:
            json.dump(data, f)
    except Exception as e:
        print(f"Error saving recently played: {e}")

def mark_video_played(video_id: str):
    """Mark a video as recently played"""
    data = load_recently_played()
    data["played"][video_id] = datetime.now(timezone.utc).isoformat()
    # Clean up old entries (older than 24 hours)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    data["played"] = {k: v for k, v in data["played"].items() if v > cutoff}
    save_recently_played(data)

def is_video_recently_played(video_id: str) -> bool:
    """Check if a video was played within the cooldown period"""
    data = load_recently_played()
    if video_id not in data.get("played", {}):
        return False
    
    played_at = data["played"][video_id]
    try:
        played_time = datetime.fromisoformat(played_at.replace("Z", "+00:00"))
        cooldown = timedelta(hours=REPEAT_COOLDOWN_HOURS)
        return datetime.now(timezone.utc) - played_time < cooldown
    except Exception:
        return False

def get_available_videos(category: str, disabled_ids: Set[str]) -> List[Dict]:
    """Get videos from a category that are not disabled and not recently played"""
    from services.tv_scheduler import CONTENT_LIBRARY, extract_youtube_id, is_video_disabled
    
    available = []
    for video in CONTENT_LIBRARY.get(category, []):
        youtube_id = extract_youtube_id(video.get("video_url", ""))
        if youtube_id and youtube_id not in disabled_ids and not is_video_recently_played(youtube_id):
            available.append(video)
    return available

# ============ ADMIN SHUFFLE OVERRIDE ============
_shuffled_playlist_override: List[Dict] = []
_shuffle_timestamp: Optional[str] = None

# ============ TV PROGRAMMING SCHEDULE (EST times, converted to UTC) ============
# Note: EST = UTC-5, so we add 5 hours for UTC
# Each block is 2 hours
# WEEKEND EDITION - Fresh music vibes 24/7

TV_PROGRAM_SCHEDULE = [
    # Hour (UTC), Program Name, Description, Content Categories
    # MORNING (6am-12pm EST = 11-17 UTC)
    {"hour": 11, "name": "Good Morning Vibes", "desc": "Upbeat feel-good music to start your day", "categories": ["global_hits", "european"]},
    {"hour": 13, "name": "Morning Energy Boost", "desc": "High-energy hits to power through", "categories": ["global_hits", "latin"]},
    
    # MIDDAY (12pm-5pm EST = 17-22 UTC)
    {"hour": 15, "name": "Midday Hits Radio", "desc": "Non-stop chart toppers and party starters", "categories": ["hiphop_rnb", "global_hits", "latin"]},
    {"hour": 17, "name": "Lunchtime Beats", "desc": "Music videos and artist showcases", "categories": ["global_hits", "kpop_asia", "hiphop_rnb"]},
    {"hour": 19, "name": "Afternoon Mix", "desc": "Global hits from around the world", "categories": ["global_hits", "latin", "caribbean"]},
    
    # EVENING (5pm-11pm EST = 22-4 UTC)  
    {"hour": 21, "name": "Weekend Party Warm-Up", "desc": "Getting ready for the night ahead", "categories": ["european", "hiphop_rnb", "latin"]},
    {"hour": 23, "name": "Prime Time Party", "desc": "Club bangers and dance floor anthems", "categories": ["european", "global_hits", "latin"]},
    {"hour": 1, "name": "Peak Hour Party", "desc": "The hottest tracks for peak night energy", "categories": ["european", "hiphop_rnb", "latin"]},
    
    # LATE NIGHT (11pm-2am EST = 4-7 UTC)
    {"hour": 3, "name": "Late Night Chill", "desc": "Smooth R&B and slow jams", "categories": ["hiphop_rnb", "global_hits"]},
    {"hour": 5, "name": "After Hours Vibes", "desc": "Wind down with chill beats", "categories": ["global_hits", "bollywood"]},
    
    # EARLY MORNING (2am-6am EST = 7-11 UTC)
    {"hour": 7, "name": "Global Rewind", "desc": "International hits for worldwide viewers", "categories": ["global_hits", "kpop_asia", "latin"]},
    {"hour": 9, "name": "Classic Music Block", "desc": "Iconic music videos from the legends", "categories": ["global_hits", "hiphop_rnb", "caribbean"]},
]

def get_current_program_block(utc_hour: int) -> Dict:
    """Get the current program block based on UTC hour"""
    # Find which program block we're in
    for i, block in enumerate(TV_PROGRAM_SCHEDULE):
        next_block = TV_PROGRAM_SCHEDULE[(i + 1) % len(TV_PROGRAM_SCHEDULE)]
        block_hour = block["hour"]
        next_hour = next_block["hour"]
        
        # Handle wraparound at midnight
        if next_hour < block_hour:
            # Block spans midnight
            if utc_hour >= block_hour or utc_hour < next_hour:
                return block
        else:
            if block_hour <= utc_hour < next_hour:
                return block
    
    # Fallback to first block
    return TV_PROGRAM_SCHEDULE[0]

# Content categories from CONTENT_LIBRARY
CONTENT_CATEGORIES = [
    "global_hits", "latin", "kpop_asia", "bollywood", 
    "caribbean", "european", "hiphop_rnb", "comedy", "short_films",
    "viral_trending", "movies_trailers", "documentaries", "gaming", 
    "sports_highlights", "afrobeats", "french_rap", "zouk_caribbean", "classic_hits"
]

TIME_PREFERENCES = {
    # Morning (6am-12pm): Upbeat, inspirational music
    "morning": ["global_hits", "afrobeats", "kpop_asia", "latin", "bollywood", "classic_hits", "viral_trending"],
    # Afternoon (12pm-6pm): Mix of music genres
    "afternoon": ["latin", "hiphop_rnb", "afrobeats", "kpop_asia", "global_hits", "french_rap", "zouk_caribbean"],
    # Evening (6pm-12am): Entertainment, music
    "evening": ["global_hits", "afrobeats", "latin", "kpop_asia", "classic_hits", "hiphop_rnb", "french_rap"],
    # Night (12am-6am): Party music, chill vibes
    "night": ["latin", "hiphop_rnb", "european", "afrobeats", "viral_trending", "zouk_caribbean", "french_rap", "global_hits"]
}

# Weekend special scheduling - music focused
WEEKEND_PREFERENCES = {
    "morning": ["global_hits", "classic_hits", "viral_trending", "afrobeats"],
    "afternoon": ["latin", "kpop_asia", "hiphop_rnb", "afrobeats", "global_hits"],
    "evening": ["global_hits", "kpop_asia", "latin", "afrobeats", "hiphop_rnb"],
    "night": ["latin", "hiphop_rnb", "european", "afrobeats", "global_hits"]
}

def get_time_period(hour: int) -> str:
    if 6 <= hour < 12:
        return "morning"
    elif 12 <= hour < 18:
        return "afternoon"
    elif 18 <= hour < 24:
        return "evening"
    else:
        return "night"


# ============ VERIFIED EMBEDDABLE CONTENT LIBRARY ============
# All videos verified embeddable - REAL MUSIC VIDEOS ONLY (no static images)
# Diverse genres: Pop, Rock, Electronic, Hip Hop, R&B, Latin, K-Pop, Afrobeats, etc.
# Updated: April 2026

CONTENT_LIBRARY = {
    "global_hits": [
        # Ed Sheeran
        {"id": "gh_shapeofyou", "title": "Ed Sheeran - Shape of You", "video_url": "https://www.youtube.com/embed/JGwWNGJdvx8", "thumbnail": "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg", "duration_seconds": 263, "source": "Ed Sheeran", "category": "global_hits"},
        {"id": "gh_photograph", "title": "Ed Sheeran - Photograph", "video_url": "https://www.youtube.com/embed/nSDgHBxUbVQ", "thumbnail": "https://i.ytimg.com/vi/nSDgHBxUbVQ/hqdefault.jpg", "duration_seconds": 258, "source": "Ed Sheeran", "category": "global_hits"},
        {"id": "gh_perfect", "title": "Ed Sheeran - Perfect", "video_url": "https://www.youtube.com/embed/2Vv-BfVoq4g", "thumbnail": "https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg", "duration_seconds": 263, "source": "Ed Sheeran", "category": "global_hits"},
        {"id": "gh_thinkingout", "title": "Ed Sheeran - Thinking Out Loud", "video_url": "https://www.youtube.com/embed/lp-EO5I60KA", "thumbnail": "https://i.ytimg.com/vi/lp-EO5I60KA/hqdefault.jpg", "duration_seconds": 281, "source": "Ed Sheeran", "category": "global_hits"},
        # Imagine Dragons
        {"id": "gh_believer", "title": "Imagine Dragons - Believer", "video_url": "https://www.youtube.com/embed/7wtfhZwyrcc", "thumbnail": "https://i.ytimg.com/vi/7wtfhZwyrcc/hqdefault.jpg", "duration_seconds": 204, "source": "Imagine Dragons", "category": "global_hits"},
        {"id": "gh_thunder", "title": "Imagine Dragons - Thunder", "video_url": "https://www.youtube.com/embed/fKopy74weus", "thumbnail": "https://i.ytimg.com/vi/fKopy74weus/hqdefault.jpg", "duration_seconds": 204, "source": "Imagine Dragons", "category": "global_hits"},
        {"id": "gh_radioactive", "title": "Imagine Dragons - Radioactive", "video_url": "https://www.youtube.com/embed/ktvTqknDobU", "thumbnail": "https://i.ytimg.com/vi/ktvTqknDobU/hqdefault.jpg", "duration_seconds": 276, "source": "Imagine Dragons", "category": "global_hits"},
        {"id": "gh_demons", "title": "Imagine Dragons - Demons", "video_url": "https://www.youtube.com/embed/mWRsgZuwf_8", "thumbnail": "https://i.ytimg.com/vi/mWRsgZuwf_8/hqdefault.jpg", "duration_seconds": 357, "source": "Imagine Dragons", "category": "global_hits"},
        # Marshmello
        {"id": "gh_happier", "title": "Marshmello ft. Bastille - Happier", "video_url": "https://www.youtube.com/embed/m7Bc3pLyij0", "thumbnail": "https://i.ytimg.com/vi/m7Bc3pLyij0/hqdefault.jpg", "duration_seconds": 214, "source": "Marshmello", "category": "global_hits"},
        {"id": "gh_alone", "title": "Marshmello - Alone", "video_url": "https://www.youtube.com/embed/ALZHF5UqnU4", "thumbnail": "https://i.ytimg.com/vi/ALZHF5UqnU4/hqdefault.jpg", "duration_seconds": 220, "source": "Marshmello", "category": "global_hits"},
        {"id": "gh_friends", "title": "Marshmello & Anne-Marie - FRIENDS", "video_url": "https://www.youtube.com/embed/CY8E6N5Nzec", "thumbnail": "https://i.ytimg.com/vi/CY8E6N5Nzec/hqdefault.jpg", "duration_seconds": 189, "source": "Marshmello", "category": "global_hits"},
        # Charlie Puth
        {"id": "gh_attention", "title": "Charlie Puth - Attention", "video_url": "https://www.youtube.com/embed/nfs8NYg7yQM", "thumbnail": "https://i.ytimg.com/vi/nfs8NYg7yQM/hqdefault.jpg", "duration_seconds": 231, "source": "Charlie Puth", "category": "global_hits"},
        {"id": "gh_onecall", "title": "Charlie Puth - One Call Away", "video_url": "https://www.youtube.com/embed/BxuY9FET9Y4", "thumbnail": "https://i.ytimg.com/vi/BxuY9FET9Y4/hqdefault.jpg", "duration_seconds": 200, "source": "Charlie Puth", "category": "global_hits"},
        # Dua Lipa
        {"id": "gh_newrules", "title": "Dua Lipa - New Rules", "video_url": "https://www.youtube.com/embed/k2qgadSvNyU", "thumbnail": "https://i.ytimg.com/vi/k2qgadSvNyU/hqdefault.jpg", "duration_seconds": 209, "source": "Dua Lipa", "category": "global_hits"},
        {"id": "gh_dontstart", "title": "Dua Lipa - Don't Start Now", "video_url": "https://www.youtube.com/embed/oygrmJFKYZY", "thumbnail": "https://i.ytimg.com/vi/oygrmJFKYZY/hqdefault.jpg", "duration_seconds": 183, "source": "Dua Lipa", "category": "global_hits"},
        {"id": "gh_levitating", "title": "Dua Lipa - Levitating", "video_url": "https://www.youtube.com/embed/TUVcZfQe-Kw", "thumbnail": "https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg", "duration_seconds": 203, "source": "Dua Lipa", "category": "global_hits"},
        # The Weeknd
        {"id": "gh_blindinglights", "title": "The Weeknd - Blinding Lights", "video_url": "https://www.youtube.com/embed/4NRXx6U8ABQ", "thumbnail": "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg", "duration_seconds": 260, "source": "The Weeknd", "category": "global_hits"},
        {"id": "gh_starboy", "title": "The Weeknd - Starboy ft. Daft Punk", "video_url": "https://www.youtube.com/embed/34Na4j8AVgA", "thumbnail": "https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg", "duration_seconds": 229, "source": "The Weeknd", "category": "global_hits"},
        {"id": "gh_cantfeel", "title": "The Weeknd - Can't Feel My Face", "video_url": "https://www.youtube.com/embed/KEI4qSrkPAs", "thumbnail": "https://i.ytimg.com/vi/KEI4qSrkPAs/hqdefault.jpg", "duration_seconds": 213, "source": "The Weeknd", "category": "global_hits"},
        # Other global hits
        {"id": "gh_dancemonkey", "title": "Tones And I - Dance Monkey", "video_url": "https://www.youtube.com/embed/q0hyYWKXF0Q", "thumbnail": "https://i.ytimg.com/vi/q0hyYWKXF0Q/hqdefault.jpg", "duration_seconds": 210, "source": "Tones And I", "category": "global_hits"},
        {"id": "gh_countingstars", "title": "OneRepublic - Counting Stars", "video_url": "https://www.youtube.com/embed/hT_nvWreIhg", "thumbnail": "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg", "duration_seconds": 268, "source": "OneRepublic", "category": "global_hits"},
        {"id": "gh_havana", "title": "Camila Cabello - Havana ft. Young Thug", "video_url": "https://www.youtube.com/embed/BQ0mxQXmLsk", "thumbnail": "https://i.ytimg.com/vi/BQ0mxQXmLsk/hqdefault.jpg", "duration_seconds": 217, "source": "Camila Cabello", "category": "global_hits"},
        {"id": "gh_closer", "title": "The Chainsmokers - Closer ft. Halsey", "video_url": "https://www.youtube.com/embed/PT2_F-1esPk", "thumbnail": "https://i.ytimg.com/vi/PT2_F-1esPk/hqdefault.jpg", "duration_seconds": 244, "source": "The Chainsmokers", "category": "global_hits"},
        {"id": "gh_something", "title": "The Chainsmokers - Something Just Like This", "video_url": "https://www.youtube.com/embed/FM7MFYoylVs", "thumbnail": "https://i.ytimg.com/vi/FM7MFYoylVs/hqdefault.jpg", "duration_seconds": 247, "source": "The Chainsmokers", "category": "global_hits"},
        {"id": "gh_senorita", "title": "Shawn Mendes, Camila Cabello - Señorita", "video_url": "https://www.youtube.com/embed/Pkh8UtuejGw", "thumbnail": "https://i.ytimg.com/vi/Pkh8UtuejGw/hqdefault.jpg", "duration_seconds": 191, "source": "Shawn Mendes", "category": "global_hits"},
        {"id": "gh_stitches", "title": "Shawn Mendes - Stitches", "video_url": "https://www.youtube.com/embed/VbfpW0pbvaU", "thumbnail": "https://i.ytimg.com/vi/VbfpW0pbvaU/hqdefault.jpg", "duration_seconds": 200, "source": "Shawn Mendes", "category": "global_hits"},
        {"id": "gh_lovely", "title": "Billie Eilish, Khalid - lovely", "video_url": "https://www.youtube.com/embed/V1Pl8CzNzCw", "thumbnail": "https://i.ytimg.com/vi/V1Pl8CzNzCw/hqdefault.jpg", "duration_seconds": 200, "source": "Billie Eilish", "category": "global_hits"},
        {"id": "gh_badguy", "title": "Billie Eilish - bad guy", "video_url": "https://www.youtube.com/embed/DyDfgMOUjCI", "thumbnail": "https://i.ytimg.com/vi/DyDfgMOUjCI/hqdefault.jpg", "duration_seconds": 194, "source": "Billie Eilish", "category": "global_hits"},
        {"id": "gh_someone", "title": "Lewis Capaldi - Someone You Loved", "video_url": "https://www.youtube.com/embed/zABLecsR5UE", "thumbnail": "https://i.ytimg.com/vi/zABLecsR5UE/hqdefault.jpg", "duration_seconds": 182, "source": "Lewis Capaldi", "category": "global_hits"},
        {"id": "gh_memories", "title": "Maroon 5 - Memories", "video_url": "https://www.youtube.com/embed/SlPhMPnQ58k", "thumbnail": "https://i.ytimg.com/vi/SlPhMPnQ58k/hqdefault.jpg", "duration_seconds": 189, "source": "Maroon 5", "category": "global_hits"},
        {"id": "gh_uptownfunk", "title": "Mark Ronson - Uptown Funk ft. Bruno Mars", "video_url": "https://www.youtube.com/embed/OPf0YbXqDm0", "thumbnail": "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg", "duration_seconds": 270, "source": "Bruno Mars", "category": "global_hits"},
        {"id": "gh_24k", "title": "Bruno Mars - 24K Magic", "video_url": "https://www.youtube.com/embed/UqyT8IEBkvY", "thumbnail": "https://i.ytimg.com/vi/UqyT8IEBkvY/hqdefault.jpg", "duration_seconds": 227, "source": "Bruno Mars", "category": "global_hits"},
        {"id": "gh_wakaup", "title": "Avicii - Wake Me Up", "video_url": "https://www.youtube.com/embed/IcrbM1l_BoI", "thumbnail": "https://i.ytimg.com/vi/IcrbM1l_BoI/hqdefault.jpg", "duration_seconds": 270, "source": "Avicii", "category": "global_hits"},
        {"id": "gh_rema_calm", "title": "Rema - Calm Down", "video_url": "https://www.youtube.com/embed/CQLsdm1ZYAw", "thumbnail": "https://i.ytimg.com/vi/CQLsdm1ZYAw/hqdefault.jpg", "duration_seconds": 239, "source": "Rema", "category": "global_hits"},
    ],

    "latin": [
        {"id": "lat_miGente", "title": "J Balvin, Willy William - Mi Gente", "video_url": "https://www.youtube.com/embed/wnJ6LuUFpMo", "thumbnail": "https://i.ytimg.com/vi/wnJ6LuUFpMo/hqdefault.jpg", "duration_seconds": 189, "source": "J Balvin", "category": "latin"},
        {"id": "lat_bailando", "title": "Enrique Iglesias - Bailando ft. Descemer", "video_url": "https://www.youtube.com/embed/NUsoVlDFqZg", "thumbnail": "https://i.ytimg.com/vi/NUsoVlDFqZg/hqdefault.jpg", "duration_seconds": 267, "source": "Enrique Iglesias", "category": "latin"},
        {"id": "lat_calma", "title": "Pedro Capó - Calma (Remix) ft. Farruko", "video_url": "https://www.youtube.com/embed/1_zgKRBrT0Y", "thumbnail": "https://i.ytimg.com/vi/1_zgKRBrT0Y/hqdefault.jpg", "duration_seconds": 234, "source": "Pedro Capó", "category": "latin"},
        {"id": "lat_china", "title": "Anuel AA, Daddy Yankee - China", "video_url": "https://www.youtube.com/embed/0VR3dfZf9Yg", "thumbnail": "https://i.ytimg.com/vi/0VR3dfZf9Yg/hqdefault.jpg", "duration_seconds": 318, "source": "Anuel AA", "category": "latin"},
        {"id": "lat_mayores", "title": "Becky G - Mayores ft. Bad Bunny", "video_url": "https://www.youtube.com/embed/GMFewiplIbw", "thumbnail": "https://i.ytimg.com/vi/GMFewiplIbw/hqdefault.jpg", "duration_seconds": 233, "source": "Becky G", "category": "latin"},
        {"id": "lat_hawai", "title": "Maluma - Hawái", "video_url": "https://www.youtube.com/embed/FTnBc_-QCXk", "thumbnail": "https://i.ytimg.com/vi/FTnBc_-QCXk/hqdefault.jpg", "duration_seconds": 203, "source": "Maluma", "category": "latin"},
        {"id": "lat_dakiti", "title": "Bad Bunny x Jhay Cortez - Dakiti", "video_url": "https://www.youtube.com/embed/TmKh7lAwnBI", "thumbnail": "https://i.ytimg.com/vi/TmKh7lAwnBI/hqdefault.jpg", "duration_seconds": 205, "source": "Bad Bunny", "category": "latin"},
        {"id": "lat_perdon", "title": "Nicky Jam & Enrique Iglesias - El Perdón", "video_url": "https://www.youtube.com/embed/0Gl2QnHNpkA", "thumbnail": "https://i.ytimg.com/vi/0Gl2QnHNpkA/hqdefault.jpg", "duration_seconds": 261, "source": "Nicky Jam", "category": "latin"},
        {"id": "lat_gasolina", "title": "Daddy Yankee - Gasolina", "video_url": "https://www.youtube.com/embed/CCF1_jI8Prk", "thumbnail": "https://i.ytimg.com/vi/CCF1_jI8Prk/hqdefault.jpg", "duration_seconds": 219, "source": "Daddy Yankee", "category": "latin"},
        {"id": "lat_suavemente", "title": "Elvis Crespo - Suavemente", "video_url": "https://www.youtube.com/embed/WPiEbYSF9kE", "thumbnail": "https://i.ytimg.com/vi/WPiEbYSF9kE/hqdefault.jpg", "duration_seconds": 224, "source": "Sony Music", "category": "latin"},
        {"id": "lat_oye_como", "title": "Santana - Oye Como Va", "video_url": "https://www.youtube.com/embed/J7ATTjg7tpE", "thumbnail": "https://i.ytimg.com/vi/J7ATTjg7tpE/hqdefault.jpg", "duration_seconds": 265, "source": "Santana", "category": "latin"},
        {"id": "lat_conga", "title": "Gloria Estefan - Conga", "video_url": "https://www.youtube.com/embed/54ItEmCnP80", "thumbnail": "https://i.ytimg.com/vi/54ItEmCnP80/hqdefault.jpg", "duration_seconds": 269, "source": "Gloria Estefan", "category": "latin"},
        {"id": "lat_livin", "title": "Ricky Martin - Livin' La Vida Loca", "video_url": "https://www.youtube.com/embed/p47fEXGabaY", "thumbnail": "https://i.ytimg.com/vi/p47fEXGabaY/hqdefault.jpg", "duration_seconds": 242, "source": "Ricky Martin", "category": "latin"},
        # NEW Latin additions
        {"id": "lat_dura", "title": "Daddy Yankee - Dura", "video_url": "https://www.youtube.com/embed/oJpsmxCi9oo", "thumbnail": "https://i.ytimg.com/vi/oJpsmxCi9oo/hqdefault.jpg", "duration_seconds": 222, "source": "Daddy Yankee", "category": "latin"},
        {"id": "lat_despacito", "title": "Luis Fonsi - Despacito ft. Daddy Yankee", "video_url": "https://www.youtube.com/embed/kJQP7kiw5Fk", "thumbnail": "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg", "duration_seconds": 282, "source": "Luis Fonsi", "category": "latin"},
        {"id": "lat_felices4", "title": "Maluma - Felices los 4", "video_url": "https://www.youtube.com/embed/t_jHrUE5IOk", "thumbnail": "https://i.ytimg.com/vi/t_jHrUE5IOk/hqdefault.jpg", "duration_seconds": 229, "source": "Maluma", "category": "latin"},
        {"id": "lat_chantaje", "title": "Shakira - Chantaje ft. Maluma", "video_url": "https://www.youtube.com/embed/6Mgqbai3fKo", "thumbnail": "https://i.ytimg.com/vi/6Mgqbai3fKo/hqdefault.jpg", "duration_seconds": 195, "source": "Shakira", "category": "latin"},
        {"id": "lat_loca", "title": "Shakira - Loca ft. El Cata", "video_url": "https://www.youtube.com/embed/XAhTt60W7qo", "thumbnail": "https://i.ytimg.com/vi/XAhTt60W7qo/hqdefault.jpg", "duration_seconds": 195, "source": "Shakira", "category": "latin"},
        {"id": "lat_hips", "title": "Shakira - Hips Don't Lie ft. Wyclef Jean", "video_url": "https://www.youtube.com/embed/DUT5rEU6pqM", "thumbnail": "https://i.ytimg.com/vi/DUT5rEU6pqM/hqdefault.jpg", "duration_seconds": 218, "source": "Shakira", "category": "latin"},
        {"id": "lat_waka", "title": "Shakira - Waka Waka (World Cup)", "video_url": "https://www.youtube.com/embed/pRpeEdMmmQ0", "thumbnail": "https://i.ytimg.com/vi/pRpeEdMmmQ0/hqdefault.jpg", "duration_seconds": 212, "source": "Shakira", "category": "latin"},
        {"id": "lat_tusa", "title": "KAROL G, Nicki Minaj - Tusa", "video_url": "https://www.youtube.com/embed/tbneQDc9A6w", "thumbnail": "https://i.ytimg.com/vi/tbneQDc9A6w/hqdefault.jpg", "duration_seconds": 201, "source": "KAROL G", "category": "latin"},
        {"id": "lat_criminal", "title": "Natti Natasha x Ozuna - Criminal", "video_url": "https://www.youtube.com/embed/VpYFmx2G_5M", "thumbnail": "https://i.ytimg.com/vi/VpYFmx2G_5M/hqdefault.jpg", "duration_seconds": 270, "source": "Natti Natasha", "category": "latin"},
        {"id": "lat_corazon", "title": "Maluma - Corazón ft. Nego do Borel", "video_url": "https://www.youtube.com/embed/rh0vvJNKoI8", "thumbnail": "https://i.ytimg.com/vi/rh0vvJNKoI8/hqdefault.jpg", "duration_seconds": 231, "source": "Maluma", "category": "latin"},
        {"id": "lat_borro", "title": "Enrique Iglesias - El Baño ft. Bad Bunny", "video_url": "https://www.youtube.com/embed/EeqCGzkOUYE", "thumbnail": "https://i.ytimg.com/vi/EeqCGzkOUYE/hqdefault.jpg", "duration_seconds": 213, "source": "Enrique Iglesias", "category": "latin"},
        {"id": "lat_safaera", "title": "Bad Bunny - Safaera", "video_url": "https://www.youtube.com/embed/jCQ_6XbATPc", "thumbnail": "https://i.ytimg.com/vi/jCQ_6XbATPc/hqdefault.jpg", "duration_seconds": 295, "source": "Bad Bunny", "category": "latin"},
    ],

    "kpop_asia": [
        {"id": "kpop_dynamite", "title": "BTS - Dynamite", "video_url": "https://www.youtube.com/embed/gdZLi9oWNZg", "thumbnail": "https://i.ytimg.com/vi/gdZLi9oWNZg/hqdefault.jpg", "duration_seconds": 222, "source": "BTS", "category": "kpop_asia"},
        {"id": "kpop_butter", "title": "BTS - Butter", "video_url": "https://www.youtube.com/embed/WMweEpGlu_U", "thumbnail": "https://i.ytimg.com/vi/WMweEpGlu_U/hqdefault.jpg", "duration_seconds": 189, "source": "BTS", "category": "kpop_asia"},
        {"id": "kpop_boyproblems", "title": "BTS - Boy With Luv ft. Halsey", "video_url": "https://www.youtube.com/embed/XsX3ATc3FbA", "thumbnail": "https://i.ytimg.com/vi/XsX3ATc3FbA/hqdefault.jpg", "duration_seconds": 253, "source": "BTS", "category": "kpop_asia"},
        {"id": "kpop_ddudu", "title": "BLACKPINK - DDU-DU DDU-DU", "video_url": "https://www.youtube.com/embed/IHNzOHi8sJs", "thumbnail": "https://i.ytimg.com/vi/IHNzOHi8sJs/hqdefault.jpg", "duration_seconds": 209, "source": "BLACKPINK", "category": "kpop_asia"},
        {"id": "kpop_howyoulike", "title": "BLACKPINK - How You Like That", "video_url": "https://www.youtube.com/embed/ioNng23DkIM", "thumbnail": "https://i.ytimg.com/vi/ioNng23DkIM/hqdefault.jpg", "duration_seconds": 183, "source": "BLACKPINK", "category": "kpop_asia"},
        {"id": "kpop_icecream", "title": "BLACKPINK - Ice Cream ft. Selena Gomez", "video_url": "https://www.youtube.com/embed/vRXZj0DzXIA", "thumbnail": "https://i.ytimg.com/vi/vRXZj0DzXIA/hqdefault.jpg", "duration_seconds": 177, "source": "BLACKPINK", "category": "kpop_asia"},
        {"id": "kpop_lovesick", "title": "BLACKPINK - Lovesick Girls", "video_url": "https://www.youtube.com/embed/dyRsYk0LyA8", "thumbnail": "https://i.ytimg.com/vi/dyRsYk0LyA8/hqdefault.jpg", "duration_seconds": 195, "source": "BLACKPINK", "category": "kpop_asia"},
        {"id": "kpop_godsmenu", "title": "Stray Kids - God's Menu", "video_url": "https://www.youtube.com/embed/TQTlCHxyuu8", "thumbnail": "https://i.ytimg.com/vi/TQTlCHxyuu8/hqdefault.jpg", "duration_seconds": 199, "source": "Stray Kids", "category": "kpop_asia"},
        {"id": "kpop_backstreet", "title": "Stray Kids - Back Door", "video_url": "https://www.youtube.com/embed/X-uJtV8ScYk", "thumbnail": "https://i.ytimg.com/vi/X-uJtV8ScYk/hqdefault.jpg", "duration_seconds": 190, "source": "Stray Kids", "category": "kpop_asia"},
        {"id": "kpop_next", "title": "TWICE - What is Love?", "video_url": "https://www.youtube.com/embed/i0p1bmr0EmE", "thumbnail": "https://i.ytimg.com/vi/i0p1bmr0EmE/hqdefault.jpg", "duration_seconds": 206, "source": "TWICE", "category": "kpop_asia"},
        {"id": "kpop_fancy", "title": "TWICE - FANCY", "video_url": "https://www.youtube.com/embed/kOHB85vDuow", "thumbnail": "https://i.ytimg.com/vi/kOHB85vDuow/hqdefault.jpg", "duration_seconds": 207, "source": "TWICE", "category": "kpop_asia"},
        {"id": "kpop_attention", "title": "NewJeans - Attention", "video_url": "https://www.youtube.com/embed/js1CtxSY38I", "thumbnail": "https://i.ytimg.com/vi/js1CtxSY38I/hqdefault.jpg", "duration_seconds": 180, "source": "NewJeans", "category": "kpop_asia"},
    ],

    "bollywood": [
        {"id": "bolly_kesariya", "title": "Kesariya - Brahmastra", "video_url": "https://www.youtube.com/embed/BddP6PYo2gs", "thumbnail": "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg", "duration_seconds": 288, "source": "T-Series", "category": "bollywood"},
        {"id": "bolly_kar", "title": "Kar Gayi Chull - Kapoor & Sons", "video_url": "https://www.youtube.com/embed/NTHz9ephYTw", "thumbnail": "https://i.ytimg.com/vi/NTHz9ephYTw/hqdefault.jpg", "duration_seconds": 202, "source": "T-Series", "category": "bollywood"},
        {"id": "bolly_kala", "title": "Kala Chashma - Baar Baar Dekho", "video_url": "https://www.youtube.com/embed/k4yXQkG2s1E", "thumbnail": "https://i.ytimg.com/vi/k4yXQkG2s1E/hqdefault.jpg", "duration_seconds": 271, "source": "Sony Music", "category": "bollywood"},
        {"id": "bolly_tum_hi_ho", "title": "Tum Hi Ho - Aashiqui 2", "video_url": "https://www.youtube.com/embed/IJq0yyWug1k", "thumbnail": "https://i.ytimg.com/vi/IJq0yyWug1k/hqdefault.jpg", "duration_seconds": 263, "source": "T-Series", "category": "bollywood"},
        {"id": "bolly_jai_ho", "title": "Jai Ho - Slumdog Millionaire", "video_url": "https://www.youtube.com/embed/xwwAVRyNmgQ", "thumbnail": "https://i.ytimg.com/vi/xwwAVRyNmgQ/hqdefault.jpg", "duration_seconds": 312, "source": "Interscope", "category": "bollywood"},
        {"id": "bolly_balam", "title": "Balam Pichkari - Yeh Jawaani", "video_url": "https://www.youtube.com/embed/0WtRNGubWGA", "thumbnail": "https://i.ytimg.com/vi/0WtRNGubWGA/hqdefault.jpg", "duration_seconds": 289, "source": "T-Series", "category": "bollywood"},
    ],

    "caribbean": [
        {"id": "carib_work", "title": "Rihanna - Work ft. Drake", "video_url": "https://www.youtube.com/embed/HL1UzIK-flA", "thumbnail": "https://i.ytimg.com/vi/HL1UzIK-flA/hqdefault.jpg", "duration_seconds": 231, "source": "Rihanna", "category": "caribbean"},
        {"id": "carib_toosie", "title": "Drake - Toosie Slide", "video_url": "https://www.youtube.com/embed/xWggTb45brM", "thumbnail": "https://i.ytimg.com/vi/xWggTb45brM/hqdefault.jpg", "duration_seconds": 247, "source": "Drake", "category": "caribbean"},
        {"id": "carib_temperature", "title": "Sean Paul - Temperature", "video_url": "https://www.youtube.com/embed/dW2MmuA1nI4", "thumbnail": "https://i.ytimg.com/vi/dW2MmuA1nI4/hqdefault.jpg", "duration_seconds": 227, "source": "Sean Paul", "category": "caribbean"},
        {"id": "carib_cheerleader", "title": "OMI - Cheerleader (Felix Jaehn Remix)", "video_url": "https://www.youtube.com/embed/jGflUbPQfW8", "thumbnail": "https://i.ytimg.com/vi/jGflUbPQfW8/hqdefault.jpg", "duration_seconds": 180, "source": "OMI", "category": "caribbean"},
        {"id": "carib_no_lie", "title": "Sean Paul - No Lie ft. Dua Lipa", "video_url": "https://www.youtube.com/embed/GzU8KqOY8YA", "thumbnail": "https://i.ytimg.com/vi/GzU8KqOY8YA/hqdefault.jpg", "duration_seconds": 223, "source": "Sean Paul", "category": "caribbean"},
        {"id": "carib_shake", "title": "Sean Paul - Shake That Thing", "video_url": "https://www.youtube.com/embed/nZXRV4MezEw", "thumbnail": "https://i.ytimg.com/vi/nZXRV4MezEw/hqdefault.jpg", "duration_seconds": 209, "source": "Sean Paul", "category": "caribbean"},
    ],

    "european": [
        {"id": "euro_titanium", "title": "David Guetta ft. Sia - Titanium", "video_url": "https://www.youtube.com/embed/JRfuAukYTKg", "thumbnail": "https://i.ytimg.com/vi/JRfuAukYTKg/hqdefault.jpg", "duration_seconds": 245, "source": "David Guetta", "category": "european"},
        {"id": "euro_hey", "title": "David Guetta - Hey Mama ft. Nicki Minaj", "video_url": "https://www.youtube.com/embed/uO59tfQ2TbA", "thumbnail": "https://i.ytimg.com/vi/uO59tfQ2TbA/hqdefault.jpg", "duration_seconds": 196, "source": "David Guetta", "category": "european"},
        {"id": "euro_lean", "title": "Major Lazer - Lean On ft. DJ Snake, MØ", "video_url": "https://www.youtube.com/embed/YqeW9_5kURI", "thumbnail": "https://i.ytimg.com/vi/YqeW9_5kURI/hqdefault.jpg", "duration_seconds": 177, "source": "Major Lazer", "category": "european"},
        {"id": "euro_turn", "title": "DJ Snake - Turn Down for What ft. Lil Jon", "video_url": "https://www.youtube.com/embed/HMUDVMiITOU", "thumbnail": "https://i.ytimg.com/vi/HMUDVMiITOU/hqdefault.jpg", "duration_seconds": 218, "source": "DJ Snake", "category": "european"},
        {"id": "euro_taki", "title": "DJ Snake - Taki Taki ft. Selena Gomez, Ozuna", "video_url": "https://www.youtube.com/embed/ixkoVwKQaJg", "thumbnail": "https://i.ytimg.com/vi/ixkoVwKQaJg/hqdefault.jpg", "duration_seconds": 222, "source": "DJ Snake", "category": "european"},
        {"id": "euro_scared", "title": "Martin Garrix - Scared To Be Lonely ft. Dua Lipa", "video_url": "https://www.youtube.com/embed/e2vBLd5Egnk", "thumbnail": "https://i.ytimg.com/vi/e2vBLd5Egnk/hqdefault.jpg", "duration_seconds": 221, "source": "Martin Garrix", "category": "european"},
        {"id": "euro_animals", "title": "Martin Garrix - Animals", "video_url": "https://www.youtube.com/embed/gCYcHz2k5x0", "thumbnail": "https://i.ytimg.com/vi/gCYcHz2k5x0/hqdefault.jpg", "duration_seconds": 187, "source": "Martin Garrix", "category": "european"},
        {"id": "euro_wake", "title": "Avicii - Wake Me Up", "video_url": "https://www.youtube.com/embed/IcrbM1l_BoI", "thumbnail": "https://i.ytimg.com/vi/IcrbM1l_BoI/hqdefault.jpg", "duration_seconds": 250, "source": "Avicii", "category": "european"},
        {"id": "euro_levels", "title": "Avicii - Levels", "video_url": "https://www.youtube.com/embed/_ovdm2yX4MA", "thumbnail": "https://i.ytimg.com/vi/_ovdm2yX4MA/hqdefault.jpg", "duration_seconds": 214, "source": "Avicii", "category": "european"},
        {"id": "euro_faded", "title": "Alan Walker - Faded", "video_url": "https://www.youtube.com/embed/60ItHLz5WEA", "thumbnail": "https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg", "duration_seconds": 212, "source": "Alan Walker", "category": "european"},
    ],

    "hiphop_rnb": [
        {"id": "hh_godsplan", "title": "Drake - God's Plan", "video_url": "https://www.youtube.com/embed/xpVfcZ0ZcFM", "thumbnail": "https://i.ytimg.com/vi/xpVfcZ0ZcFM/hqdefault.jpg", "duration_seconds": 356, "source": "Drake", "category": "hiphop_rnb"},
        {"id": "hh_hotline", "title": "Drake - Hotline Bling", "video_url": "https://www.youtube.com/embed/uxpDa-c-4Mc", "thumbnail": "https://i.ytimg.com/vi/uxpDa-c-4Mc/hqdefault.jpg", "duration_seconds": 271, "source": "Drake", "category": "hiphop_rnb"},
        {"id": "hh_starboy", "title": "The Weeknd - Starboy ft. Daft Punk", "video_url": "https://www.youtube.com/embed/34Na4j8AVgA", "thumbnail": "https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg", "duration_seconds": 230, "source": "The Weeknd", "category": "hiphop_rnb"},
        {"id": "hh_humble", "title": "Kendrick Lamar - HUMBLE.", "video_url": "https://www.youtube.com/embed/tvTRZJ-4EyI", "thumbnail": "https://i.ytimg.com/vi/tvTRZJ-4EyI/hqdefault.jpg", "duration_seconds": 177, "source": "Kendrick Lamar", "category": "hiphop_rnb"},
        {"id": "hh_alright", "title": "Kendrick Lamar - Alright", "video_url": "https://www.youtube.com/embed/Z-48u_uWMHY", "thumbnail": "https://i.ytimg.com/vi/Z-48u_uWMHY/hqdefault.jpg", "duration_seconds": 391, "source": "Kendrick Lamar", "category": "hiphop_rnb"},
        {"id": "hh_rockstar", "title": "Post Malone - rockstar ft. 21 Savage", "video_url": "https://www.youtube.com/embed/UceaB4D0jpo", "thumbnail": "https://i.ytimg.com/vi/UceaB4D0jpo/hqdefault.jpg", "duration_seconds": 218, "source": "Post Malone", "category": "hiphop_rnb"},
        {"id": "hh_congratulations", "title": "Post Malone - Congratulations ft. Quavo", "video_url": "https://www.youtube.com/embed/SC4xMk98Pdc", "thumbnail": "https://i.ytimg.com/vi/SC4xMk98Pdc/hqdefault.jpg", "duration_seconds": 220, "source": "Post Malone", "category": "hiphop_rnb"},
        {"id": "hh_circles", "title": "Post Malone - Circles", "video_url": "https://www.youtube.com/embed/wXhTHyIgQ_U", "thumbnail": "https://i.ytimg.com/vi/wXhTHyIgQ_U/hqdefault.jpg", "duration_seconds": 215, "source": "Post Malone", "category": "hiphop_rnb"},
        {"id": "hh_mood", "title": "24kGoldn - Mood ft. iann dior", "video_url": "https://www.youtube.com/embed/GrAchTdepsU", "thumbnail": "https://i.ytimg.com/vi/GrAchTdepsU/hqdefault.jpg", "duration_seconds": 140, "source": "24kGoldn", "category": "hiphop_rnb"},
        {"id": "hh_peaches", "title": "Justin Bieber - Peaches ft. Daniel Caesar, Giveon", "video_url": "https://www.youtube.com/embed/tQ0yjYUFKAE", "thumbnail": "https://i.ytimg.com/vi/tQ0yjYUFKAE/hqdefault.jpg", "duration_seconds": 198, "source": "Justin Bieber", "category": "hiphop_rnb"},
        {"id": "hh_stay", "title": "The Kid LAROI, Justin Bieber - STAY", "video_url": "https://www.youtube.com/embed/kTJczUoc26U", "thumbnail": "https://i.ytimg.com/vi/kTJczUoc26U/hqdefault.jpg", "duration_seconds": 141, "source": "The Kid LAROI", "category": "hiphop_rnb"},
        {"id": "hh_industry", "title": "Lil Nas X - INDUSTRY BABY ft. Jack Harlow", "video_url": "https://www.youtube.com/embed/UTHLKHL_whs", "thumbnail": "https://i.ytimg.com/vi/UTHLKHL_whs/hqdefault.jpg", "duration_seconds": 212, "source": "Lil Nas X", "category": "hiphop_rnb"},
        # NEW Hip-Hop/R&B additions
        {"id": "hh_blinding", "title": "The Weeknd - Blinding Lights", "video_url": "https://www.youtube.com/embed/4NRXx6U8ABQ", "thumbnail": "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg", "duration_seconds": 263, "source": "The Weeknd", "category": "hiphop_rnb"},
        {"id": "hh_save", "title": "The Weeknd - Save Your Tears", "video_url": "https://www.youtube.com/embed/XXYlFuWEuKI", "thumbnail": "https://i.ytimg.com/vi/XXYlFuWEuKI/hqdefault.jpg", "duration_seconds": 215, "source": "The Weeknd", "category": "hiphop_rnb"},
        {"id": "hh_oldtown", "title": "Lil Nas X - Old Town Road ft. Billy Ray Cyrus", "video_url": "https://www.youtube.com/embed/r7qovpFAGrQ", "thumbnail": "https://i.ytimg.com/vi/r7qovpFAGrQ/hqdefault.jpg", "duration_seconds": 157, "source": "Lil Nas X", "category": "hiphop_rnb"},
        {"id": "hh_montero", "title": "Lil Nas X - MONTERO (Call Me By Your Name)", "video_url": "https://www.youtube.com/embed/6swmTBVI83k", "thumbnail": "https://i.ytimg.com/vi/6swmTBVI83k/hqdefault.jpg", "duration_seconds": 137, "source": "Lil Nas X", "category": "hiphop_rnb"},
        {"id": "hh_sunflower", "title": "Post Malone, Swae Lee - Sunflower", "video_url": "https://www.youtube.com/embed/ApXoWvfEYVU", "thumbnail": "https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg", "duration_seconds": 158, "source": "Post Malone", "category": "hiphop_rnb"},
        {"id": "hh_sicko", "title": "Travis Scott - SICKO MODE", "video_url": "https://www.youtube.com/embed/6ONRf7h3Mdk", "thumbnail": "https://i.ytimg.com/vi/6ONRf7h3Mdk/hqdefault.jpg", "duration_seconds": 312, "source": "Travis Scott", "category": "hiphop_rnb"},
        {"id": "hh_highest", "title": "Travis Scott - HIGHEST IN THE ROOM", "video_url": "https://www.youtube.com/embed/tfSS1e3kYeo", "thumbnail": "https://i.ytimg.com/vi/tfSS1e3kYeo/hqdefault.jpg", "duration_seconds": 176, "source": "Travis Scott", "category": "hiphop_rnb"},
        {"id": "hh_laugh", "title": "Drake - Laugh Now Cry Later ft. Lil Durk", "video_url": "https://www.youtube.com/embed/JFm7YDVlqnI", "thumbnail": "https://i.ytimg.com/vi/JFm7YDVlqnI/hqdefault.jpg", "duration_seconds": 261, "source": "Drake", "category": "hiphop_rnb"},
        {"id": "hh_whats", "title": "Drake - What's Next", "video_url": "https://www.youtube.com/embed/OjNwVP3jxZQ", "thumbnail": "https://i.ytimg.com/vi/OjNwVP3jxZQ/hqdefault.jpg", "duration_seconds": 179, "source": "Drake", "category": "hiphop_rnb"},
        {"id": "hh_goosebumps", "title": "Travis Scott - goosebumps ft. Kendrick Lamar", "video_url": "https://www.youtube.com/embed/Dst9gZkq1a8", "thumbnail": "https://i.ytimg.com/vi/Dst9gZkq1a8/hqdefault.jpg", "duration_seconds": 243, "source": "Travis Scott", "category": "hiphop_rnb"},
        {"id": "hh_therefore", "title": "The Weeknd - The Hills", "video_url": "https://www.youtube.com/embed/yzTuBuRdAyA", "thumbnail": "https://i.ytimg.com/vi/yzTuBuRdAyA/hqdefault.jpg", "duration_seconds": 242, "source": "The Weeknd", "category": "hiphop_rnb"},
        {"id": "hh_dna", "title": "Kendrick Lamar - DNA.", "video_url": "https://www.youtube.com/embed/NLZRYQMLDW4", "thumbnail": "https://i.ytimg.com/vi/NLZRYQMLDW4/hqdefault.jpg", "duration_seconds": 185, "source": "Kendrick Lamar", "category": "hiphop_rnb"},
    ],

    "comedy": [
        # Stand-Up Comedy - Verified Embeddable Clips
        {"id": "com_kevin_hart", "title": "Kevin Hart - Laugh at My Pain (Best Of)", "video_url": "https://www.youtube.com/embed/ckEhChBJStY", "thumbnail": "https://i.ytimg.com/vi/ckEhChBJStY/hqdefault.jpg", "duration_seconds": 420, "source": "Kevin Hart", "category": "comedy"},
        {"id": "com_trevor_noah", "title": "Trevor Noah - Son of Patricia Highlights", "video_url": "https://www.youtube.com/embed/L3nODFbTg_s", "thumbnail": "https://i.ytimg.com/vi/L3nODFbTg_s/hqdefault.jpg", "duration_seconds": 380, "source": "Trevor Noah", "category": "comedy"},
        {"id": "com_gabriel", "title": "Gabriel Iglesias - Fluffy Movie Clips", "video_url": "https://www.youtube.com/embed/lJJ89PH2TsU", "thumbnail": "https://i.ytimg.com/vi/lJJ89PH2TsU/hqdefault.jpg", "duration_seconds": 450, "source": "Gabriel Iglesias", "category": "comedy"},
        {"id": "com_russell_peters", "title": "Russell Peters - Outsourced Comedy", "video_url": "https://www.youtube.com/embed/bJCYyrbhTog", "thumbnail": "https://i.ytimg.com/vi/bJCYyrbhTog/hqdefault.jpg", "duration_seconds": 540, "source": "Russell Peters", "category": "comedy"},
        {"id": "com_dave_chappelle", "title": "Dave Chappelle - Classic Bits", "video_url": "https://www.youtube.com/embed/hFKCwdnSPYM", "thumbnail": "https://i.ytimg.com/vi/hFKCwdnSPYM/hqdefault.jpg", "duration_seconds": 360, "source": "Comedy Central", "category": "comedy"},
        {"id": "com_jfl_best", "title": "Just For Laughs - Best Pranks Compilation", "video_url": "https://www.youtube.com/embed/BNlyZSvsNjw", "thumbnail": "https://i.ytimg.com/vi/BNlyZSvsNjw/hqdefault.jpg", "duration_seconds": 600, "source": "Just For Laughs", "category": "comedy"},
        {"id": "com_jfl_gags", "title": "Just For Laughs Gags - Funniest Moments", "video_url": "https://www.youtube.com/embed/H0WynQgUlWo", "thumbnail": "https://i.ytimg.com/vi/H0WynQgUlWo/hqdefault.jpg", "duration_seconds": 720, "source": "Just For Laughs", "category": "comedy"},
        {"id": "com_eddie_murphy", "title": "Eddie Murphy - Delirious Highlights", "video_url": "https://www.youtube.com/embed/5K1RcKJVbHA", "thumbnail": "https://i.ytimg.com/vi/5K1RcKJVbHA/hqdefault.jpg", "duration_seconds": 480, "source": "Eddie Murphy", "category": "comedy"},
        {"id": "com_jim_carrey", "title": "Jim Carrey - Best Comedy Moments", "video_url": "https://www.youtube.com/embed/iK6SS8CXYZo", "thumbnail": "https://i.ytimg.com/vi/iK6SS8CXYZo/hqdefault.jpg", "duration_seconds": 540, "source": "Jim Carrey", "category": "comedy"},
        {"id": "com_mr_bean", "title": "Mr. Bean - Funniest Moments Compilation", "video_url": "https://www.youtube.com/embed/bHNczNvOnGc", "thumbnail": "https://i.ytimg.com/vi/bHNczNvOnGc/hqdefault.jpg", "duration_seconds": 900, "source": "Mr. Bean", "category": "comedy"},
        {"id": "com_bean_holiday", "title": "Mr. Bean's Holiday - Best Scenes", "video_url": "https://www.youtube.com/embed/NVP4l4FC0gE", "thumbnail": "https://i.ytimg.com/vi/NVP4l4FC0gE/hqdefault.jpg", "duration_seconds": 600, "source": "Mr. Bean", "category": "comedy"},
        {"id": "com_key_peele", "title": "Key & Peele - Best Sketches", "video_url": "https://www.youtube.com/embed/m1bLXk6UVts", "thumbnail": "https://i.ytimg.com/vi/m1bLXk6UVts/hqdefault.jpg", "duration_seconds": 480, "source": "Comedy Central", "category": "comedy"},
        {"id": "com_snl_best", "title": "SNL - Best Sketches Compilation", "video_url": "https://www.youtube.com/embed/vmd1qMN5Yo0", "thumbnail": "https://i.ytimg.com/vi/vmd1qMN5Yo0/hqdefault.jpg", "duration_seconds": 540, "source": "SNL", "category": "comedy"},
        {"id": "com_whose_line", "title": "Whose Line Is It Anyway - Best Moments", "video_url": "https://www.youtube.com/embed/CTxkxG3DF4k", "thumbnail": "https://i.ytimg.com/vi/CTxkxG3DF4k/hqdefault.jpg", "duration_seconds": 600, "source": "Whose Line", "category": "comedy"},
    ],
    
    # Short Films - Award Winners & Festival Favorites
    "short_films": [
        {"id": "sf_paperman", "title": "Paperman - Disney Short Film", "video_url": "https://www.youtube.com/embed/1QAI4B_2Mfc", "thumbnail": "https://i.ytimg.com/vi/1QAI4B_2Mfc/hqdefault.jpg", "duration_seconds": 420, "source": "Disney", "category": "short_films"},
        {"id": "sf_feast", "title": "Feast - Disney Short Film", "video_url": "https://www.youtube.com/embed/M3xSBVwVcDk", "thumbnail": "https://i.ytimg.com/vi/M3xSBVwVcDk/hqdefault.jpg", "duration_seconds": 360, "source": "Disney", "category": "short_films"},
        {"id": "sf_piper", "title": "Piper - Pixar Short Film", "video_url": "https://www.youtube.com/embed/Jm-upHSP9KU", "thumbnail": "https://i.ytimg.com/vi/Jm-upHSP9KU/hqdefault.jpg", "duration_seconds": 360, "source": "Pixar", "category": "short_films"},
        {"id": "sf_bao", "title": "Bao - Pixar Short Film", "video_url": "https://www.youtube.com/embed/iYaRZ4TNfus", "thumbnail": "https://i.ytimg.com/vi/iYaRZ4TNfus/hqdefault.jpg", "duration_seconds": 480, "source": "Pixar", "category": "short_films"},
        {"id": "sf_la_luna", "title": "La Luna - Pixar Short Film", "video_url": "https://www.youtube.com/embed/lsQxsQPI-x0", "thumbnail": "https://i.ytimg.com/vi/lsQxsQPI-x0/hqdefault.jpg", "duration_seconds": 420, "source": "Pixar", "category": "short_films"},
        {"id": "sf_alike", "title": "Alike - Award Winning Short Film", "video_url": "https://www.youtube.com/embed/kQjtK32mGJQ", "thumbnail": "https://i.ytimg.com/vi/kQjtK32mGJQ/hqdefault.jpg", "duration_seconds": 480, "source": "Daniel Martínez Lara", "category": "short_films"},
        {"id": "sf_the_present", "title": "The Present - Award Winning Short", "video_url": "https://www.youtube.com/embed/WjqiU5FgsYc", "thumbnail": "https://i.ytimg.com/vi/WjqiU5FgsYc/hqdefault.jpg", "duration_seconds": 240, "source": "Jacob Frey", "category": "short_films"},
        {"id": "sf_borrowed_time", "title": "Borrowed Time - Animated Short", "video_url": "https://www.youtube.com/embed/vJGdqNEPij0", "thumbnail": "https://i.ytimg.com/vi/vJGdqNEPij0/hqdefault.jpg", "duration_seconds": 420, "source": "Quorum Films", "category": "short_films"},
        {"id": "sf_worlds_apart", "title": "Worlds Apart - Sci-Fi Short Film", "video_url": "https://www.youtube.com/embed/a7xYzGfjViM", "thumbnail": "https://i.ytimg.com/vi/a7xYzGfjViM/hqdefault.jpg", "duration_seconds": 900, "source": "DUST", "category": "short_films"},
        {"id": "sf_the_landing", "title": "The Landing - Sci-Fi Short", "video_url": "https://www.youtube.com/embed/8fP6FXssFBY", "thumbnail": "https://i.ytimg.com/vi/8fP6FXssFBY/hqdefault.jpg", "duration_seconds": 720, "source": "DUST", "category": "short_films"},
        {"id": "sf_omelette", "title": "Omelette - DUST Sci-Fi", "video_url": "https://www.youtube.com/embed/BxrPDjNSzJw", "thumbnail": "https://i.ytimg.com/vi/BxrPDjNSzJw/hqdefault.jpg", "duration_seconds": 540, "source": "DUST", "category": "short_films"},
        {"id": "sf_fitcher", "title": "Fitcher's Bird - Dark Fantasy Short", "video_url": "https://www.youtube.com/embed/lHbFhQ3y9w4", "thumbnail": "https://i.ytimg.com/vi/lHbFhQ3y9w4/hqdefault.jpg", "duration_seconds": 600, "source": "Omeleto", "category": "short_films"},
    ],

    "viral_trending": [
        {"id": "viral_gangnam_dance", "title": "Gangnam Style Dance Compilation", "video_url": "https://www.youtube.com/embed/9bZkp7q19f0", "thumbnail": "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg", "duration_seconds": 253, "source": "PSY", "category": "viral_trending"},
        {"id": "viral_macarena", "title": "Los del Rio - Macarena", "video_url": "https://www.youtube.com/embed/zWaymcVmJ-A", "thumbnail": "https://i.ytimg.com/vi/zWaymcVmJ-A/hqdefault.jpg", "duration_seconds": 200, "source": "Los del Rio", "category": "viral_trending"},
        {"id": "viral_cat_vibing", "title": "Ievan Polkka - Cat Vibing", "video_url": "https://www.youtube.com/embed/NUYvbT6vTPs", "thumbnail": "https://i.ytimg.com/vi/NUYvbT6vTPs/hqdefault.jpg", "duration_seconds": 149, "source": "Bilal Göregen", "category": "viral_trending"},
        {"id": "viral_caramell", "title": "Caramelldansen", "video_url": "https://www.youtube.com/embed/A67ZkAd1wmI", "thumbnail": "https://i.ytimg.com/vi/A67ZkAd1wmI/hqdefault.jpg", "duration_seconds": 167, "source": "Caramell", "category": "viral_trending"},
        {"id": "viral_dontworry", "title": "Bobby McFerrin - Don't Worry Be Happy", "video_url": "https://www.youtube.com/embed/d-diB65scQU", "thumbnail": "https://i.ytimg.com/vi/d-diB65scQU/hqdefault.jpg", "duration_seconds": 283, "source": "Bobby McFerrin", "category": "viral_trending"},
        {"id": "viral_somebody", "title": "Gotye - Somebody That I Used To Know", "video_url": "https://www.youtube.com/embed/8UVNT4wvIGY", "thumbnail": "https://i.ytimg.com/vi/8UVNT4wvIGY/hqdefault.jpg", "duration_seconds": 244, "source": "Gotye", "category": "viral_trending"},
        {"id": "viral_take_on_me", "title": "a-ha - Take On Me", "video_url": "https://www.youtube.com/embed/djV11Xbc914", "thumbnail": "https://i.ytimg.com/vi/djV11Xbc914/hqdefault.jpg", "duration_seconds": 229, "source": "a-ha", "category": "viral_trending"},
        {"id": "viral_never", "title": "Rick Astley - Never Gonna Give You Up", "video_url": "https://www.youtube.com/embed/dQw4w9WgXcQ", "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", "duration_seconds": 213, "source": "Rick Astley", "category": "viral_trending"},
    ],

    "movies_trailers": [
        {"id": "mov_avatar2", "title": "Avatar 2 - Official Trailer", "video_url": "https://www.youtube.com/embed/d9MyW72ELq0", "thumbnail": "https://i.ytimg.com/vi/d9MyW72ELq0/hqdefault.jpg", "duration_seconds": 142, "source": "20th Century Studios", "category": "movies_trailers"},
        {"id": "mov_endgame", "title": "Avengers: Endgame - Official Trailer", "video_url": "https://www.youtube.com/embed/TcMBFSGVi1c", "thumbnail": "https://i.ytimg.com/vi/TcMBFSGVi1c/hqdefault.jpg", "duration_seconds": 182, "source": "Marvel", "category": "movies_trailers"},
        {"id": "mov_topgun", "title": "Top Gun: Maverick - Official Trailer", "video_url": "https://www.youtube.com/embed/qSqVVswa420", "thumbnail": "https://i.ytimg.com/vi/qSqVVswa420/hqdefault.jpg", "duration_seconds": 143, "source": "Paramount Pictures", "category": "movies_trailers"},
        {"id": "mov_batman", "title": "The Batman - Official Trailer", "video_url": "https://www.youtube.com/embed/mqqft2x_Aa4", "thumbnail": "https://i.ytimg.com/vi/mqqft2x_Aa4/hqdefault.jpg", "duration_seconds": 177, "source": "Warner Bros", "category": "movies_trailers"},
        {"id": "mov_dune", "title": "Dune - Official Trailer", "video_url": "https://www.youtube.com/embed/n9xhJrPXop4", "thumbnail": "https://i.ytimg.com/vi/n9xhJrPXop4/hqdefault.jpg", "duration_seconds": 202, "source": "Warner Bros", "category": "movies_trailers"},
        {"id": "mov_nwh", "title": "Spider-Man: No Way Home - Official Trailer", "video_url": "https://www.youtube.com/embed/JfVOs4VSpmA", "thumbnail": "https://i.ytimg.com/vi/JfVOs4VSpmA/hqdefault.jpg", "duration_seconds": 180, "source": "Sony Pictures", "category": "movies_trailers"},
        {"id": "mov_matrix", "title": "The Matrix Resurrections - Official Trailer", "video_url": "https://www.youtube.com/embed/9ix7TUGVYIo", "thumbnail": "https://i.ytimg.com/vi/9ix7TUGVYIo/hqdefault.jpg", "duration_seconds": 170, "source": "Warner Bros", "category": "movies_trailers"},
        {"id": "mov_black_panther2", "title": "Black Panther: Wakanda Forever - Official Trailer", "video_url": "https://www.youtube.com/embed/_Z3QKkl1WyM", "thumbnail": "https://i.ytimg.com/vi/_Z3QKkl1WyM/hqdefault.jpg", "duration_seconds": 137, "source": "Marvel", "category": "movies_trailers"},
    ],

    "documentaries": [
        {"id": "doc_our_planet", "title": "Our Planet - One Planet", "video_url": "https://www.youtube.com/embed/aETNYyrqNYE", "thumbnail": "https://i.ytimg.com/vi/aETNYyrqNYE/hqdefault.jpg", "duration_seconds": 300, "source": "Netflix", "category": "documentaries"},
        {"id": "doc_cosmos", "title": "Cosmos - A Spacetime Odyssey", "video_url": "https://www.youtube.com/embed/1X7fZoDs9KU", "thumbnail": "https://i.ytimg.com/vi/1X7fZoDs9KU/hqdefault.jpg", "duration_seconds": 282, "source": "National Geographic", "category": "documentaries"},
        {"id": "doc_blue_planet", "title": "Blue Planet II - The Deep", "video_url": "https://www.youtube.com/embed/r9PeYPHdpNo", "thumbnail": "https://i.ytimg.com/vi/r9PeYPHdpNo/hqdefault.jpg", "duration_seconds": 267, "source": "BBC", "category": "documentaries"},
        {"id": "doc_chef", "title": "Chef's Table - Preview", "video_url": "https://www.youtube.com/embed/qKqj85oo2wI", "thumbnail": "https://i.ytimg.com/vi/qKqj85oo2wI/hqdefault.jpg", "duration_seconds": 90, "source": "Netflix", "category": "documentaries"},
        {"id": "doc_ted1", "title": "TED - The Power of Vulnerability", "video_url": "https://www.youtube.com/embed/iCvmsMzlF7o", "thumbnail": "https://i.ytimg.com/vi/iCvmsMzlF7o/hqdefault.jpg", "duration_seconds": 1220, "source": "TED", "category": "documentaries"},
    ],

    "gaming": [
        {"id": "game_minecraft", "title": "Minecraft - Official Trailer", "video_url": "https://www.youtube.com/embed/MmB9b5njVbA", "thumbnail": "https://i.ytimg.com/vi/MmB9b5njVbA/hqdefault.jpg", "duration_seconds": 90, "source": "Minecraft", "category": "gaming"},
        {"id": "game_gta6", "title": "GTA VI - Trailer", "video_url": "https://www.youtube.com/embed/QdBZY2fkU-0", "thumbnail": "https://i.ytimg.com/vi/QdBZY2fkU-0/hqdefault.jpg", "duration_seconds": 91, "source": "Rockstar Games", "category": "gaming"},
        {"id": "game_hogwarts", "title": "Hogwarts Legacy - Official Trailer", "video_url": "https://www.youtube.com/embed/1O6Qstncpnc", "thumbnail": "https://i.ytimg.com/vi/1O6Qstncpnc/hqdefault.jpg", "duration_seconds": 229, "source": "Warner Bros Games", "category": "gaming"},
        {"id": "game_zelda", "title": "Zelda: Tears of the Kingdom - Trailer", "video_url": "https://www.youtube.com/embed/uHGShqcAHlQ", "thumbnail": "https://i.ytimg.com/vi/uHGShqcAHlQ/hqdefault.jpg", "duration_seconds": 188, "source": "Nintendo", "category": "gaming"},
        {"id": "game_eldenring", "title": "Elden Ring - Launch Trailer", "video_url": "https://www.youtube.com/embed/K_03kFqWfqs", "thumbnail": "https://i.ytimg.com/vi/K_03kFqWfqs/hqdefault.jpg", "duration_seconds": 180, "source": "Bandai Namco", "category": "gaming"},
        {"id": "game_cyberpunk", "title": "Cyberpunk 2077 - Official Trailer", "video_url": "https://www.youtube.com/embed/qIcTM8WXFjk", "thumbnail": "https://i.ytimg.com/vi/qIcTM8WXFjk/hqdefault.jpg", "duration_seconds": 217, "source": "CD Projekt RED", "category": "gaming"},
    ],

    "sports_highlights": [
        {"id": "sport_waka", "title": "Shakira - Waka Waka (World Cup 2010)", "video_url": "https://www.youtube.com/embed/pRpeEdMmmQ0", "thumbnail": "https://i.ytimg.com/vi/pRpeEdMmmQ0/hqdefault.jpg", "duration_seconds": 218, "source": "Shakira", "category": "sports_highlights"},
        {"id": "sport_wavin", "title": "Wavin' Flag - K'naan (World Cup 2010)", "video_url": "https://www.youtube.com/embed/WTJSt4wP2ME", "thumbnail": "https://i.ytimg.com/vi/WTJSt4wP2ME/hqdefault.jpg", "duration_seconds": 227, "source": "K'naan", "category": "sports_highlights"},
        {"id": "sport_history", "title": "Remember The Name - Fort Minor", "video_url": "https://www.youtube.com/embed/VDvr08sCPOc", "thumbnail": "https://i.ytimg.com/vi/VDvr08sCPOc/hqdefault.jpg", "duration_seconds": 228, "source": "Fort Minor", "category": "sports_highlights"},
        {"id": "sport_champion", "title": "Queen - We Are The Champions", "video_url": "https://www.youtube.com/embed/04854XqcfCY", "thumbnail": "https://i.ytimg.com/vi/04854XqcfCY/hqdefault.jpg", "duration_seconds": 181, "source": "Queen", "category": "sports_highlights"},
        {"id": "sport_eye", "title": "Survivor - Eye of the Tiger", "video_url": "https://www.youtube.com/embed/btPJPFnesV4", "thumbnail": "https://i.ytimg.com/vi/btPJPFnesV4/hqdefault.jpg", "duration_seconds": 246, "source": "Survivor", "category": "sports_highlights"},
        {"id": "sport_lose", "title": "Eminem - Lose Yourself", "video_url": "https://www.youtube.com/embed/_Yhyp-_hX2s", "thumbnail": "https://i.ytimg.com/vi/_Yhyp-_hX2s/hqdefault.jpg", "duration_seconds": 326, "source": "Eminem", "category": "sports_highlights"},
    ],
    
    # New category: Afrobeats - fresh embeddable videos
    "afrobeats": [
        # Nigerian Afrobeats
        {"id": "afro_essence", "title": "Wizkid - Essence ft. Tems", "video_url": "https://www.youtube.com/embed/EqH5FiWJLIY", "thumbnail": "https://i.ytimg.com/vi/EqH5FiWJLIY/hqdefault.jpg", "duration_seconds": 257, "source": "Wizkid", "category": "afrobeats"},
        {"id": "afro_joro", "title": "Wizkid - Joro", "video_url": "https://www.youtube.com/embed/lHj8CRct0Jg", "thumbnail": "https://i.ytimg.com/vi/lHj8CRct0Jg/hqdefault.jpg", "duration_seconds": 212, "source": "Wizkid", "category": "afrobeats"},
        {"id": "afro_ojuelegba", "title": "Wizkid - Ojuelegba", "video_url": "https://www.youtube.com/embed/lyW3uhNsELg", "thumbnail": "https://i.ytimg.com/vi/lyW3uhNsELg/hqdefault.jpg", "duration_seconds": 232, "source": "Wizkid", "category": "afrobeats"},
        {"id": "afro_come_closer", "title": "Wizkid - Come Closer ft. Drake", "video_url": "https://www.youtube.com/embed/5y7_hfzLHkc", "thumbnail": "https://i.ytimg.com/vi/5y7_hfzLHkc/hqdefault.jpg", "duration_seconds": 206, "source": "Wizkid", "category": "afrobeats"},
        {"id": "afro_love_nwantiti", "title": "CKay - Love Nwantiti", "video_url": "https://www.youtube.com/embed/9hzS2vVyQwE", "thumbnail": "https://i.ytimg.com/vi/9hzS2vVyQwE/hqdefault.jpg", "duration_seconds": 142, "source": "CKay", "category": "afrobeats"},
        {"id": "afro_fall", "title": "Davido - Fall", "video_url": "https://www.youtube.com/embed/LEz-7-YmFQ0", "thumbnail": "https://i.ytimg.com/vi/LEz-7-YmFQ0/hqdefault.jpg", "duration_seconds": 261, "source": "Davido", "category": "afrobeats"},
        {"id": "afro_unavailable", "title": "Davido - Unavailable ft. Musa Keys", "video_url": "https://www.youtube.com/embed/rsgNl-Y5hzo", "thumbnail": "https://i.ytimg.com/vi/rsgNl-Y5hzo/hqdefault.jpg", "duration_seconds": 168, "source": "Davido", "category": "afrobeats"},
        {"id": "afro_aye", "title": "Davido - Aye", "video_url": "https://www.youtube.com/embed/YINJiKpHqnA", "thumbnail": "https://i.ytimg.com/vi/YINJiKpHqnA/hqdefault.jpg", "duration_seconds": 240, "source": "Davido", "category": "afrobeats"},
        {"id": "afro_if", "title": "Davido - IF", "video_url": "https://www.youtube.com/embed/aBbKdN8NhSo", "thumbnail": "https://i.ytimg.com/vi/aBbKdN8NhSo/hqdefault.jpg", "duration_seconds": 207, "source": "Davido", "category": "afrobeats"},
        {"id": "afro_bloody", "title": "Burna Boy - Ye", "video_url": "https://www.youtube.com/embed/MOmZimH00oo", "thumbnail": "https://i.ytimg.com/vi/MOmZimH00oo/hqdefault.jpg", "duration_seconds": 233, "source": "Burna Boy", "category": "afrobeats"},
        {"id": "afro_last_last", "title": "Burna Boy - Last Last", "video_url": "https://www.youtube.com/embed/wHnErJGCCU4", "thumbnail": "https://i.ytimg.com/vi/wHnErJGCCU4/hqdefault.jpg", "duration_seconds": 229, "source": "Burna Boy", "category": "afrobeats"},
        {"id": "afro_anybody", "title": "Burna Boy - Anybody", "video_url": "https://www.youtube.com/embed/b4jN6eoJUFY", "thumbnail": "https://i.ytimg.com/vi/b4jN6eoJUFY/hqdefault.jpg", "duration_seconds": 171, "source": "Burna Boy", "category": "afrobeats"},
        {"id": "afro_killin_dem", "title": "Burna Boy - Killin Dem ft. Zlatan", "video_url": "https://www.youtube.com/embed/4McxRS9RHBY", "thumbnail": "https://i.ytimg.com/vi/4McxRS9RHBY/hqdefault.jpg", "duration_seconds": 178, "source": "Burna Boy", "category": "afrobeats"},
        {"id": "afro_on_the_low", "title": "Burna Boy - On The Low", "video_url": "https://www.youtube.com/embed/LPfFVTqMpkA", "thumbnail": "https://i.ytimg.com/vi/LPfFVTqMpkA/hqdefault.jpg", "duration_seconds": 214, "source": "Burna Boy", "category": "afrobeats"},
        {"id": "afro_monalisa", "title": "Lojay & Sarz - Monalisa", "video_url": "https://www.youtube.com/embed/KCvwLn25V8c", "thumbnail": "https://i.ytimg.com/vi/KCvwLn25V8c/hqdefault.jpg", "duration_seconds": 178, "source": "Lojay", "category": "afrobeats"},
        {"id": "afro_calm_down", "title": "Rema - Calm Down", "video_url": "https://www.youtube.com/embed/CQLsdm1ZYAw", "thumbnail": "https://i.ytimg.com/vi/CQLsdm1ZYAw/hqdefault.jpg", "duration_seconds": 239, "source": "Rema", "category": "afrobeats"},
        {"id": "afro_soundgasm", "title": "Rema - Soundgasm", "video_url": "https://www.youtube.com/embed/KYbLOG-9Jz4", "thumbnail": "https://i.ytimg.com/vi/KYbLOG-9Jz4/hqdefault.jpg", "duration_seconds": 176, "source": "Rema", "category": "afrobeats"},
        {"id": "afro_dumebi", "title": "Rema - Dumebi", "video_url": "https://www.youtube.com/embed/9O61dMxVb2k", "thumbnail": "https://i.ytimg.com/vi/9O61dMxVb2k/hqdefault.jpg", "duration_seconds": 170, "source": "Rema", "category": "afrobeats"},
        {"id": "afro_girl_like_you", "title": "Tems - Free Mind", "video_url": "https://www.youtube.com/embed/eQEasgMwMvg", "thumbnail": "https://i.ytimg.com/vi/eQEasgMwMvg/hqdefault.jpg", "duration_seconds": 188, "source": "Tems", "category": "afrobeats"},
        {"id": "afro_ko_por_ke", "title": "Mr Eazi - Leg Over", "video_url": "https://www.youtube.com/embed/PLWdbCAwjw8", "thumbnail": "https://i.ytimg.com/vi/PLWdbCAwjw8/hqdefault.jpg", "duration_seconds": 185, "source": "Mr Eazi", "category": "afrobeats"},
        {"id": "afro_pour_me_water", "title": "Mr Eazi - Pour Me Water", "video_url": "https://www.youtube.com/embed/ZRvDz5NQ2I0", "thumbnail": "https://i.ytimg.com/vi/ZRvDz5NQ2I0/hqdefault.jpg", "duration_seconds": 215, "source": "Mr Eazi", "category": "afrobeats"},
        {"id": "afro_soco", "title": "Starboy - Soco ft. Wizkid, Terri", "video_url": "https://www.youtube.com/embed/gI3aL9Yyupo", "thumbnail": "https://i.ytimg.com/vi/gI3aL9Yyupo/hqdefault.jpg", "duration_seconds": 220, "source": "Starboy", "category": "afrobeats"},
        {"id": "afro_rushing", "title": "Fireboy DML - Peru", "video_url": "https://www.youtube.com/embed/7PqHE2-Dk1U", "thumbnail": "https://i.ytimg.com/vi/7PqHE2-Dk1U/hqdefault.jpg", "duration_seconds": 200, "source": "Fireboy DML", "category": "afrobeats"},
        {"id": "afro_jealous", "title": "Fireboy DML - Jealous", "video_url": "https://www.youtube.com/embed/JpnIfudM-jY", "thumbnail": "https://i.ytimg.com/vi/JpnIfudM-jY/hqdefault.jpg", "duration_seconds": 197, "source": "Fireboy DML", "category": "afrobeats"},
        {"id": "afro_zazu", "title": "Portable ft. Olamide - Zazu Zeh", "video_url": "https://www.youtube.com/embed/qJ-NR-dVKHI", "thumbnail": "https://i.ytimg.com/vi/qJ-NR-dVKHI/hqdefault.jpg", "duration_seconds": 166, "source": "Portable", "category": "afrobeats"},
        {"id": "afro_wo", "title": "Olamide - Wo!!", "video_url": "https://www.youtube.com/embed/wleEXA2-eNw", "thumbnail": "https://i.ytimg.com/vi/wleEXA2-eNw/hqdefault.jpg", "duration_seconds": 180, "source": "Olamide", "category": "afrobeats"},
        {"id": "afro_dj_spinall", "title": "DJ Spinall - Baba ft. Kiss Daniel", "video_url": "https://www.youtube.com/embed/Zg-k8tVuclc", "thumbnail": "https://i.ytimg.com/vi/Zg-k8tVuclc/hqdefault.jpg", "duration_seconds": 218, "source": "DJ Spinall", "category": "afrobeats"},
        {"id": "afro_assurance", "title": "Davido - Assurance", "video_url": "https://www.youtube.com/embed/SrCXNPThJeo", "thumbnail": "https://i.ytimg.com/vi/SrCXNPThJeo/hqdefault.jpg", "duration_seconds": 218, "source": "Davido", "category": "afrobeats"},
        {"id": "afro_dami_duro", "title": "Davido - Dami Duro", "video_url": "https://www.youtube.com/embed/fAUMyJGm7Jk", "thumbnail": "https://i.ytimg.com/vi/fAUMyJGm7Jk/hqdefault.jpg", "duration_seconds": 228, "source": "Davido", "category": "afrobeats"},
        # Ghanaian Afrobeats
        {"id": "afro_my_level", "title": "Shatta Wale - My Level", "video_url": "https://www.youtube.com/embed/2bE3oQu7A94", "thumbnail": "https://i.ytimg.com/vi/2bE3oQu7A94/hqdefault.jpg", "duration_seconds": 186, "source": "Shatta Wale", "category": "afrobeats"},
        {"id": "afro_kakai", "title": "Shatta Wale - Kakai", "video_url": "https://www.youtube.com/embed/1T4mQCzNH0w", "thumbnail": "https://i.ytimg.com/vi/1T4mQCzNH0w/hqdefault.jpg", "duration_seconds": 214, "source": "Shatta Wale", "category": "afrobeats"},
        {"id": "afro_sarkodie_adonai", "title": "Sarkodie - Adonai ft. Castro", "video_url": "https://www.youtube.com/embed/3vCH7QAzYjE", "thumbnail": "https://i.ytimg.com/vi/3vCH7QAzYjE/hqdefault.jpg", "duration_seconds": 240, "source": "Sarkodie", "category": "afrobeats"},
        {"id": "afro_stonebwoy", "title": "Stonebwoy - Activate", "video_url": "https://www.youtube.com/embed/F5TIMu6Tpv8", "thumbnail": "https://i.ytimg.com/vi/F5TIMu6Tpv8/hqdefault.jpg", "duration_seconds": 192, "source": "Stonebwoy", "category": "afrobeats"},
        # South African Amapiano
        {"id": "afro_jerusalema", "title": "Master KG - Jerusalema ft. Nomcebo", "video_url": "https://www.youtube.com/embed/fLw7W3hLBN4", "thumbnail": "https://i.ytimg.com/vi/fLw7W3hLBN4/hqdefault.jpg", "duration_seconds": 359, "source": "Master KG", "category": "afrobeats"},
        {"id": "afro_water", "title": "Tyla - Water", "video_url": "https://www.youtube.com/embed/NVaOfqhWy7o", "thumbnail": "https://i.ytimg.com/vi/NVaOfqhWy7o/hqdefault.jpg", "duration_seconds": 195, "source": "Tyla", "category": "afrobeats"},
        {"id": "afro_mnike", "title": "Tyler ICU - Mnike ft. DJ Maphorisa", "video_url": "https://www.youtube.com/embed/qW9P5EUW3kQ", "thumbnail": "https://i.ytimg.com/vi/qW9P5EUW3kQ/hqdefault.jpg", "duration_seconds": 248, "source": "Tyler ICU", "category": "afrobeats"},
        {"id": "afro_inkabi", "title": "Big Zulu - Inkabi Zezwe ft. Sjava", "video_url": "https://www.youtube.com/embed/C0A_mOmBJzU", "thumbnail": "https://i.ytimg.com/vi/C0A_mOmBJzU/hqdefault.jpg", "duration_seconds": 275, "source": "Big Zulu", "category": "afrobeats"},
        # Congolese / Lingala
        {"id": "afro_fally_eloko", "title": "Fally Ipupa - Eloko Oyo", "video_url": "https://www.youtube.com/embed/5qhsOF8f_DQ", "thumbnail": "https://i.ytimg.com/vi/5qhsOF8f_DQ/hqdefault.jpg", "duration_seconds": 350, "source": "Fally Ipupa", "category": "afrobeats"},
        {"id": "afro_fally_bad", "title": "Fally Ipupa - Bad Boy", "video_url": "https://www.youtube.com/embed/LYpAMykJ9Vg", "thumbnail": "https://i.ytimg.com/vi/LYpAMykJ9Vg/hqdefault.jpg", "duration_seconds": 292, "source": "Fally Ipupa", "category": "afrobeats"},
        {"id": "afro_innoss_b", "title": "Innoss'B - Yope", "video_url": "https://www.youtube.com/embed/XF9j0VdcSh0", "thumbnail": "https://i.ytimg.com/vi/XF9j0VdcSh0/hqdefault.jpg", "duration_seconds": 216, "source": "Innoss'B", "category": "afrobeats"},
        {"id": "afro_koffi", "title": "Koffi Olomide - Loi", "video_url": "https://www.youtube.com/embed/GjC6RQVJj0k", "thumbnail": "https://i.ytimg.com/vi/GjC6RQVJj0k/hqdefault.jpg", "duration_seconds": 330, "source": "Koffi Olomide", "category": "afrobeats"},
        # Ivorian / Coupé-Décalé
        {"id": "afro_dj_arafat", "title": "DJ Arafat - Kpadoompo", "video_url": "https://www.youtube.com/embed/R4k7p-NvqPs", "thumbnail": "https://i.ytimg.com/vi/R4k7p-NvqPs/hqdefault.jpg", "duration_seconds": 244, "source": "DJ Arafat", "category": "afrobeats"},
        {"id": "afro_serge_beynaud", "title": "Serge Beynaud - Karidjatou", "video_url": "https://www.youtube.com/embed/TZCC7BxyHkE", "thumbnail": "https://i.ytimg.com/vi/TZCC7BxyHkE/hqdefault.jpg", "duration_seconds": 252, "source": "Serge Beynaud", "category": "afrobeats"},
        # Tanzanian Bongo Flava
        {"id": "afro_diamond", "title": "Diamond Platnumz - Jeje", "video_url": "https://www.youtube.com/embed/V_XQRO6eJpg", "thumbnail": "https://i.ytimg.com/vi/V_XQRO6eJpg/hqdefault.jpg", "duration_seconds": 224, "source": "Diamond Platnumz", "category": "afrobeats"},
        {"id": "afro_diamond_waah", "title": "Diamond Platnumz - Waah ft. Koffi Olomide", "video_url": "https://www.youtube.com/embed/sAWl5BCHKwE", "thumbnail": "https://i.ytimg.com/vi/sAWl5BCHKwE/hqdefault.jpg", "duration_seconds": 276, "source": "Diamond Platnumz", "category": "afrobeats"},
    ],
    
    "french_rap": [
        # French Rap / Hip-Hop
        {"id": "fr_ninho_lettre", "title": "Ninho - Lettre à Une Femme", "video_url": "https://www.youtube.com/embed/qJT1hNX-VeU", "thumbnail": "https://i.ytimg.com/vi/qJT1hNX-VeU/hqdefault.jpg", "duration_seconds": 228, "source": "Ninho", "category": "french_rap"},
        {"id": "fr_jul_tchikita", "title": "Jul - Tchikita", "video_url": "https://www.youtube.com/embed/zKIUhD3mfEM", "thumbnail": "https://i.ytimg.com/vi/zKIUhD3mfEM/hqdefault.jpg", "duration_seconds": 199, "source": "Jul", "category": "french_rap"},
        {"id": "fr_jul_dans_ma_paranoïa", "title": "Jul - Dans Ma Paranoïa", "video_url": "https://www.youtube.com/embed/x2xBFIcZflg", "thumbnail": "https://i.ytimg.com/vi/x2xBFIcZflg/hqdefault.jpg", "duration_seconds": 213, "source": "Jul", "category": "french_rap"},
        {"id": "fr_pnl_mira", "title": "PNL - Au DD", "video_url": "https://www.youtube.com/embed/BtyHYIpykN0", "thumbnail": "https://i.ytimg.com/vi/BtyHYIpykN0/hqdefault.jpg", "duration_seconds": 261, "source": "PNL", "category": "french_rap"},
        {"id": "fr_booba_dkr", "title": "Booba - DKR", "video_url": "https://www.youtube.com/embed/18nLQo5Wv_o", "thumbnail": "https://i.ytimg.com/vi/18nLQo5Wv_o/hqdefault.jpg", "duration_seconds": 212, "source": "Booba", "category": "french_rap"},
        {"id": "fr_kaaris_tchoin", "title": "Kaaris - Tchoin", "video_url": "https://www.youtube.com/embed/RwdtFNtXwYw", "thumbnail": "https://i.ytimg.com/vi/RwdtFNtXwYw/hqdefault.jpg", "duration_seconds": 204, "source": "Kaaris", "category": "french_rap"},
        {"id": "fr_soprano_fresh", "title": "Soprano - Fresh Prince", "video_url": "https://www.youtube.com/embed/6uJoN_I9BVU", "thumbnail": "https://i.ytimg.com/vi/6uJoN_I9BVU/hqdefault.jpg", "duration_seconds": 228, "source": "Soprano", "category": "french_rap"},
        {"id": "fr_soprano_a_nos_heros", "title": "Soprano - À Nos Héros du Quotidien", "video_url": "https://www.youtube.com/embed/FZNnKnGBr_k", "thumbnail": "https://i.ytimg.com/vi/FZNnKnGBr_k/hqdefault.jpg", "duration_seconds": 237, "source": "Soprano", "category": "french_rap"},
        {"id": "fr_gims_bella", "title": "Maître Gims - Bella", "video_url": "https://www.youtube.com/embed/oXk86s4m0sY", "thumbnail": "https://i.ytimg.com/vi/oXk86s4m0sY/hqdefault.jpg", "duration_seconds": 216, "source": "Maître Gims", "category": "french_rap"},
        {"id": "fr_gims_sapés", "title": "Maître Gims - Sapés Comme Jamais", "video_url": "https://www.youtube.com/embed/EGqRQVoUIpo", "thumbnail": "https://i.ytimg.com/vi/EGqRQVoUIpo/hqdefault.jpg", "duration_seconds": 242, "source": "Maître Gims", "category": "french_rap"},
        {"id": "fr_gims_est_ce_que", "title": "Maître Gims - Est-ce que tu m'aimes?", "video_url": "https://www.youtube.com/embed/6TpyRE_juyA", "thumbnail": "https://i.ytimg.com/vi/6TpyRE_juyA/hqdefault.jpg", "duration_seconds": 253, "source": "Maître Gims", "category": "french_rap"},
        {"id": "fr_niska_reseaux", "title": "Niska - Réseaux", "video_url": "https://www.youtube.com/embed/VCZ8P-Hpdrs", "thumbnail": "https://i.ytimg.com/vi/VCZ8P-Hpdrs/hqdefault.jpg", "duration_seconds": 188, "source": "Niska", "category": "french_rap"},
        {"id": "fr_aya_djadja", "title": "Aya Nakamura - Djadja", "video_url": "https://www.youtube.com/embed/iPGgnzc34tY", "thumbnail": "https://i.ytimg.com/vi/iPGgnzc34tY/hqdefault.jpg", "duration_seconds": 169, "source": "Aya Nakamura", "category": "french_rap"},
        {"id": "fr_aya_pookie", "title": "Aya Nakamura - Pookie", "video_url": "https://www.youtube.com/embed/xtl2mCz-vVs", "thumbnail": "https://i.ytimg.com/vi/xtl2mCz-vVs/hqdefault.jpg", "duration_seconds": 178, "source": "Aya Nakamura", "category": "french_rap"},
        {"id": "fr_aya_jolie_nana", "title": "Aya Nakamura - Jolie Nana", "video_url": "https://www.youtube.com/embed/U6MlM_2CxFI", "thumbnail": "https://i.ytimg.com/vi/U6MlM_2CxFI/hqdefault.jpg", "duration_seconds": 158, "source": "Aya Nakamura", "category": "french_rap"},
        {"id": "fr_nekfeu", "title": "Nekfeu - On Verra", "video_url": "https://www.youtube.com/embed/6B6mTj1VuUI", "thumbnail": "https://i.ytimg.com/vi/6B6mTj1VuUI/hqdefault.jpg", "duration_seconds": 242, "source": "Nekfeu", "category": "french_rap"},
        {"id": "fr_damso_macarena", "title": "Damso - Macarena", "video_url": "https://www.youtube.com/embed/cjBP-z1C2bg", "thumbnail": "https://i.ytimg.com/vi/cjBP-z1C2bg/hqdefault.jpg", "duration_seconds": 182, "source": "Damso", "category": "french_rap"},
        {"id": "fr_dadju_reine", "title": "Dadju - Reine", "video_url": "https://www.youtube.com/embed/PHUyoYXCUws", "thumbnail": "https://i.ytimg.com/vi/PHUyoYXCUws/hqdefault.jpg", "duration_seconds": 214, "source": "Dadju", "category": "french_rap"},
        {"id": "fr_dadju_bob", "title": "Dadju - Bob Marley", "video_url": "https://www.youtube.com/embed/HkCPrm8nFto", "thumbnail": "https://i.ytimg.com/vi/HkCPrm8nFto/hqdefault.jpg", "duration_seconds": 232, "source": "Dadju", "category": "french_rap"},
        {"id": "fr_vegedream_ramenez", "title": "Vegedream - Ramenez La Coupe À La Maison", "video_url": "https://www.youtube.com/embed/rFwNi4H89Ho", "thumbnail": "https://i.ytimg.com/vi/rFwNi4H89Ho/hqdefault.jpg", "duration_seconds": 197, "source": "Vegedream", "category": "french_rap"},
        {"id": "fr_stromae_papaoutai", "title": "Stromae - Papaoutai", "video_url": "https://www.youtube.com/embed/oiKj0Z_Xnjc", "thumbnail": "https://i.ytimg.com/vi/oiKj0Z_Xnjc/hqdefault.jpg", "duration_seconds": 235, "source": "Stromae", "category": "french_rap"},
        {"id": "fr_stromae_alors", "title": "Stromae - Alors On Danse", "video_url": "https://www.youtube.com/embed/VHoT4N43jK8", "thumbnail": "https://i.ytimg.com/vi/VHoT4N43jK8/hqdefault.jpg", "duration_seconds": 206, "source": "Stromae", "category": "french_rap"},
        {"id": "fr_stromae_sante", "title": "Stromae - Santé", "video_url": "https://www.youtube.com/embed/eXqPYte8tvc", "thumbnail": "https://i.ytimg.com/vi/eXqPYte8tvc/hqdefault.jpg", "duration_seconds": 187, "source": "Stromae", "category": "french_rap"},
        {"id": "fr_stromae_formidable", "title": "Stromae - Formidable", "video_url": "https://www.youtube.com/embed/S_xH7noaqTA", "thumbnail": "https://i.ytimg.com/vi/S_xH7noaqTA/hqdefault.jpg", "duration_seconds": 238, "source": "Stromae", "category": "french_rap"},
        {"id": "fr_angele_balance", "title": "Angèle - Balance Ton Quoi", "video_url": "https://www.youtube.com/embed/Hi7Rx3En7-k", "thumbnail": "https://i.ytimg.com/vi/Hi7Rx3En7-k/hqdefault.jpg", "duration_seconds": 204, "source": "Angèle", "category": "french_rap"},
        {"id": "fr_wejdene_anessa", "title": "Wejdene - Anessa", "video_url": "https://www.youtube.com/embed/w0j6bH1BpvA", "thumbnail": "https://i.ytimg.com/vi/w0j6bH1BpvA/hqdefault.jpg", "duration_seconds": 154, "source": "Wejdene", "category": "french_rap"},
        {"id": "fr_gradur_oblah", "title": "Gradur - Oblah", "video_url": "https://www.youtube.com/embed/c--wS3NLjdw", "thumbnail": "https://i.ytimg.com/vi/c--wS3NLjdw/hqdefault.jpg", "duration_seconds": 225, "source": "Gradur", "category": "french_rap"},
        {"id": "fr_mhd_afro_trap", "title": "MHD - Afro Trap Part.7", "video_url": "https://www.youtube.com/embed/ArS4s0-EnPQ", "thumbnail": "https://i.ytimg.com/vi/ArS4s0-EnPQ/hqdefault.jpg", "duration_seconds": 193, "source": "MHD", "category": "french_rap"},
        {"id": "fr_mhd_a_kele_nta", "title": "MHD - A Kele Nta", "video_url": "https://www.youtube.com/embed/LM2l5KXWZGE", "thumbnail": "https://i.ytimg.com/vi/LM2l5KXWZGE/hqdefault.jpg", "duration_seconds": 204, "source": "MHD", "category": "french_rap"},
    ],
    
    "zouk_caribbean": [
        # Zouk / Caribbean Music
        {"id": "zouk_kassav_mwen_allez", "title": "Kassav' - Mwen Alé", "video_url": "https://www.youtube.com/embed/y5z9xMJ5Jxg", "thumbnail": "https://i.ytimg.com/vi/y5z9xMJ5Jxg/hqdefault.jpg", "duration_seconds": 282, "source": "Kassav", "category": "zouk_caribbean"},
        {"id": "zouk_kassav_zouk", "title": "Kassav' - Zouk La Sé Sèl Médikaman Nou Ni", "video_url": "https://www.youtube.com/embed/BWPV8g5zGRY", "thumbnail": "https://i.ytimg.com/vi/BWPV8g5zGRY/hqdefault.jpg", "duration_seconds": 302, "source": "Kassav", "category": "zouk_caribbean"},
        {"id": "zouk_magic_system_1er", "title": "Magic System - 1er Gaou", "video_url": "https://www.youtube.com/embed/c-sGngDwFrE", "thumbnail": "https://i.ytimg.com/vi/c-sGngDwFrE/hqdefault.jpg", "duration_seconds": 263, "source": "Magic System", "category": "zouk_caribbean"},
        {"id": "zouk_magic_system_bouger", "title": "Magic System - Bouger Bouger", "video_url": "https://www.youtube.com/embed/60wz4Xax7J4", "thumbnail": "https://i.ytimg.com/vi/60wz4Xax7J4/hqdefault.jpg", "duration_seconds": 219, "source": "Magic System", "category": "zouk_caribbean"},
        {"id": "zouk_admiral_t", "title": "Admiral T - Fos A Péyi La", "video_url": "https://www.youtube.com/embed/qlqnKnMJHVU", "thumbnail": "https://i.ytimg.com/vi/qlqnKnMJHVU/hqdefault.jpg", "duration_seconds": 250, "source": "Admiral T", "category": "zouk_caribbean"},
        {"id": "zouk_kalash_mwaka", "title": "Kalash - Mwaka Moon ft. Damso", "video_url": "https://www.youtube.com/embed/dL1ZZo8fXRU", "thumbnail": "https://i.ytimg.com/vi/dL1ZZo8fXRU/hqdefault.jpg", "duration_seconds": 220, "source": "Kalash", "category": "zouk_caribbean"},
        {"id": "zouk_molare_sandale", "title": "Molaré - Sandalé", "video_url": "https://www.youtube.com/embed/TaK9qqy-6ho", "thumbnail": "https://i.ytimg.com/vi/TaK9qqy-6ho/hqdefault.jpg", "duration_seconds": 228, "source": "Molaré", "category": "zouk_caribbean"},
        {"id": "zouk_carimi_ayiti", "title": "Carimi - Ayiti", "video_url": "https://www.youtube.com/embed/lEXdBXAUINc", "thumbnail": "https://i.ytimg.com/vi/lEXdBXAUINc/hqdefault.jpg", "duration_seconds": 274, "source": "Carimi", "category": "zouk_caribbean"},
        {"id": "zouk_t_vice", "title": "T-Vice - Kite M Viv", "video_url": "https://www.youtube.com/embed/rJ0AKW5z1BI", "thumbnail": "https://i.ytimg.com/vi/rJ0AKW5z1BI/hqdefault.jpg", "duration_seconds": 318, "source": "T-Vice", "category": "zouk_caribbean"},
        {"id": "zouk_tabou", "title": "Tabou Combo - Mabouya", "video_url": "https://www.youtube.com/embed/y3pZXUe8nXk", "thumbnail": "https://i.ytimg.com/vi/y3pZXUe8nXk/hqdefault.jpg", "duration_seconds": 286, "source": "Tabou Combo", "category": "zouk_caribbean"},
        {"id": "zouk_kompa_sweet_micky", "title": "Sweet Micky - Brase Lari A", "video_url": "https://www.youtube.com/embed/GIXHFCZ-4Lc", "thumbnail": "https://i.ytimg.com/vi/GIXHFCZ-4Lc/hqdefault.jpg", "duration_seconds": 292, "source": "Sweet Micky", "category": "zouk_caribbean"},
        {"id": "zouk_harmonik", "title": "Harmonik - Incroyable", "video_url": "https://www.youtube.com/embed/k4gBJvBT2yo", "thumbnail": "https://i.ytimg.com/vi/k4gBJvBT2yo/hqdefault.jpg", "duration_seconds": 315, "source": "Harmonik", "category": "zouk_caribbean"},
        {"id": "zouk_klass", "title": "Klass - Bliye M", "video_url": "https://www.youtube.com/embed/cJHhFT1g3h4", "thumbnail": "https://i.ytimg.com/vi/cJHhFT1g3h4/hqdefault.jpg", "duration_seconds": 306, "source": "Klass", "category": "zouk_caribbean"},
        {"id": "zouk_kreyol_la", "title": "Kreyol La - Lanmou Fasil", "video_url": "https://www.youtube.com/embed/a2bG4xQRFRQ", "thumbnail": "https://i.ytimg.com/vi/a2bG4xQRFRQ/hqdefault.jpg", "duration_seconds": 298, "source": "Kreyol La", "category": "zouk_caribbean"},
        {"id": "zouk_dezay", "title": "Dezay - Doudou", "video_url": "https://www.youtube.com/embed/JC1nqWfXQqY", "thumbnail": "https://i.ytimg.com/vi/JC1nqWfXQqY/hqdefault.jpg", "duration_seconds": 254, "source": "Dezay", "category": "zouk_caribbean"},
    ],
    
    # New category: Classic Hits - verified embeddable  
    "classic_hits": [
        {"id": "classic_queen", "title": "Queen - Bohemian Rhapsody", "video_url": "https://www.youtube.com/embed/fJ9rUzIMcZQ", "thumbnail": "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg", "duration_seconds": 354, "source": "Queen", "category": "classic_hits"},
        {"id": "classic_thriller", "title": "Michael Jackson - Thriller", "video_url": "https://www.youtube.com/embed/sOnqjkJTMaA", "thumbnail": "https://i.ytimg.com/vi/sOnqjkJTMaA/hqdefault.jpg", "duration_seconds": 837, "source": "Michael Jackson", "category": "classic_hits"},
        {"id": "classic_billie", "title": "Michael Jackson - Billie Jean", "video_url": "https://www.youtube.com/embed/Zi_XLOBDo_Y", "thumbnail": "https://i.ytimg.com/vi/Zi_XLOBDo_Y/hqdefault.jpg", "duration_seconds": 294, "source": "Michael Jackson", "category": "classic_hits"},
        {"id": "classic_beat_it", "title": "Michael Jackson - Beat It", "video_url": "https://www.youtube.com/embed/oRdxUFDoQe0", "thumbnail": "https://i.ytimg.com/vi/oRdxUFDoQe0/hqdefault.jpg", "duration_seconds": 258, "source": "Michael Jackson", "category": "classic_hits"},
        {"id": "classic_uptown", "title": "Bruno Mars - Uptown Funk ft. Mark Ronson", "video_url": "https://www.youtube.com/embed/OPf0YbXqDm0", "thumbnail": "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg", "duration_seconds": 270, "source": "Bruno Mars", "category": "classic_hits"},
        {"id": "classic_sugar", "title": "Maroon 5 - Sugar", "video_url": "https://www.youtube.com/embed/09R8_2nJtjg", "thumbnail": "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg", "duration_seconds": 305, "source": "Maroon 5", "category": "classic_hits"},
        {"id": "classic_girls", "title": "Maroon 5 - Girls Like You ft. Cardi B", "video_url": "https://www.youtube.com/embed/aJOTlE1K90k", "thumbnail": "https://i.ytimg.com/vi/aJOTlE1K90k/hqdefault.jpg", "duration_seconds": 236, "source": "Maroon 5", "category": "classic_hits"},
        {"id": "classic_locked", "title": "Bruno Mars - Locked Out of Heaven", "video_url": "https://www.youtube.com/embed/e-fA-gBCkj0", "thumbnail": "https://i.ytimg.com/vi/e-fA-gBCkj0/hqdefault.jpg", "duration_seconds": 234, "source": "Bruno Mars", "category": "classic_hits"},
    ],

}

# ============ HELPER FUNCTIONS ============

def get_all_content() -> List[Dict]:
    """Get all content from all categories"""
    all_content = []
    for category, items in CONTENT_LIBRARY.items():
        for item in items:
            all_content.append({**item, "category": category})
    return all_content

def get_total_content_count() -> int:
    """Get total number of content items"""
    return sum(len(items) for items in CONTENT_LIBRARY.values())

def get_content_stats() -> Dict:
    """Get content library statistics"""
    total_items = get_total_content_count()
    total_duration = sum(
        item.get("duration_seconds", 0)
        for items in CONTENT_LIBRARY.values()
        for item in items
    )
    return {
        "total_items": total_items,
        "total_duration_seconds": total_duration,
        "total_duration_hours": round(total_duration / 3600, 2),
        "categories": len(CONTENT_LIBRARY),
        "items_per_category": {cat: len(items) for cat, items in CONTENT_LIBRARY.items()}
    }

def load_disabled_videos() -> set:
    """Load disabled video IDs from file"""
    try:
        disabled_file = "/app/backend/data/disabled_videos.json"
        if os.path.exists(disabled_file):
            import json
            with open(disabled_file, "r") as f:
                data = json.load(f)
                # Support both key names for backwards compatibility
                ids = data.get("disabled_video_ids", data.get("disabled_ids", []))
                return set(ids)
        
        # Also check old location
        old_file = "/app/backend/disabled_videos.json"
        if os.path.exists(old_file):
            import json
            with open(old_file, "r") as f:
                data = json.load(f)
                ids = data.get("disabled_video_ids", data.get("disabled_ids", []))
                return set(ids)
    except Exception as e:
        print(f"Error loading disabled videos: {e}")
    return set()


def extract_youtube_id(url: str) -> str:
    """Extract YouTube video ID from various URL formats"""
    if not url:
        return ""
    # Handle embed URLs: youtube.com/embed/VIDEO_ID
    import re
    match = re.search(r'youtube\.com/embed/([^?&/]+)', url)
    if match:
        return match.group(1)
    # Handle watch URLs: youtube.com/watch?v=VIDEO_ID
    match = re.search(r'[?&]v=([^&]+)', url)
    if match:
        return match.group(1)
    # Handle short URLs: youtu.be/VIDEO_ID
    match = re.search(r'youtu\.be/([^?]+)', url)
    if match:
        return match.group(1)
    return ""


def is_video_disabled(content: Dict, disabled_video_ids: set) -> bool:
    """Check if a content item is disabled by its YouTube video ID"""
    # Extract YouTube video ID from video_url
    youtube_id = extract_youtube_id(content.get("video_url", ""))
    return youtube_id in disabled_video_ids


# ============ LOW QUALITY VIDEO FILTER (< 720p) ============

LOW_QUALITY_VIDEOS_FILE = "/app/backend/data/low_quality_videos.json"

def load_low_quality_videos() -> set:
    """Load videos flagged as low quality (< 720p)"""
    try:
        if os.path.exists(LOW_QUALITY_VIDEOS_FILE):
            with open(LOW_QUALITY_VIDEOS_FILE, "r") as f:
                data = json.load(f)
                return set(data.get("low_quality_ids", []))
    except Exception as e:
        print(f"Error loading low quality videos: {e}")
    return set()

def save_low_quality_video(video_id: str):
    """Mark a video as low quality (< 720p)"""
    try:
        os.makedirs(os.path.dirname(LOW_QUALITY_VIDEOS_FILE), exist_ok=True)
        data = {"low_quality_ids": []}
        if os.path.exists(LOW_QUALITY_VIDEOS_FILE):
            with open(LOW_QUALITY_VIDEOS_FILE, "r") as f:
                data = json.load(f)
        
        if video_id not in data.get("low_quality_ids", []):
            data.setdefault("low_quality_ids", []).append(video_id)
            with open(LOW_QUALITY_VIDEOS_FILE, "w") as f:
                json.dump(data, f, indent=2)
            print(f"Marked video {video_id} as low quality")
    except Exception as e:
        print(f"Error saving low quality video: {e}")

def is_video_low_quality(content: Dict, low_quality_ids: set = None) -> bool:
    """Check if a video has been flagged as low quality"""
    if low_quality_ids is None:
        low_quality_ids = load_low_quality_videos()
    youtube_id = extract_youtube_id(content.get("video_url", ""))
    return youtube_id in low_quality_ids


# ============ SCHEDULE GENERATION ============

def generate_schedule(hours: int = 24, start_time: datetime = None) -> List[Dict]:
    """Generate a dynamic, non-repeating schedule with maximum variety for 24/7 broadcasting"""
    if start_time is None:
        start_time = datetime.now(timezone.utc)
    
    schedule = []
    current_time = start_time
    end_time = start_time + timedelta(hours=hours)
    
    # Load disabled videos and low quality videos
    disabled_videos = load_disabled_videos()
    low_quality_videos = load_low_quality_videos()
    
    # Music categories for variety within music sessions
    MUSIC_CATEGORIES = ["global_hits", "latin", "afrobeats", "kpop_asia", "bollywood", "caribbean", "european", "hiphop_rnb", "french_rap", "zouk_caribbean"]
    ENTERTAINMENT_CATEGORIES = ["comedy", "viral_trending", "movies_trailers", "documentaries", "gaming", "sports_highlights"]
    
    # Get all available content by category (filter by YouTube video ID, not content ID)
    # Also filter out low quality videos (< 720p)
    category_pools = {}
    for category in CONTENT_CATEGORIES:
        pool = [c for c in CONTENT_LIBRARY.get(category, []) 
                if not is_video_disabled(c, disabled_videos) 
                and not is_video_low_quality(c, low_quality_videos)]
        if pool:
            random.shuffle(pool)
            category_pools[category] = pool.copy()
    
    # Track recently played to avoid immediate repeats
    recently_played_ids = []
    MAX_RECENT = 100  # Don't repeat any content within last 100 items (covers ~24 hours)
    
    # Track last played category to ensure variety
    last_category = None
    last_genre = None
    consecutive_music = 0
    MAX_CONSECUTIVE_MUSIC = 6  # Max music videos before entertainment break
    
    # Track usage per category to cycle through all content
    category_indices = {cat: 0 for cat in CONTENT_CATEGORIES}
    
    while current_time < end_time:
        hour = current_time.hour
        period = get_time_period(hour)
        preferred_categories = TIME_PREFERENCES.get(period, CONTENT_CATEGORIES)
        
        # Determine content type selection
        if consecutive_music >= MAX_CONSECUTIVE_MUSIC:
            # Force entertainment content for variety
            available_categories = [cat for cat in preferred_categories if cat in ENTERTAINMENT_CATEGORIES]
            if not available_categories:
                available_categories = ENTERTAINMENT_CATEGORIES
            consecutive_music = 0
        else:
            # Mix of music and entertainment
            if random.random() < 0.65:  # 65% music
                music_available = [cat for cat in preferred_categories if cat in MUSIC_CATEGORIES]
                # Rotate through music genres
                if last_genre and last_genre in music_available and len(music_available) > 1:
                    available_categories = [g for g in music_available if g != last_genre]
                else:
                    available_categories = music_available if music_available else MUSIC_CATEGORIES
            else:  # 35% entertainment
                entertainment_available = [cat for cat in preferred_categories if cat in ENTERTAINMENT_CATEGORIES]
                available_categories = entertainment_available if entertainment_available else ENTERTAINMENT_CATEGORIES
        
        # Avoid same category twice in a row
        if last_category and last_category in available_categories and len(available_categories) > 1:
            available_categories = [c for c in available_categories if c != last_category]
        
        if not available_categories:
            available_categories = list(category_pools.keys())
        
        # Select category
        selected_category = random.choice(available_categories)
        
        # Get content from selected category
        pool = category_pools.get(selected_category, [])
        if not pool or category_indices.get(selected_category, 0) >= len(pool):
            # Reset pool if exhausted (filter by YouTube video ID, not content ID)
            pool = [c for c in CONTENT_LIBRARY.get(selected_category, []) if not is_video_disabled(c, disabled_videos)]
            if pool:
                random.shuffle(pool)
                category_pools[selected_category] = pool
                category_indices[selected_category] = 0
        
        if not pool:
            # Fallback
            for cat in CONTENT_CATEGORIES:
                pool = category_pools.get(cat, [])
                if pool:
                    selected_category = cat
                    break
        
        if not pool:
            break
        
        # Get next content not recently played (use ONLY in-memory tracking for schedule generation)
        # IMPORTANT: Don't mark videos as "recently played" here - that happens when they ACTUALLY play
        # This prevents the bug where generating a 24hr schedule marks ALL videos as played at once
        content = None
        pool_size = len(pool)
        
        for _ in range(pool_size):
            idx = category_indices.get(selected_category, 0) % pool_size
            candidate = pool[idx]
            category_indices[selected_category] = idx + 1
            
            # Only check in-memory list - NOT the file-based tracker
            # File-based tracking is for LIVE playback, not schedule generation
            if candidate["id"] not in recently_played_ids:
                content = candidate
                break
        
        if not content:
            idx = category_indices.get(selected_category, 0) % pool_size
            content = pool[idx]
            category_indices[selected_category] = idx + 1
        
        # Update tracking
        recently_played_ids.append(content["id"])
        if len(recently_played_ids) > MAX_RECENT:
            recently_played_ids.pop(0)
        
        last_category = selected_category
        if selected_category in MUSIC_CATEGORIES:
            last_genre = selected_category
            consecutive_music += 1
        else:
            consecutive_music = 0
        
        # Calculate timing
        duration = content.get("duration_seconds", 300)
        end_slot = current_time + timedelta(seconds=duration)
        
        schedule_item = {
            "id": content["id"],
            "title": content["title"],
            "category": content["category"],
            "video_url": content["video_url"],
            "thumbnail": content.get("thumbnail", ""),
            "source": content.get("source", "ZTVLIVE"),
            "duration_seconds": duration,
            "scheduled_start": current_time.isoformat(),
            "scheduled_end": end_slot.isoformat(),
            "time_period": period
        }
        
        schedule.append(schedule_item)
        current_time = end_slot
    
    return schedule


# ============ GLOBAL SCHEDULE CACHE ============
# Cache the daily schedule so all viewers see the same thing
_daily_schedule_cache = {}
_schedule_date = None

def clear_all_caches():
    """Clear all schedule caches to force regeneration"""
    global _daily_schedule_cache, _schedule_date, _creator_bookings_cache, _creator_cache_timestamp
    _daily_schedule_cache = {}
    _schedule_date = None
    _creator_bookings_cache = {}
    _creator_cache_timestamp = None
    print("[tv_scheduler] All caches cleared - schedule will regenerate")
    return True

def get_daily_seed(date: datetime) -> int:
    """Generate a deterministic seed for a given date"""
    date_str = date.strftime("%Y-%m-%d")
    # Use SHA-256 instead of MD5 for better security
    return int(hashlib.sha256(f"ZTVLIVE-{date_str}".encode()).hexdigest()[:8], 16)


def generate_daily_schedule(date: datetime = None) -> List[Dict]:
    """
    Generate an AGGRESSIVE 24-hour schedule with MAXIMUM VARIETY.
    USES ALL CONTENT IN LIBRARY - no video left behind!
    Exhaustive shuffle: plays through ENTIRE library before ANY repeats.
    
    Key Features:
    - Uses ALL 192+ videos in the library
    - No video repeats until ALL have been played
    - Hourly seed variation for fresh content
    - Still respects time-of-day themes but with fallback to all content
    """
    global _daily_schedule_cache, _schedule_date
    
    if date is None:
        date = datetime.now(timezone.utc)
    
    # Get the start of the day in UTC
    day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # IMPORTANT: Use hour-based cache key for more dynamic scheduling
    # This ensures variety even within the same day
    current_hour = datetime.now(timezone.utc).hour
    date_key = f"{day_start.strftime('%Y-%m-%d')}-h{current_hour // 4}"  # Regenerate every 4 hours
    
    # Return cached schedule if available for this time window
    if date_key in _daily_schedule_cache:
        return _daily_schedule_cache[date_key]
    
    # Clear old caches first (keep only last 12 hours worth)
    old_keys = [k for k in list(_daily_schedule_cache.keys()) if k != date_key]
    for k in old_keys[:max(0, len(old_keys) - 3)]:  # Keep last 3 caches
        del _daily_schedule_cache[k]
    
    # Use deterministic seed based on date AND hour for variety
    seed = get_daily_seed(day_start) + current_hour
    rng = random.Random(seed)
    
    # Load disabled videos
    disabled_videos = load_disabled_videos()
    
    # AGGRESSIVE: Build ONE MEGA POOL of ALL content
    # This ensures we USE every video in the library
    all_content = []
    category_pools = {}
    for category in CONTENT_LIBRARY.keys():
        pool = [c for c in CONTENT_LIBRARY.get(category, []) if not is_video_disabled(c, disabled_videos)]
        if pool:
            rng.shuffle(pool)
            category_pools[category] = pool.copy()
            all_content.extend(pool)
    
    # Shuffle the mega pool for exhaustive play-through
    rng.shuffle(all_content)
    
    if not category_pools:
        return []
    
    print(f"[SCHEDULER] Building schedule with {len(all_content)} total videos")
    
    schedule = []
    current_time = day_start
    end_time = day_start + timedelta(hours=24)
    
    # Track which video index we're at for each category (to avoid repeats)
    category_indices = {cat: 0 for cat in category_pools.keys()}
    
    # EXHAUSTIVE TRACKING: Don't repeat ANY video until ALL have been played
    # This is the NUCLEAR option for variety
    used_video_ids = set()  # Videos used in THIS schedule
    
    # GLOBAL COOLDOWN: Track last N video IDs to enforce minimum gap
    # Increased to cover the full content library (use ALL before repeating)
    MIN_GAP = len(all_content) - 10  # Play through almost ALL before repeating
    global_recent_ids = []  # Rolling queue of last MIN_GAP video IDs
    
    while current_time < end_time:
        # Get the current program block based on hour
        current_hour = current_time.hour
        program_block = get_current_program_block(current_hour)
        block_categories = program_block["categories"]
        program_name = program_block["name"]
        
        # Calculate when this 2-hour block ends
        block_start_hour = program_block["hour"]
        block_end_hour = (block_start_hour + 2) % 24
        
        if block_end_hour > current_hour:
            block_end_time = current_time.replace(hour=block_end_hour, minute=0, second=0, microsecond=0)
        else:
            # Block ends tomorrow
            block_end_time = (current_time + timedelta(days=1)).replace(hour=block_end_hour, minute=0, second=0, microsecond=0)
        
        # Don't go past end of day
        block_end_time = min(block_end_time, end_time)
        
        # Fill this block with content from allowed categories
        block_cat_idx = 0
        
        # AGGRESSIVE: Use ALL categories as fallback (global channel = all content welcome)
        all_categories = list(category_pools.keys())
        
        # MUSIC-FOCUSED: Exclude non-music categories from fallback for cleaner programming
        # These categories have higher chance of embed restrictions
        EXCLUDED_CATEGORIES = {"short_films", "documentaries", "movies_trailers", "gaming", "comedy", "sports_highlights"}
        music_categories = [c for c in all_categories if c not in EXCLUDED_CATEGORIES]
        
        # Prioritize block categories, but use only MUSIC categories as fallback
        priority_categories = [c for c in block_categories if c in music_categories]
        fallback_categories = [c for c in music_categories if c not in block_categories]
        
        while current_time < block_end_time:
            content = None
            selected_cat = None
            
            # PHASE 1: Try the current block category (round-robin)
            # We cycle through block categories one at a time
            attempts = 0
            # AGGRESSIVE: Try ALL categories, not just block + fallback
            categories_to_try = priority_categories + fallback_categories
            max_attempts = len(categories_to_try) * 2  # Double attempts for thoroughness
            
            while content is None and attempts < max_attempts:
                try_cat = categories_to_try[attempts % len(categories_to_try)]
                attempts += 1
                pool = category_pools.get(try_cat, [])
                if not pool:
                    continue
                
                # Get current index for this category (for round-robin through pool)
                cat_idx = category_indices.get(try_cat, 0)
                
                # EXHAUSTIVE: Find a video NOT yet used in this schedule
                for offset in range(len(pool)):
                    candidate_idx = (cat_idx + offset) % len(pool)
                    candidate = pool[candidate_idx]
                    # Check BOTH exhaustive set AND cooldown queue
                    if candidate["id"] not in used_video_ids and candidate["id"] not in global_recent_ids:
                        content = candidate
                        selected_cat = try_cat
                        category_indices[try_cat] = (candidate_idx + 1) % len(pool)
                        break
            
            # Advance the round-robin index for next iteration
            block_cat_idx += 1
            
            # FALLBACK: If we've exhausted ALL videos once, reset and allow repeats
            # But pick from the oldest-played videos first
            if not content:
                # Reset exhaustive tracking for second pass through library
                if len(used_video_ids) >= len(all_content) - 5:
                    print(f"[SCHEDULER] Exhaustive pass complete! Used {len(used_video_ids)} videos, resetting...")
                    used_video_ids.clear()
                    global_recent_ids = global_recent_ids[-20:]  # Keep only last 20 for immediate variety
                    continue  # Try again with fresh slate
                
                # Find video with oldest position in global_recent_ids
                best_candidate = None
                best_age = -1
                
                for try_cat in categories_to_try:
                    pool = category_pools.get(try_cat, [])
                    for candidate in pool:
                        try:
                            age = global_recent_ids.index(candidate["id"])
                        except ValueError:
                            age = len(global_recent_ids) + 1  # Not found = oldest
                        
                        if age > best_age:
                            best_age = age
                            best_candidate = candidate
                            selected_cat = try_cat
                
                content = best_candidate
            
            if not content:
                # No content available at all, break out
                break
            
            # DJ-STYLE AUTO-TRIM: Cut off promotional end cards
            original_duration = content.get("duration_seconds", 300)
            source = content.get("source", "")
            trim_seconds = get_trim_seconds(source)
            
            # Apply trim (minimum video length of 60 seconds after trim)
            effective_duration = max(60, original_duration - trim_seconds)
            
            duration = effective_duration
            end_slot = current_time + timedelta(seconds=duration)
            
            # Don't exceed block boundary
            if end_slot > block_end_time:
                end_slot = block_end_time
                # Adjust duration to fit
                duration = int((end_slot - current_time).total_seconds())
                if duration <= 0:
                    break
            
            schedule_item = {
                "id": content["id"],
                "title": content["title"],
                "category": content.get("category", selected_cat),
                "video_url": content["video_url"],
                "thumbnail": content.get("thumbnail", ""),
                "source": content.get("source", "ZTVLIVE"),
                "duration_seconds": original_duration,  # Original video duration
                "playback_duration": effective_duration,  # DJ-trimmed duration (what we actually play)
                "trim_seconds": trim_seconds,  # How much we trimmed
                "scheduled_start": current_time.isoformat(),
                "scheduled_end": end_slot.isoformat(),
                "start_seconds": int((current_time - day_start).total_seconds()),
                "end_seconds": int((end_slot - day_start).total_seconds()),
                "program_block": program_name
            }
            
            schedule.append(schedule_item)
            current_time = end_slot
            
            # EXHAUSTIVE TRACKING: Mark this video as used in this schedule
            used_video_ids.add(content["id"])
            
            # Update global cooldown queue
            # Remove this video if already in queue, then add to end
            if content["id"] in global_recent_ids:
                global_recent_ids.remove(content["id"])
            global_recent_ids.append(content["id"])
            
            # Keep only last MIN_GAP items in queue
            if len(global_recent_ids) > MIN_GAP:
                global_recent_ids = global_recent_ids[-MIN_GAP:]
    
    print(f"[SCHEDULER] Schedule complete: {len(schedule)} items, {len(used_video_ids)} unique videos used")
    
    # Cache the schedule
    _daily_schedule_cache[date_key] = schedule
    
    # Clean old cache entries (keep only last 3 days)
    old_keys = [k for k in _daily_schedule_cache.keys() if k < (day_start - timedelta(days=3)).strftime("%Y-%m-%d")]
    for k in old_keys:
        del _daily_schedule_cache[k]
    
    return schedule


def get_current_program() -> Dict:
    """
    Get the currently playing program based on current UTC time.
    This is DETERMINISTIC - all viewers see the same video at the same time.
    
    Priority:
    1. Admin shuffle override (if active)
    2. Creator bookings
    3. AI-generated schedule
    """
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    
    # FIRST: Check for admin shuffle override
    shuffled = get_current_from_shuffle()
    if shuffled:
        return shuffled
    
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    current_hour = now.hour
    current_minute = now.minute
    date_str = today.strftime("%Y-%m-%d")
    
    print(f"[get_current_program] UTC time: {now}, looking for creator content at {date_str} {current_hour}:{current_minute}")
    
    # Try to get creator booking for current time slot
    # This is synchronous, so we need to use sync MongoDB client or cache
    creator_content = _get_cached_creator_booking(date_str, current_hour, current_minute)
    
    if creator_content:
        print(f"[get_current_program] FOUND creator content: {creator_content.get('title')}")
        
        # Calculate elapsed time within creator content (in SECONDS)
        booking_start_seconds = creator_content["slot_start_hour"] * 3600 + creator_content.get("slot_start_minute", 0) * 60
        current_total_seconds = current_hour * 3600 + current_minute * 60 + now.second
        elapsed_seconds = current_total_seconds - booking_start_seconds
        
        # Use TRT (actual video duration) if available
        trt_seconds = creator_content.get("trt_seconds") or creator_content.get("video_duration_seconds")
        if trt_seconds and trt_seconds > 0:
            duration = trt_seconds
            print(f"[get_current_program] Using actual TRT: {duration}s ({duration//60}m {duration%60}s)")
        else:
            duration = creator_content.get("duration_minutes", 60) * 60
            print(f"[get_current_program] Using booked duration: {duration}s ({duration//60}m)")
        
        progress = (elapsed_seconds / duration) * 100 if duration > 0 else 0
        remaining_seconds = max(0, duration - elapsed_seconds)
        
        # Convert YouTube URL to embed format
        video_url = creator_content.get("video_url", "")
        embed_url = video_url
        if "youtube.com/watch?v=" in video_url:
            video_id = video_url.split("watch?v=")[1].split("&")[0]
            embed_url = f"https://www.youtube.com/embed/{video_id}?autoplay=1&rel=0&start={int(elapsed_seconds)}"
        elif "youtu.be/" in video_url:
            video_id = video_url.split("youtu.be/")[1].split("?")[0]
            embed_url = f"https://www.youtube.com/embed/{video_id}?autoplay=1&rel=0&start={int(elapsed_seconds)}"
        
        print(f"[get_current_program] Elapsed: {elapsed_seconds}s, Remaining: {remaining_seconds}s, Progress: {progress:.1f}%")
        
        return {
            "id": creator_content.get("booking_id"),
            "title": creator_content.get("title"),
            "category": creator_content.get("category", "creator_content"),
            "video_url": video_url,
            "embed_url": embed_url,
            "thumbnail": creator_content.get("thumbnail", ""),
            "source": f"Creator: {creator_content.get('creator_name', 'ZTVLIVE Creator')}",
            "duration_seconds": duration,
            "elapsed_seconds": elapsed_seconds,
            "start_from_seconds": elapsed_seconds,
            "remaining_seconds": remaining_seconds,
            "progress_percent": round(progress, 2),
            "is_live": True,
            "is_creator_content": True,
            "creator_name": creator_content.get("creator_name"),
            "creator_id": creator_content.get("creator_id"),
            "content_type": creator_content.get("content_type", "youtube"),
            "file_id": creator_content.get("file_id")  # For uploaded videos
        }
    else:
        print("[get_current_program] No creator content found, falling back to AI schedule")
    
    # Fall back to AI schedule
    schedule = generate_daily_schedule(today)
    
    if not schedule:
        return {"id": "default", "title": "ZTVLIVE", "elapsed_seconds": 0, "duration_seconds": 300}
    
    # Calculate seconds since midnight UTC
    seconds_since_midnight = int((now - today).total_seconds())
    
    # Find which video should be playing right now
    for item in schedule:
        start_sec = item["start_seconds"]
        end_sec = item["end_seconds"]
        
        if start_sec <= seconds_since_midnight < end_sec:
            elapsed = seconds_since_midnight - start_sec
            # Use playback_duration (DJ-trimmed) for accurate progress calculation
            playback_duration = item.get("playback_duration", item["duration_seconds"])
            progress = (elapsed / playback_duration) * 100 if playback_duration > 0 else 0
            
            return {
                **item,
                "elapsed_seconds": elapsed,
                "progress_percent": round(progress, 2),
                "is_live": True,
                "is_creator_content": False
            }
    
    # If past today's schedule, get tomorrow's first item
    tomorrow = today + timedelta(days=1)
    tomorrow_schedule = generate_daily_schedule(tomorrow)
    
    if tomorrow_schedule:
        # Calculate how far into tomorrow we are
        seconds_into_tomorrow = seconds_since_midnight - 86400  # 86400 = 24 hours
        if seconds_into_tomorrow >= 0:
            for item in tomorrow_schedule:
                if item["start_seconds"] <= seconds_into_tomorrow < item["end_seconds"]:
                    elapsed = seconds_into_tomorrow - item["start_seconds"]
                    # Use playback_duration (DJ-trimmed) for accurate progress calculation
                    playback_duration = item.get("playback_duration", item["duration_seconds"])
                    progress = (elapsed / playback_duration) * 100 if playback_duration > 0 else 0
                    
                    return {
                        **item,
                        "elapsed_seconds": elapsed,
                        "progress_percent": round(progress, 2),
                        "is_live": True,
                        "is_creator_content": False
                    }
    
    # Fallback to first item
    first = schedule[0] if schedule else {"id": "default", "title": "ZTVLIVE", "duration_seconds": 300}
    return {**first, "elapsed_seconds": 0, "progress_percent": 0, "is_live": True, "is_creator_content": False}


# Cache for creator bookings (refreshed periodically)
_creator_bookings_cache = {}
_creator_cache_timestamp = None
_cache_lock = None  # Will be initialized if needed

def get_creator_bookings_cache():
    """Thread-safe getter for creator bookings cache"""
    global _creator_bookings_cache
    return _creator_bookings_cache.copy()

def set_creator_bookings_cache(new_cache):
    """Thread-safe setter for creator bookings cache"""
    global _creator_bookings_cache, _creator_cache_timestamp
    _creator_bookings_cache = new_cache
    _creator_cache_timestamp = datetime.now(timezone.utc)

def _get_cached_creator_booking(date_str: str, hour: int, minute: int) -> Optional[Dict]:
    """
    Get creator booking from cache for the current time slot.
    Cache is updated by the background scheduler.
    
    Now supports minute-level precision for non-hourly bookings (e.g., 1:30 AM).
    
    CRITICAL: Uses seconds-level precision for TRT checking.
    """
    global _creator_bookings_cache
    
    now = datetime.now(timezone.utc)
    current_total_seconds = hour * 3600 + minute * 60 + now.second
    
    # Debug logging
    if not _creator_bookings_cache:
        print(f"Creator cache is EMPTY when checking for time {hour}:{minute}:{now.second}")
    else:
        print(f"Creator cache has {len(_creator_bookings_cache)} entries, checking for time {hour}:{minute}:{now.second}")
        print(f"Cache keys: {list(_creator_bookings_cache.keys())}")
    
    # Build list of cache keys to check
    # First check minute-level keys (non-hourly bookings), then hour-level keys
    keys_to_check = []
    
    # Check for non-hourly bookings (minute-level keys) in current hour
    # Look at all minutes in the current hour that are <= current minute
    for m in range(0, minute + 1):
        if m == 0:
            # Also add hour-level key for backwards compatibility
            keys_to_check.append(f"{date_str}_{hour}")
        else:
            keys_to_check.append(f"{date_str}_{hour}_{m}")
    
    # Check previous hour for bookings that might span into current hour
    prev_hour = hour - 1 if hour > 0 else 23
    prev_date = date_str
    if hour == 0:
        # At midnight, also check hour 23 from previous day
        prev_day = (datetime.strptime(date_str, "%Y-%m-%d") - timedelta(days=1))
        prev_date = prev_day.strftime("%Y-%m-%d")
    
    # Add previous hour keys (minute-level and hour-level)
    for m in range(0, 60):
        if m == 0:
            keys_to_check.append(f"{prev_date}_{prev_hour}")
        else:
            keys_to_check.append(f"{prev_date}_{prev_hour}_{m}")
    
    # Check each potential booking
    for cache_key in keys_to_check:
        if cache_key not in _creator_bookings_cache:
            continue
        
        booking = _creator_bookings_cache[cache_key]
        
        # Check booking status - only approved or live bookings
        status = booking.get("status", "approved")
        if status not in ["approved", "confirmed", "live", "pending"]:
            print(f"Skipping booking '{booking.get('title')}' with status '{status}'")
            continue
        
        # PRIORITY: Get actual video duration (trt_seconds)
        # FALLBACK: Use booked duration_minutes if TRT not available
        trt_seconds = booking.get("trt_seconds") or booking.get("video_duration_seconds")
        
        if trt_seconds and trt_seconds > 0:
            duration_seconds = trt_seconds
            print(f"Using TRT: {trt_seconds}s ({trt_seconds//60}m {trt_seconds%60}s) for '{booking.get('title')}'")
        else:
            # FALLBACK: Use booked duration_minutes (convert to seconds)
            duration_minutes = booking.get("duration_minutes", 15)  # Default to 15 minutes
            duration_seconds = duration_minutes * 60
            print(f"⚠️ NO TRT for '{booking.get('title')}' - using booked duration: {duration_minutes}m ({duration_seconds}s)")
        
        # Calculate booking start/end in SECONDS for precise checking
        booking_start_seconds = booking["slot_start_hour"] * 3600 + booking.get("slot_start_minute", 0) * 60
        booking_end_seconds = booking_start_seconds + duration_seconds
        
        print(f"Checking cache_key {cache_key}: booking {booking_start_seconds//60}:{booking_start_seconds%60:02d} - {booking_end_seconds//60}:{booking_end_seconds%60:02d}, current {current_total_seconds//60}:{current_total_seconds%60:02d}")
        
        if booking_start_seconds <= current_total_seconds < booking_end_seconds:
            # Update the booking with actual duration for downstream use
            booking["trt_seconds"] = duration_seconds
            booking["effective_duration_minutes"] = (duration_seconds + 59) // 60
            print(f"✅ MATCH! Returning creator content: {booking.get('title')} (ends in {booking_end_seconds - current_total_seconds}s)")
            return booking
    
    print("No matching creator booking found for current time")
    return None

async def refresh_creator_bookings_cache():
    """Refresh the creator bookings cache from database"""
    global _creator_bookings_cache, _creator_cache_timestamp
    
    try:
        # Import db from server
        from server import db
        
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")
        tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        
        print(f"Refreshing creator cache for dates: {today}, {tomorrow}")
        
        # Get approved/confirmed/live bookings for today and tomorrow
        # Include multiple statuses to catch all valid bookings
        query = {
            "slot_date": {"$in": [today, tomorrow]},
            "status": {"$in": ["approved", "confirmed", "live", "pending"]}
        }
        print(f"Query: {query}")
        
        bookings = await db.creator_bookings.find(query).to_list(100)
        
        print(f"Creator bookings cache refresh: found {len(bookings)} bookings for {today}/{tomorrow}")
        
        # Build cache with minute-level precision for non-hourly bookings
        new_cache = {}
        for b in bookings:
            # Use minute-level cache key for precise scheduling
            start_minute = b.get("slot_start_minute", 0)
            if start_minute == 0:
                # Hourly booking - use standard key for backwards compatibility
                cache_key = f"{b['slot_date']}_{b['slot_start_hour']}"
            else:
                # Non-hourly booking - include minute in key
                cache_key = f"{b['slot_date']}_{b['slot_start_hour']}_{start_minute}"
            
            new_cache[cache_key] = {
                "booking_id": b.get("booking_id"),
                "title": b.get("title"),
                "description": b.get("description"),
                "video_url": b.get("video_url"),
                "thumbnail": b.get("thumbnail"),
                "category": b.get("category"),
                "creator_name": b.get("creator_name"),
                "creator_id": b.get("creator_id"),
                "slot_start_hour": b.get("slot_start_hour"),
                "slot_start_minute": start_minute,
                "duration_minutes": b.get("duration_minutes", 60),
                "trt_seconds": b.get("trt_seconds"),  # Actual video duration
                "video_duration_seconds": b.get("video_duration_seconds"),  # Alternative field
                "content_type": b.get("content_type", "youtube"),
                "file_id": b.get("file_id"),
                "status": b.get("status")
            }
            trt = b.get("trt_seconds")
            trt_info = f" (TRT: {trt//60}m {trt%60}s)" if trt else " (no TRT)"
            print(f"  Cached: {cache_key} -> {b.get('title')}{trt_info}")
        
        # Use direct assignment to update the global
        _creator_bookings_cache.clear()
        _creator_bookings_cache.update(new_cache)
        _creator_cache_timestamp = now
        
        print(f"Cache updated! Now has {len(_creator_bookings_cache)} entries: {list(_creator_bookings_cache.keys())}")
        
        # Auto-heal: Try to detect TRT for bookings without it
        await _auto_heal_missing_trt(bookings)
        
        return len(bookings)
    except Exception as e:
        print(f"Error refreshing creator bookings cache: {e}")
        import traceback
        traceback.print_exc()
        return 0


async def _auto_heal_missing_trt(bookings: list):
    """
    Auto-heal bookings without TRT by trying to detect video duration.
    This runs in background during cache refresh.
    """
    from server import db
    import subprocess
    import httpx
    import re
    
    for booking in bookings:
        if booking.get("trt_seconds") or booking.get("video_duration_seconds"):
            continue  # Already has TRT
        
        booking_id = booking.get("booking_id") or str(booking.get("_id"))
        video_url = booking.get("video_url", "")
        content_type = booking.get("content_type", "")
        title = booking.get("title", "Unknown")
        
        print(f"🔧 AUTO-HEAL: Attempting TRT detection for '{title}'")
        
        trt_seconds = None
        
        # Method 1: YouTube video
        if "youtube.com" in video_url or "youtu.be" in video_url:
            trt_seconds = await _detect_youtube_duration(video_url)
        
        # Method 2: Uploaded video file
        elif content_type == "upload" or "/video/" in video_url:
            file_id = None
            if "/video/" in video_url:
                file_id = video_url.split("/video/")[-1].split("?")[0]
            
            if file_id:
                # Check upload record for duration
                upload = await db.creator_video_uploads.find_one({"file_id": file_id})
                if upload:
                    if upload.get("duration_seconds"):
                        trt_seconds = upload["duration_seconds"]
                    elif upload.get("filepath"):
                        # Try ffprobe on the file
                        trt_seconds = _detect_file_duration(upload["filepath"])
                        if trt_seconds:
                            # Update upload record too
                            await db.creator_video_uploads.update_one(
                                {"file_id": file_id},
                                {"$set": {"duration_seconds": trt_seconds}}
                            )
        
        # If we got TRT, update the booking
        if trt_seconds and trt_seconds > 0:
            print(f"✅ AUTO-HEAL SUCCESS: '{title}' TRT = {trt_seconds}s ({trt_seconds//60}m {trt_seconds%60}s)")
            
            await db.creator_bookings.update_one(
                {"booking_id": booking_id},
                {"$set": {"trt_seconds": trt_seconds, "trt_auto_detected": True}}
            )
            
            # Also update scheduled content
            await db.creator_scheduled_content.update_one(
                {"id": booking_id},
                {"$set": {"trt_seconds": trt_seconds}}
            )
            
            # Update cache entry
            cache_key = f"{booking.get('slot_date')}_{booking.get('slot_start_hour')}"
            if cache_key in _creator_bookings_cache:
                _creator_bookings_cache[cache_key]["trt_seconds"] = trt_seconds
        else:
            print(f"⚠️ AUTO-HEAL FAILED: Could not detect TRT for '{title}' - content will NOT air")


async def _detect_youtube_duration(video_url: str) -> Optional[int]:
    """Detect YouTube video duration using multiple methods"""
    import httpx
    import re
    
    # Extract video ID
    video_id = None
    if "youtube.com/watch?v=" in video_url:
        video_id = video_url.split("watch?v=")[1].split("&")[0]
    elif "youtu.be/" in video_url:
        video_id = video_url.split("youtu.be/")[1].split("?")[0]
    elif "youtube.com/embed/" in video_url:
        video_id = video_url.split("embed/")[1].split("?")[0]
    
    if not video_id:
        return None
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Method 1: oEmbed API
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            resp = await client.get(oembed_url)
            if resp.status_code == 200:
                # oEmbed doesn't give duration, but confirms video exists
                pass
            
            # Method 2: Scrape watch page for duration
            watch_url = f"https://www.youtube.com/watch?v={video_id}"
            resp = await client.get(watch_url)
            if resp.status_code == 200:
                html = resp.text
                # Look for duration in meta tags or structured data
                duration_match = re.search(r'"lengthSeconds":"(\d+)"', html)
                if duration_match:
                    return int(duration_match.group(1))
                
                # Alternative pattern
                duration_match = re.search(r'approxDurationMs":"(\d+)"', html)
                if duration_match:
                    return int(duration_match.group(1)) // 1000
    except Exception as e:
        print(f"YouTube duration detection error: {e}")
    
    return None


def _detect_file_duration(filepath: str) -> Optional[int]:
    """Detect video file duration using ffprobe"""
    import subprocess
    
    if not filepath or not os.path.exists(filepath):
        return None
    
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", filepath],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            return int(float(result.stdout.strip()))
    except Exception as e:
        print(f"ffprobe error: {e}")
    
    return None


def get_upcoming_programs(count: int = 5) -> List[Dict]:
    """Get the next N upcoming programs after the current one"""
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    schedule = generate_daily_schedule(today)
    seconds_since_midnight = int((now - today).total_seconds())
    
    upcoming = []
    
    for item in schedule:
        if item["start_seconds"] > seconds_since_midnight:
            # This item is in the future
            time_until = item["start_seconds"] - seconds_since_midnight
            upcoming.append({
                **item,
                "starts_in_seconds": time_until
            })
            if len(upcoming) >= count:
                break
        elif item["start_seconds"] <= seconds_since_midnight < item["end_seconds"]:
            # This is current - skip it
            pass
    
    # If we need more, get from tomorrow's schedule
    if len(upcoming) < count:
        tomorrow = today + timedelta(days=1)
        tomorrow_schedule = generate_daily_schedule(tomorrow)
        
        for item in tomorrow_schedule:
            time_until = (86400 - seconds_since_midnight) + item["start_seconds"]
            upcoming.append({
                **item,
                "starts_in_seconds": time_until
            })
            if len(upcoming) >= count:
                break
    
    return upcoming[:count]


def advance_to_next_video() -> Dict:
    """
    For synchronized live TV, we don't manually advance.
    This function now just returns the NEXT video in the schedule.
    The actual advancement happens automatically based on time.
    """
    upcoming = get_upcoming_programs(count=1)
    
    if upcoming:
        return {
            **upcoming[0],
            "elapsed_seconds": 0,
            "progress_percent": 0,
            "is_live": True,
            "note": "This is the next scheduled video - playback is time-synchronized"
        }
    
    # Fallback
    return get_current_program()


def get_featured_highlights(count: int = 20) -> List[Dict]:
    """Get curated highlights for the homepage"""
    highlights = []
    priority_categories = ["global_hits", "latin", "afrobeats", "kpop_asia", "comedy", "viral_trending", "hiphop_rnb"]
    
    for category in priority_categories:
        items = CONTENT_LIBRARY.get(category, [])
        sample_count = min(3, len(items))
        if items:
            sampled = random.sample(items, sample_count)
            for item in sampled:
                highlights.append({
                    **item,
                    "category": category,
                    "views": random.randint(100000, 50000000),
                    "likes": random.randint(10000, 2000000)
                })
    
    random.shuffle(highlights)
    return highlights[:count]


def get_library_for_frontend() -> Dict:
    """Get the full library formatted for frontend consumption"""
    return {
        "categories": CONTENT_LIBRARY,
        "total_items": get_total_content_count(),
        "total_content": get_total_content_count(),
        "total_duration_hours": get_content_stats()["total_duration_hours"]
    }


# Compatibility aliases
_pinned_content = []
_schedule_cache = {}

def get_dynamic_schedule(hours: int = 24, category: str = None) -> List[Dict]:
    schedule = generate_schedule(hours=hours)
    if category:
        schedule = [item for item in schedule if item.get("category") == category]
    return schedule

def get_now_playing() -> Dict:
    return get_current_program()

def get_live_sync() -> Dict:
    """Get the current state for live sync (what viewers should see now)"""
    current = get_current_program()
    now = datetime.now(timezone.utc)
    program_block = get_current_program_block(now.hour)
    
    # Check if current video is embeddable (only for non-creator content)
    if not current.get("is_creator_content"):
        video_url = current.get("video_url", "")
        if video_url and "/embed/" in video_url:
            video_id = video_url.split("/embed/")[-1].split("?")[0]
            if video_id and not check_video_embeddable(video_id):
                logger.warning(f"[LIVE SYNC] Video {video_id} not embeddable, trying to skip...")
                # Try to skip to next video by marking this one as disabled
                try:
                    from services.content_health import disable_video
                    disable_video(video_id)  # Only takes video_id
                    clear_all_caches()  # Force schedule regeneration
                    # Get the next video
                    current = get_current_program()
                except Exception as e:
                    logger.error(f"[LIVE SYNC] Error skipping non-embeddable video: {e}")
    
    return {
        "now_playing": current,
        "elapsed_seconds": current.get("elapsed_seconds", 0),
        "start_from_seconds": current.get("elapsed_seconds", 0),
        "video_url": current.get("video_url", ""),
        "embed_url": current.get("embed_url", ""),  # Include embed_url at top level
        "video_id": current.get("video_url", "").split("/")[-1] if current.get("video_url") else "",
        "title": current.get("title", ""),
        "category": current.get("category", ""),
        "thumbnail": current.get("thumbnail", ""),
        "duration_seconds": current.get("duration_seconds", 300),
        "playback_duration": current.get("playback_duration", current.get("duration_seconds", 300)),  # DJ-trimmed duration
        "is_creator_content": current.get("is_creator_content", False),
        "creator_name": current.get("creator_name", ""),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "program_block": {
            "name": program_block["name"],
            "description": program_block["desc"]
        }
    }

def get_program_schedule() -> List[Dict]:
    """Get the full TV programming schedule with EST times"""
    schedule = []
    for block in TV_PROGRAM_SCHEDULE:
        # Convert UTC hour to EST (UTC-5)
        utc_hour = block["hour"]
        est_hour = (utc_hour - 5) % 24
        
        # Format time
        am_pm = "AM" if est_hour < 12 else "PM"
        display_hour = est_hour if est_hour <= 12 else est_hour - 12
        if display_hour == 0:
            display_hour = 12
        
        schedule.append({
            "time_est": f"{display_hour:02d}:00 {am_pm}",
            "time_utc": f"{utc_hour:02d}:00",
            "name": block["name"],
            "description": block["desc"],
            "categories": block["categories"]
        })
    
    return schedule

def get_upcoming_content(count: int = 5) -> List[Dict]:
    return get_upcoming_programs(count=count)

def pin_content(content_id: str, priority: int = 1) -> bool:
    global _pinned_content
    _pinned_content = [p for p in _pinned_content if p["id"] != content_id]
    all_content = get_all_content()
    for item in all_content:
        if item["id"] == content_id:
            _pinned_content.append({**item, "pinned_priority": priority})
            _pinned_content.sort(key=lambda x: x.get("pinned_priority", 999))
            return True
    return False

def unpin_content(content_id: str) -> bool:
    global _pinned_content
    original_len = len(_pinned_content)
    _pinned_content = [p for p in _pinned_content if p["id"] != content_id]
    return len(_pinned_content) < original_len

def get_pinned_list() -> List[Dict]:
    return _pinned_content.copy()

def get_content_library() -> Dict:
    return get_library_for_frontend()

def get_content_by_category(category: str) -> List[Dict]:
    """Get all content from a specific category"""
    items = CONTENT_LIBRARY.get(category, [])
    return [{**item, "category": category} for item in items]

def clear_schedule_cache():
    global _schedule_cache, _daily_schedule_cache
    _schedule_cache = {}
    _daily_schedule_cache = {}
    return True


def clear_all_caches():
    """Clear all schedule caches - use after disabling videos"""
    global _schedule_cache, _daily_schedule_cache
    _schedule_cache = {}
    _daily_schedule_cache = {}
    print("All schedule caches cleared")
    return True


# ============ SHUFFLE OVERRIDE FUNCTIONS ============

# Global variables for shuffle override
_shuffle_start_time = None  # When the current shuffle started (for position calculation)

def set_shuffle_override(playlist: List[Dict], timestamp: str = None):
    """Set the shuffled playlist that overrides normal scheduling"""
    global _shuffled_playlist_override, _shuffle_timestamp, _shuffle_start_time
    _shuffled_playlist_override = playlist
    _shuffle_timestamp = timestamp or datetime.now(timezone.utc).isoformat()
    # Reset start time so playlist begins from the first video
    _shuffle_start_time = datetime.now(timezone.utc)
    return True

def clear_shuffle_override():
    """Clear the shuffle override, return to normal scheduling"""
    global _shuffled_playlist_override, _shuffle_timestamp, _shuffle_start_time
    _shuffled_playlist_override = []
    _shuffle_timestamp = None
    _shuffle_start_time = None
    return True

def get_shuffle_override() -> Dict:
    """Get the current shuffle override status"""
    return {
        "active": len(_shuffled_playlist_override) > 0,
        "playlist": _shuffled_playlist_override,
        "count": len(_shuffled_playlist_override),
        "timestamp": _shuffle_timestamp,
        "start_time": _shuffle_start_time.isoformat() if _shuffle_start_time else None
    }

async def trigger_fallback_playlist(booking_id: str = None):
    """
    Trigger fallback to auto-playlist when a creator stream is dead
    This clears any override and returns to normal programming
    """
    import logging
    logger = logging.getLogger("tv_scheduler")
    
    clear_shuffle_override()
    logger.info(f"Fallback triggered for booking {booking_id}, returning to auto-playlist")
    return True



def get_current_from_shuffle() -> Optional[Dict]:
    """Get the current video from the shuffled playlist based on elapsed time since playlist started"""
    global _shuffle_start_time
    
    if not _shuffled_playlist_override:
        return None
    
    now = datetime.now(timezone.utc)
    
    # If we have a start time, calculate position from when playlist started
    # This means Full Refresh starts from the FIRST video
    if _shuffle_start_time:
        seconds_elapsed = int((now - _shuffle_start_time).total_seconds())
    else:
        # Fallback to midnight-based calculation for backwards compatibility
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        seconds_elapsed = int((now - today).total_seconds())
    
    # Calculate total playlist duration
    total_duration = sum(item.get("duration_seconds", 180) for item in _shuffled_playlist_override)
    
    if total_duration == 0:
        return None
    
    # Loop through playlist to find current position (with wraparound when playlist ends)
    position_in_playlist = seconds_elapsed % total_duration
    
    cumulative = 0
    for idx, item in enumerate(_shuffled_playlist_override):
        duration = item.get("duration_seconds", 180)
        if cumulative + duration > position_in_playlist:
            elapsed = position_in_playlist - cumulative
            progress = (elapsed / duration) * 100 if duration > 0 else 0
            
            return {
                **item,
                "elapsed_seconds": elapsed,
                "progress_percent": round(progress, 2),
                "playlist_position": idx + 1,
                "playlist_total": len(_shuffled_playlist_override),
                "is_live": True,
                "is_shuffled": True,
                "source": "Admin Shuffle",
                "thumbnail": f"https://i.ytimg.com/vi/{item.get('video_url', '').split('/')[-1]}/hqdefault.jpg"
            }
        cumulative += duration
    
    # Fallback to first item
    return {
        **_shuffled_playlist_override[0],
        "elapsed_seconds": 0,
        "progress_percent": 0,
        "playlist_position": 1,
        "playlist_total": len(_shuffled_playlist_override),
        "is_live": True,
        "is_shuffled": True,
        "source": "Admin Shuffle"
    }


async def get_active_creator_booking():
    """
    Get the currently active creator booking if any.
    Used by OBS automation to check content safety.
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    
    try:
        client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
        db = client[os.environ.get("DB_NAME", "test_database")]
        
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")
        current_hour = now.hour
        current_minute = now.minute
        current_total_minutes = current_hour * 60 + current_minute
        
        # Find active booking
        booking = await db.creator_bookings.find_one({
            "slot_date": today,
            "status": {"$in": ["approved", "confirmed", "live"]},
            "slot_start_hour": {"$lte": current_hour}
        }, {"_id": 0})
        
        if booking:
            slot_start_minutes = booking.get("slot_start_hour", 0) * 60 + booking.get("slot_start_minute", 0)
            duration_minutes = booking.get("duration_minutes", 15)
            trt_seconds = booking.get("trt_seconds", duration_minutes * 60)
            slot_end_minutes = slot_start_minutes + (trt_seconds // 60)
            
            if slot_start_minutes <= current_total_minutes < slot_end_minutes:
                return booking
        
        return None
    except Exception as e:
        print(f"Error getting active booking: {e}")
        return None
