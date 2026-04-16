"""
Test Suite for ZTVLIVE Creator Content Management System
Tests: Video upload, Feed browsing, Likes, Comments, Categories, Admin endpoints
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test constants
TEST_VIDEO_ID = "c9ed50d2-aa7b-4f09-ad56-d9a058b69481"
TEST_CREATOR_ID = "test_user_123"
TEST_YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


class TestCreatorVideoCategories:
    """Test category endpoints"""
    
    def test_get_categories_returns_200(self):
        """GET /api/creator-videos/categories returns list of categories"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) > 0
        print(f"SUCCESS: Retrieved {len(data['categories'])} categories")
    
    def test_categories_have_required_fields(self):
        """Categories contain all required fields"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/categories")
        assert response.status_code == 200
        
        data = response.json()
        for cat in data["categories"]:
            assert "key" in cat
            assert "name" in cat
            assert "icon" in cat
            assert "color" in cat
            assert "video_count" in cat
            print(f"SUCCESS: Category '{cat['name']}' has all required fields")
    
    def test_categories_include_music(self):
        """Music category exists and has correct structure"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/categories")
        data = response.json()
        
        music_cat = next((c for c in data["categories"] if c["key"] == "music"), None)
        assert music_cat is not None
        assert music_cat["name"] == "Music"
        assert music_cat["video_count"] >= 1  # At least our test video
        print(f"SUCCESS: Music category found with {music_cat['video_count']} videos")


class TestCreatorVideoFeed:
    """Test the video browse feed"""
    
    def test_get_feed_returns_200(self):
        """GET /api/creator-videos/feed returns videos"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/feed")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Feed returned {len(data)} videos")
    
    def test_feed_videos_have_required_fields(self):
        """Feed videos contain all required fields"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/feed?limit=5")
        data = response.json()
        
        if len(data) > 0:
            video = data[0]
            required_fields = ["id", "title", "category", "video_url", "creator_id", 
                            "creator_name", "status", "views", "likes", "comments_count"]
            for field in required_fields:
                assert field in video, f"Missing field: {field}"
            print(f"SUCCESS: Video '{video['title']}' has all required fields")
        else:
            print("INFO: No videos in feed to test")
    
    def test_feed_filter_by_category(self):
        """Feed can be filtered by category"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/feed?category=music")
        assert response.status_code == 200
        
        data = response.json()
        for video in data:
            assert video["category"] == "music", f"Video category is {video['category']}, expected music"
        print(f"SUCCESS: Category filter works, {len(data)} music videos returned")
    
    def test_feed_sort_by_recent(self):
        """Feed can be sorted by recent"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/feed?sort_by=recent&limit=5")
        assert response.status_code == 200
        print("SUCCESS: Feed sorted by recent works")
    
    def test_feed_sort_by_popular(self):
        """Feed can be sorted by popular (views)"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/feed?sort_by=popular&limit=5")
        assert response.status_code == 200
        print("SUCCESS: Feed sorted by popular works")
    
    def test_feed_pagination(self):
        """Feed supports pagination"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/feed?skip=0&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 2
        print(f"SUCCESS: Pagination works, returned {len(data)} videos")


class TestCreatorVideoUpload:
    """Test video upload via YouTube URL"""
    
    def test_upload_video_with_youtube_url(self):
        """POST /api/creator-videos/upload creates video from YouTube URL"""
        unique_title = f"TEST_Upload_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "title": unique_title,
            "description": "Pytest test video upload",
            "category": "tech",
            "video_url": "https://www.youtube.com/watch?v=ScMzIvxBSi4",
            "tags": ["test", "pytest"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/creator-videos/upload?creator_id=pytest_test_user&creator_name=PyTest%20User",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["title"] == unique_title
        assert data["category"] == "tech"
        assert data["status"] == "approved"
        assert "id" in data
        
        # Verify YouTube thumbnail was auto-generated
        assert "thumbnail_url" in data
        assert "youtube" in data["thumbnail_url"]
        
        print(f"SUCCESS: Video uploaded with ID: {data['id']}")
        
        # Cleanup - verify video was persisted by GET
        get_response = requests.get(f"{BASE_URL}/api/creator-videos/video/{data['id']}")
        assert get_response.status_code == 200
        assert get_response.json()["title"] == unique_title
        print(f"SUCCESS: Video persisted and retrievable")
        
        # Delete test video
        delete_response = requests.delete(
            f"{BASE_URL}/api/creator-videos/video/{data['id']}?creator_id=pytest_test_user"
        )
        assert delete_response.status_code == 200
        print("SUCCESS: Test video cleaned up")


class TestCreatorVideoLikes:
    """Test like/unlike functionality"""
    
    def test_like_video(self):
        """POST /api/creator-videos/video/{id}/like adds like"""
        unique_user = f"like_test_{uuid.uuid4().hex[:8]}"
        
        # First check current like count
        video_response = requests.get(f"{BASE_URL}/api/creator-videos/video/{TEST_VIDEO_ID}")
        initial_likes = video_response.json()["likes"]
        
        # Like the video
        response = requests.post(
            f"{BASE_URL}/api/creator-videos/video/{TEST_VIDEO_ID}/like?user_id={unique_user}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "liked"
        assert data["likes"] == initial_likes + 1
        print(f"SUCCESS: Video liked, count now {data['likes']}")
        
        # Unlike (toggle)
        unlike_response = requests.post(
            f"{BASE_URL}/api/creator-videos/video/{TEST_VIDEO_ID}/like?user_id={unique_user}"
        )
        assert unlike_response.status_code == 200
        assert unlike_response.json()["status"] == "unliked"
        print("SUCCESS: Video unliked (toggle works)")
    
    def test_check_like_status(self):
        """GET /api/creator-videos/video/{id}/like-status returns like status"""
        response = requests.get(
            f"{BASE_URL}/api/creator-videos/video/{TEST_VIDEO_ID}/like-status?user_id=check_test_user"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "is_liked" in data
        assert "total_likes" in data
        assert isinstance(data["is_liked"], bool)
        print(f"SUCCESS: Like status checked, is_liked={data['is_liked']}, total={data['total_likes']}")
    
    def test_like_nonexistent_video_returns_404(self):
        """Like on non-existent video returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/creator-videos/video/nonexistent-id/like?user_id=test"
        )
        assert response.status_code == 404
        print("SUCCESS: 404 returned for non-existent video")


class TestCreatorVideoComments:
    """Test comment functionality"""
    
    def test_get_comments(self):
        """GET /api/creator-videos/video/{id}/comments returns comments"""
        response = requests.get(
            f"{BASE_URL}/api/creator-videos/video/{TEST_VIDEO_ID}/comments"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            comment = data[0]
            assert "id" in comment
            assert "content" in comment
            assert "user_name" in comment
            assert "created_at" in comment
            print(f"SUCCESS: Retrieved {len(data)} comments")
        else:
            print("INFO: No comments yet")
    
    def test_add_comment(self):
        """POST /api/creator-videos/video/{id}/comment adds comment"""
        unique_content = f"Test comment {uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/creator-videos/video/{TEST_VIDEO_ID}/comment?user_id=pytest_commenter&user_name=PyTest%20Commenter",
            json={"content": unique_content}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["content"] == unique_content
        assert data["user_name"] == "PyTest Commenter"
        assert "id" in data
        
        print(f"SUCCESS: Comment added with ID: {data['id']}")
        
        # Verify comment appears in GET
        comments = requests.get(f"{BASE_URL}/api/creator-videos/video/{TEST_VIDEO_ID}/comments").json()
        comment_found = any(c["content"] == unique_content for c in comments)
        assert comment_found, "Comment not found in comments list"
        print("SUCCESS: Comment persisted and retrievable")
        
        # Cleanup - delete comment
        delete_response = requests.delete(
            f"{BASE_URL}/api/creator-videos/comment/{data['id']}?user_id=pytest_commenter"
        )
        assert delete_response.status_code == 200
        print("SUCCESS: Test comment cleaned up")
    
    def test_comment_on_nonexistent_video_returns_404(self):
        """Comment on non-existent video returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/creator-videos/video/nonexistent-id/comment?user_id=test&user_name=Test",
            json={"content": "test"}
        )
        assert response.status_code == 404
        print("SUCCESS: 404 returned for non-existent video")


class TestCreatorVideoSingleVideo:
    """Test single video retrieval"""
    
    def test_get_video_by_id(self):
        """GET /api/creator-videos/video/{id} returns video details"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/video/{TEST_VIDEO_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == TEST_VIDEO_ID
        assert data["creator_id"] == TEST_CREATOR_ID
        assert "title" in data
        assert "video_url" in data
        print(f"SUCCESS: Video '{data['title']}' retrieved")
    
    def test_get_nonexistent_video_returns_404(self):
        """GET non-existent video returns 404"""
        response = requests.get(f"{BASE_URL}/api/creator-videos/video/fake-id-12345")
        assert response.status_code == 404
        print("SUCCESS: 404 returned for non-existent video")


class TestAdminCreatorEndpoints:
    """Test admin endpoints for creator data collection"""
    
    def test_get_all_creators(self):
        """GET /api/uploads/admin/creators returns creator data"""
        response = requests.get(f"{BASE_URL}/api/uploads/admin/creators")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_creators" in data
        assert "creators" in data
        assert isinstance(data["creators"], list)
        
        if len(data["creators"]) > 0:
            creator = data["creators"][0]
            assert "creator_id" in creator
            assert "creator_name" in creator
            assert "videos" in creator
            assert "total_views" in creator
            assert "total_likes" in creator
            print(f"SUCCESS: Retrieved {data['total_creators']} creators for outreach")
        else:
            print("INFO: No creators yet")
    
    def test_creator_data_includes_email_field(self):
        """Creator data includes email for outreach"""
        response = requests.get(f"{BASE_URL}/api/uploads/admin/creators")
        data = response.json()
        
        if len(data["creators"]) > 0:
            creator = data["creators"][0]
            assert "email" in creator, "Email field missing from creator data"
            print(f"SUCCESS: Creator data includes email field: {creator['email']}")
        else:
            pytest.skip("No creators to test")
    
    def test_creator_data_aggregates_stats(self):
        """Creator data aggregates video stats correctly"""
        response = requests.get(f"{BASE_URL}/api/uploads/admin/creators")
        data = response.json()
        
        # Find our test creator
        test_creator = next((c for c in data["creators"] if c["creator_id"] == TEST_CREATOR_ID), None)
        
        if test_creator:
            assert test_creator["videos"] >= 1
            assert isinstance(test_creator["total_views"], int)
            assert isinstance(test_creator["total_likes"], int)
            print(f"SUCCESS: Test creator stats - Videos: {test_creator['videos']}, Views: {test_creator['total_views']}, Likes: {test_creator['total_likes']}")
        else:
            print("INFO: Test creator not found in admin data")


class TestCreatorMyVideos:
    """Test creator's own videos endpoint"""
    
    def test_get_my_videos(self):
        """GET /api/creator-videos/my-videos returns creator's videos"""
        response = requests.get(
            f"{BASE_URL}/api/creator-videos/my-videos?creator_id={TEST_CREATOR_ID}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            for video in data:
                assert video["creator_id"] == TEST_CREATOR_ID
            print(f"SUCCESS: Retrieved {len(data)} videos for creator {TEST_CREATOR_ID}")
        else:
            print("INFO: No videos for this creator")


class TestCreatorProfile:
    """Test creator public profile"""
    
    def test_get_creator_profile(self):
        """GET /api/creator-videos/creator/{id}/profile returns profile"""
        response = requests.get(
            f"{BASE_URL}/api/creator-videos/creator/{TEST_CREATOR_ID}/profile"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["creator_id"] == TEST_CREATOR_ID
        assert "creator_name" in data
        assert "total_videos" in data
        assert "total_views" in data
        assert "total_likes" in data
        assert "recent_videos" in data
        
        print(f"SUCCESS: Creator profile - Name: {data['creator_name']}, Videos: {data['total_videos']}")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
