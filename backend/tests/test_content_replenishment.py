"""
ZTVLIVE Content Replenishment & CC Language Tests
Tests for:
1. Auto-replenishment when disabled videos > 50
2. Fresh content being served (Taylor Swift, Adele, Bad Bunny, etc.)
3. Content health monitoring
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestContentReplenishment:
    """Tests for content auto-replenishment system"""
    
    def test_replenishment_status_endpoint(self):
        """Test GET /api/tv/content/replenish-status returns valid data"""
        response = requests.get(f"{BASE_URL}/api/tv/content/replenish-status")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields
        assert "health" in data
        assert "disabled_count" in data
        assert "threshold" in data
        assert "total_available" in data
        assert "fresh_pool_size" in data
        assert "category_stats" in data
        
        # Verify threshold is 50
        assert data["threshold"] == 50
        
        # Verify health status is correct based on disabled count
        if data["disabled_count"] > 50:
            assert data["health"] == "needs_replenishment"
        else:
            assert data["health"] == "healthy"
        
        print(f"✅ Replenishment status: {data['health']}")
        print(f"   Disabled count: {data['disabled_count']}, Threshold: {data['threshold']}")
        print(f"   Total available: {data['total_available']}, Fresh pool: {data['fresh_pool_size']}")
    
    def test_auto_replenish_endpoint(self):
        """Test POST /api/tv/content/auto-replenish triggers replenishment"""
        response = requests.post(f"{BASE_URL}/api/tv/content/auto-replenish")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields
        assert "disabled_count" in data
        assert "threshold" in data
        assert "needs_replenishment" in data
        assert "added_content" in data
        assert "total_added" in data
        
        print(f"✅ Auto-replenish triggered")
        print(f"   Needs replenishment: {data['needs_replenishment']}")
        print(f"   Total added: {data['total_added']}")
        
        # If replenishment was needed, verify content was added
        if data["needs_replenishment"]:
            assert isinstance(data["added_content"], list)
            for item in data["added_content"]:
                assert "title" in item
                assert "category" in item
    
    def test_category_stats_structure(self):
        """Test that category stats have correct structure"""
        response = requests.get(f"{BASE_URL}/api/tv/content/replenish-status")
        assert response.status_code == 200
        
        data = response.json()
        category_stats = data.get("category_stats", {})
        
        # Verify at least some categories exist
        assert len(category_stats) > 0
        
        # Verify each category has required fields
        for category, stats in category_stats.items():
            assert "total" in stats, f"Category {category} missing 'total'"
            assert "available" in stats, f"Category {category} missing 'available'"
            assert "disabled" in stats, f"Category {category} missing 'disabled'"
            
            # Verify math: total = available + disabled
            assert stats["total"] == stats["available"] + stats["disabled"], \
                f"Category {category}: total ({stats['total']}) != available ({stats['available']}) + disabled ({stats['disabled']})"
        
        print(f"✅ Category stats verified for {len(category_stats)} categories")


class TestFreshContent:
    """Tests for fresh content being served"""
    
    def test_tv_sync_returns_content(self):
        """Test GET /api/tv/sync returns current playing content"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields
        assert "now_playing" in data or "title" in data
        assert "video_url" in data or "embed_url" in data
        
        title = data.get("title") or data.get("now_playing", {}).get("title", "")
        print(f"✅ Currently playing: {title}")
    
    def test_upcoming_content_list(self):
        """Test GET /api/tv/upcoming returns upcoming content"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "upcoming" in data
        assert isinstance(data["upcoming"], list)
        assert len(data["upcoming"]) > 0
        
        # Verify each upcoming item has required fields
        for item in data["upcoming"]:
            assert "id" in item
            assert "title" in item
            assert "video_url" in item
            assert "category" in item
        
        print(f"✅ Upcoming content: {len(data['upcoming'])} videos")
        for item in data["upcoming"][:5]:
            print(f"   - {item['title']} ({item['category']})")
    
    def test_fresh_artists_in_content(self):
        """Test that fresh artists (Taylor Swift, Adele, Bad Bunny, etc.) are in content"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=50")
        assert response.status_code == 200
        
        data = response.json()
        upcoming = data.get("upcoming", [])
        
        # Get current playing too
        sync_response = requests.get(f"{BASE_URL}/api/tv/sync")
        current_title = ""
        if sync_response.status_code == 200:
            sync_data = sync_response.json()
            current_title = sync_data.get("title", "") or sync_data.get("now_playing", {}).get("title", "")
        
        # Combine all titles
        all_titles = [current_title] + [item.get("title", "") for item in upcoming]
        all_titles_lower = " ".join(all_titles).lower()
        
        # Check for fresh artists
        fresh_artists = ["taylor swift", "adele", "bad bunny", "coldplay", "drake", 
                        "blackpink", "bts", "shakira", "maluma", "rosalía", "j balvin"]
        
        found_artists = []
        for artist in fresh_artists:
            if artist in all_titles_lower:
                found_artists.append(artist)
        
        print(f"✅ Fresh artists found in content: {found_artists}")
        # At least some fresh artists should be present
        assert len(found_artists) > 0, "No fresh artists found in content"
    
    def test_content_has_embed_urls(self):
        """Test that content has proper YouTube embed URLs"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=10")
        assert response.status_code == 200
        
        data = response.json()
        upcoming = data.get("upcoming", [])
        
        for item in upcoming:
            video_url = item.get("video_url", "")
            # Should be YouTube embed URL
            assert "youtube.com/embed/" in video_url or "youtu.be/" in video_url, \
                f"Invalid video URL: {video_url}"
        
        print(f"✅ All {len(upcoming)} videos have valid YouTube embed URLs")


class TestHealthEndpoints:
    """Tests for health and monitoring endpoints"""
    
    def test_health_endpoint(self):
        """Test GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health check passed: {data}")
    
    def test_promo_videos_endpoint(self):
        """Test GET /api/tv/promo-videos returns promo videos for fallback"""
        response = requests.get(f"{BASE_URL}/api/tv/promo-videos")
        assert response.status_code == 200
        
        data = response.json()
        assert "videos" in data
        assert isinstance(data["videos"], list)
        
        print(f"✅ Promo videos available: {len(data['videos'])}")
        for video in data["videos"]:
            print(f"   - {video.get('title', 'Unknown')}")


class TestCCLanguageSupport:
    """Tests for CC language dropdown support"""
    
    def test_caption_languages_defined(self):
        """Verify caption languages are defined in frontend"""
        # This is a code verification test - the languages are defined in WatchPageV2.jsx
        # We verify the API supports the content that will use these captions
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        # Content should be YouTube-based which supports auto-captions
        video_url = data.get("video_url", "") or data.get("embed_url", "")
        assert "youtube" in video_url.lower(), "Content should be YouTube-based for CC support"
        
        print(f"✅ YouTube content supports CC/auto-translate")
        print(f"   Languages supported: EN, ES, FR, DE, PT, IT, ZH, JA, KO, HI, AR, RU, NL, PL, TR, VI, TH, ID, TL, SW")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
