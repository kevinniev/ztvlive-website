"""
ZTVLIVE Notification System Tests
Tests for creator and admin notification endpoints
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Use the public URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL.rstrip('/')

# Test credentials from environment variables
TEST_CREATOR_ID = f"test_creator_{uuid.uuid4().hex[:8]}"
TEST_USER_ID = f"test_user_{uuid.uuid4().hex[:8]}"
ADMIN_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', 'test@example.com')
ADMIN_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'test_password')


class TestNotificationTriggers:
    """Tests for notification trigger endpoints"""
    
    def test_trigger_video_live_notification(self):
        """Test POST /api/notifications/trigger-video-live"""
        video_id = f"test_video_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/notifications/trigger-video-live",
            params={
                "video_id": video_id,
                "creator_id": TEST_CREATOR_ID,
                "video_title": "Test Video Going Live"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["status"] == "notification_sent"
        assert data["video_id"] == video_id
        assert data["creator_id"] == TEST_CREATOR_ID
        print(f"✓ trigger-video-live notification sent successfully")
    
    def test_trigger_video_live_creates_creator_notification(self):
        """Verify video-live triggers notification for creator"""
        video_id = f"test_video_{uuid.uuid4().hex[:8]}"
        creator_id = f"test_creator_{uuid.uuid4().hex[:8]}"
        
        # Trigger the video live notification
        trigger_response = requests.post(
            f"{BASE_URL}/api/notifications/trigger-video-live",
            params={
                "video_id": video_id,
                "creator_id": creator_id,
                "video_title": "My Awesome Video"
            }
        )
        assert trigger_response.status_code == 200
        
        # Verify the notification was created for the creator
        notifications_response = requests.get(
            f"{BASE_URL}/api/notifications/my",
            params={"user_id": creator_id, "limit": 10}
        )
        assert notifications_response.status_code == 200
        notifications = notifications_response.json()
        
        # Find the video_live notification
        video_live_notifications = [n for n in notifications if n["type"] == "video_live"]
        assert len(video_live_notifications) > 0, "Video live notification not found for creator"
        
        latest_notification = video_live_notifications[0]
        assert "LIVE" in latest_notification["title"]
        assert video_id in latest_notification["metadata"].get("video_id", "")
        print(f"✓ Creator notification created for video going live")


class TestCreatorNotificationEndpoints:
    """Tests for creator notification CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test notification for the creator"""
        self.creator_id = f"test_creator_{uuid.uuid4().hex[:8]}"
        # Trigger a video live notification to create test data
        requests.post(
            f"{BASE_URL}/api/notifications/trigger-video-live",
            params={
                "video_id": f"setup_video_{uuid.uuid4().hex[:8]}",
                "creator_id": self.creator_id,
                "video_title": "Setup Test Video"
            }
        )
    
    def test_get_creator_notifications(self):
        """Test GET /api/notifications/my"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/my",
            params={"user_id": self.creator_id, "limit": 20}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        notifications = response.json()
        assert isinstance(notifications, list)
        
        if len(notifications) > 0:
            n = notifications[0]
            assert "id" in n
            assert "user_id" in n
            assert "type" in n
            assert "title" in n
            assert "message" in n
            assert "is_read" in n
            assert "created_at" in n
        print(f"✓ GET /api/notifications/my returned {len(notifications)} notifications")
    
    def test_get_creator_unread_count(self):
        """Test GET /api/notifications/my/unread-count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/my/unread-count",
            params={"user_id": self.creator_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        assert data["unread_count"] >= 0
        print(f"✓ Unread count for creator: {data['unread_count']}")
    
    def test_mark_notification_read(self):
        """Test POST /api/notifications/my/mark-read/{notification_id}"""
        # First, get a notification
        notifications_response = requests.get(
            f"{BASE_URL}/api/notifications/my",
            params={"user_id": self.creator_id, "limit": 1}
        )
        notifications = notifications_response.json()
        
        if len(notifications) == 0:
            pytest.skip("No notifications to mark as read")
        
        notification_id = notifications[0]["id"]
        
        # Mark it as read
        response = requests.post(
            f"{BASE_URL}/api/notifications/my/mark-read/{notification_id}",
            params={"user_id": self.creator_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["status"] == "marked_read"
        print(f"✓ Notification {notification_id} marked as read")
    
    def test_mark_all_notifications_read(self):
        """Test POST /api/notifications/my/mark-all-read"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/my/mark-all-read",
            params={"user_id": self.creator_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "marked_read" in data
        print(f"✓ Marked {data['marked_read']} notifications as read")
    
    def test_delete_notification(self):
        """Test DELETE /api/notifications/my/{notification_id}"""
        # Create a new notification first
        new_creator_id = f"del_test_{uuid.uuid4().hex[:8]}"
        requests.post(
            f"{BASE_URL}/api/notifications/trigger-video-live",
            params={
                "video_id": f"del_video_{uuid.uuid4().hex[:8]}",
                "creator_id": new_creator_id,
                "video_title": "Delete Test Video"
            }
        )
        
        # Get the notification
        notifications_response = requests.get(
            f"{BASE_URL}/api/notifications/my",
            params={"user_id": new_creator_id, "limit": 1}
        )
        notifications = notifications_response.json()
        assert len(notifications) > 0, "No notification found to delete"
        
        notification_id = notifications[0]["id"]
        
        # Delete it
        response = requests.delete(
            f"{BASE_URL}/api/notifications/my/{notification_id}",
            params={"user_id": new_creator_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["status"] == "deleted"
        print(f"✓ Notification {notification_id} deleted successfully")


class TestLikeCommentNotifications:
    """Tests for like and comment triggering notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test video"""
        self.creator_id = f"test_creator_{uuid.uuid4().hex[:8]}"
        self.creator_name = "Test Creator"
        
        # Upload a test video
        response = requests.post(
            f"{BASE_URL}/api/creator-videos/upload",
            params={
                "creator_id": self.creator_id,
                "creator_name": self.creator_name
            },
            json={
                "title": "Test Video for Notifications",
                "description": "Testing notification triggers",
                "category": "tech",
                "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "duration_seconds": 300
            }
        )
        if response.status_code == 200:
            self.video_id = response.json()["id"]
        elif response.status_code == 201:
            self.video_id = response.json()["id"]
        else:
            self.video_id = None
            print(f"Video upload failed: {response.status_code} - {response.text}")
    
    def test_like_triggers_notification(self):
        """Test that liking a video triggers a notification"""
        if not self.video_id:
            pytest.skip("Could not create test video")
        
        liker_id = f"liker_{uuid.uuid4().hex[:8]}"
        liker_name = "TestLiker"
        
        # Like the video
        like_response = requests.post(
            f"{BASE_URL}/api/creator-videos/video/{self.video_id}/like",
            params={"user_id": liker_id, "user_name": liker_name}
        )
        assert like_response.status_code == 200, f"Like failed: {like_response.text}"
        
        # Check creator notifications
        notifications_response = requests.get(
            f"{BASE_URL}/api/notifications/my",
            params={"user_id": self.creator_id, "limit": 10}
        )
        assert notifications_response.status_code == 200
        notifications = notifications_response.json()
        
        # Find video_like notification
        like_notifications = [n for n in notifications if n["type"] == "video_like"]
        assert len(like_notifications) > 0, "Like notification not found for creator"
        
        latest = like_notifications[0]
        assert liker_name in latest["message"] or "liked" in latest["title"].lower()
        print(f"✓ Like triggered notification for creator: {latest['title']}")
    
    def test_comment_triggers_notification(self):
        """Test that commenting on a video triggers a notification"""
        if not self.video_id:
            pytest.skip("Could not create test video")
        
        commenter_id = f"commenter_{uuid.uuid4().hex[:8]}"
        commenter_name = "TestCommenter"
        comment_text = "Great video! Love the content!"
        
        # Post a comment
        comment_response = requests.post(
            f"{BASE_URL}/api/creator-videos/video/{self.video_id}/comment",
            params={"user_id": commenter_id, "user_name": commenter_name},
            json={"content": comment_text}
        )
        assert comment_response.status_code == 200, f"Comment failed: {comment_response.text}"
        
        # Check creator notifications
        notifications_response = requests.get(
            f"{BASE_URL}/api/notifications/my",
            params={"user_id": self.creator_id, "limit": 10}
        )
        assert notifications_response.status_code == 200
        notifications = notifications_response.json()
        
        # Find video_comment notification
        comment_notifications = [n for n in notifications if n["type"] == "video_comment"]
        assert len(comment_notifications) > 0, "Comment notification not found for creator"
        
        latest = comment_notifications[0]
        assert commenter_name in latest["message"] or "comment" in latest["title"].lower()
        print(f"✓ Comment triggered notification for creator: {latest['title']}")


class TestAdminNotifications:
    """Tests for admin notification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin to get admin_id"""
        # Login to get admin info - uses query params not JSON body
        login_response = requests.post(
            f"{BASE_URL}/api/admin-auth/login",
            params={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code == 200:
            self.admin_id = login_response.json()["user"]["id"]
            self.token = login_response.json()["access_token"]
        else:
            self.admin_id = None
            self.token = None
    
    def test_get_admin_notifications(self):
        """Test GET /api/notifications/admin"""
        if not self.admin_id:
            pytest.skip("Could not get admin ID")
        
        response = requests.get(
            f"{BASE_URL}/api/notifications/admin",
            params={"admin_id": self.admin_id, "limit": 20}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "notifications" in data
        assert "count" in data
        assert isinstance(data["notifications"], list)
        print(f"✓ Admin notifications retrieved: {data['count']} notifications")
    
    def test_get_admin_unread_count(self):
        """Test GET /api/notifications/admin/unread-count"""
        if not self.admin_id:
            pytest.skip("Could not get admin ID")
        
        response = requests.get(
            f"{BASE_URL}/api/notifications/admin/unread-count",
            params={"admin_id": self.admin_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        print(f"✓ Admin unread count: {data['unread_count']}")
    
    def test_new_upload_triggers_admin_notification(self):
        """Test that uploading a video notifies admin"""
        if not self.admin_id:
            pytest.skip("Could not get admin ID")
        
        creator_id = f"uploader_{uuid.uuid4().hex[:8]}"
        creator_name = "TestUploader"
        
        # Upload a video
        upload_response = requests.post(
            f"{BASE_URL}/api/creator-videos/upload",
            params={
                "creator_id": creator_id,
                "creator_name": creator_name
            },
            json={
                "title": "Test Upload for Admin Notification",
                "description": "This should trigger an admin notification",
                "category": "music",
                "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "duration_seconds": 240
            }
        )
        assert upload_response.status_code in [200, 201], f"Upload failed: {upload_response.text}"
        
        # Check admin notifications
        notifications_response = requests.get(
            f"{BASE_URL}/api/notifications/admin",
            params={"admin_id": self.admin_id, "limit": 10}
        )
        assert notifications_response.status_code == 200
        data = notifications_response.json()
        
        # Find new_upload notification
        upload_notifications = [n for n in data["notifications"] if n["type"] == "new_upload"]
        assert len(upload_notifications) > 0, "New upload notification not found for admin"
        
        latest = upload_notifications[0]
        assert creator_name in latest["message"] or "uploaded" in latest["title"].lower()
        print(f"✓ Upload triggered admin notification: {latest['title']}")
    
    def test_mark_admin_notification_read(self):
        """Test POST /api/notifications/admin/mark-read/{notification_id}"""
        if not self.admin_id:
            pytest.skip("Could not get admin ID")
        
        # Get notifications
        notifications_response = requests.get(
            f"{BASE_URL}/api/notifications/admin",
            params={"admin_id": self.admin_id, "unread_only": True, "limit": 5}
        )
        data = notifications_response.json()
        
        if len(data["notifications"]) == 0:
            pytest.skip("No unread admin notifications to mark as read")
        
        notification_id = data["notifications"][0]["id"]
        
        # Mark as read
        response = requests.post(
            f"{BASE_URL}/api/notifications/admin/mark-read/{notification_id}",
            params={"admin_id": self.admin_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        assert result["status"] == "marked_read"
        print(f"✓ Admin notification {notification_id} marked as read")
    
    def test_mark_all_admin_notifications_read(self):
        """Test POST /api/notifications/admin/mark-all-read"""
        if not self.admin_id:
            pytest.skip("Could not get admin ID")
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/admin/mark-all-read",
            params={"admin_id": self.admin_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "marked_read" in data
        print(f"✓ Marked {data['marked_read']} admin notifications as read")


class TestNotificationSettings:
    """Tests for notification settings endpoints"""
    
    def test_get_notification_settings(self):
        """Test GET /api/notifications/settings"""
        user_id = f"settings_user_{uuid.uuid4().hex[:8]}"
        
        response = requests.get(
            f"{BASE_URL}/api/notifications/settings",
            params={"user_id": user_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        settings = response.json()
        
        # Should return default settings for new user
        assert "user_id" in settings
        assert "email_on_like" in settings
        assert "email_on_comment" in settings
        assert "email_on_video_live" in settings
        print(f"✓ Notification settings retrieved: {settings}")
    
    def test_update_notification_settings(self):
        """Test PUT /api/notifications/settings"""
        user_id = f"settings_user_{uuid.uuid4().hex[:8]}"
        
        response = requests.put(
            f"{BASE_URL}/api/notifications/settings",
            params={
                "user_id": user_id,
                "email_on_like": True,
                "email_on_comment": False,
                "push_notifications": True
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        settings = response.json()
        
        assert settings["email_on_like"] == True
        assert settings["email_on_comment"] == False
        print(f"✓ Notification settings updated successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
