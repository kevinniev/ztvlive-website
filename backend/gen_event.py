import sys
import os
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(''))

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

load_dotenv()

# Event Streaming Promo
prompt = """Cinematic promo video for a live streaming platform. 
Scene: A professional conference hall with speakers on stage, transitions to a wedding celebration, 
then a family reunion gathering, all being streamed live on screens and phones.
Show diverse people watching on their devices with happy expressions.
Modern, vibrant colors with red and white accents. Text overlay style: STREAM YOUR EVENTS LIVE.
Professional cinematography, smooth camera movements, warm lighting."""

output_path = "/app/frontend/public/ztvlive_events_promo.mp4"

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
