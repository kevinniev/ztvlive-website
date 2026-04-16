"""
ZTVLIVE Copyright Analysis Service
Analyzes content for potential copyright issues using AI and YouTube checks.

Features:
- AI-powered title/description analysis for copyright keywords
- YouTube API copyright status check
- Risk scoring system
- Auto-approval for "safe" content
"""

import os
import re
import httpx
from typing import Dict, Optional, List
from datetime import datetime, timezone

# Known copyright-safe patterns
SAFE_PATTERNS = [
    r"original\s+(content|music|video)",
    r"(my|our)\s+(own|original)",
    r"(created|made|produced)\s+by\s+me",
    r"no\s+copyright",
    r"royalty[\s-]?free",
    r"creative\s+commons",
    r"(cc|cc0|cc-by)",
    r"public\s+domain",
    r"licensed\s+for\s+(use|broadcast)",
]

# High-risk copyright patterns
RISK_PATTERNS = [
    r"(full\s+)?(movie|film|episode)",
    r"(official\s+)?music\s+video",
    r"(concert|live\s+performance)",
    r"(nfl|nba|mlb|nhl|fifa|ufc|wwe)",
    r"(disney|marvel|dc|warner|universal|paramount|sony|netflix)",
    r"(copyright|©|\(c\))\s*\d{4}",
    r"(reupload|re-upload|mirror)",
    r"(full\s+album|soundtrack)",
    r"(tv\s+show|series|episode\s+\d)",
]

# Moderate risk patterns
MODERATE_RISK_PATTERNS = [
    r"(cover|remix|mashup)",
    r"(reaction|review|commentary)",
    r"(gameplay|walkthrough|let's\s+play)",
    r"(trailer|teaser|clip)",
    r"(highlights|compilation)",
]


def analyze_text_for_copyright(title: str, description: str = "") -> Dict:
    """
    Analyze title and description for copyright risk indicators.
    Returns risk assessment with score and flags.
    """
    combined_text = f"{title} {description}".lower()
    
    # Check for safe patterns
    safe_indicators = []
    for pattern in SAFE_PATTERNS:
        if re.search(pattern, combined_text, re.IGNORECASE):
            safe_indicators.append(pattern)
    
    # Check for high-risk patterns
    high_risk_flags = []
    for pattern in RISK_PATTERNS:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            high_risk_flags.append({
                "pattern": pattern,
                "matched": match.group()
            })
    
    # Check for moderate risk patterns
    moderate_risk_flags = []
    for pattern in MODERATE_RISK_PATTERNS:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            moderate_risk_flags.append({
                "pattern": pattern,
                "matched": match.group()
            })
    
    # Calculate risk score (0-100)
    risk_score = 0
    
    # High risk patterns add 25 points each (max 75)
    risk_score += min(len(high_risk_flags) * 25, 75)
    
    # Moderate risk patterns add 10 points each (max 30)
    risk_score += min(len(moderate_risk_flags) * 10, 30)
    
    # Safe indicators reduce risk by 15 points each
    risk_score -= len(safe_indicators) * 15
    
    # Clamp score between 0-100
    risk_score = max(0, min(100, risk_score))
    
    # Determine risk level
    if risk_score >= 50:
        risk_level = "high"
    elif risk_score >= 25:
        risk_level = "moderate"
    else:
        risk_level = "low"
    
    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "high_risk_flags": high_risk_flags,
        "moderate_risk_flags": moderate_risk_flags,
        "safe_indicators": safe_indicators,
        "can_auto_approve": risk_level == "low" and len(high_risk_flags) == 0,
        "requires_review": risk_level in ["high", "moderate"],
        "analysis_timestamp": datetime.now(timezone.utc).isoformat()
    }


async def check_youtube_copyright_status(video_url: str) -> Dict:
    """
    Check YouTube video for copyright status using oEmbed API.
    Returns video metadata and embeddability status.
    """
    # Extract video ID
    video_id = None
    if "youtube.com/watch?v=" in video_url:
        video_id = video_url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in video_url:
        video_id = video_url.split("youtu.be/")[1].split("?")[0]
    elif "youtube.com/embed/" in video_url:
        video_id = video_url.split("embed/")[1].split("?")[0]
    
    if not video_id:
        return {
            "status": "error",
            "message": "Could not extract video ID",
            "embeddable": False
        }
    
    try:
        # Use oEmbed API to check if video is embeddable
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(oembed_url)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "status": "available",
                    "video_id": video_id,
                    "title": data.get("title"),
                    "author_name": data.get("author_name"),
                    "author_url": data.get("author_url"),
                    "thumbnail_url": data.get("thumbnail_url"),
                    "embeddable": True,
                    "provider": "youtube"
                }
            elif response.status_code == 401:
                return {
                    "status": "restricted",
                    "video_id": video_id,
                    "message": "Video is private or restricted",
                    "embeddable": False
                }
            elif response.status_code == 404:
                return {
                    "status": "not_found",
                    "video_id": video_id,
                    "message": "Video not found or removed",
                    "embeddable": False
                }
            else:
                return {
                    "status": "unknown",
                    "video_id": video_id,
                    "message": f"Unexpected status: {response.status_code}",
                    "embeddable": False
                }
                
    except Exception as e:
        return {
            "status": "error",
            "video_id": video_id,
            "message": str(e),
            "embeddable": False
        }


async def analyze_content_with_ai(title: str, description: str) -> Dict:
    """
    Use AI to analyze content for potential copyright issues.
    Returns detailed analysis with recommendations.
    """
    try:
        from emergentintegrations.llm.chat import chat, UserMessage
        
        prompt = f"""Analyze this video content submission for potential copyright issues.

Title: {title}
Description: {description}

Evaluate:
1. Is this likely original content or potentially copyrighted material?
2. Are there any red flags suggesting unauthorized use of copyrighted content?
3. Is this safe for a live TV broadcast without copyright concerns?

Respond with JSON only:
{{
    "is_likely_original": true/false,
    "copyright_concerns": ["list of specific concerns if any"],
    "safe_for_broadcast": true/false,
    "confidence": "high/medium/low",
    "recommendation": "approve/review/reject",
    "reason": "brief explanation"
}}"""

        emergent_key = os.environ.get("EMERGENT_MODEL_API_KEY", "")
        
        response = await chat(
            api_key=emergent_key,
            model="gpt-4o-mini",
            messages=[UserMessage(content=prompt)]
        )
        
        # Parse JSON response
        import json
        response_text = response.content.strip()
        
        # Handle markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        analysis = json.loads(response_text)
        analysis["ai_analyzed"] = True
        analysis["analysis_timestamp"] = datetime.now(timezone.utc).isoformat()
        
        return analysis
        
    except Exception as e:
        return {
            "ai_analyzed": False,
            "error": str(e),
            "recommendation": "review",
            "reason": "AI analysis failed, manual review required"
        }


async def full_copyright_analysis(
    title: str,
    description: str = "",
    video_url: str = None,
    content_type: str = "youtube"
) -> Dict:
    """
    Perform comprehensive copyright analysis combining all methods.
    Returns final recommendation and detailed analysis.
    """
    results = {
        "title": title,
        "content_type": content_type,
        "analyzed_at": datetime.now(timezone.utc).isoformat()
    }
    
    # 1. Text pattern analysis
    text_analysis = analyze_text_for_copyright(title, description)
    results["text_analysis"] = text_analysis
    
    # 2. YouTube copyright check (if applicable)
    if video_url and "youtube" in video_url.lower():
        youtube_check = await check_youtube_copyright_status(video_url)
        results["youtube_check"] = youtube_check
        
        # If video is not embeddable, it's a high risk
        if not youtube_check.get("embeddable"):
            text_analysis["risk_score"] = min(100, text_analysis["risk_score"] + 40)
            text_analysis["risk_level"] = "high"
            text_analysis["can_auto_approve"] = False
    
    # 3. AI analysis (for moderate or unclear cases)
    if text_analysis["risk_level"] in ["moderate", "high"] or text_analysis["risk_score"] > 15:
        ai_analysis = await analyze_content_with_ai(title, description)
        results["ai_analysis"] = ai_analysis
        
        # Adjust based on AI recommendation
        if ai_analysis.get("recommendation") == "approve" and ai_analysis.get("confidence") == "high":
            text_analysis["can_auto_approve"] = True
            text_analysis["risk_level"] = "low"
        elif ai_analysis.get("recommendation") == "reject":
            text_analysis["can_auto_approve"] = False
            text_analysis["risk_level"] = "high"
    
    # Final decision
    can_auto_approve = text_analysis.get("can_auto_approve", False)
    
    # Additional safety checks
    youtube_ok = results.get("youtube_check", {}).get("embeddable", True)
    ai_ok = results.get("ai_analysis", {}).get("safe_for_broadcast", True)
    
    final_can_approve = can_auto_approve and youtube_ok and ai_ok
    
    results["final_decision"] = {
        "can_auto_approve": final_can_approve,
        "risk_level": text_analysis["risk_level"],
        "risk_score": text_analysis["risk_score"],
        "requires_manual_review": not final_can_approve,
        "recommendation": "approve" if final_can_approve else "manual_review"
    }
    
    return results


def get_video_duration_from_upload(file_path: str) -> Optional[int]:
    """
    Get video duration in seconds from uploaded file using ffprobe.
    """
    try:
        import subprocess
        import json
        
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet", "-print_format", "json",
                "-show_format", "-show_streams", file_path
            ],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            duration = data.get("format", {}).get("duration")
            if duration:
                return int(float(duration))
            
            # Try from streams
            for stream in data.get("streams", []):
                if stream.get("duration"):
                    return int(float(stream["duration"]))
        
        return None
        
    except Exception as e:
        print(f"Error getting video duration: {e}")
        return None


async def get_youtube_video_duration(video_url: str) -> Optional[int]:
    """
    Get YouTube video duration using YouTube Data API or page scraping.
    Returns duration in seconds.
    """
    # Extract video ID
    video_id = None
    if "youtube.com/watch?v=" in video_url:
        video_id = video_url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in video_url:
        video_id = video_url.split("youtu.be/")[1].split("?")[0]
    elif "youtube.com/embed/" in video_url:
        video_id = video_url.split("embed/")[1].split("?")[0]
    
    if not video_id:
        return None
    
    try:
        # Try using noembed API which sometimes includes duration
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Try YouTube oEmbed (doesn't have duration but confirms video exists)
            oembed_url = f"https://noembed.com/embed?url=https://www.youtube.com/watch?v={video_id}"
            response = await client.get(oembed_url)
            
            if response.status_code == 200:
                data = response.json()
                # noembed doesn't provide duration directly
                # Return None and let frontend handle it
                return None
        
        return None
        
    except Exception as e:
        print(f"Error getting YouTube duration: {e}")
        return None
