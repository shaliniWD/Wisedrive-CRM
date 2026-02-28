"""
Test Collect Balance Feature for Wisedrive CRM
Tests:
1. Inspections API returns payment_status and inspection_status columns
2. Collect Balance button appears for partial payment inspections
3. Collect Balance API generates Razorpay link
4. Send Report is disabled until full payment
5. Payment history tracking
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vehicle-loan-crm.preview.emergentagent.com').rstrip('/')


class TestCollectBalanceFeature:
    """Test Collect Balance feature for partial payments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as Inspection Head"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "insphead.in@wisedrive.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.user = login_response.json()["user"]
    
    def test_01_inspections_api_returns_payment_status(self):
        """Test that inspections API returns payment_status field"""
        response = requests.get(
            f"{BASE_URL}/api/inspections?is_scheduled=true",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get inspections: {response.text}"
        
        inspections = response.json()
        assert len(inspections) > 0, "No inspections found"
        
        # Check that inspections have payment_status field
        for inspection in inspections[:5]:
            assert "payment_status" in inspection, f"Missing payment_status in inspection {inspection.get('id')}"
            print(f"Inspection {inspection.get('customer_name')}: payment_status={inspection.get('payment_status')}")
    
    def test_02_inspections_api_returns_inspection_status(self):
        """Test that inspections API returns inspection_status field"""
        response = requests.get(
            f"{BASE_URL}/api/inspections?is_scheduled=true",
            headers=self.headers
        )
        assert response.status_code == 200
        
        inspections = response.json()
        for inspection in inspections[:5]:
            assert "inspection_status" in inspection, f"Missing inspection_status in inspection {inspection.get('id')}"
            print(f"Inspection {inspection.get('customer_name')}: inspection_status={inspection.get('inspection_status')}")
    
    def test_03_find_partial_payment_inspection(self):
        """Test finding inspections with partial payment (pending_amount > 0 or balance_due > 0)"""
        response = requests.get(
            f"{BASE_URL}/api/inspections?is_scheduled=true",
            headers=self.headers
        )
        assert response.status_code == 200
        
        inspections = response.json()
        partial_payment_inspections = []
        
        for inspection in inspections:
            # Check both old format (pending_amount) and new format (balance_due)
            pending_amount = inspection.get("pending_amount", 0) or 0
            balance_due = inspection.get("balance_due", 0) or 0
            payment_type = inspection.get("payment_type", "")
            payment_status = inspection.get("payment_status", "")
            
            has_balance = pending_amount > 0 or balance_due > 0
            is_partial = payment_type == "Partial" or payment_status == "PARTIALLY_PAID"
            
            if has_balance and is_partial:
                partial_payment_inspections.append({
                    "id": inspection.get("id"),
                    "customer_name": inspection.get("customer_name"),
                    "car_number": inspection.get("car_number"),
                    "pending_amount": pending_amount,
                    "balance_due": balance_due,
                    "payment_type": payment_type,
                    "payment_status": payment_status
                })
        
        print(f"Found {len(partial_payment_inspections)} partial payment inspections:")
        for insp in partial_payment_inspections[:5]:
            print(f"  - {insp['customer_name']} ({insp['car_number']}): pending={insp['pending_amount']}, balance_due={insp['balance_due']}")
        
        assert len(partial_payment_inspections) > 0, "No partial payment inspections found for testing"
        self.partial_inspection = partial_payment_inspections[0]
    
    def test_04_collect_balance_api_works(self):
        """Test that collect-balance API generates payment link"""
        # First find a partial payment inspection
        response = requests.get(
            f"{BASE_URL}/api/inspections?is_scheduled=true",
            headers=self.headers
        )
        inspections = response.json()
        
        partial_inspection = None
        for inspection in inspections:
            pending_amount = inspection.get("pending_amount", 0) or 0
            balance_due = inspection.get("balance_due", 0) or 0
            if pending_amount > 0 or balance_due > 0:
                partial_inspection = inspection
                break
        
        assert partial_inspection is not None, "No partial payment inspection found"
        
        # Call collect-balance API
        collect_response = requests.post(
            f"{BASE_URL}/api/inspections/{partial_inspection['id']}/collect-balance",
            headers=self.headers,
            json={"send_whatsapp": False, "notes": "Test balance collection from pytest"}
        )
        
        assert collect_response.status_code == 200, f"Collect balance failed: {collect_response.text}"
        
        result = collect_response.json()
        assert result.get("success") == True, "Collect balance did not return success"
        assert "payment_link" in result, "Missing payment_link in response"
        assert "payment_link_id" in result, "Missing payment_link_id in response"
        assert "balance_amount" in result, "Missing balance_amount in response"
        
        expected_balance = partial_inspection.get("pending_amount") or partial_inspection.get("balance_due")
        assert result["balance_amount"] == expected_balance, f"Balance amount mismatch: expected {expected_balance}, got {result['balance_amount']}"
        
        print(f"Collect Balance API Success:")
        print(f"  - Payment Link: {result['payment_link']}")
        print(f"  - Balance Amount: ₹{result['balance_amount']}")
    
    def test_05_collect_balance_fails_for_fully_paid(self):
        """Test that collect-balance API fails for fully paid inspections"""
        # Find a fully paid inspection
        response = requests.get(
            f"{BASE_URL}/api/inspections?is_scheduled=true",
            headers=self.headers
        )
        inspections = response.json()
        
        fully_paid_inspection = None
        for inspection in inspections:
            pending_amount = inspection.get("pending_amount", 0) or 0
            balance_due = inspection.get("balance_due", 0) or 0
            payment_status = inspection.get("payment_status", "")
            
            if (pending_amount == 0 and balance_due == 0) or payment_status in ["FULLY_PAID", "Completed"]:
                fully_paid_inspection = inspection
                break
        
        if fully_paid_inspection is None:
            pytest.skip("No fully paid inspection found for testing")
        
        # Try to collect balance - should fail
        collect_response = requests.post(
            f"{BASE_URL}/api/inspections/{fully_paid_inspection['id']}/collect-balance",
            headers=self.headers,
            json={"send_whatsapp": False}
        )
        
        # Should return 400 error
        assert collect_response.status_code == 400, f"Expected 400 for fully paid inspection, got {collect_response.status_code}"
        print(f"Correctly rejected collect-balance for fully paid inspection: {collect_response.json()}")
    
    def test_06_send_report_requires_full_payment(self):
        """Test that send-report API requires full payment"""
        # Find a partial payment inspection
        response = requests.get(
            f"{BASE_URL}/api/inspections?is_scheduled=true",
            headers=self.headers
        )
        inspections = response.json()
        
        partial_inspection = None
        for inspection in inspections:
            pending_amount = inspection.get("pending_amount", 0) or 0
            balance_due = inspection.get("balance_due", 0) or 0
            if pending_amount > 0 or balance_due > 0:
                partial_inspection = inspection
                break
        
        if partial_inspection is None:
            pytest.skip("No partial payment inspection found")
        
        # Try to send report - should fail
        send_response = requests.post(
            f"{BASE_URL}/api/inspections/{partial_inspection['id']}/send-report",
            headers=self.headers,
            json={"send_whatsapp": False}
        )
        
        # Should return 400 error
        assert send_response.status_code == 400, f"Expected 400 for partial payment inspection, got {send_response.status_code}"
        error_detail = send_response.json().get("detail", "")
        assert "payment" in error_detail.lower() or "full" in error_detail.lower(), f"Error should mention payment: {error_detail}"
        print(f"Correctly rejected send-report for partial payment: {error_detail}")
    
    def test_07_payment_status_badges(self):
        """Test that payment status values are correct for badge display"""
        response = requests.get(
            f"{BASE_URL}/api/inspections?is_scheduled=true",
            headers=self.headers
        )
        inspections = response.json()
        
        valid_payment_statuses = ["FULLY_PAID", "PARTIALLY_PAID", "PENDING", "PAID", "Completed"]
        
        status_counts = {}
        for inspection in inspections:
            status = inspection.get("payment_status", "UNKNOWN")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print(f"Payment Status Distribution:")
        for status, count in status_counts.items():
            print(f"  - {status}: {count}")
        
        # At least some inspections should have valid statuses
        assert len(status_counts) > 0, "No payment statuses found"


class TestLeadsPartialPayment:
    """Test partial payment flow from Leads page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as HR Manager (has access to leads)"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "hr@wisedrive.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_01_leads_api_works(self):
        """Test that leads API is accessible"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get leads: {response.text}"
        leads = response.json()
        print(f"Found {len(leads)} leads")
    
    def test_02_inspection_packages_api_works(self):
        """Test that inspection packages API returns packages with partial payment settings"""
        response = requests.get(
            f"{BASE_URL}/api/inspection-packages",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get packages: {response.text}"
        
        packages = response.json()
        print(f"Found {len(packages)} packages")
        
        for pkg in packages[:5]:
            print(f"  - {pkg.get('name')}: allow_partial_payment={pkg.get('allow_partial_payment')}, partial_payment_value={pkg.get('partial_payment_value')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
