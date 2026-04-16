"""
Test suite for Creator Live Status API endpoints
Tests countdown banner, live notification, and upcoming shows features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCreatorLiveStatusPublicEndpoints:
    """Tests for public endpoints that don't require authentication"""
    
    def test_currently_live_endpoint(self):
        """GET /api/creator-live/currently-live returns live status"""
        response = requests.get(f"{BASE_URL}/api/creator-live/currently-live")
        assert response.status_code == 200
        data = response.json()
        
        # Should have is_creator_content_live field
        assert "is_creator_content_live" in data
        assert isinstance(data["is_creator_content_live"], bool)
        
        # If not live, should have message
        if not data["is_creator_content_live"]:
            assert "message" in data
        print(f"PASS: currently-live returns is_creator_content_live={data['is_creator_content_live']}")
    
    def test_upcoming_shows_endpoint(self):
        """GET /api/creator-live/upcoming-shows returns list of upcoming shows"""
        response = requests.get(f"{BASE_URL}/api/creator-live/upcoming-shows")
        assert response.status_code == 200
        data = response.json()
        
        # Should have upcoming_shows array and total_upcoming count
        assert "upcoming_shows" in data
        assert "total_upcoming" in data
        assert isinstance(data["upcoming_shows"], list)
        assert isinstance(data["total_upcoming"], int)
        
        print(f"PASS: upcoming-shows returns {data['total_upcoming']} upcoming shows")
        
        # Verify the existing booking is in the list
        if data["total_upcoming"] > 0:
            show = data["upcoming_shows"][0]
            assert "booking_id" in show
            assert "title" in show
            assert "scheduled_start" in show
            assert "countdown_seconds" in show
            print(f"PASS: First upcoming show: '{show['title']}' with countdown {show['countdown_seconds']}s")
    
    def test_upcoming_shows_with_limit(self):
        """GET /api/creator-live/upcoming-shows?limit=1 respects limit parameter"""
        response = requests.get(f"{BASE_URL}/api/creator-live/upcoming-shows?limit=1")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["upcoming_shows"]) <= 1
        print(f"PASS: upcoming-shows respects limit parameter")
    
    def test_booking_status_endpoint(self):
        """GET /api/creator-live/booking/{booking_id}/status returns booking status"""
        # First get a booking ID from upcoming shows
        response = requests.get(f"{BASE_URL}/api/creator-live/upcoming-shows")
        data = response.json()
        
        if data["total_upcoming"] > 0:
            booking_id = data["upcoming_shows"][0]["booking_id"]
            
            # Test booking status endpoint
            status_response = requests.get(f"{BASE_URL}/api/creator-live/booking/{booking_id}/status")
            assert status_response.status_code == 200
            status_data = status_response.json()
            
            assert "status" in status_data
            assert "is_live" in status_data
            assert "title" in status_data
            assert status_data["status"] in ["upcoming", "live", "ended"]
            
            print(f"PASS: booking/{booking_id}/status returns status='{status_data['status']}'")
        else:
            pytest.skip("No upcoming bookings to test")
    
    def test_booking_status_not_found(self):
        """GET /api/creator-live/booking/{invalid_id}/status returns 404"""
        response = requests.get(f"{BASE_URL}/api/creator-live/booking/invalid-booking-id-12345/status")
        assert response.status_code == 404
        print("PASS: Invalid booking ID returns 404")


class TestCreatorLiveStatusAuthEndpoints:
    """Tests for authenticated endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@ztvlivestream.com",
            "password": os.environ.get("TEST_ADMIN_PASSWORD", "REDACTED")
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        pytest.skip("Could not authenticate")
    
    def test_my_status_requires_auth(self):
        """GET /api/creator-live/my-status returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/creator-live/my-status")
        assert response.status_code == 401
        print("PASS: my-status requires authentication")
    
    def test_my_status_with_auth(self, auth_token):
        """GET /api/creator-live/my-status returns status with auth"""
        response = requests.get(
            f"{BASE_URL}/api/creator-live/my-status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have status field
        assert "status" in data
        assert data["status"] in ["idle", "upcoming", "live"]
        
        # Should have is_live and is_upcoming flags
        assert "is_live" in data
        assert "is_upcoming" in data
        
        print(f"PASS: my-status returns status='{data['status']}'")
        
        # If upcoming, verify countdown data
        if data["status"] == "upcoming":
            assert "countdown_seconds" in data
            assert "countdown_formatted" in data
            assert "scheduled_start" in data
            assert "banner" in data
            assert data["banner"]["type"] in ["upcoming", "soon", "imminent"]
            print(f"PASS: Upcoming status has countdown: {data['countdown_formatted']}")
            print(f"PASS: Banner type: {data['banner']['type']}, title: {data['banner']['title']}")
        
        # If live, verify live data
        if data["status"] == "live":
            assert "elapsed_seconds" in data
            assert "remaining_seconds" in data
            assert "watch_url" in data
            assert data["banner"]["type"] == "live"
            print(f"PASS: Live status has elapsed/remaining times")
    
    def test_my_status_banner_structure(self, auth_token):
        """Verify banner structure in my-status response"""
        response = requests.get(
            f"{BASE_URL}/api/creator-live/my-status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["status"] != "idle":
            banner = data.get("banner")
            assert banner is not None
            assert "type" in banner
            assert "title" in banner
            assert "subtitle" in banner
            assert "cta_text" in banner
            assert "cta_url" in banner
            print(f"PASS: Banner structure is complete with type={banner['type']}")
        else:
            # Idle status should have cta for scheduling
            assert "cta" in data or data.get("banner") is None
            print("PASS: Idle status has no banner (expected)")


class TestInterviewWithACCaswellBooking:
    """Specific tests for the existing 'interview with AC Caswell' booking"""
    
    def test_ac_caswell_booking_in_upcoming(self):
        """Verify 'interview with AC Caswell' appears in upcoming shows"""
        response = requests.get(f"{BASE_URL}/api/creator-live/upcoming-shows")
        assert response.status_code == 200
        data = response.json()
        
        # Find the AC Caswell booking
        ac_caswell_booking = None
        for show in data["upcoming_shows"]:
            if "AC Caswell" in show.get("title", ""):
                ac_caswell_booking = show
                break
        
        assert ac_caswell_booking is not None, "AC Caswell booking not found in upcoming shows"
        
        # Verify booking details
        assert ac_caswell_booking["title"] == "interview with AC Caswell"
        assert ac_caswell_booking["creator_name"] == "admin"
        assert ac_caswell_booking["duration_minutes"] == 60
        assert "countdown_seconds" in ac_caswell_booking
        assert ac_caswell_booking["countdown_seconds"] > 0
        
        print(f"PASS: 'interview with AC Caswell' found with countdown {ac_caswell_booking['countdown_seconds']}s")
    
    def test_ac_caswell_booking_status(self):
        """Verify booking status endpoint works for AC Caswell booking"""
        # Get the booking ID
        response = requests.get(f"{BASE_URL}/api/creator-live/upcoming-shows")
        data = response.json()
        
        ac_caswell_booking = None
        for show in data["upcoming_shows"]:
            if "AC Caswell" in show.get("title", ""):
                ac_caswell_booking = show
                break
        
        assert ac_caswell_booking is not None
        booking_id = ac_caswell_booking["booking_id"]
        
        # Check booking status
        status_response = requests.get(f"{BASE_URL}/api/creator-live/booking/{booking_id}/status")
        assert status_response.status_code == 200
        status_data = status_response.json()
        
        assert status_data["status"] == "upcoming"
        assert status_data["is_live"] == False
        assert status_data["title"] == "interview with AC Caswell"
        assert "countdown_seconds" in status_data
        
        print(f"PASS: AC Caswell booking status is 'upcoming' with countdown")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
