"""
Smart Content Review Automation System
Automatically processes creator submissions, detects issues, and provides guidance

Features:
- Auto-approve clean content
- Detect potential copyright issues
- Generate detailed fix instructions
- Send automated guidance emails
- Track resolution progress
"""

from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import logging
import re

router = APIRouter(prefix="/content-automation", tags=["Content Automation"])

logger = logging.getLogger(__name__)

# Database will be injected
db = None

def set_db(database):
    global db
    db = database


# ============ ISSUE TYPES AND SOLUTIONS ============

ISSUE_SOLUTIONS = {
    "copyrighted_music": {
        "title": "Potential Copyrighted Music Detected",
        "severity": "high",
        "description": "Your content may contain copyrighted music that isn't licensed for TV broadcast.",
        "why_flagged": "We detected keywords or patterns suggesting copyrighted music. Unlike YouTube, TV platforms (Roku, Samsung, etc.) require explicit music licenses.",
        "solutions": [
            {
                "option": "A",
                "title": "Replace the Music",
                "difficulty": "Medium",
                "steps": [
                    "Download your original video file",
                    "Use video editing software (CapCut, DaVinci Resolve, Premiere)",
                    "Remove or mute the copyrighted audio track",
                    "Add royalty-free music from: YouTube Audio Library (free), Epidemic Sound, Artlist, or Uppbeat",
                    "Export and re-upload the clean version"
                ],
                "time_estimate": "30-60 minutes",
                "resources": [
                    {"name": "YouTube Audio Library", "url": "https://studio.youtube.com/channel/UC/music", "note": "Free, no attribution required for most tracks"},
                    {"name": "Uppbeat", "url": "https://uppbeat.io", "note": "Free tier available, attribution required"},
                    {"name": "Pixabay Music", "url": "https://pixabay.com/music", "note": "Free, check individual licenses"}
                ]
            },
            {
                "option": "B",
                "title": "Provide Music License Proof",
                "difficulty": "Easy (if you have it)",
                "steps": [
                    "Gather your music license documentation",
                    "Ensure the license covers 'TV broadcast' or 'streaming distribution'",
                    "Email the license to content@ztvlivestream.com with subject: 'Music License - [Your Video Title]'",
                    "Include: License certificate/receipt, Track name and composer, Your video title"
                ],
                "time_estimate": "10 minutes",
                "note": "Standard YouTube licenses do NOT cover TV broadcast. You need a sync license."
            },
            {
                "option": "C",
                "title": "Use YouTube Embed Instead",
                "difficulty": "Easy",
                "steps": [
                    "Instead of uploading, provide your YouTube video URL",
                    "We'll embed it using YouTube's official player",
                    "YouTube handles all copyright/ContentID",
                    "Go to Upload & Earn > Select 'YouTube Link' option"
                ],
                "time_estimate": "2 minutes",
                "note": "Safest option - YouTube's licenses cover embedded playback"
            }
        ]
    },
    "third_party_content": {
        "title": "Third-Party Content Detected",
        "severity": "high",
        "description": "Your content appears to include clips, footage, or material you may not own.",
        "why_flagged": "We detected references to movies, TV shows, sports broadcasts, or other creators' content.",
        "solutions": [
            {
                "option": "A",
                "title": "Remove Third-Party Clips",
                "difficulty": "Medium",
                "steps": [
                    "Identify all clips that aren't your original footage",
                    "Edit them out or replace with your own footage",
                    "If doing commentary/reaction, use audio-only or brief screenshots instead of video clips",
                    "Re-export and upload the clean version"
                ],
                "time_estimate": "30-90 minutes"
            },
            {
                "option": "B",
                "title": "Obtain Written Permission",
                "difficulty": "Hard",
                "steps": [
                    "Contact the original content owner",
                    "Request written permission for TV/streaming distribution",
                    "Get a signed release or license agreement",
                    "Email documentation to content@ztvlivestream.com"
                ],
                "time_estimate": "Days to weeks",
                "note": "Most rights holders won't respond or will decline"
            }
        ]
    },
    "low_quality": {
        "title": "Video Quality Below Standards",
        "severity": "medium",
        "description": "Your video doesn't meet our minimum quality requirements.",
        "why_flagged": "Resolution below 720p, severe audio issues, or technical problems detected.",
        "solutions": [
            {
                "option": "A",
                "title": "Re-export at Higher Quality",
                "difficulty": "Easy",
                "steps": [
                    "Open your original project file",
                    "Export at minimum 1080p (1920x1080) resolution",
                    "Use H.264 codec with bitrate of at least 8 Mbps",
                    "Ensure audio is clear (no clipping, consistent volume)",
                    "Re-upload the higher quality version"
                ],
                "time_estimate": "15-30 minutes",
                "export_settings": {
                    "resolution": "1920x1080 minimum",
                    "codec": "H.264",
                    "bitrate": "8-15 Mbps",
                    "audio": "AAC, 192kbps minimum"
                }
            }
        ]
    },
    "missing_info": {
        "title": "Missing Required Information",
        "severity": "low",
        "description": "Your submission is missing required metadata.",
        "why_flagged": "Title, description, category, or thumbnail is missing or incomplete.",
        "solutions": [
            {
                "option": "A",
                "title": "Complete Your Submission",
                "difficulty": "Easy",
                "steps": [
                    "Go to your Library in the dashboard",
                    "Find the flagged video",
                    "Click 'Edit' and fill in all required fields",
                    "Add a compelling title (under 100 characters)",
                    "Write a description (at least 50 characters)",
                    "Select an appropriate category",
                    "Upload a thumbnail (1280x720 recommended)"
                ],
                "time_estimate": "5-10 minutes"
            }
        ]
    },
    "content_policy": {
        "title": "Content Policy Concern",
        "severity": "high",
        "description": "Your content may violate our community guidelines.",
        "why_flagged": "Potentially inappropriate content, misleading information, or policy violation detected.",
        "solutions": [
            {
                "option": "A",
                "title": "Review and Edit Content",
                "difficulty": "Varies",
                "steps": [
                    "Review our Content Guidelines at ztvlivestream.com/content-guidelines",
                    "Identify the specific issue in your content",
                    "Edit to remove or modify the problematic section",
                    "Re-upload the edited version"
                ],
                "time_estimate": "Varies"
            },
            {
                "option": "B",
                "title": "Appeal the Decision",
                "difficulty": "Easy",
                "steps": [
                    "Email appeals@ztvlivestream.com",
                    "Include your video title and submission date",
                    "Explain why you believe the flag was incorrect",
                    "Our team will review within 48 hours"
                ],
                "time_estimate": "48 hours for response"
            }
        ]
    }
}

# Keywords that trigger different issue types
DETECTION_PATTERNS = {
    "copyrighted_music": {
        "keywords": [
            "drake", "taylor swift", "beyonce", "kanye", "travis scott", "kendrick",
            "post malone", "dua lipa", "ed sheeran", "ariana grande", "the weeknd",
            "official audio", "official music video", "lyrics video", "remix",
            "cover song", "karaoke", "instrumental version"
        ],
        "weight": 0.7
    },
    "third_party_content": {
        "keywords": [
            "nba", "nfl", "espn", "disney", "marvel", "netflix", "hbo",
            "movie clip", "tv show", "episode", "scene from", "best moments",
            "compilation", "highlights", "top 10", "reaction to"
        ],
        "weight": 0.6
    },
    "content_policy": {
        "keywords": [
            "prank gone wrong", "dangerous", "challenge", "fake news",
            "exposed", "drama", "fight", "explicit"
        ],
        "weight": 0.5
    }
}


# ============ MODELS ============

class AutoReviewResult(BaseModel):
    content_id: str
    status: str  # approved, flagged, needs_review
    issues: List[Dict]
    auto_approved: bool
    guidance_sent: bool
    next_steps: str


class ContentSubmission(BaseModel):
    content_id: str
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    video_url: Optional[str] = None
    creator_id: str
    creator_email: Optional[str] = None


# ============ CORE AUTOMATION FUNCTIONS ============

def analyze_content_for_issues(title: str, description: str, category: str) -> List[Dict]:
    """Analyze content metadata for potential issues"""
    issues = []
    text_to_analyze = f"{title} {description}".lower()
    
    for issue_type, patterns in DETECTION_PATTERNS.items():
        matched_keywords = []
        for keyword in patterns["keywords"]:
            if keyword.lower() in text_to_analyze:
                matched_keywords.append(keyword)
        
        if matched_keywords:
            confidence = min(len(matched_keywords) * patterns["weight"], 1.0)
            issues.append({
                "type": issue_type,
                "confidence": round(confidence, 2),
                "matched_keywords": matched_keywords,
                "details": ISSUE_SOLUTIONS.get(issue_type, {})
            })
    
    return issues


def generate_guidance_email(creator_name: str, content_title: str, issues: List[Dict]) -> Dict:
    """Generate a detailed guidance email for the creator"""
    
    if not issues:
        return {
            "subject": f"Great news! '{content_title}' has been approved",
            "body": f"""Hi {creator_name},

Good news! Your content "{content_title}" has passed our automated review and is now approved for broadcast on ZTVLIVE.

What happens next:
• Your content will appear in our content library
• You can schedule it for specific time slots
• It may be included in our 24/7 rotation
• You'll earn revenue from ad views

Thanks for being part of ZTVLIVE!

Best,
The ZTVLIVE Team
""",
            "type": "approval"
        }
    
    # Build issue-specific guidance
    issue_sections = []
    for i, issue in enumerate(issues, 1):
        details = issue.get("details", {})
        section = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ISSUE #{i}: {details.get('title', 'Unknown Issue')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Why was this flagged?
{details.get('why_flagged', 'Potential policy violation detected.')}

📋 What we detected:
Keywords/patterns: {', '.join(issue.get('matched_keywords', []))}
Confidence: {int(issue.get('confidence', 0) * 100)}%
"""
        
        solutions = details.get("solutions", [])
        if solutions:
            section += "\n💡 HOW TO FIX THIS:\n"
            for sol in solutions:
                section += f"""
▶ OPTION {sol.get('option', '?')}: {sol.get('title', 'Solution')}
   Difficulty: {sol.get('difficulty', 'Unknown')}
   Time needed: {sol.get('time_estimate', 'Varies')}
   
   Steps:
"""
                for step_num, step in enumerate(sol.get('steps', []), 1):
                    section += f"   {step_num}. {step}\n"
                
                if sol.get('note'):
                    section += f"\n   ⚠️ Note: {sol['note']}\n"
                
                if sol.get('resources'):
                    section += "\n   📚 Helpful resources:\n"
                    for res in sol['resources']:
                        section += f"   • {res['name']}: {res['url']}\n"
                        if res.get('note'):
                            section += f"     ({res['note']})\n"
        
        issue_sections.append(section)
    
    body = f"""Hi {creator_name},

Thank you for submitting "{content_title}" to ZTVLIVE!

Our automated review system has flagged some potential issues that need your attention before we can approve this content for broadcast. Don't worry - these are usually easy to fix!

{''.join(issue_sections)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Choose the solution that works best for you
2. Make the necessary changes
3. Re-upload your content OR reply to this email if you have questions
4. Our team will re-review within 24-48 hours

Need help? Reply to this email or visit our Content Guidelines:
https://ztvlivestream.com/content-guidelines

We're here to help you succeed!

Best,
The ZTVLIVE Content Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message from ZTVLIVE's content review system.
If you believe this flag was made in error, reply with "APPEAL" and
we'll have a human reviewer take a look within 48 hours.
"""
    
    return {
        "subject": f"Action Required: '{content_title}' needs some changes",
        "body": body,
        "type": "guidance",
        "issues_count": len(issues)
    }


async def send_guidance_notification(creator_id: str, email_content: Dict):
    """Store notification for creator (email sending requires Resend integration)"""
    notification = {
        "creator_id": creator_id,
        "type": "content_review",
        "email_type": email_content["type"],
        "subject": email_content["subject"],
        "body": email_content["body"],
        "created_at": datetime.now(timezone.utc),
        "read": False,
        "email_sent": False  # Would be True if Resend is configured
    }
    
    await db.creator_notifications.insert_one(notification)
    
    # TODO: If Resend is configured, send actual email
    # await email_service.send_email(creator_email, subject, body)
    
    return notification


# ============ API ENDPOINTS ============

@router.post("/process-submission")
async def process_content_submission(
    submission: ContentSubmission,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None)
):
    """
    Automatically process a new content submission.
    Analyzes for issues and either auto-approves or flags with guidance.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Analyze content
    issues = analyze_content_for_issues(
        submission.title,
        submission.description or "",
        submission.category or ""
    )
    
    # Determine status
    if not issues:
        status = "approved"
        auto_approved = True
        review_status = "approved"
    elif any(i["confidence"] > 0.8 for i in issues):
        status = "flagged"
        auto_approved = False
        review_status = "flagged"
    else:
        status = "needs_review"
        auto_approved = False
        review_status = "pending"
    
    # Update content in database
    update_data = {
        "review_status": review_status,
        "auto_reviewed": True,
        "auto_reviewed_at": datetime.now(timezone.utc),
        "detected_issues": issues,
        "auto_approved": auto_approved
    }
    
    # Try both collections
    await db.creator_videos.update_one(
        {"id": submission.content_id},
        {"$set": update_data}
    )
    await db.creator_bookings.update_one(
        {"booking_id": submission.content_id},
        {"$set": update_data}
    )
    
    # Get creator info for notification
    creator = await db.users.find_one({"user_id": submission.creator_id})
    creator_name = creator.get("name", "Creator") if creator else "Creator"
    
    # Generate and send guidance
    email_content = generate_guidance_email(creator_name, submission.title, issues)
    
    # Send notification in background
    background_tasks.add_task(
        send_guidance_notification,
        submission.creator_id,
        email_content
    )
    
    return {
        "success": True,
        "content_id": submission.content_id,
        "status": status,
        "auto_approved": auto_approved,
        "issues_found": len(issues),
        "issues": issues,
        "guidance_sent": True,
        "next_steps": "Content approved!" if auto_approved else "Check your notifications for detailed fix instructions"
    }


@router.post("/reprocess/{content_id}")
async def reprocess_content(
    content_id: str,
    authorization: str = Header(None)
):
    """Re-process content after creator makes changes"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Find content
    content = await db.creator_videos.find_one({"id": content_id})
    if not content:
        content = await db.creator_bookings.find_one({"booking_id": content_id})
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Re-analyze
    issues = analyze_content_for_issues(
        content.get("title", ""),
        content.get("description", ""),
        content.get("category", "")
    )
    
    # Determine new status
    previous_issues = content.get("detected_issues", [])
    
    if not issues:
        status = "approved"
        message = "All issues resolved! Your content has been approved."
    elif len(issues) < len(previous_issues):
        status = "improved"
        message = f"Progress! {len(previous_issues) - len(issues)} issue(s) resolved. {len(issues)} remaining."
    else:
        status = "still_flagged"
        message = "Issues still detected. Please review the guidance below."
    
    # Update content
    update_data = {
        "review_status": "approved" if status == "approved" else "flagged",
        "reprocessed_at": datetime.now(timezone.utc),
        "detected_issues": issues,
        "resolution_progress": {
            "previous_issues": len(previous_issues),
            "current_issues": len(issues),
            "resolved": len(previous_issues) - len(issues)
        }
    }
    
    await db.creator_videos.update_one({"id": content_id}, {"$set": update_data})
    await db.creator_bookings.update_one({"booking_id": content_id}, {"$set": update_data})
    
    return {
        "success": True,
        "content_id": content_id,
        "status": status,
        "message": message,
        "issues_remaining": len(issues),
        "issues": issues
    }


@router.get("/my-notifications")
async def get_creator_notifications(
    authorization: str = Header(None),
    unread_only: bool = False
):
    """Get content review notifications for the logged-in creator"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization.replace("Bearer ", "")
    
    # Get user from session
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user_id = session.get("user_id")
    
    query = {"creator_id": user_id}
    if unread_only:
        query["read"] = False
    
    notifications = await db.creator_notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    unread_count = await db.creator_notifications.count_documents({
        "creator_id": user_id,
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.post("/mark-notification-read/{notification_id}")
async def mark_notification_read(
    notification_id: str,
    authorization: str = Header(None)
):
    """Mark a notification as read"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    await db.creator_notifications.update_one(
        {"_id": notification_id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True}


@router.get("/issue-solutions/{issue_type}")
async def get_issue_solutions(issue_type: str):
    """Get detailed solutions for a specific issue type"""
    if issue_type not in ISSUE_SOLUTIONS:
        raise HTTPException(status_code=404, detail="Unknown issue type")
    
    return {
        "issue_type": issue_type,
        "details": ISSUE_SOLUTIONS[issue_type]
    }


@router.get("/all-issue-types")
async def get_all_issue_types():
    """Get list of all issue types and their basic info"""
    return {
        "issue_types": [
            {
                "type": key,
                "title": val["title"],
                "severity": val["severity"],
                "description": val["description"],
                "solution_count": len(val.get("solutions", []))
            }
            for key, val in ISSUE_SOLUTIONS.items()
        ]
    }


@router.post("/simulate-review")
async def simulate_review(
    title: str,
    description: str = "",
    category: str = ""
):
    """
    Simulate what would happen if content with this metadata was submitted.
    Useful for creators to check before uploading.
    """
    issues = analyze_content_for_issues(title, description, category)
    
    if not issues:
        return {
            "prediction": "likely_approved",
            "message": "This content looks clean and would likely be auto-approved!",
            "issues": [],
            "tips": [
                "Make sure your actual video doesn't contain copyrighted music",
                "Ensure all footage is original or properly licensed",
                "Double-check our Content Guidelines before uploading"
            ]
        }
    
    return {
        "prediction": "likely_flagged",
        "message": f"This content may be flagged for {len(issues)} potential issue(s).",
        "issues": [
            {
                "type": i["type"],
                "title": i["details"].get("title", "Unknown"),
                "confidence": i["confidence"],
                "matched": i["matched_keywords"]
            }
            for i in issues
        ],
        "recommendations": [
            "Review our Content Guidelines at /content-guidelines",
            "Consider using royalty-free music sources",
            "Remove or replace flagged keywords/content"
        ]
    }


@router.get("/automation-stats")
async def get_automation_stats(authorization: str = Header(None)):
    """Get statistics about the automation system"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Count auto-processed content
    auto_approved = await db.creator_videos.count_documents({"auto_approved": True})
    auto_flagged = await db.creator_videos.count_documents({
        "auto_reviewed": True,
        "auto_approved": False
    })
    
    # Count notifications sent
    notifications_sent = await db.creator_notifications.count_documents({})
    
    # Count by issue type
    issue_breakdown = {}
    for issue_type in ISSUE_SOLUTIONS.keys():
        count = await db.creator_videos.count_documents({
            "detected_issues.type": issue_type
        })
        issue_breakdown[issue_type] = count
    
    return {
        "total_auto_processed": auto_approved + auto_flagged,
        "auto_approved": auto_approved,
        "auto_flagged": auto_flagged,
        "approval_rate": round(auto_approved / max(auto_approved + auto_flagged, 1) * 100, 1),
        "notifications_sent": notifications_sent,
        "issues_by_type": issue_breakdown
    }
