"""
Test suite for Content Health API endpoints and CleanYouTubePlayer integration.
Tests: /api/tv/health, /api/tv/health/scan, /api/tv/health/check
Features: Content freshness checks, video unavailability detection
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestContentHealthAPI:
    """Content Health API endpoint tests"""

    def test_health_summary_endpoint(self):
        """Test /api/tv/health returns cached health summary"""
        response = requests.get(f"{BASE_URL}/api/tv/health", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify response structure
        assert "total_cached" in data
        assert "available" in data
        assert "unavailable" in data
        assert "unknown" in data
        assert "last_full_scan" in data
        assert "unavailable_videos" in data
        
        # Verify data types
        assert isinstance(data["total_cached"], int)
        assert isinstance(data["available"], int)
        assert isinstance(data["unavailable"], int)
        assert isinstance(data["unavailable_videos"], list)
        
        print(f"Health summary: {data['available']} available, {data['unavailable']} unavailable, {data['unknown']} unknown")

    def test_single_video_check_endpoint(self):
        """Test /api/tv/health/check for single video URL"""
        # Test with a known working video
        video_url = "https://www.youtube.com/embed/Bu7sIBt_g-w"
        response = requests.get(
            f"{BASE_URL}/api/tv/health/check",
            params={"video_url": video_url},
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify response structure
        assert "video_id" in data
        assert "available" in data
        assert "checked_at" in data
        
        # Video should be available
        assert data["video_id"] == "Bu7sIBt_g-w"
        assert data["available"] is True
        
        # If available, should have title and thumbnail
        if data["available"]:
            assert "title" in data
            assert "thumbnail_url" in data
            
        print(f"Single video check: {data['video_id']} - available: {data['available']}")

    def test_single_video_check_youtube_watch_format(self):
        """Test /api/tv/health/check with youtube.com/watch?v= format"""
        video_url = "https://www.youtube.com/watch?v=T6eK-2OQtew"
        response = requests.get(
            f"{BASE_URL}/api/tv/health/check",
            params={"video_url": video_url},
            timeout=15
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["video_id"] == "T6eK-2OQtew"
        assert data["available"] is True
        print(f"YouTube watch format check passed")

    def test_single_video_check_youtu_be_format(self):
        """Test /api/tv/health/check with youtu.be/ short format"""
        video_url = "https://youtu.be/T6eK-2OQtew"
        response = requests.get(
            f"{BASE_URL}/api/tv/health/check",
            params={"video_url": video_url},
            timeout=15
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["video_id"] == "T6eK-2OQtew"
        print(f"YouTube short URL format check passed")

    def test_full_scan_returns_95_videos(self):
        """Test /api/tv/health/scan scans all 95 content library videos"""
        response = requests.post(
            f"{BASE_URL}/api/tv/health/scan",
            timeout=90  # Scan takes ~30-60 seconds
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify response structure
        assert "total_checked" in data
        assert "available" in data
        assert "unavailable" in data
        assert "unknown" in data
        assert "scan_started_at" in data
        assert "scan_completed_at" in data
        
        # Should scan all 95 videos
        assert data["total_checked"] == 95, f"Expected 95 videos, got {data['total_checked']}"
        
        # Verify available/unavailable are lists
        assert isinstance(data["available"], list)
        assert isinstance(data["unavailable"], list)
        assert isinstance(data["unknown"], list)
        
        # Total should match
        total = len(data["available"]) + len(data["unavailable"]) + len(data["unknown"])
        assert total == data["total_checked"]
        
        print(f"Full scan complete: {len(data['available'])} available, {len(data['unavailable'])} unavailable, {len(data['unknown'])} unknown")

    def test_all_95_videos_available(self):
        """Verify all 95 videos in content library are available (no broken links)"""
        response = requests.post(
            f"{BASE_URL}/api/tv/health/scan",
            timeout=90
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # After fixing 8 broken videos, all 95 should be available
        unavailable_count = len(data.get("unavailable", []))
        assert unavailable_count == 0, f"Found {unavailable_count} unavailable videos: {[v.get('title') for v in data['unavailable']]}"
        
        available_count = len(data.get("available", []))
        assert available_count == 95, f"Expected 95 available, got {available_count}"
        
        print(f"SUCCESS: All 95 videos are available")

    def test_clear_health_cache(self):
        """Test /api/tv/health/clear clears the cache"""
        response = requests.post(f"{BASE_URL}/api/tv/health/clear", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "cleared"
        
        # After clearing, health summary should show 0 cached
        summary_response = requests.get(f"{BASE_URL}/api/tv/health", timeout=10)
        summary = summary_response.json()
        assert summary["total_cached"] == 0
        
        print("Health cache cleared successfully")


class TestContentHealthService:
    """Tests for content_health.py service functions via API"""

    def test_extract_video_id_embed_format(self):
        """Test video ID extraction from embed URL"""
        video_url = "https://www.youtube.com/embed/Bu7sIBt_g-w"
        response = requests.get(
            f"{BASE_URL}/api/tv/health/check",
            params={"video_url": video_url},
            timeout=10
        )
        assert response.status_code == 200
        assert response.json()["video_id"] == "Bu7sIBt_g-w"

    def test_health_scan_includes_categories(self):
        """Test that full scan results include category information"""
        response = requests.post(f"{BASE_URL}/api/tv/health/scan", timeout=90)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check that available items have category info
        if data["available"]:
            first_item = data["available"][0]
            assert "category" in first_item
            assert "title" in first_item
            assert "video_id" in first_item
            assert "health" in first_item
            
        print(f"Scan results include category information")


class TestContentLibraryIntegrity:
    """Tests for content library data integrity"""

    def test_tv_library_returns_95_items(self):
        """Test /api/tv/library returns 95 total content items"""
        response = requests.get(f"{BASE_URL}/api/tv/library", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert data["total_content"] == 95, f"Expected 95 items, got {data['total_content']}"
        print(f"Library contains {data['total_content']} items")

    def test_sports_category_has_13_items(self):
        """Test sports category has 13 items including March 2026 content"""
        response = requests.get(f"{BASE_URL}/api/tv/library", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        sports = data["categories"].get("sports", [])
        assert len(sports) == 13, f"Expected 13 sports items, got {len(sports)}"
        
        # Verify March 2026 content titles
        titles = [s["title"] for s in sports]
        assert any("Heat vs Wizards" in t for t in titles), "Missing Heat vs Wizards game"
        assert any("Super Bowl" in t for t in titles), "Missing Super Bowl 2026"
        assert any("UFC 326" in t for t in titles), "Missing UFC 326 content"
        
        print(f"Sports category has {len(sports)} items with March 2026 content")


@pytest.fixture(autouse=True)
def verify_base_url():
    """Ensure BASE_URL is set"""
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")
