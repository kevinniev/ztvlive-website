"""
ZTVLIVE Premium Promo Video Generator using Sora 2
Creates a high-quality promotional video to attract content creators
"""
from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

EMERGENT_LLM_KEY = "sk-emergent-a7bEeFd6f9e771e7a5"

# Premium promo prompt - focus on CREATORS and EARNINGS
PROMO_PROMPT = """
Ultra high-quality cinematic commercial for ZTVLIVE streaming platform, targeting content creators.

Opening: Dramatic close-up of hands counting cash, hundred dollar bills fanning out. Camera pulls back to reveal a young diverse content creator in a modern home studio setup with ring lights and professional equipment. They're smiling confidently at camera.

Middle: Dynamic montage of creator success stories - a gamer celebrating a huge donation alert on screen, a musician performing to thousands of virtual viewers, a podcaster seeing their subscriber count climb rapidly on their dashboard. All moments bathed in warm golden light mixed with cool blue tech accents.

Transition: Smartphone screen shows the ZTVLIVE creator dashboard with earnings graph going UP dramatically. Numbers climbing: $500... $1000... $5000. Notifications popping: "New subscriber!" "Tip received!" "Your content is trending!"

Climax: Split screen showing creators worldwide - in bedrooms, studios, living rooms - all creating content simultaneously. Their faces lit by monitors, all successful, all earning. Energy is aspirational and achievable.

Final shot: Bold text emerges from particles of light: "YOUR CONTENT. YOUR AUDIENCE. YOUR MONEY." followed by ZTVLIVE logo with tagline "Get Paid What You Deserve"

Style: Premium commercial quality. Cinematic 24fps feel. Color grade: Warm highlights with teal shadows. Professional lighting throughout. Depth of field. Modern, aspirational, authentic diversity.
"""

def generate_premium_promo():
    print("=" * 60)
    print("ZTVLIVE PREMIUM PROMO VIDEO GENERATOR")
    print("=" * 60)
    print("\nGenerating high-quality creator-focused promo...")
    print("Using Sora 2 Pro for best quality...")
    print("This may take 5-10 minutes.\n")
    
    # Initialize the video generator
    generator = OpenAIVideoGeneration(api_key=EMERGENT_LLM_KEY)
    
    # Generate the video - 12 seconds for premium promo
    # Size: 1280x720 for HD widescreen (Sora 2 supported)
    video_bytes = generator.text_to_video(
        prompt=PROMO_PROMPT,
        model="sora-2",
        size="1280x720",  # HD widescreen - supported by Sora 2
        duration=12,  # 12 second premium promo
        max_wait_time=900  # 15 minute timeout for premium quality
    )
    
    if video_bytes:
        # Save the video
        output_path = "/app/backend/ztvlive_promo_premium.mp4"
        generator.save_video(video_bytes, output_path)
        print("\n" + "=" * 60)
        print("SUCCESS! PREMIUM PROMO VIDEO GENERATED!")
        print("=" * 60)
        print(f"Video saved to: {output_path}")
        print(f"File size: {len(video_bytes) / (1024*1024):.2f} MB")
        return output_path
    else:
        print("\n❌ Failed to generate video")
        return None

if __name__ == "__main__":
    result = generate_premium_promo()
    if result:
        print(f"\n✅ Premium video ready at: {result}")
    else:
        print("\n❌ Video generation failed")
