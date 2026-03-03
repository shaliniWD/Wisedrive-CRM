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

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vehicle-inspect-39.preview.emergentagent.com')

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
                "month": 4,  # April 2026
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
                    "month": 5,  # May 2026
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
        
        # Verify each record has the required fields
        if data.get("records"):
            record = data["records"][0]
            assert "employee_id" in record
            assert "gross_salary" in record
            assert "attendance_days" in record  # Present Days (calculated from Working - Absent)
            assert "attendance_deduction" in record
            assert "other_deductions" in record
            assert "net_salary" in record
        
        print(f"Preview generated with {len(data.get('records', []))} employees")
        print(f"Working Days: {data.get('working_days')}")
        print(f"Total Gross: {data.get('total_gross')}")
        print(f"Total Net: {data.get('total_net')}")
    
    def test_02_verify_working_days_in_header(self):
        """Test that working_days is returned at the batch level (not per-record column)"""
        assert self.preview_data is not None, "Preview data not available"
        
        # Working days should be at the batch/header level
        assert "working_days" in self.preview_data, "Working days should be at header level"
        working_days = self.preview_data.get("working_days")
        assert working_days > 0, "Working days should be positive"
        
        print(f"Working Days in header: {working_days}")
    
    def test_03_verify_absent_days_structure(self):
        """Test that records support absent_days calculation"""
        assert self.preview_data is not None, "Preview data not available"
        
        records = self.preview_data.get("records", [])
        assert len(records) > 0, "No records in preview"
        
        for record in records[:3]:  # Check first 3 records
            # attendance_days = working_days - absent_days
            # The UI shows absent_days as editable, and calculates attendance_days
            working_days = record.get("working_days_in_month", self.preview_data.get("working_days"))
            attendance_days = record.get("attendance_days", working_days)
            
            # Backend stores attendance_days; absent = working - attendance
            absent_days = working_days - attendance_days
            
            print(f"Employee: {record.get('employee_name')}")
            print(f"  Working Days: {working_days}")
            print(f"  Attendance Days: {attendance_days}")
            print(f"  Absent Days (calculated): {absent_days}")
            print(f"  Attendance Deduction: {record.get('attendance_deduction')}")
    
    def test_04_verify_net_salary_formula(self):
        """Test Net Salary = Gross - Statutory - (Absent_Days/Working_Days * Gross) - Other"""
        assert self.preview_data is not None, "Preview data not available"
        
        records = self.preview_data.get("records", [])
        
        for record in records[:3]:
            gross = record.get("gross_salary", 0)
            statutory = record.get("total_statutory_deductions", 0)
            attendance_ded = record.get("attendance_deduction", 0)
            other_ded = record.get("other_deductions", 0)
            net = record.get("net_salary", 0)
            
            # Calculate expected net
            expected_net = gross - statutory - attendance_ded - other_ded
            
            # Allow small rounding differences
            assert abs(net - expected_net) < 1, f"Net salary mismatch for {record.get('employee_name')}: expected {expected_net}, got {net}"
            
            print(f"Employee: {record.get('employee_name')}")
            print(f"  Gross: {gross}, Statutory: {statutory}, Attend Ded: {attendance_ded}, Other: {other_ded}")
            print(f"  Net: {net} (expected: {expected_net})")
    
    def test_05_verify_other_deductions_editable(self):
        """Test that other_deductions field exists and defaults to 0"""
        assert self.preview_data is not None, "Preview data not available"
        
        records = self.preview_data.get("records", [])
        
        for record in records[:3]:
            other_ded = record.get("other_deductions", -1)
            assert other_ded >= 0, f"other_deductions should be >= 0, got {other_ded}"
            print(f"Employee: {record.get('employee_name')}, Other Deductions: {other_ded}")
    
    def test_06_create_batch_with_preview_data(self):
        """Test creating a batch from preview data"""
        assert self.preview_data is not None, "Preview data not available"
        
        headers = self.get_headers()
        
        # Create batch
        response = requests.post(f"{BASE_URL}/api/hr/payroll/batch",
            headers=headers,
            json={
                "month": self.preview_data.get("month"),
                "year": self.preview_data.get("year"),
                "country_id": self.preview_data.get("country_id"),
                "records": self.preview_data.get("records", [])
            }
        )
        
        print(f"Create batch response status: {response.status_code}")
        if response.status_code != 200:
            print(f"Create batch response: {response.text}")
        
        assert response.status_code == 200, f"Create batch failed: {response.text}"
        
        data = response.json()
        self.__class__.batch_id = data.get("id")
        
        assert data.get("status") == "DRAFT", "Batch should be in DRAFT status"
        print(f"Batch created with ID: {self.batch_id}, Status: {data.get('status')}")
    
    def test_07_update_batch_record_absent_days(self):
        """Test updating absent days (via attendance_days) in batch record"""
        assert self.batch_id is not None, "Batch not created"
        
        headers = self.get_headers()
        
        # Get batch records
        response = requests.get(f"{BASE_URL}/api/hr/payroll/batch/{self.batch_id}", headers=headers)
        assert response.status_code == 200, f"Get batch failed: {response.text}"
        
        batch_data = response.json()
        records = batch_data.get("records", [])
        
        if len(records) > 0:
            record = records[0]
            record_id = record.get("id")
            working_days = record.get("working_days_in_month", 22)
            
            # Update attendance_days (which is working_days - absent_days)
            # Setting attendance_days = 20 means absent_days = working_days - 20
            new_attendance_days = working_days - 2  # 2 absent days
            
            update_response = requests.put(
                f"{BASE_URL}/api/hr/payroll/batch/{self.batch_id}/record/{record_id}",
                headers=headers,
                json={"attendance_days": new_attendance_days}
            )
            
            print(f"Update record response: {update_response.status_code}")
            if update_response.status_code != 200:
                print(f"Update response: {update_response.text}")
            
            assert update_response.status_code == 200, f"Update record failed: {update_response.text}"
            
            updated_record = update_response.json()
            assert updated_record.get("attendance_days") == new_attendance_days
            
            # Verify attendance deduction was recalculated
            assert updated_record.get("attendance_deduction") > 0, "Attendance deduction should be > 0 for 2 absent days"
            
            print(f"Updated record: attendance_days={updated_record.get('attendance_days')}, attendance_deduction={updated_record.get('attendance_deduction')}")
    
    def test_08_validate_absent_days_cannot_exceed_working_days(self):
        """Test validation: absent_days <= working_days"""
        assert self.batch_id is not None, "Batch not created"
        
        headers = self.get_headers()
        
        # Get batch records
        response = requests.get(f"{BASE_URL}/api/hr/payroll/batch/{self.batch_id}", headers=headers)
        batch_data = response.json()
        records = batch_data.get("records", [])
        
        if len(records) > 0:
            record = records[0]
            record_id = record.get("id")
            working_days = record.get("working_days_in_month", 22)
            
            # Try to set attendance_days to negative (which means absent > working)
            invalid_attendance_days = -5  # This would mean absent_days > working_days
            
            update_response = requests.put(
                f"{BASE_URL}/api/hr/payroll/batch/{self.batch_id}/record/{record_id}",
                headers=headers,
                json={"attendance_days": invalid_attendance_days}
            )
            
            # Should fail validation
            print(f"Invalid attendance_days response: {update_response.status_code}")
            assert update_response.status_code == 400, "Should reject negative attendance_days"
    
    def test_09_validate_absent_days_must_be_non_negative(self):
        """Test validation: absent_days >= 0"""
        assert self.batch_id is not None, "Batch not created"
        
        headers = self.get_headers()
        
        # Get batch records
        response = requests.get(f"{BASE_URL}/api/hr/payroll/batch/{self.batch_id}", headers=headers)
        batch_data = response.json()
        records = batch_data.get("records", [])
        
        if len(records) > 0:
            record = records[0]
            record_id = record.get("id")
            working_days = record.get("working_days_in_month", 22)
            
            # Try to set attendance_days > working_days (which means negative absent days)
            invalid_attendance_days = working_days + 5  # This would mean absent_days < 0
            
            update_response = requests.put(
                f"{BASE_URL}/api/hr/payroll/batch/{self.batch_id}/record/{record_id}",
                headers=headers,
                json={"attendance_days": invalid_attendance_days}
            )
            
            # Should fail validation
            print(f"attendance_days > working_days response: {update_response.status_code}")
            assert update_response.status_code == 400, "Should reject attendance_days > working_days"
    
    def test_10_cleanup_delete_batch(self):
        """Clean up: Delete the test batch"""
        if self.batch_id:
            headers = self.get_headers()
            response = requests.delete(f"{BASE_URL}/api/hr/payroll/batch/{self.batch_id}", headers=headers)
            print(f"Delete batch response: {response.status_code}")
            # Batch deletion might return 200 or 204
            assert response.status_code in [200, 204], f"Delete batch failed: {response.text}"
            print(f"Test batch {self.batch_id} deleted")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
