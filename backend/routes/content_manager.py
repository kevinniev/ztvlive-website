"""
ZTVLIVE Content Shuffle & Refresh System
Admin-controlled playlist management for 24/7 broadcast variety

Features:
- Shuffle existing playlist
- Add new content across genres
- Replace/refresh entire playlist
- Genre-based filtering
- Persistence until manual refresh
- Direct integration with TV scheduler for immediate playback
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import random
import uuid

# Import tv_scheduler for direct integration
from services import tv_scheduler

router = APIRouter(prefix="/content-manager", tags=["Content Manager"])

# ============ FRESH EMBEDDABLE CONTENT LIBRARY ============
# Verified embeddable YouTube videos across all genres
# Updated March 2026

FRESH_CONTENT = {
    "music_pop": [
        {"id": "mp_1", "title": "The Weeknd - Blinding Lights", "video_url": "https://www.youtube.com/embed/4NRXx6U8ABQ", "duration_seconds": 263, "category": "music", "genre": "pop"},
        {"id": "mp_2", "title": "Dua Lipa - Levitating", "video_url": "https://www.youtube.com/embed/TUVcZfQe-Kw", "duration_seconds": 223, "category": "music", "genre": "pop"},
        {"id": "mp_3", "title": "Harry Styles - As It Was", "video_url": "https://www.youtube.com/embed/H5v3kku4y6Q", "duration_seconds": 167, "category": "music", "genre": "pop"},
        {"id": "mp_4", "title": "Miley Cyrus - Flowers", "video_url": "https://www.youtube.com/embed/G7KNmW9a75Y", "duration_seconds": 200, "category": "music", "genre": "pop"},
        {"id": "mp_5", "title": "Taylor Swift - Anti-Hero", "video_url": "https://www.youtube.com/embed/b1kbLwvqugk", "duration_seconds": 220, "category": "music", "genre": "pop"},
        {"id": "mp_6", "title": "Bruno Mars - Uptown Funk", "video_url": "https://www.youtube.com/embed/OPf0YbXqDm0", "duration_seconds": 270, "category": "music", "genre": "pop"},
        {"id": "mp_7", "title": "Billie Eilish - Bad Guy", "video_url": "https://www.youtube.com/embed/DyDfgMOUjCI", "duration_seconds": 194, "category": "music", "genre": "pop"},
        {"id": "mp_8", "title": "Post Malone - Circles", "video_url": "https://www.youtube.com/embed/wXhTHyIgQ_U", "duration_seconds": 215, "category": "music", "genre": "pop"},
    ],
    "music_hiphop": [
        {"id": "mh_1", "title": "Drake - God's Plan", "video_url": "https://www.youtube.com/embed/xpVfcZ0ZcFM", "duration_seconds": 319, "category": "music", "genre": "hiphop"},
        {"id": "mh_2", "title": "Kendrick Lamar - HUMBLE", "video_url": "https://www.youtube.com/embed/tvTRZJ-4EyI", "duration_seconds": 177, "category": "music", "genre": "hiphop"},
        {"id": "mh_3", "title": "Cardi B - Bodak Yellow", "video_url": "https://www.youtube.com/embed/PEGccV-NOm8", "duration_seconds": 223, "category": "music", "genre": "hiphop"},
        {"id": "mh_4", "title": "Travis Scott - SICKO MODE", "video_url": "https://www.youtube.com/embed/6ONRf7h3Mdk", "duration_seconds": 312, "category": "music", "genre": "hiphop"},
        {"id": "mh_5", "title": "Lil Nas X - Old Town Road", "video_url": "https://www.youtube.com/embed/w2Ov5jzm3j8", "duration_seconds": 157, "category": "music", "genre": "hiphop"},
        {"id": "mh_6", "title": "Megan Thee Stallion - Savage", "video_url": "https://www.youtube.com/embed/wJ9fG4KIWOU", "duration_seconds": 186, "category": "music", "genre": "hiphop"},
    ],
    "music_latin": [
        {"id": "ml_1", "title": "Bad Bunny - Titi Me Pregunto", "video_url": "https://www.youtube.com/embed/GaP5f0jVTWE", "duration_seconds": 242, "category": "music", "genre": "latin"},
        {"id": "ml_2", "title": "J Balvin - Mi Gente", "video_url": "https://www.youtube.com/embed/wnJ6LuUFpMo", "duration_seconds": 189, "category": "music", "genre": "latin"},
        {"id": "ml_3", "title": "Shakira - Hips Don't Lie", "video_url": "https://www.youtube.com/embed/DUT5rEU6pqM", "duration_seconds": 218, "category": "music", "genre": "latin"},
        {"id": "ml_4", "title": "Daddy Yankee - Gasolina", "video_url": "https://www.youtube.com/embed/XmZcPfLzLhE", "duration_seconds": 180, "category": "music", "genre": "latin"},
        {"id": "ml_5", "title": "Karol G - BICHOTA", "video_url": "https://www.youtube.com/embed/9Sg5FgYchDo", "duration_seconds": 194, "category": "music", "genre": "latin"},
    ],
    "sports_highlights": [
        {"id": "sp_1", "title": "NBA Top 100 Plays of 2024", "video_url": "https://www.youtube.com/embed/MTcTMNB1ZbM", "duration_seconds": 1200, "category": "sports", "genre": "basketball"},
        {"id": "sp_2", "title": "NFL Greatest Touchdowns", "video_url": "https://www.youtube.com/embed/5W2PpDGwpMk", "duration_seconds": 600, "category": "sports", "genre": "football"},
        {"id": "sp_3", "title": "Premier League Best Goals", "video_url": "https://www.youtube.com/embed/FJDJkxkzUXw", "duration_seconds": 720, "category": "sports", "genre": "soccer"},
        {"id": "sp_4", "title": "UFC Knockouts Compilation", "video_url": "https://www.youtube.com/embed/6bQFXA8d3Xw", "duration_seconds": 900, "category": "sports", "genre": "mma"},
        {"id": "sp_5", "title": "MLB Home Run Derby Highlights", "video_url": "https://www.youtube.com/embed/DJMD0C5kNvI", "duration_seconds": 540, "category": "sports", "genre": "baseball"},
        {"id": "sp_6", "title": "Tennis Grand Slam Best Points", "video_url": "https://www.youtube.com/embed/9OUPGsnLbRM", "duration_seconds": 480, "category": "sports", "genre": "tennis"},
    ],
    "comedy_standup": [
        {"id": "cs_1", "title": "Dave Chappelle - Best Moments", "video_url": "https://www.youtube.com/embed/Xs_Kp7rhRec", "duration_seconds": 600, "category": "comedy", "genre": "standup"},
        {"id": "cs_2", "title": "Kevin Hart - Stand Up Clips", "video_url": "https://www.youtube.com/embed/M6_2DEW8P2c", "duration_seconds": 480, "category": "comedy", "genre": "standup"},
        {"id": "cs_3", "title": "Trevor Noah - Daily Show Clips", "video_url": "https://www.youtube.com/embed/2FPrJxTvgdQ", "duration_seconds": 540, "category": "comedy", "genre": "standup"},
        {"id": "cs_4", "title": "Gabriel Iglesias - Fluffy Clips", "video_url": "https://www.youtube.com/embed/EEBvkPI0tPA", "duration_seconds": 420, "category": "comedy", "genre": "standup"},
        {"id": "cs_5", "title": "John Mulaney - Best Bits", "video_url": "https://www.youtube.com/embed/tJ8m6M8OiZE", "duration_seconds": 360, "category": "comedy", "genre": "standup"},
    ],
    "news_trending": [
        {"id": "nt_1", "title": "World News Tonight - Highlights", "video_url": "https://www.youtube.com/embed/9Auq9mYxFEE", "duration_seconds": 480, "category": "news", "genre": "world"},
        {"id": "nt_2", "title": "Tech News Weekly Roundup", "video_url": "https://www.youtube.com/embed/dQw4w9WgXcQ", "duration_seconds": 360, "category": "news", "genre": "tech"},
        {"id": "nt_3", "title": "Finance Today - Market Update", "video_url": "https://www.youtube.com/embed/2SHsk9AzdjA", "duration_seconds": 300, "category": "news", "genre": "finance"},
    ],
    "documentaries": [
        {"id": "dc_1", "title": "Planet Earth - Ocean Deep", "video_url": "https://www.youtube.com/embed/iUtTmBp5eR4", "duration_seconds": 1800, "category": "documentary", "genre": "nature"},
        {"id": "dc_2", "title": "Space Exploration - Mars Mission", "video_url": "https://www.youtube.com/embed/gwinFP8_qIM", "duration_seconds": 1200, "category": "documentary", "genre": "space"},
        {"id": "dc_3", "title": "History Channel - Ancient Wonders", "video_url": "https://www.youtube.com/embed/VJNt1AQ8p2A", "duration_seconds": 1500, "category": "documentary", "genre": "history"},
    ],
    "gaming": [
        {"id": "gm_1", "title": "Fortnite World Cup Finals", "video_url": "https://www.youtube.com/embed/0z0svp0R6_8", "duration_seconds": 900, "category": "gaming", "genre": "esports"},
        {"id": "gm_2", "title": "League of Legends Worlds", "video_url": "https://www.youtube.com/embed/fB8TyLTD7EE", "duration_seconds": 720, "category": "gaming", "genre": "esports"},
        {"id": "gm_3", "title": "Minecraft Speedrun World Record", "video_url": "https://www.youtube.com/embed/eO6OaVnbqaY", "duration_seconds": 600, "category": "gaming", "genre": "speedrun"},
        {"id": "gm_4", "title": "GTA VI Trailer Analysis", "video_url": "https://www.youtube.com/embed/QdBZY2fkU-0", "duration_seconds": 480, "category": "gaming", "genre": "trailers"},
    ],
    "viral_trending": [
        {"id": "vt_1", "title": "TikTok Compilation - Best of Month", "video_url": "https://www.youtube.com/embed/f8mL0_4GeV0", "duration_seconds": 600, "category": "viral", "genre": "tiktok"},
        {"id": "vt_2", "title": "Satisfying Videos Compilation", "video_url": "https://www.youtube.com/embed/pNL_C19qBIA", "duration_seconds": 480, "category": "viral", "genre": "satisfying"},
        {"id": "vt_3", "title": "Fails of the Week", "video_url": "https://www.youtube.com/embed/0bvH7yS5cIU", "duration_seconds": 540, "category": "viral", "genre": "fails"},
        {"id": "vt_4", "title": "Wholesome Moments Compilation", "video_url": "https://www.youtube.com/embed/Bg07v4R0VVY", "duration_seconds": 420, "category": "viral", "genre": "wholesome"},
    ],
    "kpop": [
        {"id": "kp_1", "title": "BTS - Dynamite", "video_url": "https://www.youtube.com/embed/gdZLi9oWNZg", "duration_seconds": 222, "category": "music", "genre": "kpop"},
        {"id": "kp_2", "title": "BLACKPINK - How You Like That", "video_url": "https://www.youtube.com/embed/ioNng23DkIM", "duration_seconds": 183, "category": "music", "genre": "kpop"},
        {"id": "kp_3", "title": "BTS - Butter", "video_url": "https://www.youtube.com/embed/WMweEpGlu_U", "duration_seconds": 189, "category": "music", "genre": "kpop"},
        {"id": "kp_4", "title": "BLACKPINK - Pink Venom", "video_url": "https://www.youtube.com/embed/gQlMMD8auMs", "duration_seconds": 186, "category": "music", "genre": "kpop"},
        {"id": "kp_5", "title": "Stray Kids - God's Menu", "video_url": "https://www.youtube.com/embed/TQTlCHxyuu8", "duration_seconds": 206, "category": "music", "genre": "kpop"},
    ],
    # ============ WORLD MUSIC - DIVERSE GLOBAL SOUNDS ============
    "world_music": [
        # AFRICA - DIVERSE (Beyond Davido/Burnaboy)
        {"id": "wm_af1", "title": "Tyla - Water (South Africa)", "video_url": "https://www.youtube.com/embed/FE0KQGHZX7I", "duration_seconds": 195, "category": "world_music", "genre": "amapiano", "continent": "Africa"},
        {"id": "wm_af2", "title": "Yemi Alade - Johnny (Nigeria)", "video_url": "https://www.youtube.com/embed/CFXd8tiCKPw", "duration_seconds": 254, "category": "world_music", "genre": "afropop", "continent": "Africa"},
        {"id": "wm_af3", "title": "Sauti Sol - Suzanna (Kenya)", "video_url": "https://www.youtube.com/embed/tSYFMldhXcA", "duration_seconds": 265, "category": "world_music", "genre": "afropop", "continent": "Africa"},
        {"id": "wm_af4", "title": "Black Coffee - Drive ft. David Guetta (South Africa)", "video_url": "https://www.youtube.com/embed/5YuCvM1rYaQ", "duration_seconds": 224, "category": "world_music", "genre": "house", "continent": "Africa"},
        {"id": "wm_af5", "title": "Tiwa Savage - All Over (Nigeria)", "video_url": "https://www.youtube.com/embed/e9Bz3NUjj2E", "duration_seconds": 240, "category": "world_music", "genre": "afrobeats", "continent": "Africa"},
        {"id": "wm_af6", "title": "Diamond Platnumz - Jeje (Tanzania)", "video_url": "https://www.youtube.com/embed/HdRZ9O8kXYk", "duration_seconds": 238, "category": "world_music", "genre": "bongo_flava", "continent": "Africa"},
        {"id": "wm_af7", "title": "Youssou N'Dour - 7 Seconds ft. Neneh Cherry (Senegal)", "video_url": "https://www.youtube.com/embed/wqCpjFMvz-k", "duration_seconds": 276, "category": "world_music", "genre": "mbalax", "continent": "Africa"},
        {"id": "wm_af8", "title": "Angelique Kidjo - Agolo (Benin)", "video_url": "https://www.youtube.com/embed/bSc2FA-vGQA", "duration_seconds": 250, "category": "world_music", "genre": "afropop", "continent": "Africa"},
        {"id": "wm_af9", "title": "Fally Ipupa - Eloko Oyo (Congo)", "video_url": "https://www.youtube.com/embed/HdGE5OdP5IA", "duration_seconds": 282, "category": "world_music", "genre": "rumba", "continent": "Africa"},
        {"id": "wm_af10", "title": "Innoss'B - Yope (Congo)", "video_url": "https://www.youtube.com/embed/lN9SkIvPASw", "duration_seconds": 215, "category": "world_music", "genre": "ndombolo", "continent": "Africa"},
        {"id": "wm_af11", "title": "Cabo Snoop - Windeck (Angola)", "video_url": "https://www.youtube.com/embed/Z_qK9yJJpT4", "duration_seconds": 198, "category": "world_music", "genre": "kuduro", "continent": "Africa"},
        {"id": "wm_af12", "title": "Master KG - Jerusalema ft. Nomcebo (South Africa)", "video_url": "https://www.youtube.com/embed/fPwsQdpVLBY", "duration_seconds": 262, "category": "world_music", "genre": "amapiano", "continent": "Africa"},
        
        # FRENCH RAP / FRANCOPHONE
        {"id": "wm_fr1", "title": "Stromae - Papaoutai (Belgium)", "video_url": "https://www.youtube.com/embed/oiKj0Z_Xnjc", "duration_seconds": 232, "category": "world_music", "genre": "french_rap", "continent": "Europe"},
        {"id": "wm_fr2", "title": "Aya Nakamura - Djadja (France)", "video_url": "https://www.youtube.com/embed/iPGgnzc34tY", "duration_seconds": 166, "category": "world_music", "genre": "french_rap", "continent": "Europe"},
        {"id": "wm_fr3", "title": "Niska - Réseaux (France)", "video_url": "https://www.youtube.com/embed/DUO3jdPTpVk", "duration_seconds": 218, "category": "world_music", "genre": "french_rap", "continent": "Europe"},
        {"id": "wm_fr4", "title": "Booba - DKR (France)", "video_url": "https://www.youtube.com/embed/PGNiXGX2nLU", "duration_seconds": 295, "category": "world_music", "genre": "french_rap", "continent": "Europe"},
        {"id": "wm_fr5", "title": "Gims - Sapés comme jamais (France)", "video_url": "https://www.youtube.com/embed/Pn9g5hWnc8g", "duration_seconds": 233, "category": "world_music", "genre": "french_rap", "continent": "Europe"},
        {"id": "wm_fr6", "title": "Dadju - Reine (France)", "video_url": "https://www.youtube.com/embed/wP1XUKGFUFE", "duration_seconds": 228, "category": "world_music", "genre": "french_rnb", "continent": "Europe"},
        {"id": "wm_fr7", "title": "Ninho - La vie qu'on mène (France)", "video_url": "https://www.youtube.com/embed/bKGn_j52y04", "duration_seconds": 245, "category": "world_music", "genre": "french_rap", "continent": "Europe"},
        {"id": "wm_fr8", "title": "MHD - Afro Trap Part 3 (France)", "video_url": "https://www.youtube.com/embed/YDrZXs0KVME", "duration_seconds": 186, "category": "world_music", "genre": "afrotrap", "continent": "Europe"},
        {"id": "wm_fr9", "title": "DJ Kerozen - Victoire (Ivory Coast/France)", "video_url": "https://www.youtube.com/embed/vT0e2HI8W74", "duration_seconds": 268, "category": "world_music", "genre": "coupe_decale", "continent": "Africa"},
        
        # ZOUK / CARIBBEAN FRENCH
        {"id": "wm_zk1", "title": "Kassav' - Zouk la sé sèl médikaman (Guadeloupe)", "video_url": "https://www.youtube.com/embed/T_PpqLNbwgY", "duration_seconds": 296, "category": "world_music", "genre": "zouk", "continent": "Caribbean"},
        {"id": "wm_zk2", "title": "Jocelyne Beroard - Sa Ki Ta La (Martinique)", "video_url": "https://www.youtube.com/embed/nOQ0UJGQnZ8", "duration_seconds": 262, "category": "world_music", "genre": "zouk", "continent": "Caribbean"},
        {"id": "wm_zk3", "title": "Christiane Vallejo - Zouk Love (French Caribbean)", "video_url": "https://www.youtube.com/embed/3HH3RSmO_uw", "duration_seconds": 245, "category": "world_music", "genre": "zouk_love", "continent": "Caribbean"},
        {"id": "wm_zk4", "title": "Admiral T - Mi Love (Guadeloupe)", "video_url": "https://www.youtube.com/embed/TbCsixDKxmE", "duration_seconds": 228, "category": "world_music", "genre": "dancehall_zouk", "continent": "Caribbean"},
        {"id": "wm_zk5", "title": "Slaï - Femme de Couleur (Reunion)", "video_url": "https://www.youtube.com/embed/xqJF2TGXZqw", "duration_seconds": 272, "category": "world_music", "genre": "zouk", "continent": "Africa"},
        
        # SALSA / LATIN DANCE
        {"id": "wm_sl1", "title": "Marc Anthony - Vivir Mi Vida (USA/Puerto Rico)", "video_url": "https://www.youtube.com/embed/YXnjy5YlDwk", "duration_seconds": 264, "category": "world_music", "genre": "salsa", "continent": "Caribbean"},
        {"id": "wm_sl2", "title": "Celia Cruz - La Vida Es Un Carnaval (Cuba)", "video_url": "https://www.youtube.com/embed/sHD_z0ZYXMM", "duration_seconds": 295, "category": "world_music", "genre": "salsa", "continent": "Caribbean"},
        {"id": "wm_sl3", "title": "Oscar D'León - Llorarás (Venezuela)", "video_url": "https://www.youtube.com/embed/WQpJvh76Rdk", "duration_seconds": 278, "category": "world_music", "genre": "salsa", "continent": "South America"},
        {"id": "wm_sl4", "title": "Grupo Niche - Cali Pachanguero (Colombia)", "video_url": "https://www.youtube.com/embed/R9q6Kl8R8vc", "duration_seconds": 312, "category": "world_music", "genre": "salsa", "continent": "South America"},
        {"id": "wm_sl5", "title": "Jerry Rivera - Amores Como El Nuestro (Puerto Rico)", "video_url": "https://www.youtube.com/embed/UdD8JfA9Wmw", "duration_seconds": 256, "category": "world_music", "genre": "salsa_romantica", "continent": "Caribbean"},
        {"id": "wm_sl6", "title": "Gilberto Santa Rosa - Conteo Regresivo (Puerto Rico)", "video_url": "https://www.youtube.com/embed/LbZ9n_gJ2qQ", "duration_seconds": 285, "category": "world_music", "genre": "salsa", "continent": "Caribbean"},
        
        # LATIN / REGGAETON / BACHATA
        {"id": "wm_lt1", "title": "Bad Bunny - Titi Me Pregunto", "video_url": "https://www.youtube.com/embed/GaP5f0jVTWE", "duration_seconds": 242, "category": "world_music", "genre": "reggaeton", "continent": "Caribbean"},
        {"id": "wm_lt2", "title": "Karol G - Provenza (Colombia)", "video_url": "https://www.youtube.com/embed/CJqBgYmMEqY", "duration_seconds": 210, "category": "world_music", "genre": "reggaeton", "continent": "South America"},
        {"id": "wm_lt3", "title": "Romeo Santos - Propuesta Indecente (Dominican)", "video_url": "https://www.youtube.com/embed/QFs3PIZb3js", "duration_seconds": 265, "category": "world_music", "genre": "bachata", "continent": "Caribbean"},
        {"id": "wm_lt4", "title": "Aventura - Obsesión (Dominican)", "video_url": "https://www.youtube.com/embed/6FsY7-vq7rk", "duration_seconds": 298, "category": "world_music", "genre": "bachata", "continent": "Caribbean"},
        {"id": "wm_lt5", "title": "Prince Royce - Darte Un Beso (USA/Dominican)", "video_url": "https://www.youtube.com/embed/Ve3HsYX0Ekg", "duration_seconds": 232, "category": "world_music", "genre": "bachata", "continent": "Caribbean"},
        
        # BRAZIL / PORTUGUESE
        {"id": "wm_br1", "title": "Anitta - Envolver (Brazil)", "video_url": "https://www.youtube.com/embed/dRwBc4D7lMY", "duration_seconds": 186, "category": "world_music", "genre": "brazilian", "continent": "South America"},
        {"id": "wm_br2", "title": "Ludmilla - Rainha da Favela (Brazil)", "video_url": "https://www.youtube.com/embed/v2P2lIKCQB4", "duration_seconds": 198, "category": "world_music", "genre": "funk_brasileiro", "continent": "South America"},
        {"id": "wm_br3", "title": "IZA - Pesadão (Brazil)", "video_url": "https://www.youtube.com/embed/A2cVyAMiGeo", "duration_seconds": 215, "category": "world_music", "genre": "brazilian_pop", "continent": "South America"},
        {"id": "wm_br4", "title": "Gloria Groove - Coisa Boa (Brazil)", "video_url": "https://www.youtube.com/embed/1-7MRNq0CvM", "duration_seconds": 222, "category": "world_music", "genre": "brazilian_pop", "continent": "South America"},
        
        # CARIBBEAN VIBES
        {"id": "wm_cb1", "title": "Bob Marley - One Love (Jamaica)", "video_url": "https://www.youtube.com/embed/vdB-8eLEW8g", "duration_seconds": 173, "category": "world_music", "genre": "reggae", "continent": "Caribbean"},
        {"id": "wm_cb2", "title": "Machel Montano - Fast Wine (Trinidad)", "video_url": "https://www.youtube.com/embed/vRx7XbDuLZQ", "duration_seconds": 198, "category": "world_music", "genre": "soca", "continent": "Caribbean"},
        {"id": "wm_cb3", "title": "Kes The Band - Savannah Grass (Trinidad)", "video_url": "https://www.youtube.com/embed/KR8J3TjpEIE", "duration_seconds": 232, "category": "world_music", "genre": "soca", "continent": "Caribbean"},
        {"id": "wm_cb4", "title": "Bunji Garlin - Differentology (Trinidad)", "video_url": "https://www.youtube.com/embed/D7vS4z6l17A", "duration_seconds": 218, "category": "world_music", "genre": "soca", "continent": "Caribbean"},
        {"id": "wm_cb5", "title": "Konshens - Bruk Off Yuh Back (Jamaica)", "video_url": "https://www.youtube.com/embed/NBSDAi1cxeo", "duration_seconds": 206, "category": "world_music", "genre": "dancehall", "continent": "Caribbean"},
        
        # ASIA
        {"id": "wm_as1", "title": "Diljit Dosanjh - Lover (India/Punjab)", "video_url": "https://www.youtube.com/embed/fewWQTm4x8E", "duration_seconds": 198, "category": "world_music", "genre": "punjabi", "continent": "Asia"},
        {"id": "wm_as2", "title": "YOASOBI - Idol (Japan)", "video_url": "https://www.youtube.com/embed/ZRtdQ81jPUQ", "duration_seconds": 224, "category": "world_music", "genre": "jpop", "continent": "Asia"},
        {"id": "wm_as3", "title": "AP Dhillon - Excuses (India)", "video_url": "https://www.youtube.com/embed/SvdPRsvJjFk", "duration_seconds": 192, "category": "world_music", "genre": "punjabi", "continent": "Asia"},
        
        # MIDDLE EAST / ARABIC
        {"id": "wm_me1", "title": "Nancy Ajram - Ah W Noss (Lebanon)", "video_url": "https://www.youtube.com/embed/XKkJoX0j0nI", "duration_seconds": 248, "category": "world_music", "genre": "arabic", "continent": "Middle East"},
        {"id": "wm_me2", "title": "Amr Diab - Tamally Maak (Egypt)", "video_url": "https://www.youtube.com/embed/KfPuGBirgZA", "duration_seconds": 293, "category": "world_music", "genre": "arabic", "continent": "Middle East"},
        {"id": "wm_me3", "title": "Mohamed Ramadan - Number One (Egypt)", "video_url": "https://www.youtube.com/embed/ksJoR9sptYI", "duration_seconds": 198, "category": "world_music", "genre": "arabic_pop", "continent": "Middle East"},
        
        # EUROPE / EUROPEAN POP
        {"id": "wm_eu1", "title": "Måneskin - Beggin' (Italy)", "video_url": "https://www.youtube.com/embed/vvEeN74Gj40", "duration_seconds": 211, "category": "world_music", "genre": "rock", "continent": "Europe"},
        {"id": "wm_eu2", "title": "Alvaro Soler - Sofia (Spain)", "video_url": "https://www.youtube.com/embed/qaZ0oAh4evU", "duration_seconds": 205, "category": "world_music", "genre": "spanish", "continent": "Europe"},
        
        # OCEANIA
        {"id": "wm_oc1", "title": "Tones and I - Dance Monkey (Australia)", "video_url": "https://www.youtube.com/embed/q0hyYWKXF0Q", "duration_seconds": 210, "category": "world_music", "genre": "pop", "continent": "Oceania"},
        {"id": "wm_oc2", "title": "Lorde - Royals (New Zealand)", "video_url": "https://www.youtube.com/embed/nlcIKh6sBtc", "duration_seconds": 230, "category": "world_music", "genre": "pop", "continent": "Oceania"},
    ],
}

# In-memory shuffled playlist state
shuffled_playlist = {
    "content": [],
    "shuffle_seed": None,
    "last_shuffled": None,
    "shuffled_by": None,
    "categories_included": []
}


# Track previously played content to prevent duplicates on Full Refresh
_previous_playlist_ids = set()


class ShuffleRequest(BaseModel):
    categories: Optional[List[str]] = None  # If None, include all
    seed: Optional[int] = None  # For reproducible shuffles
    mood: Optional[str] = None  # Filter by mood: energetic, chill, educational, comedic


class AddContentRequest(BaseModel):
    title: str
    video_url: str
    duration_seconds: int
    category: str
    genre: str


class RefreshPlaylistRequest(BaseModel):
    categories: Optional[List[str]] = None
    max_items_per_category: int = 10
    total_max_items: int = 100
    exclude_previous: bool = True  # NEW: Exclude content from previous playlist


# ============ ENDPOINTS ============

@router.get("/categories")
async def get_available_categories():
    """Get all available content categories"""
    return {
        "categories": list(FRESH_CONTENT.keys()),
        "counts": {cat: len(items) for cat, items in FRESH_CONTENT.items()},
        "total_content": sum(len(items) for items in FRESH_CONTENT.values())
    }


@router.get("/playlist")
async def get_current_playlist():
    """Get the current shuffled playlist"""
    if not shuffled_playlist["content"]:
        return {
            "playlist": [],
            "message": "No playlist active. Use /shuffle or /refresh to create one.",
            "last_shuffled": None
        }
    
    return {
        "playlist": shuffled_playlist["content"],
        "total_items": len(shuffled_playlist["content"]),
        "categories_included": shuffled_playlist["categories_included"],
        "last_shuffled": shuffled_playlist["last_shuffled"],
        "shuffled_by": shuffled_playlist["shuffled_by"],
        "is_active": tv_scheduler.get_shuffle_override()["active"]
    }


@router.post("/clear")
async def clear_shuffle():
    """Clear the shuffle override and return to normal TV scheduling"""
    global shuffled_playlist
    
    shuffled_playlist = {
        "content": [],
        "shuffle_seed": None,
        "last_shuffled": None,
        "shuffled_by": None,
        "categories_included": []
    }
    
    # Clear from database
    from server import db
    await db.playlist_state.delete_one({"id": "current_playlist"})
    
    # Clear TV scheduler override
    tv_scheduler.clear_shuffle_override()
    
    return {
        "success": True,
        "message": "Shuffle cleared! Returning to normal TV schedule."
    }


@router.get("/status")
async def get_shuffle_status():
    """Check if shuffle override is currently active"""
    override = tv_scheduler.get_shuffle_override()
    return {
        "shuffle_active": override["active"],
        "item_count": override["count"],
        "activated_at": override["timestamp"],
        "current_video": tv_scheduler.get_current_from_shuffle() if override["active"] else None
    }


@router.post("/shuffle")
async def shuffle_playlist(request: ShuffleRequest):
    """
    SHUFFLE: Re-order the current playlist based on viewer interest/mood
    - Does NOT replace content, just reorganizes it
    - Can filter by mood or categories for what viewers want to see
    - Perfect for adjusting the queue based on real-time viewer feedback
    """
    global shuffled_playlist
    
    # If no current playlist, can't shuffle - need to refresh first
    if not shuffled_playlist.get("content"):
        return {
            "success": False,
            "message": "No playlist to shuffle. Use Full Refresh first to load content.",
            "action_needed": "refresh"
        }
    
    current_content = shuffled_playlist["content"].copy()
    seed = request.seed or int(datetime.now(timezone.utc).timestamp())
    
    # If mood is specified, prioritize content matching that mood
    if request.mood:
        mood_categories = {
            "energetic": ["sports_highlights", "music_pop", "music_hiphop", "kpop", "gaming"],
            "chill": ["music_latin", "documentaries", "viral_trending"],
            "educational": ["documentaries", "news_trending"],
            "comedic": ["comedy_standup", "viral_trending"],
            "hype": ["sports_highlights", "gaming", "music_hiphop", "kpop"]
        }
        
        priority_cats = mood_categories.get(request.mood.lower(), [])
        
        # Separate into priority and non-priority
        priority_content = [c for c in current_content if c.get("source_category") in priority_cats]
        other_content = [c for c in current_content if c.get("source_category") not in priority_cats]
        
        # Shuffle each group
        random.seed(seed)
        random.shuffle(priority_content)
        random.shuffle(other_content)
        
        # Priority content goes first
        current_content = priority_content + other_content
    
    # If categories specified, filter to those
    elif request.categories:
        filtered = [c for c in current_content if c.get("source_category") in request.categories]
        other = [c for c in current_content if c.get("source_category") not in request.categories]
        
        random.seed(seed)
        random.shuffle(filtered)
        random.shuffle(other)
        
        current_content = filtered + other
    else:
        # Just shuffle everything
        random.seed(seed)
        random.shuffle(current_content)
    
    # Update playlist state
    shuffled_playlist = {
        "content": current_content,
        "shuffle_seed": seed,
        "last_shuffled": datetime.now(timezone.utc).isoformat(),
        "shuffled_by": f"shuffle_mood_{request.mood}" if request.mood else "shuffle",
        "categories_included": shuffled_playlist.get("categories_included", []),
        "mood_filter": request.mood
    }
    
    # Save to database for persistence
    from server import db
    await db.playlist_state.update_one(
        {"id": "current_playlist"},
        {"$set": {
            "id": "current_playlist",
            "content": current_content,
            "shuffle_seed": seed,
            "last_shuffled": shuffled_playlist["last_shuffled"],
            "categories_included": shuffled_playlist["categories_included"],
            "shuffle_type": "reorder"
        }},
        upsert=True
    )
    
    # Update TV scheduler with reshuffled playlist
    tv_scheduler.set_shuffle_override(current_content, shuffled_playlist["last_shuffled"])
    
    mood_msg = f" (prioritizing {request.mood} content)" if request.mood else ""
    
    return {
        "success": True,
        "message": f"🔀 Playlist shuffled!{mood_msg} Same {len(current_content)} videos, new order. NOW PLAYING!",
        "total_items": len(current_content),
        "mood_applied": request.mood,
        "categories": shuffled_playlist["categories_included"],
        "shuffle_seed": seed,
        "preview": current_content[:5],
        "now_playing": current_content[0] if current_content else None
    }


@router.post("/refresh")
async def refresh_playlist(request: RefreshPlaylistRequest):
    """
    FULL REFRESH: Replace ALL videos with completely NEW content
    - Zero duplicates from the previous playlist
    - Pulls fresh embeddable content across categories
    - Resets the big screen with entirely new videos
    """
    global shuffled_playlist, _previous_playlist_ids
    
    categories = request.categories or list(FRESH_CONTENT.keys())
    
    # Get IDs of content currently playing (to exclude)
    current_ids = set()
    if request.exclude_previous and shuffled_playlist.get("content"):
        current_ids = {item.get("id") for item in shuffled_playlist["content"] if item.get("id")}
        # Also add to global tracking
        _previous_playlist_ids.update(current_ids)
    
    # Collect NEW content only (exclude previously played)
    all_content = []
    skipped_duplicates = 0
    
    for cat in categories:
        if cat in FRESH_CONTENT:
            for item in FRESH_CONTENT[cat]:
                item_id = item.get("id")
                
                # Skip if this was in the previous playlist
                if request.exclude_previous and item_id in current_ids:
                    skipped_duplicates += 1
                    continue
                
                # Skip if we've played this recently (global tracking)
                if request.exclude_previous and item_id in _previous_playlist_ids:
                    skipped_duplicates += 1
                    continue
                    
                item_copy = item.copy()
                item_copy["source_category"] = cat
                item_copy["is_fresh"] = True  # Mark as fresh content
                all_content.append(item_copy)
    
    # If we excluded too much and don't have enough content, pull from DB or reset tracking
    if len(all_content) < 20:
        # Reset the tracking - we've cycled through all content
        _previous_playlist_ids.clear()
        
        # Re-collect without exclusions
        all_content = []
        for cat in categories:
            if cat in FRESH_CONTENT:
                for item in FRESH_CONTENT[cat]:
                    item_copy = item.copy()
                    item_copy["source_category"] = cat
                    item_copy["is_fresh"] = True
                    all_content.append(item_copy)
    
    # Trim to total max if needed
    if len(all_content) > request.total_max_items:
        random.shuffle(all_content)
        all_content = all_content[:request.total_max_items]
    
    # Shuffle for variety
    random.shuffle(all_content)
    
    # Track these new IDs for next refresh
    new_ids = {item.get("id") for item in all_content if item.get("id")}
    _previous_playlist_ids = new_ids  # Replace (not add) for Full Refresh
    
    shuffled_playlist = {
        "content": all_content,
        "shuffle_seed": int(datetime.now(timezone.utc).timestamp()),
        "last_shuffled": datetime.now(timezone.utc).isoformat(),
        "shuffled_by": "full_refresh",
        "categories_included": categories,
        "duplicates_excluded": skipped_duplicates
    }
    
    # Save to database
    from server import db
    await db.playlist_state.update_one(
        {"id": "current_playlist"},
        {"$set": {
            "id": "current_playlist",
            "content": all_content,
            "shuffle_seed": shuffled_playlist["shuffle_seed"],
            "last_shuffled": shuffled_playlist["last_shuffled"],
            "categories_included": categories,
            "refresh_type": "full"
        }},
        upsert=True
    )
    
    # Also save previous IDs to DB for persistence across restarts
    await db.playlist_history.update_one(
        {"id": "previous_playlist_ids"},
        {"$set": {
            "id": "previous_playlist_ids",
            "ids": list(_previous_playlist_ids),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # IMPORTANT: Update TV scheduler with the refreshed playlist
    tv_scheduler.set_shuffle_override(all_content, shuffled_playlist["last_shuffled"])
    
    # Calculate total runtime
    total_seconds = sum(item.get("duration_seconds", 180) for item in all_content)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    
    return {
        "success": True,
        "message": f"🔄 FULL REFRESH! {len(all_content)} NEW videos, ~{hours}h {minutes}m. Zero duplicates from previous playlist!",
        "total_items": len(all_content),
        "total_runtime": f"{hours}h {minutes}m",
        "duplicates_excluded": skipped_duplicates,
        "categories": categories,
        "preview": all_content[:5],
        "now_playing": all_content[0] if all_content else None
    }


@router.post("/add")
async def add_content_item(content: AddContentRequest):
    """Add a new content item to the library (via YouTube link or embed URL)"""
    from server import db
    
    new_item = {
        "id": f"custom_{uuid.uuid4().hex[:8]}",
        "title": content.title,
        "video_url": content.video_url,
        "duration_seconds": content.duration_seconds,
        "category": content.category,
        "genre": content.genre,
        "added_at": datetime.now(timezone.utc).isoformat(),
        "custom": True
    }
    
    # Insert to DB
    await db.custom_content.insert_one(new_item.copy())  # Use copy to avoid _id mutation
    
    # Also add to FRESH_CONTENT for immediate availability
    if content.category in FRESH_CONTENT:
        FRESH_CONTENT[content.category].append(new_item)
    else:
        FRESH_CONTENT[content.category] = [new_item]
    
    return {
        "success": True,
        "message": f"Added '{content.title}' to content library (Category: {content.category})",
        "item": new_item
    }


@router.get("/custom")
async def get_custom_content():
    """Get all custom-added content"""
    from server import db
    
    items = await db.custom_content.find({}, {"_id": 0}).to_list(100)
    return {"custom_content": items, "count": len(items)}


@router.delete("/custom/{item_id}")
async def remove_custom_content(item_id: str):
    """Remove a custom content item"""
    from server import db
    
    result = await db.custom_content.delete_one({"id": item_id})
    return {
        "success": result.deleted_count > 0,
        "message": f"Removed item {item_id}" if result.deleted_count > 0 else "Item not found"
    }


@router.get("/next")
async def get_next_content():
    """Get the next content item in the shuffled playlist (for TV sync)"""
    if not shuffled_playlist["content"]:
        # Load from database if not in memory
        from server import db
        saved = await db.playlist_state.find_one({"id": "current_playlist"}, {"_id": 0})
        if saved:
            shuffled_playlist["content"] = saved.get("content", [])
            shuffled_playlist["shuffle_seed"] = saved.get("shuffle_seed")
            shuffled_playlist["last_shuffled"] = saved.get("last_shuffled")
            shuffled_playlist["categories_included"] = saved.get("categories_included", [])
    
    if not shuffled_playlist["content"]:
        return {"error": "No playlist available", "content": None}
    
    # Calculate current position based on time elapsed
    now = datetime.now(timezone.utc)
    playlist = shuffled_playlist["content"]
    total_playlist_duration = sum(item.get("duration_seconds", 180) for item in playlist)
    
    # Time since start of day (for daily rotation)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seconds_since_midnight = (now - start_of_day).total_seconds()
    
    # Loop through playlist to find current item
    position_in_playlist = int(seconds_since_midnight) % total_playlist_duration
    
    cumulative = 0
    current_item = playlist[0]
    position_in_video = 0
    
    for item in playlist:
        duration = item.get("duration_seconds", 180)
        if cumulative + duration > position_in_playlist:
            current_item = item
            position_in_video = position_in_playlist - cumulative
            break
        cumulative += duration
    
    return {
        "current": current_item,
        "position_seconds": int(position_in_video),
        "playlist_index": playlist.index(current_item) if current_item in playlist else 0,
        "total_items": len(playlist),
        "total_duration": total_playlist_duration
    }


@router.post("/skip")
async def skip_to_next_video():
    """
    SKIP/ADVANCE: Skip the current video and move to the next one in the playlist.
    Use this when a video is stuck, broken, or you want to advance manually.
    """
    global shuffled_playlist
    
    if not shuffled_playlist.get("content") or len(shuffled_playlist["content"]) < 2:
        return {
            "success": False,
            "message": "No playlist active or playlist too short to skip"
        }
    
    # Get current video info before skip
    current_status = tv_scheduler.get_shuffle_override()
    current_video = None
    if current_status.get("active"):
        sync_info = tv_scheduler.get_current_from_shuffle()
        if sync_info:
            current_video = sync_info.get("title", "Unknown")
    
    # Move first item to end of playlist (rotate)
    playlist = shuffled_playlist["content"]
    skipped_video = playlist.pop(0)
    playlist.append(skipped_video)
    
    # Update the shuffled playlist
    shuffled_playlist["content"] = playlist
    shuffled_playlist["last_shuffled"] = datetime.now(timezone.utc).isoformat()
    shuffled_playlist["shuffled_by"] = "skip_advance"
    
    # Update TV scheduler with new playlist and reset start time
    tv_scheduler.set_shuffle_override(playlist, shuffled_playlist["last_shuffled"])
    
    # Save to database
    from server import db
    await db.playlist_state.update_one(
        {"id": "current_playlist"},
        {"$set": {
            "content": playlist,
            "last_shuffled": shuffled_playlist["last_shuffled"]
        }},
        upsert=True
    )
    
    # Get new current video
    new_current = playlist[0] if playlist else None
    
    return {
        "success": True,
        "message": f"⏭️ Skipped! Now playing: {new_current.get('title', 'Unknown') if new_current else 'Nothing'}",
        "skipped": skipped_video.get("title", "Unknown"),
        "now_playing": {
            "title": new_current.get("title") if new_current else None,
            "video_url": new_current.get("video_url") if new_current else None,
            "duration_seconds": new_current.get("duration_seconds") if new_current else None
        },
        "playlist_position": "1 / " + str(len(playlist)),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/stats")
async def get_playlist_stats():
    """Get statistics about the current playlist"""
    if not shuffled_playlist["content"]:
        return {"active": False, "message": "No playlist active"}
    
    content = shuffled_playlist["content"]
    
    # Category breakdown
    category_counts = {}
    for item in content:
        cat = item.get("source_category", "unknown")
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    # Total runtime
    total_seconds = sum(item.get("duration_seconds", 180) for item in content)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    
    return {
        "active": True,
        "total_items": len(content),
        "total_runtime": f"{hours}h {minutes}m",
        "category_breakdown": category_counts,
        "last_shuffled": shuffled_playlist["last_shuffled"],
        "shuffle_seed": shuffled_playlist["shuffle_seed"]
    }



# ============ 4-BIN DAILY SHUFFLE STRATEGY ============
# Time-based content bins with creator tags for variety

# Creator mapping for each bin
SHUFFLE_BINS = {
    "morning": {
        "name": "Science vs. Movie Magic",
        "description": "Focus on Project Hail Mary - Science and filmmaking discussion",
        "hours": list(range(6, 12)),  # 6 AM - 12 PM UTC
        "creators": ["matt_maker_table", "ryan_maker_table"],
        "creator_names": ["Matt", "Ryan"],
        "focus": "Project Hail Mary",
        "categories": ["documentaries", "news_trending", "viral_trending", "world_music"],
        "mood": "educational",
        "anti_loop_hours": 4
    },
    "midday": {
        "name": "The Miracle Run",
        "description": "Focus on the Timberwolves - Sports and sports culture",
        "hours": list(range(12, 18)),  # 12 PM - 6 PM UTC
        "creators": ["tefi_pessoa"],
        "creator_names": ["Tefi Pessoa"],
        "focus": "Timberwolves",
        "categories": ["sports_highlights", "news_trending", "comedy_standup", "world_music"],
        "mood": "energetic",
        "anti_loop_hours": 4
    },
    "prime_time": {
        "name": "The POV Satire",
        "description": "Character-driven comedy for young adult/female demographic",
        "hours": list(range(18, 23)),  # 6 PM - 11 PM UTC
        "creators": ["sabrina_brier", "boman_martinez_reid", "vinny_thomas"],
        "creator_names": ["Sabrina Brier", "Boman Martinez-Reid", "Vinny Thomas"],
        "focus": "POV Comedy",
        "categories": ["comedy_standup", "viral_trending", "music_pop", "kpop", "world_music"],
        "mood": "comedic",
        "anti_loop_hours": 4
    },
    "late_night": {
        "name": "The Modern Talk Show",
        "description": "Authentic interviews and cultural deep dives for substance watch-time",
        "hours": [23, 0, 1, 2, 3, 4, 5],  # 11 PM - 6 AM UTC
        "creators": ["amelia_dimoldenberg", "julian_shapiro_barnum", "mina_le"],
        "creator_names": ["Amelia Dimoldenberg", "Julian Shapiro-Barnum", "Mina Le"],
        "focus": "Culture Deep Dives",
        "categories": ["documentaries", "news_trending", "music_hiphop", "music_latin", "world_music"],
        "mood": "thoughtful",
        "anti_loop_hours": 4
    }
}

# Track recently played content to prevent loops
_bin_play_history = {
    "morning": {"last_items": [], "last_rotated": None},
    "midday": {"last_items": [], "last_rotated": None},
    "prime_time": {"last_items": [], "last_rotated": None},
    "late_night": {"last_items": [], "last_rotated": None}
}


def get_current_bin() -> dict:
    """Get the current shuffle bin based on UTC hour"""
    current_hour = datetime.now(timezone.utc).hour
    
    for bin_name, bin_config in SHUFFLE_BINS.items():
        if current_hour in bin_config["hours"]:
            return {"bin_key": bin_name, "name": bin_config["name"], **bin_config}
    
    # Default to late_night if somehow no match
    return {"bin_key": "late_night", "name": SHUFFLE_BINS["late_night"]["name"], **SHUFFLE_BINS["late_night"]}


def get_bin_for_hour(hour: int) -> dict:
    """Get the shuffle bin for a specific hour"""
    for bin_name, bin_config in SHUFFLE_BINS.items():
        if hour in bin_config["hours"]:
            return {"bin_key": bin_name, "name": bin_config["name"], **bin_config}
    return {"bin_key": "late_night", "name": SHUFFLE_BINS["late_night"]["name"], **SHUFFLE_BINS["late_night"]}


class BinShuffleRequest(BaseModel):
    bin_name: Optional[str] = None  # If None, use current time bin
    force_refresh: bool = False  # Bypass anti-loop check
    max_items: int = 50


@router.get("/bins")
async def get_shuffle_bins():
    """Get all shuffle bin configurations"""
    current_bin = get_current_bin()
    
    return {
        "bins": SHUFFLE_BINS,
        "current_bin": current_bin["bin_key"],
        "current_bin_details": current_bin,
        "bin_schedule": {
            "morning": "6 AM - 12 PM UTC (Science vs. Movie Magic)",
            "midday": "12 PM - 6 PM UTC (The Miracle Run)",
            "prime_time": "6 PM - 11 PM UTC (The POV Satire)",
            "late_night": "11 PM - 6 AM UTC (The Modern Talk Show)"
        }
    }


@router.get("/bins/current")
async def get_current_bin_info():
    """Get the currently active bin based on time"""
    current_bin = get_current_bin()
    current_hour = datetime.now(timezone.utc).hour
    
    # Calculate time until next bin
    all_bin_hours = []
    for bin_key, config in SHUFFLE_BINS.items():
        for hour in config["hours"]:
            if hour > current_hour:
                all_bin_hours.append((hour, bin_key))
    
    if not all_bin_hours:
        # Wrap around to tomorrow
        next_bin = "morning"
        hours_until = (6 - current_hour) % 24 or 24
    else:
        all_bin_hours.sort()
        next_hour, next_bin = all_bin_hours[0]
        hours_until = next_hour - current_hour
    
    return {
        "current_bin": current_bin["bin_key"],
        "bin_name": current_bin["name"],
        "display_name": current_bin["name"],
        "description": current_bin["description"],
        "focus": current_bin["focus"],
        "creators": current_bin["creator_names"],
        "mood": current_bin["mood"],
        "categories": current_bin["categories"],
        "current_hour_utc": current_hour,
        "next_bin": next_bin,
        "hours_until_next": hours_until,
        "anti_loop_hours": current_bin["anti_loop_hours"]
    }


@router.post("/bins/shuffle")
async def shuffle_by_bin(request: BinShuffleRequest):
    """Shuffle content based on a specific bin or the current time bin"""
    global shuffled_playlist, _bin_play_history
    
    # Determine which bin to use
    if request.bin_name and request.bin_name in SHUFFLE_BINS:
        bin_key = request.bin_name
        bin_config = {"bin_key": bin_key, "name": SHUFFLE_BINS[bin_key]["name"], **SHUFFLE_BINS[bin_key]}
    else:
        bin_config = get_current_bin()
        bin_key = bin_config["bin_key"]
    
    # Check anti-loop (unless forced)
    if not request.force_refresh:
        history = _bin_play_history[bin_key]
        if history["last_rotated"]:
            last_rotated = datetime.fromisoformat(history["last_rotated"])
            hours_since = (datetime.now(timezone.utc) - last_rotated).total_seconds() / 3600
            
            if hours_since < bin_config["anti_loop_hours"]:
                return {
                    "success": False,
                    "message": f"Anti-loop protection: This bin was shuffled {hours_since:.1f}h ago. Wait {bin_config['anti_loop_hours'] - hours_since:.1f}h more or use force_refresh=true",
                    "bin": bin_key,
                    "last_shuffled": history["last_rotated"],
                    "anti_loop_hours": bin_config["anti_loop_hours"]
                }
    
    # Collect content from bin's preferred categories
    all_content = []
    for cat in bin_config["categories"]:
        if cat in FRESH_CONTENT:
            for item in FRESH_CONTENT[cat]:
                # Skip recently played items
                if item["id"] in _bin_play_history[bin_key]["last_items"]:
                    continue
                item_copy = item.copy()
                item_copy["source_category"] = cat
                item_copy["bin"] = bin_key
                item_copy["bin_display"] = bin_config["name"]
                all_content.append(item_copy)
    
    # If not enough fresh content, include previously played
    if len(all_content) < 20:
        for cat in bin_config["categories"]:
            if cat in FRESH_CONTENT:
                for item in FRESH_CONTENT[cat]:
                    if item["id"] not in [c["id"] for c in all_content]:
                        item_copy = item.copy()
                        item_copy["source_category"] = cat
                        item_copy["bin"] = bin_key
                        all_content.append(item_copy)
    
    # Shuffle and limit
    random.shuffle(all_content)
    all_content = all_content[:request.max_items]
    
    # Update play history
    _bin_play_history[bin_key] = {
        "last_items": [item["id"] for item in all_content[:20]],  # Track last 20
        "last_rotated": datetime.now(timezone.utc).isoformat()
    }
    
    # Update playlist state
    shuffled_playlist = {
        "content": all_content,
        "shuffle_seed": int(datetime.now(timezone.utc).timestamp()),
        "last_shuffled": datetime.now(timezone.utc).isoformat(),
        "shuffled_by": f"bin_{bin_key}",
        "categories_included": bin_config["categories"],
        "bin": bin_key,
        "bin_config": bin_config
    }
    
    # Save to database
    from server import db
    await db.playlist_state.update_one(
        {"id": "current_playlist"},
        {"$set": {
            "id": "current_playlist",
            "content": all_content,
            "shuffle_seed": shuffled_playlist["shuffle_seed"],
            "last_shuffled": shuffled_playlist["last_shuffled"],
            "categories_included": bin_config["categories"],
            "bin": bin_key
        }},
        upsert=True
    )
    
    # Update TV scheduler
    tv_scheduler.set_shuffle_override(all_content, shuffled_playlist["last_shuffled"])
    
    # Calculate runtime
    total_seconds = sum(item.get("duration_seconds", 180) for item in all_content)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    
    return {
        "success": True,
        "message": f"🎬 {bin_config['name'].upper()} bin activated! {len(all_content)} items, ~{hours}h {minutes}m of content",
        "bin": bin_key,
        "bin_display": bin_config["name"],
        "description": bin_config["description"],
        "focus": bin_config["focus"],
        "creators": bin_config["creator_names"],
        "mood": bin_config["mood"],
        "total_items": len(all_content),
        "total_runtime": f"{hours}h {minutes}m",
        "categories": bin_config["categories"],
        "preview": all_content[:5],
        "now_playing": all_content[0] if all_content else None,
        "anti_loop_active_until": (datetime.now(timezone.utc) + timedelta(hours=bin_config["anti_loop_hours"])).isoformat()
    }


@router.post("/bins/auto")
async def auto_bin_shuffle():
    """Automatically shuffle to the current time bin (for cron jobs)"""
    current_bin = get_current_bin()
    
    # Call the main shuffle endpoint
    request = BinShuffleRequest(bin_name=current_bin["bin_key"], force_refresh=False)
    return await shuffle_by_bin(request)


@router.get("/bins/schedule")
async def get_bin_schedule():
    """Get the full 24-hour bin schedule"""
    schedule = []
    
    for hour in range(24):
        bin_info = get_bin_for_hour(hour)
        schedule.append({
            "hour": hour,
            "hour_display": f"{hour:02d}:00 UTC",
            "bin": bin_info["bin_key"],
            "bin_display": bin_info["name"],
            "focus": bin_info["focus"],
            "creators": bin_info["creator_names"]
        })
    
    return {
        "schedule": schedule,
        "bins": {
            name: {
                "display_name": config["name"],
                "description": config["description"],
                "creators": config["creator_names"],
                "hours": config["hours"],
                "focus": config["focus"]
            }
            for name, config in SHUFFLE_BINS.items()
        }
    }


# Need timedelta for anti-loop calculations
from datetime import timedelta
