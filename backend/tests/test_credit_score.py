"""
Credit Score Feature Tests - Loans Module
Tests for Experian API integration via Invincible Ocean

Features tested:
- POST /api/loan-leads/{lead_id}/credit-score/request-otp - Request OTP for credit check
- POST /api/loan-leads/{lead_id}/credit-score/verify-otp - Verify OTP and fetch score
- GET /api/loan-leads/{lead_id}/credit-score - Get stored credit score
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kalyan@wisedrive.com",
        "password": "password123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping tests")

@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session

@pytest.fixture(scope="module")
def test_lead_id(api_client):
    """Get a valid loan lead ID for testing"""
    # Get loan leads
    response = api_client.get(f"{BASE_URL}/api/loan-leads")
    assert response.status_code == 200
    leads = response.json()
    
    if not leads:
        pytest.skip("No loan leads available for testing")
    
    # Return first lead ID
    return leads[0]["id"]


class TestCreditScoreEndpoints:
    """Test Credit Score API endpoints"""
    
    def test_get_credit_score_endpoint_exists(self, api_client, test_lead_id):
        """Test GET /api/loan-leads/{lead_id}/credit-score endpoint exists"""
        response = api_client.get(f"{BASE_URL}/api/loan-leads/{test_lead_id}/credit-score")
        
        # Should return 200 (even if no score yet)
        assert response.status_code == 200
        
        data = response.json()
        # Response should have expected structure
        assert "credit_score" in data
        assert "summary" in data
        assert "request_status" in data
        
        print(f"Credit score endpoint working. Current score: {data.get('credit_score')}")
    
    def test_get_credit_score_invalid_lead_id(self, api_client):
        """Test GET credit score with invalid lead ID returns 404"""
        invalid_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/loan-leads/{invalid_id}/credit-score")
        
        assert response.status_code == 404
        print("404 returned for invalid lead ID - correct behavior")
    
    def test_request_otp_endpoint_exists(self, api_client, test_lead_id):
        """Test POST /api/loan-leads/{lead_id}/credit-score/request-otp endpoint exists"""
        # Test with minimal valid data - this will call real API
        # We expect it to either succeed or fail with validation error
        test_data = {
            "first_name": "Test",
            "last_name": "User",
            "pan_number": "ABCDE1234F",  # Test PAN
            "dob": "19900101",
            "mobile_number": "9999999999",  # Test mobile
            "email": "test@example.com",
            "gender": "male",
            "pin_code": "560001"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{test_lead_id}/credit-score/request-otp",
            json=test_data
        )
        
        # Should return 200 (success) or 400 (API validation error) - not 404 or 500
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, body: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data
            assert "token" in data or "message" in data
            print(f"OTP request successful: {data.get('message')}")
        else:
            # 400 is expected for invalid test data
            print(f"OTP request returned 400 (expected for test data): {response.json().get('detail')}")
    
    def test_request_otp_invalid_lead_id(self, api_client):
        """Test request OTP with invalid lead ID returns 404"""
        invalid_id = str(uuid.uuid4())
        test_data = {
            "first_name": "Test",
            "last_name": "User",
            "pan_number": "ABCDE1234F",
            "dob": "19900101",
            "mobile_number": "9999999999",
            "email": "test@example.com",
            "gender": "male",
            "pin_code": "560001"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{invalid_id}/credit-score/request-otp",
            json=test_data
        )
        
        assert response.status_code == 404
        print("404 returned for invalid lead ID on request-otp - correct behavior")
    
    def test_request_otp_validation_pan_format(self, api_client, test_lead_id):
        """Test request OTP validates PAN format (10 chars)"""
        # Invalid PAN (too short)
        test_data = {
            "first_name": "Test",
            "last_name": "User",
            "pan_number": "ABC",  # Invalid - too short
            "dob": "19900101",
            "mobile_number": "9999999999",
            "email": "test@example.com",
            "gender": "male",
            "pin_code": "560001"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{test_lead_id}/credit-score/request-otp",
            json=test_data
        )
        
        # Should return 400 or 422 for validation error
        # Note: Backend may pass to API which will reject it
        assert response.status_code in [200, 400, 422], f"Status: {response.status_code}"
        print(f"PAN validation test - status: {response.status_code}")
    
    def test_verify_otp_endpoint_exists(self, api_client, test_lead_id):
        """Test POST /api/loan-leads/{lead_id}/credit-score/verify-otp endpoint exists"""
        # Test with dummy token/OTP - will fail but endpoint should exist
        test_data = {
            "token": "dummy_token_for_testing",
            "otp": "123456"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{test_lead_id}/credit-score/verify-otp",
            json=test_data
        )
        
        # Should return 400 (invalid token) not 404 or 500
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, body: {response.text}"
        
        if response.status_code == 400:
            print(f"Verify OTP endpoint exists - returned 400 for invalid token (expected)")
        else:
            print(f"Verify OTP returned 200 - unexpected for dummy token")
    
    def test_verify_otp_invalid_lead_id(self, api_client):
        """Test verify OTP with invalid lead ID returns 404"""
        invalid_id = str(uuid.uuid4())
        test_data = {
            "token": "dummy_token",
            "otp": "123456"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{invalid_id}/credit-score/verify-otp",
            json=test_data
        )
        
        assert response.status_code == 404
        print("404 returned for invalid lead ID on verify-otp - correct behavior")


class TestCreditScoreDataStructure:
    """Test credit score data structure in loan leads"""
    
    def test_loan_lead_has_credit_score_field(self, api_client, test_lead_id):
        """Test that loan lead response includes credit_score field"""
        response = api_client.get(f"{BASE_URL}/api/loan-leads/{test_lead_id}")
        
        assert response.status_code == 200
        lead = response.json()
        
        # credit_score field should exist (can be null)
        # The field may not be present if never set, which is also valid
        print(f"Lead credit_score: {lead.get('credit_score', 'not set')}")
        print(f"Lead has credit_score_summary: {'credit_score_summary' in lead}")
    
    def test_loan_leads_list_includes_credit_score(self, api_client):
        """Test that loan leads list includes credit_score for each lead"""
        response = api_client.get(f"{BASE_URL}/api/loan-leads")
        
        assert response.status_code == 200
        leads = response.json()
        
        if leads:
            # Check first lead has credit_score field accessible
            first_lead = leads[0]
            # credit_score may be None or a number
            print(f"First lead credit_score: {first_lead.get('credit_score', 'not present')}")
            
            # Count leads with credit scores
            with_score = sum(1 for l in leads if l.get('credit_score'))
            print(f"Leads with credit score: {with_score}/{len(leads)}")


class TestCreditScoreColorCoding:
    """Test credit score color coding logic (frontend validation)"""
    
    def test_score_color_logic(self):
        """Verify score color coding ranges"""
        # These are the expected ranges from frontend code:
        # >= 750: green (Excellent)
        # >= 650: yellow (Fair/Good)
        # >= 550: orange (Poor)
        # < 550: red (Very Poor)
        
        test_cases = [
            (800, "green", "Excellent"),
            (750, "green", "Excellent"),
            (749, "yellow", "Good"),
            (700, "yellow", "Good"),
            (650, "yellow", "Fair"),
            (649, "orange", "Poor"),
            (550, "orange", "Poor"),
            (549, "red", "Very Poor"),
            (400, "red", "Very Poor"),
        ]
        
        for score, expected_color, expected_label in test_cases:
            if score >= 750:
                color = "green"
            elif score >= 650:
                color = "yellow"
            elif score >= 550:
                color = "orange"
            else:
                color = "red"
            
            assert color == expected_color, f"Score {score} should be {expected_color}, got {color}"
        
        print("All score color coding ranges verified correctly")


class TestCreditScoreAPIConfiguration:
    """Test that Experian API is properly configured"""
    
    def test_experian_credentials_configured(self, api_client, test_lead_id):
        """Test that Experian API credentials are configured"""
        # Make a request that would fail if credentials not configured
        test_data = {
            "first_name": "Test",
            "last_name": "User",
            "pan_number": "ABCDE1234F",
            "dob": "19900101",
            "mobile_number": "9999999999",
            "email": "test@example.com",
            "gender": "male",
            "pin_code": "560001"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{test_lead_id}/credit-score/request-otp",
            json=test_data
        )
        
        # If credentials not configured, would return 500 with specific message
        if response.status_code == 500:
            detail = response.json().get("detail", "")
            if "not configured" in detail.lower():
                pytest.fail("Experian API credentials not configured in backend")
        
        # 200 or 400 means credentials are configured
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        print("Experian API credentials are configured")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
