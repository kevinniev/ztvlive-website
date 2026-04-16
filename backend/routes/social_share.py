"""
Social Share Kit
Auto-generate promotional graphics and share links for creators
"""

from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import HTMLResponse, JSONResponse
from datetime import datetime, timezone
from typing import Optional
import logging
import urllib.parse

router = APIRouter(prefix="/share", tags=["Social Share Kit"])

logger = logging.getLogger(__name__)

# Database will be injected
db = None

def set_db(database):
    global db
    db = database


# ============ SHARE LINK GENERATORS ============

@router.get("/creator/{creator_id}")
async def get_creator_share_kit(creator_id: str):
    """Get complete share kit for a creator"""
    
    creator = await db.users.find_one(
        {"user_id": creator_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    base_url = "https://ztvlivestream.com"
    username = creator.get("username") or creator_id
    profile_url = f"{base_url}/creator/{username}"
    
    # Generate share texts
    creator_name = creator.get("name", "Creator")
    
    share_texts = {
        "twitter": f"Check out {creator_name} on @ZTVLIVE! Watch their content 24/7 🎬📺 {profile_url}",
        "facebook": f"I'm watching {creator_name} on ZTVLIVE - 24/7 Interactive Live TV! Check them out:",
        "linkedin": f"Discover amazing content from {creator_name} on ZTVLIVE - the 24/7 interactive streaming platform.",
        "whatsapp": f"Hey! Check out {creator_name} on ZTVLIVE 📺 {profile_url}",
        "email_subject": f"Check out {creator_name} on ZTVLIVE!",
        "email_body": f"Hey!\n\nI found this awesome creator on ZTVLIVE - {creator_name}. You should check out their content!\n\n{profile_url}\n\nZTVLIVE is a 24/7 interactive TV platform where you can watch great content and play along with surveys."
    }
    
    # Generate share URLs
    share_urls = {
        "twitter": f"https://twitter.com/intent/tweet?text={urllib.parse.quote(share_texts['twitter'])}",
        "facebook": f"https://www.facebook.com/sharer/sharer.php?u={urllib.parse.quote(profile_url)}&quote={urllib.parse.quote(share_texts['facebook'])}",
        "linkedin": f"https://www.linkedin.com/sharing/share-offsite/?url={urllib.parse.quote(profile_url)}",
        "whatsapp": f"https://wa.me/?text={urllib.parse.quote(share_texts['whatsapp'])}",
        "telegram": f"https://t.me/share/url?url={urllib.parse.quote(profile_url)}&text={urllib.parse.quote(f'Check out {creator_name} on ZTVLIVE!')}",
        "reddit": f"https://reddit.com/submit?url={urllib.parse.quote(profile_url)}&title={urllib.parse.quote(f'{creator_name} on ZTVLIVE')}",
        "email": f"mailto:?subject={urllib.parse.quote(share_texts['email_subject'])}&body={urllib.parse.quote(share_texts['email_body'])}"
    }
    
    # Embed code for websites
    embed_code = f'''<iframe 
  src="{base_url}/embed/creator/{username}" 
  width="350" 
  height="200" 
  frameborder="0" 
  allow="autoplay; encrypted-media" 
  allowfullscreen>
</iframe>'''
    
    return {
        "creator": {
            "name": creator_name,
            "username": username,
            "avatar_url": creator.get("avatar_url"),
            "profile_url": profile_url
        },
        "share_texts": share_texts,
        "share_urls": share_urls,
        "embed_code": embed_code,
        "qr_code_url": f"{base_url}/api/share/qr/{username}",
        "og_image_url": f"{base_url}/api/share/og-image/creator/{username}"
    }


@router.get("/slot/{booking_id}")
async def get_slot_share_kit(booking_id: str):
    """Get share kit for a scheduled slot"""
    
    booking = await db.creator_bookings.find_one(
        {"booking_id": booking_id},
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    creator = await db.users.find_one(
        {"user_id": booking.get("creator_id")},
        {"_id": 0, "name": 1, "username": 1}
    )
    
    base_url = "https://ztvlivestream.com"
    creator_name = creator.get("name", "Creator") if creator else "Creator"
    slot_title = booking.get("title", "Live Content")
    
    # Format date/time
    slot_date = booking.get("slot_date", "")
    slot_hour = booking.get("slot_start_hour", 0)
    slot_minute = booking.get("slot_start_minute", 0)
    
    try:
        dt = datetime.strptime(f"{slot_date} {slot_hour}:{slot_minute}", "%Y-%m-%d %H:%M")
        formatted_date = dt.strftime("%B %d at %I:%M %p")
    except (ValueError, TypeError):
        formatted_date = f"{slot_date} at {slot_hour}:{slot_minute:02d}"
    
    watch_url = f"{base_url}/watch?slot={booking_id}"
    
    share_texts = {
        "twitter": f"🔴 GOING LIVE on ZTVLIVE!\n\n📺 {slot_title}\n🎬 {creator_name}\n📅 {formatted_date}\n\nWatch here: {watch_url}",
        "facebook": f"I'm going live on ZTVLIVE! Tune in to watch \"{slot_title}\" - {formatted_date}",
        "instagram": f"🔴 GOING LIVE!\n\n{slot_title}\n📅 {formatted_date}\n\n📺 Watch on ZTVLIVE\n🔗 Link in bio\n\n#ZTVLIVE #LiveTV #Creator",
        "whatsapp": f"Hey! I'm going live on ZTVLIVE! 📺\n\n{slot_title}\n{formatted_date}\n\nWatch here: {watch_url}",
        "countdown_text": f"⏰ {creator_name} goes live in {{countdown}}!\nWatch: {watch_url}"
    }
    
    share_urls = {
        "twitter": f"https://twitter.com/intent/tweet?text={urllib.parse.quote(share_texts['twitter'])}",
        "facebook": f"https://www.facebook.com/sharer/sharer.php?u={urllib.parse.quote(watch_url)}&quote={urllib.parse.quote(share_texts['facebook'])}",
        "whatsapp": f"https://wa.me/?text={urllib.parse.quote(share_texts['whatsapp'])}",
        "telegram": f"https://t.me/share/url?url={urllib.parse.quote(watch_url)}&text={urllib.parse.quote(f'{creator_name} is going live on ZTVLIVE!')}"
    }
    
    # Countdown embed widget
    countdown_embed = f'''<div id="ztvlive-countdown" data-slot="{booking_id}"></div>
<script src="{base_url}/embed/countdown.js"></script>'''
    
    return {
        "slot": {
            "booking_id": booking_id,
            "title": slot_title,
            "creator_name": creator_name,
            "date": slot_date,
            "time": f"{slot_hour}:{slot_minute:02d}",
            "formatted_date": formatted_date,
            "watch_url": watch_url
        },
        "share_texts": share_texts,
        "share_urls": share_urls,
        "countdown_embed": countdown_embed,
        "calendar_links": {
            "google": generate_google_calendar_link(slot_title, creator_name, watch_url, slot_date, slot_hour, slot_minute),
            "ical": f"{base_url}/api/share/ical/{booking_id}"
        },
        "og_image_url": f"{base_url}/api/share/og-image/slot/{booking_id}"
    }


def generate_google_calendar_link(title, creator, url, date, hour, minute):
    """Generate Google Calendar add event link"""
    try:
        start_dt = datetime.strptime(f"{date} {hour}:{minute}", "%Y-%m-%d %H:%M")
        end_dt = start_dt.replace(minute=start_dt.minute + 15)
        
        start_str = start_dt.strftime("%Y%m%dT%H%M%S")
        end_str = end_dt.strftime("%Y%m%dT%H%M%S")
        
        params = {
            "action": "TEMPLATE",
            "text": f"{title} - {creator} on ZTVLIVE",
            "dates": f"{start_str}/{end_str}",
            "details": f"Watch {creator} live on ZTVLIVE!\n\n{url}",
            "location": url
        }
        
        return f"https://calendar.google.com/calendar/render?{urllib.parse.urlencode(params)}"
    except (ValueError, TypeError):
        return None


@router.get("/ical/{booking_id}")
async def get_ical_file(booking_id: str):
    """Generate iCal file for a scheduled slot"""
    
    booking = await db.creator_bookings.find_one(
        {"booking_id": booking_id},
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    creator = await db.users.find_one(
        {"user_id": booking.get("creator_id")},
        {"name": 1}
    )
    
    creator_name = creator.get("name", "Creator") if creator else "Creator"
    slot_title = booking.get("title", "Live Content")
    slot_date = booking.get("slot_date", "")
    slot_hour = booking.get("slot_start_hour", 0)
    slot_minute = booking.get("slot_start_minute", 0)
    
    try:
        start_dt = datetime.strptime(f"{slot_date} {slot_hour}:{slot_minute}", "%Y-%m-%d %H:%M")
        end_dt = start_dt.replace(minute=start_dt.minute + 15)
        
        start_str = start_dt.strftime("%Y%m%dT%H%M%SZ")
        end_str = end_dt.strftime("%Y%m%dT%H%M%SZ")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    ical = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ZTVLIVE//EN
BEGIN:VEVENT
UID:{booking_id}@ztvlivestream.com
DTSTAMP:{datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")}
DTSTART:{start_str}
DTEND:{end_str}
SUMMARY:{slot_title} - {creator_name} on ZTVLIVE
DESCRIPTION:Watch {creator_name} live on ZTVLIVE!\\nhttps://ztvlivestream.com/watch?slot={booking_id}
URL:https://ztvlivestream.com/watch?slot={booking_id}
END:VEVENT
END:VCALENDAR"""
    
    return HTMLResponse(
        content=ical,
        media_type="text/calendar",
        headers={"Content-Disposition": f"attachment; filename=ztvlive-{booking_id}.ics"}
    )


# ============ PROMOTIONAL GRAPHICS DATA ============

@router.get("/promo-data/slot/{booking_id}")
async def get_slot_promo_data(booking_id: str):
    """Get data for generating promotional graphics for a slot"""
    
    booking = await db.creator_bookings.find_one(
        {"booking_id": booking_id},
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    creator = await db.users.find_one(
        {"user_id": booking.get("creator_id")},
        {"_id": 0, "name": 1, "avatar_url": 1}
    )
    
    slot_date = booking.get("slot_date", "")
    slot_hour = booking.get("slot_start_hour", 0)
    slot_minute = booking.get("slot_start_minute", 0)
    
    try:
        dt = datetime.strptime(f"{slot_date} {slot_hour}:{slot_minute}", "%Y-%m-%d %H:%M")
        formatted_date = dt.strftime("%B %d")
        formatted_time = dt.strftime("%I:%M %p")
        weekday = dt.strftime("%A")
    except (ValueError, TypeError):
        formatted_date = slot_date
        formatted_time = f"{slot_hour}:{slot_minute:02d}"
        weekday = ""
    
    return {
        "template_data": {
            "creator_name": creator.get("name", "Creator") if creator else "Creator",
            "creator_avatar": creator.get("avatar_url") if creator else None,
            "title": booking.get("title", "Live Content"),
            "date": formatted_date,
            "time": formatted_time,
            "weekday": weekday,
            "thumbnail": booking.get("thumbnail"),
            "category": booking.get("category", "Entertainment")
        },
        "suggested_templates": [
            {
                "name": "Instagram Story",
                "size": "1080x1920",
                "format": "vertical"
            },
            {
                "name": "Twitter/X Post",
                "size": "1200x675",
                "format": "landscape"
            },
            {
                "name": "Facebook Post",
                "size": "1200x630",
                "format": "landscape"
            },
            {
                "name": "YouTube Thumbnail",
                "size": "1280x720",
                "format": "landscape"
            },
            {
                "name": "Square Post",
                "size": "1080x1080",
                "format": "square"
            }
        ],
        "color_scheme": {
            "primary": "#DC2626",
            "secondary": "#7C3AED",
            "background": "#09090B",
            "text": "#FFFFFF"
        },
        "branding": {
            "logo_url": "https://ztvlivestream.com/logo.png",
            "tagline": "24/7 Interactive Live TV",
            "hashtags": ["#ZTVLIVE", "#LiveTV", "#Creator", "#GoingLive"]
        }
    }


# ============ ANALYTICS ============

@router.post("/track-click")
async def track_share_click(
    share_type: str = Query(..., description="twitter, facebook, whatsapp, etc."),
    content_type: str = Query(..., description="creator, slot, video"),
    content_id: str = Query(..., description="ID of shared content")
):
    """Track when someone clicks a share link"""
    await db.share_analytics.insert_one({
        "share_type": share_type,
        "content_type": content_type,
        "content_id": content_id,
        "clicked_at": datetime.now(timezone.utc)
    })
    return {"success": True}


@router.get("/analytics/{creator_id}")
async def get_share_analytics(
    creator_id: str,
    authorization: str = Header(None)
):
    """Get share analytics for a creator"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get share counts by platform
    pipeline = [
        {"$match": {"content_id": {"$regex": creator_id}}},
        {"$group": {"_id": "$share_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    by_platform = await db.share_analytics.aggregate(pipeline).to_list(20)
    
    # Get total shares
    total = await db.share_analytics.count_documents({"content_id": {"$regex": creator_id}})
    
    return {
        "total_shares": total,
        "by_platform": {item["_id"]: item["count"] for item in by_platform}
    }
