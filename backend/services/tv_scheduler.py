import datetime
import random
import json
import os

# Optimized Clean Content Library (Clean Feeds only)
CONTENT_LIBRARY = {
    'NASA_LIVE': [
        {'title': 'NASA Earth View', 'video_url': 'https://www.youtube.com/embed/21X5lGlDOfg'},
        {'title': 'ISS Live Stream', 'video_url': 'https://www.youtube.com/embed/P9C25Un7xaM'}
    ],
    'WILDLIFE_4K': [
        {'title': 'Tropical Reef 4K', 'video_url': 'https://www.youtube.com/embed/vPhg6sc1Mk4'},
        {'title': 'African Safari Live', 'video_url': 'https://www.youtube.com/embed/m9O0V9G9KBY'}
    ],
    'NEWS_GLOBAL': [
        {'title': 'ABC News Live', 'video_url': 'https://www.youtube.com/embed/w_Ma8oQLmSM'},
        {'title': 'Sky News Live', 'video_url': 'https://www.youtube.com/embed/9AuqEdf6zLw'}
    ]
}

class TVScheduler:
    def __init__(self, schedule_file='backend/data/clean_schedule.json'):
        self.schedule_file = schedule_file
        self.ensure_data_dir()

    def ensure_data_dir(self):
        os.makedirs(os.path.dirname(self.schedule_file), exist_ok=True)

    def generate_daily_schedule(self):
        """Generates a 96-slot schedule (15 mins each) for 24/7 automation"""
        schedule = []
        start_time = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        categories = list(CONTENT_LIBRARY.keys())
        
        for i in range(96):
            slot_time = start_time + datetime.timedelta(minutes=i*15)
            category = random.choice(categories)
            video = random.choice(CONTENT_LIBRARY[category])
            
            schedule.append({
                'id': i,
                'start_time': slot_time.isoformat(),
                'title': video['title'],
                'video_url': video['video_url'],
                'category': category,
                'duration': 15
            })
            
        with open(self.schedule_file, 'w') as f:
            json.dump(schedule, f, indent=4)
        return schedule

    def get_current_content(self):
        if not os.path.exists(self.schedule_file):
            self.generate_daily_schedule()
            
        with open(self.schedule_file, 'r') as f:
            schedule = json.load(f)
            
        now = datetime.datetime.now().isoformat()
        # Find the slot that matches the current time
        for slot in schedule:
            if slot['start_time'] <= now:
                current = slot
            else:
                break
        return current