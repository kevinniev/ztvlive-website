"""
Test Content Review and Creator Agreement APIs
Tests for: agreement-status, accept-agreement, review-queue, copyright-stats, flag-copyright, analyze-audio
Also tests MRSS feed endpoints
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@ztvlivestream.com"
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "REDACTED")


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_health_endpoint(self):
        """Test API health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data['status']}")


class TestAuthentication:
    """Test authentication for content review endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        print(f"Login response status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            token = data.get("session_token") or data.get("token")
            print(f"✓ Login successful, got token: {token[:20]}...")
            return token
        else:
            print(f"Login failed: {response.text}")
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_login_success(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data or "token" in data
        print(f"✓ Admin login successful")


class TestAgreementEndpoints:
    """Test creator agreement endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_agreement_status_requires_auth(self):
        """Test agreement-status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/content-review/agreement-status")
        assert response.status_code == 401
        print(f"✓ Agreement status correctly requires auth")
    
    def test_agreement_status_with_auth(self, auth_token):
        """Test agreement-status with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/content-review/agreement-status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "accepted" in data
        print(f"✓ Agreement status: accepted={data.get('accepted')}")
    
    def test_accept_agreement_requires_auth(self):
        """Test accept-agreement requires authentication"""
        response = requests.post(f"{BASE_URL}/api/content-review/accept-agreement", json={
            "user_id": "test",
            "accepted_at": datetime.now().isoformat(),
            "ip_address": "test",
            "sections_read": {"rights": True, "music": True, "indemnity": True, "content": True, "revenue": True}
        })
        assert response.status_code == 401
        print(f"✓ Accept agreement correctly requires auth")
    
    def test_accept_agreement_with_auth(self, auth_token):
        """Test accept-agreement with valid auth"""
        response = requests.post(
            f"{BASE_URL}/api/content-review/accept-agreement",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "user_id": "test_user",
                "accepted_at": datetime.now().isoformat(),
                "ip_address": "test",
                "sections_read": {"rights": True, "music": True, "indemnity": True, "content": True, "revenue": True}
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Accept agreement successful: {data.get('message')}")


class TestReviewQueueEndpoints:
    """Test content review queue endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_review_queue_requires_auth(self):
        """Test review-queue requires authentication"""
        response = requests.get(f"{BASE_URL}/api/content-review/review-queue")
        assert response.status_code == 401
        print(f"✓ Review queue correctly requires auth")
    
    def test_review_queue_with_auth(self, auth_token):
        """Test review-queue with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/content-review/review-queue",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "videos" in data
        assert "bookings" in data
        assert "total_pending" in data
        print(f"✓ Review queue: {len(data.get('videos', []))} videos, {len(data.get('bookings', []))} bookings, {data.get('total_pending')} pending")
    
    def test_review_queue_with_status_filter(self, auth_token):
        """Test review-queue with status filter"""
        for status in ["pending", "approved", "rejected", "flagged", "all"]:
            response = requests.get(
                f"{BASE_URL}/api/content-review/review-queue?status={status}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert response.status_code == 200
            print(f"✓ Review queue with status={status}: OK")


class TestCopyrightEndpoints:
    """Test copyright-related endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_copyright_stats_requires_auth(self):
        """Test copyright-stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/content-review/copyright-stats")
        assert response.status_code == 401
        print(f"✓ Copyright stats correctly requires auth")
    
    def test_copyright_stats_with_auth(self, auth_token):
        """Test copyright-stats with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/content-review/copyright-stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "pending_review" in data
        assert "approved" in data
        assert "rejected" in data
        assert "flagged" in data
        assert "music_warnings" in data
        assert "total" in data
        print(f"✓ Copyright stats: pending={data.get('pending_review')}, approved={data.get('approved')}, flagged={data.get('flagged')}, total={data.get('total')}")
    
    def test_flag_copyright_requires_auth(self):
        """Test flag-copyright requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/content-review/flag-copyright/test_id?flag_type=music&description=test"
        )
        assert response.status_code == 401
        print(f"✓ Flag copyright correctly requires auth")
    
    def test_flag_copyright_not_found(self, auth_token):
        """Test flag-copyright with non-existent content"""
        response = requests.post(
            f"{BASE_URL}/api/content-review/flag-copyright/nonexistent_id_12345?flag_type=music&description=test",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        print(f"✓ Flag copyright returns 404 for non-existent content")
    
    def test_analyze_audio_requires_auth(self):
        """Test analyze-audio requires authentication"""
        response = requests.post(f"{BASE_URL}/api/content-review/analyze-audio/test_id")
        assert response.status_code == 401
        print(f"✓ Analyze audio correctly requires auth")
    
    def test_analyze_audio_not_found(self, auth_token):
        """Test analyze-audio with non-existent content"""
        response = requests.post(
            f"{BASE_URL}/api/content-review/analyze-audio/nonexistent_id_12345",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        print(f"✓ Analyze audio returns 404 for non-existent content")


class TestMRSSEndpoints:
    """Test MRSS feed endpoints"""
    
    def test_mrss_feed_xml(self):
        """Test MRSS feed.xml endpoint"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml")
        assert response.status_code == 200
        assert "application/rss+xml" in response.headers.get("Content-Type", "")
        assert "<?xml" in response.text
        assert "<rss" in response.text
        assert "ZTVLIVE" in response.text
        print(f"✓ MRSS feed.xml returns valid XML")
    
    def test_mrss_feed_without_extension(self):
        """Test MRSS feed endpoint without .xml"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed")
        assert response.status_code == 200
        assert "<?xml" in response.text
        print(f"✓ MRSS feed (no extension) works")
    
    def test_mrss_info(self):
        """Test MRSS info endpoint"""
        response = requests.get(f"{BASE_URL}/api/mrss/info")
        assert response.status_code == 200
        data = response.json()
        assert "feed_name" in data
        assert "feed_url" in data
        assert "content_stats" in data
        assert "available_categories" in data
        assert "supported_platforms" in data
        print(f"✓ MRSS info: {data.get('feed_name')}, {data.get('content_stats', {}).get('total_available')} items available")
    
    def test_mrss_validate(self):
        """Test MRSS validate endpoint"""
        response = requests.get(f"{BASE_URL}/api/mrss/validate")
        assert response.status_code == 200
        data = response.json()
        assert "valid" in data
        assert "issues" in data
        assert "warnings" in data
        print(f"✓ MRSS validate: valid={data.get('valid')}, issues={len(data.get('issues', []))}, warnings={len(data.get('warnings', []))}")
    
    def test_mrss_categories(self):
        """Test MRSS categories endpoint"""
        response = requests.get(f"{BASE_URL}/api/mrss/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert "total_categories" in data
        print(f"✓ MRSS categories: {data.get('total_categories')} categories with content")


class TestContentGuidelinesPage:
    """Test Content Guidelines page loads"""
    
    def test_content_guidelines_page_loads(self):
        """Test /content-guidelines page returns HTML"""
        response = requests.get(f"{BASE_URL}/content-guidelines")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")
        print(f"✓ Content Guidelines page loads (status 200)")


class TestCreatorAgreementPage:
    """Test Creator Agreement page"""
    
    def test_creator_agreement_page_loads(self):
        """Test /creator-agreement page returns HTML"""
        response = requests.get(f"{BASE_URL}/creator-agreement")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")
        print(f"✓ Creator Agreement page loads (status 200)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
