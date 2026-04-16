"""
PENNY - ZTVLIVE Creator Engagement Agent
"This is a transmission from Penny at ZTVLIVE. If you're seeing high-octane content, 
SEO-sharpened keywords, and a 70% revenue share vibe, you've found the right source. 
Let's get these pixels moving."

Features:
- Creator engagement tracking
- Automated email campaigns
- Featured creator spotlights
- Activity monitoring
- Campaign management
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)

# ============ PENNY'S PERSONALITY ============

PENNY_INTRO = """This is a transmission from Penny at ZTVLIVE. If you're seeing high-octane content, SEO-sharpened keywords, and a 70% revenue share vibe, you've found the right source. Let's get these pixels moving."""

PENNY_TEMPLATES = {
    "welcome": {
        "subject": "Welcome to ZTVLIVE - Let's Get Those Pixels Moving!",
        "body": """Hey {name}!

This is Penny from ZTVLIVE, and I'm thrilled you've joined the revolution! 

You're now part of the world's first 24/7 live streaming network where creators like you get:
• 70% revenue share (vs YouTube's 55%)
• Zero subscriber requirements to start earning
• Global audience across Smart TVs, Roku, and mobile

Ready to upload your first video? Head to your Creator Dashboard and let's make some magic!

🎬 Quick Start:
1. Upload your video library
2. Import from YouTube (bulk import available!)
3. Schedule your content for prime time slots

Questions? Just reply to this email. I'm always here.

Let's get these pixels moving!

— Penny
ZTVLIVE Creator Success Team
""",
    },
    "inactive_reminder": {
        "subject": "We Miss You! Your ZTVLIVE Audience is Waiting",
        "body": """Hey {name}!

It's Penny from ZTVLIVE. I noticed it's been a while since you uploaded new content.

Your channel stats:
• Total views: {total_views}
• Earnings: ${earnings}
• Last upload: {last_upload}

Your fans are waiting! Here are some ideas to get back in the game:
• Import your latest YouTube content (takes 30 seconds!)
• Go live with a quick update for your audience
• Schedule some throwback content for the 24/7 stream

The 70% revenue share is still here waiting for you. Let's make some magic!

— Penny
""",
    },
    "milestone": {
        "subject": "Congrats! You Hit a ZTVLIVE Milestone!",
        "body": """Hey {name}!

BIG NEWS! You just hit {milestone}!

This calls for a celebration. Your dedication is paying off, and your audience is growing.

Here's what's next:
• You're now eligible for featured creator spotlights
• Your content may appear in our "Creator Picks" section
• Keep the momentum going with consistent uploads

Thanks for being part of the ZTVLIVE family!

— Penny
""",
    },
    "featured_spotlight": {
        "subject": "You've Been Featured on ZTVLIVE!",
        "body": """Hey {name}!

Exciting news - you've been selected as a Featured Creator on ZTVLIVE!

What this means:
• Your content is now promoted across our platform
• You'll appear in the "Featured Creators" section
• Expect a boost in views and new followers

Keep creating amazing content. The world is watching!

— Penny
""",
    },
    "campaign_upload": {
        "subject": "New Campaign: Upload Your Content & Get Featured!",
        "body": """Hey {name}!

ZTVLIVE is running a special campaign, and you're invited!

🎬 UPLOAD CHALLENGE
Upload 5 new videos this week and get:
• Featured placement on homepage
• Bonus visibility in the 24/7 stream
• Social media shoutout

Your current stats:
• Videos uploaded: {video_count}
• Total views: {total_views}

Ready to level up? Hit that upload button!

— Penny
""",
    },
    "view_other_creators": {
        "subject": "Check Out What Other ZTVLIVE Creators Are Doing!",
        "body": """Hey {name}!

Want some inspiration? Here's what's trending on ZTVLIVE:

🔥 Top Creators This Week:
{top_creators_list}

🎯 Popular Categories:
• Music videos are crushing it (+45% views)
• Comedy sketches are viral
• Gaming content is on the rise

Check out the Creator Discovery page to see what's working and get inspired!

— Penny
""",
    },
    "feature_launch_april": {
        "subject": "ZTVLIVE just got smarter - and you're getting paid for it",
        "body": """Hey {name}!

Penny here from ZTVLIVE — and I've got news that's going to make your week.

We've been listening to creators like you, and this week we shipped some MASSIVE updates:

🎬 WHAT'S NEW:

✅ Smarter Video Player - Our new streaming tech auto-detects buffering and frozen frames. Your audience never sees a glitch — we handle it.

✅ Caption Translation - Viewers can now watch your content in 20+ languages. Spanish, French, Hindi, Korean... your reach just went global.

✅ One-Click Share & Invite - Every viewer can now invite their friends directly from the watch page. More eyes = more earnings for you.

✅ Quality Filter - We automatically filter low-quality uploads to keep the broadcast premium. Your professional content stands out even more.

💰 WHAT THIS MEANS FOR YOU:

→ Better viewing experience = longer watch time = more revenue
→ Global captions = international audience growth
→ Social sharing = organic reach explosion
→ Premium stream = premium advertiser rates

🏆 THIS WEEK'S CHALLENGE:

Upload 3 videos (or import your YouTube channel) and we'll feature you in our "Creator Spotlight" — that's PRIME placement in front of 1.3M+ viewers!

Get Started Now:

🔴 Import Your YouTube Channel: https://ztvlivestream.com/creator/youtube-import (30 seconds)
📤 Upload New Content: https://ztvlivestream.com/upload-and-earn
📱 Import TikTok/Reels: https://ztvlivestream.com/upload-and-earn (auto-reframed for TV!)
📅 Schedule Your Slot: https://ztvlivestream.com/creator/schedule

SUPPORTED FORMATS:
• Video Files: MP4, MOV, WebM, FLV, AVI, MKV (up to 500MB)
• YouTube: Any video or channel link
• TikTok/Shorts/Reels: Auto-converted to TV format

THE NUMBERS:
• 70% Revenue Share (YouTube pays 55%)
• $5-15 per 1,000 views
• Weekly Payouts (not monthly)
• Zero subscriber requirements

Your content could be playing on millions of TVs RIGHT NOW while you sleep.

Let's get these pixels moving!

— Penny
ZTVLIVE Creator Success

P.S. - Have questions? Just hit reply. I personally read every email.
""",
    }
}

# ============ ENGAGEMENT TRACKING ============

class EngagementLevel(Enum):
    NEW = "new"              # < 7 days
    ACTIVE = "active"        # Uploaded in last 14 days
    ENGAGED = "engaged"      # Uploaded in last 30 days
    AT_RISK = "at_risk"      # No upload in 30-60 days
    INACTIVE = "inactive"    # No upload in 60+ days
    CHURNED = "churned"      # No upload in 90+ days

def calculate_engagement_level(creator: Dict) -> EngagementLevel:
    """Calculate creator's engagement level based on activity"""
    created_at = creator.get("created_at")
    last_upload = creator.get("last_upload_date")
    
    now = datetime.now(timezone.utc)
    
    # Check if new user
    if created_at:
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except:
                created_at = None
        # Ensure timezone-aware comparison
        if created_at:
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            if (now - created_at).days < 7:
                return EngagementLevel.NEW
    
    if not last_upload:
        return EngagementLevel.INACTIVE
    
    if isinstance(last_upload, str):
        try:
            last_upload = datetime.fromisoformat(last_upload.replace("Z", "+00:00"))
        except:
            return EngagementLevel.INACTIVE
    
    # Ensure timezone-aware comparison
    if last_upload.tzinfo is None:
        last_upload = last_upload.replace(tzinfo=timezone.utc)
    
    days_since_upload = (now - last_upload).days
    
    if days_since_upload < 14:
        return EngagementLevel.ACTIVE
    elif days_since_upload < 30:
        return EngagementLevel.ENGAGED
    elif days_since_upload < 60:
        return EngagementLevel.AT_RISK
    elif days_since_upload < 90:
        return EngagementLevel.INACTIVE
    else:
        return EngagementLevel.CHURNED

def get_engagement_stats(creators: List[Dict]) -> Dict:
    """Get engagement distribution across all creators"""
    stats = {level.value: 0 for level in EngagementLevel}
    
    for creator in creators:
        level = calculate_engagement_level(creator)
        stats[level.value] += 1
    
    return {
        "distribution": stats,
        "total_creators": len(creators),
        "active_rate": round((stats["active"] + stats["engaged"]) / max(len(creators), 1) * 100, 1),
        "at_risk_count": stats["at_risk"],
        "churned_count": stats["churned"]
    }

# ============ CAMPAIGN MANAGEMENT ============

class CampaignType(Enum):
    WELCOME = "welcome"
    RE_ENGAGEMENT = "re_engagement"
    MILESTONE = "milestone"
    FEATURED = "featured"
    UPLOAD_CHALLENGE = "upload_challenge"
    DISCOVERY = "discovery"

_active_campaigns: List[Dict] = []
_campaign_history: List[Dict] = []

def create_campaign(
    name: str,
    campaign_type: CampaignType,
    target_segment: str,  # "all", "new", "active", "at_risk", "inactive"
    template_key: str,
    scheduled_date: datetime = None
) -> Dict:
    """Create a new engagement campaign"""
    campaign = {
        "id": f"camp_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "name": name,
        "type": campaign_type.value,
        "target_segment": target_segment,
        "template_key": template_key,
        "status": "scheduled" if scheduled_date else "draft",
        "scheduled_date": scheduled_date.isoformat() if scheduled_date else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sent_count": 0,
        "open_count": 0,
        "click_count": 0
    }
    _active_campaigns.append(campaign)
    return campaign

def get_active_campaigns() -> List[Dict]:
    """Get all active campaigns"""
    return _active_campaigns

def get_campaign_stats() -> Dict:
    """Get campaign performance stats"""
    total_sent = sum(c.get("sent_count", 0) for c in _campaign_history)
    total_opened = sum(c.get("open_count", 0) for c in _campaign_history)
    total_clicked = sum(c.get("click_count", 0) for c in _campaign_history)
    
    return {
        "active_campaigns": len(_active_campaigns),
        "total_campaigns_sent": len(_campaign_history),
        "total_emails_sent": total_sent,
        "average_open_rate": round(total_opened / max(total_sent, 1) * 100, 1),
        "average_click_rate": round(total_clicked / max(total_sent, 1) * 100, 1)
    }

# ============ EMAIL GENERATION ============

def generate_email(
    template_key: str,
    creator: Dict,
    custom_data: Dict = None
) -> Dict:
    """Generate personalized email from template"""
    template = PENNY_TEMPLATES.get(template_key)
    if not template:
        return None
    
    # Merge creator data with custom data
    data = {
        "name": creator.get("name", creator.get("email", "Creator")),
        "total_views": creator.get("total_views", 0),
        "earnings": creator.get("earnings", 0),
        "video_count": creator.get("video_count", 0),
        "last_upload": creator.get("last_upload_date", "Never"),
        **(custom_data or {})
    }
    
    # Format template
    subject = template["subject"].format(**data)
    body = template["body"].format(**data)
    
    return {
        "to": creator.get("email"),
        "subject": subject,
        "body": body,
        "template_key": template_key,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

# ============ FEATURED CREATORS ============

def select_featured_creators(creators: List[Dict], count: int = 5) -> List[Dict]:
    """Select creators to be featured based on performance"""
    # Score creators based on activity and engagement
    scored = []
    for creator in creators:
        score = 0
        score += creator.get("total_views", 0) * 0.001  # Views weight
        score += creator.get("video_count", 0) * 10     # Content weight
        score += creator.get("follower_count", 0) * 5   # Followers weight
        
        # Recency bonus
        level = calculate_engagement_level(creator)
        if level == EngagementLevel.ACTIVE:
            score *= 1.5
        elif level == EngagementLevel.ENGAGED:
            score *= 1.2
        
        scored.append((score, creator))
    
    # Sort by score and return top N
    scored.sort(key=lambda x: -x[0])
    return [c for _, c in scored[:count]]

# ============ PENNY'S RECOMMENDATIONS ============

def get_penny_recommendations(creators: List[Dict]) -> List[Dict]:
    """Get Penny's engagement recommendations"""
    stats = get_engagement_stats(creators)
    recommendations = []
    
    if stats["at_risk_count"] > 5:
        recommendations.append({
            "priority": "high",
            "type": "re_engagement",
            "message": f"{stats['at_risk_count']} creators are at risk of churning. Launch a re-engagement campaign!",
            "action": "Create Re-engagement Campaign",
            "segment": "at_risk"
        })
    
    if stats["active_rate"] < 30:
        recommendations.append({
            "priority": "high",
            "type": "activation",
            "message": f"Only {stats['active_rate']}% of creators are active. Consider an upload challenge!",
            "action": "Create Upload Challenge",
            "segment": "inactive"
        })
    
    new_count = stats["distribution"]["new"]
    if new_count > 0:
        recommendations.append({
            "priority": "medium",
            "type": "onboarding",
            "message": f"{new_count} new creators joined recently. Send welcome emails!",
            "action": "Send Welcome Emails",
            "segment": "new"
        })
    
    if stats["churned_count"] > 10:
        recommendations.append({
            "priority": "low",
            "type": "win_back",
            "message": f"{stats['churned_count']} creators have churned. Consider a win-back campaign.",
            "action": "Create Win-back Campaign",
            "segment": "churned"
        })
    
    return recommendations

# ============ PENNY DASHBOARD DATA ============

def get_penny_dashboard_data(creators: List[Dict]) -> Dict:
    """Get all data for Penny's engagement dashboard"""
    engagement_stats = get_engagement_stats(creators)
    featured = select_featured_creators(creators)
    recommendations = get_penny_recommendations(creators)
    campaign_stats = get_campaign_stats()
    
    return {
        "intro": PENNY_INTRO,
        "engagement": engagement_stats,
        "featured_creators": [
            {
                "id": c.get("id", str(c.get("_id", ""))),
                "name": c.get("name", "Anonymous"),
                "video_count": c.get("video_count", 0),
                "total_views": c.get("total_views", 0),
                "level": calculate_engagement_level(c).value
            }
            for c in featured
        ],
        "recommendations": recommendations,
        "campaigns": campaign_stats,
        "active_campaigns": get_active_campaigns(),
        "templates_available": list(PENNY_TEMPLATES.keys())
    }
