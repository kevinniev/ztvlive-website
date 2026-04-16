"""
ZTVLIVE Creator Trivia & Game Analytics API Tests
Tests for:
- Creator Trivia API: /api/creator-trivia/*
- Game Analytics API: /api/game-analytics/*
"""

import pytest
import requests
import os
import random
import string

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCreatorTriviaAPI:
    """Tests for Creator Trivia endpoints"""
    
    def test_get_current_creator(self):
        """GET /api/creator-trivia/current-creator should return Todd Wiseman Jr. (or default)"""
        response = requests.get(f"{BASE_URL}/api/creator-trivia/current-creator")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "slug" in data, "Response should contain 'slug'"
        assert "name" in data, "Response should contain 'name'"
        assert "niche" in data, "Response should contain 'niche'"
        assert "avatar" in data, "Response should contain 'avatar'"
        assert "bio" in data, "Response should contain 'bio'"
        assert "question_count" in data, "Response should contain 'question_count'"
        
        # Default should be Todd Wiseman Jr. when not in scheduled hours
        # The API defaults to todd_wiseman_jr when no schedule matches
        print(f"Current creator: {data['name']} ({data['slug']})")
        assert data["slug"] == "todd_wiseman_jr", f"Expected todd_wiseman_jr, got {data['slug']}"
        assert data["name"] == "Todd Wiseman Jr.", f"Expected 'Todd Wiseman Jr.', got {data['name']}"
        assert data["niche"] == "documentary", f"Expected 'documentary' niche, got {data['niche']}"
        assert data["question_count"] > 0, "Should have trivia questions"
    
    def test_get_trivia_question_todd(self):
        """GET /api/creator-trivia/question/todd_wiseman_jr should return filmmaking questions"""
        response = requests.get(f"{BASE_URL}/api/creator-trivia/question/todd_wiseman_jr")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "index" in data, "Response should contain 'index'"
        assert "question" in data, "Response should contain 'question'"
        assert "options" in data, "Response should contain 'options'"
        assert "creator_slug" in data, "Response should contain 'creator_slug'"
        assert "creator_name" in data, "Response should contain 'creator_name'"
        assert "creator_avatar" in data, "Response should contain 'creator_avatar'"
        
        # Verify it's Todd's question
        assert data["creator_slug"] == "todd_wiseman_jr"
        assert data["creator_name"] == "Todd Wiseman Jr."
        assert len(data["options"]) == 4, "Should have 4 options"
        
        # Verify question is about filmmaking/documentary
        question_text = data["question"].lower()
        filmmaking_keywords = ["todd", "documentary", "filmmaker", "directing", "film", "emmy", "vimeo", "urban", "shooting", "brand", "content"]
        has_filmmaking_keyword = any(kw in question_text for kw in filmmaking_keywords)
        assert has_filmmaking_keyword, f"Question should be about filmmaking: {data['question']}"
        
        print(f"Question: {data['question']}")
        print(f"Options: {data['options']}")
    
    def test_get_trivia_question_invalid_creator(self):
        """GET /api/creator-trivia/question/invalid_creator should return 404"""
        response = requests.get(f"{BASE_URL}/api/creator-trivia/question/invalid_creator")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_check_trivia_answer_correct(self):
        """POST /api/creator-trivia/check-answer should validate correct answer"""
        # First get a question
        q_response = requests.get(f"{BASE_URL}/api/creator-trivia/question/todd_wiseman_jr")
        assert q_response.status_code == 200
        question_data = q_response.json()
        
        # Submit answer (we'll try all options to find correct one)
        for option_idx in range(4):
            answer_payload = {
                "creator_slug": "todd_wiseman_jr",
                "question_index": question_data["index"],
                "selected_option": option_idx,
                "voter_id": f"test_voter_{random.randint(1000, 9999)}"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/creator-trivia/check-answer",
                json=answer_payload
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            assert "correct" in data, "Response should contain 'correct'"
            assert "correct_answer" in data, "Response should contain 'correct_answer'"
            assert "correct_option" in data, "Response should contain 'correct_option'"
            
            if data["correct"]:
                print(f"Correct answer found at index {option_idx}: {data['correct_option']}")
                break
    
    def test_list_creators(self):
        """GET /api/creator-trivia/creators should list all available creators"""
        response = requests.get(f"{BASE_URL}/api/creator-trivia/creators")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "creators" in data, "Response should contain 'creators'"
        
        creators = data["creators"]
        assert len(creators) >= 3, f"Should have at least 3 creators, got {len(creators)}"
        
        # Verify Todd is in the list
        todd = next((c for c in creators if c["slug"] == "todd_wiseman_jr"), None)
        assert todd is not None, "Todd Wiseman Jr. should be in creators list"
        assert todd["name"] == "Todd Wiseman Jr."
        assert todd["niche"] == "documentary"
        
        print(f"Available creators: {[c['name'] for c in creators]}")
    
    def test_get_broadcast_schedule(self):
        """GET /api/creator-trivia/schedule should return broadcast schedule"""
        response = requests.get(f"{BASE_URL}/api/creator-trivia/schedule")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "schedule" in data, "Response should contain 'schedule'"
        
        schedule = data["schedule"]
        assert len(schedule) > 0, "Schedule should not be empty"
        
        # Verify schedule structure
        for slot in schedule:
            assert "hour_utc" in slot, "Slot should have hour_utc"
            assert "creator_slug" in slot, "Slot should have creator_slug"
            assert "creator_name" in slot, "Slot should have creator_name"
        
        print(f"Schedule has {len(schedule)} slots")


class TestGameAnalyticsAPI:
    """Tests for Game Analytics endpoints"""
    
    def test_get_analytics(self):
        """GET /api/game-analytics/analytics should return engagement metrics"""
        response = requests.get(f"{BASE_URL}/api/game-analytics/analytics")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify summary metrics
        assert "summary" in data, "Response should contain 'summary'"
        summary = data["summary"]
        
        assert "total_plays" in summary, "Summary should contain 'total_plays'"
        assert "unique_participants" in summary, "Summary should contain 'unique_participants'"
        assert "total_winners" in summary, "Summary should contain 'total_winners'"
        assert "conversion_rate" in summary, "Summary should contain 'conversion_rate'"
        assert "engagement_velocity" in summary, "Summary should contain 'engagement_velocity'"
        
        # Verify other sections
        assert "engagement_by_hour" in data, "Response should contain 'engagement_by_hour'"
        assert "geo_distribution" in data, "Response should contain 'geo_distribution'"
        assert "recent_winners" in data, "Response should contain 'recent_winners'"
        assert "reward_tiers" in data, "Response should contain 'reward_tiers'"
        assert "report_generated" in data, "Response should contain 'report_generated'"
        
        print(f"Analytics summary: {summary}")
    
    def test_post_winner_announcement(self):
        """POST /api/game-analytics/winner should create and return a winner record"""
        test_username = f"TestWinner_{random.randint(1000, 9999)}"
        
        winner_payload = {
            "username": test_username,
            "reward_type": "super_fan",
            "location": "US",
            "creator_slug": "todd_wiseman_jr"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/game-analytics/winner",
            json=winner_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify winner record structure
        assert "username" in data, "Response should contain 'username'"
        assert data["username"] == test_username, f"Username mismatch: {data['username']}"
        
        assert "reward_type" in data, "Response should contain 'reward_type'"
        assert "reward_name" in data, "Response should contain 'reward_name'"
        assert "reward_value" in data, "Response should contain 'reward_value'"
        assert "reward_code" in data, "Response should contain 'reward_code'"
        assert "timestamp" in data, "Response should contain 'timestamp'"
        assert "ticker_message" in data, "Response should contain 'ticker_message'"
        
        # Verify reward code format (ZTV-DASH-15-XXXX for super_fan in US)
        assert data["reward_code"].startswith("ZTV-DASH-15-"), f"Unexpected reward code format: {data['reward_code']}"
        
        print(f"Winner created: {data['username']} - {data['reward_value']} - Code: {data['reward_code']}")
        print(f"Ticker message: {data['ticker_message']}")
    
    def test_post_winner_non_doordash_region(self):
        """POST /api/game-analytics/winner for non-DoorDash region should give ad-free reward"""
        test_username = f"TestWinner_{random.randint(1000, 9999)}"
        
        winner_payload = {
            "username": test_username,
            "reward_type": "super_fan",
            "location": "UK",  # Not in DoorDash regions
            "creator_slug": "todd_wiseman_jr"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/game-analytics/winner",
            json=winner_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Non-DoorDash region should get ad-free reward
        assert data["reward_code"].startswith("ZTV-ADFREE-90-"), f"Expected ad-free code, got: {data['reward_code']}"
        assert data["reward_value"] == "3 months", f"Expected '3 months', got: {data['reward_value']}"
        
        print(f"Non-DoorDash region winner: {data['reward_value']} - Code: {data['reward_code']}")
    
    def test_record_game_event(self):
        """POST /api/game-analytics/event should record game events"""
        event_payload = {
            "event_type": "play_started",
            "player_id": f"test_player_{random.randint(1000, 9999)}",
            "location": "US",
            "metadata": {"source": "test"}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/game-analytics/event",
            json=event_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("recorded") == True, "Event should be recorded"
        assert data.get("event_type") == "play_started"
        
        print(f"Event recorded: {data}")
    
    def test_get_reward_tiers(self):
        """GET /api/game-analytics/reward-tiers should return available reward tiers"""
        response = requests.get(f"{BASE_URL}/api/game-analytics/reward-tiers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "tiers" in data, "Response should contain 'tiers'"
        
        tiers = data["tiers"]
        
        # Verify expected tiers exist
        assert "participation" in tiers, "Should have 'participation' tier"
        assert "super_fan" in tiers, "Should have 'super_fan' tier"
        assert "ad_free" in tiers, "Should have 'ad_free' tier"
        
        # Verify tier values
        assert tiers["participation"]["value"] == "$5"
        assert tiers["super_fan"]["value"] == "$15-$20"
        assert tiers["ad_free"]["value"] == "3 months"
        
        print(f"Reward tiers: {list(tiers.keys())}")
    
    def test_export_analytics(self):
        """GET /api/game-analytics/analytics/export should return exportable report"""
        response = requests.get(f"{BASE_URL}/api/game-analytics/analytics/export")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify export structure
        assert "title" in data, "Export should have 'title'"
        assert "metrics" in data, "Export should have 'metrics'"
        assert "export_timestamp" in data, "Export should have 'export_timestamp'"
        
        assert data["title"] == "ZTVLIVE Interactive Engagement Report"
        
        print(f"Export report generated: {data['title']}")


class TestAnalyticsAfterWinner:
    """Test that analytics update after winner creation"""
    
    def test_analytics_updates_after_winner(self):
        """Analytics should reflect new winner after POST /api/game-analytics/winner"""
        # Get initial analytics
        initial_response = requests.get(f"{BASE_URL}/api/game-analytics/analytics")
        assert initial_response.status_code == 200
        initial_data = initial_response.json()
        initial_winners = initial_data["summary"]["total_winners"]
        
        # Create a winner
        test_username = f"AnalyticsTest_{random.randint(1000, 9999)}"
        winner_payload = {
            "username": test_username,
            "reward_type": "super_fan",
            "location": "US",
            "creator_slug": "todd_wiseman_jr"
        }
        
        winner_response = requests.post(
            f"{BASE_URL}/api/game-analytics/winner",
            json=winner_payload
        )
        assert winner_response.status_code == 200
        
        # Get updated analytics
        updated_response = requests.get(f"{BASE_URL}/api/game-analytics/analytics")
        assert updated_response.status_code == 200
        updated_data = updated_response.json()
        updated_winners = updated_data["summary"]["total_winners"]
        
        # Verify winner count increased
        assert updated_winners == initial_winners + 1, f"Winner count should increase from {initial_winners} to {initial_winners + 1}, got {updated_winners}"
        
        # Verify new winner is in recent_winners
        recent_winners = updated_data["recent_winners"]
        found_winner = any(w["username"] == test_username for w in recent_winners)
        assert found_winner, f"New winner {test_username} should be in recent_winners"
        
        print(f"Analytics updated: {initial_winners} -> {updated_winners} winners")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
