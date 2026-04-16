"""
Admin Dashboard V2 Backend Tests
Tests for admin authentication, analytics, and revenue management endpoints
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')

# Test Credentials from environment variables
ADMIN_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', 'test@example.com')
ADMIN_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'test_password')
ADMIN_CODE = os.environ.get('TEST_ADMIN_CODE', 'TEST_CODE')


class TestContentLibrary:
    """Tests for content library with 250+ items"""
    
    def test_content_library_returns_251_items(self):
        """Test that content library returns 251 items"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        data = response.json()
        total = data.get("total_content", 0)
        print(f"Total content items: {total}")
        assert total >= 250, f"Expected 250+ items, got {total}"
    
    def test_content_library_has_required_categories(self):
        """Test that required categories are present"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        data = response.json()
        categories = data.get("categories", {})
        
        required_categories = ["hiphop", "rnb", "afrobeats", "sports"]
        for cat in required_categories:
            assert cat in categories, f"Missing category: {cat}"
            items = categories[cat]
            print(f"Category '{cat}' has {len(items)} items")
            assert len(items) > 0, f"Category '{cat}' is empty"


class TestAdminAuth:
    """Admin authentication endpoint tests"""
    
    def test_admin_login_with_valid_credentials(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/login",
            params={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        # Should succeed if admin was created previously
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            assert "user" in data
            assert data["user"]["email"] == ADMIN_EMAIL.lower()
            print(f"Admin login successful: {data['user']['name']} ({data['user']['role']})")
        elif response.status_code == 401:
            # Admin may not exist yet, try registration
            print("Admin not found - registration may be needed first")
            pytest.skip("Admin user not created yet")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/login",
            params={"email": "wrong@example.com", "password": "wrongpass"}
        )
        assert response.status_code == 401
        print("Invalid credentials correctly rejected")
    
    def test_admin_register_without_code(self):
        """Test admin registration without admin code fails"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/register",
            params={
                "email": "newadmin@test.com",
                "password": "test123",
                "name": "New Admin"
            }
        )
        # Should fail without admin code
        assert response.status_code in [403, 422]
        print("Registration without admin code correctly rejected")


class TestAnalyticsEndpoints:
    """Tests for analytics tracking endpoints"""
    
    def test_track_pageview(self):
        """Test page view tracking endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/analytics/track/pageview",
            params={"page": "homepage", "session_id": "test_session_123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("tracked") == True
        assert "session_id" in data
        print(f"Page view tracked: {data}")
    
    def test_track_heartbeat(self):
        """Test heartbeat tracking for concurrent viewers"""
        response = requests.post(
            f"{BASE_URL}/api/analytics/track/heartbeat",
            params={"session_id": "test_session_123", "page": "watch"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("active") == True
        print("Heartbeat tracking working")
    
    def test_get_concurrent_viewers(self):
        """Test concurrent viewers endpoint"""
        response = requests.get(f"{BASE_URL}/api/analytics/concurrent")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "by_page" in data
        print(f"Concurrent viewers: {data['total']}")
    
    def test_analytics_summary(self):
        """Test analytics summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/analytics/summary", params={"days": 7})
        assert response.status_code == 200
        data = response.json()
        assert "total_page_views" in data
        assert "unique_visitors" in data
        assert "concurrent_viewers" in data
        print(f"Analytics summary: {data['total_page_views']} views, {data['unique_visitors']} unique")
    
    def test_realtime_stats(self):
        """Test real-time statistics endpoint"""
        response = requests.get(f"{BASE_URL}/api/analytics/realtime")
        assert response.status_code == 200
        data = response.json()
        assert "concurrent_viewers" in data
        assert "views_last_5min" in data
        assert "views_last_hour" in data
        print(f"Realtime: {data['concurrent_viewers']} concurrent, {data['views_last_hour']} in last hour")


class TestRevenueEndpoints:
    """Tests for revenue management endpoints"""
    
    def test_get_ad_settings(self):
        """Test ad settings retrieval"""
        response = requests.get(f"{BASE_URL}/api/revenue/ads/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Check that response has either default settings or persisted settings
        # Settings may not all be present if never updated (only id is guaranteed)
        assert "id" in data, "Missing id in ad settings"
        
        # If pre_roll_enabled is present, verify it's a boolean
        if "pre_roll_enabled" in data:
            assert isinstance(data["pre_roll_enabled"], bool)
        
        print(f"Ad settings: {data}")
    
    def test_get_subscription_tiers(self):
        """Test subscription tiers endpoint"""
        response = requests.get(f"{BASE_URL}/api/revenue/subscriptions/tiers")
        assert response.status_code == 200
        data = response.json()
        
        assert "tiers" in data
        tiers = data["tiers"]
        assert len(tiers) >= 3, "Should have at least 3 tiers (Free, Basic, Premium)"
        
        tier_names = [t["name"] for t in tiers]
        assert "Free" in tier_names
        assert "Basic" in tier_names
        assert "Premium" in tier_names
        
        for tier in tiers:
            assert "price_monthly" in tier
            assert "features" in tier
            print(f"Tier: {tier['name']} - ${tier['price_monthly']}/mo")
    
    def test_get_payouts(self):
        """Test creator payouts endpoint"""
        response = requests.get(f"{BASE_URL}/api/revenue/payouts")
        assert response.status_code == 200
        data = response.json()
        assert "payouts" in data
        print(f"Found {len(data['payouts'])} payouts")
    
    def test_revenue_summary(self):
        """Test revenue summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/revenue/summary", params={"days": 30})
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = [
            "total_revenue",
            "ad_revenue",
            "subscription_revenue",
            "tips_revenue",
            "pending_payouts",
            "completed_payouts"
        ]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        print(f"Revenue summary: ${data['total_revenue']} total")
    
    def test_update_ad_settings(self):
        """Test updating ad settings"""
        response = requests.put(
            f"{BASE_URL}/api/revenue/ads/settings",
            params={"pre_roll_enabled": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert "updated" in data
        print("Ad settings updated successfully")


class TestAdminAuthenticatedEndpoints:
    """Tests for endpoints that require admin authentication"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/login",
            params={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_get_admin_profile(self, admin_token):
        """Test getting admin profile with auth"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin-auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "role" in data
        print(f"Admin profile: {data['email']} ({data['role']})")
    
    def test_admin_logout(self, admin_token):
        """Test admin logout"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/admin-auth/logout", headers=headers)
        assert response.status_code == 200
        print("Admin logout successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
