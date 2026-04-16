"""
ZTVLIVE Roku Content Feed API
================================
Provides Roku-compatible JSON feed for native BrightScript channels.
Follows Roku Direct Publisher Feed Specification.
"""

from fastapi import APIRouter
from datetime import datetime, timezone
from typing import List, Dict, Any

roku_feed_router = APIRouter(prefix="/api/roku-feed", tags=["Roku Feed"])

# Content library for Roku
ROKU_CONTENT_LIBRARY = {
    "sports": [
        {"id": "sp1", "title": "Super Bowl 2026 Highlights", "duration": 900, "thumbnail": "https://images.unsplash.com/photo-1461896836934-bd45ba7ad42d?w=600", "views": "45M"},
        {"id": "sp2", "title": "NBA Finals Game 7", "duration": 9900, "thumbnail": "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600", "views": "18M"},
        {"id": "sp3", "title": "UFC 310 Main Event", "duration": 2100, "thumbnail": "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600", "views": "8M"},
    ],
    "music": [
        {"id": "mu1", "title": "Calm Down - Live Performance", "duration": 320, "thumbnail": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600", "views": "12M"},
        {"id": "mu2", "title": "Summer Fest 2026 Live", "duration": 0, "is_live": True, "thumbnail": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600", "views": "2.4K live"},
        {"id": "mu3", "title": "Indie Music Sessions", "duration": 2700, "thumbnail": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600", "views": "890K"},
    ],
    "gaming": [
        {"id": "gm1", "title": "GTA 6 Deep Dive", "duration": 1500, "thumbnail": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600", "views": "50M"},
        {"id": "gm2", "title": "Esports Championship", "duration": 0, "is_live": True, "thumbnail": "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600", "views": "15K live"},
        {"id": "gm3", "title": "Fortnite Season 12", "duration": 1800, "thumbnail": "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600", "views": "8M"},
    ],
    "film": [
        {"id": "fl1", "title": "Avengers: Doomsday BTS", "duration": 1500, "thumbnail": "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=600", "views": "18M"},
        {"id": "fl2", "title": "Ocean Depths Documentary", "duration": 3120, "thumbnail": "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600", "views": "5.6M"},
        {"id": "fl3", "title": "Sci-Fi Short Films", "duration": 4800, "thumbnail": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600", "views": "3.8M"},
    ],
    "tech": [
        {"id": "tc1", "title": "AI Revolution 2026", "duration": 2400, "thumbnail": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600", "views": "8M"},
    ],
    "podcasts": [
        {"id": "pd1", "title": "The Creator Economy Show", "duration": 3900, "thumbnail": "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600", "views": "2M"},
        {"id": "pd2", "title": "Startup Stories Podcast", "duration": 2880, "thumbnail": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600", "views": "1.5M"},
    ],
    "live": [
        {"id": "lv1", "title": "ZTVLIVE 24/7 Stream", "duration": 0, "is_live": True, "thumbnail": "https://images.unsplash.com/photo-1478147427282-58a87a120781?w=600", "views": "1.2K live", "stream_url": "https://www.ztvlivestream.com/api/stream/live"},
    ],
}

# Game questions for the survey game
GAME_QUESTIONS = [
    {"id": 1, "question": "What is the most popular streaming platform?", "answers": [{"text": "Netflix", "pct": 35}, {"text": "YouTube", "pct": 28}, {"text": "Disney+", "pct": 20}, {"text": "Amazon Prime", "pct": 17}]},
    {"id": 2, "question": "Which social media app has the most users worldwide?", "answers": [{"text": "Facebook", "pct": 40}, {"text": "YouTube", "pct": 30}, {"text": "WhatsApp", "pct": 18}, {"text": "Instagram", "pct": 12}]},
    {"id": 3, "question": "What is the best-selling video game console of all time?", "answers": [{"text": "PlayStation 2", "pct": 45}, {"text": "Nintendo DS", "pct": 25}, {"text": "Nintendo Switch", "pct": 18}, {"text": "Game Boy", "pct": 12}]},
    {"id": 4, "question": "Which country has won the most FIFA World Cups?", "answers": [{"text": "Brazil", "pct": 50}, {"text": "Germany", "pct": 22}, {"text": "Italy", "pct": 15}, {"text": "Argentina", "pct": 13}]},
    {"id": 5, "question": "What is the most watched TV show of all time?", "answers": [{"text": "Game of Thrones", "pct": 35}, {"text": "Breaking Bad", "pct": 25}, {"text": "The Office", "pct": 22}, {"text": "Friends", "pct": 18}]},
    {"id": 6, "question": "Which planet is known as the Red Planet?", "answers": [{"text": "Mars", "pct": 85}, {"text": "Jupiter", "pct": 8}, {"text": "Venus", "pct": 5}, {"text": "Saturn", "pct": 2}]},
    {"id": 7, "question": "What is the capital of Australia?", "answers": [{"text": "Canberra", "pct": 45}, {"text": "Sydney", "pct": 35}, {"text": "Melbourne", "pct": 15}, {"text": "Brisbane", "pct": 5}]},
    {"id": 8, "question": "Who painted the Mona Lisa?", "answers": [{"text": "Leonardo da Vinci", "pct": 80}, {"text": "Michelangelo", "pct": 12}, {"text": "Raphael", "pct": 5}, {"text": "Picasso", "pct": 3}]},
    {"id": 9, "question": "What is the largest ocean on Earth?", "answers": [{"text": "Pacific", "pct": 75}, {"text": "Atlantic", "pct": 15}, {"text": "Indian", "pct": 7}, {"text": "Arctic", "pct": 3}]},
    {"id": 10, "question": "Which element has the chemical symbol 'Au'?", "answers": [{"text": "Gold", "pct": 70}, {"text": "Silver", "pct": 18}, {"text": "Copper", "pct": 8}, {"text": "Aluminum", "pct": 4}]},
]

@roku_feed_router.get("/")
async def get_roku_feed():
    """
    Main Roku JSON Feed - follows Roku Direct Publisher specification.
    BrightScript developers can pull this feed for native channel content.
    """
    return {
        "providerName": "ZTVLIVE",
        "language": "en",
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "version": "6.0.2",
        "feed_url": "https://www.ztvlivestream.com/api/roku-feed/",
        "categories": list(ROKU_CONTENT_LIBRARY.keys()),
        "shortFormVideos": get_all_content(),
        "liveFeeds": get_live_feeds(),
        "playlists": get_playlists(),
    }


@roku_feed_router.get("/content")
async def get_all_roku_content():
    """Get all content items for Roku channel"""
    return {
        "success": True,
        "content": get_all_content(),
        "total": sum(len(v) for v in ROKU_CONTENT_LIBRARY.values()),
        "categories": list(ROKU_CONTENT_LIBRARY.keys()),
    }


@roku_feed_router.get("/content/{category}")
async def get_roku_content_by_category(category: str):
    """Get content by category for Roku channel"""
    if category not in ROKU_CONTENT_LIBRARY and category != "all":
        return {"success": False, "error": f"Category '{category}' not found"}
    
    if category == "all":
        items = get_all_content()
    else:
        items = format_content_items(ROKU_CONTENT_LIBRARY.get(category, []), category)
    
    return {
        "success": True,
        "category": category,
        "content": items,
        "total": len(items),
    }


@roku_feed_router.get("/live")
async def get_roku_live_streams():
    """Get all live streams for Roku channel"""
    return {
        "success": True,
        "liveFeeds": get_live_feeds(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@roku_feed_router.get("/game/state")
async def get_roku_game_state():
    """Get current game state for Roku survey game"""
    import random
    current_q = random.randint(0, len(GAME_QUESTIONS) - 1)
    question = GAME_QUESTIONS[current_q]
    
    return {
        "success": True,
        "phase": "question",
        "question_number": current_q + 1,
        "total_questions": len(GAME_QUESTIONS),
        "question": question["question"],
        "countdown": 50,
        "players_count": random.randint(100, 500),
        "top_answers": question["answers"],
    }


@roku_feed_router.get("/game/questions")
async def get_roku_game_questions():
    """Get all game questions for Roku survey game"""
    return {
        "success": True,
        "questions": GAME_QUESTIONS,
        "total": len(GAME_QUESTIONS),
        "countdown_seconds": 50,
    }


@roku_feed_router.get("/schedule")
async def get_roku_schedule():
    """Get weekly schedule for Roku channel"""
    return {
        "success": True,
        "schedule": [
            {"time": "6:00 AM - 12:00 PM", "title": "Morning Show", "description": "Live Stream", "is_live": True},
            {"time": "12:00 PM - 6:00 PM", "title": "Afternoon Entertainment", "description": "Game Show"},
            {"time": "6:00 PM - 12:00 AM", "title": "Prime Time", "description": "Special Events"},
            {"time": "12:00 AM - 6:00 AM", "title": "Late Night", "description": "Replays"},
        ],
        "timezone": "America/New_York",
    }


@roku_feed_router.get("/mrss")
async def get_roku_mrss_feed():
    """Get MRSS (Media RSS) feed for Roku channel"""
    items = get_all_content()
    
    mrss = '<?xml version="1.0" encoding="UTF-8"?>\n'
    mrss += '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">\n'
    mrss += '<channel>\n'
    mrss += '<title>ZTVLIVE</title>\n'
    mrss += '<link>https://www.ztvlivestream.com</link>\n'
    mrss += '<description>24/7 Live Streaming and Unusual Fun Game Show</description>\n'
    
    for item in items[:20]:  # Limit to 20 items
        mrss += '<item>\n'
        mrss += f'  <title>{item["title"]}</title>\n'
        mrss += f'  <guid>{item["id"]}</guid>\n'
        mrss += f'  <media:thumbnail url="{item["thumbnail"]["url"]}" />\n'
        mrss += f'  <media:content duration="{item.get("duration", 0)}" />\n'
        mrss += '</item>\n'
    
    mrss += '</channel>\n'
    mrss += '</rss>'
    
    return {"mrss": mrss}


# Helper functions
def get_all_content() -> List[Dict]:
    """Get all content formatted for Roku feed"""
    all_items = []
    for category, items in ROKU_CONTENT_LIBRARY.items():
        all_items.extend(format_content_items(items, category))
    return all_items


def format_content_items(items: List[Dict], category: str) -> List[Dict]:
    """Format content items to Roku specification"""
    formatted = []
    for item in items:
        formatted.append({
            "id": item["id"],
            "title": item["title"],
            "shortDescription": f"{category.capitalize()} content on ZTVLIVE",
            "thumbnail": {
                "url": item["thumbnail"],
                "width": 600,
                "height": 338,
            },
            "genres": [category.capitalize()],
            "tags": ["ZTVLIVE", category],
            "releaseDate": "2026-01-01",
            "duration": item.get("duration", 0),
            "views": item.get("views", "0"),
            "isLive": item.get("is_live", False),
            "streamUrl": item.get("stream_url", ""),
            "content": {
                "dateAdded": datetime.now(timezone.utc).isoformat(),
                "videos": [{
                    "url": item.get("stream_url", f"https://www.ztvlivestream.com/api/stream/{item['id']}"),
                    "quality": "HD",
                    "videoType": "HLS" if item.get("is_live") else "MP4",
                }],
            },
        })
    return formatted


def get_live_feeds() -> List[Dict]:
    """Get all live feeds for Roku"""
    live_items = []
    for category, items in ROKU_CONTENT_LIBRARY.items():
        for item in items:
            if item.get("is_live"):
                live_items.append({
                    "id": item["id"],
                    "title": item["title"],
                    "thumbnail": item["thumbnail"],
                    "category": category,
                    "viewers": item.get("views", "0"),
                    "streamUrl": item.get("stream_url", f"https://www.ztvlivestream.com/api/stream/{item['id']}"),
                })
    return live_items


def get_playlists() -> List[Dict]:
    """Get playlists for Roku channel"""
    return [
        {
            "name": "Trending Now",
            "itemIds": ["sp1", "mu1", "gm1", "fl1", "tc1"],
        },
        {
            "name": "Live Now",
            "itemIds": ["lv1", "mu2", "gm2"],
        },
        {
            "name": "Sports",
            "itemIds": ["sp1", "sp2", "sp3"],
        },
        {
            "name": "Music",
            "itemIds": ["mu1", "mu2", "mu3"],
        },
        {
            "name": "Gaming",
            "itemIds": ["gm1", "gm2", "gm3"],
        },
    ]
