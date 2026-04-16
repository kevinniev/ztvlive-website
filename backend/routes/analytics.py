"""
Analytics Routes for ZTVLIVE Admin Dashboard
- Real-time viewer tracking
- Page view analytics
- Content performance metrics
- App install tracking
- SEO campaign tracking
- Geolocation-enhanced demographics
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import secrets
import logging

from services.geolocation import ipinfo_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# MongoDB connection will be injected
db = None

# In-memory concurrent viewer tracking
concurrent_viewers: Dict[str, Dict[str, Any]] = {}

def set_db(database):
    global db
    db = database

@router.post("/track/app-install")
async def track_app_install(
    platform: str,  # android, ios, desktop
    source: Optional[str] = None,  # website, seo, direct
    campaign: Optional[str] = None,
    session_id: Optional[str] = None,
    request: Request = None
):
    """Track app installation from website"""
    if not session_id:
        session_id = secrets.token_hex(16)
    
    install_data = {
        "id": secrets.token_hex(16),
        "platform": platform.lower(),
        "source": source or "website",
        "campaign": campaign,
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc),
        "user_agent": request.headers.get("user-agent") if request else None,
        "ip_address": request.client.host if request else None,
        "referrer": request.headers.get("referer") if request else None
    }
    
    await db.app_installs.insert_one(install_data)
    
    return {"tracked": True, "install_id": install_data["id"]}

@router.post("/track/seo-visit")
async def track_seo_visit(
    campaign: str,
    source: str,  # google, bing, social, etc.
    medium: Optional[str] = None,  # organic, cpc, referral
    keyword: Optional[str] = None,
    landing_page: Optional[str] = None,
    session_id: Optional[str] = None,
    request: Request = None
):
    """Track SEO campaign visit"""
    if not session_id:
        session_id = secrets.token_hex(16)
    
    seo_data = {
        "id": secrets.token_hex(16),
        "campaign": campaign,
        "source": source,
        "medium": medium or "organic",
        "keyword": keyword,
        "landing_page": landing_page,
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc),
        "user_agent": request.headers.get("user-agent") if request else None,
        "ip_address": request.client.host if request else None
    }
    
    await db.seo_visits.insert_one(seo_data)
    
    return {"tracked": True, "session_id": session_id}

# ============== TUTORIAL ANALYTICS ==============
@router.post("/track/tutorial")
async def track_tutorial_event(
    event_type: str,  # step_view, step_complete, tutorial_complete, play_click
    step_number: Optional[int] = None,
    step_name: Optional[str] = None,
    session_id: Optional[str] = None,
    time_spent_seconds: Optional[int] = None,
    request: Request = None
):
    """Track tutorial step interactions for conversion optimization"""
    if not session_id:
        session_id = secrets.token_hex(16)
    
    tutorial_data = {
        "id": secrets.token_hex(16),
        "event_type": event_type,
        "step_number": step_number,
        "step_name": step_name,
        "session_id": session_id,
        "time_spent_seconds": time_spent_seconds,
        "timestamp": datetime.now(timezone.utc),
        "user_agent": request.headers.get("user-agent") if request else None,
        "ip_address": request.client.host if request else None,
        "referrer": request.headers.get("referer") if request else None
    }
    
    await db.tutorial_analytics.insert_one(tutorial_data)
    
    return {"tracked": True, "event_id": tutorial_data["id"]}

@router.get("/tutorial/summary")
async def get_tutorial_analytics_summary(days: int = 30):
    """Get tutorial funnel analytics for admin dashboard"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get step view counts
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "event_type": "step_view"}},
        {"$group": {"_id": "$step_number", "views": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    step_views = await db.tutorial_analytics.aggregate(pipeline).to_list(None)
    
    # Get total unique sessions that started tutorial
    started_sessions = await db.tutorial_analytics.distinct(
        "session_id",
        {"timestamp": {"$gte": start_date}, "step_number": 1, "event_type": "step_view"}
    )
    
    # Get total completions
    completions = await db.tutorial_analytics.count_documents({
        "timestamp": {"$gte": start_date},
        "event_type": "tutorial_complete"
    })
    
    # Get play clicks from tutorial
    play_clicks = await db.tutorial_analytics.count_documents({
        "timestamp": {"$gte": start_date},
        "event_type": "play_click"
    })
    
    # Calculate drop-off rates per step
    funnel = []
    total_started = len(started_sessions)
    for sv in step_views:
        step_num = sv["_id"]
        views = sv["views"]
        drop_off = round((1 - (views / total_started)) * 100, 1) if total_started > 0 else 0
        funnel.append({
            "step": step_num,
            "views": views,
            "drop_off_percent": drop_off
        })
    
    return {
        "total_started": total_started,
        "total_completions": completions,
        "completion_rate": round((completions / total_started) * 100, 1) if total_started > 0 else 0,
        "play_clicks": play_clicks,
        "conversion_rate": round((play_clicks / total_started) * 100, 1) if total_started > 0 else 0,
        "funnel": funnel,
        "period_days": days
    }

# ============== EMBED REQUEST (Partner Program) ==============
@router.post("/embed-request")
async def submit_embed_request(
    request: Request
):
    """Submit a request for embed code access"""
    data = await request.json()
    
    embed_request = {
        "id": secrets.token_hex(16),
        "name": data.get("name"),
        "email": data.get("email"),
        "website": data.get("website"),
        "monthly_visitors": data.get("monthly_visitors"),
        "message": data.get("message"),
        "request_type": data.get("request_type", "embed_code"),
        "status": "pending",  # pending, approved, rejected
        "timestamp": datetime.now(timezone.utc),
        "ip_address": request.client.host if request else None,
        "user_agent": request.headers.get("user-agent") if request else None
    }
    
    await db.embed_requests.insert_one(embed_request)
    
    return {
        "success": True,
        "message": "Request submitted successfully",
        "request_id": embed_request["id"]
    }

@router.get("/embed-requests")
async def get_embed_requests(status: Optional[str] = None, limit: int = 50):
    """Get embed code access requests (admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    cursor = db.embed_requests.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit)
    requests = await cursor.to_list(None)
    
    return {
        "requests": requests,
        "total": await db.embed_requests.count_documents(query)
    }

@router.put("/embed-request/{request_id}/status")
async def update_embed_request_status(request_id: str, status: str):
    """Update embed request status (admin only)"""
    if status not in ["pending", "approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.embed_requests.update_one(
        {"id": request_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {"success": True, "status": status}

@router.get("/app-installs/summary")
async def get_app_install_summary(days: int = 30):
    """Get app installation statistics"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Total installs
    total_installs = await db.app_installs.count_documents({
        "timestamp": {"$gte": start_date}
    })
    
    # Installs by platform
    platform_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    platform_cursor = db.app_installs.aggregate(platform_pipeline)
    by_platform = {doc["_id"]: doc["count"] async for doc in platform_cursor}
    
    # Installs by source
    source_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    source_cursor = db.app_installs.aggregate(source_pipeline)
    by_source = {doc["_id"]: doc["count"] async for doc in source_cursor}
    
    # Daily installs
    daily_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_cursor = db.app_installs.aggregate(daily_pipeline)
    daily_installs = [{"date": doc["_id"], "installs": doc["count"]} async for doc in daily_cursor]
    
    return {
        "period_days": days,
        "total_installs": total_installs,
        "by_platform": by_platform,
        "by_source": by_source,
        "daily_installs": daily_installs,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@router.get("/seo/summary")
async def get_seo_summary(days: int = 30):
    """Get SEO campaign statistics"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Total SEO visits
    total_visits = await db.seo_visits.count_documents({
        "timestamp": {"$gte": start_date}
    })
    
    # By campaign
    campaign_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$campaign", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    campaign_cursor = db.seo_visits.aggregate(campaign_pipeline)
    by_campaign = [{"campaign": doc["_id"], "visits": doc["count"]} async for doc in campaign_cursor]
    
    # By source
    source_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    source_cursor = db.seo_visits.aggregate(source_pipeline)
    by_source = {doc["_id"]: doc["count"] async for doc in source_cursor}
    
    # By medium
    medium_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$medium", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    medium_cursor = db.seo_visits.aggregate(medium_pipeline)
    by_medium = {doc["_id"]: doc["count"] async for doc in medium_cursor}
    
    # Top keywords
    keyword_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "keyword": {"$ne": None}}},
        {"$group": {"_id": "$keyword", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    keyword_cursor = db.seo_visits.aggregate(keyword_pipeline)
    top_keywords = [{"keyword": doc["_id"], "visits": doc["count"]} async for doc in keyword_cursor]
    
    return {
        "period_days": days,
        "total_seo_visits": total_visits,
        "by_campaign": by_campaign,
        "by_source": by_source,
        "by_medium": by_medium,
        "top_keywords": top_keywords,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@router.get("/visitors/overview")
async def get_visitors_overview(days: int = 30):
    """Get comprehensive visitor overview for admin dashboard"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total page views
    total_views = await db.page_views.count_documents({
        "timestamp": {"$gte": start_date}
    })
    
    # Today's views
    today_views = await db.page_views.count_documents({
        "timestamp": {"$gte": today_start}
    })
    
    # Unique visitors
    unique_sessions = await db.page_views.distinct(
        "session_id",
        {"timestamp": {"$gte": start_date}}
    )
    
    # App installs
    total_installs = await db.app_installs.count_documents({
        "timestamp": {"$gte": start_date}
    })
    
    today_installs = await db.app_installs.count_documents({
        "timestamp": {"$gte": today_start}
    })
    
    # SEO visits
    total_seo = await db.seo_visits.count_documents({
        "timestamp": {"$gte": start_date}
    })
    
    # Concurrent viewers
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=2)
    active = sum(1 for v in concurrent_viewers.values() if v["last_seen"] > cutoff)
    
    # Installs by platform (for chart)
    platform_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}}
    ]
    platform_cursor = db.app_installs.aggregate(platform_pipeline)
    installs_by_platform = {doc["_id"]: doc["count"] async for doc in platform_cursor}
    
    # Daily traffic (last 7 days)
    last_7_days = datetime.now(timezone.utc) - timedelta(days=7)
    traffic_pipeline = [
        {"$match": {"timestamp": {"$gte": last_7_days}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
            "views": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    traffic_cursor = db.page_views.aggregate(traffic_pipeline)
    daily_traffic = [{"date": doc["_id"], "views": doc["views"]} async for doc in traffic_cursor]
    
    return {
        "period_days": days,
        "total_page_views": total_views,
        "today_views": today_views,
        "unique_visitors": len(unique_sessions),
        "concurrent_viewers": active,
        "app_installs": {
            "total": total_installs,
            "today": today_installs,
            "by_platform": installs_by_platform
        },
        "seo_visits": total_seo,
        "daily_traffic": daily_traffic,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@router.get("/demographics")
async def get_demographics(days: int = 30):
    """Get demographic data including locations, times, and duration"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Location data by country
    location_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "country": {"$ne": None}}},
        {"$group": {"_id": "$country", "visitors": {"$sum": 1}}},
        {"$sort": {"visitors": -1}},
        {"$limit": 20}
    ]
    location_cursor = db.page_views.aggregate(location_pipeline)
    by_country = [{"country": doc["_id"], "visitors": doc["visitors"]} async for doc in location_cursor]
    
    # Location by city (top 15)
    city_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "city": {"$ne": None}}},
        {"$group": {"_id": {"city": "$city", "country": "$country"}, "visitors": {"$sum": 1}}},
        {"$sort": {"visitors": -1}},
        {"$limit": 15}
    ]
    city_cursor = db.page_views.aggregate(city_pipeline)
    by_city = [{"city": doc["_id"]["city"], "country": doc["_id"]["country"], "visitors": doc["visitors"]} async for doc in city_cursor]
    
    # Peak hours (0-23)
    hours_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$hour": "$timestamp"},
            "views": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    hours_cursor = db.page_views.aggregate(hours_pipeline)
    by_hour = {doc["_id"]: doc["views"] async for doc in hours_cursor}
    
    # Fill in missing hours with 0
    hourly_traffic = [{"hour": h, "views": by_hour.get(h, 0)} for h in range(24)]
    
    # Peak days of week (0=Monday, 6=Sunday)
    days_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dayOfWeek": "$timestamp"},
            "views": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    days_cursor = db.page_views.aggregate(days_pipeline)
    by_day = {doc["_id"]: doc["views"] async for doc in days_cursor}
    
    day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    daily_pattern = [{"day": day_names[d-1], "views": by_day.get(d, 0)} for d in range(1, 8)]
    
    # Average session duration
    session_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "session_duration": {"$exists": True, "$gt": 0}}},
        {"$group": {
            "_id": None,
            "avg_duration": {"$avg": "$session_duration"},
            "max_duration": {"$max": "$session_duration"},
            "total_sessions": {"$sum": 1}
        }}
    ]
    session_cursor = db.sessions.aggregate(session_pipeline)
    session_stats = None
    async for doc in session_cursor:
        session_stats = doc
    
    # Duration distribution (buckets)
    duration_buckets = [
        {"label": "< 1 min", "min": 0, "max": 60},
        {"label": "1-5 min", "min": 60, "max": 300},
        {"label": "5-15 min", "min": 300, "max": 900},
        {"label": "15-30 min", "min": 900, "max": 1800},
        {"label": "30-60 min", "min": 1800, "max": 3600},
        {"label": "> 60 min", "min": 3600, "max": 999999}
    ]
    
    duration_distribution = []
    for bucket in duration_buckets:
        count = await db.sessions.count_documents({
            "timestamp": {"$gte": start_date},
            "session_duration": {"$gte": bucket["min"], "$lt": bucket["max"]}
        })
        duration_distribution.append({
            "label": bucket["label"],
            "sessions": count
        })
    
    # Watch time by content type/category
    watchtime_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "watch_duration": {"$exists": True}}},
        {"$group": {
            "_id": "$category",
            "total_watch_time": {"$sum": "$watch_duration"},
            "views": {"$sum": 1}
        }},
        {"$sort": {"total_watch_time": -1}},
        {"$limit": 10}
    ]
    watchtime_cursor = db.content_views.aggregate(watchtime_pipeline)
    watchtime_by_category = [{"category": doc["_id"] or "Unknown", "watch_time_minutes": round(doc["total_watch_time"] / 60, 1), "views": doc["views"]} async for doc in watchtime_cursor]
    
    # Device types
    device_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "device_type": {"$ne": None}}},
        {"$group": {"_id": "$device_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    device_cursor = db.page_views.aggregate(device_pipeline)
    by_device = {doc["_id"]: doc["count"] async for doc in device_cursor}
    
    # Browser stats
    browser_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "browser": {"$ne": None}}},
        {"$group": {"_id": "$browser", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    browser_cursor = db.page_views.aggregate(browser_pipeline)
    by_browser = [{"browser": doc["_id"], "count": doc["count"]} async for doc in browser_cursor]
    
    return {
        "period_days": days,
        "locations": {
            "by_country": by_country,
            "by_city": by_city
        },
        "time_patterns": {
            "hourly_traffic": hourly_traffic,
            "daily_pattern": daily_pattern,
            "peak_hour": max(hourly_traffic, key=lambda x: x["views"])["hour"] if hourly_traffic else None,
            "peak_day": max(daily_pattern, key=lambda x: x["views"])["day"] if daily_pattern else None
        },
        "session_duration": {
            "average_seconds": round(session_stats["avg_duration"], 1) if session_stats else 0,
            "average_formatted": format_duration(session_stats["avg_duration"]) if session_stats else "0:00",
            "max_seconds": session_stats["max_duration"] if session_stats else 0,
            "total_sessions": session_stats["total_sessions"] if session_stats else 0,
            "distribution": duration_distribution
        },
        "watch_time": {
            "by_category": watchtime_by_category
        },
        "devices": {
            "by_type": by_device,
            "by_browser": by_browser
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

def format_duration(seconds):
    """Format seconds to human readable duration"""
    if not seconds:
        return "0:00"
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    if minutes >= 60:
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours}h {mins}m"
    return f"{minutes}:{secs:02d}"

@router.post("/track/session-start")
async def track_session_start(
    session_id: str,
    page: str,
    request: Request = None
):
    """Track when a session starts with enhanced geolocation"""
    # Get location from IP using ipinfo.io
    ip_address = request.client.host if request else None
    user_agent = request.headers.get("user-agent", "") if request else ""
    
    # Get geolocation data
    geo_data = {"country": None, "country_code": None, "city": None, "region": None}
    if ip_address:
        try:
            geo_data = await ipinfo_service.get_location(ip_address)
        except Exception as e:
            logger.warning(f"Geolocation lookup failed: {e}")
    
    # Parse device type from user agent
    device_type = "desktop"
    if "mobile" in user_agent.lower() or "android" in user_agent.lower():
        device_type = "mobile"
    elif "ipad" in user_agent.lower() or "tablet" in user_agent.lower():
        device_type = "tablet"
    
    # Parse browser
    browser = "Unknown"
    if "chrome" in user_agent.lower() and "edg" not in user_agent.lower():
        browser = "Chrome"
    elif "firefox" in user_agent.lower():
        browser = "Firefox"
    elif "safari" in user_agent.lower() and "chrome" not in user_agent.lower():
        browser = "Safari"
    elif "edg" in user_agent.lower():
        browser = "Edge"
    elif "opera" in user_agent.lower():
        browser = "Opera"
    
    session_data = {
        "session_id": session_id,
        "start_time": datetime.now(timezone.utc),
        "timestamp": datetime.now(timezone.utc),
        "ip_address": ip_address,
        "user_agent": user_agent,
        "device_type": device_type,
        "browser": browser,
        "entry_page": page,
        # Enhanced geolocation from ipinfo.io
        "country": geo_data.get("country") or ipinfo_service.get_country_name(geo_data.get("country_code", "XX")),
        "country_code": geo_data.get("country_code"),
        "city": geo_data.get("city"),
        "region": geo_data.get("region"),
        "latitude": geo_data.get("latitude"),
        "longitude": geo_data.get("longitude"),
        "timezone": geo_data.get("timezone"),
        "org": geo_data.get("org"),
        "session_duration": 0
    }
    
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": session_data},
        upsert=True
    )
    
    return {"tracked": True, "session_id": session_id, "location": geo_data.get("country")}

@router.post("/track/session-end")
async def track_session_end(
    session_id: str,
    duration_seconds: int
):
    """Track when a session ends with duration"""
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "end_time": datetime.now(timezone.utc),
            "session_duration": duration_seconds
        }}
    )
    
    return {"tracked": True, "duration": duration_seconds}

@router.post("/track/content-view")
async def track_content_view(
    content_id: str,
    category: Optional[str] = None,
    watch_duration: Optional[int] = 0,
    session_id: Optional[str] = None,
    request: Request = None
):
    """Track content/video view with watch duration"""
    view_data = {
        "id": secrets.token_hex(16),
        "content_id": content_id,
        "category": category,
        "watch_duration": watch_duration,
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc),
        "ip_address": request.client.host if request else None
    }
    
    await db.content_views.insert_one(view_data)
    
    return {"tracked": True}

@router.post("/track/pageview")
async def track_pageview(
    page: str,
    session_id: Optional[str] = None,
    referrer: Optional[str] = None,
    request: Request = None
):
    """Track a page view with geolocation"""
    if not session_id:
        session_id = secrets.token_hex(16)
    
    ip_address = request.client.host if request else None
    user_agent = request.headers.get("user-agent", "") if request else ""
    
    # Get geolocation data
    geo_data = {}
    if ip_address:
        try:
            geo_data = await ipinfo_service.get_location(ip_address)
        except Exception as e:
            logger.warning(f"Pageview geolocation failed: {e}")
    
    # Parse device type
    device_type = "desktop"
    if "mobile" in user_agent.lower() or "android" in user_agent.lower():
        device_type = "mobile"
    elif "ipad" in user_agent.lower() or "tablet" in user_agent.lower():
        device_type = "tablet"
    
    # Parse browser
    browser = "Unknown"
    if "chrome" in user_agent.lower() and "edg" not in user_agent.lower():
        browser = "Chrome"
    elif "firefox" in user_agent.lower():
        browser = "Firefox"
    elif "safari" in user_agent.lower() and "chrome" not in user_agent.lower():
        browser = "Safari"
    elif "edg" in user_agent.lower():
        browser = "Edge"
    
    view_data = {
        "id": secrets.token_hex(16),
        "page": page,
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc),
        "referrer": referrer,
        "user_agent": user_agent,
        "ip_address": ip_address,
        "device_type": device_type,
        "browser": browser,
        # Geolocation data from ipinfo.io
        "country": geo_data.get("country") or ipinfo_service.get_country_name(geo_data.get("country_code", "XX")),
        "country_code": geo_data.get("country_code"),
        "city": geo_data.get("city"),
        "region": geo_data.get("region"),
        "latitude": geo_data.get("latitude"),
        "longitude": geo_data.get("longitude")
    }
    
    await db.page_views.insert_one(view_data)
    
    # Update concurrent viewers
    concurrent_viewers[session_id] = {
        "page": page,
        "last_seen": datetime.now(timezone.utc),
        "country": geo_data.get("country")
    }
    
    return {"session_id": session_id, "tracked": True}

@router.post("/track/content")
async def track_content_view(
    content_id: str,
    content_title: str,
    category: str,
    session_id: str,
    watch_duration_seconds: int = 0,
    completed: bool = False
):
    """Track content/video view"""
    view_data = {
        "id": secrets.token_hex(16),
        "content_id": content_id,
        "content_title": content_title,
        "category": category,
        "session_id": session_id,
        "watch_duration_seconds": watch_duration_seconds,
        "completed": completed,
        "timestamp": datetime.now(timezone.utc)
    }
    
    await db.content_views.insert_one(view_data)
    
    return {"tracked": True}

@router.post("/track/heartbeat")
async def track_heartbeat(session_id: str, page: str):
    """Update session heartbeat for concurrent viewer tracking"""
    concurrent_viewers[session_id] = {
        "page": page,
        "last_seen": datetime.now(timezone.utc)
    }
    return {"active": True}

@router.get("/concurrent")
async def get_concurrent_viewers():
    """Get current concurrent viewers count (real visitors to add to base)"""
    # Clean up stale sessions (older than 2 minutes)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=2)
    active_sessions = {
        k: v for k, v in concurrent_viewers.items()
        if v["last_seen"] > cutoff
    }
    
    # Count by page
    by_page = {}
    for session_id, data in active_sessions.items():
        page = data.get("page", "unknown")
        by_page[page] = by_page.get(page, 0) + 1
    
    return {
        "count": len(active_sessions),  # This gets added to the 1.385M base
        "total": len(active_sessions),
        "by_page": by_page,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/summary")
async def get_analytics_summary(
    days: int = 7,
    admin: dict = None  # Will be injected
):
    """Get analytics summary for admin dashboard"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Total page views
    total_views = await db.page_views.count_documents({
        "timestamp": {"$gte": start_date}
    })
    
    # Unique visitors (by session)
    unique_sessions = await db.page_views.distinct(
        "session_id",
        {"timestamp": {"$gte": start_date}}
    )
    
    # Views by page
    views_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$page", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    views_by_page_cursor = db.page_views.aggregate(views_pipeline)
    views_by_page = {doc["_id"]: doc["count"] async for doc in views_by_page_cursor}
    
    # Views by hour (last 24 hours)
    last_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    hourly_pipeline = [
        {"$match": {"timestamp": {"$gte": last_24h}}},
        {"$group": {
            "_id": {"$hour": "$timestamp"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    hourly_cursor = db.page_views.aggregate(hourly_pipeline)
    views_by_hour = [{"hour": doc["_id"], "views": doc["count"]} async for doc in hourly_cursor]
    
    # Top content
    content_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": "$content_id",
            "title": {"$first": "$content_title"},
            "category": {"$first": "$category"},
            "views": {"$sum": 1},
            "total_watch_time": {"$sum": "$watch_duration_seconds"},
            "completions": {"$sum": {"$cond": ["$completed", 1, 0]}}
        }},
        {"$sort": {"views": -1}},
        {"$limit": 20}
    ]
    top_content_cursor = db.content_views.aggregate(content_pipeline)
    top_content = []
    async for doc in top_content_cursor:
        top_content.append({
            "content_id": doc["_id"],
            "title": doc["title"],
            "category": doc["category"],
            "views": doc["views"],
            "total_watch_time_minutes": round(doc["total_watch_time"] / 60, 1),
            "completions": doc["completions"]
        })
    
    # Get concurrent viewers
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=2)
    active_sessions = {
        k: v for k, v in concurrent_viewers.items()
        if v["last_seen"] > cutoff
    }
    
    return {
        "period_days": days,
        "total_page_views": total_views,
        "unique_visitors": len(unique_sessions),
        "concurrent_viewers": len(active_sessions),
        "views_by_page": views_by_page,
        "views_by_hour": views_by_hour,
        "top_content": top_content,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@router.get("/realtime")
async def get_realtime_stats():
    """Get real-time statistics for live dashboard"""
    now = datetime.now(timezone.utc)
    last_5min = now - timedelta(minutes=5)
    last_hour = now - timedelta(hours=1)
    
    # Recent page views (last 5 min)
    recent_views = await db.page_views.count_documents({
        "timestamp": {"$gte": last_5min}
    })
    
    # Hourly views
    hourly_views = await db.page_views.count_documents({
        "timestamp": {"$gte": last_hour}
    })
    
    # Concurrent viewers
    cutoff = now - timedelta(minutes=2)
    active = sum(1 for v in concurrent_viewers.values() if v["last_seen"] > cutoff)
    
    # Recent content views
    recent_content = await db.content_views.find(
        {"timestamp": {"$gte": last_5min}},
        {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    return {
        "concurrent_viewers": active,
        "views_last_5min": recent_views,
        "views_last_hour": hourly_views,
        "recent_content_views": recent_content,
        "timestamp": now.isoformat()
    }

@router.get("/content/{content_id}")
async def get_content_analytics(content_id: str, days: int = 30):
    """Get analytics for specific content"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    pipeline = [
        {"$match": {
            "content_id": content_id,
            "timestamp": {"$gte": start_date}
        }},
        {"$group": {
            "_id": None,
            "total_views": {"$sum": 1},
            "unique_viewers": {"$addToSet": "$session_id"},
            "total_watch_time": {"$sum": "$watch_duration_seconds"},
            "completions": {"$sum": {"$cond": ["$completed", 1, 0]}},
            "title": {"$first": "$content_title"},
            "category": {"$first": "$category"}
        }}
    ]
    
    result = await db.content_views.aggregate(pipeline).to_list(1)
    
    if not result:
        return {
            "content_id": content_id,
            "total_views": 0,
            "unique_viewers": 0,
            "total_watch_time_minutes": 0,
            "completions": 0,
            "completion_rate": 0
        }
    
    data = result[0]
    total_views = data["total_views"]
    
    return {
        "content_id": content_id,
        "title": data.get("title", "Unknown"),
        "category": data.get("category", "Unknown"),
        "total_views": total_views,
        "unique_viewers": len(data["unique_viewers"]),
        "total_watch_time_minutes": round(data["total_watch_time"] / 60, 1),
        "completions": data["completions"],
        "completion_rate": round((data["completions"] / total_views) * 100, 1) if total_views > 0 else 0
    }



@router.get("/geolocation/stats")
async def get_geolocation_stats():
    """Get geolocation service statistics"""
    return {
        "service": "ipinfo.io",
        "cache_stats": ipinfo_service.get_cache_stats(),
        "status": "active" if ipinfo_service.has_token else "limited_free_tier"
    }


@router.get("/geolocation/lookup/{ip_address}")
async def lookup_ip_geolocation(ip_address: str):
    """
    Lookup geolocation for a specific IP address
    Useful for admin debugging
    """
    try:
        location = await ipinfo_service.get_location(ip_address)
        return {
            "ip": ip_address,
            "location": location
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/demographics/enhanced")
async def get_enhanced_demographics(days: int = 30):
    """
    Get enhanced demographic data using geolocation service
    Includes more accurate location data from ipinfo.io
    """
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Location data by country (using enhanced geo data)
    location_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "country": {"$ne": None, "$ne": "Unknown", "$ne": "Local"}}},
        {"$group": {"_id": {"country": "$country", "country_code": "$country_code"}, "visitors": {"$sum": 1}}},
        {"$sort": {"visitors": -1}},
        {"$limit": 25}
    ]
    location_cursor = db.page_views.aggregate(location_pipeline)
    by_country = []
    async for doc in location_cursor:
        country_name = doc["_id"].get("country") or ipinfo_service.get_country_name(doc["_id"].get("country_code", "XX"))
        by_country.append({
            "country": country_name,
            "country_code": doc["_id"].get("country_code", "XX"),
            "visitors": doc["visitors"]
        })
    
    # Top cities
    city_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "city": {"$ne": None}}},
        {"$group": {"_id": {"city": "$city", "country": "$country", "region": "$region"}, "visitors": {"$sum": 1}}},
        {"$sort": {"visitors": -1}},
        {"$limit": 20}
    ]
    city_cursor = db.page_views.aggregate(city_pipeline)
    by_city = []
    async for doc in city_cursor:
        by_city.append({
            "city": doc["_id"].get("city"),
            "region": doc["_id"].get("region"),
            "country": doc["_id"].get("country"),
            "visitors": doc["visitors"]
        })
    
    # Regions within top countries
    region_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "region": {"$ne": None}}},
        {"$group": {"_id": {"region": "$region", "country": "$country"}, "visitors": {"$sum": 1}}},
        {"$sort": {"visitors": -1}},
        {"$limit": 15}
    ]
    region_cursor = db.page_views.aggregate(region_pipeline)
    by_region = []
    async for doc in region_cursor:
        by_region.append({
            "region": doc["_id"].get("region"),
            "country": doc["_id"].get("country"),
            "visitors": doc["visitors"]
        })
    
    # Geographic coordinates for map visualization
    geo_coords_pipeline = [
        {"$match": {
            "timestamp": {"$gte": start_date}, 
            "latitude": {"$ne": None},
            "longitude": {"$ne": None}
        }},
        {"$group": {
            "_id": {"lat": {"$round": ["$latitude", 1]}, "lon": {"$round": ["$longitude", 1]}},
            "count": {"$sum": 1},
            "city": {"$first": "$city"},
            "country": {"$first": "$country"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 100}
    ]
    geo_cursor = db.page_views.aggregate(geo_coords_pipeline)
    geo_points = []
    async for doc in geo_cursor:
        if doc["_id"]["lat"] and doc["_id"]["lon"]:
            geo_points.append({
                "lat": doc["_id"]["lat"],
                "lon": doc["_id"]["lon"],
                "count": doc["count"],
                "city": doc.get("city"),
                "country": doc.get("country")
            })
    
    return {
        "period_days": days,
        "locations": {
            "by_country": by_country,
            "by_city": by_city,
            "by_region": by_region,
            "geo_points": geo_points
        },
        "service": "ipinfo.io",
        "generated_at": datetime.now(timezone.utc).isoformat()
    }



# In-memory activity feed for real-time tracking
activity_feed: List[Dict[str, Any]] = []
MAX_ACTIVITY_ITEMS = 100

def add_activity(event_type: str, description: str, details: dict = None):
    """Add an activity to the real-time feed"""
    global activity_feed
    activity = {
        "id": secrets.token_hex(8),
        "event_type": event_type,
        "description": description,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    activity_feed.insert(0, activity)
    # Keep only last 100 activities
    if len(activity_feed) > MAX_ACTIVITY_ITEMS:
        activity_feed = activity_feed[:MAX_ACTIVITY_ITEMS]

@router.post("/track/page-visit")
async def track_page_visit(
    request: Request,
    page: str,
    referrer: Optional[str] = None,
    session_id: Optional[str] = None
):
    """Track page visits for real-time analytics"""
    if not session_id:
        session_id = secrets.token_hex(16)
    
    # Get geo info
    ip = request.client.host if request else "unknown"
    geo_info = await ipinfo_service.get_location(ip)
    
    visit_data = {
        "id": secrets.token_hex(16),
        "page": page,
        "session_id": session_id,
        "referrer": referrer or request.headers.get("referer"),
        "user_agent": request.headers.get("user-agent") if request else None,
        "ip_address": ip,
        "country": geo_info.get("country") if geo_info else None,
        "city": geo_info.get("city") if geo_info else None,
        "timestamp": datetime.now(timezone.utc)
    }
    
    # Store in DB
    if db:
        await db.page_visits.insert_one(visit_data)
    
    # Add to activity feed
    location = f"{geo_info.get('city', 'Unknown')}, {geo_info.get('country', 'Unknown')}" if geo_info else "Unknown"
    add_activity(
        "page_visit",
        f"Someone visited {page}",
        {"page": page, "location": location}
    )
    
    return {"tracked": True, "session_id": session_id}

@router.post("/track/game-action")
async def track_game_action(
    request: Request,
    action: str,  # joined, answered, won_prize, etc.
    player_id: Optional[str] = None,
    details: Optional[dict] = None
):
    """Track game actions for real-time activity feed"""
    ip = request.client.host if request else "unknown"
    geo_info = await ipinfo_service.get_location(ip)
    
    location = f"{geo_info.get('city', 'Unknown')}, {geo_info.get('country', 'Unknown')}" if geo_info else "Unknown"
    
    action_descriptions = {
        "joined": "A new player joined the game",
        "answered": "A player submitted an answer",
        "won_prize": "A player won a prize!",
        "claimed_prize": "A player claimed their prize",
        "shared": "A player shared the game"
    }
    
    add_activity(
        f"game_{action}",
        action_descriptions.get(action, f"Player action: {action}"),
        {"action": action, "location": location, "player_id": player_id, **(details or {})}
    )
    
    return {"tracked": True}

@router.get("/activity-feed")
async def get_activity_feed(limit: int = 50):
    """Get real-time activity feed for admin dashboard"""
    return {
        "activities": activity_feed[:limit],
        "total": len(activity_feed),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/realtime-stats")
async def get_realtime_stats():
    """Get real-time statistics for admin dashboard"""
    now = datetime.now(timezone.utc)
    
    # Count page visits in last hour
    one_hour_ago = now - timedelta(hours=1)
    five_min_ago = now - timedelta(minutes=5)
    
    hourly_visits = 0
    recent_visits = 0
    
    if db:
        hourly_visits = await db.page_visits.count_documents({
            "timestamp": {"$gte": one_hour_ago}
        })
        recent_visits = await db.page_visits.count_documents({
            "timestamp": {"$gte": five_min_ago}
        })
    
    return {
        "visits_last_hour": hourly_visits,
        "visits_last_5min": recent_visits,
        "active_feed_items": len(activity_feed),
        "timestamp": now.isoformat()
    }
