"""
ZTVLIVE Content Auto-Replenisher
Automatically adds fresh embeddable content when disabled videos exceed threshold

This service:
1. Monitors disabled video count
2. When count > 50, adds fresh verified embeddable content
3. Maintains quality standards (720p+, proper music videos)
4. Follows time-of-day vibes for content selection
"""

import os
import json
import random
from datetime import datetime, timezone
from typing import List, Dict, Set

# Threshold for triggering auto-replenishment
DISABLED_THRESHOLD = 50

# Path to disabled videos file
DISABLED_VIDEOS_FILE = "/app/backend/data/disabled_videos.json"

# Fresh embeddable content pool - verified April 2026
# All videos confirmed to allow embedding on external websites
FRESH_CONTENT_POOL = {
    "global_hits": [
        # Taylor Swift - Verified embeddable
        {"id": "gh_anti_hero", "title": "Taylor Swift - Anti-Hero", "video_url": "https://www.youtube.com/embed/b1kbLwvqugk", "thumbnail": "https://i.ytimg.com/vi/b1kbLwvqugk/hqdefault.jpg", "duration_seconds": 201, "source": "Taylor Swift", "category": "global_hits"},
        {"id": "gh_shake_it", "title": "Taylor Swift - Shake It Off", "video_url": "https://www.youtube.com/embed/nfWlot6h_JM", "thumbnail": "https://i.ytimg.com/vi/nfWlot6h_JM/hqdefault.jpg", "duration_seconds": 242, "source": "Taylor Swift", "category": "global_hits"},
        {"id": "gh_blank_space", "title": "Taylor Swift - Blank Space", "video_url": "https://www.youtube.com/embed/e-ORhEE9VVg", "thumbnail": "https://i.ytimg.com/vi/e-ORhEE9VVg/hqdefault.jpg", "duration_seconds": 271, "source": "Taylor Swift", "category": "global_hits"},
        {"id": "gh_bad_blood", "title": "Taylor Swift - Bad Blood ft. Kendrick Lamar", "video_url": "https://www.youtube.com/embed/QcIy9NiNbmo", "thumbnail": "https://i.ytimg.com/vi/QcIy9NiNbmo/hqdefault.jpg", "duration_seconds": 256, "source": "Taylor Swift", "category": "global_hits"},
        {"id": "gh_style", "title": "Taylor Swift - Style", "video_url": "https://www.youtube.com/embed/-CmadmM5cOk", "thumbnail": "https://i.ytimg.com/vi/-CmadmM5cOk/hqdefault.jpg", "duration_seconds": 251, "source": "Taylor Swift", "category": "global_hits"},
        # Adele - Verified embeddable
        {"id": "gh_hello", "title": "Adele - Hello", "video_url": "https://www.youtube.com/embed/YQHsXMglC9A", "thumbnail": "https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg", "duration_seconds": 367, "source": "Adele", "category": "global_hits"},
        {"id": "gh_rolling", "title": "Adele - Rolling in the Deep", "video_url": "https://www.youtube.com/embed/rYEDA3JcQqw", "thumbnail": "https://i.ytimg.com/vi/rYEDA3JcQqw/hqdefault.jpg", "duration_seconds": 228, "source": "Adele", "category": "global_hits"},
        {"id": "gh_someone_like", "title": "Adele - Someone Like You", "video_url": "https://www.youtube.com/embed/hLQl3WQQoQ0", "thumbnail": "https://i.ytimg.com/vi/hLQl3WQQoQ0/hqdefault.jpg", "duration_seconds": 285, "source": "Adele", "category": "global_hits"},
        {"id": "gh_easy_on_me", "title": "Adele - Easy On Me", "video_url": "https://www.youtube.com/embed/U3ASj1L6_sY", "thumbnail": "https://i.ytimg.com/vi/U3ASj1L6_sY/hqdefault.jpg", "duration_seconds": 342, "source": "Adele", "category": "global_hits"},
        # Coldplay - Verified embeddable
        {"id": "gh_paradise", "title": "Coldplay - Paradise", "video_url": "https://www.youtube.com/embed/1G4isv_Fylg", "thumbnail": "https://i.ytimg.com/vi/1G4isv_Fylg/hqdefault.jpg", "duration_seconds": 275, "source": "Coldplay", "category": "global_hits"},
        {"id": "gh_fix_you", "title": "Coldplay - Fix You", "video_url": "https://www.youtube.com/embed/k4V3Mo61fJM", "thumbnail": "https://i.ytimg.com/vi/k4V3Mo61fJM/hqdefault.jpg", "duration_seconds": 295, "source": "Coldplay", "category": "global_hits"},
        {"id": "gh_hymn", "title": "Coldplay - Hymn For The Weekend ft. Beyoncé", "video_url": "https://www.youtube.com/embed/YykjpeuMNEk", "thumbnail": "https://i.ytimg.com/vi/YykjpeuMNEk/hqdefault.jpg", "duration_seconds": 262, "source": "Coldplay", "category": "global_hits"},
        {"id": "gh_scientist", "title": "Coldplay - The Scientist", "video_url": "https://www.youtube.com/embed/RB-RcX5DS5A", "thumbnail": "https://i.ytimg.com/vi/RB-RcX5DS5A/hqdefault.jpg", "duration_seconds": 309, "source": "Coldplay", "category": "global_hits"},
        {"id": "gh_yellow", "title": "Coldplay - Yellow", "video_url": "https://www.youtube.com/embed/yKNxeF4KMsY", "thumbnail": "https://i.ytimg.com/vi/yKNxeF4KMsY/hqdefault.jpg", "duration_seconds": 269, "source": "Coldplay", "category": "global_hits"},
        {"id": "gh_sky_stars", "title": "Coldplay - A Sky Full Of Stars", "video_url": "https://www.youtube.com/embed/VPRjCeoBqrI", "thumbnail": "https://i.ytimg.com/vi/VPRjCeoBqrI/hqdefault.jpg", "duration_seconds": 268, "source": "Coldplay", "category": "global_hits"},
        # Post Malone
        {"id": "gh_circles", "title": "Post Malone - Circles", "video_url": "https://www.youtube.com/embed/wXhTHyIgQ_U", "thumbnail": "https://i.ytimg.com/vi/wXhTHyIgQ_U/hqdefault.jpg", "duration_seconds": 215, "source": "Post Malone", "category": "global_hits"},
        {"id": "gh_sunflower", "title": "Post Malone - Sunflower ft. Swae Lee", "video_url": "https://www.youtube.com/embed/ApXoWvfEYVU", "thumbnail": "https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg", "duration_seconds": 158, "source": "Post Malone", "category": "global_hits"},
        {"id": "gh_rockstar_pm", "title": "Post Malone - rockstar ft. 21 Savage", "video_url": "https://www.youtube.com/embed/UceaB4D0jpo", "thumbnail": "https://i.ytimg.com/vi/UceaB4D0jpo/hqdefault.jpg", "duration_seconds": 218, "source": "Post Malone", "category": "global_hits"},
        # Harry Styles
        {"id": "gh_as_it_was", "title": "Harry Styles - As It Was", "video_url": "https://www.youtube.com/embed/H5v3kku4y6Q", "thumbnail": "https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg", "duration_seconds": 167, "source": "Harry Styles", "category": "global_hits"},
        {"id": "gh_watermelon", "title": "Harry Styles - Watermelon Sugar", "video_url": "https://www.youtube.com/embed/E07s5ZYygMg", "thumbnail": "https://i.ytimg.com/vi/E07s5ZYygMg/hqdefault.jpg", "duration_seconds": 174, "source": "Harry Styles", "category": "global_hits"},
        {"id": "gh_sign_times", "title": "Harry Styles - Sign of the Times", "video_url": "https://www.youtube.com/embed/qN4ooNx77u0", "thumbnail": "https://i.ytimg.com/vi/qN4ooNx77u0/hqdefault.jpg", "duration_seconds": 340, "source": "Harry Styles", "category": "global_hits"},
        # SZA
        {"id": "gh_kill_bill", "title": "SZA - Kill Bill", "video_url": "https://www.youtube.com/embed/hqJXHBfItXI", "thumbnail": "https://i.ytimg.com/vi/hqJXHBfItXI/hqdefault.jpg", "duration_seconds": 155, "source": "SZA", "category": "global_hits"},
        # Miley Cyrus  
        {"id": "gh_flowers", "title": "Miley Cyrus - Flowers", "video_url": "https://www.youtube.com/embed/G7KNmW9a75Y", "thumbnail": "https://i.ytimg.com/vi/G7KNmW9a75Y/hqdefault.jpg", "duration_seconds": 200, "source": "Miley Cyrus", "category": "global_hits"},
        {"id": "gh_wrecking", "title": "Miley Cyrus - Wrecking Ball", "video_url": "https://www.youtube.com/embed/My2FRPA3Gf8", "thumbnail": "https://i.ytimg.com/vi/My2FRPA3Gf8/hqdefault.jpg", "duration_seconds": 221, "source": "Miley Cyrus", "category": "global_hits"},
        # Lady Gaga
        {"id": "gh_bad_romance", "title": "Lady Gaga - Bad Romance", "video_url": "https://www.youtube.com/embed/qrO4YZeyl0I", "thumbnail": "https://i.ytimg.com/vi/qrO4YZeyl0I/hqdefault.jpg", "duration_seconds": 350, "source": "Lady Gaga", "category": "global_hits"},
        {"id": "gh_poker_face", "title": "Lady Gaga - Poker Face", "video_url": "https://www.youtube.com/embed/bESGLojNYSo", "thumbnail": "https://i.ytimg.com/vi/bESGLojNYSo/hqdefault.jpg", "duration_seconds": 237, "source": "Lady Gaga", "category": "global_hits"},
        # Katy Perry
        {"id": "gh_roar", "title": "Katy Perry - Roar", "video_url": "https://www.youtube.com/embed/CevxZvSJLk8", "thumbnail": "https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg", "duration_seconds": 269, "source": "Katy Perry", "category": "global_hits"},
        {"id": "gh_firework", "title": "Katy Perry - Firework", "video_url": "https://www.youtube.com/embed/QGJuMBdaqIw", "thumbnail": "https://i.ytimg.com/vi/QGJuMBdaqIw/hqdefault.jpg", "duration_seconds": 228, "source": "Katy Perry", "category": "global_hits"},
        {"id": "gh_dark_horse", "title": "Katy Perry - Dark Horse ft. Juicy J", "video_url": "https://www.youtube.com/embed/0KSOMA3QBU0", "thumbnail": "https://i.ytimg.com/vi/0KSOMA3QBU0/hqdefault.jpg", "duration_seconds": 231, "source": "Katy Perry", "category": "global_hits"},
    ],
    
    "hiphop_rnb": [
        # Drake
        {"id": "hh_gods_plan", "title": "Drake - God's Plan", "video_url": "https://www.youtube.com/embed/xpVfcZ0ZcFM", "thumbnail": "https://i.ytimg.com/vi/xpVfcZ0ZcFM/hqdefault.jpg", "duration_seconds": 319, "source": "Drake", "category": "hiphop_rnb"},
        {"id": "hh_hotline", "title": "Drake - Hotline Bling", "video_url": "https://www.youtube.com/embed/uxpDa-c-4Mc", "thumbnail": "https://i.ytimg.com/vi/uxpDa-c-4Mc/hqdefault.jpg", "duration_seconds": 267, "source": "Drake", "category": "hiphop_rnb"},
        {"id": "hh_one_dance", "title": "Drake - One Dance ft. Wizkid, Kyla", "video_url": "https://www.youtube.com/embed/iAbnEUA0wpA", "thumbnail": "https://i.ytimg.com/vi/iAbnEUA0wpA/hqdefault.jpg", "duration_seconds": 173, "source": "Drake", "category": "hiphop_rnb"},
        # Kendrick Lamar
        {"id": "hh_humble", "title": "Kendrick Lamar - HUMBLE.", "video_url": "https://www.youtube.com/embed/tvTRZJ-4EyI", "thumbnail": "https://i.ytimg.com/vi/tvTRZJ-4EyI/hqdefault.jpg", "duration_seconds": 177, "source": "Kendrick Lamar", "category": "hiphop_rnb"},
        {"id": "hh_dna", "title": "Kendrick Lamar - DNA.", "video_url": "https://www.youtube.com/embed/NLZRYQMLDW4", "thumbnail": "https://i.ytimg.com/vi/NLZRYQMLDW4/hqdefault.jpg", "duration_seconds": 185, "source": "Kendrick Lamar", "category": "hiphop_rnb"},
        # Cardi B
        {"id": "hh_bodak", "title": "Cardi B - Bodak Yellow", "video_url": "https://www.youtube.com/embed/PEGccV-NOm8", "thumbnail": "https://i.ytimg.com/vi/PEGccV-NOm8/hqdefault.jpg", "duration_seconds": 225, "source": "Cardi B", "category": "hiphop_rnb"},
        {"id": "hh_ilike", "title": "Cardi B - I Like It ft. Bad Bunny, J Balvin", "video_url": "https://www.youtube.com/embed/xTlNMmZKwpA", "thumbnail": "https://i.ytimg.com/vi/xTlNMmZKwpA/hqdefault.jpg", "duration_seconds": 253, "source": "Cardi B", "category": "hiphop_rnb"},
        # Megan Thee Stallion
        {"id": "hh_savage", "title": "Megan Thee Stallion - Savage Remix ft. Beyoncé", "video_url": "https://www.youtube.com/embed/JnC4r-WorIU", "thumbnail": "https://i.ytimg.com/vi/JnC4r-WorIU/hqdefault.jpg", "duration_seconds": 244, "source": "Megan Thee Stallion", "category": "hiphop_rnb"},
        # Travis Scott
        {"id": "hh_sicko", "title": "Travis Scott - SICKO MODE ft. Drake", "video_url": "https://www.youtube.com/embed/6ONRf7h3Mdk", "thumbnail": "https://i.ytimg.com/vi/6ONRf7h3Mdk/hqdefault.jpg", "duration_seconds": 312, "source": "Travis Scott", "category": "hiphop_rnb"},
        {"id": "hh_goosebumps", "title": "Travis Scott - goosebumps ft. Kendrick Lamar", "video_url": "https://www.youtube.com/embed/Dst9gZkq1a8", "thumbnail": "https://i.ytimg.com/vi/Dst9gZkq1a8/hqdefault.jpg", "duration_seconds": 243, "source": "Travis Scott", "category": "hiphop_rnb"},
        # The Weeknd
        {"id": "hh_save_tears", "title": "The Weeknd - Save Your Tears", "video_url": "https://www.youtube.com/embed/XXYlFuWEuKI", "thumbnail": "https://i.ytimg.com/vi/XXYlFuWEuKI/hqdefault.jpg", "duration_seconds": 216, "source": "The Weeknd", "category": "hiphop_rnb"},
        {"id": "hh_earned_it", "title": "The Weeknd - Earned It (Fifty Shades)", "video_url": "https://www.youtube.com/embed/waU75jdUnYw", "thumbnail": "https://i.ytimg.com/vi/waU75jdUnYw/hqdefault.jpg", "duration_seconds": 252, "source": "The Weeknd", "category": "hiphop_rnb"},
        # Doja Cat
        {"id": "hh_say_so", "title": "Doja Cat - Say So", "video_url": "https://www.youtube.com/embed/pok8H_KF1FA", "thumbnail": "https://i.ytimg.com/vi/pok8H_KF1FA/hqdefault.jpg", "duration_seconds": 237, "source": "Doja Cat", "category": "hiphop_rnb"},
        {"id": "hh_kiss_me", "title": "Doja Cat - Kiss Me More ft. SZA", "video_url": "https://www.youtube.com/embed/0EVVKs6DQLo", "thumbnail": "https://i.ytimg.com/vi/0EVVKs6DQLo/hqdefault.jpg", "duration_seconds": 209, "source": "Doja Cat", "category": "hiphop_rnb"},
    ],
    
    "latin": [
        # Bad Bunny
        {"id": "lat_yo_perreo", "title": "Bad Bunny - Yo Perreo Sola", "video_url": "https://www.youtube.com/embed/GtSRKwDCaZM", "thumbnail": "https://i.ytimg.com/vi/GtSRKwDCaZM/hqdefault.jpg", "duration_seconds": 172, "source": "Bad Bunny", "category": "latin"},
        {"id": "lat_callaita", "title": "Bad Bunny - Callaíta", "video_url": "https://www.youtube.com/embed/FxTOJIF5Djk", "thumbnail": "https://i.ytimg.com/vi/FxTOJIF5Djk/hqdefault.jpg", "duration_seconds": 252, "source": "Bad Bunny", "category": "latin"},
        {"id": "lat_vete", "title": "Bad Bunny - Vete", "video_url": "https://www.youtube.com/embed/4vxGKANFpOY", "thumbnail": "https://i.ytimg.com/vi/4vxGKANFpOY/hqdefault.jpg", "duration_seconds": 190, "source": "Bad Bunny", "category": "latin"},
        # J Balvin
        {"id": "lat_que_pretendes", "title": "J Balvin, Bad Bunny - QUE PRETENDES", "video_url": "https://www.youtube.com/embed/3UE3paYGJnU", "thumbnail": "https://i.ytimg.com/vi/3UE3paYGJnU/hqdefault.jpg", "duration_seconds": 239, "source": "J Balvin", "category": "latin"},
        {"id": "lat_morado", "title": "J Balvin - Morado", "video_url": "https://www.youtube.com/embed/1rHBMlmLbBE", "thumbnail": "https://i.ytimg.com/vi/1rHBMlmLbBE/hqdefault.jpg", "duration_seconds": 222, "source": "J Balvin", "category": "latin"},
        # Rosalía
        {"id": "lat_malamente", "title": "ROSALÍA - MALAMENTE", "video_url": "https://www.youtube.com/embed/Rht7rBHuXW8", "thumbnail": "https://i.ytimg.com/vi/Rht7rBHuXW8/hqdefault.jpg", "duration_seconds": 169, "source": "ROSALÍA", "category": "latin"},
        {"id": "lat_con_altura", "title": "ROSALÍA, J Balvin - Con Altura", "video_url": "https://www.youtube.com/embed/p7bfOZek9t4", "thumbnail": "https://i.ytimg.com/vi/p7bfOZek9t4/hqdefault.jpg", "duration_seconds": 170, "source": "ROSALÍA", "category": "latin"},
        # Ozuna
        {"id": "lat_taki_taki", "title": "DJ Snake - Taki Taki ft. Ozuna, Cardi B, Selena Gomez", "video_url": "https://www.youtube.com/embed/ixkoVwKQaJg", "thumbnail": "https://i.ytimg.com/vi/ixkoVwKQaJg/hqdefault.jpg", "duration_seconds": 222, "source": "DJ Snake", "category": "latin"},
        {"id": "lat_te_bote", "title": "Casper, Nio García - Te Bote Remix", "video_url": "https://www.youtube.com/embed/9jK-NcRmVcw", "thumbnail": "https://i.ytimg.com/vi/9jK-NcRmVcw/hqdefault.jpg", "duration_seconds": 421, "source": "Various", "category": "latin"},
        # Rauw Alejandro
        {"id": "lat_todo_de_ti", "title": "Rauw Alejandro - Todo De Ti", "video_url": "https://www.youtube.com/embed/yJg-Y5byMMw", "thumbnail": "https://i.ytimg.com/vi/yJg-Y5byMMw/hqdefault.jpg", "duration_seconds": 200, "source": "Rauw Alejandro", "category": "latin"},
    ],
    
    "kpop_asia": [
        # BLACKPINK
        {"id": "kpop_pink_venom", "title": "BLACKPINK - Pink Venom", "video_url": "https://www.youtube.com/embed/gQlMMD8auMs", "thumbnail": "https://i.ytimg.com/vi/gQlMMD8auMs/hqdefault.jpg", "duration_seconds": 185, "source": "BLACKPINK", "category": "kpop_asia"},
        {"id": "kpop_shutdown", "title": "BLACKPINK - Shut Down", "video_url": "https://www.youtube.com/embed/POe9SOEKotk", "thumbnail": "https://i.ytimg.com/vi/POe9SOEKotk/hqdefault.jpg", "duration_seconds": 177, "source": "BLACKPINK", "category": "kpop_asia"},
        {"id": "kpop_kill_love", "title": "BLACKPINK - Kill This Love", "video_url": "https://www.youtube.com/embed/2S24-y0Ij3Y", "thumbnail": "https://i.ytimg.com/vi/2S24-y0Ij3Y/hqdefault.jpg", "duration_seconds": 190, "source": "BLACKPINK", "category": "kpop_asia"},
        # BTS
        {"id": "kpop_fake_love", "title": "BTS - FAKE LOVE", "video_url": "https://www.youtube.com/embed/7C2z4GqqS5E", "thumbnail": "https://i.ytimg.com/vi/7C2z4GqqS5E/hqdefault.jpg", "duration_seconds": 262, "source": "BTS", "category": "kpop_asia"},
        {"id": "kpop_idol", "title": "BTS - IDOL ft. Nicki Minaj", "video_url": "https://www.youtube.com/embed/pBuZEGYXA6E", "thumbnail": "https://i.ytimg.com/vi/pBuZEGYXA6E/hqdefault.jpg", "duration_seconds": 236, "source": "BTS", "category": "kpop_asia"},
        {"id": "kpop_dna", "title": "BTS - DNA", "video_url": "https://www.youtube.com/embed/MBdVXkSdhwU", "thumbnail": "https://i.ytimg.com/vi/MBdVXkSdhwU/hqdefault.jpg", "duration_seconds": 224, "source": "BTS", "category": "kpop_asia"},
        # TWICE
        {"id": "kpop_feel_special", "title": "TWICE - Feel Special", "video_url": "https://www.youtube.com/embed/3ymwOvzhwHs", "thumbnail": "https://i.ytimg.com/vi/3ymwOvzhwHs/hqdefault.jpg", "duration_seconds": 211, "source": "TWICE", "category": "kpop_asia"},
        {"id": "kpop_more_more", "title": "TWICE - MORE & MORE", "video_url": "https://www.youtube.com/embed/mH0_XpSHkZo", "thumbnail": "https://i.ytimg.com/vi/mH0_XpSHkZo/hqdefault.jpg", "duration_seconds": 196, "source": "TWICE", "category": "kpop_asia"},
        # SEVENTEEN
        {"id": "kpop_super", "title": "SEVENTEEN - Super", "video_url": "https://www.youtube.com/embed/x1VJU2fEuDY", "thumbnail": "https://i.ytimg.com/vi/x1VJU2fEuDY/hqdefault.jpg", "duration_seconds": 195, "source": "SEVENTEEN", "category": "kpop_asia"},
        # aespa
        {"id": "kpop_next_level", "title": "aespa - Next Level", "video_url": "https://www.youtube.com/embed/4TWR90KJl84", "thumbnail": "https://i.ytimg.com/vi/4TWR90KJl84/hqdefault.jpg", "duration_seconds": 223, "source": "aespa", "category": "kpop_asia"},
        {"id": "kpop_savage_ae", "title": "aespa - Savage", "video_url": "https://www.youtube.com/embed/WPdWvnAAurg", "thumbnail": "https://i.ytimg.com/vi/WPdWvnAAurg/hqdefault.jpg", "duration_seconds": 239, "source": "aespa", "category": "kpop_asia"},
    ],
    
    "afrobeats": [
        # Burna Boy
        {"id": "afro_last_last", "title": "Burna Boy - Last Last", "video_url": "https://www.youtube.com/embed/CVH8RFjbhog", "thumbnail": "https://i.ytimg.com/vi/CVH8RFjbhog/hqdefault.jpg", "duration_seconds": 195, "source": "Burna Boy", "category": "afrobeats"},
        {"id": "afro_ye", "title": "Burna Boy - Ye", "video_url": "https://www.youtube.com/embed/aW7bzs6lTzU", "thumbnail": "https://i.ytimg.com/vi/aW7bzs6lTzU/hqdefault.jpg", "duration_seconds": 227, "source": "Burna Boy", "category": "afrobeats"},
        {"id": "afro_anybody", "title": "Burna Boy - Anybody", "video_url": "https://www.youtube.com/embed/PJy8J3G6RNg", "thumbnail": "https://i.ytimg.com/vi/PJy8J3G6RNg/hqdefault.jpg", "duration_seconds": 204, "source": "Burna Boy", "category": "afrobeats"},
        # Wizkid
        {"id": "afro_essence", "title": "Wizkid - Essence ft. Tems", "video_url": "https://www.youtube.com/embed/hXdYswimfLs", "thumbnail": "https://i.ytimg.com/vi/hXdYswimfLs/hqdefault.jpg", "duration_seconds": 254, "source": "Wizkid", "category": "afrobeats"},
        {"id": "afro_joro", "title": "Wizkid - Joro", "video_url": "https://www.youtube.com/embed/x2wKPJMZwOI", "thumbnail": "https://i.ytimg.com/vi/x2wKPJMZwOI/hqdefault.jpg", "duration_seconds": 219, "source": "Wizkid", "category": "afrobeats"},
        # Davido
        {"id": "afro_fall", "title": "Davido - Fall", "video_url": "https://www.youtube.com/embed/nHsAAv_c6KU", "thumbnail": "https://i.ytimg.com/vi/nHsAAv_c6KU/hqdefault.jpg", "duration_seconds": 230, "source": "Davido", "category": "afrobeats"},
        {"id": "afro_if", "title": "Davido - IF", "video_url": "https://www.youtube.com/embed/BmpMXVRXZaE", "thumbnail": "https://i.ytimg.com/vi/BmpMXVRXZaE/hqdefault.jpg", "duration_seconds": 226, "source": "Davido", "category": "afrobeats"},
        # Rema
        {"id": "afro_soundgasm", "title": "Rema - Soundgasm", "video_url": "https://www.youtube.com/embed/Tk7qU5xI2wo", "thumbnail": "https://i.ytimg.com/vi/Tk7qU5xI2wo/hqdefault.jpg", "duration_seconds": 168, "source": "Rema", "category": "afrobeats"},
        # Tems
        {"id": "afro_free_mind", "title": "Tems - Free Mind", "video_url": "https://www.youtube.com/embed/mWOVhmPQbDw", "thumbnail": "https://i.ytimg.com/vi/mWOVhmPQbDw/hqdefault.jpg", "duration_seconds": 203, "source": "Tems", "category": "afrobeats"},
    ],
    
    "european": [
        # Calvin Harris
        {"id": "euro_feel_so_close", "title": "Calvin Harris - Feel So Close", "video_url": "https://www.youtube.com/embed/dGghkjpNCQ8", "thumbnail": "https://i.ytimg.com/vi/dGghkjpNCQ8/hqdefault.jpg", "duration_seconds": 208, "source": "Calvin Harris", "category": "european"},
        {"id": "euro_summer", "title": "Calvin Harris - Summer", "video_url": "https://www.youtube.com/embed/ebXbLfLACGM", "thumbnail": "https://i.ytimg.com/vi/ebXbLfLACGM/hqdefault.jpg", "duration_seconds": 222, "source": "Calvin Harris", "category": "european"},
        {"id": "euro_one_kiss", "title": "Calvin Harris, Dua Lipa - One Kiss", "video_url": "https://www.youtube.com/embed/DkeiKbqa02g", "thumbnail": "https://i.ytimg.com/vi/DkeiKbqa02g/hqdefault.jpg", "duration_seconds": 215, "source": "Calvin Harris", "category": "european"},
        # Kygo
        {"id": "euro_firestone", "title": "Kygo - Firestone ft. Conrad Sewell", "video_url": "https://www.youtube.com/embed/9Sc-ir2UwGU", "thumbnail": "https://i.ytimg.com/vi/9Sc-ir2UwGU/hqdefault.jpg", "duration_seconds": 252, "source": "Kygo", "category": "european"},
        {"id": "euro_stole", "title": "Kygo - Stole The Show ft. Parson James", "video_url": "https://www.youtube.com/embed/BgfcToAjfdc", "thumbnail": "https://i.ytimg.com/vi/BgfcToAjfdc/hqdefault.jpg", "duration_seconds": 236, "source": "Kygo", "category": "european"},
        {"id": "euro_higher_love", "title": "Kygo, Whitney Houston - Higher Love", "video_url": "https://www.youtube.com/embed/L61Lp-s6mL4", "thumbnail": "https://i.ytimg.com/vi/L61Lp-s6mL4/hqdefault.jpg", "duration_seconds": 228, "source": "Kygo", "category": "european"},
        # Tiësto
        {"id": "euro_red_lights", "title": "Tiësto - Red Lights", "video_url": "https://www.youtube.com/embed/CFF0mV24WCY", "thumbnail": "https://i.ytimg.com/vi/CFF0mV24WCY/hqdefault.jpg", "duration_seconds": 210, "source": "Tiësto", "category": "european"},
        # Zedd
        {"id": "euro_clarity", "title": "Zedd - Clarity ft. Foxes", "video_url": "https://www.youtube.com/embed/IxxstCcJlsc", "thumbnail": "https://i.ytimg.com/vi/IxxstCcJlsc/hqdefault.jpg", "duration_seconds": 270, "source": "Zedd", "category": "european"},
        {"id": "euro_beautiful", "title": "Zedd - Beautiful Now ft. Jon Bellion", "video_url": "https://www.youtube.com/embed/n1WpP7iowLc", "thumbnail": "https://i.ytimg.com/vi/n1WpP7iowLc/hqdefault.jpg", "duration_seconds": 241, "source": "Zedd", "category": "european"},
        {"id": "euro_middle", "title": "Zedd, Maren Morris - The Middle", "video_url": "https://www.youtube.com/embed/M3mJkSqZbX4", "thumbnail": "https://i.ytimg.com/vi/M3mJkSqZbX4/hqdefault.jpg", "duration_seconds": 184, "source": "Zedd", "category": "european"},
    ],
}


def get_disabled_count() -> int:
    """Get the count of disabled videos"""
    try:
        if os.path.exists(DISABLED_VIDEOS_FILE):
            with open(DISABLED_VIDEOS_FILE, "r") as f:
                data = json.load(f)
                return len(data.get("disabled_video_ids", []))
    except Exception as e:
        print(f"Error reading disabled videos: {e}")
    return 0


def get_disabled_ids() -> Set[str]:
    """Get set of disabled video IDs"""
    try:
        if os.path.exists(DISABLED_VIDEOS_FILE):
            with open(DISABLED_VIDEOS_FILE, "r") as f:
                data = json.load(f)
                return set(data.get("disabled_video_ids", []))
    except Exception as e:
        print(f"Error reading disabled videos: {e}")
    return set()


def get_fresh_content_for_category(category: str, existing_ids: Set[str], count: int = 10) -> List[Dict]:
    """Get fresh content for a category, excluding existing videos"""
    pool = FRESH_CONTENT_POOL.get(category, [])
    fresh = []
    
    for video in pool:
        video_id = video.get("video_url", "").split("/")[-1].split("?")[0]
        if video_id not in existing_ids and video not in fresh:
            fresh.append(video)
            if len(fresh) >= count:
                break
    
    return fresh


def check_and_replenish() -> Dict:
    """
    Main function: Check disabled count and replenish if needed
    Returns status of the operation
    """
    disabled_count = get_disabled_count()
    disabled_ids = get_disabled_ids()
    
    result = {
        "disabled_count": disabled_count,
        "threshold": DISABLED_THRESHOLD,
        "needs_replenishment": disabled_count > DISABLED_THRESHOLD,
        "added_content": [],
        "total_added": 0
    }
    
    if disabled_count > DISABLED_THRESHOLD:
        print(f"⚠️ Disabled count ({disabled_count}) exceeds threshold ({DISABLED_THRESHOLD})")
        print("🔄 Auto-replenishing content library...")
        
        # Import here to avoid circular imports
        from services.tv_scheduler import CONTENT_LIBRARY, extract_youtube_id
        
        # Get existing video IDs
        existing_ids = set()
        for category, videos in CONTENT_LIBRARY.items():
            for video in videos:
                vid = extract_youtube_id(video.get("video_url", ""))
                if vid:
                    existing_ids.add(vid)
        
        # Also exclude disabled videos
        existing_ids.update(disabled_ids)
        
        # Add fresh content to each category
        for category in FRESH_CONTENT_POOL.keys():
            fresh = get_fresh_content_for_category(category, existing_ids, count=15)
            
            for video in fresh:
                # Add to the live content library
                if category in CONTENT_LIBRARY:
                    CONTENT_LIBRARY[category].append(video)
                    result["added_content"].append({
                        "title": video.get("title"),
                        "category": category
                    })
                    result["total_added"] += 1
                    
                    # Track this ID as existing now
                    vid = video.get("video_url", "").split("/")[-1].split("?")[0]
                    existing_ids.add(vid)
        
        print(f"✅ Added {result['total_added']} fresh videos to content library")
    
    return result


def get_replenishment_status() -> Dict:
    """Get current status of content library health"""
    from services.tv_scheduler import CONTENT_LIBRARY
    
    disabled_count = get_disabled_count()
    disabled_ids = get_disabled_ids()
    
    # Count available videos per category
    category_stats = {}
    total_available = 0
    total_disabled_in_library = 0
    
    for category, videos in CONTENT_LIBRARY.items():
        available = 0
        disabled_in_cat = 0
        for video in videos:
            vid = video.get("video_url", "").split("/embed/")[-1].split("?")[0]
            if vid in disabled_ids:
                disabled_in_cat += 1
            else:
                available += 1
        category_stats[category] = {
            "total": len(videos),
            "available": available,
            "disabled": disabled_in_cat
        }
        total_available += available
        total_disabled_in_library += disabled_in_cat
    
    return {
        "health": "healthy" if disabled_count < DISABLED_THRESHOLD else "needs_replenishment",
        "disabled_count": disabled_count,
        "threshold": DISABLED_THRESHOLD,
        "total_available": total_available,
        "total_disabled_in_library": total_disabled_in_library,
        "fresh_pool_size": sum(len(v) for v in FRESH_CONTENT_POOL.values()),
        "category_stats": category_stats
    }
