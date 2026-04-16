"""
ZTVLIVE Promo Video Generator using Sora 2
"""
from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

EMERGENT_LLM_KEY = "sk-emergent-a7bEeFd6f9e771e7a5"

# Compelling promo prompt for ZTVLIVE - optimized for Sora 2
PROMO_PROMPT = """
Cinematic broadcast-quality promotional video. Opening shot: A glowing neon "LIVE" badge pulses against a dark background with electric blue and purple light trails streaming past. 

Camera pushes through a futuristic digital tunnel of streaming content - gaming clips, music performances, sports highlights, viral moments - all flowing in dynamic motion. Golden coins and currency symbols cascade through the frame, symbolizing creator earnings.

Diverse group of young content creators in a modern studio, faces lit by monitor glow, excitedly reacting to their screens showing viewer counts climbing rapidly. Their joy is infectious and authentic.

Final dramatic shot: Sleek smartphone displaying a streaming interface with "24/7 LIVE" glowing badge, viewers commenting in real-time, against a backdrop of city lights at night. Premium cinematic lighting, lens flares, shallow depth of field.

Style: Modern tech commercial aesthetic, high contrast, vibrant neon colors (electric blue, purple, gold), professional broadcast quality, energetic pacing.
"""

def generate_promo():
    print("=" * 60)
    print("ZTVLIVE PROMO VIDEO GENERATOR")
    print("=" * 60)
    print("\nInitializing Sora 2 video generation...")
    print("This may take 2-5 minutes for high-quality video generation.\n")
    
    # Initialize the video generator
    generator = OpenAIVideoGeneration(api_key=EMERGENT_LLM_KEY)
    
    # Generate the video - using 8 seconds for a good promo length
    # Size: 1280x720 for standard HD
    video_bytes = generator.text_to_video(
        prompt=PROMO_PROMPT,
        model="sora-2",
        size="1280x720",
        duration=8,  # 8 second promo
        max_wait_time=600  # 10 minute timeout
    )
    
    if video_bytes:
        # Save the video
        output_path = "/app/backend/ztvlive_promo.mp4"
        generator.save_video(video_bytes, output_path)
        print("\n" + "=" * 60)
        print("SUCCESS! PROMO VIDEO GENERATED!")
        print("=" * 60)
        print(f"Video saved to: {output_path}")
        print(f"File size: {len(video_bytes) / (1024*1024):.2f} MB")
        return output_path
    else:
        print("\n❌ Failed to generate video")
        return None

if __name__ == "__main__":
    result = generate_promo()
    if result:
        print(f"\n✅ Video ready at: {result}")
    else:
        print("\n❌ Video generation failed")
