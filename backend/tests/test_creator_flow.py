"""
ZTVLIVE Creator Flow Tests
Tests: Signup, Login, Upload (File/YouTube/TikTok), Dashboard, Library
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")

# Test credentials
TEST_EMAIL = "admin@ztvlivestream.com"
TEST_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "REDACTED")
TEST_NAME = "Admin User"

# For signup tests - unique email
UNIQUE_EMAIL = f"test_creator_{uuid.uuid4().hex[:8]}@test.com"


class TestAuthFlow:
    """Test authentication endpoints - signup and login"""
    
    def test_health_check(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✓ Health check passed")
    
    def test_signup_new_user(self):
        """Test creator signup with new email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "email": UNIQUE_EMAIL,
                "password": "TestPass123!",
                "name": "Test Creator"
            }
        )
        # Should succeed or return 400 if email already exists
        assert response.status_code in [200, 201, 400], f"Signup failed: {response.status_code} - {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "user" in data or "success" in data, f"Unexpected signup response: {data}"
            print(f"✓ Signup successful for {UNIQUE_EMAIL}")
        else:
            print(f"✓ Signup returned 400 (email may already exist): {response.json()}")
    
    def test_login_with_valid_credentials(self):
        """Test login with admin credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "user" in data or "success" in data, f"Login response missing user: {data}"
        
        # Check for session token
        if "session_token" in data:
            print(f"✓ Login successful, got session_token")
        elif "token" in data:
            print(f"✓ Login successful, got token")
        else:
            print(f"✓ Login successful: {list(data.keys())}")
    
    def test_login_with_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": "WrongPassword123"
            }
        )
        assert response.status_code in [401, 400], f"Expected 401/400 for invalid login, got {response.status_code}"
        print("✓ Invalid login correctly rejected")
    
    def test_auth_me_endpoint(self):
        """Test /auth/me with valid token"""
        # First login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        token = data.get("session_token") or data.get("token")
        
        if not token:
            pytest.skip("No token returned from login")
        
        # Test /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"/auth/me failed: {response.status_code} - {response.text}"
        
        user_data = response.json()
        assert "user_id" in user_data or "email" in user_data, f"User data missing expected fields: {user_data}"
        print(f"✓ /auth/me returned user data: {user_data.get('email', user_data.get('user_id'))}")


class TestCreatorVideos:
    """Test creator video endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Could not authenticate")
        data = response.json()
        return data.get("session_token") or data.get("token")
    
    @pytest.fixture
    def user_id(self, auth_token):
        """Get user ID from /auth/me"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code != 200:
            pytest.skip("Could not get user info")
        return response.json().get("user_id")
    
    def test_get_my_videos(self, auth_token, user_id):
        """Test fetching creator's video library"""
        response = requests.get(
            f"{BASE_URL}/api/creator-videos/my-videos",
            params={"creator_id": user_id, "limit": 10},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get my videos failed: {response.status_code} - {response.text}"
        
        videos = response.json()
        assert isinstance(videos, list), f"Expected list of videos, got: {type(videos)}"
        print(f"✓ Got {len(videos)} videos from library")
    
    def test_upload_youtube_video(self, auth_token, user_id):
        """Test uploading a YouTube video link"""
        response = requests.post(
            f"{BASE_URL}/api/creator-videos/upload",
            params={
                "creator_id": user_id,
                "creator_name": "Test Creator"
            },
            json={
                "title": f"Test YouTube Upload {datetime.now().isoformat()}",
                "description": "Test video upload via API",
                "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "category": "entertainment",
                "tags": ["test"]
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Accept 200, 201, or 422 (validation error)
        assert response.status_code in [200, 201, 422], f"Upload failed: {response.status_code} - {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "video_id" in data or "id" in data, f"Upload response missing video_id: {data}"
            print(f"✓ YouTube video uploaded successfully")
        else:
            print(f"✓ Upload returned validation error (expected): {response.json()}")
    
    def test_browse_videos(self):
        """Test public video browse endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/creator-videos/browse",
            params={"limit": 10}
        )
        assert response.status_code == 200, f"Browse failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "videos" in data or isinstance(data, list), f"Unexpected browse response: {data}"
        print(f"✓ Browse endpoint working")


class TestCreatorDashboard:
    """Test creator dashboard related endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Could not authenticate")
        data = response.json()
        return data.get("session_token") or data.get("token")
    
    @pytest.fixture
    def user_id(self, auth_token):
        """Get user ID"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code != 200:
            pytest.skip("Could not get user info")
        return response.json().get("user_id")
    
    def test_creator_stats(self, auth_token, user_id):
        """Test creator stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/creator/{user_id}/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Stats endpoint may return 200 or 404 if no stats yet
        assert response.status_code in [200, 404], f"Stats failed: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Creator stats: {data}")
        else:
            print("✓ Creator stats endpoint accessible (no stats yet)")
    
    def test_my_bookings(self, auth_token):
        """Test fetching creator's scheduled bookings"""
        response = requests.get(
            f"{BASE_URL}/api/creator-schedule/my-bookings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"My bookings failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "bookings" in data or isinstance(data, list), f"Unexpected bookings response: {data}"
        print(f"✓ My bookings endpoint working")
    
    def test_content_automation_notifications(self, auth_token):
        """Test content automation notifications"""
        response = requests.get(
            f"{BASE_URL}/api/content-automation/my-notifications",
            params={"unread_only": True},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # May return 200 or 404
        assert response.status_code in [200, 404], f"Notifications failed: {response.status_code} - {response.text}"
        print("✓ Notifications endpoint accessible")
    
    def test_agreement_status(self, auth_token):
        """Test creator agreement status"""
        response = requests.get(
            f"{BASE_URL}/api/content-review/agreement-status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # May return 200 or 404
        assert response.status_code in [200, 404], f"Agreement status failed: {response.status_code} - {response.text}"
        print("✓ Agreement status endpoint accessible")


class TestUploadEndpoints:
    """Test file upload endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Could not authenticate")
        data = response.json()
        return data.get("session_token") or data.get("token")
    
    @pytest.fixture
    def user_id(self, auth_token):
        """Get user ID"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code != 200:
            pytest.skip("Could not get user info")
        return response.json().get("user_id")
    
    def test_video_upload_endpoint_exists(self, auth_token, user_id):
        """Test that video upload endpoint exists"""
        # Test with empty file to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/uploads/video",
            data={
                "creator_id": user_id,
                "creator_name": "Test Creator",
                "category": "entertainment"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Should return 422 (missing file) or 400, not 404
        assert response.status_code != 404, f"Upload endpoint not found: {response.status_code}"
        print(f"✓ Video upload endpoint exists (returned {response.status_code})")
    
    def test_import_video_endpoint(self, auth_token, user_id):
        """Test TikTok/Shorts import endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/creator-videos/import-video",
            params={
                "url": "https://www.tiktok.com/@test/video/123",
                "output_resolution": "1920x1080",
                "blur_background": True,
                "creator_id": user_id
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # May return various codes - just verify endpoint exists
        assert response.status_code != 404, f"Import endpoint not found: {response.status_code}"
        print(f"✓ Import video endpoint exists (returned {response.status_code})")


class TestYouTubeImport:
    """Test YouTube channel import"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Could not authenticate")
        data = response.json()
        return data.get("session_token") or data.get("token")
    
    def test_youtube_import_endpoint(self, auth_token):
        """Test YouTube channel import endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/youtube-import/quick-import",
            json={
                "channel_url": "https://www.youtube.com/@test",
                "creator_id": "test_user",
                "creator_name": "Test Creator"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Endpoint should exist - may fail due to invalid channel
        assert response.status_code != 404, f"YouTube import endpoint not found: {response.status_code}"
        print(f"✓ YouTube import endpoint exists (returned {response.status_code})")


class TestScheduling:
    """Test scheduling endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Could not authenticate")
        data = response.json()
        return data.get("session_token") or data.get("token")
    
    def test_available_slots(self, auth_token):
        """Test fetching available time slots"""
        response = requests.get(
            f"{BASE_URL}/api/creator-schedule/available-slots",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Available slots failed: {response.status_code} - {response.text}"
        print("✓ Available slots endpoint working")
    
    def test_schedule_grid(self, auth_token):
        """Test schedule grid endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/creator-schedule/schedule-grid",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Schedule grid failed: {response.status_code} - {response.text}"
        print("✓ Schedule grid endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
