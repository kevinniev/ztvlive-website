import sys
import os
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(''))

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

load_dotenv()

# Notification Promo
prompt = """Exciting promotional video showcasing push notifications.
Scene: A smartphone screen showing a notification bell icon lighting up with a glow,
then a person excitedly picking up their phone, transitions to them 
watching live content on their TV with friends. 
Visual metaphor of never missing a moment. Glowing notification effects.
Modern, sleek design. Red accent color pulsing with notifications.
Dynamic camera work, energetic pace. Text concept: NEVER MISS A MOMENT."""

output_path = "/app/frontend/public/ztvlive_notification_promo.mp4"

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
