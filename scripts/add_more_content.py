"""
Add more verified videos to fill gaps in library
"""

import asyncio
import aiohttp

# Additional videos to test - focusing on missing categories
ADDITIONAL_VIDEOS = {
    "afrobeats": [
        # Try different Afrobeats videos
        {"id": "afro_ojuelegba", "title": "WizKid - Ojuelegba", "video_url": "https://www.youtube.com/embed/dyHS_E0svDw", "duration_seconds": 295, "source": "WizKid"},
        {"id": "afro_dangote", "title": "Burna Boy - Dangote", "video_url": "https://www.youtube.com/embed/L0qQJGQq0n8", "duration_seconds": 246, "source": "Burna Boy"},
        {"id": "afro_on_the_low", "title": "Burna Boy - On The Low", "video_url": "https://www.youtube.com/embed/DfGEhVxnpJo", "duration_seconds": 196, "source": "Burna Boy"},
        {"id": "afro_anybody", "title": "Burna Boy - Anybody", "video_url": "https://www.youtube.com/embed/uyItBjpkfnk", "duration_seconds": 196, "source": "Burna Boy"},
        {"id": "afro_mad", "title": "Davido - FIA", "video_url": "https://www.youtube.com/embed/oYqZ1sRl0Jk", "duration_seconds": 206, "source": "Davido"},
        {"id": "afro_soco", "title": "WizKid - Soco ft. Ceeza Milli, Spotless, Terri", "video_url": "https://www.youtube.com/embed/BPwMj-TQFKI", "duration_seconds": 225, "source": "WizKid"},
        {"id": "afro_pana", "title": "Tekno - Pana", "video_url": "https://www.youtube.com/embed/mWRkMn5kHIg", "duration_seconds": 228, "source": "Tekno"},
        {"id": "afro_johnny", "title": "Yemi Alade - Johnny", "video_url": "https://www.youtube.com/embed/0zEzZcBVLhU", "duration_seconds": 255, "source": "Yemi Alade"},
        {"id": "afro_doro", "title": "Tekno - Duro", "video_url": "https://www.youtube.com/embed/BpNEf5pP82o", "duration_seconds": 219, "source": "Tekno"},
        {"id": "afro_rema_calm", "title": "Rema - Calm Down", "video_url": "https://www.youtube.com/embed/CQLsdm1ZYAw", "duration_seconds": 239, "source": "Rema"},
    ],
    
    "bollywood_extra": [
        {"id": "bolly_afghan", "title": "Afghan Jalebi - Phantom", "video_url": "https://www.youtube.com/embed/B3NMX3Qp1Gc", "duration_seconds": 265, "source": "T-Series"},
        {"id": "bolly_lungi", "title": "Lungi Dance - Chennai Express", "video_url": "https://www.youtube.com/embed/H5vKH_wHLVg", "duration_seconds": 256, "source": "T-Series"},
        {"id": "bolly_desi_girl", "title": "Desi Girl - Dostana", "video_url": "https://www.youtube.com/embed/y-j0piXG1ws", "duration_seconds": 294, "source": "T-Series"},
        {"id": "bolly_pehla", "title": "Pehla Nasha - Jo Jeeta Wohi Sikandar", "video_url": "https://www.youtube.com/embed/dH5l1qsM0ao", "duration_seconds": 292, "source": "Tips Official"},
        {"id": "bolly_tum_hi_ho", "title": "Tum Hi Ho - Aashiqui 2", "video_url": "https://www.youtube.com/embed/IJq0yyWug1k", "duration_seconds": 263, "source": "T-Series"},
        {"id": "bolly_jai_ho", "title": "Jai Ho - Slumdog Millionaire", "video_url": "https://www.youtube.com/embed/xwwAVRyNmgQ", "duration_seconds": 312, "source": "Interscope"},
        {"id": "bolly_balam", "title": "Balam Pichkari - Yeh Jawaani", "video_url": "https://www.youtube.com/embed/0WtRNGubWGA", "duration_seconds": 289, "source": "T-Series"},
    ],
    
    "sports_extra": [
        {"id": "sport_waka", "title": "Shakira - Waka Waka (World Cup 2010)", "video_url": "https://www.youtube.com/embed/pRpeEdMmmQ0", "duration_seconds": 218, "source": "Shakira"},
        {"id": "sport_wavin", "title": "Wavin' Flag - K'naan (World Cup 2010)", "video_url": "https://www.youtube.com/embed/WTJSt4wP2ME", "duration_seconds": 227, "source": "K'naan"},
        {"id": "sport_live_it_up", "title": "Live It Up - Nicky Jam, Will Smith (World Cup 2018)", "video_url": "https://www.youtube.com/embed/V_r95yQqn9c", "duration_seconds": 224, "source": "Sony Music"},
        {"id": "sport_hayya", "title": "Hayya Hayya - Trinidad Cardona (World Cup 2022)", "video_url": "https://www.youtube.com/embed/xmR4X2Nh1ks", "duration_seconds": 183, "source": "FIFA"},
        {"id": "sport_cup_of_life", "title": "Ricky Martin - The Cup of Life", "video_url": "https://www.youtube.com/embed/8BtLzHJfJuo", "duration_seconds": 216, "source": "Sony Music"},
    ],
    
    "latin_extra": [
        {"id": "lat_gasolina", "title": "Daddy Yankee - Gasolina", "video_url": "https://www.youtube.com/embed/CCF1_jI8Prk", "duration_seconds": 219, "source": "Daddy Yankee"},
        {"id": "lat_suavemente", "title": "Elvis Crespo - Suavemente", "video_url": "https://www.youtube.com/embed/WPiEbYSF9kE", "duration_seconds": 224, "source": "Sony Music"},
        {"id": "lat_oye_como", "title": "Santana - Oye Como Va", "video_url": "https://www.youtube.com/embed/J7ATTjg7tpE", "duration_seconds": 265, "source": "Santana"},
        {"id": "lat_conga", "title": "Gloria Estefan - Conga", "video_url": "https://www.youtube.com/embed/54ItEmCnP80", "duration_seconds": 269, "source": "Gloria Estefan"},
        {"id": "lat_livin", "title": "Ricky Martin - Livin' La Vida Loca", "video_url": "https://www.youtube.com/embed/p47fEXGabaY", "duration_seconds": 242, "source": "Ricky Martin"},
        {"id": "lat_obsession", "title": "Aventura - Obsesión", "video_url": "https://www.youtube.com/embed/3BfFvxfAKTQ", "duration_seconds": 259, "source": "Aventura"},
        {"id": "lat_baila_morena", "title": "Hector y Tito - Baila Morena", "video_url": "https://www.youtube.com/embed/gJjH9qKx6Nc", "duration_seconds": 241, "source": "Sony Music"},
    ],
    
    "comedy_extra": [
        {"id": "com_charlie1", "title": "Charlie Chaplin - The Lion's Cage", "video_url": "https://www.youtube.com/embed/6wpbN4lxsF0", "duration_seconds": 240, "source": "Charlie Chaplin"},
        {"id": "com_charlie2", "title": "Charlie Chaplin - Best Funny Scenes", "video_url": "https://www.youtube.com/embed/kNxk8ymutss", "duration_seconds": 300, "source": "Charlie Chaplin"},
        {"id": "com_tom_jerry", "title": "Tom and Jerry - Best Chase Scenes", "video_url": "https://www.youtube.com/embed/CfjGnrdqvAg", "duration_seconds": 240, "source": "Warner Bros"},
        {"id": "com_looney", "title": "Looney Tunes - Best Moments", "video_url": "https://www.youtube.com/embed/g-dJKE0WYzM", "duration_seconds": 300, "source": "Warner Bros"},
    ],
    
    "caribbean_extra": [
        {"id": "carib_closer", "title": "Sean Paul - She Doesn't Mind", "video_url": "https://www.youtube.com/embed/0bOHLqm0_CY", "duration_seconds": 216, "source": "Sean Paul"},
        {"id": "carib_fire", "title": "Sean Paul - Got 2 Luv U ft. Alexis Jordan", "video_url": "https://www.youtube.com/embed/GfGNvEXiw-E", "duration_seconds": 227, "source": "Sean Paul"},
        {"id": "carib_no_lie", "title": "Sean Paul - No Lie ft. Dua Lipa", "video_url": "https://www.youtube.com/embed/GzU8KqOY8YA", "duration_seconds": 223, "source": "Sean Paul"},
        {"id": "carib_shake", "title": "Sean Paul - Shake That Thing", "video_url": "https://www.youtube.com/embed/nZXRV4MezEw", "duration_seconds": 209, "source": "Sean Paul"},
    ],
}

async def check_embeddable(session, video_id, title):
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
            if resp.status == 200:
                return True
            return False
    except:
        return False

async def main():
    print("Checking additional videos...\n")
    
    verified = {}
    
    async with aiohttp.ClientSession() as session:
        for category, videos in ADDITIONAL_VIDEOS.items():
            print(f"\n--- {category.upper()} ---")
            verified[category] = []
            
            for video in videos:
                video_url = video.get("video_url", "")
                video_id = video_url.split("/")[-1].split("?")[0] if video_url else None
                
                if video_id:
                    is_ok = await check_embeddable(session, video_id, video["title"])
                    if is_ok:
                        print(f"  ✅ {video['title'][:45]}")
                        video["thumbnail"] = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
                        verified[category].append(video)
                    else:
                        print(f"  ❌ {video['title'][:45]}")
                    await asyncio.sleep(0.15)
    
    # Save additional verified videos
    print("\n\nAdditional verified videos:")
    for cat, vids in verified.items():
        if vids:
            print(f"  {cat}: {len(vids)} videos")

    # Output Python code
    with open("/app/backend/services/additional_content.py", "w") as f:
        f.write("# Additional verified content\n\n")
        f.write("ADDITIONAL_CONTENT = {\n")
        for cat, vids in verified.items():
            base_cat = cat.replace("_extra", "")
            f.write(f'    "{base_cat}": [\n')
            for v in vids:
                f.write(f'        {{"id": "{v["id"]}", "title": "{v["title"]}", "video_url": "{v["video_url"]}", "thumbnail": "{v.get("thumbnail","")}", "duration_seconds": {v["duration_seconds"]}, "source": "{v["source"]}"}},\n')
            f.write("    ],\n")
        f.write("}\n")
    
    print("\n✅ Saved to /app/backend/services/additional_content.py")

if __name__ == "__main__":
    asyncio.run(main())
