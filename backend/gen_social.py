import sys
import os
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(''))

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

load_dotenv()

# Social Media Ad - Short viral clip
prompt = """Fast-paced social media advertisement for streaming platform.
Quick cuts showing: esports gaming tournaments, live music concerts, sports game highlights,
wedding celebrations, business conferences - all being watched on phones and big screen TVs.
Vibrant neon colors, energetic transitions, modern TikTok/Instagram style editing.
Young diverse audience enjoying content together. Red and black color scheme with glow effects.
Punchy, viral video style optimized for social media attention grabbing.
Dynamic text overlays appearing and disappearing. High energy throughout."""

output_path = "/app/frontend/public/ztvlive_social_ad.mp4"

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
