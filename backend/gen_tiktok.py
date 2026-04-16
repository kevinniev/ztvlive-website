import sys
import os
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(''))

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

load_dotenv()

# Vertical Social Media Ad for TikTok/Reels
prompt = """Vertical format social media advertisement for live streaming platform.
Scene: Phone-first view of someone scrolling through live events - weddings, concerts, sports.
Then the phone screen expands to fill the frame showing exciting live content.
Quick transitions, trending TikTok editing style with zoom effects.
Young person reacting excitedly to content. Red color accents and glow effects.
Text concept: YOUR EVENTS LIVE. WATCH FREE.
High energy, viral potential, mobile-first design."""

output_path = "/app/frontend/public/ztvlive_tiktok_events.mp4"

print(f"Generating: {output_path}")
video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])

video_bytes = video_gen.text_to_video(
    prompt=prompt,
    model="sora-2",
    size="1024x1792",  # Vertical format
    duration=8,
    max_wait_time=600
)

if video_bytes:
    video_gen.save_video(video_bytes, output_path)
    print(f"SUCCESS: {output_path}")
else:
    print("FAILED")
