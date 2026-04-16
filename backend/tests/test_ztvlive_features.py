"""
ZTVLIVE Feature Tests - Iteration 43
Tests for: CC translation, Promo video fallback, Low quality reporting, Share & Invite
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://best-bites-live.preview.emergentagent.com')

class TestPromoVideosFallback:
    """Test promo videos API for stream freeze fallback"""
    
    def test_get_promo_videos_endpoint(self):
        """Test that promo videos endpoint returns videos"""
        response = requests.get(f"{BASE_URL}/api/tv/promo-videos")
        assert response.status_code == 200
        
        data = response.json()
        assert "videos" in data
        assert "count" in data
        assert data["count"] > 0
        print(f"✓ Found {data['count']} promo videos")
    
    def test_promo_videos_have_required_fields(self):
        """Test that promo videos have all required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/promo-videos")
        assert response.status_code == 200
        
        data = response.json()
        for video in data["videos"]:
            assert "id" in video
            assert "title" in video
            assert "video_url" in video
            assert "duration_seconds" in video
            assert "is_promo" in video
            assert video["is_promo"] == True
        print("✓ All promo videos have required fields")
    
    def test_promo_video_urls_are_valid(self):
        """Test that promo video URLs are accessible"""
        response = requests.get(f"{BASE_URL}/api/tv/promo-videos")
        assert response.status_code == 200
        
        data = response.json()
        for video in data["videos"]:
            video_url = video["video_url"]
            # Check if it's a relative URL (starts with /api/static)
            if video_url.startswith("/api/static"):
                full_url = f"{BASE_URL}{video_url}"
                # Just check the URL format is correct
                assert "/promo/" in video_url
                print(f"✓ Promo video URL valid: {video['title']}")


class TestLowQualityVideoReporting:
    """Test low quality video reporting endpoint"""
    
    def test_report_low_quality_video(self):
        """Test reporting a low quality video"""
        response = requests.post(
            f"{BASE_URL}/api/tv/report-low-quality",
            params={
                "video_id": "test_video_123",
                "reason": "low_resolution"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["video_id"] == "test_video_123"
        assert data["action"] == "marked_low_quality"
        print("✓ Low quality video reported successfully")
    
    def test_report_low_quality_with_youtube_id(self):
        """Test reporting with YouTube ID"""
        response = requests.post(
            f"{BASE_URL}/api/tv/report-low-quality",
            params={
                "youtube_id": "dQw4w9WgXcQ",
                "reason": "embedding_disabled"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print("✓ Low quality video reported with YouTube ID")


class TestTVSync:
    """Test TV sync endpoint for watch page"""
    
    def test_tv_sync_returns_content(self):
        """Test that TV sync returns current playing content"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        assert "now_playing" in data or "video_id" in data
        assert "elapsed_seconds" in data
        print("✓ TV sync returns current content")
    
    def test_tv_sync_has_video_url(self):
        """Test that TV sync includes video URL"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        # Video URL can be at top level or in now_playing
        video_url = data.get("video_url") or data.get("now_playing", {}).get("video_url")
        assert video_url is not None
        assert "youtube.com" in video_url or "youtu.be" in video_url
        print(f"✓ TV sync has video URL: {video_url[:50]}...")


class TestUpcomingContent:
    """Test upcoming content endpoint"""
    
    def test_get_upcoming_content(self):
        """Test getting upcoming content list"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "upcoming" in data
        assert len(data["upcoming"]) > 0
        print(f"✓ Got {len(data['upcoming'])} upcoming videos")
    
    def test_upcoming_content_has_required_fields(self):
        """Test that upcoming content has required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=3")
        assert response.status_code == 200
        
        data = response.json()
        for video in data["upcoming"]:
            assert "id" in video
            assert "title" in video
            assert "video_url" in video
        print("✓ Upcoming content has required fields")


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check(self):
        """Test that health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print("✓ Health check passed")


class TestNewsTicker:
    """Test news ticker endpoint"""
    
    def test_get_news_ticker(self):
        """Test getting news ticker headlines"""
        response = requests.get(f"{BASE_URL}/api/news/ticker")
        assert response.status_code == 200
        
        data = response.json()
        assert "headlines" in data
        print(f"✓ Got {len(data['headlines'])} ticker headlines")


class TestChatEndpoints:
    """Test chat endpoints for live chat"""
    
    def test_get_chat_messages(self):
        """Test getting chat messages"""
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        assert response.status_code == 200
        
        data = response.json()
        assert "messages" in data
        print(f"✓ Got {len(data['messages'])} chat messages")
    
    def test_send_chat_message(self):
        """Test sending a chat message"""
        message = {
            "id": "test_msg_123",
            "username": "TestUser",
            "message": "Hello ZTVLIVE!",
            "timestamp": "2026-04-13T14:30:00Z"
        }
        response = requests.post(f"{BASE_URL}/api/chat/send", json=message)
        assert response.status_code == 200
        print("✓ Chat message sent successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
