"""
Verify all video links in the content library are valid and embeddable
"""

import asyncio
import aiohttp
import sys
sys.path.insert(0, '/app/backend')

from services.tv_scheduler import CONTENT_LIBRARY

async def check_video(session, video_id, title, category):
    """Check if video is embeddable"""
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
            if resp.status == 200:
                return True, None
            elif resp.status == 401:
                return False, "Embedding disabled"
            elif resp.status == 404:
                return False, "Video not found"
            else:
                return False, f"Status {resp.status}"
    except asyncio.TimeoutError:
        return False, "Timeout"
    except Exception as e:
        return False, str(e)

async def main():
    print("=" * 60)
    print("VERIFYING CONTENT LIBRARY VIDEOS")
    print("=" * 60)
    
    total = 0
    passed = 0
    failed = []
    
    async with aiohttp.ClientSession() as session:
        for category, videos in CONTENT_LIBRARY.items():
            print(f"\n--- {category.upper()} ({len(videos)} videos) ---")
            
            for video in videos:
                video_url = video.get("video_url", "")
                video_id = video_url.split("/")[-1].split("?")[0] if video_url else None
                
                if not video_id:
                    print(f"  ❌ {video['title'][:40]} - No video ID in URL: {video_url}")
                    failed.append((video['id'], video['title'], category, "Invalid URL"))
                    total += 1
                    continue
                
                total += 1
                is_ok, error = await check_video(session, video_id, video["title"], category)
                
                if is_ok:
                    print(f"  ✅ {video['title'][:45]}")
                    passed += 1
                else:
                    print(f"  ❌ {video['title'][:40]} - {error}")
                    failed.append((video['id'], video['title'], category, error))
                
                await asyncio.sleep(0.1)
    
    print("\n" + "=" * 60)
    print(f"VERIFICATION COMPLETE: {passed}/{total} videos passed")
    print("=" * 60)
    
    if failed:
        print(f"\n{len(failed)} BROKEN VIDEOS TO FIX:")
        for vid_id, title, cat, error in failed:
            print(f"  - [{cat}] {title}: {error} (ID: {vid_id})")
    else:
        print("\n✅ All videos are valid and embeddable!")
    
    return failed

if __name__ == "__main__":
    broken = asyncio.run(main())
    
    # Save broken videos to file for reference
    if broken:
        with open('/tmp/broken_videos.txt', 'w') as f:
            for vid_id, title, cat, error in broken:
                f.write(f"{vid_id}|{cat}|{title}|{error}\n")
        print(f"\nBroken videos saved to /tmp/broken_videos.txt")
