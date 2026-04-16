"""
ZTVLIVE TV Scheduler Consistency and Variety Tests
Tests for:
- Schedule API consistency (same content order on repeated calls)
- Duration-based timing
- Content variety rules (no two 60+ min back-to-back, category alternation)
- Watch page APIs (sync, now-playing, upcoming)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestScheduleConsistency:
    """Test that schedule is consistent within the same hour"""
    
    def test_schedule_returns_200(self):
        """Schedule API should return 200"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
    def test_schedule_has_required_fields(self):
        """Schedule response should have required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule")
        data = response.json()
        
        assert "schedule" in data, "Missing 'schedule' field"
        assert "current" in data, "Missing 'current' field"
        assert "total_items" in data, "Missing 'total_items' field"
        assert "server_time" in data, "Missing 'server_time' field"
        assert "categories" in data, "Missing 'categories' field"
        
        assert len(data["schedule"]) > 0, "Schedule should have items"
        
    def test_schedule_consistency_same_order(self):
        """Calling schedule twice should return same content order"""
        response1 = requests.get(f"{BASE_URL}/api/tv/schedule")
        time.sleep(1)  # Small delay
        response2 = requests.get(f"{BASE_URL}/api/tv/schedule")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        schedule1 = response1.json().get("schedule", [])
        schedule2 = response2.json().get("schedule", [])
        
        # Compare content IDs of first 20 items
        ids1 = [item["content"]["id"] for item in schedule1[:20]]
        ids2 = [item["content"]["id"] for item in schedule2[:20]]
        
        assert ids1 == ids2, f"Schedule order changed between calls! First call: {ids1[:5]}, Second call: {ids2[:5]}"
        
    def test_schedule_items_have_duration_based_timing(self):
        """Each schedule item should have start_time and end_time based on duration"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule")
        data = response.json()
        schedule = data.get("schedule", [])
        
        for item in schedule[:10]:
            assert "start_time" in item, "Missing start_time"
            assert "end_time" in item, "Missing end_time"
            assert "duration_seconds" in item, "Missing duration_seconds"
            
            # Content should have duration_seconds matching
            content = item.get("content", {})
            assert content.get("duration_seconds", 0) == item["duration_seconds"], \
                f"Duration mismatch for {content.get('title')}"


class TestContentVariety:
    """Test content variety rules"""
    
    def test_no_two_long_videos_back_to_back(self):
        """No two 60+ minute videos should play back-to-back"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule")
        schedule = response.json().get("schedule", [])
        
        violations = []
        for i in range(1, len(schedule)):
            curr_dur = schedule[i]["content"].get("duration_seconds", 0)
            prev_dur = schedule[i-1]["content"].get("duration_seconds", 0)
            
            # 60 minutes = 3600 seconds
            if curr_dur > 3600 and prev_dur > 3600:
                violations.append({
                    "index": i,
                    "prev_title": schedule[i-1]["content"]["title"],
                    "prev_duration": prev_dur,
                    "curr_title": schedule[i]["content"]["title"],
                    "curr_duration": curr_dur
                })
        
        assert len(violations) == 0, f"Found {len(violations)} violations of back-to-back 60+ min rule: {violations}"
        
    def test_category_variety(self):
        """Categories should alternate - minimal same category back-to-back"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule")
        schedule = response.json().get("schedule", [])
        
        same_cat_count = 0
        total_transitions = len(schedule) - 1
        
        for i in range(1, len(schedule)):
            curr_cat = schedule[i]["content"].get("category")
            prev_cat = schedule[i-1]["content"].get("category")
            
            if curr_cat == prev_cat:
                same_cat_count += 1
        
        # Allow up to 10% same category transitions
        max_allowed = total_transitions * 0.1
        assert same_cat_count <= max_allowed, \
            f"Too many same category back-to-back: {same_cat_count}/{total_transitions} (max allowed: {max_allowed})"
            
    def test_short_content_after_long_content(self):
        """After long videos (>60 min), should prefer short content (<10 min)"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule")
        schedule = response.json().get("schedule", [])
        
        long_followed_by_short = 0
        long_followed_by_medium_or_long = 0
        
        for i in range(1, len(schedule)):
            prev_dur = schedule[i-1]["content"].get("duration_seconds", 0)
            curr_dur = schedule[i]["content"].get("duration_seconds", 0)
            
            if prev_dur > 3600:  # Previous was > 60 min
                if curr_dur < 600:  # Current is < 10 min
                    long_followed_by_short += 1
                else:
                    long_followed_by_medium_or_long += 1
        
        total_long_videos = long_followed_by_short + long_followed_by_medium_or_long
        if total_long_videos > 0:
            short_ratio = long_followed_by_short / total_long_videos
            # Should be at least 50% short content after long (algorithm uses 70% preference)
            assert short_ratio >= 0.5, \
                f"Expected at least 50% short content after long videos, got {short_ratio:.1%}"


class TestSyncAndNowPlaying:
    """Test sync and now-playing APIs"""
    
    def test_sync_returns_current_content(self):
        """Sync API should return current content with timing info"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        assert "current_content" in data, "Missing current_content"
        assert "elapsed_seconds" in data, "Missing elapsed_seconds"
        assert "remaining_seconds" in data, "Missing remaining_seconds"
        assert "total_duration" in data, "Missing total_duration"
        assert "progress_percent" in data, "Missing progress_percent"
        assert "sync_position" in data, "Missing sync_position"
        
    def test_sync_content_has_required_fields(self):
        """Current content should have required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        content = data.get("current_content", {})
        assert "id" in content, "Content missing id"
        assert "title" in content, "Content missing title"
        assert "video_url" in content, "Content missing video_url"
        assert "duration_seconds" in content, "Content missing duration_seconds"
        assert "category" in content, "Content missing category"
        
    def test_sync_timing_is_valid(self):
        """Timing values should be valid"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        elapsed = data.get("elapsed_seconds", 0)
        remaining = data.get("remaining_seconds", 0)
        total = data.get("total_duration", 0)
        progress = data.get("progress_percent", 0)
        
        assert elapsed >= 0, "Elapsed should be >= 0"
        assert remaining >= 0, "Remaining should be >= 0"
        assert total > 0, "Total duration should be > 0"
        assert 0 <= progress <= 100, "Progress should be 0-100"
        
        # elapsed + remaining should approximately equal total
        assert abs((elapsed + remaining) - total) <= 2, \
            f"elapsed ({elapsed}) + remaining ({remaining}) should equal total ({total})"
            
    def test_sync_has_next_up(self):
        """Sync should include next up content"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        data = response.json()
        
        assert "next_up" in data, "Missing next_up"
        next_up = data.get("next_up")
        
        if next_up:  # May be null at end of schedule
            content = next_up.get("content", {})
            assert "title" in content, "Next up content missing title"
            assert "duration_seconds" in content, "Next up content missing duration_seconds"


class TestUpcoming:
    """Test upcoming content API"""
    
    def test_upcoming_returns_list(self):
        """Upcoming API should return list of upcoming content"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "upcoming" in data, "Missing upcoming field"
        assert isinstance(data["upcoming"], list), "upcoming should be a list"
        
    def test_upcoming_items_have_required_fields(self):
        """Each upcoming item should have required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        data = response.json()
        upcoming = data.get("upcoming", [])
        
        if len(upcoming) > 0:
            item = upcoming[0]
            assert "content" in item, "Missing content"
            assert "start_time" in item, "Missing start_time"
            assert "end_time" in item, "Missing end_time"
            assert "duration_display" in item, "Missing duration_display"
            
    def test_upcoming_respects_count_param(self):
        """Upcoming should return requested count"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=3")
        data = response.json()
        upcoming = data.get("upcoming", [])
        
        assert len(upcoming) <= 3, f"Expected at most 3 items, got {len(upcoming)}"


class TestNewsTicker:
    """Test news ticker API for watch page"""
    
    def test_ticker_returns_headlines(self):
        """News ticker should return headlines"""
        response = requests.get(f"{BASE_URL}/api/news/ticker")
        assert response.status_code == 200
        
        data = response.json()
        assert "headlines" in data, "Missing headlines field"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
