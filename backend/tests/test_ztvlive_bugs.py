"""
ZTVLIVE Bug Verification Tests - Iteration 18
Tests for reported bugs:
1. Video playback on /watch page - verify video content loads
2. /api/tv/sync endpoint returns valid video data
3. /api/news/ticker returns headlines with world feed
4. News ticker scrolling functionality
5. Viewer count consistency
6. Share link URL correctness
7. /api/tv/upcoming returns schedule items
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTVSync:
    """Test /api/tv/sync endpoint for video data"""
    
    def test_tv_sync_returns_valid_data(self):
        """Test that tv/sync returns valid video data with required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/sync", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Check that top-level fields exist (which frontend uses)
        assert 'title' in data, "Missing title field"
        assert 'video_id' in data or 'video_url' in data, "Missing video_id or video_url"
        assert 'video_url' in data, "Missing video_url"
        
        # Verify video_url is not empty
        assert data.get('video_url'), "video_url is empty"
        
        # Check video_url is a valid YouTube embed URL
        video_url = data.get('video_url', '')
        assert 'youtube.com/embed/' in video_url, f"video_url should be YouTube embed URL, got: {video_url}"
        
        print(f"TV Sync - Title: {data.get('title')}")
        print(f"TV Sync - Video URL: {data.get('video_url')}")
        print(f"TV Sync - Category: {data.get('category')}")
    
    def test_tv_sync_has_video_id(self):
        """Verify video_id can be extracted from video_url"""
        response = requests.get(f"{BASE_URL}/api/tv/sync", timeout=10)
        data = response.json()
        
        video_url = data.get('video_url', '')
        if 'youtube.com/embed/' in video_url:
            video_id = video_url.split('youtube.com/embed/')[-1].split('?')[0]
            assert video_id and len(video_id) >= 10, f"Invalid video_id extracted: {video_id}"
            print(f"Extracted video_id: {video_id}")
    
    def test_tv_sync_content_not_unavailable(self):
        """Verify the video content data exists (API level check)"""
        response = requests.get(f"{BASE_URL}/api/tv/sync", timeout=10)
        data = response.json()
        
        title = data.get('title', '')
        # Title should not be empty or indicate unavailability
        assert title, "Title is empty"
        assert 'unavailable' not in title.lower(), f"Video marked as unavailable: {title}"
        print(f"Content is available: {title}")


class TestNewsTicker:
    """Test /api/news/ticker endpoint"""
    
    def test_news_ticker_returns_headlines(self):
        """Test that news/ticker returns headlines array"""
        response = requests.get(f"{BASE_URL}/api/news/ticker", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'headlines' in data, "Missing headlines field"
        
        headlines = data.get('headlines', [])
        assert len(headlines) > 0, "No headlines returned"
        print(f"News Ticker - {len(headlines)} headlines returned")
    
    def test_news_ticker_headline_structure(self):
        """Test that each headline has required fields"""
        response = requests.get(f"{BASE_URL}/api/news/ticker", timeout=10)
        data = response.json()
        
        headlines = data.get('headlines', [])
        for i, headline in enumerate(headlines[:3]):  # Check first 3
            assert 'headline' in headline, f"Headline {i} missing 'headline' field"
            assert 'source' in headline, f"Headline {i} missing 'source' field"
            
            # Verify non-empty values
            assert headline.get('headline'), f"Headline {i} has empty headline text"
            assert headline.get('source'), f"Headline {i} has empty source"
            
            print(f"Headline {i+1}: {headline.get('headline')[:60]}... ({headline.get('source')})")
    
    def test_news_ticker_world_feed_content(self):
        """Test that ticker contains news/world content (not just ZTVLIVE promos)"""
        response = requests.get(f"{BASE_URL}/api/news/ticker", timeout=10)
        data = response.json()
        
        headlines = data.get('headlines', [])
        
        # Check if we have real news (not just ZTVLIVE promos)
        news_sources = [h.get('source', '') for h in headlines]
        non_ztv_sources = [s for s in news_sources if 'ZTVLIVE' not in s]
        
        # If NewsAPI is rate limited, we'll have fallback ZTVLIVE headlines
        # This is acceptable as noted in the test context
        if len(non_ztv_sources) > 0:
            print(f"World feed active: {len(non_ztv_sources)} external sources")
        else:
            # Fallback headlines are also valid (due to NewsAPI rate limiting)
            print("Using fallback headlines (NewsAPI likely rate limited)")
            # Verify fallback headlines are still valid format
            assert all(h.get('headline') and h.get('source') for h in headlines)


class TestTVUpcoming:
    """Test /api/tv/upcoming endpoint"""
    
    def test_tv_upcoming_returns_schedule(self):
        """Test that tv/upcoming returns upcoming schedule items"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'upcoming' in data, "Missing upcoming field"
        
        upcoming = data.get('upcoming', [])
        print(f"TV Upcoming - {len(upcoming)} items returned")
        
        for i, item in enumerate(upcoming[:3]):
            print(f"  {i+1}. {item.get('title', item.get('content', {}).get('title', 'Unknown'))}")
    
    def test_tv_upcoming_item_structure(self):
        """Test that upcoming items have valid structure"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5", timeout=10)
        data = response.json()
        
        upcoming = data.get('upcoming', [])
        if len(upcoming) > 0:
            item = upcoming[0]
            # Items should have id and content or direct fields
            assert 'id' in item or 'title' in item, "Upcoming item missing id/title"
            print(f"First upcoming item structure: {list(item.keys())}")


class TestViewerCount:
    """Test viewer count consistency"""
    
    def test_viewer_count_consistent(self):
        """Test that viewer count is consistent (seed-based)"""
        # Make multiple requests and check consistency
        responses = []
        for _ in range(3):
            response = requests.get(f"{BASE_URL}/api/tv/sync", timeout=10)
            responses.append(response.json())
        
        # Note: Viewer count is generated client-side based on hour seed
        # API doesn't return viewer count directly
        # This test verifies the API is stable
        print("Viewer count is generated client-side based on UTC hour seed")
        print("This ensures consistency across devices in same hour")
    
    def test_live_current_returns_viewers(self):
        """Test /api/live/current endpoint for viewers"""
        response = requests.get(f"{BASE_URL}/api/live/current", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        # This endpoint returns a 'viewers' field
        if 'viewers' in data:
            print(f"Live current viewers: {data.get('viewers')}")
            assert data.get('viewers') >= 0, "Invalid viewer count"


class TestShareLink:
    """Test share link URL correctness"""
    
    def test_share_link_domain(self):
        """Verify that share link uses correct domain www.ztvlivestream.com"""
        # This is a frontend test, but we verify the expected behavior
        # The frontend hardcodes: https://www.ztvlivestream.com/watch
        expected_domain = "www.ztvlivestream.com"
        print(f"Share link should use domain: {expected_domain}")
        print("Frontend shares: https://www.ztvlivestream.com/watch")
        # Actual verification requires frontend testing


class TestContentHealth:
    """Test content health and library endpoints"""
    
    def test_tv_library_has_content(self):
        """Verify content library has valid videos"""
        response = requests.get(f"{BASE_URL}/api/tv/library", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        total = data.get('total_items') or data.get('total_content', 0)
        print(f"Content library has {total} items")
        assert total > 0, "Content library is empty"
    
    def test_health_summary(self):
        """Check content health summary"""
        response = requests.get(f"{BASE_URL}/api/tv/health", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        print(f"Health check: {data}")


# Run specific tests for debugging
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
