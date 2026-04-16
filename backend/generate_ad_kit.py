"""
ZTVLIVE Social Media Ad Kit Generator
Creates promo videos in multiple formats for different platforms
"""
from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration
import os

EMERGENT_LLM_KEY = "sk-emergent-a7bEeFd6f9e771e7a5"

# Base prompt optimized for all formats
BASE_PROMPT = """High-energy promotional video for ZTVLIVE streaming platform targeting content creators.

Scene: Young diverse content creator in modern studio, confidently looking at camera with ring light reflection in eyes. Their expression shows excitement and success.

Transition: Quick cuts showing streaming dashboard with rising viewer counts, notification alerts popping up showing tips and new subscribers. Numbers climbing: subscriber count going up fast.

Action: Creator reacting with genuine joy to seeing earnings increase on their screen. Golden light accents representing money and success. Phone showing the ZTVLIVE app with "LIVE" badge glowing.

Climax: Multiple creators in split-frame, all creating content, all successful. Energy is aspirational and achievable.

Mood: Energetic, modern, aspirational. Premium commercial quality with warm golden highlights and cool blue tech accents. Professional lighting, shallow depth of field.

Text elements should feel integrated: "GET PAID MORE" "STREAM 24/7" "JOIN ZTVLIVE"
"""

# Platform-specific prompts
VERTICAL_PROMPT = BASE_PROMPT + """

VERTICAL FORMAT (9:16): Optimized for mobile viewing. Center the creator in frame. Stack text elements vertically. Close-up shots work best. Phone-first composition."""

SQUARE_PROMPT = BASE_PROMPT + """

SQUARE FORMAT (1:1): Balanced composition for Instagram feed. Creator centered with room for text overlays. Works well as thumbnail. Clear, bold visuals."""

def generate_video(prompt, size, output_name, duration=8):
    """Generate a single video with given parameters"""
    print(f"\n{'='*50}")
    print(f"Generating: {output_name}")
    print(f"Size: {size}, Duration: {duration}s")
    print('='*50)
    
    generator = OpenAIVideoGeneration(api_key=EMERGENT_LLM_KEY)
    
    video_bytes = generator.text_to_video(
        prompt=prompt,
        model="sora-2",
        size=size,
        duration=duration,
        max_wait_time=600
    )
    
    if video_bytes:
        output_path = f"/app/backend/ad_kit/{output_name}"
        os.makedirs("/app/backend/ad_kit", exist_ok=True)
        generator.save_video(video_bytes, output_path)
        print(f"✅ SUCCESS: Saved to {output_path}")
        print(f"   Size: {len(video_bytes) / (1024*1024):.2f} MB")
        return output_path
    else:
        print(f"❌ FAILED: {output_name}")
        return None

def main():
    print("\n" + "="*60)
    print("ZTVLIVE SOCIAL MEDIA AD KIT GENERATOR")
    print("="*60)
    print("\nGenerating videos for multiple platforms...")
    print("This will take approximately 10-15 minutes total.\n")
    
    results = {}
    
    # 1. Vertical 9:16 for TikTok/Reels (1024x1792)
    print("\n[1/2] TikTok/Reels Vertical (9:16)")
    results['vertical'] = generate_video(
        VERTICAL_PROMPT,
        "1024x1792",  # Vertical 9:16
        "ztvlive_vertical_9x16.mp4",
        duration=8  # 8 seconds for short-form
    )
    
    # 2. Square 1:1 for Instagram/Facebook (1024x1024)
    print("\n[2/2] Instagram/Facebook Square (1:1)")
    results['square'] = generate_video(
        SQUARE_PROMPT,
        "1024x1024",  # Square 1:1
        "ztvlive_square_1x1.mp4",
        duration=8  # 8 seconds
    )
    
    print("\n" + "="*60)
    print("AD KIT GENERATION COMPLETE!")
    print("="*60)
    
    print("\n📦 Generated Files:")
    for format_name, path in results.items():
        if path:
            print(f"   ✅ {format_name}: {path}")
        else:
            print(f"   ❌ {format_name}: FAILED")
    
    # We already have 16:9
    print(f"   ✅ horizontal (16:9): /app/backend/ztvlive_promo_premium.mp4 (existing)")
    
    return results

if __name__ == "__main__":
    main()
