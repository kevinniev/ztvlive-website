"""
ZTVLIVE Notification System
Handles creator notifications, admin alerts, and live video notifications
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from enum import Enum
import uuid
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# Database reference (set from server.py)
db = None

# Email service reference (set from server.py)
email_service = None

def set_database(database):
    global db
    db = database

def set_email_service(service):
    global email_service
    email_service = service


class NotificationType(str, Enum):
    VIDEO_LIKE = "video_like"
    VIDEO_COMMENT = "video_comment"
    VIDEO_LIVE = "video_live"
    NEW_FOLLOWER = "new_follower"
    PAYOUT_RECEIVED = "payout_received"
    VIDEO_APPROVED = "video_approved"
    VIDEO_SCHEDULED = "video_scheduled"
    SYSTEM_ANNOUNCEMENT = "system_announcement"


class NotificationPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class NotificationCreate(BaseModel):
    user_id: str
    type: NotificationType
    title: str
    message: str
    link: Optional[str] = None
    metadata: Optional[dict] = None
    priority: NotificationPriority = NotificationPriority.MEDIUM


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    link: Optional[str]
    metadata: Optional[dict]
    priority: str
    is_read: bool
    created_at: datetime


# ============ NOTIFICATION HELPERS ============

async def create_notification(
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    link: Optional[str] = None,
    metadata: Optional[dict] = None,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    send_email: bool = False
) -> dict:
    """Create a notification for a user"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notification_type.value,
        "title": title,
        "message": message,
        "link": link,
        "metadata": metadata or {},
        "priority": priority.value,
        "is_read": False,
        "email_sent": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.notifications.insert_one(notification)
    logger.info(f"Notification created for {user_id}: {title}")
    
    # Send email notification if requested
    if send_email:
        await send_email_notification(user_id, title, message, link)
    
    return notification


async def send_email_notification(user_id: str, title: str, message: str, link: Optional[str] = None):
    """Send email notification to user (placeholder - integrate with email service)"""
    try:
        # Get user email
        user = await db.users.find_one({"user_id": user_id})
        if not user or not user.get("email"):
            logger.warning(f"No email found for user {user_id}")
            return
        
        email = user["email"]
        
        # Log email (in production, integrate with SendGrid/SES/etc)
        logger.info(f"📧 EMAIL TO: {email}")
        logger.info(f"   Subject: ZTVLIVE - {title}")
        logger.info(f"   Message: {message}")
        if link:
            logger.info(f"   Link: {link}")
        
        # Store email log in database
        await db.email_logs.insert_one({
            "id": str(uuid.uuid4()),
            "to_email": email,
            "user_id": user_id,
            "subject": f"ZTVLIVE - {title}",
            "message": message,
            "link": link,
            "status": "logged",  # Change to "sent" when email service integrated
            "created_at": datetime.now(timezone.utc)
        })
        
    except Exception as e:
        logger.error(f"Failed to send email notification: {e}")


async def notify_admin(
    title: str,
    message: str,
    notification_type: str = "creator_activity",
    metadata: Optional[dict] = None
):
    """Send notification to all admins"""
    try:
        admins = await db.admin_users.find({"is_active": True}).to_list(100)
        
        for admin in admins:
            admin_notification = {
                "id": str(uuid.uuid4()),
                "admin_id": admin["id"],
                "type": notification_type,
                "title": title,
                "message": message,
                "metadata": metadata or {},
                "is_read": False,
                "created_at": datetime.now(timezone.utc)
            }
            await db.admin_notifications.insert_one(admin_notification)
        
        logger.info(f"Admin notification sent: {title}")
        
    except Exception as e:
        logger.error(f"Failed to notify admin: {e}")


async def notify_video_going_live(video_id: str, creator_id: str, video_title: str):
    """Notify creator when their video starts playing live"""
    await create_notification(
        user_id=creator_id,
        notification_type=NotificationType.VIDEO_LIVE,
        title="🔴 Your Video is LIVE!",
        message=f'"{video_title}" is now playing on ZTVLIVE! Share it with your friends and watch the views grow!',
        link=f"/watch?v={video_id}",
        metadata={"video_id": video_id, "video_title": video_title},
        priority=NotificationPriority.HIGH,
        send_email=False  # We'll send a custom HTML email below
    )
    
    # Send beautiful HTML email via SendGrid
    if email_service:
        try:
            # Get creator info for email
            user = await db.users.find_one({"user_id": creator_id})
            if user and user.get("email"):
                await email_service.send_video_live_email(
                    to_email=user["email"],
                    creator_name=user.get("name", "Creator"),
                    video_title=video_title,
                    video_id=video_id
                )
        except Exception as e:
            logger.error(f"Failed to send video live email: {e}")
    
    # Also notify admin
    await notify_admin(
        title="Creator Video Now Live",
        message=f'Video "{video_title}" is now playing on the live channel',
        notification_type="video_live",
        metadata={"video_id": video_id, "creator_id": creator_id}
    )


async def notify_video_like(video_id: str, creator_id: str, video_title: str, liker_name: str, total_likes: int = 0):
    """Notify creator when someone likes their video"""
    await create_notification(
        user_id=creator_id,
        notification_type=NotificationType.VIDEO_LIKE,
        title="❤️ New Like!",
        message=f'{liker_name} liked your video "{video_title}"',
        link=f"/watch?v={video_id}",
        metadata={"video_id": video_id, "liker_name": liker_name},
        priority=NotificationPriority.LOW
    )
    
    # Check notification settings - only send email if enabled
    settings = await db.notification_settings.find_one({"user_id": creator_id})
    send_email = settings.get("email_on_like", False) if settings else False
    
    if send_email and email_service:
        try:
            user = await db.users.find_one({"user_id": creator_id})
            if user and user.get("email"):
                await email_service.send_like_email(
                    to_email=user["email"],
                    creator_name=user.get("name", "Creator"),
                    liker_name=liker_name,
                    video_title=video_title,
                    video_id=video_id,
                    total_likes=total_likes
                )
        except Exception as e:
            logger.error(f"Failed to send like email: {e}")


async def notify_video_comment(
    video_id: str, 
    creator_id: str, 
    video_title: str, 
    commenter_name: str,
    comment_preview: str
):
    """Notify creator when someone comments on their video"""
    await create_notification(
        user_id=creator_id,
        notification_type=NotificationType.VIDEO_COMMENT,
        title="💬 New Comment!",
        message=f'{commenter_name} commented on "{video_title}": "{comment_preview[:50]}..."' if len(comment_preview) > 50 else f'{commenter_name} commented on "{video_title}": "{comment_preview}"',
        link=f"/watch?v={video_id}",
        metadata={"video_id": video_id, "commenter_name": commenter_name, "comment": comment_preview},
        priority=NotificationPriority.MEDIUM
    )
    
    # Check notification settings - send email by default for comments
    settings = await db.notification_settings.find_one({"user_id": creator_id})
    send_email = settings.get("email_on_comment", True) if settings else True
    
    if send_email and email_service:
        try:
            user = await db.users.find_one({"user_id": creator_id})
            if user and user.get("email"):
                await email_service.send_comment_email(
                    to_email=user["email"],
                    creator_name=user.get("name", "Creator"),
                    commenter_name=commenter_name,
                    video_title=video_title,
                    comment=comment_preview,
                    video_id=video_id
                )
        except Exception as e:
            logger.error(f"Failed to send comment email: {e}")


async def notify_new_creator(creator_id: str, creator_name: str, creator_email: str):
    """Notify admin when a new creator joins"""
    await notify_admin(
        title="🆕 New Creator Joined!",
        message=f'{creator_name} ({creator_email}) just joined ZTVLIVE as a creator!',
        notification_type="new_creator",
        metadata={"creator_id": creator_id, "creator_name": creator_name, "creator_email": creator_email}
    )


async def notify_new_upload(creator_id: str, creator_name: str, video_title: str, category: str):
    """Notify admin when a creator uploads new content"""
    await notify_admin(
        title="📤 New Content Uploaded",
        message=f'{creator_name} uploaded "{video_title}" in {category}',
        notification_type="new_upload",
        metadata={"creator_id": creator_id, "creator_name": creator_name, "video_title": video_title, "category": category}
    )


# ============ CREATOR NOTIFICATION ENDPOINTS ============

@router.get("/my", response_model=List[NotificationResponse])
async def get_my_notifications(
    user_id: str = Query(...),
    unread_only: bool = False,
    skip: int = 0,
    limit: int = 50
):
    """Get notifications for a user"""
    query = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return notifications


@router.get("/my/unread-count")
async def get_unread_count(user_id: str = Query(...)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": user_id,
        "is_read": False
    })
    return {"unread_count": count}


@router.post("/my/mark-read/{notification_id}")
async def mark_notification_read(notification_id: str, user_id: str = Query(...)):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user_id},
        {"$set": {"is_read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"status": "marked_read"}


@router.post("/my/mark-all-read")
async def mark_all_notifications_read(user_id: str = Query(...)):
    """Mark all notifications as read"""
    result = await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {"marked_read": result.modified_count}


@router.delete("/my/{notification_id}")
async def delete_notification(notification_id: str, user_id: str = Query(...)):
    """Delete a notification"""
    result = await db.notifications.delete_one({
        "id": notification_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"status": "deleted"}


# ============ ADMIN NOTIFICATION ENDPOINTS ============

@router.get("/admin")
async def get_admin_notifications(
    admin_id: str = Query(...),
    unread_only: bool = False,
    notification_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get notifications for admin"""
    query = {"admin_id": admin_id}
    if unread_only:
        query["is_read"] = False
    if notification_type:
        query["type"] = notification_type
    
    notifications = await db.admin_notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"notifications": notifications, "count": len(notifications)}


@router.get("/admin/unread-count")
async def get_admin_unread_count(admin_id: str = Query(...)):
    """Get count of unread admin notifications"""
    count = await db.admin_notifications.count_documents({
        "admin_id": admin_id,
        "is_read": False
    })
    return {"unread_count": count}


@router.post("/admin/mark-read/{notification_id}")
async def mark_admin_notification_read(notification_id: str, admin_id: str = Query(...)):
    """Mark an admin notification as read"""
    result = await db.admin_notifications.update_one(
        {"id": notification_id, "admin_id": admin_id},
        {"$set": {"is_read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"status": "marked_read"}


@router.post("/admin/mark-all-read")
async def mark_all_admin_notifications_read(admin_id: str = Query(...)):
    """Mark all admin notifications as read"""
    result = await db.admin_notifications.update_many(
        {"admin_id": admin_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {"marked_read": result.modified_count}


# ============ NOTIFICATION SETTINGS ============

@router.get("/settings")
async def get_notification_settings(user_id: str = Query(...)):
    """Get notification preferences for a user"""
    settings = await db.notification_settings.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not settings:
        # Return default settings
        settings = {
            "user_id": user_id,
            "email_on_like": False,
            "email_on_comment": True,
            "email_on_video_live": True,
            "email_on_payout": True,
            "push_notifications": True,
            "digest_frequency": "instant"  # instant, daily, weekly
        }
    
    return settings


@router.put("/settings")
async def update_notification_settings(
    user_id: str = Query(...),
    email_on_like: Optional[bool] = None,
    email_on_comment: Optional[bool] = None,
    email_on_video_live: Optional[bool] = None,
    email_on_payout: Optional[bool] = None,
    push_notifications: Optional[bool] = None,
    digest_frequency: Optional[str] = None
):
    """Update notification preferences"""
    updates = {}
    if email_on_like is not None:
        updates["email_on_like"] = email_on_like
    if email_on_comment is not None:
        updates["email_on_comment"] = email_on_comment
    if email_on_video_live is not None:
        updates["email_on_video_live"] = email_on_video_live
    if email_on_payout is not None:
        updates["email_on_payout"] = email_on_payout
    if push_notifications is not None:
        updates["push_notifications"] = push_notifications
    if digest_frequency is not None:
        updates["digest_frequency"] = digest_frequency
    
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db.notification_settings.update_one(
            {"user_id": user_id},
            {"$set": updates},
            upsert=True
        )
    
    return await get_notification_settings(user_id)


# ============ BROADCAST NOTIFICATIONS ============

@router.post("/admin/broadcast")
async def broadcast_notification(
    title: str = Query(...),
    message: str = Query(...),
    admin_id: str = Query(...),
    target: str = Query("all_creators")  # all_creators, all_users, specific_category
):
    """Admin: Broadcast notification to multiple users"""
    # Verify admin
    admin = await db.admin_users.find_one({"id": admin_id})
    if not admin or admin.get("role") not in ["super_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get target users
    if target == "all_creators":
        # Get all unique creator IDs from videos
        pipeline = [
            {"$group": {"_id": "$creator_id"}},
            {"$limit": 10000}
        ]
        creator_ids = [doc["_id"] async for doc in db.creator_videos.aggregate(pipeline)]
    else:
        creator_ids = []
    
    # Create notifications for all targets
    count = 0
    for user_id in creator_ids:
        await create_notification(
            user_id=user_id,
            notification_type=NotificationType.SYSTEM_ANNOUNCEMENT,
            title=title,
            message=message,
            priority=NotificationPriority.HIGH
        )
        count += 1
    
    logger.info(f"Broadcast sent to {count} users by admin {admin_id}")
    
    return {"status": "broadcast_sent", "recipients": count}


# ============ VIDEO LIVE NOTIFICATION ENDPOINT ============

@router.post("/trigger-video-live")
async def trigger_video_live_notification(
    video_id: str = Query(...),
    creator_id: str = Query(...),
    video_title: str = Query(...)
):
    """
    Trigger a notification when a creator's video starts playing live.
    This endpoint is called by the TV scheduler when a creator video goes live.
    """
    await notify_video_going_live(video_id, creator_id, video_title)
    return {
        "status": "notification_sent",
        "video_id": video_id,
        "creator_id": creator_id,
        "message": f"Notification sent for '{video_title}' going live"
    }

