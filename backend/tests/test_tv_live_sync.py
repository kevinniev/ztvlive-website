"""
Test TV Live Sync and Video Advance Functionality
Tests the fix for video skipping/jumping issue on the watch page

Key behaviors to verify:
1. /api/tv/sync returns elapsed_seconds > 0 when video is in progress
2. /api/tv/advance returns elapsed_seconds: 0 for new videos
3. Video transitions work correctly (new video starts from beginning)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://best-bites-live.preview.emergentagent.com').rstrip('/')


class TestTVSyncEndpoint:
    """Tests for /api/tv/sync endpoint - Live TV synchronization"""
    
    def test_sync_endpoint_returns_200(self):
        """Test that sync endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/tv/sync returns 200")
    
    def test_sync_returns_elapsed_seconds(self):
        """Test that sync returns elapsed_seconds field"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        assert "elapsed_seconds" in data, "Missing elapsed_seconds in response"
        assert isinstance(data["elapsed_seconds"], (int, float)), "elapsed_seconds should be numeric"
        print(f"PASS: elapsed_seconds = {data['elapsed_seconds']}")
    
    def test_sync_returns_now_playing(self):
        """Test that sync returns now_playing with video details"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        assert "now_playing" in data, "Missing now_playing in response"
        
        now_playing = data["now_playing"]
        assert "id" in now_playing, "Missing id in now_playing"
        assert "title" in now_playing, "Missing title in now_playing"
        assert "video_url" in now_playing, "Missing video_url in now_playing"
        assert "duration_seconds" in now_playing, "Missing duration_seconds in now_playing"
        print(f"PASS: now_playing contains: {now_playing['title']}")
    
    def test_sync_elapsed_seconds_increases_over_time(self):
        """Test that elapsed_seconds increases as time passes (live TV behavior)"""
        response1 = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response1.status_code == 200
        elapsed1 = response1.json()["elapsed_seconds"]
        
        # Wait 2 seconds
        time.sleep(2)
        
        response2 = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response2.status_code == 200
        elapsed2 = response2.json()["elapsed_seconds"]
        
        # Elapsed should increase (or video changed)
        video_id1 = response1.json().get("video_id")
        video_id2 = response2.json().get("video_id")
        
        if video_id1 == video_id2:
            # Same video - elapsed should increase
            assert elapsed2 >= elapsed1, f"elapsed_seconds should increase: {elapsed1} -> {elapsed2}"
            print(f"PASS: elapsed_seconds increased from {elapsed1} to {elapsed2}")
        else:
            # Video changed - new video should start from beginning
            print(f"PASS: Video changed from {video_id1} to {video_id2}")
    
    def test_sync_returns_video_url(self):
        """Test that sync returns video_url for YouTube player"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        assert "video_url" in data, "Missing video_url in response"
        assert "youtube.com/embed" in data["video_url"], "video_url should be YouTube embed URL"
        print(f"PASS: video_url = {data['video_url']}")
    
    def test_sync_returns_video_id(self):
        """Test that sync returns video_id for YouTube player"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        assert "video_id" in data, "Missing video_id in response"
        assert len(data["video_id"]) > 0, "video_id should not be empty"
        print(f"PASS: video_id = {data['video_id']}")


class TestTVAdvanceEndpoint:
    """Tests for /api/tv/advance endpoint - Video transition"""
    
    def test_advance_endpoint_returns_200(self):
        """Test that advance endpoint is accessible"""
        response = requests.post(f"{BASE_URL}/api/tv/advance")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/tv/advance returns 200")
    
    def test_advance_returns_success(self):
        """Test that advance returns success: true"""
        response = requests.post(f"{BASE_URL}/api/tv/advance")
        assert response.status_code == 200
        
        data = response.json()
        assert "success" in data, "Missing success in response"
        assert data["success"] == True, "success should be True"
        print("PASS: advance returns success: true")
    
    def test_advance_returns_new_video_with_zero_elapsed(self):
        """Test that advance returns new video with elapsed_seconds: 0"""
        response = requests.post(f"{BASE_URL}/api/tv/advance")
        assert response.status_code == 200
        
        data = response.json()
        assert "now_playing" in data, "Missing now_playing in response"
        
        now_playing = data["now_playing"]
        assert "elapsed_seconds" in now_playing, "Missing elapsed_seconds in now_playing"
        
        # New video should start from 0
        assert now_playing["elapsed_seconds"] == 0, f"New video should start at 0, got {now_playing['elapsed_seconds']}"
        print(f"PASS: New video '{now_playing['title']}' starts at elapsed_seconds: 0")
    
    def test_advance_changes_video(self):
        """Test that advance actually changes to a different video"""
        # Get current video
        sync_response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert sync_response.status_code == 200
        current_video_id = sync_response.json().get("video_id")
        
        # Advance to next
        advance_response = requests.post(f"{BASE_URL}/api/tv/advance")
        assert advance_response.status_code == 200
        
        new_video = advance_response.json().get("now_playing", {})
        new_video_url = new_video.get("video_url", "")
        new_video_id = new_video_url.split("/")[-1] if new_video_url else ""
        
        # Should be a different video
        assert new_video_id != current_video_id, f"Video should change: {current_video_id} -> {new_video_id}"
        print(f"PASS: Video changed from {current_video_id} to {new_video_id}")
    
    def test_advance_returns_valid_video_details(self):
        """Test that advance returns complete video details"""
        response = requests.post(f"{BASE_URL}/api/tv/advance")
        assert response.status_code == 200
        
        data = response.json()
        now_playing = data.get("now_playing", {})
        
        required_fields = ["id", "title", "video_url", "duration_seconds", "category"]
        for field in required_fields:
            assert field in now_playing, f"Missing {field} in now_playing"
        
        print(f"PASS: now_playing contains all required fields")


class TestLiveTVBehavior:
    """Tests for Live TV behavior - sync to live position"""
    
    def test_joining_mid_broadcast_gets_elapsed_time(self):
        """Test that joining mid-broadcast returns current elapsed time"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        elapsed = data["elapsed_seconds"]
        duration = data["now_playing"]["duration_seconds"]
        
        # Elapsed should be between 0 and duration
        assert 0 <= elapsed <= duration, f"elapsed_seconds ({elapsed}) should be between 0 and {duration}"
        print(f"PASS: Joining mid-broadcast, elapsed={elapsed}s of {duration}s total")
    
    def test_video_transition_starts_from_beginning(self):
        """Test that when video ends and transitions, new video starts from 0"""
        # Advance to trigger a transition
        response = requests.post(f"{BASE_URL}/api/tv/advance")
        assert response.status_code == 200
        
        data = response.json()
        now_playing = data.get("now_playing", {})
        
        # New video should start from 0
        assert now_playing.get("elapsed_seconds") == 0, "New video should start at 0"
        assert now_playing.get("progress_percent") == 0, "New video should have 0% progress"
        print(f"PASS: New video '{now_playing['title']}' starts from beginning (0 seconds)")
    
    def test_sync_after_advance_shows_low_elapsed(self):
        """Test that sync immediately after advance shows low elapsed time"""
        # Advance to new video
        advance_response = requests.post(f"{BASE_URL}/api/tv/advance")
        assert advance_response.status_code == 200
        
        # Immediately sync
        sync_response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert sync_response.status_code == 200
        
        elapsed = sync_response.json()["elapsed_seconds"]
        
        # Should be very low (just started)
        assert elapsed < 10, f"Just-started video should have low elapsed time, got {elapsed}"
        print(f"PASS: Sync after advance shows elapsed={elapsed}s (< 10s)")


class TestNowPlayingEndpoint:
    """Tests for /api/tv/now-playing endpoint"""
    
    def test_now_playing_returns_200(self):
        """Test that now-playing endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/tv/now-playing")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/tv/now-playing returns 200")
    
    def test_now_playing_returns_video_details(self):
        """Test that now-playing returns video details"""
        response = requests.get(f"{BASE_URL}/api/tv/now-playing")
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data, "Missing id"
        assert "title" in data, "Missing title"
        assert "video_url" in data, "Missing video_url"
        print(f"PASS: now-playing returns: {data.get('title')}")


class TestUpcomingEndpoint:
    """Tests for /api/tv/upcoming endpoint"""
    
    def test_upcoming_returns_200(self):
        """Test that upcoming endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/tv/upcoming returns 200")
    
    def test_upcoming_returns_list(self):
        """Test that upcoming returns a list of videos"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "upcoming" in data, "Missing upcoming in response"
        assert isinstance(data["upcoming"], list), "upcoming should be a list"
        print(f"PASS: upcoming returns {len(data['upcoming'])} videos")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
