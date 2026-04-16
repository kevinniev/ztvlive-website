"""
ZTVLIVE Content Health & TV Scheduler API Tests
Tests for: tv/sync, tv/upcoming, tv/health, tv/library
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
        
        # Check top-level fields
        assert "title" in data, "Missing 'title' field"
        assert "category" in data, "Missing 'category' field"
        assert "video_url" in data, "Missing 'video_url' field"
        
        print(f"PASS: /api/tv/sync has required fields - title: {data['title']}, category: {data['category']}")
    
    def test_tv_sync_video_url_is_youtube_embed(self):
        """Verify video_url is in YouTube embed format"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        video_url = data.get("video_url", "")
        assert "youtube.com/embed/" in video_url, f"video_url should be YouTube embed format, got: {video_url}"
        print(f"PASS: video_url is YouTube embed format: {video_url}")
    
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
    
    def test_tv_upcoming_has_diverse_content(self):
        """Verify upcoming content includes diverse categories (afrobeats, rnb, hiphop, movies, entertainment)"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=10")
        data = response.json()
        upcoming = data.get("upcoming", [])
        
        categories = set(item.get("category") for item in upcoming)
        expected_categories = {"afrobeats", "rnb", "hiphop", "movies", "entertainment", "news", "sports"}
        
        # At least 3 different categories should be present
        assert len(categories) >= 2, f"Expected diverse content (3+ categories), got: {categories}"
        
        # Check for at least one of the new content types
        new_content_found = categories & expected_categories
        assert len(new_content_found) > 0, f"Expected new content types (afrobeats, rnb, hiphop, movies, entertainment), got: {categories}"
        
        print(f"PASS: Upcoming content is diverse with {len(categories)} categories: {categories}")


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
    
    def test_tv_health_has_disabled_videos_list(self):
        """Verify response has disabled_videos list"""
        response = requests.get(f"{BASE_URL}/api/tv/health")
        data = response.json()
        
        assert "disabled_videos" in data, "Missing 'disabled_videos' field"
        assert isinstance(data["disabled_videos"], list), "disabled_videos should be a list"
        
        print(f"PASS: /api/tv/health has disabled_videos list (count: {len(data['disabled_videos'])})")


class TestTVLibraryAPI:
    """Tests for /api/tv/library endpoint - Content library"""
    
    def test_tv_library_returns_200(self):
        """Verify /api/tv/library returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/tv/library returns 200")
    
    def test_tv_library_has_7_categories(self):
        """Verify library has 7 categories (afrobeats, rnb, hiphop, movies, entertainment, news, sports)"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        assert "categories" in data, "Missing 'categories' field"
        categories = data["categories"]
        
        expected = ["afrobeats", "rnb", "hiphop", "movies", "entertainment", "news", "sports"]
        for cat in expected:
            assert cat in categories, f"Missing category: {cat}"
        
        print(f"PASS: /api/tv/library has all 7 categories: {list(categories.keys())}")
    
    def test_tv_library_afrobeats_content(self):
        """Verify afrobeats category has DJ Boat mixes, Rema, Burna Boy content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        afrobeats = data["categories"].get("afrobeats", [])
        assert len(afrobeats) >= 5, f"Expected 5+ afrobeats items, got {len(afrobeats)}"
        
        titles = [item["title"].lower() for item in afrobeats]
        combined = " ".join(titles)
        
        # Check for expected artists
        assert any(artist in combined for artist in ["rema", "burna", "wizkid", "asake"]), f"Expected Afrobeats artists in titles"
        
        print(f"PASS: Afrobeats category has {len(afrobeats)} items with proper content")
    
    def test_tv_library_rnb_content(self):
        """Verify R&B category has Adele, The Weeknd, Bruno Mars content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        rnb = data["categories"].get("rnb", [])
        assert len(rnb) >= 5, f"Expected 5+ R&B items, got {len(rnb)}"
        
        titles = [item["title"].lower() for item in rnb]
        combined = " ".join(titles)
        
        # Check for expected artists
        assert any(artist in combined for artist in ["adele", "weeknd", "bruno"]), f"Expected R&B artists in titles"
        
        print(f"PASS: R&B category has {len(rnb)} items with proper content")
    
    def test_tv_library_hiphop_content(self):
        """Verify Hip-hop category has PSY, Despacito, Kendrick content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        hiphop = data["categories"].get("hiphop", [])
        assert len(hiphop) >= 4, f"Expected 4+ Hip-hop items, got {len(hiphop)}"
        
        titles = [item["title"].lower() for item in hiphop]
        combined = " ".join(titles)
        
        # Check for expected content
        assert any(term in combined for term in ["psy", "gangnam", "despacito", "kendrick"]), f"Expected Hip-hop content in titles"
        
        print(f"PASS: Hip-hop category has {len(hiphop)} items with proper content")
    
    def test_tv_library_movies_content(self):
        """Verify Movies category has MrBeast, Blender films content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        movies = data["categories"].get("movies", [])
        assert len(movies) >= 4, f"Expected 4+ movies items, got {len(movies)}"
        
        titles = [item["title"].lower() for item in movies]
        sources = [item.get("source", "").lower() for item in movies]
        combined = " ".join(titles + sources)
        
        # Check for expected content
        assert any(term in combined for term in ["mrbeast", "blender", "squid game"]), f"Expected Movies content"
        
        print(f"PASS: Movies category has {len(movies)} items with proper content")
    
    def test_tv_library_entertainment_content(self):
        """Verify Entertainment category has Baby Shark, Cocomelon content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        entertainment = data["categories"].get("entertainment", [])
        assert len(entertainment) >= 5, f"Expected 5+ entertainment items, got {len(entertainment)}"
        
        titles = [item["title"].lower() for item in entertainment]
        combined = " ".join(titles)
        
        # Check for expected content
        assert any(term in combined for term in ["baby shark", "cocomelon", "dance"]), f"Expected Entertainment content"
        
        print(f"PASS: Entertainment category has {len(entertainment)} items with proper content")
    
    def test_tv_library_total_items(self):
        """Verify library has 30+ total content items"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        data = response.json()
        
        total = data.get("total_items", 0)
        assert total >= 30, f"Expected 30+ total items, got {total}"
        
        print(f"PASS: /api/tv/library has {total} total items")


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
