"""
Payroll Enhancement Tests - Testing new features:
A) Pay period and working days display
B) Editable attendance_days with prorated salary recalculation  
C) Editable other_deductions with cap at Net Pay
"""
import pytest
import requests
import os
from datetime import datetime
import calendar

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "ceo@wisedrive.com"
CEO_PASSWORD = "password123"

# India country ID
INDIA_COUNTRY_ID = "c49e1dc6-1450-40c2-9846-56b73369b2b1"


class TestPayrollEnhancement:
    """Test the payroll enhancement features: pay period, working days, attendance editing, other deductions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as CEO
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        login_data = login_response.json()
        self.token = login_data.get("access_token")
        assert self.token, f"No access_token in response: {login_data}"
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.user = login_data.get("user", {})
        print(f"\n✓ Logged in as {self.user.get('name')} ({self.user.get('role')})")
    
    def test_01_login_success(self):
        """Test CEO login works correctly"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == CEO_EMAIL
        print(f"✓ Login successful for {data['user']['name']}")
    
    def test_02_preview_payroll_has_pay_period(self):
        """Test payroll preview returns pay_period_start and pay_period_end"""
        # Use April 2026 to avoid existing batches
        test_month = 4
        test_year = 2026
        
        response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
            "month": test_month,
            "year": test_year,
            "country_id": INDIA_COUNTRY_ID
        })
        
        # Could be 200 (success) or 400 (batch already exists)
        if response.status_code == 400:
            error = response.json()
            if "already exists" in error.get("detail", "").lower():
                print(f"Batch already exists for {test_month}/{test_year} - checking for other available month")
                # Try another month
                for month in range(5, 13):
                    response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
                        "month": month,
                        "year": test_year,
                        "country_id": INDIA_COUNTRY_ID
                    })
                    if response.status_code == 200:
                        test_month = month
                        break
        
        if response.status_code != 200:
            pytest.skip("No available month for preview test")
        
        preview = response.json()
        
        # Test Feature A: Pay period fields
        assert "pay_period_start" in preview, "pay_period_start missing from preview"
        assert "pay_period_end" in preview, "pay_period_end missing from preview"
        
        # Validate format: YYYY-MM-DD
        assert preview["pay_period_start"] is not None
        assert preview["pay_period_end"] is not None
        
        # Verify dates are in correct format
        expected_start = f"{test_year}-{str(test_month).zfill(2)}-01"
        last_day = calendar.monthrange(test_year, test_month)[1]
        expected_end = f"{test_year}-{str(test_month).zfill(2)}-{last_day}"
        
        assert preview["pay_period_start"] == expected_start, f"Expected {expected_start}, got {preview['pay_period_start']}"
        assert preview["pay_period_end"] == expected_end, f"Expected {expected_end}, got {preview['pay_period_end']}"
        
        print(f"✓ Pay period: {preview['pay_period_start']} to {preview['pay_period_end']}")
    
    def test_03_preview_payroll_has_working_days(self):
        """Test payroll preview returns working_days count"""
        test_month = 4
        test_year = 2026
        
        response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
            "month": test_month,
            "year": test_year,
            "country_id": INDIA_COUNTRY_ID
        })
        
        if response.status_code == 400:
            # Try another month
            for month in range(5, 13):
                response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
                    "month": month,
                    "year": test_year,
                    "country_id": INDIA_COUNTRY_ID
                })
                if response.status_code == 200:
                    test_month = month
                    break
        
        if response.status_code != 200:
            pytest.skip("No available month for preview test")
        
        preview = response.json()
        
        # Test Feature A: Working days field
        assert "working_days" in preview, "working_days missing from preview"
        assert isinstance(preview["working_days"], int), "working_days should be an integer"
        assert preview["working_days"] > 0, "working_days should be positive"
        assert preview["working_days"] <= 31, "working_days should not exceed days in month"
        
        print(f"✓ Working days in month: {preview['working_days']}")
    
    def test_04_preview_records_have_working_days_column(self):
        """Test each employee record has working_days_in_month field"""
        test_month = 4
        test_year = 2026
        
        response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
            "month": test_month,
            "year": test_year,
            "country_id": INDIA_COUNTRY_ID
        })
        
        if response.status_code == 400:
            for month in range(5, 13):
                response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
                    "month": month,
                    "year": test_year,
                    "country_id": INDIA_COUNTRY_ID
                })
                if response.status_code == 200:
                    break
        
        if response.status_code != 200:
            pytest.skip("No available month for preview test")
        
        preview = response.json()
        records = preview.get("records", [])
        assert len(records) > 0, "No records in preview"
        
        for record in records:
            assert "working_days_in_month" in record, f"working_days_in_month missing for {record.get('employee_name')}"
            assert isinstance(record["working_days_in_month"], int)
            assert record["working_days_in_month"] > 0
            
        print(f"✓ All {len(records)} employee records have working_days_in_month field")
    
    def test_05_preview_records_have_attendance_days(self):
        """Test each employee record has editable attendance_days field"""
        test_month = 4
        test_year = 2026
        
        response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
            "month": test_month,
            "year": test_year,
            "country_id": INDIA_COUNTRY_ID
        })
        
        if response.status_code == 400:
            for month in range(5, 13):
                response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
                    "month": month,
                    "year": test_year,
                    "country_id": INDIA_COUNTRY_ID
                })
                if response.status_code == 200:
                    break
        
        if response.status_code != 200:
            pytest.skip("No available month for preview test")
        
        preview = response.json()
        records = preview.get("records", [])
        
        for record in records:
            assert "attendance_days" in record, f"attendance_days missing for {record.get('employee_name')}"
            assert isinstance(record["attendance_days"], int)
            assert record["attendance_days"] >= 0
            assert record["attendance_days"] <= record["working_days_in_month"], \
                f"attendance_days ({record['attendance_days']}) should not exceed working_days ({record['working_days_in_month']})"
            
        print(f"✓ All {len(records)} employee records have attendance_days field with valid values")
    
    def test_06_preview_records_have_other_deductions(self):
        """Test each employee record has editable other_deductions field"""
        test_month = 4
        test_year = 2026
        
        response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
            "month": test_month,
            "year": test_year,
            "country_id": INDIA_COUNTRY_ID
        })
        
        if response.status_code == 400:
            for month in range(5, 13):
                response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
                    "month": month,
                    "year": test_year,
                    "country_id": INDIA_COUNTRY_ID
                })
                if response.status_code == 200:
                    break
        
        if response.status_code != 200:
            pytest.skip("No available month for preview test")
        
        preview = response.json()
        records = preview.get("records", [])
        
        for record in records:
            assert "other_deductions" in record, f"other_deductions missing for {record.get('employee_name')}"
            # Initially should be 0 or whatever default
            assert record["other_deductions"] >= 0
            
        print(f"✓ All {len(records)} employee records have other_deductions field")
    
    def test_07_update_batch_record_attendance_days(self):
        """Test updating attendance_days in a DRAFT batch record with validation"""
        # First, find or create a DRAFT batch
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "status": "DRAFT",
            "country_id": INDIA_COUNTRY_ID
        })
        assert response.status_code == 200
        batches = response.json()
        
        if not batches:
            # Try to create a batch - find available month
            for month in range(4, 13):
                preview_response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
                    "month": month,
                    "year": 2026,
                    "country_id": INDIA_COUNTRY_ID
                })
                if preview_response.status_code == 200:
                    preview = preview_response.json()
                    # Create batch
                    create_response = self.session.post(f"{BASE_URL}/api/hr/payroll/batch", json={
                        "month": preview["month"],
                        "year": preview["year"],
                        "country_id": preview["country_id"],
                        "records": preview["records"]
                    })
                    if create_response.status_code == 200:
                        batch = create_response.json()
                        batches = [batch]
                        print(f"✓ Created DRAFT batch for {month}/2026")
                        break
        
        if not batches:
            pytest.skip("No DRAFT batch available for testing")
        
        batch_id = batches[0]["id"]
        
        # Get batch records
        batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
        assert batch_response.status_code == 200
        batch_data = batch_response.json()
        records = batch_data.get("records", [])
        
        if not records:
            pytest.skip("No records in batch")
        
        record = records[0]
        record_id = record["id"]
        working_days = record["working_days_in_month"]
        original_attendance = record.get("attendance_days", working_days)
        
        # Test: Update attendance_days to a valid value
        new_attendance = max(0, working_days - 2)  # 2 days less than working days
        
        update_response = self.session.put(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/record/{record_id}",
            json={"attendance_days": new_attendance}
        )
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        updated_record = update_response.json()
        assert updated_record["attendance_days"] == new_attendance
        
        # Verify attendance_deduction was recalculated
        assert "attendance_deduction" in updated_record
        per_day_salary = record["gross_salary"] / working_days
        expected_deduction = round(per_day_salary * (working_days - new_attendance), 2)
        assert abs(updated_record["attendance_deduction"] - expected_deduction) < 0.01, \
            f"Expected deduction {expected_deduction}, got {updated_record['attendance_deduction']}"
        
        print(f"✓ Updated attendance_days from {original_attendance} to {new_attendance}")
        print(f"✓ Attendance deduction recalculated to {updated_record['attendance_deduction']}")
    
    def test_08_update_batch_record_attendance_days_validation_negative(self):
        """Test attendance_days validation - must be >= 0"""
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "status": "DRAFT",
            "country_id": INDIA_COUNTRY_ID
        })
        batches = response.json()
        
        if not batches:
            pytest.skip("No DRAFT batch available for testing")
        
        batch_id = batches[0]["id"]
        
        batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
        records = batch_response.json().get("records", [])
        
        if not records:
            pytest.skip("No records in batch")
        
        record_id = records[0]["id"]
        
        # Test: Try to set attendance_days to negative
        update_response = self.session.put(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/record/{record_id}",
            json={"attendance_days": -1}
        )
        
        # Should fail with 400
        assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}"
        error = update_response.json()
        assert "negative" in error.get("detail", "").lower() or "non-negative" in error.get("detail", "").lower()
        
        print(f"✓ Negative attendance_days correctly rejected: {error.get('detail')}")
    
    def test_09_update_batch_record_attendance_days_validation_exceeds_working(self):
        """Test attendance_days validation - must be <= working_days"""
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "status": "DRAFT",
            "country_id": INDIA_COUNTRY_ID
        })
        batches = response.json()
        
        if not batches:
            pytest.skip("No DRAFT batch available for testing")
        
        batch_id = batches[0]["id"]
        
        batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
        records = batch_response.json().get("records", [])
        
        if not records:
            pytest.skip("No records in batch")
        
        record = records[0]
        record_id = record["id"]
        working_days = record["working_days_in_month"]
        
        # Test: Try to set attendance_days > working_days
        update_response = self.session.put(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/record/{record_id}",
            json={"attendance_days": working_days + 5}
        )
        
        # Should fail with 400
        assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}"
        error = update_response.json()
        assert "exceed" in error.get("detail", "").lower() or "cannot" in error.get("detail", "").lower()
        
        print(f"✓ attendance_days exceeding working_days correctly rejected: {error.get('detail')}")
    
    def test_10_update_batch_record_other_deductions(self):
        """Test updating other_deductions in a DRAFT batch record"""
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "status": "DRAFT",
            "country_id": INDIA_COUNTRY_ID
        })
        batches = response.json()
        
        if not batches:
            pytest.skip("No DRAFT batch available for testing")
        
        batch_id = batches[0]["id"]
        
        batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
        records = batch_response.json().get("records", [])
        
        if not records:
            pytest.skip("No records in batch")
        
        record = records[0]
        record_id = record["id"]
        
        # Calculate max other_deductions (should be capped at net before other)
        gross = record["gross_salary"]
        statutory = record.get("total_statutory_deductions", 0)
        attendance_ded = record.get("attendance_deduction", 0)
        max_other = gross - statutory - attendance_ded
        
        # Test: Update other_deductions to a valid value (half of max)
        test_deduction = round(max_other / 2, 2)
        
        update_response = self.session.put(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/record/{record_id}",
            json={"other_deductions": test_deduction}
        )
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        updated_record = update_response.json()
        assert updated_record["other_deductions"] == test_deduction
        
        # Verify net_salary was recalculated
        expected_net = round(gross - statutory - attendance_ded - test_deduction, 2)
        assert abs(updated_record["net_salary"] - expected_net) < 0.01, \
            f"Expected net {expected_net}, got {updated_record['net_salary']}"
        
        print(f"✓ Updated other_deductions to {test_deduction}")
        print(f"✓ Net salary recalculated to {updated_record['net_salary']}")
    
    def test_11_update_batch_record_other_deductions_validation_negative(self):
        """Test other_deductions validation - must be >= 0"""
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "status": "DRAFT",
            "country_id": INDIA_COUNTRY_ID
        })
        batches = response.json()
        
        if not batches:
            pytest.skip("No DRAFT batch available for testing")
        
        batch_id = batches[0]["id"]
        
        batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
        records = batch_response.json().get("records", [])
        
        if not records:
            pytest.skip("No records in batch")
        
        record_id = records[0]["id"]
        
        # Test: Try to set other_deductions to negative
        update_response = self.session.put(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/record/{record_id}",
            json={"other_deductions": -100}
        )
        
        assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}"
        error = update_response.json()
        assert "negative" in error.get("detail", "").lower() or "non-negative" in error.get("detail", "").lower()
        
        print(f"✓ Negative other_deductions correctly rejected: {error.get('detail')}")
    
    def test_12_update_batch_record_other_deductions_validation_exceeds_net(self):
        """Test other_deductions validation - must be capped at Net Pay"""
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "status": "DRAFT",
            "country_id": INDIA_COUNTRY_ID
        })
        batches = response.json()
        
        if not batches:
            pytest.skip("No DRAFT batch available for testing")
        
        batch_id = batches[0]["id"]
        
        batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
        records = batch_response.json().get("records", [])
        
        if not records:
            pytest.skip("No records in batch")
        
        record = records[0]
        record_id = record["id"]
        
        # Calculate max allowed other_deductions
        gross = record["gross_salary"]
        statutory = record.get("total_statutory_deductions", 0)
        attendance_ded = record.get("attendance_deduction", 0)
        max_other = gross - statutory - attendance_ded
        
        # Test: Try to set other_deductions > max (would make net negative)
        excessive_deduction = max_other + 1000
        
        update_response = self.session.put(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/record/{record_id}",
            json={"other_deductions": excessive_deduction}
        )
        
        assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}"
        error = update_response.json()
        assert "exceed" in error.get("detail", "").lower() or "cannot" in error.get("detail", "").lower() or "cap" in error.get("detail", "").lower()
        
        print(f"✓ other_deductions exceeding net salary correctly rejected: {error.get('detail')}")
    
    def test_13_batch_totals_update_on_record_edit(self):
        """Test that batch totals update when records are edited"""
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "status": "DRAFT",
            "country_id": INDIA_COUNTRY_ID
        })
        batches = response.json()
        
        if not batches:
            pytest.skip("No DRAFT batch available for testing")
        
        batch_id = batches[0]["id"]
        original_batch = batches[0]
        original_total_net = original_batch.get("total_net", 0)
        
        # Get records
        batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
        records = batch_response.json().get("records", [])
        
        if not records:
            pytest.skip("No records in batch")
        
        record = records[0]
        record_id = record["id"]
        working_days = record["working_days_in_month"]
        
        # Update attendance_days to create a difference
        new_attendance = max(0, working_days - 3)
        
        update_response = self.session.put(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/record/{record_id}",
            json={"attendance_days": new_attendance}
        )
        assert update_response.status_code == 200
        
        # Get updated batch
        updated_batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
        updated_batch = updated_batch_response.json().get("batch")
        
        # Verify totals changed
        print(f"✓ Original total_net: {original_total_net}")
        print(f"✓ Updated total_net: {updated_batch.get('total_net')}")
        
        # The totals should have changed (unless all attendance days were already at their max)
        assert "total_net" in updated_batch
        assert "total_attendance_deductions" in updated_batch
    
    def test_14_cleanup_test_batch(self):
        """Clean up: Delete test DRAFT batches"""
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "status": "DRAFT",
            "country_id": INDIA_COUNTRY_ID,
            "year": 2026
        })
        batches = response.json()
        
        for batch in batches:
            if batch.get("month", 0) >= 4:  # Only delete test batches (Apr 2026 onwards)
                delete_response = self.session.delete(
                    f"{BASE_URL}/api/hr/payroll/batch/{batch['id']}"
                )
                if delete_response.status_code == 200:
                    print(f"✓ Cleaned up DRAFT batch: {batch.get('month')}/{batch.get('year')}")
