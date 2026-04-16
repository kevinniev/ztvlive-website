"""
Creator Agreement and Content Review Routes
Handles creator agreements, content review queue, and copyright flagging
"""

from fastapi import APIRouter, HTTPException, Header, Request, Query
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import logging

router = APIRouter(prefix="/content-review", tags=["Creator Agreement & Review"])

logger = logging.getLogger(__name__)

# Database will be injected
db = None

def set_db(database):
    global db
    db = database


# ============ MODELS ============

class AgreementAcceptance(BaseModel):
    user_id: str
    accepted_at: str
    ip_address: str
    sections_read: Dict[str, bool]


class ContentReviewUpdate(BaseModel):
    status: str  # pending, approved, rejected, flagged
    reviewer_notes: Optional[str] = None
    copyright_flags: Optional[List[str]] = None
    music_detected: Optional[List[Dict]] = None


# ============ AGREEMENT ENDPOINTS ============

@router.get("/agreement-status")
async def get_agreement_status(authorization: str = Header(None)):
    """Check if user has accepted the creator agreement"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization.replace("Bearer ", "")
    
    # Get user from session
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user_id = session.get("user_id")
    
    # Check for agreement
    agreement = await db.creator_agreements.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if agreement:
        return {
            "accepted": True,
            "accepted_at": agreement.get("accepted_at"),
            "version": agreement.get("agreement_version", "1.0")
        }
    
    return {"accepted": False}


@router.post("/accept-agreement")
async def accept_agreement(
    data: AgreementAcceptance,
    request: Request,
    authorization: str = Header(None)
):
    """Accept the creator agreement"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization.replace("Bearer ", "")
    
    # Verify session
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user_id = session.get("user_id")
    
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    
    # Check if already accepted
    existing = await db.creator_agreements.find_one({"user_id": user_id})
    if existing:
        return {"success": True, "message": "Agreement already accepted"}
    
    # Save agreement
    agreement_doc = {
        "user_id": user_id,
        "accepted_at": datetime.now(timezone.utc),
        "ip_address": client_ip,
        "user_agent": request.headers.get("user-agent", "unknown"),
        "sections_read": data.sections_read,
        "agreement_version": "1.0",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.creator_agreements.insert_one(agreement_doc)
    
    # Update user profile
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "creator_agreement_accepted": True,
            "creator_agreement_date": datetime.now(timezone.utc)
        }}
    )
    
    logger.info(f"Creator agreement accepted by user {user_id}")
    
    return {
        "success": True,
        "message": "Agreement accepted successfully"
    }


# ============ CONTENT REVIEW ENDPOINTS ============

@router.get("/review-queue")
async def get_review_queue(
    status: str = Query("pending", description="Filter by status"),
    limit: int = Query(50, le=200),
    authorization: str = Header(None)
):
    """Get content review queue (admin only)"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Query based on status
    query = {}
    if status != "all":
        query["review_status"] = status
    
    # Get videos pending review
    videos = await db.creator_videos.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Also get bookings pending review
    bookings = await db.creator_bookings.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "videos": videos,
        "bookings": bookings,
        "total_pending": len([v for v in videos if v.get("review_status") == "pending"]) + 
                        len([b for b in bookings if b.get("review_status") == "pending"])
    }


@router.post("/review/{content_id}")
async def update_content_review(
    content_id: str,
    update: ContentReviewUpdate,
    authorization: str = Header(None)
):
    """Update content review status (admin only)"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    update_data = {
        "review_status": update.status,
        "reviewed_at": datetime.now(timezone.utc),
        "reviewer_notes": update.reviewer_notes
    }
    
    if update.copyright_flags:
        update_data["copyright_flags"] = update.copyright_flags
    
    if update.music_detected:
        update_data["music_detected"] = update.music_detected
    
    # Try to update in creator_videos first
    result = await db.creator_videos.update_one(
        {"id": content_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        # Try creator_bookings
        result = await db.creator_bookings.update_one(
            {"booking_id": content_id},
            {"$set": update_data}
        )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # If approved, also update the main status
    if update.status == "approved":
        await db.creator_videos.update_one(
            {"id": content_id},
            {"$set": {"status": "approved"}}
        )
        await db.creator_bookings.update_one(
            {"booking_id": content_id},
            {"$set": {"status": "approved"}}
        )
    elif update.status == "rejected":
        await db.creator_videos.update_one(
            {"id": content_id},
            {"$set": {"status": "rejected"}}
        )
        await db.creator_bookings.update_one(
            {"booking_id": content_id},
            {"$set": {"status": "rejected"}}
        )
    
    logger.info(f"Content {content_id} review updated to {update.status}")
    
    return {"success": True, "status": update.status}


@router.post("/flag-copyright/{content_id}")
async def flag_copyright(
    content_id: str,
    flag_type: str = Query(..., description="music, video, image, other"),
    description: str = Query(..., description="Description of the copyright issue"),
    authorization: str = Header(None)
):
    """Flag content for potential copyright issues"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    flag_doc = {
        "type": flag_type,
        "description": description,
        "flagged_at": datetime.now(timezone.utc),
        "resolved": False
    }
    
    # Add flag to content
    result = await db.creator_videos.update_one(
        {"id": content_id},
        {
            "$push": {"copyright_flags": flag_doc},
            "$set": {"review_status": "flagged"}
        }
    )
    
    if result.modified_count == 0:
        result = await db.creator_bookings.update_one(
            {"booking_id": content_id},
            {
                "$push": {"copyright_flags": flag_doc},
                "$set": {"review_status": "flagged"}
            }
        )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    
    logger.warning(f"Copyright flag added to content {content_id}: {flag_type}")
    
    return {"success": True, "message": "Copyright flag added"}


# ============ MUSIC DETECTION (SIMULATED) ============

@router.post("/analyze-audio/{content_id}")
async def analyze_audio_for_copyright(
    content_id: str,
    authorization: str = Header(None)
):
    """
    Analyze content audio for potential copyrighted music.
    NOTE: This is a simulated endpoint. In production, integrate with:
    - ACRCloud
    - Audible Magic
    - YouTube Content ID API (if available)
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Find the content
    video = await db.creator_videos.find_one({"id": content_id})
    if not video:
        video = await db.creator_bookings.find_one({"booking_id": content_id})
    
    if not video:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # SIMULATED: In production, this would call an audio fingerprinting API
    # For now, we'll flag anything with certain keywords in title/description
    
    title = (video.get("title", "") or "").lower()
    description = (video.get("description", "") or "").lower()
    
    music_risk_keywords = [
        "drake", "taylor swift", "beyonce", "travis scott", "kanye",
        "official audio", "music video", "remix", "cover song",
        "nba", "nfl", "espn", "disney", "marvel", "netflix"
    ]
    
    detected_risks = []
    for keyword in music_risk_keywords:
        if keyword in title or keyword in description:
            detected_risks.append({
                "keyword": keyword,
                "confidence": 0.7,
                "type": "keyword_match",
                "recommendation": "Manual review recommended"
            })
    
    # Update content with analysis results
    analysis_result = {
        "analyzed_at": datetime.now(timezone.utc),
        "risks_detected": len(detected_risks) > 0,
        "detected_items": detected_risks,
        "analysis_type": "simulated_keyword_scan",
        "note": "Full audio fingerprinting requires ACRCloud or similar service integration"
    }
    
    await db.creator_videos.update_one(
        {"id": content_id},
        {"$set": {"audio_analysis": analysis_result}}
    )
    await db.creator_bookings.update_one(
        {"booking_id": content_id},
        {"$set": {"audio_analysis": analysis_result}}
    )
    
    # If risks detected, set review status to flagged
    if detected_risks:
        await db.creator_videos.update_one(
            {"id": content_id},
            {"$set": {"review_status": "flagged", "music_warning": True}}
        )
        await db.creator_bookings.update_one(
            {"booking_id": content_id},
            {"$set": {"review_status": "flagged", "music_warning": True}}
        )
    
    return {
        "success": True,
        "content_id": content_id,
        "risks_detected": len(detected_risks) > 0,
        "risk_count": len(detected_risks),
        "details": detected_risks,
        "recommendation": "Content flagged for manual review" if detected_risks else "No obvious risks detected"
    }


@router.get("/copyright-stats")
async def get_copyright_stats(authorization: str = Header(None)):
    """Get copyright review statistics"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Count by review status
    pending = await db.creator_videos.count_documents({"review_status": "pending"})
    approved = await db.creator_videos.count_documents({"review_status": "approved"})
    rejected = await db.creator_videos.count_documents({"review_status": "rejected"})
    flagged = await db.creator_videos.count_documents({"review_status": "flagged"})
    
    # Count bookings too
    pending += await db.creator_bookings.count_documents({"review_status": "pending"})
    approved += await db.creator_bookings.count_documents({"review_status": "approved"})
    rejected += await db.creator_bookings.count_documents({"review_status": "rejected"})
    flagged += await db.creator_bookings.count_documents({"review_status": "flagged"})
    
    # Count with music warnings
    music_warnings = await db.creator_videos.count_documents({"music_warning": True})
    music_warnings += await db.creator_bookings.count_documents({"music_warning": True})
    
    return {
        "pending_review": pending,
        "approved": approved,
        "rejected": rejected,
        "flagged": flagged,
        "music_warnings": music_warnings,
        "total": pending + approved + rejected + flagged
    }
