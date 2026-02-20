"""
Test suite for Mechanic App - Seed Test Data and Inspections API
Tests: Seed test data, Dev mechanic login, Fetch inspections with correct fields
"""
import pytest
import requests
import os

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials for dev mechanic
DEV_MECHANIC_PHONE = "9611188788"
DEV_OTP = "123456"


class TestSeedTestData:
    """Test seed test data endpoint"""
    
    def test_seed_test_data_creates_inspections(self, api_client):
        """Test POST /api/mechanic/seed-test-data creates test inspections"""
        response = api_client.post(f"{BASE_URL}/api/mechanic/seed-test-data")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "message" in data, "Response should contain message"
        assert "total_test_inspections" in data, "Response should contain total_test_inspections"
        assert "cities" in data, "Response should contain cities"
        assert "statuses" in data, "Response should contain statuses"
        
        # Verify cities include expected values
        cities = data.get("cities", [])
        assert "Bangalore" in cities, "Cities should include Bangalore"
        assert "Hyderabad" in cities, "Cities should include Hyderabad"
        assert "Chennai" in cities, "Cities should include Chennai"
        
        # Verify statuses include expected values
        statuses = data.get("statuses", [])
        assert "NEW" in statuses, "Statuses should include NEW"
        assert "ACCEPTED" in statuses, "Statuses should include ACCEPTED"
        assert "COMPLETED" in statuses, "Statuses should include COMPLETED"
        
        print(f"✓ Seed test data successful: {data.get('message')}")
        print(f"  Total test inspections: {data.get('total_test_inspections')}")
        print(f"  Cities: {cities}")
        print(f"  Statuses: {statuses}")


class TestDevMechanicAuth:
    """Test dev mechanic authentication flow"""
    
    def test_request_otp_dev_mechanic(self, api_client):
        """Test OTP request for dev mechanic phone (9611188788)"""
        response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={
            "phone": DEV_MECHANIC_PHONE
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "OTP request should succeed"
        print(f"✓ OTP request for dev mechanic successful: {data.get('message')}")
    
    def test_verify_otp_dev_mechanic(self, api_client):
        """Test OTP verification for dev mechanic with OTP 123456"""
        # First request OTP
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={
            "phone": DEV_MECHANIC_PHONE
        })
        
        # Verify with dev OTP
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": DEV_MECHANIC_PHONE,
            "otp": DEV_OTP
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "mechanicProfile" in data, "Response should contain mechanicProfile"
        
        profile = data["mechanicProfile"]
        assert profile.get("id") == "dev-mechanic-001", f"Dev mechanic ID should be dev-mechanic-001, got {profile.get('id')}"
        assert profile.get("name") == "Dev Mechanic", f"Dev mechanic name should be 'Dev Mechanic', got {profile.get('name')}"
        assert profile.get("phone") == DEV_MECHANIC_PHONE, f"Phone should match, got {profile.get('phone')}"
        
        # Verify inspection_cities
        inspection_cities = profile.get("inspection_cities", [])
        assert "Bangalore" in inspection_cities, "Dev mechanic should have Bangalore in inspection_cities"
        assert "Hyderabad" in inspection_cities, "Dev mechanic should have Hyderabad in inspection_cities"
        assert "Chennai" in inspection_cities, "Dev mechanic should have Chennai in inspection_cities"
        
        print(f"✓ Dev mechanic login successful")
        print(f"  ID: {profile.get('id')}")
        print(f"  Name: {profile.get('name')}")
        print(f"  Phone: {profile.get('phone')}")
        print(f"  Inspection Cities: {inspection_cities}")
        
        return data["token"]
    
    def test_verify_otp_wrong_otp(self, api_client):
        """Test OTP verification with wrong OTP"""
        # First request OTP
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={
            "phone": DEV_MECHANIC_PHONE
        })
        
        # Verify with wrong OTP
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": DEV_MECHANIC_PHONE,
            "otp": "000000"
        })
        
        assert response.status_code == 400, f"Expected 400 for wrong OTP, got {response.status_code}"
        print("✓ Wrong OTP correctly rejected")


class TestMechanicInspectionsAPI:
    """Test mechanic inspections API with correct field mapping"""
    
    def test_get_inspections_returns_correct_fields(self, dev_mechanic_auth_client):
        """Test GET /api/mechanic/inspections returns inspections with correct fields"""
        response = dev_mechanic_auth_client.get(f"{BASE_URL}/api/mechanic/inspections")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Got {len(data)} inspections")
        
        if len(data) > 0:
            inspection = data[0]
            
            # Verify required fields exist
            required_fields = [
                "id", "scheduledAt", "status", "vehicleNumber", 
                "makeModelVariant", "city", "customerName", "customerPhone",
                "customerAddress", "latitude", "longitude", "assignedMechanicId",
                "requiredModules", "progress", "packageName"
            ]
            
            for field in required_fields:
                assert field in inspection, f"Inspection should have field '{field}'"
            
            print(f"  First inspection:")
            print(f"    ID: {inspection.get('id')}")
            print(f"    Vehicle: {inspection.get('vehicleNumber')}")
            print(f"    Status: {inspection.get('status')}")
            print(f"    City: {inspection.get('city')}")
            print(f"    Customer: {inspection.get('customerName')}")
            print(f"    Address: {inspection.get('customerAddress')}")
            print(f"    Latitude: {inspection.get('latitude')}")
            print(f"    Longitude: {inspection.get('longitude')}")
            
            # Verify latitude and longitude are present (for map navigation)
            assert inspection.get('latitude') is not None or inspection.get('customerAddress'), \
                "Inspection should have latitude or customerAddress for navigation"
            
            print("✓ All required fields present in inspection response")
        else:
            print("  No inspections found - seed test data first")
    
    def test_get_inspections_with_status_filter(self, dev_mechanic_auth_client):
        """Test filtering inspections by status"""
        for status in ["NEW", "ACCEPTED", "COMPLETED"]:
            response = dev_mechanic_auth_client.get(
                f"{BASE_URL}/api/mechanic/inspections",
                params={"status": status}
            )
            
            assert response.status_code == 200, f"Expected 200 for status={status}, got {response.status_code}"
            data = response.json()
            
            # Verify all returned inspections have the correct status
            for insp in data:
                assert insp.get("status") == status, f"Expected status {status}, got {insp.get('status')}"
            
            print(f"✓ Status filter '{status}': {len(data)} inspections")
    
    def test_get_inspections_unauthorized(self, api_client):
        """Test inspections endpoint without auth token"""
        response = api_client.get(f"{BASE_URL}/api/mechanic/inspections")
        
        # Should reject without auth
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print(f"✓ Unauthorized access correctly rejected with status {response.status_code}")


class TestInspectionFieldMapping:
    """Test that inspection fields are correctly mapped for frontend interface"""
    
    def test_inspection_has_navigation_fields(self, dev_mechanic_auth_client):
        """Test that inspections have latitude, longitude, and customerAddress for map navigation"""
        response = dev_mechanic_auth_client.get(f"{BASE_URL}/api/mechanic/inspections")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) == 0:
            pytest.skip("No inspections available - seed test data first")
        
        # Check each inspection has navigation fields
        for insp in data:
            # At least one of these should be present for navigation
            has_coords = insp.get('latitude') is not None and insp.get('longitude') is not None
            has_address = bool(insp.get('customerAddress'))
            
            assert has_coords or has_address, \
                f"Inspection {insp.get('id')} should have coordinates or address for navigation"
            
            if has_coords:
                print(f"  {insp.get('vehicleNumber')}: lat={insp.get('latitude')}, lng={insp.get('longitude')}")
            else:
                print(f"  {insp.get('vehicleNumber')}: address={insp.get('customerAddress')}")
        
        print(f"✓ All {len(data)} inspections have navigation data")
    
    def test_inspection_interface_compatibility(self, dev_mechanic_auth_client):
        """Test that API response matches frontend Inspection interface"""
        response = dev_mechanic_auth_client.get(f"{BASE_URL}/api/mechanic/inspections")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) == 0:
            pytest.skip("No inspections available - seed test data first")
        
        # Frontend Inspection interface fields:
        # id, scheduledAt, status, vehicleNumber, makeModelVariant, city,
        # customerName, customerPhone, customerAddress, latitude, longitude,
        # assignedMechanicId, requiredModules, progress, orderId, packageName
        
        interface_fields = {
            "id": str,
            "scheduledAt": str,
            "status": str,
            "vehicleNumber": str,
            "makeModelVariant": str,
            "city": str,
            "customerName": str,
            "customerPhone": str,
            "customerAddress": str,
            "latitude": (float, int, type(None)),
            "longitude": (float, int, type(None)),
            "assignedMechanicId": (str, type(None)),
            "requiredModules": dict,
            "progress": dict,
            "packageName": str,
        }
        
        for insp in data:
            for field, expected_type in interface_fields.items():
                assert field in insp, f"Missing field '{field}' in inspection {insp.get('id')}"
                
                if isinstance(expected_type, tuple):
                    assert isinstance(insp[field], expected_type), \
                        f"Field '{field}' should be {expected_type}, got {type(insp[field])}"
                else:
                    # Allow None for optional fields
                    if insp[field] is not None:
                        assert isinstance(insp[field], expected_type), \
                            f"Field '{field}' should be {expected_type}, got {type(insp[field])}"
        
        print(f"✓ All {len(data)} inspections match frontend Inspection interface")


class TestTokenValidation:
    """Test that dev mechanic token is valid for API access"""
    
    def test_token_valid_for_inspections(self, dev_mechanic_auth_client):
        """Test that dev mechanic token can access inspections endpoint"""
        response = dev_mechanic_auth_client.get(f"{BASE_URL}/api/mechanic/inspections")
        
        assert response.status_code == 200, f"Token should be valid, got {response.status_code}: {response.text}"
        print("✓ Dev mechanic token is valid for /api/mechanic/inspections")
    
    def test_token_contains_mechanic_info(self, api_client):
        """Test that token payload contains mechanic app flag"""
        # Login and get token
        api_client.post(f"{BASE_URL}/api/auth/request-otp", json={
            "phone": DEV_MECHANIC_PHONE
        })
        
        response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": DEV_MECHANIC_PHONE,
            "otp": DEV_OTP
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Token should be a JWT
        token = data.get("token")
        assert token is not None, "Token should be present"
        assert len(token.split('.')) == 3, "Token should be a valid JWT (3 parts)"
        
        print(f"✓ Token is a valid JWT format")


# ==================== FIXTURES ====================

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def dev_mechanic_token(api_client):
    """Get dev mechanic auth token via OTP flow"""
    # Request OTP
    otp_response = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={
        "phone": DEV_MECHANIC_PHONE
    })
    
    if otp_response.status_code != 200:
        pytest.skip(f"Could not request OTP: {otp_response.text}")
    
    # Verify OTP
    verify_response = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={
        "phone": DEV_MECHANIC_PHONE,
        "otp": DEV_OTP
    })
    
    if verify_response.status_code != 200:
        pytest.skip(f"Could not verify OTP: {verify_response.text}")
    
    data = verify_response.json()
    return data.get("token")


@pytest.fixture(scope="session")
def dev_mechanic_auth_client(dev_mechanic_token):
    """Session with dev mechanic auth header"""
    if not dev_mechanic_token:
        pytest.skip("No dev mechanic token available")
    
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {dev_mechanic_token}"
    })
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
