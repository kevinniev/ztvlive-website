"""
Admin Models for ZTVLIVE
- Admin User Authentication
- Role-Based Access Control
- Traffic Analytics
- Revenue Controls
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class AdminRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    MANAGER = "manager"
    VIEWER = "viewer"

class AdminUser(BaseModel):
    id: str = Field(default_factory=lambda: "")
    email: str
    password_hash: str
    name: str
    role: AdminRole = AdminRole.VIEWER
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    avatar_url: Optional[str] = None

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    expires_in: int = 86400  # 24 hours

class AdminCreateRequest(BaseModel):
    email: str
    password: str
    name: str
    role: AdminRole = AdminRole.VIEWER

# Traffic Analytics Models
class PageView(BaseModel):
    id: str = Field(default_factory=lambda: "")
    page: str  # homepage, watch, library, schedule, etc.
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    referrer: Optional[str] = None
    duration_seconds: int = 0

class ContentView(BaseModel):
    id: str = Field(default_factory=lambda: "")
    content_id: str
    content_title: str
    category: str
    session_id: str
    watch_duration_seconds: int = 0
    completed: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ConcurrentViewers(BaseModel):
    count: int
    page: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class TrafficSummary(BaseModel):
    total_page_views: int
    unique_visitors: int
    concurrent_viewers: int
    views_by_page: Dict[str, int]
    views_by_hour: List[Dict[str, Any]]
    top_content: List[Dict[str, Any]]
    avg_session_duration_seconds: int

# Revenue Models
class AdPlacement(str, Enum):
    PRE_ROLL = "pre_roll"
    MID_ROLL = "mid_roll"
    POST_ROLL = "post_roll"
    BANNER = "banner"
    OVERLAY = "overlay"

class AdSettings(BaseModel):
    id: str = Field(default_factory=lambda: "settings")
    pre_roll_enabled: bool = True
    pre_roll_frequency: int = 1  # Every video
    mid_roll_enabled: bool = False
    mid_roll_interval_seconds: int = 300  # Every 5 minutes
    post_roll_enabled: bool = False
    banner_enabled: bool = True
    overlay_enabled: bool = False
    ad_free_for_subscribers: bool = True
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None

class SubscriptionTier(BaseModel):
    id: str = Field(default_factory=lambda: "")
    name: str
    price_monthly: float
    price_yearly: float
    features: List[str]
    is_active: bool = True
    max_devices: int = 1
    ad_free: bool = False
    hd_quality: bool = True
    downloads_enabled: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Subscription(BaseModel):
    id: str = Field(default_factory=lambda: "")
    user_id: str
    tier_id: str
    status: str = "active"  # active, cancelled, expired, paused
    start_date: datetime
    end_date: datetime
    auto_renew: bool = True
    payment_method: Optional[str] = None
    last_payment_date: Optional[datetime] = None
    next_payment_date: Optional[datetime] = None

class CreatorPayout(BaseModel):
    id: str = Field(default_factory=lambda: "")
    creator_id: str
    creator_name: str
    creator_email: str
    amount: float
    status: str = "pending"  # pending, processing, completed, failed
    period_start: datetime
    period_end: datetime
    views_count: int = 0
    tips_amount: float = 0.0
    ad_revenue_share: float = 0.0
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class RevenueSummary(BaseModel):
    total_revenue: float
    ad_revenue: float
    subscription_revenue: float
    tips_revenue: float
    pending_payouts: float
    completed_payouts: float
    revenue_by_day: List[Dict[str, Any]]
    top_earning_creators: List[Dict[str, Any]]
    subscription_stats: Dict[str, Any]
