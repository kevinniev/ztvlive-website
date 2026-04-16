"""
ZTVLIVE Creator Revolution Promo Video Generator
"""

import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(''))

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

load_dotenv('/app/backend/.env')

def generate_video():
    print("🎬 Generating Creator Revolution Promo Video...")
    
    prompt = """
    High-energy, professional promotional video for a creator streaming platform revolution.
    
    SCENE 1 (0-2s): Dramatic opening - A frustrated content creator looking at their laptop showing 
    "$47.32 MONTHLY EARNINGS" with red downward arrows. Dark, moody lighting. Text overlay appears: 
    "THE HARSH TRUTH: 50% OF CREATORS STUCK UNDER $10K"
    
    SCENE 2 (2-4s): Quick cuts of creators working hard - filming, editing, posting - but looking 
    exhausted and underpaid. Split screen showing platform logos taking 50% cut. 
    Text: "PLATFORMS KEEP THE LION'S SHARE"
    
    SCENE 3 (4-6s): DRAMATIC TRANSITION - Glass shattering effect, explosion of golden particles.
    Bold text "FLIP THE SCRIPT" with hammer smashing through. Energy shift to bright, powerful visuals.
    
    SCENE 4 (6-8s): Triumphant reveal - ZTVLIVE logo with "70% REVENUE SHARE" in huge golden text.
    Money/coins visual effect. Happy, successful creator celebrating. Premium purple and gold color scheme.
    Text: "70% GOES TO YOU"
    
    SCENE 5 (8-10s): Multiple TV screens lighting up - Roku, Fire TV, Samsung, LG logos appearing
    one by one. Content playing on massive screens in living rooms worldwide. Globe with connection lines.
    Text: "BROADCAST TO MILLIONS ON THE BIG SCREEN"
    
    SCENE 6 (10-12s): Professional media production environment, 15+ years experience badge,
    growth charts going up. Creator community growing, networking.
    Text: "15+ YEARS MEDIA EXPERIENCE FUELING YOUR GROWTH"
    
    FINAL FRAME (12-15s): Epic call-to-action - ZTVLIVE logo center screen with glowing effects,
    "JOIN THE REVOLUTION" text, www.ztvlivestream.com URL prominently displayed.
    Purple/gold gradient background, professional broadcast quality finish.
    
    Style: Fast-paced, TikTok/Instagram Reels energy, professional broadcast quality,
    bold typography, cinematic transitions, empowering and revolutionary tone.
    Color palette: Deep purple, gold, white accents.
    """
    
    video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])
    
    video_bytes = video_gen.text_to_video(
        prompt=prompt,
        model="sora-2",
        size="1280x720",  # HD Landscape
        duration=12,  # Maximum duration
        max_wait_time=900
    )
    
    if video_bytes:
        output_path = '/app/backend/uploads/promo_creator_revolution.mp4'
        video_gen.save_video(video_bytes, output_path)
        print(f"✅ Video saved to: {output_path}")
        return output_path
    else:
        print("❌ Video generation failed")
        return None

if __name__ == "__main__":
    result = generate_video()
    if result:
        print(f"\n🎉 Promo video ready: {result}")
