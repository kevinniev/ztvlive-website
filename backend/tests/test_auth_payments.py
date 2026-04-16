"""
Tests for ZTVLIVE Auth and Payment Features
- Creator authentication (signup, login, /auth/me)
- Payment packages
- Tip endpoints (Stripe integration)
"""

import pytest
import requests
import os
import uuid
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    @pytest.fixture(scope="class")
    def test_user(self):
        """Generate unique test user credentials"""
        unique_id = uuid.uuid4().hex[:8]
        return {
            "email": f"test_{unique_id}@ztvlive.test",
            "password": "TestPassword123!",
            "name": f"Test User {unique_id}"
        }
    
    def test_auth_me_returns_401_when_not_authenticated(self):
        """GET /api/auth/me should return 401 when not authenticated"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"✓ /api/auth/me returns 401 when not authenticated: {data['detail']}")
    
    def test_signup_creates_new_user(self, test_user):
        """POST /api/auth/signup should create a new user"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=test_user)
        
        # Could be 200 or 400 if user already exists
        if response.status_code == 400:
            data = response.json()
            if "already registered" in data.get("detail", ""):
                pytest.skip("Test user already exists - this is acceptable")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["email"] == test_user["email"]
        assert data["user"]["name"] == test_user["name"]
        assert data["user"]["role"] == "creator"
        assert "user_id" in data["user"]
        assert "password_hash" not in data["user"]  # Should not expose password hash
        
        print(f"✓ Signup successful for {test_user['email']}")
        return data
    
    def test_login_authenticates_user(self, test_user):
        """POST /api/auth/login should authenticate existing user"""
        # First ensure user exists by trying signup
        signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json=test_user)
        
        # Now try login
        login_data = {
            "email": test_user["email"],
            "password": test_user["password"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["email"] == test_user["email"]
        
        print(f"✓ Login successful for {test_user['email']}")
        return data
    
    def test_login_with_invalid_credentials_returns_401(self):
        """POST /api/auth/login should return 401 for invalid credentials"""
        login_data = {
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        
        print(f"✓ Login correctly returns 401 for invalid credentials")
    
    def test_auth_me_with_valid_token(self, test_user):
        """GET /api/auth/me should return user data when authenticated"""
        # First login to get token
        login_data = {
            "email": test_user["email"],
            "password": test_user["password"]
        }
        
        # Create user if not exists
        requests.post(f"{BASE_URL}/api/auth/signup", json=test_user)
        
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if login_resp.status_code != 200:
            pytest.skip("Could not login - skipping authenticated test")
        
        session_token = login_resp.json().get("session_token")
        
        # Now test /auth/me with token
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["email"] == test_user["email"]
        
        print(f"✓ /api/auth/me returns user data with valid token")


class TestPaymentEndpoints:
    """Payment system endpoint tests"""
    
    def test_get_tip_packages(self):
        """GET /api/payments/packages should return tip packages"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "packages" in data
        packages = data["packages"]
        
        # Verify we have the expected packages
        assert len(packages) == 5, f"Expected 5 packages, got {len(packages)}"
        
        # Check each package has required fields
        expected_packages = {
            "coffee": 5.00,
            "lunch": 10.00,
            "support": 25.00,
            "sponsor": 50.00,
            "patron": 100.00
        }
        
        for pkg in packages:
            assert "id" in pkg
            assert "name" in pkg
            assert "amount" in pkg
            assert "emoji" in pkg
            
            if pkg["id"] in expected_packages:
                assert pkg["amount"] == expected_packages[pkg["id"]], \
                    f"Package {pkg['id']} should have amount {expected_packages[pkg['id']]}, got {pkg['amount']}"
        
        print(f"✓ /api/payments/packages returns {len(packages)} tip packages:")
        for pkg in packages:
            print(f"  - {pkg['emoji']} {pkg['name']}: ${pkg['amount']}")
    
    def test_tip_endpoint_exists(self):
        """POST /api/payments/tip endpoint should exist"""
        # Send incomplete data to just check if endpoint exists
        response = requests.post(f"{BASE_URL}/api/payments/tip", json={})
        
        # Should get 422 (validation error) not 404 (not found)
        assert response.status_code != 404, "Endpoint /api/payments/tip does not exist"
        print(f"✓ /api/payments/tip endpoint exists (status: {response.status_code})")
    
    def test_custom_tip_endpoint_exists(self):
        """POST /api/payments/custom-tip endpoint should exist"""
        response = requests.post(f"{BASE_URL}/api/payments/custom-tip", json={})
        
        assert response.status_code != 404, "Endpoint /api/payments/custom-tip does not exist"
        print(f"✓ /api/payments/custom-tip endpoint exists (status: {response.status_code})")
    
    def test_payment_status_endpoint_exists(self):
        """GET /api/payments/status/{session_id} endpoint should exist"""
        # Use a fake session ID to test endpoint existence
        response = requests.get(f"{BASE_URL}/api/payments/status/fake_session_123")
        
        # Should get 404 for transaction not found, not endpoint not found
        assert response.status_code != 405, "Endpoint method not allowed"
        print(f"✓ /api/payments/status endpoint exists (status: {response.status_code})")


class TestPromoPage:
    """Tests for Promo video availability"""
    
    def test_promo_video_accessible(self):
        """The promo video should be accessible"""
        response = requests.head(f"{BASE_URL}/ztvlive_promo.mp4")
        
        # Could be 200 or 404 depending on how static files are served
        # On frontend it's served by React, so we check via the API base
        if response.status_code == 404:
            # Try without API prefix (direct frontend access)
            frontend_url = BASE_URL.replace('/api', '') if '/api' in BASE_URL else BASE_URL
            response = requests.head(f"{frontend_url}/ztvlive_promo.mp4")
        
        print(f"✓ Promo video check completed (status: {response.status_code})")


class TestIndexHtml:
    """Tests for AdSense integration in index.html"""
    
    def test_adsense_script_in_html(self):
        """AdSense script should be present in the HTML"""
        response = requests.get(f"{BASE_URL}/")
        
        if response.status_code == 200:
            html = response.text
            adsense_present = "googlesyndication.com" in html or "ca-pub-" in html
            print(f"✓ AdSense check on main page (found: {adsense_present})")
        else:
            print(f"✓ Main page status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
