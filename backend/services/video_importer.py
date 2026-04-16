"""
ZTVLIVE Video Importer Service
Imports videos from TikTok, YouTube Shorts, Instagram Reels
Auto-reframes vertical (9:16) to horizontal (16:9) with blur background
"""

import os
import re
import uuid
import subprocess
import asyncio
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple
from enum import Enum
import yt_dlp

# Storage paths
UPLOAD_DIR = "/app/backend/uploads"
PROCESSED_DIR = "/app/backend/uploads/processed"

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)


class VideoSource(Enum):
    TIKTOK = "tiktok"
    YOUTUBE_SHORTS = "youtube_shorts"
    INSTAGRAM_REELS = "instagram_reels"
    UNKNOWN = "unknown"


class OutputResolution(Enum):
    HD_720 = "1280x720"
    FULL_HD_1080 = "1920x1080"
    UHD_4K = "3840x2160"


def detect_source(url: str) -> VideoSource:
    """Detect the source platform from URL"""
    url_lower = url.lower()
    
    if "tiktok.com" in url_lower:
        return VideoSource.TIKTOK
    elif "youtube.com/shorts" in url_lower or "youtu.be" in url_lower:
        return VideoSource.YOUTUBE_SHORTS
    elif "instagram.com" in url_lower and ("reel" in url_lower or "/p/" in url_lower):
        return VideoSource.INSTAGRAM_REELS
    
    return VideoSource.UNKNOWN


def extract_video_id(url: str, source: VideoSource) -> Optional[str]:
    """Extract video ID from URL"""
    try:
        if source == VideoSource.TIKTOK:
            # TikTok: /video/1234567890 or /@user/video/1234567890
            match = re.search(r'/video/(\d+)', url)
            if match:
                return match.group(1)
        
        elif source == VideoSource.YOUTUBE_SHORTS:
            # YouTube Shorts: /shorts/ABC123 or youtu.be/ABC123
            match = re.search(r'(?:shorts/|youtu\.be/)([a-zA-Z0-9_-]+)', url)
            if match:
                return match.group(1)
        
        elif source == VideoSource.INSTAGRAM_REELS:
            # Instagram: /reel/ABC123/ or /p/ABC123/
            match = re.search(r'(?:/reel/|/p/)([a-zA-Z0-9_-]+)', url)
            if match:
                return match.group(1)
    except Exception:
        pass
    
    return None


async def download_video(url: str) -> Dict:
    """
    Download video from TikTok, YouTube Shorts, or Instagram Reels
    Returns metadata and file path
    """
    source = detect_source(url)
    if source == VideoSource.UNKNOWN:
        raise ValueError("Unsupported URL. Please use TikTok, YouTube Shorts, or Instagram Reels links.")
    
    video_id = extract_video_id(url, source)
    unique_id = f"{source.value}_{video_id or uuid.uuid4().hex[:8]}"
    output_path = os.path.join(UPLOAD_DIR, f"{unique_id}.mp4")
    
    # yt-dlp options with better headers for TikTok/Instagram
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'outtmpl': output_path.replace('.mp4', '.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.tiktok.com/',
        },
    }
    
    # TikTok-specific options
    if source == VideoSource.TIKTOK:
        ydl_opts['extractor_args'] = {'tiktok': {'app_version': '26.1.3'}}
    
    # Add cookies for Instagram (may be needed)
    if source == VideoSource.INSTAGRAM_REELS:
        ydl_opts['cookiesfrombrowser'] = ('chrome',)  # Try browser cookies
    
    try:
        # Run in thread pool to not block
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, lambda: _download_sync(url, ydl_opts))
        
        # Find the actual downloaded file
        actual_path = output_path.replace('.mp4', f".{info.get('ext', 'mp4')}")
        if not os.path.exists(actual_path):
            # Try without extension change
            actual_path = output_path
        
        if not os.path.exists(actual_path):
            raise FileNotFoundError(f"Downloaded file not found at {actual_path}")
        
        return {
            "success": True,
            "source": source.value,
            "video_id": video_id,
            "unique_id": unique_id,
            "file_path": actual_path,
            "title": info.get('title', 'Untitled'),
            "duration": info.get('duration', 0),
            "uploader": info.get('uploader', 'Unknown'),
            "thumbnail": info.get('thumbnail', ''),
            "original_url": url,
            "width": info.get('width', 0),
            "height": info.get('height', 0),
        }
    
    except Exception as e:
        error_msg = str(e)
        
        # Provide more helpful error messages
        if "blocked" in error_msg.lower() or "IP" in error_msg:
            error_msg = "TikTok is blocking our server. Please try: 1) YouTube Shorts instead, 2) A full TikTok URL (not shortened), or 3) Download the video and upload directly."
        elif "Unsupported URL" in error_msg:
            error_msg = "Could not access this video. Try using the full video URL instead of a shortened link."
        elif "private" in error_msg.lower():
            error_msg = "This video is private. Please make sure the video is public."
        
        return {
            "success": False,
            "error": error_msg,
            "source": source.value,
            "suggestion": "Try YouTube Shorts - they work more reliably. Or download the video first and upload it directly."
        }


def _download_sync(url: str, ydl_opts: dict) -> dict:
    """Synchronous download helper"""
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return info


def get_video_dimensions(file_path: str) -> Tuple[int, int]:
    """Get video width and height using ffprobe"""
    cmd = [
        'ffprobe', '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-of', 'csv=p=0',
        file_path
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            parts = result.stdout.strip().split(',')
            if len(parts) >= 2:
                return int(parts[0]), int(parts[1])
    except Exception:
        pass
    
    return 0, 0


async def reframe_video(
    input_path: str,
    output_resolution: OutputResolution = OutputResolution.FULL_HD_1080,
    blur_background: bool = True
) -> Dict:
    """
    Reframe vertical video (9:16) to horizontal (16:9) with blur background
    
    Args:
        input_path: Path to input video
        output_resolution: Target resolution (720p, 1080p, or 4K)
        blur_background: If True, adds blurred background; if False, uses black bars
    
    Returns:
        Dict with success status and output path
    """
    if not os.path.exists(input_path):
        return {"success": False, "error": "Input file not found"}
    
    # Get original dimensions
    width, height = get_video_dimensions(input_path)
    
    # Determine if video is vertical
    is_vertical = height > width
    
    # Parse output resolution
    out_width, out_height = map(int, output_resolution.value.split('x'))
    
    # Generate output filename
    basename = os.path.basename(input_path)
    name, ext = os.path.splitext(basename)
    output_path = os.path.join(PROCESSED_DIR, f"{name}_reframed_{out_width}x{out_height}.mp4")
    
    try:
        if is_vertical and blur_background:
            # Reframe with blur background
            # Step 1: Create blurred, scaled background
            # Step 2: Overlay original video centered
            filter_complex = (
                f"[0:v]scale={out_width}:{out_height}:force_original_aspect_ratio=increase,"
                f"crop={out_width}:{out_height},boxblur=20:5[bg];"
                f"[0:v]scale=-1:{out_height}:force_original_aspect_ratio=decrease[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2"
            )
            
            cmd = [
                'ffmpeg', '-y', '-i', input_path,
                '-filter_complex', filter_complex,
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                '-c:a', 'aac', '-b:a', '128k',
                '-movflags', '+faststart',
                output_path
            ]
        
        elif is_vertical:
            # Black bars (pillarbox)
            cmd = [
                'ffmpeg', '-y', '-i', input_path,
                '-vf', f'scale={out_width}:{out_height}:force_original_aspect_ratio=decrease,'
                       f'pad={out_width}:{out_height}:(ow-iw)/2:(oh-ih)/2:black',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                '-c:a', 'aac', '-b:a', '128k',
                '-movflags', '+faststart',
                output_path
            ]
        
        else:
            # Video is already horizontal, just scale to target resolution
            cmd = [
                'ffmpeg', '-y', '-i', input_path,
                '-vf', f'scale={out_width}:{out_height}:force_original_aspect_ratio=decrease,'
                       f'pad={out_width}:{out_height}:(ow-iw)/2:(oh-ih)/2:black',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                '-c:a', 'aac', '-b:a', '128k',
                '-movflags', '+faststart',
                output_path
            ]
        
        # Run FFmpeg
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        )
        
        if result.returncode != 0:
            return {
                "success": False,
                "error": f"FFmpeg error: {result.stderr[:500]}"
            }
        
        # Get output file info
        out_width_actual, out_height_actual = get_video_dimensions(output_path)
        
        return {
            "success": True,
            "output_path": output_path,
            "original_dimensions": f"{width}x{height}",
            "output_dimensions": f"{out_width_actual}x{out_height_actual}",
            "was_vertical": is_vertical,
            "blur_background": blur_background,
        }
    
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Video processing timed out (5 min limit)"}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def import_and_process_video(
    url: str,
    output_resolution: str = "1920x1080",
    blur_background: bool = True
) -> Dict:
    """
    Complete pipeline: Download → Detect dimensions → Reframe → Return processed video
    
    Args:
        url: TikTok, YouTube Shorts, or Instagram Reels URL
        output_resolution: Target resolution ("1280x720", "1920x1080", "3840x2160")
        blur_background: Use blur background instead of black bars
    
    Returns:
        Dict with video metadata and processed file path
    """
    # Step 1: Download
    download_result = await download_video(url)
    
    if not download_result.get("success"):
        return download_result
    
    # Step 2: Determine resolution enum
    resolution_map = {
        "1280x720": OutputResolution.HD_720,
        "1920x1080": OutputResolution.FULL_HD_1080,
        "3840x2160": OutputResolution.UHD_4K,
    }
    resolution = resolution_map.get(output_resolution, OutputResolution.FULL_HD_1080)
    
    # Step 3: Reframe
    reframe_result = await reframe_video(
        download_result["file_path"],
        resolution,
        blur_background
    )
    
    if not reframe_result.get("success"):
        return {
            **download_result,
            "reframe_error": reframe_result.get("error"),
            "processed": False
        }
    
    # Combine results
    # Convert file path to URL path for serving
    processed_filename = os.path.basename(reframe_result["output_path"])
    video_url = f"/api/processed-videos/{processed_filename}"
    
    return {
        "success": True,
        "source": download_result["source"],
        "title": download_result["title"],
        "uploader": download_result["uploader"],
        "duration": download_result["duration"],
        "thumbnail": download_result["thumbnail"],
        "original_url": url,
        "original_path": download_result["file_path"],
        "processed_path": reframe_result["output_path"],
        "video_url": video_url,  # URL to serve the processed video
        "original_dimensions": reframe_result["original_dimensions"],
        "output_dimensions": reframe_result["output_dimensions"],
        "was_vertical": reframe_result["was_vertical"],
        "blur_background": reframe_result["blur_background"],
        "processed": True,
    }
