#!/usr/bin/env python3
"""
ZTVLIVE 24-Hour Schedule Generator
===================================
Generates a diverse, professionally-curated 24/7 broadcast schedule.
Outputs: backend/data/clean_schedule.json

Categories:
  🎵 Kompa/Haitian Music (Klass, T-Vice, Harmonik, Kai, Nu-Look)
  🎤 Hip-Hop/R&B (Drake, Future, Kendrick Lamar)
  📺 Global News (NASA Live, Sky News AU, Bloomberg)
  🌴 Caribbean Vibes (Zouk, Reggae)
"""

import json
import os
from datetime import datetime

# ─── Master Feed Library ────────────────────────────────────────────

KOMPA_FEEDS = [
    {
        "id": "kompa_klass_ranje",
        "title": "Klass - Ranje Chita",
        "video_url": "https://www.youtube.com/embed/5U2zBvF8n8Q",
        "category": "KOMPA",
        "source": "Klass",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Klass - Ranje Chita | Haitian Kompa",
        "duration_seconds": 300,
    },
    {
        "id": "kompa_tvice_moving",
        "title": "T-Vice - Moving On",
        "video_url": "https://www.youtube.com/embed/6_Yf_7pXoQ4",
        "category": "KOMPA",
        "source": "T-Vice",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "T-Vice - Moving On | Haitian Kompa",
        "duration_seconds": 300,
    },
    {
        "id": "kompa_kai_kanpe",
        "title": "Kai - Kanpe",
        "video_url": "https://www.youtube.com/embed/m7lP_lK4bW8",
        "category": "KOMPA",
        "source": "Kai",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Kai - Kanpe | Haitian Kompa",
        "duration_seconds": 300,
    },
    {
        "id": "kompa_harmonik_bouke",
        "title": "Harmonik - Mwen Bouke",
        "video_url": "https://www.youtube.com/embed/5F_E_vF_1zQ",
        "category": "KOMPA",
        "source": "Harmonik",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Harmonik - Mwen Bouke | Haitian Kompa",
        "duration_seconds": 300,
    },
    {
        "id": "kompa_nulook_live",
        "title": "Nu-Look - Best Of Live Mix",
        "video_url": "https://www.youtube.com/embed/dRhVmtYbJOQ",
        "category": "KOMPA",
        "source": "Nu-Look",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Nu-Look live performance compilation | Haitian Kompa",
        "duration_seconds": 600,
    },
]

HIPHOP_FEEDS = [
    {
        "id": "hiphop_drake_gods_plan",
        "title": "Drake - God's Plan",
        "video_url": "https://www.youtube.com/embed/xpVfcZ0ZcFM",
        "category": "HIPHOP",
        "source": "Drake",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Drake - God's Plan (Official Video)",
        "duration_seconds": 330,
    },
    {
        "id": "hiphop_future_mask_off",
        "title": "Future - Mask Off",
        "video_url": "https://www.youtube.com/embed/xvZqHgFz51I",
        "category": "HIPHOP",
        "source": "Future",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Future - Mask Off (Official Video)",
        "duration_seconds": 260,
    },
    {
        "id": "hiphop_kendrick_humble",
        "title": "Kendrick Lamar - HUMBLE.",
        "video_url": "https://www.youtube.com/embed/tvTRZJ-4EyI",
        "category": "HIPHOP",
        "source": "Kendrick Lamar",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Kendrick Lamar - HUMBLE. (Official Video)",
        "duration_seconds": 180,
    },
    {
        "id": "hiphop_kendrick_dna",
        "title": "Kendrick Lamar - DNA.",
        "video_url": "https://www.youtube.com/embed/NLZRYQMLDW4",
        "category": "HIPHOP",
        "source": "Kendrick Lamar",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Kendrick Lamar - DNA. (Official Video)",
        "duration_seconds": 200,
    },
]

NEWS_FEEDS = [
    {
        "id": "news_nasa_tv",
        "title": "NASA TV - Space & Science Live",
        "video_url": "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
        "fallback_url": "https://www.youtube.com/embed/21X5lGlDOfg",
        "category": "NEWS",
        "source": "NASA",
        "stream_type": "hls",
        "thumbnail": "https://images-assets.nasa.gov/image/iss040e090540/iss040e090540~orig.jpg",
        "description": "Live feed from NASA Television - ISS, launches, briefings",
        "duration_seconds": 3600,
    },
    {
        "id": "news_sky_au",
        "title": "Sky News Australia Live",
        "video_url": "https://skynewsau-live.akamaized.net/hls/live/2002689/skynewsau-extra1/master.m3u8",
        "fallback_url": "https://www.youtube.com/embed/9AuqEdf6zLw",
        "category": "NEWS",
        "source": "Sky News AU",
        "stream_type": "hls",
        "thumbnail": "",
        "description": "24/7 Sky News Australia - breaking news & analysis",
        "duration_seconds": 3600,
    },
    {
        "id": "news_bloomberg",
        "title": "Bloomberg Television",
        "video_url": "https://www.bloomberg.com/media-manifest/streams/us.m3u8",
        "fallback_url": "https://www.youtube.com/embed/dp8PhLsUcFE",
        "category": "NEWS",
        "source": "Bloomberg",
        "stream_type": "hls",
        "thumbnail": "",
        "description": "Bloomberg TV - global markets, business & finance",
        "duration_seconds": 3600,
    },
    {
        "id": "news_cgtn",
        "title": "CGTN Global News",
        "video_url": "https://news.cgtn.com/resource/live/english/cgtn-news.m3u8",
        "fallback_url": "https://www.youtube.com/embed/z-lPi-5UIoo",
        "category": "NEWS",
        "source": "CGTN",
        "stream_type": "hls",
        "thumbnail": "",
        "description": "CGTN English - 24/7 global news coverage",
        "duration_seconds": 3600,
    },
]

CARIBBEAN_FEEDS = [
    {
        "id": "caribbean_zouk_mix",
        "title": "Zouk Love - Best Of Mix",
        "video_url": "https://www.youtube.com/embed/oC2wRhBJEIQ",
        "category": "CARIBBEAN",
        "source": "Zouk Mix",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Best of Zouk Love mix - Caribbean vibes",
        "duration_seconds": 3600,
    },
    {
        "id": "caribbean_reggae_mix",
        "title": "Reggae Roots & Culture Mix",
        "video_url": "https://www.youtube.com/embed/WXMa3k7TjWI",
        "category": "CARIBBEAN",
        "source": "Reggae Mix",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Reggae roots and culture - island vibes 24/7",
        "duration_seconds": 3600,
    },
    {
        "id": "caribbean_soca_mix",
        "title": "Soca & Carnival Energy Mix",
        "video_url": "https://www.youtube.com/embed/c5GnBpOWemA",
        "category": "CARIBBEAN",
        "source": "Soca Mix",
        "stream_type": "youtube",
        "thumbnail": "",
        "description": "Soca hits - Caribbean carnival energy",
        "duration_seconds": 3600,
    },
]

# ─── 24-Hour Programming Blocks ────────────────────────────────────

PROGRAM_BLOCKS = {
    "Late Night Vibes": {
        "hours": [0, 1, 2],
        "emoji": "🌙",
        "primary": "CARIBBEAN",
        "secondary": "KOMPA",
        "description": "Late night Caribbean vibes - Zouk, Reggae & Kompa"
    },
    "Early Morning News": {
        "hours": [3, 4, 5],
        "emoji": "🌅",
        "primary": "NEWS",
        "secondary": None,
        "description": "Global news - NASA, Sky News, Bloomberg"
    },
    "Morning Kompa": {
        "hours": [6, 7, 8],
        "emoji": "🎵",
        "primary": "KOMPA",
        "secondary": "CARIBBEAN",
        "description": "Start your day with Haitian Kompa - Klass, T-Vice, Harmonik"
    },
    "Mid-Morning Report": {
        "hours": [9, 10, 11],
        "emoji": "📺",
        "primary": "NEWS",
        "secondary": None,
        "description": "Global news coverage - Bloomberg, Sky News AU"
    },
    "Afternoon Hip-Hop": {
        "hours": [12, 13, 14],
        "emoji": "🎤",
        "primary": "HIPHOP",
        "secondary": "KOMPA",
        "description": "Hip-Hop & R&B - Drake, Future, Kendrick Lamar"
    },
    "Caribbean Afternoon": {
        "hours": [15, 16],
        "emoji": "🌴",
        "primary": "CARIBBEAN",
        "secondary": "KOMPA",
        "description": "Caribbean vibes - Zouk, Reggae, Soca"
    },
    "Evening News": {
        "hours": [17, 18],
        "emoji": "📰",
        "primary": "NEWS",
        "secondary": None,
        "description": "Evening news roundup - global coverage"
    },
    "Prime Time Kompa": {
        "hours": [19, 20, 21],
        "emoji": "🔥",
        "primary": "KOMPA",
        "secondary": "HIPHOP",
        "description": "Prime time - Klass, T-Vice, Kai, Harmonik, Nu-Look"
    },
    "Night Session": {
        "hours": [22, 23],
        "emoji": "🎶",
        "primary": "HIPHOP",
        "secondary": "CARIBBEAN",
        "description": "Night session - Hip-Hop, R&B & Caribbean sounds"
    },
}

CATEGORY_MAP = {
    "KOMPA": KOMPA_FEEDS,
    "HIPHOP": HIPHOP_FEEDS,
    "NEWS": NEWS_FEEDS,
    "CARIBBEAN": CARIBBEAN_FEEDS,
}


def generate_clean_schedule():
    """Generate a full 24-hour schedule with 30-minute slots."""

    hour_to_block = {}
    for block_name, block_info in PROGRAM_BLOCKS.items():
        for h in block_info["hours"]:
            hour_to_block[h] = (block_name, block_info)

    schedule = []
    cat_index = {cat: 0 for cat in CATEGORY_MAP}

    for hour in range(24):
        for half in range(2):
            slot_index = hour * 2 + half
            block_name, block_info = hour_to_block.get(hour, ("ZTV Live", {
                "emoji": "📺",
                "primary": "NEWS",
                "secondary": None,
                "description": "ZTV Live programming",
            }))

            primary_cat = block_info.get("primary", "NEWS")
            secondary_cat = block_info.get("secondary")

            if half == 0 or secondary_cat is None:
                use_cat = primary_cat
            else:
                use_cat = secondary_cat

            feeds = CATEGORY_MAP.get(use_cat, NEWS_FEEDS)
            idx = cat_index[use_cat] % len(feeds)
            feed = feeds[idx]
            cat_index[use_cat] = idx + 1

            slot = {
                "slot": slot_index,
                "hour": hour,
                "half": half,
                "start_time": f"{hour:02d}:{half * 30:02d}",
                "end_time": f"{hour:02d}:{(half + 1) * 30:02d}" if half == 0 else f"{(hour + 1) % 24:02d}:00",
                "program_block": block_name,
                "program_emoji": block_info.get("emoji", "📺"),
                "program_description": block_info.get("description", ""),
                "id": feed["id"],
                "title": feed["title"],
                "video_url": feed["video_url"],
                "fallback_url": feed.get("fallback_url", ""),
                "category": feed["category"],
                "source": feed.get("source", "ZTV"),
                "stream_type": feed.get("stream_type", "youtube"),
                "thumbnail": feed.get("thumbnail", ""),
                "description": feed.get("description", ""),
                "duration_seconds": feed.get("duration_seconds", 1800),
            }
            schedule.append(slot)

    seen_ids = set()
    all_feeds = []
    for cat_feeds in CATEGORY_MAP.values():
        for f in cat_feeds:
            if f["id"] not in seen_ids:
                seen_ids.add(f["id"])
                all_feeds.append(f)

    output = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "version": "3.0",
        "total_slots": len(schedule),
        "total_feeds": len(all_feeds),
        "categories": list(CATEGORY_MAP.keys()),
        "program_blocks": {
            name: {
                "hours": info["hours"],
                "emoji": info["emoji"],
                "description": info["description"],
            }
            for name, info in PROGRAM_BLOCKS.items()
        },
        "feeds": all_feeds,
        "schedule": schedule,
    }

    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "..", "data")
    os.makedirs(data_dir, exist_ok=True)
    output_path = os.path.join(data_dir, "clean_schedule.json")

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"✅ Generated 24-hour schedule: {output_path}")
    print(f"   Slots: {len(schedule)} (48 x 30min)")
    print(f"   Feeds: {len(all_feeds)} unique")
    print(f"   Categories: {', '.join(CATEGORY_MAP.keys())}")
    print(f"   Program blocks: {len(PROGRAM_BLOCKS)}")
    for name, info in PROGRAM_BLOCKS.items():
        hours = info["hours"]
        print(f"     {info['emoji']} {name}: {hours[0]:02d}:00-{(hours[-1]+1)%24:02d}:00 → {info['primary']}" +
              (f" + {info.get('secondary', '')}" if info.get("secondary") else ""))

    return output


if __name__ == "__main__":
    generate_clean_schedule()
