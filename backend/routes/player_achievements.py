"""
ZTVLIVE Player Achievements & Badges System

Badges:
- Top 10% Player (score in top 10% of all players)
- 5-Game Streak (played 5 games in a row)
- First Answer (answered first in a round)
- Perfect Round (all correct answers in a game)
- Speed Demon (answered in under 2 seconds)
- Social Butterfly (invited 5+ friends)
- Loyal Viewer (watched 10+ hours)
- Night Owl (played between 12am-5am)
- Early Bird (played between 5am-8am)
- Weekend Warrior (played 10+ games on weekend)
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/achievements", tags=["Player Achievements"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "ztvlive")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Badge definitions
BADGES = {
    "top_10_percent": {
        "id": "top_10_percent",
        "name": "Top 10% Player",
        "description": "Your score is in the top 10% of all players",
        "icon": "trophy",
        "color": "gold",
        "rarity": "legendary"
    },
    "five_game_streak": {
        "id": "five_game_streak",
        "name": "5-Game Streak",
        "description": "Played 5 games in a row without missing a day",
        "icon": "flame",
        "color": "orange",
        "rarity": "rare"
    },
    "first_answer": {
        "id": "first_answer",
        "name": "Lightning Fast",
        "description": "First to answer in a round",
        "icon": "zap",
        "color": "yellow",
        "rarity": "common"
    },
    "perfect_round": {
        "id": "perfect_round",
        "name": "Perfect Round",
        "description": "All correct answers in a single game",
        "icon": "star",
        "color": "purple",
        "rarity": "epic"
    },
    "speed_demon": {
        "id": "speed_demon",
        "name": "Speed Demon",
        "description": "Answered correctly in under 2 seconds",
        "icon": "rocket",
        "color": "red",
        "rarity": "rare"
    },
    "social_butterfly": {
        "id": "social_butterfly",
        "name": "Social Butterfly",
        "description": "Invited 5+ friends to play",
        "icon": "users",
        "color": "pink",
        "rarity": "uncommon"
    },
    "loyal_viewer": {
        "id": "loyal_viewer",
        "name": "Loyal Viewer",
        "description": "Watched 10+ hours of ZTVLIVE",
        "icon": "tv",
        "color": "green",
        "rarity": "uncommon"
    },
    "night_owl": {
        "id": "night_owl",
        "name": "Night Owl",
        "description": "Played between midnight and 5am",
        "icon": "moon",
        "color": "indigo",
        "rarity": "uncommon"
    },
    "early_bird": {
        "id": "early_bird",
        "name": "Early Bird",
        "description": "Played between 5am and 8am",
        "icon": "sunrise",
        "color": "amber",
        "rarity": "uncommon"
    },
    "weekend_warrior": {
        "id": "weekend_warrior",
        "name": "Weekend Warrior",
        "description": "Played 10+ games on weekends",
        "icon": "calendar",
        "color": "blue",
        "rarity": "rare"
    },
    "century_club": {
        "id": "century_club",
        "name": "Century Club",
        "description": "Scored 100+ points in a single game",
        "icon": "award",
        "color": "emerald",
        "rarity": "rare"
    },
    "comeback_king": {
        "id": "comeback_king",
        "name": "Comeback King",
        "description": "Won a game after being in last place",
        "icon": "trending-up",
        "color": "cyan",
        "rarity": "epic"
    },
    "group_leader": {
        "id": "group_leader",
        "name": "Group Leader",
        "description": "Won 3+ private group games",
        "icon": "crown",
        "color": "gold",
        "rarity": "rare"
    },
    "trivia_master": {
        "id": "trivia_master",
        "name": "Trivia Master",
        "description": "Answered 100+ questions correctly",
        "icon": "brain",
        "color": "violet",
        "rarity": "epic"
    },
    "new_player": {
        "id": "new_player",
        "name": "Welcome!",
        "description": "Joined ZTVLIVE",
        "icon": "sparkles",
        "color": "green",
        "rarity": "common"
    }
}

# Rarity colors for display
RARITY_COLORS = {
    "common": "#9ca3af",      # gray
    "uncommon": "#22c55e",    # green
    "rare": "#3b82f6",        # blue
    "epic": "#a855f7",        # purple
    "legendary": "#f59e0b"    # amber/gold
}


class AchievementEvent(BaseModel):
    player_id: str
    event_type: str  # "game_played", "answer_submitted", "first_answer", "game_won", etc.
    metadata: Optional[dict] = None


@router.get("/badges")
async def get_all_badges():
    """Get all available badges with their descriptions"""
    return {
        "badges": list(BADGES.values()),
        "rarity_colors": RARITY_COLORS
    }


@router.get("/player/{player_id}")
async def get_player_achievements(player_id: str):
    """Get all achievements for a specific player"""
    player = await db.players.find_one(
        {"player_id": player_id},
        {"_id": 0, "badges": 1, "stats": 1, "badge_progress": 1}
    )
    
    if not player:
        return {
            "player_id": player_id,
            "badges": [],
            "stats": {},
            "badge_progress": {}
        }
    
    # Enrich badges with full badge info
    earned_badges = []
    for badge_id in player.get("badges", []):
        if badge_id in BADGES:
            badge = BADGES[badge_id].copy()
            badge["earned"] = True
            earned_badges.append(badge)
    
    return {
        "player_id": player_id,
        "badges": earned_badges,
        "badge_count": len(earned_badges),
        "stats": player.get("stats", {}),
        "badge_progress": player.get("badge_progress", {})
    }


@router.post("/check")
async def check_and_award_badges(event: AchievementEvent):
    """
    Check if player earned any new badges based on an event.
    Called after game actions (answer, game end, etc.)
    """
    player = await db.players.find_one({"player_id": event.player_id})
    
    if not player:
        # Create player if doesn't exist
        player = {
            "player_id": event.player_id,
            "badges": ["new_player"],
            "stats": {
                "games_played": 0,
                "total_score": 0,
                "correct_answers": 0,
                "first_answers": 0,
                "fastest_answer_ms": None,
                "watch_time_minutes": 0,
                "friends_invited": 0,
                "group_wins": 0,
                "perfect_games": 0,
                "current_streak": 0,
                "last_played_date": None,
                "weekend_games": 0
            },
            "badge_progress": {},
            "created_at": datetime.now(timezone.utc)
        }
        await db.players.insert_one(player)
        return {
            "new_badges": [BADGES["new_player"]],
            "message": "Welcome to ZTVLIVE!"
        }
    
    current_badges = set(player.get("badges", []))
    stats = player.get("stats", {})
    new_badges = []
    
    # Update stats based on event
    now = datetime.now(timezone.utc)
    metadata = event.metadata or {}
    
    if event.event_type == "game_played":
        stats["games_played"] = stats.get("games_played", 0) + 1
        
        # Check streak
        last_played = stats.get("last_played_date")
        if last_played:
            last_date = datetime.fromisoformat(last_played.replace("Z", "+00:00")) if isinstance(last_played, str) else last_played
            if (now - last_date).days == 1:
                stats["current_streak"] = stats.get("current_streak", 0) + 1
            elif (now - last_date).days > 1:
                stats["current_streak"] = 1
        else:
            stats["current_streak"] = 1
        
        stats["last_played_date"] = now.isoformat()
        
        # Weekend check
        if now.weekday() >= 5:  # Saturday = 5, Sunday = 6
            stats["weekend_games"] = stats.get("weekend_games", 0) + 1
        
        # Check 5-game streak badge
        if stats["current_streak"] >= 5 and "five_game_streak" not in current_badges:
            new_badges.append("five_game_streak")
        
        # Check weekend warrior badge
        if stats.get("weekend_games", 0) >= 10 and "weekend_warrior" not in current_badges:
            new_badges.append("weekend_warrior")
    
    elif event.event_type == "answer_submitted":
        is_correct = metadata.get("is_correct", False)
        answer_time_ms = metadata.get("answer_time_ms", 10000)
        
        if is_correct:
            stats["correct_answers"] = stats.get("correct_answers", 0) + 1
            
            # Check trivia master (100+ correct)
            if stats["correct_answers"] >= 100 and "trivia_master" not in current_badges:
                new_badges.append("trivia_master")
        
        # Check speed demon (under 2 seconds)
        if answer_time_ms < 2000 and is_correct:
            if stats.get("fastest_answer_ms") is None or answer_time_ms < stats["fastest_answer_ms"]:
                stats["fastest_answer_ms"] = answer_time_ms
            if "speed_demon" not in current_badges:
                new_badges.append("speed_demon")
    
    elif event.event_type == "first_answer":
        stats["first_answers"] = stats.get("first_answers", 0) + 1
        if "first_answer" not in current_badges:
            new_badges.append("first_answer")
    
    elif event.event_type == "game_won":
        game_score = metadata.get("score", 0)
        stats["total_score"] = stats.get("total_score", 0) + game_score
        
        # Check century club (100+ points in one game)
        if game_score >= 100 and "century_club" not in current_badges:
            new_badges.append("century_club")
        
        # Group win
        if metadata.get("is_group_game"):
            stats["group_wins"] = stats.get("group_wins", 0) + 1
            if stats["group_wins"] >= 3 and "group_leader" not in current_badges:
                new_badges.append("group_leader")
    
    elif event.event_type == "perfect_game":
        stats["perfect_games"] = stats.get("perfect_games", 0) + 1
        if "perfect_round" not in current_badges:
            new_badges.append("perfect_round")
    
    elif event.event_type == "friend_invited":
        stats["friends_invited"] = stats.get("friends_invited", 0) + 1
        if stats["friends_invited"] >= 5 and "social_butterfly" not in current_badges:
            new_badges.append("social_butterfly")
    
    elif event.event_type == "watch_time":
        minutes = metadata.get("minutes", 0)
        stats["watch_time_minutes"] = stats.get("watch_time_minutes", 0) + minutes
        # 10 hours = 600 minutes
        if stats["watch_time_minutes"] >= 600 and "loyal_viewer" not in current_badges:
            new_badges.append("loyal_viewer")
    
    # Time-based badges
    hour = now.hour
    if 0 <= hour < 5 and "night_owl" not in current_badges:
        new_badges.append("night_owl")
    elif 5 <= hour < 8 and "early_bird" not in current_badges:
        new_badges.append("early_bird")
    
    # Update player with new badges and stats
    if new_badges:
        current_badges.update(new_badges)
    
    await db.players.update_one(
        {"player_id": event.player_id},
        {
            "$set": {
                "badges": list(current_badges),
                "stats": stats
            }
        }
    )
    
    # Return new badges with full info
    new_badge_info = [BADGES[b] for b in new_badges if b in BADGES]
    
    return {
        "new_badges": new_badge_info,
        "total_badges": len(current_badges),
        "message": f"You earned {len(new_badges)} new badge(s)!" if new_badges else None
    }


@router.get("/leaderboard")
async def get_badge_leaderboard(limit: int = 20):
    """Get leaderboard of players with most badges"""
    pipeline = [
        {"$match": {"badges": {"$exists": True, "$ne": []}}},
        {"$project": {
            "_id": 0,
            "player_id": 1,
            "name": 1,
            "badge_count": {"$size": "$badges"},
            "badges": 1,
            "stats": 1
        }},
        {"$sort": {"badge_count": -1, "stats.total_score": -1}},
        {"$limit": limit}
    ]
    
    leaders = await db.players.aggregate(pipeline).to_list(limit)
    
    # Calculate percentile for top 10%
    total_players = await db.players.count_documents({"badges": {"$exists": True}})
    top_10_threshold = max(1, int(total_players * 0.1))
    
    return {
        "leaderboard": leaders,
        "total_players": total_players,
        "top_10_threshold": top_10_threshold
    }


@router.post("/check-top-10")
async def check_top_10_percent(player_id: str):
    """Check if player qualifies for Top 10% badge"""
    player = await db.players.find_one({"player_id": player_id})
    if not player:
        return {"eligible": False}
    
    player_score = player.get("stats", {}).get("total_score", 0)
    
    # Count players with higher scores
    higher_count = await db.players.count_documents({
        "stats.total_score": {"$gt": player_score}
    })
    
    total_players = await db.players.count_documents({"stats.total_score": {"$exists": True}})
    
    if total_players == 0:
        return {"eligible": False, "percentile": 0}
    
    percentile = ((total_players - higher_count) / total_players) * 100
    eligible = percentile >= 90  # Top 10%
    
    if eligible and "top_10_percent" not in player.get("badges", []):
        # Award the badge
        await db.players.update_one(
            {"player_id": player_id},
            {"$addToSet": {"badges": "top_10_percent"}}
        )
        return {
            "eligible": True,
            "percentile": round(percentile, 1),
            "new_badge": BADGES["top_10_percent"],
            "message": "Congratulations! You're in the Top 10%!"
        }
    
    return {
        "eligible": eligible,
        "percentile": round(percentile, 1),
        "already_earned": "top_10_percent" in player.get("badges", [])
    }
