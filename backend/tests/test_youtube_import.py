"""
ZTVLIVE YouTube Import API Tests
Tests the YouTube channel import feature endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from environment variables
TEST_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', 'test@example.com')
TEST_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'test_password')


class TestYouTubeImportAuth:
    """Test authentication requirements for YouTube Import endpoints"""
    
    def test_lookup_channel_requires_auth(self):
        """POST /api/youtube-import/lookup-channel should return 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/lookup-channel",
            json={
                "channel_url": "@goodtechcheap",
                "youtube_api_key": "fake_key"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: lookup-channel returns 401 without auth")
    
    def test_my_imports_requires_auth(self):
        """GET /api/youtube-import/my-imports should return 401 without token"""
        response = requests.get(
            f"{BASE_URL}/api/youtube-import/my-imports",
            params={"creator_id": "test_creator_123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: my-imports returns 401 without auth")
    
    def test_start_import_requires_auth(self):
        """POST /api/youtube-import/start-import should return 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/start-import",
            params={
                "creator_id": "test_creator_123",
                "creator_name": "Test Creator"
            },
            json={
                "channel_url": "@goodtechcheap",
                "youtube_api_key": "fake_key"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: start-import returns 401 without auth")
    
    def test_job_status_requires_auth(self):
        """GET /api/youtube-import/job/{job_id} should return 401 without token"""
        response = requests.get(
            f"{BASE_URL}/api/youtube-import/job/fake_job_id"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: job status returns 401 without auth")
    
    def test_imported_channels_requires_auth(self):
        """GET /api/youtube-import/imported-channels should return 401 without token"""
        response = requests.get(
            f"{BASE_URL}/api/youtube-import/imported-channels",
            params={"creator_id": "test_creator_123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: imported-channels returns 401 without auth")
    
    def test_cancel_job_requires_auth(self):
        """DELETE /api/youtube-import/job/{job_id} should return 401 without token"""
        response = requests.delete(
            f"{BASE_URL}/api/youtube-import/job/fake_job_id",
            params={"creator_id": "test_creator_123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "Authentication required" in data["detail"]
        print(f"PASS: cancel job returns 401 without auth")


class TestYouTubeImportWithAuth:
    """Test YouTube Import endpoints with valid authentication"""
    
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
    
    def test_my_imports_with_auth(self):
        """GET /api/youtube-import/my-imports should return list with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/youtube-import/my-imports",
            params={"creator_id": self.user_id},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "imports" in data
        assert isinstance(data["imports"], list)
        print(f"PASS: my-imports returns list with auth (found {len(data['imports'])} imports)")
    
    def test_imported_channels_with_auth(self):
        """GET /api/youtube-import/imported-channels should return list with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/youtube-import/imported-channels",
            params={"creator_id": self.user_id},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "channels" in data
        assert isinstance(data["channels"], list)
        print(f"PASS: imported-channels returns list with auth (found {len(data['channels'])} channels)")
    
    def test_lookup_channel_with_invalid_api_key(self):
        """POST /api/youtube-import/lookup-channel should return error with invalid API key"""
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/lookup-channel",
            json={
                "channel_url": "@goodtechcheap",
                "youtube_api_key": "invalid_api_key_12345"
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        # Should return 400 with YouTube API error (invalid key)
        assert response.status_code in [400, 500], f"Expected 400/500, got {response.status_code}: {response.text}"
        print(f"PASS: lookup-channel returns error with invalid API key (status: {response.status_code})")
    
    def test_job_status_not_found(self):
        """GET /api/youtube-import/job/{job_id} should return 404 for non-existent job"""
        response = requests.get(
            f"{BASE_URL}/api/youtube-import/job/nonexistent_job_id_12345",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"PASS: job status returns 404 for non-existent job")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
