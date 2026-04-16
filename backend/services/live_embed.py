"""
ZTVLIVE Live Stream Embed Service
Embed YouTube Live, Facebook Live, and Instagram Live streams
No RTMP needed - just paste a link!
"""

import re
from typing import Dict, Optional
from enum import Enum
from datetime import datetime, timezone


class LivePlatform(Enum):
    YOUTUBE = "youtube"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    UNKNOWN = "unknown"


def detect_live_platform(url: str) -> LivePlatform:
    """Detect the live streaming platform from URL"""
    url_lower = url.lower()
    
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return LivePlatform.YOUTUBE
    elif "facebook.com" in url_lower or "fb.watch" in url_lower:
        return LivePlatform.FACEBOOK
    elif "instagram.com" in url_lower:
        return LivePlatform.INSTAGRAM
    
    return LivePlatform.UNKNOWN


def extract_youtube_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from various URL formats"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/v\/([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None


def extract_facebook_video_id(url: str) -> Optional[str]:
    """Extract Facebook video ID from URL"""
    patterns = [
        r'facebook\.com\/.*\/videos\/(\d+)',
        r'facebook\.com\/watch\/?\?v=(\d+)',
        r'facebook\.com\/.*\/live\/(\d+)',
        r'fb\.watch\/([a-zA-Z0-9_-]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None


def extract_instagram_id(url: str) -> Optional[str]:
    """Extract Instagram live/video ID from URL"""
    patterns = [
        r'instagram\.com\/[^\/]+\/live',  # Live streams
        r'instagram\.com\/p\/([a-zA-Z0-9_-]+)',
        r'instagram\.com\/tv\/([a-zA-Z0-9_-]+)',
        r'instagram\.com\/reel\/([a-zA-Z0-9_-]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            if match.groups():
                return match.group(1)
            return "live"
    
    return None


def generate_youtube_embed(video_id: str, autoplay: bool = True) -> Dict:
    """Generate YouTube embed code for live stream"""
    autoplay_param = "1" if autoplay else "0"
    
    embed_url = f"https://www.youtube.com/embed/{video_id}?autoplay={autoplay_param}&mute=0&rel=0&modestbranding=1"
    
    iframe_code = f'''<iframe 
    width="100%" 
    height="100%" 
    src="{embed_url}" 
    title="YouTube Live Stream" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
    allowfullscreen>
</iframe>'''
    
    return {
        "success": True,
        "platform": "youtube",
        "video_id": video_id,
        "embed_url": embed_url,
        "iframe_code": iframe_code,
        "direct_url": f"https://www.youtube.com/watch?v={video_id}",
    }


def generate_facebook_embed(video_id: str, autoplay: bool = True) -> Dict:
    """Generate Facebook embed code for live stream"""
    # Facebook uses their video embed plugin
    embed_url = f"https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D{video_id}&show_text=false&autoplay={'true' if autoplay else 'false'}"
    
    iframe_code = f'''<iframe 
    src="{embed_url}" 
    width="100%" 
    height="100%" 
    style="border:none;overflow:hidden" 
    scrolling="no" 
    frameborder="0" 
    allowfullscreen="true" 
    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share">
</iframe>'''
    
    return {
        "success": True,
        "platform": "facebook",
        "video_id": video_id,
        "embed_url": embed_url,
        "iframe_code": iframe_code,
        "direct_url": f"https://www.facebook.com/watch/?v={video_id}",
    }


def generate_instagram_embed(post_id: str) -> Dict:
    """
    Generate Instagram embed info
    Note: Instagram live streams cannot be embedded directly.
    For regular posts/reels, we can use their embed endpoint.
    """
    if post_id == "live":
        return {
            "success": False,
            "platform": "instagram",
            "error": "Instagram Live cannot be embedded directly. Please use Instagram's 'Share to Facebook' feature to stream to Facebook, then embed the Facebook stream.",
            "workaround": "Stream to Facebook Live simultaneously and embed that instead.",
        }
    
    # For regular Instagram posts/reels
    embed_url = f"https://www.instagram.com/p/{post_id}/embed"
    
    iframe_code = f'''<iframe 
    src="{embed_url}" 
    width="100%" 
    height="100%" 
    frameborder="0" 
    scrolling="no" 
    allowtransparency="true">
</iframe>'''
    
    return {
        "success": True,
        "platform": "instagram",
        "post_id": post_id,
        "embed_url": embed_url,
        "iframe_code": iframe_code,
        "direct_url": f"https://www.instagram.com/p/{post_id}/",
        "note": "Instagram Live cannot be embedded. This embeds the post/reel instead.",
    }


def get_live_embed(url: str, autoplay: bool = True) -> Dict:
    """
    Main function to get embed code from any supported live stream URL
    
    Args:
        url: YouTube Live, Facebook Live, or Instagram URL
        autoplay: Whether to autoplay the stream
    
    Returns:
        Dict with embed code, iframe HTML, and metadata
    """
    platform = detect_live_platform(url)
    
    if platform == LivePlatform.UNKNOWN:
        return {
            "success": False,
            "error": "Unsupported platform. Please use YouTube Live, Facebook Live, or Instagram links.",
            "supported_platforms": ["YouTube Live", "Facebook Live", "Instagram (posts/reels only)"],
        }
    
    if platform == LivePlatform.YOUTUBE:
        video_id = extract_youtube_video_id(url)
        if not video_id:
            return {"success": False, "error": "Could not extract YouTube video ID from URL"}
        return generate_youtube_embed(video_id, autoplay)
    
    elif platform == LivePlatform.FACEBOOK:
        video_id = extract_facebook_video_id(url)
        if not video_id:
            return {"success": False, "error": "Could not extract Facebook video ID from URL"}
        return generate_facebook_embed(video_id, autoplay)
    
    elif platform == LivePlatform.INSTAGRAM:
        post_id = extract_instagram_id(url)
        if not post_id:
            return {"success": False, "error": "Could not extract Instagram post ID from URL"}
        return generate_instagram_embed(post_id)
    
    return {"success": False, "error": "Unknown error occurred"}


# Database model for creator live sessions
def create_live_session(
    creator_id: str,
    platform: str,
    embed_url: str,
    original_url: str,
    title: str = "Live Stream"
) -> Dict:
    """Create a live session record for a creator"""
    return {
        "creator_id": creator_id,
        "platform": platform,
        "embed_url": embed_url,
        "original_url": original_url,
        "title": title,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "is_live": True,
        "viewer_count": 0,
    }
