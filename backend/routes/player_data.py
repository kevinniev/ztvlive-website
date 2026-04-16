"""
ZTVLIVE Player Data Collection & Analytics

Features:
- Player profile tracking via cookies/sessions
- Game history and leaderboard archive
- Email collection for marketing
- Play statistics and engagement metrics
"""

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
import uuid
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/players", tags=["Player Data"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "ztvlive")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ============== MODELS ==============

class PlayerProfile(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    subscribe_updates: bool = False
    follow_social: Optional[List[str]] = None  # ["twitter", "instagram", etc.]

class PlayerActivity(BaseModel):
    player_id: str
    action: str  # "game_start", "game_end", "answer", "group_join", "group_create"
    metadata: Optional[dict] = None

class GameSession(BaseModel):
    group_id: str
    game_type: str  # "custom" or "live"
    questions_played: int
    duration_seconds: int
    final_leaderboard: List[dict]

class EmailSubscription(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    source: str = "game"  # "game", "group", "website"

# ============== PLAYER TRACKING ==============

@router.post("/track")
async def track_player(request: Request, response: Response, profile: Optional[PlayerProfile] = None):
    """
    Track a player visit and create/update their profile.
    Uses cookies to identify returning players.
    """
    # Get or create player ID from cookie
    player_id = request.cookies.get("ztvlive_player_id")
    is_new_player = False
    
    if not player_id:
        player_id = str(uuid.uuid4())
        is_new_player = True
    
    # Get player data from DB or create new
    player_data = await db.players.find_one({"player_id": player_id})
    
    now = datetime.now(timezone.utc)
    
    if player_data:
        # Update existing player
        update_data = {
            "last_seen": now,
            "visit_count": player_data.get("visit_count", 0) + 1
        }
        
        if profile:
            if profile.name:
                update_data["name"] = profile.name
            if profile.email:
                update_data["email"] = profile.email
            if profile.subscribe_updates:
                update_data["subscribed"] = True
            if profile.follow_social:
                update_data["followed_social"] = profile.follow_social
        
        await db.players.update_one(
            {"player_id": player_id},
            {"$set": update_data}
        )
    else:
        # Create new player
        new_player = {
            "player_id": player_id,
            "name": profile.name if profile else None,
            "email": profile.email if profile else None,
            "subscribed": profile.subscribe_updates if profile else False,
            "created_at": now,
            "last_seen": now,
            "visit_count": 1,
            "games_played": 0,
            "total_score": 0,
            "groups_joined": [],
            "followed_social": profile.follow_social if profile else []
        }
        await db.players.insert_one(new_player)
    
    # Set cookie (expires in 1 year)
    response.set_cookie(
        key="ztvlive_player_id",
        value=player_id,
        max_age=365 * 24 * 60 * 60,  # 1 year
        httponly=True,
        samesite="lax"
    )
    
    return {
        "player_id": player_id,
        "is_new_player": is_new_player,
        "message": "Welcome back!" if not is_new_player else "Welcome to ZTVLIVE!"
    }


@router.get("/me")
async def get_my_profile(request: Request):
    """Get current player's profile based on cookie"""
    player_id = request.cookies.get("ztvlive_player_id")
    
    if not player_id:
        return {"player_id": None, "message": "No player profile found"}
    
    player = await db.players.find_one(
        {"player_id": player_id},
        {"_id": 0}
    )
    
    if not player:
        return {"player_id": player_id, "message": "Profile not found"}
    
    # Get game history
    games = await db.game_history.find(
        {"players.player_id": player_id}
    ).sort("ended_at", -1).limit(10).to_list(10)
    
    # Calculate stats
    total_games = await db.game_history.count_documents({"players.player_id": player_id})
    
    return {
        "player_id": player_id,
        "name": player.get("name"),
        "email": player.get("email"),
        "subscribed": player.get("subscribed", False),
        "stats": {
            "games_played": total_games,
            "total_score": player.get("total_score", 0),
            "visit_count": player.get("visit_count", 0),
            "member_since": player.get("created_at")
        },
        "recent_games": [
            {
                "group_name": g.get("group_name"),
                "played_at": g.get("ended_at"),
                "score": next((p.get("score", 0) for p in g.get("players", []) if p.get("player_id") == player_id), 0),
                "rank": next((p.get("rank", 0) for p in g.get("players", []) if p.get("player_id") == player_id), 0)
            }
            for g in games
        ]
    }


@router.post("/activity")
async def log_activity(activity: PlayerActivity):
    """Log player activity for analytics"""
    await db.player_activity.insert_one({
        "player_id": activity.player_id,
        "action": activity.action,
        "metadata": activity.metadata,
        "timestamp": datetime.now(timezone.utc)
    })
    
    # Update player stats based on action
    if activity.action == "game_end":
        score = activity.metadata.get("score", 0) if activity.metadata else 0
        await db.players.update_one(
            {"player_id": activity.player_id},
            {
                "$inc": {"games_played": 1, "total_score": score}
            }
        )
    
    return {"success": True}


# ============== EMAIL SUBSCRIPTION ==============

@router.post("/subscribe")
async def subscribe_email(subscription: EmailSubscription):
    """Subscribe email for updates"""
    existing = await db.email_subscribers.find_one({"email": subscription.email})
    
    if existing:
        return {"success": True, "message": "Already subscribed!", "already_subscribed": True}
    
    await db.email_subscribers.insert_one({
        "email": subscription.email,
        "name": subscription.name,
        "source": subscription.source,
        "subscribed_at": datetime.now(timezone.utc),
        "active": True
    })
    
    return {"success": True, "message": "Thanks for subscribing!"}


@router.get("/subscribers/count")
async def get_subscriber_count():
    """Get total subscriber count (for display)"""
    count = await db.email_subscribers.count_documents({"active": True})
    return {"count": count}


# ============== GAME HISTORY ==============

@router.post("/games/archive")
async def archive_game(session: GameSession):
    """Archive a completed game session"""
    game_record = {
        "group_id": session.group_id,
        "game_type": session.game_type,
        "questions_played": session.questions_played,
        "duration_seconds": session.duration_seconds,
        "players": session.final_leaderboard,
        "ended_at": datetime.now(timezone.utc)
    }
    
    # Get group name
    group = await db.game_groups.find_one({"group_id": session.group_id})
    if group:
        game_record["group_name"] = group.get("name")
    
    result = await db.game_history.insert_one(game_record)
    
    # Update group statistics
    await db.game_groups.update_one(
        {"group_id": session.group_id},
        {
            "$inc": {"total_games_played": 1},
            "$push": {
                "game_history": {
                    "$each": [{"game_id": str(result.inserted_id), "ended_at": game_record["ended_at"]}],
                    "$slice": -50  # Keep last 50 games
                }
            }
        }
    )
    
    return {"success": True, "game_id": str(result.inserted_id)}


@router.get("/games/history/{group_id}")
async def get_group_game_history(group_id: str, limit: int = 20):
    """Get game history for a group"""
    games = await db.game_history.find(
        {"group_id": group_id}
    ).sort("ended_at", -1).limit(limit).to_list(limit)
    
    return {
        "group_id": group_id,
        "total_games": len(games),
        "games": [
            {
                "game_id": str(g.get("_id")),
                "game_type": g.get("game_type"),
                "questions_played": g.get("questions_played"),
                "duration_seconds": g.get("duration_seconds"),
                "ended_at": g.get("ended_at"),
                "winner": g.get("players", [{}])[0] if g.get("players") else None,
                "player_count": len(g.get("players", []))
            }
            for g in games
        ]
    }


@router.get("/games/{game_id}/leaderboard")
async def get_game_leaderboard(game_id: str):
    """Get archived leaderboard for a specific game"""
    from bson import ObjectId
    
    try:
        game = await db.game_history.find_one({"_id": ObjectId(game_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid game ID")
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return {
        "game_id": game_id,
        "group_name": game.get("group_name"),
        "ended_at": game.get("ended_at"),
        "questions_played": game.get("questions_played"),
        "leaderboard": game.get("players", [])
    }


# ============== SOCIAL FOLLOW TRACKING ==============

@router.post("/follow-social")
async def track_social_follow(request: Request, platform: str):
    """Track when a player clicks to follow on social media"""
    player_id = request.cookies.get("ztvlive_player_id")
    
    # Log the follow action
    await db.social_follows.insert_one({
        "player_id": player_id,
        "platform": platform,
        "timestamp": datetime.now(timezone.utc)
    })
    
    # Update player profile
    if player_id:
        await db.players.update_one(
            {"player_id": player_id},
            {"$addToSet": {"followed_social": platform}}
        )
    
    # Get follow count for this platform
    count = await db.social_follows.count_documents({"platform": platform})
    
    return {"success": True, "platform": platform, "total_follows": count}


@router.get("/social-stats")
async def get_social_stats():
    """Get social media follow statistics"""
    platforms = ["twitter", "instagram", "tiktok", "youtube", "facebook"]
    stats = {}
    
    for platform in platforms:
        count = await db.social_follows.count_documents({"platform": platform})
        stats[platform] = count
    
    return {"stats": stats}


# ============== ANALYTICS DASHBOARD DATA ==============

@router.get("/analytics/overview")
async def get_analytics_overview():
    """Get overview analytics for admin dashboard"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    
    # Total players
    total_players = await db.players.count_documents({})
    
    # New players today
    new_today = await db.players.count_documents({"created_at": {"$gte": today_start}})
    
    # Active players this week
    active_week = await db.players.count_documents({"last_seen": {"$gte": week_ago}})
    
    # Total games played
    total_games = await db.game_history.count_documents({})
    
    # Email subscribers
    subscribers = await db.email_subscribers.count_documents({"active": True})
    
    # Groups created
    total_groups = await db.game_groups.count_documents({})
    
    return {
        "total_players": total_players,
        "new_players_today": new_today,
        "active_players_week": active_week,
        "total_games_played": total_games,
        "email_subscribers": subscribers,
        "total_groups": total_groups,
        "timestamp": now
    }
