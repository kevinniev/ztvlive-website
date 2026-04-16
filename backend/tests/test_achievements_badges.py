"""
ZTVLIVE Achievements & Badges System Tests
Tests for the new badge system with 15 achievements
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://best-bites-live.preview.emergentagent.com').rstrip('/')


class TestAchievementsBadges:
    """Tests for /api/achievements/* endpoints"""
    
    def test_get_all_badges_returns_15_badges(self):
        """Verify /api/achievements/badges returns exactly 15 badges"""
        response = requests.get(f"{BASE_URL}/api/achievements/badges")
        assert response.status_code == 200
        
        data = response.json()
        assert "badges" in data
        assert "rarity_colors" in data
        assert len(data["badges"]) == 15, f"Expected 15 badges, got {len(data['badges'])}"
        
        # Verify badge structure
        for badge in data["badges"]:
            assert "id" in badge
            assert "name" in badge
            assert "description" in badge
            assert "icon" in badge
            assert "color" in badge
            assert "rarity" in badge
    
    def test_badges_include_expected_types(self):
        """Verify all expected badge types are present"""
        response = requests.get(f"{BASE_URL}/api/achievements/badges")
        assert response.status_code == 200
        
        data = response.json()
        badge_ids = [b["id"] for b in data["badges"]]
        
        expected_badges = [
            "top_10_percent", "five_game_streak", "first_answer", "perfect_round",
            "speed_demon", "social_butterfly", "loyal_viewer", "night_owl",
            "early_bird", "weekend_warrior", "century_club", "comeback_king",
            "group_leader", "trivia_master", "new_player"
        ]
        
        for expected in expected_badges:
            assert expected in badge_ids, f"Missing badge: {expected}"
    
    def test_check_awards_new_player_badge(self):
        """Verify /api/achievements/check awards 'new_player' badge to first-time players"""
        unique_player_id = f"test_new_player_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/achievements/check",
            json={
                "player_id": unique_player_id,
                "event_type": "game_played"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "new_badges" in data
        assert len(data["new_badges"]) >= 1
        
        # First-time player should get "new_player" badge
        badge_ids = [b["id"] for b in data["new_badges"]]
        assert "new_player" in badge_ids, "New player badge not awarded"
        assert data["message"] == "Welcome to ZTVLIVE!"
    
    def test_get_player_achievements(self):
        """Verify /api/achievements/player/{player_id} returns earned badges and stats"""
        # First create a player
        player_id = f"test_player_{uuid.uuid4().hex[:8]}"
        requests.post(
            f"{BASE_URL}/api/achievements/check",
            json={"player_id": player_id, "event_type": "game_played"}
        )
        
        # Then fetch their achievements
        response = requests.get(f"{BASE_URL}/api/achievements/player/{player_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["player_id"] == player_id
        assert "badges" in data
        assert "badge_count" in data
        assert "stats" in data
        
        # Should have at least the new_player badge
        assert data["badge_count"] >= 1
        badge_ids = [b["id"] for b in data["badges"]]
        assert "new_player" in badge_ids
    
    def test_get_player_achievements_nonexistent(self):
        """Verify /api/achievements/player returns empty for non-existent player"""
        response = requests.get(f"{BASE_URL}/api/achievements/player/nonexistent_player_xyz")
        assert response.status_code == 200
        
        data = response.json()
        assert data["badges"] == []
        assert data["stats"] == {}
    
    def test_leaderboard_returns_top_badge_collectors(self):
        """Verify /api/achievements/leaderboard returns top badge collectors"""
        response = requests.get(f"{BASE_URL}/api/achievements/leaderboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert "total_players" in data
        assert "top_10_threshold" in data
        
        # Leaderboard should be sorted by badge_count descending
        if len(data["leaderboard"]) > 1:
            for i in range(len(data["leaderboard"]) - 1):
                assert data["leaderboard"][i]["badge_count"] >= data["leaderboard"][i+1]["badge_count"]
    
    def test_leaderboard_with_limit(self):
        """Verify leaderboard respects limit parameter"""
        response = requests.get(f"{BASE_URL}/api/achievements/leaderboard?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["leaderboard"]) <= 5


class TestTVScheduleHealth:
    """Tests for TV schedule and content health"""
    
    def test_schedule_health_shows_100_plus_videos(self):
        """Verify /api/tv/schedule-health shows 100+ unique videos"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule-health")
        assert response.status_code == 200
        
        data = response.json()
        assert "library_stats" in data
        assert "schedule_stats" in data
        assert "health_score" in data
        
        # Should have 100+ unique videos in schedule
        unique_videos = data["schedule_stats"]["unique_videos"]
        assert unique_videos >= 100, f"Expected 100+ unique videos, got {unique_videos}"
    
    def test_tv_sync_returns_current_video(self):
        """Verify /api/tv/sync returns currently playing video with metadata"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        
        data = response.json()
        assert "video_id" in data
        assert "title" in data
        assert "elapsed_seconds" in data
        assert "now_playing" in data
        
        # Verify now_playing structure
        now_playing = data["now_playing"]
        assert "id" in now_playing
        assert "title" in now_playing
        assert "video_url" in now_playing
        assert "duration_seconds" in now_playing
    
    def test_skip_current_video(self):
        """Verify /api/tv/skip-current skips and returns success"""
        response = requests.get(f"{BASE_URL}/api/tv/skip-current")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "skipped_video_id" in data
        assert "message" in data


class TestAppDownloadPage:
    """Tests for App Download page API support"""
    
    def test_promo_videos_endpoint(self):
        """Verify /api/tv/promo-videos returns promo content"""
        response = requests.get(f"{BASE_URL}/api/tv/promo-videos")
        assert response.status_code == 200
        
        data = response.json()
        assert "videos" in data


class TestWatchPageAPIs:
    """Tests for Watch page supporting APIs"""
    
    def test_upcoming_videos(self):
        """Verify /api/tv/upcoming returns upcoming content"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "upcoming" in data
        assert len(data["upcoming"]) <= 5
    
    def test_bigscreen_show_status(self):
        """Verify /api/bigscreen-show/status returns show status"""
        response = requests.get(f"{BASE_URL}/api/bigscreen-show/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "is_live" in data
    
    def test_analytics_concurrent(self):
        """Verify /api/analytics/concurrent returns viewer count"""
        response = requests.get(f"{BASE_URL}/api/analytics/concurrent")
        assert response.status_code == 200
        
        data = response.json()
        assert "count" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
