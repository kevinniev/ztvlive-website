"""
ZTVLIVE Content Engine
Automated content sourcing and AI-curated programming
"""

import asyncio
import httpx
import random
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import json
import re

NEWS_API_KEY = os.environ.get('ZTV_API_KEY', '')
NEWS_API_BASE_URL = "https://newsapi.org/v2"

# Content categories for 24/7 programming
CONTENT_CATEGORIES = [
    "movies",
    "sports", 
    "buzz",       # Viral content
    "music",
    "news",
    "gaming",
    "tech"
]

# Curated YouTube channels/playlists per category (no API key needed - uses embed URLs)
CURATED_CONTENT = {
    "sports": [
        {
            "id": "sports_1",
            "title": "LeBron James Top 40 Career Plays",
            "video_url": "https://www.youtube.com/embed/-9lP95Qo-I0",
            "thumbnail": "https://i.ytimg.com/vi/-9lP95Qo-I0/maxresdefault.jpg",
            "duration": "10:45",
            "source": "NBA Official",
            "views": 12500000,
            "category": "sports"
        },
        {
            "id": "sports_2", 
            "title": "Lionel Messi All 2024 Goals | Inter Miami",
            "video_url": "https://www.youtube.com/embed/JhWPHsx_h-8",
            "thumbnail": "https://i.ytimg.com/vi/JhWPHsx_h-8/maxresdefault.jpg",
            "duration": "15:30",
            "source": "Inter Miami CF",
            "views": 45000000,
            "category": "sports"
        },
        {
            "id": "sports_3",
            "title": "Top 100 Catches of 2024 NFL Season",
            "video_url": "https://www.youtube.com/embed/7AfEjKekOa0",
            "thumbnail": "https://i.ytimg.com/vi/7AfEjKekOa0/maxresdefault.jpg",
            "duration": "23:45",
            "source": "NFL Official",
            "views": 5200000,
            "category": "sports"
        },
        {
            "id": "sports_4",
            "title": "UFC Top Knockouts of 2024",
            "video_url": "https://www.youtube.com/embed/YfL9L7nH2WI",
            "thumbnail": "https://i.ytimg.com/vi/YfL9L7nH2WI/maxresdefault.jpg",
            "duration": "18:22",
            "source": "UFC",
            "views": 8900000,
            "category": "sports"
        },
        {
            "id": "sports_5",
            "title": "Michael Jordan - His Airness Documentary",
            "video_url": "https://www.youtube.com/embed/5ofWv1DGPSg",
            "thumbnail": "https://i.ytimg.com/vi/5ofWv1DGPSg/maxresdefault.jpg",
            "duration": "1:49:22",
            "source": "Joseph Vincent",
            "views": 8900000,
            "category": "sports"
        }
    ],
    "music": [
        {
            "id": "music_1",
            "title": "Beyoncé - Single Ladies",
            "video_url": "https://www.youtube.com/embed/4m1EFMoRFvY",
            "thumbnail": "https://i.ytimg.com/vi/4m1EFMoRFvY/hqdefault.jpg",
            "duration": "3:15",
            "source": "Beyoncé",
            "views": 350000000,
            "category": "music"
        },
        {
            "id": "music_2",
            "title": "Bruno Mars & Anderson .Paak - Leave The Door Open",
            "video_url": "https://www.youtube.com/embed/adLGHcj_fmA",
            "thumbnail": "https://i.ytimg.com/vi/adLGHcj_fmA/hqdefault.jpg",
            "duration": "4:02",
            "source": "Silk Sonic",
            "views": 780000000,
            "category": "music"
        },
        {
            "id": "music_3",
            "title": "Kendrick Lamar - Not Like Us",
            "video_url": "https://www.youtube.com/embed/T6eK-2OQtew",
            "thumbnail": "https://i.ytimg.com/vi/T6eK-2OQtew/hqdefault.jpg",
            "duration": "4:35",
            "source": "Kendrick Lamar",
            "views": 250000000,
            "category": "music"
        },
        {
            "id": "music_4",
            "title": "Taylor Swift - Anti-Hero (Official Music Video)",
            "video_url": "https://www.youtube.com/embed/b1kbLwvqugk",
            "thumbnail": "https://i.ytimg.com/vi/b1kbLwvqugk/hqdefault.jpg",
            "duration": "3:21",
            "source": "Taylor Swift",
            "views": 650000000,
            "category": "music"
        },
        {
            "id": "music_5",
            "title": "Doja Cat - Paint The Town Red",
            "video_url": "https://www.youtube.com/embed/m4_9TFeMfJE",
            "thumbnail": "https://i.ytimg.com/vi/m4_9TFeMfJE/hqdefault.jpg",
            "duration": "3:51",
            "source": "Doja Cat",
            "views": 450000000,
            "category": "music"
        }
    ],
    "movies": [
        {
            "id": "movies_1",
            "title": "Dune Part Two - Official Trailer",
            "video_url": "https://www.youtube.com/embed/Way9Dexny3w",
            "thumbnail": "https://i.ytimg.com/vi/Way9Dexny3w/maxresdefault.jpg",
            "duration": "3:01",
            "source": "Warner Bros",
            "views": 45000000,
            "category": "movies"
        },
        {
            "id": "movies_2",
            "title": "Oppenheimer - Official Trailer",
            "video_url": "https://www.youtube.com/embed/uYPbbksJxIg",
            "thumbnail": "https://i.ytimg.com/vi/uYPbbksJxIg/maxresdefault.jpg",
            "duration": "3:28",
            "source": "Universal Pictures",
            "views": 65000000,
            "category": "movies"
        },
        {
            "id": "movies_3",
            "title": "Deadpool & Wolverine - Official Trailer",
            "video_url": "https://www.youtube.com/embed/73_1biulkYk",
            "thumbnail": "https://i.ytimg.com/vi/73_1biulkYk/maxresdefault.jpg",
            "duration": "2:42",
            "source": "Marvel",
            "views": 120000000,
            "category": "movies"
        },
        {
            "id": "movies_4",
            "title": "Inside Out 2 - Official Trailer",
            "video_url": "https://www.youtube.com/embed/LEjhY15eCx0",
            "thumbnail": "https://i.ytimg.com/vi/LEjhY15eCx0/maxresdefault.jpg",
            "duration": "2:18",
            "source": "Pixar",
            "views": 85000000,
            "category": "movies"
        },
        {
            "id": "movies_5",
            "title": "Gladiator II - Official Trailer",
            "video_url": "https://www.youtube.com/embed/4rgYUipGJNo",
            "thumbnail": "https://i.ytimg.com/vi/4rgYUipGJNo/maxresdefault.jpg",
            "duration": "2:54",
            "source": "Paramount",
            "views": 35000000,
            "category": "movies"
        }
    ],
    "buzz": [
        {
            "id": "buzz_1",
            "title": "Katt Williams FULL Interview - Club Shay Shay",
            "video_url": "https://www.youtube.com/embed/8oRRZiRQxTs",
            "thumbnail": "https://i.ytimg.com/vi/8oRRZiRQxTs/hqdefault.jpg",
            "duration": "2:45:30",
            "source": "Club Shay Shay",
            "views": 91000000,
            "category": "buzz"
        },
        {
            "id": "buzz_2",
            "title": "Joe Rogan Experience - Elon Musk",
            "video_url": "https://www.youtube.com/embed/O4wBUysNe2k",
            "thumbnail": "https://i.ytimg.com/vi/O4wBUysNe2k/hqdefault.jpg",
            "duration": "2:58:20",
            "source": "JRE",
            "views": 42000000,
            "category": "buzz"
        },
        {
            "id": "buzz_3",
            "title": "Internet's Most Viral Moments 2024",
            "video_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            "duration": "15:00",
            "source": "Viral Videos",
            "views": 28000000,
            "category": "buzz"
        },
        {
            "id": "buzz_4",
            "title": "Drink Champs - 50 Cent Full Episode",
            "video_url": "https://www.youtube.com/embed/yir4GNA52xE",
            "thumbnail": "https://i.ytimg.com/vi/yir4GNA52xE/hqdefault.jpg",
            "duration": "1:13:26",
            "source": "Drink Champs",
            "views": 8500000,
            "category": "buzz"
        },
        {
            "id": "buzz_5",
            "title": "Celebrity Interviews Compilation",
            "video_url": "https://www.youtube.com/embed/W6oQUDFV2C0",
            "thumbnail": "https://i.ytimg.com/vi/W6oQUDFV2C0/hqdefault.jpg",
            "duration": "8:45",
            "source": "Entertainment Tonight",
            "views": 15000000,
            "category": "buzz"
        }
    ],
    "news": [
        {
            "id": "news_1",
            "title": "World News Tonight - Latest Headlines",
            "video_url": "https://www.youtube.com/embed/w_Ma8oQLmSM",
            "thumbnail": "https://i.ytimg.com/vi/w_Ma8oQLmSM/hqdefault.jpg",
            "duration": "30:00",
            "source": "ABC News",
            "views": 5000000,
            "category": "news"
        },
        {
            "id": "news_2",
            "title": "Tech News - AI Revolution Continues",
            "video_url": "https://www.youtube.com/embed/aircAruvnKk",
            "thumbnail": "https://i.ytimg.com/vi/aircAruvnKk/hqdefault.jpg",
            "duration": "18:15",
            "source": "3Blue1Brown",
            "views": 12000000,
            "category": "news"
        },
        {
            "id": "news_3",
            "title": "Business News & Market Updates",
            "video_url": "https://www.youtube.com/embed/PHe0bXAIuk0",
            "thumbnail": "https://i.ytimg.com/vi/PHe0bXAIuk0/hqdefault.jpg",
            "duration": "22:00",
            "source": "Bloomberg",
            "views": 3500000,
            "category": "news"
        }
    ],
    "gaming": [
        {
            "id": "gaming_1",
            "title": "GTA 6 Official Trailer",
            "video_url": "https://www.youtube.com/embed/QdBZY2fkU-0",
            "thumbnail": "https://i.ytimg.com/vi/QdBZY2fkU-0/hqdefault.jpg",
            "duration": "1:31",
            "source": "Rockstar Games",
            "views": 210000000,
            "category": "gaming"
        },
        {
            "id": "gaming_2",
            "title": "Best Game Trailers 2024 Compilation",
            "video_url": "https://www.youtube.com/embed/K0u_kAWLJOA",
            "thumbnail": "https://i.ytimg.com/vi/K0u_kAWLJOA/hqdefault.jpg",
            "duration": "25:45",
            "source": "IGN",
            "views": 15000000,
            "category": "gaming"
        },
        {
            "id": "gaming_3",
            "title": "Epic Gaming Moments Compilation",
            "video_url": "https://www.youtube.com/embed/BTPZ8lkR5YU",
            "thumbnail": "https://i.ytimg.com/vi/BTPZ8lkR5YU/hqdefault.jpg",
            "duration": "25:00",
            "source": "Gaming Highlights",
            "views": 8000000,
            "category": "gaming"
        },
        {
            "id": "gaming_4",
            "title": "Speedrun World Records 2024",
            "video_url": "https://www.youtube.com/embed/0mAnZGyQ-U4",
            "thumbnail": "https://i.ytimg.com/vi/0mAnZGyQ-U4/hqdefault.jpg",
            "duration": "35:12",
            "source": "SummoningSalt",
            "views": 45000000,
            "category": "gaming"
        }
    ],
    "tech": [
        {
            "id": "tech_1",
            "title": "Apple Vision Pro Review",
            "video_url": "https://www.youtube.com/embed/OFvXuyITwBI",
            "thumbnail": "https://i.ytimg.com/vi/OFvXuyITwBI/hqdefault.jpg",
            "duration": "28:45",
            "source": "MKBHD",
            "views": 18000000,
            "category": "tech"
        },
        {
            "id": "tech_2",
            "title": "AI Explained Simply",
            "video_url": "https://www.youtube.com/embed/JTxsNm9IdYU",
            "thumbnail": "https://i.ytimg.com/vi/JTxsNm9IdYU/hqdefault.jpg",
            "duration": "15:30",
            "source": "Fireship",
            "views": 8500000,
            "category": "tech"
        },
        {
            "id": "tech_3",
            "title": "Best Gadgets 2024",
            "video_url": "https://www.youtube.com/embed/VN4Mx5ePIao",
            "thumbnail": "https://i.ytimg.com/vi/VN4Mx5ePIao/hqdefault.jpg",
            "duration": "22:15",
            "source": "The Verge",
            "views": 5200000,
            "category": "tech"
        }
    ]
}

# AI-curated schedule pattern (hour -> category)
# This creates variety throughout the day
SCHEDULE_PATTERN = {
    0: "movies",
    1: "movies",
    2: "buzz",
    3: "music",
    4: "music",
    5: "news",
    6: "news",
    7: "sports",
    8: "sports",
    9: "tech",
    10: "buzz",
    11: "gaming",
    12: "movies",
    13: "sports",
    14: "music",
    15: "buzz",
    16: "news",
    17: "gaming",
    18: "sports",
    19: "movies",
    20: "music",
    21: "buzz",
    22: "tech",
    23: "movies"
}


# News headlines cache
_news_cache: Dict[str, Dict] = {}
_NEWS_CACHE_TTL_MINUTES = 60  # Cache for 1 hour to reduce API calls

async def fetch_news_headlines(category: str = "general", count: int = 10) -> List[Dict]:
    """Fetch real news headlines from NewsAPI with caching"""
    global _news_cache
    
    cache_key = f"{category}_{count}"
    now = datetime.now(timezone.utc)
    
    # Check cache first
    if cache_key in _news_cache:
        cached = _news_cache[cache_key]
        cache_age = (now - cached["timestamp"]).total_seconds() / 60
        if cache_age < _NEWS_CACHE_TTL_MINUTES:
            print(f"Using cached news headlines for {category} (age: {cache_age:.1f} min)")
            return cached["headlines"]
    
    if not NEWS_API_KEY:
        return get_fallback_news()
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NEWS_API_BASE_URL}/top-headlines",
                params={
                    "apiKey": NEWS_API_KEY,
                    "country": "us",
                    "category": category,
                    "pageSize": count
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                articles = data.get("articles", [])
                headlines = [
                    {
                        "headline": article.get("title", ""),
                        "source": article.get("source", {}).get("name", "News"),
                        "url": article.get("url", ""),
                        "publishedAt": article.get("publishedAt", "")
                    }
                    for article in articles if article.get("title")
                ]
                
                # Cache the results
                _news_cache[cache_key] = {
                    "headlines": headlines,
                    "timestamp": now
                }
                print(f"Fetched and cached {len(headlines)} headlines for {category}")
                return headlines
            elif response.status_code == 429:
                # Rate limited - use cached data if available, otherwise fallback
                print("NewsAPI rate limited, using cached/fallback data")
                if cache_key in _news_cache:
                    return _news_cache[cache_key]["headlines"]
                return get_fallback_news()
    except Exception as e:
        print(f"Error fetching news: {e}")
    
    # Return cached data if available, even if expired
    if cache_key in _news_cache:
        return _news_cache[cache_key]["headlines"]
    
    return get_fallback_news()


def get_fallback_news() -> List[Dict]:
    """Fallback news when API is unavailable - rotates to feel dynamic"""
    # Multiple sets of fallback headlines that rotate hourly
    all_fallback_headlines = [
        [
            {"headline": "Breaking: Major developments in global markets today", "source": "ZTVLIVE News"},
            {"headline": "Tech giants announce new AI partnerships", "source": "ZTVLIVE Tech"},
            {"headline": "Sports: Championship finals draw record viewership", "source": "ZTVLIVE Sports"},
            {"headline": "Entertainment: Award season buzz begins", "source": "ZTVLIVE Entertainment"},
            {"headline": "Weather alert: Storm systems moving across regions", "source": "ZTVLIVE Weather"}
        ],
        [
            {"headline": "World leaders meet to discuss economic strategies", "source": "ZTVLIVE World"},
            {"headline": "New smartphone features unveiled at tech expo", "source": "ZTVLIVE Tech"},
            {"headline": "Historic championship game breaks streaming records", "source": "ZTVLIVE Sports"},
            {"headline": "Hollywood blockbuster exceeds box office expectations", "source": "ZTVLIVE Movies"},
            {"headline": "Global markets react to economic data releases", "source": "ZTVLIVE Finance"}
        ],
        [
            {"headline": "Scientists make breakthrough discovery in climate research", "source": "ZTVLIVE Science"},
            {"headline": "Music industry celebrates streaming milestones", "source": "ZTVLIVE Music"},
            {"headline": "Travel industry sees record summer bookings", "source": "ZTVLIVE Travel"},
            {"headline": "Gaming industry announces major upcoming releases", "source": "ZTVLIVE Gaming"},
            {"headline": "Health experts share new wellness recommendations", "source": "ZTVLIVE Health"}
        ],
        [
            {"headline": "Electric vehicle sales surge to new highs", "source": "ZTVLIVE Auto"},
            {"headline": "International film festival announces winners", "source": "ZTVLIVE Entertainment"},
            {"headline": "Startup ecosystem shows record investment growth", "source": "ZTVLIVE Business"},
            {"headline": "Popular streaming series breaks viewing records", "source": "ZTVLIVE TV"},
            {"headline": "Sports teams prepare for upcoming championship", "source": "ZTVLIVE Sports"}
        ]
    ]
    
    # Rotate based on current hour
    hour = datetime.now(timezone.utc).hour
    index = hour % len(all_fallback_headlines)
    return all_fallback_headlines[index]


def get_category_for_hour(hour: int) -> str:
    """Get the scheduled category for a given hour (MST)"""
    return SCHEDULE_PATTERN.get(hour % 24, "buzz")


def get_content_for_category(category: str) -> List[Dict]:
    """Get all content for a specific category"""
    return CURATED_CONTENT.get(category, CURATED_CONTENT.get("buzz", []))


def get_content_for_slot(slot_hour: int, seed_date: str = None) -> Dict:
    """Get content for a specific time slot with variety"""
    category = get_category_for_hour(slot_hour)
    content_list = get_content_for_category(category)
    
    if not content_list:
        content_list = CURATED_CONTENT.get("buzz", [])
    
    # Use date seed for consistent daily selection but variety across hours
    if seed_date:
        day_seed = hash(seed_date)
    else:
        day_seed = hash(datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    
    # Select content based on hour and day
    content_index = (slot_hour + day_seed) % len(content_list)
    content = content_list[content_index].copy()
    content["scheduled_category"] = category
    
    return content


def generate_24hr_schedule(base_date: datetime = None) -> List[Dict]:
    """Generate a full 24-hour schedule with AI-curated content mix"""
    if base_date is None:
        base_date = datetime.now(timezone.utc)
    
    date_str = base_date.strftime("%Y-%m-%d")
    schedule = []
    
    for hour in range(24):
        content = get_content_for_slot(hour, date_str)
        
        slot = {
            "id": f"slot_{date_str}_{hour:02d}",
            "slot_index": hour,
            "slot_date": date_str,
            "start_time": f"{hour:02d}:00",
            "end_time": f"{(hour + 1) % 24:02d}:00",
            "scheduled_category": content.get("scheduled_category", "buzz"),
            "content": content,
            "is_current": False,
            "is_upcoming": False
        }
        
        schedule.append(slot)
    
    # Mark current and upcoming
    current_hour = base_date.hour
    for slot in schedule:
        if slot["slot_index"] == current_hour:
            slot["is_current"] = True
        elif slot["slot_index"] == (current_hour + 1) % 24:
            slot["is_upcoming"] = True
    
    return schedule


def get_current_programming() -> Dict:
    """Get what's currently playing based on time"""
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    
    content = get_content_for_slot(current_hour)
    next_content = get_content_for_slot((current_hour + 1) % 24)
    
    return {
        "current": content,
        "next_up": next_content,
        "current_hour": current_hour,
        "category": content.get("scheduled_category", "buzz")
    }


def get_all_categories() -> List[Dict]:
    """Get all available categories with content counts"""
    return [
        {
            "id": cat,
            "name": cat.title(),
            "content_count": len(CURATED_CONTENT.get(cat, [])),
            "color": get_category_color(cat)
        }
        for cat in CONTENT_CATEGORIES
    ]


def get_category_color(category: str) -> str:
    """Get color for category badge"""
    colors = {
        "sports": "#f97316",
        "music": "#d946ef", 
        "movies": "#ec4899",
        "buzz": "#ef4444",
        "news": "#eab308",
        "gaming": "#22c55e",
        "tech": "#06b6d4"
    }
    return colors.get(category, "#8b5cf6")
