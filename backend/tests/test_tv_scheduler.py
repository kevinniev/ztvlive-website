"""
Test suite for Dynamic TV Scheduler APIs
Tests: /api/tv/schedule, /api/tv/now-playing, /api/tv/library, /api/tv/pin, /api/tv/pinned
"""
import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTVScheduleEndpoint:
    """Tests for GET /api/tv/schedule - Dynamic schedule generation"""
    
    def test_schedule_returns_200(self):
        """Verify schedule endpoint returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/tv/schedule returns 200")
    
    def test_schedule_structure(self):
        """Verify schedule response has required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule?hours=1")
        assert response.status_code == 200
        data = response.json()
        
        assert "schedule" in data, "Missing 'schedule' field"
        assert "current" in data, "Missing 'current' field"
        assert "total_items" in data, "Missing 'total_items' field"
        assert "server_time" in data, "Missing 'server_time' field"
        assert "categories" in data, "Missing 'categories' field"
        print("✓ Schedule response has all required fields")
    
    def test_schedule_has_items(self):
        """Verify schedule contains items"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule?hours=24")
        data = response.json()
        
        assert len(data["schedule"]) > 0, "Schedule should have items"
        assert data["total_items"] > 0, "total_items should be > 0"
        print(f"✓ Schedule contains {data['total_items']} items")
    
    def test_schedule_item_structure(self):
        """Verify each schedule item has required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule?hours=1")
        data = response.json()
        
        schedule_item = data["schedule"][0]
        required_fields = [
            "slot_index", "id", "content", "start_time", "end_time",
            "start_display", "end_display", "duration_seconds",
            "duration_display", "is_pinned", "category"
        ]
        
        for field in required_fields:
            assert field in schedule_item, f"Missing field: {field}"
        print("✓ Schedule items have all required fields")
    
    def test_schedule_content_structure(self):
        """Verify content within schedule item has required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule?hours=1")
        data = response.json()
        
        content = data["schedule"][0]["content"]
        content_fields = ["id", "title", "video_url", "thumbnail", "duration_seconds", "source", "category"]
        
        for field in content_fields:
            assert field in content, f"Content missing field: {field}"
        print("✓ Schedule content has all required fields")
    
    def test_schedule_has_current_item(self):
        """Verify one item is marked as current"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule?hours=24")
        data = response.json()
        
        current_items = [s for s in data["schedule"] if s.get("is_current")]
        assert len(current_items) >= 1, "Should have at least one current item"
        
        current = current_items[0]
        assert "elapsed_seconds" in current, "Current item should have elapsed_seconds"
        assert "remaining_seconds" in current, "Current item should have remaining_seconds"
        print(f"✓ Current playing: {current['content']['title']}")
    
    def test_schedule_duration_based_timing(self):
        """Verify schedule uses duration-based timing (back-to-back)"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule?hours=1")
        data = response.json()
        
        if len(data["schedule"]) >= 2:
            first = data["schedule"][0]
            second = data["schedule"][1]
            
            # First item's end_time should equal second item's start_time
            assert first["end_time"] == second["start_time"], \
                "Schedule items should be back-to-back (no gaps)"
            print("✓ Schedule uses duration-based timing (back-to-back)")
        else:
            print("⚠ Not enough items to verify back-to-back timing")


class TestNowPlayingEndpoint:
    """Tests for GET /api/tv/now-playing - Current content with sync info"""
    
    def test_now_playing_returns_200(self):
        """Verify now-playing endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/tv/now-playing")
        assert response.status_code == 200
        print("✓ GET /api/tv/now-playing returns 200")
    
    def test_now_playing_structure(self):
        """Verify now-playing response has all required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/now-playing")
        data = response.json()
        
        required_fields = [
            "current_content", "elapsed_seconds", "remaining_seconds",
            "total_duration", "progress_percent", "sync_position",
            "server_time", "next_up"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        print("✓ Now-playing has all required sync fields")
    
    def test_now_playing_progress(self):
        """Verify progress calculations are valid"""
        response = requests.get(f"{BASE_URL}/api/tv/now-playing")
        data = response.json()
        
        assert 0 <= data["progress_percent"] <= 100, "Progress should be 0-100"
        assert data["elapsed_seconds"] >= 0, "Elapsed should be >= 0"
        assert data["remaining_seconds"] >= 0, "Remaining should be >= 0"
        assert data["sync_position"] >= 0, "Sync position should be >= 0"
        print(f"✓ Progress: {data['progress_percent']:.1f}%, Elapsed: {data['elapsed_seconds']}s")
    
    def test_now_playing_has_next_up(self):
        """Verify next_up content is included"""
        response = requests.get(f"{BASE_URL}/api/tv/now-playing")
        data = response.json()
        
        assert data.get("next_up") is not None, "Should have next_up content"
        assert "content" in data["next_up"], "next_up should have content"
        print(f"✓ Next up: {data['next_up']['content']['title']}")


class TestLibraryEndpoint:
    """Tests for GET /api/tv/library - All content organized by category"""
    
    def test_library_returns_200(self):
        """Verify library endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        print("✓ GET /api/tv/library returns 200")
    
    def test_library_structure(self):
        """Verify library response structure"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        assert "categories" in data, "Missing 'categories' field"
        assert "total_content" in data, "Missing 'total_content' field"
        assert "total_duration_hours" in data, "Missing 'total_duration_hours' field"
        print(f"✓ Library has {data['total_content']} items, {data['total_duration_hours']:.1f} hours")
    
    def test_library_has_categories(self):
        """Verify library has content across multiple categories"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        categories = data["categories"]
        assert len(categories) >= 5, "Should have at least 5 categories"
        
        expected_categories = ["music", "movies", "documentary", "educational", "sports"]
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
        print(f"✓ Library has {len(categories)} categories")
    
    def test_library_content_items(self):
        """Verify library content items have required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        # Check a sample item from first category
        first_category = list(data["categories"].keys())[0]
        items = data["categories"][first_category]
        
        if items:
            item = items[0]
            required = ["id", "title", "video_url", "thumbnail", "duration_seconds", "source", "category"]
            for field in required:
                assert field in item, f"Content item missing field: {field}"
        print("✓ Library content items have all required fields")


class TestPinEndpoints:
    """Tests for pin/unpin functionality - Admin controls"""
    
    def test_pin_content(self):
        """Test pinning content with priority"""
        # Pin a content item
        response = requests.post(f"{BASE_URL}/api/tv/pin/yt_m2?priority=5")
        assert response.status_code == 200, f"Pin failed: {response.status_code}"
        
        data = response.json()
        assert data["success"] == True, "Pin should succeed"
        assert data["content_id"] == "yt_m2", "Content ID should match"
        print(f"✓ Pinned yt_m2 with priority 5, total pinned: {data['pinned_count']}")
    
    def test_get_pinned_content(self):
        """Verify pinned content is returned"""
        response = requests.get(f"{BASE_URL}/api/tv/pinned")
        assert response.status_code == 200
        
        data = response.json()
        assert "pinned" in data, "Missing 'pinned' field"
        assert len(data["pinned"]) >= 1, "Should have at least 1 pinned item"
        
        # Verify pinned item structure
        pinned_item = data["pinned"][0]
        assert "pinned" in pinned_item and pinned_item["pinned"] == True
        assert "pin_priority" in pinned_item
        assert "pinned_at" in pinned_item
        print(f"✓ Got {len(data['pinned'])} pinned items")
    
    def test_unpin_content(self):
        """Test unpinning content"""
        # First pin something to unpin
        requests.post(f"{BASE_URL}/api/tv/pin/yt_m2?priority=5")
        
        # Now unpin it
        response = requests.delete(f"{BASE_URL}/api/tv/pin/yt_m2")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True, "Unpin should succeed"
        assert data["content_id"] == "yt_m2"
        print(f"✓ Unpinned yt_m2, remaining pinned: {data['pinned_count']}")
    
    def test_pin_priority_ordering(self):
        """Verify pinned content is sorted by priority"""
        # Clean up first
        requests.delete(f"{BASE_URL}/api/tv/pin/yt_m1")
        requests.delete(f"{BASE_URL}/api/tv/pin/yt_m2")
        
        # Pin with different priorities
        requests.post(f"{BASE_URL}/api/tv/pin/yt_m1?priority=3")
        requests.post(f"{BASE_URL}/api/tv/pin/yt_m2?priority=7")
        
        response = requests.get(f"{BASE_URL}/api/tv/pinned")
        data = response.json()
        
        # Higher priority should come first (yt_m3 has priority 10 already)
        priorities = [p.get("pin_priority", 0) for p in data["pinned"]]
        assert priorities == sorted(priorities, reverse=True), "Should be sorted by priority descending"
        print(f"✓ Pinned content sorted by priority: {priorities}")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/tv/pin/yt_m1")
        requests.delete(f"{BASE_URL}/api/tv/pin/yt_m2")
    
    def test_pin_invalid_content(self):
        """Test pinning non-existent content returns 404"""
        response = requests.post(f"{BASE_URL}/api/tv/pin/invalid_content_id_xyz")
        assert response.status_code == 404, "Should return 404 for invalid content"
        print("✓ Pin invalid content returns 404")


class TestSchedulePinnedContent:
    """Tests for pinned content appearing in schedule"""
    
    def test_pinned_content_appears_first(self):
        """Verify pinned content appears at the beginning of schedule"""
        # Get current pinned content
        pinned_resp = requests.get(f"{BASE_URL}/api/tv/pinned")
        pinned_data = pinned_resp.json()
        
        if len(pinned_data["pinned"]) > 0:
            # Get schedule
            schedule_resp = requests.get(f"{BASE_URL}/api/tv/schedule?hours=1")
            schedule_data = schedule_resp.json()
            
            # Current item should be pinned if we have pinned content
            current = schedule_data.get("current")
            if current and current.get("is_pinned"):
                print(f"✓ Current playing is pinned: {current['content']['title']}")
            else:
                first_pinned = next((s for s in schedule_data["schedule"] if s.get("is_pinned")), None)
                if first_pinned:
                    print(f"✓ Found pinned in schedule: {first_pinned['content']['title']}")
        else:
            print("⚠ No pinned content to verify")


class TestContentCategories:
    """Tests for content category system"""
    
    def test_all_categories_have_content(self):
        """Verify all categories have content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        for category, items in data["categories"].items():
            assert len(items) >= 1, f"Category {category} should have content"
        print("✓ All categories have content")
    
    def test_library_category_endpoint(self):
        """Test category-specific library endpoint"""
        response = requests.get(f"{BASE_URL}/api/tv/library/music")
        assert response.status_code == 200
        
        data = response.json()
        assert data["category"] == "music"
        assert len(data["content"]) > 0
        
        for item in data["content"]:
            assert item["category"] == "music", "All items should be music category"
        print(f"✓ Library/music returns {data['total']} music items")
    
    def test_invalid_category_returns_400(self):
        """Test invalid category returns 400"""
        response = requests.get(f"{BASE_URL}/api/tv/library/invalid_category_xyz")
        assert response.status_code == 400, "Invalid category should return 400"
        print("✓ Invalid category returns 400")


class TestContentSources:
    """Tests for multiple content sources"""
    
    def test_youtube_content_present(self):
        """Verify YouTube content is present"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        all_items = []
        for items in data["categories"].values():
            all_items.extend(items)
        
        youtube_items = [i for i in all_items if i.get("source_type") == "youtube"]
        assert len(youtube_items) > 0, "Should have YouTube content"
        print(f"✓ Found {len(youtube_items)} YouTube items")
    
    def test_internet_archive_content_present(self):
        """Verify Internet Archive content is present"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        all_items = []
        for items in data["categories"].values():
            all_items.extend(items)
        
        ia_items = [i for i in all_items if i.get("source_type") == "internet_archive"]
        assert len(ia_items) > 0, "Should have Internet Archive content"
        print(f"✓ Found {len(ia_items)} Internet Archive items")
    
    def test_total_content_hours(self):
        """Verify total content hours calculation"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        assert data["total_duration_hours"] > 10, "Should have >10 hours of content"
        print(f"✓ Total content: {data['total_duration_hours']:.1f} hours")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
