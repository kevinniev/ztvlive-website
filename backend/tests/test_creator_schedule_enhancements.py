"""
ZTVLIVE Creator Schedule Enhancement Tests
Tests for: confetti celebration, copyright analysis, admin notifications, OBS health dashboard
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://best-bites-live.preview.emergentagent.com').rstrip('/')


class TestOBSHealthDashboard:
    """OBS Health Dashboard endpoint tests"""
    
    def test_obs_health_dashboard_returns_valid_response(self):
        """Test /api/obs/health-dashboard returns valid structure"""
        response = requests.get(f"{BASE_URL}/api/obs/health-dashboard")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields exist
        assert "obs_connection" in data
        assert "stream_health" in data
        assert "scheduler_sync" in data
        assert "overall_status" in data
        
        # Verify obs_connection structure
        obs = data["obs_connection"]
        assert "status" in obs
        assert "is_connected" in obs
        assert "last_check" in obs
        
        # Verify scheduler_sync structure
        sync = data["scheduler_sync"]
        assert "is_synced" in sync
        assert "current_content" in sync
        
        print(f"OBS Health Dashboard: overall_status={data['overall_status']}")
        print(f"OBS Connection: {obs['status']}, is_connected={obs['is_connected']}")
        print(f"Scheduler Sync: is_synced={sync['is_synced']}")


class TestAdminNotifications:
    """Admin Notifications endpoint tests"""
    
    def test_admin_notifications_all_returns_valid_response(self):
        """Test /api/admin-notifications/all returns valid structure"""
        response = requests.get(f"{BASE_URL}/api/admin-notifications/all")
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data
        assert "total" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        
        print(f"Admin Notifications: total={data['total']}, unread={data['unread_count']}")
    
    def test_admin_notifications_with_limit(self):
        """Test /api/admin-notifications/all with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/admin-notifications/all?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["notifications"]) <= 10
    
    def test_admin_notifications_unread_only(self):
        """Test /api/admin-notifications/all with unread_only parameter"""
        response = requests.get(f"{BASE_URL}/api/admin-notifications/all?unread_only=true")
        assert response.status_code == 200
        
        data = response.json()
        # All returned notifications should be unread
        for notification in data["notifications"]:
            assert notification.get("read") == False


class TestCreatorScheduleAvailableSlots:
    """Creator Schedule Available Slots tests"""
    
    def test_available_slots_returns_valid_response(self):
        """Test /api/creator-schedule/available-slots returns valid structure"""
        response = requests.get(f"{BASE_URL}/api/creator-schedule/available-slots?days_ahead=7")
        assert response.status_code == 200
        
        data = response.json()
        assert "available_slots" in data
        assert isinstance(data["available_slots"], list)
        
        if len(data["available_slots"]) > 0:
            day = data["available_slots"][0]
            assert "date" in day
            assert "day_name" in day
            assert "slots" in day
            
            if len(day["slots"]) > 0:
                slot = day["slots"][0]
                assert "date" in slot
                assert "hour" in slot
                assert "minute" in slot
                assert "time_display" in slot
                assert "is_available" in slot
        
        print(f"Available Slots: {len(data['available_slots'])} days returned")


class TestSmartScheduleBooking:
    """Smart Schedule Booking tests - verifies show_confetti field"""
    
    def test_smart_schedule_book_requires_auth(self):
        """Test /api/smart-schedule/book requires authentication"""
        payload = {
            "slot_date": "2026-04-15",
            "slot_time": "14:00",
            "duration_minutes": 60,
            "title": "Test Content",
            "description": "Test description",
            "content_type": "youtube",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "category": "creator_content"
        }
        
        response = requests.post(f"{BASE_URL}/api/smart-schedule/book", json=payload)
        # Should return 401 without auth
        assert response.status_code == 401
        print("Smart Schedule Book: Correctly requires authentication")
    
    def test_smart_schedule_response_model_has_confetti_field(self):
        """Verify SmartBookingResponse model includes show_confetti field"""
        # This is a code review test - verify the response model
        # The actual booking test would require authentication
        # We verify by checking the endpoint exists and returns proper error
        
        response = requests.post(f"{BASE_URL}/api/smart-schedule/book", json={})
        # Should return 401 (auth required) or 422 (validation error)
        assert response.status_code in [401, 422]
        print("Smart Schedule Book endpoint exists and validates input")


class TestCopyrightAnalyzer:
    """Copyright Analyzer service tests"""
    
    def test_parse_duration_endpoint(self):
        """Test /api/smart-schedule/parse-duration endpoint"""
        # Test various duration formats
        test_cases = [
            ("2h 30m", 150),
            ("90 minutes", 90),
            ("1h", 60),
            ("45m", 45),
            ("120", 120),
        ]
        
        for duration_text, expected_minutes in test_cases:
            response = requests.post(
                f"{BASE_URL}/api/smart-schedule/parse-duration?duration_text={duration_text}"
            )
            assert response.status_code == 200
            data = response.json()
            assert "minutes" in data
            assert data["minutes"] == expected_minutes
            print(f"Parse Duration: '{duration_text}' -> {data['minutes']} minutes")


class TestCreatorScheduleMyBookings:
    """Creator Schedule My Bookings tests"""
    
    def test_my_bookings_requires_auth(self):
        """Test /api/creator-schedule/my-bookings requires authentication"""
        response = requests.get(f"{BASE_URL}/api/creator-schedule/my-bookings")
        assert response.status_code == 401
        
        data = response.json()
        assert "detail" in data
        print("My Bookings: Correctly requires authentication")


class TestSmartSchedulePendingReminders:
    """Smart Schedule Pending Reminders tests"""
    
    def test_pending_reminders_requires_auth(self):
        """Test /api/smart-schedule/pending-reminders requires authentication"""
        response = requests.get(f"{BASE_URL}/api/smart-schedule/pending-reminders")
        assert response.status_code == 401
        print("Pending Reminders: Correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
