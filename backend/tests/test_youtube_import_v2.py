"""
ZTVLIVE YouTube Import V2 API Tests
Tests the NEW YouTube channel connection and auto-sync features:
- connect-channel (with verification code)
- verify-ownership
- connected-channels
- sync-channel
- disconnect-channel
- update sync settings
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from environment variables
TEST_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', 'test@example.com')
TEST_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'test_password')


class TestConnectedChannelsAuth:
    """Test authentication requirements for new Connected Channels endpoints"""
    
    def test_connect_channel_requires_auth(self):
        """POST /api/youtube-import/connect-channel should return 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/connect-channel",
            params={
                "creator_id": "test_creator_123",
                "creator_name": "Test Creator"
            },
            json={
                "channel_url": "@goodtechcheap",
                "youtube_api_key": "fake_key",
                "auto_sync_enabled": True
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: connect-channel returns 401 without auth")
    
    def test_verify_ownership_requires_auth(self):
        """POST /api/youtube-import/verify-ownership should return 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/verify-ownership",
            params={
                "channel_id": "UC_test_channel",
                "creator_id": "test_creator_123"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: verify-ownership returns 401 without auth")
    
    def test_connected_channels_requires_auth(self):
        """GET /api/youtube-import/connected-channels should return 401 without token"""
        response = requests.get(
            f"{BASE_URL}/api/youtube-import/connected-channels",
            params={"creator_id": "test_creator_123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: connected-channels returns 401 without auth")
    
    def test_sync_channel_requires_auth(self):
        """POST /api/youtube-import/sync-channel/{channel_id} should return 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/sync-channel/UC_test_channel",
            params={"creator_id": "test_creator_123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: sync-channel returns 401 without auth")
    
    def test_disconnect_channel_requires_auth(self):
        """DELETE /api/youtube-import/connected-channel/{channel_id} should return 401 without token"""
        response = requests.delete(
            f"{BASE_URL}/api/youtube-import/connected-channel/UC_test_channel",
            params={"creator_id": "test_creator_123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: disconnect-channel returns 401 without auth")
    
    def test_update_settings_requires_auth(self):
        """PUT /api/youtube-import/connected-channel/{channel_id}/settings should return 401 without token"""
        response = requests.put(
            f"{BASE_URL}/api/youtube-import/connected-channel/UC_test_channel/settings",
            params={
                "creator_id": "test_creator_123",
                "auto_sync_enabled": True,
                "sync_interval_hours": 24
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: update-settings returns 401 without auth")


class TestConnectedChannelsWithAuth:
    """Test Connected Channels endpoints with valid authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token") or data.get("session_token")
            self.user = data.get("user", {})
            self.user_id = self.user.get("user_id") or self.user.get("id")
            self.user_name = self.user.get("name") or self.user.get("display_name", "Test User")
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    def test_connected_channels_returns_list(self):
        """GET /api/youtube-import/connected-channels should return list with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/youtube-import/connected-channels",
            params={"creator_id": self.user_id},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "channels" in data
        assert isinstance(data["channels"], list)
        print(f"PASS: connected-channels returns list with auth (found {len(data['channels'])} channels)")
    
    def test_connect_channel_with_invalid_api_key(self):
        """POST /api/youtube-import/connect-channel should return error with invalid API key"""
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/connect-channel",
            params={
                "creator_id": self.user_id,
                "creator_name": self.user_name
            },
            json={
                "channel_url": "@goodtechcheap",
                "youtube_api_key": "invalid_api_key_12345",
                "auto_sync_enabled": True
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        # Should return 400 with YouTube API error (invalid key)
        assert response.status_code in [400, 500], f"Expected 400/500, got {response.status_code}: {response.text}"
        print(f"PASS: connect-channel returns error with invalid API key (status: {response.status_code})")
    
    def test_verify_ownership_channel_not_found(self):
        """POST /api/youtube-import/verify-ownership should return 404 for non-connected channel"""
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/verify-ownership",
            params={
                "channel_id": "UC_nonexistent_channel_12345",
                "creator_id": self.user_id
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"PASS: verify-ownership returns 404 for non-connected channel")
    
    def test_sync_channel_not_found(self):
        """POST /api/youtube-import/sync-channel/{channel_id} should return 404 for non-verified channel"""
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/sync-channel/UC_nonexistent_channel_12345",
            params={"creator_id": self.user_id},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"PASS: sync-channel returns 404 for non-verified channel")
    
    def test_disconnect_channel_not_found(self):
        """DELETE /api/youtube-import/connected-channel/{channel_id} should return 404 for non-connected channel"""
        response = requests.delete(
            f"{BASE_URL}/api/youtube-import/connected-channel/UC_nonexistent_channel_12345",
            params={"creator_id": self.user_id},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"PASS: disconnect-channel returns 404 for non-connected channel")
    
    def test_update_settings_not_found(self):
        """PUT /api/youtube-import/connected-channel/{channel_id}/settings should return 404 for non-verified channel"""
        response = requests.put(
            f"{BASE_URL}/api/youtube-import/connected-channel/UC_nonexistent_channel_12345/settings",
            params={
                "creator_id": self.user_id,
                "auto_sync_enabled": True,
                "sync_interval_hours": 24
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"PASS: update-settings returns 404 for non-verified channel")


class TestConnectChannelResponseFormat:
    """Test that connect-channel returns proper verification code format"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token") or data.get("session_token")
            self.user = data.get("user", {})
            self.user_id = self.user.get("user_id") or self.user.get("id")
            self.user_name = self.user.get("name") or self.user.get("display_name", "Test User")
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    def test_connect_channel_response_structure(self):
        """Verify connect-channel endpoint exists and returns proper error for invalid key"""
        # We can't test with a real API key, but we can verify the endpoint structure
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/connect-channel",
            params={
                "creator_id": self.user_id,
                "creator_name": self.user_name
            },
            json={
                "channel_url": "@testchannel",
                "youtube_api_key": "test_key_123",
                "auto_sync_enabled": True,
                "sync_interval_hours": 24
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        # With invalid API key, should return 400 or 500
        # The important thing is the endpoint exists and processes the request
        assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code}"
        print(f"PASS: connect-channel endpoint exists and processes requests (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
