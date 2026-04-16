"""
ZTVLIVE Creator Video Models
Handles video uploads, categories, likes, comments, and scheduling
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class VideoCategory(str, Enum):
    MUSIC = "music"
    SPORTS = "sports"
    GAMING = "gaming"
    COMEDY = "comedy"
    PODCAST = "podcast"
    NEWS = "news"
    EDUCATION = "education"
    ENTERTAINMENT = "entertainment"
    LIFESTYLE = "lifestyle"
    TECH = "tech"
    OTHER = "other"

class VideoStatus(str, Enum):
    PENDING = "pending"  # Uploaded, awaiting review
    APPROVED = "approved"  # Approved for browse feed
    SCHEDULED = "scheduled"  # Scheduled for live stream
    LIVE = "live"  # Currently playing on live stream
    REJECTED = "rejected"  # Rejected by admin

class VideoUploadRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    category: VideoCategory = VideoCategory.OTHER
    custom_category: Optional[str] = Field(None, max_length=50)  # If category is OTHER
    video_url: str  # YouTube URL or uploaded file URL
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    tags: Optional[List[str]] = []

class VideoResponse(BaseModel):
    id: str = ""
    title: str = ""
    description: Optional[str] = None
    category: str = "other"
    custom_category: Optional[str] = None
    video_url: str = ""
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    creator_id: str = ""
    creator_name: str = "Anonymous"
    creator_avatar: Optional[str] = None
    status: str = "pending"
    views: int = 0
    likes: int = 0
    comments_count: int = 0
    tags: List[str] = []
    scheduled_time: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)

class CommentResponse(BaseModel):
    id: str
    video_id: str
    user_id: str
    user_name: str
    user_avatar: Optional[str]
    content: str
    likes: int = 0
    created_at: datetime

class ScheduleSlotRequest(BaseModel):
    video_id: str
    requested_time: datetime  # UTC time
    duration_minutes: Optional[int] = 5  # Default 5 min slot

class ScheduleSlotResponse(BaseModel):
    id: str
    video_id: str
    video_title: str
    creator_id: str
    creator_name: str
    scheduled_start: datetime
    scheduled_end: datetime
    status: str  # pending, confirmed, completed, cancelled

class TimeSlotAvailability(BaseModel):
    requested_time: datetime
    is_available: bool
    conflict_with: Optional[str] = None  # Video title if conflict
    suggested_alternatives: List[datetime] = []  # Next available slots

# Categories with display names and icons
CATEGORY_INFO = {
    "music": {"name": "Music", "icon": "music", "color": "#EF4444"},
    "sports": {"name": "Sports", "icon": "trophy", "color": "#F59E0B"},
    "gaming": {"name": "Gaming", "icon": "gamepad-2", "color": "#8B5CF6"},
    "comedy": {"name": "Comedy", "icon": "laugh", "color": "#EC4899"},
    "podcast": {"name": "Podcast", "icon": "mic", "color": "#06B6D4"},
    "news": {"name": "News", "icon": "newspaper", "color": "#3B82F6"},
    "education": {"name": "Education", "icon": "graduation-cap", "color": "#10B981"},
    "entertainment": {"name": "Entertainment", "icon": "tv", "color": "#F97316"},
    "lifestyle": {"name": "Lifestyle", "icon": "heart", "color": "#DB2777"},
    "tech": {"name": "Tech", "icon": "cpu", "color": "#6366F1"},
    "other": {"name": "Other", "icon": "folder", "color": "#6B7280"},
}
