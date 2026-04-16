"""
ZTVLIVE Promo Video Generator
Generates two promotional videos using Sora 2
"""

import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(''))

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

# Load environment variables
load_dotenv('/app/backend/.env')

def generate_video(prompt, output_path, duration=8):
    """Generate video with Sora 2"""
    print(f"\n🎬 Generating video: {output_path}")
    print(f"📝 Prompt: {prompt[:100]}...")
    
    video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])
    
    video_bytes = video_gen.text_to_video(
        prompt=prompt,
        model="sora-2",
        size="1280x720",  # HD landscape for TV/promo content
        duration=duration,
        max_wait_time=900  # 15 minutes max wait
    )
    
    if video_bytes:
        video_gen.save_video(video_bytes, output_path)
        print(f"✅ Video saved to: {output_path}")
        return output_path
    else:
        print(f"❌ Video generation failed for: {output_path}")
        return None


def main():
    # Promo 1: "The 70% Revolution"
    promo1_prompt = """
    Cinematic fast-paced promotional video for a creator streaming platform.
    
    Scene 1: A frustrated content creator looking at a laptop screen showing low earnings, 
    dark moody lighting, the screen shows "Platform Fee: 50%". Text overlay: "The creator economy is broken."
    
    Scene 2: Quick cut to bright, energetic scene. The same creator now smiling, 
    looking at a vibrant dashboard showing "You Keep 70%" in bold green text. 
    Colorful graphs going up. Text overlay: "At ZTVLIVE, we flipped the script."
    
    Scene 3: Dynamic motion graphics with "70%" in large bold text, 
    particles and energy effects, purple and red color scheme.
    Text overlay: "No gatekeeping. Start earning from Day 1."
    
    Final frame: ZTVLIVE logo with "Join the revolution at ztvlivestream.com" text.
    Professional marketing video style, high energy, modern aesthetic.
    """
    
    # Promo 2: "Big Screen Dreams"
    promo2_prompt = """
    Cinematic promotional video for a TV streaming platform.
    
    Scene 1: Close-up of a content creator's hands holding a smartphone, 
    filming content. Shallow depth of field, warm lighting.
    Text overlay: "Your content is too big for a tiny screen."
    
    Scene 2: Smooth cinematic zoom out transition - the phone content 
    transforms and appears on a massive 65-inch 4K TV in a beautiful 
    modern living room. Family watching in awe on a comfortable couch.
    Text overlay: "Take it to the living room. Go global."
    
    Scene 3: Multiple smart TV screens showing diverse content - 
    Roku, Fire TV, Samsung, LG logos appearing. 
    Text overlay: "ZTVLIVE broadcasts 24/7 on Roku, Fire TV, Samsung, and LG."
    
    Final frame: Global map with connection points lighting up, 
    ZTVLIVE logo. Text overlay: "Reach millions. Get seen where it counts."
    Cinematic, professional, aspirational tone.
    """
    
    # Generate Promo 1
    print("=" * 60)
    print("🎬 ZTVLIVE PROMO VIDEO GENERATOR")
    print("=" * 60)
    
    result1 = generate_video(
        promo1_prompt,
        '/app/backend/uploads/promo_70_percent_revolution.mp4',
        duration=8
    )
    
    # Generate Promo 2
    result2 = generate_video(
        promo2_prompt,
        '/app/backend/uploads/promo_big_screen_dreams.mp4',
        duration=8
    )
    
    print("\n" + "=" * 60)
    print("📊 GENERATION SUMMARY")
    print("=" * 60)
    
    if result1:
        print(f"✅ Promo 1 (70% Revolution): {result1}")
    else:
        print("❌ Promo 1 (70% Revolution): FAILED")
        
    if result2:
        print(f"✅ Promo 2 (Big Screen Dreams): {result2}")
    else:
        print("❌ Promo 2 (Big Screen Dreams): FAILED")


if __name__ == "__main__":
    main()
