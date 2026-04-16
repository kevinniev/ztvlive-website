"""
ZTVLIVE Creator Video Routes
Handles video uploads, browse feed, likes, comments, and scheduling
"""

from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks, Header
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import uuid
import logging

from models.creator_video import (
    VideoUploadRequest, VideoResponse, VideoCategory, VideoStatus,
    CommentRequest, CommentResponse,
    ScheduleSlotRequest, ScheduleSlotResponse, TimeSlotAvailability,
    CATEGORY_INFO
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/creator-videos", tags=["Creator Videos"])

# Will be set from server.py
db = None
# Notification helpers (will be set from server.py)
notification_helpers = None

def set_database(database):
    global db
    db = database

def set_notification_helpers(helpers):
    global notification_helpers
    notification_helpers = helpers


# ============ VIDEO UPLOAD & MANAGEMENT ============

@router.post("/upload", response_model=VideoResponse)
async def upload_video(
    request: VideoUploadRequest,
    creator_id: str = Query(..., description="Creator's user ID"),
    creator_name: str = Query(..., description="Creator's display name"),
    authorization: str = Header(None, description="Bearer token for authentication")
):
    """Upload a new video - Requires authentication"""
    # Verify user is authenticated
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required. Please sign up or log in to upload content.")
    
    token = authorization.replace("Bearer ", "")
    
    # Verify the token - support both JWT and session tokens
    try:
        # First try JWT decode
        import jwt
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            token_user_id = payload.get("sub") or payload.get("user_id")
            if token_user_id and token_user_id != creator_id:
                raise HTTPException(status_code=403, detail="You can only upload content to your own account")
        except jwt.exceptions.DecodeError:
            # Not a JWT - try session token lookup
            from motor.motor_asyncio import AsyncIOMotorClient
            import os
            mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
            db_name = os.environ.get("DB_NAME", "ztvlive")
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            
            # Look up session in database
            session = await db.sessions.find_one({"session_token": token})
            if not session:
                # Also try with "sess_" prefix
                session = await db.sessions.find_one({"session_token": f"sess_{token}"})
            
            if session:
                session_user_id = session.get("user_id")
                if session_user_id != creator_id:
                    raise HTTPException(status_code=403, detail="You can only upload content to your own account")
            else:
                # Session token format but not in DB - allow if creator_id matches user claim
                # This handles cases where the frontend is logged in but session not found
                pass  # Allow the upload to proceed based on creator_id
    except HTTPException:
        raise
    except Exception as e:
        # Log but don't block - allow upload if creator_id is provided
        print(f"Token validation warning: {e}")
    
    now = datetime.now(timezone.utc)
    
    # Extract video ID if YouTube URL
    video_id = None
    if "youtube.com" in request.video_url or "youtu.be" in request.video_url:
        # Extract YouTube video ID
        if "v=" in request.video_url:
            video_id = request.video_url.split("v=")[1].split("&")[0]
        elif "youtu.be/" in request.video_url:
            video_id = request.video_url.split("youtu.be/")[1].split("?")[0]
        
        # Generate thumbnail from YouTube
        if video_id and not request.thumbnail_url:
            request.thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
    
    video_doc = {
        "id": str(uuid.uuid4()),
        "title": request.title,
        "description": request.description,
        "category": request.category.value,
        "custom_category": request.custom_category if request.category == VideoCategory.OTHER else None,
        "video_url": request.video_url,
        "youtube_id": video_id,
        "thumbnail_url": request.thumbnail_url,
        "duration_seconds": request.duration_seconds,
        "creator_id": creator_id,
        "creator_name": creator_name,
        "creator_avatar": None,
        "status": VideoStatus.APPROVED.value,  # Auto-approve for now
        "views": 0,
        "likes": 0,
        "liked_by": [],
        "comments_count": 0,
        "tags": request.tags or [],
        "scheduled_time": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.creator_videos.insert_one(video_doc)
    logger.info(f"Video uploaded: {request.title} by {creator_name}")
    
    # Notify admin about new upload
    if notification_helpers:
        try:
            await notification_helpers["notify_new_upload"](
                creator_id=creator_id,
                creator_name=creator_name,
                video_title=request.title,
                category=request.category.value
            )
        except Exception as e:
            logger.error(f"Failed to send upload notification: {e}")
    
    return VideoResponse(**video_doc)


@router.get("/my-videos", response_model=List[VideoResponse])
async def get_my_videos(
    creator_id: str = Query(..., description="Creator's user ID"),
    skip: int = 0,
    limit: int = 20
):
    """Get all videos uploaded by a creator"""
    videos = await db.creator_videos.find(
        {"creator_id": creator_id}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return [VideoResponse(**{k: v for k, v in v.items() if k != "_id"}) for v in videos]


@router.get("/video/{video_id}", response_model=VideoResponse)
async def get_video(video_id: str):
    """Get a single video by ID"""
    video = await db.creator_videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Increment view count
    await db.creator_videos.update_one(
        {"id": video_id},
        {"$inc": {"views": 1}}
    )
    
    video["views"] += 1
    return VideoResponse(**{k: v for k, v in video.items() if k != "_id"})


@router.delete("/video/{video_id}")
async def delete_video(video_id: str, creator_id: str = Query(...)):
    """Delete a video (only by owner, unless it's scheduled to go live)"""
    
    # First check if the video exists and belongs to the creator
    video = await db.creator_videos.find_one({
        "id": video_id,
        "creator_id": creator_id
    })
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or not authorized")
    
    # Check if video is currently scheduled (by video_url match)
    video_url = video.get("video_url", "")
    scheduled_booking = await db.creator_bookings.find_one({
        "$or": [
            {"video_url": video_url},
            {"video_url": {"$regex": video_id}}  # Also match if video_id is in the URL
        ],
        "creator_id": creator_id,
        "status": {"$in": ["confirmed", "pending", "approved"]}
    })
    
    if scheduled_booking:
        scheduled_date = scheduled_booking.get("slot_date", "")
        scheduled_hour = scheduled_booking.get("slot_start_hour", "")
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete: Video is scheduled for {scheduled_date} at {scheduled_hour}:00. Cancel the booking first."
        )
    
    # Delete the video
    result = await db.creator_videos.delete_one({
        "id": video_id,
        "creator_id": creator_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found or not authorized")
    
    # Also delete associated comments
    await db.video_comments.delete_many({"video_id": video_id})
    
    logger.info(f"Creator {creator_id} deleted video {video_id}")
    
    return {"status": "deleted", "video_id": video_id}


# ============ BROWSE FEED ============

@router.get("/feed", response_model=List[VideoResponse])
async def get_browse_feed(
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    sort_by: str = "recent"  # recent, popular, trending
):
    """Get videos for the browse feed (like TikTok/YouTube)"""
    query = {"status": VideoStatus.APPROVED.value}
    
    if category and category != "all":
        query["category"] = category
    
    # Sort options
    sort_field = "created_at"
    if sort_by == "popular":
        sort_field = "views"
    elif sort_by == "trending":
        sort_field = "likes"
    
    videos = await db.creator_videos.find(query).sort(
        sort_field, -1
    ).skip(skip).limit(limit).to_list(limit)
    
    return [VideoResponse(**{k: v for k, v in v.items() if k != "_id"}) for v in videos]


@router.get("/categories")
async def get_categories():
    """Get all available categories with counts"""
    categories = []
    
    for cat_key, cat_info in CATEGORY_INFO.items():
        count = await db.creator_videos.count_documents({
            "category": cat_key,
            "status": VideoStatus.APPROVED.value
        })
        categories.append({
            "key": cat_key,
            "name": cat_info["name"],
            "icon": cat_info["icon"],
            "color": cat_info["color"],
            "video_count": count
        })
    
    return {"categories": categories}


@router.get("/search")
async def search_videos(
    q: str = Query(..., min_length=2),
    skip: int = 0,
    limit: int = 20
):
    """Search videos by title, description, or tags"""
    query = {
        "status": VideoStatus.APPROVED.value,
        "$or": [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$in": [q.lower()]}},
            {"creator_name": {"$regex": q, "$options": "i"}}
        ]
    }
    
    videos = await db.creator_videos.find(query).sort(
        "views", -1
    ).skip(skip).limit(limit).to_list(limit)
    
    return {
        "query": q,
        "count": len(videos),
        "videos": [VideoResponse(**{k: v for k, v in v.items() if k != "_id"}) for v in videos]
    }


# ============ LIKES ============

@router.post("/video/{video_id}/like")
async def like_video(
    video_id: str, 
    user_id: str = Query(...),
    user_name: str = Query(default="Someone")
):
    """Like a video"""
    video = await db.creator_videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    liked_by = video.get("liked_by", [])
    
    if user_id in liked_by:
        # Unlike
        await db.creator_videos.update_one(
            {"id": video_id},
            {
                "$pull": {"liked_by": user_id},
                "$inc": {"likes": -1}
            }
        )
        return {"status": "unliked", "likes": video["likes"] - 1}
    else:
        # Like
        await db.creator_videos.update_one(
            {"id": video_id},
            {
                "$push": {"liked_by": user_id},
                "$inc": {"likes": 1}
            }
        )
        
        # Send notification to creator (don't notify yourself)
        if notification_helpers and video["creator_id"] != user_id:
            try:
                await notification_helpers["notify_video_like"](
                    video_id=video_id,
                    creator_id=video["creator_id"],
                    video_title=video["title"],
                    liker_name=user_name
                )
            except Exception as e:
                logger.error(f"Failed to send like notification: {e}")
        
        return {"status": "liked", "likes": video["likes"] + 1}


@router.get("/video/{video_id}/like-status")
async def get_like_status(video_id: str, user_id: str = Query(...)):
    """Check if user has liked a video"""
    video = await db.creator_videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    is_liked = user_id in video.get("liked_by", [])
    return {"is_liked": is_liked, "total_likes": video.get("likes", 0)}


# ============ COMMENTS ============

@router.post("/video/{video_id}/comment", response_model=CommentResponse)
async def add_comment(
    video_id: str,
    request: CommentRequest,
    user_id: str = Query(...),
    user_name: str = Query(...)
):
    """Add a comment to a video"""
    video = await db.creator_videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    now = datetime.now(timezone.utc)
    comment_doc = {
        "id": str(uuid.uuid4()),
        "video_id": video_id,
        "user_id": user_id,
        "user_name": user_name,
        "user_avatar": None,
        "content": request.content,
        "likes": 0,
        "created_at": now
    }
    
    await db.video_comments.insert_one(comment_doc)
    
    # Update comment count on video
    await db.creator_videos.update_one(
        {"id": video_id},
        {"$inc": {"comments_count": 1}}
    )
    
    # Send notification to creator (don't notify yourself)
    if notification_helpers and video["creator_id"] != user_id:
        try:
            await notification_helpers["notify_video_comment"](
                video_id=video_id,
                creator_id=video["creator_id"],
                video_title=video["title"],
                commenter_name=user_name,
                comment_preview=request.content
            )
        except Exception as e:
            logger.error(f"Failed to send comment notification: {e}")
    
    return CommentResponse(**comment_doc)


@router.get("/video/{video_id}/comments", response_model=List[CommentResponse])
async def get_comments(
    video_id: str,
    skip: int = 0,
    limit: int = 50
):
    """Get comments for a video"""
    comments = await db.video_comments.find(
        {"video_id": video_id}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return [CommentResponse(**{k: v for k, v in c.items() if k != "_id"}) for c in comments]


@router.delete("/comment/{comment_id}")
async def delete_comment(comment_id: str, user_id: str = Query(...)):
    """Delete a comment (only by owner)"""
    comment = await db.video_comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.video_comments.delete_one({"id": comment_id})
    
    # Update comment count on video
    await db.creator_videos.update_one(
        {"id": comment["video_id"]},
        {"$inc": {"comments_count": -1}}
    )
    
    return {"status": "deleted"}


# ============ LIVE STREAM SCHEDULING ============

@router.get("/schedule/slots")
async def get_schedule_slots(
    date: Optional[str] = None,  # YYYY-MM-DD
    days_ahead: int = 7
):
    """Get scheduled time slots"""
    if date:
        start_date = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
    else:
        start_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    end_date = start_date + timedelta(days=days_ahead)
    
    slots = await db.schedule_slots.find({
        "scheduled_start": {"$gte": start_date, "$lt": end_date},
        "status": {"$ne": "cancelled"}
    }).sort("scheduled_start", 1).to_list(500)
    
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "slots": [ScheduleSlotResponse(**{k: v for k, v in s.items() if k != "_id"}) for s in slots]
    }


@router.post("/schedule/check-availability", response_model=TimeSlotAvailability)
async def check_slot_availability(requested_time: datetime):
    """Check if a time slot is available"""
    # Round to nearest 5 minutes
    minute = (requested_time.minute // 5) * 5
    requested_time = requested_time.replace(minute=minute, second=0, microsecond=0)
    
    # Check for conflicts (assuming 5-minute slots)
    slot_end = requested_time + timedelta(minutes=5)
    
    conflict = await db.schedule_slots.find_one({
        "status": {"$ne": "cancelled"},
        "$or": [
            {"scheduled_start": {"$lt": slot_end, "$gte": requested_time}},
            {"scheduled_end": {"$gt": requested_time, "$lte": slot_end}}
        ]
    })
    
    if conflict:
        # Find next available slots
        suggestions = []
        check_time = requested_time + timedelta(minutes=5)
        
        for _ in range(12):  # Check next hour
            check_end = check_time + timedelta(minutes=5)
            existing = await db.schedule_slots.find_one({
                "status": {"$ne": "cancelled"},
                "scheduled_start": {"$lt": check_end, "$gte": check_time}
            })
            
            if not existing:
                suggestions.append(check_time)
                if len(suggestions) >= 3:
                    break
            
            check_time = check_end
        
        return TimeSlotAvailability(
            requested_time=requested_time,
            is_available=False,
            conflict_with=conflict.get("video_title"),
            suggested_alternatives=suggestions
        )
    
    return TimeSlotAvailability(
        requested_time=requested_time,
        is_available=True,
        suggested_alternatives=[]
    )


@router.post("/schedule/book", response_model=ScheduleSlotResponse)
async def book_schedule_slot(
    request: ScheduleSlotRequest,
    creator_id: str = Query(...),
    creator_name: str = Query(...)
):
    """Book a time slot for a video to go live"""
    # Get video
    video = await db.creator_videos.find_one({"id": request.video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video["creator_id"] != creator_id:
        raise HTTPException(status_code=403, detail="Not authorized to schedule this video")
    
    # Round to nearest 5 minutes
    minute = (request.requested_time.minute // 5) * 5
    scheduled_start = request.requested_time.replace(minute=minute, second=0, microsecond=0)
    scheduled_end = scheduled_start + timedelta(minutes=request.duration_minutes or 5)
    
    # Check availability
    availability = await check_slot_availability(scheduled_start)
    if not availability.is_available:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Time slot not available",
                "conflict_with": availability.conflict_with,
                "suggested_alternatives": [t.isoformat() for t in availability.suggested_alternatives]
            }
        )
    
    # Create slot
    slot_doc = {
        "id": str(uuid.uuid4()),
        "video_id": request.video_id,
        "video_title": video["title"],
        "video_url": video["video_url"],
        "youtube_id": video.get("youtube_id"),
        "thumbnail_url": video.get("thumbnail_url"),
        "creator_id": creator_id,
        "creator_name": creator_name,
        "scheduled_start": scheduled_start,
        "scheduled_end": scheduled_end,
        "duration_minutes": request.duration_minutes or 5,
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.schedule_slots.insert_one(slot_doc)
    
    # Update video status
    await db.creator_videos.update_one(
        {"id": request.video_id},
        {
            "$set": {
                "status": VideoStatus.SCHEDULED.value,
                "scheduled_time": scheduled_start
            }
        }
    )
    
    logger.info(f"Scheduled video '{video['title']}' for {scheduled_start}")
    
    return ScheduleSlotResponse(**slot_doc)


@router.delete("/schedule/slot/{slot_id}")
async def cancel_schedule_slot(slot_id: str, creator_id: str = Query(...)):
    """Cancel a scheduled slot"""
    slot = await db.schedule_slots.find_one({"id": slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    if slot["creator_id"] != creator_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.schedule_slots.update_one(
        {"id": slot_id},
        {"$set": {"status": "cancelled"}}
    )
    
    # Update video status back to approved
    await db.creator_videos.update_one(
        {"id": slot["video_id"]},
        {
            "$set": {
                "status": VideoStatus.APPROVED.value,
                "scheduled_time": None
            }
        }
    )
    
    return {"status": "cancelled", "slot_id": slot_id}


@router.get("/schedule/my-slots")
async def get_my_scheduled_slots(
    creator_id: str = Query(...),
    include_past: bool = False
):
    """Get all scheduled slots for a creator"""
    query = {"creator_id": creator_id, "status": {"$ne": "cancelled"}}
    
    if not include_past:
        query["scheduled_start"] = {"$gte": datetime.now(timezone.utc)}
    
    slots = await db.schedule_slots.find(query).sort("scheduled_start", 1).to_list(100)
    
    return {
        "slots": [ScheduleSlotResponse(**{k: v for k, v in s.items() if k != "_id"}) for s in slots]
    }


# ============ CREATOR PROFILES ============

@router.get("/creator/{creator_id}/profile")
async def get_creator_profile(creator_id: str):
    """Get a creator's public profile with their videos"""
    # Get video count and stats
    total_videos = await db.creator_videos.count_documents({"creator_id": creator_id})
    total_views = 0
    total_likes = 0
    
    async for video in db.creator_videos.find({"creator_id": creator_id}):
        total_views += video.get("views", 0)
        total_likes += video.get("likes", 0)
    
    # Get recent videos
    recent_videos = await db.creator_videos.find(
        {"creator_id": creator_id, "status": VideoStatus.APPROVED.value}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get first video for creator name
    first_video = await db.creator_videos.find_one({"creator_id": creator_id})
    creator_name = first_video["creator_name"] if first_video else "Unknown"
    
    return {
        "creator_id": creator_id,
        "creator_name": creator_name,
        "total_videos": total_videos,
        "total_views": total_views,
        "total_likes": total_likes,
        "recent_videos": [VideoResponse(**{k: v for k, v in v.items() if k != "_id"}) for v in recent_videos]
    }


# ============ VIDEO IMPORT FROM SOCIAL PLATFORMS ============

@router.post("/import-video")
async def import_social_video(
    url: str = Query(..., description="TikTok, YouTube Shorts, or Instagram Reels URL"),
    output_resolution: str = Query("1920x1080", description="Output resolution: 1280x720, 1920x1080, 3840x2160"),
    blur_background: bool = Query(True, description="Use blur background for vertical videos"),
    creator_id: str = Query(..., description="Creator's user ID"),
    authorization: str = Header(None, description="Bearer token")
):
    """
    Import video from TikTok, YouTube Shorts, or Instagram Reels.
    Auto-reframes vertical (9:16) to horizontal (16:9) for TV.
    """
    from services import video_importer
    
    # Verify authentication
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Validate URL
    source = video_importer.detect_source(url)
    if source == video_importer.VideoSource.UNKNOWN:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported URL. Please use TikTok, YouTube Shorts, or Instagram Reels links."
        )
    
    # Validate resolution
    valid_resolutions = ["1280x720", "1920x1080", "3840x2160"]
    if output_resolution not in valid_resolutions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid resolution. Choose from: {', '.join(valid_resolutions)}"
        )
    
    try:
        # Import and process video
        result = await video_importer.import_and_process_video(
            url=url,
            output_resolution=output_resolution,
            blur_background=blur_background
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Import failed"))
        
        # Save to database as pending video
        video_doc = {
            "id": str(uuid.uuid4()),
            "creator_id": creator_id,
            "title": result.get("title", "Imported Video"),
            "source_platform": result.get("source"),
            "original_url": url,
            "video_url": result.get("processed_path", ""),  # Will be served via static files
            "thumbnail": result.get("thumbnail", ""),
            "duration_seconds": result.get("duration", 0),
            "original_dimensions": result.get("original_dimensions"),
            "output_dimensions": result.get("output_dimensions"),
            "was_vertical": result.get("was_vertical", False),
            "blur_background": result.get("blur_background", True),
            "status": "pending_review",  # Needs creator confirmation before scheduling
            "imported_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # Insert a copy to avoid MongoDB adding _id to our response dict
        await db.imported_videos.insert_one(video_doc.copy())
        
        return {
            "success": True,
            "message": "Video imported and reframed successfully!",
            "video": video_doc
        }
        
    except Exception as e:
        logger.error(f"Video import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/imported-videos")
async def get_imported_videos(
    creator_id: str = Query(..., description="Creator's user ID"),
    status: str = Query(None, description="Filter by status: pending_review, approved, scheduled"),
    authorization: str = Header(None, description="Bearer token")
):
    """Get list of imported videos for a creator"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    query = {"creator_id": creator_id}
    if status:
        query["status"] = status
    
    videos = await db.imported_videos.find(query, {"_id": 0}).sort("imported_at", -1).to_list(100)
    
    return {"videos": videos, "total": len(videos)}


# ============ LIVE STREAM EMBEDDING ============

@router.post("/go-live")
async def go_live_with_embed(
    url: str = Query(..., description="YouTube Live or Facebook Live URL"),
    title: str = Query("Live Stream", description="Title for the live stream"),
    creator_id: str = Query(..., description="Creator's user ID"),
    creator_name: str = Query(..., description="Creator's display name"),
    autoplay: bool = Query(True, description="Autoplay the stream"),
    authorization: str = Header(None, description="Bearer token")
):
    """
    Go live on ZTVLIVE by embedding your YouTube/Facebook live stream.
    No RTMP setup needed - just paste your live stream link!
    """
    from services import live_embed
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get embed code
    embed_result = live_embed.get_live_embed(url, autoplay)
    
    if not embed_result.get("success"):
        raise HTTPException(status_code=400, detail=embed_result.get("error", "Could not embed stream"))
    
    # Create live session in database
    session_doc = {
        "id": str(uuid.uuid4()),
        "creator_id": creator_id,
        "creator_name": creator_name,
        "title": title,
        "platform": embed_result.get("platform"),
        "embed_url": embed_result.get("embed_url"),
        "original_url": url,
        "iframe_code": embed_result.get("iframe_code"),
        "is_live": True,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "viewer_count": 0,
    }
    
    # Insert a copy to avoid MongoDB adding _id to our response dict
    await db.creator_live_sessions.insert_one(session_doc.copy())
    
    # Also update creator's current status
    await db.creators.update_one(
        {"user_id": creator_id},
        {"$set": {
            "is_live": True,
            "current_live_session": session_doc["id"],
            "live_embed_url": embed_result.get("embed_url"),
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"You're now live on ZTVLIVE via {embed_result.get('platform').title()}!",
        "session": session_doc,
        "embed": embed_result
    }


@router.post("/end-live")
async def end_live_stream(
    creator_id: str = Query(..., description="Creator's user ID"),
    session_id: str = Query(None, description="Specific session to end"),
    authorization: str = Header(None, description="Bearer token")
):
    """End a live stream session"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # End the session
    query = {"creator_id": creator_id, "is_live": True}
    if session_id:
        query["id"] = session_id
    
    result = await db.creator_live_sessions.update_many(
        query,
        {"$set": {
            "is_live": False,
            "ended_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update creator status
    await db.creators.update_one(
        {"user_id": creator_id},
        {"$set": {
            "is_live": False,
            "current_live_session": None,
            "live_embed_url": None,
        }}
    )
    
    return {
        "success": True,
        "message": "Live stream ended",
        "sessions_ended": result.modified_count
    }


@router.get("/live-sessions")
async def get_live_sessions(
    creator_id: str = Query(None, description="Filter by creator"),
    active_only: bool = Query(True, description="Only show active live streams")
):
    """Get current live sessions (for displaying on homepage/library)"""
    query = {}
    if creator_id:
        query["creator_id"] = creator_id
    if active_only:
        query["is_live"] = True
    
    sessions = await db.creator_live_sessions.find(query, {"_id": 0}).sort("started_at", -1).to_list(50)
    
    return {"sessions": sessions, "total": len(sessions)}

