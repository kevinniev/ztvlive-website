"""
ZTVLIVE In-App Notifications API
Provides endpoints for real-time notification management.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging

from services.notification_scheduler import (
    get_user_notifications,
    mark_notification_read,
    mark_all_read,
    dismiss_notification,
    get_unread_count,
    create_notification,
    NotificationType
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/in-app-notifications", tags=["In-App Notifications"])


class NotificationResponse(BaseModel):
    notification_id: str
    type: str
    title: str
    message: str
    data: Dict[str, Any] = {}
    actions: List[Dict] = []
    priority: str = "normal"
    icon: str = "bell"
    link: Optional[str] = None
    read: bool = False
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: List[Dict]
    unread_count: int
    total: int


class CreateNotificationRequest(BaseModel):
    user_id: str
    type: str
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict]] = None
    priority: Optional[str] = "normal"
    icon: Optional[str] = None
    link: Optional[str] = None


@router.get("")
async def get_notifications(
    user_id: str = Query(..., description="User ID to fetch notifications for"),
    unread_only: bool = Query(False, description="Only return unread notifications"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    types: Optional[str] = Query(None, description="Comma-separated notification types filter")
):
    """
    Get notifications for a user.
    
    Returns paginated list of notifications with unread count.
    """
    type_list = types.split(",") if types else None
    
    notifications = await get_user_notifications(
        user_id=user_id,
        unread_only=unread_only,
        limit=limit,
        skip=skip,
        notification_types=type_list
    )
    
    unread_count = await get_unread_count(user_id)
    
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total": len(notifications),
        "has_more": len(notifications) == limit
    }


@router.get("/unread-count")
async def get_notification_count(
    user_id: str = Query(..., description="User ID")
):
    """Get count of unread notifications for a user."""
    count = await get_unread_count(user_id)
    return {"unread_count": count}


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    user_id: str = Query(..., description="User ID")
):
    """Mark a single notification as read."""
    success = await mark_notification_read(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success", "notification_id": notification_id}


@router.post("/read-all")
async def mark_all_as_read(
    user_id: str = Query(..., description="User ID")
):
    """Mark all notifications as read for a user."""
    count = await mark_all_read(user_id)
    return {"status": "success", "marked_count": count}


@router.post("/{notification_id}/dismiss")
async def dismiss_single_notification(
    notification_id: str,
    user_id: str = Query(..., description="User ID")
):
    """Dismiss (soft delete) a notification."""
    success = await dismiss_notification(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success", "notification_id": notification_id}


@router.post("/create")
async def create_new_notification(request: CreateNotificationRequest):
    """
    Create a new notification (admin/system use).
    
    This endpoint is for system-generated notifications.
    """
    notification_id = await create_notification(
        user_id=request.user_id,
        notification_type=request.type,
        title=request.title,
        message=request.message,
        data=request.data,
        actions=request.actions,
        priority=request.priority,
        icon=request.icon,
        link=request.link
    )
    
    if not notification_id:
        raise HTTPException(status_code=500, detail="Failed to create notification")
    
    return {"status": "success", "notification_id": notification_id}


@router.get("/types")
async def get_notification_types():
    """Get all available notification types."""
    return {
        "types": [
            {"value": NotificationType.SLOT_REMINDER_30, "label": "30-Min Slot Reminder", "icon": "clock"},
            {"value": NotificationType.SLOT_REMINDER_5, "label": "5-Min Slot Reminder", "icon": "alarm-clock"},
            {"value": NotificationType.SLOT_LIVE, "label": "Slot Live Now", "icon": "radio"},
            {"value": NotificationType.SLOT_COMPLETED, "label": "Slot Completed", "icon": "check-circle"},
            {"value": NotificationType.CONTENT_APPROVED, "label": "Content Approved", "icon": "check-circle-2"},
            {"value": NotificationType.CONTENT_FLAGGED, "label": "Content Flagged", "icon": "alert-triangle"},
            {"value": NotificationType.COLLAB_INVITE, "label": "Collab Invite", "icon": "user-plus"},
            {"value": NotificationType.COLLAB_ACCEPTED, "label": "Collab Accepted", "icon": "users"},
            {"value": NotificationType.COLLAB_DECLINED, "label": "Collab Declined", "icon": "user-x"},
            {"value": NotificationType.REVENUE_MILESTONE, "label": "Revenue Milestone", "icon": "trophy"},
            {"value": NotificationType.OPTIMAL_TIME, "label": "Optimal Scheduling Time", "icon": "sparkles"},
            {"value": NotificationType.ENGAGEMENT_ALERT, "label": "Engagement Alert", "icon": "trending-up"},
            {"value": NotificationType.SYSTEM, "label": "System", "icon": "info"},
        ]
    }


@router.post("/test")
async def send_test_notification(
    user_id: str = Query(..., description="User ID to send test notification to"),
    notification_type: str = Query("system", description="Type of notification")
):
    """
    Send a test notification (for debugging/demo).
    """
    type_configs = {
        "slot_reminder": {
            "type": NotificationType.SLOT_REMINDER_30,
            "title": "Your slot starts in 30 minutes!",
            "message": "Test Video goes live soon. Get ready!",
            "priority": "high",
            "icon": "clock"
        },
        "content_approved": {
            "type": NotificationType.CONTENT_APPROVED,
            "title": "Content approved!",
            "message": "Your video has been approved and is ready for scheduling",
            "priority": "high",
            "icon": "check-circle-2"
        },
        "collab_invite": {
            "type": NotificationType.COLLAB_INVITE,
            "title": "New collaboration invite!",
            "message": "A creator wants to collaborate with you",
            "priority": "high",
            "icon": "user-plus"
        },
        "system": {
            "type": NotificationType.SYSTEM,
            "title": "Test Notification",
            "message": "This is a test notification from ZTVLIVE",
            "priority": "normal",
            "icon": "info"
        }
    }
    
    config = type_configs.get(notification_type, type_configs["system"])
    
    notification_id = await create_notification(
        user_id=user_id,
        notification_type=config["type"],
        title=config["title"],
        message=config["message"],
        priority=config["priority"],
        icon=config["icon"],
        actions=[
            {"label": "View", "action": "view", "link": "/creator/dashboard"},
            {"label": "Dismiss", "action": "dismiss"}
        ]
    )
    
    return {
        "status": "success",
        "notification_id": notification_id,
        "message": f"Test notification sent to user {user_id}"
    }
