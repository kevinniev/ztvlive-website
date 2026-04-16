import sys
import os
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(''))

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

load_dotenv()

# App Install Promo
prompt = """Modern promotional video for app installation across devices.
Scene: Three devices floating in 3D space - an iPhone, Android phone, and laptop computer.
App installation animation on each device showing download progress.
Then all three devices showing the same live stream content in sync.
Clean, minimalist dark background with red accent lighting and glow effects.
Text concept: DOWNLOAD ON ANY DEVICE. WATCH ANYWHERE.
Sleek tech commercial style, smooth 3D animations, premium feel."""

output_path = "/app/frontend/public/ztvlive_app_install_promo.mp4"

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
