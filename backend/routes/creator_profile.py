"""
Creator Profile & Social Features Routes
Handles public creator profiles, following, and social sharing
"""

from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from typing import Optional, List
import logging

router = APIRouter(prefix="/creators", tags=["Creator Profile"])

logger = logging.getLogger(__name__)

# Database will be injected
db = None

def set_db(database):
    global db
    db = database


# ============ PUBLIC PROFILE ============

@router.get("/profile/{username}")
async def get_creator_profile(username: str):
    """Get public creator profile by username or user_id"""
    
    # Try to find by username first, then by user_id
    creator = await db.users.find_one(
        {"$or": [
            {"username": username},
            {"user_id": username},
            {"name": {"$regex": f"^{username}$", "$options": "i"}}
        ]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    user_id = creator.get("user_id")
    
    # Get creator's approved videos
    videos = await db.creator_videos.find(
        {"creator_id": user_id, "status": "approved"},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Get upcoming scheduled slots
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    upcoming_slots = await db.creator_bookings.find(
        {
            "creator_id": user_id,
            "status": {"$in": ["approved", "confirmed"]},
            "slot_date": {"$gte": today}
        },
        {"_id": 0}
    ).sort([("slot_date", 1), ("slot_start_hour", 1)]).limit(10).to_list(10)
    
    # Get follower count
    follower_count = await db.creator_followers.count_documents({"creator_id": user_id})
    
    # Calculate total views
    total_views = sum(v.get("views", 0) for v in videos)
    
    # Build public profile
    public_profile = {
        "user_id": user_id,
        "username": creator.get("username") or username,
        "name": creator.get("name", "Creator"),
        "bio": creator.get("bio", ""),
        "avatar_url": creator.get("avatar_url"),
        "banner_url": creator.get("banner_url"),
        "is_verified": creator.get("is_verified", False),
        "youtube_url": creator.get("youtube_url"),
        "instagram_url": creator.get("instagram_url"),
        "twitter_url": creator.get("twitter_url"),
        "website_url": creator.get("website_url"),
        "total_views": total_views,
        "joined_at": creator.get("created_at")
    }
    
    return {
        "creator": public_profile,
        "videos": videos,
        "upcoming_slots": upcoming_slots,
        "follower_count": follower_count
    }


@router.get("/is-following/{creator_id}")
async def check_following_status(
    creator_id: str,
    authorization: str = Header(None)
):
    """Check if current user is following a creator"""
    if not authorization:
        return {"is_following": False}
    
    token = authorization.replace("Bearer ", "")
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        return {"is_following": False}
    
    user_id = session.get("user_id")
    
    follow = await db.creator_followers.find_one({
        "follower_id": user_id,
        "creator_id": creator_id
    })
    
    return {"is_following": follow is not None}


@router.post("/follow/{creator_id}")
async def follow_creator(
    creator_id: str,
    authorization: str = Header(None)
):
    """Follow a creator"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization.replace("Bearer ", "")
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user_id = session.get("user_id")
    
    # Can't follow yourself
    if user_id == creator_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    # Check if already following
    existing = await db.creator_followers.find_one({
        "follower_id": user_id,
        "creator_id": creator_id
    })
    
    if existing:
        return {"success": True, "message": "Already following"}
    
    # Create follow relationship
    await db.creator_followers.insert_one({
        "follower_id": user_id,
        "creator_id": creator_id,
        "followed_at": datetime.now(timezone.utc)
    })
    
    logger.info(f"User {user_id} followed creator {creator_id}")
    
    return {"success": True, "message": "Now following"}


@router.post("/unfollow/{creator_id}")
async def unfollow_creator(
    creator_id: str,
    authorization: str = Header(None)
):
    """Unfollow a creator"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization.replace("Bearer ", "")
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user_id = session.get("user_id")
    
    result = await db.creator_followers.delete_one({
        "follower_id": user_id,
        "creator_id": creator_id
    })
    
    if result.deleted_count > 0:
        logger.info(f"User {user_id} unfollowed creator {creator_id}")
    
    return {"success": True, "message": "Unfollowed"}


@router.get("/followers/{creator_id}")
async def get_creator_followers(
    creator_id: str,
    limit: int = Query(50, le=100)
):
    """Get list of followers for a creator"""
    followers = await db.creator_followers.find(
        {"creator_id": creator_id},
        {"_id": 0}
    ).sort("followed_at", -1).limit(limit).to_list(limit)
    
    count = await db.creator_followers.count_documents({"creator_id": creator_id})
    
    return {
        "followers": followers,
        "total": count
    }


@router.get("/following")
async def get_following_list(
    authorization: str = Header(None),
    limit: int = Query(50, le=100)
):
    """Get list of creators the current user is following"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization.replace("Bearer ", "")
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user_id = session.get("user_id")
    
    following = await db.creator_followers.find(
        {"follower_id": user_id},
        {"_id": 0}
    ).sort("followed_at", -1).limit(limit).to_list(limit)
    
    # Get creator details
    creator_ids = [f["creator_id"] for f in following]
    creators = await db.users.find(
        {"user_id": {"$in": creator_ids}},
        {"_id": 0, "password_hash": 0, "user_id": 1, "name": 1, "username": 1, "avatar_url": 1}
    ).to_list(100)
    
    return {
        "following": creators,
        "total": len(creators)
    }


# ============ PROFILE UPDATE ============

@router.put("/profile/update")
async def update_creator_profile(
    bio: Optional[str] = None,
    username: Optional[str] = None,
    youtube_url: Optional[str] = None,
    instagram_url: Optional[str] = None,
    twitter_url: Optional[str] = None,
    website_url: Optional[str] = None,
    authorization: str = Header(None)
):
    """Update creator profile information"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization.replace("Bearer ", "")
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user_id = session.get("user_id")
    
    update_data = {}
    if bio is not None:
        update_data["bio"] = bio[:500]  # Limit bio length
    if username is not None:
        # Check if username is taken
        existing = await db.users.find_one({"username": username, "user_id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_data["username"] = username.lower().replace(" ", "")
    if youtube_url is not None:
        update_data["youtube_url"] = youtube_url
    if instagram_url is not None:
        update_data["instagram_url"] = instagram_url
    if twitter_url is not None:
        update_data["twitter_url"] = twitter_url
    if website_url is not None:
        update_data["website_url"] = website_url
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
    
    return {"success": True, "updated_fields": list(update_data.keys())}


# ============ SEARCH ============

@router.get("/search")
async def search_creators(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, le=50)
):
    """Search for creators by name or username"""
    creators = await db.users.find(
        {
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"username": {"$regex": q, "$options": "i"}}
            ]
        },
        {"_id": 0, "password_hash": 0, "user_id": 1, "name": 1, "username": 1, "avatar_url": 1, "bio": 1}
    ).limit(limit).to_list(limit)
    
    return {"creators": creators, "total": len(creators)}


# ============ FEATURED CREATORS ============

@router.get("/featured")
async def get_featured_creators(limit: int = Query(10, le=20)):
    """Get featured/popular creators"""
    # Get creators with most followers
    pipeline = [
        {"$group": {"_id": "$creator_id", "follower_count": {"$sum": 1}}},
        {"$sort": {"follower_count": -1}},
        {"$limit": limit}
    ]
    
    top_creators = await db.creator_followers.aggregate(pipeline).to_list(limit)
    creator_ids = [c["_id"] for c in top_creators]
    
    if not creator_ids:
        # Fallback: get recent active creators
        recent_bookings = await db.creator_bookings.find(
            {"status": {"$in": ["approved", "confirmed"]}},
            {"creator_id": 1}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        creator_ids = list(set(b["creator_id"] for b in recent_bookings))
    
    creators = await db.users.find(
        {"user_id": {"$in": creator_ids}},
        {"_id": 0, "password_hash": 0}
    ).to_list(limit)
    
    # Add follower counts
    for creator in creators:
        count = await db.creator_followers.count_documents({"creator_id": creator.get("user_id")})
        creator["follower_count"] = count
    
    return {"featured_creators": creators}
