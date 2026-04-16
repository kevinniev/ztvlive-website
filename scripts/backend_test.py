import requests
import sys
from datetime import datetime
import json

class ZTVLiveAPITester:
    def __init__(self, base_url="https://best-bites-live.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Array/Simple value'}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:500]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            return False, {}

    def test_basic_endpoints(self):
        """Test core API endpoints"""
        print("=== TESTING BASIC ENDPOINTS ===")
        
        # Root endpoint
        self.run_test("API Root", "GET", "", 200)
        
        # Categories
        success, data = self.run_test("Get Categories", "GET", "categories", 200)
        if success and 'categories' in data:
            print(f"   Found {len(data['categories'])} categories")
        
        # Highlights
        success, data = self.run_test("Get All Highlights", "GET", "highlights", 200)
        if success and 'highlights' in data:
            print(f"   Found {len(data['highlights'])} highlights")
        
        # Highlights with category filter
        self.run_test("Get Sports Highlights", "GET", "highlights?category=sports", 200)
        
        # Live current
        success, data = self.run_test("Get Current Live", "GET", "live/current", 200)
        if success:
            if 'current' in data and 'next_up' in data:
                print(f"   Current: {data['current'].get('title', 'No title')[:50]}...")
                print(f"   Viewers: {data.get('viewers', 0)}")

    def test_individual_highlight(self):
        """Test individual highlight endpoints"""
        print("\n=== TESTING INDIVIDUAL HIGHLIGHTS ===")
        
        # Get first highlight ID from the mock data
        highlight_ids = ["h1", "h2", "h3"]  # From MOCK_HIGHLIGHTS
        
        for hid in highlight_ids[:2]:  # Test first 2
            success, data = self.run_test(f"Get Highlight {hid}", "GET", f"highlights/{hid}", 200)
            if success and 'title' in data:
                print(f"   Title: {data['title'][:50]}...")
                print(f"   Category: {data.get('category', 'N/A')}")
                break

    def test_chat_system(self):
        """Test chat endpoints"""
        print("\n=== TESTING CHAT SYSTEM ===")
        
        # Get chat messages
        success, data = self.run_test("Get Chat Messages", "GET", "chat/messages", 200)
        if success and 'messages' in data:
            print(f"   Found {len(data['messages'])} chat messages")

    def test_schedule_system(self):
        """Test schedule endpoints"""
        print("\n=== TESTING SCHEDULE SYSTEM ===")
        
        # Get schedule
        success, data = self.run_test("Get Schedule", "GET", "schedule", 200)
        if success and 'schedule' in data:
            print(f"   Found {len(data['schedule'])} schedule slots")
            print(f"   Timezone: {data.get('timezone', 'N/A')}")

    def test_trending_ticker(self):
        """Test trending ticker"""
        print("\n=== TESTING TRENDING TICKER ===")
        
        success, data = self.run_test("Get Trending Ticker", "GET", "trending/ticker", 200)
        if success and 'tickers' in data:
            print(f"   Found {len(data['tickers'])} ticker items")

    def test_ai_commentary(self):
        """Test AI commentary generation"""
        print("\n=== TESTING AI COMMENTARY ===")
        
        commentary_request = {
            "topic": "Test AI Commentary Generation",
            "category": "tech",
            "humor_level": 5,
            "include_facts": True
        }
        
        success, data = self.run_test(
            "Generate AI Commentary", 
            "POST", 
            "ai/generate-commentary", 
            200, 
            commentary_request,
            timeout=60  # AI generation might take longer
        )
        if success:
            print(f"   Generated: {data.get('commentary', 'No commentary')[:100]}...")
            print(f"   Model: {data.get('model', 'Unknown')}")

    def test_like_functionality(self):
        """Test like functionality"""
        print("\n=== TESTING LIKE FUNCTIONALITY ===")
        
        # Test liking a highlight
        self.run_test("Like Highlight h1", "POST", "highlights/h1/like", 200)

    def test_submission_system(self):
        """Test highlight submission endpoints"""
        print("\n=== TESTING SUBMISSION SYSTEM ===")
        
        # Test creating a submission
        submission_data = {
            "title": "Test Highlight Submission",
            "category": "tech",
            "source_url": "https://youtube.com/watch?v=test123",
            "description": "This is a test submission for the highlight system",
            "submitter_name": "Test User",
            "submitter_email": "test@example.com",
            "why_trending": "This is trending because it's a great test case for our system"
        }
        
        success, data = self.run_test(
            "Submit New Highlight", 
            "POST", 
            "submissions", 
            200, 
            submission_data
        )
        if success:
            submission_id = data.get('id', 'unknown')
            print(f"   Created submission ID: {submission_id}")
            print(f"   Status: {data.get('status', 'unknown')}")
        
        # Test getting all submissions
        success, data = self.run_test("Get All Submissions", "GET", "submissions", 200)
        if success and 'submissions' in data:
            print(f"   Found {len(data['submissions'])} submissions")
            if data['submissions']:
                print(f"   First submission: {data['submissions'][0].get('title', 'No title')[:50]}...")
        
        # Test getting pending submissions only
        self.run_test("Get Pending Submissions", "GET", "submissions?status=pending", 200)

    def test_stream_config(self):
        """Test stream configuration endpoint"""
        print("\n=== TESTING STREAM CONFIG ===")
        
        success, data = self.run_test("Get Stream Config", "GET", "stream/config", 200)
        if success:
            print(f"   HLS URL: {data.get('hls_url', 'Not configured')}")
            print(f"   Stream Type: {data.get('stream_type', 'Unknown')}")
            print(f"   Is Live: {data.get('is_live', False)}")

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 STARTING ZTVLIVE API TESTS")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        self.test_basic_endpoints()
        self.test_individual_highlight()
        self.test_chat_system()
        self.test_schedule_system()
        self.test_trending_ticker()
        self.test_ai_commentary()
        self.test_like_functionality()
        self.test_submission_system()
        self.test_stream_config()
        
        # Print results
        print("\n" + "=" * 60)
        print(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS ({len(self.failed_tests)}):")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. {test['name']}")
                if 'error' in test:
                    print(f"   Error: {test['error']}")
                else:
                    print(f"   Expected: {test['expected']}, Got: {test['actual']}")
                print()
        
        return self.tests_passed == self.tests_run

def main():
    tester = ZTVLiveAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())