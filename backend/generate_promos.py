import asyncio
import sys
import os
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(''))

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

# Load environment variables
load_dotenv()

def generate_video(prompt, output_path, duration=8):
    """Generate video with Sora 2"""
    print(f"\n🎬 Generating: {output_path}")
    print(f"   Prompt: {prompt[:100]}...")
    
    video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])
    
    video_bytes = video_gen.text_to_video(
        prompt=prompt,
        model="sora-2",
        size="1280x720",
        duration=duration,
        max_wait_time=600
    )
    
    if video_bytes:
        video_gen.save_video(video_bytes, output_path)
        print(f"   ✅ Saved to: {output_path}")
        return output_path
    else:
        print(f"   ❌ Failed to generate")
        return None

def main():
    # Define all promo videos to generate
    promos = [
        {
            "name": "events_promo",
            "prompt": """Cinematic promo video for a live streaming platform. 
            Scene: A professional conference hall with speakers on stage, transitions to a wedding celebration, 
            then a family reunion gathering, all being streamed live on screens and phones.
            Show diverse people watching on their devices with happy expressions.
            Modern, vibrant colors with red and white accents. Text overlay style: "STREAM YOUR EVENTS LIVE".
            Professional cinematography, smooth camera movements, warm lighting.""",
            "output": "/app/frontend/public/ztvlive_events_promo.mp4",
            "duration": 8
        },
        {
            "name": "schedule_promo",
            "prompt": """Dynamic promotional video for content scheduling feature.
            Scene: A calendar interface animating with time slots filling in, 
            transitions to a phone notification popping up, then friends and family 
            gathering around a TV to watch together. 
            Modern tech aesthetic with sleek UI elements. Red and black color scheme.
            Shows the concept of scheduling content for loved ones to watch.
            Smooth transitions, modern editing style.""",
            "output": "/app/frontend/public/ztvlive_schedule_promo.mp4",
            "duration": 8
        },
        {
            "name": "notification_promo",
            "prompt": """Exciting promotional video showcasing push notifications.
            Scene: A smartphone screen showing a notification bell icon lighting up,
            then a person excitedly picking up their phone, transitions to them 
            watching live content on their TV. 
            Visual metaphor of never missing a moment. Glowing notification effects.
            Modern, sleek design. Red accent color pulsing with notifications.
            Dynamic camera work, energetic pace.""",
            "output": "/app/frontend/public/ztvlive_notification_promo.mp4",
            "duration": 8
        },
        {
            "name": "app_install_promo",
            "prompt": """Modern promotional video for app installation across devices.
            Scene: Three devices floating - an iPhone, Android phone, and laptop computer.
            App installation animation on each device. Progress bars filling up.
            Then all three devices showing the same live stream in sync.
            Clean, minimalist white background with red accent lighting.
            Text concept: "AVAILABLE ON ALL DEVICES".
            Sleek tech commercial style, smooth 3D animations.""",
            "output": "/app/frontend/public/ztvlive_app_install_promo.mp4",
            "duration": 8
        },
        {
            "name": "social_media_ad",
            "prompt": """Fast-paced social media advertisement for streaming platform.
            Quick cuts showing: gaming streams, music performances, sports highlights,
            family events, conferences - all being watched on phones and TVs.
            Vibrant colors, energetic transitions, modern editing.
            Young diverse audience engaging with content. Red and black color scheme.
            Punchy, viral video style optimized for social media.
            Dynamic text overlays appearing and disappearing.""",
            "output": "/app/frontend/public/ztvlive_social_ad.mp4",
            "duration": 8
        }
    ]
    
    print("=" * 60)
    print("🎬 ZTVLIVE PROMO VIDEO GENERATOR")
    print("=" * 60)
    print(f"Generating {len(promos)} promotional videos...")
    
    results = []
    for promo in promos:
        try:
            result = generate_video(
                prompt=promo["prompt"],
                output_path=promo["output"],
                duration=promo["duration"]
            )
            results.append({
                "name": promo["name"],
                "success": result is not None,
                "path": result
            })
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            results.append({
                "name": promo["name"],
                "success": False,
                "error": str(e)
            })
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 GENERATION SUMMARY")
    print("=" * 60)
    
    successful = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]
    
    print(f"✅ Successful: {len(successful)}/{len(results)}")
    for r in successful:
        print(f"   - {r['name']}: {r['path']}")
    
    if failed:
        print(f"\n❌ Failed: {len(failed)}/{len(results)}")
        for r in failed:
            print(f"   - {r['name']}: {r.get('error', 'Unknown error')}")
    
    return results

if __name__ == "__main__":
    main()
