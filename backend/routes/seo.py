"""
SEO Routes - Sitemap, Robots.txt, and Structured Data
"""

from fastapi import APIRouter, Response
from fastapi.responses import PlainTextResponse
from datetime import datetime, timezone
import logging

router = APIRouter(tags=["SEO"])

logger = logging.getLogger(__name__)

# Database will be injected
db = None

def set_db(database):
    global db
    db = database

BASE_URL = "https://ztvlivestream.com"


@router.get("/sitemap.xml")
async def get_sitemap():
    """Generate dynamic XML sitemap"""
    
    urls = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Static pages
    static_pages = [
        ("", "1.0", "daily"),  # Homepage
        ("/watch", "0.9", "always"),
        ("/guide", "0.9", "hourly"),
        ("/play", "0.8", "daily"),
        ("/schedule", "0.8", "daily"),
        ("/upload-and-earn", "0.7", "weekly"),
        ("/content-guidelines", "0.6", "monthly"),
        ("/creator-agreement", "0.6", "monthly"),
        ("/creators", "0.7", "weekly"),
        ("/login", "0.5", "monthly"),
        ("/signup", "0.5", "monthly"),
    ]
    
    for path, priority, changefreq in static_pages:
        urls.append(f"""  <url>
    <loc>{BASE_URL}{path}</loc>
    <lastmod>{now}</lastmod>
    <changefreq>{changefreq}</changefreq>
    <priority>{priority}</priority>
  </url>""")
    
    # Creator profiles
    try:
        creators = await db.users.find(
            {},
            {"username": 1, "user_id": 1, "updated_at": 1}
        ).limit(1000).to_list(1000)
        
        for creator in creators:
            username = creator.get("username") or creator.get("user_id")
            updated = creator.get("updated_at")
            lastmod = updated.strftime("%Y-%m-%d") if updated else now
            urls.append(f"""  <url>
    <loc>{BASE_URL}/creator/{username}</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>""")
    except Exception as e:
        logger.error(f"Error fetching creators for sitemap: {e}")
    
    # Approved videos
    try:
        videos = await db.creator_videos.find(
            {"status": "approved"},
            {"id": 1, "created_at": 1}
        ).limit(500).to_list(500)
        
        for video in videos:
            video_id = video.get("id")
            created = video.get("created_at")
            lastmod = created.strftime("%Y-%m-%d") if created else now
            urls.append(f"""  <url>
    <loc>{BASE_URL}/watch?v={video_id}</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>""")
    except Exception as e:
        logger.error(f"Error fetching videos for sitemap: {e}")
    
    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
{chr(10).join(urls)}
</urlset>"""
    
    return Response(
        content=sitemap,
        media_type="application/xml"
    )


@router.get("/robots.txt")
async def get_robots():
    """Generate robots.txt"""
    robots = f"""# ZTVLIVE Robots.txt
User-agent: *
Allow: /
Allow: /watch
Allow: /guide
Allow: /play
Allow: /creator/
Allow: /content-guidelines
Allow: /creators

# Disallow admin and private pages
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard
Disallow: /library
Disallow: /upload-and-earn
Disallow: /schedule-slot
Disallow: /settings

# Sitemap
Sitemap: {BASE_URL}/sitemap.xml

# Crawl delay (be nice to our servers)
Crawl-delay: 1
"""
    return PlainTextResponse(content=robots)


@router.get("/structured-data/organization")
async def get_organization_schema():
    """Get Organization structured data"""
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "ZTVLIVE",
        "url": BASE_URL,
        "logo": f"{BASE_URL}/logo.png",
        "description": "24/7 Interactive Live TV featuring trivia games, creator content, and entertainment",
        "sameAs": [
            "https://twitter.com/ztvlive",
            "https://instagram.com/ztvlive",
            "https://youtube.com/@ztvlive"
        ],
        "contactPoint": {
            "@type": "ContactPoint",
            "email": "support@ztvlivestream.com",
            "contactType": "customer support"
        }
    }


@router.get("/structured-data/website")
async def get_website_schema():
    """Get WebSite structured data with search action"""
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "ZTVLIVE",
        "url": BASE_URL,
        "description": "24/7 Interactive Live TV - Watch, play, and earn",
        "potentialAction": {
            "@type": "SearchAction",
            "target": f"{BASE_URL}/search?q={{search_term_string}}",
            "query-input": "required name=search_term_string"
        }
    }


@router.get("/structured-data/video-channel")
async def get_video_channel_schema():
    """Get BroadcastChannel structured data"""
    return {
        "@context": "https://schema.org",
        "@type": "BroadcastChannel",
        "name": "ZTVLIVE",
        "broadcastDisplayName": "ZTVLIVE - 24/7 Live TV",
        "broadcastChannelId": "ztvlive",
        "inBroadcastLineup": {
            "@type": "CableOrSatelliteService",
            "name": "ZTVLIVE Streaming"
        },
        "genre": ["Entertainment", "Game Show", "Creator Content"],
        "broadcastServiceTier": "Free"
    }


@router.get("/structured-data/creator/{username}")
async def get_creator_schema(username: str):
    """Get Person structured data for a creator"""
    creator = await db.users.find_one(
        {"$or": [{"username": username}, {"user_id": username}]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not creator:
        return {"error": "Creator not found"}
    
    # Get video count
    video_count = await db.creator_videos.count_documents({
        "creator_id": creator.get("user_id"),
        "status": "approved"
    })
    
    # Get follower count
    follower_count = await db.creator_followers.count_documents({
        "creator_id": creator.get("user_id")
    })
    
    same_as = []
    if creator.get("youtube_url"):
        same_as.append(creator["youtube_url"])
    if creator.get("instagram_url"):
        same_as.append(creator["instagram_url"])
    if creator.get("twitter_url"):
        same_as.append(creator["twitter_url"])
    if creator.get("website_url"):
        same_as.append(creator["website_url"])
    
    return {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": creator.get("name"),
        "alternateName": creator.get("username"),
        "description": creator.get("bio", f"{creator.get('name')} is a content creator on ZTVLIVE"),
        "url": f"{BASE_URL}/creator/{username}",
        "image": creator.get("avatar_url"),
        "sameAs": same_as,
        "interactionStatistic": [
            {
                "@type": "InteractionCounter",
                "interactionType": "https://schema.org/FollowAction",
                "userInteractionCount": follower_count
            }
        ],
        "mainEntityOfPage": {
            "@type": "ProfilePage",
            "name": f"{creator.get('name')} on ZTVLIVE",
            "description": f"Watch {creator.get('name')}'s content on ZTVLIVE - 24/7 Interactive Live TV"
        }
    }


@router.get("/structured-data/video/{video_id}")
async def get_video_schema(video_id: str):
    """Get VideoObject structured data for a video"""
    video = await db.creator_videos.find_one(
        {"id": video_id},
        {"_id": 0}
    )
    
    if not video:
        return {"error": "Video not found"}
    
    creator = await db.users.find_one(
        {"user_id": video.get("creator_id")},
        {"name": 1}
    )
    
    duration_iso = None
    if video.get("duration_seconds"):
        mins = video["duration_seconds"] // 60
        secs = video["duration_seconds"] % 60
        duration_iso = f"PT{mins}M{secs}S"
    
    upload_date = video.get("created_at")
    if upload_date:
        upload_date = upload_date.strftime("%Y-%m-%d") if hasattr(upload_date, 'strftime') else str(upload_date)
    
    return {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": video.get("title", "Untitled"),
        "description": video.get("description", "Watch on ZTVLIVE"),
        "thumbnailUrl": video.get("thumbnail_url"),
        "uploadDate": upload_date,
        "duration": duration_iso,
        "contentUrl": video.get("video_url"),
        "embedUrl": f"{BASE_URL}/embed/video/{video_id}",
        "interactionStatistic": {
            "@type": "InteractionCounter",
            "interactionType": "https://schema.org/WatchAction",
            "userInteractionCount": video.get("views", 0)
        },
        "author": {
            "@type": "Person",
            "name": creator.get("name") if creator else "ZTVLIVE Creator"
        },
        "publisher": {
            "@type": "Organization",
            "name": "ZTVLIVE",
            "logo": {
                "@type": "ImageObject",
                "url": f"{BASE_URL}/logo.png"
            }
        }
    }


@router.get("/structured-data/schedule")
async def get_schedule_schema():
    """Get TVSchedule structured data for today's schedule"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get today's schedule
    bookings = await db.creator_bookings.find(
        {
            "slot_date": today,
            "status": {"$in": ["approved", "confirmed"]}
        },
        {"_id": 0}
    ).sort([("slot_start_hour", 1), ("slot_start_minute", 1)]).to_list(96)
    
    episodes = []
    for booking in bookings:
        creator = await db.users.find_one(
            {"user_id": booking.get("creator_id")},
            {"name": 1}
        )
        
        start_time = f"{booking.get('slot_start_hour', 0):02d}:{booking.get('slot_start_minute', 0):02d}"
        
        episodes.append({
            "@type": "TVEpisode",
            "name": booking.get("title", "Creator Content"),
            "description": booking.get("description", ""),
            "startDate": f"{today}T{start_time}:00",
            "duration": "PT15M",
            "actor": {
                "@type": "Person",
                "name": creator.get("name") if creator else "ZTVLIVE"
            }
        })
    
    return {
        "@context": "https://schema.org",
        "@type": "TVSeries",
        "name": "ZTVLIVE Daily Schedule",
        "description": "24/7 Interactive Live TV featuring games and creator content",
        "url": f"{BASE_URL}/guide",
        "numberOfEpisodes": len(episodes),
        "episode": episodes
    }


@router.get("/meta-tags/{page_type}/{identifier}")
async def get_meta_tags(page_type: str, identifier: str = ""):
    """Get meta tags for different page types"""
    
    meta = {
        "title": "ZTVLIVE - 24/7 Interactive Live TV",
        "description": "Watch, play, and earn on ZTVLIVE - the 24/7 interactive streaming platform featuring trivia games and creator content.",
        "og_title": "ZTVLIVE - 24/7 Interactive Live TV",
        "og_description": "Watch, play, and earn on ZTVLIVE",
        "og_image": f"{BASE_URL}/og-default.jpg",
        "og_type": "website",
        "twitter_card": "summary_large_image"
    }
    
    if page_type == "creator" and identifier:
        creator = await db.users.find_one(
            {"$or": [{"username": identifier}, {"user_id": identifier}]},
            {"name": 1, "bio": 1, "avatar_url": 1}
        )
        if creator:
            meta["title"] = f"{creator.get('name')} | ZTVLIVE Creator"
            meta["description"] = creator.get("bio") or f"Watch {creator.get('name')}'s content on ZTVLIVE"
            meta["og_title"] = f"{creator.get('name')} | ZTVLIVE"
            meta["og_description"] = meta["description"]
            meta["og_image"] = creator.get("avatar_url") or meta["og_image"]
            meta["og_type"] = "profile"
    
    elif page_type == "video" and identifier:
        video = await db.creator_videos.find_one({"id": identifier})
        if video:
            meta["title"] = f"{video.get('title', 'Video')} | ZTVLIVE"
            meta["description"] = video.get("description", "Watch on ZTVLIVE")[:160]
            meta["og_title"] = video.get("title", "Video")
            meta["og_description"] = meta["description"]
            meta["og_image"] = video.get("thumbnail_url") or meta["og_image"]
            meta["og_type"] = "video.other"
    
    elif page_type == "guide":
        meta["title"] = "TV Guide | ZTVLIVE"
        meta["description"] = "See what's on ZTVLIVE - 24/7 live TV schedule with creator content and interactive games"
        meta["og_title"] = "ZTVLIVE TV Guide"
    
    elif page_type == "watch":
        meta["title"] = "Watch Live | ZTVLIVE"
        meta["description"] = "Watch ZTVLIVE now - 24/7 interactive live TV"
        meta["og_title"] = "Watch ZTVLIVE Live"
    
    return meta
