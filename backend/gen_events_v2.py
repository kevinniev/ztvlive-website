import sys
import os
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(''))

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

load_dotenv()

# Events Promo - Smoother ending
prompt = """Cinematic promotional video for live event streaming platform.

Opening: Wide shot of a beautiful wedding celebration, guests dancing and celebrating.
Middle: Smooth transition to a business conference with engaged audience, then to a family reunion with multiple generations laughing together.
Closing: All scenes shown on glowing phone and TV screens, with warm ambient lighting fading to a subtle red glow.

Style: Professional cinematography, warm golden lighting, smooth slow-motion transitions.
Mood: Celebratory, inclusive, heartwarming.
End with a gentle fade to black over 2 seconds.
No abrupt cuts. Smooth, cinematic flow throughout."""

output_path = "/app/frontend/public/ztvlive_events_promo.mp4"

print(f"Generating: {output_path}")
video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])

video_bytes = video_gen.text_to_video(
    prompt=prompt,
    model="sora-2",
    size="1280x720",
    duration=12,  # Longer duration for smoother ending
    max_wait_time=600
)

if video_bytes:
    video_gen.save_video(video_bytes, output_path)
    print(f"SUCCESS: {output_path}")
else:
    print("FAILED")
