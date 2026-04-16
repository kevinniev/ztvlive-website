"""
Tests for Push Notifications and Geolocation APIs - ZTVLIVE
Testing "Notify Me" feature endpoints and ipinfo.io geolocation service
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_PLAYER_ID = f"test-player-{uuid.uuid4().hex[:8]}"
TEST_CREATOR_ID = "test-creator-123"
TEST_CREATOR_NAME = "Test Creator"


class TestPushNotificationAPIs:
    """Push notification endpoint tests - "Notify Me" feature"""
    
    def test_push_subscribe(self):
        """Test push subscription registration"""
        response = requests.post(f"{BASE_URL}/api/push/subscribe", json={
            "player_id": TEST_PLAYER_ID,
            "user_id": "test-user-001",
            "device_type": "web"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "subscribed"
        assert data.get("player_id") == TEST_PLAYER_ID
        print(f"✓ Push subscription registered: {TEST_PLAYER_ID}")
    
    def test_follow_creator(self):
        """Test follow creator endpoint"""
        response = requests.post(f"{BASE_URL}/api/push/follow-creator", json={
            "creator_id": TEST_CREATOR_ID,
            "creator_name": TEST_CREATOR_NAME,
            "player_id": TEST_PLAYER_ID,
            "user_id": "test-user-001"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") in ["following", "already_following"]
        assert data.get("creator_id") == TEST_CREATOR_ID
        print(f"✓ Follow creator successful: {data}")
    
    def test_check_following_status(self):
        """Test check if user is following a creator"""
        response = requests.get(
            f"{BASE_URL}/api/push/is-following/{TEST_CREATOR_ID}",
            params={"player_id": TEST_PLAYER_ID}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "is_following" in data
        assert data.get("creator_id") == TEST_CREATOR_ID
        print(f"✓ Following status check: is_following={data.get('is_following')}")
    
    def test_get_following_list(self):
        """Test get list of creators user is following"""
        response = requests.get(
            f"{BASE_URL}/api/push/following",
            params={"player_id": TEST_PLAYER_ID}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "following" in data
        assert "count" in data
        assert isinstance(data.get("following"), list)
        print(f"✓ Following list retrieved: count={data.get('count')}")
    
    def test_get_push_stats(self):
        """Test push notification stats endpoint for admin dashboard"""
        response = requests.get(f"{BASE_URL}/api/push/stats", params={"days": 30})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_subscriptions" in data
        assert "total_follows" in data
        assert "top_followed_creators" in data
        assert "period_days" in data
        assert "generated_at" in data
        
        # Verify data types
        assert isinstance(data.get("total_subscriptions"), int)
        assert isinstance(data.get("total_follows"), int)
        assert isinstance(data.get("top_followed_creators"), list)
        
        print(f"✓ Push stats retrieved: subscriptions={data.get('total_subscriptions')}, follows={data.get('total_follows')}")
    
    def test_unfollow_creator(self):
        """Test unfollow creator endpoint"""
        response = requests.post(f"{BASE_URL}/api/push/unfollow-creator", json={
            "creator_id": TEST_CREATOR_ID,
            "player_id": TEST_PLAYER_ID
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") in ["unfollowed", "not_following"]
        assert data.get("creator_id") == TEST_CREATOR_ID
        print(f"✓ Unfollow creator: status={data.get('status')}")
    
    def test_verify_unfollowed(self):
        """Verify creator was actually unfollowed"""
        response = requests.get(
            f"{BASE_URL}/api/push/is-following/{TEST_CREATOR_ID}",
            params={"player_id": TEST_PLAYER_ID}
        )
        
        assert response.status_code == 200
        data = response.json()
        # After unfollow, should be not following
        assert data.get("is_following") == False
        print(f"✓ Verified unfollowed: is_following={data.get('is_following')}")
    
    def test_follow_without_player_id_fails(self):
        """Test follow-creator without player_id should fail validation"""
        response = requests.post(f"{BASE_URL}/api/push/follow-creator", json={
            "creator_id": TEST_CREATOR_ID,
            "creator_name": TEST_CREATOR_NAME
            # Missing player_id
        })
        
        # Should return 422 (validation error) since player_id is required
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Follow without player_id correctly rejected with 422")
    
    def test_get_creator_followers(self):
        """Test get creator followers count endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/push/creator/{TEST_CREATOR_ID}/followers"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "creator_id" in data
        assert "follower_count" in data
        assert isinstance(data.get("follower_count"), int)
        print(f"✓ Creator followers count: {data.get('follower_count')}")


class TestGeolocationAPIs:
    """Geolocation service tests - ipinfo.io integration"""
    
    def test_geolocation_lookup_public_ip(self):
        """Test geolocation lookup for a public IP"""
        # Using Google's public DNS IP for testing
        test_ip = "8.8.8.8"
        response = requests.get(f"{BASE_URL}/api/analytics/geolocation/lookup/{test_ip}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "ip" in data
        assert "location" in data
        
        location = data.get("location", {})
        assert "country" in location or "country_code" in location
        print(f"✓ Geolocation lookup for {test_ip}: {location.get('country', location.get('country_code'))}")
    
    def test_geolocation_lookup_private_ip(self):
        """Test geolocation lookup for a private IP (should return Local)"""
        test_ip = "192.168.1.1"
        response = requests.get(f"{BASE_URL}/api/analytics/geolocation/lookup/{test_ip}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        location = data.get("location", {})
        # Private IPs should be marked as local/private
        assert location.get("is_private") == True or location.get("country") in ["Local", "Unknown"]
        print(f"✓ Private IP lookup handled correctly: {location}")
    
    def test_geolocation_stats(self):
        """Test geolocation service statistics"""
        response = requests.get(f"{BASE_URL}/api/analytics/geolocation/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "service" in data
        assert data.get("service") == "ipinfo.io"
        assert "cache_stats" in data
        assert "status" in data
        print(f"✓ Geolocation service stats: service={data.get('service')}, status={data.get('status')}")
    
    def test_enhanced_demographics(self):
        """Test enhanced demographics endpoint with geolocation data"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/demographics/enhanced",
            params={"days": 30}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "period_days" in data
        assert "locations" in data
        assert "service" in data
        assert data.get("service") == "ipinfo.io"
        
        # Verify locations structure
        locations = data.get("locations", {})
        assert "by_country" in locations
        assert "by_city" in locations
        assert "by_region" in locations
        
        print(f"✓ Enhanced demographics retrieved: countries={len(locations.get('by_country', []))}")
    
    def test_basic_demographics(self):
        """Test basic demographics endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/demographics",
            params={"days": 30}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "period_days" in data
        assert "locations" in data
        assert "time_patterns" in data
        assert "session_duration" in data
        assert "devices" in data
        
        print(f"✓ Basic demographics retrieved successfully")


class TestCreatorProfileWithNotifyMe:
    """Test creator profile related to NotifyMe button"""
    
    def test_get_creator_profile(self):
        """Test getting creator profile by username"""
        response = requests.get(f"{BASE_URL}/api/creator/testcreator")
        
        # Profile might not exist - that's okay, we're testing the endpoint works
        if response.status_code == 200:
            data = response.json()
            assert "profile" in data or "user_id" in data
            print(f"✓ Creator profile found: {data.get('profile', {}).get('username', 'testcreator')}")
        elif response.status_code == 404:
            print("✓ Creator profile endpoint works (profile not found - expected for test)")
        else:
            # Any other status code is unexpected
            assert False, f"Unexpected status code: {response.status_code}"


class TestAdminDashboardPushStats:
    """Test admin dashboard push notification statistics display"""
    
    def test_admin_login(self):
        """Test admin login and get token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/login",
            params={
                "email": "admin@ztvlivestream.com",
                "password": os.environ.get("TEST_ADMIN_PASSWORD", "REDACTED")
            }
        )
        
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ Admin login successful")
        return data.get("access_token")
    
    def test_push_stats_structure_for_dashboard(self):
        """Verify push stats have correct structure for admin dashboard display"""
        response = requests.get(f"{BASE_URL}/api/push/stats", params={"days": 30})
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all fields needed for admin dashboard
        required_fields = [
            "total_subscriptions",  # For "Push Subscribers" card
            "total_follows",        # For "Creator Follows" card
            "top_followed_creators" # For "Top Creator" card
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify top_followed_creators has correct structure if not empty
        if data.get("top_followed_creators"):
            creator = data["top_followed_creators"][0]
            assert "creator_id" in creator or "creator_name" in creator
            assert "followers" in creator
        
        print(f"✓ Push stats structure valid for dashboard display")
        print(f"  - Push Subscribers: {data.get('total_subscriptions')}")
        print(f"  - Creator Follows: {data.get('total_follows')}")
        print(f"  - Top Creators: {len(data.get('top_followed_creators', []))}")


# Cleanup fixture - runs after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup any test data after tests complete"""
    yield
    # No cleanup needed - test data will be cleaned by TTL or manual cleanup


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
