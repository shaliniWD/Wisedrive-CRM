"""
Test Login Page and Countries API - CRM UI Refresh
Tests for country selection on login page and related API endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCountriesAPI:
    """Test /api/auth/countries endpoint - public endpoint for login dropdown"""
    
    def test_get_countries_public_endpoint(self):
        """Test that countries endpoint is accessible without auth"""
        response = requests.get(f"{BASE_URL}/api/auth/countries")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        countries = response.json()
        assert isinstance(countries, list), "Response should be a list"
        assert len(countries) >= 4, f"Expected at least 4 countries, got {len(countries)}"
        
        # Verify country structure
        for country in countries:
            assert "id" in country, "Country should have 'id'"
            assert "name" in country, "Country should have 'name'"
            assert "code" in country, "Country should have 'code'"
        
        print(f"SUCCESS: Found {len(countries)} countries")
    
    def test_countries_include_required_countries(self):
        """Test that India, Malaysia, Thailand, Philippines are present"""
        response = requests.get(f"{BASE_URL}/api/auth/countries")
        assert response.status_code == 200
        
        countries = response.json()
        country_names = [c["name"] for c in countries]
        
        required_countries = ["India", "Malaysia", "Thailand", "Philippines"]
        for country in required_countries:
            assert country in country_names, f"Missing required country: {country}"
            print(f"SUCCESS: Found {country}")
    
    def test_countries_have_correct_codes(self):
        """Test that countries have correct ISO codes"""
        response = requests.get(f"{BASE_URL}/api/auth/countries")
        assert response.status_code == 200
        
        countries = response.json()
        expected_codes = {"India": "IN", "Malaysia": "MY", "Thailand": "TH", "Philippines": "PH"}
        
        for country in countries:
            if country["name"] in expected_codes:
                assert country["code"] == expected_codes[country["name"]], \
                    f"Expected code {expected_codes[country['name']]} for {country['name']}, got {country['code']}"
                print(f"SUCCESS: {country['name']} has correct code {country['code']}")


class TestLoginWithCountry:
    """Test login flow with country selection"""
    
    def test_login_with_india_country(self):
        """Test login with India country selected"""
        # First get India country ID
        countries_response = requests.get(f"{BASE_URL}/api/auth/countries")
        assert countries_response.status_code == 200
        
        countries = countries_response.json()
        india = next((c for c in countries if c["name"] == "India"), None)
        assert india is not None, "India country not found"
        
        # Login with country_id
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123",
            "country_id": india["id"]
        })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user"
        
        print(f"SUCCESS: Login with India country successful")
        print(f"User: {data['user'].get('name')}, Country: {data['user'].get('country_name')}")
    
    def test_login_without_country_id(self):
        """Test login without country_id (should still work)"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123"
        })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        assert "access_token" in data, "Response should contain access_token"
        
        print(f"SUCCESS: Login without country_id successful")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        
        assert login_response.status_code == 401, f"Expected 401, got {login_response.status_code}"
        print("SUCCESS: Invalid credentials correctly rejected")


class TestLeadsAPI:
    """Test Leads API endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_leads(self, auth_token):
        """Test getting leads list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/leads", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        leads = response.json()
        assert isinstance(leads, list), "Response should be a list"
        print(f"SUCCESS: Retrieved {len(leads)} leads")
    
    def test_leads_have_required_fields(self, auth_token):
        """Test that leads have required fields including ad_id"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/leads", headers=headers)
        
        assert response.status_code == 200
        leads = response.json()
        
        if len(leads) > 0:
            lead = leads[0]
            required_fields = ["id", "name", "mobile", "city", "source", "status"]
            for field in required_fields:
                assert field in lead, f"Lead missing required field: {field}"
            
            # ad_id is optional but should be supported
            print(f"SUCCESS: Lead has all required fields")
            if "ad_id" in lead and lead["ad_id"]:
                print(f"SUCCESS: Lead has ad_id: {lead['ad_id']}")
            if "payment_link" in lead and lead["payment_link"]:
                print(f"SUCCESS: Lead has payment_link: {lead['payment_link']}")
    
    def test_create_lead_with_ad_id(self, auth_token):
        """Test creating a lead with ad_id field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        lead_data = {
            "name": "TEST_Lead_AdID",
            "mobile": "9999999999",
            "city": "Bangalore",
            "source": "FACEBOOK",
            "status": "NEW",
            "ad_id": "TEST_AD_123456"
        }
        
        response = requests.post(f"{BASE_URL}/api/leads", headers=headers, json=lead_data)
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        created_lead = response.json()
        assert created_lead.get("ad_id") == "TEST_AD_123456", "ad_id not saved correctly"
        
        print(f"SUCCESS: Created lead with ad_id: {created_lead.get('ad_id')}")
        
        # Cleanup - delete the test lead
        lead_id = created_lead.get("id")
        if lead_id:
            requests.delete(f"{BASE_URL}/api/leads/{lead_id}", headers=headers)
    
    def test_update_lead_with_payment_link(self, auth_token):
        """Test updating a lead with payment_link"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First create a test lead
        lead_data = {
            "name": "TEST_Lead_PaymentLink",
            "mobile": "8888888888",
            "city": "Mumbai",
            "source": "GOOGLE",
            "status": "NEW"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/leads", headers=headers, json=lead_data)
        assert create_response.status_code in [200, 201]
        
        created_lead = create_response.json()
        lead_id = created_lead.get("id")
        
        # Update with payment link
        update_data = {
            "payment_link": "https://rzp.io/l/TESTLINK123"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/leads/{lead_id}", headers=headers, json=update_data)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated_lead = update_response.json()
        assert updated_lead.get("payment_link") == "https://rzp.io/l/TESTLINK123", "payment_link not saved"
        
        print(f"SUCCESS: Updated lead with payment_link")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/leads/{lead_id}", headers=headers)


class TestLeadStatuses:
    """Test lead status values"""
    
    def test_get_lead_statuses(self):
        """Test getting lead statuses"""
        response = requests.get(f"{BASE_URL}/api/lead-statuses")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        statuses = response.json()
        assert isinstance(statuses, list), "Response should be a list"
        
        # Check for required statuses
        required_statuses = ["NEW", "CONTACTED", "INTERESTED", "NOT_INTERESTED", "CONVERTED", "RNR"]
        for status in required_statuses:
            assert status in statuses, f"Missing required status: {status}"
        
        print(f"SUCCESS: Found {len(statuses)} statuses: {statuses}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
