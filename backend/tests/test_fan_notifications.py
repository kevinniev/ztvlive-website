"""
Test Fan Notifications and Creator Stats for ZTVLIVE
Tests:
- POST /api/fan-notifications/subscribe - subscribing fans to creator notifications
- GET /api/fan-notifications/subscribers/{creator_id} - getting subscriber counts
- GET /api/creator/my-live-stats - getting creator's own live stats
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFanNotifications:
    """Fan notification subscription tests"""
    
    def test_subscribe_to_creator_notifications(self):
        """Test subscribing a fan to creator notifications"""
        unique_email = f"testfan_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(f"{BASE_URL}/api/fan-notifications/subscribe", json={
            "email": unique_email,
            "creator_id": "test-creator-123",
            "notify_live": True,
            "notify_scheduled": True
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "subscription_id" in data
        assert "email" in data
        assert data["email"] == unique_email
        print(f"✓ Fan subscription created: {data['subscription_id']}")
    
    def test_subscribe_to_all_creators(self):
        """Test subscribing to all creators (creator_id = None)"""
        unique_email = f"allfan_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(f"{BASE_URL}/api/fan-notifications/subscribe", json={
            "email": unique_email,
            "creator_id": None,  # Subscribe to all creators
            "notify_live": True,
            "notify_scheduled": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "subscription_id" in data
        print(f"✓ All-creators subscription created: {data['subscription_id']}")
    
    def test_update_existing_subscription(self):
        """Test updating an existing subscription"""
        unique_email = f"updatefan_{uuid.uuid4().hex[:8]}@example.com"
        
        # First subscription
        response1 = requests.post(f"{BASE_URL}/api/fan-notifications/subscribe", json={
            "email": unique_email,
            "creator_id": "test-creator-456",
            "notify_live": True,
            "notify_scheduled": True
        })
        assert response1.status_code == 200
        
        # Update subscription (same email + creator_id)
        response2 = requests.post(f"{BASE_URL}/api/fan-notifications/subscribe", json={
            "email": unique_email,
            "creator_id": "test-creator-456",
            "notify_live": False,  # Changed
            "notify_scheduled": True
        })
        assert response2.status_code == 200
        data = response2.json()
        assert "updated" in data["message"].lower() or "subscription" in data["message"].lower()
        print(f"✓ Subscription updated successfully")
    
    def test_invalid_email_format(self):
        """Test subscription with invalid email format"""
        response = requests.post(f"{BASE_URL}/api/fan-notifications/subscribe", json={
            "email": "not-an-email",
            "creator_id": "test-creator-123",
            "notify_live": True
        })
        
        # Should return 422 for validation error
        assert response.status_code == 422, f"Expected 422 for invalid email, got {response.status_code}"
        print(f"✓ Invalid email correctly rejected")


class TestSubscriberCount:
    """Subscriber count endpoint tests"""
    
    def test_get_subscriber_count(self):
        """Test getting subscriber count for a creator"""
        response = requests.get(f"{BASE_URL}/api/fan-notifications/subscribers/test-creator-123")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "creator_id" in data
        assert "direct_subscribers" in data
        assert "total_reach" in data
        assert data["creator_id"] == "test-creator-123"
        assert isinstance(data["direct_subscribers"], int)
        assert isinstance(data["total_reach"], int)
        print(f"✓ Subscriber count: direct={data['direct_subscribers']}, total_reach={data['total_reach']}")
    
    def test_subscriber_count_new_creator(self):
        """Test subscriber count for a creator with no subscribers"""
        new_creator_id = f"new-creator-{uuid.uuid4().hex[:8]}"
        response = requests.get(f"{BASE_URL}/api/fan-notifications/subscribers/{new_creator_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # New creator should have 0 direct subscribers
        assert data["direct_subscribers"] == 0
        # But may have total_reach from "all creators" subscribers
        assert data["total_reach"] >= 0
        print(f"✓ New creator subscriber count: {data}")


class TestCreatorLiveStats:
    """Creator live stats endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@ztvlivestream.com",
            "password": os.environ.get("TEST_ADMIN_PASSWORD", "REDACTED")
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
    
    def test_creator_stats_requires_auth(self):
        """Test that creator stats endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/creator/my-live-stats")
        
        # Should return 401 without auth
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Creator stats correctly requires authentication")
    
    def test_creator_stats_with_auth(self, admin_token):
        """Test creator stats with valid authentication"""
        response = requests.get(
            f"{BASE_URL}/api/creator/my-live-stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "is_my_content_live" in data
        assert isinstance(data["is_my_content_live"], bool)
        
        # Admin can see stats even when their content is not live
        # The endpoint returns full stats for admin regardless of is_my_content_live
        if data.get("is_my_content_live"):
            assert "content_title" in data
            assert "viewer_count" in data
            assert "elapsed_seconds" in data
            assert "remaining_seconds" in data
            print(f"✓ Creator content is LIVE: {data['content_title']}")
        else:
            # Admin gets stats even when not live (content_title, viewer_count, etc.)
            # OR regular creator gets message/next_scheduled
            has_stats = "content_title" in data or "viewer_count" in data
            has_message = "message" in data or "next_scheduled" in data
            assert has_stats or has_message, f"Expected stats or message, got: {data}"
            print(f"✓ Creator stats response: {data}")
    
    def test_creator_stats_response_structure(self, admin_token):
        """Test that creator stats returns proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/creator/my-live-stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Must have is_my_content_live field
        assert "is_my_content_live" in data
        
        # If live, must have these fields
        if data.get("is_my_content_live"):
            required_fields = ["content_title", "viewer_count", "elapsed_seconds", "remaining_seconds"]
            for field in required_fields:
                assert field in data, f"Missing field: {field}"
            
            # Numeric fields should be integers
            assert isinstance(data["viewer_count"], int)
            assert isinstance(data["elapsed_seconds"], (int, float))
            assert isinstance(data["remaining_seconds"], (int, float))
        
        print(f"✓ Creator stats structure validated")


class TestUnsubscribe:
    """Unsubscribe endpoint tests"""
    
    def test_unsubscribe_from_creator(self):
        """Test unsubscribing from a creator"""
        unique_email = f"unsub_{uuid.uuid4().hex[:8]}@example.com"
        
        # First subscribe
        sub_response = requests.post(f"{BASE_URL}/api/fan-notifications/subscribe", json={
            "email": unique_email,
            "creator_id": "test-creator-unsub",
            "notify_live": True
        })
        assert sub_response.status_code == 200
        
        # Then unsubscribe
        unsub_response = requests.delete(
            f"{BASE_URL}/api/fan-notifications/unsubscribe",
            params={"email": unique_email, "creator_id": "test-creator-unsub"}
        )
        
        assert unsub_response.status_code == 200
        data = unsub_response.json()
        assert "message" in data
        print(f"✓ Unsubscribe successful: {data['message']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
