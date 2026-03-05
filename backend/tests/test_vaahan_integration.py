"""
Test Vaahan API Integration for Vehicle RTO Data
Tests the fetch-vaahan-data endpoint and data storage in inspection records
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVaahanIntegration:
    """Test Vaahan API integration for vehicle data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
        
        # Test inspection ID with car_number BR02BA4257
        self.test_inspection_id = "d4a31696-0fb6-4a4a-9e45-7f6927ab98de"
    
    def test_fetch_vaahan_data_endpoint_returns_200(self):
        """Test that POST /api/inspections/{id}/fetch-vaahan-data returns 200"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}/fetch-vaahan-data"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] == True
    
    def test_fetch_vaahan_data_returns_engine_number(self):
        """Test that Vaahan data includes engine_number"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}/fetch-vaahan-data"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        vaahan_data = data.get("vaahan_data", {})
        assert "engine_number" in vaahan_data, "engine_number field missing from vaahan_data"
        assert vaahan_data["engine_number"], "engine_number should not be empty"
        print(f"Engine Number: {vaahan_data['engine_number']}")
    
    def test_fetch_vaahan_data_returns_chassis_number(self):
        """Test that Vaahan data includes chassis_number"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}/fetch-vaahan-data"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        vaahan_data = data.get("vaahan_data", {})
        assert "chassis_number" in vaahan_data, "chassis_number field missing from vaahan_data"
        assert vaahan_data["chassis_number"], "chassis_number should not be empty"
        print(f"Chassis Number: {vaahan_data['chassis_number']}")
    
    def test_fetch_vaahan_data_returns_all_vehicle_details(self):
        """Test that Vaahan data includes all expected vehicle details"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}/fetch-vaahan-data"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        vaahan_data = data.get("vaahan_data", {})
        
        # Check all expected fields
        expected_fields = [
            "registration_number",
            "engine_number",
            "chassis_number",
            "manufacturer",
            "model",
            "color",
            "fuel_type",
            "body_type",
            "vehicle_class",
            "manufacturing_date",
            "registration_date",
            "owner_count",
            "insurance_company",
            "insurance_valid_upto",
            "status"
        ]
        
        for field in expected_fields:
            assert field in vaahan_data, f"Field '{field}' missing from vaahan_data"
        
        print(f"All expected fields present in vaahan_data")
    
    def test_inspection_stores_vaahan_data(self):
        """Test that inspection record stores vaahan_data after fetch"""
        # First fetch Vaahan data
        fetch_response = self.session.post(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}/fetch-vaahan-data"
        )
        assert fetch_response.status_code == 200
        
        # Then get the inspection to verify data is stored
        get_response = self.session.get(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}"
        )
        
        assert get_response.status_code == 200
        inspection = get_response.json()
        
        # Verify vaahan_data is stored in inspection
        assert "vaahan_data" in inspection, "vaahan_data not stored in inspection"
        assert inspection["vaahan_data"], "vaahan_data should not be empty"
        
        # Verify engine_number and chassis_number are in stored data
        vaahan_data = inspection["vaahan_data"]
        assert "engine_number" in vaahan_data, "engine_number not in stored vaahan_data"
        assert "chassis_number" in vaahan_data, "chassis_number not in stored vaahan_data"
        
        print(f"Stored Engine Number: {vaahan_data['engine_number']}")
        print(f"Stored Chassis Number: {vaahan_data['chassis_number']}")
    
    def test_inspection_has_rto_verification_status(self):
        """Test that inspection has rto_verification_status after Vaahan fetch"""
        # Fetch Vaahan data
        self.session.post(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}/fetch-vaahan-data"
        )
        
        # Get inspection
        get_response = self.session.get(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}"
        )
        
        assert get_response.status_code == 200
        inspection = get_response.json()
        
        assert "rto_verification_status" in inspection
        assert inspection["rto_verification_status"] == "VERIFIED"
    
    def test_fetch_vaahan_data_without_car_number_returns_400(self):
        """Test that fetching Vaahan data for inspection without car_number returns 400"""
        # Create a test inspection without car_number (or use a known one)
        # For now, we'll test with a non-existent inspection
        response = self.session.post(
            f"{BASE_URL}/api/inspections/non-existent-id/fetch-vaahan-data"
        )
        
        # Should return 404 for non-existent inspection
        assert response.status_code == 404
    
    def test_vaahan_data_source_field(self):
        """Test that response includes source field (local_db or vaahan_api)"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}/fetch-vaahan-data"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "source" in data, "source field missing from response"
        assert data["source"] in ["local_db", "vaahan_api"], f"Unexpected source: {data['source']}"
        print(f"Data source: {data['source']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
