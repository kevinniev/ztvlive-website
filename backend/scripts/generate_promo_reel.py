#!/usr/bin/env python3
"""
ZTVLIVE: The 70% Revolution Reel Generator
Duration: 25 Seconds (split into segments)
"""

import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

sys.path.insert(0, '/app/backend')
load_dotenv('/app/backend/.env')

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

# Output directory
OUTPUT_DIR = "/app/backend/static/promo"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Video segments with their prompts
PROMO_SEGMENTS = [
    {
        "name": "01_revolution_intro",
        "duration": 4,
        "prompt": """Cinematic fast-cut montage: A packed stadium with roaring fans, bright stadium lights, 
        confetti flying. Cut to a professional news anchor at a sleek modern desk with screens behind them.
        Cut to high-tech streaming equipment with glowing LED lights. Dark dramatic lighting with neon purple 
        and red accents. Professional broadcast quality. Text overlay: "THE REVOLUTION IS HERE" in bold white 
        futuristic font. Epic, high-energy opening sequence.""",
        "size": "1792x1024"
    },
    {
        "name": "02_sports_news_tech",
        "duration": 8,
        "prompt": """Fast-paced montage of premium content: A soccer player scoring an incredible goal in slow motion, 
        stadium erupting. Quick cut to a breaking news broadcast with urgent graphics and a professional anchor. 
        Cut to a tech podcast studio with modern equipment, hosts discussing with enthusiasm. Dynamic camera movements, 
        professional color grading with vibrant colors. Premium television quality. Text overlays flash: "SPORTS" 
        "NEWS" "TECH" "24/7" in bold modern typography. Sleek, broadcast-quality footage.""",
        "size": "1792x1024"
    },
    {
        "name": "03_creator_revenue",
        "duration": 8,
        "prompt": """A confident, happy content creator smiling at a professional broadcast camera in a modern studio. 
        The creator looks successful and professional. Warm, inviting lighting. The scene transitions to show 
        streaming platform interfaces on multiple screens - Roku, Fire TV, Samsung TV. Bold animated text appears: 
        "70% REVENUE SHARE" in large green and white numbers. Money/coins graphics subtly appear. 
        Professional, aspirational, empowering mood. Clean modern aesthetic.""",
        "size": "1792x1024"
    },
    {
        "name": "04_logo_cta",
        "duration": 4,
        "prompt": """A sleek, modern logo reveal on a dark background with purple and red gradient lighting effects. 
        The scene features a minimalist dark studio with dramatic lighting. Animated light rays and particles. 
        Text "JOIN THE REVOLUTION" appears with a professional animation. Clean, premium branding moment. 
        Corporate broadcast quality. Ends with a solid professional look suitable for a streaming platform brand.""",
        "size": "1792x1024"
    }
]

def generate_segment(segment, model="sora-2"):
    """Generate a single video segment"""
    print(f"\n{'='*60}")
    print(f"Generating: {segment['name']}")
    print(f"Duration: {segment['duration']}s")
    print(f"Prompt: {segment['prompt'][:100]}...")
    print(f"{'='*60}")
    
    output_path = os.path.join(OUTPUT_DIR, f"{segment['name']}.mp4")
    
    # Create new instance for each generation
    video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])
    
    try:
        video_bytes = video_gen.text_to_video(
            prompt=segment['prompt'],
            model=model,
            size=segment['size'],
            duration=segment['duration'],
            max_wait_time=900  # 15 minutes timeout
        )
        
        if video_bytes:
            video_gen.save_video(video_bytes, output_path)
            print(f"✅ Saved: {output_path}")
            return output_path
        else:
            print(f"❌ Failed to generate: {segment['name']}")
            return None
            
    except Exception as e:
        print(f"❌ Error generating {segment['name']}: {e}")
        return None

def main():
    print("\n" + "="*60)
    print("ZTVLIVE: The 70% Revolution Reel Generator")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Total segments: {len(PROMO_SEGMENTS)}")
    print(f"Total duration: {sum(s['duration'] for s in PROMO_SEGMENTS)}s")
    
    results = []
    
    for i, segment in enumerate(PROMO_SEGMENTS, 1):
        print(f"\n[{i}/{len(PROMO_SEGMENTS)}] Processing segment...")
        result = generate_segment(segment)
        results.append({
            "name": segment["name"],
            "success": result is not None,
            "path": result
        })
    
    print("\n" + "="*60)
    print("GENERATION COMPLETE")
    print("="*60)
    
    successful = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]
    
    print(f"\n✅ Successful: {len(successful)}/{len(results)}")
    for r in successful:
        print(f"   - {r['path']}")
    
    if failed:
        print(f"\n❌ Failed: {len(failed)}/{len(results)}")
        for r in failed:
            print(f"   - {r['name']}")
    
    print(f"\nFinished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Generate ffmpeg command to combine videos
    if successful:
        print("\n" + "="*60)
        print("TO COMBINE VIDEOS, RUN:")
        print("="*60)
        input_files = " ".join([f"-i {r['path']}" for r in successful])
        filter_complex = f"concat=n={len(successful)}:v=1:a=0"
        print(f"ffmpeg {input_files} -filter_complex '{filter_complex}' {OUTPUT_DIR}/ztvlive_70_percent_reel.mp4")
    
    return results

if __name__ == "__main__":
    main()
