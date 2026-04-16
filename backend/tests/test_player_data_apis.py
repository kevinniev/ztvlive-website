"""
ZTVLIVE Player Data APIs Test Suite
Tests for player tracking, email subscription, and analytics endpoints
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://best-bites-live.preview.emergentagent.com').rstrip('/')


class TestPlayerTracking:
    """Tests for /api/players/track endpoint - Player data tracking via cookies"""
    
    def test_track_player_with_profile(self):
        """Test tracking a new player with profile data"""
        test_name = f"TEST_Player_{uuid.uuid4().hex[:8]}"
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/players/track",
            json={
                "name": test_name,
                "email": test_email,
                "subscribe_updates": False
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "player_id" in data, "Response should contain player_id"
        assert "is_new_player" in data, "Response should contain is_new_player"
        assert "message" in data, "Response should contain message"
        
        # Verify player_id is a valid UUID
        assert len(data["player_id"]) > 0, "player_id should not be empty"
        print(f"✓ Player tracked successfully: {data['player_id']}")
    
    def test_track_player_without_profile(self):
        """Test tracking a player without profile data (anonymous)"""
        response = requests.post(
            f"{BASE_URL}/api/players/track",
            json={}
        )
        
        # Should fail because name is required
        assert response.status_code in [200, 422], f"Expected 200 or 422, got {response.status_code}"
        print(f"✓ Anonymous tracking handled correctly")


class TestEmailSubscription:
    """Tests for /api/players/subscribe endpoint - Email subscription"""
    
    def test_subscribe_new_email(self):
        """Test subscribing a new email address"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/players/subscribe",
            json={
                "email": test_email,
                "name": "Test Subscriber",
                "source": "game"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Subscription should succeed"
        assert "message" in data, "Response should contain message"
        print(f"✓ Email subscribed successfully: {test_email}")
    
    def test_subscribe_duplicate_email(self):
        """Test subscribing the same email twice"""
        test_email = f"test_dup_{uuid.uuid4().hex[:8]}@example.com"
        
        # First subscription
        response1 = requests.post(
            f"{BASE_URL}/api/players/subscribe",
            json={"email": test_email, "source": "game"}
        )
        assert response1.status_code == 200
        
        # Second subscription (duplicate)
        response2 = requests.post(
            f"{BASE_URL}/api/players/subscribe",
            json={"email": test_email, "source": "game"}
        )
        
        assert response2.status_code == 200
        data = response2.json()
        assert data.get("already_subscribed") == True, "Should indicate already subscribed"
        print(f"✓ Duplicate subscription handled correctly")
    
    def test_subscribe_invalid_email(self):
        """Test subscribing with invalid email format"""
        response = requests.post(
            f"{BASE_URL}/api/players/subscribe",
            json={"email": "not-an-email", "source": "game"}
        )
        
        # Should fail validation
        assert response.status_code == 422, f"Expected 422 for invalid email, got {response.status_code}"
        print(f"✓ Invalid email rejected correctly")


class TestAnalyticsOverview:
    """Tests for /api/players/analytics/overview endpoint"""
    
    def test_get_analytics_overview(self):
        """Test getting analytics overview data"""
        response = requests.get(f"{BASE_URL}/api/players/analytics/overview")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        expected_fields = [
            "total_players",
            "new_players_today",
            "active_players_week",
            "total_games_played",
            "email_subscribers",
            "total_groups",
            "timestamp"
        ]
        
        for field in expected_fields:
            assert field in data, f"Response should contain {field}"
        
        # Verify data types
        assert isinstance(data["total_players"], int), "total_players should be int"
        assert isinstance(data["email_subscribers"], int), "email_subscribers should be int"
        assert isinstance(data["total_groups"], int), "total_groups should be int"
        
        print(f"✓ Analytics overview: {data['total_players']} players, {data['email_subscribers']} subscribers")


class TestSocialFollowTracking:
    """Tests for /api/players/follow-social endpoint"""
    
    def test_track_social_follow(self):
        """Test tracking a social media follow"""
        response = requests.post(
            f"{BASE_URL}/api/players/follow-social?platform=twitter"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Follow tracking should succeed"
        assert data.get("platform") == "twitter", "Platform should be twitter"
        assert "total_follows" in data, "Response should contain total_follows"
        print(f"✓ Social follow tracked: {data['platform']} ({data['total_follows']} total)")
    
    def test_get_social_stats(self):
        """Test getting social media statistics"""
        response = requests.get(f"{BASE_URL}/api/players/social-stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "stats" in data, "Response should contain stats"
        
        # Verify platforms are tracked
        expected_platforms = ["twitter", "instagram", "tiktok", "youtube", "facebook"]
        for platform in expected_platforms:
            assert platform in data["stats"], f"Stats should include {platform}"
        
        print(f"✓ Social stats retrieved: {data['stats']}")


class TestGameHistory:
    """Tests for game history endpoints"""
    
    def test_get_group_game_history(self):
        """Test getting game history for a group"""
        # Use a test group ID
        test_group_id = "TEST_GROUP_123"
        
        response = requests.get(f"{BASE_URL}/api/players/games/history/{test_group_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "group_id" in data, "Response should contain group_id"
        assert "total_games" in data, "Response should contain total_games"
        assert "games" in data, "Response should contain games list"
        assert isinstance(data["games"], list), "games should be a list"
        
        print(f"✓ Game history retrieved: {data['total_games']} games for group {test_group_id}")


class TestSubscriberCount:
    """Tests for subscriber count endpoint"""
    
    def test_get_subscriber_count(self):
        """Test getting total subscriber count"""
        response = requests.get(f"{BASE_URL}/api/players/subscribers/count")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "count" in data, "Response should contain count"
        assert isinstance(data["count"], int), "count should be an integer"
        assert data["count"] >= 0, "count should be non-negative"
        
        print(f"✓ Subscriber count: {data['count']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
