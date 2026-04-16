"""
ZTVLIVE YouTube Channel Import Routes
Allows creators to import all videos from their YouTube channels
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Header
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging
import re
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/youtube-import", tags=["YouTube Import"])

# Will be set from server.py
db = None

def set_database(database):
    global db
    db = database


# ============ MODELS ============

class ChannelImportRequest(BaseModel):
    channel_url: str  # YouTube channel URL (@username or channel ID format)
    youtube_api_key: str


class VideoImportItem(BaseModel):
    video_id: str
    title: str
    description: str
    thumbnail_url: str
    published_at: str
    duration: Optional[str] = None
    view_count: int = 0
    like_count: int = 0


class ChannelInfo(BaseModel):
    channel_id: str
    channel_title: str
    description: str
    thumbnail_url: str
    subscriber_count: int = 0
    video_count: int = 0
    custom_url: Optional[str] = None


class ImportJobStatus(BaseModel):
    job_id: str
    status: str  # pending, in_progress, completed, failed
    channel_id: str
    channel_title: str
    total_videos: int
    imported_videos: int
    failed_videos: int
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None


# ============ HELPERS ============

def extract_channel_identifier(url: str) -> tuple:
    """
    Extract channel identifier from various YouTube URL formats
    Returns: (identifier_type, identifier) where type is 'handle', 'channel_id', or 'custom'
    """
    url = url.strip()
    
    # Handle @username format
    handle_match = re.search(r'youtube\.com/@([a-zA-Z0-9_-]+)', url)
    if handle_match:
        return ('handle', handle_match.group(1))
    
    # Handle direct @username
    if url.startswith('@'):
        return ('handle', url[1:])
    
    # Handle channel ID format (UC...)
    channel_id_match = re.search(r'youtube\.com/channel/(UC[a-zA-Z0-9_-]+)', url)
    if channel_id_match:
        return ('channel_id', channel_id_match.group(1))
    
    # Handle /c/ custom URL format
    custom_match = re.search(r'youtube\.com/c/([a-zA-Z0-9_-]+)', url)
    if custom_match:
        return ('custom', custom_match.group(1))
    
    # Handle /user/ format (old style)
    user_match = re.search(r'youtube\.com/user/([a-zA-Z0-9_-]+)', url)
    if user_match:
        return ('user', user_match.group(1))
    
    # If it looks like a channel ID directly
    if url.startswith('UC') and len(url) == 24:
        return ('channel_id', url)
    
    # Assume it's a handle/username if nothing else matches
    return ('handle', url)


async def resolve_channel_id(identifier_type: str, identifier: str, api_key: str) -> str:
    """Resolve various identifiers to a YouTube channel ID"""
    import httpx
    
    base_url = "https://www.googleapis.com/youtube/v3"
    
    if identifier_type == 'channel_id':
        return identifier
    
    async with httpx.AsyncClient() as client:
        if identifier_type == 'handle':
            # Search for the channel by handle
            response = await client.get(
                f"{base_url}/search",
                params={
                    "part": "snippet",
                    "q": f"@{identifier}",
                    "type": "channel",
                    "maxResults": 1,
                    "key": api_key
                }
            )
            data = response.json()
            
            if response.status_code != 200:
                error_msg = data.get('error', {}).get('message', 'Unknown error')
                raise HTTPException(status_code=400, detail=f"YouTube API error: {error_msg}")
            
            if not data.get('items'):
                # Try channels.list with forHandle (newer API)
                response = await client.get(
                    f"{base_url}/channels",
                    params={
                        "part": "id,snippet",
                        "forHandle": identifier,
                        "key": api_key
                    }
                )
                data = response.json()
                
                if data.get('items'):
                    return data['items'][0]['id']
                
                raise HTTPException(status_code=404, detail=f"Channel @{identifier} not found")
            
            return data['items'][0]['snippet']['channelId']
        
        elif identifier_type in ('custom', 'user'):
            # Search for the channel
            response = await client.get(
                f"{base_url}/search",
                params={
                    "part": "snippet",
                    "q": identifier,
                    "type": "channel",
                    "maxResults": 5,
                    "key": api_key
                }
            )
            data = response.json()
            
            if response.status_code != 200:
                error_msg = data.get('error', {}).get('message', 'Unknown error')
                raise HTTPException(status_code=400, detail=f"YouTube API error: {error_msg}")
            
            if not data.get('items'):
                raise HTTPException(status_code=404, detail=f"Channel '{identifier}' not found")
            
            # Return the first match
            return data['items'][0]['snippet']['channelId']
    
    raise HTTPException(status_code=400, detail="Could not resolve channel identifier")


async def get_channel_info(channel_id: str, api_key: str) -> ChannelInfo:
    """Get channel information from YouTube API"""
    import httpx
    
    base_url = "https://www.googleapis.com/youtube/v3"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{base_url}/channels",
            params={
                "part": "snippet,statistics,brandingSettings",
                "id": channel_id,
                "key": api_key
            }
        )
        data = response.json()
        
        if response.status_code != 200:
            error_msg = data.get('error', {}).get('message', 'Unknown error')
            raise HTTPException(status_code=400, detail=f"YouTube API error: {error_msg}")
        
        if not data.get('items'):
            raise HTTPException(status_code=404, detail="Channel not found")
        
        item = data['items'][0]
        snippet = item.get('snippet', {})
        statistics = item.get('statistics', {})
        
        return ChannelInfo(
            channel_id=channel_id,
            channel_title=snippet.get('title', ''),
            description=snippet.get('description', ''),
            thumbnail_url=snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
            subscriber_count=int(statistics.get('subscriberCount', 0)),
            video_count=int(statistics.get('videoCount', 0)),
            custom_url=snippet.get('customUrl')
        )


async def fetch_all_channel_videos(channel_id: str, api_key: str, max_results: int = 500) -> List[VideoImportItem]:
    """Fetch all videos from a YouTube channel using pagination"""
    import httpx
    
    base_url = "https://www.googleapis.com/youtube/v3"
    videos = []
    next_page_token = None
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # First, get the uploads playlist ID
        response = await client.get(
            f"{base_url}/channels",
            params={
                "part": "contentDetails",
                "id": channel_id,
                "key": api_key
            }
        )
        data = response.json()
        
        if response.status_code != 200 or not data.get('items'):
            raise HTTPException(status_code=400, detail="Could not get channel uploads playlist")
        
        uploads_playlist_id = data['items'][0]['contentDetails']['relatedPlaylists']['uploads']
        
        # Fetch videos from the uploads playlist
        while len(videos) < max_results:
            params = {
                "part": "snippet,contentDetails",
                "playlistId": uploads_playlist_id,
                "maxResults": min(50, max_results - len(videos)),  # API max is 50 per request
                "key": api_key
            }
            
            if next_page_token:
                params["pageToken"] = next_page_token
            
            response = await client.get(f"{base_url}/playlistItems", params=params)
            data = response.json()
            
            if response.status_code != 200:
                error_msg = data.get('error', {}).get('message', 'Unknown error')
                logger.error(f"YouTube API error fetching videos: {error_msg}")
                break
            
            items = data.get('items', [])
            if not items:
                break
            
            # Get video IDs for statistics
            video_ids = [item['contentDetails']['videoId'] for item in items]
            
            # Fetch video statistics
            stats_response = await client.get(
                f"{base_url}/videos",
                params={
                    "part": "statistics,contentDetails",
                    "id": ",".join(video_ids),
                    "key": api_key
                }
            )
            stats_data = stats_response.json()
            stats_map = {v['id']: v for v in stats_data.get('items', [])}
            
            for item in items:
                snippet = item['snippet']
                video_id = item['contentDetails']['videoId']
                stats = stats_map.get(video_id, {})
                
                videos.append(VideoImportItem(
                    video_id=video_id,
                    title=snippet.get('title', ''),
                    description=snippet.get('description', '')[:500],  # Truncate long descriptions
                    thumbnail_url=snippet.get('thumbnails', {}).get('maxres', {}).get('url') or 
                                  snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                    published_at=snippet.get('publishedAt', ''),
                    duration=stats.get('contentDetails', {}).get('duration'),
                    view_count=int(stats.get('statistics', {}).get('viewCount', 0)),
                    like_count=int(stats.get('statistics', {}).get('likeCount', 0))
                ))
            
            next_page_token = data.get('nextPageToken')
            if not next_page_token:
                break
    
    return videos


async def import_videos_to_library(
    videos: List[VideoImportItem],
    creator_id: str,
    creator_name: str,
    channel_id: str,
    job_id: str
):
    """Import fetched videos into the creator's library"""
    imported = 0
    failed = 0
    
    for video in videos:
        try:
            # Check if video already exists
            existing = await db.creator_videos.find_one({
                "creator_id": creator_id,
                "youtube_id": video.video_id
            })
            
            if existing:
                # Skip already imported videos
                continue
            
            # Create video document
            video_doc = {
                "id": str(uuid.uuid4()),
                "title": video.title,
                "description": video.description,
                "category": "entertainment",  # Default category
                "video_url": f"https://www.youtube.com/watch?v={video.video_id}",
                "youtube_id": video.video_id,
                "thumbnail_url": video.thumbnail_url or f"https://img.youtube.com/vi/{video.video_id}/maxresdefault.jpg",
                "duration_seconds": None,
                "creator_id": creator_id,
                "creator_name": creator_name,
                "status": "approved",  # Auto-approve imported videos
                "views": video.view_count,
                "likes": video.like_count,
                "liked_by": [],
                "comments_count": 0,
                "tags": [],
                "source": "youtube_import",
                "source_channel_id": channel_id,
                "youtube_published_at": video.published_at,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            
            await db.creator_videos.insert_one(video_doc)
            imported += 1
            
            # Update job progress periodically
            if imported % 10 == 0:
                await db.youtube_import_jobs.update_one(
                    {"job_id": job_id},
                    {
                        "$set": {
                            "imported_videos": imported,
                            "failed_videos": failed,
                            "updated_at": datetime.now(timezone.utc)
                        }
                    }
                )
                
        except Exception as e:
            logger.error(f"Failed to import video {video.video_id}: {e}")
            failed += 1
    
    return imported, failed


# ============ ENDPOINTS ============

@router.post("/lookup-channel")
async def lookup_channel(
    request: ChannelImportRequest,
    authorization: str = Header(None)
):
    """
    Look up a YouTube channel by URL/handle and return channel info
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        # Extract channel identifier from URL
        id_type, identifier = extract_channel_identifier(request.channel_url)
        logger.info(f"Looking up channel: type={id_type}, identifier={identifier}")
        
        # Resolve to channel ID
        channel_id = await resolve_channel_id(id_type, identifier, request.youtube_api_key)
        
        # Get channel info
        channel_info = await get_channel_info(channel_id, request.youtube_api_key)
        
        return {
            "success": True,
            "channel": channel_info.dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Channel lookup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start-import")
async def start_channel_import(
    request: ChannelImportRequest,
    background_tasks: BackgroundTasks,
    creator_id: str = Query(...),
    creator_name: str = Query(...),
    max_videos: int = Query(default=500, le=3000),
    authorization: str = Header(None)
):
    """
    Start importing all videos from a YouTube channel
    Returns a job ID to track progress
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        # Extract and resolve channel
        id_type, identifier = extract_channel_identifier(request.channel_url)
        channel_id = await resolve_channel_id(id_type, identifier, request.youtube_api_key)
        channel_info = await get_channel_info(channel_id, request.youtube_api_key)
        
        # Check if there's already an active import for this channel
        existing_job = await db.youtube_import_jobs.find_one({
            "creator_id": creator_id,
            "channel_id": channel_id,
            "status": {"$in": ["pending", "in_progress"]}
        })
        
        if existing_job:
            raise HTTPException(
                status_code=409,
                detail="An import is already in progress for this channel"
            )
        
        # Create import job
        job_id = str(uuid.uuid4())
        job_doc = {
            "job_id": job_id,
            "creator_id": creator_id,
            "creator_name": creator_name,
            "channel_id": channel_id,
            "channel_title": channel_info.channel_title,
            "channel_thumbnail": channel_info.thumbnail_url,
            "status": "pending",
            "total_videos": min(channel_info.video_count, max_videos),
            "imported_videos": 0,
            "failed_videos": 0,
            "max_videos": max_videos,
            "api_key": request.youtube_api_key,  # Store temporarily for background task
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "error_message": None
        }
        
        await db.youtube_import_jobs.insert_one(job_doc)
        
        # Start background import task
        background_tasks.add_task(
            run_import_job,
            job_id,
            channel_id,
            creator_id,
            creator_name,
            request.youtube_api_key,
            max_videos
        )
        
        return {
            "success": True,
            "job_id": job_id,
            "channel": channel_info.dict(),
            "estimated_videos": min(channel_info.video_count, max_videos),
            "message": f"Import started for {channel_info.channel_title}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Import start error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def run_import_job(
    job_id: str,
    channel_id: str,
    creator_id: str,
    creator_name: str,
    api_key: str,
    max_videos: int
):
    """Background task to run the import job"""
    try:
        # Update status to in_progress
        await db.youtube_import_jobs.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "in_progress",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Fetch all videos
        videos = await fetch_all_channel_videos(channel_id, api_key, max_videos)
        
        # Update total count
        await db.youtube_import_jobs.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "total_videos": len(videos),
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Import videos
        imported, failed = await import_videos_to_library(
            videos, creator_id, creator_name, channel_id, job_id
        )
        
        # Mark job as completed
        await db.youtube_import_jobs.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "completed",
                    "imported_videos": imported,
                    "failed_videos": failed,
                    "updated_at": datetime.now(timezone.utc)
                },
                "$unset": {"api_key": ""}  # Remove API key after completion
            }
        )
        
        logger.info(f"Import job {job_id} completed: {imported} imported, {failed} failed")
        
    except Exception as e:
        logger.error(f"Import job {job_id} failed: {e}")
        await db.youtube_import_jobs.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "failed",
                    "error_message": str(e),
                    "updated_at": datetime.now(timezone.utc)
                },
                "$unset": {"api_key": ""}
            }
        )


@router.get("/job/{job_id}")
async def get_import_job_status(
    job_id: str,
    authorization: str = Header(None)
):
    """Get the status of an import job"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    job = await db.youtube_import_jobs.find_one(
        {"job_id": job_id},
        {"api_key": 0}  # Don't return API key
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    
    # Convert ObjectId and datetime for JSON serialization
    job.pop("_id", None)
    
    return {
        "success": True,
        "job": job
    }


@router.get("/my-imports")
async def get_my_imports(
    creator_id: str = Query(...),
    authorization: str = Header(None)
):
    """Get all import jobs for a creator"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    jobs = await db.youtube_import_jobs.find(
        {"creator_id": creator_id},
        {"api_key": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Convert for JSON serialization
    for job in jobs:
        job.pop("_id", None)
    
    return {
        "success": True,
        "imports": jobs
    }


@router.get("/admin/all-jobs")
async def get_all_import_jobs(
    authorization: str = Header(None),
    limit: int = Query(50, le=200)
):
    """Admin endpoint: Get all import jobs across all creators"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Note: In production, verify admin role from token
    jobs = await db.youtube_import_jobs.find(
        {},
        {"api_key": 0, "api_key_encrypted": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Convert for JSON serialization
    for job in jobs:
        job.pop("_id", None)
    
    return {
        "success": True,
        "jobs": jobs,
        "total": len(jobs)
    }


@router.get("/imported-channels")
async def get_imported_channels(
    creator_id: str = Query(...),
    authorization: str = Header(None)
):
    """Get list of channels that have been imported by a creator"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get unique channels from completed imports
    pipeline = [
        {"$match": {"creator_id": creator_id, "status": "completed"}},
        {"$group": {
            "_id": "$channel_id",
            "channel_title": {"$first": "$channel_title"},
            "channel_thumbnail": {"$first": "$channel_thumbnail"},
            "total_imported": {"$sum": "$imported_videos"},
            "last_import": {"$max": "$created_at"}
        }},
        {"$sort": {"last_import": -1}}
    ]
    
    channels = await db.youtube_import_jobs.aggregate(pipeline).to_list(50)
    
    return {
        "success": True,
        "channels": channels
    }


@router.delete("/job/{job_id}")
async def cancel_import_job(
    job_id: str,
    creator_id: str = Query(...),
    authorization: str = Header(None)
):
    """Cancel a pending or in-progress import job"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    result = await db.youtube_import_jobs.update_one(
        {
            "job_id": job_id,
            "creator_id": creator_id,
            "status": {"$in": ["pending", "in_progress"]}
        },
        {
            "$set": {
                "status": "cancelled",
                "updated_at": datetime.now(timezone.utc)
            },
            "$unset": {"api_key": ""}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Job not found or already completed")
    
    return {"success": True, "message": "Import job cancelled"}



# ============ CONNECTED CHANNELS & AUTO-SYNC ============

class ConnectChannelRequest(BaseModel):
    channel_url: str
    youtube_api_key: str
    auto_sync_enabled: bool = True
    sync_interval_hours: int = 24  # How often to check for new videos


class VerificationRequest(BaseModel):
    channel_id: str
    verification_code: str


@router.post("/connect-channel")
async def connect_channel(
    request: ConnectChannelRequest,
    creator_id: str = Query(...),
    creator_name: str = Query(...),
    authorization: str = Header(None)
):
    """
    Connect a YouTube channel for auto-sync.
    Generates a verification code that creator must add to their channel description.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        # Resolve channel
        id_type, identifier = extract_channel_identifier(request.channel_url)
        channel_id = await resolve_channel_id(id_type, identifier, request.youtube_api_key)
        channel_info = await get_channel_info(channel_id, request.youtube_api_key)
        
        # Check if already connected by this creator
        existing = await db.connected_channels.find_one({
            "creator_id": creator_id,
            "channel_id": channel_id
        })
        
        if existing and existing.get("verified"):
            return {
                "success": True,
                "already_connected": True,
                "channel": channel_info.dict(),
                "message": "Channel already connected and verified"
            }
        
        # Generate unique verification code
        verification_code = f"ZTVLIVE-{uuid.uuid4().hex[:8].upper()}"
        
        # Store or update connection request
        connection_doc = {
            "creator_id": creator_id,
            "creator_name": creator_name,
            "channel_id": channel_id,
            "channel_title": channel_info.channel_title,
            "channel_thumbnail": channel_info.thumbnail_url,
            "channel_url": request.channel_url,
            "verification_code": verification_code,
            "verified": False,
            "auto_sync_enabled": request.auto_sync_enabled,
            "sync_interval_hours": request.sync_interval_hours,
            "last_sync_at": None,
            "last_video_date": None,
            "total_videos_synced": 0,
            "api_key_encrypted": request.youtube_api_key,  # In production, encrypt this
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.connected_channels.update_one(
            {"creator_id": creator_id, "channel_id": channel_id},
            {"$set": connection_doc},
            upsert=True
        )
        
        return {
            "success": True,
            "channel": channel_info.dict(),
            "verification_code": verification_code,
            "verification_instructions": [
                f"1. Go to YouTube Studio for your channel '{channel_info.channel_title}'",
                "2. Click 'Customization' > 'Basic info'",
                f"3. Add this code anywhere in your channel description: {verification_code}",
                "4. Save your changes",
                "5. Come back here and click 'Verify Ownership'",
                "6. After verification, you can remove the code from your description"
            ],
            "message": "Please verify channel ownership by adding the code to your channel description"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Connect channel error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify-ownership")
async def verify_channel_ownership(
    channel_id: str = Query(...),
    creator_id: str = Query(...),
    authorization: str = Header(None)
):
    """
    Verify channel ownership by checking if verification code is in channel description.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get connection record
    connection = await db.connected_channels.find_one({
        "creator_id": creator_id,
        "channel_id": channel_id
    })
    
    if not connection:
        raise HTTPException(status_code=404, detail="Channel connection not found. Please connect the channel first.")
    
    if connection.get("verified"):
        return {
            "success": True,
            "already_verified": True,
            "message": "Channel already verified"
        }
    
    verification_code = connection.get("verification_code")
    api_key = connection.get("api_key_encrypted")
    
    if not verification_code or not api_key:
        raise HTTPException(status_code=400, detail="Missing verification data")
    
    try:
        # Fetch current channel description
        channel_info = await get_channel_info(channel_id, api_key)
        
        # Check if verification code is in description
        if verification_code in (channel_info.description or ""):
            # Mark as verified
            await db.connected_channels.update_one(
                {"creator_id": creator_id, "channel_id": channel_id},
                {
                    "$set": {
                        "verified": True,
                        "verified_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            return {
                "success": True,
                "verified": True,
                "channel_title": channel_info.channel_title,
                "message": f"Channel '{channel_info.channel_title}' verified successfully! You can now remove the code from your description. Auto-sync is enabled."
            }
        else:
            return {
                "success": False,
                "verified": False,
                "verification_code": verification_code,
                "message": f"Verification code not found in channel description. Please add '{verification_code}' to your channel's About section and try again."
            }
            
    except Exception as e:
        logger.error(f"Verification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connected-channels")
async def get_connected_channels(
    creator_id: str = Query(...),
    authorization: str = Header(None)
):
    """Get all connected channels for a creator"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    channels = await db.connected_channels.find(
        {"creator_id": creator_id},
        {"api_key_encrypted": 0}  # Don't return API key
    ).sort("created_at", -1).to_list(50)
    
    # Convert for JSON
    for ch in channels:
        ch.pop("_id", None)
    
    return {
        "success": True,
        "channels": channels
    }


@router.post("/sync-channel/{channel_id}")
async def manual_sync_channel(
    channel_id: str,
    background_tasks: BackgroundTasks,
    creator_id: str = Query(...),
    authorization: str = Header(None)
):
    """Manually trigger a sync for a connected channel to import new videos"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get connection
    connection = await db.connected_channels.find_one({
        "creator_id": creator_id,
        "channel_id": channel_id,
        "verified": True
    })
    
    if not connection:
        raise HTTPException(status_code=404, detail="Verified channel connection not found")
    
    # Check if sync is already in progress
    active_job = await db.youtube_import_jobs.find_one({
        "creator_id": creator_id,
        "channel_id": channel_id,
        "status": {"$in": ["pending", "in_progress"]}
    })
    
    if active_job:
        return {
            "success": False,
            "message": "A sync is already in progress for this channel",
            "job_id": active_job["job_id"]
        }
    
    # Create sync job
    job_id = str(uuid.uuid4())
    job_doc = {
        "job_id": job_id,
        "creator_id": creator_id,
        "creator_name": connection["creator_name"],
        "channel_id": channel_id,
        "channel_title": connection["channel_title"],
        "channel_thumbnail": connection.get("channel_thumbnail"),
        "status": "pending",
        "job_type": "sync",  # Distinguish from full import
        "total_videos": 0,
        "imported_videos": 0,
        "failed_videos": 0,
        "skipped_videos": 0,
        "sync_since": connection.get("last_video_date"),
        "api_key": connection["api_key_encrypted"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.youtube_import_jobs.insert_one(job_doc)
    
    # Start background sync
    background_tasks.add_task(
        run_sync_job,
        job_id,
        channel_id,
        creator_id,
        connection["creator_name"],
        connection["api_key_encrypted"],
        connection.get("last_video_date")
    )
    
    return {
        "success": True,
        "job_id": job_id,
        "message": f"Sync started for {connection['channel_title']}"
    }


async def run_sync_job(
    job_id: str,
    channel_id: str,
    creator_id: str,
    creator_name: str,
    api_key: str,
    sync_since: Optional[datetime]
):
    """Background task to sync new videos from a channel"""
    import httpx
    
    try:
        await db.youtube_import_jobs.update_one(
            {"job_id": job_id},
            {"$set": {"status": "in_progress", "updated_at": datetime.now(timezone.utc)}}
        )
        
        base_url = "https://www.googleapis.com/youtube/v3"
        new_videos = []
        newest_video_date = sync_since
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get uploads playlist ID
            response = await client.get(
                f"{base_url}/channels",
                params={"part": "contentDetails", "id": channel_id, "key": api_key}
            )
            data = response.json()
            
            if not data.get('items'):
                raise Exception("Could not get channel uploads playlist")
            
            uploads_playlist_id = data['items'][0]['contentDetails']['relatedPlaylists']['uploads']
            
            # Fetch recent videos (up to 50, newest first)
            params = {
                "part": "snippet,contentDetails",
                "playlistId": uploads_playlist_id,
                "maxResults": 50,
                "key": api_key
            }
            
            response = await client.get(f"{base_url}/playlistItems", params=params)
            data = response.json()
            
            if response.status_code != 200:
                raise Exception(f"YouTube API error: {data.get('error', {}).get('message', 'Unknown')}")
            
            items = data.get('items', [])
            
            for item in items:
                snippet = item['snippet']
                video_id = item['contentDetails']['videoId']
                published_at_str = snippet.get('publishedAt', '')
                
                try:
                    published_at = datetime.fromisoformat(published_at_str.replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    published_at = datetime.now(timezone.utc)
                
                # Track newest video date
                if newest_video_date is None or published_at > newest_video_date:
                    newest_video_date = published_at
                
                # Skip if older than last sync (if we have a sync date)
                if sync_since and published_at <= sync_since:
                    continue
                
                # Check if already imported
                existing = await db.creator_videos.find_one({
                    "creator_id": creator_id,
                    "youtube_id": video_id
                })
                
                if existing:
                    continue
                
                new_videos.append({
                    "video_id": video_id,
                    "title": snippet.get('title', ''),
                    "description": snippet.get('description', '')[:500],
                    "thumbnail_url": snippet.get('thumbnails', {}).get('maxres', {}).get('url') or
                                    snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                    "published_at": published_at_str
                })
        
        # Update job with total count
        await db.youtube_import_jobs.update_one(
            {"job_id": job_id},
            {"$set": {"total_videos": len(new_videos), "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Import new videos
        imported = 0
        failed = 0
        
        for video in new_videos:
            try:
                video_doc = {
                    "id": str(uuid.uuid4()),
                    "title": video["title"],
                    "description": video["description"],
                    "category": "entertainment",
                    "video_url": f"https://www.youtube.com/watch?v={video['video_id']}",
                    "youtube_id": video["video_id"],
                    "thumbnail_url": video["thumbnail_url"] or f"https://img.youtube.com/vi/{video['video_id']}/maxresdefault.jpg",
                    "creator_id": creator_id,
                    "creator_name": creator_name,
                    "status": "approved",
                    "views": 0,
                    "likes": 0,
                    "liked_by": [],
                    "comments_count": 0,
                    "tags": [],
                    "source": "youtube_sync",
                    "source_channel_id": channel_id,
                    "youtube_published_at": video["published_at"],
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                
                await db.creator_videos.insert_one(video_doc)
                imported += 1
                
            except Exception as e:
                logger.error(f"Failed to import video {video['video_id']}: {e}")
                failed += 1
        
        # Update job as completed
        await db.youtube_import_jobs.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "completed",
                    "imported_videos": imported,
                    "failed_videos": failed,
                    "updated_at": datetime.now(timezone.utc)
                },
                "$unset": {"api_key": ""}
            }
        )
        
        # Update connected channel with last sync info
        await db.connected_channels.update_one(
            {"creator_id": creator_id, "channel_id": channel_id},
            {
                "$set": {
                    "last_sync_at": datetime.now(timezone.utc),
                    "last_video_date": newest_video_date,
                    "updated_at": datetime.now(timezone.utc)
                },
                "$inc": {"total_videos_synced": imported}
            }
        )
        
        logger.info(f"Sync job {job_id} completed: {imported} new videos imported")
        
    except Exception as e:
        logger.error(f"Sync job {job_id} failed: {e}")
        await db.youtube_import_jobs.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "failed",
                    "error_message": str(e),
                    "updated_at": datetime.now(timezone.utc)
                },
                "$unset": {"api_key": ""}
            }
        )


@router.delete("/connected-channel/{channel_id}")
async def disconnect_channel(
    channel_id: str,
    creator_id: str = Query(...),
    authorization: str = Header(None)
):
    """Disconnect a YouTube channel (stops auto-sync)"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    result = await db.connected_channels.delete_one({
        "creator_id": creator_id,
        "channel_id": channel_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Channel connection not found")
    
    return {
        "success": True,
        "message": "Channel disconnected. Auto-sync disabled. Your imported videos remain in your library."
    }


@router.put("/connected-channel/{channel_id}/settings")
async def update_channel_sync_settings(
    channel_id: str,
    creator_id: str = Query(...),
    auto_sync_enabled: bool = Query(default=True),
    sync_interval_hours: int = Query(default=24, ge=1, le=168),
    authorization: str = Header(None)
):
    """Update auto-sync settings for a connected channel"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    result = await db.connected_channels.update_one(
        {"creator_id": creator_id, "channel_id": channel_id, "verified": True},
        {
            "$set": {
                "auto_sync_enabled": auto_sync_enabled,
                "sync_interval_hours": sync_interval_hours,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Verified channel connection not found")
    
    return {
        "success": True,
        "message": f"Auto-sync {'enabled' if auto_sync_enabled else 'disabled'}. Sync interval: {sync_interval_hours} hours"
    }


# ============ SCHEDULED AUTO-SYNC (Called by background scheduler) ============

async def run_scheduled_auto_sync():
    """
    Run auto-sync for all connected channels that are due.
    This should be called by a background scheduler (e.g., every hour).
    """
    now = datetime.now(timezone.utc)
    
    # Find channels due for sync
    channels = await db.connected_channels.find({
        "verified": True,
        "auto_sync_enabled": True
    }).to_list(100)
    
    synced_count = 0
    
    for channel in channels:
        last_sync = channel.get("last_sync_at")
        interval_hours = channel.get("sync_interval_hours", 24)
        
        # Check if due for sync
        if last_sync:
            from datetime import timedelta
            next_sync = last_sync + timedelta(hours=interval_hours)
            if now < next_sync:
                continue
        
        # Check if sync already in progress
        active_job = await db.youtube_import_jobs.find_one({
            "creator_id": channel["creator_id"],
            "channel_id": channel["channel_id"],
            "status": {"$in": ["pending", "in_progress"]}
        })
        
        if active_job:
            continue
        
        # Create and run sync job
        job_id = str(uuid.uuid4())
        job_doc = {
            "job_id": job_id,
            "creator_id": channel["creator_id"],
            "creator_name": channel["creator_name"],
            "channel_id": channel["channel_id"],
            "channel_title": channel["channel_title"],
            "status": "pending",
            "job_type": "auto_sync",
            "total_videos": 0,
            "imported_videos": 0,
            "failed_videos": 0,
            "sync_since": channel.get("last_video_date"),
            "api_key": channel["api_key_encrypted"],
            "created_at": now,
            "updated_at": now
        }
        
        await db.youtube_import_jobs.insert_one(job_doc)
        
        # Run sync (in production, this would be queued)
        await run_sync_job(
            job_id,
            channel["channel_id"],
            channel["creator_id"],
            channel["creator_name"],
            channel["api_key_encrypted"],
            channel.get("last_video_date")
        )
        
        synced_count += 1
    
    logger.info(f"Auto-sync completed: {synced_count} channels synced")
    return synced_count



# ============ QUICK ADMIN IMPORT (Uses stored API key) ============

class QuickImportRequest(BaseModel):
    channel_url: str
    creator_id: str
    creator_name: str

@router.post("/quick-import")
async def quick_import_channel(request: QuickImportRequest):
    """
    Quick import endpoint for admin - uses stored YouTube API key
    Imports all videos from a YouTube channel directly
    """
    import httpx
    
    # Get API key from environment
    api_key = os.environ.get('YOUTUBE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="YouTube API key not configured")
    
    # Extract channel identifier
    id_type, identifier = extract_channel_identifier(request.channel_url)
    
    try:
        # Resolve to channel ID
        channel_id = await resolve_channel_id(id_type, identifier, api_key)
        
        # Get channel info
        channel_info = await get_channel_info(channel_id, api_key)
        
        # Fetch all videos (up to 500)
        videos = await fetch_all_channel_videos(channel_id, api_key, max_results=500)
        
        # Import videos to database
        imported_count = 0
        errors = []
        
        for video in videos:
            try:
                video_doc = {
                    "video_id": f"yt_{video.video_id}_{uuid.uuid4().hex[:8]}",
                    "creator_id": request.creator_id,
                    "creator_name": request.creator_name,
                    "title": video.title,
                    "description": video.description[:1000] if video.description else "",
                    "video_url": f"https://www.youtube.com/watch?v={video.video_id}",
                    "youtube_id": video.video_id,
                    "thumbnail_url": video.thumbnail_url,
                    "category": "entertainment",
                    "tags": [],
                    "duration_seconds": parse_duration(video.duration) if video.duration else 0,
                    "youtube_views": video.view_count,
                    "youtube_likes": video.like_count,
                    "youtube_published_at": video.published_at,
                    "review_status": "approved",
                    "auto_approved": True,
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                
                # Check for duplicates
                existing = await db.creator_videos.find_one({
                    "youtube_id": video.video_id,
                    "creator_id": request.creator_id
                })
                
                if not existing:
                    await db.creator_videos.insert_one(video_doc)
                    imported_count += 1
                    logger.info(f"Imported: {video.title[:50]}...")
                else:
                    logger.info(f"Skipped duplicate: {video.title[:50]}...")
                    
            except Exception as e:
                errors.append({"video_id": video.video_id, "error": str(e)})
                logger.error(f"Error importing video {video.video_id}: {e}")
        
        return {
            "success": True,
            "channel": {
                "id": channel_id,
                "title": channel_info.channel_title,
                "subscriber_count": channel_info.subscriber_count,
                "video_count": channel_info.video_count
            },
            "import_results": {
                "total_found": len(videos),
                "imported": imported_count,
                "skipped_duplicates": len(videos) - imported_count - len(errors),
                "errors": len(errors)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quick import error: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


def parse_duration(duration_str: str) -> int:
    """Parse ISO 8601 duration to seconds"""
    if not duration_str:
        return 0
    
    import re
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
    if not match:
        return 0
    
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    
    return hours * 3600 + minutes * 60 + seconds
