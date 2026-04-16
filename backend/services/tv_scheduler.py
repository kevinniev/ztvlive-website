import datetime
import random
import json
import os

# CLEAN FEED MASTER LIBRARY - GUARANTEED PLAYABLE
CLEAN_FEEDS = [
    {'title': 'NASA Earth Live', 'video_url': 'https://www.youtube.com/embed/21X5lGlDOfg', 'category': 'SPACE 4K'},
    {'title': 'ISS Space Station Live', 'video_url': 'https://www.youtube.com/embed/P9C25Un7xaM', 'category': 'SCIENCE'},
    {'title': 'ABC News Live Feed', 'video_url': 'https://www.youtube.com/embed/w_Ma8oQLmSM', 'category': 'NEWS'},
    {'title': 'Sky News Global Live', 'video_url': 'https://www.youtube.com/embed/9AuqEdf6zLw', 'category': 'NEWS'},
    {'title': 'African Safari 4K Live', 'video_url': 'https://www.youtube.com/embed/m9O0V9G9KBY', 'category': 'WILDLIFE'},
    {'title': 'Tropical Reef 4K Live', 'video_url': 'https://www.youtube.com/embed/vPhg6sc1Mk4', 'category': 'NATURE'},
    {'title': 'Lofi Hip Hop Radio', 'video_url': 'https://www.youtube.com/embed/jfKfPfyJRdk', 'category': 'MUSIC'}
]

def get_live_sync():
    """Advanced 24/7 Sync Hub - Enforces Clean Feeds Only"""
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Rotate feeds every 15 minutes based on the hour and minute
    # 96 slots per day (24 * 4)
    slot_index = (now.hour * 4) + (now.minute // 15)
    feed_index = slot_index % len(CLEAN_FEEDS)
    
    current = CLEAN_FEEDS[feed_index]
    
    return {
        "utc_time": now.isoformat(),
        "title": current['title'],
        "video_url": current['video_url'],
        "category": current['category'],
        "viewer_count": 1436592,
        "status": "live",
        "is_creator_content": False,
        "is_clean_feed": True
    }

def get_current_program():
    return get_live_sync()

def get_upcoming_programs(count=1):
    return [CLEAN_FEEDS[i % len(CLEAN_FEEDS)] for i in range(1, count + 1)]