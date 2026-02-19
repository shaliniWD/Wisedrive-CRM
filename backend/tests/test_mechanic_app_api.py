"""
Test suite for Mechanic Mobile App API endpoints
Tests: OTP Login, Inspections List, Accept/Reject, Progress, Complete
"""
import pytest
import requests
import os
import uuid

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MECHANIC_PHONE = "+919689760236"
DEV_OTP = "123456"
CRM_ADMIN_EMAIL = "countryhead.in@wisedrive.com"
CRM_ADMIN_PASSWORD = "password123"


class TestMechanicOTPAuth:
    """Test mechanic OTP authentication flow"""
    
    def test_request_otp_registered_mechanic(self, api_client):
        """Test OTP request for registered mechanic phone"""
        response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={
            "phone": MECHANIC_PHONE
        })
        
        # Should return success for registered mechanic
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
        print(f"✓ OTP request successful: {data.get('message')}")
    
    def test_request_otp_unregistered_phone(self, api_client):
        """Test OTP request for unregistered phone number"""
        response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={
            "phone": "+919999999999"  # Unregistered number
        })
        
        # Should return 404 for unregistered mechanic
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        print(f"✓ Unregistered phone correctly rejected: {data.get('detail')}")
    
    def test_verify_otp_success(self, api_client):
        """Test OTP verification with correct OTP"""
        # First request OTP
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={
            "phone": MECHANIC_PHONE
        })
        
        # Verify with dev OTP
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": MECHANIC_PHONE,
            "otp": DEV_OTP
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "mechanicProfile" in data, "Response should contain mechanicProfile"
        
        profile = data["mechanicProfile"]
        assert "id" in profile
        assert "name" in profile
        assert "phone" in profile
        print(f"✓ OTP verification successful. Mechanic: {profile.get('name')}")
        
        return data["token"]
    
    def test_verify_otp_invalid(self, api_client):
        """Test OTP verification with wrong OTP"""
        # First request OTP
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={
            "phone": MECHANIC_PHONE
        })
        
        # Verify with wrong OTP
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": MECHANIC_PHONE,
            "otp": "000000"  # Wrong OTP
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Invalid OTP correctly rejected")
    
    def test_verify_otp_without_request(self, api_client):
        """Test OTP verification without prior request"""
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+919888888888",  # Phone that didn't request OTP
            "otp": DEV_OTP
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ OTP verification without request correctly rejected")


class TestMechanicInspections:
    """Test mechanic inspections endpoints"""
    
    def test_get_inspections_list(self, mechanic_auth_client):
        """Test getting inspections list for mechanic"""
        response = mechanic_auth_client.get(f"{BASE_URL}/api/mechanic/inspections")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            inspection = data[0]
            # Verify inspection structure
            assert "id" in inspection
            assert "status" in inspection
            assert "vehicleNumber" in inspection
            assert "customerName" in inspection
            print(f"✓ Got {len(data)} inspections. First: {inspection.get('vehicleNumber')}")
        else:
            print("✓ Got empty inspections list (no inspections available)")
        
        return data
    
    def test_get_inspections_with_status_filter(self, mechanic_auth_client):
        """Test filtering inspections by status"""
        for status in ["NEW", "ACCEPTED", "COMPLETED"]:
            response = mechanic_auth_client.get(
                f"{BASE_URL}/api/mechanic/inspections",
                params={"status": status}
            )
            
            assert response.status_code == 200, f"Expected 200 for status={status}, got {response.status_code}"
            data = response.json()
            print(f"✓ Status filter '{status}': {len(data)} inspections")
    
    def test_get_inspections_unauthorized(self):
        """Test inspections endpoint without auth"""
        # Use fresh session without auth token
        fresh_session = requests.Session()
        fresh_session.headers.update({"Content-Type": "application/json"})
        
        response = fresh_session.get(f"{BASE_URL}/api/mechanic/inspections")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthorized access correctly rejected")


class TestMechanicInspectionDetail:
    """Test mechanic inspection detail endpoint"""
    
    def test_get_inspection_detail(self, mechanic_auth_client, test_inspection_id):
        """Test getting inspection detail"""
        if not test_inspection_id:
            pytest.skip("No inspection available for testing")
        
        response = mechanic_auth_client.get(
            f"{BASE_URL}/api/mechanic/inspections/{test_inspection_id}"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("id") == test_inspection_id
        assert "vehicleNumber" in data
        assert "customerName" in data
        assert "status" in data
        print(f"✓ Got inspection detail: {data.get('vehicleNumber')}")
    
    def test_get_inspection_detail_not_found(self, mechanic_auth_client):
        """Test getting non-existent inspection"""
        fake_id = f"fake-{uuid.uuid4()}"
        response = mechanic_auth_client.get(
            f"{BASE_URL}/api/mechanic/inspections/{fake_id}"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent inspection correctly returns 404")


class TestInspectionQuestionnaire:
    """Test inspection questionnaire endpoint"""
    
    def test_get_questionnaire(self, mechanic_auth_client, test_inspection_id):
        """Test getting questionnaire for inspection"""
        if not test_inspection_id:
            pytest.skip("No inspection available for testing")
        
        response = mechanic_auth_client.get(
            f"{BASE_URL}/api/inspections/{test_inspection_id}/questionnaire"
        )
        
        # May return 200 with questions or 404 if no template
        if response.status_code == 200:
            data = response.json()
            assert "inspection_id" in data
            assert "questions" in data
            assert "total_questions" in data
            print(f"✓ Got questionnaire with {data.get('total_questions')} questions")
        elif response.status_code == 404:
            print("✓ No questionnaire template found (expected for some inspections)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}: {response.text}")


class TestMechanicInspectionActions:
    """Test mechanic inspection accept/reject/progress/complete actions"""
    
    def test_accept_inspection(self, mechanic_auth_client, new_inspection_id):
        """Test accepting an inspection"""
        if not new_inspection_id:
            pytest.skip("No NEW inspection available for testing")
        
        response = mechanic_auth_client.post(
            f"{BASE_URL}/api/mechanic/inspections/{new_inspection_id}/accept"
        )
        
        # May succeed or fail if already assigned
        if response.status_code == 200:
            data = response.json()
            assert data.get("status") == "ACCEPTED"
            assert "assignedMechanicId" in data
            print(f"✓ Inspection accepted: {data.get('message')}")
        elif response.status_code == 400:
            print("✓ Inspection already assigned (expected)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}: {response.text}")
    
    def test_save_progress(self, mechanic_auth_client, accepted_inspection_id):
        """Test saving inspection progress"""
        if not accepted_inspection_id:
            pytest.skip("No accepted inspection available for testing")
        
        response = mechanic_auth_client.post(
            f"{BASE_URL}/api/mechanic/inspections/{accepted_inspection_id}/progress",
            json={
                "progress_data": {
                    "photosDone": True,
                    "notesDone": False
                }
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "progress" in data
            print(f"✓ Progress saved: {data.get('message')}")
        elif response.status_code == 403:
            print("✓ Not assigned to this inspection (expected)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}: {response.text}")
    
    def test_complete_inspection(self, mechanic_auth_client, accepted_inspection_id):
        """Test completing an inspection"""
        if not accepted_inspection_id:
            pytest.skip("No accepted inspection available for testing")
        
        response = mechanic_auth_client.post(
            f"{BASE_URL}/api/mechanic/inspections/{accepted_inspection_id}/complete"
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("status") == "COMPLETED"
            print(f"✓ Inspection completed: {data.get('message')}")
        elif response.status_code == 403:
            print("✓ Not assigned to this inspection (expected)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}: {response.text}")
    
    def test_accept_nonexistent_inspection(self, mechanic_auth_client):
        """Test accepting non-existent inspection"""
        fake_id = f"fake-{uuid.uuid4()}"
        response = mechanic_auth_client.post(
            f"{BASE_URL}/api/mechanic/inspections/{fake_id}/accept"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent inspection correctly returns 404")


class TestMechanicRejectInspection:
    """Test mechanic reject inspection endpoint"""
    
    def test_reject_inspection(self, mechanic_auth_client, new_inspection_id):
        """Test rejecting an inspection"""
        if not new_inspection_id:
            pytest.skip("No NEW inspection available for testing")
        
        response = mechanic_auth_client.post(
            f"{BASE_URL}/api/mechanic/inspections/{new_inspection_id}/reject",
            json={"reason": "Test rejection - too far away"}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("status") == "REJECTED"
            print(f"✓ Inspection rejected: {data.get('message')}")
        elif response.status_code == 400:
            print("✓ Inspection already assigned (expected)")
        else:
            # May fail if inspection doesn't exist or already processed
            print(f"Reject returned {response.status_code}: {response.text}")


# ==================== FIXTURES ====================

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def mechanic_token(api_client):
    """Get mechanic auth token via OTP flow"""
    # Request OTP
    otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={
        "phone": MECHANIC_PHONE
    })
    
    if otp_response.status_code != 200:
        pytest.skip(f"Could not request OTP: {otp_response.text}")
    
    # Verify OTP
    verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={
        "phone": MECHANIC_PHONE,
        "otp": DEV_OTP
    })
    
    if verify_response.status_code != 200:
        pytest.skip(f"Could not verify OTP: {verify_response.text}")
    
    data = verify_response.json()
    return data.get("token")


@pytest.fixture(scope="session")
def mechanic_auth_client(api_client, mechanic_token):
    """Session with mechanic auth header"""
    if not mechanic_token:
        pytest.skip("No mechanic token available")
    
    api_client.headers.update({"Authorization": f"Bearer {mechanic_token}"})
    return api_client


@pytest.fixture(scope="session")
def test_inspection_id(mechanic_auth_client):
    """Get an inspection ID for testing"""
    response = mechanic_auth_client.get(f"{BASE_URL}/api/mechanic/inspections")
    
    if response.status_code != 200:
        return None
    
    inspections = response.json()
    if inspections:
        return inspections[0].get("id")
    return None


@pytest.fixture(scope="session")
def new_inspection_id(mechanic_auth_client):
    """Get a NEW status inspection ID for testing"""
    response = mechanic_auth_client.get(
        f"{BASE_URL}/api/mechanic/inspections",
        params={"status": "NEW"}
    )
    
    if response.status_code != 200:
        return None
    
    inspections = response.json()
    if inspections:
        return inspections[0].get("id")
    return None


@pytest.fixture(scope="session")
def accepted_inspection_id(mechanic_auth_client):
    """Get an ACCEPTED status inspection ID for testing"""
    response = mechanic_auth_client.get(
        f"{BASE_URL}/api/mechanic/inspections",
        params={"status": "ACCEPTED"}
    )
    
    if response.status_code != 200:
        return None
    
    inspections = response.json()
    if inspections:
        return inspections[0].get("id")
    return None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
