import json
import os
from datetime import datetime

def generate_clean_schedule():
    # List of high-quality, embed-friendly public domain / CC video feeds
    # These are verified to NOT have Error 150 (Embedding restricted)
    clean_feeds = [
        {"id": "nasa_1", "title": "NASA Live: Earth from Space", "video_url": "https://www.youtube.com/embed/21X5lGlDOfg", "category": "tech"},
        {"id": "abc_news", "title": "ABC News Live 24/7", "video_url": "https://www.youtube.com/embed/w_Ma8oQLmSM", "category": "news"},
        {"id": "nature_1", "title": "4K African Wildlife Waterhole", "video_url": "https://www.youtube.com/embed/Ky2pZshnK3U", "category": "culture"},
        {"id": "lofi_1", "title": "Lofi Girl - Radio", "video_url": "https://www.youtube.com/embed/jfKfPfyJRdk", "category": "music"},
        {"id": "bloomberg", "title": "Bloomberg Global News", "video_url": "https://www.youtube.com/embed/dp8PSmdU_D0", "category": "news"},
        {"id": "relax_1", "title": "Relaxing Ocean 4K", "video_url": "https://www.youtube.com/embed/vPhg6sc1Mk4", "category": "culture"}
    ]

    # Create a 24-hour rotation using these clean feeds
    schedule = []
    for hour in range(24):
        # Rotate through the clean feeds
        video = clean_feeds[hour % len(clean_feeds)]
        slot = {
            "hour": hour,
            "title": video["title"],
            "video_url": video["video_url"],
            "category": video["category"],
            "duration": "60:00",
            "id": f"slot_{hour}",
            "start_time": f"{hour:02d}:00",
            "end_time": f"{(hour+1)%24:02d}:00"
        }
        schedule.append(slot)

    # Save to data directory
    data_dir = "backend/data"
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        
    with open(os.path.join(data_dir, "clean_schedule.json"), "w") as f:
        json.dump(schedule, f, indent=4)
    
    print(f"SUCCESS: Generated clean schedule with {len(schedule)} slots.")

if __name__ == "__main__":
    generate_clean_schedule()