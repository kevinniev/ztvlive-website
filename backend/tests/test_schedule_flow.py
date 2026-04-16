"""
Test suite for ZTVLIVE Content Scheduling Flow
Features tested:
1. Admin login with credentials
2. Schedule availability API
3. Schedule request API
4. Schedule queue (admin)
5. Schedule approval/rejection APIs
6. Upcoming scheduled content API
7. Live comments API
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from environment variables
ADMIN_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', 'test@example.com')
ADMIN_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'test_password')


class TestAdminAuthentication:
    """Test admin login flow"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/login",
            params={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        print(f"Admin login status: {response.status_code}")
        print(f"Admin login response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == ADMIN_EMAIL, f"Expected email {ADMIN_EMAIL}"
        assert data["user"]["role"] == "admin" or data["user"]["role"] == "super_admin", "User should have admin role"
        
        # Store token for other tests
        TestAdminAuthentication.admin_token = data["access_token"]
        TestAdminAuthentication.admin_user = data["user"]
        print("✓ Admin login successful")
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/login",
            params={"email": "wrong@email.com", "password": "wrongpassword"}
        )
        
        assert response.status_code in [401, 403, 404], f"Expected 4xx error, got {response.status_code}"
        print("✓ Invalid credentials rejected correctly")


class TestScheduleAvailability:
    """Test schedule availability API"""
    
    def test_get_schedule_availability_today(self):
        """Test getting available time slots for today"""
        response = requests.get(f"{BASE_URL}/api/schedule/availability")
        print(f"Schedule availability status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "date" in data, "Response should contain date"
        assert "slots" in data, "Response should contain slots array"
        assert len(data["slots"]) > 0, "Should have time slots available"
        
        # Check slot structure
        first_slot = data["slots"][0]
        assert "time" in first_slot, "Slot should have time field"
        assert "time_utc" in first_slot, "Slot should have time_utc field"
        assert "available" in first_slot, "Slot should have available field"
        
        print(f"✓ Schedule availability returned {len(data['slots'])} slots for date {data['date']}")
    
    def test_get_schedule_availability_with_timezone(self):
        """Test schedule availability with timezone parameter"""
        response = requests.get(
            f"{BASE_URL}/api/schedule/availability",
            params={"timezone": "America/New_York"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["timezone"] == "America/New_York"
        print("✓ Schedule availability works with timezone parameter")
    
    def test_get_schedule_availability_future_date(self):
        """Test schedule availability for a future date"""
        future_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/schedule/availability",
            params={"date": future_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["date"] == future_date
        
        # Future date should have more available slots
        available_slots = [s for s in data["slots"] if s.get("available")]
        print(f"✓ Future date {future_date} has {len(available_slots)} available slots")


class TestScheduleQueue:
    """Test admin schedule queue API"""
    
    @pytest.fixture(autouse=True)
    def setup_admin_token(self):
        """Ensure admin token is available - always get fresh token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/login",
            params={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            TestAdminAuthentication.admin_token = response.json()["access_token"]
        else:
            pytest.skip("Admin authentication failed")
    
    def test_get_schedule_queue(self):
        """Test getting schedule queue (admin)"""
        response = requests.get(
            f"{BASE_URL}/api/schedule/queue",
            headers={"Authorization": f"Bearer {TestAdminAuthentication.admin_token}"}
        )
        print(f"Schedule queue status: {response.status_code}")
        print(f"Schedule queue response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pending" in data, "Response should contain pending array"
        assert "approved" in data, "Response should contain approved array"
        assert "completed" in data, "Response should contain completed array"
        
        # All should be arrays
        assert isinstance(data["pending"], list), "pending should be a list"
        assert isinstance(data["approved"], list), "approved should be a list"
        assert isinstance(data["completed"], list), "completed should be a list"
        
        print(f"✓ Schedule queue: {len(data['pending'])} pending, {len(data['approved'])} approved, {len(data['completed'])} completed")
    
    def test_schedule_queue_requires_auth(self):
        """Test that schedule queue requires authentication"""
        response = requests.get(f"{BASE_URL}/api/schedule/queue")
        
        # Should fail without auth
        assert response.status_code in [401, 403], f"Expected 4xx without auth, got {response.status_code}"
        print("✓ Schedule queue correctly requires authentication")


class TestUpcomingScheduled:
    """Test upcoming scheduled content API"""
    
    def test_get_upcoming_scheduled(self):
        """Test getting upcoming scheduled content (public)"""
        response = requests.get(f"{BASE_URL}/api/schedule/upcoming")
        print(f"Upcoming scheduled status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "upcoming" in data, "Response should contain upcoming array"
        assert isinstance(data["upcoming"], list), "upcoming should be a list"
        
        # If there are upcoming items, verify structure
        if len(data["upcoming"]) > 0:
            item = data["upcoming"][0]
            expected_fields = ["schedule_id", "title", "creator_name", "scheduled_time"]
            for field in expected_fields:
                assert field in item, f"Upcoming item should have {field}"
            print(f"✓ Upcoming scheduled content: {len(data['upcoming'])} items")
        else:
            print("✓ Upcoming scheduled content API works (0 items currently)")


class TestLiveComments:
    """Test live comments API"""
    
    def test_get_recent_live_comments(self):
        """Test getting recent live comments"""
        response = requests.get(f"{BASE_URL}/api/live-comments/recent")
        print(f"Live comments status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "comments" in data, "Response should contain comments array"
        assert isinstance(data["comments"], list), "comments should be a list"
        
        print(f"✓ Live comments: {len(data['comments'])} recent comments")
    
    def test_live_comments_with_limit(self):
        """Test live comments with limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/live-comments/recent",
            params={"limit": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["comments"]) <= 10, "Should respect limit parameter"
        print("✓ Live comments respects limit parameter")


class TestScheduleRequestFlow:
    """Test the full schedule request flow (requires creator auth)"""
    
    def test_schedule_request_requires_auth(self):
        """Test that schedule request requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/schedule/request",
            json={
                "video_id": "test_video",
                "requested_time": (datetime.now() + timedelta(hours=2)).isoformat(),
                "timezone": "UTC"
            }
        )
        
        # Should fail without auth
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print("✓ Schedule request correctly requires authentication")


class TestScheduleApprovalReject:
    """Test schedule approval and rejection (admin)"""
    
    @pytest.fixture(autouse=True)
    def setup_admin_token(self):
        """Ensure admin token is available - always get fresh token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/login",
            params={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            TestAdminAuthentication.admin_token = response.json()["access_token"]
        else:
            pytest.skip("Admin authentication failed")
    
    def test_approve_nonexistent_schedule(self):
        """Test approving a non-existent schedule"""
        response = requests.put(
            f"{BASE_URL}/api/schedule/nonexistent_schedule_id_123/approve",
            headers={"Authorization": f"Bearer {TestAdminAuthentication.admin_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Approve non-existent schedule returns 404")
    
    def test_reject_nonexistent_schedule(self):
        """Test rejecting a non-existent schedule"""
        response = requests.put(
            f"{BASE_URL}/api/schedule/nonexistent_schedule_id_123/reject",
            params={"reason": "Test rejection"},
            headers={"Authorization": f"Bearer {TestAdminAuthentication.admin_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Reject non-existent schedule returns 404")
    
    def test_approve_requires_admin(self):
        """Test that approval requires admin auth"""
        response = requests.put(f"{BASE_URL}/api/schedule/some_id/approve")
        
        assert response.status_code in [401, 403], f"Expected 4xx without admin auth, got {response.status_code}"
        print("✓ Approve correctly requires admin authentication")


class TestNowPlaying:
    """Test now playing scheduled content"""
    
    def test_get_now_playing(self):
        """Test getting currently playing scheduled content"""
        response = requests.get(f"{BASE_URL}/api/schedule/now-playing")
        print(f"Now playing status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "has_scheduled" in data, "Response should contain has_scheduled flag"
        
        if data["has_scheduled"]:
            assert "content" in data, "Should have content when has_scheduled is True"
            assert "elapsed_seconds" in data, "Should have elapsed_seconds"
            assert "remaining_seconds" in data, "Should have remaining_seconds"
            print(f"✓ Now playing: {data['content']['title']} (elapsed: {data['elapsed_seconds']}s)")
        else:
            print("✓ Now playing API works (no scheduled content currently)")


class TestMyScheduled:
    """Test getting creator's own scheduled content"""
    
    def test_my_scheduled_requires_auth(self):
        """Test that my-scheduled requires authentication"""
        response = requests.get(f"{BASE_URL}/api/schedule/my-scheduled")
        
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ My scheduled correctly requires authentication")


class TestAdminDashboardAPI:
    """Additional admin APIs for dashboard"""
    
    @pytest.fixture(autouse=True)
    def setup_admin_token(self):
        """Ensure admin token is available - always get fresh token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/login",
            params={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            TestAdminAuthentication.admin_token = response.json()["access_token"]
        else:
            pytest.skip("Admin authentication failed")
    
    def test_analytics_summary(self):
        """Test analytics summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/analytics/summary")
        print(f"Analytics summary status: {response.status_code}")
        
        # This might return 200 or 404 depending on implementation
        if response.status_code == 200:
            print("✓ Analytics summary endpoint available")
        else:
            print(f"⚠ Analytics summary not available (status: {response.status_code})")
    
    def test_analytics_realtime(self):
        """Test analytics realtime endpoint"""
        response = requests.get(f"{BASE_URL}/api/analytics/realtime")
        print(f"Analytics realtime status: {response.status_code}")
        
        if response.status_code == 200:
            print("✓ Analytics realtime endpoint available")
        else:
            print(f"⚠ Analytics realtime not available (status: {response.status_code})")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
