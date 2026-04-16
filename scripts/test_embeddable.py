"""
Quick check to find embeddable YouTube videos
"""
import asyncio
import aiohttp

# Videos to test - well known videos that typically allow embedding
TEST_VIDEOS = [
    # Baby Shark, Despacito, Shape of You - most viewed videos
    {"id": "test1", "name": "Baby Shark", "video_id": "XqZsoesa55w"},
    {"id": "test2", "name": "Despacito", "video_id": "kJQP7kiw5Fk"},
    {"id": "test3", "name": "Shape of You", "video_id": "JGwWNGJdvx8"},
    {"id": "test4", "name": "See You Again", "video_id": "RgKAFK5djSk"},
    {"id": "test5", "name": "Gangnam Style", "video_id": "9bZkp7q19f0"},
    {"id": "test6", "name": "Counting Stars", "video_id": "hT_nvWreIhg"},
    {"id": "test7", "name": "Roar - Katy Perry", "video_id": "CevxZvSJLk8"},
    {"id": "test8", "name": "Hello - Adele", "video_id": "YQHsXMglC9A"},
    {"id": "test9", "name": "Believer - Imagine Dragons", "video_id": "7wtfhZwyrcc"},
    {"id": "test10", "name": "Sunflower - Post Malone", "video_id": "ApXoWvfEYVU"},
    # Lo-fi/Chill music (usually embeddable)
    {"id": "lofi1", "name": "Lofi Hip Hop Radio", "video_id": "5qap5aO4i9A"},
    {"id": "lofi2", "name": "Chill Lofi Mix", "video_id": "BTYAsjAVa3I"},
    # Royalty free/Creative Commons
    {"id": "free1", "name": "Epic Music Mix", "video_id": "dWNvlyycWzQ"},
]

async def check_embeddable(session, video_id, name):
    """Check if video is embeddable using oembed"""
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
            if resp.status == 200:
                print(f"✅ {name} ({video_id}) - EMBEDDABLE")
                return True
            else:
                print(f"❌ {name} ({video_id}) - NOT EMBEDDABLE (status {resp.status})")
                return False
    except Exception as e:
        print(f"❌ {name} ({video_id}) - ERROR: {e}")
        return False

async def main():
    print("Testing video embeddability...\n")
    
    async with aiohttp.ClientSession() as session:
        results = []
        for video in TEST_VIDEOS:
            ok = await check_embeddable(session, video["video_id"], video["name"])
            results.append((video, ok))
            await asyncio.sleep(0.2)  # Rate limit
    
    print(f"\n\nSummary: {sum(1 for _, ok in results if ok)}/{len(results)} videos embeddable")

if __name__ == "__main__":
    asyncio.run(main())
