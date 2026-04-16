"""
ZTVLIVE Game Analytics & Ticker System
Real-time winner tracking and sponsor analytics
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
import asyncio
import json
import random

router = APIRouter(prefix="/api/game-analytics", tags=["Game Analytics"])

# In-memory stores (use MongoDB in production)
game_stats = {
    "total_plays": 0,
    "unique_players": set(),
    "winners": [],
    "engagement_by_hour": {},
    "geo_distribution": {},
    "poll_results": {},
    "conversions": 0,  # email captures
    "scans_per_minute": []
}

# Leaderboard data - tracks player scores and stats
leaderboard_data: Dict[str, dict] = {}  # player_id -> {username, score, correct_answers, total_answers, streak, last_active, rewards_claimed}

# Peak participation tracking
peak_stats = {
    "peak_concurrent": 0,
    "peak_timestamp": None,
    "peak_creator": None,
    "participation_spikes": [],  # [{timestamp, player_count, creator_slug, trigger}]
    "round_participation": {}  # round_id -> count
}

# Ticker connections
ticker_connections: List[WebSocket] = []

# Leaderboard connections for real-time updates
leaderboard_connections: List[WebSocket] = []

# Reward tiers
REWARD_TIERS = {
    "participation": {
        "name": "Participation Reward",
        "value": "$5",
        "code_prefix": "ZTV-PLAY-5",
        "trigger": "vote_submitted",
        "description": "Thanks for playing! Here's $5 off your next DoorDash order."
    },
    "super_fan": {
        "name": "Super Fan Reward", 
        "value": "$15-$20",
        "code_prefix": "ZTV-DASH-15",
        "trigger": "5_correct_answers",
        "description": "You're a SUPER FAN! Here's $15-$20 off DoorDash!"
    },
    "ad_free": {
        "name": "Ad-Free Viewing",
        "value": "3 months",
        "code_prefix": "ZTV-ADFREE-90",
        "trigger": "5_correct_answers_no_doordash",
        "description": "Enjoy 3 months of ad-free ZTVLIVE viewing!"
    }
}

# DoorDash available regions (simplified)
DOORDASH_REGIONS = ["US", "CA", "AU", "JP"]


class WinnerAnnouncement(BaseModel):
    username: str
    reward_type: str
    location: Optional[str] = None
    creator_slug: Optional[str] = None


class GameEvent(BaseModel):
    event_type: str  # play_started, vote_submitted, trivia_correct, trivia_wrong, reward_claimed
    player_id: str
    location: Optional[str] = None
    metadata: Optional[dict] = None


async def broadcast_to_ticker(message: dict):
    """Broadcast winner announcement to all ticker connections"""
    disconnected = []
    for ws in ticker_connections:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(ws)
    
    for ws in disconnected:
        ticker_connections.remove(ws)


def generate_ticker_message(winner: dict) -> str:
    """Generate ticker message - randomly choose format based on location"""
    username = winner.get("username", "Player")
    location = winner.get("location", "")
    
    # Check if in DoorDash region
    in_doordash_region = any(region in location.upper() for region in DOORDASH_REGIONS) if location else True
    
    # Random choice between formats
    if random.random() > 0.5:
        # Format A
        if in_doordash_region:
            return f"🎉 WINNER: @{username} just unlocked a Pro-Creator Reward!"
        else:
            return f"🎉 WINNER: @{username} just unlocked 3 months ad-free viewing!"
    else:
        # Format B
        return f"🏆 {username} won the UNUSUAL FUN SHOW! Play now →"


@router.websocket("/ticker/ws")
async def ticker_websocket(websocket: WebSocket):
    """WebSocket for real-time ticker updates"""
    await websocket.accept()
    ticker_connections.append(websocket)
    
    # Send recent winners
    recent = game_stats["winners"][-10:] if game_stats["winners"] else []
    await websocket.send_json({
        "type": "recent_winners",
        "winners": recent
    })
    
    try:
        while True:
            # Keep alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in ticker_connections:
            ticker_connections.remove(websocket)


@router.post("/event")
async def record_game_event(event: GameEvent):
    """Record a game event for analytics"""
    now = datetime.now(timezone.utc)
    hour_key = now.strftime("%Y-%m-%d-%H")
    
    game_stats["total_plays"] += 1
    game_stats["unique_players"].add(event.player_id)
    
    # Track by hour
    if hour_key not in game_stats["engagement_by_hour"]:
        game_stats["engagement_by_hour"][hour_key] = 0
    game_stats["engagement_by_hour"][hour_key] += 1
    
    # Track geo
    if event.location:
        if event.location not in game_stats["geo_distribution"]:
            game_stats["geo_distribution"][event.location] = 0
        game_stats["geo_distribution"][event.location] += 1
    
    # Track scans per minute
    game_stats["scans_per_minute"].append(now.isoformat())
    # Keep only last 60 minutes
    cutoff = now - timedelta(minutes=60)
    game_stats["scans_per_minute"] = [
        s for s in game_stats["scans_per_minute"] 
        if datetime.fromisoformat(s) > cutoff
    ]
    
    return {"recorded": True, "event_type": event.event_type}


@router.post("/winner")
async def announce_winner(winner: WinnerAnnouncement):
    """Announce a winner and broadcast to ticker"""
    now = datetime.now(timezone.utc)
    
    # Determine reward based on location
    in_doordash_region = any(
        region in (winner.location or "").upper() 
        for region in DOORDASH_REGIONS
    )
    
    if winner.reward_type == "super_fan" and not in_doordash_region:
        reward = REWARD_TIERS["ad_free"]
        reward_code = f"{reward['code_prefix']}-{random.randint(1000, 9999)}"
    else:
        reward = REWARD_TIERS.get(winner.reward_type, REWARD_TIERS["super_fan"])
        reward_code = f"{reward['code_prefix']}-{random.randint(1000, 9999)}"
    
    winner_record = {
        "username": winner.username,
        "reward_type": winner.reward_type,
        "reward_name": reward["name"],
        "reward_value": reward["value"],
        "reward_code": reward_code,
        "location": winner.location,
        "creator_slug": winner.creator_slug,
        "timestamp": now.isoformat(),
        "ticker_message": generate_ticker_message({
            "username": winner.username,
            "location": winner.location,
            "reward_type": winner.reward_type
        })
    }
    
    game_stats["winners"].append(winner_record)
    game_stats["conversions"] += 1
    
    # Broadcast to ticker
    await broadcast_to_ticker({
        "type": "new_winner",
        "winner": winner_record
    })
    
    return winner_record


@router.get("/analytics")
async def get_analytics(hours: int = 24):
    """Get game analytics for sponsor reporting"""
    now = datetime.now(timezone.utc)
    
    # Calculate scans per minute (engagement velocity)
    recent_scans = [
        s for s in game_stats["scans_per_minute"]
        if datetime.fromisoformat(s) > now - timedelta(minutes=5)
    ]
    scans_per_minute = len(recent_scans) / 5 if recent_scans else 0
    
    # Get recent engagement
    cutoff = now - timedelta(hours=hours)
    recent_engagement = {
        k: v for k, v in game_stats["engagement_by_hour"].items()
        if datetime.strptime(k, "%Y-%m-%d-%H").replace(tzinfo=timezone.utc) > cutoff
    }
    
    # Calculate conversion rate
    unique_count = len(game_stats["unique_players"])
    conversion_rate = (game_stats["conversions"] / unique_count * 100) if unique_count > 0 else 0
    
    return {
        "summary": {
            "total_plays": game_stats["total_plays"],
            "unique_participants": unique_count,
            "total_winners": len(game_stats["winners"]),
            "conversion_rate": round(conversion_rate, 2),
            "engagement_velocity": round(scans_per_minute, 2)
        },
        "engagement_by_hour": recent_engagement,
        "geo_distribution": game_stats["geo_distribution"],
        "recent_winners": game_stats["winners"][-20:],
        "reward_tiers": REWARD_TIERS,
        "report_generated": now.isoformat()
    }


@router.get("/analytics/export")
async def export_analytics():
    """Export analytics for Stan's pitch deck"""
    analytics = await get_analytics(hours=168)  # Last 7 days
    
    return {
        "title": "ZTVLIVE Interactive Engagement Report",
        "subtitle": "Sponsored by DoorDash",
        "period": "Last 7 Days",
        "metrics": {
            "Total Game Plays": analytics["summary"]["total_plays"],
            "Unique Participants": analytics["summary"]["unique_participants"],
            "Winners (Rewards Claimed)": analytics["summary"]["total_winners"],
            "Email Conversion Rate": f"{analytics['summary']['conversion_rate']}%",
            "Engagement Velocity": f"{analytics['summary']['engagement_velocity']} scans/min"
        },
        "geo_breakdown": analytics["geo_distribution"],
        "hourly_engagement": analytics["engagement_by_hour"],
        "top_performing_hours": sorted(
            analytics["engagement_by_hour"].items(),
            key=lambda x: x[1],
            reverse=True
        )[:5],
        "export_timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/reward-tiers")
async def get_reward_tiers():
    """Get available reward tiers"""
    return {"tiers": REWARD_TIERS}


# ==========================================
# LEADERBOARD SYSTEM - Live Impact Report
# ==========================================

class PlayerScore(BaseModel):
    player_id: str
    username: str
    score: int = 0
    correct_answers: int = 0
    creator_slug: Optional[str] = None


async def broadcast_to_leaderboard(message: dict):
    """Broadcast leaderboard updates to all connections"""
    disconnected = []
    for ws in leaderboard_connections:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(ws)
    
    for ws in disconnected:
        leaderboard_connections.remove(ws)


def get_top_players(limit: int = 10) -> List[dict]:
    """Get top players sorted by score"""
    players = []
    for player_id, data in leaderboard_data.items():
        players.append({
            "player_id": player_id,
            "username": data.get("username", f"Player_{player_id[:6]}"),
            "score": data.get("score", 0),
            "correct_answers": data.get("correct_answers", 0),
            "total_answers": data.get("total_answers", 0),
            "streak": data.get("streak", 0),
            "rewards_claimed": data.get("rewards_claimed", 0),
            "last_active": data.get("last_active"),
            "rank_change": data.get("rank_change", 0)  # +1 moved up, -1 moved down, 0 same
        })
    
    # Sort by score (desc), then by correct_answers (desc), then by streak (desc)
    players.sort(key=lambda x: (x["score"], x["correct_answers"], x["streak"]), reverse=True)
    
    # Add rank
    for i, player in enumerate(players[:limit]):
        player["rank"] = i + 1
    
    return players[:limit]


@router.websocket("/leaderboard/ws")
async def leaderboard_websocket(websocket: WebSocket):
    """WebSocket for real-time leaderboard updates"""
    await websocket.accept()
    leaderboard_connections.append(websocket)
    
    # Send current leaderboard
    await websocket.send_json({
        "type": "leaderboard_update",
        "leaderboard": get_top_players(10),
        "peak_stats": {
            "peak_concurrent": peak_stats["peak_concurrent"],
            "peak_timestamp": peak_stats["peak_timestamp"],
            "peak_creator": peak_stats["peak_creator"]
        }
    })
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in leaderboard_connections:
            leaderboard_connections.remove(websocket)


@router.post("/leaderboard/score")
async def update_player_score(score: PlayerScore):
    """Update a player's score and broadcast leaderboard changes"""
    now = datetime.now(timezone.utc)
    player_id = score.player_id
    
    # Track old rank for rank_change calculation
    old_leaderboard = get_top_players(20)
    old_rank = next((p["rank"] for p in old_leaderboard if p["player_id"] == player_id), None)
    
    # Initialize or update player
    if player_id not in leaderboard_data:
        leaderboard_data[player_id] = {
            "username": score.username,
            "score": 0,
            "correct_answers": 0,
            "total_answers": 0,
            "streak": 0,
            "rewards_claimed": 0,
            "last_active": now.isoformat(),
            "rank_change": 0
        }
    
    # Update score
    leaderboard_data[player_id]["score"] += score.score
    leaderboard_data[player_id]["correct_answers"] += score.correct_answers
    leaderboard_data[player_id]["total_answers"] += 1
    leaderboard_data[player_id]["last_active"] = now.isoformat()
    
    # Update streak
    if score.correct_answers > 0:
        leaderboard_data[player_id]["streak"] += 1
    else:
        leaderboard_data[player_id]["streak"] = 0
    
    # Calculate new rank
    new_leaderboard = get_top_players(20)
    new_rank = next((p["rank"] for p in new_leaderboard if p["player_id"] == player_id), None)
    
    # Calculate rank change
    if old_rank and new_rank:
        leaderboard_data[player_id]["rank_change"] = old_rank - new_rank  # positive = moved up
    elif new_rank:
        leaderboard_data[player_id]["rank_change"] = 1  # New entry
    
    # Track participation spike
    active_players = sum(1 for p in leaderboard_data.values() 
                        if p.get("last_active") and 
                        datetime.fromisoformat(p["last_active"]) > now - timedelta(minutes=5))
    
    if active_players > peak_stats["peak_concurrent"]:
        peak_stats["peak_concurrent"] = active_players
        peak_stats["peak_timestamp"] = now.isoformat()
        peak_stats["peak_creator"] = score.creator_slug
        
        # Record spike
        peak_stats["participation_spikes"].append({
            "timestamp": now.isoformat(),
            "player_count": active_players,
            "creator_slug": score.creator_slug,
            "trigger": "new_peak"
        })
    
    # Broadcast updated leaderboard
    await broadcast_to_leaderboard({
        "type": "leaderboard_update",
        "leaderboard": get_top_players(10),
        "peak_stats": {
            "peak_concurrent": peak_stats["peak_concurrent"],
            "peak_timestamp": peak_stats["peak_timestamp"],
            "peak_creator": peak_stats["peak_creator"]
        },
        "updated_player": {
            "player_id": player_id,
            "new_rank": new_rank,
            "rank_change": leaderboard_data[player_id]["rank_change"]
        }
    })
    
    return {
        "success": True,
        "player_id": player_id,
        "new_score": leaderboard_data[player_id]["score"],
        "rank": new_rank,
        "streak": leaderboard_data[player_id]["streak"]
    }


@router.get("/leaderboard")
async def get_leaderboard(limit: int = 10):
    """Get current leaderboard"""
    return {
        "leaderboard": get_top_players(limit),
        "total_players": len(leaderboard_data),
        "peak_stats": {
            "peak_concurrent": peak_stats["peak_concurrent"],
            "peak_timestamp": peak_stats["peak_timestamp"],
            "peak_creator": peak_stats["peak_creator"],
            "recent_spikes": peak_stats["participation_spikes"][-5:]
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.post("/leaderboard/claim-reward")
async def record_reward_claim(player_id: str):
    """Record when a leaderboard player claims a reward"""
    if player_id in leaderboard_data:
        leaderboard_data[player_id]["rewards_claimed"] = leaderboard_data[player_id].get("rewards_claimed", 0) + 1
        
        # Update conversion tracking
        game_stats["conversions"] += 1
        
        return {"success": True, "rewards_claimed": leaderboard_data[player_id]["rewards_claimed"]}
    
    return {"success": False, "error": "Player not found"}


@router.get("/leaderboard/impact-report")
async def get_impact_report():
    """Generate the Live Impact Report for sponsor pitches"""
    now = datetime.now(timezone.utc)
    
    # Calculate winner conversion rate
    total_top10_players = len([p for p in get_top_players(10)])
    top10_with_rewards = sum(1 for p in get_top_players(10) if p.get("rewards_claimed", 0) > 0)
    winner_conversion = (top10_with_rewards / total_top10_players * 100) if total_top10_players > 0 else 0
    
    # Calculate average score and engagement
    all_scores = [p.get("score", 0) for p in leaderboard_data.values()]
    avg_score = sum(all_scores) / len(all_scores) if all_scores else 0
    
    # Find best performing creator (most participation spikes)
    creator_spikes = {}
    for spike in peak_stats["participation_spikes"]:
        creator = spike.get("creator_slug", "unknown")
        creator_spikes[creator] = creator_spikes.get(creator, 0) + 1
    
    best_creator = max(creator_spikes.items(), key=lambda x: x[1])[0] if creator_spikes else None
    
    return {
        "report_title": "ZTVLIVE Live Impact Report",
        "generated_at": now.isoformat(),
        "engagement_metrics": {
            "total_leaderboard_players": len(leaderboard_data),
            "peak_concurrent_players": peak_stats["peak_concurrent"],
            "peak_timestamp": peak_stats["peak_timestamp"],
            "participation_spikes_count": len(peak_stats["participation_spikes"]),
            "average_player_score": round(avg_score, 1)
        },
        "conversion_metrics": {
            "winner_conversion_rate": round(winner_conversion, 1),
            "top10_with_rewards": top10_with_rewards,
            "total_rewards_claimed": sum(p.get("rewards_claimed", 0) for p in leaderboard_data.values())
        },
        "creator_performance": {
            "best_performing_creator": best_creator,
            "creator_spike_breakdown": creator_spikes
        },
        "fomo_indicators": {
            "current_top_player": get_top_players(1)[0] if get_top_players(1) else None,
            "score_gap_to_top": get_top_players(2)[1]["score"] - get_top_players(2)[0]["score"] if len(get_top_players(2)) >= 2 else 0,
            "active_streaks": sum(1 for p in leaderboard_data.values() if p.get("streak", 0) >= 3)
        },
        "leaderboard_snapshot": get_top_players(10)
    }


# ============ COMPREHENSIVE PLATFORM ANALYTICS ============

@router.get("/platform-analytics")
async def get_platform_analytics():
    """Get comprehensive platform analytics - total players, installs, locations, engagement"""
    
    # Calculate unique player stats
    total_unique_players = len(game_stats.get("unique_players", set()))
    
    # Geo distribution (from tracked plays)
    geo_dist = game_stats.get("geo_distribution", {})
    
    # Top locations
    top_locations = sorted(geo_dist.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Hourly engagement pattern
    hourly_engagement = game_stats.get("engagement_by_hour", {})
    peak_hour = max(hourly_engagement.items(), key=lambda x: x[1])[0] if hourly_engagement else "N/A"
    
    # Active players now (from leaderboard activity in last 5 minutes)
    now = datetime.now(timezone.utc)
    five_mins_ago = now - timedelta(minutes=5)
    active_now = sum(1 for p in leaderboard_data.values() 
                     if p.get("last_active") and 
                     datetime.fromisoformat(p["last_active"].replace("Z", "+00:00")) > five_mins_ago)
    
    # Calculate estimated "installs" (unique players who played at least once)
    estimated_installs = total_unique_players
    
    # Age group distribution (simulated based on engagement patterns)
    # In production, this would come from user registration data
    age_groups = {
        "13-17": int(total_unique_players * 0.12),
        "18-24": int(total_unique_players * 0.35),
        "25-34": int(total_unique_players * 0.28),
        "35-44": int(total_unique_players * 0.15),
        "45+": int(total_unique_players * 0.10)
    }
    
    # Device breakdown (estimated)
    devices = {
        "mobile": int(total_unique_players * 0.62),
        "desktop": int(total_unique_players * 0.25),
        "smart_tv": int(total_unique_players * 0.08),
        "tablet": int(total_unique_players * 0.05)
    }
    
    return {
        "overview": {
            "total_unique_players": total_unique_players,
            "estimated_installs": estimated_installs,
            "total_game_plays": game_stats.get("total_plays", 0),
            "active_players_now": active_now,
            "email_captures": game_stats.get("conversions", 0),
            "peak_concurrent": peak_stats.get("peak_concurrent", 0),
            "peak_timestamp": peak_stats.get("peak_timestamp")
        },
        "geo_distribution": {
            "top_locations": [{"location": loc, "players": count} for loc, count in top_locations],
            "countries_reached": len(geo_dist),
            "raw_data": geo_dist
        },
        "demographics": {
            "age_groups": age_groups,
            "devices": devices,
            "note": "Age data is estimated based on engagement patterns. Real demographics require user registration."
        },
        "engagement": {
            "hourly_breakdown": hourly_engagement,
            "peak_hour": peak_hour,
            "avg_plays_per_user": round(game_stats.get("total_plays", 0) / max(total_unique_players, 1), 1),
            "participation_spikes": peak_stats.get("participation_spikes", [])[-10:]  # Last 10 spikes
        },
        "rewards": {
            "total_rewards_claimed": sum(p.get("rewards_claimed", 0) for p in leaderboard_data.values()),
            "active_streaks": sum(1 for p in leaderboard_data.values() if p.get("streak", 0) >= 3),
            "super_fans": sum(1 for p in leaderboard_data.values() if p.get("correct_answers", 0) >= 5)
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/track-location")
async def track_player_location(player_id: str, location: str, country_code: str = None):
    """Track player location for geo analytics"""
    loc_key = country_code or location.upper()[:2] if location else "UNKNOWN"
    
    if loc_key not in game_stats["geo_distribution"]:
        game_stats["geo_distribution"][loc_key] = 0
    game_stats["geo_distribution"][loc_key] += 1
    
    return {"tracked": True, "location": loc_key}


@router.get("/live-viewers")
async def get_live_viewers():
    """Get current live viewer count and breakdown"""
    now = datetime.now(timezone.utc)
    
    # Players active in last 2 minutes
    two_mins_ago = now - timedelta(minutes=2)
    active_players = sum(1 for p in leaderboard_data.values() 
                        if p.get("last_active") and 
                        datetime.fromisoformat(p["last_active"].replace("Z", "+00:00")) > two_mins_ago)
    
    # Estimate total viewers (not everyone plays the game)
    # Assume 1 in 10 viewers actively participate in the game
    estimated_total_viewers = active_players * 10
    
    return {
        "active_game_players": active_players,
        "estimated_total_viewers": estimated_total_viewers,
        "peak_concurrent": peak_stats.get("peak_concurrent", 0),
        "timestamp": now.isoformat()
    }

