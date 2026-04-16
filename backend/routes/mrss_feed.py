"""
ZTVLIVE MRSS Feed for Syndication Partners
Industry-standard Media RSS feed for platforms like Pluto TV, Xumo, Samsung TV Plus, etc.

Features:
- Full MRSS 1.5.1 spec compliance
- Channel metadata with branding
- Episode/item listing with rich media tags
- Thumbnail support with multiple sizes
- Duration, content ratings, categories
- Proper XML namespaces for media elements
"""

from fastapi import APIRouter, Request, Query
from fastapi.responses import Response
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
import xml.etree.ElementTree as ET
from xml.dom import minidom
import logging

router = APIRouter(prefix="/mrss", tags=["MRSS Feed"])

logger = logging.getLogger(__name__)

# Channel Configuration
CHANNEL_CONFIG = {
    "title": "ZTVLIVE",
    "description": "24/7 Interactive Live TV featuring trivia games, creator content, and entertainment. Play along with polls, win prizes, and watch amazing content from creators worldwide.",
    "link": "https://ztvlivestream.com",
    "language": "en-us",
    "copyright": f"Copyright {datetime.now().year} ZTVLIVE. All rights reserved.",
    "webmaster": "support@ztvlivestream.com",
    "managing_editor": "content@ztvlivestream.com",
    "category": "Entertainment",
    "ttl": 15,  # Time to live in minutes
    "image": {
        "url": "https://ztvlivestream.com/logo.png",
        "title": "ZTVLIVE",
        "link": "https://ztvlivestream.com",
        "width": 144,
        "height": 144
    }
}

# Content ratings mapping
CONTENT_RATINGS = {
    "general": "TV-G",
    "family": "TV-G",
    "teen": "TV-PG",
    "mature": "TV-14",
    "adult": "TV-MA"
}

# Category mappings for MRSS
CATEGORY_MAPPING = {
    "music": "Music",
    "sports": "Sports",
    "gaming": "Gaming",
    "comedy": "Comedy",
    "podcast": "Talk Shows",
    "news": "News",
    "education": "Educational",
    "entertainment": "Entertainment",
    "lifestyle": "Lifestyle",
    "tech": "Technology",
    "trivia": "Game Shows",
    "creator_content": "Entertainment",
    "other": "Entertainment"
}


def get_db():
    """Get database connection from main server"""
    from server import db
    return db


def format_duration_iso8601(seconds: int) -> str:
    """Convert seconds to ISO 8601 duration format (PT1H30M45S)"""
    if not seconds or seconds <= 0:
        return "PT0S"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    duration = "PT"
    if hours:
        duration += f"{hours}H"
    if minutes:
        duration += f"{minutes}M"
    if secs or (not hours and not minutes):
        duration += f"{secs}S"
    
    return duration


def format_duration_colons(seconds: int) -> str:
    """Convert seconds to HH:MM:SS format"""
    if not seconds or seconds <= 0:
        return "00:00:00"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def format_rfc822_date(dt: datetime) -> str:
    """Format datetime as RFC 822 for RSS"""
    if not dt:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%a, %d %b %Y %H:%M:%S %z")


def prettify_xml(elem: ET.Element) -> str:
    """Return a pretty-printed XML string with proper namespace handling"""
    # Register namespaces to avoid ns0, ns1 prefixes
    ET.register_namespace('media', 'http://search.yahoo.com/mrss/')
    ET.register_namespace('dcterms', 'http://purl.org/dc/terms/')
    ET.register_namespace('atom', 'http://www.w3.org/2005/Atom')
    ET.register_namespace('pluto', 'http://pluto.tv/')
    
    rough_string = ET.tostring(elem, encoding='unicode')
    reparsed = minidom.parseString(rough_string)
    return reparsed.toprettyxml(indent="  ", encoding=None)


def escape_xml(text: str) -> str:
    """Escape special XML characters"""
    if not text:
        return ""
    return (str(text)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;"))


async def build_mrss_feed(
    base_url: str,
    content_type: str = "all",
    category: str = None,
    limit: int = 100,
    include_scheduled: bool = True
) -> str:
    """
    Build the MRSS feed XML using string templates for clean output.
    
    Args:
        base_url: Base URL for the feed (e.g., https://ztvlivestream.com)
        content_type: Filter by content type (all, creator, ai, scheduled)
        category: Filter by category
        limit: Maximum number of items
        include_scheduled: Include upcoming scheduled content
    """
    db = get_db()
    
    # Gather content items
    items = []
    
    # Get creator videos from creator_videos collection
    if content_type in ["all", "creator"]:
        query = {"status": "approved"}
        if category:
            query["category"] = category
            
        creator_videos = await db.creator_videos.find(query).sort("created_at", -1).limit(limit).to_list(limit)
        
        for video in creator_videos:
            items.append({
                "id": video.get("id", str(video.get("_id", ""))),
                "title": video.get("title", "Untitled"),
                "description": video.get("description", ""),
                "video_url": video.get("video_url", ""),
                "thumbnail_url": video.get("thumbnail_url", ""),
                "duration_seconds": video.get("duration_seconds", 0),
                "creator_name": video.get("creator_name", "ZTVLIVE"),
                "category": video.get("category", "entertainment"),
                "created_at": video.get("created_at"),
                "content_type": "creator",
                "views": video.get("views", 0),
                "tags": video.get("tags", [])
            })
    
    # Get scheduled creator bookings
    if content_type in ["all", "scheduled"] and include_scheduled:
        now = datetime.now(timezone.utc)
        query = {
            "status": {"$in": ["approved", "confirmed"]},
            "slot_date": {"$gte": now.strftime("%Y-%m-%d")}
        }
        if category:
            query["category"] = category
            
        scheduled_bookings = await db.creator_bookings.find(query).sort([("slot_date", 1), ("slot_start_hour", 1)]).limit(limit).to_list(limit)
        
        for booking in scheduled_bookings:
            slot_date = booking.get("slot_date", "")
            slot_hour = booking.get("slot_start_hour", 0)
            slot_minute = booking.get("slot_start_minute", 0)
            
            try:
                scheduled_dt = datetime.strptime(
                    f"{slot_date} {slot_hour:02d}:{slot_minute:02d}",
                    "%Y-%m-%d %H:%M"
                ).replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                scheduled_dt = now
            
            items.append({
                "id": booking.get("booking_id", str(booking.get("_id", ""))),
                "title": booking.get("title", "Scheduled Content"),
                "description": booking.get("description", ""),
                "video_url": booking.get("video_url", ""),
                "thumbnail_url": booking.get("thumbnail", ""),
                "duration_seconds": booking.get("trt_seconds", booking.get("duration_minutes", 60) * 60),
                "creator_name": booking.get("creator_name", "Creator"),
                "category": booking.get("category", "creator_content"),
                "created_at": booking.get("created_at"),
                "scheduled_at": scheduled_dt,
                "content_type": "scheduled",
                "tags": []
            })
    
    # Sort by created_at descending
    items.sort(key=lambda x: x.get("scheduled_at") or x.get("created_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    items = items[:limit]
    
    # Build XML string
    now_rfc822 = format_rfc822_date(datetime.now(timezone.utc))
    
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0"',
        '     xmlns:media="http://search.yahoo.com/mrss/"',
        '     xmlns:dcterms="http://purl.org/dc/terms/"',
        '     xmlns:atom="http://www.w3.org/2005/Atom"',
        '     xmlns:pluto="http://pluto.tv/">',
        '  <channel>',
        f'    <title>{escape_xml(CHANNEL_CONFIG["title"])}</title>',
        f'    <link>{escape_xml(CHANNEL_CONFIG["link"])}</link>',
        f'    <description>{escape_xml(CHANNEL_CONFIG["description"])}</description>',
        f'    <language>{CHANNEL_CONFIG["language"]}</language>',
        f'    <copyright>{escape_xml(CHANNEL_CONFIG["copyright"])}</copyright>',
        f'    <webMaster>{CHANNEL_CONFIG["webmaster"]}</webMaster>',
        f'    <managingEditor>{CHANNEL_CONFIG["managing_editor"]}</managingEditor>',
        f'    <category>{CHANNEL_CONFIG["category"]}</category>',
        f'    <ttl>{CHANNEL_CONFIG["ttl"]}</ttl>',
        f'    <lastBuildDate>{now_rfc822}</lastBuildDate>',
        f'    <pubDate>{now_rfc822}</pubDate>',
        f'    <atom:link href="{base_url}/api/mrss/feed.xml" rel="self" type="application/rss+xml"/>',
        '    <image>',
        f'      <url>{CHANNEL_CONFIG["image"]["url"]}</url>',
        f'      <title>{escape_xml(CHANNEL_CONFIG["image"]["title"])}</title>',
        f'      <link>{CHANNEL_CONFIG["image"]["link"]}</link>',
        f'      <width>{CHANNEL_CONFIG["image"]["width"]}</width>',
        f'      <height>{CHANNEL_CONFIG["image"]["height"]}</height>',
        '    </image>',
        f'    <media:thumbnail url="{CHANNEL_CONFIG["image"]["url"]}" width="{CHANNEL_CONFIG["image"]["width"]}" height="{CHANNEL_CONFIG["image"]["height"]}"/>',
    ]
    
    # Add items
    for item in items:
        item_id = item.get("id", "")
        item_title = escape_xml(item.get("title", "Untitled"))
        description = item.get("description", "")
        if not description:
            description = f"Watch {item.get('title', 'this content')} on ZTVLIVE - 24/7 Interactive Live TV"
        description = escape_xml(description[:500])
        
        creator_name = escape_xml(item.get("creator_name", "ZTVLIVE"))
        category_raw = item.get("category", "entertainment")
        category_display = CATEGORY_MAPPING.get(category_raw, "Entertainment")
        
        pub_date = item.get("scheduled_at") or item.get("created_at")
        pub_date_str = format_rfc822_date(pub_date) if pub_date else now_rfc822
        
        # Process video URL
        video_url = item.get("video_url", "")
        media_url = ""
        media_type = "video/mp4"
        
        if video_url:
            if "youtube.com" in video_url or "youtu.be" in video_url:
                video_id = None
                if "v=" in video_url:
                    video_id = video_url.split("v=")[1].split("&")[0]
                elif "youtu.be/" in video_url:
                    video_id = video_url.split("youtu.be/")[1].split("?")[0]
                elif "embed/" in video_url:
                    video_id = video_url.split("embed/")[1].split("?")[0]
                
                if video_id:
                    media_url = f"https://www.youtube.com/embed/{video_id}"
                    media_type = "text/html"
                else:
                    media_url = video_url
            else:
                if video_url.startswith("/"):
                    media_url = f"{base_url}{video_url}"
                elif video_url.startswith("vid_"):
                    media_url = f"{base_url}/api/creator-schedule/video/{video_url}"
                else:
                    media_url = video_url
        
        thumbnail_url = item.get("thumbnail_url", "")
        duration_seconds = item.get("duration_seconds", 0)
        duration_attr = f' duration="{duration_seconds}"' if duration_seconds and duration_seconds > 0 else ""
        
        xml_parts.append('    <item>')
        xml_parts.append(f'      <title>{item_title}</title>')
        xml_parts.append(f'      <link>{base_url}/watch?v={item_id}</link>')
        xml_parts.append(f'      <description>{description}</description>')
        xml_parts.append(f'      <guid isPermaLink="false">ztvlive-{item_id}</guid>')
        xml_parts.append(f'      <pubDate>{pub_date_str}</pubDate>')
        xml_parts.append(f'      <author>{creator_name}@ztvlivestream.com ({creator_name})</author>')
        xml_parts.append(f'      <dcterms:creator>{creator_name}</dcterms:creator>')
        xml_parts.append(f'      <category>{category_display}</category>')
        
        if media_url:
            xml_parts.append(f'      <media:content url="{escape_xml(media_url)}" type="{media_type}" medium="video" isDefault="true"{duration_attr}>')
            xml_parts.append(f'        <media:title type="plain">{item_title}</media:title>')
            xml_parts.append(f'        <media:description type="plain">{description}</media:description>')
            if thumbnail_url:
                xml_parts.append(f'        <media:thumbnail url="{escape_xml(thumbnail_url)}" width="480" height="360"/>')
            xml_parts.append(f'        <media:category>{category_display}</media:category>')
            
            tags = item.get("tags", [])
            if tags:
                xml_parts.append(f'        <media:keywords>{escape_xml(", ".join(tags[:10]))}</media:keywords>')
            
            xml_parts.append(f'        <media:credit role="author">{creator_name}</media:credit>')
            xml_parts.append(f'        <media:rating scheme="urn:v-chip">{CONTENT_RATINGS.get("general", "TV-G")}</media:rating>')
            xml_parts.append('      </media:content>')
        
        if thumbnail_url:
            xml_parts.append(f'      <media:thumbnail url="{escape_xml(thumbnail_url)}"/>')
        
        # dcterms:valid for scheduled content
        if item.get("scheduled_at"):
            xml_parts.append(f'      <dcterms:valid>start={item["scheduled_at"].isoformat()};</dcterms:valid>')
        
        xml_parts.append('    </item>')
    
    xml_parts.append('  </channel>')
    xml_parts.append('</rss>')
    
    return '\n'.join(xml_parts)


# ============ ENDPOINTS ============

@router.get("/feed.xml")
@router.get("/feed")
async def get_mrss_feed(
    request: Request,
    type: str = Query("all", description="Content type: all, creator, scheduled"),
    category: str = Query(None, description="Filter by category"),
    limit: int = Query(100, ge=1, le=500, description="Maximum items to return")
):
    """
    MRSS Feed Endpoint for Syndication Partners.
    
    This endpoint returns a Media RSS (MRSS) feed compliant with industry standards
    for platforms like Pluto TV, Xumo, Samsung TV Plus, LG Channels, etc.
    
    Query Parameters:
    - type: Filter by content type (all, creator, scheduled)
    - category: Filter by category (music, sports, gaming, etc.)
    - limit: Maximum number of items (default: 100, max: 500)
    
    Returns: application/rss+xml
    """
    # Get base URL from request or environment
    base_url = os.environ.get("BASE_URL", "https://ztvlivestream.com")
    
    # Also check for production URL from frontend env
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    if frontend_url and "preview.emergentagent.com" not in frontend_url:
        base_url = frontend_url.rstrip("/api").rstrip("/")
    
    try:
        xml_content = await build_mrss_feed(
            base_url=base_url,
            content_type=type,
            category=category,
            limit=limit
        )
        
        return Response(
            content=xml_content,
            media_type="application/rss+xml",
            headers={
                "Content-Type": "application/rss+xml; charset=utf-8",
                "Cache-Control": "public, max-age=300",  # Cache for 5 minutes
                "X-Content-Type-Options": "nosniff"
            }
        )
    except Exception as e:
        logger.error(f"MRSS feed generation error: {e}")
        # Return minimal valid RSS on error
        error_xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ZTVLIVE</title>
    <link>https://ztvlivestream.com</link>
    <description>Feed temporarily unavailable</description>
  </channel>
</rss>"""
        return Response(
            content=error_xml,
            media_type="application/rss+xml",
            status_code=500
        )


@router.get("/info")
async def get_feed_info():
    """
    Get information about the MRSS feed for syndication partners.
    
    Returns feed metadata, available categories, and integration instructions.
    """
    db = get_db()
    
    # Get content counts
    creator_count = await db.creator_videos.count_documents({"status": "approved"})
    scheduled_count = await db.creator_bookings.count_documents({
        "status": {"$in": ["approved", "confirmed"]},
        "slot_date": {"$gte": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    })
    
    # Get available categories with counts
    categories = []
    for cat_key, cat_display in CATEGORY_MAPPING.items():
        count = await db.creator_videos.count_documents({
            "status": "approved",
            "category": cat_key
        })
        if count > 0:
            categories.append({
                "key": cat_key,
                "display_name": cat_display,
                "video_count": count
            })
    
    base_url = os.environ.get("BASE_URL", "https://ztvlivestream.com")
    
    return {
        "feed_name": CHANNEL_CONFIG["title"],
        "feed_description": CHANNEL_CONFIG["description"],
        "feed_url": f"{base_url}/api/mrss/feed.xml",
        "feed_format": "MRSS 1.5.1 (Media RSS)",
        "content_stats": {
            "total_creator_videos": creator_count,
            "upcoming_scheduled": scheduled_count,
            "total_available": creator_count + scheduled_count
        },
        "available_categories": categories,
        "update_frequency": "Real-time (TTL: 15 minutes)",
        "supported_platforms": [
            "Pluto TV",
            "Xumo",
            "Samsung TV Plus",
            "LG Channels",
            "Roku Channel",
            "Amazon Freevee",
            "Tubi",
            "Plex",
            "Generic MRSS consumers"
        ],
        "endpoints": {
            "main_feed": f"{base_url}/api/mrss/feed.xml",
            "with_category": f"{base_url}/api/mrss/feed.xml?category=gaming",
            "creator_only": f"{base_url}/api/mrss/feed.xml?type=creator",
            "scheduled_only": f"{base_url}/api/mrss/feed.xml?type=scheduled"
        },
        "contact": {
            "technical": "tech@ztvlivestream.com",
            "partnerships": "partnerships@ztvlivestream.com"
        },
        "content_rating": "TV-G (General Audience)",
        "language": "en-US"
    }


@router.get("/validate")
async def validate_feed():
    """
    Validate the MRSS feed structure.
    
    Performs basic validation checks on the feed to ensure it meets
    syndication platform requirements.
    """
    db = get_db()
    
    issues = []
    warnings = []
    
    # Check for content
    creator_count = await db.creator_videos.count_documents({"status": "approved"})
    if creator_count == 0:
        warnings.append("No approved creator videos found - feed will be empty")
    
    # Check for missing thumbnails
    missing_thumbs = await db.creator_videos.count_documents({
        "status": "approved",
        "$or": [
            {"thumbnail_url": None},
            {"thumbnail_url": ""},
            {"thumbnail_url": {"$exists": False}}
        ]
    })
    if missing_thumbs > 0:
        warnings.append(f"{missing_thumbs} videos are missing thumbnails")
    
    # Check for missing durations
    missing_duration = await db.creator_videos.count_documents({
        "status": "approved",
        "$or": [
            {"duration_seconds": None},
            {"duration_seconds": 0},
            {"duration_seconds": {"$exists": False}}
        ]
    })
    if missing_duration > 0:
        warnings.append(f"{missing_duration} videos are missing duration information")
    
    # Check scheduled content TRT
    missing_trt = await db.creator_bookings.count_documents({
        "status": {"$in": ["approved", "confirmed"]},
        "$or": [
            {"trt_seconds": None},
            {"trt_seconds": 0},
            {"trt_seconds": {"$exists": False}}
        ]
    })
    if missing_trt > 0:
        warnings.append(f"{missing_trt} scheduled bookings are missing TRT (Total Running Time)")
    
    # Try to generate feed to check for errors
    try:
        base_url = os.environ.get("BASE_URL", "https://ztvlivestream.com")
        xml_content = await build_mrss_feed(base_url, limit=10)
        
        # Parse to validate XML
        ET.fromstring(xml_content.encode('utf-8').decode('utf-8').replace('<?xml version="1.0" ?>', '<?xml version="1.0" encoding="UTF-8"?>'))
    except Exception as e:
        issues.append(f"Feed generation error: {str(e)}")
    
    is_valid = len(issues) == 0
    
    return {
        "valid": is_valid,
        "issues": issues,
        "warnings": warnings,
        "content_count": creator_count,
        "recommendation": "Feed is ready for syndication" if is_valid and creator_count > 0 else "Address issues before submitting to syndication partners"
    }


@router.get("/categories")
async def get_available_categories():
    """
    Get all available content categories with video counts.
    """
    db = get_db()
    
    categories = []
    for cat_key, cat_display in CATEGORY_MAPPING.items():
        count = await db.creator_videos.count_documents({
            "status": "approved",
            "category": cat_key
        })
        categories.append({
            "key": cat_key,
            "display_name": cat_display,
            "mrss_category": cat_display,
            "video_count": count,
            "feed_url": f"/api/mrss/feed.xml?category={cat_key}" if count > 0 else None
        })
    
    # Sort by count descending
    categories.sort(key=lambda x: x["video_count"], reverse=True)
    
    return {
        "categories": categories,
        "total_categories": len([c for c in categories if c["video_count"] > 0])
    }
