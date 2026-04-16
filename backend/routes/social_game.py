"""
ZTVLIVE Social Game Integration
Deep links, QR codes, and social sharing for the Unusual Fun Game Show

Features:
- Generate trackable deep links (/play?ref=, /join/{code})
- QR code generation with platform + creator tracking
- Anonymous play first, signup for rewards
- Social share with live game stats
"""

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import hashlib
import base64
import logging

router = APIRouter(prefix="/social-game", tags=["Social Game Integration"])
logger = logging.getLogger("social_game")

# ============ MODELS ============

class GenerateLinkRequest(BaseModel):
    """Request to generate a trackable game link"""
    platform: str = Field(..., description="Social platform: tiktok, instagram, twitter, youtube, facebook")
    creator: Optional[str] = Field(None, description="Creator slug: julian, sabrina_brier, boman, etc.")
    campaign: Optional[str] = Field(None, description="Campaign name: 7_day_squeeze, launch_week, etc.")
    custom_message: Optional[str] = Field(None, description="Custom message for the share card")

class GenerateQRRequest(BaseModel):
    """Request to generate a QR code"""
    platform: str
    creator: Optional[str] = None
    campaign: Optional[str] = None
    size: int = Field(300, ge=100, le=1000, description="QR code size in pixels")
    format: str = Field("png", description="Output format: png, svg")

class TrackJoinRequest(BaseModel):
    """Track when someone joins via a deep link"""
    ref: Optional[str] = None
    platform: Optional[str] = None
    creator: Optional[str] = None
    campaign: Optional[str] = None
    session_id: Optional[str] = None
    reward_id: Optional[str] = None
    engagement_velocity_ms: Optional[int] = None  # Time from page load to join
    auto_join: Optional[bool] = False

class ShareStatsResponse(BaseModel):
    """Current game stats for social sharing"""
    active_players: int
    total_plays_today: int
    top_prize: str
    current_question_topic: str
    leaderboard_top_3: List[dict]

# ============ HELPER FUNCTIONS ============

def get_db():
    """Get database connection"""
    from server import db
    return db

def generate_short_code(length: int = 8) -> str:
    """Generate a short unique code for invite links"""
    unique = uuid.uuid4().hex + datetime.now(timezone.utc).isoformat()
    hash_obj = hashlib.sha256(unique.encode())
    return base64.urlsafe_b64encode(hash_obj.digest())[:length].decode()

def build_tracking_params(platform: str = None, creator: str = None, campaign: str = None) -> str:
    """Build UTM-style tracking parameters"""
    params = []
    if platform:
        params.append(f"utm_source={platform}")
        params.append(f"ref={platform}")
    if creator:
        params.append("utm_medium=creator")
        params.append(f"creator={creator}")
    if campaign:
        params.append(f"utm_campaign={campaign}")
    return "&".join(params)

# ============ API ENDPOINTS ============

@router.post("/generate-link")
async def generate_game_link(request: GenerateLinkRequest):
    """
    Generate a trackable deep link for social sharing.
    The link will redirect to the Watch page with the game overlay auto-opened.
    """
    db = get_db()
    
    # Generate unique invite code
    invite_code = generate_short_code(8)
    
    # Build the deep link
    base_url = "https://www.ztvlivestream.com"  # Production URL
    tracking_params = build_tracking_params(request.platform, request.creator, request.campaign)
    
    # Two link formats:
    # 1. Short link with code: /join/{code}
    # 2. Direct play link: /play?{tracking_params}
    
    short_link = f"{base_url}/join/{invite_code}"
    direct_link = f"{base_url}/play?{tracking_params}"
    
    # Store the invite code mapping
    invite_record = {
        "code": invite_code,
        "platform": request.platform,
        "creator": request.creator,
        "campaign": request.campaign,
        "custom_message": request.custom_message,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "clicks": 0,
        "conversions": 0,  # Signups from this link
        "plays": 0  # Game plays from this link
    }
    
    await db.social_invite_links.insert_one(invite_record)
    
    logger.info(f"Generated invite link: {invite_code} for {request.platform}/{request.creator}")
    
    return {
        "success": True,
        "invite_code": invite_code,
        "links": {
            "short": short_link,
            "direct": direct_link,
            "qr_endpoint": f"/api/social-game/qr/{invite_code}"
        },
        "tracking": {
            "platform": request.platform,
            "creator": request.creator,
            "campaign": request.campaign
        },
        "share_text": request.custom_message or f"🎮 Join me on ZTVLIVE! Scan to play trivia and win real prizes! {short_link}"
    }


@router.get("/qr/{invite_code}")
async def get_qr_code(
    invite_code: str,
    size: int = Query(300, ge=100, le=1000),
    format: str = Query("svg", regex="^(png|svg)$")
):
    """
    Generate a QR code for an invite link.
    Returns SVG or redirects to QR code image.
    """
    db = get_db()
    
    # Verify invite code exists
    invite = await db.social_invite_links.find_one({"code": invite_code})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite code not found")
    
    # Build the target URL
    base_url = "https://www.ztvlivestream.com"
    target_url = f"{base_url}/join/{invite_code}"
    
    # Use a QR code API (qrserver.com is free and reliable)
    qr_api_url = f"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={target_url}&format={format}"
    
    # For SVG, we can embed styling
    if format == "svg":
        qr_api_url += "&color=8B5CF6&bgcolor=0A0A0A"  # Purple on dark
    
    return {
        "qr_url": qr_api_url,
        "target_url": target_url,
        "invite_code": invite_code,
        "embed_html": f'<img src="{qr_api_url}" alt="Scan to play ZTVLIVE" style="width:{size}px;height:{size}px;" />',
        "platform": invite.get("platform"),
        "creator": invite.get("creator")
    }


@router.post("/generate-qr")
async def generate_qr_direct(request: GenerateQRRequest):
    """
    Generate a QR code directly without creating an invite code first.
    Good for quick QR generation for overlays.
    """
    # First generate the link
    link_request = GenerateLinkRequest(
        platform=request.platform,
        creator=request.creator,
        campaign=request.campaign
    )
    link_result = await generate_game_link(link_request)
    
    # Then get the QR
    invite_code = link_result["invite_code"]
    qr_result = await get_qr_code(invite_code, request.size, request.format)
    
    return {
        **link_result,
        "qr": qr_result
    }


@router.post("/track-join")
async def track_join(request: TrackJoinRequest):
    """
    Track when someone joins the game via a social link.
    Called when the /play or /join page loads, or when auto_join triggers.
    
    Tracks:
    - Platform attribution (TikTok, Instagram, etc.)
    - Creator attribution (julian, sabrina, etc.)
    - Campaign attribution (7_day_squeeze, etc.)
    - Engagement velocity (ms from page load to join)
    - Reward intent (reward_id if specified)
    """
    db = get_db()
    
    # Create tracking event
    event = {
        "event_type": "join_pool" if request.auto_join else "game_join",
        "ref": request.ref,
        "platform": request.platform,
        "creator": request.creator,
        "campaign": request.campaign,
        "reward_id": request.reward_id,
        "session_id": request.session_id or str(uuid.uuid4()),
        "engagement_velocity_ms": request.engagement_velocity_ms,
        "auto_join": request.auto_join,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "converted": False  # Will be updated when they signup
    }
    
    await db.social_tracking_events.insert_one(event)
    
    # Update invite link stats if we have a ref
    if request.ref:
        await db.social_invite_links.update_one(
            {"$or": [{"code": request.ref}, {"platform": request.ref}]},
            {"$inc": {"clicks": 1, "joins": 1}}
        )
    
    # Log for real-time monitoring
    velocity_text = f"{request.engagement_velocity_ms}ms" if request.engagement_velocity_ms else "N/A"
    logger.info(f"[JoinPool] Platform: {request.platform}, Creator: {request.creator}, Velocity: {velocity_text}")
    
    return {
        "tracked": True,
        "session_id": event["session_id"],
        "event_type": event["event_type"],
        "engagement_velocity_ms": request.engagement_velocity_ms
    }


@router.get("/share-stats")
async def get_share_stats():
    """
    Get current game stats for social share cards.
    Used by share buttons to show live stats.
    """
    db = get_db()
    
    # Get today's date range
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Count active game sessions (last 5 minutes)
    five_min_ago = datetime.now(timezone.utc).isoformat()
    
    # Get leaderboard top 3
    leaderboard = await db.game_leaderboard.find(
        {},
        {"_id": 0, "username": 1, "score": 1, "streak": 1}
    ).sort("score", -1).limit(3).to_list(3)
    
    # Get today's play count
    today_plays = await db.game_sessions.count_documents({
        "started_at": {"$gte": today_start.isoformat()}
    })
    
    return {
        "active_players": max(1, len(leaderboard)),  # At least show 1
        "total_plays_today": today_plays or 47,  # Default for demo
        "top_prize": "Mystery Money Jackpot",
        "sponsor_text": "by our sponsors",
        "current_question_topic": "Pop Culture Trivia",
        "leaderboard_top_3": leaderboard or [
            {"username": "Player1", "score": 500, "streak": 3},
            {"username": "Player2", "score": 350, "streak": 2},
            {"username": "Player3", "score": 200, "streak": 1}
        ],
        "share_message": f"🎮 {today_plays or 47} players today! Join the trivia and win real prizes!",
        "hashtags": ["#ZTVLIVE", "#WinRealPrizes", "#TriviaTime"]
    }


@router.get("/analytics")
async def get_social_analytics(
    days: int = Query(7, ge=1, le=30),
    platform: str = Query(None),
    creator: str = Query(None)
):
    """
    Get analytics for social game integrations.
    Shows which platforms and creators drive the most engagement.
    """
    db = get_db()
    
    # Date range
    start_date = datetime.now(timezone.utc)
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    start_date = start_date - timedelta(days=days)
    
    # Build query
    query = {"timestamp": {"$gte": start_date.isoformat()}}
    if platform:
        query["platform"] = platform
    if creator:
        query["creator"] = creator
    
    # Get events
    events = await db.social_tracking_events.find(query).to_list(10000)
    
    # Aggregate by platform
    platform_stats = {}
    creator_stats = {}
    velocities = []
    
    for event in events:
        p = event.get("platform", "unknown")
        c = event.get("creator", "organic")
        
        if p not in platform_stats:
            platform_stats[p] = {"clicks": 0, "conversions": 0, "joins": 0}
        platform_stats[p]["clicks"] += 1
        if event.get("converted"):
            platform_stats[p]["conversions"] += 1
        if event.get("auto_join") or event.get("event_type") == "join_pool":
            platform_stats[p]["joins"] += 1
        
        if c not in creator_stats:
            creator_stats[c] = {"clicks": 0, "conversions": 0, "joins": 0}
        creator_stats[c]["clicks"] += 1
        if event.get("converted"):
            creator_stats[c]["conversions"] += 1
        if event.get("auto_join") or event.get("event_type") == "join_pool":
            creator_stats[c]["joins"] += 1
        
        # Collect velocities for averaging
        if event.get("engagement_velocity_ms"):
            velocities.append(event["engagement_velocity_ms"])
    
    # Get invite link stats
    invite_links = await db.social_invite_links.find({}).to_list(100)
    
    # Calculate average engagement velocity
    avg_velocity = sum(velocities) / len(velocities) if velocities else 0
    
    return {
        "period_days": days,
        "total_clicks": len(events),
        "total_conversions": sum(1 for e in events if e.get("converted")),
        "total_pool_joins": sum(1 for e in events if e.get("auto_join") or e.get("event_type") == "join_pool"),
        "engagement_velocity": {
            "average_ms": round(avg_velocity, 0),
            "average_seconds": round(avg_velocity / 1000, 2),
            "samples": len(velocities),
            "fastest_ms": min(velocities) if velocities else 0,
            "slowest_ms": max(velocities) if velocities else 0
        },
        "by_platform": platform_stats,
        "by_creator": creator_stats,
        "top_performing_links": sorted(
            [{"code": l["code"], "platform": l.get("platform"), "creator": l.get("creator"), 
              "clicks": l.get("clicks", 0), "joins": l.get("joins", 0)} 
             for l in invite_links],
            key=lambda x: x["clicks"],
            reverse=True
        )[:10],
        "conversion_rate": f"{(sum(1 for e in events if e.get('converted')) / max(1, len(events)) * 100):.1f}%"
    }


@router.get("/links")
async def get_all_links(
    platform: str = Query(None),
    creator: str = Query(None),
    limit: int = Query(50, ge=1, le=200)
):
    """Get all generated invite links with their stats"""
    db = get_db()
    
    query = {}
    if platform:
        query["platform"] = platform
    if creator:
        query["creator"] = creator
    
    links = await db.social_invite_links.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "links": links,
        "count": len(links)
    }


@router.delete("/links/{invite_code}")
async def delete_link(invite_code: str):
    """Delete an invite link"""
    db = get_db()
    
    result = await db.social_invite_links.delete_one({"code": invite_code})
    
    return {
        "deleted": result.deleted_count > 0,
        "code": invite_code
    }



class ShareEmailRequest(BaseModel):
    """Send game invite via email"""
    to_email: str
    from_name: str = "A Friend"
    game_url: str = "https://www.ztvlivestream.com/play"


@router.post("/share-email")
async def share_via_email(req: ShareEmailRequest):
    """Send a game invite email to a friend"""
    from services.email_service import send_email
    
    try:
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #18181b; color: white; padding: 30px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="display: inline-block; width: 60px; height: 60px; background: linear-gradient(135deg, #dc2626, #b91c1c); border-radius: 16px; line-height: 60px; font-size: 28px; font-weight: bold; color: white;">Z</div>
            </div>
            
            <h1 style="text-align: center; color: white; font-size: 24px; margin-bottom: 10px;">You're Invited to Play!</h1>
            
            <p style="text-align: center; color: #a1a1aa; font-size: 16px; margin-bottom: 30px;">
                <strong>{req.from_name}</strong> invited you to play ZTVLIVE Unusual Fun Game Show - a live trivia game where you can win real prizes!
            </p>
            
            <div style="text-align: center; margin-bottom: 30px;">
                <a href="{req.game_url}" style="display: inline-block; background: linear-gradient(135deg, #9333ea, #ec4899); color: white; text-decoration: none; padding: 16px 40px; border-radius: 30px; font-weight: bold; font-size: 18px;">
                    🎮 Play Now & Win!
                </a>
            </div>
            
            <div style="background: #27272a; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h3 style="color: #fbbf24; margin-top: 0;">How to Play:</h3>
                <ol style="color: #a1a1aa; padding-left: 20px;">
                    <li>Click the button above to join the live game</li>
                    <li>Answer fun trivia questions by typing your answer</li>
                    <li>Match what other players say to win points</li>
                    <li>Top scorers win mystery prizes every 10 minutes!</li>
                </ol>
            </div>
            
            <p style="text-align: center; color: #71717a; font-size: 12px;">
                ZTVLIVE - 24/7 Live Interactive Game Show<br/>
                Watch on Roku, Fire TV, or play directly on the web!
            </p>
        </div>
        """
        
        await send_email(
            to_email=req.to_email,
            subject=f"🎮 {req.from_name} invited you to play ZTVLIVE!",
            html_content=html_content
        )
        
        # Track the share
        db = get_db()
        await db.email_shares.insert_one({
            "to_email": req.to_email,
            "from_name": req.from_name,
            "game_url": req.game_url,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })
        
        return {"success": True, "message": "Invite email sent!"}
        
    except Exception as e:
        logger.error(f"Failed to send share email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")