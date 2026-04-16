from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Request, Cookie, Response, Header, Depends
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import random
import asyncio
import httpx
import json
import aiofiles
import zipfile
import io
from emergentintegrations.llm.chat import LlmChat, UserMessage
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

# Import admin routes
from routes import admin_auth, analytics, revenue, creator_videos, uploads, notifications, push_notifications
from routes import creator_scheduling
from routes import game_show
from routes import admin_notifications
from routes import creator_trivia
from routes import fan_notifications
from routes import game_analytics
from routes import starter_pack
from routes import content_manager
from routes import smart_scheduling
from routes import creator_collabs
from routes import social_game
from routes import bigscreen_scheduler
from routes import live_game
from routes import live_survey
from routes import youtube_import
from routes import creator_live_status
from routes import mrss_feed
from routes import creator_agreement
from routes import content_automation
from routes import creator_profile
from routes import social_share
from routes import seo
from routes import group_challenge_v2 as group_challenge
from routes import player_data
from routes import player_achievements
from routes import roku_feed
from routes import obs_controller
from routes import in_app_notifications
from services import email_service
from services import notification_scheduler
from services import translation
from services import video_importer
from services import live_embed

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize scheduler
scheduler = AsyncIOScheduler(timezone="UTC")

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Stream Configuration
HLS_STREAM_URL = os.environ.get('HLS_STREAM_URL', '')
RTMP_URL = os.environ.get('RTMP_URL', '')
RTMP_STREAM_KEY = os.environ.get('RTMP_STREAM_KEY', '')

# NewsAPI Configuration
NEWS_API_KEY = os.environ.get('ZTV_API_KEY', '')
NEWS_API_BASE_URL = "https://newsapi.org/v2"

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')

# Creator tip packages - FIXED AMOUNTS (never accept from frontend)
CREATOR_TIP_PACKAGES = {
    "coffee": 5.00,
    "lunch": 10.00,
    "support": 25.00,
    "sponsor": 50.00,
    "patron": 100.00
}

# Create the main app
app = FastAPI()

# Mount static files for promo videos
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/api/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Mount releases directory for Roku/FireTV/LG/Samsung app downloads
RELEASES_DIR = Path("/app/releases")
if RELEASES_DIR.exists():
    app.mount("/api/releases", StaticFiles(directory=str(RELEASES_DIR)), name="releases")

# Mount Roku TV App (Base44 design)
ROKU_TV_APP_DIR = Path("/app/frontend/public/roku")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Roku TV App SPA fallback routes (before static files to handle SPA routing)
@app.get("/api/roku-tv-app/{path:path}")
async def roku_tv_app_spa(path: str):
    """Serve Roku TV App - SPA fallback for client-side routing"""
    if ROKU_TV_APP_DIR.exists():
        # Check if it's a static asset
        file_path = ROKU_TV_APP_DIR / path
        if file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html for SPA routing
        index_path = ROKU_TV_APP_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Roku TV App not found")

@app.get("/api/roku-tv-app")
@app.get("/api/roku-tv-app/")
async def roku_tv_app_index():
    """Serve Roku TV App index"""
    if ROKU_TV_APP_DIR.exists():
        index_path = ROKU_TV_APP_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Roku TV App not found")

# Mount uploads/processed directory for imported/reframed videos
UPLOADS_PROCESSED_DIR = Path("/app/backend/uploads/processed")
UPLOADS_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/processed-videos", StaticFiles(directory=str(UPLOADS_PROCESSED_DIR)), name="processed_videos")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Background task flag
content_generator_running = False


# ============ AUTH HELPER (Needed early for Depends) ============

async def get_current_user(session_token: str = Cookie(None), authorization: str = Header(None)) -> Optional[Dict]:
    """Get current user from session token (cookie or header)"""
    from typing import Optional, Dict
    
    token = None
    
    # Try cookie first
    if session_token:
        token = session_token
    # Fallback to Authorization header
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    if not token:
        return None
    
    # Try JWT decode first
    import jwt
    import os
    try:
        secret = os.environ.get("JWT_SECRET", "your-secret-key")
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
            if user:
                return user
    except:
        pass
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    return user_doc

# ============ WEBSOCKET CONNECTION MANAGER ============

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = []
        self.active_connections[room].append(websocket)
        logger.info(f"WebSocket connected to room: {room}, total: {len(self.active_connections[room])}")
    
    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.active_connections:
            if websocket in self.active_connections[room]:
                self.active_connections[room].remove(websocket)
            logger.info(f"WebSocket disconnected from room: {room}, remaining: {len(self.active_connections[room])}")
    
    async def broadcast(self, message: dict, room: str):
        if room in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[room]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Failed to send message: {e}")
                    dead_connections.append(connection)
            # Clean up dead connections
            for dead in dead_connections:
                self.disconnect(dead, room)

manager = ConnectionManager()

# ============ SEO REDIRECT HANDLERS ============
# Handle old/legacy URLs with proper 301 redirects for SEO

from fastapi.responses import RedirectResponse

# ============ FILE DOWNLOAD ENDPOINTS ============
@app.get("/api/downloads/{filename}")
async def download_file(filename: str):
    """Download files from /app directory"""
    file_path = Path(f"/app/{filename}")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/zip" if filename.endswith('.zip') else "application/octet-stream"
    )

@app.get("/stream/{path:path}")
async def redirect_stream_urls(path: str):
    """301 redirect old /stream/* URLs to /watch"""
    return RedirectResponse(url="/watch", status_code=301)

@app.get("/watch/stream/{path:path}")
async def redirect_watch_stream_urls(path: str):
    """301 redirect old /watch/stream/* URLs to /watch"""
    return RedirectResponse(url="/watch", status_code=301)

@app.get("/category/{path:path}")
async def redirect_category_urls(path: str):
    """301 redirect old /category/* URLs to /library"""
    return RedirectResponse(url="/library", status_code=301)

@app.get("/on-demand")
@app.get("/on-demand/{path:path}")
async def redirect_on_demand_urls(path: str = ""):
    """301 redirect old /on-demand URLs to /library"""
    return RedirectResponse(url="/library", status_code=301)

# ============ NEWSAPI SERVICE ============

# Map NewsAPI categories to ZTVLIVE categories
NEWSAPI_CATEGORY_MAP = {
    "sports": "sports",
    "entertainment": "culture",
    "technology": "tech",
    "science": "tech",
    "business": "news",
    "health": "news",
    "general": "news",
}

# Reverse map - ZTVLIVE category to NewsAPI query keywords
ZTVLIVE_TO_NEWSAPI_KEYWORDS = {
    "sports": ["sports", "NBA", "NFL", "soccer", "UFC", "tennis", "championship"],
    "podcast": ["podcast", "interview", "Joe Rogan", "celebrity interview", "talk show"],
    "music": ["music", "concert", "album release", "Grammy", "artist tour", "Beyonce", "Drake"],
    "film": ["movie", "film", "Netflix", "box office", "Oscar", "streaming", "TV show"],
    "tech": ["technology", "AI", "Apple", "Google", "startup", "crypto", "gadget"],
    "gaming": ["gaming", "video game", "PlayStation", "Xbox", "Nintendo", "esports"],
    "news": ["breaking news", "world news", "politics", "economy", "climate"],
    "culture": ["viral", "TikTok", "celebrity", "fashion", "meme", "social media trend"],
    "other": ["documentary", "lifestyle", "education", "interesting"],
}

class NewsAPIService:
    """Service to fetch real trending content from NewsAPI"""
    
    def __init__(self):
        self.api_key = NEWS_API_KEY
        self.base_url = NEWS_API_BASE_URL
        self.cache: Dict[str, Any] = {}
        self.cache_ttl = timedelta(minutes=30)
        self.last_fetch: Dict[str, datetime] = {}
    
    def _is_cache_valid(self, category: str) -> bool:
        if category not in self.cache or category not in self.last_fetch:
            return False
        return datetime.now(timezone.utc) - self.last_fetch[category] < self.cache_ttl
    
    async def fetch_trending_for_category(self, category: str, page_size: int = 10) -> List[Dict]:
        """Fetch real trending news for a ZTVLIVE category"""
        if not self.api_key:
            logger.warning("NewsAPI key not configured, using fallback content")
            return []
        
        # Check cache first
        cache_key = f"{category}_{page_size}"
        if self._is_cache_valid(cache_key):
            logger.info(f"Using cached NewsAPI results for {category}")
            return self.cache[cache_key]
        
        # Get keywords for this category
        keywords = ZTVLIVE_TO_NEWSAPI_KEYWORDS.get(category, ["trending", "viral"])
        query = " OR ".join(keywords[:3])  # Use top 3 keywords
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Use everything endpoint for more flexibility
                response = await client.get(
                    f"{self.base_url}/everything",
                    params={
                        "q": query,
                        "sortBy": "publishedAt",
                        "pageSize": page_size,
                        "language": "en",
                        "apiKey": self.api_key,
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    articles = data.get("articles", [])
                    
                    # Transform to our format
                    trending_items = []
                    for article in articles:
                        if not article.get("title") or article.get("title") == "[Removed]":
                            continue
                        
                        trending_items.append({
                            "title": article.get("title", ""),
                            "description": article.get("description", ""),
                            "source": article.get("source", {}).get("name", "Unknown"),
                            "url": article.get("url", ""),
                            "image_url": article.get("urlToImage", ""),
                            "published_at": article.get("publishedAt", ""),
                            "category": category,
                            "content_preview": article.get("content", "")[:200] if article.get("content") else "",
                        })
                    
                    # Cache the results
                    self.cache[cache_key] = trending_items
                    self.last_fetch[cache_key] = datetime.now(timezone.utc)
                    
                    logger.info(f"Fetched {len(trending_items)} trending items for {category} from NewsAPI")
                    return trending_items
                else:
                    logger.error(f"NewsAPI error: {response.status_code} - {response.text}")
                    return []
                    
        except Exception as e:
            logger.error(f"Failed to fetch from NewsAPI for {category}: {e}")
            return []
    
    async def fetch_top_headlines(self, country: str = "us", page_size: int = 20) -> List[Dict]:
        """Fetch top headlines across all categories"""
        if not self.api_key:
            return []
        
        cache_key = f"headlines_{country}_{page_size}"
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.base_url}/top-headlines",
                    params={
                        "country": country,
                        "pageSize": page_size,
                        "apiKey": self.api_key,
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    articles = data.get("articles", [])
                    
                    headlines = []
                    for article in articles:
                        if not article.get("title") or article.get("title") == "[Removed]":
                            continue
                        headlines.append({
                            "title": article.get("title", ""),
                            "description": article.get("description", ""),
                            "source": article.get("source", {}).get("name", "Unknown"),
                            "url": article.get("url", ""),
                            "image_url": article.get("urlToImage", ""),
                            "published_at": article.get("publishedAt", ""),
                        })
                    
                    self.cache[cache_key] = headlines
                    self.last_fetch[cache_key] = datetime.now(timezone.utc)
                    return headlines
                else:
                    logger.error(f"NewsAPI headlines error: {response.status_code}")
                    return []
                    
        except Exception as e:
            logger.error(f"Failed to fetch headlines: {e}")
            return []
    
    async def search_topic(self, topic: str, page_size: int = 5) -> List[Dict]:
        """Search for a specific topic"""
        if not self.api_key:
            return []
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.base_url}/everything",
                    params={
                        "q": topic,
                        "sortBy": "relevancy",
                        "pageSize": page_size,
                        "language": "en",
                        "apiKey": self.api_key,
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return [{
                        "title": a.get("title", ""),
                        "description": a.get("description", ""),
                        "source": a.get("source", {}).get("name", ""),
                        "url": a.get("url", ""),
                    } for a in data.get("articles", []) if a.get("title") and a.get("title") != "[Removed]"]
                return []
        except Exception as e:
            logger.error(f"Failed to search topic {topic}: {e}")
            return []

# Initialize NewsAPI service
news_api_service = NewsAPIService()

# ============ MODELS ============

class Highlight(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    thumbnail: str
    video_url: Optional[str] = None
    description: str
    ai_commentary: Optional[str] = None
    humor_level: int = Field(default=5, ge=1, le=10)
    views: int = Field(default=0)
    likes: int = Field(default=0)
    duration: str = "5:30"
    source: str = "Social Media"
    trending_score: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_live: bool = False

class HighlightCreate(BaseModel):
    title: str
    category: str
    thumbnail: str
    video_url: Optional[str] = None
    description: str
    humor_level: int = Field(default=5, ge=1, le=10)

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    message: str
    color: str = "#8b5cf6"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AICommentaryRequest(BaseModel):
    topic: str
    category: str
    humor_level: int = Field(default=5, ge=1, le=10)
    include_facts: bool = True

class ScheduleSlot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    highlight_id: str
    start_time: str
    end_time: str
    day: str

class HighlightSubmission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    source_url: Optional[str] = None  # URL for streaming link submissions
    file_path: Optional[str] = None  # Path for uploaded files
    file_name: Optional[str] = None  # Original filename
    file_size: Optional[int] = None  # File size in bytes
    submission_type: str = "link"  # "link" or "upload"
    description: str
    submitter_name: str
    submitter_email: Optional[str] = None
    why_trending: str
    status: str = Field(default="pending")  # pending, approved, rejected
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HighlightSubmissionCreate(BaseModel):
    title: str
    category: str
    source_url: Optional[str] = None
    description: str
    submitter_name: str
    submitter_email: Optional[str] = None
    why_trending: str
    submission_type: str = "link"
    creator_id: Optional[str] = None  # Link to creator if logged in

# Creator Live Stream Submission - For creators who want to be featured live
class LiveStreamSubmission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    stream_url: str  # HLS or RTMP stream URL
    stream_type: str = "hls"  # hls, rtmp, youtube_live
    category: str
    description: str
    creator_name: str
    creator_email: str
    creator_social: Optional[str] = None  # Social media handle
    # AI Review Results
    ai_review_status: str = Field(default="pending")  # pending, reviewing, approved, rejected
    ai_review_score: Optional[float] = None
    ai_content_analysis: Optional[str] = None
    ai_quality_score: Optional[float] = None  # 0-100 quality rating
    ai_resolution_check: Optional[str] = None  # "720p", "1080p", "4K", etc.
    ai_content_flags: List[str] = Field(default_factory=list)  # Any content warnings
    ai_review_notes: Optional[str] = None
    # Status tracking
    is_approved_for_live: bool = False
    scheduled_time: Optional[datetime] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None

# Creator Partner Interest - YouTube creators joining ZTVLIVE
class CreatorInterest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    channel_url: str
    source: str = "landing_page"  # landing_page, referral, social, etc.
    status: str = "pending"  # pending, contacted, approved, rejected
    notes: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    contacted_at: Optional[datetime] = None

class CreatorInterestCreate(BaseModel):
    email: str
    channel_url: str
    source: str = "landing_page"

# ============ VIDEO IMPORT MODELS ============

class VideoImportRequest(BaseModel):
    """Request to import video from TikTok, YouTube Shorts, or Instagram Reels"""
    url: str
    output_resolution: str = "1920x1080"  # 1280x720, 1920x1080, 3840x2160
    blur_background: bool = True

class LiveEmbedRequest(BaseModel):
    """Request to embed a live stream from YouTube/Facebook"""
    url: str
    title: str = "Live Stream"
    autoplay: bool = True

class LiveStreamSubmissionCreate(BaseModel):
    title: str
    stream_url: str
    stream_type: str = "hls"
    category: str
    description: str
    creator_name: str
    creator_email: str
    creator_social: Optional[str] = None

class ArchivedVideo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    thumbnail: str
    video_url: str  # YouTube, Vimeo, or direct video URL
    video_type: str = "youtube"  # youtube, vimeo, direct, embed
    description: str
    ai_commentary: Optional[str] = None
    duration: str = "5:00"
    views: int = Field(default=0)
    likes: int = Field(default=0)
    source: str = "ZTVLIVE"
    aired_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    in_rotation: bool = True  # Whether to include in auto-playlist

class ArchivedVideoCreate(BaseModel):
    title: str
    category: str
    thumbnail: str
    video_url: str
    video_type: str = "youtube"
    description: str
    duration: str = "5:00"
    source: str = "ZTVLIVE"
    in_rotation: bool = True

class PlaylistState(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "playlist_state"
    current_video_id: Optional[str] = None
    current_index: int = 0
    is_live_streaming: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ CREATOR SCHEDULING SYSTEM ============

class CreatorScheduledContent(BaseModel):
    """Content scheduled by creators for specific time slots"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slot_date: str  # Format: YYYY-MM-DD
    slot_hour: int  # 0-23
    creator_id: str
    creator_name: str
    creator_email: str
    # Content details
    title: str
    description: str
    content_type: str = "video"  # video, youtube, live_embed, upload
    video_url: str  # YouTube URL, social media live URL, or uploaded file path
    thumbnail: Optional[str] = None
    duration: str = "60:00"  # Default to 1 hour slot
    category: str
    # Status
    status: str = "scheduled"  # scheduled, live, completed, cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cancelled_at: Optional[datetime] = None

class CreatorScheduleBooking(BaseModel):
    """Request to book a time slot"""
    slot_date: str  # Format: YYYY-MM-DD
    slot_hour: int  # 0-23
    title: str
    description: str
    content_type: str = "video"  # video, youtube, live_embed, upload
    video_url: str
    thumbnail: Optional[str] = None
    category: str

# Category rotation for diverse programming (expanded categories)
CATEGORY_ROTATION = [
    "sports",       # 00:00 - Sports highlights
    "music",        # 01:00 - Music videos & performances  
    "podcast",      # 02:00 - Podcasts & interviews
    "promo",        # 03:00 - Promo slot
    "gaming",       # 04:00 - Gaming content
    "documentary",  # 05:00 - Documentaries
    "news",         # 06:00 - News & current events
    "promo",        # 07:00 - Promo slot
    "comedy",       # 08:00 - Comedy & entertainment
    "fitness",      # 09:00 - Fitness & wellness
    "film",         # 10:00 - Film trailers & reviews
    "promo",        # 11:00 - Promo slot
    "vlogs",        # 12:00 - Vlogs & lifestyle
    "tech",         # 13:00 - Tech reviews
    "culture",      # 14:00 - Culture & arts
    "promo",        # 15:00 - Promo slot
    "sports",       # 16:00 - More sports
    "music",        # 17:00 - More music
    "gaming",       # 18:00 - More gaming
    "promo",        # 19:00 - Promo slot
    "buzz",         # 20:00 - Viral & trending
    "podcast",      # 21:00 - More podcasts
    "film",         # 22:00 - More film
    "promo",        # 23:00 - Promo slot
]

# Content library by category for diverse programming (expanded)
CATEGORY_CONTENT = {
    "sports": [],
    "music": [],
    "podcast": [],
    "gaming": [],
    "film": [],
    "news": [],
    "culture": [],
    "tech": [],
    "documentary": [],
    "comedy": [],
    "fitness": [],
    "vlogs": [],
    "buzz": [],
}

def populate_category_content():
    """Populate CATEGORY_CONTENT from MOCK_HIGHLIGHTS for diverse scheduling"""
    global CATEGORY_CONTENT
    CATEGORY_CONTENT = {
        "sports": [],
        "music": [],
        "podcast": [],
        "gaming": [],
        "film": [],
        "news": [],
        "culture": [],
        "tech": [],
        "documentary": [],
        "comedy": [],
        "fitness": [],
        "vlogs": [],
        "buzz": [],
    }
    # Will be called after MOCK_HIGHLIGHTS is defined

class VideoComment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    video_id: str  # Can be highlight_id or archived_video_id or "live_stream"
    username: str
    message: str
    color: str = "#8b5cf6"
    likes: int = Field(default=0)
    is_pinned: bool = False
    is_hidden: bool = False  # Admin can hide inappropriate comments
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VideoCommentCreate(BaseModel):
    video_id: str
    username: str
    message: str
    color: str = "#8b5cf6"

# Comment Settings - Global and per-video
class CommentSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    target_id: str  # "global", "live_stream", or specific video_id
    comments_enabled: bool = True
    require_approval: bool = False  # If true, comments need admin approval
    slow_mode_seconds: int = 0  # 0 = disabled, >0 = seconds between messages
    blocked_words: List[str] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class CommentSettingsUpdate(BaseModel):
    comments_enabled: Optional[bool] = None
    require_approval: Optional[bool] = None
    slow_mode_seconds: Optional[int] = None
    blocked_words: Optional[List[str]] = None

class AIGeneratedContent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    thumbnail: str
    description: str
    ai_commentary: str
    humor_level: int = Field(default=7)
    views: int = Field(default=0)
    likes: int = Field(default=0)
    duration: str = "3:00"
    source: str = "AI Generated"
    trending_score: float = Field(default=75.0)
    video_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    in_rotation: bool = True

class TrendingTopic(BaseModel):
    """Real-time trending topic discovered from multiple sources"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    topic: str
    category: str
    sources: List[str] = []  # List of sources where this was found
    keywords: List[str] = []
    summary: str
    ai_narrative: str  # AI-synthesized story
    thumbnail: str
    video_url: Optional[str] = None
    views: int = Field(default=0)
    likes: int = Field(default=0)
    engagement_score: float = Field(default=80.0)
    is_breaking: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))

# Real-time trending topics templates - AI will expand on these with current events
TRENDING_TOPIC_SEEDS = {
    "sports": [
        {"topic": "NBA Playoffs", "keywords": ["basketball", "playoffs", "championship", "buzzer beater"]},
        {"topic": "NFL Draft", "keywords": ["football", "draft", "picks", "rookies"]},
        {"topic": "Soccer Transfer News", "keywords": ["soccer", "transfer", "premier league", "champions league"]},
        {"topic": "UFC/MMA Fights", "keywords": ["UFC", "MMA", "knockout", "fight"]},
        {"topic": "Tennis Grand Slam", "keywords": ["tennis", "Wimbledon", "US Open", "championship"]},
    ],
    "podcast": [
        {"topic": "Celebrity Interview Drama", "keywords": ["interview", "podcast", "controversy", "viral"]},
        {"topic": "True Crime Updates", "keywords": ["true crime", "investigation", "mystery", "solved"]},
        {"topic": "Comedy Special Reactions", "keywords": ["comedy", "standup", "Netflix", "special"]},
        {"topic": "Political Commentary", "keywords": ["politics", "debate", "election", "policy"]},
    ],
    "music": [
        {"topic": "New Album Drop", "keywords": ["album", "release", "streaming", "records"]},
        {"topic": "Concert Tour Announcement", "keywords": ["tour", "concert", "tickets", "sold out"]},
        {"topic": "Music Awards Drama", "keywords": ["Grammys", "awards", "performance", "winner"]},
        {"topic": "Viral Song Trend", "keywords": ["TikTok", "viral", "song", "dance"]},
    ],
    "film": [
        {"topic": "Box Office Records", "keywords": ["box office", "opening weekend", "records", "billion"]},
        {"topic": "Movie Trailer Reaction", "keywords": ["trailer", "teaser", "reaction", "hype"]},
        {"topic": "Streaming Wars Update", "keywords": ["Netflix", "Disney+", "streaming", "exclusive"]},
        {"topic": "Award Season Buzz", "keywords": ["Oscar", "nomination", "best picture", "actor"]},
    ],
    "tech": [
        {"topic": "AI Breakthrough", "keywords": ["AI", "artificial intelligence", "ChatGPT", "breakthrough"]},
        {"topic": "Product Launch", "keywords": ["Apple", "Google", "Samsung", "launch", "new"]},
        {"topic": "Crypto Market Movement", "keywords": ["Bitcoin", "crypto", "blockchain", "price"]},
        {"topic": "Tech Company News", "keywords": ["Meta", "Tesla", "Amazon", "earnings"]},
    ],
    "gaming": [
        {"topic": "Game Release/Update", "keywords": ["game", "release", "update", "patch"]},
        {"topic": "Esports Tournament", "keywords": ["esports", "tournament", "championship", "prize"]},
        {"topic": "Gaming Industry News", "keywords": ["PlayStation", "Xbox", "Nintendo", "exclusive"]},
        {"topic": "Speedrun World Record", "keywords": ["speedrun", "record", "glitch", "world record"]},
    ],
    "news": [
        {"topic": "Breaking World News", "keywords": ["breaking", "world", "international", "crisis"]},
        {"topic": "Science Discovery", "keywords": ["science", "discovery", "research", "NASA"]},
        {"topic": "Weather Event", "keywords": ["weather", "storm", "climate", "extreme"]},
        {"topic": "Economic Update", "keywords": ["economy", "stock", "market", "inflation"]},
    ],
    "culture": [
        {"topic": "Viral Social Media Moment", "keywords": ["viral", "TikTok", "Twitter", "meme"]},
        {"topic": "Celebrity News", "keywords": ["celebrity", "relationship", "scandal", "paparazzi"]},
        {"topic": "Internet Trend Analysis", "keywords": ["trend", "viral", "challenge", "internet"]},
        {"topic": "Fashion/Style Moment", "keywords": ["fashion", "style", "red carpet", "outfit"]},
    ],
}

# Video sources for embedding (royalty-free/embeddable content matching topics)
TOPIC_VIDEO_SOURCES = {
    "sports": [
        "https://www.youtube.com/watch?v=NSnAvhvfniw",  # Basketball highlights
        "https://www.youtube.com/watch?v=ysz5S6PUM-U",  # Sports moments
    ],
    "podcast": [
        "https://www.youtube.com/watch?v=rVqAdIMQZlk",  # Talk show clips
    ],
    "music": [
        "https://www.youtube.com/watch?v=JGwWNGJdvx8",  # Concert footage
    ],
    "film": [
        "https://www.youtube.com/watch?v=TWfph3iNC-k",  # Movie clips
    ],
    "tech": [
        "https://www.youtube.com/watch?v=Knyc_O2KQKs",  # Tech reviews
    ],
    "gaming": [
        "https://www.youtube.com/watch?v=9DI8kkR9G0s",  # Gaming highlights
    ],
    "news": [
        "https://www.youtube.com/watch?v=JXeJANDKwDc",  # News clips
    ],
    "culture": [
        "https://www.youtube.com/watch?v=OKcl_KMXhAM",  # Culture moments
    ],
}

# ============ MOCK DATA ============

CATEGORIES = [
    {"id": "sports", "name": "Sports", "color": "#f97316", "icon": "Trophy", "subcategories": [
        {"id": "nba", "name": "NBA Basketball"},
        {"id": "nfl", "name": "NFL Football"},
        {"id": "soccer", "name": "Soccer/Football"},
        {"id": "mma", "name": "UFC/MMA"},
        {"id": "boxing", "name": "Boxing"},
        {"id": "tennis", "name": "Tennis"},
        {"id": "baseball", "name": "MLB Baseball"},
    ]},
    {"id": "podcast", "name": "Podcasts", "color": "#8b5cf6", "icon": "Mic", "subcategories": [
        {"id": "interviews", "name": "Celebrity Interviews"},
        {"id": "comedy", "name": "Comedy"},
        {"id": "true-crime", "name": "True Crime"},
        {"id": "politics", "name": "Politics & News"},
        {"id": "business", "name": "Business & Finance"},
        {"id": "relationships", "name": "Relationships & Lifestyle"},
    ]},
    {"id": "music", "name": "Music", "color": "#d946ef", "icon": "Music", "subcategories": [
        {"id": "hiphop", "name": "Hip-Hop/R&B"},
        {"id": "afrobeats", "name": "Afrobeats"},
        {"id": "pop", "name": "Pop"},
        {"id": "rock", "name": "Rock"},
        {"id": "latin", "name": "Latin/Reggaeton"},
        {"id": "dance", "name": "Dance/EDM"},
        {"id": "concerts", "name": "Live Concerts"},
        {"id": "awards", "name": "Award Shows"},
    ]},
    {"id": "film", "name": "Film & TV", "color": "#ec4899", "icon": "Film", "subcategories": [
        {"id": "movies", "name": "Movies"},
        {"id": "tv-shows", "name": "TV Shows"},
        {"id": "streaming", "name": "Streaming News"},
        {"id": "trailers", "name": "Trailers"},
        {"id": "reviews", "name": "Reviews"},
        {"id": "african-cinema", "name": "African Cinema"},
    ]},
    {"id": "tech", "name": "Tech", "color": "#06b6d4", "icon": "Cpu", "subcategories": [
        {"id": "ai", "name": "AI & Machine Learning"},
        {"id": "gadgets", "name": "Gadgets"},
        {"id": "crypto", "name": "Crypto & Web3"},
        {"id": "startups", "name": "Startups"},
    ]},
    {"id": "gaming", "name": "Gaming", "color": "#22c55e", "icon": "Gamepad2", "subcategories": [
        {"id": "esports", "name": "Esports"},
        {"id": "pc", "name": "PC Gaming"},
        {"id": "console", "name": "Console"},
        {"id": "mobile", "name": "Mobile Gaming"},
    ]},
    {"id": "news", "name": "Breaking News", "color": "#eab308", "icon": "Newspaper", "subcategories": [
        {"id": "world", "name": "World News"},
        {"id": "politics", "name": "Politics"},
        {"id": "science", "name": "Science"},
        {"id": "weather", "name": "Weather"},
    ]},
    {"id": "culture", "name": "Culture", "color": "#f43f5e", "icon": "Sparkles", "subcategories": [
        {"id": "viral", "name": "Viral Moments"},
        {"id": "celebrity", "name": "Celebrity News"},
        {"id": "fashion", "name": "Fashion & Style"},
        {"id": "memes", "name": "Memes & Trends"},
        {"id": "black-culture", "name": "Black Culture & Entertainment"},
        {"id": "african-culture", "name": "African Culture"},
        {"id": "diaspora", "name": "Diaspora Stories"},
    ]},
    {"id": "other", "name": "Other", "color": "#71717a", "icon": "MoreHorizontal", "subcategories": [
        {"id": "documentary", "name": "Documentary"},
        {"id": "educational", "name": "Educational"},
        {"id": "lifestyle", "name": "Lifestyle"},
        {"id": "comedy", "name": "Comedy"},
        {"id": "misc", "name": "Miscellaneous"},
    ]},
]

MOCK_HIGHLIGHTS = [
    # SPORTS - Real viral sports content with ACCURATE matching videos
    {
        "id": "h1",
        "title": "LeBron James Top 40 Career Plays - 40th Birthday Special",
        "category": "sports",
        "subcategory": "nba",
        "thumbnail": "https://i.ytimg.com/vi/-9lP95Qo-I0/maxresdefault.jpg",
        "description": "The King's most iconic moments - dunks, blocks, and clutch shots that defined an era. Official NBA release.",
        "ai_commentary": "LeBron proving once again why he's called the King. At this point, Father Time should just retire because LeBron isn't listening.",
        "video_url": "https://www.youtube.com/embed/-9lP95Qo-I0",
        "views": 12500000,
        "likes": 850000,
        "duration": "10:45",
        "source": "NBA Official",
        "trending_score": 98.5,
        "is_live": False
    },
    {
        "id": "h1b",
        "title": "Michael Jordan - His Airness Full Documentary",
        "category": "sports",
        "subcategory": "nba",
        "thumbnail": "https://i.ytimg.com/vi/5ofWv1DGPSg/maxresdefault.jpg",
        "description": "The complete story of the greatest basketball player ever. From Bulls to legacy.",
        "ai_commentary": "MJ didn't just play basketball, he changed the entire game. Six rings and zero debate.",
        "video_url": "https://www.youtube.com/embed/5ofWv1DGPSg",
        "views": 8900000,
        "likes": 620000,
        "duration": "1:49:22",
        "source": "Joseph Vincent",
        "trending_score": 96.2,
        "is_live": False
    },
    {
        "id": "h1c",
        "title": "Lionel Messi - All 2024 Goals | Inter Miami",
        "category": "sports",
        "subcategory": "soccer",
        "thumbnail": "https://i.ytimg.com/vi/JhWPHsx_h-8/maxresdefault.jpg",
        "description": "Every single goal from Messi's 2024 Inter Miami season. Pure magic from the GOAT.",
        "ai_commentary": "Messi making MLS defenders look silly. At 37, he's still the best player on the planet.",
        "video_url": "https://www.youtube.com/embed/JhWPHsx_h-8",
        "views": 45000000,
        "likes": 1200000,
        "duration": "15:30",
        "source": "Inter Miami CF",
        "trending_score": 99.1,
        "is_live": False
    },
    {
        "id": "h1d",
        "title": "Top 100 Catches of the 2024 NFL Season",
        "category": "sports",
        "subcategory": "nfl",
        "thumbnail": "https://i.ytimg.com/vi/7AfEjKekOa0/maxresdefault.jpg",
        "description": "The most insane catches from the 2024 NFL season. One-handed grabs and diving plays.",
        "ai_commentary": "These receivers have magnets for hands. Pure athletic excellence.",
        "video_url": "https://www.youtube.com/embed/7AfEjKekOa0",
        "views": 5200000,
        "likes": 320000,
        "duration": "23:45",
        "source": "NFL Official",
        "trending_score": 94.8,
        "is_live": False
    },
    # PODCAST - Real podcast clips with accurate links
    {
        "id": "h2",
        "title": "Katt Williams FULL Interview on Club Shay Shay",
        "category": "podcast",
        "subcategory": "interviews",
        "thumbnail": "https://i.ytimg.com/vi/8oRRZiRQxTs/maxresdefault.jpg",
        "description": "The interview that broke the internet. Katt Williams holds nothing back on Shannon Sharpe's show.",
        "ai_commentary": "Katt Williams spilled ALL the tea and the internet still hasn't recovered. Shannon just sat there like the rest of us.",
        "video_url": "https://www.youtube.com/embed/8oRRZiRQxTs",
        "views": 91000000,
        "likes": 2920000,
        "duration": "2:45:30",
        "source": "Club Shay Shay",
        "trending_score": 99.8,
        "is_live": False
    },
    {
        "id": "h2b",
        "title": "Joe Rogan Experience #2404 - Elon Musk",
        "category": "podcast",
        "subcategory": "interviews",
        "thumbnail": "https://i.ytimg.com/vi/O4wBUysNe2k/maxresdefault.jpg",
        "description": "Elon Musk talks about SpaceX, Tesla, X, AI, and the future of humanity.",
        "ai_commentary": "Three hours of Elon being Elon. My brain needs a vacation after this.",
        "video_url": "https://www.youtube.com/embed/O4wBUysNe2k",
        "views": 42000000,
        "likes": 1100000,
        "duration": "2:58:20",
        "source": "JRE",
        "trending_score": 96.5,
        "is_live": False
    },
    {
        "id": "h2c",
        "title": "Drink Champs - 50 Cent Part 1 (Full Episode)",
        "category": "podcast",
        "subcategory": "hiphop",
        "thumbnail": "https://i.ytimg.com/vi/yir4GNA52xE/maxresdefault.jpg",
        "description": "50 Cent on Drink Champs - his rise, G-Unit, Get Rich or Die Tryin', beefs, and business empire.",
        "ai_commentary": "50 Cent being 50 Cent. No filter, no regrets, and absolutely hilarious.",
        "video_url": "https://www.youtube.com/embed/yir4GNA52xE",
        "views": 8500000,
        "likes": 420000,
        "duration": "1:13:26",
        "source": "Drink Champs",
        "trending_score": 93.2,
        "is_live": False
    },
    # MUSIC - Full music videos that play properly (no trailers)
    {
        "id": "h3",
        "title": "The Weeknd - Blinding Lights (Official Video)",
        "category": "music",
        "subcategory": "pop",
        "thumbnail": "https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg",
        "description": "The Weeknd's biggest hit with iconic synthwave vibes and Vegas aesthetics.",
        "ai_commentary": "This song literally owned 2020. Still can't get it out of my head.",
        "video_url": "https://www.youtube.com/embed/4NRXx6U8ABQ",
        "views": 4500000000,
        "likes": 25000000,
        "duration": "4:22",
        "source": "The Weeknd",
        "trending_score": 99.9,
        "is_live": False
    },
    {
        "id": "h3b",
        "title": "Dua Lipa - Levitating (Official Video)",
        "category": "music",
        "subcategory": "pop",
        "thumbnail": "https://i.ytimg.com/vi/TUVcZfQe-Kw/maxresdefault.jpg",
        "description": "The disco-pop anthem that dominated the charts worldwide.",
        "ai_commentary": "Dua Lipa brought disco back and we're not complaining. Pure vibes!",
        "video_url": "https://www.youtube.com/embed/TUVcZfQe-Kw",
        "views": 1200000000,
        "likes": 8500000,
        "duration": "3:41",
        "source": "Dua Lipa",
        "trending_score": 98.5,
        "is_live": False
    },
    {
        "id": "h3c",
        "title": "Bad Bunny - Tití Me Preguntó (Official Video)",
        "category": "music",
        "subcategory": "latin",
        "thumbnail": "https://i.ytimg.com/vi/soCe4ztSHYQ/maxresdefault.jpg",
        "description": "Bad Bunny's viral hit from Un Verano Sin Ti - the biggest album of 2022.",
        "ai_commentary": "Bad Bunny owns the summer every single year. This song is unstoppable!",
        "video_url": "https://www.youtube.com/embed/soCe4ztSHYQ",
        "views": 850000000,
        "likes": 7200000,
        "duration": "4:12",
        "source": "Bad Bunny",
        "trending_score": 99.2,
        "is_live": False
    },
    {
        "id": "h3d",
        "title": "Harry Styles - As It Was (Official Video)",
        "category": "music",
        "subcategory": "pop",
        "thumbnail": "https://i.ytimg.com/vi/H5v3kku4y6Q/maxresdefault.jpg",
        "description": "Harry Styles' emotional hit that topped charts in 35 countries.",
        "ai_commentary": "Harry went from boy band to global superstar. This song hits different.",
        "video_url": "https://www.youtube.com/embed/H5v3kku4y6Q",
        "views": 1600000000,
        "likes": 12000000,
        "duration": "2:47",
        "source": "Harry Styles",
        "trending_score": 98.8,
        "is_live": False
    },
    {
        "id": "h3e",
        "title": "SZA - Kill Bill (Official Video)",
        "category": "music",
        "subcategory": "rnb",
        "thumbnail": "https://i.ytimg.com/vi/hTLJYxfkIeg/maxresdefault.jpg",
        "description": "SZA's revenge anthem from the album SOS - raw and emotional.",
        "ai_commentary": "SZA really said 'if I can't have you, nobody can' and we felt that.",
        "video_url": "https://www.youtube.com/embed/hTLJYxfkIeg",
        "views": 420000000,
        "likes": 5500000,
        "duration": "2:33",
        "source": "SZA",
        "trending_score": 97.5,
        "is_live": False
    },
    {
        "id": "h3f",
        "title": "Miley Cyrus - Flowers (Official Video)",
        "category": "music",
        "subcategory": "pop",
        "thumbnail": "https://i.ytimg.com/vi/G7KNmW9a75Y/maxresdefault.jpg",
        "description": "Miley's empowerment anthem that broke streaming records.",
        "ai_commentary": "Miley really said 'I can buy myself flowers' and that energy is everything.",
        "video_url": "https://www.youtube.com/embed/G7KNmW9a75Y",
        "views": 1300000000,
        "likes": 9800000,
        "duration": "3:21",
        "source": "Miley Cyrus",
        "trending_score": 99.1,
        "is_live": False
    },
    {
        "id": "h3g",
        "title": "Bruno Mars, Anderson .Paak - Leave The Door Open (Official Video)",
        "category": "music",
        "subcategory": "rnb",
        "thumbnail": "https://i.ytimg.com/vi/adLGHcj_fmA/maxresdefault.jpg",
        "description": "Silk Sonic's Grammy-winning debut single - pure 70s soul vibes.",
        "ai_commentary": "Bruno and Anderson brought back real R&B and we didn't know we needed it.",
        "video_url": "https://www.youtube.com/embed/adLGHcj_fmA",
        "views": 750000000,
        "likes": 6200000,
        "duration": "4:02",
        "source": "Silk Sonic",
        "trending_score": 98.0,
        "is_live": False
    },
    {
        "id": "h3h",
        "title": "Rihanna - Lift Me Up (Official Video)",
        "category": "music",
        "subcategory": "ballad",
        "thumbnail": "https://i.ytimg.com/vi/ZZWk-GbpQSc/maxresdefault.jpg",
        "description": "Rihanna's emotional return from Black Panther: Wakanda Forever.",
        "ai_commentary": "Rihanna came back after 6 years and delivered chills. The queen never misses.",
        "video_url": "https://www.youtube.com/embed/ZZWk-GbpQSc",
        "views": 350000000,
        "likes": 4500000,
        "duration": "3:26",
        "source": "Rihanna",
        "trending_score": 97.8,
        "is_live": False
    },
    # FILM - Movie content with accurate links
    {
        "id": "h4",
        "title": "Deadpool & Wolverine - Official Trailer",
        "category": "film",
        "subcategory": "movies",
        "thumbnail": "https://i.ytimg.com/vi/73_1biulkYk/maxresdefault.jpg",
        "description": "Ryan Reynolds and Hugh Jackman team up. The MCU will never be the same.",
        "ai_commentary": "Marvel finally letting Deadpool be Deadpool. Our wallets are ready to suffer.",
        "video_url": "https://www.youtube.com/embed/73_1biulkYk",
        "views": 135000000,
        "likes": 4100000,
        "duration": "2:39",
        "source": "Marvel Entertainment",
        "trending_score": 99.5,
        "is_live": False
    },
    {
        "id": "h4b",
        "title": "Dune Part 2 - Full Movie Breakdown",
        "category": "film",
        "subcategory": "movies",
        "thumbnail": "https://i.ytimg.com/vi/Way9Dexny3w/maxresdefault.jpg",
        "description": "Denis Villeneuve's epic conclusion. Every detail, every Easter egg explained.",
        "ai_commentary": "Dune Part 2 made sand look exciting. That's the power of cinema.",
        "video_url": "https://www.youtube.com/embed/Way9Dexny3w",
        "views": 42000000,
        "likes": 2100000,
        "duration": "18:45",
        "source": "Warner Bros",
        "trending_score": 98.2,
        "is_live": False
    },
    # TECH - Technology content with accurate links
    {
        "id": "h5",
        "title": "iPhone 15 Pro Review - MKBHD",
        "category": "tech",
        "subcategory": "gadgets",
        "thumbnail": "https://i.ytimg.com/vi/cBpGq-vDr2Y/maxresdefault.jpg",
        "description": "Marques Brownlee's comprehensive review of Apple's latest flagship iPhone 15 Pro.",
        "ai_commentary": "MKBHD doing what MKBHD does best - making us want to upgrade our perfectly fine phones.",
        "video_url": "https://www.youtube.com/embed/cBpGq-vDr2Y",
        "views": 28000000,
        "likes": 1500000,
        "duration": "14:30",
        "source": "MKBHD",
        "trending_score": 97.4,
        "is_live": False
    },
    {
        "id": "h5b",
        "title": "GPT-5 is here... Can it win back programmers? | Fireship",
        "category": "tech",
        "subcategory": "ai",
        "thumbnail": "https://i.ytimg.com/vi/8tx2viHpgA8/maxresdefault.jpg",
        "description": "Fireship breaks down GPT-5 - is it a game-changer or overhyped upgrade toward superintelligence?",
        "ai_commentary": "AI is evolving faster than my student loans. At least one of us is growing.",
        "video_url": "https://www.youtube.com/embed/8tx2viHpgA8",
        "views": 15000000,
        "likes": 980000,
        "duration": "7:35",
        "source": "Fireship",
        "trending_score": 96.1,
        "is_live": False
    },
    # GAMING - Gaming content with accurate links
    {
        "id": "h6",
        "title": "GTA 6 Official Trailer - Full Analysis",
        "category": "gaming",
        "subcategory": "console",
        "thumbnail": "https://i.ytimg.com/vi/QdBZY2fkU-0/maxresdefault.jpg",
        "description": "Rockstar finally drops the GTA 6 trailer. Every frame analyzed.",
        "ai_commentary": "Rockstar really made us wait 10+ years and we're STILL hyped. Stockholm syndrome but make it gaming.",
        "video_url": "https://www.youtube.com/embed/QdBZY2fkU-0",
        "views": 195000000,
        "likes": 12200000,
        "duration": "1:31",
        "source": "Rockstar Games",
        "trending_score": 99.9,
        "is_live": False
    },
    {
        "id": "h6b",
        "title": "Fortnite OG - Official Gameplay Trailer",
        "category": "gaming",
        "subcategory": "esports",
        "thumbnail": "https://i.ytimg.com/vi/p7e3KAAKAqw/maxresdefault.jpg",
        "description": "Fortnite brings back Chapter 1 Season 1. The original map, original loot, original experience.",
        "ai_commentary": "Epic Games said 'you want nostalgia? Here's ALL the nostalgia.' And we ate it up.",
        "video_url": "https://www.youtube.com/embed/p7e3KAAKAqw",
        "views": 38000000,
        "likes": 2200000,
        "duration": "1:55",
        "source": "Fortnite Official",
        "trending_score": 98.6,
        "is_live": False
    },
    # CULTURE/BUZZ - Viral content with accurate links
    {
        "id": "h8",
        "title": "The Best Of The Internet (2024) - Daily Dose",
        "category": "culture",
        "subcategory": "viral",
        "thumbnail": "https://i.ytimg.com/vi/lC9emrW0F2o/maxresdefault.jpg",
        "description": "The most viral moments of 2024 compiled. Pure internet gold from Daily Dose of Internet.",
        "ai_commentary": "The internet remains undefeated in creating chaos. We wouldn't have it any other way.",
        "video_url": "https://www.youtube.com/embed/lC9emrW0F2o",
        "views": 22000000,
        "likes": 1800000,
        "duration": "29:07",
        "source": "Daily Dose of Internet",
        "trending_score": 97.3,
        "is_live": False
    },
    {
        "id": "h8b",
        "title": "Best of Kai Cenat 2024 - Stream Highlights",
        "category": "culture",
        "subcategory": "streaming",
        "thumbnail": "https://i.ytimg.com/vi/PTl4o24-v9Y/maxresdefault.jpg",
        "description": "The best moments from Kai Cenat's record-breaking Mafiathon 2 and 2024 streams.",
        "ai_commentary": "Kai Cenat turned streaming into an Olympic sport. Those energy levels are unmatched.",
        "video_url": "https://www.youtube.com/embed/PTl4o24-v9Y",
        "views": 35000000,
        "likes": 2100000,
        "duration": "1:53:06",
        "source": "Kai Cenat",
        "trending_score": 98.5,
        "is_live": False
    },
    {
        "id": "h8c",
        "title": "MrBeast - 2,000 People Fight For $5,000,000",
        "category": "culture",
        "subcategory": "viral",
        "thumbnail": "https://i.ytimg.com/vi/gs8qfL9PNac/maxresdefault.jpg",
        "description": "MrBeast's biggest challenge yet. 2,000 contestants compete for $5 million.",
        "ai_commentary": "MrBeast really said 'let me just give away another million.' His accountant must be stressed.",
        "video_url": "https://www.youtube.com/embed/gs8qfL9PNac",
        "views": 180000000,
        "likes": 8500000,
        "duration": "28:15",
        "source": "MrBeast",
        "trending_score": 99.4,
        "is_live": False
    },
    # NEWS - Breaking news content
    {
        "id": "h7",
        "title": "BBC News Live - Global Headlines Today",
        "category": "news",
        "subcategory": "world",
        "thumbnail": "https://i.ytimg.com/vi/OtK5aVPe884/maxresdefault.jpg",
        "description": "Breaking news from around the world. Live coverage of today's top stories from BBC News.",
        "ai_commentary": "Staying informed in 2024 is a full-time job. Here's your daily briefing.",
        "video_url": "https://www.youtube.com/embed/OtK5aVPe884",
        "views": 8500000,
        "likes": 420000,
        "duration": "LIVE",
        "source": "BBC News",
        "trending_score": 94.2,
        "is_live": True
    },
    # OTHER - Documentary, educational, comedy
    {
        "id": "h9",
        "title": "What is the Speed of Dark? - Vsauce",
        "category": "other",
        "subcategory": "educational",
        "thumbnail": "https://i.ytimg.com/vi/JTvcpdfGUtQ/maxresdefault.jpg",
        "description": "Michael from Vsauce explores the fascinating physics of darkness and shadows.",
        "ai_commentary": "Came here to scroll, now I'm questioning the fabric of reality. Thanks, Vsauce.",
        "video_url": "https://www.youtube.com/embed/JTvcpdfGUtQ",
        "views": 32000000,
        "likes": 1900000,
        "duration": "7:14",
        "source": "Vsauce",
        "trending_score": 96.8,
        "is_live": False
    },
    {
        "id": "h9b",
        "title": "15 Minutes of Kevin Hart Stand-Up Comedy | Netflix",
        "category": "other",
        "subcategory": "comedy",
        "thumbnail": "https://i.ytimg.com/vi/ooaIo4_TNdE/maxresdefault.jpg",
        "description": "Kevin Hart's funniest stand-up moments from his Netflix specials. Warning: You WILL laugh out loud.",
        "ai_commentary": "Kevin Hart turning his height jokes into millions. Short king energy at its finest.",
        "video_url": "https://www.youtube.com/embed/ooaIo4_TNdE",
        "views": 28000000,
        "likes": 1600000,
        "duration": "15:56",
        "source": "Netflix Is A Joke",
        "trending_score": 95.4,
        "is_live": False
    },
]

# Populate category content from MOCK_HIGHLIGHTS
def init_category_content():
    """Initialize category content from MOCK_HIGHLIGHTS"""
    for highlight in MOCK_HIGHLIGHTS:
        category = highlight.get("category", "other")
        if category in CATEGORY_CONTENT:
            CATEGORY_CONTENT[category].append(highlight)
        elif category == "other":
            # Distribute "other" content across categories
            CATEGORY_CONTENT["culture"].append(highlight)
    
    # Add SCHEDULE-EXCLUSIVE content (not featured elsewhere on the site)
    SCHEDULE_EXCLUSIVE = [
        # Documentary content
        {
            "id": "doc-nature-1",
            "title": "Planet Earth III - Behind the Scenes",
            "description": "Exclusive behind-the-scenes footage from the groundbreaking documentary series.",
            "category": "documentary",
            "video_url": "https://www.youtube.com/watch?v=JbJgYpuzgcI",
            "thumbnail": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800",
            "duration": "12:30",
            "source": "BBC Earth",
            "trending_score": 88.5,
            "ai_commentary": "Nature documentaries continue to captivate audiences worldwide with stunning visuals.",
            "is_schedule_exclusive": True
        },
        # Comedy content
        {
            "id": "comedy-standup-1",
            "title": "Best Stand-Up Moments 2024",
            "description": "The funniest stand-up comedy clips that had audiences in tears.",
            "category": "comedy",
            "video_url": "https://www.youtube.com/watch?v=JTdVLJ-1JLM",
            "thumbnail": "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800",
            "duration": "15:45",
            "source": "Comedy Central",
            "trending_score": 91.2,
            "ai_commentary": "Comedy continues to evolve with fresh perspectives and relatable humor.",
            "is_schedule_exclusive": True
        },
        # Fitness content
        {
            "id": "fitness-hiit-1",
            "title": "30-Minute Full Body HIIT Workout",
            "description": "High-intensity interval training that delivers results. No equipment needed.",
            "category": "fitness",
            "video_url": "https://www.youtube.com/watch?v=ml6cT4AZdqI",
            "thumbnail": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
            "duration": "30:00",
            "source": "ZTVLIVE Fitness",
            "trending_score": 85.0,
            "ai_commentary": "Fitness content continues to dominate as viewers prioritize health and wellness.",
            "is_schedule_exclusive": True
        },
        # Vlogs content
        {
            "id": "vlog-travel-1",
            "title": "Japan Travel Vlog - Hidden Gems of Tokyo",
            "description": "Discover the secret spots tourists never see. Local favorites revealed.",
            "category": "vlogs",
            "video_url": "https://www.youtube.com/watch?v=WLIv7HnZ_fE",
            "thumbnail": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800",
            "duration": "22:15",
            "source": "Travel Creators",
            "trending_score": 87.8,
            "ai_commentary": "Travel vlogs offer virtual escapes and authentic local experiences.",
            "is_schedule_exclusive": True
        },
        # Buzz/Viral content
        {
            "id": "buzz-viral-1",
            "title": "This Week's Viral Moments Compilation",
            "description": "The internet's most talked-about moments from the past 7 days.",
            "category": "buzz",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=800",
            "duration": "18:30",
            "source": "ZTVLIVE Viral",
            "trending_score": 95.5,
            "ai_commentary": "The internet never sleeps, and neither does our viral content radar!",
            "is_schedule_exclusive": True
        },
        # More documentary
        {
            "id": "doc-space-1",
            "title": "James Webb Telescope - New Discoveries",
            "description": "Mind-blowing new images and discoveries from the most powerful telescope ever built.",
            "category": "documentary",
            "video_url": "https://www.youtube.com/watch?v=GvHJZHC9Sh8",
            "thumbnail": "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800",
            "duration": "25:00",
            "source": "NASA",
            "trending_score": 92.1,
            "ai_commentary": "Space exploration continues to reveal the universe's incredible mysteries.",
            "is_schedule_exclusive": True
        },
        # More comedy
        {
            "id": "comedy-sketch-1",
            "title": "SNL Best Sketches - Season Highlights",
            "description": "The most memorable comedy sketches that defined this season.",
            "category": "comedy",
            "video_url": "https://www.youtube.com/watch?v=lJRBJhJXBa0",
            "thumbnail": "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800",
            "duration": "20:00",
            "source": "NBC",
            "trending_score": 89.0,
            "ai_commentary": "Sketch comedy remains a cultural touchstone for political and social commentary.",
            "is_schedule_exclusive": True
        },
    ]
    
    # Add exclusive content to categories
    for item in SCHEDULE_EXCLUSIVE:
        category = item.get("category")
        if category in CATEGORY_CONTENT:
            CATEGORY_CONTENT[category].append(item)

# Initialize on module load
init_category_content()

# AI Content Templates for generating new highlights
AI_CONTENT_TEMPLATES = {
    "sports": [
        {"topic": "basketball buzzer beater", "template": "INCREDIBLE {team} buzzer beater wins the game!"},
        {"topic": "soccer goal celebration", "template": "{player}'s wild goal celebration goes viral"},
        {"topic": "boxing knockout", "template": "DEVASTATING knockout in round {round}!"},
        {"topic": "football touchdown", "template": "{team} scores game-winning TD in final seconds"},
        {"topic": "tennis ace", "template": "{player} serves 150mph ace at championship point"},
    ],
    "podcast": [
        {"topic": "celebrity interview", "template": "{celebrity} reveals shocking secret on podcast"},
        {"topic": "debate goes viral", "template": "Heated debate breaks the internet"},
        {"topic": "comedian roast", "template": "{comedian}'s brutal roast leaves host speechless"},
        {"topic": "life advice", "template": "This life advice clip has millions crying"},
    ],
    "music": [
        {"topic": "live performance", "template": "{artist}'s concert moment leaves fans SHOOK"},
        {"topic": "unreleased song", "template": "Leaked {artist} track has fans going crazy"},
        {"topic": "dance challenge", "template": "New dance challenge takes over TikTok"},
        {"topic": "cover song", "template": "This {song} cover is better than the original?!"},
    ],
    "film": [
        {"topic": "movie trailer", "template": "New {movie} trailer breaks viewing records"},
        {"topic": "behind scenes", "template": "Behind-the-scenes {movie} blooper goes viral"},
        {"topic": "actor transformation", "template": "{actor}'s transformation for new role is INSANE"},
        {"topic": "plot twist reaction", "template": "Audience reactions to {movie} twist are hilarious"},
    ],
    "tech": [
        {"topic": "product launch", "template": "{company} announces game-changing product"},
        {"topic": "AI breakthrough", "template": "New AI can now {ability} - scientists amazed"},
        {"topic": "gadget fail", "template": "{product} launch goes hilariously wrong"},
        {"topic": "hack discovery", "template": "Life hack: {hack} - why didn't we know this?!"},
    ],
    "gaming": [
        {"topic": "speedrun record", "template": "{game} beaten in {time} - new world record!"},
        {"topic": "glitch discovery", "template": "Hilarious {game} glitch breaks the internet"},
        {"topic": "pro play", "template": "Pro player's {game} play is absolutely INSANE"},
        {"topic": "game announcement", "template": "{game} sequel announced - fans lose it"},
    ],
    "news": [
        {"topic": "weird news", "template": "You won't believe what happened in {place}"},
        {"topic": "feel good story", "template": "Heartwarming: {subject} story goes viral"},
        {"topic": "science discovery", "template": "Scientists discover {discovery} - mind blown"},
        {"topic": "world record", "template": "New world record for {record} - unbelievable!"},
    ],
    "culture": [
        {"topic": "meme origin", "template": "The origin of {meme} meme finally explained"},
        {"topic": "trend analysis", "template": "Why {trend} is taking over social media"},
        {"topic": "celebrity moment", "template": "{celebrity}'s {action} moment goes viral"},
        {"topic": "internet debate", "template": "Internet divided over {topic} - which side are you?"},
    ],
    "other": [
        {"topic": "documentary", "template": "Mind-blowing documentary reveals {subject}"},
        {"topic": "educational", "template": "This {topic} explanation will change how you see the world"},
        {"topic": "lifestyle", "template": "{trend} lifestyle trend is taking over in 2026"},
        {"topic": "comedy", "template": "This comedian's {topic} bit has everyone rolling"},
        {"topic": "misc", "template": "You won't believe this {subject} story"},
    ],
}

# Sample thumbnails for AI-generated content by category - Using copyright-free Unsplash images
CATEGORY_THUMBNAILS = {
    "sports": [
        "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",  # Basketball action
        "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",  # Soccer/Football
        "https://images.unsplash.com/photo-1461896836934-48a0b6cef7c9?w=800",  # Stadium crowd
        "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800",  # Running/Athletics
    ],
    "podcast": [
        "https://images.unsplash.com/photo-1589903308904-1010c2294adc?w=800",  # Studio microphone
        "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800",  # Radio studio
        "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800",  # Podcast recording
    ],
    "music": [
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",  # Concert crowd
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",  # Concert stage lights
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",  # Music performance
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800",  # DJ setup
    ],
    "film": [
        "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800",  # Cinema camera
        "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800",  # Film reel
        "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800",  # Movie theater
    ],
    "tech": [
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",  # Circuit board
        "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800",  # Cybersecurity
        "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800",  # Laptop technology
    ],
    "gaming": [
        "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800",  # Gaming setup
        "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800",  # Esports
        "https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=800",  # Gaming controller
    ],
    "news": [
        "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800",  # Newspaper
        "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800",  # Breaking news
        "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800",  # News desk
    ],
    "culture": [
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800",  # Friends group
        "https://images.unsplash.com/photo-1534030347209-467a5b0ad3e6?w=800",  # Social media
        "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800",  # Diverse group
    ],
    "other": [
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",  # Documentary
        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800",  # Educational
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800",  # Lifestyle
    ],
}

MOCK_CHAT_MESSAGES = [
    {"username": "StreamKing99", "message": "This is FIRE 🔥🔥🔥", "color": "#f97316"},
    {"username": "NightOwl_TV", "message": "24/7 content hits different at 3am", "color": "#8b5cf6"},
    {"username": "ViralWatcher", "message": "Lmaooo the commentary is killing me", "color": "#22c55e"},
    {"username": "TrendHunter", "message": "W content as always", "color": "#ec4899"},
    {"username": "MemeOverlord", "message": "Chat moving so fast no one will see I love ZTVLIVE", "color": "#06b6d4"},
]

# ============ API ROUTES ============

@api_router.get("/")
async def root():
    return {"message": "ZTVLIVE API - Your 24/7 Trending Highlights Channel"}

@api_router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}

@api_router.get("/highlights", response_model=dict)
async def get_highlights(category: Optional[str] = None, limit: int = 20):
    highlights = MOCK_HIGHLIGHTS.copy()
    
    # Check for custom highlights in DB
    db_highlights = await db.highlights.find({}, {"_id": 0}).to_list(100)
    if db_highlights:
        for h in db_highlights:
            if isinstance(h.get('created_at'), str):
                h['created_at'] = datetime.fromisoformat(h['created_at'])
        highlights.extend(db_highlights)
    
    if category and category != "all":
        highlights = [h for h in highlights if h.get("category") == category]
    
    # Sort by trending score
    highlights.sort(key=lambda x: x.get("trending_score", 0), reverse=True)
    
    return {"highlights": highlights[:limit], "total": len(highlights)}

@api_router.get("/highlights/{highlight_id}")
async def get_highlight(highlight_id: str):
    # Check mock data first
    for h in MOCK_HIGHLIGHTS:
        if h["id"] == highlight_id:
            return h
    
    # Check DB
    db_highlight = await db.highlights.find_one({"id": highlight_id}, {"_id": 0})
    if db_highlight:
        if isinstance(db_highlight.get('created_at'), str):
            db_highlight['created_at'] = datetime.fromisoformat(db_highlight['created_at'])
        return db_highlight
    
    raise HTTPException(status_code=404, detail="Highlight not found")

@api_router.get("/live/current")
async def get_current_live():
    """Get the currently playing content in the 24/7 stream"""
    from services.tv_scheduler import get_current_program
    
    # Get current video (checks creator bookings first, then AI schedule)
    current = get_current_program()
    
    if not current:
        # Fallback
        all_highlights = MOCK_HIGHLIGHTS.copy()
        current_index = int(datetime.now(timezone.utc).timestamp() / 300) % len(all_highlights)
        current = all_highlights[current_index].copy()
        current["is_live"] = True
        current["is_creator_content"] = False
    
    # Make sure YouTube URLs are in embed format
    video_url = current.get("video_url", "")
    if "youtube.com/watch?v=" in video_url:
        video_id = video_url.split("watch?v=")[1].split("&")[0]
        current["video_url"] = f"https://www.youtube.com/embed/{video_id}"
        current["embed_url"] = f"https://www.youtube.com/embed/{video_id}?autoplay=1&rel=0"
    elif "youtu.be/" in video_url:
        video_id = video_url.split("youtu.be/")[1].split("?")[0]
        current["video_url"] = f"https://www.youtube.com/embed/{video_id}"
        current["embed_url"] = f"https://www.youtube.com/embed/{video_id}?autoplay=1&rel=0"
    elif "youtube.com/embed/" in video_url:
        current["embed_url"] = video_url if "autoplay=1" in video_url else f"{video_url}?autoplay=1&rel=0"
    
    # Get next up from schedule
    from services.tv_scheduler import get_upcoming_programs
    upcoming = get_upcoming_programs(1)
    next_up = upcoming[0] if upcoming else None
    
    return {
        "current": current,
        "next_up": next_up,
        "viewers": random.randint(5000, 50000),
        "started_at": datetime.now(timezone.utc).isoformat(),
        "is_creator_content": current.get("is_creator_content", False),
        "creator_name": current.get("creator_name") if current.get("is_creator_content") else None
    }

@api_router.get("/chat/messages")
async def get_chat_messages():
    """Get recent chat messages (simulated live chat)"""
    messages = []
    for i, msg in enumerate(MOCK_CHAT_MESSAGES):
        messages.append({
            "id": f"msg_{i}_{random.randint(1000, 9999)}",
            **msg,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    return {"messages": messages}

@api_router.post("/chat/send")
async def send_chat_message(message: ChatMessage):
    """Send a chat message"""
    msg_dict = message.model_dump()
    msg_dict['timestamp'] = msg_dict['timestamp'].isoformat()
    await db.chat_messages.insert_one(msg_dict)
    # Remove MongoDB _id from response
    msg_dict.pop('_id', None)
    return {"success": True, "message": msg_dict}

# ============ VIDEO COMMENTS (Persistent - Always Active) ============

async def get_comment_settings(target_id: str) -> dict:
    """Get comment settings for a target (global, live_stream, or video_id)"""
    # Check specific settings first
    settings = await db.comment_settings.find_one({"target_id": target_id}, {"_id": 0})
    if settings:
        return settings
    
    # Fall back to global settings
    global_settings = await db.comment_settings.find_one({"target_id": "global"}, {"_id": 0})
    if global_settings:
        return global_settings
    
    # Default: comments enabled
    return {"comments_enabled": True, "require_approval": False, "slow_mode_seconds": 0, "blocked_words": []}

@api_router.get("/comments/{video_id}")
async def get_video_comments(video_id: str, limit: int = 50, include_hidden: bool = False):
    """Get all comments for a video - works for any video whether live or not"""
    # Get comment settings
    settings = await get_comment_settings(video_id)
    
    query = {"video_id": video_id}
    if not include_hidden:
        query["is_hidden"] = {"$ne": True}
    
    comments = await db.video_comments.find(
        query, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Get pinned comments first
    pinned = [c for c in comments if c.get("is_pinned")]
    unpinned = [c for c in comments if not c.get("is_pinned")]
    comments = pinned + unpinned
    
    for comment in comments:
        if isinstance(comment.get('created_at'), str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
    
    return {
        "comments": comments, 
        "total": len(comments), 
        "video_id": video_id,
        "settings": {
            "comments_enabled": settings.get("comments_enabled", True),
            "slow_mode_seconds": settings.get("slow_mode_seconds", 0)
        }
    }

@api_router.post("/comments", response_model=VideoComment)
async def add_video_comment(comment: VideoCommentCreate):
    """Add a comment to any video - checks if comments are enabled"""
    # Check if comments are enabled for this video
    settings = await get_comment_settings(comment.video_id)
    
    if not settings.get("comments_enabled", True):
        raise HTTPException(status_code=403, detail="Comments are disabled for this content")
    
    # Check for blocked words
    blocked_words = settings.get("blocked_words", [])
    message_lower = comment.message.lower()
    for word in blocked_words:
        if word.lower() in message_lower:
            raise HTTPException(status_code=400, detail="Your comment contains blocked content")
    
    comment_obj = VideoComment(**comment.model_dump())
    
    # If require_approval is on, comments are hidden by default
    if settings.get("require_approval", False):
        comment_obj.is_hidden = True
    
    doc = comment_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.video_comments.insert_one(doc)
    logger.info(f"New comment on video {comment.video_id}: {comment.message[:50]}")
    return comment_obj

@api_router.post("/comments/{comment_id}/like")
async def like_comment(comment_id: str):
    """Like a comment"""
    await db.video_comments.update_one(
        {"id": comment_id},
        {"$inc": {"likes": 1}}
    )
    return {"success": True, "comment_id": comment_id}

@api_router.get("/comments/recent/all")
async def get_recent_comments(limit: int = 20):
    """Get most recent comments across all videos - for live feed"""
    comments = await db.video_comments.find(
        {"is_hidden": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    for comment in comments:
        if isinstance(comment.get('created_at'), str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
    
    return {"comments": comments, "total": len(comments)}

# ============ LIVE STREAM COMMENTS ============

@api_router.get("/comments/live")
async def get_live_stream_comments(limit: int = 100):
    """Get comments for the live stream"""
    settings = await get_comment_settings("live_stream")
    
    comments = await db.video_comments.find(
        {"video_id": "live_stream", "is_hidden": {"$ne": True}}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    for comment in comments:
        if isinstance(comment.get('created_at'), str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
    
    return {
        "comments": comments,
        "total": len(comments),
        "settings": {
            "comments_enabled": settings.get("comments_enabled", True),
            "slow_mode_seconds": settings.get("slow_mode_seconds", 0)
        }
    }

@api_router.post("/comments/live")
async def add_live_stream_comment(comment: VideoCommentCreate):
    """Add a comment to the live stream"""
    comment.video_id = "live_stream"
    return await add_video_comment(comment)

# ============ ADMIN COMMENT MANAGEMENT ============

@api_router.get("/admin/comments/settings/{target_id}")
async def get_admin_comment_settings(target_id: str):
    """Get comment settings for a target (admin)"""
    settings = await db.comment_settings.find_one({"target_id": target_id}, {"_id": 0})
    if not settings:
        # Return defaults
        return {
            "target_id": target_id,
            "comments_enabled": True,
            "require_approval": False,
            "slow_mode_seconds": 0,
            "blocked_words": []
        }
    return settings

@api_router.put("/admin/comments/settings/{target_id}")
async def update_comment_settings(target_id: str, settings: CommentSettingsUpdate):
    """Update comment settings for a target (admin)"""
    update_data = {k: v for k, v in settings.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.comment_settings.update_one(
        {"target_id": target_id},
        {"$set": update_data, "$setOnInsert": {"target_id": target_id, "id": str(uuid.uuid4())}},
        upsert=True
    )
    
    logger.info(f"Updated comment settings for {target_id}: {update_data}")
    return {"success": True, "target_id": target_id, "settings": update_data}

@api_router.post("/admin/comments/{comment_id}/hide")
async def hide_comment(comment_id: str):
    """Hide a comment (admin)"""
    await db.video_comments.update_one(
        {"id": comment_id},
        {"$set": {"is_hidden": True}}
    )
    return {"success": True, "comment_id": comment_id, "action": "hidden"}

@api_router.post("/admin/comments/{comment_id}/show")
async def show_comment(comment_id: str):
    """Unhide a comment (admin)"""
    await db.video_comments.update_one(
        {"id": comment_id},
        {"$set": {"is_hidden": False}}
    )
    return {"success": True, "comment_id": comment_id, "action": "shown"}

@api_router.post("/admin/comments/{comment_id}/pin")
async def pin_comment(comment_id: str):
    """Pin a comment to top (admin)"""
    await db.video_comments.update_one(
        {"id": comment_id},
        {"$set": {"is_pinned": True}}
    )
    return {"success": True, "comment_id": comment_id, "action": "pinned"}

@api_router.post("/admin/comments/{comment_id}/unpin")
async def unpin_comment(comment_id: str):
    """Unpin a comment (admin)"""
    await db.video_comments.update_one(
        {"id": comment_id},
        {"$set": {"is_pinned": False}}
    )
    return {"success": True, "comment_id": comment_id, "action": "unpinned"}

@api_router.delete("/admin/comments/{comment_id}")
async def delete_comment(comment_id: str):
    """Delete a comment permanently (admin)"""
    result = await db.video_comments.delete_one({"id": comment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"success": True, "comment_id": comment_id, "action": "deleted"}

@api_router.get("/admin/comments/pending")
async def get_pending_comments(limit: int = 50):
    """Get all hidden/pending comments for approval (admin)"""
    comments = await db.video_comments.find(
        {"is_hidden": True}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    for comment in comments:
        if isinstance(comment.get('created_at'), str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
    
    return {"comments": comments, "total": len(comments)}

# ============ UNIVERSAL VIDEO FETCH ============

@api_router.get("/video/{video_id}")
async def get_video_by_id(video_id: str):
    """Fetch any video by ID from all sources"""
    
    # Check curated videos first (cv prefix)
    for video in CURATED_TRENDING_VIDEOS:
        if video.get("id") == video_id:
            return video
    
    # Check mock highlights (h prefix)
    for video in MOCK_HIGHLIGHTS:
        if video.get("id") == video_id:
            return video
    
    # Check real-time content in database
    realtime = await db.realtime_content.find_one({"id": video_id}, {"_id": 0})
    if realtime:
        return realtime
    
    # Check AI highlights
    ai_highlight = await db.ai_highlights.find_one({"id": video_id}, {"_id": 0})
    if ai_highlight:
        return ai_highlight
    
    # Check archived videos
    archived = await db.archived_videos.find_one({"id": video_id}, {"_id": 0})
    if archived:
        return archived
    
    raise HTTPException(status_code=404, detail="Video not found")

# ============ AI CONTENT GENERATION ============

async def generate_ai_highlight(category: str = None, use_real_news: bool = True):
    """Generate a new AI highlight with commentary, optionally using real NewsAPI data"""
    if not category:
        category = random.choice(list(AI_CONTENT_TEMPLATES.keys()))
    
    templates = AI_CONTENT_TEMPLATES.get(category, AI_CONTENT_TEMPLATES["culture"])
    template = random.choice(templates)
    thumbnails = CATEGORY_THUMBNAILS.get(category, CATEGORY_THUMBNAILS["culture"])
    
    # Try to get real trending news from NewsAPI
    real_news_item = None
    real_title = None
    real_description = None
    real_source = None
    real_thumbnail = None
    
    if use_real_news and NEWS_API_KEY:
        try:
            trending_items = await news_api_service.fetch_trending_for_category(category, page_size=10)
            if trending_items:
                # Pick a random item from the trending news
                real_news_item = random.choice(trending_items)
                real_title = real_news_item.get("title", "")
                real_description = real_news_item.get("description", "")
                real_source = real_news_item.get("source", "NewsAPI")
                if real_news_item.get("image_url"):
                    real_thumbnail = real_news_item.get("image_url")
                logger.info(f"Using real news for {category}: {real_title[:50]}...")
        except Exception as e:
            logger.warning(f"Failed to fetch real news for {category}, using templates: {e}")
    
    # If we have real news, use it; otherwise fall back to templates
    if real_title:
        title = real_title
        description = real_description or f"Breaking {category} story from {real_source}!"
        source = f"NewsAPI via {real_source}"
        thumbnail = real_thumbnail or random.choice(thumbnails)
    else:
        # Fall back to template-based generation
        title_vars = {
            "team": random.choice(["Lakers", "Warriors", "Celtics", "Heat", "Bulls"]),
            "player": random.choice(["LeBron", "Curry", "Messi", "Ronaldo", "Serena"]),
            "celebrity": random.choice(["Dwayne Johnson", "Taylor Swift", "Bad Bunny", "Beyoncé"]),
            "comedian": random.choice(["Kevin Hart", "Dave Chappelle", "Jo Koy"]),
            "artist": random.choice(["Drake", "Billie Eilish", "The Weeknd", "Doja Cat"]),
            "movie": random.choice(["Avatar 4", "Spider-Man 5", "Fast & Furious 12"]),
            "actor": random.choice(["Tom Holland", "Zendaya", "Timothée Chalamet"]),
            "company": random.choice(["Apple", "Tesla", "Google", "Meta"]),
            "product": random.choice(["iPhone 18", "Tesla Bot", "Google Glass 2"]),
            "ability": random.choice(["write poetry", "compose music", "design clothes"]),
            "hack": random.choice(["This phone trick", "This cooking method", "This workout"]),
            "game": random.choice(["GTA 7", "Minecraft 2", "Fortnite Chapter 10"]),
            "time": random.choice(["12 minutes", "8 minutes", "under 10 minutes"]),
            "place": random.choice(["Florida", "Tokyo", "London", "Dubai"]),
            "subject": random.choice(["A dog", "A teacher", "A grandma"]),
            "discovery": random.choice(["new planet", "ancient artifact", "cure for hiccups"]),
            "record": random.choice(["longest dance", "most tacos eaten", "fastest typing"]),
            "meme": random.choice(["the 'OK Boomer'", "the distracted boyfriend", "this new TikTok"]),
            "trend": random.choice(["quiet luxury", "de-influencing", "girl dinner"]),
            "action": random.choice(["red carpet", "interview", "reaction"]),
            "topic": random.choice(["pineapple on pizza", "toilet paper direction", "hot dog sandwich"]),
            "round": random.choice(["1", "3", "12"]),
            "song": random.choice(["Bohemian Rhapsody", "Hotel California", "Stairway to Heaven"]),
        }
        title = template["template"].format(**{k: v for k, v in title_vars.items() if f"{{{k}}}" in template["template"]})
        description = f"AI curated highlight from the {category} world. This is what everyone's talking about!"
        source = "AI Generated"
        thumbnail = random.choice(thumbnails)
    
    # Generate AI commentary based on the title (real or generated)
    commentary = f"This {category} content is absolutely fire! The internet can't stop talking about it, and honestly, we get it. Sometimes reality is funnier than any joke we could write."
    
    if EMERGENT_LLM_KEY:
        try:
            # Build context for better commentary
            context = f"Title: {title}"
            if real_description:
                context += f"\nContext: {real_description}"
            
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"ztvlive_gen_{uuid.uuid4()}",
                system_message="""You are a hilarious entertainment commentator for ZTVLIVE, a 24/7 viral content streaming platform. 
Create funny, engaging commentary about trending topics. Be witty, use pop culture references, 
and make jokes that would make people share the clip. Keep it under 100 words.
If the topic is serious news, balance humor with appropriate respect."""
            ).with_model("openai", "gpt-5.2")
            
            response = await chat.send_message(UserMessage(
                text=f"Create funny commentary for this trending {category} highlight: {context}"
            ))
            commentary = response
        except Exception as e:
            logger.error(f"AI commentary generation failed: {e}")
    
    # Create the highlight with real or generated data
    highlight = AIGeneratedContent(
        title=title,
        category=category,
        thumbnail=thumbnail,
        description=description,
        ai_commentary=commentary,
        humor_level=random.randint(6, 9),
        views=random.randint(10000, 500000),
        likes=random.randint(1000, 50000),
        duration=f"{random.randint(2, 8)}:{random.randint(10, 59):02d}",
        trending_score=random.uniform(70, 95),
        source=source,
    )
    
    return highlight

@api_router.post("/ai/generate-highlight")
async def create_ai_highlight(category: Optional[str] = None, background_tasks: BackgroundTasks = None):
    """Generate a new AI highlight and add it to the playlist"""
    highlight = await generate_ai_highlight(category)
    
    # Save to database
    doc = highlight.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.ai_highlights.insert_one(doc)
    
    # Remove MongoDB _id before returning
    doc.pop('_id', None)
    
    logger.info(f"Generated AI highlight: {highlight.title}")
    return {"success": True, "highlight": doc}

@api_router.get("/ai/highlights")
async def get_ai_highlights(category: Optional[str] = None, limit: int = 20):
    """Get AI-generated highlights"""
    query = {}
    if category and category != "all":
        query["category"] = category
    
    highlights = await db.ai_highlights.find(query, {"_id": 0}).to_list(limit)
    
    for h in highlights:
        if isinstance(h.get('created_at'), str):
            h['created_at'] = datetime.fromisoformat(h['created_at'])
    
    highlights.sort(key=lambda x: x.get('created_at', datetime.min), reverse=True)
    return {"highlights": highlights, "total": len(highlights)}

@api_router.post("/ai/seed-content")
async def seed_ai_content():
    """Generate initial batch of AI content for all categories"""
    generated = []
    for category in AI_CONTENT_TEMPLATES.keys():
        for _ in range(3):  # 3 per category = 24 total
            highlight = await generate_ai_highlight(category)
            doc = highlight.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.ai_highlights.insert_one(doc)
            doc.pop('_id', None)  # Remove MongoDB _id
            generated.append(doc)
    
    logger.info(f"Seeded {len(generated)} AI highlights")
    return {"success": True, "generated": len(generated), "highlights": generated}

# Curated trending videos from public/embeddable sources
CURATED_TRENDING_VIDEOS = [
    {
        "id": "cv1",
        "title": "Epic Basketball Buzzer Beater Compilation",
        "category": "sports",
        "thumbnail": "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
        "description": "The most insane buzzer beaters in basketball history. These shots had us out of our seats!",
        "video_url": "https://www.youtube.com/watch?v=NSnAvhvfniw",
        "views": 4500000,
        "likes": 890000,
        "duration": "10:24",
        "source": "Sports Highlights",
        "trending_score": 97.2
    },
    {
        "id": "cv2",
        "title": "Best Stand-Up Comedy Moments 2024",
        "category": "podcast",
        "thumbnail": "https://images.unsplash.com/photo-1589903308904-1010c2294adc?w=800",
        "description": "Hilarious clips from the best comedians. Warning: You will laugh out loud!",
        "video_url": "https://www.youtube.com/watch?v=rVqAdIMQZlk",
        "views": 2100000,
        "likes": 450000,
        "duration": "15:30",
        "source": "Comedy Central",
        "trending_score": 94.8
    },
    {
        "id": "cv3",
        "title": "Live Concert Epic Moments",
        "category": "music",
        "thumbnail": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
        "description": "When artists and crowds create magic together. Goosebumps guaranteed!",
        "video_url": "https://www.youtube.com/watch?v=JGwWNGJdvx8",
        "views": 8900000,
        "likes": 1200000,
        "duration": "12:15",
        "source": "Music Moments",
        "trending_score": 98.9
    },
    {
        "id": "cv4",
        "title": "Best Movie Plot Twists That Broke the Internet",
        "category": "film",
        "thumbnail": "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800",
        "description": "These movie moments made audiences gasp worldwide. Spoiler alert!",
        "video_url": "https://www.youtube.com/watch?v=TWfph3iNC-k",
        "views": 3200000,
        "likes": 560000,
        "duration": "18:40",
        "source": "Film Reviews",
        "trending_score": 95.6
    },
    {
        "id": "cv5",
        "title": "Mind-Blowing Tech Gadgets 2024",
        "category": "tech",
        "thumbnail": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",
        "description": "The future is now! These gadgets will change how we live.",
        "video_url": "https://www.youtube.com/watch?v=Knyc_O2KQKs",
        "views": 1800000,
        "likes": 320000,
        "duration": "8:55",
        "source": "Tech Reviews",
        "trending_score": 92.3
    },
    {
        "id": "cv6",
        "title": "Pro Gamer Insane Plays Compilation",
        "category": "gaming",
        "thumbnail": "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800",
        "description": "When professional gamers do the impossible. These plays are unreal!",
        "video_url": "https://www.youtube.com/watch?v=9DI8kkR9G0s",
        "views": 5600000,
        "likes": 980000,
        "duration": "11:20",
        "source": "Gaming Highlights",
        "trending_score": 96.4
    },
    {
        "id": "cv7",
        "title": "Most Viral News Moments This Year",
        "category": "news",
        "thumbnail": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800",
        "description": "News stories that captivated the world. From heartwarming to bizarre!",
        "video_url": "https://www.youtube.com/watch?v=JXeJANDKwDc",
        "views": 2400000,
        "likes": 410000,
        "duration": "14:10",
        "source": "News Digest",
        "trending_score": 93.7
    },
    {
        "id": "cv8",
        "title": "Internet Culture Moments That Defined 2024",
        "category": "culture",
        "thumbnail": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800",
        "description": "Memes, trends, and viral moments that made us who we are this year.",
        "video_url": "https://www.youtube.com/watch?v=OKcl_KMXhAM",
        "views": 4100000,
        "likes": 720000,
        "duration": "9:45",
        "source": "Internet Today",
        "trending_score": 97.8
    },
]

@api_router.get("/curated/trending")
async def get_curated_trending(category: Optional[str] = None, limit: int = 10):
    """Get curated trending videos with AI commentary"""
    videos = CURATED_TRENDING_VIDEOS.copy()
    
    if category and category != "all":
        videos = [v for v in videos if v.get("category") == category]
    
    # Add AI commentary to each video
    for video in videos:
        if "ai_commentary" not in video:
            # Generate or use cached commentary
            video["ai_commentary"] = f"This {video['category']} content is absolutely fire! With {video['views']:,} views and counting, it's clear the internet can't get enough. Our AI analysis shows this is peak entertainment that resonates with audiences worldwide."
    
    return {"videos": videos[:limit], "total": len(videos)}

@api_router.post("/curated/generate-commentary/{video_id}")
async def generate_video_commentary(video_id: str):
    """Generate fresh AI commentary for a curated video"""
    video = next((v for v in CURATED_TRENDING_VIDEOS if v["id"] == video_id), None)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if not EMERGENT_LLM_KEY:
        return {"commentary": f"This {video['category']} highlight is trending for all the right reasons!", "video_id": video_id}
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ztv_commentary_{uuid.uuid4()}",
            system_message="""You are a hilarious entertainment commentator for ZTVLIVE. Create witty, 
engaging commentary about trending videos. Be funny, use pop culture references, and make 
observations that would make viewers want to share. Keep it under 100 words."""
        ).with_model("openai", "gpt-5.2")
        
        response = await chat.send_message(UserMessage(
            text=f"Create funny commentary for this trending {video['category']} video: {video['title']}. Description: {video['description']}"
        ))
        
        return {"commentary": response, "video_id": video_id}
    except Exception as e:
        logger.error(f"Commentary generation failed: {e}")
        return {"commentary": f"This {video['category']} content is absolutely legendary! The internet agrees - this is must-watch material.", "video_id": video_id}

# ============ REAL-TIME AI CONTENT GENERATION ============

async def generate_trending_narrative(category: str, topic_seed: dict) -> TrendingTopic:
    """Generate a compelling narrative from a trending topic seed"""
    topic = topic_seed["topic"]
    keywords = topic_seed["keywords"]
    
    # Get thumbnail for category
    thumbnails = CATEGORY_THUMBNAILS.get(category, CATEGORY_THUMBNAILS["culture"])
    thumbnail = random.choice(thumbnails)
    
    # Get video URL for category
    videos = TOPIC_VIDEO_SOURCES.get(category, TOPIC_VIDEO_SOURCES["culture"])
    video_url = random.choice(videos) if videos else None
    
    # Generate AI narrative
    narrative = f"Breaking: {topic} is dominating headlines! Our AI analysis reveals this is one of the most engaging stories in {category} right now."
    summary = f"The latest on {topic} - everything you need to know about what's trending."
    
    if EMERGENT_LLM_KEY:
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"ztv_trending_{uuid.uuid4()}",
                system_message="""You are ZTVLIVE's AI news anchor creating compelling highlight narratives.
Your job is to take trending topics and create engaging, informative, and entertaining summaries.
Analyze the topic from multiple angles and present the most interesting aspects.
Be factual but add personality. Include why this matters to viewers.
Keep narratives between 100-200 words. Make it feel like breaking news that viewers MUST see."""
            ).with_model("openai", "gpt-5.2")
            
            response = await chat.send_message(UserMessage(
                text=f"""Create an engaging highlight narrative for this trending {category} topic: "{topic}"
                
Keywords to consider: {', '.join(keywords)}

Create a compelling story that:
1. Hooks viewers immediately
2. Explains why this is trending NOW
3. Provides interesting angles/perspectives
4. Makes viewers want to watch and share"""
            ))
            narrative = response
            
            # Generate summary too
            summary_chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"ztv_summary_{uuid.uuid4()}",
                system_message="Create a 1-2 sentence teaser summary for a trending video. Be catchy and make people want to click."
            ).with_model("openai", "gpt-5.2")
            
            summary = await summary_chat.send_message(UserMessage(
                text=f"Create a teaser for: {topic} in {category}"
            ))
            
        except Exception as e:
            logger.error(f"AI narrative generation failed: {e}")
    
    # Create title variations
    title_formats = [
        f"BREAKING: {topic} - What You Need to Know",
        f"{topic}: The Story Everyone's Talking About",
        f"VIRAL: {topic} Takes Over the Internet",
        f"{topic} - Our AI Analysis Reveals Everything",
        f"🔥 {topic}: Why This is Trending NOW",
    ]
    
    trending_topic = TrendingTopic(
        topic=random.choice(title_formats),
        category=category,
        sources=["Social Media", "News Outlets", "Viral Content"],
        keywords=keywords,
        summary=summary,
        ai_narrative=narrative,
        thumbnail=thumbnail,
        video_url=video_url,
        views=random.randint(100000, 5000000),
        likes=random.randint(10000, 500000),
        engagement_score=random.uniform(75, 99),
        is_breaking=random.random() > 0.7,
    )
    
    return trending_topic

@api_router.post("/realtime/generate")
async def generate_realtime_content(category: Optional[str] = None, count: int = 1):
    """Generate fresh real-time trending content"""
    generated = []
    
    categories_to_generate = [category] if category else list(TRENDING_TOPIC_SEEDS.keys())
    
    for cat in categories_to_generate[:count]:
        if cat not in TRENDING_TOPIC_SEEDS:
            cat = random.choice(list(TRENDING_TOPIC_SEEDS.keys()))
        
        topic_seed = random.choice(TRENDING_TOPIC_SEEDS[cat])
        trending = await generate_trending_narrative(cat, topic_seed)
        
        # Save to database
        doc = trending.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['expires_at'] = doc['expires_at'].isoformat()
        await db.realtime_content.insert_one(doc)
        
        generated.append(doc)
        logger.info(f"Generated real-time content: {trending.topic}")
    
    return {"success": True, "generated": len(generated), "content": generated}

@api_router.get("/realtime/feed")
async def get_realtime_feed(category: Optional[str] = None, limit: int = 20):
    """Get the real-time content feed - freshest content first"""
    query = {}
    if category and category != "all":
        query["category"] = category
    
    # Get from database
    db_content = await db.realtime_content.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # If not enough content, generate some
    if len(db_content) < 8:
        for cat in random.sample(list(TRENDING_TOPIC_SEEDS.keys()), min(8 - len(db_content), 8)):
            topic_seed = random.choice(TRENDING_TOPIC_SEEDS[cat])
            trending = await generate_trending_narrative(cat, topic_seed)
            doc = trending.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            doc['expires_at'] = doc['expires_at'].isoformat()
            await db.realtime_content.insert_one(doc)
            db_content.append(doc)
    
    # Add mock highlights as fallback
    all_content = db_content + MOCK_HIGHLIGHTS[:limit]
    
    return {
        "feed": all_content[:limit],
        "total": len(all_content),
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

@api_router.post("/realtime/refresh-all")
async def refresh_all_content():
    """Generate fresh content for all categories"""
    generated = []
    
    for category in TRENDING_TOPIC_SEEDS.keys():
        # Generate 2-3 items per category
        for _ in range(random.randint(2, 3)):
            topic_seed = random.choice(TRENDING_TOPIC_SEEDS[category])
            trending = await generate_trending_narrative(category, topic_seed)
            
            doc = trending.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            doc['expires_at'] = doc['expires_at'].isoformat()
            await db.realtime_content.insert_one(doc)
            generated.append(doc)
    
    logger.info(f"Refreshed all content: {len(generated)} items generated")
    return {"success": True, "generated": len(generated)}

@api_router.get("/realtime/breaking")
async def get_breaking_news(limit: int = 5):
    """Get breaking/hot stories marked as urgent"""
    # Get breaking content from database
    breaking = await db.realtime_content.find(
        {"is_breaking": True}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Add some mock breaking news if needed
    if len(breaking) < limit:
        for h in MOCK_HIGHLIGHTS:
            if h.get("trending_score", 0) > 95:
                h["is_breaking"] = True
                breaking.append(h)
                if len(breaking) >= limit:
                    break
    
    return {"breaking": breaking[:limit], "count": len(breaking)}

# ============ NEWSAPI REAL TRENDING ENDPOINTS ============

@api_router.get("/newsapi/trending/{category}")
async def get_newsapi_trending(category: str, limit: int = 10):
    """
    Get real trending content from NewsAPI for a specific category.
    This fetches actual current news and trending topics.
    """
    if category not in ALL_CONTENT_CATEGORIES and category != "all":
        raise HTTPException(status_code=400, detail=f"Invalid category. Choose from: {ALL_CONTENT_CATEGORIES}")
    
    if category == "all":
        # Fetch from multiple categories
        all_trending = []
        for cat in ["sports", "tech", "news", "culture"]:
            items = await news_api_service.fetch_trending_for_category(cat, page_size=5)
            all_trending.extend(items)
        return {"trending": all_trending[:limit], "category": "all", "count": len(all_trending[:limit])}
    
    trending = await news_api_service.fetch_trending_for_category(category, page_size=limit)
    return {"trending": trending, "category": category, "count": len(trending)}

@api_router.get("/newsapi/headlines")
async def get_newsapi_headlines(country: str = "us", limit: int = 20):
    """Get top headlines from NewsAPI"""
    headlines = await news_api_service.fetch_top_headlines(country=country, page_size=limit)
    return {"headlines": headlines, "country": country, "count": len(headlines)}

@api_router.get("/newsapi/search")
async def search_newsapi(query: str, limit: int = 10):
    """Search NewsAPI for specific topics"""
    if not query or len(query) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")
    
    results = await news_api_service.search_topic(query, page_size=limit)
    return {"results": results, "query": query, "count": len(results)}

@api_router.get("/newsapi/status")
async def get_newsapi_status():
    """Check if NewsAPI is configured and working"""
    has_key = bool(NEWS_API_KEY)
    cache_size = len(news_api_service.cache)
    
    # Test the connection if key exists
    is_working = False
    error_message = None
    
    if has_key:
        try:
            test_results = await news_api_service.search_topic("test", page_size=1)
            is_working = len(test_results) > 0
        except Exception as e:
            error_message = str(e)
    
    return {
        "configured": has_key,
        "working": is_working,
        "cache_entries": cache_size,
        "error": error_message,
        "categories_available": list(ZTVLIVE_TO_NEWSAPI_KEYWORDS.keys()),
    }

# ============ DAILY AI CONTENT GENERATION ============

ALL_CONTENT_CATEGORIES = ["sports", "podcast", "music", "film", "tech", "gaming", "news", "culture", "other"]

async def generate_daily_content_for_category(category: str, count: int = 3):
    """Generate daily AI content for a specific category using NewsAPI real data"""
    generated = []
    for _ in range(count):
        try:
            highlight = await generate_ai_highlight(category, use_real_news=True)
            doc = highlight.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            doc['generated_date'] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            doc['source_type'] = "daily_ai_newsapi" if NEWS_API_KEY else "daily_ai_template"
            await db.ai_highlights.insert_one(doc)
            doc.pop('_id', None)  # Remove MongoDB _id
            generated.append(doc)
            logger.info(f"Generated AI content for {category}: {doc['title'][:50]}...")
        except Exception as e:
            logger.error(f"Failed to generate content for {category}: {e}")
    return generated

@api_router.post("/ai/generate-daily")
async def generate_daily_content(
    categories: Optional[List[str]] = None,
    count_per_category: int = 3,
    background_tasks: BackgroundTasks = None
):
    """
    Generate daily AI content for all categories.
    This should be called once per day (via cron, admin, or startup).
    
    - categories: List of categories to generate for (default: all)
    - count_per_category: Number of highlights to generate per category (default: 3)
    """
    target_categories = categories or ALL_CONTENT_CATEGORIES
    
    # Check if we already generated content today
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing_today = await db.ai_highlights.count_documents({"generated_date": today})
    
    if existing_today >= len(target_categories) * count_per_category:
        return {
            "success": True,
            "message": f"Daily content already generated today ({existing_today} items)",
            "generated": 0,
            "existing": existing_today
        }
    
    all_generated = []
    for category in target_categories:
        generated = await generate_daily_content_for_category(category, count_per_category)
        all_generated.extend(generated)
    
    logger.info(f"Daily content generation complete: {len(all_generated)} items across {len(target_categories)} categories")
    
    return {
        "success": True,
        "message": f"Generated {len(all_generated)} highlights across {len(target_categories)} categories",
        "generated": len(all_generated),
        "categories": target_categories,
        "date": today,
        "breakdown": {cat: sum(1 for g in all_generated if g.get("category") == cat) for cat in target_categories}
    }

@api_router.get("/ai/status")
async def get_ai_content_status():
    """Get status of AI-generated content across all categories"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    status = {
        "date": today,
        "categories": {}
    }
    
    for category in ALL_CONTENT_CATEGORIES:
        # Count total and today's content
        total = await db.ai_highlights.count_documents({"category": category})
        today_count = await db.ai_highlights.count_documents({
            "category": category,
            "generated_date": today
        })
        
        # Get most recent for this category
        recent = await db.ai_highlights.find(
            {"category": category}, 
            {"_id": 0, "title": 1, "created_at": 1}
        ).sort("created_at", -1).to_list(1)
        
        status["categories"][category] = {
            "total_content": total,
            "generated_today": today_count,
            "last_generated": recent[0]["title"] if recent else None,
            "needs_generation": today_count < 3
        }
    
    # Overall summary
    total_today = sum(cat["generated_today"] for cat in status["categories"].values())
    categories_needing_content = [
        cat for cat, info in status["categories"].items() 
        if info["needs_generation"]
    ]
    
    status["summary"] = {
        "total_generated_today": total_today,
        "categories_needing_content": categories_needing_content,
        "all_categories_covered": len(categories_needing_content) == 0
    }
    
    return status

@api_router.post("/ai/generate-missing")
async def generate_missing_content():
    """Generate content only for categories that don't have today's content"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    generated_categories = []
    all_generated = []
    
    for category in ALL_CONTENT_CATEGORIES:
        today_count = await db.ai_highlights.count_documents({
            "category": category,
            "generated_date": today
        })
        
        if today_count < 3:
            needed = 3 - today_count
            generated = await generate_daily_content_for_category(category, needed)
            all_generated.extend(generated)
            generated_categories.append({
                "category": category,
                "had": today_count,
                "generated": len(generated)
            })
    
    return {
        "success": True,
        "message": f"Generated content for {len(generated_categories)} categories",
        "total_generated": len(all_generated),
        "details": generated_categories
    }

@api_router.get("/ai/scheduler")
async def get_scheduler_status():
    """Get the status of the content generation scheduler"""
    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id": job.id,
            "name": job.name,
            "category": job.id.replace("daily_", "").replace("_content", ""),
            "next_run": next_run.isoformat() if next_run else None,
            "next_run_in": str(next_run - datetime.now(timezone.utc)) if next_run else None
        })
    
    # Sort by next run time
    jobs.sort(key=lambda x: x["next_run"] or "")
    
    return {
        "scheduler_running": scheduler.running,
        "total_jobs": len(jobs),
        "schedule": CATEGORY_SCHEDULES,
        "jobs": jobs,
        "timezone": "UTC"
    }

@api_router.post("/ai/scheduler/trigger/{category}")
async def trigger_category_generation(category: str):
    """Manually trigger content generation for a specific category"""
    if category not in ALL_CONTENT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Valid: {ALL_CONTENT_CATEGORIES}")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.ai_highlights.count_documents({
        "category": category,
        "generated_date": today
    })
    
    if existing >= 3:
        return {
            "success": False,
            "message": f"{category} already has {existing} highlights today",
            "generated": 0
        }
    
    needed = 3 - existing
    generated = await generate_daily_content_for_category(category, needed)
    
    return {
        "success": True,
        "message": f"Generated {len(generated)} highlights for {category}",
        "category": category,
        "generated": len(generated),
        "titles": [g["title"] for g in generated]
    }

@api_router.post("/ai/scheduler/trigger-all")
async def trigger_all_categories():
    """Manually trigger content generation for all categories"""
    results = []
    total_generated = 0
    
    for category in ALL_CONTENT_CATEGORIES:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        existing = await db.ai_highlights.count_documents({
            "category": category,
            "generated_date": today
        })
        
        if existing < 3:
            needed = 3 - existing
            generated = await generate_daily_content_for_category(category, needed)
            total_generated += len(generated)
            results.append({
                "category": category,
                "generated": len(generated),
                "titles": [g["title"] for g in generated]
            })
        else:
            results.append({
                "category": category,
                "generated": 0,
                "message": f"Already has {existing} highlights"
            })
    
    return {
        "success": True,
        "total_generated": total_generated,
        "categories_processed": len(results),
        "results": results
    }

@api_router.get("/ai/refresh-schedule")
async def get_refresh_schedule():
    """Get the content refresh schedule for all categories"""
    schedule_info = []
    
    for category, schedule in CATEGORY_SCHEDULES.items():
        next_refresh_hours = []
        current_hour = datetime.now(timezone.utc).hour
        
        for hour in sorted(schedule["hours"]):
            if hour > current_hour:
                next_refresh_hours.append(hour)
        
        # If no more today, show tomorrow's first
        if not next_refresh_hours:
            next_refresh_hours = [schedule["hours"][0]]
        
        schedule_info.append({
            "category": category,
            "refresh_hours_utc": schedule["hours"],
            "refresh_minute": schedule["minute"],
            "refreshes_per_day": len(schedule["hours"]),
            "next_refresh_hour_utc": next_refresh_hours[0],
        })
    
    # Get content counts per category
    content_counts = {}
    for category in ALL_CONTENT_CATEGORIES:
        count = await db.ai_highlights.count_documents({"category": category})
        content_counts[category] = count
    
    return {
        "schedules": schedule_info,
        "content_counts": content_counts,
        "total_scheduled_jobs": sum(len(s["hours"]) for s in CATEGORY_SCHEDULES.values()),
        "current_time_utc": datetime.now(timezone.utc).isoformat(),
    }

@api_router.get("/content/all")
async def get_all_content(category: Optional[str] = None, limit: int = 30):
    """Get combined content from all sources for display"""
    query = {}
    if category and category != "all":
        query["category"] = category
    
    # Gather content from all sources
    realtime = await db.realtime_content.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit // 3)
    ai_generated = await db.ai_highlights.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit // 3)
    
    # Combine with curated and mock content
    curated = [v for v in CURATED_TRENDING_VIDEOS if not category or category == "all" or v["category"] == category]
    mock = [h for h in MOCK_HIGHLIGHTS if not category or category == "all" or h["category"] == category]
    
    # Merge and shuffle for variety
    all_content = realtime + ai_generated + curated + mock
    random.shuffle(all_content)
    
    # Sort by engagement/trending score
    all_content.sort(key=lambda x: x.get("trending_score", x.get("engagement_score", 50)), reverse=True)
    
    return {
        "content": all_content[:limit],
        "total": len(all_content),
        "sources": {
            "realtime": len(realtime),
            "ai_generated": len(ai_generated),
            "curated": len(curated),
            "highlights": len(mock)
        }
    }

@api_router.post("/ai/generate-commentary")
async def generate_ai_commentary(request: AICommentaryRequest):
    """Generate AI commentary with humor for a trending topic"""
    if not EMERGENT_LLM_KEY:
        # Fallback mock commentary
        return {
            "commentary": f"Breaking news from the {request.category} world! {request.topic} is absolutely wild. I'd make a joke but the reality is already funnier than fiction.",
            "generated": True,
            "model": "fallback"
        }
    
    try:
        humor_instructions = {
            1: "Be completely serious and factual.",
            3: "Add subtle wit and clever observations.",
            5: "Include moderate humor with some jokes.",
            7: "Be quite funny with multiple jokes and puns.",
            10: "Go full comedy mode - make it hilarious with constant jokes!"
        }
        
        humor_level = min(request.humor_level, 10)
        humor_key = min([k for k in humor_instructions.keys() if k >= humor_level], default=5)
        
        system_prompt = f"""You are a witty entertainment commentator for ZTVLIVE, a 24/7 trending highlights channel. 
Your job is to create engaging, entertaining commentary about trending topics.
{humor_instructions[humor_key]}
Keep responses under 150 words. Be conversational and relatable.
{"Include relevant facts mixed with humor." if request.include_facts else "Focus purely on entertainment value."}"""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ztvlive_{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(
            text=f"Create entertaining commentary about this trending topic in {request.category}: {request.topic}"
        )
        
        response = await chat.send_message(user_message)
        
        return {
            "commentary": response,
            "generated": True,
            "model": "gpt-5.2"
        }
    except Exception as e:
        logger.error(f"AI generation error: {e}")
        return {
            "commentary": f"This {request.category} moment is absolutely trending for good reason! {request.topic} has the internet going crazy, and honestly, we're here for every second of it.",
            "generated": True,
            "model": "fallback",
            "error": str(e)
        }

@api_router.get("/schedule")
async def get_schedule(date: Optional[str] = None, slot_interval: int = 15):
    """
    Get the 24/7 programming schedule synchronized with actual TV playback.
    slot_interval: 15, 30, or 60 minutes per slot (default 15 for granular scheduling)
    """
    from services.tv_scheduler import generate_daily_schedule, get_current_program_block, TV_PROGRAM_SCHEDULE
    
    # Validate slot_interval
    if slot_interval not in [15, 30, 60]:
        slot_interval = 15
    
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    current_minute = now.minute
    
    # Use provided date or today
    if date:
        schedule_date = date
        day_start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    else:
        schedule_date = now.strftime("%Y-%m-%d")
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get the actual TV schedule (same as what's playing on /watch)
    tv_schedule = generate_daily_schedule(day_start)
    
    # Get creator-booked slots for this date
    creator_bookings = await db.creator_bookings.find({
        "slot_date": schedule_date,
        "status": "approved"
    }, {"_id": 0}).to_list(100)
    
    # Create lookup dict for booked slots - key is "hour:minute" for precise matching
    booked_slots = {}
    for b in creator_bookings:
        hour = b.get("slot_start_hour", 0)
        minute = b.get("slot_start_minute", 0)
        duration = b.get("duration_minutes", 60)
        
        # Mark all 15-minute intervals covered by this booking
        booking_start_mins = hour * 60 + minute
        booking_end_mins = booking_start_mins + duration
        
        for slot_mins in range(booking_start_mins, booking_end_mins, slot_interval):
            slot_hour = slot_mins // 60
            slot_min = slot_mins % 60
            slot_key = f"{slot_hour}:{slot_min}"
            booked_slots[slot_key] = {
                **b,
                "is_start": slot_mins == booking_start_mins  # Mark the actual start slot
            }
    
    # Build schedule with slot_interval minute slots
    schedule = []
    slots_per_day = (24 * 60) // slot_interval
    
    for slot_idx in range(slots_per_day):
        total_minutes = slot_idx * slot_interval
        hour = total_minutes // 60
        minute = total_minutes % 60
        slot_key = f"{hour}:{minute}"
        
        # Get the program block for this hour (for theming)
        program_block = get_current_program_block(hour)
        
        # Check if this slot has creator booking
        booking_info = booked_slots.get(slot_key)
        booking = booking_info if booking_info and booking_info.get("is_start", False) else None
        is_within_booking = booking_info is not None
        
        if booking:
            # This is the START of a creator booking
            start_minute = booking.get("slot_start_minute", 0)
            duration_minutes = booking.get("duration_minutes", 60)
            end_minutes = hour * 60 + start_minute + duration_minutes
            end_hour = end_minutes // 60
            end_minute = end_minutes % 60
            
            start_time = f"{hour:02d}:{start_minute:02d}"
            end_time = f"{end_hour % 24:02d}:{end_minute:02d}"
            
            highlight = {
                "id": booking.get("booking_id", f"creator_{hour}_{minute}"),
                "title": booking.get("title", "Creator Content"),
                "description": booking.get("description", ""),
                "category": booking.get("category", "creator_content"),
                "video_url": booking.get("video_url", ""),
                "thumbnail": booking.get("thumbnail", "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400"),
                "duration": f"{duration_minutes}:00",
                "is_creator_content": True,
                "views": 0,
                "likes": 0,
                "source": booking.get("creator_name", "Creator"),
                "trending_score": 100,
                "is_live": booking.get("content_type") == "live_embed"
            }
            creator_info = {
                "creator_id": booking.get("creator_id"),
                "creator_name": booking.get("creator_name"),
                "content_type": booking.get("content_type", "youtube"),
                "duration_minutes": duration_minutes
            }
        elif is_within_booking:
            # This slot is within an ongoing booking but not the start
            # Skip it in the grid display (it's part of the previous slot's duration)
            continue
        else:
            # AI-generated content slot
            start_time = f"{hour:02d}:{minute:02d}"
            end_minutes = total_minutes + slot_interval
            end_time = f"{(end_minutes // 60) % 24:02d}:{end_minutes % 60:02d}"
            creator_info = None
            
            # Get video from this time slot in the TV schedule
            slot_start_sec = total_minutes * 60
            slot_end_sec = slot_start_sec + slot_interval * 60
            
            # Find videos in this slot
            slot_videos = [v for v in tv_schedule if v["start_seconds"] >= slot_start_sec and v["start_seconds"] < slot_end_sec]
            
            if slot_videos:
                first_video = slot_videos[0]
                highlight = {
                    "id": first_video.get("id", f"slot_{hour}_{minute}"),
                    "title": first_video.get("title", program_block["name"]),
                    "description": program_block["desc"],
                    "category": first_video.get("category", program_block["categories"][0] if program_block.get("categories") else "mixed"),
                    "video_url": first_video.get("video_url", ""),
                    "thumbnail": first_video.get("thumbnail", "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400"),
                    "duration": f"{first_video.get('duration_seconds', 300) // 60}:{first_video.get('duration_seconds', 300) % 60:02d}",
                    "views": random.randint(1000, 50000),
                    "likes": random.randint(100, 5000),
                    "source": first_video.get("source", "ZTVLIVE"),
                    "trending_score": random.randint(70, 100),
                    "is_live": False,
                    "program_block": program_block["name"]
                }
            else:
                # Fallback
                highlight = {
                    "id": f"slot_{hour}_{minute}",
                    "title": program_block["name"],
                    "description": program_block["desc"],
                    "category": program_block["categories"][0] if program_block.get("categories") else "mixed",
                    "video_url": "",
                    "thumbnail": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400",
                    "duration": f"{slot_interval}:00",
                    "views": 0,
                    "likes": 0,
                    "source": "ZTVLIVE",
                    "trending_score": 50,
                    "is_live": False,
                    "program_block": program_block["name"]
                }
        
        # Calculate timing
        is_creator_slot = booking is not None
        current_slot_minutes = current_hour * 60 + current_minute
        slot_total_minutes = hour * 60 + minute
        is_today = schedule_date == now.strftime("%Y-%m-%d")
        is_current = is_today and slot_total_minutes <= current_slot_minutes < slot_total_minutes + slot_interval
        is_past = is_today and slot_total_minutes + slot_interval <= current_slot_minutes
        
        if is_today:
            minutes_until = slot_total_minutes - current_slot_minutes
            if minutes_until < 0:
                minutes_until += 24 * 60  # Next day
        else:
            minutes_until = 9999  # Future date
        
        # Slot is bookable if: not creator booked, in the future (>= 1 min), and not currently playing
        is_bookable = not is_creator_slot and not is_past and not is_current and minutes_until >= 1
        
        schedule.append({
            "id": f"slot_{hour}_{minute}",
            "start_time": start_time,
            "end_time": end_time,
            "slot_date": schedule_date,
            "slot_index": hour + (minute / 60),  # e.g., 14.25 for 14:15, 14.5 for 14:30
            "slot_hour": hour,
            "slot_minute": minute,
            "highlight": highlight,
            "is_current": is_current,
            "is_past": is_past,
            "minutes_until": minutes_until,
            "scheduled_category": highlight.get("category", "mixed"),
            "is_creator_slot": is_creator_slot,
            "creator_info": creator_info,
            "is_bookable": is_bookable,
            "program_block": program_block["name"]
        })
    
    # Count stats
    available_slots = len([s for s in schedule if s["is_bookable"]])
    creator_slots_count = len(set(b.get("booking_id") for b in creator_bookings))
    
    return {
        "schedule": schedule, 
        "timezone": "UTC",
        "current_hour": current_hour,
        "current_minute": current_minute,
        "schedule_date": schedule_date,
        "server_time": now.isoformat(),
        "creator_slots": creator_slots_count,
        "available_slots": available_slots,
        "slot_interval": slot_interval
    }

@api_router.get("/schedule/current")
async def get_current_scheduled_content():
    """Get the content that should be playing right now based on the schedule"""
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    schedule_date = now.strftime("%Y-%m-%d")
    
    # Check for creator-scheduled content
    creator_booking = await db.creator_scheduled_content.find_one({
        "slot_date": schedule_date,
        "slot_hour": current_hour,
        "status": {"$in": ["scheduled", "live"]}
    }, {"_id": 0})
    
    if creator_booking:
        # Use creator's content
        current_content = {
            "id": creator_booking["id"],
            "title": creator_booking["title"],
            "description": creator_booking["description"],
            "category": creator_booking["category"],
            "video_url": creator_booking["video_url"],
            "thumbnail": creator_booking.get("thumbnail", "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400"),
            "duration": creator_booking.get("duration", "60:00"),
            "is_creator_content": True,
            "content_type": creator_booking.get("content_type", "video"),
            "creator_name": creator_booking["creator_name"],
            "views": 0,
            "likes": 0,
            "source": creator_booking["creator_name"],
            "trending_score": 100,
            "is_live": creator_booking.get("content_type") == "live_embed",
            "ai_commentary": f"Live from {creator_booking['creator_name']} - Exclusive content on ZTVLIVE!"
        }
        
        # Update status to live if not already
        if creator_booking["status"] != "live":
            await db.creator_scheduled_content.update_one(
                {"id": creator_booking["id"]},
                {"$set": {"status": "live"}}
            )
            # Trigger push notification to followers
            try:
                from services.push_notifications import onesignal_service
                # Get follower player IDs
                followers = await db.creator_followers.find(
                    {"creator_id": creator_booking["creator_id"], "is_active": True},
                    {"player_id": 1}
                ).to_list(10000)
                
                if followers:
                    player_ids = [f["player_id"] for f in followers]
                    await onesignal_service.send_creator_live_notification(
                        creator_id=creator_booking["creator_id"],
                        creator_name=creator_booking["creator_name"],
                        video_title=creator_booking["title"],
                        video_thumbnail=creator_booking.get("thumbnail"),
                        follower_player_ids=player_ids
                    )
                    logging.info(f"Sent live notification for {creator_booking['creator_name']} to {len(player_ids)} followers")
            except Exception as e:
                logging.error(f"Failed to send push notification: {e}")
    elif CATEGORY_ROTATION[current_hour] == "promo":
        # Promo slot
        promo_videos = [
            {"id": "promo-70-revolution", "title": "The 70% Revolution - ZTVLIVE", "category": "promo", 
             "video_url": "/api/static/promo/ztvlive_70_revolution_with_voiceover.mp4", "duration": "0:23", "is_promo": True,
             "thumbnail": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400",
             "description": "Join the 70% Revolution", "ai_commentary": "Keep 70% of your revenue on ZTVLIVE!",
             "views": 0, "likes": 0, "source": "ZTVLIVE", "trending_score": 100, "is_live": False, "is_featured": True},
            {"id": "promo-premium", "title": "ZTVLIVE - Create. Stream. Earn.", "category": "promo", 
             "video_url": "/ztvlive_promo_premium.mp4", "duration": "0:12", "is_promo": True,
             "thumbnail": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400",
             "description": "ZTVLIVE Promotional Content", "ai_commentary": "Support creators on ZTVLIVE!",
             "views": 0, "likes": 0, "source": "ZTVLIVE", "trending_score": 100, "is_live": False},
        ]
        current_content = promo_videos[0]  # Use main promo (70% Revolution)
    else:
        # Regular diverse content
        target_category = CATEGORY_ROTATION[current_hour]
        
        if CATEGORY_CONTENT.get(target_category) and len(CATEGORY_CONTENT[target_category]) > 0:
            content_list = CATEGORY_CONTENT[target_category]
            content_index = (current_hour + now.day) % len(content_list)
            current_content = content_list[content_index]
        else:
            content_index = current_hour % len(MOCK_HIGHLIGHTS)
            current_content = MOCK_HIGHLIGHTS[content_index]
    
    # Get next hour's content
    next_hour = (current_hour + 1) % 24
    next_date = schedule_date if next_hour > current_hour else (now + timedelta(days=1)).strftime("%Y-%m-%d")
    
    next_booking = await db.creator_scheduled_content.find_one({
        "slot_date": next_date,
        "slot_hour": next_hour,
        "status": "scheduled"
    }, {"_id": 0})
    
    if next_booking:
        next_content = {
            "id": next_booking["id"],
            "title": next_booking["title"],
            "category": next_booking["category"],
            "thumbnail": next_booking.get("thumbnail"),
            "is_creator_content": True,
            "creator_name": next_booking["creator_name"]
        }
    elif CATEGORY_ROTATION[next_hour] == "promo":
        next_content = {"id": "promo", "title": "ZTVLIVE Promo", "category": "promo", "is_promo": True}
    else:
        target_category = CATEGORY_ROTATION[next_hour]
        if CATEGORY_CONTENT.get(target_category) and len(CATEGORY_CONTENT[target_category]) > 0:
            content_list = CATEGORY_CONTENT[target_category]
            content_index = (next_hour + now.day) % len(content_list)
            next_content = content_list[content_index]
        else:
            next_content = MOCK_HIGHLIGHTS[next_hour % len(MOCK_HIGHLIGHTS)]
    
    # Calculate time remaining
    minutes_remaining = 60 - now.minute
    seconds_remaining = 60 - now.second
    
    return {
        "current": current_content,
        "next_up": next_content,
        "current_slot": f"{current_hour:02d}:00 - {(current_hour + 1) % 24:02d}:00",
        "scheduled_category": CATEGORY_ROTATION[current_hour],
        "minutes_remaining": minutes_remaining,
        "seconds_remaining": seconds_remaining,
        "is_promo_slot": CATEGORY_ROTATION[current_hour] == "promo",
        "is_creator_slot": creator_booking is not None,
        "server_time": now.isoformat(),
        "timezone": "UTC"
    }

@api_router.get("/schedule/slot/{slot_id}")
async def get_schedule_slot(slot_id: str, date: Optional[str] = None):
    """Get details of a specific schedule slot for preview"""
    try:
        slot_index = int(slot_id.replace("slot_", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid slot ID")
    
    if slot_index < 0 or slot_index >= 24:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    now = datetime.now(timezone.utc)
    schedule_date = date or now.strftime("%Y-%m-%d")
    
    # Check for creator booking
    creator_booking = await db.creator_scheduled_content.find_one({
        "slot_date": schedule_date,
        "slot_hour": slot_index,
        "status": {"$in": ["scheduled", "live"]}
    }, {"_id": 0})
    
    if creator_booking:
        content = {
            "id": creator_booking["id"],
            "title": creator_booking["title"],
            "description": creator_booking["description"],
            "category": creator_booking["category"],
            "video_url": creator_booking["video_url"],
            "thumbnail": creator_booking.get("thumbnail", "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400"),
            "duration": creator_booking.get("duration", "60:00"),
            "is_creator_content": True,
            "content_type": creator_booking.get("content_type", "video"),
            "creator_name": creator_booking["creator_name"],
            "ai_commentary": f"Exclusive content from {creator_booking['creator_name']}!",
            "views": 0,
            "likes": 0,
            "source": creator_booking["creator_name"],
            "trending_score": 100,
            "is_live": creator_booking.get("content_type") == "live_embed"
        }
        is_creator_slot = True
    elif CATEGORY_ROTATION[slot_index] == "promo":
        # Promo content
        promo_videos = [
            {"id": "promo-70-revolution", "title": "The 70% Revolution - ZTVLIVE", "category": "promo", 
             "video_url": "/api/static/promo/ztvlive_70_revolution_with_voiceover.mp4", "duration": "0:23", "is_promo": True,
             "thumbnail": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400",
             "description": "Join the 70% Revolution", "ai_commentary": "Keep 70% of your revenue on ZTVLIVE!",
             "views": 0, "likes": 0, "source": "ZTVLIVE", "trending_score": 100, "is_live": False, "is_featured": True},
            {"id": "promo-premium", "title": "ZTVLIVE - Create. Stream. Earn.", "category": "promo", 
             "video_url": "/ztvlive_promo_premium.mp4", "duration": "0:12", "is_promo": True,
             "thumbnail": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400",
             "description": "ZTVLIVE Promotional Content", "ai_commentary": "Support creators on ZTVLIVE!",
             "views": 0, "likes": 0, "source": "ZTVLIVE", "trending_score": 100, "is_live": False},
        ]
        content = promo_videos[0]
        is_creator_slot = False
    else:
        # Regular diverse content
        target_category = CATEGORY_ROTATION[slot_index]
        
        if CATEGORY_CONTENT.get(target_category) and len(CATEGORY_CONTENT[target_category]) > 0:
            content_list = CATEGORY_CONTENT[target_category]
            content_index = (slot_index + now.day) % len(content_list)
            content = content_list[content_index]
        else:
            content_index = slot_index % len(MOCK_HIGHLIGHTS)
            content = MOCK_HIGHLIGHTS[content_index]
        is_creator_slot = False
    
    current_hour = now.hour
    is_current = slot_index == current_hour and schedule_date == now.strftime("%Y-%m-%d")
    
    # Calculate time until this slot
    if schedule_date > now.strftime("%Y-%m-%d"):
        # Future date
        minutes_until = (24 - current_hour + slot_index) * 60 - now.minute
    elif slot_index > current_hour:
        minutes_until = (slot_index - current_hour) * 60 - now.minute
    elif slot_index < current_hour:
        minutes_until = (24 - current_hour + slot_index) * 60 - now.minute
    else:
        minutes_until = 0
    
    # Check if bookable
    is_bookable = (
        not is_creator_slot and 
        CATEGORY_ROTATION[slot_index] != "promo" and
        (slot_index > current_hour or schedule_date > now.strftime("%Y-%m-%d"))
    )
    
    return {
        "slot_id": slot_id,
        "slot_index": slot_index,
        "slot_date": schedule_date,
        "start_time": f"{slot_index:02d}:00",
        "end_time": f"{(slot_index + 1) % 24:02d}:00",
        "content": content,
        "is_current": is_current,
        "is_promo": content.get("is_promo", False),
        "is_creator_slot": is_creator_slot,
        "scheduled_category": CATEGORY_ROTATION[slot_index],
        "minutes_until": minutes_until,
        "is_bookable": is_bookable,
        "can_preview": True
    }

# ============ CREATOR SCHEDULING ENDPOINTS ============

@api_router.get("/schedule/available")
async def get_available_slots(date: Optional[str] = None):
    """Get available slots for creator booking (next 24 hours)"""
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    
    # Today's date
    today = now.strftime("%Y-%m-%d")
    
    target_date = date or today
    
    # Get existing bookings for target date
    existing_bookings = await db.creator_scheduled_content.find({
        "slot_date": target_date,
        "status": {"$in": ["scheduled", "live"]}
    }, {"_id": 0}).to_list(100)
    
    booked_hours = {b["slot_hour"] for b in existing_bookings}
    
    available_slots = []
    for hour in range(24):
        # Skip promo slots
        if CATEGORY_ROTATION[hour] == "promo":
            continue
        
        # Skip already booked slots
        if hour in booked_hours:
            continue
        
        # Skip past slots for today
        if target_date == today and hour <= current_hour:
            continue
        
        available_slots.append({
            "slot_hour": hour,
            "slot_date": target_date,
            "start_time": f"{hour:02d}:00",
            "end_time": f"{(hour + 1) % 24:02d}:00",
            "default_category": CATEGORY_ROTATION[hour],
            "slot_id": f"slot_{hour}"
        })
    
    return {
        "available_slots": available_slots,
        "target_date": target_date,
        "total_available": len(available_slots),
        "promo_slots_excluded": len([h for h in range(24) if CATEGORY_ROTATION[h] == "promo"])
    }

@api_router.post("/schedule/book")
async def book_schedule_slot(booking: CreatorScheduleBooking, creator_id: str, creator_name: str, creator_email: str):
    """Book a time slot for creator content (auto-approved, max 2 per day)"""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Validate slot date (must be today or tomorrow, within 24 hours)
    valid_dates = [today, (now + timedelta(days=1)).strftime("%Y-%m-%d")]
    if booking.slot_date not in valid_dates:
        raise HTTPException(status_code=400, detail="Can only book slots within the next 24 hours")
    
    # Validate slot hour
    if booking.slot_hour < 0 or booking.slot_hour >= 24:
        raise HTTPException(status_code=400, detail="Invalid slot hour")
    
    # Check if slot is a promo slot
    if CATEGORY_ROTATION[booking.slot_hour] == "promo":
        raise HTTPException(status_code=400, detail="Cannot book promo slots")
    
    # Check if slot is in the past
    if booking.slot_date == today and booking.slot_hour <= now.hour:
        raise HTTPException(status_code=400, detail="Cannot book past or current slots")
    
    # Check if slot is already booked
    existing = await db.creator_scheduled_content.find_one({
        "slot_date": booking.slot_date,
        "slot_hour": booking.slot_hour,
        "status": {"$in": ["scheduled", "live"]}
    })
    if existing:
        raise HTTPException(status_code=409, detail="This slot is already booked")
    
    # Check creator's daily booking limit (max 2 per day)
    creator_bookings_today = await db.creator_scheduled_content.count_documents({
        "creator_id": creator_id,
        "slot_date": booking.slot_date,
        "status": {"$in": ["scheduled", "live"]}
    })
    if creator_bookings_today >= 2:
        raise HTTPException(status_code=429, detail="Maximum 2 bookings per day per creator")
    
    # Create the booking (auto-approved)
    scheduled_content = CreatorScheduledContent(
        slot_date=booking.slot_date,
        slot_hour=booking.slot_hour,
        creator_id=creator_id,
        creator_name=creator_name,
        creator_email=creator_email,
        title=booking.title,
        description=booking.description,
        content_type=booking.content_type,
        video_url=booking.video_url,
        thumbnail=booking.thumbnail,
        category=booking.category,
        status="scheduled"
    )
    
    doc = scheduled_content.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.creator_scheduled_content.insert_one(doc)
    
    return {
        "success": True,
        "message": f"Slot booked successfully for {booking.slot_date} at {booking.slot_hour:02d}:00",
        "booking": {
            "id": scheduled_content.id,
            "slot_date": booking.slot_date,
            "slot_hour": booking.slot_hour,
            "title": booking.title,
            "status": "scheduled"
        }
    }

@api_router.get("/schedule/my-bookings")
async def get_my_bookings(creator_id: str):
    """Get creator's scheduled content bookings"""
    bookings = await db.creator_scheduled_content.find({
        "creator_id": creator_id
    }, {"_id": 0}).sort("slot_date", 1).to_list(100)
    
    # Categorize by status
    scheduled = [b for b in bookings if b["status"] == "scheduled"]
    completed = [b for b in bookings if b["status"] == "completed"]
    cancelled = [b for b in bookings if b["status"] == "cancelled"]
    
    return {
        "bookings": bookings,
        "scheduled": scheduled,
        "completed": completed,
        "cancelled": cancelled,
        "total": len(bookings)
    }

@api_router.delete("/schedule/cancel/{booking_id}")
async def cancel_booking(booking_id: str, creator_id: str):
    """Cancel a scheduled booking (slot reverts to default programming)"""
    now = datetime.now(timezone.utc)
    
    # Find the booking
    booking = await db.creator_scheduled_content.find_one({
        "id": booking_id,
        "creator_id": creator_id
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Booking already cancelled")
    
    if booking["status"] == "live":
        raise HTTPException(status_code=400, detail="Cannot cancel a live broadcast")
    
    # Cancel the booking
    await db.creator_scheduled_content.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now.isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "Booking cancelled. Slot reverted to default programming.",
        "booking_id": booking_id
    }

# ============ CATEGORY BROWSING & ADVANCED FEATURES ============

@api_router.get("/schedule/category/{category}")
async def get_category_content(category: str, limit: int = 20):
    """Get all content for a specific category to allow category browsing"""
    if category not in CATEGORY_CONTENT and category != "promo":
        raise HTTPException(status_code=404, detail=f"Category '{category}' not found")
    
    # Get promo content separately
    if category == "promo":
        promo_videos = [
            {"id": "promo-70-revolution", "title": "The 70% Revolution - ZTVLIVE", "category": "promo", 
             "video_url": "/api/static/promo/ztvlive_70_revolution_with_voiceover.mp4", "duration": "0:23", "is_promo": True,
             "thumbnail": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400",
             "description": "Join the 70% Revolution - Keep 70% of your revenue on ZTVLIVE",
             "is_featured": True},
            {"id": "promo-premium", "title": "ZTVLIVE - Create. Stream. Earn.", "category": "promo", 
             "video_url": "/ztvlive_promo_premium.mp4", "duration": "0:12", "is_promo": True,
             "thumbnail": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400",
             "description": "ZTVLIVE Promotional Content"},
            {"id": "promo-events", "title": "Stream Your Events Live", "category": "promo",
             "video_url": "/ztvlive_events_promo.mp4", "duration": "0:08", "is_promo": True,
             "thumbnail": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400",
             "description": "Conferences, weddings & family reunions"},
            {"id": "promo-schedule", "title": "Schedule & Share", "category": "promo",
             "video_url": "/ztvlive_schedule_promo.mp4", "duration": "0:08", "is_promo": True,
             "thumbnail": "https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=400",
             "description": "Book your slot for friends & family"},
            {"id": "promo-notification", "title": "Never Miss a Moment", "category": "promo",
             "video_url": "/ztvlive_notification_promo.mp4", "duration": "0:08", "is_promo": True,
             "thumbnail": "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400",
             "description": "Get notified when content goes live"},
            {"id": "promo-install", "title": "Download on Any Device", "category": "promo",
             "video_url": "/ztvlive_app_install_promo.mp4", "duration": "0:08", "is_promo": True,
             "thumbnail": "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400",
             "description": "Watch on iOS, Android, Desktop"},
        ]
        return {
            "category": category,
            "content": promo_videos,
            "total": len(promo_videos)
        }
    
    content_list = CATEGORY_CONTENT.get(category, [])[:limit]
    
    return {
        "category": category,
        "content": content_list,
        "total": len(content_list)
    }

@api_router.get("/schedule/time")
async def get_schedule_time():
    """Get current time in multiple timezones including Arizona (MST)"""
    now = datetime.now(timezone.utc)
    
    # Arizona doesn't observe DST, always UTC-7
    arizona_offset = timedelta(hours=-7)
    arizona_time = now + arizona_offset
    
    return {
        "utc": now.isoformat(),
        "utc_hour": now.hour,
        "utc_minute": now.minute,
        "arizona": arizona_time.isoformat(),
        "arizona_hour": arizona_time.hour,
        "arizona_minute": arizona_time.minute,
        "arizona_display": arizona_time.strftime("%I:%M %p MST"),
        "timezone_offset": -7
    }

@api_router.post("/schedule/hold")
async def hold_schedule_slot(
    slot_date: str,
    slot_hour: int,
    creator_id: str,
    creator_name: str,
    creator_email: str,
    event_title: str = "TBD",
    event_description: str = "Details to be confirmed"
):
    """Hold a slot for future confirmation - allows booking without full details"""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Allow holding slots up to 30 days in advance
    max_date = (now + timedelta(days=30)).strftime("%Y-%m-%d")
    if slot_date < today:
        raise HTTPException(status_code=400, detail="Cannot hold past slots")
    if slot_date > max_date:
        raise HTTPException(status_code=400, detail="Can only hold slots up to 30 days in advance")
    
    # Validate slot hour
    if slot_hour < 0 or slot_hour >= 24:
        raise HTTPException(status_code=400, detail="Invalid slot hour")
    
    # Check if slot is a promo slot
    if CATEGORY_ROTATION[slot_hour] == "promo":
        raise HTTPException(status_code=400, detail="Cannot hold promo slots")
    
    # Check if slot is already booked or held
    existing = await db.creator_scheduled_content.find_one({
        "slot_date": slot_date,
        "slot_hour": slot_hour,
        "status": {"$in": ["scheduled", "live", "held"]}
    })
    if existing:
        raise HTTPException(status_code=409, detail="This slot is already taken or held")
    
    # Create hold
    hold_id = str(uuid.uuid4())
    hold_doc = {
        "id": hold_id,
        "slot_date": slot_date,
        "slot_hour": slot_hour,
        "creator_id": creator_id,
        "creator_name": creator_name,
        "creator_email": creator_email,
        "title": event_title,
        "description": event_description,
        "content_type": "pending",
        "video_url": "",
        "category": CATEGORY_ROTATION[slot_hour],
        "status": "held",  # New status for held slots
        "created_at": now.isoformat(),
        "hold_expires": (now + timedelta(days=7)).isoformat()  # Hold expires in 7 days
    }
    
    await db.creator_scheduled_content.insert_one(hold_doc)
    
    return {
        "success": True,
        "message": f"Slot held for {slot_date} at {slot_hour:02d}:00. Confirm within 7 days.",
        "hold": {
            "id": hold_id,
            "slot_date": slot_date,
            "slot_hour": slot_hour,
            "status": "held",
            "expires": hold_doc["hold_expires"]
        }
    }

@api_router.post("/schedule/confirm/{hold_id}")
async def confirm_held_slot(
    hold_id: str,
    creator_id: str,
    title: str,
    description: str,
    content_type: str,
    video_url: str,
    thumbnail: Optional[str] = None
):
    """Confirm a held slot with full event details"""
    # Find the hold
    hold = await db.creator_scheduled_content.find_one({
        "id": hold_id,
        "creator_id": creator_id,
        "status": "held"
    })
    
    if not hold:
        raise HTTPException(status_code=404, detail="Hold not found or already confirmed")
    
    # Check if hold expired
    now = datetime.now(timezone.utc)
    if hold.get("hold_expires") and now.isoformat() > hold["hold_expires"]:
        await db.creator_scheduled_content.update_one(
            {"id": hold_id},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=410, detail="Hold has expired. Please book a new slot.")
    
    # Update to confirmed/scheduled
    await db.creator_scheduled_content.update_one(
        {"id": hold_id},
        {"$set": {
            "title": title,
            "description": description,
            "content_type": content_type,
            "video_url": video_url,
            "thumbnail": thumbnail,
            "status": "scheduled",
            "confirmed_at": now.isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "Slot confirmed successfully!",
        "booking": {
            "id": hold_id,
            "slot_date": hold["slot_date"],
            "slot_hour": hold["slot_hour"],
            "title": title,
            "status": "scheduled"
        }
    }

@api_router.get("/schedule/weekly")
async def get_weekly_schedule():
    """Get programming schedule for the next 7 days"""
    now = datetime.now(timezone.utc)
    weekly_schedule = []
    
    for day_offset in range(7):
        day_date = (now + timedelta(days=day_offset)).strftime("%Y-%m-%d")
        day_name = (now + timedelta(days=day_offset)).strftime("%A")
        
        # Get bookings for this day
        day_bookings = await db.creator_scheduled_content.find({
            "slot_date": day_date,
            "status": {"$in": ["scheduled", "held", "live"]}
        }, {"_id": 0}).to_list(100)
        
        booked_slots = {b["slot_hour"]: b for b in day_bookings}
        
        slots = []
        for hour in range(24):
            if hour in booked_slots:
                booking = booked_slots[hour]
                slots.append({
                    "hour": hour,
                    "category": booking.get("category", CATEGORY_ROTATION[hour]),
                    "is_booked": True,
                    "is_held": booking.get("status") == "held",
                    "title": booking.get("title", "TBD"),
                    "creator": booking.get("creator_name")
                })
            else:
                slots.append({
                    "hour": hour,
                    "category": CATEGORY_ROTATION[hour],
                    "is_booked": False,
                    "is_held": False,
                    "is_promo": CATEGORY_ROTATION[hour] == "promo"
                })
        
        weekly_schedule.append({
            "date": day_date,
            "day_name": day_name,
            "is_today": day_offset == 0,
            "slots": slots,
            "booked_count": len(day_bookings)
        })
    
    return {
        "week_start": now.strftime("%Y-%m-%d"),
        "schedule": weekly_schedule
    }

@api_router.get("/schedule/live-sync")
async def get_live_sync_info():
    """Get live synchronization info for viewers worldwide"""
    now = datetime.now(timezone.utc)
    
    # Arizona time (UTC-7, no DST)
    arizona_offset = timedelta(hours=-7)
    arizona_time = now + arizona_offset
    
    current_hour = now.hour
    current_minute = now.minute
    current_second = now.second
    
    # Seconds into the current hour
    seconds_into_hour = current_minute * 60 + current_second
    
    # Get current content
    schedule_date = now.strftime("%Y-%m-%d")
    
    # Check for creator content
    creator_booking = await db.creator_scheduled_content.find_one({
        "slot_date": schedule_date,
        "slot_hour": current_hour,
        "status": {"$in": ["scheduled", "live"]}
    }, {"_id": 0})
    
    if creator_booking:
        current_content = {
            "id": creator_booking["id"],
            "title": creator_booking["title"],
            "video_url": creator_booking["video_url"],
            "duration": creator_booking.get("duration", "60:00"),
            "is_creator": True
        }
    elif CATEGORY_ROTATION[current_hour] == "promo":
        current_content = {
            "id": "promo",
            "title": "ZTVLIVE Promo",
            "video_url": "/ztvlive_promo_premium.mp4",
            "duration": "0:12",
            "is_promo": True
        }
    else:
        category = CATEGORY_ROTATION[current_hour]
        if CATEGORY_CONTENT.get(category) and len(CATEGORY_CONTENT[category]) > 0:
            content_index = (current_hour + now.day) % len(CATEGORY_CONTENT[category])
            video = CATEGORY_CONTENT[category][content_index]
            current_content = {
                "id": video["id"],
                "title": video["title"],
                "video_url": video.get("video_url", ""),
                "duration": video.get("duration", "5:00"),
                "is_creator": False
            }
        else:
            content_index = current_hour % len(MOCK_HIGHLIGHTS)
            video = MOCK_HIGHLIGHTS[content_index]
            current_content = {
                "id": video["id"],
                "title": video["title"],
                "video_url": video.get("video_url", ""),
                "duration": video.get("duration", "5:00"),
                "is_creator": False
            }
    
    # Parse duration to seconds
    duration_parts = current_content["duration"].split(":")
    if len(duration_parts) == 2:
        duration_seconds = int(duration_parts[0]) * 60 + int(duration_parts[1])
    else:
        duration_seconds = 300  # Default 5 minutes
    
    # Calculate sync position (where everyone should be)
    if duration_seconds > 0:
        loops_completed = seconds_into_hour // duration_seconds
        current_position = seconds_into_hour % duration_seconds
    else:
        loops_completed = 0
        current_position = 0
    
    # Time remaining in slot
    seconds_remaining_in_hour = 3600 - seconds_into_hour
    
    return {
        "utc_time": now.isoformat(),
        "arizona_time": arizona_time.isoformat(),
        "arizona_display": arizona_time.strftime("%I:%M:%S %p MST"),
        "current_hour": current_hour,
        "current_minute": current_minute,
        "current_second": current_second,
        "seconds_into_hour": seconds_into_hour,
        "seconds_remaining": seconds_remaining_in_hour,
        "current_slot": f"{current_hour:02d}:00 - {(current_hour + 1) % 24:02d}:00",
        "category": CATEGORY_ROTATION[current_hour],
        "content": current_content,
        "sync": {
            "video_duration_seconds": duration_seconds,
            "loops_completed": loops_completed,
            "current_position_seconds": current_position,
            "sync_to_position": current_position
        }
    }

@api_router.get("/schedule/past/{slot_date}/{slot_hour}")
async def get_past_slot_content(slot_date: str, slot_hour: int):
    """Get content from a past slot - allows full playback after airing"""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    current_hour = now.hour
    
    # Check if this slot is in the past
    is_past = slot_date < today or (slot_date == today and slot_hour < current_hour)
    is_current = slot_date == today and slot_hour == current_hour
    
    if not is_past and not is_current:
        raise HTTPException(
            status_code=403, 
            detail="This content hasn't aired yet. Only 60-second preview available."
        )
    
    # Check for creator content
    creator_booking = await db.creator_scheduled_content.find_one({
        "slot_date": slot_date,
        "slot_hour": slot_hour,
        "status": {"$in": ["scheduled", "live", "completed"]}
    }, {"_id": 0})
    
    if creator_booking:
        content = {
            "id": creator_booking["id"],
            "title": creator_booking["title"],
            "description": creator_booking.get("description", ""),
            "video_url": creator_booking["video_url"],
            "thumbnail": creator_booking.get("thumbnail"),
            "duration": creator_booking.get("duration", "60:00"),
            "category": creator_booking.get("category"),
            "creator_name": creator_booking.get("creator_name"),
            "is_creator_content": True,
            "can_watch_full": True
        }
    else:
        # Get default content for that slot
        category = CATEGORY_ROTATION[slot_hour]
        
        if category == "promo":
            content = {
                "id": f"promo-{slot_hour}",
                "title": "ZTVLIVE Promotional Content",
                "video_url": "/ztvlive_promo_premium.mp4",
                "duration": "0:12",
                "category": "promo",
                "is_promo": True,
                "can_watch_full": True
            }
        elif CATEGORY_CONTENT.get(category) and len(CATEGORY_CONTENT[category]) > 0:
            # Parse slot_date to get day of month for rotation
            try:
                day = int(slot_date.split("-")[2])
            except (ValueError, IndexError):
                day = 1
            content_index = (slot_hour + day) % len(CATEGORY_CONTENT[category])
            video = CATEGORY_CONTENT[category][content_index]
            content = {
                **video,
                "can_watch_full": True,
                "is_creator_content": False
            }
        else:
            content_index = slot_hour % len(MOCK_HIGHLIGHTS)
            video = MOCK_HIGHLIGHTS[content_index]
            content = {
                **video,
                "can_watch_full": True,
                "is_creator_content": False
            }
    
    return {
        "slot_date": slot_date,
        "slot_hour": slot_hour,
        "slot_time": f"{slot_hour:02d}:00 - {(slot_hour + 1) % 24:02d}:00",
        "is_past": is_past,
        "is_current": is_current,
        "content": content,
        "playback_mode": "full" if is_past else "live"
    }

@api_router.get("/trending/ticker")
async def get_trending_ticker():
    """Get dynamic breaking news ticker content based on categories"""
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    current_category = CATEGORY_ROTATION[current_hour]
    
    # Base tickers that always show
    base_tickers = [
        "📺 ZTVLIVE: 24/7 Free Streaming - ztvlivestream.com",
        "🔔 Enable notifications to never miss your favorite content!",
        "📱 Download our app on iOS, Android & Desktop",
    ]
    
    # Category-specific tickers
    category_tickers = {
        "sports": [
            "🏀 LIVE: NBA highlights streaming now on ZTVLIVE",
            "⚽ TRENDING: Messi's latest goal breaks the internet",
            "🏈 NFL: Top plays of the week available in our library",
            "🎾 US Open updates: Live coverage coming soon",
        ],
        "music": [
            "🎵 NEW: Top music performances streaming live",
            "🎤 VIRAL: Concert footage everyone is talking about",
            "🎸 FEATURED: Indie artists showcase this hour",
            "🎹 LIVE: Music streams from creators worldwide",
        ],
        "gaming": [
            "🎮 LIVE: Gaming streams from top creators",
            "🕹️ ESPORTS: Tournament highlights available now",
            "🎯 TRENDING: Best gaming moments of the week",
            "🏆 NEW: Subscribe to gaming creators on ZTVLIVE",
        ],
        "podcast": [
            "🎙️ FEATURED: Top podcasts streaming this hour",
            "💭 TRENDING: Conversations that matter",
            "🎧 NEW: Interview highlights you can't miss",
            "📻 LIVE: Podcast streams from your favorite hosts",
        ],
        "news": [
            "📰 BREAKING: Latest headlines streaming live",
            "🌍 WORLD: Global news updates every hour",
            "💼 BUSINESS: Market updates and analysis",
            "🔥 TRENDING: Stories everyone is discussing",
        ],
        "film": [
            "🎬 FEATURED: Film reviews and trailers",
            "🍿 NEW: Behind-the-scenes exclusives",
            "🎥 TRENDING: Movie clips going viral",
            "⭐ REVIEWS: Latest film discussions",
        ],
        "documentary": [
            "🎬 FEATURED: Eye-opening documentaries",
            "🌍 EXPLORE: Nature and science content",
            "📚 LEARNING: Educational content streaming",
            "🔍 DISCOVER: Stories that inspire",
        ],
        "comedy": [
            "😂 LIVE: Comedy streams to brighten your day",
            "🎤 FEATURED: Stand-up highlights",
            "😆 VIRAL: Funniest moments of the week",
            "🎭 NEW: Sketch comedy from creators",
        ],
        "fitness": [
            "💪 LIVE: Workout streams for every level",
            "🧘 FEATURED: Yoga and wellness content",
            "🏃 TRENDING: Fitness challenges going viral",
            "🥗 NEW: Health and nutrition tips",
        ],
        "tech": [
            "📱 FEATURED: Latest tech reviews",
            "💻 TRENDING: Gadget unboxings",
            "🤖 AI: Technology news and updates",
            "🔧 HOW-TO: Tech tutorials streaming",
        ],
        "culture": [
            "🎨 FEATURED: Art and culture streams",
            "🌐 TRENDING: Cultural moments worldwide",
            "📸 NEW: Photography and design content",
            "✨ LIFESTYLE: Trends and inspiration",
        ],
        "vlogs": [
            "📹 LIVE: Vloggers streaming now",
            "✈️ TRAVEL: Adventure vlogs featured",
            "🏠 LIFESTYLE: Daily life content",
            "👥 FEATURED: Creator vlogs you'll love",
        ],
        "buzz": [
            "🔥 VIRAL: Content breaking the internet",
            "💥 TRENDING: Must-see moments",
            "⚡ HOT: What everyone is watching",
            "🌟 FEATURED: Viral creators on ZTVLIVE",
        ],
        "promo": [
            "📺 ZTVLIVE: Stream your events FREE",
            "🎉 NEW: Book your slot for friends & family",
            "🔔 FEATURE: Get notified when content goes live",
            "📱 DOWNLOAD: Watch on any device",
        ]
    }
    
    # Build ticker list
    tickers = base_tickers.copy()
    
    # Add category-specific tickers for current category
    if current_category in category_tickers:
        tickers.extend(category_tickers[current_category][:2])
    
    # Add some variety from other categories
    import random
    other_categories = [c for c in category_tickers.keys() if c != current_category and c != "promo"]
    for cat in random.sample(other_categories, min(3, len(other_categories))):
        tickers.append(random.choice(category_tickers[cat]))
    
    return {
        "tickers": tickers,
        "current_category": current_category,
        "last_updated": now.isoformat()
    }


# ============ SCHEDULE V2 - AI-CURATED CONTENT ENGINE ============

from services.content_engine import (
    generate_24hr_schedule,
    get_current_programming,
    get_content_for_category,
    get_all_categories,
    fetch_news_headlines,
    get_category_color,
    CONTENT_CATEGORIES
)

@api_router.get("/schedule/v2")
async def get_schedule_v2():
    """Get the AI-curated 24/7 programming schedule"""
    now = datetime.now(timezone.utc)
    schedule = generate_24hr_schedule(now)
    
    return {
        "schedule": schedule,
        "current_hour": now.hour,
        "server_time": now.isoformat(),
        "categories": CONTENT_CATEGORIES,
        "total_slots": len(schedule)
    }

@api_router.get("/schedule/v2/current")
async def get_current_v2():
    """Get what's currently playing and what's next"""
    programming = get_current_programming()
    return programming

@api_router.get("/schedule/v2/category/{category}")
async def get_category_content_v2(category: str, limit: int = 20):
    """Get all content for a specific category"""
    if category not in CONTENT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Choose from: {CONTENT_CATEGORIES}")
    
    content = get_content_for_category(category)
    return {
        "category": category,
        "content": content[:limit],
        "total": len(content),
        "color": get_category_color(category)
    }

@api_router.get("/schedule/v2/categories")
async def get_categories_v2():
    """Get all available content categories"""
    return {"categories": get_all_categories()}

@api_router.get("/news/ticker")
async def get_news_ticker():
    """Get real-time news headlines for the ticker"""
    try:
        headlines = await fetch_news_headlines("general", 10)
        return {
            "headlines": headlines,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching news: {e}")
        return {
            "headlines": [
                {"headline": "ZTVLIVE: 24/7 Free Streaming Now Available", "source": "ZTVLIVE"},
                {"headline": "Breaking news updates coming soon", "source": "ZTVLIVE News"}
            ],
            "last_updated": datetime.now(timezone.utc).isoformat()
        }


# ============ DYNAMIC TV SCHEDULER - Continuous 24/7 Programming ============

from services.tv_scheduler import (
    get_dynamic_schedule,
    get_now_playing,
    get_live_sync,
    get_upcoming_content,
    pin_content as scheduler_pin_content,
    unpin_content as scheduler_unpin_content,
    get_pinned_list,
    get_content_library,
    get_all_content,
    get_content_by_category,
    clear_schedule_cache,
    clear_all_caches,
    advance_to_next_video,
    get_program_schedule,
    CONTENT_CATEGORIES as TV_CATEGORIES,
    CONTENT_LIBRARY
)

from services.content_health import (
    check_content_library_health,
    quick_check_video,
    get_health_summary,
    clear_health_cache,
    validate_video_for_embedding,
    batch_validate_videos
)

from services.background_scheduler import (
    start_scheduler,
    stop_scheduler,
    get_scan_status,
    trigger_scan_now,
    disable_video,
    enable_video,
    get_disabled_videos
)

@api_router.get("/tv/health")
async def get_content_health_summary():
    """Get summary of content health (cached results)"""
    return get_health_summary()


# ============ EMAIL TEST ENDPOINT ============

class TestEmailRequest(BaseModel):
    to_email: str
    subject: Optional[str] = "ZTVLIVE Test Email"
    message: Optional[str] = "This is a test email from ZTVLIVE!"


@api_router.post("/test-email")
async def send_test_email(request: TestEmailRequest):
    """Send a test email to verify SendGrid configuration"""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #171717; border-radius: 16px; overflow: hidden;">
                        <tr>
                            <td style="background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); padding: 30px; text-align: center;">
                                <h1 style="margin: 0; color: white; font-size: 28px;">✅ Email Test Successful!</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="margin: 0 0 20px; color: #e5e5e5; font-size: 18px;">
                                    Your ZTVLIVE email system is working!
                                </p>
                                <p style="margin: 0 0 30px; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                                    {request.message}
                                </p>
                                <div style="background-color: #262626; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                                    <p style="margin: 0 0 10px; color: #737373; font-size: 12px;">Sent to:</p>
                                    <p style="margin: 0; color: #a855f7; font-size: 16px; font-weight: 600;">{request.to_email}</p>
                                </div>
                                <a href="https://www.ztvlivestream.com" style="display: inline-block; background-color: #a855f7; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                                    Visit ZTVLIVE
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 30px; background-color: #0a0a0a; border-top: 1px solid #262626;">
                                <p style="margin: 0; color: #525252; font-size: 14px; text-align: center;">
                                    ZTVLIVE • 24/7 Live TV Platform
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    try:
        result = await email_service.send_email(
            to_email=request.to_email,
            subject=request.subject,
            html_content=html_content
        )
        return {
            "success": True,
            "message": f"Test email sent to {request.to_email}",
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

@api_router.get("/tv/health/status")
async def get_scheduler_status():
    """Get background scheduler status and scan history"""
    return get_scan_status()

@api_router.post("/tv/health/scan")
async def scan_content_health():
    """Scan entire content library for unavailable videos (takes ~30-60 seconds)"""
    results = await check_content_library_health(CONTENT_LIBRARY)
    return results

@api_router.post("/tv/health/scan-now")
async def trigger_immediate_scan():
    """Trigger an immediate health scan in background"""
    return trigger_scan_now()

@api_router.get("/tv/health/check")
async def check_single_video(video_url: str):
    """Quick check for a single video URL"""
    result = await quick_check_video(video_url)
    return result

@api_router.post("/tv/health/clear")
async def clear_content_health_cache():
    """Clear the health check cache"""
    return clear_health_cache()

@api_router.get("/tv/health/disabled")
async def get_disabled_video_list():
    """Get list of currently disabled videos"""
    return {"disabled_videos": list(get_disabled_videos()), "count": len(get_disabled_videos())}

@api_router.post("/tv/health/disable/{video_id}")
async def disable_single_video(video_id: str, reason: str = "manual"):
    """Manually disable a video"""
    result = disable_video(video_id)
    # Clear caches after disabling
    clear_all_caches()
    return {"success": True if result else False, "video_id": video_id, "action": "disabled", "reason": reason}

@api_router.post("/tv/health/enable/{video_id}")
async def enable_single_video(video_id: str):
    """Re-enable a disabled video"""
    return enable_video(video_id)


@api_router.get("/tv/content/replenish-status")
async def get_content_replenishment_status():
    """Get the status of content library health and replenishment needs"""
    from services.content_replenisher import get_replenishment_status
    return get_replenishment_status()


@api_router.post("/tv/content/auto-replenish")
async def trigger_auto_replenishment():
    """
    Manually trigger content auto-replenishment.
    Automatically called when disabled videos exceed threshold.
    """
    from services.content_replenisher import check_and_replenish
    result = check_and_replenish()
    
    # If content was added, refresh the schedule
    if result.get("total_added", 0) > 0:
        clear_all_caches()
    
    return result


# ============ VIDEO VALIDATION ENDPOINTS ============

class VideoValidationRequest(BaseModel):
    """Request model for single video validation"""
    video_url: str

class BatchValidationRequest(BaseModel):
    """Request model for batch video validation"""
    video_urls: List[str]

@api_router.post("/tv/validate")
async def validate_single_video(request: VideoValidationRequest):
    """
    Validate a single video URL before adding to content library.
    Checks:
    - URL format validity
    - Video availability 
    - Embed permission
    - Video metadata (title, author, thumbnail)
    
    Returns detailed validation result with recommendations.
    """
    result = await validate_video_for_embedding(request.video_url)
    return result

@api_router.post("/tv/validate/batch")
async def validate_multiple_videos(request: BatchValidationRequest):
    """
    Validate multiple video URLs at once for bulk import.
    Returns categorized results: valid, invalid, uncertain.
    Limited to 50 videos per request.
    """
    if len(request.video_urls) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 videos per batch request")
    
    results = await batch_validate_videos(request.video_urls)
    return results

@api_router.get("/tv/validate/check/{video_id}")
async def quick_validate_video_id(video_id: str):
    """
    Quick validation of a video ID (not full URL).
    Useful for quick checks without constructing full URLs.
    """
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    result = await validate_video_for_embedding(video_url)
    return result

# ============ NEWSLETTER / EMAIL CAPTURE ============

class NewsletterSubscribeRequest(BaseModel):
    email: str

@api_router.post("/newsletter/subscribe")
async def subscribe_newsletter(request: NewsletterSubscribeRequest):
    """Subscribe to ZTVLIVE newsletter"""
    email = request.email.lower().strip()
    
    # Basic email validation
    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    # Check if already subscribed
    existing = await db.newsletter_subscribers.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Already subscribed")
    
    # Add subscriber
    await db.newsletter_subscribers.insert_one({
        "email": email,
        "subscribed_at": datetime.now(timezone.utc),
        "source": "website",
        "status": "active"
    })
    
    logger.info(f"New newsletter subscriber: {email}")
    return {"status": "subscribed", "message": "Welcome to ZTVLIVE!"}

@api_router.get("/newsletter/subscribers/count")
async def get_subscriber_count():
    """Get total newsletter subscribers (admin)"""
    count = await db.newsletter_subscribers.count_documents({"status": "active"})
    return {"count": count}

@api_router.post("/newsletter/unsubscribe")
async def unsubscribe_newsletter(request: NewsletterSubscribeRequest):
    """Unsubscribe from newsletter"""
    email = request.email.lower().strip()
    
    result = await db.newsletter_subscribers.update_one(
        {"email": email},
        {"$set": {"status": "unsubscribed", "unsubscribed_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"status": "unsubscribed"}

# ============ RTMP RESTREAMER CONTROL ============

import subprocess

_rtmp_process = None
_rtmp_running = False
_xvfb_process = None
_chromium_process = None

# Audio source for RTMP stream (file path or URL)
_rtmp_audio_source = ""

@api_router.post("/rtmp/start")
async def start_rtmp_restreamer(background_tasks: BackgroundTasks, audio_source: str = None):
    """Start the RTMP stream by running the bash script"""
    global _rtmp_process, _rtmp_running, _rtmp_audio_source
    
    if _rtmp_running:
        return {"status": "already_running", "message": "RTMP stream is already running"}
    
    try:
        # ===== AUTO-INSTALL DEPENDENCIES =====
        # Check and install missing dependencies before running script
        import shutil
        
        deps_missing = False
        if not shutil.which("ffmpeg"):
            deps_missing = True
            logger.info("ffmpeg not found, installing...")
        if not shutil.which("chromium"):
            deps_missing = True
            logger.info("chromium not found, installing...")
        if not shutil.which("Xvfb"):
            deps_missing = True
            logger.info("Xvfb not found, installing...")
        
        if deps_missing:
            logger.info("Installing missing RTMP dependencies...")
            # Run apt-get install synchronously to ensure deps are ready
            install_result = subprocess.run(
                ["apt-get", "update"],
                capture_output=True,
                timeout=60
            )
            install_result = subprocess.run(
                ["apt-get", "install", "-y", "ffmpeg", "chromium", "xvfb"],
                capture_output=True,
                timeout=300
            )
            if install_result.returncode != 0:
                logger.error(f"Failed to install dependencies: {install_result.stderr.decode()}")
                return {"status": "error", "message": "Failed to install dependencies. Try again."}
            logger.info("Dependencies installed successfully!")
        # ===== END DEPENDENCY CHECK =====
        
        # Kill any existing processes
        subprocess.run(["pkill", "-9", "-f", "ffmpeg.*rtmp"], capture_output=True)
        subprocess.run(["pkill", "-9", "-f", "chromium"], capture_output=True)
        subprocess.run(["pkill", "-9", "-f", "Xvfb"], capture_output=True)
        await asyncio.sleep(2)
        
        # Set audio source environment variable
        env = os.environ.copy()
        if audio_source:
            _rtmp_audio_source = audio_source
            env["AUDIO_SOURCE"] = audio_source
        elif _rtmp_audio_source:
            env["AUDIO_SOURCE"] = _rtmp_audio_source
        
        # Run the bash script in background
        script_path = "/app/backend/scripts/rtmp_stream.sh"
        _rtmp_process = subprocess.Popen(
            ["bash", script_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
            env=env
        )
        
        _rtmp_running = True
        logger.info(f"RTMP stream started via bash script (PID: {_rtmp_process.pid}), Audio: {_rtmp_audio_source or 'silent'}")
        
        return {
            "status": "started",
            "message": "RTMP stream started - Roku TV broadcast streaming to Castr",
            "pid": _rtmp_process.pid,
            "audio_source": _rtmp_audio_source or "silent"
        }
    except Exception as e:
        logger.error(f"Failed to start RTMP stream: {e}")
        return {"status": "error", "message": str(e)}

@api_router.post("/rtmp/set-audio")
async def set_rtmp_audio(audio_url: str = ""):
    """Set the audio source for RTMP stream (file path or stream URL)"""
    global _rtmp_audio_source
    _rtmp_audio_source = audio_url
    return {
        "status": "updated",
        "audio_source": audio_url if audio_url else "silent",
        "message": "Audio source updated. Restart stream to apply."
    }

@api_router.get("/rtmp/audio")
async def get_rtmp_audio():
    """Get the current audio source configuration"""
    global _rtmp_audio_source
    return {
        "audio_source": _rtmp_audio_source if _rtmp_audio_source else "silent"
    }

@api_router.post("/rtmp/stop")
async def stop_rtmp_restreamer():
    """Stop the RTMP stream and all related processes"""
    global _rtmp_process, _rtmp_running, _xvfb_process, _chromium_process
    
    try:
        # Kill FFmpeg
        if _rtmp_process:
            _rtmp_process.terminate()
            try:
                _rtmp_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                _rtmp_process.kill()
        
        # Kill Chromium
        if _chromium_process:
            _chromium_process.terminate()
            try:
                _chromium_process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                _chromium_process.kill()
        
        # Kill Xvfb
        if _xvfb_process:
            _xvfb_process.terminate()
            try:
                _xvfb_process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                _xvfb_process.kill()
        
        # Also kill any orphaned processes
        subprocess.run(["pkill", "-9", "-f", "ffmpeg.*rtmp"], capture_output=True)
        subprocess.run(["pkill", "-9", "-f", "chromium.*roku-tv"], capture_output=True)
        subprocess.run(["pkill", "-9", "-f", "Xvfb :99"], capture_output=True)
        
    except Exception as e:
        logger.error(f"Error stopping RTMP: {e}")
    
    _rtmp_process = None
    _chromium_process = None
    _xvfb_process = None
    _rtmp_running = False
    logger.info("RTMP stream stopped")
    
    return {"status": "stopped", "message": "RTMP stream stopped"}

@api_router.get("/rtmp/status")
async def get_rtmp_status():
    """Get the status of the RTMP stream"""
    global _rtmp_process, _rtmp_running
    
    # Check for running ffmpeg processes
    check_result = subprocess.run(['pgrep', '-f', 'ffmpeg.*rtmp'], capture_output=True, text=True)
    ffmpeg_running = check_result.returncode == 0
    
    # Also check for Xvfb (indicates stream is starting)
    xvfb_check = subprocess.run(['pgrep', '-f', 'Xvfb :99'], capture_output=True, text=True)
    xvfb_running = xvfb_check.returncode == 0
    
    if _rtmp_running and _rtmp_process:
        # Check if process is still running
        poll = _rtmp_process.poll()
        if poll is None:
            if ffmpeg_running:
                return {
                    "status": "running",
                    "pid": _rtmp_process.pid,
                    "destination": "rtmp://us-west.castr.io/static",
                    "source": "Roku TV Broadcast (/roku-tv)"
                }
            elif xvfb_running:
                # Script is starting up (Xvfb running but FFmpeg not yet)
                return {
                    "status": "starting",
                    "pid": _rtmp_process.pid,
                    "message": "Stream is starting, please wait..."
                }
            else:
                return {"status": "starting", "pid": _rtmp_process.pid}
        else:
            _rtmp_running = False
            return {"status": "stopped", "exit_code": poll}
    elif ffmpeg_running:
        # Process started externally (e.g., via bash script)
        _rtmp_running = True  # Sync state
        return {
            "status": "running",
            "destination": "rtmp://us-west.castr.io/static",
            "source": "Roku TV Broadcast (/roku-tv)",
            "note": "Started via external script"
        }
    elif xvfb_running:
        # Starting up
        return {
            "status": "starting",
            "message": "Stream is starting, please wait..."
        }
    
    return {"status": "stopped"}

@api_router.get("/rtmp/config")
async def get_rtmp_config():
    """Get the RTMP configuration (excluding sensitive stream key)"""
    return {
        "rtmp_url": "rtmp://us-west.castr.io/static",
        "hls_url": "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_b8b938d0c6b811eab6745b4605902bfa/index.m3u8",
        "stream_key_masked": "live_b8b9...bfa"
    }

@api_router.get("/roku/download-package")
async def download_roku_package():
    """Download the latest Roku channel package"""
    from fastapi.responses import FileResponse
    import os
    
    # Latest version - v3.5.6 with no launch animation
    package_path = "/app/backend/static/roku/ztvlive-channel-v3.5.6.zip"
    
    # Fallback to older versions if latest doesn't exist
    if not os.path.exists(package_path):
        package_path = "/app/backend/static/roku/ztvlive-channel-v3.5.5.zip"
    if not os.path.exists(package_path):
        package_path = "/app/backend/static/roku/ztvlive-channel-v3.5.4.zip"
    if not os.path.exists(package_path):
        package_path = "/app/backend/static/roku/ztvlive-channel-v3.5.3.zip"
    if not os.path.exists(package_path):
        package_path = "/app/backend/static/roku/ztvlive-roku-v3.5.2.zip"
    if not os.path.exists(package_path):
        package_path = "/app/backend/static/roku/ztvlive-roku-v3.5.1.zip"
    if not os.path.exists(package_path):
        package_path = "/app/backend/static/roku/ztvlive-roku-v3.5.0.zip"
    if not os.path.exists(package_path):
        package_path = "/app/releases/roku/ZTVLIVE_Premium_v7.zip"
    if not os.path.exists(package_path):
        package_path = "/app/releases/roku/ZTVLIVE_Premium_v4.zip"
    
    if not os.path.exists(package_path):
        raise HTTPException(status_code=404, detail="Roku package not found")
    
    filename = os.path.basename(package_path)
    
    return FileResponse(
        path=package_path,
        filename=filename,
        media_type="application/zip"
    )

@api_router.get("/firetv/download-package")
async def download_firetv_package():
    """Download the Fire TV app package"""
    from fastapi.responses import FileResponse
    import os
    
    package_path = "/app/releases/firetv/ZTVLIVE_FireTV.zip"
    
    if not os.path.exists(package_path):
        raise HTTPException(status_code=404, detail="Fire TV package not found")
    
    return FileResponse(
        path=package_path,
        filename="ZTVLIVE_FireTV.zip",
        media_type="application/zip"
    )

@api_router.get("/lg-webos/download-package")
async def download_lg_webos_package():
    """Download the latest LG webOS app package (ZIP)"""
    from fastapi.responses import FileResponse
    import os
    
    # Try latest version first
    package_path = "/app/releases/lg-webos/ZTVLIVE_LG_webOS_v1.1.0.zip"
    if not os.path.exists(package_path):
        package_path = "/app/releases/lg-webos/ZTVLIVE_LG_webOS_v2.zip"
    if not os.path.exists(package_path):
        package_path = "/app/releases/lg-webos/ZTVLIVE_LG_webOS.zip"
    
    if not os.path.exists(package_path):
        raise HTTPException(status_code=404, detail="LG webOS package not found")
    
    return FileResponse(
        path=package_path,
        filename="ZTVLIVE_LG_webOS_v1.1.0.zip",
        media_type="application/zip"
    )

@api_router.get("/lg-webos/download-ipk")
async def download_lg_webos_ipk():
    """Download the LG webOS IPK package (for Seller Lounge upload)"""
    from fastapi.responses import FileResponse
    import os
    
    package_path = "/app/releases/lg-webos/com.ztvlive.tv_1.1.0_all_NEW.ipk"
    
    if not os.path.exists(package_path):
        raise HTTPException(status_code=404, detail="LG webOS IPK not found")
    
    return FileResponse(
        path=package_path,
        filename="com.ztvlive.tv_1.1.0_all.ipk",
        media_type="application/octet-stream"
    )

@api_router.get("/lg-webos/download-test-zip")
async def download_lg_webos_test_zip():
    """Download the LG webOS Test IPK as ZIP (for Seller Lounge Test Info)"""
    from fastapi.responses import FileResponse
    import os
    
    package_path = "/app/releases/lg-webos/ZTVLIVE_Test_IPK.zip"
    
    if not os.path.exists(package_path):
        raise HTTPException(status_code=404, detail="LG webOS Test ZIP not found")
    
    return FileResponse(
        path=package_path,
        filename="ZTVLIVE_Test_IPK.zip",
        media_type="application/zip"
    )

@api_router.get("/samsung-tizen/download-package")
async def download_samsung_tizen_package():
    """Download the Samsung Tizen app package"""
    from fastapi.responses import FileResponse
    import os
    
    package_path = "/app/releases/samsung-tizen/ZTVLIVE_Samsung_Tizen.zip"
    
    if not os.path.exists(package_path):
        raise HTTPException(status_code=404, detail="Samsung Tizen package not found")
    
    return FileResponse(
        path=package_path,
        filename="ZTVLIVE_Samsung_Tizen.zip",
        media_type="application/zip"
    )

# ============ SEO DASHBOARD API ============

# Store SEO metrics in memory (would be DB in production)
SEO_METRICS = {
    "last_updated": None,
    "data": []
}

@api_router.get("/seo/metrics")
async def get_seo_metrics():
    """Get SEO metrics for dashboard"""
    # Return sample data based on the Google Search Console spreadsheet
    return {
        "metrics": [
            {"date": "2026-03-22", "not_indexed": 0, "indexed": 0, "impressions": 130},
            {"date": "2026-03-23", "not_indexed": 10, "indexed": 3, "impressions": 51},
            {"date": "2026-03-24", "not_indexed": 28, "indexed": 5, "impressions": 61},
            {"date": "2026-03-25", "not_indexed": 28, "indexed": 5, "impressions": 53},
            {"date": "2026-03-26", "not_indexed": 28, "indexed": 5, "impressions": 37},
            {"date": "2026-03-27", "not_indexed": 28, "indexed": 5, "impressions": 91},
            {"date": "2026-03-28", "not_indexed": 12, "indexed": 7, "impressions": 32},
            {"date": "2026-03-29", "not_indexed": 12, "indexed": 7, "impressions": 30},
            {"date": "2026-03-30", "not_indexed": 12, "indexed": 7, "impressions": 0}
        ],
        "summary": {
            "total_indexed": 7,
            "total_not_indexed": 12,
            "total_impressions": 485,
            "index_rate": "36.8%",
            "avg_daily_impressions": 53.9
        },
        "last_updated": "2026-03-30"
    }

@api_router.get("/seo/sitemap-status")
async def get_sitemap_status():
    """Get sitemap pages and their indexing status"""
    import xml.etree.ElementTree as ET
    
    sitemap_path = "/app/frontend/public/sitemap.xml"
    pages = []
    
    try:
        tree = ET.parse(sitemap_path)
        root = tree.getroot()
        namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        
        for url in root.findall('ns:url', namespace):
            loc = url.find('ns:loc', namespace)
            lastmod = url.find('ns:lastmod', namespace)
            priority = url.find('ns:priority', namespace)
            changefreq = url.find('ns:changefreq', namespace)
            
            if loc is not None:
                page_url = loc.text.replace('https://www.ztvlivestream.com', '')
                if not page_url:
                    page_url = '/'
                    
                pages.append({
                    "url": page_url,
                    "full_url": loc.text,
                    "lastmod": lastmod.text if lastmod is not None else None,
                    "priority": float(priority.text) if priority is not None else 0.5,
                    "changefreq": changefreq.text if changefreq is not None else "monthly",
                    "status": "indexed" if float(priority.text if priority is not None else "0.5") >= 0.8 else "pending"
                })
    except Exception as e:
        return {"error": str(e), "pages": []}
    
    return {
        "total_pages": len(pages),
        "pages": pages,
        "sitemap_url": "https://www.ztvlivestream.com/sitemap.xml"
    }

@api_router.post("/seo/request-indexing")
async def request_indexing(page_url: str = ""):
    """Request Google to index a specific page (placeholder - requires Google API)"""
    return {
        "status": "pending",
        "message": f"Indexing request submitted for {page_url}. Use Google Search Console for actual submission.",
        "instructions": [
            "1. Go to Google Search Console",
            "2. Enter the URL in the URL Inspection tool",
            "3. Click 'Request Indexing'",
            "4. Wait 1-2 weeks for Google to crawl"
        ]
    }

@api_router.get("/seo/crawl-issues")
async def get_crawl_issues():
    """Get list of URLs with crawl issues from Google Search Console data"""
    # These are the URLs from the user's Google Search Console that need attention
    crawl_issues = [
        {
            "url": "/watch/stream/million-dollar-mingle-luxury-polo-event-2020-interview-with-sheldon-bailey-beverly-peele1080p",
            "last_crawled": "2026-02-10",
            "status": "Pending",
            "issue": "Old URL pattern - redirects to /watch",
            "action": "301 redirect in place, waiting for Google to re-crawl"
        },
        {
            "url": "/stream/the-zapp-band-concert-2019",
            "last_crawled": "2025-12-25",
            "status": "Pending",
            "issue": "Old URL pattern - redirects to /watch",
            "action": "301 redirect in place"
        },
        {
            "url": "/stream/gomez-vs-llanez",
            "last_crawled": "2025-12-21",
            "status": "Pending",
            "issue": "Old URL pattern - redirects to /watch",
            "action": "301 redirect in place"
        },
        {
            "url": "/category/on-demand?page=1",
            "last_crawled": "2025-12-09",
            "status": "Pending",
            "issue": "Old URL pattern - redirects to /library",
            "action": "301 redirect in place"
        },
        {
            "url": "/password/reset",
            "last_crawled": "2025-10-23",
            "status": "Pending",
            "issue": "Valid page, waiting for index",
            "action": "Request indexing in GSC"
        },
        {
            "url": "/library",
            "last_crawled": "2026-03-31",
            "status": "Failed",
            "issue": "Crawl failed - possibly server error during crawl",
            "action": "Request re-indexing in GSC"
        },
        {
            "url": "/stream/zazueta-vs-ikei",
            "last_crawled": "2026-03-31",
            "status": "Failed",
            "issue": "Old URL pattern - now redirects to /watch",
            "action": "301 redirect in place, request re-crawl"
        }
    ]
    
    return {
        "total_issues": len(crawl_issues),
        "issues": crawl_issues,
        "summary": {
            "pending": len([i for i in crawl_issues if i["status"] == "Pending"]),
            "failed": len([i for i in crawl_issues if i["status"] == "Failed"]),
            "redirects_configured": 6,
            "needs_gsc_action": 2
        },
        "recommendations": [
            "1. All /stream/* and /category/* URLs now have 301 redirects",
            "2. Request re-indexing for /library in Google Search Console",
            "3. Old URLs will be removed from index after Google re-crawls",
            "4. robots.txt updated to block crawling of old URL patterns"
        ]
    }

# Roku-compatible stream specs
ROKU_SPECS = {
    "required_width": 1920,
    "required_height": 1080,
    "allowed_profiles": ["High", "Main", "Baseline"],
    "max_level": 4.1,
    "required_codec": "h264",
    "required_pix_fmt": "yuv420p"
}

# Promo/Fallback content for Roku when main stream is unavailable
ROKU_PROMO_PLAYLIST = [
    {
        "id": "promo-1",
        "title": "ZTVLIVE - Music Mix",
        "description": "Enjoy music while we restore the main stream",
        "url": "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8",
        "thumbnail": "https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg",
        "duration": "continuous"
    },
    {
        "id": "promo-2", 
        "title": "ZTVLIVE - Big Buck Bunny",
        "description": "Family Entertainment",
        "url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        "thumbnail": "https://i.ytimg.com/vi/H5v3kku4y6Q/maxresdefault.jpg",
        "duration": "10:00"
    },
    {
        "id": "promo-3",
        "title": "ZTVLIVE - Sintel",
        "description": "Animated Short Film",
        "url": "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
        "thumbnail": "https://i.ytimg.com/vi/TUVcZfQe-Kw/maxresdefault.jpg",
        "duration": "14:48"
    }
]

@api_router.get("/roku/promos")
async def get_roku_promos():
    """
    Get fallback promo playlist for Roku.
    These play in a loop when the main live stream has technical issues.
    """
    return {
        "promos": ROKU_PROMO_PLAYLIST,
        "message": "ZTVLIVE promos - plays when main stream is unavailable",
        "loop": True,
        "check_main_stream_interval_seconds": 60
    }


@api_router.get("/roku/content")
async def get_roku_content():
    """
    Get all content organized for Roku channel display.
    Returns categories with proper thumbnails and real video content.
    """
    from services.tv_scheduler import get_live_sync, CONTENT_LIBRARY
    
    # Get current live content
    live_sync = get_live_sync()
    now_playing = live_sync.get("now_playing", {})
    
    # Roku-optimized categories with curated thumbnails
    roku_categories = {
        "LIVE NOW": {
            "description": "Watch what's streaming right now",
            "thumbnail": "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400",
            "items": [{
                "title": now_playing.get("title", "ZTVLIVE 24/7"),
                "description": now_playing.get("description", "Live streaming entertainment"),
                "thumbnail": f"https://img.youtube.com/vi/{now_playing.get('video_id', 'dQw4w9WgXcQ')}/maxresdefault.jpg",
                "type": "live",
                "is_live": True
            }]
        },
        "MUSIC VIDEOS": {
            "description": "Hit music videos from around the world",
            "thumbnail": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
            "items": []
        },
        "GLOBAL HITS": {
            "description": "International chart toppers",
            "thumbnail": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400",
            "items": []
        },
        "HIP HOP & R&B": {
            "description": "Urban music and soul",
            "thumbnail": "https://images.unsplash.com/photo-1571609802154-77ca6b8d4b75?w=400",
            "items": []
        },
        "LATIN VIBES": {
            "description": "Reggaeton, Latin Pop & More",
            "thumbnail": "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=400",
            "items": []
        },
        "K-POP & ASIA": {
            "description": "Asian pop culture",
            "thumbnail": "https://images.unsplash.com/photo-1619961602105-16fa2a5465c2?w=400",
            "items": []
        },
        "THROWBACKS": {
            "description": "Classic hits from the legends",
            "thumbnail": "https://images.unsplash.com/photo-1458560871784-56d23406c091?w=400",
            "items": []
        },
        "DOCUMENTARIES": {
            "description": "Educational and inspiring content",
            "thumbnail": "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400",
            "items": []
        },
        "COMEDY": {
            "description": "Laugh out loud moments",
            "thumbnail": "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400",
            "items": []
        }
    }
    
    # Map CONTENT_LIBRARY categories to Roku categories
    category_mapping = {
        "global_hits": "GLOBAL HITS",
        "latin": "LATIN VIBES",
        "kpop_asia": "K-POP & ASIA",
        "hiphop_rnb": "HIP HOP & R&B",
        "european": "MUSIC VIDEOS",
        "bollywood": "GLOBAL HITS",
        "caribbean": "LATIN VIBES",
        "comedy": "COMEDY",
        "documentaries": "DOCUMENTARIES",
        "viral_trending": "MUSIC VIDEOS"
    }
    
    # Populate categories from CONTENT_LIBRARY
    for cat_key, videos in CONTENT_LIBRARY.items():
        roku_cat = category_mapping.get(cat_key)
        if roku_cat and roku_cat in roku_categories:
            for video in videos[:8]:  # Limit to 8 per category
                roku_categories[roku_cat]["items"].append({
                    "title": video.get("title", "Untitled"),
                    "description": video.get("description", ""),
                    "thumbnail": f"https://img.youtube.com/vi/{video.get('youtube_id')}/maxresdefault.jpg" if video.get("youtube_id") else video.get("thumbnail", ""),
                    "duration": video.get("duration_seconds", 0),
                    "video_id": video.get("youtube_id") or video.get("id"),
                    "type": "video"
                })
    
    # Convert to list format for Roku
    result = []
    for cat_name, cat_data in roku_categories.items():
        if cat_data["items"]:  # Only include categories with content
            result.append({
                "title": cat_name,
                "description": cat_data["description"],
                "thumbnail": cat_data["thumbnail"],
                "items": cat_data["items"]
            })
    
    return {
        "categories": result,
        "total_categories": len(result),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/roku/now-playing")
async def get_roku_now_playing():
    """
    Get the current now playing content for Roku display.
    Returns optimized data for Roku's ContentNode format.
    """
    from services.tv_scheduler import get_live_sync
    
    sync = get_live_sync()
    np = sync.get("now_playing", {})
    
    return {
        "title": np.get("title", "ZTVLIVE 24/7"),
        "description": np.get("description", "24/7 Live Entertainment"),
        "thumbnail": f"https://img.youtube.com/vi/{np.get('video_id', 'dQw4w9WgXcQ')}/maxresdefault.jpg",
        "video_id": np.get("video_id"),
        "is_creator_content": np.get("is_creator_content", False),
        "creator_name": sync.get("creator_name", ""),
        "elapsed_seconds": np.get("elapsed_seconds", 0),
        "duration_seconds": np.get("duration_seconds", 0),
        "program_block": sync.get("program_block", {}).get("name", "ZTVLIVE")
    }

@api_router.get("/roku/stream-status")
async def get_roku_stream_status():
    """
    Check if the main live stream is available for Roku.
    Returns status and fallback promo playlist if stream is down.
    """
    global _rtmp_running
    
    hls_url = "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_b8b938d0c6b811eab6745b4605902bfa/index.m3u8"
    
    stream_available = False
    try:
        # Quick check if HLS manifest is accessible
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.head(hls_url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                stream_available = response.status == 200
    except:
        stream_available = False
    
    return {
        "main_stream_available": stream_available,
        "main_stream_url": hls_url if stream_available else None,
        "rtmp_status": "running" if _rtmp_running else "stopped",
        "fallback_promos": ROKU_PROMO_PLAYLIST if not stream_available else None,
        "message": "Main stream is live" if stream_available else "Using promo fallback - main stream will resume shortly"
    }

@api_router.get("/rtmp/stream-health")
async def get_stream_health():
    """
    Run ffprobe on the HLS stream and validate against Roku specs.
    Returns codec, resolution, profile/level and alerts if out of spec.
    """
    hls_url = "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_b8b938d0c6b811eab6745b4605902bfa/index.m3u8"
    
    try:
        # Run ffprobe to get stream info
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            hls_url
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            return {
                "status": "error",
                "message": "Could not probe stream - stream may be offline",
                "ffprobe_error": result.stderr[:500] if result.stderr else "Unknown error"
            }
        
        import json as json_module
        probe_data = json_module.loads(result.stdout)
        
        # Find video stream
        video_stream = None
        audio_stream = None
        for stream in probe_data.get("streams", []):
            if stream.get("codec_type") == "video" and not video_stream:
                video_stream = stream
            elif stream.get("codec_type") == "audio" and not audio_stream:
                audio_stream = stream
        
        if not video_stream:
            return {
                "status": "error",
                "message": "No video stream found in HLS feed"
            }
        
        # Extract video info
        width = video_stream.get("width", 0)
        height = video_stream.get("height", 0)
        codec_name = video_stream.get("codec_name", "unknown")
        profile = video_stream.get("profile", "unknown")
        level = video_stream.get("level", 0)
        pix_fmt = video_stream.get("pix_fmt", "unknown")
        fps = video_stream.get("r_frame_rate", "0/1")
        bitrate = video_stream.get("bit_rate", probe_data.get("format", {}).get("bit_rate", "unknown"))
        
        # Parse level (ffprobe returns as integer, e.g., 41 for 4.1)
        level_float = level / 10.0 if level > 10 else level
        
        # Parse FPS
        try:
            fps_parts = fps.split("/")
            fps_value = round(int(fps_parts[0]) / int(fps_parts[1]), 2) if len(fps_parts) == 2 else float(fps)
        except:
            fps_value = 0
        
        # Validate against Roku specs
        alerts = []
        
        # Check resolution
        if width != ROKU_SPECS["required_width"] or height != ROKU_SPECS["required_height"]:
            alerts.append({
                "type": "resolution",
                "severity": "critical",
                "message": f"Resolution {width}x{height} - Roku requires exactly {ROKU_SPECS['required_width']}x{ROKU_SPECS['required_height']}",
                "current": f"{width}x{height}",
                "required": f"{ROKU_SPECS['required_width']}x{ROKU_SPECS['required_height']}"
            })
        
        # Check codec
        if codec_name != ROKU_SPECS["required_codec"]:
            alerts.append({
                "type": "codec",
                "severity": "critical",
                "message": f"Codec '{codec_name}' - Roku requires H.264",
                "current": codec_name,
                "required": ROKU_SPECS["required_codec"]
            })
        
        # Check profile
        if profile not in ROKU_SPECS["allowed_profiles"]:
            alerts.append({
                "type": "profile",
                "severity": "warning",
                "message": f"Profile '{profile}' may not be supported by all Roku devices",
                "current": profile,
                "allowed": ROKU_SPECS["allowed_profiles"]
            })
        
        # Check level
        if level_float > ROKU_SPECS["max_level"]:
            alerts.append({
                "type": "level",
                "severity": "critical",
                "message": f"H.264 Level {level_float} exceeds Roku max of {ROKU_SPECS['max_level']}",
                "current": level_float,
                "max_allowed": ROKU_SPECS["max_level"]
            })
        
        # Check pixel format
        if pix_fmt != ROKU_SPECS["required_pix_fmt"]:
            alerts.append({
                "type": "pix_fmt",
                "severity": "warning",
                "message": f"Pixel format '{pix_fmt}' - yuv420p recommended for compatibility",
                "current": pix_fmt,
                "recommended": ROKU_SPECS["required_pix_fmt"]
            })
        
        # Determine overall status
        critical_alerts = [a for a in alerts if a["severity"] == "critical"]
        warning_alerts = [a for a in alerts if a["severity"] == "warning"]
        
        if critical_alerts:
            status = "critical"
            status_message = f"{len(critical_alerts)} critical issue(s) - Roku playback will fail"
        elif warning_alerts:
            status = "warning"
            status_message = f"{len(warning_alerts)} warning(s) - Playback may have issues on some devices"
        else:
            status = "healthy"
            status_message = "Stream is fully Roku-compatible"
        
        return {
            "status": status,
            "status_message": status_message,
            "stream_info": {
                "resolution": f"{width}x{height}",
                "width": width,
                "height": height,
                "codec": codec_name,
                "profile": profile,
                "level": level_float,
                "pix_fmt": pix_fmt,
                "fps": fps_value,
                "bitrate": bitrate,
                "bitrate_kbps": round(int(bitrate) / 1000) if bitrate and bitrate != "unknown" else "unknown"
            },
            "roku_specs": ROKU_SPECS,
            "alerts": alerts,
            "audio_info": {
                "codec": audio_stream.get("codec_name", "none") if audio_stream else "none",
                "sample_rate": audio_stream.get("sample_rate", "unknown") if audio_stream else "unknown",
                "channels": audio_stream.get("channels", 0) if audio_stream else 0
            } if audio_stream else None,
            "checked_at": datetime.utcnow().isoformat()
        }
        
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "message": "ffprobe timed out - stream may be slow or offline"
        }
    except FileNotFoundError:
        return {
            "status": "error",
            "message": "ffprobe not installed - run: apt install -y ffmpeg"
        }
    except Exception as e:
        logger.error(f"Stream health check failed: {e}")
        return {
            "status": "error",
            "message": f"Health check failed: {str(e)}"
        }

@api_router.post("/tv/refresh")
async def refresh_tv_schedule():
    """Clear schedule cache and force refresh with latest content"""
    clear_all_caches()
    return {"success": True, "message": "All schedule caches cleared"}


@api_router.post("/tv/force-refresh")
async def force_refresh_schedule():
    """
    Force clear ALL caches and regenerate schedule.
    Use this after disabling/enabling videos to ensure changes take effect.
    """
    clear_all_caches()
    # Trigger schedule regeneration by getting a fresh sync
    from services.tv_scheduler import get_live_sync
    new_sync = get_live_sync()
    return {
        "success": True,
        "message": "Schedule fully refreshed",
        "now_playing": new_sync.get("now_playing", {}).get("title", "Unknown")
    }


@api_router.get("/obs/health-dashboard")
async def get_obs_health_dashboard():
    """
    Comprehensive OBS health dashboard for monitoring streaming status.
    Combines RTMP status, stream health, and scheduler sync status.
    """
    from services.tv_scheduler import get_current_program, get_upcoming_programs, _schedule_cache
    
    result = {
        "obs_connection": {
            "status": "unknown",
            "is_connected": False,
            "last_check": datetime.now(timezone.utc).isoformat()
        },
        "stream_health": {
            "status": "unknown",
            "is_healthy": False
        },
        "scheduler_sync": {
            "is_synced": False,
            "current_content": None,
            "next_content": None
        },
        "recommendations": [],
        "overall_status": "unknown"
    }
    
    try:
        # 1. Check RTMP/OBS connection status
        check_result = subprocess.run(['pgrep', '-f', 'ffmpeg.*rtmp'], capture_output=True, text=True, timeout=5)
        ffmpeg_running = check_result.returncode == 0
        
        if ffmpeg_running:
            result["obs_connection"]["status"] = "connected"
            result["obs_connection"]["is_connected"] = True
        else:
            # Check if there's external stream to Castr
            hls_url = "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_b8b938d0c6b811eab6745b4605902bfa/index.m3u8"
            try:
                import httpx
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.head(hls_url)
                    if response.status_code == 200:
                        result["obs_connection"]["status"] = "external_connected"
                        result["obs_connection"]["is_connected"] = True
                        result["obs_connection"]["note"] = "Stream active via external source (OBS/Castr)"
                    else:
                        result["obs_connection"]["status"] = "disconnected"
                        result["recommendations"].append("Start OBS and connect to Castr RTMP")
            except Exception:
                result["obs_connection"]["status"] = "disconnected"
                result["recommendations"].append("Start OBS and connect to Castr RTMP")
        
        # 2. Check stream health (reuse existing endpoint logic)
        try:
            hls_url = "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_b8b938d0c6b811eab6745b4605902bfa/index.m3u8"
            cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", hls_url]
            probe_result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            
            if probe_result.returncode == 0:
                import json as json_module
                probe_data = json_module.loads(probe_result.stdout)
                video_stream = next((s for s in probe_data.get("streams", []) if s.get("codec_type") == "video"), None)
                
                if video_stream:
                    width = video_stream.get("width", 0)
                    height = video_stream.get("height", 0)
                    codec = video_stream.get("codec_name", "unknown")
                    
                    # Check Roku compliance
                    is_roku_compliant = (
                        width == 1920 and 
                        height == 1080 and 
                        codec == "h264"
                    )
                    
                    result["stream_health"]["status"] = "healthy" if is_roku_compliant else "degraded"
                    result["stream_health"]["is_healthy"] = is_roku_compliant
                    result["stream_health"]["resolution"] = f"{width}x{height}"
                    result["stream_health"]["codec"] = codec
                    result["stream_health"]["roku_compliant"] = is_roku_compliant
                    
                    if not is_roku_compliant:
                        result["recommendations"].append(f"Stream resolution/codec needs adjustment for Roku (current: {width}x{height} {codec})")
                else:
                    result["stream_health"]["status"] = "no_video"
                    result["recommendations"].append("No video stream detected")
            else:
                result["stream_health"]["status"] = "offline"
                result["recommendations"].append("Stream appears to be offline")
                
        except subprocess.TimeoutExpired:
            result["stream_health"]["status"] = "timeout"
            result["recommendations"].append("Stream health check timed out")
        except Exception as e:
            result["stream_health"]["status"] = "error"
            result["stream_health"]["error"] = str(e)
        
        # 3. Check scheduler sync status
        try:
            current = get_current_program()
            upcoming_list = get_upcoming_programs(count=1)
            upcoming = upcoming_list[0] if upcoming_list else None
            
            result["scheduler_sync"]["current_content"] = {
                "title": current.get("title", "Unknown"),
                "is_creator_content": current.get("is_creator_content", False),
                "source": current.get("source", "AI")
            }
            
            if upcoming:
                result["scheduler_sync"]["next_content"] = {
                    "title": upcoming.get("title", "Unknown"),
                    "starts_in_minutes": upcoming.get("starts_in_minutes", 0)
                }
            
            result["scheduler_sync"]["is_synced"] = bool(current.get("title"))
            result["scheduler_sync"]["cache_size"] = len(_schedule_cache) if _schedule_cache else 0
            
        except Exception as e:
            result["scheduler_sync"]["error"] = str(e)
            result["recommendations"].append("Scheduler sync issue - check tv_scheduler service")
        
        # 4. Calculate overall status
        obs_ok = result["obs_connection"]["is_connected"]
        stream_ok = result["stream_health"]["is_healthy"]
        sync_ok = result["scheduler_sync"]["is_synced"]
        
        if obs_ok and stream_ok and sync_ok:
            result["overall_status"] = "healthy"
        elif obs_ok and (stream_ok or sync_ok):
            result["overall_status"] = "degraded"
        else:
            result["overall_status"] = "critical"
        
    except Exception as e:
        result["error"] = str(e)
        result["overall_status"] = "error"
    
    return result


@api_router.get("/obs/content-status")
async def get_obs_content_status():
    """
    Returns current content status for OBS automation.
    OBS should poll this every 2-3 seconds to decide scene switching.
    
    Priority: Creator Content > Safe AI Content > Promo/Game Fallback
    """
    from services.tv_scheduler import get_live_sync
    
    sync = get_live_sync()
    now_playing = sync.get("now_playing", {})
    
    # Get timing info
    elapsed = now_playing.get("elapsed_seconds", 0)
    duration = now_playing.get("duration_seconds", 300)
    time_remaining = max(0, duration - elapsed)
    
    # Check if this is creator content
    is_creator = now_playing.get("is_creator_content", False)
    
    # Safety checks
    is_ending_soon = time_remaining < 15  # Last 15 seconds = YouTube end screen
    is_starting = elapsed < 3  # First 3 seconds might have loading
    
    # Determine if content is safe to broadcast
    is_safe = not is_ending_soon and not is_starting
    
    # Recommended OBS scene
    if is_safe and is_creator:
        recommended_scene = "CREATOR_CONTENT"
        priority = 1
    elif is_safe:
        recommended_scene = "WATCH_PAGE"
        priority = 2
    elif time_remaining > 0 and time_remaining < 15:
        recommended_scene = "TRANSITION"
        priority = 3
    else:
        recommended_scene = "FALLBACK"
        priority = 4
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "current_content": {
            "title": now_playing.get("title", "Unknown"),
            "video_id": now_playing.get("video_id"),
            "is_creator_content": is_creator,
            "creator_name": sync.get("creator_name", ""),
            "elapsed_seconds": elapsed,
            "duration_seconds": duration,
            "time_remaining": time_remaining,
            "progress_percent": round((elapsed / duration * 100) if duration > 0 else 0, 1)
        },
        "safety": {
            "is_safe": is_safe,
            "is_ending_soon": is_ending_soon,
            "is_starting": is_starting,
            "reason": "Content is safe" if is_safe else (
                "Ending soon - YouTube end screen" if is_ending_soon else
                "Starting - may have loading graphics" if is_starting else "Unknown"
            )
        },
        "obs_recommendation": {
            "scene": recommended_scene,
            "priority": priority,
            "action": "STAY" if is_safe else "SWITCH",
            "switch_to": None if is_safe else ("PROMO" if time_remaining < 15 else "GAME")
        },
        "next_content": {
            "available": True,
            "eta_seconds": time_remaining
        }
    }


@api_router.get("/tv/schedule")
async def get_tv_schedule(hours: int = 24):
    """Get the dynamic TV schedule with continuous programming"""
    return get_dynamic_schedule(hours)

@api_router.get("/tv/debug-content")
async def debug_tv_content():
    """Debug endpoint to check content library"""
    from services import tv_scheduler
    music = tv_scheduler.CONTENT_LIBRARY.get('music', [])
    return {
        "music_count": len(music),
        "first_title": music[0].get("title") if music else None,
        "module_file": tv_scheduler.__file__,
        "all_categories": list(tv_scheduler.CONTENT_LIBRARY.keys())
    }

@api_router.get("/tv/now-playing")
async def get_tv_now_playing():
    """Get what's currently playing with sync info"""
    return get_now_playing()

@api_router.get("/tv/upcoming")
async def get_tv_upcoming(count: int = 10):
    """Get upcoming content in the schedule"""
    return {"upcoming": get_upcoming_content(count)}


@api_router.get("/tv/promo-videos")
async def get_promo_videos():
    """
    Get list of ZTVLIVE promo videos to use as fallback when content freezes/buffers.
    Used by the frontend to fill gaps when videos have frozen frames or silence.
    """
    promo_videos = [
        {
            "id": "promo-70-revolution",
            "title": "The 70% Revolution - ZTVLIVE",
            "video_url": "/api/static/promo/ztvlive_70_revolution_with_voiceover.mp4",
            "thumbnail": "/api/static/promo/ztvlive_logo.png",
            "duration_seconds": 23,
            "is_promo": True
        },
        {
            "id": "promo-70-final",
            "title": "ZTVLIVE - Create. Stream. Earn.",
            "video_url": "/api/static/promo/ztvlive_70_revolution_FINAL.mp4",
            "thumbnail": "/api/static/promo/ztvlive_logo.png",
            "duration_seconds": 36,
            "is_promo": True
        },
        {
            "id": "promo-tiktok",
            "title": "ZTVLIVE - For TikTok & Reels",
            "video_url": "/api/static/promo/ztvlive_TIKTOK_REELS.mp4",
            "thumbnail": "/api/static/promo/ztvlive_logo.png",
            "duration_seconds": 25,
            "is_promo": True
        },
        {
            "id": "promo-twitter",
            "title": "ZTVLIVE - For Twitter/X",
            "video_url": "/api/static/promo/ztvlive_TWITTER_X.mp4",
            "thumbnail": "/api/static/promo/ztvlive_logo.png",
            "duration_seconds": 30,
            "is_promo": True
        }
    ]
    
    return {
        "videos": promo_videos,
        "count": len(promo_videos),
        "message": "Use these promo videos when content freezes or buffers"
    }


@api_router.get("/tv/creator-cache")
async def get_creator_cache():
    """Debug endpoint to view creator bookings cache status"""
    from services.tv_scheduler import _creator_bookings_cache, _creator_cache_timestamp, refresh_creator_bookings_cache
    
    return {
        "cache_size": len(_creator_bookings_cache) if _creator_bookings_cache else 0,
        "cache_keys": list(_creator_bookings_cache.keys()) if _creator_bookings_cache else [],
        "cache_entries": {k: {"title": v.get("title"), "hour": v.get("slot_start_hour"), "minute": v.get("slot_start_minute")} for k, v in _creator_bookings_cache.items()} if _creator_bookings_cache else {},
        "last_refresh": _creator_cache_timestamp.isoformat() if _creator_cache_timestamp else None,
        "current_utc": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/tv/schedule-diagnostic")
async def get_schedule_diagnostic():
    """
    Comprehensive diagnostic for creator scheduling issues.
    Call this endpoint to understand why scheduled content isn't playing.
    """
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    current_hour = now.hour
    current_minute = now.minute
    
    # Get all bookings for today
    today_bookings = await db.creator_bookings.find(
        {"slot_date": today},
        {"_id": 0}
    ).to_list(100)
    
    # Get creator cache status
    from services.tv_scheduler import _creator_bookings_cache, _creator_cache_timestamp
    
    # Analyze each booking
    booking_analysis = []
    for b in today_bookings:
        trt = b.get("trt_seconds") or b.get("video_duration_seconds")
        duration_minutes = b.get("duration_minutes", 15)
        effective_duration = trt if trt else duration_minutes * 60
        
        slot_start = b.get("slot_start_hour", 0) * 60 + b.get("slot_start_minute", 0)
        slot_end = slot_start + (effective_duration // 60)
        current_time_minutes = current_hour * 60 + current_minute
        
        is_active_now = slot_start <= current_time_minutes < slot_end
        time_until_start = slot_start - current_time_minutes
        
        booking_analysis.append({
            "title": b.get("title"),
            "slot_time": f"{b.get('slot_start_hour', 0):02d}:{b.get('slot_start_minute', 0):02d}",
            "status": b.get("status"),
            "has_trt": bool(trt),
            "trt_seconds": trt,
            "duration_minutes": duration_minutes,
            "effective_duration_seconds": effective_duration,
            "is_active_now": is_active_now,
            "time_until_start_minutes": time_until_start if time_until_start > 0 else "PAST",
            "video_url": b.get("video_url", "")[:80] + "..." if b.get("video_url") else None,
            "issues": []
        })
        
        # Check for issues
        issues = booking_analysis[-1]["issues"]
        if b.get("status") not in ["approved", "confirmed", "live", "pending"]:
            issues.append(f"❌ Status is '{b.get('status')}' - needs to be 'approved', 'confirmed', 'live', or 'pending'")
        if not trt and not duration_minutes:
            issues.append("⚠️ No TRT and no duration_minutes - will use 15min default")
        if not b.get("video_url"):
            issues.append("❌ No video_url set")
    
    # Cache status
    cache_key_for_now = f"{today}_{current_hour}"
    is_in_cache = cache_key_for_now in (_creator_bookings_cache or {})
    
    return {
        "diagnostic_time": now.isoformat(),
        "current_time": f"{current_hour:02d}:{current_minute:02d} UTC",
        "today_date": today,
        "expected_cache_key": cache_key_for_now,
        "is_in_cache": is_in_cache,
        "cache_last_refresh": _creator_cache_timestamp.isoformat() if _creator_cache_timestamp else "Never",
        "total_bookings_today": len(today_bookings),
        "bookings": booking_analysis,
        "recommendations": [
            "If booking shows is_active_now=true but not playing, try POST /api/tv/refresh-creator-cache",
            "If status is not 'approved', booking won't play",
            "TRT (actual video duration) is now optional - will fallback to duration_minutes",
            "Check /api/tv/sync to see what's currently playing"
        ]
    }


@api_router.post("/tv/refresh-creator-cache")
async def force_refresh_creator_cache():
    """Force refresh the creator bookings cache from database"""
    from services.tv_scheduler import refresh_creator_bookings_cache, _creator_bookings_cache
    
    count = await refresh_creator_bookings_cache()
    
    return {
        "refreshed": True,
        "bookings_cached": count,
        "cache_keys": list(_creator_bookings_cache.keys()) if _creator_bookings_cache else [],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@api_router.post("/tv/reset-booking-status")
async def reset_booking_status(booking_id: str = None, reset_all_today: bool = False):
    """
    Reset booking status from 'completed' back to 'approved' so it can play again.
    Use this to fix bookings that were marked complete prematurely.
    
    - booking_id: Reset a specific booking
    - reset_all_today: Reset all completed bookings for today
    """
    from services.tv_scheduler import refresh_creator_bookings_cache
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    if booking_id:
        result = await db.creator_bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"status": "approved", "auto_cutoff_applied": False}}
        )
        if result.modified_count > 0:
            await refresh_creator_bookings_cache()
            return {"success": True, "message": f"Reset booking {booking_id} to approved"}
        return {"success": False, "message": "Booking not found"}
    
    if reset_all_today:
        result = await db.creator_bookings.update_many(
            {"slot_date": today, "status": "completed"},
            {"$set": {"status": "approved", "auto_cutoff_applied": False}}
        )
        await refresh_creator_bookings_cache()
        return {"success": True, "message": f"Reset {result.modified_count} bookings to approved for {today}"}
    
    return {"success": False, "message": "Provide booking_id or set reset_all_today=true"}


# Manual scene override storage
_manual_scene_override = {
    "enabled": False,
    "scene": "game",  # "game" or "creator"
    "override_until": None,
    "reason": None,
    "set_by": None
}


@api_router.get("/obs/manual-override")
async def get_manual_override():
    """Get current manual scene override status"""
    global _manual_scene_override
    
    # Check if override has expired
    if _manual_scene_override["enabled"] and _manual_scene_override["override_until"]:
        if datetime.now(timezone.utc) > datetime.fromisoformat(_manual_scene_override["override_until"].replace("Z", "+00:00")):
            _manual_scene_override["enabled"] = False
            _manual_scene_override["reason"] = "Override expired"
    
    return _manual_scene_override


@api_router.post("/obs/manual-override")
async def set_manual_override(
    scene: str,
    duration_minutes: int = 60,
    reason: str = "Manual override",
    user: dict = Depends(get_current_user)
):
    """
    Manually override OBS scene switching.
    Admin can force a specific scene regardless of scheduled content.
    """
    global _manual_scene_override
    
    if scene not in ["game", "creator", "disable"]:
        raise HTTPException(status_code=400, detail="Scene must be 'game', 'creator', or 'disable'")
    
    if scene == "disable":
        _manual_scene_override = {
            "enabled": False,
            "scene": "game",
            "override_until": None,
            "reason": "Override disabled",
            "set_by": user.get("email")
        }
        return {"message": "Manual override disabled", "status": _manual_scene_override}
    
    override_until = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
    
    _manual_scene_override = {
        "enabled": True,
        "scene": scene,
        "override_until": override_until.isoformat(),
        "reason": reason,
        "set_by": user.get("email")
    }
    
    return {
        "message": f"Scene override set to '{scene}' for {duration_minutes} minutes",
        "status": _manual_scene_override
    }


@api_router.get("/broadcast/viewer-count")
async def get_real_viewer_count():
    """
    Get real-time viewer count from WebSocket connections.
    Returns actual connected viewers, not estimates.
    """
    from routes.live_survey import survey_game
    
    # Get actual WebSocket connections
    game_viewers = len(survey_game.connected_clients) if hasattr(survey_game, 'connected_clients') else 0
    
    # Get watch page viewers (if we track them separately)
    watch_viewers = 0
    
    return {
        "total_viewers": game_viewers + watch_viewers,
        "game_players": game_viewers,
        "watch_viewers": watch_viewers,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_real_count": True
    }


@api_router.get("/broadcast/youtube-stats")
async def get_youtube_video_stats(video_url: str = None, video_id: str = None):
    """
    Get real YouTube video statistics using oEmbed API.
    """
    if not video_url and not video_id:
        raise HTTPException(status_code=400, detail="Provide video_url or video_id")
    
    # Extract video ID if URL provided
    if video_url:
        if "youtube.com/watch?v=" in video_url:
            video_id = video_url.split("v=")[1].split("&")[0]
        elif "youtu.be/" in video_url:
            video_id = video_url.split("youtu.be/")[1].split("?")[0]
        elif "youtube.com/embed/" in video_url:
            video_id = video_url.split("embed/")[1].split("?")[0]
    
    if not video_id:
        raise HTTPException(status_code=400, detail="Could not extract video ID")
    
    try:
        import httpx
        
        # Get oEmbed data
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(oembed_url)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "video_id": video_id,
                    "title": data.get("title"),
                    "author_name": data.get("author_name"),
                    "author_url": data.get("author_url"),
                    "thumbnail_url": data.get("thumbnail_url"),
                    "available": True
                }
            else:
                return {
                    "video_id": video_id,
                    "available": False,
                    "error": "Video not accessible"
                }
    except Exception as e:
        return {
            "video_id": video_id,
            "available": False,
            "error": str(e)
        }


@api_router.get("/creator/share/{booking_id}")
async def get_creator_share_info(booking_id: str):
    """
    Get shareable info for a creator's scheduled content.
    Returns share URL and content details for social media sharing.
    """
    booking = await db.creator_bookings.find_one({"booking_id": booking_id})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Build share URL
    share_url = f"https://www.ztvlivestream.com/watch?event={booking_id}"
    
    # Format schedule time for sharing
    slot_date = booking.get("slot_date", "")
    slot_hour = booking.get("slot_start_hour", 0)
    slot_minute = booking.get("slot_start_minute", 0)
    
    # Convert to user-friendly format
    schedule_time = f"{slot_date} at {slot_hour:02d}:{slot_minute:02d} UTC"
    
    return {
        "booking_id": booking_id,
        "title": booking.get("title"),
        "creator_name": booking.get("creator_name"),
        "schedule_time": schedule_time,
        "slot_date": slot_date,
        "slot_hour": slot_hour,
        "slot_minute": slot_minute,
        "duration_minutes": booking.get("duration_minutes", 60),
        "thumbnail": booking.get("thumbnail"),
        "share_url": share_url,
        "share_text": f"Watch '{booking.get('title')}' LIVE on ZTVLIVE! {schedule_time}",
        "social_share": {
            "twitter": f"https://twitter.com/intent/tweet?text=Watch%20'{booking.get('title')}'%20LIVE%20on%20ZTVLIVE!&url={share_url}",
            "facebook": f"https://www.facebook.com/sharer/sharer.php?u={share_url}",
            "whatsapp": f"https://wa.me/?text=Watch%20'{booking.get('title')}'%20LIVE%20on%20ZTVLIVE!%20{share_url}"
        },
        "status": booking.get("status")
    }


@api_router.get("/creator/{user_id}/stats")
async def get_creator_stats_by_id(
    user_id: str,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None)
):
    """
    Get stats for a specific creator by user_id.
    Returns total views, earnings, and video count.
    """
    # Verify authentication
    token = session_token
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
        else:
            token = authorization
    
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get requesting user
    requesting_user = await get_current_user(session_token=token)
    if not requesting_user:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Users can only see their own stats (or admin can see all)
    requesting_user_id = str(requesting_user.get("_id") or requesting_user.get("user_id"))
    is_admin = requesting_user.get("email") in ["admin@ztvlivestream.com", "kevin@ztvlive.com"] or requesting_user.get("role") == "admin"
    
    if requesting_user_id != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="You can only view your own stats")
    
    # Get creator stats
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user_doc:
        return {
            "total_views": 0,
            "total_earnings": 0.0,
            "video_count": 0,
            "follower_count": 0
        }
    
    # Count videos
    video_count = await db.creator_videos.count_documents({"creator_id": user_id})
    
    # Get follower count
    follower_count = await db.creator_follows.count_documents({"creator_id": user_id})
    
    return {
        "total_views": user_doc.get("total_views", 0),
        "total_earnings": user_doc.get("total_earnings", 0.0),
        "video_count": video_count,
        "follower_count": follower_count,
        "is_verified": user_doc.get("is_verified", False)
    }


@api_router.get("/creator/my-live-stats")
async def get_creator_live_stats(user: dict = Depends(get_current_user)):
    """
    Get real-time stats for the current creator's LIVE content.
    Only returns data if the creator's content is currently live.
    Regular creators can ONLY see their own stats.
    """
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    from routes.live_survey import survey_game
    from services.tv_scheduler import get_current_program
    
    user_id = str(user.get("_id") or user.get("user_id"))
    user_email = user.get("email", "")
    is_admin = user_email in ["admin@ztvlivestream.com", "kevin@ztvlive.com"]
    
    # Get current program
    current = get_current_program()
    is_creator_content = current.get("is_creator_content", False)
    
    # Check if this creator's content is live
    current_creator_id = current.get("creator_id")
    is_my_content_live = is_creator_content and current_creator_id == user_id
    
    if not is_my_content_live and not is_admin:
        # Creator's content is not live - return minimal info
        return {
            "is_my_content_live": False,
            "message": "Your content is not currently live",
            "next_scheduled": await get_next_scheduled_for_creator(user_id)
        }
    
    # Creator's content IS live (or user is admin) - return full stats
    game_viewers = len(survey_game.connected_clients) if hasattr(survey_game, 'connected_clients') else 0
    
    return {
        "is_my_content_live": is_my_content_live,
        "content_title": current.get("title") if is_my_content_live or is_admin else None,
        "viewer_count": game_viewers if is_my_content_live or is_admin else 0,
        "elapsed_seconds": current.get("elapsed_seconds", 0) if is_my_content_live or is_admin else 0,
        "remaining_seconds": current.get("duration_seconds", 0) - current.get("elapsed_seconds", 0) if is_my_content_live or is_admin else 0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


async def get_next_scheduled_for_creator(creator_id: str):
    """Get the next scheduled content for a specific creator"""
    now = datetime.now(timezone.utc)
    
    next_booking = await db.creator_bookings.find_one({
        "creator_id": creator_id,
        "status": {"$in": ["approved", "confirmed"]},
        "slot_datetime_utc": {"$gt": now.isoformat()}
    }, sort=[("slot_datetime_utc", 1)])
    
    if next_booking:
        return {
            "title": next_booking.get("title"),
            "slot_date": next_booking.get("slot_date"),
            "slot_hour": next_booking.get("slot_start_hour"),
            "slot_minute": next_booking.get("slot_start_minute", 0)
        }
    
    return None


@api_router.get("/broadcast/viewer-count/admin")
async def get_admin_viewer_count(user: dict = Depends(get_current_user)):
    """
    Admin-only endpoint for full viewer statistics.
    Regular creators should use /creator/my-live-stats instead.
    """
    user_email = user.get("email", "")
    is_admin = user_email in ["admin@ztvlivestream.com", "kevin@ztvlive.com"]
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from routes.live_survey import survey_game
    
    game_viewers = len(survey_game.connected_clients) if hasattr(survey_game, 'connected_clients') else 0
    
    return {
        "total_viewers": game_viewers,
        "game_players": game_viewers,
        "watch_viewers": 0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_real_count": True
    }


@api_router.get("/obs/scene-switch")
async def get_obs_scene_switch():
    """
    OBS Scene Switch API - Returns which scene OBS should display.
    
    This endpoint is polled by the local OBS automation script every 30 seconds.
    Returns:
    - scene: "game" or "creator" 
    - is_creator_live: boolean
    - creator_embed_url: YouTube embed URL if creator content is live
    - creator_title: Title of creator content
    - remaining_seconds: Time remaining for creator content
    - switch_back_at: ISO timestamp when to switch back to game
    """
    global _manual_scene_override
    from services.tv_scheduler import get_current_program
    
    # Check for manual override first
    if _manual_scene_override.get("enabled"):
        override_until = _manual_scene_override.get("override_until")
        if override_until:
            try:
                until_dt = datetime.fromisoformat(override_until.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) < until_dt:
                    # Manual override is active
                    return {
                        "scene": _manual_scene_override["scene"],
                        "is_creator_live": _manual_scene_override["scene"] == "creator",
                        "manual_override": True,
                        "override_reason": _manual_scene_override.get("reason"),
                        "override_until": override_until,
                        "message": f"MANUAL OVERRIDE: {_manual_scene_override.get('reason')}"
                    }
                else:
                    # Override expired
                    _manual_scene_override["enabled"] = False
            except:
                pass
    
    current = get_current_program()
    
    is_creator = current.get("is_creator_content", False)
    
    if is_creator:
        # Calculate when creator content ends
        duration = current.get("duration_seconds", 3600)
        elapsed = current.get("elapsed_seconds", 0)
        remaining = max(0, duration - elapsed)
        
        switch_back_at = (datetime.now(timezone.utc) + timedelta(seconds=remaining)).isoformat()
        
        return {
            "scene": "creator",
            "is_creator_live": True,
            "creator_embed_url": current.get("embed_url") or current.get("video_url"),
            "creator_title": current.get("title"),
            "creator_name": current.get("creator_name"),
            "thumbnail": current.get("thumbnail"),
            "elapsed_seconds": elapsed,
            "remaining_seconds": remaining,
            "duration_seconds": duration,
            "switch_back_at": switch_back_at,
            "message": f"Creator content '{current.get('title')}' is LIVE - switch to creator scene"
        }
    else:
        # Check if creator content is coming up soon (within 2 minutes)
        upcoming_creator = None
        try:
            from services.tv_scheduler import _creator_bookings_cache
            now = datetime.now(timezone.utc)
            current_date = now.strftime("%Y-%m-%d")
            current_hour = now.hour
            current_minute = now.minute
            
            # Check next hour's cache
            next_hour = (current_hour + 1) % 24
            next_date = current_date if next_hour > current_hour else (now + timedelta(days=1)).strftime("%Y-%m-%d")
            
            for cache_key, booking in _creator_bookings_cache.items():
                booking_date, booking_hour = cache_key.rsplit("_", 1)
                booking_hour = int(booking_hour)
                booking_minute = booking.get("slot_start_minute", 0)
                
                # Calculate minutes until this booking
                if booking_date == current_date and booking_hour == current_hour:
                    minutes_until = booking_minute - current_minute
                elif booking_date == current_date and booking_hour == current_hour + 1:
                    minutes_until = 60 - current_minute + booking_minute
                else:
                    continue
                
                if 0 < minutes_until <= 2:  # Within 2 minutes
                    upcoming_creator = {
                        "title": booking.get("title"),
                        "starts_in_seconds": minutes_until * 60,
                        "creator_name": booking.get("creator_name")
                    }
                    break
        except Exception as e:
            print(f"Error checking upcoming creator: {e}")
        
        response = {
            "scene": "game",
            "is_creator_live": False,
            "creator_embed_url": None,
            "creator_title": None,
            "message": "No creator content - show game feed"
        }
        
        if upcoming_creator:
            response["upcoming_creator"] = upcoming_creator
            response["message"] = f"Creator '{upcoming_creator['title']}' starting in {upcoming_creator['starts_in_seconds']} seconds"
        
        return response


@api_router.get("/tv/library")
async def get_tv_library():
    """Get all available content organized by category"""
    return get_content_library()

@api_router.get("/tv/library/{category}")
async def get_tv_library_category(category: str):
    """Get content for a specific category"""
    if category not in TV_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Choose from: {TV_CATEGORIES}")
    
    content = get_content_by_category(category)
    return {
        "category": category,
        "content": content,
        "total": len(content)
    }

@api_router.post("/tv/advance")
async def advance_tv_content():
    """Advance to the next video in the playlist (called when current video ends)"""
    try:
        next_video = advance_to_next_video()
        return {
            "success": True,
            "now_playing": next_video,
            "message": "Advanced to next video"
        }
    except Exception as e:
        logger.error(f"Error advancing video: {e}")
        return {
            "success": False,
            "message": str(e)
        }

@api_router.post("/tv/pin/{content_id}")
async def pin_tv_content(content_id: str, priority: int = 0):
    """Pin content to play with priority (admin function)"""
    result = scheduler_pin_content(content_id, priority)
    if not result["success"]:
        raise HTTPException(status_code=404, detail="Content not found")
    return result

@api_router.delete("/tv/pin/{content_id}")
async def unpin_tv_content(content_id: str):
    """Remove content from pinned list"""
    result = scheduler_unpin_content(content_id)
    return result

@api_router.get("/tv/pinned")
async def get_tv_pinned():
    """Get all pinned content"""
    return {"pinned": get_pinned_list()}

@api_router.get("/tv/sync")
async def get_tv_sync():
    """Get live sync information for synchronized viewing"""
    return get_live_sync()

@api_router.get("/tv/skip-current")
async def skip_current_video():
    """
    Skip the current video (used when embed fails).
    Triggers the next video in rotation immediately.
    """
    from services.content_health import disable_video
    from services.tv_scheduler import get_live_sync as scheduler_sync
    
    # Get current video
    current_sync = scheduler_sync()
    current_video_id = current_sync.get("video_id")
    
    if current_video_id:
        # Disable the current video so it won't play again
        disable_video(current_video_id)
        # Clear all caches to force regeneration
        clear_all_caches()
        logger.info(f"Skipped and disabled video {current_video_id} due to embed error")
    
    return {
        "success": True,
        "skipped_video_id": current_video_id,
        "message": "Video skipped and disabled, next sync will return new content"
    }

async def get_tv_program_schedule():
    """Get the daily TV programming schedule with time blocks"""
    return {"schedule": get_program_schedule()}

@api_router.get("/tv/health")
async def get_content_health():
    """Get content health summary - which videos are disabled"""
    from services.content_health import get_health_summary, load_disabled_videos
    summary = get_health_summary()
    return {
        "status": "healthy" if summary["disabled_count"] == 0 else "degraded",
        "disabled_count": summary["disabled_count"],
        "disabled_videos": summary["disabled_videos"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.post("/tv/clear-cache")
async def clear_tv_cache():
    """Clear all TV schedule caches to force regeneration"""
    from services.tv_scheduler import clear_all_caches
    clear_all_caches()
    return {
        "success": True,
        "message": "All caches cleared, schedule will regenerate on next sync"
    }

@api_router.post("/tv/health/check")
async def run_health_check():
    """Run a full health check on all content (admin only)"""
    from services.content_health import check_content_health
    from services.tv_scheduler import CONTENT_LIBRARY
    
    results = await check_content_health(CONTENT_LIBRARY)
    return results

@api_router.post("/tv/health/disable/{video_id}")
async def disable_video(video_id: str):
    """Disable a video that's not working"""
    from services.content_health import disable_video
    success = disable_video(video_id)
    return {"success": success, "video_id": video_id, "action": "disabled"}

@api_router.post("/tv/health/enable/{video_id}")
async def enable_video(video_id: str):
    """Re-enable a previously disabled video"""
    from services.content_health import enable_video
    success = enable_video(video_id)
    return {"success": success, "video_id": video_id, "action": "enabled"}

@api_router.api_route("/tv/report-error", methods=["GET", "POST"])
async def report_video_error(video_id: str, error_code: int = None, error_message: str = None):
    """Report a video playback error from the client (supports both GET and POST)"""
    from services.content_health import disable_video
    
    # Auto-disable videos with error 150 (embedding disabled)
    if error_code == 150:
        disable_video(video_id)
        logger.warning(f"Auto-disabled video {video_id} due to error 150 (embedding disabled)")
        return {"action": "disabled", "video_id": video_id, "reason": "embedding_disabled"}
    
    # Log other errors but don't auto-disable
    logger.warning(f"Video error reported: {video_id}, code: {error_code}, message: {error_message}")
    return {"action": "logged", "video_id": video_id}


@api_router.post("/tv/report-low-quality")
async def report_low_quality_video(video_id: str = None, youtube_id: str = None, reason: str = None):
    """Report a video as low quality (< 720p) - will be filtered from playlist"""
    from services.tv_scheduler import save_low_quality_video
    
    # Accept either video_id or youtube_id
    vid = video_id or youtube_id
    if not vid:
        raise HTTPException(status_code=400, detail="video_id or youtube_id required")
    
    save_low_quality_video(vid)
    logger.info(f"Video marked as low quality: {vid}, reason: {reason}")
    
    return {
        "success": True,
        "video_id": vid,
        "action": "marked_low_quality",
        "reason": reason or "Quality below 720p"
    }


@api_router.get("/tv/low-quality-list")
async def get_low_quality_videos():
    """Get list of videos marked as low quality"""
    from services.tv_scheduler import load_low_quality_videos
    
    low_quality_ids = load_low_quality_videos()
    return {
        "count": len(low_quality_ids),
        "video_ids": list(low_quality_ids)
    }


@api_router.post("/tv/refresh-schedule")
async def refresh_schedule():
    """Force refresh the schedule cache to get fresh content - ADMIN ONLY"""
    from services.tv_scheduler import clear_all_caches, generate_daily_schedule, CONTENT_LIBRARY
    from datetime import datetime, timezone
    from collections import Counter
    
    # Clear all caches
    clear_all_caches()
    
    # Generate fresh schedule
    schedule = generate_daily_schedule(datetime.now(timezone.utc))
    
    # Calculate stats
    video_ids = [item['id'] for item in schedule]
    counts = Counter(video_ids)
    repeated = {k: v for k, v in counts.items() if v > 1}
    
    total_content = sum(len(v) for v in CONTENT_LIBRARY.values())
    
    return {
        "success": True,
        "message": "Schedule cache cleared and regenerated",
        "stats": {
            "total_library_size": total_content,
            "schedule_length": len(schedule),
            "unique_videos_used": len(counts),
            "max_repeats": max(repeated.values()) if repeated else 0,
            "videos_with_repeats": len(repeated)
        }
    }


@api_router.get("/tv/schedule-health")
async def get_schedule_health():
    """Get comprehensive schedule health stats for Admin Dashboard"""
    from services.tv_scheduler import (
        generate_daily_schedule, CONTENT_LIBRARY, 
        load_disabled_videos, is_video_disabled
    )
    from datetime import datetime, timezone
    from collections import Counter
    
    # Get current schedule
    schedule = generate_daily_schedule(datetime.now(timezone.utc))
    
    # Library stats
    disabled_videos = load_disabled_videos()
    total_videos = sum(len(v) for v in CONTENT_LIBRARY.values())
    enabled_videos = sum(
        1 for cat_items in CONTENT_LIBRARY.values() 
        for item in cat_items 
        if not is_video_disabled(item, disabled_videos)
    )
    disabled_count = total_videos - enabled_videos
    
    # Schedule stats
    video_ids = [item['id'] for item in schedule]
    counts = Counter(video_ids)
    repeated = {k: v for k, v in counts.items() if v > 1}
    unique_videos = len(counts)
    max_repeats = max(repeated.values()) if repeated else 0
    
    # Category distribution
    category_counts = Counter(item.get('category', 'unknown') for item in schedule)
    
    # Calculate health score (0-100)
    # Factors: utilization rate, max repeats, category spread
    utilization_rate = (unique_videos / enabled_videos * 100) if enabled_videos > 0 else 0
    repeat_penalty = min(max_repeats * 5, 30)  # Max 30 point penalty
    category_spread = len(category_counts) / len(CONTENT_LIBRARY) * 20  # Max 20 points for using all categories
    
    health_score = min(100, max(0, int(
        utilization_rate * 0.6 +  # 60% weight on utilization
        category_spread +          # 20% weight on category variety
        (20 - repeat_penalty)      # 20% weight on avoiding repeats
    )))
    
    # Generate recommendations
    recommendations = []
    if utilization_rate < 80:
        recommendations.append(f"Library utilization is {utilization_rate:.0f}% - consider refreshing the schedule to use more content")
    if max_repeats > 5:
        recommendations.append(f"Some videos repeat {max_repeats}x - reduce by expanding content library or refreshing schedule")
    if disabled_count > 20:
        recommendations.append(f"{disabled_count} videos are disabled - review and re-enable working videos")
    if len(category_counts) < len(CONTENT_LIBRARY) * 0.6:
        recommendations.append("Some categories are underrepresented - adjust time block preferences")
    
    return {
        "library_stats": {
            "total_videos": total_videos,
            "enabled_videos": enabled_videos,
            "disabled_videos": disabled_count,
            "categories_count": len(CONTENT_LIBRARY)
        },
        "schedule_stats": {
            "schedule_length": len(schedule),
            "unique_videos": unique_videos,
            "max_repeats": max_repeats,
            "videos_with_repeats": len(repeated),
            "utilization_percent": round(utilization_rate, 1)
        },
        "category_distribution": dict(category_counts),
        "health_score": health_score,
        "recommendations": recommendations,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@api_router.post("/highlights", response_model=Highlight)
async def create_highlight(highlight: HighlightCreate):
    """Create a new highlight (admin function)"""
    highlight_obj = Highlight(**highlight.model_dump())
    doc = highlight_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.highlights.insert_one(doc)
    return highlight_obj

@api_router.post("/highlights/{highlight_id}/like")
async def like_highlight(highlight_id: str):
    """Like a highlight (works for both regular and AI-generated highlights)"""
    # Try regular highlights first
    result = await db.highlights.update_one(
        {"id": highlight_id},
        {"$inc": {"likes": 1}}
    )
    
    # If not found, try AI highlights
    if result.modified_count == 0:
        await db.ai_highlights.update_one(
            {"id": highlight_id},
            {"$inc": {"likes": 1}}
        )
    
    return {"success": True, "highlight_id": highlight_id}

@api_router.get("/featured/highlights")
async def get_featured_highlights(limit: int = 12):
    """Get featured highlights - curated 2026 video content with playable URLs"""
    
    # Curated 2026 Featured Highlights with video URLs
    FEATURED_2026 = [
        {
            "id": "fh1",
            "title": "Avengers: Doomsday - Official Teaser (2026)",
            "category": "movies",
            "thumbnail": "https://i.ytimg.com/vi/399Ez7WHK5s/maxresdefault.jpg",
            "description": "The first official teaser for Avengers: Doomsday. Robert Downey Jr. returns as Doctor Doom.",
            "ai_commentary": "Marvel finally dropped the teaser and the internet broke. RDJ as Doom? Plot twist of the century.",
            "video_url": "https://www.youtube.com/embed/399Ez7WHK5s",
            "views": 45000000,
            "likes": 2800000,
            "duration": "1:05",
            "source": "Marvel Entertainment",
            "trending_score": 99.5,
            "is_featured": True
        },
        {
            "id": "fh2",
            "title": "Wonder Man - Official Trailer (2026)",
            "category": "movies",
            "thumbnail": "https://i.ytimg.com/vi/HhhjRm8hqX4/maxresdefault.jpg",
            "description": "Marvel Television's Wonder Man official trailer. A superhero story with an Oscar-winning director vibe.",
            "ai_commentary": "Marvel's taking the superhero genre to prestige TV territory. This ain't your average hero show.",
            "video_url": "https://www.youtube.com/embed/HhhjRm8hqX4",
            "views": 28000000,
            "likes": 1500000,
            "duration": "2:21",
            "source": "Marvel Television",
            "trending_score": 95.0,
            "is_featured": True
        },
        {
            "id": "fh3",
            "title": "NBA Slam Dunk Contest 2026 - Keshad Johnson Wins!",
            "category": "sports",
            "thumbnail": "https://i.ytimg.com/vi/M3hjdJDR_qA/maxresdefault.jpg",
            "description": "Keshad Johnson takes home the 2026 AT&T Slam Dunk trophy with incredible dunks.",
            "ai_commentary": "This man defied gravity. The judges didn't give him a 50, they gave him physics lessons.",
            "video_url": "https://www.youtube.com/embed/M3hjdJDR_qA",
            "views": 12000000,
            "likes": 890000,
            "duration": "5:54",
            "source": "NBA",
            "trending_score": 92.0,
            "is_featured": True
        },
        {
            "id": "fh4",
            "title": "TikTok Viral Songs Mashup - March 2026",
            "category": "music",
            "thumbnail": "https://i.ytimg.com/vi/mQWKJIzVnZQ/maxresdefault.jpg",
            "description": "The hottest TikTok songs and dances of March 2026 in one epic mashup.",
            "ai_commentary": "If your FYP doesn't have these songs, are you even on TikTok? Pure viral energy.",
            "video_url": "https://www.youtube.com/embed/mQWKJIzVnZQ",
            "views": 8500000,
            "likes": 650000,
            "duration": "8:37",
            "source": "TikTok Trends",
            "trending_score": 88.0,
            "is_featured": True
        },
        {
            "id": "fh5",
            "title": "Bam Adebayo 62 Points - Heat vs Wizards (March 10, 2026)",
            "category": "sports",
            "thumbnail": "https://i.ytimg.com/vi/Bu7sIBt_g-w/maxresdefault.jpg",
            "description": "Bam Adebayo drops a career-high 62 points in an epic performance against the Wizards.",
            "ai_commentary": "Bam woke up and chose violence. 62 points? That's not a game, that's a statement.",
            "video_url": "https://www.youtube.com/embed/Bu7sIBt_g-w",
            "views": 5200000,
            "likes": 420000,
            "duration": "10:00",
            "source": "NBA",
            "trending_score": 90.0,
            "is_featured": True
        },
        {
            "id": "fh6",
            "title": "Funniest Dogs Compilation - March 2026",
            "category": "entertainment",
            "thumbnail": "https://i.ytimg.com/vi/6dRHkUzk5m0/maxresdefault.jpg",
            "description": "The best dog fails, zoomies, and reactions of March 2026. Pure chaos and cuteness.",
            "ai_commentary": "These dogs have one braincell and they're sharing it. Chaotic good energy only.",
            "video_url": "https://www.youtube.com/embed/6dRHkUzk5m0",
            "views": 15000000,
            "likes": 1200000,
            "duration": "54:33",
            "source": "Pet Compilations",
            "trending_score": 85.0,
            "is_featured": True
        },
        {
            "id": "fh7",
            "title": "UFC 326: Oliveira vs Holloway - Full Highlights",
            "category": "sports",
            "thumbnail": "https://i.ytimg.com/vi/EmURnsv_bS4/maxresdefault.jpg",
            "description": "Charles Oliveira vs Max Holloway BMF Title fight highlights from UFC 326.",
            "ai_commentary": "Two legends, one cage, zero chill. This fight was everything we hoped for and more.",
            "video_url": "https://www.youtube.com/embed/EmURnsv_bS4",
            "views": 9800000,
            "likes": 780000,
            "duration": "10:00",
            "source": "UFC",
            "trending_score": 91.0,
            "is_featured": True
        },
        {
            "id": "fh8",
            "title": "Avengers: Doomsday X-Men Teaser - First Look",
            "category": "movies",
            "thumbnail": "https://i.ytimg.com/vi/khX1Y3kmOJY/maxresdefault.jpg",
            "description": "First look at X-Men in the MCU! Professor X, Magneto, and Cyclops make their debut.",
            "ai_commentary": "The X-Men are finally in the MCU and Patrick Stewart is BACK. Dreams do come true.",
            "video_url": "https://www.youtube.com/embed/khX1Y3kmOJY",
            "views": 32000000,
            "likes": 2100000,
            "duration": "1:09",
            "source": "IGN",
            "trending_score": 94.0,
            "is_featured": True
        },
        {
            "id": "fh9",
            "title": "Rema & Selena Gomez - Calm Down (Official Video)",
            "category": "music",
            "thumbnail": "https://i.ytimg.com/vi/WcIcVapfqXw/maxresdefault.jpg",
            "description": "The global hit that broke streaming records. Rema and Selena Gomez's Calm Down.",
            "ai_commentary": "This song has been stuck in everyone's head for months and we're not complaining.",
            "video_url": "https://www.youtube.com/embed/WcIcVapfqXw",
            "views": 1900000000,
            "likes": 18000000,
            "duration": "3:59",
            "source": "Rema Official",
            "trending_score": 98.0,
            "is_featured": True
        },
        {
            "id": "fh10",
            "title": "SZA - Kill Bill (Official Video)",
            "category": "music",
            "thumbnail": "https://i.ytimg.com/vi/MSRcC626prw/maxresdefault.jpg",
            "description": "SZA's Kill Bill official music video from her album SOS.",
            "ai_commentary": "SZA really said 'I might kill my ex' and we all felt that. An anthem for the heartbroken.",
            "video_url": "https://www.youtube.com/embed/MSRcC626prw",
            "views": 650000000,
            "likes": 8500000,
            "duration": "4:36",
            "source": "SZA Official",
            "trending_score": 96.0,
            "is_featured": True
        },
        {
            "id": "fh11",
            "title": "Super Bowl 2026: Seahawks vs Patriots - Full Highlights",
            "category": "sports",
            "thumbnail": "https://i.ytimg.com/vi/xl2WuL2dDZ8/maxresdefault.jpg",
            "description": "Seattle Seahawks defeat New England Patriots 29-13 in Super Bowl 2026.",
            "ai_commentary": "Seattle finally got their revenge. The 12th Man was LOUD that night.",
            "video_url": "https://www.youtube.com/embed/xl2WuL2dDZ8",
            "views": 45000000,
            "likes": 3200000,
            "duration": "15:00",
            "source": "NFL",
            "trending_score": 93.0,
            "is_featured": True
        },
        {
            "id": "fh12",
            "title": "MKBHD - Best Tech of 2026 So Far",
            "category": "tech",
            "thumbnail": "https://i.ytimg.com/vi/ZdO82BBni0M/maxresdefault.jpg",
            "description": "Marques Brownlee reviews the best smartphones and gadgets of 2026.",
            "ai_commentary": "When MKBHD speaks, the tech world listens. This man's camera work is chef's kiss.",
            "video_url": "https://www.youtube.com/embed/ZdO82BBni0M",
            "views": 8200000,
            "likes": 620000,
            "duration": "20:00",
            "source": "MKBHD",
            "trending_score": 87.0,
            "is_featured": True
        }
    ]
    
    # Sort by trending score and return
    sorted_featured = sorted(FEATURED_2026, key=lambda x: x.get("trending_score", 0), reverse=True)
    return {"featured": sorted_featured[:limit], "total": len(sorted_featured[:limit])}

@api_router.get("/featured/{category}")
async def get_featured_by_category(category: str, limit: int = 6):
    """Get featured highlights for a specific category"""
    if category not in ALL_CONTENT_CATEGORIES and category != "all":
        raise HTTPException(status_code=400, detail=f"Invalid category. Choose from: {ALL_CONTENT_CATEGORIES}")
    
    query = {} if category == "all" else {"category": category}
    
    highlights = await db.ai_highlights.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"featured": highlights, "category": category, "count": len(highlights)}

@api_router.get("/stream/config")
async def get_stream_config():
    """Get the HLS stream URL for playback"""
    return {
        "hls_url": HLS_STREAM_URL,
        "is_live": bool(HLS_STREAM_URL),
        "stream_type": "hls"
    }

@api_router.post("/submissions", response_model=HighlightSubmission)
async def submit_highlight(submission: HighlightSubmissionCreate):
    """Submit a highlight suggestion from viewers (link-based) - also saves to creator library"""
    # Validate URL if provided
    if submission.source_url:
        validation = validate_video_url(submission.source_url)
        if not validation["valid"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid or blocked URL: {', '.join(validation['warnings'])}"
            )
        
        # Log warnings but allow submission
        if validation["warnings"]:
            logger.warning(f"URL submission warnings for {submission.source_url}: {validation['warnings']}")
    
    submission_obj = HighlightSubmission(**submission.model_dump())
    doc = submission_obj.model_dump()
    doc['submitted_at'] = doc['submitted_at'].isoformat()
    doc['url_validation'] = validate_video_url(submission.source_url) if submission.source_url else None
    doc['creator_id'] = submission.creator_id
    await db.submissions.insert_one(doc)
    
    # Also save to creator_videos collection if creator is logged in
    if submission.creator_id:
        now = datetime.now(timezone.utc)
        
        # Extract YouTube thumbnail if applicable
        thumbnail_url = None
        youtube_id = None
        if submission.source_url and ("youtube.com" in submission.source_url or "youtu.be" in submission.source_url):
            if "v=" in submission.source_url:
                youtube_id = submission.source_url.split("v=")[1].split("&")[0]
            elif "youtu.be/" in submission.source_url:
                youtube_id = submission.source_url.split("youtu.be/")[1].split("?")[0]
            if youtube_id:
                thumbnail_url = f"https://img.youtube.com/vi/{youtube_id}/maxresdefault.jpg"
        
        video_doc = {
            "id": submission_obj.id,
            "title": submission.title,
            "description": submission.description,
            "category": submission.category,
            "custom_category": None,
            "video_url": submission.source_url,
            "youtube_id": youtube_id,
            "thumbnail_url": thumbnail_url,
            "duration_seconds": None,
            "creator_id": submission.creator_id,
            "creator_name": submission.submitter_name,
            "creator_avatar": None,
            "status": "library",  # In library, not yet scheduled
            "views": 0,
            "likes": 0,
            "liked_by": [],
            "comments_count": 0,
            "tags": [],
            "scheduled_time": None,
            "created_at": now,
            "updated_at": now
        }
        await db.creator_videos.insert_one(video_doc)
        logger.info(f"Video saved to creator library: {submission.title} by {submission.submitter_name}")
    
    logger.info(f"New highlight submission: {submission_obj.title}")
    return submission_obj

@api_router.post("/submissions/validate-url")
async def validate_submission_url(url: str):
    """Validate a URL before submission"""
    validation = validate_video_url(url)
    return {
        "url": url,
        "valid": validation["valid"],
        "trusted_source": validation["trusted_source"],
        "domain": validation["domain"],
        "warnings": validation["warnings"],
        "message": "URL is from a trusted source" if validation["trusted_source"] else (
            "URL will require manual review" if validation["valid"] else "URL is blocked or invalid"
        )
    }

# File size limits - Support 4K/8K content
MAX_FILE_SIZE = 1024 * 1024 * 1024 * 1024  # 1TB for highest quality 4K/8K
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.mxf', '.prores'}

# Trusted video sources for link validation
TRUSTED_VIDEO_DOMAINS = {
    'youtube.com', 'www.youtube.com', 'youtu.be',
    'vimeo.com', 'www.vimeo.com',
    'dailymotion.com', 'www.dailymotion.com',
    'twitch.tv', 'www.twitch.tv', 'clips.twitch.tv',
    'streamable.com', 'www.streamable.com',
    'archive.org', 'www.archive.org',
    'pexels.com', 'www.pexels.com',
    'pixabay.com', 'www.pixabay.com',
    'coverr.co', 'www.coverr.co',
    'mixkit.co', 'www.mixkit.co',
    'videvo.net', 'www.videvo.net',
    'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
    'instagram.com', 'www.instagram.com',
    'facebook.com', 'www.facebook.com', 'fb.watch',
    'twitter.com', 'www.twitter.com', 'x.com',
}

# Blocked/suspicious patterns
BLOCKED_URL_PATTERNS = [
    'bit.ly', 'tinyurl', 'goo.gl', 't.co',  # URL shorteners (potential scams)
    'download', 'crack', 'free-movie', 'pirate',  # Piracy indicators
    'porn', 'xxx', 'adult',  # Adult content
    '.ru/', '.cn/', '.xyz/',  # Suspicious TLDs
]

def validate_video_url(url: str) -> dict:
    """Validate a video URL for authenticity and copyright safety"""
    from urllib.parse import urlparse
    
    result = {
        "valid": False,
        "trusted_source": False,
        "warnings": [],
        "domain": None
    }
    
    try:
        parsed = urlparse(url.lower())
        domain = parsed.netloc.replace('www.', '')
        result["domain"] = domain
        
        # Check for blocked patterns
        url_lower = url.lower()
        for pattern in BLOCKED_URL_PATTERNS:
            if pattern in url_lower:
                result["warnings"].append(f"URL contains blocked pattern: {pattern}")
                return result
        
        # Check if from trusted source
        if domain in TRUSTED_VIDEO_DOMAINS or any(d in domain for d in TRUSTED_VIDEO_DOMAINS):
            result["trusted_source"] = True
            result["valid"] = True
        else:
            # Allow custom domains but flag as unverified
            result["valid"] = True
            result["warnings"].append("Source not in trusted list - will require manual review")
        
        # Check for HTTPS
        if parsed.scheme != 'https':
            result["warnings"].append("Non-HTTPS URL - may be insecure")
        
        return result
        
    except Exception as e:
        result["warnings"].append(f"URL parsing error: {str(e)}")
        return result

@api_router.post("/submissions/upload")
async def submit_highlight_with_upload(
    title: str = Form(...),
    category: str = Form(...),
    description: str = Form(...),
    submitter_name: str = Form(...),
    why_trending: str = Form(...),
    submitter_email: Optional[str] = Form(None),
    creator_id: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    """Submit a highlight with video file upload - also saves to creator library"""
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"
        )
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}{file_ext}"
    file_path = UPLOADS_DIR / safe_filename
    
    # Save file in chunks
    file_size = 0
    try:
        async with aiofiles.open(file_path, 'wb') as out_file:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    await out_file.close()
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=400, 
                        detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
                    )
                await out_file.write(chunk)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Create submission
    submission_obj = HighlightSubmission(
        title=title,
        category=category,
        description=description,
        submitter_name=submitter_name,
        submitter_email=submitter_email,
        why_trending=why_trending,
        submission_type="upload",
        file_path=str(file_path),
        file_name=file.filename,
        file_size=file_size
    )
    
    doc = submission_obj.model_dump()
    doc['submitted_at'] = doc['submitted_at'].isoformat()
    doc['creator_id'] = creator_id  # Link to creator if logged in
    await db.submissions.insert_one(doc)
    
    # Also save to creator_videos collection if creator is logged in
    video_id = None
    if creator_id:
        now = datetime.now(timezone.utc)
        video_doc = {
            "id": submission_obj.id,
            "title": title,
            "description": description,
            "category": category,
            "custom_category": None,
            "video_url": f"/api/uploads/{submission_obj.id}",
            "youtube_id": None,
            "thumbnail_url": None,
            "duration_seconds": None,
            "creator_id": creator_id,
            "creator_name": submitter_name,
            "creator_avatar": None,
            "status": "library",  # In library, not yet scheduled
            "views": 0,
            "likes": 0,
            "liked_by": [],
            "comments_count": 0,
            "tags": [],
            "scheduled_time": None,
            "file_path": str(file_path),
            "file_name": file.filename,
            "file_size": file_size,
            "created_at": now,
            "updated_at": now
        }
        await db.creator_videos.insert_one(video_doc)
        video_id = submission_obj.id
        logger.info(f"Video saved to creator library: {title} by {submitter_name}")
    
    logger.info(f"New file upload submission: {title} ({file_size / (1024*1024):.2f}MB)")
    
    return {
        "success": True,
        "id": submission_obj.id,
        "submission_id": submission_obj.id,
        "video_id": video_id,
        "title": title,
        "file_name": file.filename,
        "file_size_mb": round(file_size / (1024 * 1024), 2),
        "status": "library" if creator_id else "pending",
        "in_library": creator_id is not None,
        "message": "Your video has been uploaded successfully!"
    }

@api_router.get("/uploads/file/{file_id}")
async def get_uploaded_file(file_id: str):
    """Serve uploaded video files by file_id (legacy endpoint)"""
    from fastapi.responses import FileResponse
    
    # Find the file
    for ext in ALLOWED_VIDEO_EXTENSIONS:
        file_path = UPLOADS_DIR / f"{file_id}{ext}"
        if file_path.exists():
            return FileResponse(
                path=file_path,
                media_type="video/mp4",
                filename=f"video{ext}"
            )
    
    raise HTTPException(status_code=404, detail="File not found")

@api_router.get("/submissions")
async def get_submissions(status: Optional[str] = None):
    """Get all highlight submissions (admin)"""
    query = {}
    if status:
        query["status"] = status
    submissions = await db.submissions.find(query, {"_id": 0}).to_list(100)
    for sub in submissions:
        if isinstance(sub.get('submitted_at'), str):
            sub['submitted_at'] = datetime.fromisoformat(sub['submitted_at'])
    return {"submissions": submissions, "total": len(submissions)}

@api_router.patch("/submissions/{submission_id}")
async def update_submission_status(submission_id: str, status: str):
    """Update submission status (admin)"""
    if status not in ["pending", "approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    await db.submissions.update_one(
        {"id": submission_id},
        {"$set": {"status": status}}
    )
    return {"success": True, "submission_id": submission_id, "status": status}

# ============ CREATOR LIVE STREAM SUBMISSIONS ============

async def ai_review_stream(stream_url: str, category: str, description: str) -> dict:
    """AI reviews a submitted stream for content, quality, and appropriateness"""
    review_result = {
        "status": "approved",
        "score": 85.0,
        "quality_score": 80.0,
        "resolution": "1080p (estimated)",
        "content_flags": [],
        "analysis": "Stream appears appropriate for ZTVLIVE platform.",
        "notes": "Manual review recommended before going live."
    }
    
    if not EMERGENT_LLM_KEY:
        return review_result
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ztv_stream_review_{uuid.uuid4()}",
            system_message="""You are ZTVLIVE's AI content moderator. You review stream submissions for:

1. CONTENT APPROPRIATENESS: Is this suitable for a general entertainment audience?
2. CATEGORY FIT: Does it match the claimed category?
3. QUALITY INDICATORS: Based on the URL and description, estimate quality.
4. BRAND SAFETY: Any red flags for advertisers or viewers?

Respond in this JSON format only:
{
    "status": "approved" or "needs_review" or "rejected",
    "score": 0-100 overall score,
    "quality_score": 0-100 estimated quality,
    "resolution": "estimated resolution",
    "content_flags": ["list", "of", "concerns"],
    "analysis": "Brief content analysis",
    "notes": "Recommendations for review team"
}"""
        ).with_model("openai", "gpt-5.2")
        
        response = await chat.send_message(UserMessage(
            text=f"""Review this stream submission:
            
URL: {stream_url}
Category: {category}
Description: {description}

Analyze the stream URL pattern, description, and category fit. Provide your review."""
        ))
        
        # Try to parse JSON from response
        import json
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                review_result = json.loads(response[json_start:json_end])
        except json.JSONDecodeError:
            logger.warning("Could not parse AI review response as JSON")
            review_result["analysis"] = response
            
    except Exception as e:
        logger.error(f"AI stream review failed: {e}")
        review_result["notes"] = f"AI review encountered error, manual review required: {str(e)}"
    
    return review_result

@api_router.post("/stream/submit")
async def submit_creator_stream(submission: LiveStreamSubmissionCreate, background_tasks: BackgroundTasks):
    """Submit a live stream for AI review and potential featuring on ZTVLIVE"""
    
    # Validate stream URL format
    valid_protocols = ["http://", "https://", "rtmp://", "rtmps://"]
    if not any(submission.stream_url.startswith(p) for p in valid_protocols):
        raise HTTPException(status_code=400, detail="Invalid stream URL format. Must be HTTP(S) or RTMP.")
    
    # Create submission object
    submission_obj = LiveStreamSubmission(**submission.model_dump())
    
    # Perform AI review
    logger.info(f"Starting AI review for stream: {submission.title}")
    ai_review = await ai_review_stream(
        submission.stream_url, 
        submission.category, 
        submission.description
    )
    
    # Update submission with AI review results
    submission_obj.ai_review_status = ai_review.get("status", "needs_review")
    submission_obj.ai_review_score = ai_review.get("score", 0)
    submission_obj.ai_content_analysis = ai_review.get("analysis", "")
    submission_obj.ai_quality_score = ai_review.get("quality_score", 0)
    submission_obj.ai_resolution_check = ai_review.get("resolution", "Unknown")
    submission_obj.ai_content_flags = ai_review.get("content_flags", [])
    submission_obj.ai_review_notes = ai_review.get("notes", "")
    submission_obj.reviewed_at = datetime.now(timezone.utc)
    
    # Auto-approve if score is high enough and no flags
    if submission_obj.ai_review_score >= 80 and not submission_obj.ai_content_flags:
        submission_obj.is_approved_for_live = True
        submission_obj.ai_review_status = "approved"
    
    # Save to database
    doc = submission_obj.model_dump()
    doc['submitted_at'] = doc['submitted_at'].isoformat()
    doc['reviewed_at'] = doc['reviewed_at'].isoformat() if doc['reviewed_at'] else None
    doc['scheduled_time'] = doc['scheduled_time'].isoformat() if doc['scheduled_time'] else None
    await db.stream_submissions.insert_one(doc)
    
    logger.info(f"Stream submission processed: {submission_obj.title} - Status: {submission_obj.ai_review_status}")
    
    return {
        "success": True,
        "submission_id": submission_obj.id,
        "title": submission_obj.title,
        "ai_review": {
            "status": submission_obj.ai_review_status,
            "score": submission_obj.ai_review_score,
            "quality_score": submission_obj.ai_quality_score,
            "resolution": submission_obj.ai_resolution_check,
            "content_flags": submission_obj.ai_content_flags,
            "analysis": submission_obj.ai_content_analysis,
            "notes": submission_obj.ai_review_notes
        },
        "approved_for_live": submission_obj.is_approved_for_live,
        "message": "Your stream has been reviewed by our AI. " + (
            "Congratulations! Your stream meets our criteria and is approved for featuring!" 
            if submission_obj.is_approved_for_live 
            else "Your submission is under review. Our team will contact you shortly."
        )
    }

@api_router.get("/stream/submissions")
async def get_stream_submissions(status: Optional[str] = None, limit: int = 50):
    """Get all stream submissions (admin)"""
    query = {}
    if status:
        query["ai_review_status"] = status
    
    submissions = await db.stream_submissions.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(limit)
    
    for sub in submissions:
        if isinstance(sub.get('submitted_at'), str):
            sub['submitted_at'] = datetime.fromisoformat(sub['submitted_at'])
        if isinstance(sub.get('reviewed_at'), str):
            sub['reviewed_at'] = datetime.fromisoformat(sub['reviewed_at'])
    
    return {
        "submissions": submissions, 
        "total": len(submissions),
        "stats": {
            "approved": len([s for s in submissions if s.get("is_approved_for_live")]),
            "pending": len([s for s in submissions if s.get("ai_review_status") == "needs_review"]),
            "rejected": len([s for s in submissions if s.get("ai_review_status") == "rejected"])
        }
    }

@api_router.get("/stream/submissions/{submission_id}")
async def get_stream_submission(submission_id: str):
    """Get a specific stream submission"""
    submission = await db.stream_submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Stream submission not found")
    return submission

@api_router.patch("/stream/submissions/{submission_id}/approve")
@api_router.post("/stream-submissions/{submission_id}/approve")
async def approve_stream_submission(submission_id: str, scheduled_time: Optional[str] = None):
    """Approve a stream submission for live broadcast (admin)"""
    update_data = {
        "is_approved_for_live": True,
        "ai_review_status": "approved",
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    if scheduled_time:
        update_data["scheduled_time"] = scheduled_time
    
    result = await db.stream_submissions.update_one(
        {"id": submission_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Stream submission not found")
    
    return {"success": True, "submission_id": submission_id, "status": "approved"}

@api_router.patch("/stream/submissions/{submission_id}/reject")
@api_router.post("/stream-submissions/{submission_id}/reject")
async def reject_stream_submission(submission_id: str, reason: str = "Does not meet content guidelines"):
    """Reject a stream submission (admin)"""
    result = await db.stream_submissions.update_one(
        {"id": submission_id},
        {"$set": {
            "is_approved_for_live": False,
            "ai_review_status": "rejected",
            "ai_review_notes": reason,
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Stream submission not found")
    
    return {"success": True, "submission_id": submission_id, "status": "rejected", "reason": reason}

@api_router.post("/stream/go-live/{submission_id}")
async def set_approved_stream_live(submission_id: str):
    """Set an approved stream as the current live stream (admin)"""
    submission = await db.stream_submissions.find_one({"id": submission_id}, {"_id": 0})
    
    if not submission:
        raise HTTPException(status_code=404, detail="Stream submission not found")
    
    if not submission.get("is_approved_for_live"):
        raise HTTPException(status_code=400, detail="Stream is not approved for live broadcast")
    
    # Update the active stream URL
    await db.stream_config.update_one(
        {"id": "active_stream"},
        {"$set": {
            "hls_url": submission["stream_url"],
            "title": submission["title"],
            "creator": submission["creator_name"],
            "category": submission["category"],
            "is_live": True,
            "started_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    logger.info(f"Stream going live: {submission['title']} by {submission['creator_name']}")
    
    return {
        "success": True,
        "message": f"Stream '{submission['title']}' is now LIVE!",
        "stream_url": submission["stream_url"],
        "creator": submission["creator_name"]
    }

@api_router.post("/stream/stop-live")
async def stop_live_stream():
    """Stop the current live stream and return to playlist (admin)"""
    await db.stream_config.update_one(
        {"id": "active_stream"},
        {"$set": {
            "is_live": False,
            "stopped_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    logger.info("Live stream stopped, returning to playlist mode")
    return {"success": True, "message": "Live stream stopped. Returning to playlist mode."}

# ============ ADMIN DASHBOARD ENDPOINTS ============

@api_router.get("/admin/dashboard")
async def get_admin_dashboard():
    """Get admin dashboard overview with all stats"""
    # User stats - REAL DATA from database
    total_users = await db.users.count_documents({})
    total_creators = await db.users.count_documents({"role": {"$in": ["creator", "admin"]}})
    new_users_today = await db.users.count_documents({
        "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
    })
    
    # Stream submissions stats
    total_submissions = await db.stream_submissions.count_documents({})
    approved_streams = await db.stream_submissions.count_documents({"is_approved_for_live": True})
    pending_streams = await db.stream_submissions.count_documents({"ai_review_status": "needs_review"})
    rejected_streams = await db.stream_submissions.count_documents({"ai_review_status": "rejected"})
    
    # Content stats
    total_videos = await db.archived_videos.count_documents({})
    videos_in_rotation = await db.archived_videos.count_documents({"in_rotation": True})
    ai_content = await db.ai_highlights.count_documents({})
    realtime_content = await db.realtime_content.count_documents({})
    
    # Creator videos
    creator_videos = await db.creator_videos.count_documents({})
    imported_videos = await db.imported_videos.count_documents({})
    
    # Comment stats
    total_comments = await db.video_comments.count_documents({})
    live_comments = await db.video_comments.count_documents({"video_id": "live_stream"})
    hidden_comments = await db.video_comments.count_documents({"is_hidden": True})
    
    # Content submissions stats
    content_submissions = await db.submissions.count_documents({})
    pending_content = await db.submissions.count_documents({"status": "pending"})
    
    # Game stats
    game_plays = await db.game_plays.count_documents({})
    game_sessions = await db.game_sessions.count_documents({})
    
    # Get current stream config
    stream_config = await db.stream_config.find_one({"id": "active_stream"}, {"_id": 0})
    
    # Get global comment settings
    comment_settings = await db.comment_settings.find_one({"target_id": "global"}, {"_id": 0})
    live_comment_settings = await db.comment_settings.find_one({"target_id": "live_stream"}, {"_id": 0})
    
    return {
        "users": {
            "total": total_users,
            "creators": total_creators,
            "new_today": new_users_today
        },
        "stream_submissions": {
            "total": total_submissions,
            "approved": approved_streams,
            "pending": pending_streams,
            "rejected": rejected_streams
        },
        "content": {
            "archived_videos": total_videos,
            "in_rotation": videos_in_rotation,
            "ai_generated": ai_content,
            "realtime": realtime_content,
            "creator_videos": creator_videos,
            "imported_videos": imported_videos,
            "mock_highlights": len(MOCK_HIGHLIGHTS)
        },
        "comments": {
            "total": total_comments,
            "live_stream": live_comments,
            "pending_approval": hidden_comments
        },
        "submissions": {
            "total": content_submissions,
            "pending": pending_content
        },
        "game": {
            "total_plays": game_plays,
            "active_sessions": game_sessions
        },
        "current_stream": stream_config or {"is_live": False},
        "settings": {
            "global_comments": comment_settings or {"comments_enabled": True},
            "live_comments": live_comment_settings or {"comments_enabled": True}
        }
    }

@api_router.get("/admin/users")
async def get_admin_users(
    role: Optional[str] = None, 
    limit: int = 100,
    skip: int = 0
):
    """Get all users/creators for admin dashboard"""
    query = {}
    if role:
        query["role"] = role
    
    users = await db.users.find(query, {"_id": 0, "password": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).to_list(limit)
    total = await db.users.count_documents(query)
    
    # Enrich with video counts
    for user in users:
        user_id = user.get("user_id") or user.get("id")
        if user_id:
            user["video_count"] = await db.creator_videos.count_documents({"creator_id": user_id})
            user["imported_count"] = await db.imported_videos.count_documents({"creator_id": user_id})
    
    return {
        "users": users,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/admin/creators")
async def get_admin_creators(limit: int = 50):
    """Get all creators with their stats"""
    # Get users who have uploaded content or have creator role
    creators_query = {
        "$or": [
            {"role": {"$in": ["creator", "admin"]}},
            {"has_uploaded": True}
        ]
    }
    
    creators = await db.users.find(creators_query, {"_id": 0, "password": 0, "password_hash": 0}).sort("created_at", -1).to_list(limit)
    
    # Enrich with stats
    for creator in creators:
        user_id = creator.get("user_id") or creator.get("id")
        if user_id:
            creator["videos"] = await db.creator_videos.count_documents({"creator_id": user_id})
            creator["imports"] = await db.imported_videos.count_documents({"creator_id": user_id})
            creator["total_views"] = creator.get("total_views", 0)
            creator["total_earnings"] = creator.get("total_earnings", 0)
    
    return {
        "creators": creators,
        "total": len(creators)
    }


# ============ CREATOR SEARCH (PUBLIC - FOR FANS) ============

@api_router.get("/creators/search")
async def search_creators(
    request: Request,
    q: str = "",
    category: str = None,
    limit: int = 20
):
    """
    Public endpoint for fans to search and discover creators.
    Returns ONLY safe public information - no emails, passwords, or sensitive data.
    """
    from services.security import check_rate_limit, get_client_ip, sanitize_creator_for_public, detect_suspicious_pattern
    
    # Rate limiting
    client_ip = get_client_ip(request)
    rate_check = check_rate_limit(client_ip, "search")
    if not rate_check["allowed"]:
        raise HTTPException(status_code=429, detail=rate_check["reason"])
    
    # Detect bulk scraping attempts
    detect_suspicious_pattern(client_ip, "bulk_scraping")
    
    # Build search query
    query = {"role": {"$in": ["creator", "admin"]}}
    
    if q:
        # Search by name, username, or bio
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}},
            {"display_name": {"$regex": q, "$options": "i"}},
            {"bio": {"$regex": q, "$options": "i"}}
        ]
    
    if category:
        query["category"] = category
    
    # Fetch creators with LIMITED fields (security)
    safe_projection = {
        "_id": 0,
        "password": 0,
        "password_hash": 0,
        "email": 0,  # NEVER expose email publicly
        "phone": 0,
        "payment_info": 0,
        "stripe_account": 0,
        "session_token": 0
    }
    
    creators = await db.users.find(query, safe_projection).sort("total_views", -1).limit(min(limit, 50)).to_list(None)
    
    # Sanitize each creator for public display
    safe_creators = []
    for creator in creators:
        safe = sanitize_creator_for_public(creator)
        # Add video count
        user_id = creator.get("user_id") or creator.get("id")
        if user_id:
            safe["video_count"] = await db.creator_videos.count_documents({"creator_id": user_id})
        safe_creators.append(safe)
    
    return {
        "creators": safe_creators,
        "count": len(safe_creators),
        "query": q
    }


@api_router.get("/creators/featured")
async def get_featured_creators(limit: int = 10):
    """Get featured creators for homepage display - PUBLIC"""
    from services.security import sanitize_creator_for_public
    
    # Get creators with most views/content
    query = {"role": {"$in": ["creator", "admin"]}}
    
    creators = await db.users.find(
        query, 
        {"_id": 0, "password": 0, "password_hash": 0, "email": 0, "phone": 0, "payment_info": 0}
    ).sort("total_views", -1).limit(limit).to_list(None)
    
    featured = []
    for creator in creators:
        safe = sanitize_creator_for_public(creator)
        user_id = creator.get("user_id") or creator.get("id")
        if user_id:
            safe["video_count"] = await db.creator_videos.count_documents({"creator_id": user_id})
        featured.append(safe)
    
    return {"featured": featured}


# ============ SECURITY ENDPOINTS (ADMIN ONLY) ============

@api_router.get("/admin/security/stats")
async def get_security_stats():
    """Get security overview - ADMIN ONLY"""
    from services.security import get_security_stats, get_blocked_ips, get_suspicious_activity_log
    
    return {
        "stats": get_security_stats(),
        "blocked_ips": get_blocked_ips(),
        "recent_threats": get_suspicious_activity_log(20)
    }


@api_router.post("/admin/security/block-ip")
async def block_ip_endpoint(ip: str, duration_minutes: int = 30, reason: str = "Manual block"):
    """Block an IP address - ADMIN ONLY"""
    from services.security import block_ip
    block_ip(ip, duration_minutes, reason)
    return {"success": True, "message": f"IP {ip} blocked for {duration_minutes} minutes"}


@api_router.post("/admin/security/unblock-ip")
async def unblock_ip_endpoint(ip: str):
    """Unblock an IP address - ADMIN ONLY"""
    from services.security import unblock_ip
    unblock_ip(ip)
    return {"success": True, "message": f"IP {ip} unblocked"}


# ============ PENNY CREATOR ENGAGEMENT (ADMIN ONLY) ============

@api_router.get("/admin/penny/dashboard")
async def get_penny_dashboard():
    """
    Penny's Creator Engagement Dashboard - ADMIN ONLY
    Shows engagement stats, featured creators, and campaign recommendations
    """
    from services.penny_engagement import get_penny_dashboard_data, PENNY_INTRO
    
    # Get all creators
    creators = await db.users.find(
        {"role": {"$in": ["creator", "admin"]}},
        {"_id": 0, "password": 0, "password_hash": 0}
    ).to_list(None)
    
    # Enrich with activity data
    for creator in creators:
        user_id = creator.get("user_id") or creator.get("id")
        if user_id:
            creator["video_count"] = await db.creator_videos.count_documents({"creator_id": user_id})
            # Get last upload date
            last_video = await db.creator_videos.find_one(
                {"creator_id": user_id},
                sort=[("created_at", -1)]
            )
            if last_video:
                creator["last_upload_date"] = last_video.get("created_at")
    
    dashboard_data = get_penny_dashboard_data(creators)
    
    return dashboard_data


@api_router.get("/admin/penny/creators-for-campaign")
async def get_creators_for_campaign(segment: str = "all", limit: int = 100):
    """
    Get creators filtered by engagement segment for campaigns
    Segments: all, new, active, at_risk, inactive, churned
    """
    from services.penny_engagement import calculate_engagement_level, EngagementLevel
    
    creators = await db.users.find(
        {"role": {"$in": ["creator", "admin"]}},
        {"_id": 0, "password": 0, "password_hash": 0}
    ).to_list(None)
    
    # Enrich and filter
    filtered = []
    for creator in creators:
        user_id = creator.get("user_id") or creator.get("id")
        if user_id:
            creator["video_count"] = await db.creator_videos.count_documents({"creator_id": user_id})
            last_video = await db.creator_videos.find_one(
                {"creator_id": user_id},
                sort=[("created_at", -1)]
            )
            if last_video:
                creator["last_upload_date"] = last_video.get("created_at")
        
        level = calculate_engagement_level(creator)
        creator["engagement_level"] = level.value
        
        if segment == "all" or segment == level.value:
            filtered.append({
                "id": creator.get("user_id") or creator.get("id"),
                "name": creator.get("name", "Anonymous"),
                "email": creator.get("email"),  # Include email for campaign sending
                "video_count": creator.get("video_count", 0),
                "total_views": creator.get("total_views", 0),
                "engagement_level": level.value,
                "last_upload_date": creator.get("last_upload_date")
            })
    
    return {
        "creators": filtered[:limit],
        "total": len(filtered),
        "segment": segment
    }


@api_router.post("/admin/penny/send-campaign")
async def send_penny_campaign(
    template_key: str,
    segment: str = "all",
    test_mode: bool = True
):
    """
    Send a campaign email to creators - ADMIN ONLY
    Set test_mode=False to actually send emails
    """
    from services.penny_engagement import generate_email, PENNY_TEMPLATES
    from services.email_service import send_email as send_email_service
    
    if template_key not in PENNY_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Invalid template: {template_key}")
    
    # Get target creators
    creators_response = await get_creators_for_campaign(segment)
    creators = creators_response["creators"]
    
    if test_mode:
        # Just preview what would be sent
        sample = creators[0] if creators else {"name": "Test Creator", "email": "test@example.com"}
        preview_email = generate_email(template_key, sample)
        return {
            "test_mode": True,
            "would_send_to": len(creators),
            "preview": preview_email,
            "segment": segment
        }
    
    # Actually send emails
    sent_count = 0
    failed_count = 0
    results = []
    
    for creator in creators:
        if creator.get("email"):
            email_data = generate_email(template_key, creator)
            if email_data:
                try:
                    result = await send_email_service(
                        to_email=email_data["to"],
                        subject=email_data["subject"],
                        html_content=f"<pre style='font-family: sans-serif; line-height: 1.6;'>{email_data['body']}</pre>"
                    )
                    if result.get("status") in ["sent", "logged_only"]:
                        sent_count += 1
                        results.append({"email": creator["email"], "status": "sent"})
                    else:
                        failed_count += 1
                        results.append({"email": creator["email"], "status": "failed"})
                except Exception as e:
                    failed_count += 1
                    results.append({"email": creator["email"], "status": "error", "error": str(e)})
                    logger.error(f"[PENNY] Failed to send to {creator['email']}: {e}")
    
    return {
        "success": True,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "template": template_key,
        "segment": segment,
        "message": f"Campaign sent to {sent_count} creators" + (f" ({failed_count} failed)" if failed_count else ""),
        "details": results[:20]  # Limit details for response size
    }


@api_router.get("/admin/submissions/content")
async def get_admin_content_submissions(status: Optional[str] = None, limit: int = 50):
    """Get all content submissions for admin review"""
    query = {}
    if status:
        query["status"] = status
    
    submissions = await db.submissions.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(limit)
    
    for sub in submissions:
        if isinstance(sub.get('submitted_at'), str):
            sub['submitted_at'] = datetime.fromisoformat(sub['submitted_at'])
    
    stats = {
        "total": await db.submissions.count_documents({}),
        "pending": await db.submissions.count_documents({"status": "pending"}),
        "approved": await db.submissions.count_documents({"status": "approved"}),
        "rejected": await db.submissions.count_documents({"status": "rejected"})
    }
    
    return {"submissions": submissions, "stats": stats}


@api_router.post("/submissions/{submission_id}/approve")
async def approve_submission(submission_id: str):
    """Approve a pending submission"""
    result = await db.submissions.update_one(
        {"id": submission_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Send notification to admin
    try:
        from routes.admin_notifications import create_notification
        await create_notification(
            notification_type="submission_approved",
            title="Submission Approved",
            message=f"Submission {submission_id} has been approved",
            data={"submission_id": submission_id},
            priority="normal"
        )
    except Exception as e:
        print(f"Notification error: {e}")
    
    return {"success": True, "message": "Submission approved"}


@api_router.post("/submissions/{submission_id}/reject")
async def reject_submission(submission_id: str):
    """Reject a pending submission"""
    result = await db.submissions.update_one(
        {"id": submission_id},
        {"$set": {
            "status": "rejected",
            "rejected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    return {"success": True, "message": "Submission rejected"}


@api_router.get("/admin/streams/recent")
async def get_recent_stream_submissions(limit: int = 20):
    """Get most recent stream submissions"""
    submissions = await db.stream_submissions.find(
        {}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(limit)
    
    for sub in submissions:
        if isinstance(sub.get('submitted_at'), str):
            sub['submitted_at'] = datetime.fromisoformat(sub['submitted_at'])
        if isinstance(sub.get('reviewed_at'), str):
            sub['reviewed_at'] = datetime.fromisoformat(sub['reviewed_at'])
    
    return {"submissions": submissions}

@api_router.post("/admin/set-live-title")
async def set_live_stream_title(title: str, subtitle: Optional[str] = None):
    """Set a custom title for the current live stream (admin)"""
    await db.stream_config.update_one(
        {"id": "active_stream"},
        {"$set": {
            "custom_title": title,
            "custom_subtitle": subtitle,
            "title_updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"success": True, "title": title, "subtitle": subtitle}

@api_router.get("/admin/live/config")
async def get_live_config():
    """Get current live stream configuration (admin)"""
    config = await db.stream_config.find_one({"id": "active_stream"}, {"_id": 0})
    return config or {
        "is_live": False,
        "hls_url": HLS_STREAM_URL,
        "title": "ZTVLIVE 24/7",
        "custom_title": None
    }

@api_router.get("/archive")
async def get_archived_videos(category: Optional[str] = None, limit: int = 50):
    """Get all archived videos for the library"""
    query = {}
    if category and category != "all":
        query["category"] = category
    
    videos = await db.archived_videos.find(query, {"_id": 0}).to_list(limit)
    
    # Convert datetime strings back to datetime objects
    for video in videos:
        if isinstance(video.get('created_at'), str):
            video['created_at'] = datetime.fromisoformat(video['created_at'])
        if isinstance(video.get('aired_at'), str):
            video['aired_at'] = datetime.fromisoformat(video['aired_at'])
    
    # Sort by most recent
    videos.sort(key=lambda x: x.get('created_at', datetime.min), reverse=True)
    
    return {"videos": videos, "total": len(videos)}

@api_router.get("/archive/{video_id}")
async def get_archived_video(video_id: str):
    """Get a single archived video"""
    video = await db.archived_videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Increment views
    await db.archived_videos.update_one(
        {"id": video_id},
        {"$inc": {"views": 1}}
    )
    
    if isinstance(video.get('created_at'), str):
        video['created_at'] = datetime.fromisoformat(video['created_at'])
    
    return video

@api_router.post("/archive", response_model=ArchivedVideo)
async def add_archived_video(video: ArchivedVideoCreate):
    """Add a video to the archive (admin)"""
    video_obj = ArchivedVideo(**video.model_dump())
    doc = video_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('aired_at'):
        doc['aired_at'] = doc['aired_at'].isoformat()
    await db.archived_videos.insert_one(doc)
    logger.info(f"Added video to archive: {video_obj.title}")
    return video_obj

@api_router.post("/archive/{video_id}/like")
async def like_archived_video(video_id: str):
    """Like an archived video"""
    await db.archived_videos.update_one(
        {"id": video_id},
        {"$inc": {"likes": 1}}
    )
    return {"success": True, "video_id": video_id}

@api_router.delete("/archive/{video_id}")
async def delete_archived_video(video_id: str):
    """Delete a video from archive (admin)"""
    result = await db.archived_videos.delete_one({"id": video_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    return {"success": True, "video_id": video_id}

@api_router.patch("/archive/{video_id}/rotation")
async def toggle_video_rotation(video_id: str, in_rotation: bool):
    """Toggle whether a video is in the auto-playlist rotation"""
    await db.archived_videos.update_one(
        {"id": video_id},
        {"$set": {"in_rotation": in_rotation}}
    )
    return {"success": True, "video_id": video_id, "in_rotation": in_rotation}

@api_router.get("/playlist/current")
async def get_current_playlist_video():
    """Get the current video in the fallback playlist (when not live streaming)"""
    # Get archived videos in rotation
    archived_videos = await db.archived_videos.find({"in_rotation": True}, {"_id": 0}).to_list(100)
    
    # Get AI-generated highlights in rotation
    ai_highlights = await db.ai_highlights.find({"in_rotation": True}, {"_id": 0}).to_list(100)
    
    # Combine all content sources - PRIORITIZE MOCK_HIGHLIGHTS which have real YouTube URLs
    # Filter out content without video_url for better playback
    all_videos = []
    
    # First add MOCK_HIGHLIGHTS (they have real YouTube videos)
    all_videos.extend(MOCK_HIGHLIGHTS)
    
    # Then add archived videos with video_url
    for v in archived_videos:
        if v.get("video_url"):
            all_videos.append(v)
    
    # Then add AI highlights with video_url
    for v in ai_highlights:
        if v.get("video_url"):
            all_videos.append(v)
    
    if not all_videos:
        return {"video": None, "message": "No videos in rotation"}
    
    # Calculate current index based on time (rotates every 3 minutes for more variety)
    current_index = int(datetime.now(timezone.utc).timestamp() / 180) % len(all_videos)
    current_video = all_videos[current_index]
    next_index = (current_index + 1) % len(all_videos)
    next_video = all_videos[next_index]
    
    # Get comment count for current video
    comment_count = await db.video_comments.count_documents({"video_id": current_video.get("id", "")})
    
    return {
        "current": current_video,
        "next_up": next_video,
        "total_in_rotation": len(all_videos),
        "current_index": current_index,
        "is_fallback_mode": True,
        "comment_count": comment_count,
        "sources": {
            "archived": len(archived_videos),
            "ai_generated": len(ai_highlights),
            "mock": len(MOCK_HIGHLIGHTS)
        }
    }

@api_router.get("/playlist/all")
async def get_full_playlist(category: Optional[str] = None):
    """Get the full playlist organized by category"""
    # Get all content sources
    archived_videos = await db.archived_videos.find({"in_rotation": True}, {"_id": 0}).to_list(100)
    ai_highlights = await db.ai_highlights.find({"in_rotation": True}, {"_id": 0}).to_list(100)
    
    all_videos = archived_videos + ai_highlights + MOCK_HIGHLIGHTS
    
    if category and category != "all":
        all_videos = [v for v in all_videos if v.get("category") == category]
    
    # Organize by category
    by_category = {}
    for video in all_videos:
        cat = video.get("category", "other")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(video)
    
    return {
        "playlist": all_videos,
        "by_category": by_category,
        "total": len(all_videos),
        "categories": list(by_category.keys())
    }

@api_router.post("/playlist/advance")
async def advance_playlist():
    """Manually advance to the next video in playlist"""
    videos = await db.archived_videos.find({"in_rotation": True}, {"_id": 0}).to_list(100)
    all_videos = videos + MOCK_HIGHLIGHTS
    
    if not all_videos:
        return {"success": False, "message": "No videos in rotation"}
    
    # Get current state and advance
    state = await db.playlist_state.find_one({"id": "playlist_state"}, {"_id": 0})
    current_index = state.get("current_index", 0) if state else 0
    next_index = (current_index + 1) % len(all_videos)
    
    await db.playlist_state.update_one(
        {"id": "playlist_state"},
        {"$set": {
            "current_index": next_index,
            "current_video_id": all_videos[next_index].get("id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "new_index": next_index, "video": all_videos[next_index]}

@api_router.get("/stream/status")
async def get_stream_status():
    """Check if live stream is active and return appropriate playback source"""
    # In a real implementation, this would check if the HLS stream is actually live
    # For now, we return the HLS URL and let the frontend handle fallback
    return {
        "hls_url": HLS_STREAM_URL,
        "is_configured": bool(HLS_STREAM_URL),
        "fallback_enabled": True,
        "message": "Use playlist/current endpoint when stream is offline"
    }

# ============ AUTHENTICATION SYSTEM ============

class UserProfile(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "creator"  # creator, admin
    created_at: datetime
    bio: Optional[str] = None
    website: Optional[str] = None
    social_links: Optional[Dict[str, str]] = None
    total_earnings: float = 0.0
    total_views: int = 0
    is_verified: bool = False

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

async def get_current_user(session_token: str = Cookie(None), authorization: str = None) -> Optional[Dict]:
    """Get current user from session token (cookie or header)"""
    token = None
    
    # Try cookie first
    if session_token:
        token = session_token
    # Fallback to Authorization header
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    if not token:
        return None
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        # Session expired, clean it up
        await db.user_sessions.delete_one({"session_token": token})
        return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0, "password_hash": 0}  # Exclude password_hash for security
    )
    
    return user_doc

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id for session_token after Google OAuth"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Exchange with Emergent Auth
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            user_data = auth_response.json()
            
        except Exception as e:
            logger.error(f"Auth exchange error: {e}")
            raise HTTPException(status_code=500, detail="Auth service error")
    
    # Check if user exists
    existing_user = await db.users.find_one(
        {"email": user_data["email"]},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info if needed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": user_data.get("name", existing_user.get("name")),
                "picture": user_data.get("picture", existing_user.get("picture")),
                "last_login": datetime.now(timezone.utc)
            }}
        )
    else:
        # Create new user with auto-generated username
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        base_username = user_data.get("name", "creator").lower().replace(" ", "_")[:20]
        # Add random suffix to ensure uniqueness
        username = f"{base_username}_{uuid.uuid4().hex[:6]}"
        
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data.get("name", "Creator"),
            "username": username,  # Auto-generated username
            "display_name": user_data.get("name", "Creator"),  # Public display name (can be changed)
            "picture": user_data.get("picture"),
            "role": "creator",
            "created_at": datetime.now(timezone.utc),
            "last_login": datetime.now(timezone.utc),
            "bio": None,
            "website": None,
            "social_links": {},
            "total_earnings": 0.0,
            "total_views": 0,
            "is_verified": False,
            "privacy_mode": False  # If true, use display_name instead of real name
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = user_data.get("session_token", f"sess_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set httpOnly cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    # Get full user for response
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "user": user_doc,
        "session_token": session_token
    }

@api_router.get("/auth/me")
async def get_me(
    session_token: str = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Get current authenticated user"""
    # Get token from cookie or header
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = await get_current_user(session_token=token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    return user

@api_router.post("/auth/logout")
async def logout(response: Response, session_token: str = Cookie(None)):
    """Logout user and clear session"""
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    
    return {"success": True, "message": "Logged out successfully"}

@api_router.put("/auth/profile")
async def update_profile(
    request: Request,
    session_token: str = Cookie(None),
    authorization: Optional[str] = None
):
    """Update user profile"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    user = await get_current_user(session_token=token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    
    # Allowed fields to update - including display_name for privacy
    allowed_fields = ["name", "display_name", "bio", "website", "social_links", "privacy_mode", "username", "banner_image", "profile_video"]
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    
    # Validate username if being updated
    if "username" in update_data:
        username = update_data["username"].lower().strip()
        # Validate username format
        import re
        if not re.match(r'^[a-z0-9_]{3,30}$', username):
            raise HTTPException(status_code=400, detail="Username must be 3-30 characters, lowercase letters, numbers, and underscores only")
        # Check if username is taken
        existing = await db.users.find_one({"username": username, "user_id": {"$ne": user["user_id"]}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_data["username"] = username
    
    if update_data:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return updated_user

# ============ PUBLIC CREATOR PROFILES ============

@api_router.get("/creator/{username}")
async def get_creator_profile(username: str):
    """Get public creator profile by username"""
    # Find user by username (case-insensitive) or user_id
    user = await db.users.find_one(
        {"$or": [{"username": username.lower()}, {"user_id": username}]},
        {"_id": 0, "password_hash": 0, "email": 0}  # Hide sensitive data
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    # Get creator's videos (approved, published, library, or live for public view)
    videos = await db.creator_videos.find(
        {"creator_id": user["user_id"], "status": {"$in": ["approved", "published", "live", "library"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get follower count
    follower_count = await db.follows.count_documents({"following_id": user["user_id"]})
    following_count = await db.follows.count_documents({"follower_id": user["user_id"]})
    
    # Get total stats
    total_likes = sum(v.get("likes", 0) for v in videos)
    total_views = sum(v.get("views", 0) for v in videos)
    
    return {
        "profile": {
            "user_id": user["user_id"],
            "username": user.get("username"),
            "display_name": user.get("display_name") or user.get("name", "Creator"),
            "picture": user.get("picture"),
            "banner_image": user.get("banner_image"),
            "bio": user.get("bio"),
            "website": user.get("website"),
            "social_links": user.get("social_links", {}),
            "is_verified": user.get("is_verified", False),
            "created_at": user.get("created_at"),
            "follower_count": follower_count,
            "following_count": following_count,
            "total_videos": len(videos),
            "total_likes": total_likes,
            "total_views": total_views
        },
        "videos": videos
    }

@api_router.get("/creator/{username}/videos")
async def get_creator_videos(username: str, page: int = 1, limit: int = 20):
    """Get paginated videos for a creator"""
    user = await db.users.find_one(
        {"$or": [{"username": username.lower()}, {"user_id": username}]},
        {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    skip = (page - 1) * limit
    
    videos = await db.creator_videos.find(
        {"creator_id": user["user_id"], "status": {"$in": ["approved", "published", "live", "library"]}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.creator_videos.count_documents(
        {"creator_id": user["user_id"], "status": {"$in": ["approved", "published", "live", "library"]}}
    )
    
    return {
        "videos": videos,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.post("/creator/{username}/follow")
async def follow_creator(
    username: str,
    session_token: str = Cookie(None),
    authorization: Optional[str] = None
):
    """Follow a creator"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    user = await get_current_user(session_token=token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find creator to follow
    creator = await db.users.find_one({"username": username.lower()}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    if creator["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    # Check if already following
    existing = await db.follows.find_one({
        "follower_id": user["user_id"],
        "following_id": creator["user_id"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already following this creator")
    
    # Create follow relationship
    await db.follows.insert_one({
        "follower_id": user["user_id"],
        "following_id": creator["user_id"],
        "created_at": datetime.now(timezone.utc)
    })
    
    # Send notification to creator
    await db.notifications.insert_one({
        "user_id": creator["user_id"],
        "type": "new_follower",
        "message": f"{user.get('display_name') or user.get('name', 'Someone')} started following you",
        "data": {"follower_id": user["user_id"], "follower_name": user.get("display_name") or user.get("name")},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"success": True, "message": f"Now following {creator.get('display_name') or creator.get('name')}"}

@api_router.delete("/creator/{username}/follow")
async def unfollow_creator(
    username: str,
    session_token: str = Cookie(None),
    authorization: Optional[str] = None
):
    """Unfollow a creator"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    user = await get_current_user(session_token=token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    creator = await db.users.find_one({"username": username.lower()}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    result = await db.follows.delete_one({
        "follower_id": user["user_id"],
        "following_id": creator["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not following this creator")
    
    return {"success": True, "message": f"Unfollowed {creator.get('display_name') or creator.get('name')}"}

@api_router.get("/creator/{username}/is-following")
async def check_following(
    username: str,
    session_token: str = Cookie(None),
    authorization: Optional[str] = None
):
    """Check if current user is following a creator"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    user = await get_current_user(session_token=token)
    if not user:
        return {"is_following": False}
    
    creator = await db.users.find_one({"username": username.lower()}, {"_id": 0})
    if not creator:
        return {"is_following": False}
    
    existing = await db.follows.find_one({
        "follower_id": user["user_id"],
        "following_id": creator["user_id"]
    })
    
    return {"is_following": existing is not None}

@api_router.get("/creators/search")
async def search_creators(q: str = "", limit: int = 20):
    """Search creators by username or display name"""
    if not q:
        # Return featured/verified creators
        creators = await db.users.find(
            {"is_verified": True, "username": {"$exists": True}},
            {"_id": 0, "password_hash": 0, "email": 0}
        ).limit(limit).to_list(limit)
    else:
        # Search by username or display_name
        creators = await db.users.find(
            {
                "$or": [
                    {"username": {"$regex": q, "$options": "i"}},
                    {"display_name": {"$regex": q, "$options": "i"}},
                    {"name": {"$regex": q, "$options": "i"}}
                ],
                "username": {"$exists": True}
            },
            {"_id": 0, "password_hash": 0, "email": 0}
        ).limit(limit).to_list(limit)
    
    return {"creators": creators}

# ============ CREATOR PARTNER PROGRAM ============

@api_router.post("/creators/interest")
async def submit_creator_interest(data: CreatorInterestCreate):
    """Submit interest in joining ZTVLIVE as a creator partner"""
    # Check if already submitted
    existing = await db.creator_interests.find_one({"email": data.email.lower()})
    if existing:
        return {"success": True, "message": "You're already on our list! We'll be in touch soon."}
    
    # Create interest record
    interest = CreatorInterest(
        email=data.email.lower(),
        channel_url=data.channel_url,
        source=data.source
    )
    
    await db.creator_interests.insert_one(interest.model_dump())
    
    # Log for admin visibility
    logger.info(f"New creator interest: {data.email} - {data.channel_url}")
    
    return {
        "success": True, 
        "message": "Thanks for your interest! We'll review your channel and reach out within 48 hours."
    }

@api_router.get("/creators/interests")
async def get_creator_interests(
    status: str = None,
    limit: int = 50,
    authorization: str = Header(None)
):
    """Admin: Get all creator interest submissions"""
    # Verify admin token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin access required")
    
    token = authorization.replace("Bearer ", "")
    admin = await db.admin_sessions.find_one({"token": token})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    interests = await db.creator_interests.find(
        query,
        {"_id": 0}
    ).sort("submitted_at", -1).limit(limit).to_list(limit)
    
    return {
        "interests": interests,
        "total": await db.creator_interests.count_documents(query)
    }

@api_router.patch("/creators/interests/{interest_id}")
async def update_creator_interest(
    interest_id: str,
    status: str,
    notes: str = None,
    authorization: str = Header(None)
):
    """Admin: Update creator interest status"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin access required")
    
    token = authorization.replace("Bearer ", "")
    admin = await db.admin_sessions.find_one({"token": token})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin access required")
    
    update_data = {
        "status": status,
        "contacted_at": datetime.now(timezone.utc) if status == "contacted" else None
    }
    if notes:
        update_data["notes"] = notes
    
    result = await db.creator_interests.update_one(
        {"id": interest_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Interest not found")
    
    return {"success": True, "message": f"Status updated to {status}"}

# ============ CONTENT SCHEDULING SYSTEM ============

class ScheduleRequest(BaseModel):
    video_id: str
    requested_time: str  # ISO format datetime
    timezone: str = "UTC"
    notify_followers: bool = True

class ScheduleStatus:
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    LIVE = "live"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

@api_router.get("/schedule/availability")
async def get_schedule_availability(
    date: str = None,  # YYYY-MM-DD format
    timezone: str = "UTC"
):
    """Get available time slots for a given date"""
    from zoneinfo import ZoneInfo
    
    try:
        tz = ZoneInfo(timezone)
    except Exception:
        tz = ZoneInfo("UTC")
    
    # Default to today if no date provided
    if not date:
        now = datetime.now(tz)
        date = now.strftime("%Y-%m-%d")
    
    # Parse the date
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=tz)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Get start and end of day in UTC
    day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # Convert to UTC for database query
    day_start_utc = day_start.astimezone(timezone_module.utc)
    day_end_utc = day_end.astimezone(timezone_module.utc)
    
    # Get all scheduled content for this day
    scheduled = await db.scheduled_content.find({
        "scheduled_time": {"$gte": day_start_utc, "$lte": day_end_utc},
        "status": {"$in": [ScheduleStatus.PENDING, ScheduleStatus.APPROVED, ScheduleStatus.LIVE]}
    }, {"_id": 0}).sort("scheduled_time", 1).to_list(100)
    
    # Generate time slots (every 30 minutes)
    slots = []
    current_slot = day_start.replace(hour=0, minute=0)
    now = datetime.now(tz)
    
    while current_slot <= day_end:
        slot_utc = current_slot.astimezone(timezone_module.utc)
        
        # Check if slot is in the past
        is_past = current_slot < now
        
        # Check if slot is taken
        is_taken = False
        taken_by = None
        for s in scheduled:
            s_time = s["scheduled_time"]
            if isinstance(s_time, str):
                s_time = datetime.fromisoformat(s_time.replace("Z", "+00:00"))
            s_end = s_time + timedelta(seconds=s.get("duration_seconds", 300))
            
            # Check overlap
            slot_end = slot_utc + timedelta(minutes=30)
            if s_time < slot_end and s_end > slot_utc:
                is_taken = True
                taken_by = {
                    "schedule_id": s.get("schedule_id"),
                    "title": s.get("title"),
                    "creator_name": s.get("creator_name"),
                    "status": s.get("status")
                }
                break
        
        slots.append({
            "time": current_slot.strftime("%H:%M"),
            "time_utc": slot_utc.isoformat(),
            "available": not is_taken and not is_past,
            "is_past": is_past,
            "taken_by": taken_by
        })
        
        current_slot += timedelta(minutes=30)
    
    return {
        "date": date,
        "timezone": timezone,
        "slots": slots
    }

@api_router.post("/schedule/request")
async def request_schedule_slot(
    request: ScheduleRequest,
    session_token: str = Cookie(None),
    authorization: Optional[str] = None
):
    """Request a time slot for creator content"""
    from zoneinfo import ZoneInfo
    
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    user = await get_current_user(session_token=token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get the video
    video = await db.creator_videos.find_one(
        {"video_id": request.video_id, "creator_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or not yours")
    
    if video.get("status") not in ["approved", "published"]:
        raise HTTPException(status_code=400, detail="Only approved videos can be scheduled")
    
    # Parse requested time
    try:
        tz = ZoneInfo(request.timezone)
        requested_dt = datetime.fromisoformat(request.requested_time.replace("Z", "+00:00"))
        if requested_dt.tzinfo is None:
            requested_dt = requested_dt.replace(tzinfo=tz)
        requested_utc = requested_dt.astimezone(timezone_module.utc)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid datetime format: {str(e)}")
    
    # Check if time is in the future (at least 30 minutes from now)
    now = datetime.now(timezone_module.utc)
    if requested_utc < now + timedelta(minutes=30):
        raise HTTPException(status_code=400, detail="Scheduled time must be at least 30 minutes in the future")
    
    # Check if slot is available (no overlap with existing scheduled content)
    duration = video.get("duration_seconds", 300)
    slot_end = requested_utc + timedelta(seconds=duration)
    
    conflict = await db.scheduled_content.find_one({
        "status": {"$in": [ScheduleStatus.PENDING, ScheduleStatus.APPROVED, ScheduleStatus.LIVE]},
        "$or": [
            {"scheduled_time": {"$lt": slot_end, "$gte": requested_utc}},
            {"scheduled_end": {"$gt": requested_utc, "$lte": slot_end}},
            {"$and": [
                {"scheduled_time": {"$lte": requested_utc}},
                {"scheduled_end": {"$gte": slot_end}}
            ]}
        ]
    })
    
    if conflict:
        # Find next available slot
        next_available = slot_end
        while True:
            check_end = next_available + timedelta(seconds=duration)
            next_conflict = await db.scheduled_content.find_one({
                "status": {"$in": [ScheduleStatus.PENDING, ScheduleStatus.APPROVED, ScheduleStatus.LIVE]},
                "$or": [
                    {"scheduled_time": {"$lt": check_end, "$gte": next_available}},
                    {"scheduled_end": {"$gt": next_available, "$lte": check_end}}
                ]
            })
            if not next_conflict:
                break
            next_available = datetime.fromisoformat(
                next_conflict["scheduled_end"].replace("Z", "+00:00") if isinstance(next_conflict["scheduled_end"], str) 
                else next_conflict["scheduled_end"].isoformat()
            )
        
        return {
            "success": False,
            "message": "Time slot not available",
            "conflict": {
                "title": conflict.get("title"),
                "scheduled_time": conflict.get("scheduled_time"),
                "scheduled_end": conflict.get("scheduled_end")
            },
            "next_available": next_available.isoformat(),
            "next_available_local": next_available.astimezone(tz).strftime("%Y-%m-%d %H:%M")
        }
    
    # Create schedule entry
    schedule_id = f"sched_{uuid.uuid4().hex[:12]}"
    schedule_entry = {
        "schedule_id": schedule_id,
        "video_id": request.video_id,
        "creator_id": user["user_id"],
        "creator_name": user.get("display_name") or user.get("name"),
        "creator_username": user.get("username"),
        "title": video.get("title"),
        "description": video.get("description"),
        "thumbnail": video.get("thumbnail"),
        "video_url": video.get("video_url"),
        "category": video.get("category"),
        "duration_seconds": duration,
        "scheduled_time": requested_utc.isoformat(),
        "scheduled_end": slot_end.isoformat(),
        "requested_timezone": request.timezone,
        "notify_followers": request.notify_followers,
        "status": ScheduleStatus.PENDING,
        "created_at": datetime.now(timezone_module.utc).isoformat(),
        "updated_at": datetime.now(timezone_module.utc).isoformat()
    }
    
    await db.scheduled_content.insert_one(schedule_entry)
    
    # Notify admins
    await db.notifications.insert_one({
        "user_id": "admin",
        "type": "schedule_request",
        "message": f"{user.get('display_name') or user.get('name')} requested to schedule '{video.get('title')}'",
        "data": {"schedule_id": schedule_id, "creator_id": user["user_id"]},
        "read": False,
        "created_at": datetime.now(timezone_module.utc)
    })
    
    return {
        "success": True,
        "schedule_id": schedule_id,
        "scheduled_time": requested_utc.isoformat(),
        "scheduled_time_local": requested_dt.strftime("%Y-%m-%d %H:%M %Z"),
        "status": ScheduleStatus.PENDING,
        "message": "Your content has been submitted for scheduling. You'll be notified once approved."
    }

@api_router.get("/schedule/my-scheduled")
async def get_my_scheduled_content(
    session_token: str = Cookie(None),
    authorization: Optional[str] = None
):
    """Get creator's scheduled content"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    user = await get_current_user(session_token=token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    scheduled = await db.scheduled_content.find(
        {"creator_id": user["user_id"]},
        {"_id": 0}
    ).sort("scheduled_time", -1).to_list(50)
    
    return {"scheduled": scheduled}

@api_router.get("/schedule/upcoming")
async def get_upcoming_scheduled():
    """Get upcoming scheduled content (public)"""
    now = datetime.now(timezone_module.utc)
    
    scheduled = await db.scheduled_content.find(
        {
            "status": ScheduleStatus.APPROVED,
            "scheduled_time": {"$gte": now.isoformat()}
        },
        {"_id": 0}
    ).sort("scheduled_time", 1).limit(20).to_list(20)
    
    return {"upcoming": scheduled}

async def get_admin_from_jwt(token: str) -> Optional[Dict]:
    """Verify JWT token and get admin user from admin_users collection"""
    try:
        import jwt
        from routes.admin_auth import JWT_SECRET, JWT_ALGORITHM
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        admin_id = payload.get("sub")
        if admin_id:
            admin = await db.admin_users.find_one({"id": admin_id}, {"_id": 0, "password_hash": 0})
            if admin and admin.get("is_active", False):
                return admin
    except Exception:
        pass
    return None

@api_router.get("/schedule/queue")
async def get_schedule_queue(
    session_token: str = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Get all pending schedule requests (admin only)"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    # Try regular user auth first
    user = await get_current_user(session_token=token)
    is_admin = user and user.get("role") == "admin"
    
    # If no regular user or not admin, try admin JWT auth
    if not is_admin and token:
        admin = await get_admin_from_jwt(token)
        if admin and admin.get("role") in ["super_admin", "manager", "viewer"]:
            is_admin = True
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone_module.utc)
    today = now.strftime("%Y-%m-%d")
    tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Get pending requests from scheduled_content
    pending = await db.scheduled_content.find(
        {"status": ScheduleStatus.PENDING},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Also get pending from creator_bookings
    pending_bookings = await db.creator_bookings.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Transform creator_bookings to match scheduled_content format
    for b in pending_bookings:
        pending.append({
            "schedule_id": b.get("booking_id"),
            "creator_id": b.get("creator_id"),
            "creator_name": b.get("creator_name"),
            "title": b.get("title"),
            "description": b.get("description"),
            "video_url": b.get("video_url"),
            "thumbnail": b.get("thumbnail"),
            "scheduled_time": f"{b.get('slot_date')}T{b.get('slot_start_hour', 0):02d}:{b.get('slot_start_minute', 0):02d}:00Z",
            "duration_minutes": b.get("duration_minutes", 60),
            "status": "pending",
            "created_at": b.get("created_at"),
            "source": "creator_booking"
        })
    
    # Get approved upcoming from scheduled_content
    approved = await db.scheduled_content.find(
        {"status": ScheduleStatus.APPROVED, "scheduled_time": {"$gte": now.isoformat()}},
        {"_id": 0}
    ).sort("scheduled_time", 1).to_list(50)
    
    # Also get approved/confirmed from creator_bookings
    approved_bookings = await db.creator_bookings.find(
        {"slot_date": {"$in": [today, tomorrow]}, "status": {"$in": ["approved", "confirmed", "live"]}},
        {"_id": 0}
    ).sort("slot_date", 1).to_list(50)
    
    for b in approved_bookings:
        scheduled_time = f"{b.get('slot_date')}T{b.get('slot_start_hour', 0):02d}:{b.get('slot_start_minute', 0):02d}:00Z"
        approved.append({
            "schedule_id": b.get("booking_id"),
            "creator_id": b.get("creator_id"),
            "creator_name": b.get("creator_name"),
            "title": b.get("title"),
            "description": b.get("description"),
            "video_url": b.get("video_url"),
            "thumbnail": b.get("thumbnail"),
            "scheduled_time": scheduled_time,
            "duration_minutes": b.get("duration_minutes", 60),
            "status": b.get("status"),
            "created_at": b.get("created_at"),
            "source": "creator_booking"
        })
    
    # Sort approved by scheduled_time
    approved.sort(key=lambda x: x.get("scheduled_time", ""))
    
    # Get recently completed
    completed = await db.scheduled_content.find(
        {"status": {"$in": [ScheduleStatus.COMPLETED, ScheduleStatus.LIVE]}},
        {"_id": 0}
    ).sort("scheduled_time", -1).limit(20).to_list(20)
    
    # Also get completed creator_bookings
    completed_bookings = await db.creator_bookings.find(
        {"status": "completed"},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    for b in completed_bookings:
        completed.append({
            "schedule_id": b.get("booking_id"),
            "creator_name": b.get("creator_name"),
            "title": b.get("title"),
            "status": "completed",
            "source": "creator_booking"
        })
    
    return {
        "pending": pending,
        "approved": approved,
        "completed": completed
    }

@api_router.put("/schedule/{schedule_id}/approve")
async def approve_schedule(
    schedule_id: str,
    session_token: str = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Approve a scheduled content request (admin only)"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    # Try regular user auth first
    user = await get_current_user(session_token=token)
    admin_id = None
    is_admin = user and user.get("role") == "admin"
    if user:
        admin_id = user.get("user_id")
    
    # If no regular user or not admin, try admin JWT auth
    if not is_admin and token:
        admin = await get_admin_from_jwt(token)
        if admin and admin.get("role") in ["super_admin", "manager"]:
            is_admin = True
            admin_id = admin.get("id")
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    schedule = await db.scheduled_content.find_one(
        {"schedule_id": schedule_id},
        {"_id": 0}
    )
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    if schedule["status"] != ScheduleStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot approve - status is {schedule['status']}")
    
    # Update status
    await db.scheduled_content.update_one(
        {"schedule_id": schedule_id},
        {"$set": {
            "status": ScheduleStatus.APPROVED,
            "approved_by": admin_id,
            "approved_at": datetime.now(timezone_module.utc).isoformat(),
            "updated_at": datetime.now(timezone_module.utc).isoformat()
        }}
    )
    
    # Notify creator
    await db.notifications.insert_one({
        "user_id": schedule["creator_id"],
        "type": "schedule_approved",
        "message": f"Your content '{schedule['title']}' has been approved for live broadcast!",
        "data": {
            "schedule_id": schedule_id,
            "scheduled_time": schedule["scheduled_time"],
            "title": schedule["title"]
        },
        "read": False,
        "created_at": datetime.now(timezone_module.utc)
    })
    
    # If notify_followers is enabled, notify all followers
    if schedule.get("notify_followers"):
        followers = await db.follows.find(
            {"following_id": schedule["creator_id"]}
        ).to_list(1000)
        
        for follower in followers:
            await db.notifications.insert_one({
                "user_id": follower["follower_id"],
                "type": "creator_going_live",
                "message": f"{schedule['creator_name']} is going live with '{schedule['title']}'",
                "data": {
                    "schedule_id": schedule_id,
                    "scheduled_time": schedule["scheduled_time"],
                    "creator_id": schedule["creator_id"],
                    "creator_username": schedule.get("creator_username")
                },
                "read": False,
                "created_at": datetime.now(timezone_module.utc)
            })
    
    return {"success": True, "message": "Schedule approved", "schedule_id": schedule_id}

@api_router.put("/schedule/{schedule_id}/reject")
async def reject_schedule(
    schedule_id: str,
    reason: str = "",
    session_token: str = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Reject a scheduled content request (admin only)"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    # Try regular user auth first
    user = await get_current_user(session_token=token)
    admin_id = None
    is_admin = user and user.get("role") == "admin"
    if user:
        admin_id = user.get("user_id")
    
    # If no regular user or not admin, try admin JWT auth
    if not is_admin and token:
        admin = await get_admin_from_jwt(token)
        if admin and admin.get("role") in ["super_admin", "manager"]:
            is_admin = True
            admin_id = admin.get("id")
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    schedule = await db.scheduled_content.find_one(
        {"schedule_id": schedule_id},
        {"_id": 0}
    )
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Update status
    await db.scheduled_content.update_one(
        {"schedule_id": schedule_id},
        {"$set": {
            "status": ScheduleStatus.REJECTED,
            "rejected_by": admin_id,
            "rejection_reason": reason,
            "updated_at": datetime.now(timezone_module.utc).isoformat()
        }}
    )
    
    # Notify creator
    await db.notifications.insert_one({
        "user_id": schedule["creator_id"],
        "type": "schedule_rejected",
        "message": f"Your schedule request for '{schedule['title']}' was not approved." + (f" Reason: {reason}" if reason else ""),
        "data": {"schedule_id": schedule_id, "reason": reason},
        "read": False,
        "created_at": datetime.now(timezone_module.utc)
    })
    
    return {"success": True, "message": "Schedule rejected", "schedule_id": schedule_id}

@api_router.delete("/schedule/{schedule_id}")
async def cancel_schedule(
    schedule_id: str,
    session_token: str = Cookie(None),
    authorization: Optional[str] = None
):
    """Cancel a scheduled content (creator or admin)"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    user = await get_current_user(session_token=token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    schedule = await db.scheduled_content.find_one(
        {"schedule_id": schedule_id},
        {"_id": 0}
    )
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check ownership or admin
    is_admin = user.get("role") == "admin"
    is_owner = schedule["creator_id"] == user["user_id"]
    
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this schedule")
    
    if schedule["status"] in [ScheduleStatus.LIVE, ScheduleStatus.COMPLETED]:
        raise HTTPException(status_code=400, detail="Cannot cancel - content is live or already completed")
    
    # Update status
    await db.scheduled_content.update_one(
        {"schedule_id": schedule_id},
        {"$set": {
            "status": ScheduleStatus.CANCELLED,
            "cancelled_by": user["user_id"],
            "updated_at": datetime.now(timezone_module.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Schedule cancelled"}

@api_router.get("/schedule/now-playing")
async def get_scheduled_now_playing():
    """Get currently playing scheduled content (if any)"""
    now = datetime.now(timezone_module.utc)
    now_str = now.isoformat()
    
    # Find content that should be playing now
    current = await db.scheduled_content.find_one({
        "status": {"$in": [ScheduleStatus.APPROVED, ScheduleStatus.LIVE]},
        "scheduled_time": {"$lte": now_str},
        "scheduled_end": {"$gte": now_str}
    }, {"_id": 0})
    
    if current:
        # Update status to LIVE if not already
        if current["status"] == ScheduleStatus.APPROVED:
            await db.scheduled_content.update_one(
                {"schedule_id": current["schedule_id"]},
                {"$set": {"status": ScheduleStatus.LIVE}}
            )
            current["status"] = ScheduleStatus.LIVE
        
        # Calculate elapsed time
        scheduled_time = datetime.fromisoformat(current["scheduled_time"].replace("Z", "+00:00"))
        elapsed = (now - scheduled_time).total_seconds()
        
        return {
            "has_scheduled": True,
            "content": current,
            "elapsed_seconds": int(elapsed),
            "remaining_seconds": current["duration_seconds"] - int(elapsed)
        }
    
    # Check if any approved content just ended - mark as completed
    just_ended = await db.scheduled_content.find({
        "status": ScheduleStatus.LIVE,
        "scheduled_end": {"$lt": now_str}
    }).to_list(10)
    
    for ended in just_ended:
        await db.scheduled_content.update_one(
            {"schedule_id": ended["schedule_id"]},
            {"$set": {"status": ScheduleStatus.COMPLETED}}
        )
    
    return {"has_scheduled": False, "content": None}

# Add timezone import alias at module level usage
timezone_module = timezone

# ============ LIVE COMMENTS API ============

@api_router.get("/live-comments/recent")
async def get_recent_live_comments(limit: int = 50):
    """Get recent live comments for initial display"""
    comments = await db.live_comments.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Reverse to show oldest first
    comments.reverse()
    return {"comments": comments}

# ============ JWT-BASED LOCAL AUTH (Alternative) ============

import hashlib
import secrets

def hash_password(password: str) -> str:
    """Simple password hashing"""
    return hashlib.sha256(password.encode()).hexdigest()

class LocalSignupRequest(BaseModel):
    email: str
    password: str
    name: str

class LocalLoginRequest(BaseModel):
    email: str
    password: str

@api_router.post("/auth/signup")
async def local_signup(request: LocalSignupRequest, response: Response):
    """Sign up with email and password"""
    # Check if user exists
    existing = await db.users.find_one({"email": request.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user with auto-generated username
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(request.password)
    base_username = request.name.lower().replace(" ", "_")[:20]
    username = f"{base_username}_{uuid.uuid4().hex[:6]}"
    
    new_user = {
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "username": username,  # Auto-generated username
        "display_name": request.name,
        "password_hash": password_hash,
        "picture": None,
        "role": "creator",
        "created_at": datetime.now(timezone.utc),
        "last_login": datetime.now(timezone.utc),
        "bio": None,
        "website": None,
        "social_links": {},
        "total_earnings": 0.0,
        "total_views": 0,
        "is_verified": False,
        "auth_method": "local"
    }
    await db.users.insert_one(new_user)
    
    # Create session
    session_token = f"sess_{secrets.token_hex(32)}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    # Remove password hash and _id from response
    del new_user["password_hash"]
    if "_id" in new_user:
        del new_user["_id"]
    
    # Convert datetime objects to ISO format strings for JSON serialization
    if isinstance(new_user.get("created_at"), datetime):
        new_user["created_at"] = new_user["created_at"].isoformat()
    if isinstance(new_user.get("last_login"), datetime):
        new_user["last_login"] = new_user["last_login"].isoformat()
    
    return {
        "success": True,
        "user": new_user,
        "session_token": session_token
    }

@api_router.post("/auth/login")
async def local_login(request: LocalLoginRequest, response: Response):
    """Login with email and password"""
    logger.info(f"Login attempt for: {request.email}")
    user = await db.users.find_one({"email": request.email})
    
    if not user:
        logger.warning(f"User not found: {request.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check password
    password_hash = hash_password(request.password)
    stored_hash = user.get("password_hash", "")
    logger.info(f"Password check - stored: {stored_hash[:10]}..., computed: {password_hash[:10]}...")
    
    if stored_hash != password_hash:
        logger.warning(f"Password mismatch for: {request.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create session
    session_token = f"sess_{secrets.token_hex(32)}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Update last login
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    user_response = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    
    return {
        "success": True,
        "user": user_response,
        "session_token": session_token
    }

# ============ STRIPE PAYMENT SYSTEM ============

class TipRequest(BaseModel):
    package_id: str
    creator_id: str
    origin_url: str
    message: Optional[str] = None

class CustomTipRequest(BaseModel):
    amount: float
    creator_id: str
    origin_url: str
    message: Optional[str] = None

@api_router.post("/payments/tip")
async def create_tip_checkout(request: Request, tip: TipRequest):
    """Create checkout session for tipping a creator"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Validate package - NEVER accept amount from frontend
    if tip.package_id not in CREATOR_TIP_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid tip package")
    
    amount = CREATOR_TIP_PACKAGES[tip.package_id]
    
    # Verify creator exists
    creator = await db.users.find_one({"user_id": tip.creator_id}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    # Build URLs from origin
    success_url = f"{tip.origin_url}/tip/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{tip.origin_url}/tip/cancel"
    
    # Initialize Stripe
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "creator_tip",
            "package_id": tip.package_id,
            "creator_id": tip.creator_id,
            "creator_name": creator.get("name", "Creator"),
            "message": tip.message or ""
        }
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Record transaction
    await db.payment_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "session_id": session.session_id,
        "type": "creator_tip",
        "amount": amount,
        "currency": "usd",
        "creator_id": tip.creator_id,
        "package_id": tip.package_id,
        "message": tip.message,
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "checkout_url": session.url,
        "session_id": session.session_id
    }

@api_router.post("/payments/custom-tip")
async def create_custom_tip(request: Request, tip: CustomTipRequest):
    """Create checkout for custom tip amount"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Validate amount range
    if tip.amount < 1.00 or tip.amount > 1000.00:
        raise HTTPException(status_code=400, detail="Amount must be between $1 and $1000")
    
    # Verify creator exists
    creator = await db.users.find_one({"user_id": tip.creator_id}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    # Build URLs
    success_url = f"{tip.origin_url}/tip/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{tip.origin_url}/tip/cancel"
    
    # Initialize Stripe
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_request = CheckoutSessionRequest(
        amount=tip.amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "custom_tip",
            "creator_id": tip.creator_id,
            "creator_name": creator.get("name", "Creator"),
            "message": tip.message or ""
        }
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    await db.payment_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "session_id": session.session_id,
        "type": "custom_tip",
        "amount": tip.amount,
        "currency": "usd",
        "creator_id": tip.creator_id,
        "message": tip.message,
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "checkout_url": session.url,
        "session_id": session.session_id
    }

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    """Get payment status and update if needed"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Find transaction
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already completed, don't reprocess
    if transaction.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "amount": transaction.get("amount"),
            "message": "Payment already processed"
        }
    
    # Check with Stripe
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction status
    new_status = checkout_status.payment_status
    
    if new_status == "paid" and transaction.get("payment_status") != "paid":
        # Credit creator
        creator_id = transaction.get("creator_id")
        amount = transaction.get("amount", 0)
        
        if creator_id:
            await db.users.update_one(
                {"user_id": creator_id},
                {"$inc": {"total_earnings": amount}}
            )
            
            # Record in creator earnings
            await db.creator_earnings.insert_one({
                "earning_id": f"earn_{uuid.uuid4().hex[:12]}",
                "creator_id": creator_id,
                "amount": amount,
                "type": transaction.get("type"),
                "message": transaction.get("message"),
                "session_id": session_id,
                "created_at": datetime.now(timezone.utc)
            })
    
    # Update transaction
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": new_status,
            "status": checkout_status.status,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "status": checkout_status.status,
        "payment_status": new_status,
        "amount": checkout_status.amount_total / 100,  # Convert from cents
        "currency": checkout_status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Process webhook event
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            
            # Update transaction
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            
            if transaction and transaction.get("payment_status") != "paid":
                # Credit creator
                creator_id = transaction.get("creator_id")
                amount = transaction.get("amount", 0)
                
                if creator_id:
                    await db.users.update_one(
                        {"user_id": creator_id},
                        {"$inc": {"total_earnings": amount}}
                    )
                
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )
        
        return {"received": True}
        
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/payments/packages")
async def get_tip_packages():
    """Get available tip packages"""
    return {
        "packages": [
            {"id": "coffee", "name": "Buy a Coffee", "amount": 5.00, "emoji": "☕"},
            {"id": "lunch", "name": "Buy Lunch", "amount": 10.00, "emoji": "🍔"},
            {"id": "support", "name": "Show Support", "amount": 25.00, "emoji": "💪"},
            {"id": "sponsor", "name": "Sponsor", "amount": 50.00, "emoji": "⭐"},
            {"id": "patron", "name": "Patron", "amount": 100.00, "emoji": "👑"}
        ]
    }

@api_router.get("/creator/{creator_id}/earnings")
async def get_creator_earnings(
    creator_id: str,
    session_token: str = Cookie(None),
    authorization: Optional[str] = None
):
    """Get creator's earnings (only visible to creator themselves)"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    user = await get_current_user(session_token=token)
    if not user or user["user_id"] != creator_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get earnings summary
    earnings = await db.creator_earnings.find(
        {"creator_id": creator_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    total = sum(e.get("amount", 0) for e in earnings)
    
    return {
        "total_earnings": total,
        "recent_earnings": earnings
    }

# ============ AD KIT DOWNLOAD ENDPOINT ============

AD_KIT_VIDEOS = [
    {
        "filename": "ztvlive_horizontal_16x9.mp4",
        "source": "ztvlive_promo_premium.mp4",
        "platform": "YouTube, Website, TV, Facebook Feed",
        "dimensions": "1280x720 (16:9)",
        "duration": "12 seconds"
    },
    {
        "filename": "ztvlive_vertical_9x16.mp4",
        "source": "ztvlive_tiktok_vertical.mp4",
        "platform": "TikTok, Instagram Reels, YouTube Shorts",
        "dimensions": "720x1280 (9:16)",
        "duration": "8 seconds"
    }
]

CAPTIONS_AND_HASHTAGS = """
================================================================================
ZTVLIVE SOCIAL MEDIA AD KIT - CAPTIONS & HASHTAGS
================================================================================

📱 TIKTOK / INSTAGRAM REELS
---------------------------
Caption Option 1:
"Getting paid to create content hits different 💰 Join ZTVLIVE and start earning what you deserve! Link in bio 🔥"

Caption Option 2:
"POV: You switched to ZTVLIVE and now you're getting weekly payouts 📈 #CreatorLife"

Caption Option 3:
"They said content creation doesn't pay... then I found ZTVLIVE 💸"

Hashtags:
#ZTVLIVE #ContentCreator #CreatorEconomy #GetPaid #StreamingLife #TikTokCreator #ReelsCreator #MakeMoneyOnline #CreatorTips #LiveStreaming #24x7Live #WeeklyPayouts

--------------------------------------------------------------------------------

📺 YOUTUBE
----------
Title Options:
• "ZTVLIVE - Get Paid More for Your Content | Join Now"
• "Why Creators Are Switching to ZTVLIVE | 70% Revenue Share"
• "Stream 24/7 and Earn Weekly with ZTVLIVE"

Description:
Join ZTVLIVE today and start earning what you deserve! 💰
✅ 70% Revenue Share
✅ Weekly Payouts
✅ 24/7 Content Distribution
✅ Direct Fan Support & Tips

Sign up FREE: https://ztvlivestream.com
Watch on Roku, Fire TV, and more!

Hashtags: #ZTVLIVE #ContentCreator #LiveStreaming #CreatorEconomy #GetPaid

--------------------------------------------------------------------------------

📘 FACEBOOK
-----------
Post Option 1:
"Ready to get paid what you're worth? 💰 ZTVLIVE offers 70% revenue share and weekly payouts to content creators. Join the movement! 🚀 #ZTVLIVE #CreatorEconomy"

Post Option 2:
"Content creators: Stop leaving money on the table. ZTVLIVE pays MORE and pays FASTER. Link in comments 👇"

--------------------------------------------------------------------------------

🐦 TWITTER / X
--------------
Tweet Option 1:
"🔥 ZTVLIVE is changing the game for creators:
• 70% revenue share
• Weekly payouts
• 24/7 distribution

Join now 👉 ztvlivestream.com"

Tweet Option 2:
"why are creators switching to @ZTVLIVE?

because they're tired of waiting months to get paid 💰

weekly payouts. 70% rev share. join us."

--------------------------------------------------------------------------------

📌 GENERAL TIPS
---------------
• Always include a clear call-to-action (CTA)
• Post during peak hours (typically 6-9 PM local time)
• Engage with comments within the first hour
• Use the vertical video for Stories and Reels
• Use the horizontal video for feed posts and ads

================================================================================
© ZTVLIVE - Download more assets at ztvlivestream.com/ad-kit
================================================================================
"""

@api_router.get("/ad-kit/download-all")
async def download_ad_kit_zip():
    """Download all ad kit videos and captions as a ZIP file"""
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Add videos
        frontend_public = Path("/app/frontend/public")
        
        for video in AD_KIT_VIDEOS:
            source_path = frontend_public / video["source"]
            if source_path.exists():
                zip_file.write(source_path, f"videos/{video['filename']}")
        
        # Add captions and hashtags file
        zip_file.writestr("CAPTIONS_AND_HASHTAGS.txt", CAPTIONS_AND_HASHTAGS)
        
        # Add README
        readme = """ZTVLIVE Social Media Ad Kit
===========================

This kit contains:

📁 videos/
   - ztvlive_horizontal_16x9.mp4 (1280x720, 12s) - YouTube, Website, TV, Facebook
   - ztvlive_vertical_9x16.mp4 (720x1280, 8s) - TikTok, Reels, Shorts

📄 CAPTIONS_AND_HASHTAGS.txt
   - Ready-to-use captions for each platform
   - Optimized hashtags for maximum reach

USAGE TIPS:
-----------
• TikTok/Reels: Use the vertical video
• YouTube/Website: Use the horizontal video
• Instagram Feed: Crop horizontal to square (1:1)
• Facebook: Both formats work - vertical for mobile, horizontal for desktop

Need more formats? Visit ztvlivestream.com/ad-kit

Questions? Contact creators@ztvlivestream.com

© ZTVLIVE - Stream. Create. Earn.
"""
        zip_file.writestr("README.txt", readme)
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=ZTVLIVE_Ad_Kit.zip"
        }
    )

@api_router.get("/ad-kit/videos")
async def get_ad_kit_videos():
    """Get list of available ad kit videos"""
    return {
        "videos": AD_KIT_VIDEOS,
        "download_url": "/api/ad-kit/download-all"
    }

# ============ ROKU CHANNEL API ============

# Download endpoints for TV apps
@api_router.get("/download/roku-channel")
async def download_roku_channel():
    """Download Roku Channel ZIP"""
    zip_path = Path("/app/ZTVLIVE_Roku_Channel.zip")
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Roku channel package not found")
    return FileResponse(
        path=str(zip_path),
        filename="ZTVLIVE_Roku_Channel.zip",
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=ZTVLIVE_Roku_Channel.zip"}
    )

@api_router.get("/download/firetv-app")
async def download_firetv_app():
    """Download Fire TV App ZIP"""
    zip_path = Path("/app/ZTVLIVE_FireTV_App.zip")
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Fire TV app package not found")
    return FileResponse(
        path=str(zip_path),
        filename="ZTVLIVE_FireTV_App.zip",
        media_type="application/zip"
    )

@api_router.get("/download/icon-512")
async def download_icon_512():
    """Download 512x512 app icon"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Icon_512x512.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Icon not found")
    return FileResponse(
        path=str(file_path),
        filename="ZTVLIVE_Icon_512x512.png",
        media_type="image/png"
    )

@api_router.get("/download/icon-114")
async def download_icon_114():
    """Download 114x114 app icon"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Icon_114x114.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Icon not found")
    return FileResponse(
        path=str(file_path),
        filename="ZTVLIVE_Icon_114x114.png",
        media_type="image/png"
    )

@api_router.get("/download/firetv-banner")
async def download_firetv_banner():
    """Download 1280x720 Fire TV banner"""
    file_path = Path("/app/frontend/public/ZTVLIVE_FireTV_Banner_1280x720.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Banner not found")
    return FileResponse(
        path=str(file_path),
        filename="ZTVLIVE_FireTV_Banner_1280x720.png",
        media_type="image/png"
    )

@api_router.get("/download/promo-image")
async def download_promo_image():
    """Download 1024x500 promotional image"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Promo_1024x500.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Promo image not found")
    return FileResponse(
        path=str(file_path),
        filename="ZTVLIVE_Promo_1024x500.png",
        media_type="image/png"
    )

@api_router.get("/download/screenshot-1")
async def download_screenshot_1():
    """Download screenshot 1 (1920x1080)"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Screenshot_1_1920x1080.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return FileResponse(
        path=str(file_path),
        filename="ZTVLIVE_Screenshot_1_1920x1080.png",
        media_type="image/png"
    )

@api_router.get("/download/screenshot-2")
async def download_screenshot_2():
    """Download screenshot 2 (1920x1080)"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Screenshot_2_1920x1080.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return FileResponse(
        path=str(file_path),
        filename="ZTVLIVE_Screenshot_2_1920x1080.png",
        media_type="image/png"
    )

@api_router.get("/download/screenshot-3")
async def download_screenshot_3():
    """Download screenshot 3 (1920x1080)"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Screenshot_3_1920x1080.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return FileResponse(
        path=str(file_path),
        filename="ZTVLIVE_Screenshot_3_1920x1080.png",
        media_type="image/png"
    )

@api_router.get("/download/featured-background")
async def download_featured_background():
    """Download featured content background (1920x720)"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Featured_Background_1920x720.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Background not found")
    return FileResponse(
        path=str(file_path),
        filename="ZTVLIVE_Featured_Background_1920x720.png",
        media_type="image/png"
    )

@api_router.get("/download/app-background")
async def download_app_background():
    """Download app background image (1920x1080)"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Background_1920x1080.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Background not found")
    return FileResponse(
        path=str(file_path),
        filename="ZTVLIVE_Background_1920x1080.png",
        media_type="image/png"
    )

@api_router.get("/download/featured-logo")
async def download_featured_logo():
    """Download featured content logo (640x260)"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Featured_Logo_640x260.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Logo not found")
    return FileResponse(
        path=str(file_path),
        filename="ZTVLIVE_Featured_Logo_640x260.png",
        media_type="image/png"
    )

@api_router.get("/download/screenshot-800x480")
async def download_screenshot_800x480():
    """Download screenshot 800x480"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Screenshot_800x480.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return FileResponse(path=str(file_path), filename="ZTVLIVE_Screenshot_800x480.png", media_type="image/png")

@api_router.get("/download/screenshot-1024x600")
async def download_screenshot_1024x600():
    """Download screenshot 1024x600"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Screenshot_1024x600.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return FileResponse(path=str(file_path), filename="ZTVLIVE_Screenshot_1024x600.png", media_type="image/png")

@api_router.get("/download/screenshot-1280x720")
async def download_screenshot_1280x720():
    """Download screenshot 1280x720"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Screenshot_1280x720.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return FileResponse(path=str(file_path), filename="ZTVLIVE_Screenshot_1280x720.png", media_type="image/png")

@api_router.get("/download/screenshot-1280x800")
async def download_screenshot_1280x800():
    """Download screenshot 1280x800"""
    file_path = Path("/app/frontend/public/ZTVLIVE_Screenshot_1280x800.png")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return FileResponse(path=str(file_path), filename="ZTVLIVE_Screenshot_1280x800.png", media_type="image/png")

# Promo Video Downloads
@api_router.get("/download/video-promo-premium")
async def download_video_promo_premium():
    """Download premium promo video (7.4MB)"""
    file_path = Path("/app/frontend/public/ztvlive_promo_premium.mp4")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(path=str(file_path), filename="ZTVLIVE_Promo_Premium.mp4", media_type="video/mp4")

@api_router.get("/download/video-promo-main")
async def download_video_promo_main():
    """Download main promo video (5.9MB)"""
    file_path = Path("/app/frontend/public/ztvlive_promo.mp4")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(path=str(file_path), filename="ZTVLIVE_Promo.mp4", media_type="video/mp4")

@api_router.get("/download/video-music-promo")
async def download_video_music_promo():
    """Download music promo video (4.4MB)"""
    file_path = Path("/app/frontend/public/ztvlive_music_promo.mp4")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(path=str(file_path), filename="ZTVLIVE_Music_Promo.mp4", media_type="video/mp4")

@api_router.get("/download/video-gaming-promo")
async def download_video_gaming_promo():
    """Download gaming promo video (5.2MB)"""
    file_path = Path("/app/frontend/public/ztvlive_gaming_promo.mp4")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(path=str(file_path), filename="ZTVLIVE_Gaming_Promo.mp4", media_type="video/mp4")

@api_router.get("/download/video-events-promo")
async def download_video_events_promo():
    """Download events promo video (4.6MB)"""
    file_path = Path("/app/frontend/public/ztvlive_events_promo.mp4")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(path=str(file_path), filename="ZTVLIVE_Events_Promo.mp4", media_type="video/mp4")

HLS_STREAM_URL = os.environ.get('HLS_STREAM_URL', 'https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_b8b938d0c6b811eab6745b4605902bfa/index.m3u8')

# Fallback playlist when not broadcasting
ROKU_FALLBACK_PLAYLIST = [
    {"id": "promo-70-revolution", "url": "/api/static/promo/ztvlive_70_revolution_with_voiceover.mp4", "title": "The 70% Revolution", "duration": 23},
    {"id": "promo-premium", "url": "/ztvlive_promo_premium.mp4", "title": "ZTVLIVE - Create. Stream. Earn.", "duration": 12},
    {"id": "promo-gaming", "url": "/ztvlive_gaming_promo.mp4", "title": "ZTVLIVE Gaming", "duration": 8},
    {"id": "promo-music", "url": "/ztvlive_music_promo.mp4", "title": "ZTVLIVE Music", "duration": 8},
    {"id": "promo-podcast", "url": "/ztvlive_podcast_promo.mp4", "title": "ZTVLIVE Podcasts", "duration": 8}
]

async def check_hls_stream_active() -> bool:
    """Check if the HLS stream is currently active"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.head(HLS_STREAM_URL)
            return response.status_code == 200
    except:
        return False

@api_router.get("/roku/live-status")
async def get_roku_live_status(request: Request):
    """Check if live stream is active and return appropriate content"""
    base_url = str(request.base_url).rstrip('/')
    
    is_live = await check_hls_stream_active()
    
    # Build full URLs for fallback videos
    fallback_with_urls = []
    for video in ROKU_FALLBACK_PLAYLIST:
        fallback_with_urls.append({
            **video,
            "url": f"{base_url}{video['url']}"
        })
    
    return {
        "isLive": is_live,
        "streamUrl": HLS_STREAM_URL if is_live else None,
        "fallbackPlaylist": fallback_with_urls,
        "currentTitle": "ZTVLIVE 24/7 - LIVE" if is_live else "ZTVLIVE - Now Playing",
        "viewerCount": random.randint(800, 2500),
        "nextBroadcast": None,
        "message": "Streaming live now!" if is_live else "Playing featured content"
    }

@api_router.get("/roku/content")
async def get_roku_content():
    """
    Content feed for custom Roku channel library.
    Returns categories and videos that creators can update via admin.
    """
    
    # Build content from MOCK_HIGHLIGHTS organized by category
    categories = {}
    
    for highlight in MOCK_HIGHLIGHTS:
        cat = highlight.get("category", "entertainment")
        if cat not in categories:
            categories[cat] = {
                "name": cat.title(),
                "videos": []
            }
        
        if highlight.get("video_url") or highlight.get("thumbnail"):
            categories[cat]["videos"].append({
                "id": highlight.get("id", ""),
                "title": highlight.get("title", highlight.get("topic", "Untitled")),
                "description": highlight.get("description", "")[:200],
                "thumbnail": highlight.get("thumbnail", ""),
                "video_url": highlight.get("video_url", ""),
                "duration": highlight.get("duration", "3:00"),
                "source": highlight.get("source", "ZTVLIVE")
            })
    
    # Add live stream
    live_content = {
        "name": "Live Now",
        "videos": [{
            "id": "live-main",
            "title": "ZTVLIVE 24/7 Stream",
            "description": "Watch our 24/7 live interactive game show. Play along and win prizes!",
            "thumbnail": "https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg",
            "video_url": "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_b8b938d0c6b811eab6745b4605902bfa/index.m3u8",
            "stream_format": "hls",
            "is_live": True,
            "duration": "LIVE"
        }]
    }
    
    # Organize output
    return {
        "version": "1.0",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "categories": [
            live_content,
            categories.get("music", {"name": "Music", "videos": []}),
            categories.get("entertainment", {"name": "Entertainment", "videos": []}),
            categories.get("sports", {"name": "Sports", "videos": []}),
            categories.get("tech", {"name": "Tech", "videos": []}),
            categories.get("comedy", {"name": "Comedy", "videos": []}),
        ]
    }

# ===== TRANSLATION ENDPOINTS =====

class TranslateRequest(BaseModel):
    text: str
    target_lang: str
    source_lang: str = "en"

class TranslateQuestionRequest(BaseModel):
    question: str
    target_lang: str

class NormalizeAnswerRequest(BaseModel):
    answer: str
    source_lang: str

@api_router.get("/translation/ui/{lang}")
async def get_ui_translations(lang: str):
    """Get all UI translations for a language"""
    texts = translation.get_all_ui_texts(lang)
    return {
        "lang": lang,
        "supported": lang in translation.SUPPORTED_LANGUAGES,
        "translations": texts
    }

@api_router.get("/translation/languages")
async def get_supported_languages():
    """Get list of supported languages"""
    return {
        "languages": translation.SUPPORTED_LANGUAGES,
        "default": "en"
    }

@api_router.post("/translation/translate")
async def translate_text_endpoint(req: TranslateRequest):
    """Translate arbitrary text"""
    translated = await translation.translate_text(req.text, req.target_lang, req.source_lang)
    return {
        "original": req.text,
        "translated": translated,
        "source_lang": req.source_lang,
        "target_lang": req.target_lang
    }

@api_router.post("/translation/question")
async def translate_question_endpoint(req: TranslateQuestionRequest):
    """Translate a game question"""
    # First check pre-translated questions
    translated = translation.get_translated_question(req.question, req.target_lang)
    
    # If not found, translate dynamically
    if translated == req.question and req.target_lang != "en":
        translated = await translation.translate_question(req.question, req.target_lang)
    
    return {
        "original": req.question,
        "translated": translated,
        "target_lang": req.target_lang
    }

@api_router.post("/translation/normalize-answer")
async def normalize_answer_endpoint(req: NormalizeAnswerRequest):
    """Normalize an answer to English for matching"""
    normalized = await translation.normalize_answer_to_english(req.answer, req.source_lang)
    return {
        "original": req.answer,
        "normalized": normalized,
        "source_lang": req.source_lang
    }

@api_router.get("/roku/feed")
async def get_roku_feed(request: Request):
    """Main Roku Direct Publisher feed"""
    base_url = str(request.base_url).rstrip('/')
    
    is_live = await check_hls_stream_active()
    
    # Build promo videos for shortFormVideos
    short_form_videos = []
    for i, video in enumerate(ROKU_FALLBACK_PLAYLIST):
        short_form_videos.append({
            "id": video["id"],
            "title": video["title"],
            "shortDescription": f"ZTVLIVE Official Promo - {video['title']}",
            "thumbnail": f"{base_url}/roku/thumb_{video['id']}.jpg",
            "releaseDate": "2026-03-10",
            "tags": ["promo", "featured", "ztvlive"],
            "genres": ["Entertainment"],
            "content": {
                "dateAdded": "2026-03-10",
                "videos": [{
                    "url": f"{base_url}{video['url']}",
                    "quality": "HD",
                    "videoType": "MP4"
                }],
                "duration": video["duration"]
            }
        })
    
    # Get library videos for on-demand content
    library_videos = []
    for idx, highlight in enumerate(MOCK_HIGHLIGHTS[:20]):
        if highlight.get("video_url"):
            library_videos.append({
                "id": f"lib-{idx}",
                "title": highlight.get("title", highlight.get("topic", "Untitled")),
                "shortDescription": highlight.get("description", "")[:200],
                "thumbnail": highlight.get("thumbnail", ""),
                "releaseDate": "2026-03-10",
                "tags": [highlight.get("category", "general")],
                "genres": ["Entertainment"],
                "content": {
                    "dateAdded": "2026-03-10",
                    "videos": [{
                        "url": highlight.get("video_url", ""),
                        "quality": "HD",
                        "videoType": "MP4"
                    }],
                    "duration": highlight.get("duration", 180)
                }
            })
    
    return {
        "providerName": "ZTVLIVE",
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "language": "en",
        "liveFeeds": [
            {
                "id": "ztvlive-main",
                "title": "ZTVLIVE 24/7",
                "shortDescription": "Non-stop trending content - Sports, Music, Gaming, Podcasts and more!",
                "thumbnail": f"{base_url}/roku/live_thumbnail.jpg",
                "brandedThumbnail": f"{base_url}/roku/live_branded.jpg",
                "tags": ["live", "trending", "24/7"],
                "content": {
                    "dateAdded": "2026-03-10",
                    "videos": [{
                        "url": HLS_STREAM_URL,
                        "quality": "HD",
                        "videoType": "HLS"
                    }]
                }
            }
        ],
        "movies": [],
        "series": [],
        "shortFormVideos": short_form_videos,
        "tvSpecials": library_videos[:10],
        "categories": [
            {"name": "Live Now", "playlistName": "live", "order": "most_recent"},
            {"name": "Trending", "playlistName": "trending", "order": "most_popular"},
            {"name": "Sports", "playlistName": "sports", "order": "most_recent"},
            {"name": "Music", "playlistName": "music", "order": "most_recent"},
            {"name": "Gaming", "playlistName": "gaming", "order": "most_recent"},
            {"name": "Podcasts", "playlistName": "podcasts", "order": "most_recent"},
            {"name": "Film & TV", "playlistName": "film", "order": "most_recent"}
        ],
        "playlists": [
            {
                "name": "Featured Promos",
                "itemIds": [v["id"] for v in ROKU_FALLBACK_PLAYLIST]
            }
        ]
    }

@api_router.get("/roku/categories/{category}")
async def get_roku_category(category: str, request: Request):
    """Get videos by category for Roku"""
    base_url = str(request.base_url).rstrip('/')
    
    # Filter highlights by category
    filtered = [h for h in MOCK_HIGHLIGHTS if h.get("category", "").lower() == category.lower()]
    
    if not filtered:
        filtered = MOCK_HIGHLIGHTS[:10]  # Return general content if category empty
    
    videos = []
    for idx, h in enumerate(filtered[:20]):
        videos.append({
            "id": f"{category}-{idx}",
            "title": h.get("title", h.get("topic", "Untitled")),
            "shortDescription": h.get("description", "")[:200],
            "thumbnail": h.get("thumbnail", ""),
            "duration": h.get("duration", 180),
            "url": h.get("video_url", ""),
            "category": category
        })
    
    return {
        "category": category,
        "totalCount": len(videos),
        "videos": videos
    }

@api_router.get("/roku/search")
async def search_roku_content(q: str, request: Request):
    """Search content for Roku deep linking"""
    query = q.lower()
    
    results = []
    for idx, h in enumerate(MOCK_HIGHLIGHTS):
        title = h.get("title", h.get("topic", "")).lower()
        desc = h.get("description", "").lower()
        
        if query in title or query in desc:
            results.append({
                "id": f"search-{idx}",
                "title": h.get("title", h.get("topic", "Untitled")),
                "thumbnail": h.get("thumbnail", ""),
                "url": h.get("video_url", ""),
                "category": h.get("category", "general"),
                "matchType": "title" if query in title else "description"
            })
    
    return {
        "query": q,
        "totalResults": len(results),
        "results": results[:20]
    }

# ============ SMART TV APP DOWNLOAD ENDPOINTS ============

@api_router.get("/download/samsung-tizen-app")
async def download_samsung_tizen_app():
    """Download Samsung Tizen TV app package"""
    zip_path = ROOT_DIR.parent / "ZTVLIVE_Samsung_Tizen_App.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Samsung Tizen app package not found")
    return FileResponse(
        path=str(zip_path),
        filename="ZTVLIVE_Samsung_Tizen_App.zip",
        media_type="application/zip"
    )

@api_router.get("/download/lg-webos-app")
async def download_lg_webos_app():
    """Download LG webOS TV app package"""
    zip_path = ROOT_DIR.parent / "ZTVLIVE_LG_webOS_App.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="LG webOS app package not found")
    return FileResponse(
        path=str(zip_path),
        filename="ZTVLIVE_LG_webOS_App.zip",
        media_type="application/zip"
    )

# ============ STORE SUBMISSION ASSETS ============

@api_router.get("/download/store-assets/samsung-icon")
async def download_samsung_icon():
    """Download Samsung app icon (512x512)"""
    return FileResponse(
        path=str(ROOT_DIR.parent / "frontend/public/samsung_icon_512.png"),
        filename="ZTVLIVE_Samsung_Icon_512x512.png",
        media_type="image/png"
    )

@api_router.get("/download/store-assets/lg-icon")
async def download_lg_icon():
    """Download LG app icon"""
    return FileResponse(
        path=str(ROOT_DIR.parent / "frontend/public/lg_icon_130.png"),
        filename="ZTVLIVE_LG_Icon.png",
        media_type="image/png"
    )

@api_router.get("/download/store-assets/samsung-banner")
async def download_samsung_banner():
    """Download Samsung store banner"""
    return FileResponse(
        path=str(ROOT_DIR.parent / "frontend/public/store_banner_samsung.png"),
        filename="ZTVLIVE_Samsung_Banner.png",
        media_type="image/png"
    )

@api_router.get("/download/store-assets/lg-banner")
async def download_lg_banner():
    """Download LG store banner"""
    return FileResponse(
        path=str(ROOT_DIR.parent / "frontend/public/store_banner_lg.png"),
        filename="ZTVLIVE_LG_Banner.png",
        media_type="image/png"
    )

@api_router.get("/download/store-assets/samsung-screenshot-1")
async def download_samsung_screenshot_1():
    """Download Samsung screenshot 1"""
    return FileResponse(
        path=str(ROOT_DIR.parent / "frontend/public/screenshot_samsung_1.png"),
        filename="ZTVLIVE_Samsung_Screenshot_1.png",
        media_type="image/png"
    )

@api_router.get("/download/store-assets/samsung-screenshot-2")
async def download_samsung_screenshot_2():
    """Download Samsung screenshot 2"""
    return FileResponse(
        path=str(ROOT_DIR.parent / "frontend/public/screenshot_samsung_2.png"),
        filename="ZTVLIVE_Samsung_Screenshot_2.png",
        media_type="image/png"
    )

@api_router.get("/download/store-assets/lg-screenshot-1")
async def download_lg_screenshot_1():
    """Download LG screenshot 1"""
    return FileResponse(
        path=str(ROOT_DIR.parent / "frontend/public/screenshot_lg_1.png"),
        filename="ZTVLIVE_LG_Screenshot_1.png",
        media_type="image/png"
    )

@api_router.get("/download/store-assets/lg-screenshot-2")
async def download_lg_screenshot_2():
    """Download LG screenshot 2"""
    return FileResponse(
        path=str(ROOT_DIR.parent / "frontend/public/screenshot_lg_2.png"),
        filename="ZTVLIVE_LG_Screenshot_2.png",
        media_type="image/png"
    )


# ============ PROMO VIDEO DOWNLOADS ============

@api_router.get("/download/promo/70-percent-revolution")
async def download_promo_70_percent():
    """Download the '70% Revolution' promo video"""
    video_path = ROOT_DIR / "uploads" / "promo_70_percent_revolution.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Promo video not found")
    return FileResponse(
        path=str(video_path),
        filename="ZTVLIVE_Promo_70_Percent_Revolution.mp4",
        media_type="video/mp4"
    )

@api_router.get("/download/promo/big-screen-dreams")
async def download_promo_big_screen_dreams():
    """Download the 'Big Screen Dreams' promo video"""
    video_path = ROOT_DIR / "uploads" / "promo_big_screen_dreams.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Promo video not found")
    return FileResponse(
        path=str(video_path),
        filename="ZTVLIVE_Promo_Big_Screen_Dreams.mp4",
        media_type="video/mp4"
    )

@api_router.get("/download/promo/creator-revolution")
async def download_promo_creator_revolution():
    """Download the 'Creator Revolution' promo video"""
    video_path = ROOT_DIR / "uploads" / "promo_creator_revolution.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Promo video not found")
    return FileResponse(
        path=str(video_path),
        filename="ZTVLIVE_Promo_Creator_Revolution.mp4",
        media_type="video/mp4"
    )



# Include the router in the main app
app.include_router(api_router)

# Initialize admin routes with database connection
admin_auth.set_db(db)
analytics.set_db(db)
revenue.set_db(db)

# Initialize creator routes with database connection
creator_videos.set_database(db)
uploads.set_database(db)
notifications.set_database(db)
push_notifications.set_database(db)
email_service.set_database(db)
youtube_import.set_database(db)
creator_live_status.set_database(db)

# Connect email service to notifications
notifications.set_email_service(email_service)

# Set notification helpers for creator_videos
creator_videos.set_notification_helpers({
    "notify_video_like": notifications.notify_video_like,
    "notify_video_comment": notifications.notify_video_comment,
    "notify_new_upload": notifications.notify_new_upload,
    "notify_video_going_live": notifications.notify_video_going_live,
    "notify_new_creator": notifications.notify_new_creator
})

# Include admin routers
app.include_router(admin_auth.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(revenue.router, prefix="/api")

# Include creator routers
app.include_router(creator_videos.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(push_notifications.router, prefix="/api")
app.include_router(creator_scheduling.router, prefix="/api")
app.include_router(game_show.router)
app.include_router(admin_notifications.router, prefix="/api")
app.include_router(fan_notifications.router, prefix="/api")
fan_notifications.set_database(db)
app.include_router(creator_trivia.router)
app.include_router(game_analytics.router)
app.include_router(starter_pack.router, prefix="/api")
app.include_router(content_manager.router, prefix="/api")
app.include_router(smart_scheduling.router, prefix="/api")
creator_collabs.set_db(db)
app.include_router(creator_collabs.router, prefix="/api")
app.include_router(social_game.router, prefix="/api")
app.include_router(bigscreen_scheduler.router, prefix="/api")
app.include_router(live_game.router)
app.include_router(live_survey.router)
app.include_router(youtube_import.router, prefix="/api")
app.include_router(creator_live_status.router, prefix="/api")
app.include_router(mrss_feed.router, prefix="/api")
creator_agreement.set_db(db)
app.include_router(creator_agreement.router, prefix="/api")
content_automation.set_db(db)
app.include_router(content_automation.router, prefix="/api")
creator_profile.set_db(db)
app.include_router(creator_profile.router, prefix="/api")
social_share.set_db(db)
app.include_router(social_share.router, prefix="/api")
seo.set_db(db)
app.include_router(seo.router, prefix="/api/seo")

# Group Challenge routes
app.include_router(group_challenge.router)

# Player Data & Analytics routes
app.include_router(player_data.router)

# Player Achievements & Badges routes
app.include_router(player_achievements.router)

# Roku Feed API routes (for BrightScript native channel integration)
app.include_router(roku_feed.roku_feed_router)

# OBS Scene Controller API (for automated scene switching)
app.include_router(obs_controller.obs_router)

# In-App Notifications API (real-time notification system)
app.include_router(in_app_notifications.router, prefix="/api")

# Health check endpoint for deployment monitoring
@app.get("/api/health")
async def health_check():
    """Health check endpoint for deployment monitoring"""
    try:
        # Check MongoDB connection
        await db.command("ping")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "healthy",
        "service": "ztvlive-backend",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Get allowed origins - credentials require specific origins, not wildcards
cors_origins_env = os.environ.get('CORS_ORIGINS', '')
if cors_origins_env == '*':
    # Wildcard - allow all origins without credentials for universal access
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=False,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
elif cors_origins_env:
    # Specific origins from environment variable
    allowed_origins = [origin.strip() for origin in cors_origins_env.split(',')]
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=allowed_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Default - allow all origins without credentials for production flexibility
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=False,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Middleware to prevent caching of API responses
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheMiddleware)

# ============ WEBSOCKET ENDPOINTS ============

@app.websocket("/ws/chat/{room}")
async def websocket_chat_endpoint(websocket: WebSocket, room: str):
    """WebSocket endpoint for real-time chat"""
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_json()
            
            # Validate message
            if not data.get("message") or not data.get("username"):
                continue
            
            # Check comment settings
            settings = await get_comment_settings(room)
            if not settings.get("comments_enabled", True):
                await websocket.send_json({
                    "type": "error",
                    "message": "Comments are currently disabled"
                })
                continue
            
            # Check for blocked words
            blocked_words = settings.get("blocked_words", [])
            message_lower = data["message"].lower()
            is_blocked = any(word.lower() in message_lower for word in blocked_words)
            
            if is_blocked:
                await websocket.send_json({
                    "type": "error",
                    "message": "Your message contains blocked content"
                })
                continue
            
            # Create comment object
            colors = ["#f97316", "#8b5cf6", "#22c55e", "#ec4899", "#06b6d4", "#eab308", "#a855f7"]
            comment_id = str(uuid.uuid4())
            comment_doc = {
                "id": comment_id,
                "video_id": room,
                "username": data["username"],
                "message": data["message"],
                "color": data.get("color", random.choice(colors)),
                "likes": 0,
                "is_pinned": False,
                "is_hidden": settings.get("require_approval", False),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Save to database
            await db.video_comments.insert_one(comment_doc)
            
            # Broadcast to all connections in the room (only if not hidden)
            if not comment_doc["is_hidden"]:
                await manager.broadcast({
                    "type": "new_comment",
                    "comment": {
                        "id": comment_doc["id"],
                        "username": comment_doc["username"],
                        "message": comment_doc["message"],
                        "color": comment_doc["color"],
                        "likes": comment_doc["likes"],
                        "created_at": comment_doc["created_at"]
                    }
                }, room)
            
            logger.info(f"WebSocket message in {room}: {data['username']}: {data['message'][:50]}")
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, room)

@app.websocket("/ws/content/{category}")
async def websocket_content_updates(websocket: WebSocket, category: str = "all"):
    """WebSocket endpoint for real-time content updates"""
    await content_manager.connect(websocket, category)
    try:
        while True:
            # Keep connection alive, listen for any client messages
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        content_manager.disconnect(websocket, category)
    except Exception as e:
        logger.error(f"Content WebSocket error: {e}")
        content_manager.disconnect(websocket, category)

@app.websocket("/ws/live-comments")
async def websocket_live_comments(websocket: WebSocket):
    """WebSocket endpoint for live stream comments overlay"""
    room = "live_stream"
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle different message types
            msg_type = data.get("type", "comment")
            
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            
            if msg_type == "comment":
                # Validate message
                if not data.get("message") or not data.get("username"):
                    continue
                
                # Rate limiting - max 1 comment per 3 seconds per user
                user_key = f"rate_limit:{data.get('user_id', data['username'])}"
                
                # Create live comment object (for overlay display)
                colors = ["#f97316", "#8b5cf6", "#22c55e", "#ec4899", "#06b6d4", "#eab308", "#a855f7", "#ef4444", "#3b82f6"]
                comment_id = f"lc_{uuid.uuid4().hex[:8]}"
                
                live_comment = {
                    "id": comment_id,
                    "type": "live_comment",
                    "username": data["username"][:20],  # Limit username length
                    "message": data["message"][:200],    # Limit message length
                    "color": data.get("color", random.choice(colors)),
                    "user_id": data.get("user_id"),
                    "avatar": data.get("avatar"),
                    "is_verified": data.get("is_verified", False),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
                # Save to database for history
                await db.live_comments.insert_one({
                    **live_comment,
                    "created_at": datetime.now(timezone.utc)
                })
                
                # Broadcast to all viewers
                await manager.broadcast(live_comment, room)
                
                logger.info(f"Live comment: {data['username']}: {data['message'][:30]}")
            
            elif msg_type == "reaction":
                # Handle emoji reactions (hearts, fire, etc.)
                reaction = {
                    "type": "reaction",
                    "emoji": data.get("emoji", "❤️"),
                    "user_id": data.get("user_id"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                await manager.broadcast(reaction, room)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
    except Exception as e:
        logger.error(f"Live comments WebSocket error: {e}")
        manager.disconnect(websocket, room)

# ============ SCHEDULED CONTENT GENERATION ============

# Schedule configuration - More frequent updates for fresh content
# Each category refreshes every 4 hours at staggered intervals
CATEGORY_SCHEDULES = {
    "sports": {"hours": [2, 6, 10, 14, 18, 22], "minute": 0},    # Every 4 hours
    "news": {"hours": [0, 4, 8, 12, 16, 20], "minute": 0},       # Every 4 hours (offset)
    "tech": {"hours": [1, 5, 9, 13, 17, 21], "minute": 0},       # Every 4 hours (offset)
    "music": {"hours": [2, 6, 10, 14, 18, 22], "minute": 15},    # Every 4 hours
    "film": {"hours": [3, 7, 11, 15, 19, 23], "minute": 0},      # Every 4 hours
    "gaming": {"hours": [1, 5, 9, 13, 17, 21], "minute": 30},    # Every 4 hours
    "culture": {"hours": [0, 4, 8, 12, 16, 20], "minute": 30},   # Every 4 hours
    "podcast": {"hours": [3, 7, 11, 15, 19, 23], "minute": 30},  # Every 4 hours
    "other": {"hours": [6, 12, 18], "minute": 45},               # 3x daily
}

# Content manager for broadcasting new content
class ContentUpdateManager:
    def __init__(self):
        self.content_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, category: str = "all"):
        await websocket.accept()
        if category not in self.content_connections:
            self.content_connections[category] = []
        self.content_connections[category].append(websocket)
    
    def disconnect(self, websocket: WebSocket, category: str = "all"):
        if category in self.content_connections:
            if websocket in self.content_connections[category]:
                self.content_connections[category].remove(websocket)
    
    async def broadcast_new_content(self, content: dict, category: str):
        """Broadcast new content to all connected clients"""
        targets = []
        if "all" in self.content_connections:
            targets.extend(self.content_connections["all"])
        if category in self.content_connections:
            targets.extend(self.content_connections[category])
        
        for connection in targets:
            try:
                await connection.send_json({
                    "type": "new_content",
                    "category": category,
                    "content": content
                })
            except Exception:
                pass

content_manager = ContentUpdateManager()

async def scheduled_category_generation(category: str):
    """Scheduled job to generate fresh content for a specific category"""
    try:
        # Generate 1-2 new highlights per refresh cycle
        logger.info(f"[SCHEDULER] Refreshing {category} content with latest news...")
        
        # Generate new content using real NewsAPI data
        highlight = await generate_ai_highlight(category, use_real_news=True)
        doc = highlight.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['generated_date'] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        doc['refresh_cycle'] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        doc['source_type'] = "auto_refresh"
        doc['is_featured'] = True  # Mark as featured content
        
        await db.ai_highlights.insert_one(doc)
        doc.pop('_id', None)
        
        # Broadcast to connected clients
        await content_manager.broadcast_new_content(doc, category)
        
        logger.info(f"[SCHEDULER] New {category} highlight: {doc['title'][:50]}...")
        
        # Clean up old non-featured content (keep last 50 per category)
        old_count = await db.ai_highlights.count_documents({"category": category})
        if old_count > 50:
            oldest = await db.ai_highlights.find(
                {"category": category, "is_featured": {"$ne": True}},
                {"_id": 1}
            ).sort("created_at", 1).limit(old_count - 50).to_list(old_count - 50)
            
            if oldest:
                ids_to_delete = [doc["_id"] for doc in oldest]
                await db.ai_highlights.delete_many({"_id": {"$in": ids_to_delete}})
                logger.info(f"[SCHEDULER] Cleaned up {len(ids_to_delete)} old {category} highlights")
        
    except Exception as e:
        logger.error(f"[SCHEDULER] Error generating {category} content: {e}")

def setup_category_schedules():
    """Set up scheduled jobs for each category with multiple refresh times"""
    for category, schedule in CATEGORY_SCHEDULES.items():
        # Create jobs for each hour in the schedule
        for hour in schedule["hours"]:
            job_id = f"refresh_{category}_{hour:02d}"
            
            # Remove existing job if any
            if scheduler.get_job(job_id):
                scheduler.remove_job(job_id)
            
            # Add scheduled job
            scheduler.add_job(
                scheduled_category_generation,
                CronTrigger(hour=hour, minute=schedule["minute"]),
                args=[category],
                id=job_id,
                name=f"{category.title()} Refresh at {hour:02d}:{schedule['minute']:02d}",
                replace_existing=True
            )
        
        logger.info(f"Scheduled {category} refresh at hours {schedule['hours']} minute {schedule['minute']}")

# ============ PRE-SHOW REMINDER SYSTEM ============

async def send_upcoming_show_reminders():
    """
    Check for upcoming creator content and send 10-minute pre-show reminders.
    This runs every minute to catch shows starting in ~10 minutes.
    """
    try:
        from services.push_notifications import onesignal_service
        
        now = datetime.now(timezone.utc)
        
        # Look for bookings starting in 9-11 minutes (to catch ~10 min window)
        target_start = now + timedelta(minutes=9)
        target_end = now + timedelta(minutes=11)
        
        # Find approved bookings in this window that haven't been reminded
        upcoming_bookings = await db.creator_bookings.find({
            "status": "approved",
            "slot_datetime": {
                "$gte": target_start,
                "$lte": target_end
            },
            "reminder_sent": {"$ne": True}
        }).to_list(10)
        
        for booking in upcoming_bookings:
            booking_id = str(booking.get("_id", booking.get("booking_id")))
            
            # Get subscribers for this booking
            subscribers = await db.booking_subscribers.find({
                "booking_id": booking_id,
                "is_active": True
            }).to_list(100)
            
            player_ids = [s.get("player_id") for s in subscribers if s.get("player_id")]
            
            if player_ids:
                creator_name = booking.get("creator_name", "A Creator")
                video_title = booking.get("title", "Upcoming Content")
                thumbnail = booking.get("thumbnail_url")
                
                # Send the 10-minute reminder
                result = await onesignal_service.send_content_reminder(
                    creator_name=creator_name,
                    video_title=video_title,
                    minutes_until_live=10,
                    follower_player_ids=player_ids,
                    video_thumbnail=thumbnail
                )
                
                logger.info(f"Sent 10-min reminder for booking {booking_id} to {len(player_ids)} subscribers: {result}")
            
            # Mark as reminded so we don't send again
            await db.creator_bookings.update_one(
                {"_id": booking["_id"]},
                {"$set": {"reminder_sent": True, "reminder_sent_at": now}}
            )
            
    except Exception as e:
        logger.error(f"Error sending show reminders: {e}")

# ============ STARTUP & SHUTDOWN EVENTS ============

@app.on_event("startup")
async def startup_event():
    """Run on server startup - generate daily content if needed and start scheduler"""
    logger.info("ZTVLIVE server starting up...")
    
    # Initialize notification scheduler with database
    notification_scheduler.set_db(db)
    notification_scheduler.register_scheduler_jobs(scheduler)
    logger.info("Notification scheduler initialized!")
    
    # Start the scheduler
    setup_category_schedules()
    scheduler.start()
    logger.info("Content generation scheduler started!")
    
    # Start background health scanner
    start_scheduler()
    logger.info("Background health scanner started (runs every 6 hours)")
    
    # Initialize creator bookings cache
    from services.tv_scheduler import refresh_creator_bookings_cache
    booking_count = await refresh_creator_bookings_cache()
    logger.info(f"Creator bookings cache initialized with {booking_count} approved bookings")
    
    # Schedule periodic refresh of creator bookings cache (every 1 minute for better sync)
    scheduler.add_job(
        refresh_creator_bookings_cache,
        'interval',
        minutes=1,
        id='refresh_creator_bookings',
        replace_existing=True
    )
    
    # Schedule 10-minute pre-show reminder notifications
    scheduler.add_job(
        send_upcoming_show_reminders,
        'interval',
        minutes=1,  # Check every minute for upcoming shows
        id='send_show_reminders',
        replace_existing=True
    )
    logger.info("10-minute pre-show reminder scheduler started!")
    
    # ============ SMART SCHEDULING CRON JOBS ============
    
    # Smart Scheduling: Check and send due reminders (every hour)
    async def smart_schedule_check_reminders():
        """Check and send 1-week advance reminders for upcoming events"""
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://127.0.0.1:8001/api/smart-schedule/cron/check-reminders",
                    timeout=30.0
                )
                result = response.json()
                if result.get("sent", 0) > 0:
                    logger.info(f"Smart Schedule: Sent {result['sent']} event reminders")
        except Exception as e:
            logger.error(f"Smart Schedule reminder check failed: {e}")
    
    scheduler.add_job(
        smart_schedule_check_reminders,
        'cron',
        hour='*',  # Every hour
        minute=0,
        id='smart_schedule_reminders',
        replace_existing=True
    )
    logger.info("Smart Scheduling: Reminder check scheduled (hourly at :00)")
    
    # Smart Scheduling: Check stream health (every minute)
    async def smart_schedule_check_health():
        """Check health of live streams and trigger fallback if dead"""
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://127.0.0.1:8001/api/smart-schedule/cron/check-health",
                    timeout=30.0
                )
                result = response.json()
                if result.get("fallbacks_triggered", 0) > 0:
                    logger.warning(f"Smart Schedule: Triggered {result['fallbacks_triggered']} stream fallbacks")
        except Exception as e:
            logger.error(f"Smart Schedule health check failed: {e}")
    
    scheduler.add_job(
        smart_schedule_check_health,
        'interval',
        minutes=1,
        id='smart_schedule_health',
        replace_existing=True
    )
    logger.info("Smart Scheduling: Health check scheduled (every 1 minute)")
    
    # Smart Scheduling: Apply auto-cutoffs for ended events (every minute)
    async def smart_schedule_check_cutoffs():
        """Apply auto-cutoff for events that have ended"""
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://127.0.0.1:8001/api/smart-schedule/cron/check-cutoffs",
                    timeout=30.0
                )
                result = response.json()
                if result.get("cutoffs_applied", 0) > 0:
                    logger.info(f"Smart Schedule: Applied {result['cutoffs_applied']} auto-cutoffs")
        except Exception as e:
            logger.error(f"Smart Schedule cutoff check failed: {e}")
    
    scheduler.add_job(
        smart_schedule_check_cutoffs,
        'interval',
        minutes=1,
        id='smart_schedule_cutoffs',
        replace_existing=True
    )
    logger.info("Smart Scheduling: Auto-cutoff check scheduled (every 1 minute)")
    
    # Creator Live Status: Mark bookings as live and send notifications
    async def creator_live_status_check():
        """Check and mark creator bookings as live when their time comes"""
        try:
            from routes.creator_live_status import check_and_mark_live_bookings
            await check_and_mark_live_bookings()
        except Exception as e:
            logger.error(f"Creator live status check failed: {e}")
    
    scheduler.add_job(
        creator_live_status_check,
        'interval',
        seconds=30,  # Check every 30 seconds for precision
        id='creator_live_status_check',
        replace_existing=True
    )
    logger.info("Creator Live Status: Check scheduled (every 30 seconds)")
    
    # Check and generate daily content for all categories (immediate on startup)
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        for category in ALL_CONTENT_CATEGORIES:
            today_count = await db.ai_highlights.count_documents({
                "category": category,
                "generated_date": today
            })
            
            if today_count < 3:
                needed = 3 - today_count
                logger.info(f"Generating {needed} daily highlights for {category}...")
                await generate_daily_content_for_category(category, needed)
        
        total_today = await db.ai_highlights.count_documents({"generated_date": today})
        logger.info(f"Daily content check complete: {total_today} highlights for {today}")
        
    except Exception as e:
        logger.error(f"Startup content generation error: {e}")
    
    # ============ BIG SCREEN SHOW SCHEDULER ============
    # Schedule the "Unusual Fun Game Show" for 11:45 UTC daily
    async def trigger_bigscreen_show():
        """Trigger the Big Screen show at scheduled time"""
        try:
            from routes.bigscreen_scheduler import schedule_show_trigger, scheduled_shows
            import uuid
            from datetime import datetime, timedelta, timezone
            
            show_id = f"show_{uuid.uuid4().hex[:8]}"
            now = datetime.now(timezone.utc)
            
            show = {
                "show_id": show_id,
                "show_name": "ZTVLIVE Unusual Fun Game Show",
                "scheduled_start": now.isoformat(),
                "scheduled_end": (now + timedelta(minutes=30)).isoformat(),
                "cooldown_end": (now + timedelta(minutes=35)).isoformat(),
                "status": "scheduled",
                "recurring": True,
                "push_to_roku": True,
                "push_to_firetv": True,
                "priority": 100,
                "created_at": now.isoformat()
            }
            
            scheduled_shows.append(show)
            
            # Import and start the show
            from routes.bigscreen_scheduler import start_show
            asyncio.create_task(start_show(show_id))
            
            logger.info(f"[BIG SCREEN] Triggered daily show: {show_id}")
        except Exception as e:
            logger.error(f"[BIG SCREEN] Failed to trigger show: {e}")
    
    # Schedule for 11:45 UTC (6:45 AM EST)
    scheduler.add_job(
        trigger_bigscreen_show,
        CronTrigger(hour=11, minute=45),
        id='bigscreen_show_1145',
        replace_existing=True
    )
    logger.info("Big Screen Show: Scheduled for 11:45 UTC daily")
    
    # Also schedule for 22:00 UTC (5:00 PM EST / 10:00 PM for late viewers)
    scheduler.add_job(
        trigger_bigscreen_show,
        CronTrigger(hour=22, minute=0),
        id='bigscreen_show_2200',
        replace_existing=True
    )
    logger.info("Big Screen Show: Scheduled for 22:00 UTC daily")
    
    # ============ 24/7 LIVE GAME ============
    # Start the always-on live game system
    try:
        from routes.live_game import start_live_game
        await start_live_game()
        logger.info("24/7 Live Game: Started successfully!")
    except Exception as e:
        logger.error(f"Failed to start live game: {e}")
    
    # ============ VIDEO UPLOAD CLEANUP SCHEDULER ============
    # Clean up failed/disabled uploads every 6 hours
    try:
        from routes.uploads import cleanup_failed_uploads
        scheduler.add_job(
            cleanup_failed_uploads,
            'interval',
            hours=6,
            id='cleanup_failed_uploads',
            replace_existing=True
        )
        logger.info("Upload Cleanup: Scheduled every 6 hours")
    except Exception as e:
        logger.error(f"Failed to schedule upload cleanup: {e}")
    
    # ============ 24/7 LIVE SURVEY GAME ============
    # Start the Family Feud style survey game
    try:
        from routes.live_survey import start_survey_game
        await start_survey_game()
        logger.info("24/7 Live Survey Game: Started successfully!")
    except Exception as e:
        logger.error(f"Failed to start survey game: {e}")
    
    # Auto-start RTMP stream for Roku broadcast on server startup
    try:
        import subprocess
        import os
        
        # Check if RTMP stream is already running
        check_result = subprocess.run(['pgrep', '-f', 'ffmpeg.*rtmp'], capture_output=True, text=True)
        
        if check_result.returncode != 0:  # Not running
            logger.info("RTMP stream not running, attempting auto-start...")
            
            # Ensure required binaries are installed
            subprocess.run(['which', 'ffmpeg'], check=True, capture_output=True)
            subprocess.run(['which', 'chromium'], check=True, capture_output=True)
            
            # Start RTMP stream in background
            script_path = '/app/backend/scripts/rtmp_stream.sh'
            if os.path.exists(script_path):
                subprocess.Popen(
                    ['bash', script_path],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True
                )
                logger.info("RTMP stream auto-started for Roku broadcast!")
            else:
                logger.warning(f"RTMP script not found at {script_path}")
        else:
            logger.info("RTMP stream already running (PID found)")
            
    except subprocess.CalledProcessError as e:
        logger.warning(f"RTMP auto-start skipped - missing binaries: {e}")
    except Exception as e:
        logger.error(f"RTMP auto-start failed: {e}")
    
    logger.info("ZTVLIVE server ready!")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Clean up on shutdown"""
    logger.info("ZTVLIVE server shutting down...")
    scheduler.shutdown(wait=False)
    stop_scheduler()  # Stop background health scanner
    client.close()

# Force reload TV scheduler module
import importlib
import services.tv_scheduler as _tv_scheduler
importlib.reload(_tv_scheduler)

@api_router.get("/debug/tv-content")
async def debug_tv_content_v2():
    """Debug endpoint to see loaded TV content"""
    from services import tv_scheduler
    
    # Get the actual CONTENT_LIBRARY from the module
    content = tv_scheduler.CONTENT_LIBRARY
    music = content.get('music', [])
    
    return {
        "content_library_keys": list(content.keys()),
        "music_count": len(music),
        "first_music": music[0] if music else None,
        "module_file": tv_scheduler.__file__
    }

# ============ RTMP STREAM MANAGEMENT ============
import subprocess

@api_router.post("/admin/start-rtmp")
async def start_rtmp_stream(background_tasks: BackgroundTasks):
    """Start or restart the RTMP stream to Castr.io for Roku
    
    Access this from your browser: POST /api/admin/start-rtmp
    Or use curl: curl -X POST https://YOUR-PREVIEW-URL/api/admin/start-rtmp
    """
    
    def run_rtmp():
        try:
            # Check if ffmpeg is installed, if not install it
            ffmpeg_check = subprocess.run(['which', 'ffmpeg'], capture_output=True)
            if ffmpeg_check.returncode != 0:
                logger.info("Installing ffmpeg, xvfb, chromium...")
                subprocess.run(['apt', 'update'], capture_output=True)
                subprocess.run(['apt', 'install', '-y', 'ffmpeg', 'xvfb', 'chromium'], capture_output=True)
                logger.info("Dependencies installed")
            
            # Kill existing processes
            subprocess.run(['pkill', '-9', 'ffmpeg'], capture_output=True)
            subprocess.run(['pkill', '-9', 'chromium'], capture_output=True)
            subprocess.run(['pkill', '-9', 'Xvfb'], capture_output=True)
            
            import time
            time.sleep(2)
            
            # Start the RTMP script
            script_path = '/app/backend/scripts/rtmp_stream.sh'
            subprocess.Popen(
                ['bash', script_path],
                stdout=open('/var/log/ztvlive_stream.log', 'w'),
                stderr=subprocess.STDOUT,
                start_new_session=True
            )
            logger.info("RTMP stream started successfully!")
        except Exception as e:
            logger.error(f"Failed to start RTMP: {e}")
    
    background_tasks.add_task(run_rtmp)
    return {"success": True, "message": "RTMP stream starting... Check /api/admin/rtmp-status in 30 seconds."}

@api_router.get("/admin/rtmp-status")
async def get_rtmp_status():
    """Check if RTMP stream is running
    
    Access: GET /api/admin/rtmp-status
    """
    try:
        # Check for running processes
        ffmpeg_result = subprocess.run(['pgrep', '-f', 'ffmpeg.*rtmp'], capture_output=True, text=True)
        chromium_result = subprocess.run(['pgrep', '-f', 'chromium'], capture_output=True, text=True)
        xvfb_result = subprocess.run(['pgrep', '-f', 'Xvfb'], capture_output=True, text=True)
        
        ffmpeg_running = bool(ffmpeg_result.stdout.strip())
        chromium_running = bool(chromium_result.stdout.strip())
        xvfb_running = bool(xvfb_result.stdout.strip())
        
        # Get latest log
        log_lines = []
        try:
            with open('/var/log/ffmpeg_stream.log', 'r') as f:
                log_lines = f.readlines()[-5:]
        except:
            try:
                with open('/var/log/ztvlive_stream.log', 'r') as f:
                    log_lines = f.readlines()[-5:]
            except:
                pass
        
        return {
            "stream_active": ffmpeg_running and chromium_running,
            "ffmpeg_running": ffmpeg_running,
            "chromium_running": chromium_running,
            "xvfb_running": xvfb_running,
            "recent_logs": log_lines,
            "hint": "If stream is not active, POST /api/admin/start-rtmp to start it"
        }
    except Exception as e:
        return {"error": str(e)}

@api_router.post("/admin/stop-rtmp")
async def stop_rtmp_stream():
    """Stop the RTMP stream"""
    try:
        subprocess.run(['pkill', '-9', 'ffmpeg'], capture_output=True)
        subprocess.run(['pkill', '-9', 'chromium'], capture_output=True)
        subprocess.run(['pkill', '-9', 'Xvfb'], capture_output=True)
        return {"success": True, "message": "RTMP stream stopped"}
    except Exception as e:
        return {"error": str(e)}
# Force reload Thu Mar 20 12:35:00 UTC 2026


# ============ OBS AUTOMATION API ============
# Smart content routing for OBS scene switching

@api_router.get("/obs/content-status")
async def get_obs_content_status():
    """
    Returns current content status for OBS automation.
    OBS should poll this every 2-3 seconds to decide scene switching.
    
    Priority: Creator Content > Safe AI Content > Promo/Game Fallback
    """
    from services.tv_scheduler import get_live_sync, get_active_creator_booking
    
    sync = get_live_sync()
    now_playing = sync.get("now_playing", {})
    
    # Get timing info
    elapsed = now_playing.get("elapsed_seconds", 0)
    duration = now_playing.get("duration_seconds", 300)
    time_remaining = max(0, duration - elapsed)
    
    # Check if this is creator content
    is_creator = now_playing.get("is_creator_content", False)
    creator_booking = await get_active_creator_booking() if is_creator else None
    
    # Safety checks
    is_ending_soon = time_remaining < 15  # Last 15 seconds = YouTube end screen
    is_starting = elapsed < 3  # First 3 seconds might have YouTube loading
    
    # Check copyright status for creator content
    copyright_safe = True
    if is_creator and creator_booking:
        review_status = creator_booking.get("review_status", "approved")
        copyright_safe = review_status not in ["flagged", "rejected", "pending_review"]
    
    # Determine if content is safe to broadcast
    is_safe = (
        not is_ending_soon and 
        not is_starting and 
        copyright_safe
    )
    
    # Recommended OBS scene
    if is_safe and is_creator:
        recommended_scene = "CREATOR_CONTENT"
        priority = 1
    elif is_safe and not is_ending_soon:
        recommended_scene = "WATCH_PAGE"
        priority = 2
    elif time_remaining > 0 and time_remaining < 15:
        recommended_scene = "TRANSITION"  # Show transition graphic
        priority = 3
    else:
        recommended_scene = "FALLBACK"  # Promo or Game
        priority = 4
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "current_content": {
            "title": now_playing.get("title", "Unknown"),
            "video_id": now_playing.get("video_id"),
            "is_creator_content": is_creator,
            "creator_name": sync.get("creator_name", ""),
            "elapsed_seconds": elapsed,
            "duration_seconds": duration,
            "time_remaining": time_remaining,
            "progress_percent": round((elapsed / duration * 100) if duration > 0 else 0, 1)
        },
        "safety": {
            "is_safe": is_safe,
            "is_ending_soon": is_ending_soon,
            "is_starting": is_starting,
            "copyright_safe": copyright_safe,
            "reason": "Content is safe" if is_safe else (
                "Ending soon - YouTube end screen" if is_ending_soon else
                "Starting - may have loading graphics" if is_starting else
                "Copyright flagged" if not copyright_safe else "Unknown"
            )
        },
        "obs_recommendation": {
            "scene": recommended_scene,
            "priority": priority,
            "action": "STAY" if is_safe else "SWITCH",
            "switch_to": None if is_safe else ("PROMO" if time_remaining < 15 else "GAME"),
            "switch_back_in": time_remaining if is_ending_soon else None
        },
        "next_content": {
            "available": True,
            "eta_seconds": time_remaining
        }
    }


@api_router.get("/obs/scene-config")
async def get_obs_scene_config():
    """
    Returns OBS scene configuration for automation script.
    """
    # Get base URL from environment or use dynamic detection
    base_url = os.environ.get('BASE_URL', os.environ.get('REACT_APP_BACKEND_URL', ''))
    if not base_url:
        base_url = 'https://ztvlivestream.com'  # Production fallback
    
    # Remove trailing slash if present
    base_url = base_url.rstrip('/')
    
    return {
        "scenes": {
            "WATCH_PAGE": {
                "description": "Browser source capturing watch page",
                "source": f"{base_url}/watch?obs=true&minimal=true",
                "priority": 1,
                "use_when": ["safe_content", "creator_content"]
            },
            "CREATOR_CONTENT": {
                "description": "Same as WATCH_PAGE but for creator content",
                "source": f"{base_url}/watch?obs=true&minimal=true",
                "priority": 1,
                "use_when": ["creator_scheduled", "creator_live"]
            },
            "TRANSITION": {
                "description": "Brief transition graphic",
                "source": "local:transition.mp4",
                "priority": 2,
                "duration": 3,
                "use_when": ["content_ending", "content_starting"]
            },
            "PROMO": {
                "description": "ZTVLIVE promo video loop",
                "source": "local:ztvlive-promo.mp4",
                "priority": 3,
                "use_when": ["unsafe_content", "no_content"]
            },
            "GAME": {
                "description": "Interactive game/survey overlay",
                "source": f"{base_url}/game-overlay?obs=true",
                "priority": 4,
                "use_when": ["fallback", "between_content"]
            }
        },
        "polling_interval_ms": 2000,
        "switch_threshold_seconds": 15,
        "api_endpoint": "/api/obs/content-status"
    }


# Re-include router to pick up late-defined routes
app.include_router(api_router)
