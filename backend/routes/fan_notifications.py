"""
Fan Notification System for ZTVLIVE
Allows fans to subscribe to creators and get notified when content goes live.
Supports both Email (Resend) and Push (OneSignal) notifications.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os
import logging

router = APIRouter(prefix="/fan-notifications", tags=["Fan Notifications"])
logger = logging.getLogger("fan_notifications")

# Will be set by server.py
db = None
def set_database(database):
    global db
    db = database


class FanSubscription(BaseModel):
    email: EmailStr
    creator_id: Optional[str] = None  # Subscribe to specific creator, or all if None
    notify_live: bool = True
    notify_scheduled: bool = True


class NotificationPreferences(BaseModel):
    email_notifications: bool = True
    push_notifications: bool = True


@router.post("/subscribe")
async def subscribe_to_notifications(subscription: FanSubscription):
    """
    Subscribe to get notified when creator content goes live.
    Fans can subscribe to specific creators or all creators.
    """
    subscription_id = str(uuid.uuid4())
    
    subscription_doc = {
        "_id": subscription_id,
        "subscription_id": subscription_id,
        "email": subscription.email,
        "creator_id": subscription.creator_id,  # None means all creators
        "notify_live": subscription.notify_live,
        "notify_scheduled": subscription.notify_scheduled,
        "subscribed_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    # Check if already subscribed
    existing = await db.fan_subscriptions.find_one({
        "email": subscription.email,
        "creator_id": subscription.creator_id
    })
    
    if existing:
        # Update existing subscription
        await db.fan_subscriptions.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "notify_live": subscription.notify_live,
                "notify_scheduled": subscription.notify_scheduled,
                "is_active": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Subscription updated", "subscription_id": existing["_id"]}
    
    await db.fan_subscriptions.insert_one(subscription_doc)
    
    return {
        "message": "Successfully subscribed!",
        "subscription_id": subscription_id,
        "email": subscription.email
    }


@router.delete("/unsubscribe")
async def unsubscribe_from_notifications(email: str, creator_id: Optional[str] = None):
    """Unsubscribe from notifications"""
    query = {"email": email}
    if creator_id:
        query["creator_id"] = creator_id
    
    result = await db.fan_subscriptions.update_many(
        query,
        {"$set": {"is_active": False, "unsubscribed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Unsubscribed {result.modified_count} subscription(s)"}


@router.get("/subscribers/{creator_id}")
async def get_creator_subscribers(creator_id: str):
    """Get count of subscribers for a creator (for creator dashboard)"""
    # Count direct subscribers
    direct_count = await db.fan_subscriptions.count_documents({
        "creator_id": creator_id,
        "is_active": True
    })
    
    # Count "all creators" subscribers
    all_count = await db.fan_subscriptions.count_documents({
        "creator_id": None,
        "is_active": True
    })
    
    return {
        "creator_id": creator_id,
        "direct_subscribers": direct_count,
        "total_reach": direct_count + all_count
    }


async def notify_fans_content_live(
    creator_id: str,
    creator_name: str,
    content_title: str,
    watch_url: str,
    thumbnail: str = None
):
    """
    Send notifications to all fans subscribed to this creator.
    Called when creator content goes live.
    Sends BOTH email and push notifications.
    """
    # Get all relevant email subscribers
    subscribers = await db.fan_subscriptions.find({
        "$or": [
            {"creator_id": creator_id, "is_active": True, "notify_live": True},
            {"creator_id": None, "is_active": True, "notify_live": True}
        ]
    }).to_list(1000)
    
    email_notified = 0
    push_notified = 0
    
    # 1. Send email notifications
    if subscribers:
        for sub in subscribers:
            try:
                await send_live_notification_email(
                    to_email=sub["email"],
                    creator_name=creator_name,
                    content_title=content_title,
                    watch_url=watch_url,
                    thumbnail=thumbnail
                )
                email_notified += 1
                
                # Log notification
                await db.notification_log.insert_one({
                    "subscription_id": sub.get("subscription_id"),
                    "email": sub["email"],
                    "creator_id": creator_id,
                    "notification_type": "content_live",
                    "channel": "email",
                    "content_title": content_title,
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "status": "sent"
                })
            except Exception as e:
                logger.error(f"Failed to notify {sub['email']}: {e}")
                await db.notification_log.insert_one({
                    "subscription_id": sub.get("subscription_id"),
                    "email": sub["email"],
                    "creator_id": creator_id,
                    "notification_type": "content_live",
                    "channel": "email",
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "status": "failed",
                    "error": str(e)
                })
    
    # 2. Send push notifications via OneSignal
    try:
        from services.push_notifications import onesignal_service
        
        # Get all push followers for this creator
        followers = await db.creator_followers.find({
            "creator_id": creator_id,
            "is_active": True
        }, {"player_id": 1}).to_list(10000)
        
        if followers:
            player_ids = [f["player_id"] for f in followers if f.get("player_id")]
            
            if player_ids:
                result = await onesignal_service.send_creator_live_notification(
                    creator_id=creator_id,
                    creator_name=creator_name,
                    video_title=content_title,
                    video_thumbnail=thumbnail,
                    follower_player_ids=player_ids
                )
                
                push_notified = len(player_ids)
                
                # Log push notification
                await db.notification_log.insert_one({
                    "creator_id": creator_id,
                    "notification_type": "content_live",
                    "channel": "push",
                    "content_title": content_title,
                    "recipients_count": push_notified,
                    "onesignal_response": result,
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "status": "sent" if result.get("id") else "failed"
                })
                
    except Exception as e:
        logger.error(f"Failed to send push notifications: {e}")
    
    logger.info(f"Notified fans for {creator_name}: {email_notified} emails, {push_notified} push")
    
    return {
        "email_notified": email_notified, 
        "push_notified": push_notified,
        "total_email_subscribers": len(subscribers)
    }


async def send_live_notification_email(
    to_email: str,
    creator_name: str,
    content_title: str,
    watch_url: str,
    thumbnail: str = None
):
    """Send email notification that content is live"""
    resend_key = os.environ.get("RESEND_API_KEY")
    
    if not resend_key:
        print(f"Resend API key not configured - would notify {to_email}")
        return
    
    import httpx
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: white; padding: 0;">
        <div style="background: linear-gradient(135deg, #dc2626, #ec4899); padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">LIVE NOW!</h1>
        </div>
        
        <div style="padding: 30px;">
            {f'<img src="{thumbnail}" style="width: 100%; border-radius: 10px; margin-bottom: 20px;">' if thumbnail else ''}
            
            <h2 style="margin: 0 0 10px 0; color: white;">{content_title}</h2>
            <p style="color: #a1a1aa; margin: 0 0 20px 0;">by {creator_name}</p>
            
            <p style="color: #d4d4d8; line-height: 1.6;">
                Your favorite creator is LIVE on ZTVLIVE! Don't miss out - tune in now!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{watch_url}" 
                   style="background: linear-gradient(135deg, #dc2626, #ec4899); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 30px; 
                          font-weight: bold;
                          font-size: 18px;
                          display: inline-block;">
                    WATCH LIVE
                </a>
            </div>
        </div>
        
        <div style="background: #1a1a1a; padding: 20px; text-align: center; border-top: 1px solid #333;">
            <p style="color: #666; font-size: 12px; margin: 0;">
                You received this because you subscribed to notifications on ZTVLIVE.<br>
                <a href="https://www.ztvlivestream.com/unsubscribe?email={to_email}" style="color: #888;">Unsubscribe</a>
            </p>
        </div>
    </div>
    """
    
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": "ZTVLIVE <live@ztvlivestream.com>",
                "to": [to_email],
                "subject": f"🔴 LIVE NOW: {content_title} by {creator_name}",
                "html": html_content
            },
            timeout=10.0
        )


async def notify_fans_content_scheduled(
    creator_id: str,
    creator_name: str,
    content_title: str,
    schedule_time: str,
    share_url: str
):
    """
    Send notifications to fans when new content is scheduled.
    """
    subscribers = await db.fan_subscriptions.find({
        "$or": [
            {"creator_id": creator_id, "is_active": True, "notify_scheduled": True},
            {"creator_id": None, "is_active": True, "notify_scheduled": True}
        ]
    }).to_list(1000)
    
    notified_count = 0
    
    for sub in subscribers:
        try:
            await send_scheduled_notification_email(
                to_email=sub["email"],
                creator_name=creator_name,
                content_title=content_title,
                schedule_time=schedule_time,
                share_url=share_url
            )
            notified_count += 1
        except Exception as e:
            print(f"Failed to notify {sub['email']}: {e}")
    
    return {"notified": notified_count}


async def send_scheduled_notification_email(
    to_email: str,
    creator_name: str,
    content_title: str,
    schedule_time: str,
    share_url: str
):
    """Send email notification about scheduled content"""
    resend_key = os.environ.get("RESEND_API_KEY")
    
    if not resend_key:
        print(f"Resend API key not configured - would notify {to_email}")
        return
    
    import httpx
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: white;">
        <div style="background: linear-gradient(135deg, #7c3aed, #3b82f6); padding: 20px; text-align: center;">
            <h1 style="margin: 0;">COMING SOON</h1>
        </div>
        
        <div style="padding: 30px;">
            <h2 style="margin: 0 0 10px 0;">{content_title}</h2>
            <p style="color: #a1a1aa;">by {creator_name}</p>
            
            <div style="background: #1a1a1a; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <p style="margin: 0; color: #a1a1aa;">Scheduled for:</p>
                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold;">{schedule_time}</p>
            </div>
            
            <p style="color: #d4d4d8;">
                Mark your calendar! Your favorite creator has new content coming to ZTVLIVE.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{share_url}" 
                   style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 20px; font-weight: bold;">
                    Set Reminder
                </a>
            </div>
        </div>
    </div>
    """
    
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": "ZTVLIVE <notifications@ztvlivestream.com>",
                "to": [to_email],
                "subject": f"📅 Coming Soon: {content_title} by {creator_name}",
                "html": html_content
            },
            timeout=10.0
        )
