"""
ZTVLIVE Admin Notifications System
Real-time notifications for admins about content submissions, bookings, etc.
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone
import asyncio
import json
import uuid

router = APIRouter(prefix="/admin-notifications", tags=["Admin Notifications"])

# In-memory store for notifications and WebSocket connections
admin_notifications: List[dict] = []
admin_connections: Dict[str, WebSocket] = {}

class NotificationCreate(BaseModel):
    type: str  # content_submission, booking_request, new_user, etc.
    title: str
    message: str
    data: Optional[dict] = None
    priority: str = "normal"  # low, normal, high, urgent

class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    data: Optional[dict]
    priority: str
    read: bool
    created_at: str


async def broadcast_to_admins(notification: dict):
    """Broadcast notification to all connected admin WebSockets"""
    disconnected = []
    for admin_id, ws in admin_connections.items():
        try:
            await ws.send_json(notification)
        except Exception:
            disconnected.append(admin_id)
    
    # Clean up disconnected
    for admin_id in disconnected:
        del admin_connections[admin_id]


async def create_notification(
    notification_type: str,
    title: str,
    message: str,
    data: dict = None,
    priority: str = "normal"
) -> dict:
    """Create and broadcast a new admin notification"""
    notification = {
        "id": str(uuid.uuid4())[:8],
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "priority": priority,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Store notification (keep last 100)
    admin_notifications.insert(0, notification)
    if len(admin_notifications) > 100:
        admin_notifications.pop()
    
    # Broadcast to connected admins
    await broadcast_to_admins({
        "type": "new_notification",
        "notification": notification
    })
    
    return notification


@router.websocket("/ws/{admin_id}")
async def admin_notification_websocket(websocket: WebSocket, admin_id: str):
    """WebSocket connection for real-time admin notifications"""
    await websocket.accept()
    admin_connections[admin_id] = websocket
    
    # Send existing unread notifications
    unread = [n for n in admin_notifications if not n["read"]]
    await websocket.send_json({
        "type": "initial_notifications",
        "notifications": unread[:20],
        "unread_count": len(unread)
    })
    
    try:
        while True:
            # Keep connection alive and listen for mark-as-read
            data = await websocket.receive_json()
            
            if data.get("action") == "mark_read":
                notification_id = data.get("notification_id")
                for n in admin_notifications:
                    if n["id"] == notification_id:
                        n["read"] = True
                        break
            
            elif data.get("action") == "mark_all_read":
                for n in admin_notifications:
                    n["read"] = True
                    
    except WebSocketDisconnect:
        if admin_id in admin_connections:
            del admin_connections[admin_id]


@router.get("/all")
async def get_all_notifications(
    request: Request,
    limit: int = 50,
    unread_only: bool = False
):
    """Get all admin notifications"""
    # In production, verify admin role
    notifications = admin_notifications
    
    if unread_only:
        notifications = [n for n in notifications if not n["read"]]
    
    return {
        "notifications": notifications[:limit],
        "total": len(admin_notifications),
        "unread_count": len([n for n in admin_notifications if not n["read"]])
    }


@router.post("/mark-read/{notification_id}")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    for n in admin_notifications:
        if n["id"] == notification_id:
            n["read"] = True
            return {"success": True}
    
    raise HTTPException(status_code=404, detail="Notification not found")


@router.post("/mark-all-read")
async def mark_all_read():
    """Mark all notifications as read"""
    for n in admin_notifications:
        n["read"] = True
    
    return {"success": True, "marked": len(admin_notifications)}


@router.post("/create")
async def create_notification_endpoint(notification: NotificationCreate):
    """Create a new notification (for internal use)"""
    result = await create_notification(
        notification.type,
        notification.title,
        notification.message,
        notification.data,
        notification.priority
    )
    return result


# Convenience functions for specific notification types
async def notify_content_submission(
    creator_name: str,
    content_title: str,
    content_type: str,
    booking_id: str
):
    """Notify admins about new content submission"""
    return await create_notification(
        notification_type="content_submission",
        title="New Content Submitted",
        message=f"{creator_name} submitted '{content_title}' ({content_type})",
        data={
            "creator_name": creator_name,
            "content_title": content_title,
            "content_type": content_type,
            "booking_id": booking_id,
            "action_url": f"/admin/dashboard#bookings"  # Link to admin dashboard bookings section
        },
        priority="high"
    )


async def notify_booking_request(
    creator_name: str,
    slot_date: str,
    slot_time: str,
    booking_id: str
):
    """Notify admins about new booking request"""
    return await create_notification(
        notification_type="booking_request",
        title="New Slot Booking",
        message=f"{creator_name} requested slot on {slot_date} at {slot_time}",
        data={
            "creator_name": creator_name,
            "slot_date": slot_date,
            "slot_time": slot_time,
            "booking_id": booking_id,
            "action_url": f"/admin/dashboard#bookings"  # Link to admin dashboard bookings section
        },
        priority="high"
    )


async def notify_new_user(email: str, username: str = None):
    """Notify admins about new user registration"""
    return await create_notification(
        notification_type="new_user",
        title="New User Registered",
        message=f"New user: {username or email}",
        data={
            "email": email,
            "username": username
        },
        priority="normal"
    )


async def notify_content_submission_enhanced(
    creator_name: str,
    content_title: str,
    content_type: str,
    booking_id: str,
    slot_date: str,
    slot_time: str,
    status: str,
    copyright_analysis: dict = None
):
    """Enhanced notification for content submission with copyright analysis"""
    risk_level = "unknown"
    if copyright_analysis:
        risk_level = copyright_analysis.get("final_decision", {}).get("risk_level", "unknown")
    
    priority = "urgent" if risk_level == "high" else "high" if status == "pending" else "normal"
    
    title = f"{'⚠️ ' if risk_level == 'high' else ''}New Content: {content_title[:30]}..."
    
    message_parts = [
        f"Creator: {creator_name}",
        f"Scheduled: {slot_date} at {slot_time}",
        f"Status: {status.upper()}",
    ]
    
    if risk_level != "unknown":
        message_parts.append(f"Copyright Risk: {risk_level.upper()}")
    
    return await create_notification(
        notification_type="content_submission",
        title=title,
        message=" | ".join(message_parts),
        data={
            "creator_name": creator_name,
            "content_title": content_title,
            "content_type": content_type,
            "booking_id": booking_id,
            "slot_date": slot_date,
            "slot_time": slot_time,
            "status": status,
            "copyright_risk": risk_level,
            "action_url": f"/admin/dashboard#bookings"  # Link to admin dashboard
        },
        priority=priority
    )


async def send_admin_email_notification(
    creator_name: str,
    content_title: str,
    booking_id: str,
    slot_date: str,
    slot_time: str,
    status: str,
    copyright_risk: str = "unknown"
):
    """Send email notification to admin about new content submission"""
    import os
    
    # Get admin email from environment or use default
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@ztvlivestream.com")
    
    try:
        # Try using Resend if available
        resend_key = os.environ.get("RESEND_API_KEY")
        if resend_key:
            import httpx
            
            subject = f"{'⚠️ ' if copyright_risk == 'high' else ''}New Content Scheduled: {content_title}"
            
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #8B5CF6;">New Content Submission</h2>
                <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 10px;">
                    <p><strong>Creator:</strong> {creator_name}</p>
                    <p><strong>Title:</strong> {content_title}</p>
                    <p><strong>Scheduled:</strong> {slot_date} at {slot_time}</p>
                    <p><strong>Status:</strong> <span style="color: {'#22c55e' if status == 'approved' else '#eab308'}">{status.upper()}</span></p>
                    <p><strong>Copyright Risk:</strong> <span style="color: {'#ef4444' if copyright_risk == 'high' else '#22c55e' if copyright_risk == 'low' else '#eab308'}">{copyright_risk.upper()}</span></p>
                </div>
                <div style="margin-top: 20px;">
                    <a href="https://www.ztvlivestream.com/admin/bookings/{booking_id}" 
                       style="background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                        Review Content
                    </a>
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
                        "to": [admin_email],
                        "subject": subject,
                        "html": html_content
                    },
                    timeout=10.0
                )
            print(f"Admin email sent for booking {booking_id}")
        else:
            print("Resend API key not configured, skipping email notification")
            
    except Exception as e:
        print(f"Failed to send admin email: {e}")
