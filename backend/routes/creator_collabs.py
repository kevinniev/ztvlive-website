"""
ZTVLIVE Creator Collaboration System
Enables creators to collaborate on content with revenue splitting and cross-promotion

Features:
- Invite collaborators by email/username
- Custom revenue split percentages
- Shared video management
- Cross-promotion tools
- Collab analytics
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid
import logging

router = APIRouter(prefix="/collabs", tags=["Creator Collaborations"])
logger = logging.getLogger("creator_collabs")

# Database reference
db = None

def set_db(database):
    global db
    db = database


# ============ MODELS ============

class CollabStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    COMPLETED = "completed"

class CollabRole(str, Enum):
    OWNER = "owner"
    COLLABORATOR = "collaborator"
    GUEST = "guest"

class CollabInviteRequest(BaseModel):
    video_id: str
    invitee_email: Optional[str] = None
    invitee_username: Optional[str] = None
    revenue_split: float = Field(ge=0, le=100, default=50)  # Percentage for invitee
    message: Optional[str] = None
    cross_promote: bool = True

class CollabResponseRequest(BaseModel):
    action: str  # "accept" or "decline"
    message: Optional[str] = None

class UpdateRevenueSplitRequest(BaseModel):
    new_split: float = Field(ge=0, le=100)


# ============ HELPER FUNCTIONS ============

async def get_current_user(request):
    """Extract current user from request"""
    from routes.creator_scheduling import get_current_user as _get_user
    return await _get_user(request)

async def get_user_by_email(email: str):
    """Find user by email"""
    return await db.users.find_one({"email": email.lower()}, {"_id": 0, "password": 0})

async def get_user_by_username(username: str):
    """Find user by username"""
    return await db.users.find_one(
        {"$or": [{"username": username}, {"name": username}]},
        {"_id": 0, "password": 0}
    )


# ============ API ENDPOINTS ============

@router.post("/invite")
async def create_collab_invite(request: Request, invite: CollabInviteRequest):
    """
    Invite another creator to collaborate on a video
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    owner_id = str(user.get("_id") or user.get("user_id"))
    owner_name = user.get("username") or user.get("name") or user.get("email", "").split("@")[0]
    owner_email = user.get("email")
    
    # Find the video
    video = await db.uploads.find_one({"id": invite.video_id}, {"_id": 0})
    if not video:
        video = await db.creator_videos.find_one({"id": invite.video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Verify ownership
    if video.get("creator_id") != owner_id:
        raise HTTPException(status_code=403, detail="You can only invite collaborators to your own videos")
    
    # Find invitee
    invitee = None
    if invite.invitee_email:
        invitee = await get_user_by_email(invite.invitee_email)
    elif invite.invitee_username:
        invitee = await get_user_by_username(invite.invitee_username)
    
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")
    
    invitee_id = str(invitee.get("_id") or invitee.get("user_id"))
    invitee_name = invitee.get("username") or invitee.get("name") or invitee.get("email", "").split("@")[0]
    invitee_email = invitee.get("email")
    
    # Check for existing invite
    existing = await db.collabs.find_one({
        "video_id": invite.video_id,
        "invitee_id": invitee_id,
        "status": {"$in": ["pending", "accepted"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Collaboration already exists for this video and user")
    
    # Create collab record
    collab_id = str(uuid.uuid4())
    collab = {
        "collab_id": collab_id,
        "video_id": invite.video_id,
        "video_title": video.get("title", "Untitled"),
        "video_thumbnail": video.get("thumbnail_url"),
        
        # Owner info
        "owner_id": owner_id,
        "owner_name": owner_name,
        "owner_email": owner_email,
        "owner_revenue_split": 100 - invite.revenue_split,
        
        # Invitee info
        "invitee_id": invitee_id,
        "invitee_name": invitee_name,
        "invitee_email": invitee_email,
        "invitee_revenue_split": invite.revenue_split,
        
        # Collab details
        "status": CollabStatus.PENDING.value,
        "message": invite.message,
        "cross_promote": invite.cross_promote,
        
        # Analytics
        "total_views": 0,
        "total_revenue": 0,
        "owner_earnings": 0,
        "invitee_earnings": 0,
        
        # Timestamps
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "accepted_at": None,
        "completed_at": None
    }
    
    await db.collabs.insert_one(collab)
    
    # Create notification for invitee
    notification = {
        "notification_id": str(uuid.uuid4()),
        "user_id": invitee_id,
        "type": "collab_invite",
        "title": "New Collaboration Invite!",
        "message": f"{owner_name} wants to collaborate with you on \"{video.get('title', 'a video')}\"",
        "collab_id": collab_id,
        "actions": ["accept", "decline"],
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_notifications.insert_one(notification)
    
    # Send push notification to invitee
    try:
        from services.push_notifications import onesignal_service
        
        # Get invitee's player IDs
        invitee_devices = await db.user_devices.find(
            {"user_id": invitee_id},
            {"player_id": 1}
        ).to_list(10)
        
        invitee_player_ids = [d["player_id"] for d in invitee_devices if d.get("player_id")]
        
        if invitee_player_ids:
            await onesignal_service.send_collab_invite_notification(
                invitee_player_ids=invitee_player_ids,
                owner_name=owner_name,
                video_title=video.get("title", "a video"),
                collab_id=collab_id,
                revenue_split=invite.revenue_split
            )
            logger.info(f"Push notification sent for collab invite {collab_id}")
    except Exception as e:
        logger.error(f"Failed to send collab invite push notification: {e}")
    
    logger.info(f"Collab invite created: {collab_id} from {owner_name} to {invitee_name}")
    
    return {
        "collab_id": collab_id,
        "status": "pending",
        "message": f"Invitation sent to {invitee_name}",
        "revenue_split": {
            "owner": 100 - invite.revenue_split,
            "collaborator": invite.revenue_split
        }
    }


@router.post("/{collab_id}/respond")
async def respond_to_collab(request: Request, collab_id: str, response: CollabResponseRequest):
    """
    Accept or decline a collaboration invite
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    
    collab = await db.collabs.find_one({"collab_id": collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    if collab["invitee_id"] != user_id:
        raise HTTPException(status_code=403, detail="You are not the invitee for this collaboration")
    
    if collab["status"] != CollabStatus.PENDING.value:
        raise HTTPException(status_code=400, detail=f"Cannot respond - collaboration is already {collab['status']}")
    
    new_status = CollabStatus.ACCEPTED if response.action == "accept" else CollabStatus.DECLINED
    
    update_data = {
        "status": new_status.value,
        "response_message": response.message,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if new_status == CollabStatus.ACCEPTED:
        update_data["accepted_at"] = datetime.now(timezone.utc)
        
        # Update video to mark as collab
        await db.uploads.update_one(
            {"id": collab["video_id"]},
            {"$set": {
                "is_collab": True,
                "collab_id": collab_id,
                "collaborators": [collab["owner_id"], collab["invitee_id"]]
            }}
        )
        await db.creator_videos.update_one(
            {"id": collab["video_id"]},
            {"$set": {
                "is_collab": True,
                "collab_id": collab_id,
                "collaborators": [collab["owner_id"], collab["invitee_id"]]
            }}
        )
    
    await db.collabs.update_one(
        {"collab_id": collab_id},
        {"$set": update_data}
    )
    
    # Notify owner
    notification = {
        "notification_id": str(uuid.uuid4()),
        "user_id": collab["owner_id"],
        "type": "collab_response",
        "title": f"Collaboration {'Accepted' if new_status == CollabStatus.ACCEPTED else 'Declined'}",
        "message": f"{collab['invitee_name']} has {response.action}ed your collaboration invite for \"{collab['video_title']}\"",
        "collab_id": collab_id,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_notifications.insert_one(notification)
    
    # Send push notification to owner when accepted
    if new_status == CollabStatus.ACCEPTED:
        try:
            from services.push_notifications import onesignal_service
            
            # Get owner's player IDs
            owner_devices = await db.user_devices.find(
                {"user_id": collab["owner_id"]},
                {"player_id": 1}
            ).to_list(10)
            
            owner_player_ids = [d["player_id"] for d in owner_devices if d.get("player_id")]
            
            if owner_player_ids:
                await onesignal_service.send_collab_accepted_notification(
                    owner_player_ids=owner_player_ids,
                    collaborator_name=collab["invitee_name"],
                    video_title=collab["video_title"],
                    collab_id=collab_id,
                    revenue_split=collab["invitee_revenue_split"]
                )
                logger.info(f"Push notification sent for collab accepted {collab_id}")
        except Exception as e:
            logger.error(f"Failed to send collab accepted push notification: {e}")
    
    return {
        "collab_id": collab_id,
        "status": new_status.value,
        "message": f"Collaboration {response.action}ed"
    }


@router.put("/{collab_id}/revenue-split")
async def update_revenue_split(request: Request, collab_id: str, update: UpdateRevenueSplitRequest):
    """
    Update the revenue split for a collaboration (owner only)
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    
    collab = await db.collabs.find_one({"collab_id": collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    if collab["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the owner can update revenue split")
    
    await db.collabs.update_one(
        {"collab_id": collab_id},
        {"$set": {
            "owner_revenue_split": 100 - update.new_split,
            "invitee_revenue_split": update.new_split,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Notify collaborator
    notification = {
        "notification_id": str(uuid.uuid4()),
        "user_id": collab["invitee_id"],
        "type": "collab_update",
        "title": "Revenue Split Updated",
        "message": f"Revenue split for \"{collab['video_title']}\" has been updated to {update.new_split}% for you",
        "collab_id": collab_id,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_notifications.insert_one(notification)
    
    return {
        "collab_id": collab_id,
        "new_split": {
            "owner": 100 - update.new_split,
            "collaborator": update.new_split
        }
    }


@router.get("/my-collabs")
async def get_my_collaborations(request: Request):
    """
    Get all collaborations for the current user (as owner or collaborator)
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    
    # Get collabs where user is owner
    as_owner = await db.collabs.find(
        {"owner_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get collabs where user is collaborator
    as_collaborator = await db.collabs.find(
        {"invitee_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add role field
    for collab in as_owner:
        collab["my_role"] = "owner"
        collab["my_split"] = collab["owner_revenue_split"]
        collab["my_earnings"] = collab["owner_earnings"]
    
    for collab in as_collaborator:
        collab["my_role"] = "collaborator"
        collab["my_split"] = collab["invitee_revenue_split"]
        collab["my_earnings"] = collab["invitee_earnings"]
    
    # Separate by status
    pending = [c for c in as_collaborator if c["status"] == "pending"]
    active = [c for c in (as_owner + as_collaborator) if c["status"] == "accepted"]
    completed = [c for c in (as_owner + as_collaborator) if c["status"] == "completed"]
    
    # Calculate totals
    total_collab_earnings = sum(c["my_earnings"] for c in active + completed)
    total_collab_views = sum(c["total_views"] for c in active + completed)
    
    return {
        "summary": {
            "total_active": len(active),
            "total_pending": len(pending),
            "total_completed": len(completed),
            "total_earnings": round(total_collab_earnings, 2),
            "total_views": total_collab_views
        },
        "pending_invites": pending,
        "active_collabs": active,
        "completed_collabs": completed[:10]  # Limit completed
    }


@router.get("/{collab_id}")
async def get_collab_details(request: Request, collab_id: str):
    """
    Get detailed information about a collaboration
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    
    collab = await db.collabs.find_one({"collab_id": collab_id}, {"_id": 0})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    # Verify access
    if collab["owner_id"] != user_id and collab["invitee_id"] != user_id:
        raise HTTPException(status_code=403, detail="You don't have access to this collaboration")
    
    # Add computed fields
    collab["my_role"] = "owner" if collab["owner_id"] == user_id else "collaborator"
    collab["my_split"] = collab["owner_revenue_split"] if collab["my_role"] == "owner" else collab["invitee_revenue_split"]
    collab["my_earnings"] = collab["owner_earnings"] if collab["my_role"] == "owner" else collab["invitee_earnings"]
    
    # Get video details
    video = await db.uploads.find_one({"id": collab["video_id"]}, {"_id": 0})
    if not video:
        video = await db.creator_videos.find_one({"id": collab["video_id"]}, {"_id": 0})
    
    collab["video_details"] = video
    
    return collab


@router.get("/{collab_id}/analytics")
async def get_collab_analytics(request: Request, collab_id: str):
    """
    Get detailed analytics for a collaboration
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    
    collab = await db.collabs.find_one({"collab_id": collab_id}, {"_id": 0})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    if collab["owner_id"] != user_id and collab["invitee_id"] != user_id:
        raise HTTPException(status_code=403, detail="You don't have access to this collaboration")
    
    # Get video analytics
    video = await db.uploads.find_one({"id": collab["video_id"]}, {"_id": 0})
    if not video:
        video = await db.creator_videos.find_one({"id": collab["video_id"]}, {"_id": 0})
    
    views = video.get("views", 0) if video else 0
    
    # Calculate earnings based on views
    CPM_RATE = 2.50
    AD_REVENUE_SHARE = 0.70
    total_revenue = (views / 1000) * CPM_RATE * AD_REVENUE_SHARE
    
    owner_earnings = total_revenue * (collab["owner_revenue_split"] / 100)
    invitee_earnings = total_revenue * (collab["invitee_revenue_split"] / 100)
    
    # Update collab with latest analytics
    await db.collabs.update_one(
        {"collab_id": collab_id},
        {"$set": {
            "total_views": views,
            "total_revenue": round(total_revenue, 2),
            "owner_earnings": round(owner_earnings, 2),
            "invitee_earnings": round(invitee_earnings, 2)
        }}
    )
    
    return {
        "collab_id": collab_id,
        "video_title": collab["video_title"],
        "total_views": views,
        "total_revenue": round(total_revenue, 2),
        "earnings_breakdown": {
            "owner": {
                "name": collab["owner_name"],
                "split": collab["owner_revenue_split"],
                "earnings": round(owner_earnings, 2)
            },
            "collaborator": {
                "name": collab["invitee_name"],
                "split": collab["invitee_revenue_split"],
                "earnings": round(invitee_earnings, 2)
            }
        },
        "cross_promotion": {
            "enabled": collab["cross_promote"],
            "reach_multiplier": 1.5 if collab["cross_promote"] else 1.0
        }
    }


@router.delete("/{collab_id}")
async def cancel_collaboration(request: Request, collab_id: str):
    """
    Cancel a collaboration (owner or pending invitee)
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    
    collab = await db.collabs.find_one({"collab_id": collab_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    
    # Check if user can cancel
    can_cancel = (
        collab["owner_id"] == user_id or 
        (collab["invitee_id"] == user_id and collab["status"] == "pending")
    )
    
    if not can_cancel:
        raise HTTPException(status_code=403, detail="You cannot cancel this collaboration")
    
    await db.collabs.update_one(
        {"collab_id": collab_id},
        {"$set": {
            "status": CollabStatus.CANCELLED.value,
            "cancelled_by": user_id,
            "cancelled_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update video
    await db.uploads.update_one(
        {"id": collab["video_id"]},
        {"$set": {"is_collab": False, "collab_id": None, "collaborators": []}}
    )
    await db.creator_videos.update_one(
        {"id": collab["video_id"]},
        {"$set": {"is_collab": False, "collab_id": None, "collaborators": []}}
    )
    
    # Notify the other party
    notify_id = collab["invitee_id"] if collab["owner_id"] == user_id else collab["owner_id"]
    notification = {
        "notification_id": str(uuid.uuid4()),
        "user_id": notify_id,
        "type": "collab_cancelled",
        "title": "Collaboration Cancelled",
        "message": f"The collaboration for \"{collab['video_title']}\" has been cancelled",
        "collab_id": collab_id,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_notifications.insert_one(notification)
    
    return {"message": "Collaboration cancelled", "collab_id": collab_id}


@router.get("/search/creators")
async def search_creators(request: Request, q: str):
    """
    Search for creators to collaborate with
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in")
    
    user_id = str(user.get("_id") or user.get("user_id"))
    
    # Search by username or name
    creators = await db.users.find(
        {
            "$or": [
                {"username": {"$regex": q, "$options": "i"}},
                {"name": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}}
            ],
            "user_id": {"$ne": user_id}  # Exclude self
        },
        {"_id": 0, "password": 0}
    ).limit(10).to_list(10)
    
    # Format response
    results = []
    for creator in creators:
        results.append({
            "user_id": str(creator.get("_id") or creator.get("user_id")),
            "username": creator.get("username") or creator.get("name", "").replace(" ", "_").lower(),
            "name": creator.get("name") or creator.get("username"),
            "profile_pic": creator.get("profile_picture") or creator.get("avatar"),
            "is_verified": creator.get("is_creator_approved", False)
        })
    
    return {"results": results, "count": len(results)}
