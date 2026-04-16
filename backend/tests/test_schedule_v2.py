"""
Test suite for ZTVLIVE Schedule V2 and News Ticker APIs
Tests the new simplified schedule page endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://best-bites-live.preview.emergentagent.com').rstrip('/')

class TestScheduleV2API:
    """Test the new /api/schedule/v2 endpoints"""
    
    def test_get_schedule_v2_returns_24_slots(self):
        """GET /api/schedule/v2 should return 24 hourly time slots"""
        response = requests.get(f"{BASE_URL}/api/schedule/v2")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify 24 slots
        assert "schedule" in data
        assert len(data["schedule"]) == 24
        print(f"SUCCESS: Schedule has {len(data['schedule'])} slots")
        
        # Verify server time and current hour
        assert "current_hour" in data
        assert "server_time" in data
        assert 0 <= data["current_hour"] <= 23
        
    def test_schedule_v2_slot_structure(self):
        """Each schedule slot should have required fields"""
        response = requests.get(f"{BASE_URL}/api/schedule/v2")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check first slot structure
        slot = data["schedule"][0]
        
        required_fields = ["id", "slot_index", "start_time", "end_time", "scheduled_category", "content"]
        for field in required_fields:
            assert field in slot, f"Missing field: {field}"
        
        # Verify content structure
        content = slot["content"]
        content_fields = ["title", "video_url", "thumbnail", "category"]
        for field in content_fields:
            assert field in content, f"Missing content field: {field}"
        
        print(f"SUCCESS: Slot structure verified - title: {content['title'][:30]}...")
        
    def test_schedule_v2_current_slot_marked(self):
        """Current time slot should be marked with is_current=True"""
        response = requests.get(f"{BASE_URL}/api/schedule/v2")
        
        assert response.status_code == 200
        data = response.json()
        
        # Find current slot
        current_slots = [s for s in data["schedule"] if s.get("is_current")]
        
        assert len(current_slots) >= 1, "No current slot marked"
        current_slot = current_slots[0]
        
        # Verify it matches current hour
        assert current_slot["slot_index"] == data["current_hour"]
        print(f"SUCCESS: Current slot at {current_slot['start_time']} marked correctly")
        
    def test_schedule_v2_categories_returned(self):
        """Schedule should return list of valid categories"""
        response = requests.get(f"{BASE_URL}/api/schedule/v2")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "categories" in data
        expected_categories = ["movies", "sports", "buzz", "music", "news", "gaming", "tech"]
        
        for cat in expected_categories:
            assert cat in data["categories"], f"Missing category: {cat}"
        
        print(f"SUCCESS: All {len(expected_categories)} categories present")
        
    def test_schedule_v2_video_urls_format(self):
        """Video URLs should be valid YouTube embed URLs"""
        response = requests.get(f"{BASE_URL}/api/schedule/v2")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check a sample of video URLs
        valid_url_count = 0
        for slot in data["schedule"][:5]:
            video_url = slot["content"].get("video_url", "")
            if "youtube.com/embed/" in video_url:
                valid_url_count += 1
        
        assert valid_url_count >= 3, "Most video URLs should be YouTube embeds"
        print(f"SUCCESS: {valid_url_count}/5 slots have valid YouTube embed URLs")


class TestScheduleV2CurrentEndpoint:
    """Test /api/schedule/v2/current endpoint"""
    
    def test_get_current_programming(self):
        """GET /api/schedule/v2/current returns what's playing now"""
        response = requests.get(f"{BASE_URL}/api/schedule/v2/current")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have current and next_up
        assert "current" in data
        assert "next_up" in data
        assert "current_hour" in data
        
        print(f"SUCCESS: Current: {data['current']['title'][:30]}...")
        print(f"SUCCESS: Next up: {data['next_up']['title'][:30]}...")


class TestScheduleV2CategoryEndpoint:
    """Test /api/schedule/v2/category/{category} endpoint"""
    
    def test_get_sports_category_content(self):
        """GET /api/schedule/v2/category/sports returns sports content"""
        response = requests.get(f"{BASE_URL}/api/schedule/v2/category/sports")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["category"] == "sports"
        assert "content" in data
        assert len(data["content"]) > 0
        
        # All content should be sports category
        for item in data["content"]:
            assert item["category"] == "sports"
        
        print(f"SUCCESS: Found {len(data['content'])} sports items")
        
    def test_invalid_category_returns_400(self):
        """Invalid category should return 400 error"""
        response = requests.get(f"{BASE_URL}/api/schedule/v2/category/invalid_category")
        
        assert response.status_code == 400
        print("SUCCESS: Invalid category returns 400")


class TestScheduleV2CategoriesEndpoint:
    """Test /api/schedule/v2/categories endpoint"""
    
    def test_get_all_categories(self):
        """GET /api/schedule/v2/categories returns all categories with metadata"""
        response = requests.get(f"{BASE_URL}/api/schedule/v2/categories")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "categories" in data
        
        # Each category should have id, name, content_count, color
        for cat in data["categories"]:
            assert "id" in cat
            assert "name" in cat
            assert "content_count" in cat
            assert "color" in cat
        
        print(f"SUCCESS: Found {len(data['categories'])} categories with metadata")


class TestNewsTicker:
    """Test the /api/news/ticker endpoint"""
    
    def test_get_news_ticker(self):
        """GET /api/news/ticker returns headlines"""
        response = requests.get(f"{BASE_URL}/api/news/ticker")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "headlines" in data
        assert "last_updated" in data
        assert len(data["headlines"]) > 0
        
        print(f"SUCCESS: Got {len(data['headlines'])} headlines")
        
    def test_news_ticker_headline_structure(self):
        """Each headline should have required fields"""
        response = requests.get(f"{BASE_URL}/api/news/ticker")
        
        assert response.status_code == 200
        data = response.json()
        
        for headline in data["headlines"]:
            assert "headline" in headline
            assert "source" in headline
            assert len(headline["headline"]) > 0
            assert len(headline["source"]) > 0
        
        print(f"SUCCESS: All {len(data['headlines'])} headlines have valid structure")


class TestSchedulePageIntegration:
    """Integration tests for schedule page data flow"""
    
    def test_schedule_provides_watch_page_data(self):
        """Schedule content should be playable on watch page"""
        # Get current programming
        current_res = requests.get(f"{BASE_URL}/api/schedule/v2/current")
        assert current_res.status_code == 200
        
        current = current_res.json()["current"]
        
        # Video URL should be valid
        assert current.get("video_url")
        assert "youtube.com/embed/" in current["video_url"]
        
        print(f"SUCCESS: Current video is playable: {current['title'][:30]}...")
        
    def test_schedule_matches_categories_endpoint(self):
        """Schedule categories should match categories endpoint"""
        schedule_res = requests.get(f"{BASE_URL}/api/schedule/v2")
        categories_res = requests.get(f"{BASE_URL}/api/schedule/v2/categories")
        
        assert schedule_res.status_code == 200
        assert categories_res.status_code == 200
        
        schedule_cats = set(schedule_res.json()["categories"])
        endpoint_cats = set(c["id"] for c in categories_res.json()["categories"])
        
        # All schedule categories should have matching endpoint categories
        for cat in schedule_cats:
            assert cat in endpoint_cats, f"Category {cat} not in categories endpoint"
        
        print(f"SUCCESS: All schedule categories have matching endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
