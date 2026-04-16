"""
ZTVLIVE Watch Page API Tests
Tests the TV scheduling, sync, and ticker APIs used by the watch page
"""

import pytest
import requests
import os

# Get API base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://best-bites-live.preview.emergentagent.com').rstrip('/')


class TestTVSyncAPI:
    """Test /api/tv/sync endpoint - core watch page API"""
    
    def test_tv_sync_returns_200(self):
        """GET /api/tv/sync should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"PASS: /api/tv/sync returns 200")
    
    def test_tv_sync_has_required_fields(self):
        """Sync response should have title, video_url, and elapsed_seconds"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        # Check top-level fields
        assert "title" in data, "Missing 'title' field"
        assert "video_url" in data, "Missing 'video_url' field"
        assert "elapsed_seconds" in data, "Missing 'elapsed_seconds' field"
        
        # Validate data types
        assert isinstance(data["title"], str), "title should be string"
        assert isinstance(data["video_url"], str), "video_url should be string"
        assert isinstance(data["elapsed_seconds"], (int, float)), "elapsed_seconds should be numeric"
        
        print(f"PASS: Sync API has all required fields")
        print(f"  Title: {data['title']}")
        print(f"  Video URL: {data['video_url']}")
        print(f"  Elapsed: {data['elapsed_seconds']}s")
    
    def test_tv_sync_video_url_is_youtube_embed(self):
        """video_url should be a valid YouTube embed URL"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        video_url = data.get("video_url", "")
        assert "youtube.com/embed/" in video_url, f"video_url should be YouTube embed, got: {video_url}"
        print(f"PASS: video_url is YouTube embed format")
    
    def test_tv_sync_has_now_playing(self):
        """Sync should include now_playing object"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        assert "now_playing" in data, "Missing 'now_playing' field"
        now_playing = data["now_playing"]
        
        # Check now_playing required fields
        required_fields = ["id", "title", "video_url", "category", "duration_seconds"]
        for field in required_fields:
            assert field in now_playing, f"now_playing missing '{field}'"
        
        print(f"PASS: now_playing has all required fields")


class TestTVUpcomingAPI:
    """Test /api/tv/upcoming endpoint"""
    
    def test_upcoming_returns_200(self):
        """GET /api/tv/upcoming should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"PASS: /api/tv/upcoming returns 200")
    
    def test_upcoming_returns_list(self):
        """Upcoming should return a list of programs"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        data = response.json()
        
        assert "upcoming" in data, "Missing 'upcoming' field"
        assert isinstance(data["upcoming"], list), "upcoming should be a list"
        assert len(data["upcoming"]) > 0, "upcoming should have items"
        
        print(f"PASS: Upcoming returns {len(data['upcoming'])} items")
    
    def test_upcoming_items_have_required_fields(self):
        """Each upcoming item should have required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        data = response.json()
        
        required_fields = ["id", "title", "video_url", "category"]
        
        for i, item in enumerate(data["upcoming"][:3]):  # Check first 3
            for field in required_fields:
                assert field in item, f"Item {i} missing '{field}'"
        
        print(f"PASS: Upcoming items have required fields")
        for item in data["upcoming"][:3]:
            print(f"  - {item['title']} ({item['category']})")


class TestNewsTickerAPI:
    """Test /api/news/ticker endpoint"""
    
    def test_ticker_returns_200(self):
        """GET /api/news/ticker should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/news/ticker")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"PASS: /api/news/ticker returns 200")
    
    def test_ticker_returns_headlines(self):
        """Ticker should return headlines array"""
        response = requests.get(f"{BASE_URL}/api/news/ticker")
        data = response.json()
        
        assert "headlines" in data, "Missing 'headlines' field"
        assert isinstance(data["headlines"], list), "headlines should be a list"
        
        print(f"PASS: Ticker returns {len(data['headlines'])} headlines")
    
    def test_ticker_headlines_have_content(self):
        """Headlines should have headline and source"""
        response = requests.get(f"{BASE_URL}/api/news/ticker")
        data = response.json()
        
        if data["headlines"]:
            headline = data["headlines"][0]
            assert "headline" in headline, "Missing 'headline' field"
            assert "source" in headline, "Missing 'source' field"
            print(f"PASS: Headlines have content")
            print(f"  First headline: {headline['headline'][:50]}...")


class TestTVScheduleAPI:
    """Test /api/tv/schedule endpoint"""
    
    def test_schedule_returns_200(self):
        """GET /api/tv/schedule should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"PASS: /api/tv/schedule returns 200")
    
    def test_schedule_returns_list(self):
        """Schedule should return list of programs"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule")
        data = response.json()
        
        assert isinstance(data, list), "Schedule should return list"
        assert len(data) > 0, "Schedule should have items"
        
        print(f"PASS: Schedule returns {len(data)} programs")


class TestChatAPI:
    """Test /api/chat/messages endpoint"""
    
    def test_chat_messages_returns_200(self):
        """GET /api/chat/messages should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"PASS: /api/chat/messages returns 200")
    
    def test_chat_messages_returns_list(self):
        """Chat should return messages array"""
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        data = response.json()
        
        assert "messages" in data, "Missing 'messages' field"
        assert isinstance(data["messages"], list), "messages should be list"
        
        print(f"PASS: Chat returns {len(data['messages'])} messages")
    
    def test_post_chat_message(self):
        """POST /api/chat/send should add a message"""
        message_data = {
            "id": "test123",
            "username": "TestUser",
            "message": "Test message from pytest",
            "timestamp": "2026-03-12T00:00:00Z"
        }
        
        response = requests.post(f"{BASE_URL}/api/chat/send", json=message_data)
        # Chat endpoint may return 200 or 201
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
        print(f"PASS: Chat message posted successfully")


class TestContentLibrary:
    """Test /api/tv/library endpoint"""
    
    def test_library_returns_200(self):
        """GET /api/tv/library should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"PASS: /api/tv/library returns 200")
    
    def test_library_has_news_category(self):
        """Library should include news category (30-min news blocks feature)"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        assert "categories" in data, "Missing 'categories' field"
        categories = data["categories"]
        
        # Check if news category exists
        assert "news" in categories, "Missing 'news' category (required for 30-min news blocks)"
        
        news_content = categories.get("news", [])
        print(f"PASS: Library has 'news' category with {len(news_content)} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
