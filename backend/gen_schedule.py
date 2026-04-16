import sys
import os
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(''))

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

load_dotenv()

# Schedule & Share Promo
prompt = """Dynamic promotional video for content scheduling feature.
Scene: A calendar interface animating with time slots filling in, 
transitions to a phone notification popping up, then friends and family 
gathering around a TV to watch together. 
Modern tech aesthetic with sleek UI elements. Red and black color scheme.
Shows the concept of scheduling content for loved ones to watch.
Smooth transitions, modern editing style."""

output_path = "/app/frontend/public/ztvlive_schedule_promo.mp4"

print(f"Generating: {output_path}")
video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])

video_bytes = video_gen.text_to_video(
    prompt=prompt,
    model="sora-2",
    size="1280x720",
    duration=8,
    max_wait_time=600
)

if video_bytes:
    video_gen.save_video(video_bytes, output_path)
    print(f"SUCCESS: {output_path}")
else:
    print("FAILED")
