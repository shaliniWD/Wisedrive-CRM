"""
API Contract Tests - Run before deploying after any refactoring

These tests verify that API responses match the expected structure.
Run with: pytest tests/test_api_contracts.py -v

IMPORTANT: Run these tests after ANY refactoring to catch regressions early!
"""
import pytest
import httpx
import os

# Get API URL from environment or use default
API_URL = os.environ.get("API_URL", "http://localhost:8001/api")
TEST_EMAIL = "kalyan@wisedrive.com"
TEST_PASSWORD = "password123"


@pytest.fixture
def auth_token():
    """Get authentication token for testing"""
    response = httpx.post(
        f"{API_URL}/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200
    return response.json().get("access_token")


class TestMechanicAPIContract:
    """
    Tests for Mechanic App API - ensures response structure is correct
    """
    
    REQUIRED_FIELDS = [
        "id", "scheduledAt", "status", "crmStatus", 
        "vehicleNumber", "makeModelVariant", "customerName"
    ]
    
    VALID_STATUSES = ["NEW", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "REJECTED"]
    
    def test_mechanic_inspections_response_structure(self, auth_token):
        """Verify /mechanic/inspections returns properly transformed data"""
        response = httpx.get(
            f"{API_URL}/mechanic/inspections",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            inspection = data[0]
            
            # Check required fields exist
            for field in self.REQUIRED_FIELDS:
                assert field in inspection, f"Missing required field: {field}"
            
            # Check status is valid
            assert inspection["status"] in self.VALID_STATUSES, \
                f"Invalid status: {inspection['status']}"
            
            # Check it's NOT returning raw DB fields
            assert "inspection_status" not in inspection, \
                "Response contains raw DB field 'inspection_status' - transformation not applied!"
            assert "car_number" not in inspection, \
                "Response contains raw DB field 'car_number' - transformation not applied!"
    
    def test_mechanic_inspection_detail_structure(self, auth_token):
        """Verify /mechanic/inspections/{id} returns properly transformed data"""
        # First get list to get an ID
        list_response = httpx.get(
            f"{API_URL}/mechanic/inspections",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if list_response.status_code == 200 and len(list_response.json()) > 0:
            inspection_id = list_response.json()[0]["id"]
            
            response = httpx.get(
                f"{API_URL}/mechanic/inspections/{inspection_id}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            assert response.status_code == 200
            inspection = response.json()
            
            # Check required fields
            for field in self.REQUIRED_FIELDS:
                assert field in inspection, f"Missing required field: {field}"
            
            # Check status is valid
            assert inspection["status"] in self.VALID_STATUSES


class TestInspectionsAPIContract:
    """
    Tests for CRM Inspections API
    """
    
    def test_inspections_list_response(self, auth_token):
        """Verify /inspections returns expected structure"""
        response = httpx.get(
            f"{API_URL}/inspections?limit=5",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "inspections" in data or isinstance(data, list)


class TestVehicleAPIContract:
    """
    Tests for Vehicle/Vaahan API
    """
    
    def test_vehicle_details_has_source(self, auth_token):
        """Verify vehicle details includes source indicator (local_db or vaahan_api)"""
        response = httpx.get(
            f"{API_URL}/vehicle/details/KA01AB1234",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "source" in data, "Vehicle API should indicate data source"
            assert data["source"] in ["local_db", "vaahan_api"]


# Quick check that can be run manually
if __name__ == "__main__":
    print("Running API Contract Tests...")
    print(f"API URL: {API_URL}")
    
    # Get token
    response = httpx.post(
        f"{API_URL}/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to authenticate: {response.text}")
        exit(1)
    
    token = response.json().get("access_token")
    print(f"✅ Authenticated")
    
    # Test mechanic inspections
    response = httpx.get(
        f"{API_URL}/mechanic/inspections",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        if len(data) > 0:
            first = data[0]
            required = ["status", "vehicleNumber", "customerName", "scheduledAt"]
            missing = [f for f in required if f not in first]
            
            if missing:
                print(f"❌ REGRESSION: Missing fields in mechanic API: {missing}")
                print(f"   Got keys: {list(first.keys())[:10]}")
            else:
                print(f"✅ Mechanic API contract OK - status: {first.get('status')}")
        else:
            print("⚠️  No inspections to test")
    else:
        print(f"❌ Mechanic API failed: {response.status_code}")
    
    print("\nDone!")
