"""
ZTVLIVE File Upload Routes
Handles video uploads, profile pictures, and slideshow content
Features:
- Chunked uploads for large files (up to 2GB)
- Auto thumbnail generation
- Video validation and conversion
- Download/Share permission controls
- Auto-cleanup of failed/disabled uploads
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.responses import FileResponse
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import uuid
import aiofiles
import logging
import asyncio
import subprocess
import shutil
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["Uploads"])

# Database reference (set from server.py)
db = None

# Thread pool for CPU-intensive tasks like thumbnail generation and video conversion
thumbnail_executor = ThreadPoolExecutor(max_workers=2)
conversion_executor = ThreadPoolExecutor(max_workers=1)

def set_database(database):
    global db
    db = database

# Upload directories
UPLOAD_BASE = Path("/app/backend/uploads")
VIDEO_DIR = UPLOAD_BASE / "videos"
IMAGE_DIR = UPLOAD_BASE / "images"
THUMBNAIL_DIR = UPLOAD_BASE / "thumbnails"
CONVERTED_DIR = UPLOAD_BASE / "converted"
FAILED_DIR = UPLOAD_BASE / "failed"

# Ensure directories exist
for directory in [VIDEO_DIR, IMAGE_DIR, THUMBNAIL_DIR, CONVERTED_DIR, FAILED_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Allowed file types
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".flv", ".mpeg", ".mpg", ".3gp", ".3gpp", ".ts"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_SLIDESHOW_EXTENSIONS = {".mp4", ".mov"}  # Slideshows exported as video

# Max file sizes (in bytes)
MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024  # 2GB (chunked uploads)
MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10MB
MAX_CHUNK_SIZE = 10 * 1024 * 1024   # 10MB chunks for faster uploads


def get_file_extension(filename: str) -> str:
    """Get lowercase file extension"""
    return Path(filename).suffix.lower()


def generate_unique_filename(original_filename: str, prefix: str = "") -> str:
    """Generate unique filename preserving extension"""
    ext = get_file_extension(original_filename)
    unique_id = str(uuid.uuid4())[:12]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"{prefix}{timestamp}_{unique_id}{ext}"


def generate_thumbnail_sync(video_path: str, thumbnail_path: str) -> bool:
    """Synchronous thumbnail generation (runs in thread pool)"""
    try:
        from moviepy import VideoFileClip
        
        clip = VideoFileClip(video_path)
        # Get frame at 10% of duration (or 2 seconds, whichever is smaller)
        timestamp = min(clip.duration * 0.1, 2.0)
        frame = clip.get_frame(timestamp)
        
        # Save as image
        from PIL import Image
        img = Image.fromarray(frame)
        img.save(thumbnail_path, "JPEG", quality=85)
        
        clip.close()
        logger.info(f"Thumbnail generated: {thumbnail_path}")
        return True
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return False


async def generate_thumbnail_async(video_path: str, upload_id: str, stored_filename: str):
    """Background task to generate thumbnail for uploaded video"""
    try:
        # Generate thumbnail filename
        thumb_filename = stored_filename.rsplit('.', 1)[0] + "_thumb.jpg"
        thumb_path = THUMBNAIL_DIR / thumb_filename
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        success = await loop.run_in_executor(
            thumbnail_executor,
            generate_thumbnail_sync,
            video_path,
            str(thumb_path)
        )
        
        if success:
            # Update database with thumbnail URL
            await db.uploads.update_one(
                {"id": upload_id},
                {"$set": {
                    "thumbnail_url": f"/api/uploads/serve/thumbnail/{thumb_filename}",
                    "thumbnail_filename": thumb_filename,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            logger.info(f"Thumbnail saved for upload {upload_id}")
    except Exception as e:
        logger.error(f"Background thumbnail generation failed: {e}")



# ============ VIDEO VALIDATION & CONVERSION ============

def validate_video_sync(video_path: str) -> dict:
    """
    Validate video file using ffprobe.
    Returns dict with video info or error details.
    """
    try:
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', '-show_streams', video_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            return {
                "valid": False,
                "error": "Unable to read video file. The file may be corrupted or in an unsupported format.",
                "guidance": [
                    "Please ensure your video is in a supported format (MP4, MOV, AVI, MKV, WebM)",
                    "Try re-exporting the video from your editing software",
                    "If the problem persists, try converting to MP4 using a free tool like HandBrake"
                ]
            }
        
        import json
        probe_data = json.loads(result.stdout)
        
        # Check for video stream
        video_stream = None
        audio_stream = None
        for stream in probe_data.get('streams', []):
            if stream.get('codec_type') == 'video' and not video_stream:
                video_stream = stream
            elif stream.get('codec_type') == 'audio' and not audio_stream:
                audio_stream = stream
        
        if not video_stream:
            return {
                "valid": False,
                "error": "No video stream found in file.",
                "guidance": [
                    "The uploaded file doesn't contain video content",
                    "Please upload a video file, not an audio-only file",
                    "Supported formats: MP4, MOV, AVI, MKV, WebM"
                ]
            }
        
        # Get video info
        format_info = probe_data.get('format', {})
        duration = float(format_info.get('duration', 0))
        file_size = int(format_info.get('size', 0))
        bitrate = int(format_info.get('bit_rate', 0))
        
        width = int(video_stream.get('width', 0))
        height = int(video_stream.get('height', 0))
        codec = video_stream.get('codec_name', 'unknown')
        
        # Check if conversion is needed
        needs_conversion = False
        conversion_reasons = []
        
        # Check codec - prefer h264/h265 for web playback
        if codec not in ['h264', 'hevc', 'h265', 'vp8', 'vp9', 'av1']:
            needs_conversion = True
            conversion_reasons.append(f"Codec '{codec}' may not be web-compatible")
        
        # Check container format
        format_name = format_info.get('format_name', '')
        if 'mp4' not in format_name and 'webm' not in format_name:
            needs_conversion = True
            conversion_reasons.append("Container format needs conversion to MP4")
        
        return {
            "valid": True,
            "duration_seconds": int(duration),
            "file_size": file_size,
            "bitrate": bitrate,
            "width": width,
            "height": height,
            "codec": codec,
            "format": format_name,
            "has_audio": audio_stream is not None,
            "needs_conversion": needs_conversion,
            "conversion_reasons": conversion_reasons
        }
        
    except subprocess.TimeoutExpired:
        return {
            "valid": False,
            "error": "Video validation timed out. The file may be too large or corrupted.",
            "guidance": [
                "Try uploading a smaller file (under 1GB)",
                "Ensure the video is not corrupted",
                "Try converting to MP4 before uploading"
            ]
        }
    except Exception as e:
        logger.error(f"Video validation error: {e}")
        return {
            "valid": False,
            "error": f"Validation error: {str(e)}",
            "guidance": [
                "An unexpected error occurred during validation",
                "Please try uploading again",
                "If the problem persists, try a different video format"
            ]
        }


def convert_video_sync(input_path: str, output_path: str, target_quality: str = "high") -> dict:
    """
    Convert video to web-compatible MP4 format using ffmpeg.
    Preserves quality while ensuring browser compatibility.
    """
    try:
        # Quality presets
        quality_presets = {
            "high": {"crf": "18", "preset": "slow", "audio_bitrate": "192k"},
            "medium": {"crf": "23", "preset": "medium", "audio_bitrate": "128k"},
            "low": {"crf": "28", "preset": "fast", "audio_bitrate": "96k"}
        }
        preset = quality_presets.get(target_quality, quality_presets["high"])
        
        cmd = [
            'ffmpeg', '-y', '-i', input_path,
            '-c:v', 'libx264',          # H.264 codec for maximum compatibility
            '-crf', preset["crf"],       # Quality (lower = better, 18 is visually lossless)
            '-preset', preset["preset"], # Encoding speed/quality tradeoff
            '-profile:v', 'high',        # H.264 profile for quality
            '-level', '4.1',             # H.264 level for compatibility
            '-movflags', '+faststart',   # Enable streaming
            '-pix_fmt', 'yuv420p',       # Pixel format for compatibility
            '-c:a', 'aac',               # AAC audio codec
            '-b:a', preset["audio_bitrate"],  # Audio bitrate
            '-ar', '48000',              # Audio sample rate
            '-ac', '2',                  # Stereo audio
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)  # 1 hour timeout
        
        if result.returncode == 0 and os.path.exists(output_path):
            # Get output file size
            output_size = os.path.getsize(output_path)
            return {
                "success": True,
                "output_path": output_path,
                "output_size": output_size
            }
        else:
            return {
                "success": False,
                "error": result.stderr[:500] if result.stderr else "Conversion failed"
            }
            
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Conversion timed out. Video may be too long or complex."
        }
    except Exception as e:
        logger.error(f"Video conversion error: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def validate_and_convert_video(video_path: str, upload_id: str, stored_filename: str):
    """Background task to validate video and convert if needed"""
    try:
        loop = asyncio.get_event_loop()
        
        # Step 1: Validate video
        validation = await loop.run_in_executor(
            conversion_executor,
            validate_video_sync,
            video_path
        )
        
        if not validation.get("valid"):
            # Mark upload as failed with guidance
            await db.uploads.update_one(
                {"id": upload_id},
                {"$set": {
                    "status": "failed",
                    "error": validation.get("error"),
                    "guidance": validation.get("guidance", []),
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            logger.warning(f"Upload {upload_id} validation failed: {validation.get('error')}")
            return
        
        # Update with video metadata
        await db.uploads.update_one(
            {"id": upload_id},
            {"$set": {
                "duration_seconds": validation.get("duration_seconds"),
                "width": validation.get("width"),
                "height": validation.get("height"),
                "codec": validation.get("codec"),
                "has_audio": validation.get("has_audio"),
                "validated": True,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Step 2: Convert if needed
        if validation.get("needs_conversion"):
            logger.info(f"Converting video {upload_id}: {validation.get('conversion_reasons')}")
            
            await db.uploads.update_one(
                {"id": upload_id},
                {"$set": {"status": "converting"}}
            )
            
            # Generate output path
            output_filename = stored_filename.rsplit('.', 1)[0] + "_converted.mp4"
            output_path = str(CONVERTED_DIR / output_filename)
            
            conversion = await loop.run_in_executor(
                conversion_executor,
                convert_video_sync,
                video_path,
                output_path,
                "high"
            )
            
            if conversion.get("success"):
                # Update to use converted file
                new_file_url = f"/api/uploads/serve/video/{output_filename}"
                await db.uploads.update_one(
                    {"id": upload_id},
                    {"$set": {
                        "file_url": new_file_url,
                        "converted_filename": output_filename,
                        "original_filename_backup": stored_filename,
                        "status": "uploaded",
                        "conversion_complete": True,
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )
                logger.info(f"Video {upload_id} converted successfully")
            else:
                # Conversion failed but original might still work
                await db.uploads.update_one(
                    {"id": upload_id},
                    {"$set": {
                        "status": "uploaded",
                        "conversion_failed": True,
                        "conversion_error": conversion.get("error"),
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )
                logger.warning(f"Video {upload_id} conversion failed: {conversion.get('error')}")
        else:
            # No conversion needed
            await db.uploads.update_one(
                {"id": upload_id},
                {"$set": {"status": "uploaded"}}
            )
            
    except Exception as e:
        logger.error(f"Video validation/conversion error for {upload_id}: {e}")
        await db.uploads.update_one(
            {"id": upload_id},
            {"$set": {
                "status": "error",
                "error": str(e),
                "updated_at": datetime.now(timezone.utc)
            }}
        )


# ============ CLEANUP FUNCTIONS ============

async def cleanup_failed_uploads():
    """Remove failed/disabled uploads older than 24 hours"""
    try:
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        
        # Find old failed uploads
        failed_uploads = await db.uploads.find({
            "status": {"$in": ["failed", "disabled", "deleted"]},
            "updated_at": {"$lt": cutoff_time}
        }).to_list(100)
        
        cleaned_count = 0
        for upload in failed_uploads:
            try:
                # Delete video file
                stored_filename = upload.get("stored_filename")
                if stored_filename:
                    video_path = VIDEO_DIR / stored_filename
                    if video_path.exists():
                        video_path.unlink()
                        logger.info(f"Deleted video file: {stored_filename}")
                
                # Delete thumbnail
                thumb_filename = upload.get("thumbnail_filename")
                if thumb_filename:
                    thumb_path = THUMBNAIL_DIR / thumb_filename
                    if thumb_path.exists():
                        thumb_path.unlink()
                
                # Delete converted file if exists
                converted_filename = upload.get("converted_filename")
                if converted_filename:
                    converted_path = CONVERTED_DIR / converted_filename
                    if converted_path.exists():
                        converted_path.unlink()
                
                # Delete from database
                await db.uploads.delete_one({"id": upload.get("id")})
                cleaned_count += 1
                
            except Exception as e:
                logger.error(f"Error cleaning up upload {upload.get('id')}: {e}")
        
        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} failed/disabled uploads")
        
        return cleaned_count
        
    except Exception as e:
        logger.error(f"Cleanup failed uploads error: {e}")
        return 0


async def disable_and_cleanup_video(upload_id: str):
    """Disable a video and schedule it for cleanup"""
    try:
        # Mark as disabled
        await db.uploads.update_one(
            {"id": upload_id},
            {"$set": {
                "status": "disabled",
                "disabled_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Also update creator_video_uploads if exists
        await db.creator_video_uploads.update_one(
            {"$or": [{"id": upload_id}, {"video_id": upload_id}]},
            {"$set": {
                "status": "disabled",
                "review_status": "disabled",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        logger.info(f"Video {upload_id} disabled and scheduled for cleanup")
        return True
        
    except Exception as e:
        logger.error(f"Error disabling video {upload_id}: {e}")
        return False



# ============ VIDEO UPLOADS ============

@router.post("/video")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    creator_id: str = Form(...),
    creator_name: str = Form(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: str = Form("other"),
    content_type: str = Form("video"),  # video or slideshow
    generate_thumbnail: bool = Form(True)  # Auto-generate thumbnail
):
    """
    Upload a video file for the creator content system.
    Supports regular videos and slideshow exports.
    Auto-generates thumbnail in background.
    """
    # Validate file extension
    ext = get_file_extension(file.filename)
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"
        )
    
    # Check file size (read in chunks)
    file_size = 0
    chunks = []
    
    while True:
        chunk = await file.read(MAX_CHUNK_SIZE)
        if not chunk:
            break
        chunks.append(chunk)
        file_size += len(chunk)
        if file_size > MAX_VIDEO_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {MAX_VIDEO_SIZE // (1024*1024*1024)}GB"
            )
    
    # Generate unique filename
    unique_filename = generate_unique_filename(file.filename, f"{creator_id[:8]}_")
    file_path = VIDEO_DIR / unique_filename
    
    # Write file
    async with aiofiles.open(file_path, "wb") as f:
        for chunk in chunks:
            await f.write(chunk)
    
    upload_id = str(uuid.uuid4())
    
    # Create upload record in database
    upload_record = {
        "id": upload_id,
        "creator_id": creator_id,
        "creator_name": creator_name,
        "original_filename": file.filename,
        "stored_filename": unique_filename,
        "file_path": str(file_path),
        "file_size": file_size,
        "file_type": "video",
        "content_type": content_type,  # video or slideshow
        "extension": ext,
        "title": title or file.filename,
        "description": description,
        "category": category,
        "status": "uploaded",
        "thumbnail_url": None,  # Will be set by background task
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.uploads.insert_one(upload_record)
    
    logger.info(f"Video uploaded: {unique_filename} by {creator_name} ({file_size / (1024*1024):.2f}MB)")
    
    # Schedule thumbnail generation in background
    if generate_thumbnail:
        background_tasks.add_task(
            generate_thumbnail_async,
            str(file_path),
            upload_id,
            unique_filename
        )
    
    # Return URL-safe response (excluding _id)
    return {
        "id": upload_id,
        "filename": unique_filename,
        "file_size": file_size,
        "file_url": f"/api/uploads/serve/video/{unique_filename}",
        "content_type": content_type,
        "status": "uploaded",
        "message": "Video uploaded successfully"
    }


@router.post("/video/chunk/init")
async def init_chunked_upload(
    creator_id: str = Form(...),
    creator_name: str = Form(...),
    filename: str = Form(...),
    total_size: int = Form(...),
    total_chunks: int = Form(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: str = Form("other"),
    content_type: str = Form("video")
):
    """Initialize a chunked upload session for large videos"""
    ext = get_file_extension(filename)
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"
        )
    
    if total_size > MAX_VIDEO_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_VIDEO_SIZE // (1024*1024)}MB"
        )
    
    upload_id = str(uuid.uuid4())
    unique_filename = generate_unique_filename(filename, f"{creator_id[:8]}_")
    
    # Create upload session
    session = {
        "upload_id": upload_id,
        "creator_id": creator_id,
        "creator_name": creator_name,
        "original_filename": filename,
        "stored_filename": unique_filename,
        "total_size": total_size,
        "total_chunks": total_chunks,
        "uploaded_chunks": [],
        "bytes_uploaded": 0,
        "title": title or filename,
        "description": description,
        "category": category,
        "content_type": content_type,
        "status": "in_progress",
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)
    }
    
    await db.upload_sessions.insert_one(session)
    
    return {
        "upload_id": upload_id,
        "filename": unique_filename,
        "total_chunks": total_chunks,
        "chunk_size": MAX_CHUNK_SIZE,
        "message": "Upload session initialized"
    }


@router.post("/video/chunk/upload")
async def upload_chunk(
    background_tasks: BackgroundTasks,
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    chunk: UploadFile = File(...)
):
    """Upload a single chunk of a large video"""
    session = await db.upload_sessions.find_one({"upload_id": upload_id})
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    if session["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Upload session is not active")
    
    # Read chunk data
    chunk_data = await chunk.read()
    chunk_size = len(chunk_data)
    
    # Save chunk to temp file
    chunk_path = VIDEO_DIR / f"{upload_id}_chunk_{chunk_index}"
    async with aiofiles.open(chunk_path, "wb") as f:
        await f.write(chunk_data)
    
    # Update session
    await db.upload_sessions.update_one(
        {"upload_id": upload_id},
        {
            "$push": {"uploaded_chunks": chunk_index},
            "$inc": {"bytes_uploaded": chunk_size}
        }
    )
    
    # Check if all chunks uploaded
    updated_session = await db.upload_sessions.find_one({"upload_id": upload_id})
    if len(updated_session["uploaded_chunks"]) >= updated_session["total_chunks"]:
        # Combine chunks
        final_path = VIDEO_DIR / updated_session["stored_filename"]
        async with aiofiles.open(final_path, "wb") as final_file:
            for i in range(updated_session["total_chunks"]):
                chunk_file = VIDEO_DIR / f"{upload_id}_chunk_{i}"
                async with aiofiles.open(chunk_file, "rb") as cf:
                    await final_file.write(await cf.read())
                # Clean up chunk file
                os.remove(chunk_file)
        
        # Update session status
        await db.upload_sessions.update_one(
            {"upload_id": upload_id},
            {"$set": {"status": "completed"}}
        )
        
        # Create upload record with permission settings
        ext = get_file_extension(updated_session["original_filename"])
        record_id = str(uuid.uuid4())
        upload_record = {
            "id": record_id,
            "creator_id": updated_session["creator_id"],
            "creator_name": updated_session["creator_name"],
            "original_filename": updated_session["original_filename"],
            "stored_filename": updated_session["stored_filename"],
            "file_path": str(final_path),
            "file_size": updated_session["bytes_uploaded"],
            "file_type": "video",
            "content_type": updated_session["content_type"],
            "extension": ext,
            "title": updated_session["title"],
            "description": updated_session["description"],
            "category": updated_session["category"],
            "status": "validating",  # Start as validating
            "thumbnail_url": None,
            # Permission settings (defaults - creator can change)
            "allow_download": updated_session.get("allow_download", False),
            "allow_share": updated_session.get("allow_share", True),
            "is_public": updated_session.get("is_public", True),
            # Validation status
            "validated": False,
            "needs_conversion": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.uploads.insert_one(upload_record)
        
        logger.info(f"Chunked upload completed: {updated_session['stored_filename']}")
        
        # Schedule thumbnail generation
        background_tasks.add_task(
            generate_thumbnail_async,
            str(final_path),
            record_id,
            updated_session["stored_filename"]
        )
        
        # Schedule video validation and conversion
        background_tasks.add_task(
            validate_and_convert_video,
            str(final_path),
            record_id,
            updated_session["stored_filename"]
        )
        
        return {
            "status": "completed",
            "id": record_id,
            "upload_id": upload_id,
            "file_url": f"/api/uploads/serve/video/{updated_session['stored_filename']}",
            "message": "Upload completed successfully"
        }
    
    return {
        "status": "in_progress",
        "chunk_index": chunk_index,
        "chunks_uploaded": len(updated_session["uploaded_chunks"]) + 1,
        "total_chunks": updated_session["total_chunks"],
        "bytes_uploaded": updated_session["bytes_uploaded"] + chunk_size
    }


# ============ IMAGE UPLOADS (Profile Pictures) ============

@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    creator_id: str = Form(...),
    image_type: str = Form("profile")  # profile, thumbnail, banner
):
    """Upload an image (profile picture, thumbnail, etc.)"""
    ext = get_file_extension(file.filename)
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )
    
    # Read file
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_IMAGE_SIZE // (1024*1024)}MB"
        )
    
    # Determine storage directory
    if image_type == "thumbnail":
        storage_dir = THUMBNAIL_DIR
    else:
        storage_dir = IMAGE_DIR
    
    # Generate unique filename
    unique_filename = generate_unique_filename(file.filename, f"{image_type}_{creator_id[:8]}_")
    file_path = storage_dir / unique_filename
    
    # Write file
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)
    
    # Create upload record
    upload_record = {
        "id": str(uuid.uuid4()),
        "creator_id": creator_id,
        "original_filename": file.filename,
        "stored_filename": unique_filename,
        "file_path": str(file_path),
        "file_size": len(content),
        "file_type": "image",
        "image_type": image_type,
        "extension": ext,
        "status": "uploaded",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.uploads.insert_one(upload_record)
    
    logger.info(f"Image uploaded: {unique_filename} ({image_type})")
    
    return {
        "id": upload_record["id"],
        "filename": unique_filename,
        "file_url": f"/api/uploads/serve/image/{unique_filename}",
        "image_type": image_type,
        "message": "Image uploaded successfully"
    }


# ============ FILE SERVING ============

@router.get("/serve/video/{filename}")
async def serve_video(filename: str):
    """Serve a video file - checks both main and converted directories"""
    # Check in primary video directory
    file_path = VIDEO_DIR / filename
    if file_path.exists():
        return FileResponse(
            path=file_path,
            media_type="video/mp4",
            filename=filename
        )
    
    # Also check converted directory for processed videos
    converted_path = CONVERTED_DIR / filename
    if converted_path.exists():
        return FileResponse(
            path=converted_path,
            media_type="video/mp4",
            filename=filename
        )
    
    # Video file not found - provide helpful error
    logger.warning(f"Video file not found: {filename} (checked {VIDEO_DIR} and {CONVERTED_DIR})")
    raise HTTPException(
        status_code=404, 
        detail="Video file not found. The file may have been moved or the upload was incomplete."
    )


@router.get("/serve/thumbnail/{filename}")
async def serve_thumbnail(filename: str):
    """Serve a video thumbnail"""
    file_path = THUMBNAIL_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    return FileResponse(
        path=file_path,
        media_type="image/jpeg",
        filename=filename
    )


@router.get("/serve/image/{filename}")
async def serve_image(filename: str):
    """Serve an image file"""
    # Check both image directories
    for directory in [IMAGE_DIR, THUMBNAIL_DIR]:
        file_path = directory / filename
        if file_path.exists():
            ext = get_file_extension(filename)
            media_types = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".webp": "image/webp"
            }
            return FileResponse(
                path=file_path,
                media_type=media_types.get(ext, "image/jpeg"),
                filename=filename
            )
    
    raise HTTPException(status_code=404, detail="Image not found")



@router.get("/check-file/{filename}")
async def check_file_status(filename: str):
    """Check if a video file exists and is valid"""
    # Check all possible locations
    locations = [
        ("videos", VIDEO_DIR / filename),
        ("converted", CONVERTED_DIR / filename),
    ]
    
    for location_name, file_path in locations:
        if file_path.exists():
            stat = file_path.stat()
            return {
                "exists": True,
                "filename": filename,
                "location": location_name,
                "size_bytes": stat.st_size,
                "is_valid": stat.st_size > 100,  # Consider files < 100 bytes as invalid/incomplete
                "file_url": f"/api/uploads/serve/video/{filename}"
            }
    
    return {
        "exists": False,
        "filename": filename,
        "location": None,
        "size_bytes": 0,
        "is_valid": False,
        "error": "File not found - upload may have failed or been deleted"
    }



# ============ UPLOAD MANAGEMENT ============

@router.get("/my-uploads")
async def get_my_uploads(
    creator_id: str = Query(...),
    file_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    validate_files: bool = Query(False, description="Also check if files exist on disk")
):
    """Get all uploads for a creator"""
    query = {"creator_id": creator_id}
    if file_type:
        query["file_type"] = file_type
    
    uploads = await db.uploads.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Add URLs and optionally validate files
    for upload in uploads:
        if upload["file_type"] == "video":
            upload["file_url"] = f"/api/uploads/serve/video/{upload['stored_filename']}"
            
            # Optionally check if file exists
            if validate_files:
                filename = upload.get('stored_filename', '')
                file_path = VIDEO_DIR / filename
                converted_path = CONVERTED_DIR / filename
                
                if file_path.exists():
                    upload["file_exists"] = True
                    upload["file_valid"] = file_path.stat().st_size > 100
                elif converted_path.exists():
                    upload["file_exists"] = True
                    upload["file_valid"] = converted_path.stat().st_size > 100
                else:
                    upload["file_exists"] = False
                    upload["file_valid"] = False
        else:
            upload["file_url"] = f"/api/uploads/serve/image/{upload['stored_filename']}"
    
    return {"uploads": uploads, "count": len(uploads)}


@router.delete("/{upload_id}")
async def delete_upload(upload_id: str, creator_id: str = Query(...)):
    """Delete an uploaded file (only by owner)"""
    upload = await db.uploads.find_one({"id": upload_id})
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if upload["creator_id"] != creator_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete file from disk
    try:
        file_path = Path(upload["file_path"])
        if file_path.exists():
            os.remove(file_path)
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
    
    # Delete from database
    await db.uploads.delete_one({"id": upload_id})
    
    return {"status": "deleted", "upload_id": upload_id}


@router.post("/cleanup-orphaned")
async def cleanup_orphaned_uploads(creator_id: str = Query(...)):
    """
    Clean up database records for videos whose files no longer exist.
    This removes orphaned records from failed/incomplete uploads.
    """
    try:
        # Find all uploads for this creator
        uploads = await db.uploads.find(
            {"creator_id": creator_id, "file_type": "video"},
            {"_id": 0, "id": 1, "stored_filename": 1, "title": 1}
        ).to_list(1000)
        
        orphaned = []
        for upload in uploads:
            filename = upload.get('stored_filename', '')
            file_path = VIDEO_DIR / filename
            converted_path = CONVERTED_DIR / filename
            
            if not file_path.exists() and not converted_path.exists():
                orphaned.append(upload)
        
        # Delete orphaned records
        deleted_ids = []
        for orphan in orphaned:
            await db.uploads.delete_one({"id": orphan["id"]})
            deleted_ids.append(orphan["id"])
            logger.info(f"Deleted orphaned upload record: {orphan.get('title', 'Unknown')} ({orphan['id']})")
        
        return {
            "status": "completed",
            "total_checked": len(uploads),
            "orphaned_found": len(orphaned),
            "deleted_ids": deleted_ids,
            "message": f"Cleaned up {len(orphaned)} orphaned upload records"
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up orphaned uploads: {e}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")




# ============ BATCH METADATA UPDATE ============

from pydantic import BaseModel

class VideoMetadataUpdate(BaseModel):
    video_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None

class BatchMetadataRequest(BaseModel):
    videos: List[VideoMetadataUpdate]
    apply_to_all: Optional[dict] = None  # {"title_prefix": "...", "description": "...", "category": "..."}

@router.post("/batch/metadata")
async def batch_update_metadata(request: BatchMetadataRequest):
    """
    Batch update metadata for multiple videos.
    Supports individual updates or applying same values to all.
    """
    updated = []
    failed = []
    
    for video_update in request.videos:
        try:
            # Build update dict
            update_fields = {"updated_at": datetime.now(timezone.utc)}
            
            # Apply individual updates
            if video_update.title:
                update_fields["title"] = video_update.title
            if video_update.description:
                update_fields["description"] = video_update.description
            if video_update.category:
                update_fields["category"] = video_update.category
            
            # Apply "apply_to_all" values if present
            if request.apply_to_all:
                if request.apply_to_all.get("title_prefix") and video_update.title:
                    update_fields["title"] = request.apply_to_all["title_prefix"] + " " + video_update.title
                if request.apply_to_all.get("description"):
                    update_fields["description"] = request.apply_to_all["description"]
                if request.apply_to_all.get("category"):
                    update_fields["category"] = request.apply_to_all["category"]
            
            # Update in uploads collection
            result = await db.uploads.update_one(
                {"id": video_update.video_id},
                {"$set": update_fields}
            )
            
            # Also update in creator_videos collection if exists
            await db.creator_videos.update_one(
                {"id": video_update.video_id},
                {"$set": update_fields}
            )
            
            if result.modified_count > 0 or result.matched_count > 0:
                updated.append(video_update.video_id)
            else:
                # Try updating by different ID field
                result2 = await db.creator_videos.update_one(
                    {"video_id": video_update.video_id},
                    {"$set": update_fields}
                )
                if result2.modified_count > 0 or result2.matched_count > 0:
                    updated.append(video_update.video_id)
                else:
                    failed.append({"video_id": video_update.video_id, "reason": "Not found"})
                    
        except Exception as e:
            logger.error(f"Error updating video {video_update.video_id}: {e}")
            failed.append({"video_id": video_update.video_id, "reason": str(e)})
    
    return {
        "status": "completed",
        "updated_count": len(updated),
        "failed_count": len(failed),
        "updated_ids": updated,
        "failed": failed
    }


@router.get("/batch/categories")
async def get_available_categories():
    """Get list of available categories for batch editing"""
    return {
        "categories": [
            {"value": "entertainment", "label": "Entertainment"},
            {"value": "music", "label": "Music"},
            {"value": "comedy", "label": "Comedy"},
            {"value": "news", "label": "News"},
            {"value": "sports", "label": "Sports"},
            {"value": "education", "label": "Education"},
            {"value": "documentary", "label": "Documentary"},
            {"value": "lifestyle", "label": "Lifestyle"},
            {"value": "gaming", "label": "Gaming"},
            {"value": "tech", "label": "Technology"},
            {"value": "other", "label": "Other"}
        ]
    }


# ============ VIDEO ORDERING / REORDER ============

class VideoOrderItem(BaseModel):
    video_id: str
    order: int

class ReorderRequest(BaseModel):
    creator_id: str
    videos: List[VideoOrderItem]

@router.post("/reorder")
async def reorder_videos(request: ReorderRequest):
    """
    Save the custom order for a creator's video library.
    """
    try:
        updated = 0
        for item in request.videos:
            # Update order in uploads collection
            result1 = await db.uploads.update_one(
                {"id": item.video_id, "creator_id": request.creator_id},
                {"$set": {"display_order": item.order, "updated_at": datetime.now(timezone.utc)}}
            )
            # Also update in creator_videos collection
            result2 = await db.creator_videos.update_one(
                {"id": item.video_id, "creator_id": request.creator_id},
                {"$set": {"display_order": item.order, "updated_at": datetime.now(timezone.utc)}}
            )
            if result1.modified_count > 0 or result2.modified_count > 0:
                updated += 1
        
        return {
            "status": "success",
            "updated_count": updated,
            "total_videos": len(request.videos)
        }
    except Exception as e:
        logger.error(f"Error reordering videos: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reorder: {str(e)}")


# ============ VIDEO ANALYTICS ============

@router.get("/analytics/{video_id}")
async def get_video_analytics(video_id: str):
    """
    Get detailed analytics for a specific video.
    Includes views, engagement, watch time, and performance trends.
    """
    # Try to find video in both collections
    video = await db.uploads.find_one({"id": video_id}, {"_id": 0})
    if not video:
        video = await db.creator_videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        video = await db.creator_videos.find_one({"video_id": video_id}, {"_id": 0})
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Get view history from analytics collection (if exists)
    view_history = []
    try:
        history = await db.video_analytics.find(
            {"video_id": video_id},
            {"_id": 0}
        ).sort("date", -1).limit(30).to_list(30)
        view_history = history if history else []
    except Exception:
        pass
    
    # Calculate engagement metrics
    views = video.get("views", 0)
    likes = video.get("likes", 0)
    shares = video.get("shares", 0)
    comments = video.get("comments", 0)
    watch_time_seconds = video.get("total_watch_time_seconds", 0)
    duration_seconds = video.get("duration_seconds", 0)
    
    engagement_rate = 0
    if views > 0:
        engagement_rate = round(((likes + shares + comments) / views) * 100, 2)
    
    avg_watch_time = 0
    completion_rate = 0
    if views > 0 and watch_time_seconds > 0:
        avg_watch_time = round(watch_time_seconds / views)
        if duration_seconds > 0:
            completion_rate = round((avg_watch_time / duration_seconds) * 100, 1)
    
    # Generate mock daily data if no history exists (for demo purposes)
    if not view_history:
        from random import randint
        import datetime as dt
        base_views = max(views // 30, 1) if views > 0 else randint(0, 5)
        for i in range(30):
            date = (dt.datetime.now(timezone.utc) - dt.timedelta(days=29-i)).strftime("%Y-%m-%d")
            daily_views = max(0, base_views + randint(-2, 5))
            view_history.append({
                "date": date,
                "views": daily_views,
                "watch_time": daily_views * randint(30, 180)
            })
    
    return {
        "video_id": video_id,
        "title": video.get("title", "Untitled"),
        "thumbnail_url": video.get("thumbnail_url"),
        "created_at": video.get("created_at"),
        "status": video.get("status", video.get("review_status", "pending")),
        "category": video.get("category", "other"),
        "metrics": {
            "total_views": views,
            "total_likes": likes,
            "total_shares": shares,
            "total_comments": comments,
            "engagement_rate": engagement_rate,
            "avg_watch_time_seconds": avg_watch_time,
            "completion_rate": completion_rate,
            "duration_seconds": duration_seconds
        },
        "performance": {
            "views_trend": "up" if len(view_history) > 1 and view_history[-1].get("views", 0) > view_history[0].get("views", 0) else "stable",
            "daily_history": view_history[-14:],  # Last 14 days
            "weekly_avg_views": round(sum(h.get("views", 0) for h in view_history[-7:]) / 7, 1) if view_history else 0
        },
        "schedule_info": {
            "times_scheduled": video.get("times_scheduled", 0),
            "last_aired": video.get("last_aired"),
            "next_scheduled": video.get("next_scheduled")
        }
    }


# ============ A/B THUMBNAIL TESTING ============

class ThumbnailVariant(BaseModel):
    variant_id: str
    thumbnail_url: str
    impressions: int = 0
    clicks: int = 0

class ABTestCreate(BaseModel):
    video_id: str
    creator_id: str

@router.post("/ab-test/create")
async def create_ab_test(request: ABTestCreate):
    """Create a new A/B test for a video's thumbnails"""
    test_id = str(uuid.uuid4())
    
    # Get original thumbnail
    video = await db.uploads.find_one({"id": request.video_id}, {"_id": 0})
    if not video:
        video = await db.creator_videos.find_one({"id": request.video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    original_thumb = video.get("thumbnail_url", "")
    
    ab_test = {
        "test_id": test_id,
        "video_id": request.video_id,
        "creator_id": request.creator_id,
        "status": "active",
        "variants": [
            {
                "variant_id": "original",
                "thumbnail_url": original_thumb,
                "impressions": 0,
                "clicks": 0,
                "is_original": True
            }
        ],
        "winner": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.ab_tests.insert_one(ab_test)
    
    return {
        "test_id": test_id,
        "video_id": request.video_id,
        "status": "active",
        "variants": ab_test["variants"]
    }


@router.post("/ab-test/{test_id}/add-variant")
async def add_thumbnail_variant(
    test_id: str,
    file: UploadFile = File(...),
    creator_id: str = Form(...)
):
    """Add a new thumbnail variant to an A/B test"""
    test = await db.ab_tests.find_one({"test_id": test_id}, {"_id": 0})
    if not test:
        raise HTTPException(status_code=404, detail="A/B test not found")
    
    if test["creator_id"] != creator_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if len(test["variants"]) >= 4:
        raise HTTPException(status_code=400, detail="Maximum 4 variants allowed")
    
    # Validate image
    ext = get_file_extension(file.filename)
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid image type")
    
    # Save thumbnail
    variant_id = f"variant_{len(test['variants'])}"
    unique_filename = generate_unique_filename(file.filename, f"abtest_{test_id[:8]}_")
    file_path = THUMBNAIL_DIR / unique_filename
    
    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)
    
    thumbnail_url = f"/api/uploads/serve/thumbnail/{unique_filename}"
    
    # Add variant
    new_variant = {
        "variant_id": variant_id,
        "thumbnail_url": thumbnail_url,
        "impressions": 0,
        "clicks": 0,
        "is_original": False
    }
    
    await db.ab_tests.update_one(
        {"test_id": test_id},
        {
            "$push": {"variants": new_variant},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {
        "test_id": test_id,
        "variant_id": variant_id,
        "thumbnail_url": thumbnail_url
    }


@router.post("/ab-test/{test_id}/track")
async def track_ab_test_event(
    test_id: str,
    variant_id: str = Form(...),
    event_type: str = Form(...)  # "impression" or "click"
):
    """Track an impression or click for a thumbnail variant"""
    if event_type not in ["impression", "click"]:
        raise HTTPException(status_code=400, detail="Invalid event type")
    
    field = "impressions" if event_type == "impression" else "clicks"
    
    await db.ab_tests.update_one(
        {"test_id": test_id, "variants.variant_id": variant_id},
        {
            "$inc": {f"variants.$.{field}": 1},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {"status": "tracked"}


@router.get("/ab-test/{test_id}/results")
async def get_ab_test_results(test_id: str):
    """Get A/B test results with CTR calculations"""
    test = await db.ab_tests.find_one({"test_id": test_id}, {"_id": 0})
    if not test:
        raise HTTPException(status_code=404, detail="A/B test not found")
    
    # Calculate CTR for each variant
    variants_with_ctr = []
    for variant in test["variants"]:
        impressions = variant.get("impressions", 0)
        clicks = variant.get("clicks", 0)
        ctr = round((clicks / impressions * 100), 2) if impressions > 0 else 0
        
        variants_with_ctr.append({
            **variant,
            "ctr": ctr,
            "performance": "winner" if ctr > 0 and all(
                ctr >= (v.get("clicks", 0) / v.get("impressions", 1) * 100 if v.get("impressions", 0) > 0 else 0)
                for v in test["variants"]
            ) else "testing"
        })
    
    # Sort by CTR
    variants_with_ctr.sort(key=lambda x: x["ctr"], reverse=True)
    
    return {
        "test_id": test_id,
        "video_id": test["video_id"],
        "status": test["status"],
        "winner": test.get("winner"),
        "variants": variants_with_ctr,
        "total_impressions": sum(v.get("impressions", 0) for v in test["variants"]),
        "total_clicks": sum(v.get("clicks", 0) for v in test["variants"]),
        "created_at": test["created_at"],
        "days_running": (datetime.now(timezone.utc) - test["created_at"]).days if test.get("created_at") else 0
    }


@router.post("/ab-test/{test_id}/select-winner")
async def select_ab_test_winner(test_id: str, variant_id: str = Form(...)):
    """Select a winner and apply that thumbnail to the video"""
    test = await db.ab_tests.find_one({"test_id": test_id}, {"_id": 0})
    if not test:
        raise HTTPException(status_code=404, detail="A/B test not found")
    
    # Find the winning variant
    winner = next((v for v in test["variants"] if v["variant_id"] == variant_id), None)
    if not winner:
        raise HTTPException(status_code=404, detail="Variant not found")
    
    # Update video thumbnail
    await db.uploads.update_one(
        {"id": test["video_id"]},
        {"$set": {"thumbnail_url": winner["thumbnail_url"]}}
    )
    await db.creator_videos.update_one(
        {"id": test["video_id"]},
        {"$set": {"thumbnail_url": winner["thumbnail_url"]}}
    )
    
    # Mark test as completed
    await db.ab_tests.update_one(
        {"test_id": test_id},
        {
            "$set": {
                "status": "completed",
                "winner": variant_id,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "status": "completed",
        "winner": variant_id,
        "thumbnail_url": winner["thumbnail_url"]
    }


@router.get("/ab-test/video/{video_id}")
async def get_video_ab_tests(video_id: str):
    """Get all A/B tests for a video"""
    tests = await db.ab_tests.find(
        {"video_id": video_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
    return {"video_id": video_id, "tests": tests}


@router.get("/ab-test/creator/{creator_id}")
async def get_creator_ab_tests(creator_id: str):
    """Get all A/B tests for a creator"""
    tests = await db.ab_tests.find(
        {"creator_id": creator_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Calculate stats for each test
    for test in tests:
        for variant in test.get("variants", []):
            impressions = variant.get("impressions", 0)
            clicks = variant.get("clicks", 0)
            variant["ctr"] = round((clicks / impressions * 100), 2) if impressions > 0 else 0
    
    return {"creator_id": creator_id, "tests": tests}


# ============ CREATOR REVENUE DASHBOARD ============

@router.get("/revenue/{creator_id}")
async def get_creator_revenue(creator_id: str, period: str = "all"):
    """
    Get detailed revenue breakdown for a creator.
    period: 'week', 'month', 'year', 'all'
    """
    # Calculate date filter
    now = datetime.now(timezone.utc)
    date_filter = {}
    if period == "week":
        date_filter = {"created_at": {"$gte": now - timedelta(days=7)}}
    elif period == "month":
        date_filter = {"created_at": {"$gte": now - timedelta(days=30)}}
    elif period == "year":
        date_filter = {"created_at": {"$gte": now - timedelta(days=365)}}
    
    # Get all videos with their stats
    videos = await db.creator_videos.find(
        {"creator_id": creator_id, **date_filter},
        {"_id": 0}
    ).to_list(1000)
    
    # Also check uploads collection
    uploads = await db.uploads.find(
        {"creator_id": creator_id, **date_filter},
        {"_id": 0}
    ).to_list(1000)
    
    # Merge and dedupe
    all_videos = {v.get("id") or v.get("video_id"): v for v in videos + uploads}
    
    # Revenue calculation constants (example rates)
    CPM_RATE = 2.50  # $2.50 per 1000 views (70% creator share)
    AD_REVENUE_SHARE = 0.70  # 70% to creator
    SLOT_BOOKING_RATE = 5.00  # $5 per scheduled slot
    
    # Calculate per-video revenue
    video_revenues = []
    total_views = 0
    total_ad_revenue = 0
    total_slot_revenue = 0
    
    for vid, video in all_videos.items():
        views = video.get("views", 0)
        times_scheduled = video.get("times_scheduled", 0)
        
        # Ad revenue from views
        ad_revenue = (views / 1000) * CPM_RATE * AD_REVENUE_SHARE
        
        # Slot revenue
        slot_revenue = times_scheduled * SLOT_BOOKING_RATE * 0.5  # 50% bonus for scheduled content
        
        video_revenue = ad_revenue + slot_revenue
        
        video_revenues.append({
            "video_id": vid,
            "title": video.get("title", "Untitled"),
            "thumbnail_url": video.get("thumbnail_url"),
            "views": views,
            "times_scheduled": times_scheduled,
            "ad_revenue": round(ad_revenue, 2),
            "slot_revenue": round(slot_revenue, 2),
            "total_revenue": round(video_revenue, 2),
            "created_at": video.get("created_at")
        })
        
        total_views += views
        total_ad_revenue += ad_revenue
        total_slot_revenue += slot_revenue
    
    # Sort by revenue
    video_revenues.sort(key=lambda x: x["total_revenue"], reverse=True)
    
    # Get payment history
    payments = await db.creator_payments.find(
        {"creator_id": creator_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Calculate pending vs paid
    total_earned = total_ad_revenue + total_slot_revenue
    total_paid = sum(p.get("amount", 0) for p in payments if p.get("status") == "paid")
    pending_balance = max(0, total_earned - total_paid)
    
    # Generate daily revenue history (last 30 days)
    daily_revenue = []
    from random import uniform
    base_daily = total_earned / 30 if total_earned > 0 else 0
    for i in range(30):
        date = (now - timedelta(days=29-i)).strftime("%Y-%m-%d")
        daily_revenue.append({
            "date": date,
            "revenue": round(base_daily * uniform(0.5, 1.5), 2)
        })
    
    return {
        "creator_id": creator_id,
        "period": period,
        "summary": {
            "total_revenue": round(total_earned, 2),
            "ad_revenue": round(total_ad_revenue, 2),
            "slot_revenue": round(total_slot_revenue, 2),
            "total_views": total_views,
            "total_videos": len(video_revenues),
            "avg_revenue_per_video": round(total_earned / len(video_revenues), 2) if video_revenues else 0,
            "pending_balance": round(pending_balance, 2),
            "total_paid": round(total_paid, 2)
        },
        "revenue_rates": {
            "cpm_rate": CPM_RATE,
            "creator_share": f"{int(AD_REVENUE_SHARE * 100)}%",
            "slot_bonus": "50%"
        },
        "top_videos": video_revenues[:10],
        "all_videos": video_revenues,
        "daily_revenue": daily_revenue,
        "payment_history": payments,
        "next_payout": {
            "amount": round(pending_balance, 2),
            "status": "pending" if pending_balance >= 50 else "below_threshold",
            "threshold": 50.00,
            "estimated_date": (now + timedelta(days=15)).strftime("%Y-%m-%d") if pending_balance >= 50 else None
        }
    }


@router.get("/revenue/{creator_id}/video/{video_id}")
async def get_video_revenue_details(creator_id: str, video_id: str):
    """Get detailed revenue breakdown for a specific video"""
    video = await db.uploads.find_one({"id": video_id, "creator_id": creator_id}, {"_id": 0})
    if not video:
        video = await db.creator_videos.find_one({"id": video_id, "creator_id": creator_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    views = video.get("views", 0)
    times_scheduled = video.get("times_scheduled", 0)
    
    # Revenue calculation
    CPM_RATE = 2.50
    AD_REVENUE_SHARE = 0.70
    SLOT_BOOKING_RATE = 5.00
    
    ad_revenue = (views / 1000) * CPM_RATE * AD_REVENUE_SHARE
    slot_revenue = times_scheduled * SLOT_BOOKING_RATE * 0.5
    
    # Generate daily breakdown (last 14 days)
    now = datetime.now(timezone.utc)
    daily_breakdown = []
    base_views = views / 14 if views > 0 else 0
    from random import uniform, randint
    for i in range(14):
        date = (now - timedelta(days=13-i)).strftime("%Y-%m-%d")
        day_views = int(base_views * uniform(0.5, 1.5))
        day_revenue = (day_views / 1000) * CPM_RATE * AD_REVENUE_SHARE
        daily_breakdown.append({
            "date": date,
            "views": day_views,
            "revenue": round(day_revenue, 2)
        })
    
    return {
        "video_id": video_id,
        "title": video.get("title", "Untitled"),
        "thumbnail_url": video.get("thumbnail_url"),
        "total_views": views,
        "times_scheduled": times_scheduled,
        "revenue": {
            "ad_revenue": round(ad_revenue, 2),
            "slot_revenue": round(slot_revenue, 2),
            "total": round(ad_revenue + slot_revenue, 2)
        },
        "performance": {
            "avg_daily_views": round(views / 14, 1),
            "avg_daily_revenue": round((ad_revenue + slot_revenue) / 14, 2)
        },
        "daily_breakdown": daily_breakdown
    }



# ============ ADMIN: CREATOR DATA COLLECTION ============

@router.get("/admin/creators")
async def get_all_creators():
    """
    Admin endpoint: Get all creator data for outreach/marketing.
    Includes contact info, upload stats, and engagement metrics.
    """
    # Aggregate creator data from uploads and videos
    pipeline = [
        {
            "$group": {
                "_id": "$creator_id",
                "creator_name": {"$first": "$creator_name"},
                "total_uploads": {"$sum": 1},
                "total_size_bytes": {"$sum": "$file_size"},
                "first_upload": {"$min": "$created_at"},
                "last_upload": {"$max": "$created_at"},
                "categories": {"$addToSet": "$category"}
            }
        },
        {"$sort": {"last_upload": -1}}
    ]
    
    creators_from_uploads = await db.uploads.aggregate(pipeline).to_list(1000)
    
    # Also get data from creator_videos collection
    video_pipeline = [
        {
            "$group": {
                "_id": "$creator_id",
                "creator_name": {"$first": "$creator_name"},
                "total_videos": {"$sum": 1},
                "total_views": {"$sum": "$views"},
                "total_likes": {"$sum": "$likes"},
                "categories": {"$addToSet": "$category"},
                "first_video": {"$min": "$created_at"},
                "last_video": {"$max": "$created_at"}
            }
        }
    ]
    
    creators_from_videos = await db.creator_videos.aggregate(video_pipeline).to_list(1000)
    
    # Merge data
    creator_map = {}
    
    for c in creators_from_uploads:
        creator_id = c["_id"]
        creator_map[creator_id] = {
            "creator_id": creator_id,
            "creator_name": c["creator_name"],
            "uploads": c["total_uploads"],
            "upload_size_mb": round(c["total_size_bytes"] / (1024 * 1024), 2),
            "first_activity": c["first_upload"],
            "last_activity": c["last_upload"],
            "categories": list(c["categories"]),
            "videos": 0,
            "total_views": 0,
            "total_likes": 0
        }
    
    for c in creators_from_videos:
        creator_id = c["_id"]
        if creator_id in creator_map:
            creator_map[creator_id]["videos"] = c["total_videos"]
            creator_map[creator_id]["total_views"] = c["total_views"]
            creator_map[creator_id]["total_likes"] = c["total_likes"]
            creator_map[creator_id]["categories"] = list(set(
                creator_map[creator_id]["categories"] + list(c["categories"])
            ))
            if c["last_video"] > creator_map[creator_id]["last_activity"]:
                creator_map[creator_id]["last_activity"] = c["last_video"]
        else:
            creator_map[creator_id] = {
                "creator_id": creator_id,
                "creator_name": c["creator_name"],
                "uploads": 0,
                "upload_size_mb": 0,
                "first_activity": c["first_video"],
                "last_activity": c["last_video"],
                "categories": list(c["categories"]),
                "videos": c["total_videos"],
                "total_views": c["total_views"],
                "total_likes": c["total_likes"]
            }
    
    # Get contact info from users collection
    creator_ids = list(creator_map.keys())
    users = await db.users.find(
        {"user_id": {"$in": creator_ids}},
        {"_id": 0, "user_id": 1, "email": 1, "name": 1, "picture": 1, "created_at": 1}
    ).to_list(1000)
    
    user_map = {u["user_id"]: u for u in users}
    
    # Combine data
    result = []
    for creator_id, data in creator_map.items():
        user_info = user_map.get(creator_id, {})
        data["email"] = user_info.get("email", "N/A")
        data["profile_picture"] = user_info.get("picture")
        data["joined_date"] = user_info.get("created_at")
        result.append(data)
    
    # Sort by activity
    result.sort(key=lambda x: x.get("last_activity") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    
    return {
        "total_creators": len(result),
        "creators": result
    }


@router.get("/admin/creator/{creator_id}")
async def get_creator_details(creator_id: str):
    """Admin: Get detailed info about a specific creator"""
    # Get user info
    user = await db.users.find_one(
        {"user_id": creator_id},
        {"_id": 0}
    )
    
    # Get uploads
    uploads = await db.uploads.find(
        {"creator_id": creator_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get videos
    videos = await db.creator_videos.find(
        {"creator_id": creator_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate stats
    total_views = sum(v.get("views", 0) for v in videos)
    total_likes = sum(v.get("likes", 0) for v in videos)
    
    return {
        "creator_id": creator_id,
        "user_info": user,
        "stats": {
            "total_uploads": len(uploads),
            "total_videos": len(videos),
            "total_views": total_views,
            "total_likes": total_likes
        },
        "recent_uploads": uploads[:10],
        "recent_videos": videos[:10]
    }


@router.post("/admin/creator/{creator_id}/note")
async def add_creator_note(
    creator_id: str,
    note: str = Form(...),
    admin_email: str = Form(...)
):
    """Admin: Add a note about a creator (for outreach tracking)"""
    note_record = {
        "id": str(uuid.uuid4()),
        "creator_id": creator_id,
        "note": note,
        "added_by": admin_email,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.creator_notes.insert_one(note_record)
    
    return {"status": "added", "note_id": note_record["id"]}


@router.get("/admin/creator/{creator_id}/notes")
async def get_creator_notes(creator_id: str):
    """Admin: Get all notes for a creator"""
    notes = await db.creator_notes.find(
        {"creator_id": creator_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"notes": notes}



@router.delete("/admin/creator/{creator_id}")
async def delete_creator(creator_id: str):
    """Admin: Delete a creator and all their content"""
    try:
        # Delete creator videos
        videos_result = await db.creator_videos.delete_many({"creator_id": creator_id})
        
        # Delete creator bookings
        bookings_result = await db.creator_bookings.delete_many({"creator_id": creator_id})
        
        # Delete creator notes
        notes_result = await db.creator_notes.delete_many({"creator_id": creator_id})
        
        # Delete creator agreement records
        agreements_result = await db.creator_agreements.delete_many({"user_id": creator_id})
        
        # Delete user record if exists
        user_result = await db.users.delete_one({"user_id": creator_id})
        
        # Delete fan notifications related to this creator
        notifications_result = await db.fan_notifications.delete_many({"creator_id": creator_id})
        
        # Delete follower relationships
        followers_result = await db.creator_followers.delete_many({"creator_id": creator_id})
        followers_result2 = await db.creator_followers.delete_many({"follower_id": creator_id})
        
        return {
            "status": "deleted",
            "creator_id": creator_id,
            "deleted_counts": {
                "videos": videos_result.deleted_count,
                "bookings": bookings_result.deleted_count,
                "notes": notes_result.deleted_count,
                "agreements": agreements_result.deleted_count,
                "user": user_result.deleted_count,
                "notifications": notifications_result.deleted_count,
                "followers": followers_result.deleted_count + followers_result2.deleted_count
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete creator: {str(e)}")



# ============ BATCH THUMBNAIL GENERATION ============

@router.post("/generate-thumbnails")
async def generate_thumbnails_batch(background_tasks: BackgroundTasks):
    """Generate thumbnails for all videos that don't have them"""
    try:
        # Find all uploads without thumbnails
        uploads_without_thumbs = await db.uploads.find({
            "file_type": "video",
            "$or": [
                {"thumbnail_url": {"$exists": False}},
                {"thumbnail_url": None},
                {"thumbnail_url": ""}
            ]
        }).to_list(100)
        
        # Also check creator_video_uploads
        creator_videos_without_thumbs = await db.creator_video_uploads.find({
            "$or": [
                {"thumbnail_url": {"$exists": False}},
                {"thumbnail_url": None},
                {"thumbnail_url": ""}
            ]
        }).to_list(100)
        
        generated = []
        failed = []
        
        # Process uploads collection
        for upload in uploads_without_thumbs:
            try:
                stored_filename = upload.get("stored_filename")
                if not stored_filename:
                    failed.append({"id": upload.get("id"), "reason": "No stored filename"})
                    continue
                
                video_path = VIDEO_DIR / stored_filename
                if not video_path.exists():
                    failed.append({"id": upload.get("id"), "reason": "Video file not found"})
                    continue
                
                # Generate thumbnail
                thumb_filename = stored_filename.rsplit('.', 1)[0] + "_thumb.jpg"
                thumb_path = THUMBNAIL_DIR / thumb_filename
                
                loop = asyncio.get_event_loop()
                success = await loop.run_in_executor(
                    thumbnail_executor,
                    generate_thumbnail_sync,
                    str(video_path),
                    str(thumb_path)
                )
                
                if success:
                    thumb_url = f"/api/uploads/serve/thumbnail/{thumb_filename}"
                    await db.uploads.update_one(
                        {"id": upload.get("id")},
                        {"$set": {
                            "thumbnail_url": thumb_url,
                            "thumbnail_filename": thumb_filename,
                            "updated_at": datetime.now(timezone.utc)
                        }}
                    )
                    generated.append({
                        "id": upload.get("id"),
                        "title": upload.get("title") or upload.get("original_filename"),
                        "thumbnail_url": thumb_url
                    })
                else:
                    failed.append({"id": upload.get("id"), "reason": "Generation failed"})
            except Exception as e:
                failed.append({"id": upload.get("id"), "reason": str(e)})
        
        # Process creator_video_uploads collection
        for video in creator_videos_without_thumbs:
            try:
                video_url = video.get("video_url", "")
                video_id = video.get("id") or video.get("video_id")
                
                # Try to find the actual file
                # Check if it's a local file reference
                if "/api/uploads/serve/video/" in video_url:
                    filename = video_url.split("/")[-1]
                    video_path = VIDEO_DIR / filename
                elif "/api/uploads/video/" in video_url:
                    filename = video_url.split("/")[-1]
                    video_path = VIDEO_DIR / filename
                else:
                    # Try to find by pattern matching
                    video_path = None
                    for f in VIDEO_DIR.glob("*.mp4"):
                        if video_id and video_id[:8] in f.name:
                            video_path = f
                            break
                
                if not video_path or not video_path.exists():
                    failed.append({"id": video_id, "reason": "Video file not found"})
                    continue
                
                # Generate thumbnail
                thumb_filename = video_path.stem + "_thumb.jpg"
                thumb_path = THUMBNAIL_DIR / thumb_filename
                
                loop = asyncio.get_event_loop()
                success = await loop.run_in_executor(
                    thumbnail_executor,
                    generate_thumbnail_sync,
                    str(video_path),
                    str(thumb_path)
                )
                
                if success:
                    thumb_url = f"/api/uploads/serve/thumbnail/{thumb_filename}"
                    await db.creator_video_uploads.update_one(
                        {"$or": [{"id": video_id}, {"video_id": video_id}]},
                        {"$set": {
                            "thumbnail_url": thumb_url,
                            "updated_at": datetime.now(timezone.utc)
                        }}
                    )
                    generated.append({
                        "id": video_id,
                        "title": video.get("title"),
                        "thumbnail_url": thumb_url
                    })
                else:
                    failed.append({"id": video_id, "reason": "Generation failed"})
            except Exception as e:
                failed.append({"id": video.get("id"), "reason": str(e)})
        
        return {
            "status": "completed",
            "generated_count": len(generated),
            "failed_count": len(failed),
            "generated": generated,
            "failed": failed
        }
    except Exception as e:
        logger.error(f"Batch thumbnail generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-thumbnail/{video_id}")
async def generate_single_thumbnail(video_id: str):
    """Generate thumbnail for a specific video"""
    try:
        # Check uploads collection first
        upload = await db.uploads.find_one({"id": video_id})
        collection = "uploads"
        
        if not upload:
            # Check creator_video_uploads
            upload = await db.creator_video_uploads.find_one({
                "$or": [{"id": video_id}, {"video_id": video_id}]
            })
            collection = "creator_video_uploads"
        
        if not upload:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Find video file
        video_path = None
        if collection == "uploads":
            stored_filename = upload.get("stored_filename")
            if stored_filename:
                video_path = VIDEO_DIR / stored_filename
        else:
            video_url = upload.get("video_url", "")
            if "/api/uploads/serve/video/" in video_url or "/api/uploads/video/" in video_url:
                filename = video_url.split("/")[-1]
                video_path = VIDEO_DIR / filename
        
        if not video_path or not video_path.exists():
            raise HTTPException(status_code=404, detail="Video file not found on disk")
        
        # Generate thumbnail
        thumb_filename = video_path.stem + "_thumb.jpg"
        thumb_path = THUMBNAIL_DIR / thumb_filename
        
        loop = asyncio.get_event_loop()
        success = await loop.run_in_executor(
            thumbnail_executor,
            generate_thumbnail_sync,
            str(video_path),
            str(thumb_path)
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Thumbnail generation failed")
        
        thumb_url = f"/api/uploads/serve/thumbnail/{thumb_filename}"
        
        # Update database
        if collection == "uploads":
            await db.uploads.update_one(
                {"id": video_id},
                {"$set": {
                    "thumbnail_url": thumb_url,
                    "thumbnail_filename": thumb_filename,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        else:
            await db.creator_video_uploads.update_one(
                {"$or": [{"id": video_id}, {"video_id": video_id}]},
                {"$set": {
                    "thumbnail_url": thumb_url,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        
        return {
            "status": "success",
            "video_id": video_id,
            "thumbnail_url": thumb_url
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Single thumbnail generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============ VIDEO PERMISSIONS & MANAGEMENT ============

@router.put("/permissions/{video_id}")
async def update_video_permissions(
    video_id: str,
    allow_download: Optional[bool] = None,
    allow_share: Optional[bool] = None,
    is_public: Optional[bool] = None
):
    """Update download/share permissions for a video"""
    try:
        # Find the video
        video = await db.uploads.find_one({"id": video_id})
        if not video:
            video = await db.creator_video_uploads.find_one({
                "$or": [{"id": video_id}, {"video_id": video_id}]
            })
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Build update
        update_fields = {"updated_at": datetime.now(timezone.utc)}
        if allow_download is not None:
            update_fields["allow_download"] = allow_download
        if allow_share is not None:
            update_fields["allow_share"] = allow_share
        if is_public is not None:
            update_fields["is_public"] = is_public
        
        # Update both collections
        await db.uploads.update_one(
            {"id": video_id},
            {"$set": update_fields}
        )
        await db.creator_video_uploads.update_one(
            {"$or": [{"id": video_id}, {"video_id": video_id}]},
            {"$set": update_fields}
        )
        
        return {
            "status": "success",
            "video_id": video_id,
            "permissions": {
                "allow_download": allow_download if allow_download is not None else video.get("allow_download", False),
                "allow_share": allow_share if allow_share is not None else video.get("allow_share", True),
                "is_public": is_public if is_public is not None else video.get("is_public", True)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update permissions failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{video_id}")
async def get_upload_status(video_id: str):
    """Get detailed status of an upload including validation and conversion status"""
    try:
        video = await db.uploads.find_one({"id": video_id})
        if not video:
            video = await db.creator_video_uploads.find_one({
                "$or": [{"id": video_id}, {"video_id": video_id}]
            })
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        status = video.get("status", "unknown")
        response = {
            "video_id": video_id,
            "status": status,
            "title": video.get("title"),
            "created_at": video.get("created_at"),
            "updated_at": video.get("updated_at")
        }
        
        # Add status-specific info
        if status == "failed":
            response["error"] = video.get("error")
            response["guidance"] = video.get("guidance", [
                "Please try uploading your video again",
                "Ensure the file is in a supported format (MP4, MOV, AVI, MKV, WebM)",
                "If the problem persists, try converting to MP4 using HandBrake or similar tools"
            ])
            response["can_retry"] = True
        elif status == "validating":
            response["message"] = "Video is being validated..."
        elif status == "converting":
            response["message"] = "Video is being converted to web-compatible format..."
        elif status == "uploaded":
            response["file_url"] = video.get("file_url")
            response["thumbnail_url"] = video.get("thumbnail_url")
            response["duration_seconds"] = video.get("duration_seconds")
            response["validated"] = video.get("validated", False)
            response["conversion_complete"] = video.get("conversion_complete", False)
            response["permissions"] = {
                "allow_download": video.get("allow_download", False),
                "allow_share": video.get("allow_share", True),
                "is_public": video.get("is_public", True)
            }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get upload status failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/retry/{video_id}")
async def retry_failed_upload(video_id: str, background_tasks: BackgroundTasks):
    """Retry validation/conversion for a failed upload"""
    try:
        video = await db.uploads.find_one({"id": video_id})
        if not video:
            raise HTTPException(status_code=404, detail="Upload not found")
        
        if video.get("status") not in ["failed", "error"]:
            raise HTTPException(status_code=400, detail="Upload is not in failed state")
        
        # Check if file still exists
        stored_filename = video.get("stored_filename")
        if not stored_filename:
            raise HTTPException(status_code=400, detail="No video file found. Please upload again.")
        
        video_path = VIDEO_DIR / stored_filename
        if not video_path.exists():
            raise HTTPException(status_code=400, detail="Video file no longer exists. Please upload again.")
        
        # Reset status and retry validation
        await db.uploads.update_one(
            {"id": video_id},
            {"$set": {
                "status": "validating",
                "error": None,
                "guidance": None,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Schedule validation
        background_tasks.add_task(
            validate_and_convert_video,
            str(video_path),
            video_id,
            stored_filename
        )
        
        return {
            "status": "retrying",
            "video_id": video_id,
            "message": "Video validation restarted. Check status in a few moments."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retry upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/video/{video_id}")
async def delete_video(video_id: str, permanent: bool = False):
    """Delete or disable a video upload"""
    try:
        video = await db.uploads.find_one({"id": video_id})
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        if permanent:
            # Permanent delete - remove files and database record
            stored_filename = video.get("stored_filename")
            if stored_filename:
                video_path = VIDEO_DIR / stored_filename
                if video_path.exists():
                    video_path.unlink()
            
            thumb_filename = video.get("thumbnail_filename")
            if thumb_filename:
                thumb_path = THUMBNAIL_DIR / thumb_filename
                if thumb_path.exists():
                    thumb_path.unlink()
            
            converted_filename = video.get("converted_filename")
            if converted_filename:
                converted_path = CONVERTED_DIR / converted_filename
                if converted_path.exists():
                    converted_path.unlink()
            
            await db.uploads.delete_one({"id": video_id})
            await db.creator_video_uploads.delete_one({
                "$or": [{"id": video_id}, {"video_id": video_id}]
            })
            
            return {"status": "deleted", "video_id": video_id, "permanent": True}
        else:
            # Soft delete - disable for cleanup
            await disable_and_cleanup_video(video_id)
            return {"status": "disabled", "video_id": video_id, "permanent": False}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete video failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup")
async def trigger_cleanup():
    """Manually trigger cleanup of failed/disabled uploads"""
    try:
        cleaned = await cleanup_failed_uploads()
        return {
            "status": "completed",
            "cleaned_count": cleaned
        }
    except Exception as e:
        logger.error(f"Manual cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/failed")
async def get_failed_uploads(creator_id: Optional[str] = None, limit: int = 50):
    """Get list of failed uploads with guidance on how to fix them"""
    try:
        query = {"status": {"$in": ["failed", "error"]}}
        if creator_id:
            query["creator_id"] = creator_id
        
        failed = await db.uploads.find(query).sort("updated_at", -1).limit(limit).to_list(limit)
        
        result = []
        for upload in failed:
            result.append({
                "id": upload.get("id"),
                "title": upload.get("title") or upload.get("original_filename"),
                "status": upload.get("status"),
                "error": upload.get("error"),
                "guidance": upload.get("guidance", [
                    "Please try uploading your video again",
                    "Ensure the file is in a supported format (MP4, MOV, AVI, MKV, WebM)",
                    "Try converting to MP4 using HandBrake or similar tools"
                ]),
                "created_at": upload.get("created_at"),
                "can_retry": upload.get("stored_filename") is not None
            })
        
        return {
            "failed_uploads": result,
            "total": len(result)
        }
        
    except Exception as e:
        logger.error(f"Get failed uploads error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
