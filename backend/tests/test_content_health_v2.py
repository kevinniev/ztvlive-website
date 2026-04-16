"""
ZTVLIVE Content Health & TV Scheduler API Tests
Tests for: tv/sync, tv/upcoming, tv/health, tv/library
Updated for HLS streaming support
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTVSyncAPI:
    """Tests for /api/tv/sync endpoint - Live streaming sync data"""
    
    def test_tv_sync_returns_200(self):
        """Verify /api/tv/sync returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/tv/sync returns 200")
    
    def test_tv_sync_has_required_fields(self):
        """Verify response has title, category, video_url fields"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        assert "title" in data, "Missing 'title' field"
        assert "category" in data, "Missing 'category' field"
        assert "video_url" in data, "Missing 'video_url' field"
        
        print(f"PASS: /api/tv/sync has required fields - title: {data['title']}, category: {data['category']}")
    
    def test_tv_sync_video_url_is_valid_stream(self):
        """Verify video_url is an HLS stream (.m3u8) or YouTube embed"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        video_url = data.get("video_url", "")
        is_hls = ".m3u8" in video_url
        is_youtube = "youtube.com/embed/" in video_url
        assert is_hls or is_youtube, f"video_url should be HLS (.m3u8) or YouTube embed, got: {video_url}"
        print(f"PASS: video_url is valid stream format: {'HLS' if is_hls else 'YouTube'}")
    
    def test_tv_sync_has_stream_type(self):
        """Verify response includes stream_type field"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        assert "stream_type" in data, "Missing 'stream_type' field"
        assert data["stream_type"] in ["hls", "youtube", "embed"], f"Unexpected stream_type: {data['stream_type']}"
        print(f"PASS: stream_type is {data['stream_type']}")
    
    def test_tv_sync_has_now_playing(self):
        """Verify response has now_playing object with id, title, video_url"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        assert "now_playing" in data, "Missing 'now_playing' object"
        now_playing = data["now_playing"]
        
        assert "id" in now_playing, "now_playing missing 'id'"
        assert "title" in now_playing, "now_playing missing 'title'"
        assert "video_url" in now_playing, "now_playing missing 'video_url'"
        
        print(f"PASS: now_playing has required fields - id: {now_playing['id']}, title: {now_playing['title']}")


class TestTVUpcomingAPI:
    """Tests for /api/tv/upcoming endpoint - Upcoming content schedule"""
    
    def test_tv_upcoming_returns_200(self):
        """Verify /api/tv/upcoming returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/tv/upcoming returns 200")
    
    def test_tv_upcoming_returns_list(self):
        """Verify response has upcoming list"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        data = response.json()
        
        assert "upcoming" in data, "Missing 'upcoming' array"
        assert isinstance(data["upcoming"], list), "upcoming should be a list"
        assert len(data["upcoming"]) > 0, "upcoming list should not be empty"
        
        print(f"PASS: /api/tv/upcoming returns {len(data['upcoming'])} items")
    
    def test_tv_upcoming_items_have_required_fields(self):
        """Verify each upcoming item has id, title, video_url, category"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        data = response.json()
        upcoming = data.get("upcoming", [])
        
        for item in upcoming:
            assert "id" in item, f"Upcoming item missing 'id'"
            assert "title" in item, f"Upcoming item missing 'title'"
            assert "video_url" in item, f"Upcoming item missing 'video_url'"
            assert "category" in item, f"Upcoming item missing 'category'"
        
        print(f"PASS: All upcoming items have required fields (id, title, video_url, category)")


class TestTVHealthAPI:
    """Tests for /api/tv/health endpoint - Content health monitoring"""
    
    def test_tv_health_returns_200(self):
        """Verify /api/tv/health returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/tv/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/tv/health returns 200")
    
    def test_tv_health_has_status(self):
        """Verify response has status field (healthy/degraded)"""
        response = requests.get(f"{BASE_URL}/api/tv/health")
        data = response.json()
        
        assert "status" in data, "Missing 'status' field"
        assert data["status"] in ["healthy", "degraded"], f"status should be 'healthy' or 'degraded', got: {data['status']}"
        
        print(f"PASS: /api/tv/health status: {data['status']}")
    
    def test_tv_health_has_disabled_count(self):
        """Verify response has disabled_count field"""
        response = requests.get(f"{BASE_URL}/api/tv/health")
        data = response.json()
        
        assert "disabled_count" in data, "Missing 'disabled_count' field"
        assert isinstance(data["disabled_count"], int), "disabled_count should be an integer"
        
        print(f"PASS: /api/tv/health disabled_count: {data['disabled_count']}")


class TestNewsTicker:
    """Tests for /api/news/ticker endpoint"""
    
    def test_news_ticker_returns_200(self):
        """Verify /api/news/ticker returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/news/ticker")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/news/ticker returns 200")
    
    def test_news_ticker_has_headlines(self):
        """Verify response has headlines array"""
        response = requests.get(f"{BASE_URL}/api/news/ticker")
        data = response.json()
        
        assert "headlines" in data, "Missing 'headlines' field"
        assert isinstance(data["headlines"], list), "headlines should be a list"
        
        if len(data["headlines"]) > 0:
            headline = data["headlines"][0]
            assert "headline" in headline, "Each headline item should have 'headline' field"
            assert "source" in headline, "Each headline item should have 'source' field"
        
        print(f"PASS: /api/news/ticker has {len(data['headlines'])} headlines")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
