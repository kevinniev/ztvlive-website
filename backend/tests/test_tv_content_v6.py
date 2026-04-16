"""
Test file for ZTVLIVE Content Library v6.0 - March 2026 Update
Tests fresh sports content (NBA, NFL Super Bowl, UFC 326), hip-hop, R&B, Afrobeats, and all categories
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestContentLibraryV6:
    """Test the updated content library (v6.0) with March 2026 content"""
    
    def test_library_endpoint_returns_95_items(self):
        """Verify library returns all 95 content items"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        data = response.json()
        
        # Verify total items
        assert data.get('total_items') == 95, f"Expected 95 items, got {data.get('total_items')}"
        assert data.get('total_content') == 95
        
        # Verify categories structure
        assert 'categories' in data
        categories = data['categories']
        assert len(categories) == 16, f"Expected 16 categories, got {len(categories)}"
        
    def test_sports_has_13_march_2026_items(self):
        """Verify sports category has 13 fresh March 2026 items"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        data = response.json()
        
        sports = data['categories'].get('sports', [])
        assert len(sports) == 13, f"Expected 13 sports items, got {len(sports)}"
        
    def test_sports_nba_march_2026_highlights(self):
        """Verify NBA March 2026 highlights content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        sports = response.json()['categories'].get('sports', [])
        
        # Extract titles
        titles = [s['title'] for s in sports]
        
        # Verify NBA highlights (March 9-10, 2026)
        assert any("Bam Adebayo 62 PTS" in t for t in titles), "Missing Bam Adebayo 62 PTS game"
        assert any("Heat vs Wizards" in t for t in titles), "Missing Heat vs Wizards game"
        assert any("Mavericks vs Hawks" in t for t in titles), "Missing Mavericks vs Hawks game"
        assert any("SGA Game Winner" in t for t in titles), "Missing SGA game winner highlight"
        assert any("Kawhi Leonard 29 PTS" in t for t in titles), "Missing Kawhi Leonard game"
        
    def test_sports_super_bowl_2026_content(self):
        """Verify Super Bowl 2026 Seahawks vs Patriots content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        sports = response.json()['categories'].get('sports', [])
        
        titles = [s['title'] for s in sports]
        
        # Verify Super Bowl 2026
        assert any("Super Bowl 2026" in t and "Seahawks" in t and "Patriots" in t for t in titles), \
            "Missing Super Bowl 2026 Seahawks vs Patriots"
        assert any("Super Bowl 2026 Extended" in t for t in titles), "Missing Super Bowl extended highlights"
        
    def test_sports_ufc_326_charles_oliveira_max_holloway(self):
        """Verify UFC 326 Charles Oliveira vs Max Holloway content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        sports = response.json()['categories'].get('sports', [])
        
        titles = [s['title'] for s in sports]
        
        # Verify UFC 326 content
        assert any("UFC 326" in t and "Oliveira" in t and "Holloway" in t for t in titles), \
            "Missing UFC 326 Oliveira vs Holloway"
        assert any("UFC 326" in t for t in titles), "Missing UFC 326 content"
        
    def test_hiphop_fresh_2026_content(self):
        """Verify hip-hop has fresh 2026 content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        hiphop = response.json()['categories'].get('hiphop', [])
        
        assert len(hiphop) == 13, f"Expected 13 hip-hop items, got {len(hiphop)}"
        
        # Check for 2026 content
        titles = [h['title'] for h in hiphop]
        assert any("2026" in t for t in titles), "Missing 2026 hip-hop content"
        
    def test_rnb_fresh_2026_content(self):
        """Verify R&B has fresh 2026 content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        rnb = response.json()['categories'].get('rnb', [])
        
        assert len(rnb) == 10, f"Expected 10 R&B items, got {len(rnb)}"
        
        # Check for Tyla 2026 content
        titles = [r['title'] for r in rnb]
        assert any("Tyla" in t for t in titles), "Missing Tyla content"
        assert any("2026" in t for t in titles), "Missing 2026 R&B content"
        
    def test_afrobeats_fresh_2026_content(self):
        """Verify Afrobeats has fresh 2026 content"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        afrobeats = response.json()['categories'].get('afrobeats', [])
        
        assert len(afrobeats) == 11, f"Expected 11 Afrobeats items, got {len(afrobeats)}"
        
        # Check for 2026 content and major artists
        titles = [a['title'] for a in afrobeats]
        assert any("2026" in t for t in titles), "Missing 2026 Afrobeats content"
        assert any("Burna Boy" in t or "Wizkid" in t or "Davido" in t for t in titles), \
            "Missing major Afrobeats artists"
            
    def test_all_content_has_required_fields(self):
        """Verify all content items have required fields"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        categories = response.json()['categories']
        
        required_fields = ['id', 'title', 'video_url', 'thumbnail', 'duration_seconds', 'source', 'category']
        
        for cat_name, items in categories.items():
            for item in items:
                for field in required_fields:
                    assert field in item, f"Missing {field} in {cat_name} item: {item.get('title', 'unknown')}"
                    
class TestScheduleEndpoints:
    """Test schedule API endpoints return correct format"""
    
    def test_schedule_returns_24_hours(self):
        """Verify schedule returns 24 hour schedule with proper format"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule?hours=24")
        assert response.status_code == 200
        data = response.json()
        
        # Verify schedule structure
        assert 'schedule' in data
        assert 'server_time' in data
        assert len(data['schedule']) == 24, f"Expected 24 schedule slots, got {len(data['schedule'])}"
        
    def test_schedule_items_have_nested_content(self):
        """Verify schedule items have nested content object"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule?hours=24")
        assert response.status_code == 200
        schedule = response.json()['schedule']
        
        for slot in schedule[:3]:  # Check first 3 slots
            assert 'content' in slot, f"Missing 'content' in schedule slot: {slot}"
            content = slot['content']
            assert 'title' in content, f"Missing 'title' in content: {content}"
            assert 'video_url' in content, f"Missing 'video_url' in content: {content}"
            assert 'thumbnail' in content, f"Missing 'thumbnail' in content: {content}"
            
    def test_schedule_has_current_marker(self):
        """Verify schedule has is_current flag"""
        response = requests.get(f"{BASE_URL}/api/tv/schedule?hours=24")
        assert response.status_code == 200
        schedule = response.json()['schedule']
        
        # First item should be current
        assert schedule[0]['is_current'] == True, "First schedule item should be current"
        
        # Should have duration_display
        assert 'duration_display' in schedule[0], "Missing duration_display"
        
    def test_now_playing_endpoint(self):
        """Verify now-playing endpoint returns current content"""
        response = requests.get(f"{BASE_URL}/api/tv/now-playing")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert 'current' in data
        assert 'next' in data
        assert 'server_time' in data
        
        current = data['current']
        assert 'title' in current
        assert 'video_url' in current
        assert 'elapsed_seconds' in current
        assert 'progress_percent' in current
        
    def test_sync_endpoint(self):
        """Verify sync endpoint returns proper format"""
        response = requests.get(f"{BASE_URL}/api/tv/sync")
        assert response.status_code == 200
        data = response.json()
        
        # Verify sync structure
        assert 'current_content' in data
        assert 'next_up' in data
        assert 'elapsed_seconds' in data
        assert 'total_duration' in data
        assert 'progress_percent' in data
        assert 'remaining_seconds' in data
        
    def test_upcoming_endpoint(self):
        """Verify upcoming endpoint returns content list"""
        response = requests.get(f"{BASE_URL}/api/tv/upcoming?count=5")
        assert response.status_code == 200
        data = response.json()
        
        assert 'upcoming' in data
        assert len(data['upcoming']) <= 5
        
class TestPinContentFeature:
    """Test content pinning functionality"""
    
    def test_pinned_list_endpoint(self):
        """Verify pinned list endpoint works"""
        response = requests.get(f"{BASE_URL}/api/tv/pinned")
        assert response.status_code == 200
        data = response.json()
        
        assert 'pinned' in data
        assert isinstance(data['pinned'], list)
        
class TestCategoryBreakdown:
    """Test individual category content counts"""
    
    def test_comedy_category(self):
        """Verify comedy has 6 items"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        comedy = response.json()['categories'].get('comedy', [])
        assert len(comedy) == 6, f"Expected 6 comedy items, got {len(comedy)}"
        
    def test_tech_category(self):
        """Verify tech has 7 items including MKBHD"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        tech = response.json()['categories'].get('tech', [])
        assert len(tech) == 7, f"Expected 7 tech items, got {len(tech)}"
        
        titles = [t['title'] for t in tech]
        assert any("MKBHD" in t for t in titles), "Missing MKBHD content"
        
    def test_gaming_category(self):
        """Verify gaming has 5 items including GTA 6"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        gaming = response.json()['categories'].get('gaming', [])
        assert len(gaming) == 5, f"Expected 5 gaming items, got {len(gaming)}"
        
        titles = [g['title'] for g in gaming]
        assert any("GTA 6" in t for t in titles), "Missing GTA 6 content"
        
    def test_movies_category(self):
        """Verify movies has 8 items"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        movies = response.json()['categories'].get('movies', [])
        assert len(movies) == 8, f"Expected 8 movies items, got {len(movies)}"
        
    def test_gospel_category(self):
        """Verify gospel has 6 items"""
        response = requests.get(f"{BASE_URL}/api/tv/library")
        assert response.status_code == 200
        gospel = response.json()['categories'].get('gospel', [])
        assert len(gospel) == 6, f"Expected 6 gospel items, got {len(gospel)}"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
