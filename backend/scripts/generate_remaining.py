import os
import sys
from datetime import datetime
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

OUTPUT_DIR = '/app/backend/static/promo'
os.makedirs(OUTPUT_DIR, exist_ok=True)

segments = [
    {
        'name': '02_sports_news_tech',
        'duration': 8,
        'prompt': 'Fast-paced premium content montage: A soccer player scoring goal in slow motion, stadium celebrating. Cut to breaking news broadcast with anchor. Cut to modern tech podcast studio. Bold text flashes: SPORTS NEWS TECH 24/7. Premium broadcast quality.'
    },
    {
        'name': '03_creator_revenue', 
        'duration': 8,
        'prompt': 'Confident content creator smiling at professional camera in modern studio. Show streaming on smart TVs. Large bold text: 70 PERCENT REVENUE SHARE in green. Warm, aspirational, professional atmosphere.'
    },
    {
        'name': '04_logo_cta',
        'duration': 4,
        'prompt': 'Sleek logo reveal on dark background with purple and red lighting. Animated light rays. Text: JOIN THE REVOLUTION. Professional corporate branding. Clean elegant finish.'
    }
]

print(f'Starting at {datetime.now()}', flush=True)

for i, seg in enumerate(segments, 2):
    print(f'\n[{i}/4] Generating: {seg["name"]} ({seg["duration"]}s)...', flush=True)
    video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])
    
    try:
        video_bytes = video_gen.text_to_video(
            prompt=seg['prompt'],
            model='sora-2',
            size='1280x720', 
            duration=seg['duration'],
            max_wait_time=900
        )
        
        if video_bytes:
            path = f'{OUTPUT_DIR}/{seg["name"]}.mp4'
            video_gen.save_video(video_bytes, path)
            print(f'✅ Saved: {path}', flush=True)
        else:
            print(f'❌ Failed: {seg["name"]}', flush=True)
    except Exception as e:
        print(f'❌ Error: {e}', flush=True)

print(f'\nCompleted at {datetime.now()}', flush=True)
