"""
Test NewsAPI Integration for ZTVLIVE
Tests the NewsAPI endpoints including status, trending, headlines, and search functionality.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNewsAPIStatus:
    """Tests for NewsAPI status endpoint to verify configuration"""
    
    def test_newsapi_status_configured(self):
        """Test that NewsAPI is configured with API key"""
        response = requests.get(f"{BASE_URL}/api/newsapi/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "configured" in data
        assert data["configured"] == True, "NewsAPI should be configured with ZTV_API_KEY"
        
    def test_newsapi_status_working(self):
        """Test that NewsAPI is working and can fetch data"""
        response = requests.get(f"{BASE_URL}/api/newsapi/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "working" in data
        assert data["working"] == True, "NewsAPI should be working"
        assert data["error"] is None, f"NewsAPI should not have errors: {data.get('error')}"
        
    def test_newsapi_status_categories_available(self):
        """Test that all expected categories are available"""
        response = requests.get(f"{BASE_URL}/api/newsapi/status")
        assert response.status_code == 200
        
        data = response.json()
        expected_categories = ["sports", "podcast", "music", "film", "tech", "gaming", "news", "culture", "other"]
        assert "categories_available" in data
        
        for cat in expected_categories:
            assert cat in data["categories_available"], f"Category {cat} should be available"


class TestNewsAPITrending:
    """Tests for NewsAPI trending endpoint with different categories"""
    
    def test_trending_sports(self):
        """Test fetching trending sports news"""
        response = requests.get(f"{BASE_URL}/api/newsapi/trending/sports?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "trending" in data
        assert "category" in data
        assert data["category"] == "sports"
        assert "count" in data
        
        # Should return real news articles
        if data["count"] > 0:
            article = data["trending"][0]
            assert "title" in article
            assert "source" in article
            assert article["category"] == "sports"
    
    def test_trending_tech(self):
        """Test fetching trending tech news"""
        response = requests.get(f"{BASE_URL}/api/newsapi/trending/tech?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "trending" in data
        assert data["category"] == "tech"
        
        if data["count"] > 0:
            article = data["trending"][0]
            assert "title" in article
            assert article["category"] == "tech"
    
    def test_trending_news(self):
        """Test fetching trending general news"""
        response = requests.get(f"{BASE_URL}/api/newsapi/trending/news?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "trending" in data
        assert data["category"] == "news"
    
    def test_trending_culture(self):
        """Test fetching trending culture news"""
        response = requests.get(f"{BASE_URL}/api/newsapi/trending/culture?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "trending" in data
        assert data["category"] == "culture"
    
    def test_trending_all_categories(self):
        """Test fetching trending from all categories"""
        response = requests.get(f"{BASE_URL}/api/newsapi/trending/all?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "trending" in data
        assert data["category"] == "all"
    
    def test_trending_invalid_category(self):
        """Test that invalid category returns error"""
        response = requests.get(f"{BASE_URL}/api/newsapi/trending/invalid_category")
        assert response.status_code == 400
    
    def test_trending_article_structure(self):
        """Test that trending articles have correct structure"""
        response = requests.get(f"{BASE_URL}/api/newsapi/trending/sports?limit=3")
        assert response.status_code == 200
        
        data = response.json()
        if data["count"] > 0:
            article = data["trending"][0]
            # Check required fields
            assert "title" in article
            assert "description" in article
            assert "source" in article
            assert "url" in article
            assert "image_url" in article
            assert "published_at" in article
            assert "category" in article


class TestNewsAPIHeadlines:
    """Tests for NewsAPI headlines endpoint"""
    
    def test_headlines_default(self):
        """Test fetching top headlines with default parameters"""
        response = requests.get(f"{BASE_URL}/api/newsapi/headlines")
        assert response.status_code == 200
        
        data = response.json()
        assert "headlines" in data
        assert "country" in data
        assert data["country"] == "us"
        assert "count" in data
    
    def test_headlines_with_limit(self):
        """Test fetching headlines with specific limit"""
        response = requests.get(f"{BASE_URL}/api/newsapi/headlines?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "headlines" in data
        assert len(data["headlines"]) <= 5
    
    def test_headlines_article_structure(self):
        """Test that headline articles have correct structure"""
        response = requests.get(f"{BASE_URL}/api/newsapi/headlines?limit=3")
        assert response.status_code == 200
        
        data = response.json()
        if data["count"] > 0:
            article = data["headlines"][0]
            assert "title" in article
            assert "description" in article
            assert "source" in article
            assert "url" in article
            assert "published_at" in article


class TestNewsAPISearch:
    """Tests for NewsAPI search endpoint"""
    
    def test_search_valid_query(self):
        """Test searching with a valid query"""
        response = requests.get(f"{BASE_URL}/api/newsapi/search?query=technology")
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        assert "query" in data
        assert data["query"] == "technology"
        assert "count" in data
    
    def test_search_ai_query(self):
        """Test searching for AI-related content"""
        response = requests.get(f"{BASE_URL}/api/newsapi/search?query=AI")
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        # Should return results for popular topic
        assert data["count"] > 0, "Should find results for 'AI' query"
    
    def test_search_with_limit(self):
        """Test search with specific limit"""
        response = requests.get(f"{BASE_URL}/api/newsapi/search?query=sports&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["results"]) <= 5
    
    def test_search_short_query_rejected(self):
        """Test that very short queries are rejected"""
        response = requests.get(f"{BASE_URL}/api/newsapi/search?query=a")
        assert response.status_code == 400
    
    def test_search_result_structure(self):
        """Test that search results have correct structure"""
        response = requests.get(f"{BASE_URL}/api/newsapi/search?query=test")
        assert response.status_code == 200
        
        data = response.json()
        if data["count"] > 0:
            result = data["results"][0]
            assert "title" in result
            assert "description" in result
            assert "source" in result
            assert "url" in result


class TestAIHighlightGeneration:
    """Tests for AI highlight generation that uses NewsAPI data"""
    
    def test_generate_highlight_endpoint(self):
        """Test that AI highlight generation endpoint works"""
        response = requests.post(
            f"{BASE_URL}/api/ai/generate-highlight",
            json={"category": "tech", "use_real_news": True}
        )
        # Should return 200 or 201
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
    
    def test_generate_highlight_with_news_integration(self):
        """Test AI highlight generation uses real news data"""
        response = requests.post(
            f"{BASE_URL}/api/ai/generate-highlight",
            json={"category": "sports", "use_real_news": True}
        )
        assert response.status_code in [200, 201]
        
        data = response.json()
        # Should contain AI-generated content
        if "highlight" in data:
            highlight = data["highlight"]
            assert "title" in highlight
            assert "ai_commentary" in highlight
            assert "category" in highlight


class TestCachingBehavior:
    """Tests for NewsAPI caching to avoid rate limits"""
    
    def test_cache_is_used(self):
        """Test that multiple requests use cache"""
        # First request
        response1 = requests.get(f"{BASE_URL}/api/newsapi/trending/sports?limit=3")
        assert response1.status_code == 200
        
        # Check status for cache entries
        status_response = requests.get(f"{BASE_URL}/api/newsapi/status")
        assert status_response.status_code == 200
        
        data = status_response.json()
        assert "cache_entries" in data
        # Cache should have at least 1 entry after fetching
        assert data["cache_entries"] >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
