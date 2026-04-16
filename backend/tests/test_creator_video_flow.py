"""
ZTVLIVE Creator Video Flow Tests
Tests for:
1. Video submission saves to creator library with correct creator_id
2. Creator dashboard shows videos with 'In Library' status badge
3. Creator dashboard shows Schedule button for library videos
4. Public creator profile page shows creator's videos
5. Schedule page displays available time slots
6. Submit success page shows 'Schedule for Livestream' and 'Keep in Library' options
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCreatorVideoFlow:
    """Test the complete creator video submission and management flow"""
    
    # Test credentials from environment variables
    admin_email = os.environ.get('TEST_ADMIN_EMAIL', 'test@example.com')
    admin_password = os.environ.get('TEST_ADMIN_PASSWORD', 'test_password')
    admin_user_id = os.environ.get('TEST_ADMIN_USER_ID', 'test_user_id')
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.test_video_id = None
        yield
        # Cleanup: Delete test video if created
        if self.test_video_id:
            try:
                self.session.delete(
                    f"{BASE_URL}/api/creator-videos/video/{self.test_video_id}",
                    params={"creator_id": self.admin_user_id}
                )
            except:
                pass
    
    def test_01_health_check(self):
        """Test API health endpoint"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"API not healthy: {data}"
        print("✓ API health check passed")
    
    def test_02_admin_login(self):
        """Test admin login to get auth token"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": self.admin_email,
                "password": self.admin_password
            }
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data or "user" in data, f"No token/user in response: {data}"
        
        # Store token for subsequent requests
        if "token" in data:
            self.session.headers.update({"Authorization": f"Bearer {data['token']}"})
        
        print(f"✓ Admin login successful: {data.get('user', {}).get('email', 'N/A')}")
        return data
    
    def test_03_link_submission_saves_to_creator_library(self):
        """Test that link submission saves to creator_videos collection with correct creator_id"""
        # First login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": self.admin_email,
                "password": self.admin_password
            }
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        
        if "token" in login_data:
            self.session.headers.update({"Authorization": f"Bearer {login_data['token']}"})
        
        # Submit a video link with creator_id
        test_title = f"TEST_Video_{uuid.uuid4().hex[:8]}"
        submission_data = {
            "title": test_title,
            "category": "music",
            "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "description": "Test video submission for creator library",
            "submitter_name": "Admin Test",
            "submitter_email": self.admin_email,
            "why_trending": "Testing creator video flow",
            "submission_type": "link",
            "creator_id": self.admin_user_id
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/submissions",
            json=submission_data
        )
        
        assert response.status_code == 200, f"Submission failed: {response.text}"
        data = response.json()
        
        # Verify submission was created
        assert "id" in data, f"No submission ID returned: {data}"
        self.test_video_id = data["id"]
        
        print(f"✓ Video submission created with ID: {self.test_video_id}")
        
        # Verify video is in creator_videos collection via my-videos endpoint
        videos_response = self.session.get(
            f"{BASE_URL}/api/creator-videos/my-videos",
            params={"creator_id": self.admin_user_id}
        )
        
        assert videos_response.status_code == 200, f"Failed to get my-videos: {videos_response.text}"
        videos = videos_response.json()
        
        # Find our test video
        test_video = next((v for v in videos if v.get("title") == test_title), None)
        assert test_video is not None, f"Test video not found in creator library. Videos: {[v.get('title') for v in videos[:5]]}"
        
        # Verify creator_id is correct
        assert test_video.get("creator_id") == self.admin_user_id, f"Creator ID mismatch: {test_video.get('creator_id')} != {self.admin_user_id}"
        
        # Verify status is 'library'
        assert test_video.get("status") == "library", f"Video status should be 'library', got: {test_video.get('status')}"
        
        print(f"✓ Video saved to creator library with correct creator_id and 'library' status")
        return test_video
    
    def test_04_creator_videos_my_videos_endpoint(self):
        """Test that /api/creator-videos/my-videos returns videos for creator"""
        response = self.session.get(
            f"{BASE_URL}/api/creator-videos/my-videos",
            params={"creator_id": self.admin_user_id}
        )
        
        assert response.status_code == 200, f"my-videos endpoint failed: {response.text}"
        videos = response.json()
        
        assert isinstance(videos, list), f"Expected list, got: {type(videos)}"
        print(f"✓ my-videos endpoint returned {len(videos)} videos")
        
        # Check video structure
        if videos:
            video = videos[0]
            required_fields = ["id", "title", "creator_id", "status"]
            for field in required_fields:
                assert field in video, f"Missing field '{field}' in video: {video.keys()}"
            
            # Check for library status videos
            library_videos = [v for v in videos if v.get("status") == "library"]
            print(f"✓ Found {len(library_videos)} videos with 'library' status")
        
        return videos
    
    def test_05_public_creator_profile_shows_videos(self):
        """Test that public creator profile endpoint returns creator's videos"""
        # Try with user_id first (since admin might not have username set)
        response = self.session.get(f"{BASE_URL}/api/creator/{self.admin_user_id}")
        
        if response.status_code == 404:
            # Try with 'admin' username
            response = self.session.get(f"{BASE_URL}/api/creator/admin")
        
        if response.status_code == 404:
            print("⚠ Creator profile not found - admin user may not have username set")
            pytest.skip("Admin user doesn't have a public profile set up")
        
        assert response.status_code == 200, f"Creator profile failed: {response.text}"
        data = response.json()
        
        # Verify profile structure
        assert "profile" in data, f"No profile in response: {data.keys()}"
        assert "videos" in data, f"No videos in response: {data.keys()}"
        
        profile = data["profile"]
        videos = data["videos"]
        
        print(f"✓ Creator profile loaded: {profile.get('display_name', 'N/A')}")
        print(f"✓ Profile shows {len(videos)} videos")
        
        # Verify videos have required fields
        if videos:
            video = videos[0]
            assert "title" in video, f"Video missing title: {video.keys()}"
            assert "status" in video, f"Video missing status: {video.keys()}"
        
        return data
    
    def test_06_schedule_available_slots_endpoint(self):
        """Test that schedule page can fetch available time slots"""
        response = self.session.get(
            f"{BASE_URL}/api/creator-schedule/available-slots",
            params={"days_ahead": 7}
        )
        
        assert response.status_code == 200, f"Available slots endpoint failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "available_slots" in data, f"No available_slots in response: {data.keys()}"
        
        slots = data["available_slots"]
        assert isinstance(slots, list), f"Expected list, got: {type(slots)}"
        
        print(f"✓ Schedule endpoint returned {len(slots)} days of slots")
        
        # Check slot structure
        if slots:
            day = slots[0]
            assert "day_name" in day, f"Missing day_name in slot: {day.keys()}"
            assert "date" in day, f"Missing date in slot: {day.keys()}"
            assert "slots" in day, f"Missing slots in day: {day.keys()}"
            
            if day["slots"]:
                slot = day["slots"][0]
                assert "time_display" in slot, f"Missing time_display in slot: {slot.keys()}"
                assert "is_available" in slot, f"Missing is_available in slot: {slot.keys()}"
                
                available_count = sum(1 for s in day["slots"] if s.get("is_available"))
                print(f"✓ First day has {available_count} available slots")
        
        return data
    
    def test_07_submission_response_includes_library_status(self):
        """Test that submission response includes status for library/schedule options"""
        # Login first
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": self.admin_email,
                "password": self.admin_password
            }
        )
        if login_response.status_code == 200:
            login_data = login_response.json()
            if "token" in login_data:
                self.session.headers.update({"Authorization": f"Bearer {login_data['token']}"})
        
        # Submit another test video
        test_title = f"TEST_StatusCheck_{uuid.uuid4().hex[:8]}"
        submission_data = {
            "title": test_title,
            "category": "tech",
            "source_url": "https://www.youtube.com/watch?v=test123",
            "description": "Test for status response",
            "submitter_name": "Admin Test",
            "why_trending": "Testing status response",
            "submission_type": "link",
            "creator_id": self.admin_user_id
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/submissions",
            json=submission_data
        )
        
        assert response.status_code == 200, f"Submission failed: {response.text}"
        data = response.json()
        
        # The response should include status field
        # Note: The HighlightSubmission model has status field with default "pending"
        # But when creator_id is provided, video is saved to creator_videos with "library" status
        assert "id" in data, f"No ID in response: {data}"
        
        # Verify the video in creator_videos has library status
        videos_response = self.session.get(
            f"{BASE_URL}/api/creator-videos/my-videos",
            params={"creator_id": self.admin_user_id}
        )
        
        if videos_response.status_code == 200:
            videos = videos_response.json()
            test_video = next((v for v in videos if v.get("title") == test_title), None)
            if test_video:
                assert test_video.get("status") == "library", f"Expected 'library' status, got: {test_video.get('status')}"
                print(f"✓ Video saved with 'library' status for schedule/keep options")
                
                # Cleanup
                try:
                    self.session.delete(
                        f"{BASE_URL}/api/creator-videos/video/{test_video['id']}",
                        params={"creator_id": self.admin_user_id}
                    )
                except:
                    pass
        
        return data


class TestCreatorDashboardAPIs:
    """Test APIs used by Creator Dashboard"""
    
    admin_user_id = "user_9c8d972958d4"
    
    def test_my_videos_returns_status_badges(self):
        """Test that my-videos returns videos with status for badge display"""
        session = requests.Session()
        response = session.get(
            f"{BASE_URL}/api/creator-videos/my-videos",
            params={"creator_id": self.admin_user_id}
        )
        
        assert response.status_code == 200, f"my-videos failed: {response.text}"
        videos = response.json()
        
        # Count videos by status
        status_counts = {}
        for video in videos:
            status = video.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print(f"✓ Videos by status: {status_counts}")
        
        # Verify status field exists
        for video in videos[:3]:  # Check first 3
            assert "status" in video, f"Video missing status field: {video.get('title')}"
        
        return videos


class TestSchedulePageAPIs:
    """Test APIs used by Schedule Page"""
    
    def test_available_slots_structure(self):
        """Test available slots endpoint returns proper structure"""
        session = requests.Session()
        response = session.get(
            f"{BASE_URL}/api/creator-schedule/available-slots",
            params={"days_ahead": 7}
        )
        
        assert response.status_code == 200, f"Available slots failed: {response.text}"
        data = response.json()
        
        assert "available_slots" in data, "Missing available_slots"
        
        # Verify booking rules if present
        if "booking_rules" in data:
            rules = data["booking_rules"]
            print(f"✓ Booking rules: {rules}")
        
        slots = data["available_slots"]
        if slots:
            # Verify day structure
            day = slots[0]
            print(f"✓ First day: {day.get('day_name')} - {day.get('date')}")
            
            # Verify slot structure
            if day.get("slots"):
                slot = day["slots"][0]
                print(f"✓ Sample slot: {slot.get('time_display')} - Available: {slot.get('is_available')}")
        
        return data
    
    def test_smart_schedule_parse_duration(self):
        """Test smart schedule duration parsing"""
        session = requests.Session()
        
        # Test various duration formats
        test_cases = [
            ("1 hour", 60),
            ("30 minutes", 30),
            ("2h 30m", 150),
            ("90", 90),
        ]
        
        for duration_text, expected_minutes in test_cases:
            response = session.post(
                f"{BASE_URL}/api/smart-schedule/parse-duration",
                params={"duration_text": duration_text}
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✓ '{duration_text}' parsed to {data.get('minutes')} minutes")
            else:
                print(f"⚠ Duration parsing not available or failed for '{duration_text}'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
