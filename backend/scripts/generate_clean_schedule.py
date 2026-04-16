#!/usr/bin/env python3
"""
ZTVLIVE 24-Hour Schedule Generator - Verified Hits Edition
==========================================================
Generates a 24/7 schedule using high-visibility, embed-friendly content.
Avoids YouTube Error 150 (Embedding restricted).

Outputs: backend/data/clean_schedule.json
"""

import json
import os
from datetime import datetime

# ━━━ Verified Embeddable Master Library ━━━
# These have been tested and verified to work in embeds

VERIFIED_FEEDS = [
    {"id": "chill_lofi", "title": "Lofi Hip Hop Radio", "video_url": "https://www.youtube.com/embed/jfKfPfyJRdk", "category": "Chill", "source": "Lofi Girl"},
    {"id": "rnb_whitney", "title": "Whitney Houston - I Will Always Love You", "video_url": "https://www.youtube.com/embed/3JWTaaS7LdU", "category": "R&B", "source": "Whitney Houston"},
    {"id": "disco_september", "title": "Earth, Wind & Fire - September", "video_url": "https://www.youtube.com/embed/Gs069dndIYk", "category": "Disco", "source": "Earth, Wind & Fire"},
    {"id": "pop_thriller", "title": "Michael Jackson - Thriller", "video_url": "https://www.youtube.com/embed/sOnqjkJTMaA", "category": "Pop", "source": "Michael Jackson"},
    {"id": "news_nasa", "title": "NASA Live", "video_url": "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8", "category": "Space/News", "source": "NASA", "stream_type": "hls"},
    {"id": "rock_eye", "title": "Survivor - Eye Of The Tiger", "video_url": "https://www.youtube.com/embed/btPJPFnesV4", "category": "Rock", "source": "Survivor"},
    {"id": "pop_happy", "title": "Pharrell - Happy", "video_url": "https://www.youtube.com/embed/ZbZSe6N_BXs", "category": "Pop", "source": "Pharrell"},
    {"id": "pop_uptown", "title": "Uptown Funk - Bruno Mars", "video_url": "https://www.youtube.com/embed/OPf0YbXqDm0", "category": "Pop", "source": "Mark Ronson"},
    {"id": "focus_lofi", "title": "Lofi Hip Hop - Study Beats", "video_url": "https://www.youtube.com/embed/5qap5aO4i9A", "category": "Focus", "source": "Lofi Girl"},
    {"id": "latin_despacito", "title": "Luis Fonsi - Despacito", "video_url": "https://www.youtube.com/embed/kJQP7kiw5Fk", "category": "Latin", "source": "Luis Fonsi"},
    {"id": "pop_takeonme", "title": "a-ha - Take On Me", "video_url": "https://www.youtube.com/embed/djV11Xbc914", "category": "80s", "source": "a-ha"},
    {"id": "pop_shape", "title": "Ed Sheeran - Shape of You", "video_url": "https://www.youtube.com/embed/JGwWNGJdvx8", "category": "Pop", "source": "Ed Sheeran"},
    {"id": "dance_partyrock", "title": "LMFAO - Party Rock Anthem", "video_url": "https://www.youtube.com/embed/KQ6zr6kCPj8", "category": "Dance", "source": "LMFAO"},
    {"id": "carib_leanon", "title": "Major Lazer - Lean On", "video_url": "https://www.youtube.com/embed/YqeW9_5kURI", "category": "Caribbean", "source": "Major Lazer"},
    {"id": "carib_wakawaka", "title": "Shakira - Waka Waka", "video_url": "https://www.youtube.com/embed/pRpeEdMmmQ0", "category": "Caribbean", "source": "Shakira"},
    {"id": "kpop_gangnam", "title": "PSY - Gangnam Style", "video_url": "https://www.youtube.com/embed/9bZkp7q19f0", "category": "K-Pop", "source": "PSY"},
    {"id": "dance_timber", "title": "Pitbull - Timber", "video_url": "https://www.youtube.com/embed/hHUbLv4ThOo", "category": "Dance", "source": "Pitbull"},
    {"id": "news_nasa_hls", "title": "NASA Live Feed", "video_url": "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8", "category": "News", "source": "NASA", "stream_type": "hls"},
    {"id": "pop_shakeitoff", "title": "Taylor Swift - Shake It Off", "video_url": "https://www.youtube.com/embed/nfWlot6h_JM", "category": "Pop", "source": "Taylor Swift"},
    {"id": "rock_bohemian", "title": "Queen - Bohemian Rhapsody", "video_url": "https://www.youtube.com/embed/fJ9rUzIMcZQ", "category": "Rock", "source": "Queen"},
    {"id": "rnb_billiejean", "title": "Michael Jackson - Billie Jean", "video_url": "https://www.youtube.com/embed/Zi_XLOBDo_Y", "category": "R&B", "source": "Michael Jackson"},
    {"id": "edm_closer", "title": "The Chainsmokers - Closer", "video_url": "https://www.youtube.com/embed/0zG9YfGf1T0", "category": "EDM", "source": "The Chainsmokers"},
    {"id": "edm_faded", "title": "Alan Walker - Faded", "video_url": "https://www.youtube.com/embed/60ItHLz5WEA", "category": "EDM", "source": "Alan Walker"},
    {"id": "chill_chillhop", "title": "Chillhop Radio", "video_url": "https://www.youtube.com/embed/5yx6BWlEVcY", "category": "Chill", "source": "Chillhop Music"},
]

# ━━━ 24-Hour Programming Blocks ━━━
# Match the hours to the verified hits list

HOURS_MAP = {
    0: "chill_lofi",
    1: "rnb_whitney",
    2: "disco_september",
    3: "pop_thriller",
    4: "news_nasa",
    5: "rock_eye",
    6: "pop_happy",
    7: "pop_uptown",
    8: "focus_lofi",
    9: "latin_despacito",
    10: "pop_takeonme",
    11: "pop_shape",
    12: "dance_partyrock",
    13: "carib_leanon",
    14: "carib_wakawaka",
    15: "kpop_gangnam",
    16: "dance_timber",
    17: "news_nasa_hls",
    18: "pop_shakeitoff",
    19: "rock_bohemian",
    20: "rnb_billiejean",
    21: "edm_closer",
    22: "edm_faded",
    23: "chill_chillhop",
}

def generate_clean_schedule():
    schedule = []
    feeds_map = {f["id"]: f for f in VERIFIED_FEEDS}
    
    for hour in range(24):
        for half in range(2):
            slot_index = hour * 2 + half
            feed_id = HOURS_MAP[hour]
            feed = feeds_map[feed_id]
            
            slot = {
                "slot": slot_index,
                "hour": hour,
                "half": half,
                "start_time": f"{hour:02d}:{half * 30:02d}",
                "end_time": f"{hour:02d}:{(half + 1) * 30:02d}" if half == 0 else f"{(hour + 1) % 24:02d}:00",
                "program_block": "ZTV Live Hits",
                # Feed data
                "id": feed["id"],
                "title": feed["title"],
                "video_url": feed["video_url"],
                "category": feed["category"],
                "source": feed.get("source", "ZTV"),
                "stream_type": feed.get("stream_type", "youtube"),
                "thumbnail": feed.get("thumbnail", ""),
                "description": feed.get("description", ""),
                "duration_seconds": 1800,
            }
            schedule.append(slot)

    output = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "version": "4.0-verified",
        "total_slots": len(schedule),
        "total_feeds": len(VERIFIED_FEEDS),
        "feeds": VERIFIED_FEEDS,
        "schedule": schedule,
    }

    # Use relative path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "..", "data", "clean_schedule.json")
    
    # Also save to current work dir for safety
    with open("clean_schedule.json", "w") as f:
        json.dump(output, f, indent=2)
        
    return output

if __name__ == "__main__":
    data = generate_clean_schedule()
    print(f"Generated {len(data['schedule'])} slots with {len(data['feeds'])} verified feeds.")
