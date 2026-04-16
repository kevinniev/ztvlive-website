"""
ZTVLIVE RTMP Restreamer Service
Streams scheduled content to Castr RTMP for 24/7 broadcasting.

This service:
1. Gets the current video from the schedule
2. Downloads/streams it via FFmpeg to RTMP
3. Handles transitions between videos
4. Runs continuously in the background
"""

import asyncio
import subprocess
import logging
import os
import signal
import sys
from datetime import datetime, timezone
from typing import Optional, Dict
import httpx
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rtmp_restreamer")

# RTMP Configuration - Castr
RTMP_CONFIG = {
    "url": "rtmp://us-west.castr.io/static",
    "stream_key": "live_b8b938d0c6b811eab6745b4605902bfa?password=2cee9565",
}

# Full RTMP destination
RTMP_DESTINATION = f"{RTMP_CONFIG['url']}/{RTMP_CONFIG['stream_key']}"

# Backend API URL
API_BASE_URL = os.environ.get("API_URL", "http://localhost:8001/api")

# Global state
_current_process: Optional[subprocess.Popen] = None
_is_running = False
_current_video_id = None


def get_youtube_stream_url(video_id: str) -> Optional[str]:
    """Get the best streamable URL for a YouTube video using yt-dlp"""
    try:
        # Set up environment with deno path
        env = os.environ.copy()
        env["PATH"] = "/root/.deno/bin:" + env.get("PATH", "")
        
        # Use yt-dlp to get stream URL
        result = subprocess.run(
            [
                "yt-dlp",
                "--js-runtimes", "deno",
                "-f", "best[height<=720]/best",  # Max 720p for bandwidth, fallback to best
                "-g",  # Get URL only
                "--no-warnings",
                f"https://www.youtube.com/watch?v={video_id}"
            ],
            capture_output=True,
            text=True,
            timeout=30,
            env=env
        )
        
        if result.returncode == 0 and result.stdout.strip():
            url = result.stdout.strip().split('\n')[0]  # Get first URL
            logger.info(f"Got stream URL for {video_id}")
            return url
        else:
            logger.error(f"yt-dlp error for {video_id}: {result.stderr[:200]}")
            return None
    except subprocess.TimeoutExpired:
        logger.error(f"Timeout getting stream URL for {video_id}")
        return None
    except Exception as e:
        logger.error(f"Error getting stream URL: {e}")
        return None


async def get_current_content() -> Optional[Dict]:
    """Fetch current scheduled content from API"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{API_BASE_URL}/tv/sync", timeout=10)
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.error(f"Error fetching content: {e}")
    return None


def start_ffmpeg_stream(video_url: str, duration: Optional[int] = None) -> subprocess.Popen:
    """Start FFmpeg process to stream video to RTMP"""
    
    ffmpeg_cmd = [
        "ffmpeg",
        "-re",  # Read input at native frame rate
        "-i", video_url,  # Input URL
        "-c:v", "libx264",  # Video codec
        "-preset", "veryfast",  # Encoding speed
        "-maxrate", "2500k",  # Max bitrate
        "-bufsize", "5000k",  # Buffer size
        "-pix_fmt", "yuv420p",  # Pixel format
        "-g", "50",  # Keyframe interval
        "-c:a", "aac",  # Audio codec
        "-b:a", "128k",  # Audio bitrate
        "-ar", "44100",  # Audio sample rate
        "-f", "flv",  # Output format
        RTMP_DESTINATION  # RTMP destination
    ]
    
    # Add duration if specified
    if duration:
        ffmpeg_cmd.insert(1, "-t")
        ffmpeg_cmd.insert(2, str(duration))
    
    logger.info(f"Starting FFmpeg stream to {RTMP_CONFIG['url']}")
    
    process = subprocess.Popen(
        ffmpeg_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.PIPE
    )
    
    return process


def stop_ffmpeg_stream():
    """Stop the current FFmpeg process"""
    global _current_process
    
    if _current_process:
        logger.info("Stopping FFmpeg stream...")
        _current_process.terminate()
        try:
            _current_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _current_process.kill()
        _current_process = None


async def stream_loop():
    """Main streaming loop - continuously streams scheduled content"""
    global _current_process, _is_running, _current_video_id
    
    _is_running = True
    logger.info("Starting RTMP restreamer loop...")
    
    failed_videos = set()  # Track videos that failed to stream
    consecutive_failures = 0
    max_consecutive_failures = 5
    
    while _is_running:
        try:
            # Get current scheduled content
            content = await get_current_content()
            
            if not content or not content.get("video_id"):
                logger.warning("No content available, waiting...")
                await asyncio.sleep(10)
                continue
            
            video_id = content.get("video_id")
            title = content.get("title", "Unknown")
            remaining = content.get("remaining_seconds", 300)
            
            # Skip if this video already failed
            if video_id in failed_videos:
                logger.info(f"Skipping previously failed video: {video_id}")
                await asyncio.sleep(5)  # Wait for schedule to advance
                continue
            
            # Check if video changed
            if video_id != _current_video_id:
                logger.info(f"New video: {title} (ID: {video_id})")
                
                # Stop current stream
                stop_ffmpeg_stream()
                
                # Get stream URL
                stream_url = get_youtube_stream_url(video_id)
                
                if stream_url:
                    # Start streaming this video
                    _current_process = start_ffmpeg_stream(stream_url, remaining + 10)  # Add buffer
                    _current_video_id = video_id
                    consecutive_failures = 0
                    logger.info(f"Streaming: {title} for ~{remaining}s")
                else:
                    logger.warning(f"Could not get stream URL for {video_id}, marking as failed")
                    failed_videos.add(video_id)
                    consecutive_failures += 1
                    
                    if consecutive_failures >= max_consecutive_failures:
                        logger.error(f"Too many consecutive failures ({consecutive_failures}), waiting...")
                        await asyncio.sleep(30)
                        consecutive_failures = 0
                        failed_videos.clear()  # Reset failed videos
                    
                    await asyncio.sleep(2)
                    continue
            
            # Wait before checking for next video
            # Check more frequently near the end of the video
            if remaining < 30:
                await asyncio.sleep(5)
            else:
                await asyncio.sleep(15)
            
            # Check if FFmpeg is still running
            if _current_process and _current_process.poll() is not None:
                exit_code = _current_process.poll()
                logger.warning(f"FFmpeg process ended with code {exit_code}, will restart with next video")
                _current_video_id = None
                
        except Exception as e:
            logger.error(f"Error in stream loop: {e}")
            await asyncio.sleep(10)
    
    # Cleanup
    stop_ffmpeg_stream()
    logger.info("RTMP restreamer stopped")


def signal_handler(signum, frame):
    """Handle shutdown signals"""
    global _is_running
    logger.info(f"Received signal {signum}, shutting down...")
    _is_running = False
    stop_ffmpeg_stream()
    sys.exit(0)


async def main():
    """Main entry point"""
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info("=" * 50)
    logger.info("ZTVLIVE RTMP Restreamer")
    logger.info(f"Destination: {RTMP_CONFIG['url']}")
    logger.info("=" * 50)
    
    # Check if yt-dlp is available
    try:
        result = subprocess.run(["yt-dlp", "--version"], capture_output=True, text=True)
        logger.info(f"yt-dlp version: {result.stdout.strip()}")
    except FileNotFoundError:
        logger.error("yt-dlp not found! Installing...")
        subprocess.run(["pip", "install", "yt-dlp"], check=True)
    
    # Start the streaming loop
    await stream_loop()


if __name__ == "__main__":
    asyncio.run(main())
