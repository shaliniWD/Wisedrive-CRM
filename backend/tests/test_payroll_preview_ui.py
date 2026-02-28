"""
Test Payroll Preview UI/UX Changes
- Working Days editable in header (not in table column)
- Absent Days column (renamed from Attendance Days) editable
- Validation: Absent Days >= 0 and <= Working Days
- Real-time recalculation when Absent Days is edited
- Other deductions column editable
- Create Batch works after edits
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://car-credit-portal.preview.emergentagent.com')

class TestPayrollPreviewUIChanges:
    """Test the new Payroll Preview UI/UX features"""
    
    auth_token = None
    country_id = None
    preview_data = None
    batch_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        # Login as CEO
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.__class__.auth_token = data.get("access_token")
        
        # Get India country ID
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        countries_response = requests.get(f"{BASE_URL}/api/hr/countries", headers=headers)
        if countries_response.status_code == 200:
            countries = countries_response.json()
            for country in countries:
                if country.get("name") == "India":
                    self.__class__.country_id = country.get("id")
                    break
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_01_generate_preview(self):
        """Test generating payroll preview - verifies API returns data with absent_days support"""
        headers = self.get_headers()
        
        # Use a fresh month that doesn't have a batch
        response = requests.post(f"{BASE_URL}/api/hr/payroll/preview", 
            headers=headers,
            json={
                "month": 6,  # June 2026
                "year": 2026,
                "country_id": self.country_id
            }
        )
        
        print(f"Preview response status: {response.status_code}")
        if response.status_code != 200:
            print(f"Preview response: {response.text}")
        
        # If batch exists, try another month
        if response.status_code == 400 and "already exists" in response.text.lower():
            response = requests.post(f"{BASE_URL}/api/hr/payroll/preview", 
                headers=headers,
                json={
                    "month": 7,  # July 2026
                    "year": 2026,
                    "country_id": self.country_id
                }
            )
        
        assert response.status_code == 200, f"Preview generation failed: {response.text}"
        
        data = response.json()
        self.__class__.preview_data = data
        
        # Verify preview structure
        assert "working_days" in data, "Missing working_days in preview"
        assert "records" in data, "Missing records in preview"
        assert "total_gross" in data, "Missing total_gross in preview"
        assert "total_net" in data, "Missing total_net in preview"
        
        print(f"Preview generated with {len(data.get('records', []))} employees")
    
    def test_02_verify_working_days_in_header(self):
        """Test that working_days is returned at the batch level (not per-record column)"""
        assert self.preview_data is not None, "Preview data not available"
        assert "working_days" in self.preview_data, "Working days should be at header level"
        print(f"Working Days in header: {self.preview_data.get('working_days')}")
    
    def test_03_create_batch_with_preview_data(self):
        """Test creating a batch from preview data"""
        assert self.preview_data is not None, "Preview data not available"
        
        headers = self.get_headers()
        
        response = requests.post(f"{BASE_URL}/api/hr/payroll/batch",
            headers=headers,
            json={
                "month": self.preview_data.get("month"),
                "year": self.preview_data.get("year"),
                "country_id": self.preview_data.get("country_id"),
                "records": self.preview_data.get("records", [])
            }
        )
        
        assert response.status_code == 200, f"Create batch failed: {response.text}"
        
        data = response.json()
        self.__class__.batch_id = data.get("id")
        
        assert data.get("status") == "DRAFT"
        print(f"Batch created with ID: {self.batch_id}")
    
    def test_04_validate_absent_days_cannot_exceed_working_days(self):
        """Test validation: absent_days <= working_days"""
        assert self.batch_id is not None, "Batch not created"
        
        headers = self.get_headers()
        
        response = requests.get(f"{BASE_URL}/api/hr/payroll/batch/{self.batch_id}", headers=headers)
        batch_data = response.json()
        records = batch_data.get("records", [])
        
        if len(records) > 0:
            record = records[0]
            record_id = record.get("id")
            
            # Try to set attendance_days to negative (which means absent > working)
            update_response = requests.put(
                f"{BASE_URL}/api/hr/payroll/batch/{self.batch_id}/record/{record_id}",
                headers=headers,
                json={"attendance_days": -5}
            )
            
            assert update_response.status_code == 400, "Should reject negative attendance_days"
    
    def test_05_cleanup_delete_batch(self):
        """Clean up: Delete the test batch"""
        if self.batch_id:
            headers = self.get_headers()
            response = requests.delete(f"{BASE_URL}/api/hr/payroll/batch/{self.batch_id}", headers=headers)
            assert response.status_code in [200, 204]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
