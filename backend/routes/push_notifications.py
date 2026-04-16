"""
Push Notification Routes for ZTVLIVE
Handles "Notify Me" / Follow Creator functionality
"""

from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging

from services.push_notifications import onesignal_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/push", tags=["Push Notifications"])

# Database reference (set from server.py)
db = None

def set_database(database):
    global db
    db = database


# ============ MODELS ============

class FollowCreatorRequest(BaseModel):
    creator_id: str
    creator_name: str
    player_id: str  # OneSignal player/subscription ID
    user_id: Optional[str] = None  # Optional logged-in user ID


class UnfollowCreatorRequest(BaseModel):
    creator_id: str
    player_id: str


class PushSubscriptionRequest(BaseModel):
    player_id: str
    user_id: Optional[str] = None
    device_type: Optional[str] = None  # web, android, ios


# ============ ENDPOINTS ============

@router.post("/subscribe")
async def register_push_subscription(
    request: PushSubscriptionRequest,
    req: Request = None
):
    """
    Register a push notification subscription
    Called when user enables notifications on the website
    """
    subscription_data = {
        "id": str(uuid.uuid4()),
        "player_id": request.player_id,
        "user_id": request.user_id,
        "device_type": request.device_type or "web",
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "ip_address": req.client.host if req else None
    }
    
    # Upsert subscription
    await db.push_subscriptions.update_one(
        {"player_id": request.player_id},
        {"$set": subscription_data},
        upsert=True
    )
    
    logger.info(f"Push subscription registered: {request.player_id}")
    
    return {
        "status": "subscribed",
        "player_id": request.player_id
    }


@router.post("/follow-creator")
async def follow_creator(request: FollowCreatorRequest):
    """
    Follow a creator to get notified when their content goes live
    """
    follow_data = {
        "id": str(uuid.uuid4()),
        "creator_id": request.creator_id,
        "creator_name": request.creator_name,
        "player_id": request.player_id,
        "user_id": request.user_id,
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Check if already following
    existing = await db.creator_followers.find_one({
        "creator_id": request.creator_id,
        "player_id": request.player_id
    })
    
    if existing:
        if existing.get("is_active"):
            return {"status": "already_following", "creator_id": request.creator_id}
        else:
            # Reactivate
            await db.creator_followers.update_one(
                {"_id": existing["_id"]},
                {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}}
            )
            logger.info(f"Reactivated follow: {request.player_id} -> {request.creator_name}")
            return {"status": "following", "creator_id": request.creator_id, "reactivated": True}
    
    # Create new follow
    await db.creator_followers.insert_one(follow_data)
    
    # Update follower count on creator
    await db.users.update_one(
        {"user_id": request.creator_id},
        {"$inc": {"follower_count": 1}}
    )
    
    # Add tag to OneSignal player for segmentation
    await onesignal_service.add_tag_to_user(
        player_id=request.player_id,
        tag_key=f"follows_{request.creator_id}",
        tag_value="true"
    )
    
    logger.info(f"New follow: {request.player_id} -> {request.creator_name}")
    
    return {
        "status": "following",
        "creator_id": request.creator_id,
        "creator_name": request.creator_name
    }


@router.post("/unfollow-creator")
async def unfollow_creator(request: UnfollowCreatorRequest):
    """
    Unfollow a creator - stop receiving notifications
    """
    result = await db.creator_followers.update_one(
        {
            "creator_id": request.creator_id,
            "player_id": request.player_id
        },
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count > 0:
        # Decrement follower count
        await db.users.update_one(
            {"user_id": request.creator_id},
            {"$inc": {"follower_count": -1}}
        )
        
        # Remove tag from OneSignal
        await onesignal_service.add_tag_to_user(
            player_id=request.player_id,
            tag_key=f"follows_{request.creator_id}",
            tag_value=""  # Empty string removes the tag
        )
        
        logger.info(f"Unfollowed: {request.player_id} -> {request.creator_id}")
        return {"status": "unfollowed", "creator_id": request.creator_id}
    
    return {"status": "not_following", "creator_id": request.creator_id}


@router.get("/following")
async def get_following_creators(player_id: str = Query(...)):
    """
    Get list of creators a user is following
    """
    follows = await db.creator_followers.find(
        {"player_id": player_id, "is_active": True},
        {"_id": 0, "creator_id": 1, "creator_name": 1, "created_at": 1}
    ).to_list(100)
    
    return {
        "following": follows,
        "count": len(follows)
    }


@router.get("/is-following/{creator_id}")
async def check_following(
    creator_id: str,
    player_id: str = Query(...)
):
    """
    Check if a user is following a specific creator
    """
    follow = await db.creator_followers.find_one({
        "creator_id": creator_id,
        "player_id": player_id,
        "is_active": True
    })
    
    return {
        "is_following": follow is not None,
        "creator_id": creator_id
    }


@router.get("/creator/{creator_id}/followers")
async def get_creator_followers(
    creator_id: str,
    include_player_ids: bool = False
):
    """
    Get follower count for a creator
    Optionally include player IDs for sending notifications
    """
    projection = {"_id": 0}
    if include_player_ids:
        projection["player_id"] = 1
    
    followers = await db.creator_followers.find(
        {"creator_id": creator_id, "is_active": True},
        projection
    ).to_list(10000)
    
    result = {
        "creator_id": creator_id,
        "follower_count": len(followers)
    }
    
    if include_player_ids:
        result["player_ids"] = [f["player_id"] for f in followers]
    
    return result


@router.post("/notify/creator-live")
async def notify_creator_going_live(
    creator_id: str = Query(...),
    creator_name: str = Query(...),
    video_title: str = Query(...),
    video_thumbnail: Optional[str] = None
):
    """
    Send push notification to all followers that creator is going live
    Called by the TV scheduler when creator content starts
    """
    # Get all active followers
    followers = await db.creator_followers.find(
        {"creator_id": creator_id, "is_active": True},
        {"player_id": 1}
    ).to_list(10000)
    
    if not followers:
        return {
            "status": "no_followers",
            "creator_id": creator_id,
            "notifications_sent": 0
        }
    
    player_ids = [f["player_id"] for f in followers]
    
    # Send notification via OneSignal
    result = await onesignal_service.send_creator_live_notification(
        creator_id=creator_id,
        creator_name=creator_name,
        video_title=video_title,
        video_thumbnail=video_thumbnail,
        follower_player_ids=player_ids
    )
    
    # Log the notification
    await db.push_notification_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "creator_live",
        "creator_id": creator_id,
        "creator_name": creator_name,
        "video_title": video_title,
        "recipients_count": len(player_ids),
        "onesignal_response": result,
        "created_at": datetime.now(timezone.utc)
    })
    
    logger.info(f"Sent live notification for {creator_name} to {len(player_ids)} followers")
    
    return {
        "status": "sent",
        "creator_id": creator_id,
        "notifications_sent": len(player_ids),
        "onesignal_response": result
    }


@router.post("/notify/content-reminder")
async def send_content_reminder(
    creator_id: str = Query(...),
    creator_name: str = Query(...),
    video_title: str = Query(...),
    minutes_until_live: int = Query(5),
    video_thumbnail: Optional[str] = None
):
    """
    Send reminder notification X minutes before content goes live
    """
    followers = await db.creator_followers.find(
        {"creator_id": creator_id, "is_active": True},
        {"player_id": 1}
    ).to_list(10000)
    
    if not followers:
        return {"status": "no_followers", "notifications_sent": 0}
    
    player_ids = [f["player_id"] for f in followers]
    
    result = await onesignal_service.send_content_reminder(
        creator_name=creator_name,
        video_title=video_title,
        minutes_until_live=minutes_until_live,
        follower_player_ids=player_ids,
        video_thumbnail=video_thumbnail
    )
    
    return {
        "status": "sent",
        "notifications_sent": len(player_ids),
        "onesignal_response": result
    }


@router.get("/stats")
async def get_push_notification_stats(days: int = 30):
    """
    Get push notification statistics for admin dashboard
    """
    from datetime import timedelta
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Total subscriptions
    total_subscriptions = await db.push_subscriptions.count_documents({
        "is_active": True
    })
    
    # Total follows
    total_follows = await db.creator_followers.count_documents({
        "is_active": True
    })
    
    # Notifications sent
    notifications_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$type",
            "count": {"$sum": 1},
            "total_recipients": {"$sum": "$recipients_count"}
        }}
    ]
    notifications_cursor = db.push_notification_logs.aggregate(notifications_pipeline)
    notifications_by_type = {}
    async for doc in notifications_cursor:
        notifications_by_type[doc["_id"]] = {
            "count": doc["count"],
            "total_recipients": doc["total_recipients"]
        }
    
    # Top followed creators
    top_creators_pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {
            "_id": {"creator_id": "$creator_id", "creator_name": "$creator_name"},
            "followers": {"$sum": 1}
        }},
        {"$sort": {"followers": -1}},
        {"$limit": 10}
    ]
    top_creators_cursor = db.creator_followers.aggregate(top_creators_pipeline)
    top_creators = []
    async for doc in top_creators_cursor:
        top_creators.append({
            "creator_id": doc["_id"]["creator_id"],
            "creator_name": doc["_id"]["creator_name"],
            "followers": doc["followers"]
        })
    
    return {
        "period_days": days,
        "total_subscriptions": total_subscriptions,
        "total_follows": total_follows,
        "notifications_by_type": notifications_by_type,
        "top_followed_creators": top_creators,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
