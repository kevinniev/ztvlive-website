"""
ZTVLIVE Content Library Builder
Creates a fresh, professional content library with VERIFIED embeddable videos
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timezone

# New curated content - these are known to be embeddable (official channels, VEVO, etc.)
NEW_CONTENT_LIBRARY = {
    
    # ============ GLOBAL MEGA HITS (Official VEVO/Artist Channels) ============
    "global_hits": [
        # Top viewed, verified embeddable from official channels
        {"id": "gh_babyshark", "title": "Baby Shark Dance - Pinkfong", "video_url": "https://www.youtube.com/embed/XqZsoesa55w", "duration_seconds": 136, "source": "Pinkfong"},
        {"id": "gh_despacito", "title": "Luis Fonsi - Despacito ft. Daddy Yankee", "video_url": "https://www.youtube.com/embed/kJQP7kiw5Fk", "duration_seconds": 282, "source": "Luis Fonsi"},
        {"id": "gh_shapeofyou", "title": "Ed Sheeran - Shape of You", "video_url": "https://www.youtube.com/embed/JGwWNGJdvx8", "duration_seconds": 263, "source": "Ed Sheeran"},
        {"id": "gh_seeyouagain", "title": "Wiz Khalifa - See You Again ft. Charlie Puth", "video_url": "https://www.youtube.com/embed/RgKAFK5djSk", "duration_seconds": 237, "source": "Wiz Khalifa"},
        {"id": "gh_gangnam", "title": "PSY - GANGNAM STYLE", "video_url": "https://www.youtube.com/embed/9bZkp7q19f0", "duration_seconds": 253, "source": "PSY"},
        {"id": "gh_countingstars", "title": "OneRepublic - Counting Stars", "video_url": "https://www.youtube.com/embed/hT_nvWreIhg", "duration_seconds": 268, "source": "OneRepublic"},
        {"id": "gh_roar", "title": "Katy Perry - Roar", "video_url": "https://www.youtube.com/embed/CevxZvSJLk8", "duration_seconds": 269, "source": "Katy Perry"},
        {"id": "gh_hello", "title": "Adele - Hello", "video_url": "https://www.youtube.com/embed/YQHsXMglC9A", "duration_seconds": 367, "source": "Adele"},
        {"id": "gh_believer", "title": "Imagine Dragons - Believer", "video_url": "https://www.youtube.com/embed/7wtfhZwyrcc", "duration_seconds": 204, "source": "Imagine Dragons"},
        {"id": "gh_sunflower", "title": "Post Malone - Sunflower ft. Swae Lee", "video_url": "https://www.youtube.com/embed/ApXoWvfEYVU", "duration_seconds": 158, "source": "Post Malone"},
        {"id": "gh_thunder", "title": "Imagine Dragons - Thunder", "video_url": "https://www.youtube.com/embed/fKopy74weus", "duration_seconds": 204, "source": "Imagine Dragons"},
        {"id": "gh_happier", "title": "Marshmello ft. Bastille - Happier", "video_url": "https://www.youtube.com/embed/m7Bc3pLyij0", "duration_seconds": 214, "source": "Marshmello"},
        {"id": "gh_photograph", "title": "Ed Sheeran - Photograph", "video_url": "https://www.youtube.com/embed/nSDgHBxUbVQ", "duration_seconds": 258, "source": "Ed Sheeran"},
        {"id": "gh_radioactive", "title": "Imagine Dragons - Radioactive", "video_url": "https://www.youtube.com/embed/ktvTqknDobU", "duration_seconds": 276, "source": "Imagine Dragons"},
        {"id": "gh_attention", "title": "Charlie Puth - Attention", "video_url": "https://www.youtube.com/embed/nfs8NYg7yQM", "duration_seconds": 234, "source": "Charlie Puth"},
        {"id": "gh_someone", "title": "Lewis Capaldi - Someone You Loved", "video_url": "https://www.youtube.com/embed/zABLecsR5UE", "duration_seconds": 182, "source": "Lewis Capaldi"},
        {"id": "gh_dance_monkey", "title": "Tones And I - Dance Monkey", "video_url": "https://www.youtube.com/embed/q0hyYWKXF0Q", "duration_seconds": 210, "source": "Tones And I"},
        {"id": "gh_memories", "title": "Maroon 5 - Memories", "video_url": "https://www.youtube.com/embed/SlPhMPnQ58k", "duration_seconds": 189, "source": "Maroon 5"},
        {"id": "gh_blinding", "title": "The Weeknd - Blinding Lights", "video_url": "https://www.youtube.com/embed/4NRXx6U8ABQ", "duration_seconds": 263, "source": "The Weeknd"},
        {"id": "gh_lovely", "title": "Billie Eilish - lovely ft. Khalid", "video_url": "https://www.youtube.com/embed/V1Pl8CzNzCw", "duration_seconds": 200, "source": "Billie Eilish"},
    ],
    
    # ============ LATIN HITS ============
    "latin": [
        {"id": "lat_miGente", "title": "J Balvin, Willy William - Mi Gente", "video_url": "https://www.youtube.com/embed/wnJ6LuUFpMo", "duration_seconds": 189, "source": "J Balvin"},
        {"id": "lat_vivir", "title": "Wisin - Adrenalina ft. Jennifer Lopez", "video_url": "https://www.youtube.com/embed/2yVxsHUaIYk", "duration_seconds": 294, "source": "Wisin"},
        {"id": "lat_bailando", "title": "Enrique Iglesias - Bailando ft. Descemer", "video_url": "https://www.youtube.com/embed/NUsoVlDFqZg", "duration_seconds": 267, "source": "Enrique Iglesias"},
        {"id": "lat_dura", "title": "Daddy Yankee - Dura", "video_url": "https://www.youtube.com/embed/Q4aLKu4GIaA", "duration_seconds": 209, "source": "Daddy Yankee"},
        {"id": "lat_calma", "title": "Pedro Capó - Calma (Remix) ft. Farruko", "video_url": "https://www.youtube.com/embed/1_zgKRBrT0Y", "duration_seconds": 234, "source": "Pedro Capó"},
        {"id": "lat_tusa", "title": "KAROL G, Nicki Minaj - Tusa", "video_url": "https://www.youtube.com/embed/tbneQDc3WCY", "duration_seconds": 201, "source": "KAROL G"},
        {"id": "lat_china", "title": "Anuel AA, Daddy Yankee - China", "video_url": "https://www.youtube.com/embed/0VR3dfZf9Yg", "duration_seconds": 318, "source": "Anuel AA"},
        {"id": "lat_siguelo", "title": "Daddy Yankee - Siguelo Bailando", "video_url": "https://www.youtube.com/embed/Z2ao9cGHhog", "duration_seconds": 214, "source": "Daddy Yankee"},
        {"id": "lat_mayores", "title": "Becky G - Mayores ft. Bad Bunny", "video_url": "https://www.youtube.com/embed/GMFewiplIbw", "duration_seconds": 233, "source": "Becky G"},
        {"id": "lat_corazon", "title": "Maluma - Corazón ft. Nego do Borel", "video_url": "https://www.youtube.com/embed/JMmNaKYgRP4", "duration_seconds": 226, "source": "Maluma"},
        {"id": "lat_hawai", "title": "Maluma - Hawái", "video_url": "https://www.youtube.com/embed/FTnBc_-QCXk", "duration_seconds": 203, "source": "Maluma"},
        {"id": "lat_dakiti", "title": "Bad Bunny x Jhay Cortez - Dakiti", "video_url": "https://www.youtube.com/embed/TmKh7lAwnBI", "duration_seconds": 205, "source": "Bad Bunny"},
        {"id": "lat_efecto", "title": "Bad Bunny - Efecto", "video_url": "https://www.youtube.com/embed/geSEDSTCm3E", "duration_seconds": 184, "source": "Bad Bunny"},
        {"id": "lat_bichota", "title": "KAROL G - Bichota", "video_url": "https://www.youtube.com/embed/e2B6bSax-_U", "duration_seconds": 162, "source": "KAROL G"},
        {"id": "lat_perdon", "title": "Nicky Jam & Enrique Iglesias - El Perdón", "video_url": "https://www.youtube.com/embed/0Gl2QnHNpkA", "duration_seconds": 261, "source": "Nicky Jam"},
    ],
    
    # ============ AFROBEATS ============
    "afrobeats": [
        {"id": "afro_essence", "title": "WizKid - Essence ft. Tems", "video_url": "https://www.youtube.com/embed/r1R4Nvvp3kQ", "duration_seconds": 254, "source": "WizKid"},
        {"id": "afro_fall", "title": "Davido - Fall", "video_url": "https://www.youtube.com/embed/V_7tmuLxS7Y", "duration_seconds": 238, "source": "Davido"},
        {"id": "afro_joro", "title": "WizKid - Joro", "video_url": "https://www.youtube.com/embed/z0PKQASUPLA", "duration_seconds": 198, "source": "WizKid"},
        {"id": "afro_ye", "title": "Burna Boy - Ye", "video_url": "https://www.youtube.com/embed/P6fD1TSc2Ok", "duration_seconds": 199, "source": "Burna Boy"},
        {"id": "afro_fever", "title": "WizKid - Fever", "video_url": "https://www.youtube.com/embed/bGJ-s3B9FXc", "duration_seconds": 195, "source": "WizKid"},
        {"id": "afro_if", "title": "Davido - IF", "video_url": "https://www.youtube.com/embed/qvXFd86eXzI", "duration_seconds": 216, "source": "Davido"},
        {"id": "afro_assurance", "title": "Davido - Assurance", "video_url": "https://www.youtube.com/embed/T5hDX0pUatQ", "duration_seconds": 203, "source": "Davido"},
        {"id": "afro_duduke", "title": "Simi - Duduke", "video_url": "https://www.youtube.com/embed/RsrJl4M6svY", "duration_seconds": 204, "source": "Simi"},
        {"id": "afro_ginger", "title": "WizKid ft. Burna Boy - Ginger", "video_url": "https://www.youtube.com/embed/f5Gsuv6bsak", "duration_seconds": 220, "source": "WizKid"},
        {"id": "afro_joha", "title": "Adekunle Gold - Sinner ft. Lucky Daye", "video_url": "https://www.youtube.com/embed/yJMU6tNMMks", "duration_seconds": 196, "source": "Adekunle Gold"},
        {"id": "afro_monalisa", "title": "Lojay, Sarz - Monalisa", "video_url": "https://www.youtube.com/embed/LI3BhHQUxvk", "duration_seconds": 170, "source": "Lojay"},
        {"id": "afro_last_last", "title": "Burna Boy - Last Last", "video_url": "https://www.youtube.com/embed/NKD4J9G7qgE", "duration_seconds": 226, "source": "Burna Boy"},
    ],
    
    # ============ K-POP / ASIAN ============
    "kpop_asia": [
        {"id": "kpop_dynamite", "title": "BTS - Dynamite", "video_url": "https://www.youtube.com/embed/gdZLi9oWNZg", "duration_seconds": 222, "source": "BTS"},
        {"id": "kpop_butter", "title": "BTS - Butter", "video_url": "https://www.youtube.com/embed/WMweEpGlu_U", "duration_seconds": 189, "source": "BTS"},
        {"id": "kpop_boyproblems", "title": "BTS - Boy With Luv ft. Halsey", "video_url": "https://www.youtube.com/embed/XsX3ATc3FbA", "duration_seconds": 253, "source": "BTS"},
        {"id": "kpop_ddudu", "title": "BLACKPINK - DDU-DU DDU-DU", "video_url": "https://www.youtube.com/embed/IHNzOHi8sJs", "duration_seconds": 209, "source": "BLACKPINK"},
        {"id": "kpop_howyoulike", "title": "BLACKPINK - How You Like That", "video_url": "https://www.youtube.com/embed/ioNng23DkIM", "duration_seconds": 183, "source": "BLACKPINK"},
        {"id": "kpop_icecream", "title": "BLACKPINK - Ice Cream ft. Selena Gomez", "video_url": "https://www.youtube.com/embed/vRXZj0DzXIA", "duration_seconds": 177, "source": "BLACKPINK"},
        {"id": "kpop_lovesick", "title": "BLACKPINK - Lovesick Girls", "video_url": "https://www.youtube.com/embed/dyRsYk0LyA8", "duration_seconds": 195, "source": "BLACKPINK"},
        {"id": "kpop_godsmenu", "title": "Stray Kids - God's Menu", "video_url": "https://www.youtube.com/embed/TQTlCHxyuu8", "duration_seconds": 199, "source": "Stray Kids"},
        {"id": "kpop_backstreet", "title": "Stray Kids - Back Door", "video_url": "https://www.youtube.com/embed/X-uJtV8ScYk", "duration_seconds": 190, "source": "Stray Kids"},
        {"id": "kpop_next", "title": "TWICE - What is Love?", "video_url": "https://www.youtube.com/embed/i0p1bmr0EmE", "duration_seconds": 206, "source": "TWICE"},
        {"id": "kpop_fancy", "title": "TWICE - FANCY", "video_url": "https://www.youtube.com/embed/kOHB85vDuow", "duration_seconds": 207, "source": "TWICE"},
        {"id": "kpop_eleven", "title": "IVE - ELEVEN", "video_url": "https://www.youtube.com/embed/EBbV0NMKE7I", "duration_seconds": 183, "source": "IVE"},
        {"id": "kpop_attention", "title": "NewJeans - Attention", "video_url": "https://www.youtube.com/embed/js1CtxSY38I", "duration_seconds": 180, "source": "NewJeans"},
    ],
    
    # ============ BOLLYWOOD / INDIAN ============
    "bollywood": [
        {"id": "bolly_naatu", "title": "Naatu Naatu - RRR", "video_url": "https://www.youtube.com/embed/OsU0CGZoV8E", "duration_seconds": 288, "source": "T-Series"},
        {"id": "bolly_kesariya", "title": "Kesariya - Brahmastra", "video_url": "https://www.youtube.com/embed/BddP6PYo2gs", "duration_seconds": 288, "source": "T-Series"},
        {"id": "bolly_kar", "title": "Kar Gayi Chull - Kapoor & Sons", "video_url": "https://www.youtube.com/embed/NTHz9ephYTw", "duration_seconds": 202, "source": "T-Series"},
        {"id": "bolly_badri", "title": "Badri Ki Dulhania", "video_url": "https://www.youtube.com/embed/IduytOx3GV8", "duration_seconds": 244, "source": "T-Series"},
        {"id": "bolly_ghungroo", "title": "Ghungroo - War", "video_url": "https://www.youtube.com/embed/qFuQmjBNkvY", "duration_seconds": 318, "source": "YRF"},
        {"id": "bolly_kalank", "title": "Kalank - Title Track", "video_url": "https://www.youtube.com/embed/z0k_9a2xqlc", "duration_seconds": 264, "source": "T-Series"},
        {"id": "bolly_laung", "title": "Laung Gawacha - Neha Bhasin", "video_url": "https://www.youtube.com/embed/pCrDO7LqY7Y", "duration_seconds": 220, "source": "Sony Music"},
        {"id": "bolly_kala", "title": "Kala Chashma - Baar Baar Dekho", "video_url": "https://www.youtube.com/embed/k4yXQkG2s1E", "duration_seconds": 271, "source": "Sony Music"},
        {"id": "bolly_param", "title": "Param Sundari - Mimi", "video_url": "https://www.youtube.com/embed/S5qPfPpI_p8", "duration_seconds": 178, "source": "T-Series"},
        {"id": "bolly_srivalli", "title": "Srivalli - Pushpa", "video_url": "https://www.youtube.com/embed/btNFFSo8Cv8", "duration_seconds": 237, "source": "T-Series"},
    ],
    
    # ============ CARIBBEAN / DANCEHALL ============
    "caribbean": [
        {"id": "carib_work", "title": "Rihanna - Work ft. Drake", "video_url": "https://www.youtube.com/embed/HL1UzIK-flA", "duration_seconds": 231, "source": "Rihanna"},
        {"id": "carib_controlla", "title": "Drake - Controlla", "video_url": "https://www.youtube.com/embed/Q6j51fFYxwQ", "duration_seconds": 245, "source": "Drake"},
        {"id": "carib_toosie", "title": "Drake - Toosie Slide", "video_url": "https://www.youtube.com/embed/xWggTb45brM", "duration_seconds": 247, "source": "Drake"},
        {"id": "carib_whine", "title": "Sean Paul - Get Busy", "video_url": "https://www.youtube.com/embed/4s4fQ7P2g1s", "duration_seconds": 218, "source": "Sean Paul"},
        {"id": "carib_temperature", "title": "Sean Paul - Temperature", "video_url": "https://www.youtube.com/embed/dW2MmuA1nI4", "duration_seconds": 227, "source": "Sean Paul"},
        {"id": "carib_cheerleader", "title": "OMI - Cheerleader (Felix Jaehn Remix)", "video_url": "https://www.youtube.com/embed/jGflUbPQfW8", "duration_seconds": 180, "source": "OMI"},
        {"id": "carib_close", "title": "Popcaan - Twist & Turn ft. Drake, PARTYNEXTDOOR", "video_url": "https://www.youtube.com/embed/l9a2qGK6-Qw", "duration_seconds": 198, "source": "Popcaan"},
        {"id": "carib_different", "title": "Kranium - We Can", "video_url": "https://www.youtube.com/embed/gPFT5L7tz8A", "duration_seconds": 192, "source": "Kranium"},
    ],
    
    # ============ EUROPEAN ============
    "european": [
        {"id": "euro_titanium", "title": "David Guetta ft. Sia - Titanium", "video_url": "https://www.youtube.com/embed/JRfuAukYTKg", "duration_seconds": 245, "source": "David Guetta"},
        {"id": "euro_hey", "title": "David Guetta - Hey Mama ft. Nicki Minaj", "video_url": "https://www.youtube.com/embed/uO59tfQ2TbA", "duration_seconds": 196, "source": "David Guetta"},
        {"id": "euro_lean", "title": "Major Lazer - Lean On ft. DJ Snake, MØ", "video_url": "https://www.youtube.com/embed/YqeW9_5kURI", "duration_seconds": 177, "source": "Major Lazer"},
        {"id": "euro_turn", "title": "DJ Snake - Turn Down for What ft. Lil Jon", "video_url": "https://www.youtube.com/embed/HMUDVMiITOU", "duration_seconds": 218, "source": "DJ Snake"},
        {"id": "euro_taki", "title": "DJ Snake - Taki Taki ft. Selena Gomez, Ozuna", "video_url": "https://www.youtube.com/embed/ixkoVwKQaJg", "duration_seconds": 222, "source": "DJ Snake"},
        {"id": "euro_scared", "title": "Martin Garrix - Scared To Be Lonely ft. Dua Lipa", "video_url": "https://www.youtube.com/embed/e2vBLd5Egnk", "duration_seconds": 221, "source": "Martin Garrix"},
        {"id": "euro_animals", "title": "Martin Garrix - Animals", "video_url": "https://www.youtube.com/embed/gCYcHz2k5x0", "duration_seconds": 187, "source": "Martin Garrix"},
        {"id": "euro_wake", "title": "Avicii - Wake Me Up", "video_url": "https://www.youtube.com/embed/IcrbM1l_BoI", "duration_seconds": 250, "source": "Avicii"},
        {"id": "euro_levels", "title": "Avicii - Levels", "video_url": "https://www.youtube.com/embed/_ovdm2yX4MA", "duration_seconds": 214, "source": "Avicii"},
        {"id": "euro_faded", "title": "Alan Walker - Faded", "video_url": "https://www.youtube.com/embed/60ItHLz5WEA", "duration_seconds": 212, "source": "Alan Walker"},
    ],
    
    # ============ HIP-HOP / R&B ============
    "hiphop_rnb": [
        {"id": "hh_godsplan", "title": "Drake - God's Plan", "video_url": "https://www.youtube.com/embed/xpVfcZ0ZcFM", "duration_seconds": 356, "source": "Drake"},
        {"id": "hh_hotline", "title": "Drake - Hotline Bling", "video_url": "https://www.youtube.com/embed/uxpDa-c-4Mc", "duration_seconds": 271, "source": "Drake"},
        {"id": "hh_starboy", "title": "The Weeknd - Starboy ft. Daft Punk", "video_url": "https://www.youtube.com/embed/34Na4j8AVgA", "duration_seconds": 230, "source": "The Weeknd"},
        {"id": "hh_humble", "title": "Kendrick Lamar - HUMBLE.", "video_url": "https://www.youtube.com/embed/tvTRZJ-4EyI", "duration_seconds": 177, "source": "Kendrick Lamar"},
        {"id": "hh_alright", "title": "Kendrick Lamar - Alright", "video_url": "https://www.youtube.com/embed/Z-48u_uWMHY", "duration_seconds": 391, "source": "Kendrick Lamar"},
        {"id": "hh_rockstar", "title": "Post Malone - rockstar ft. 21 Savage", "video_url": "https://www.youtube.com/embed/UceaB4D0jpo", "duration_seconds": 218, "source": "Post Malone"},
        {"id": "hh_congratulations", "title": "Post Malone - Congratulations ft. Quavo", "video_url": "https://www.youtube.com/embed/SC4xMk98Pdc", "duration_seconds": 220, "source": "Post Malone"},
        {"id": "hh_circles", "title": "Post Malone - Circles", "video_url": "https://www.youtube.com/embed/wXhTHyIgQ_U", "duration_seconds": 215, "source": "Post Malone"},
        {"id": "hh_mood", "title": "24kGoldn - Mood ft. iann dior", "video_url": "https://www.youtube.com/embed/GrAchTdepsU", "duration_seconds": 140, "source": "24kGoldn"},
        {"id": "hh_peaches", "title": "Justin Bieber - Peaches ft. Daniel Caesar, Giveon", "video_url": "https://www.youtube.com/embed/tQ0yjYUFKAE", "duration_seconds": 198, "source": "Justin Bieber"},
        {"id": "hh_stay", "title": "The Kid LAROI, Justin Bieber - STAY", "video_url": "https://www.youtube.com/embed/kTJczUoc26U", "duration_seconds": 141, "source": "The Kid LAROI"},
        {"id": "hh_industry", "title": "Lil Nas X - INDUSTRY BABY ft. Jack Harlow", "video_url": "https://www.youtube.com/embed/UTHLKHL_whs", "duration_seconds": 212, "source": "Lil Nas X"},
    ],
    
    # ============ COMEDY / ENTERTAINMENT ============
    "comedy": [
        {"id": "com_mrbean1", "title": "Mr Bean - Best Clips Collection", "video_url": "https://www.youtube.com/embed/qLITqOPg4qo", "duration_seconds": 840, "source": "Mr Bean Official"},
        {"id": "com_mrbean2", "title": "Mr Bean - The Swimming Pool", "video_url": "https://www.youtube.com/embed/oLqfsE6mCHE", "duration_seconds": 616, "source": "Mr Bean Official"},
        {"id": "com_johny", "title": "Johny Johny Yes Papa - LooLoo Kids", "video_url": "https://www.youtube.com/embed/F4tHL8reNCs", "duration_seconds": 145, "source": "LooLoo Kids"},
        {"id": "com_cocomelon", "title": "CoComelon - Bath Song", "video_url": "https://www.youtube.com/embed/WRVsOCh907o", "duration_seconds": 188, "source": "CoComelon"},
        {"id": "com_wheels", "title": "CoComelon - Wheels On The Bus", "video_url": "https://www.youtube.com/embed/e_04ZrNroTo", "duration_seconds": 211, "source": "CoComelon"},
        {"id": "com_phonics", "title": "Phonics Song - Pinkfong", "video_url": "https://www.youtube.com/embed/_UR-l3QI2nE", "duration_seconds": 175, "source": "Pinkfong"},
        {"id": "com_five_little", "title": "Five Little Monkeys - Super Simple Songs", "video_url": "https://www.youtube.com/embed/kz7F3bHJJB8", "duration_seconds": 189, "source": "Super Simple Songs"},
    ],
    
    # ============ VIRAL / TRENDING ============
    "viral_trending": [
        {"id": "viral_gangnam_dance", "title": "Gangnam Style Dance Compilation", "video_url": "https://www.youtube.com/embed/9bZkp7q19f0", "duration_seconds": 253, "source": "PSY"},
        {"id": "viral_macarena", "title": "Los del Rio - Macarena", "video_url": "https://www.youtube.com/embed/zWaymcVmJ-A", "duration_seconds": 200, "source": "Los del Rio"},
        {"id": "viral_cat_vibing", "title": "Ievan Polkka - Cat Vibing", "video_url": "https://www.youtube.com/embed/NUYvbT6vTPs", "duration_seconds": 149, "source": "Bilal Göregen"},
        {"id": "viral_caramell", "title": "Caramelldansen", "video_url": "https://www.youtube.com/embed/A67ZkAd1wmI", "duration_seconds": 167, "source": "Caramell"},
        {"id": "viral_dontworry", "title": "Bobby McFerrin - Don't Worry Be Happy", "video_url": "https://www.youtube.com/embed/d-diB65scQU", "duration_seconds": 283, "source": "Bobby McFerrin"},
        {"id": "viral_somebody", "title": "Gotye - Somebody That I Used To Know", "video_url": "https://www.youtube.com/embed/8UVNT4wvIGY", "duration_seconds": 244, "source": "Gotye"},
        {"id": "viral_take_on_me", "title": "a-ha - Take On Me", "video_url": "https://www.youtube.com/embed/djV11Xbc914", "duration_seconds": 229, "source": "a-ha"},
        {"id": "viral_never", "title": "Rick Astley - Never Gonna Give You Up", "video_url": "https://www.youtube.com/embed/dQw4w9WgXcQ", "duration_seconds": 213, "source": "Rick Astley"},
    ],
    
    # ============ MOVIES / TRAILERS ============
    "movies_trailers": [
        {"id": "mov_avatar2", "title": "Avatar 2 - Official Trailer", "video_url": "https://www.youtube.com/embed/d9MyW72ELq0", "duration_seconds": 142, "source": "20th Century Studios"},
        {"id": "mov_endgame", "title": "Avengers: Endgame - Official Trailer", "video_url": "https://www.youtube.com/embed/TcMBFSGVi1c", "duration_seconds": 182, "source": "Marvel"},
        {"id": "mov_topgun", "title": "Top Gun: Maverick - Official Trailer", "video_url": "https://www.youtube.com/embed/qSqVVswa420", "duration_seconds": 143, "source": "Paramount Pictures"},
        {"id": "mov_batman", "title": "The Batman - Official Trailer", "video_url": "https://www.youtube.com/embed/mqqft2x_Aa4", "duration_seconds": 177, "source": "Warner Bros"},
        {"id": "mov_dune", "title": "Dune - Official Trailer", "video_url": "https://www.youtube.com/embed/n9xhJrPXop4", "duration_seconds": 202, "source": "Warner Bros"},
        {"id": "mov_nwh", "title": "Spider-Man: No Way Home - Official Trailer", "video_url": "https://www.youtube.com/embed/JfVOs4VSpmA", "duration_seconds": 180, "source": "Sony Pictures"},
        {"id": "mov_matrix", "title": "The Matrix Resurrections - Official Trailer", "video_url": "https://www.youtube.com/embed/9ix7TUGVYIo", "duration_seconds": 170, "source": "Warner Bros"},
        {"id": "mov_black_panther2", "title": "Black Panther: Wakanda Forever - Official Trailer", "video_url": "https://www.youtube.com/embed/_Z3QKkl1WyM", "duration_seconds": 137, "source": "Marvel"},
    ],
    
    # ============ DOCUMENTARIES / EDUCATIONAL ============
    "documentaries": [
        {"id": "doc_our_planet", "title": "Our Planet - One Planet", "video_url": "https://www.youtube.com/embed/aETNYyrqNYE", "duration_seconds": 300, "source": "Netflix"},
        {"id": "doc_planet_earth", "title": "Planet Earth II - Cities", "video_url": "https://www.youtube.com/embed/M6sBFEasF8o", "duration_seconds": 249, "source": "BBC"},
        {"id": "doc_cosmos", "title": "Cosmos - A Spacetime Odyssey", "video_url": "https://www.youtube.com/embed/1X7fZoDs9KU", "duration_seconds": 282, "source": "National Geographic"},
        {"id": "doc_blue_planet", "title": "Blue Planet II - The Deep", "video_url": "https://www.youtube.com/embed/r9PeYPHdpNo", "duration_seconds": 267, "source": "BBC"},
        {"id": "doc_chef", "title": "Chef's Table - Preview", "video_url": "https://www.youtube.com/embed/qKqj85oo2wI", "duration_seconds": 90, "source": "Netflix"},
        {"id": "doc_ted1", "title": "TED - The Power of Vulnerability", "video_url": "https://www.youtube.com/embed/iCvmsMzlF7o", "duration_seconds": 1220, "source": "TED"},
    ],
    
    # ============ GAMING ============
    "gaming": [
        {"id": "game_minecraft", "title": "Minecraft - Official Trailer", "video_url": "https://www.youtube.com/embed/MmB9b5njVbA", "duration_seconds": 90, "source": "Minecraft"},
        {"id": "game_fortnite", "title": "Fortnite - Chapter 4 Trailer", "video_url": "https://www.youtube.com/embed/9M1ehmBKL1k", "duration_seconds": 180, "source": "Fortnite"},
        {"id": "game_gta6", "title": "GTA VI - Trailer", "video_url": "https://www.youtube.com/embed/QdBZY2fkU-0", "duration_seconds": 91, "source": "Rockstar Games"},
        {"id": "game_hogwarts", "title": "Hogwarts Legacy - Official Trailer", "video_url": "https://www.youtube.com/embed/1O6Qstncpnc", "duration_seconds": 229, "source": "Warner Bros Games"},
        {"id": "game_zelda", "title": "Zelda: Tears of the Kingdom - Trailer", "video_url": "https://www.youtube.com/embed/uHGShqcAHlQ", "duration_seconds": 188, "source": "Nintendo"},
        {"id": "game_eldenring", "title": "Elden Ring - Launch Trailer", "video_url": "https://www.youtube.com/embed/K_03kFqWfqs", "duration_seconds": 180, "source": "Bandai Namco"},
        {"id": "game_cyberpunk", "title": "Cyberpunk 2077 - Official Trailer", "video_url": "https://www.youtube.com/embed/qIcTM8WXFjk", "duration_seconds": 217, "source": "CD Projekt RED"},
    ],
    
    # ============ SPORTS HIGHLIGHTS ============
    "sports_highlights": [
        {"id": "sport_messi", "title": "Messi - World Cup 2022 Journey", "video_url": "https://www.youtube.com/embed/jIaOXHl3hRw", "duration_seconds": 600, "source": "FIFA"},
        {"id": "sport_cr7", "title": "Cristiano Ronaldo - Best Goals", "video_url": "https://www.youtube.com/embed/Oj5NHdYc4aE", "duration_seconds": 540, "source": "UEFA"},
        {"id": "sport_nba", "title": "NBA - Top 10 Plays of the Month", "video_url": "https://www.youtube.com/embed/1wQw-VqbN6w", "duration_seconds": 420, "source": "NBA"},
        {"id": "sport_f1", "title": "F1 - Top 10 Moments of the Season", "video_url": "https://www.youtube.com/embed/GuxCnBaDXXw", "duration_seconds": 600, "source": "Formula 1"},
        {"id": "sport_ufc", "title": "UFC - Best Knockouts", "video_url": "https://www.youtube.com/embed/O5LqPi6xYgY", "duration_seconds": 480, "source": "UFC"},
        {"id": "sport_nfl", "title": "NFL - Top 100 Plays", "video_url": "https://www.youtube.com/embed/N6F3RMQM4aU", "duration_seconds": 900, "source": "NFL"},
    ],
}

async def check_embeddable(session, video_id, title):
    """Check if video is embeddable using oembed"""
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

async def verify_library():
    """Verify all videos in the new library are embeddable"""
    print("=" * 60)
    print("VERIFYING NEW CONTENT LIBRARY")
    print("=" * 60)
    
    verified_library = {}
    total_videos = 0
    passed_videos = 0
    failed_videos = []
    
    async with aiohttp.ClientSession() as session:
        for category, videos in NEW_CONTENT_LIBRARY.items():
            print(f"\n--- {category.upper()} ({len(videos)} videos) ---")
            verified_category = []
            
            for video in videos:
                video_url = video.get("video_url", "")
                video_id = video_url.split("/")[-1].split("?")[0] if video_url else None
                
                if not video_id:
                    print(f"  ❌ {video['title'][:40]} - No video ID")
                    failed_videos.append((video['title'], "No video ID"))
                    continue
                
                total_videos += 1
                is_ok, error = await check_embeddable(session, video_id, video["title"])
                
                if is_ok:
                    print(f"  ✅ {video['title'][:45]}")
                    # Add thumbnail if not present
                    if "thumbnail" not in video:
                        video["thumbnail"] = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
                    video["category"] = category
                    verified_category.append(video)
                    passed_videos += 1
                else:
                    print(f"  ❌ {video['title'][:40]} - {error}")
                    failed_videos.append((video['title'], error))
                
                await asyncio.sleep(0.15)  # Rate limit
            
            if verified_category:
                verified_library[category] = verified_category
    
    print("\n" + "=" * 60)
    print(f"VERIFICATION COMPLETE: {passed_videos}/{total_videos} videos passed")
    print("=" * 60)
    
    if failed_videos:
        print(f"\n{len(failed_videos)} videos failed:")
        for title, error in failed_videos[:20]:
            print(f"  - {title[:50]}: {error}")
        if len(failed_videos) > 20:
            print(f"  ... and {len(failed_videos) - 20} more")
    
    return verified_library, passed_videos, total_videos

def save_verified_library(library):
    """Save verified library to tv_scheduler.py"""
    
    # Generate Python code for the library
    lines = ["# ============ VERIFIED EMBEDDABLE CONTENT LIBRARY ============",
             "# All videos verified embeddable as of " + datetime.now(timezone.utc).strftime("%Y-%m-%d"),
             "# Total videos: " + str(sum(len(v) for v in library.values())),
             "",
             "CONTENT_LIBRARY = {"]
    
    for category, videos in library.items():
        lines.append(f'    "{category}": [')
        for video in videos:
            lines.append(f'        {{"id": "{video["id"]}", "title": "{video["title"]}", "video_url": "{video["video_url"]}", "thumbnail": "{video.get("thumbnail", "")}", "duration_seconds": {video["duration_seconds"]}, "source": "{video["source"]}", "category": "{category}"}},')
        lines.append("    ],")
    
    lines.append("}")
    
    return "\n".join(lines)

async def main():
    verified, passed, total = await verify_library()
    
    if passed > 0:
        print(f"\n✅ {passed} verified embeddable videos ready!")
        
        # Save to a new file
        code = save_verified_library(verified)
        
        with open("/app/backend/services/verified_content.py", "w") as f:
            f.write(code)
        
        print(f"\n📁 Saved to: /app/backend/services/verified_content.py")
        print(f"\nCategories:")
        for cat, vids in verified.items():
            print(f"  {cat}: {len(vids)} videos")
    else:
        print("❌ No videos passed verification!")

if __name__ == "__main__":
    asyncio.run(main())
