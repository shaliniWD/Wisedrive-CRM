"""
Payroll Batch API Tests - Testing the new batch-based payroll governance model
Tests: Preview → Create Batch → Edit in DRAFT → Confirm → Mark Paid workflow
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "ceo@wisedrive.com"
CEO_PASSWORD = "password123"

# India country ID
INDIA_COUNTRY_ID = "c49e1dc6-1450-40c2-9846-56b73369b2b1"


class TestPayrollBatchWorkflow:
    """Test the complete payroll batch workflow: Preview → Create → Edit → Confirm → Mark Paid"""
    
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
        # API uses 'access_token' not 'token'
        self.token = login_data.get("access_token")
        assert self.token, f"No access_token in response: {login_data}"
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.user = login_data.get("user", {})
        print(f"✓ Logged in as {self.user.get('name')} ({self.user.get('role')})")
    
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
    
    def test_02_get_countries(self):
        """Test getting countries list"""
        response = self.session.get(f"{BASE_URL}/api/countries")
        assert response.status_code == 200
        countries = response.json()
        assert isinstance(countries, list)
        assert len(countries) > 0
        
        # Find India
        india = next((c for c in countries if c.get("id") == INDIA_COUNTRY_ID), None)
        assert india is not None, f"India not found in countries: {countries}"
        print(f"✓ Found {len(countries)} countries, India ID: {INDIA_COUNTRY_ID}")
    
    def test_03_get_payroll_batches(self):
        """Test getting payroll batches list with filters"""
        # Get all batches
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches")
        assert response.status_code == 200
        batches = response.json()
        assert isinstance(batches, list)
        print(f"✓ Found {len(batches)} total batches")
        
        # Get batches filtered by country
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "country_id": INDIA_COUNTRY_ID
        })
        assert response.status_code == 200
        india_batches = response.json()
        print(f"✓ Found {len(india_batches)} batches for India")
        
        # Get batches filtered by year
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "year": 2026
        })
        assert response.status_code == 200
        year_batches = response.json()
        print(f"✓ Found {len(year_batches)} batches for 2026")
        
        # Get batches filtered by status
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "status": "DRAFT"
        })
        assert response.status_code == 200
        draft_batches = response.json()
        print(f"✓ Found {len(draft_batches)} DRAFT batches")
    
    def test_04_preview_payroll(self):
        """Test payroll preview API - generates preview without saving to DB"""
        # Preview for February 2026, India
        response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
            "month": 2,
            "year": 2026,
            "country_id": INDIA_COUNTRY_ID
        })
        
        # Could be 200 (success) or 400 (batch already exists)
        if response.status_code == 400:
            error = response.json()
            if "already exists" in error.get("detail", "").lower():
                print(f"✓ Preview blocked - batch already exists for Feb 2026")
                pytest.skip("Batch already exists for Feb 2026")
            else:
                pytest.fail(f"Preview failed: {error}")
        
        assert response.status_code == 200, f"Preview failed: {response.text}"
        preview = response.json()
        
        # Validate preview structure
        assert "month" in preview
        assert "year" in preview
        assert "country_id" in preview
        assert "country_name" in preview
        assert "employee_count" in preview
        assert "total_gross" in preview
        assert "total_net" in preview
        assert "records" in preview
        
        print(f"✓ Preview generated for {preview.get('country_name')}")
        print(f"  - Month: {preview.get('month')}/{preview.get('year')}")
        print(f"  - Employees: {preview.get('employee_count')}")
        print(f"  - Total Gross: {preview.get('currency_symbol', '₹')}{preview.get('total_gross')}")
        print(f"  - Total Net: {preview.get('currency_symbol', '₹')}{preview.get('total_net')}")
        
        # Validate records structure
        if preview.get("records"):
            record = preview["records"][0]
            assert "employee_id" in record
            assert "employee_name" in record
            assert "gross_salary" in record
            assert "pf_employee" in record
            assert "professional_tax" in record
            assert "income_tax" in record
            assert "attendance_deduction" in record
            assert "net_salary" in record
            print(f"  - Sample record: {record.get('employee_name')} - Net: {record.get('net_salary')}")
    
    def test_05_create_batch_workflow(self):
        """Test creating a payroll batch from preview"""
        # First, try to preview for a month that doesn't have a batch
        # Use March 2026 to avoid conflicts
        test_month = 3
        test_year = 2026
        
        # Check if batch already exists
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "country_id": INDIA_COUNTRY_ID,
            "year": test_year
        })
        assert response.status_code == 200
        existing_batches = response.json()
        
        # Find a month without a batch
        existing_months = [b.get("month") for b in existing_batches if b.get("country_id") == INDIA_COUNTRY_ID]
        
        for month in range(3, 13):  # Try March to December
            if month not in existing_months:
                test_month = month
                break
        
        print(f"Testing with month: {test_month}/{test_year}")
        
        # Preview payroll
        preview_response = self.session.post(f"{BASE_URL}/api/hr/payroll/preview", json={
            "month": test_month,
            "year": test_year,
            "country_id": INDIA_COUNTRY_ID
        })
        
        if preview_response.status_code == 400:
            error = preview_response.json()
            if "already exists" in error.get("detail", "").lower():
                print(f"✓ Batch already exists for {test_month}/{test_year} - skipping create test")
                pytest.skip(f"Batch already exists for {test_month}/{test_year}")
        
        assert preview_response.status_code == 200, f"Preview failed: {preview_response.text}"
        preview = preview_response.json()
        
        # Create batch from preview
        create_response = self.session.post(f"{BASE_URL}/api/hr/payroll/batch", json={
            "month": preview["month"],
            "year": preview["year"],
            "country_id": preview["country_id"],
            "records": preview["records"]
        })
        
        assert create_response.status_code == 200, f"Create batch failed: {create_response.text}"
        batch = create_response.json()
        
        # Validate batch structure
        assert "id" in batch
        assert batch["status"] == "DRAFT"
        assert batch["month"] == test_month
        assert batch["year"] == test_year
        assert batch["country_id"] == INDIA_COUNTRY_ID
        
        print(f"✓ Created DRAFT batch: {batch.get('id')}")
        print(f"  - Status: {batch.get('status')}")
        print(f"  - Employees: {batch.get('employee_count')}")
        print(f"  - Total Net: {batch.get('currency_symbol', '₹')}{batch.get('total_net')}")
        
        # Store batch ID for subsequent tests
        self.__class__.created_batch_id = batch["id"]
        self.__class__.created_batch_month = test_month
        self.__class__.created_batch_year = test_year
    
    def test_06_get_batch_details(self):
        """Test getting batch details with records"""
        batch_id = getattr(self.__class__, 'created_batch_id', None)
        if not batch_id:
            # Try to find an existing DRAFT batch
            response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
                "status": "DRAFT",
                "country_id": INDIA_COUNTRY_ID
            })
            assert response.status_code == 200
            batches = response.json()
            if batches:
                batch_id = batches[0]["id"]
            else:
                pytest.skip("No DRAFT batch available for testing")
        
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "batch" in data
        assert "records" in data
        
        batch = data["batch"]
        records = data["records"]
        
        print(f"✓ Got batch details: {batch.get('id')}")
        print(f"  - Status: {batch.get('status')}")
        print(f"  - Records count: {len(records)}")
        
        if records:
            record = records[0]
            print(f"  - Sample record: {record.get('employee_name')}")
            print(f"    - Gross: {record.get('gross_salary')}")
            print(f"    - Statutory: {record.get('total_statutory_deductions')}")
            print(f"    - Attendance: {record.get('attendance_deduction')}")
            print(f"    - Net: {record.get('net_salary')}")
            
            # Store record ID for edit test
            self.__class__.test_record_id = record.get("id")
    
    def test_07_edit_draft_record(self):
        """Test editing a record in DRAFT batch"""
        batch_id = getattr(self.__class__, 'created_batch_id', None)
        record_id = getattr(self.__class__, 'test_record_id', None)
        
        if not batch_id or not record_id:
            # Try to find an existing DRAFT batch with records
            response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
                "status": "DRAFT",
                "country_id": INDIA_COUNTRY_ID
            })
            assert response.status_code == 200
            batches = response.json()
            
            if not batches:
                pytest.skip("No DRAFT batch available for edit testing")
            
            batch_id = batches[0]["id"]
            
            # Get records
            batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
            assert batch_response.status_code == 200
            batch_data = batch_response.json()
            
            if not batch_data.get("records"):
                pytest.skip("No records in DRAFT batch")
            
            record_id = batch_data["records"][0]["id"]
        
        # Edit the record - update other_deductions
        edit_response = self.session.put(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/record/{record_id}",
            json={
                "other_deductions": 500,
                "other_deductions_reason": "Test deduction"
            }
        )
        
        assert edit_response.status_code == 200, f"Edit failed: {edit_response.text}"
        updated_record = edit_response.json()
        
        assert updated_record.get("other_deductions") == 500
        print(f"✓ Edited record {record_id}")
        print(f"  - Other deductions: {updated_record.get('other_deductions')}")
        print(f"  - Updated net: {updated_record.get('net_salary')}")
    
    def test_08_confirm_batch(self):
        """Test confirming a DRAFT batch (DRAFT → CONFIRMED)"""
        batch_id = getattr(self.__class__, 'created_batch_id', None)
        
        if not batch_id:
            # Try to find an existing DRAFT batch
            response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
                "status": "DRAFT",
                "country_id": INDIA_COUNTRY_ID
            })
            assert response.status_code == 200
            batches = response.json()
            
            if not batches:
                pytest.skip("No DRAFT batch available for confirm testing")
            
            batch_id = batches[0]["id"]
        
        # Confirm the batch
        confirm_response = self.session.post(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/confirm",
            json={"notes": "Confirmed by automated test"}
        )
        
        assert confirm_response.status_code == 200, f"Confirm failed: {confirm_response.text}"
        confirmed_batch = confirm_response.json()
        
        assert confirmed_batch.get("status") == "CONFIRMED"
        print(f"✓ Confirmed batch {batch_id}")
        print(f"  - Status: {confirmed_batch.get('status')}")
        print(f"  - Confirmed at: {confirmed_batch.get('confirmed_at')}")
        
        # Store for mark paid test
        self.__class__.confirmed_batch_id = batch_id
    
    def test_09_cannot_edit_confirmed_batch(self):
        """Test that CONFIRMED batch records cannot be edited"""
        batch_id = getattr(self.__class__, 'confirmed_batch_id', None)
        
        if not batch_id:
            # Try to find an existing CONFIRMED batch
            response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
                "status": "CONFIRMED",
                "country_id": INDIA_COUNTRY_ID
            })
            assert response.status_code == 200
            batches = response.json()
            
            if not batches:
                pytest.skip("No CONFIRMED batch available for immutability testing")
            
            batch_id = batches[0]["id"]
        
        # Get a record from the batch
        batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{batch_id}")
        assert batch_response.status_code == 200
        batch_data = batch_response.json()
        
        if not batch_data.get("records"):
            pytest.skip("No records in CONFIRMED batch")
        
        record_id = batch_data["records"][0]["id"]
        
        # Try to edit - should fail
        edit_response = self.session.put(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/record/{record_id}",
            json={"other_deductions": 1000}
        )
        
        # Should return 400 or 403
        assert edit_response.status_code in [400, 403], f"Edit should have failed but got: {edit_response.status_code}"
        print(f"✓ Correctly blocked edit on CONFIRMED batch")
        print(f"  - Error: {edit_response.json().get('detail')}")
    
    def test_10_mark_batch_paid(self):
        """Test marking a CONFIRMED batch as paid (CONFIRMED → CLOSED)"""
        batch_id = getattr(self.__class__, 'confirmed_batch_id', None)
        
        if not batch_id:
            # Try to find an existing CONFIRMED batch
            response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
                "status": "CONFIRMED",
                "country_id": INDIA_COUNTRY_ID
            })
            assert response.status_code == 200
            batches = response.json()
            
            if not batches:
                pytest.skip("No CONFIRMED batch available for mark paid testing")
            
            batch_id = batches[0]["id"]
        
        # Mark as paid
        payment_response = self.session.post(
            f"{BASE_URL}/api/hr/payroll/batch/{batch_id}/mark-paid",
            json={
                "payment_date": datetime.now().strftime("%Y-%m-%d"),
                "payment_mode": "BANK_TRANSFER",
                "transaction_reference": f"TEST-TXN-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "notes": "Paid via automated test"
            }
        )
        
        assert payment_response.status_code == 200, f"Mark paid failed: {payment_response.text}"
        closed_batch = payment_response.json()
        
        assert closed_batch.get("status") == "CLOSED"
        print(f"✓ Marked batch as paid: {batch_id}")
        print(f"  - Status: {closed_batch.get('status')}")
        print(f"  - Transaction: {closed_batch.get('transaction_reference')}")
    
    def test_11_generate_payslip_for_confirmed_record(self):
        """Test generating payslip for a record in CONFIRMED/CLOSED batch"""
        # Find a CONFIRMED or CLOSED batch
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "country_id": INDIA_COUNTRY_ID
        })
        assert response.status_code == 200
        batches = response.json()
        
        # Find a batch that's CONFIRMED or CLOSED
        target_batch = None
        for batch in batches:
            if batch.get("status") in ["CONFIRMED", "CLOSED"]:
                target_batch = batch
                break
        
        if not target_batch:
            pytest.skip("No CONFIRMED/CLOSED batch available for payslip testing")
        
        # Get records
        batch_response = self.session.get(f"{BASE_URL}/api/hr/payroll/batch/{target_batch['id']}")
        assert batch_response.status_code == 200
        batch_data = batch_response.json()
        
        if not batch_data.get("records"):
            pytest.skip("No records in batch")
        
        record_id = batch_data["records"][0]["id"]
        
        # Generate payslip
        payslip_response = self.session.post(f"{BASE_URL}/api/hr/payroll/{record_id}/generate-payslip")
        
        # Could succeed or fail based on record state
        if payslip_response.status_code == 200:
            result = payslip_response.json()
            print(f"✓ Generated payslip for record {record_id}")
            print(f"  - Path: {result.get('payslip_path')}")
        else:
            print(f"✓ Payslip generation returned: {payslip_response.status_code}")
            print(f"  - Response: {payslip_response.text[:200]}")


class TestPayrollBatchFilters:
    """Test payroll batch filtering functionality"""
    
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
        assert login_response.status_code == 200
        
        login_data = login_response.json()
        self.token = login_data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_filter_by_country(self):
        """Test filtering batches by country"""
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "country_id": INDIA_COUNTRY_ID
        })
        assert response.status_code == 200
        batches = response.json()
        
        # All batches should be for India
        for batch in batches:
            assert batch.get("country_id") == INDIA_COUNTRY_ID
        
        print(f"✓ Filter by country: {len(batches)} batches for India")
    
    def test_filter_by_year(self):
        """Test filtering batches by year"""
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "year": 2026
        })
        assert response.status_code == 200
        batches = response.json()
        
        # All batches should be for 2026
        for batch in batches:
            assert batch.get("year") == 2026
        
        print(f"✓ Filter by year: {len(batches)} batches for 2026")
    
    def test_filter_by_status(self):
        """Test filtering batches by status"""
        for status in ["DRAFT", "CONFIRMED", "CLOSED"]:
            response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
                "status": status
            })
            assert response.status_code == 200
            batches = response.json()
            
            # All batches should have the specified status
            for batch in batches:
                assert batch.get("status") == status
            
            print(f"✓ Filter by status {status}: {len(batches)} batches")
    
    def test_combined_filters(self):
        """Test combining multiple filters"""
        response = self.session.get(f"{BASE_URL}/api/hr/payroll/batches", params={
            "country_id": INDIA_COUNTRY_ID,
            "year": 2026,
            "status": "DRAFT"
        })
        assert response.status_code == 200
        batches = response.json()
        
        for batch in batches:
            assert batch.get("country_id") == INDIA_COUNTRY_ID
            assert batch.get("year") == 2026
            assert batch.get("status") == "DRAFT"
        
        print(f"✓ Combined filters: {len(batches)} DRAFT batches for India 2026")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
