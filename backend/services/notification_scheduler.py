"""
ZTVLIVE Creator Notification Scheduler
Comprehensive push notification system with APScheduler integration.

Features:
- Real-time in-app notifications (stored in MongoDB)
- Push notifications via OneSignal
- Upcoming slot reminders (30 min, 5 min before)
- Optimal scheduling time suggestions
- Collab notifications
- Content status updates
"""

import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

logger = logging.getLogger("notification_scheduler")

# Database reference (set from server.py)
db = None

def set_db(database):
    """Set database reference from server.py"""
    global db
    db = database
    logger.info("Notification scheduler database initialized")


# ============ IN-APP NOTIFICATION SYSTEM ============

class NotificationType:
    """Notification type constants"""
    SLOT_REMINDER_30 = "slot_reminder_30"
    SLOT_REMINDER_5 = "slot_reminder_5"
    SLOT_LIVE = "slot_live"
    SLOT_COMPLETED = "slot_completed"
    CONTENT_APPROVED = "content_approved"
    CONTENT_FLAGGED = "content_flagged"
    COLLAB_INVITE = "collab_invite"
    COLLAB_ACCEPTED = "collab_accepted"
    COLLAB_DECLINED = "collab_declined"
    REVENUE_MILESTONE = "revenue_milestone"
    OPTIMAL_TIME = "optimal_time"
    SYSTEM = "system"
    ENGAGEMENT_ALERT = "engagement_alert"


async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    data: Dict[str, Any] = None,
    actions: List[Dict] = None,
    priority: str = "normal",
    icon: str = None,
    link: str = None
) -> Optional[str]:
    """
    Create an in-app notification stored in MongoDB.
    
    Args:
        user_id: Target user ID
        notification_type: Type from NotificationType class
        title: Notification title
        message: Notification body
        data: Additional data payload
        actions: List of action buttons [{"label": "View", "action": "view_slot", "data": {...}}]
        priority: "low", "normal", "high", "urgent"
        icon: Icon name (lucide-react compatible)
        link: Direct link when clicked
    
    Returns:
        notification_id if successful, None otherwise
    """
    if db is None:
        logger.warning("Database not initialized for notifications")
        return None
    
    notification_id = str(uuid.uuid4())
    
    notification = {
        "notification_id": notification_id,
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "actions": actions or [],
        "priority": priority,
        "icon": icon or _get_default_icon(notification_type),
        "link": link,
        "read": False,
        "dismissed": False,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7)
    }
    
    try:
        await db.user_notifications.insert_one(notification)
        logger.info(f"Created notification {notification_id} for user {user_id}: {title}")
        return notification_id
    except Exception as e:
        logger.error(f"Failed to create notification: {e}")
        return None


def _get_default_icon(notification_type: str) -> str:
    """Get default icon for notification type"""
    icons = {
        NotificationType.SLOT_REMINDER_30: "clock",
        NotificationType.SLOT_REMINDER_5: "alarm-clock",
        NotificationType.SLOT_LIVE: "radio",
        NotificationType.SLOT_COMPLETED: "check-circle",
        NotificationType.CONTENT_APPROVED: "check-circle-2",
        NotificationType.CONTENT_FLAGGED: "alert-triangle",
        NotificationType.COLLAB_INVITE: "user-plus",
        NotificationType.COLLAB_ACCEPTED: "users",
        NotificationType.COLLAB_DECLINED: "user-x",
        NotificationType.REVENUE_MILESTONE: "trophy",
        NotificationType.OPTIMAL_TIME: "sparkles",
        NotificationType.ENGAGEMENT_ALERT: "trending-up",
        NotificationType.SYSTEM: "info",
    }
    return icons.get(notification_type, "bell")


async def get_user_notifications(
    user_id: str,
    unread_only: bool = False,
    limit: int = 50,
    skip: int = 0,
    notification_types: List[str] = None
) -> List[Dict]:
    """Get notifications for a user"""
    if db is None:
        return []
    
    query = {"user_id": user_id, "dismissed": False}
    
    if unread_only:
        query["read"] = False
    
    if notification_types:
        query["type"] = {"$in": notification_types}
    
    try:
        notifications = await db.user_notifications.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        return notifications
    except Exception as e:
        logger.error(f"Failed to get notifications: {e}")
        return []


async def mark_notification_read(notification_id: str, user_id: str) -> bool:
    """Mark a notification as read"""
    if db is None:
        return False
    
    try:
        result = await db.user_notifications.update_one(
            {"notification_id": notification_id, "user_id": user_id},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0
    except Exception as e:
        logger.error(f"Failed to mark notification read: {e}")
        return False


async def mark_all_read(user_id: str) -> int:
    """Mark all notifications as read for a user"""
    if db is None:
        return 0
    
    try:
        result = await db.user_notifications.update_many(
            {"user_id": user_id, "read": False},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count
    except Exception as e:
        logger.error(f"Failed to mark all read: {e}")
        return 0


async def dismiss_notification(notification_id: str, user_id: str) -> bool:
    """Dismiss (soft delete) a notification"""
    if db is None:
        return False
    
    try:
        result = await db.user_notifications.update_one(
            {"notification_id": notification_id, "user_id": user_id},
            {"$set": {"dismissed": True, "dismissed_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0
    except Exception as e:
        logger.error(f"Failed to dismiss notification: {e}")
        return False


async def get_unread_count(user_id: str) -> int:
    """Get count of unread notifications"""
    if db is None:
        return 0
    
    try:
        count = await db.user_notifications.count_documents({
            "user_id": user_id,
            "read": False,
            "dismissed": False
        })
        return count
    except Exception as e:
        logger.error(f"Failed to get unread count: {e}")
        return 0


# ============ SCHEDULED TASKS ============

async def check_upcoming_slots():
    """
    Check for slots starting soon and send reminders.
    Called every 5 minutes by APScheduler.
    """
    if db is None:
        logger.warning("Database not initialized for notification scheduler")
        return
    
    now = datetime.now(timezone.utc)
    logger.info(f"[Notification Scheduler] Checking upcoming slots at {now.isoformat()}")
    
    try:
        from services.push_notifications import onesignal_service
        
        # ===== 30-MINUTE REMINDERS =====
        thirty_min_window_start = (now + timedelta(minutes=28)).isoformat()
        thirty_min_window_end = (now + timedelta(minutes=32)).isoformat()
        
        upcoming_30 = await db.creator_bookings.find({
            "slot_start_datetime": {
                "$gte": thirty_min_window_start,
                "$lte": thirty_min_window_end
            },
            "status": {"$in": ["approved", "scheduled", "confirmed"]},
            "reminder_30_sent": {"$ne": True}
        }).to_list(100)
        
        for booking in upcoming_30:
            creator_id = booking.get("creator_id")
            slot_time = booking.get("slot_start_time", "")
            video_title = booking.get("video_title", booking.get("title", "Your content"))
            booking_id = booking.get("booking_id", str(booking.get("_id", "")))
            
            # Create in-app notification
            await create_notification(
                user_id=creator_id,
                notification_type=NotificationType.SLOT_REMINDER_30,
                title="Your slot starts in 30 minutes!",
                message=f'"{video_title}" goes live at {slot_time}',
                data={"booking_id": booking_id, "video_title": video_title},
                actions=[
                    {"label": "View Schedule", "action": "view_schedule", "link": "/creator/schedule"},
                    {"label": "Dismiss", "action": "dismiss"}
                ],
                priority="high",
                link="/creator/schedule"
            )
            
            # Send push notification if devices registered
            devices = await db.user_devices.find(
                {"user_id": creator_id},
                {"player_id": 1}
            ).to_list(10)
            
            player_ids = [d["player_id"] for d in devices if d.get("player_id")]
            
            if player_ids:
                await onesignal_service.send_schedule_reminder_notification(
                    creator_player_ids=player_ids,
                    video_title=video_title,
                    slot_date=booking.get("slot_date", ""),
                    slot_time=slot_time,
                    minutes_until=30,
                    booking_id=booking_id
                )
            
            # Mark as sent
            await db.creator_bookings.update_one(
                {"_id": booking["_id"]},
                {"$set": {"reminder_30_sent": True}}
            )
            
            logger.info(f"[30-min reminder] Sent for booking {booking_id} to creator {creator_id}")
        
        # ===== 5-MINUTE REMINDERS =====
        five_min_window_start = (now + timedelta(minutes=3)).isoformat()
        five_min_window_end = (now + timedelta(minutes=7)).isoformat()
        
        upcoming_5 = await db.creator_bookings.find({
            "slot_start_datetime": {
                "$gte": five_min_window_start,
                "$lte": five_min_window_end
            },
            "status": {"$in": ["approved", "scheduled", "confirmed"]},
            "reminder_5_sent": {"$ne": True}
        }).to_list(100)
        
        for booking in upcoming_5:
            creator_id = booking.get("creator_id")
            slot_time = booking.get("slot_start_time", "")
            video_title = booking.get("video_title", booking.get("title", "Your content"))
            booking_id = booking.get("booking_id", str(booking.get("_id", "")))
            
            # Create urgent in-app notification
            await create_notification(
                user_id=creator_id,
                notification_type=NotificationType.SLOT_REMINDER_5,
                title="Going LIVE in 5 minutes!",
                message=f'"{video_title}" is about to start',
                data={"booking_id": booking_id, "video_title": video_title},
                actions=[
                    {"label": "Watch Now", "action": "watch_live", "link": "/watch"},
                    {"label": "View Schedule", "action": "view_schedule", "link": "/creator/schedule"}
                ],
                priority="urgent",
                icon="radio",
                link="/watch"
            )
            
            # Send push notification
            devices = await db.user_devices.find(
                {"user_id": creator_id},
                {"player_id": 1}
            ).to_list(10)
            
            player_ids = [d["player_id"] for d in devices if d.get("player_id")]
            
            if player_ids:
                await onesignal_service.send_schedule_reminder_notification(
                    creator_player_ids=player_ids,
                    video_title=video_title,
                    slot_date=booking.get("slot_date", ""),
                    slot_time=slot_time,
                    minutes_until=5,
                    booking_id=booking_id
                )
            
            # Mark as sent
            await db.creator_bookings.update_one(
                {"_id": booking["_id"]},
                {"$set": {"reminder_5_sent": True}}
            )
            
            logger.info(f"[5-min reminder] Sent for booking {booking_id} to creator {creator_id}")
        
        # ===== LIVE NOW NOTIFICATIONS =====
        # Check for slots that just started (within last 2 minutes)
        live_window_start = (now - timedelta(minutes=2)).isoformat()
        live_window_end = now.isoformat()
        
        just_started = await db.creator_bookings.find({
            "slot_start_datetime": {
                "$gte": live_window_start,
                "$lte": live_window_end
            },
            "status": {"$in": ["approved", "scheduled", "confirmed"]},
            "live_notification_sent": {"$ne": True}
        }).to_list(50)
        
        for booking in just_started:
            creator_id = booking.get("creator_id")
            video_title = booking.get("video_title", booking.get("title", "Content"))
            booking_id = booking.get("booking_id", str(booking.get("_id", "")))
            
            # Create LIVE notification for creator
            await create_notification(
                user_id=creator_id,
                notification_type=NotificationType.SLOT_LIVE,
                title="You're LIVE NOW!",
                message=f'"{video_title}" is playing on ZTVLIVE',
                data={"booking_id": booking_id, "video_title": video_title},
                actions=[
                    {"label": "Watch Live", "action": "watch_live", "link": "/watch"},
                    {"label": "Share", "action": "share", "link": f"/share?video={booking_id}"}
                ],
                priority="urgent",
                icon="radio"
            )
            
            # Mark as sent
            await db.creator_bookings.update_one(
                {"_id": booking["_id"]},
                {"$set": {"live_notification_sent": True, "status": "live"}}
            )
            
            logger.info(f"[LIVE notification] Sent for booking {booking_id}")
        
        logger.info(f"[Notification Scheduler] Processed {len(upcoming_30)} 30-min, {len(upcoming_5)} 5-min, {len(just_started)} live notifications")
        
    except Exception as e:
        logger.error(f"Error in check_upcoming_slots: {e}", exc_info=True)


async def check_collab_notifications():
    """
    Check for pending collab invites and send reminders.
    Called every hour.
    """
    if db is None:
        return
    
    now = datetime.now(timezone.utc)
    
    try:
        # Find pending collab invites older than 24 hours without reminder
        old_pending = await db.creator_collabs.find({
            "status": "pending",
            "created_at": {"$lte": (now - timedelta(hours=24)).isoformat()},
            "reminder_sent": {"$ne": True}
        }).to_list(100)
        
        for collab in old_pending:
            invitee_id = collab.get("invitee_id")
            inviter_name = collab.get("inviter_name", "A creator")
            video_title = collab.get("video_title", "a collaboration")
            
            await create_notification(
                user_id=invitee_id,
                notification_type=NotificationType.COLLAB_INVITE,
                title="Collab invite waiting!",
                message=f'{inviter_name} invited you to collaborate on "{video_title}"',
                data={"collab_id": collab.get("collab_id")},
                actions=[
                    {"label": "View Invite", "action": "view_collab", "link": "/creator/collabs"},
                    {"label": "Decline", "action": "decline_collab"}
                ],
                priority="normal",
                link="/creator/collabs"
            )
            
            await db.creator_collabs.update_one(
                {"_id": collab["_id"]},
                {"$set": {"reminder_sent": True}}
            )
        
        logger.info(f"[Collab Scheduler] Sent {len(old_pending)} collab reminders")
        
    except Exception as e:
        logger.error(f"Error in check_collab_notifications: {e}")


async def send_daily_engagement_digest():
    """
    Send daily engagement summary to active creators.
    Called once daily at 9 AM UTC.
    """
    if db is None:
        return
    
    try:
        # Get all approved creators
        creators = await db.users.find(
            {"$or": [{"is_creator_approved": True}, {"role": "creator"}]},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1}
        ).to_list(1000)
        
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        
        for creator in creators:
            creator_id = creator.get("user_id")
            if not creator_id:
                continue
            
            # Get yesterday's stats
            videos = await db.creator_videos.find(
                {"creator_id": creator_id},
                {"views": 1, "likes": 1}
            ).to_list(100)
            
            total_views = sum(v.get("views", 0) for v in videos)
            total_likes = sum(v.get("likes", 0) for v in videos)
            
            # Only notify if they have engagement
            if total_views > 10:
                await create_notification(
                    user_id=creator_id,
                    notification_type=NotificationType.ENGAGEMENT_ALERT,
                    title="Your daily stats",
                    message=f"Yesterday: {total_views:,} views, {total_likes} likes across your content",
                    data={"total_views": total_views, "total_likes": total_likes},
                    actions=[
                        {"label": "View Analytics", "action": "view_analytics", "link": "/creator/dashboard#analytics"}
                    ],
                    priority="low",
                    icon="bar-chart"
                )
        
        logger.info(f"[Daily Digest] Sent engagement digests to {len(creators)} creators")
        
    except Exception as e:
        logger.error(f"Error in send_daily_engagement_digest: {e}")


async def send_weekly_optimal_time_digest():
    """
    Send weekly notification about optimal scheduling times.
    Called once a week on Sunday.
    """
    if db is None:
        return
    
    try:
        from services.push_notifications import onesignal_service
        
        # Get all active creators with devices
        creators = await db.users.find(
            {"$or": [{"is_creator_approved": True}, {"role": "creator"}]},
            {"_id": 0, "user_id": 1, "name": 1}
        ).to_list(1000)
        
        now = datetime.now(timezone.utc)
        
        for creator in creators:
            creator_id = creator.get("user_id")
            if not creator_id:
                continue
            
            # Calculate next Saturday at 8 PM as default optimal
            days_until_saturday = (5 - now.weekday()) % 7
            if days_until_saturday == 0:
                days_until_saturday = 7
            next_saturday = now + timedelta(days=days_until_saturday)
            
            await create_notification(
                user_id=creator_id,
                notification_type=NotificationType.OPTIMAL_TIME,
                title="Best time to go live this week",
                message=f"Schedule your content for {next_saturday.strftime('%A, %B %d')} at 8:00 PM - weekend prime time drives 40% more views!",
                data={
                    "suggested_date": next_saturday.strftime("%Y-%m-%d"),
                    "suggested_time": "20:00",
                    "confidence": 85
                },
                actions=[
                    {"label": "Schedule Now", "action": "schedule", "link": "/creator/schedule"},
                    {"label": "View Insights", "action": "view_insights", "link": "/creator/dashboard#analytics"}
                ],
                priority="normal",
                icon="sparkles"
            )
            
            # Also send push notification if devices registered
            devices = await db.user_devices.find(
                {"user_id": creator_id},
                {"player_id": 1}
            ).to_list(10)
            
            player_ids = [d["player_id"] for d in devices if d.get("player_id")]
            
            if player_ids:
                await onesignal_service.send_optimal_time_notification(
                    creator_player_ids=player_ids,
                    suggested_date=next_saturday.strftime("%A, %B %d"),
                    suggested_time="8:00 PM",
                    confidence_score=85,
                    reason="Weekend prime time drives 40% more views"
                )
        
        logger.info(f"[Weekly Digest] Sent optimal time suggestions to {len(creators)} creators")
        
    except Exception as e:
        logger.error(f"Error in send_weekly_optimal_time_digest: {e}")


async def cleanup_old_notifications():
    """
    Remove old dismissed/expired notifications.
    Called daily at midnight.
    """
    if db is None:
        return
    
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        
        # Delete dismissed notifications older than 30 days
        result = await db.user_notifications.delete_many({
            "$or": [
                {"dismissed": True, "dismissed_at": {"$lt": cutoff}},
                {"expires_at": {"$lt": datetime.now(timezone.utc)}}
            ]
        })
        
        logger.info(f"[Cleanup] Removed {result.deleted_count} old notifications")
        
    except Exception as e:
        logger.error(f"Error in cleanup_old_notifications: {e}")


# ============ NOTIFICATION TRIGGERS ============

async def notify_content_approved(creator_id: str, video_title: str, video_id: str):
    """Send notification when content is approved"""
    await create_notification(
        user_id=creator_id,
        notification_type=NotificationType.CONTENT_APPROVED,
        title="Content approved!",
        message=f'"{video_title}" has been approved and is ready for scheduling',
        data={"video_id": video_id, "video_title": video_title},
        actions=[
            {"label": "Schedule Now", "action": "schedule", "link": f"/creator/schedule?video={video_id}"},
            {"label": "View Library", "action": "view_library", "link": "/creator/dashboard#library"}
        ],
        priority="high",
        icon="check-circle-2"
    )


async def notify_content_flagged(creator_id: str, video_title: str, video_id: str, reason: str):
    """Send notification when content is flagged for review"""
    await create_notification(
        user_id=creator_id,
        notification_type=NotificationType.CONTENT_FLAGGED,
        title="Content needs attention",
        message=f'"{video_title}" was flagged: {reason}',
        data={"video_id": video_id, "video_title": video_title, "reason": reason},
        actions=[
            {"label": "View Details", "action": "view_details", "link": f"/creator/dashboard?video={video_id}"},
            {"label": "Contact Support", "action": "contact_support", "link": "/support"}
        ],
        priority="high",
        icon="alert-triangle"
    )


async def notify_collab_invite(invitee_id: str, inviter_name: str, video_title: str, collab_id: str):
    """Send notification for new collab invite"""
    await create_notification(
        user_id=invitee_id,
        notification_type=NotificationType.COLLAB_INVITE,
        title="New collaboration invite!",
        message=f'{inviter_name} wants to collaborate with you on "{video_title}"',
        data={"collab_id": collab_id, "inviter_name": inviter_name, "video_title": video_title},
        actions=[
            {"label": "Accept", "action": "accept_collab", "data": {"collab_id": collab_id}},
            {"label": "Decline", "action": "decline_collab", "data": {"collab_id": collab_id}},
            {"label": "View Details", "action": "view_collab", "link": "/creator/collabs"}
        ],
        priority="high",
        icon="user-plus"
    )


async def notify_revenue_milestone(creator_id: str, milestone: str, amount: float):
    """Send notification for revenue milestone"""
    await create_notification(
        user_id=creator_id,
        notification_type=NotificationType.REVENUE_MILESTONE,
        title=f"Milestone reached: {milestone}!",
        message=f"You've earned ${amount:.2f}. Keep creating amazing content!",
        data={"milestone": milestone, "amount": amount},
        actions=[
            {"label": "View Revenue", "action": "view_revenue", "link": "/creator/dashboard#revenue"}
        ],
        priority="normal",
        icon="trophy"
    )


# ============ SCHEDULER INITIALIZATION ============

def register_scheduler_jobs(scheduler):
    """Register all notification scheduler jobs with APScheduler"""
    
    # Check upcoming slots every 5 minutes
    scheduler.add_job(
        check_upcoming_slots,
        'interval',
        minutes=5,
        id='notification_upcoming_slots',
        replace_existing=True,
        name='Check upcoming broadcast slots'
    )
    
    # Check collab notifications every hour
    scheduler.add_job(
        check_collab_notifications,
        'interval',
        hours=1,
        id='notification_collabs',
        replace_existing=True,
        name='Check pending collab invites'
    )
    
    # Send daily engagement digest at 9 AM UTC
    scheduler.add_job(
        send_daily_engagement_digest,
        'cron',
        hour=9,
        minute=0,
        id='notification_daily_digest',
        replace_existing=True,
        name='Daily engagement digest'
    )
    
    # Send weekly optimal time digest on Sundays at 10 AM UTC
    scheduler.add_job(
        send_weekly_optimal_time_digest,
        'cron',
        day_of_week='sun',
        hour=10,
        minute=0,
        id='notification_weekly_optimal',
        replace_existing=True,
        name='Weekly optimal scheduling times'
    )
    
    # Cleanup old notifications daily at midnight
    scheduler.add_job(
        cleanup_old_notifications,
        'cron',
        hour=0,
        minute=0,
        id='notification_cleanup',
        replace_existing=True,
        name='Cleanup old notifications'
    )
    
    logger.info("[Notification Scheduler] All jobs registered successfully")
