"""
MRSS Feed Endpoint Tests
Tests for ZTVLIVE MRSS (Media RSS) feed for syndication partners.
Validates XML structure, namespaces, content-type headers, and query parameters.
"""

import pytest
import requests
import os
import xml.etree.ElementTree as ET
from xml.dom import minidom

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestMRSSFeedBasic:
    """Basic MRSS feed endpoint tests"""
    
    def test_mrss_feed_xml_endpoint_returns_200(self):
        """Test that /api/mrss/feed.xml returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ /api/mrss/feed.xml returns 200 OK")
    
    def test_mrss_feed_alternative_endpoint_returns_200(self):
        """Test that /api/mrss/feed (without .xml) also works"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ /api/mrss/feed returns 200 OK")
    
    def test_mrss_feed_content_type_header(self):
        """Test that Content-Type is application/rss+xml"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        content_type = response.headers.get('Content-Type', '')
        assert 'application/rss+xml' in content_type, f"Expected application/rss+xml, got {content_type}"
        print(f"✓ Content-Type header is correct: {content_type}")
    
    def test_mrss_feed_cache_control_header(self):
        """Test that Cache-Control header is set"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        cache_control = response.headers.get('Cache-Control', '')
        assert cache_control, "Cache-Control header should be set"
        print(f"✓ Cache-Control header: {cache_control}")


class TestMRSSFeedXMLStructure:
    """Tests for MRSS XML structure and namespaces"""
    
    def test_mrss_feed_is_valid_xml(self):
        """Test that the feed returns valid XML"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        try:
            # Parse XML
            root = ET.fromstring(response.text)
            assert root is not None, "XML parsing failed"
            print(f"✓ Feed returns valid XML")
        except ET.ParseError as e:
            pytest.fail(f"Invalid XML: {e}")
    
    def test_mrss_feed_has_rss_root_element(self):
        """Test that root element is <rss>"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        root = ET.fromstring(response.text)
        # Remove namespace prefix if present
        tag = root.tag.split('}')[-1] if '}' in root.tag else root.tag
        assert tag == 'rss', f"Expected root element 'rss', got '{tag}'"
        print(f"✓ Root element is <rss>")
    
    def test_mrss_feed_has_version_attribute(self):
        """Test that RSS has version 2.0"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        root = ET.fromstring(response.text)
        version = root.get('version')
        assert version == '2.0', f"Expected version 2.0, got {version}"
        print(f"✓ RSS version is 2.0")
    
    def test_mrss_feed_has_media_namespace(self):
        """Test that feed declares media: namespace"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        # Check for media namespace in raw XML
        assert 'xmlns:media="http://search.yahoo.com/mrss/"' in response.text, \
            "Missing media namespace declaration"
        print(f"✓ Media namespace (xmlns:media) is declared")
    
    def test_mrss_feed_has_dcterms_namespace(self):
        """Test that feed declares dcterms: namespace"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        assert 'xmlns:dcterms="http://purl.org/dc/terms/"' in response.text, \
            "Missing dcterms namespace declaration"
        print(f"✓ DCTerms namespace (xmlns:dcterms) is declared")
    
    def test_mrss_feed_has_atom_namespace(self):
        """Test that feed declares atom: namespace"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        assert 'xmlns:atom="http://www.w3.org/2005/Atom"' in response.text, \
            "Missing atom namespace declaration"
        print(f"✓ Atom namespace (xmlns:atom) is declared")
    
    def test_mrss_feed_has_channel_element(self):
        """Test that feed has <channel> element"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        root = ET.fromstring(response.text)
        channel = root.find('channel')
        assert channel is not None, "Missing <channel> element"
        print(f"✓ Feed has <channel> element")
    
    def test_mrss_feed_channel_has_required_elements(self):
        """Test that channel has required RSS elements"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        root = ET.fromstring(response.text)
        channel = root.find('channel')
        
        required_elements = ['title', 'link', 'description', 'language']
        for elem_name in required_elements:
            elem = channel.find(elem_name)
            assert elem is not None, f"Missing required element: {elem_name}"
            assert elem.text, f"Element {elem_name} is empty"
        
        print(f"✓ Channel has all required elements: {required_elements}")
    
    def test_mrss_feed_channel_title_is_ztvlive(self):
        """Test that channel title is ZTVLIVE"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        root = ET.fromstring(response.text)
        channel = root.find('channel')
        title = channel.find('title')
        assert title is not None and title.text == 'ZTVLIVE', \
            f"Expected title 'ZTVLIVE', got '{title.text if title is not None else None}'"
        print(f"✓ Channel title is 'ZTVLIVE'")


class TestMRSSFeedMediaElements:
    """Tests for media: namespace elements in MRSS feed"""
    
    def test_mrss_feed_has_media_thumbnail_in_channel(self):
        """Test that channel has media:thumbnail"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        # Check for media:thumbnail in raw XML
        assert 'media:thumbnail' in response.text, "Missing media:thumbnail element"
        print(f"✓ Feed contains media:thumbnail elements")
    
    def test_mrss_feed_items_have_media_content(self):
        """Test that items have media:content elements (if items exist)"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        # Check for media:content in raw XML
        if '<item>' in response.text:
            assert 'media:content' in response.text, "Items should have media:content elements"
            print(f"✓ Items contain media:content elements")
        else:
            print(f"⚠ No items in feed (empty feed is valid)")


class TestMRSSFeedQueryParameters:
    """Tests for MRSS feed query parameter filtering"""
    
    def test_mrss_feed_category_filter(self):
        """Test category filtering with ?category=music"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml?category=music", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        # Verify it's still valid XML
        root = ET.fromstring(response.text)
        assert root is not None
        print(f"✓ Category filter (music) works - returns valid XML")
    
    def test_mrss_feed_type_filter_creator(self):
        """Test content type filtering with ?type=creator"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml?type=creator", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        root = ET.fromstring(response.text)
        assert root is not None
        print(f"✓ Type filter (creator) works - returns valid XML")
    
    def test_mrss_feed_type_filter_scheduled(self):
        """Test content type filtering with ?type=scheduled"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml?type=scheduled", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        root = ET.fromstring(response.text)
        assert root is not None
        print(f"✓ Type filter (scheduled) works - returns valid XML")
    
    def test_mrss_feed_limit_parameter(self):
        """Test limit parameter with ?limit=5"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml?limit=5", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        root = ET.fromstring(response.text)
        channel = root.find('channel')
        items = channel.findall('item')
        # Should have at most 5 items
        assert len(items) <= 5, f"Expected at most 5 items, got {len(items)}"
        print(f"✓ Limit parameter works - got {len(items)} items (max 5)")
    
    def test_mrss_feed_combined_filters(self):
        """Test combined filters: category + type + limit"""
        response = requests.get(
            f"{BASE_URL}/api/mrss/feed.xml?category=music&type=creator&limit=10", 
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        root = ET.fromstring(response.text)
        assert root is not None
        print(f"✓ Combined filters work - returns valid XML")


class TestMRSSInfoEndpoint:
    """Tests for /api/mrss/info endpoint"""
    
    def test_mrss_info_returns_200(self):
        """Test that /api/mrss/info returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/mrss/info", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ /api/mrss/info returns 200 OK")
    
    def test_mrss_info_returns_json(self):
        """Test that /api/mrss/info returns JSON"""
        response = requests.get(f"{BASE_URL}/api/mrss/info", timeout=30)
        content_type = response.headers.get('Content-Type', '')
        assert 'application/json' in content_type, f"Expected JSON, got {content_type}"
        data = response.json()
        assert isinstance(data, dict), "Response should be a JSON object"
        print(f"✓ /api/mrss/info returns valid JSON")
    
    def test_mrss_info_has_required_fields(self):
        """Test that info response has required fields"""
        response = requests.get(f"{BASE_URL}/api/mrss/info", timeout=30)
        data = response.json()
        
        required_fields = [
            'feed_name', 'feed_description', 'feed_url', 'feed_format',
            'content_stats', 'supported_platforms', 'endpoints'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"✓ Info response has all required fields: {required_fields}")
    
    def test_mrss_info_feed_name_is_ztvlive(self):
        """Test that feed_name is ZTVLIVE"""
        response = requests.get(f"{BASE_URL}/api/mrss/info", timeout=30)
        data = response.json()
        assert data.get('feed_name') == 'ZTVLIVE', \
            f"Expected feed_name 'ZTVLIVE', got '{data.get('feed_name')}'"
        print(f"✓ Feed name is 'ZTVLIVE'")
    
    def test_mrss_info_has_content_stats(self):
        """Test that content_stats has expected structure"""
        response = requests.get(f"{BASE_URL}/api/mrss/info", timeout=30)
        data = response.json()
        
        content_stats = data.get('content_stats', {})
        expected_keys = ['total_creator_videos', 'upcoming_scheduled', 'total_available']
        
        for key in expected_keys:
            assert key in content_stats, f"Missing content_stats key: {key}"
        
        print(f"✓ Content stats has expected structure: {content_stats}")
    
    def test_mrss_info_has_endpoints(self):
        """Test that endpoints section has feed URLs"""
        response = requests.get(f"{BASE_URL}/api/mrss/info", timeout=30)
        data = response.json()
        
        endpoints = data.get('endpoints', {})
        assert 'main_feed' in endpoints, "Missing main_feed endpoint"
        assert endpoints['main_feed'].endswith('/api/mrss/feed.xml'), \
            f"Unexpected main_feed URL: {endpoints['main_feed']}"
        
        print(f"✓ Endpoints section has feed URLs")


class TestMRSSValidateEndpoint:
    """Tests for /api/mrss/validate endpoint"""
    
    def test_mrss_validate_returns_200(self):
        """Test that /api/mrss/validate returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/mrss/validate", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ /api/mrss/validate returns 200 OK")
    
    def test_mrss_validate_returns_json(self):
        """Test that /api/mrss/validate returns JSON"""
        response = requests.get(f"{BASE_URL}/api/mrss/validate", timeout=30)
        data = response.json()
        assert isinstance(data, dict), "Response should be a JSON object"
        print(f"✓ /api/mrss/validate returns valid JSON")
    
    def test_mrss_validate_has_valid_field(self):
        """Test that validate response has 'valid' boolean field"""
        response = requests.get(f"{BASE_URL}/api/mrss/validate", timeout=30)
        data = response.json()
        
        assert 'valid' in data, "Missing 'valid' field"
        assert isinstance(data['valid'], bool), "'valid' should be boolean"
        
        print(f"✓ Validate response has 'valid' field: {data['valid']}")
    
    def test_mrss_validate_has_issues_and_warnings(self):
        """Test that validate response has issues and warnings arrays"""
        response = requests.get(f"{BASE_URL}/api/mrss/validate", timeout=30)
        data = response.json()
        
        assert 'issues' in data, "Missing 'issues' field"
        assert 'warnings' in data, "Missing 'warnings' field"
        assert isinstance(data['issues'], list), "'issues' should be a list"
        assert isinstance(data['warnings'], list), "'warnings' should be a list"
        
        print(f"✓ Validate response has issues ({len(data['issues'])}) and warnings ({len(data['warnings'])})")
    
    def test_mrss_validate_has_recommendation(self):
        """Test that validate response has recommendation"""
        response = requests.get(f"{BASE_URL}/api/mrss/validate", timeout=30)
        data = response.json()
        
        assert 'recommendation' in data, "Missing 'recommendation' field"
        assert data['recommendation'], "Recommendation should not be empty"
        
        print(f"✓ Validate response has recommendation: {data['recommendation'][:50]}...")


class TestMRSSCategoriesEndpoint:
    """Tests for /api/mrss/categories endpoint"""
    
    def test_mrss_categories_returns_200(self):
        """Test that /api/mrss/categories returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/mrss/categories", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ /api/mrss/categories returns 200 OK")
    
    def test_mrss_categories_returns_json(self):
        """Test that /api/mrss/categories returns JSON"""
        response = requests.get(f"{BASE_URL}/api/mrss/categories", timeout=30)
        data = response.json()
        assert isinstance(data, dict), "Response should be a JSON object"
        print(f"✓ /api/mrss/categories returns valid JSON")
    
    def test_mrss_categories_has_categories_array(self):
        """Test that response has categories array"""
        response = requests.get(f"{BASE_URL}/api/mrss/categories", timeout=30)
        data = response.json()
        
        assert 'categories' in data, "Missing 'categories' field"
        assert isinstance(data['categories'], list), "'categories' should be a list"
        
        print(f"✓ Categories response has {len(data['categories'])} categories")
    
    def test_mrss_categories_structure(self):
        """Test that each category has expected fields"""
        response = requests.get(f"{BASE_URL}/api/mrss/categories", timeout=30)
        data = response.json()
        
        categories = data.get('categories', [])
        if categories:
            first_cat = categories[0]
            expected_fields = ['key', 'display_name', 'mrss_category', 'video_count']
            
            for field in expected_fields:
                assert field in first_cat, f"Category missing field: {field}"
            
            print(f"✓ Categories have expected structure: {expected_fields}")
        else:
            print(f"⚠ No categories returned (empty is valid)")
    
    def test_mrss_categories_has_total_count(self):
        """Test that response has total_categories count"""
        response = requests.get(f"{BASE_URL}/api/mrss/categories", timeout=30)
        data = response.json()
        
        assert 'total_categories' in data, "Missing 'total_categories' field"
        assert isinstance(data['total_categories'], int), "'total_categories' should be int"
        
        print(f"✓ Total categories with content: {data['total_categories']}")


class TestMRSSYouTubeURLTransformation:
    """Tests for YouTube URL transformation in MRSS feed"""
    
    def test_youtube_urls_transformed_to_embed(self):
        """Test that YouTube URLs are transformed to embed format"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml", timeout=30)
        
        # If there are any YouTube URLs in the feed, they should be embed format
        if 'youtube.com' in response.text:
            # Check that embed URLs are used, not watch URLs
            assert 'youtube.com/embed/' in response.text or 'youtube.com/watch' not in response.text, \
                "YouTube URLs should be in embed format"
            print(f"✓ YouTube URLs are in embed format")
        else:
            print(f"⚠ No YouTube URLs in feed to verify")


class TestMRSSFeedRobustness:
    """Robustness and edge case tests"""
    
    def test_mrss_feed_invalid_category_still_works(self):
        """Test that invalid category doesn't break the feed"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml?category=nonexistent", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        root = ET.fromstring(response.text)
        assert root is not None
        print(f"✓ Invalid category filter returns valid (possibly empty) feed")
    
    def test_mrss_feed_invalid_type_still_works(self):
        """Test that invalid type doesn't break the feed"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml?type=invalid", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        root = ET.fromstring(response.text)
        assert root is not None
        print(f"✓ Invalid type filter returns valid feed")
    
    def test_mrss_feed_limit_boundary_min(self):
        """Test limit=1 works"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml?limit=1", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        root = ET.fromstring(response.text)
        channel = root.find('channel')
        items = channel.findall('item')
        assert len(items) <= 1, f"Expected at most 1 item, got {len(items)}"
        print(f"✓ Limit=1 works correctly")
    
    def test_mrss_feed_limit_boundary_max(self):
        """Test limit=500 (max) works"""
        response = requests.get(f"{BASE_URL}/api/mrss/feed.xml?limit=500", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        root = ET.fromstring(response.text)
        assert root is not None
        print(f"✓ Limit=500 (max) works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
