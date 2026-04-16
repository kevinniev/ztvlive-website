"""
Test Video Delete Functionality for ZTVLIVE
Tests the DELETE /api/creator-videos/video/{video_id} endpoint
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVideoDelete:
    """Test video delete functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_creator_id = f"test_delete_user_{uuid.uuid4().hex[:8]}"
        self.test_creator_name = "Test Delete User"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_health_check(self):
        """Verify API is healthy"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_create_video_for_delete(self):
        """Create a test video to delete later"""
        # Create a video
        video_data = {
            "title": f"TEST_DELETE_VIDEO_{uuid.uuid4().hex[:8]}",
            "description": "This video will be deleted",
            "category": "music",
            "video_url": "https://www.youtube.com/watch?v=test123",
            "duration_seconds": 120,
            "tags": ["test", "delete"]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/creator-videos/upload",
            params={
                "creator_id": self.test_creator_id,
                "creator_name": self.test_creator_name
            },
            json=video_data,
            headers={"Authorization": "Bearer test_token_123"}
        )
        
        assert response.status_code == 200, f"Failed to create video: {response.text}"
        created_video = response.json()
        assert "id" in created_video
        print(f"✓ Created test video with ID: {created_video['id']}")
        return created_video
    
    def test_delete_video_success(self):
        """Test successful video deletion"""
        # First create a video
        video_data = {
            "title": f"TEST_DELETE_SUCCESS_{uuid.uuid4().hex[:8]}",
            "description": "This video will be deleted successfully",
            "category": "music",
            "video_url": "https://www.youtube.com/watch?v=delete_test",
            "duration_seconds": 60,
            "tags": ["test"]
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/creator-videos/upload",
            params={
                "creator_id": self.test_creator_id,
                "creator_name": self.test_creator_name
            },
            json=video_data,
            headers={"Authorization": "Bearer test_token_123"}
        )
        
        assert create_response.status_code == 200, f"Failed to create video: {create_response.text}"
        video_id = create_response.json()["id"]
        print(f"✓ Created video for deletion: {video_id}")
        
        # Now delete the video
        delete_response = self.session.delete(
            f"{BASE_URL}/api/creator-videos/video/{video_id}",
            params={"creator_id": self.test_creator_id}
        )
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        delete_data = delete_response.json()
        assert delete_data["status"] == "deleted"
        assert delete_data["video_id"] == video_id
        print(f"✓ Successfully deleted video: {video_id}")
        
        # Verify video is gone
        get_response = self.session.get(f"{BASE_URL}/api/creator-videos/video/{video_id}")
        assert get_response.status_code == 404, "Video should not exist after deletion"
        print("✓ Verified video no longer exists")
    
    def test_delete_video_not_found(self):
        """Test deleting a non-existent video returns 404"""
        fake_video_id = f"fake_{uuid.uuid4().hex}"
        
        response = self.session.delete(
            f"{BASE_URL}/api/creator-videos/video/{fake_video_id}",
            params={"creator_id": self.test_creator_id}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent video returns 404")
    
    def test_delete_video_wrong_creator(self):
        """Test that a creator cannot delete another creator's video"""
        # First create a video with one creator
        video_data = {
            "title": f"TEST_WRONG_CREATOR_{uuid.uuid4().hex[:8]}",
            "description": "This video belongs to creator A",
            "category": "music",
            "video_url": "https://www.youtube.com/watch?v=wrong_creator",
            "duration_seconds": 60,
            "tags": ["test"]
        }
        
        creator_a_id = f"creator_a_{uuid.uuid4().hex[:8]}"
        
        create_response = self.session.post(
            f"{BASE_URL}/api/creator-videos/upload",
            params={
                "creator_id": creator_a_id,
                "creator_name": "Creator A"
            },
            json=video_data,
            headers={"Authorization": "Bearer test_token_123"}
        )
        
        assert create_response.status_code == 200
        video_id = create_response.json()["id"]
        print(f"✓ Created video by Creator A: {video_id}")
        
        # Try to delete with a different creator
        creator_b_id = f"creator_b_{uuid.uuid4().hex[:8]}"
        
        delete_response = self.session.delete(
            f"{BASE_URL}/api/creator-videos/video/{video_id}",
            params={"creator_id": creator_b_id}
        )
        
        assert delete_response.status_code == 404, f"Expected 404 (not authorized), got {delete_response.status_code}"
        print("✓ Cannot delete another creator's video (returns 404)")
        
        # Cleanup - delete with correct creator
        cleanup_response = self.session.delete(
            f"{BASE_URL}/api/creator-videos/video/{video_id}",
            params={"creator_id": creator_a_id}
        )
        assert cleanup_response.status_code == 200
        print("✓ Cleanup: deleted video with correct creator")
    
    def test_delete_scheduled_video_fails(self):
        """Test that scheduled videos cannot be deleted"""
        # First create a video
        video_data = {
            "title": f"TEST_SCHEDULED_{uuid.uuid4().hex[:8]}",
            "description": "This video will be scheduled",
            "category": "music",
            "video_url": f"https://www.youtube.com/watch?v=scheduled_{uuid.uuid4().hex[:8]}",
            "duration_seconds": 120,
            "tags": ["test", "scheduled"]
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/creator-videos/upload",
            params={
                "creator_id": self.test_creator_id,
                "creator_name": self.test_creator_name
            },
            json=video_data,
            headers={"Authorization": "Bearer test_token_123"}
        )
        
        assert create_response.status_code == 200
        video = create_response.json()
        video_id = video["id"]
        video_url = video["video_url"]
        print(f"✓ Created video for scheduling: {video_id}")
        
        # Create a booking for this video
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        booking_data = {
            "slot_date": future_date,
            "slot_start_hour": 14,
            "content_title": video["title"],
            "video_url": video_url,
            "duration_minutes": 2,
            "content_source": "library"
        }
        
        booking_response = self.session.post(
            f"{BASE_URL}/api/creator-schedule/book-slot",
            params={
                "creator_id": self.test_creator_id,
                "creator_name": self.test_creator_name
            },
            json=booking_data,
            headers={"Authorization": "Bearer test_token_123"}
        )
        
        # Check if booking was created
        if booking_response.status_code == 200:
            print(f"✓ Created booking for video")
            
            # Now try to delete the scheduled video
            delete_response = self.session.delete(
                f"{BASE_URL}/api/creator-videos/video/{video_id}",
                params={"creator_id": self.test_creator_id}
            )
            
            # Should return 400 because video is scheduled
            assert delete_response.status_code == 400, f"Expected 400 for scheduled video, got {delete_response.status_code}: {delete_response.text}"
            error_detail = delete_response.json().get("detail", "")
            assert "scheduled" in error_detail.lower() or "cancel" in error_detail.lower(), f"Error should mention scheduled: {error_detail}"
            print(f"✓ Cannot delete scheduled video: {error_detail}")
            
            # Cleanup - cancel booking first
            bookings_response = self.session.get(
                f"{BASE_URL}/api/creator-schedule/my-bookings",
                headers={"Authorization": "Bearer test_token_123"}
            )
            if bookings_response.status_code == 200:
                bookings = bookings_response.json().get("bookings", [])
                for booking in bookings:
                    if booking.get("video_url") == video_url:
                        cancel_response = self.session.delete(
                            f"{BASE_URL}/api/creator-schedule/booking/{booking['id']}",
                            params={"creator_id": self.test_creator_id},
                            headers={"Authorization": "Bearer test_token_123"}
                        )
                        print(f"✓ Cancelled booking: {cancel_response.status_code}")
            
            # Now delete should work
            final_delete = self.session.delete(
                f"{BASE_URL}/api/creator-videos/video/{video_id}",
                params={"creator_id": self.test_creator_id}
            )
            print(f"✓ Cleanup delete: {final_delete.status_code}")
        else:
            print(f"⚠ Could not create booking (status {booking_response.status_code}), skipping scheduled video test")
            # Still cleanup the video
            self.session.delete(
                f"{BASE_URL}/api/creator-videos/video/{video_id}",
                params={"creator_id": self.test_creator_id}
            )
    
    def test_delete_endpoint_url_format(self):
        """Verify the correct endpoint URL format is used"""
        # The correct endpoint should be: DELETE /api/creator-videos/video/{video_id}?creator_id={creator_id}
        # NOT: DELETE /api/creator-videos/{video_id}
        
        # Create a test video
        video_data = {
            "title": f"TEST_URL_FORMAT_{uuid.uuid4().hex[:8]}",
            "description": "Testing URL format",
            "category": "music",
            "video_url": "https://www.youtube.com/watch?v=url_format_test",
            "duration_seconds": 60,
            "tags": ["test"]
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/creator-videos/upload",
            params={
                "creator_id": self.test_creator_id,
                "creator_name": self.test_creator_name
            },
            json=video_data,
            headers={"Authorization": "Bearer test_token_123"}
        )
        
        assert create_response.status_code == 200
        video_id = create_response.json()["id"]
        
        # Test CORRECT URL format: /api/creator-videos/video/{video_id}
        correct_url = f"{BASE_URL}/api/creator-videos/video/{video_id}"
        delete_response = self.session.delete(
            correct_url,
            params={"creator_id": self.test_creator_id}
        )
        
        assert delete_response.status_code == 200, f"Correct URL format should work: {delete_response.status_code}"
        print(f"✓ Correct URL format works: DELETE /api/creator-videos/video/{{video_id}}?creator_id={{creator_id}}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
