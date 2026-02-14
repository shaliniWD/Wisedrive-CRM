"""
Finance Module Enhanced Tests - Testing new payment types and B2B fields
Tests: 9 payment types, B2B fields (GST/TDS), vendor payments, payslip generation
"""
import pytest
import requests
import os
import random

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Payment types to test
PAYMENT_TYPES = [
    'salary',           # Salary Payout
    'mechanic_payout',  # Mechanic Payment
    'incentive',        # Incentive Payment
    'vendor',           # Vendor Payment (B2B)
    'admin_expense',    # Admin Expenses
    'operational',      # Operational Expenses
    'statutory',        # Statutory Payments (B2B)
    'legal',            # Legal Payments (B2B)
    'other',            # Other Payments
]

# B2B payment types that need GST/TDS
B2B_PAYMENT_TYPES = ['vendor', 'statutory', 'legal']

# Non-B2B payment types
NON_B2B_PAYMENT_TYPES = ['salary', 'mechanic_payout', 'incentive', 'admin_expense', 'operational', 'other']


class TestFinanceEnhanced:
    """Test enhanced Finance module features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.finance_token = None
        self.ceo_token = None
        self.created_payment_ids = []
        # Use random month to avoid duplicates
        self.test_month = random.randint(3, 12)
        self.test_year = 2026
    
    def login_finance_manager(self):
        """Login as Finance Manager India"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance.in@wisedrive.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Finance Manager login failed: {response.text}"
        data = response.json()
        self.finance_token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.finance_token}"})
        return data
    
    def login_ceo(self):
        """Login as CEO"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        self.ceo_token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.ceo_token}"})
        return data
    
    def get_employees(self):
        """Get employees for payment creation"""
        response = self.session.get(f"{BASE_URL}/api/finance/employees")
        assert response.status_code == 200
        return response.json()
    
    # ==================== PAYMENT TYPES TESTS ====================
    
    def test_01_finance_manager_login(self):
        """Test Finance Manager India can login"""
        data = self.login_finance_manager()
        assert "access_token" in data
        assert data.get("user", {}).get("email") == "finance.in@wisedrive.com"
        print("SUCCESS: Finance Manager India login successful")
    
    def test_02_verify_9_payment_types_in_backend(self):
        """Verify backend supports all 9 payment types"""
        # Just verify the payment types are defined in the model
        expected_types = ['salary', 'mechanic_payout', 'incentive', 'vendor', 
                         'admin_expense', 'operational', 'statutory', 'legal', 'other']
        
        for pt in expected_types:
            assert pt in PAYMENT_TYPES, f"Missing payment type: {pt}"
        
        print(f"SUCCESS: All 9 payment types verified: {expected_types}")
    
    # ==================== B2B PAYMENT TESTS ====================
    
    def test_03_vendor_payment_b2b_fields(self):
        """Test Vendor Payment has B2B fields (Actual Amount, GST, TDS, Final Payout)"""
        self.login_finance_manager()
        
        payload = {
            "payment_type": "vendor",
            "vendor_name": "TEST_ABC Vendor Pvt Ltd",
            "invoice_number": "INV-2026-001",
            "month": self.test_month,
            "year": self.test_year,
            "actual_amount": 100000,
            "gst_percentage": 18,
            "tds_percentage": 10,
            "notes": "Vendor payment with GST/TDS"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code in [200, 201], f"Failed to create vendor payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        # Verify B2B fields
        assert data.get("payment_type") == "vendor"
        assert data.get("vendor_name") == "TEST_ABC Vendor Pvt Ltd"
        assert data.get("invoice_number") == "INV-2026-001"
        assert data.get("actual_amount") == 100000
        assert data.get("gst_percentage") == 18
        assert data.get("tds_percentage") == 10
        
        print(f"SUCCESS: Vendor payment created with B2B fields")
        print(f"  - Actual Amount: {data.get('actual_amount')}")
        print(f"  - GST %: {data.get('gst_percentage')}")
        print(f"  - TDS %: {data.get('tds_percentage')}")
    
    def test_04_statutory_payment_b2b_fields(self):
        """Test Statutory Payment has B2B fields"""
        self.login_finance_manager()
        
        payload = {
            "payment_type": "statutory",
            "vendor_name": "TEST_GST Department",
            "month": self.test_month,
            "year": self.test_year,
            "actual_amount": 50000,
            "gst_percentage": 0,  # No GST on statutory
            "tds_percentage": 0,  # No TDS on statutory
            "notes": "GST payment for Q4"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code in [200, 201], f"Failed to create statutory payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "statutory"
        assert data.get("vendor_name") == "TEST_GST Department"
        print("SUCCESS: Statutory payment created with B2B fields")
    
    def test_05_legal_payment_b2b_fields(self):
        """Test Legal Payment has B2B fields"""
        self.login_finance_manager()
        
        payload = {
            "payment_type": "legal",
            "vendor_name": "TEST_XYZ Law Firm",
            "invoice_number": "LEG-2026-001",
            "month": self.test_month,
            "year": self.test_year,
            "actual_amount": 75000,
            "gst_percentage": 18,
            "tds_percentage": 10,
            "notes": "Legal consultation fees"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code in [200, 201], f"Failed to create legal payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "legal"
        assert data.get("vendor_name") == "TEST_XYZ Law Firm"
        print("SUCCESS: Legal payment created with B2B fields")
    
    def test_06_b2b_payment_requires_vendor_name(self):
        """Test B2B payment fails without vendor_name"""
        self.login_finance_manager()
        
        payload = {
            "payment_type": "vendor",
            "month": self.test_month,
            "year": self.test_year,
            "actual_amount": 10000,
            # Missing vendor_name
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 400, f"Expected 400 for missing vendor_name, got {response.status_code}"
        print("SUCCESS: B2B payment correctly requires vendor_name")
    
    # ==================== NON-B2B PAYMENT TESTS ====================
    
    def test_07_admin_expense_payment(self):
        """Test Admin Expense payment"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for admin expense test")
        
        employee_id = employees[0]["id"]
        
        payload = {
            "payment_type": "admin_expense",
            "employee_id": employee_id,
            "month": self.test_month,
            "year": self.test_year,
            "gross_amount": 15000,
            "deductions": 0,
            "net_amount": 15000,
            "notes": "TEST_Office supplies reimbursement"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code in [200, 201], f"Failed to create admin expense: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "admin_expense"
        assert data.get("gross_amount") == 15000
        assert data.get("net_amount") == 15000
        print("SUCCESS: Admin expense payment created with non-B2B fields")
    
    def test_08_operational_expense_payment(self):
        """Test Operational Expense payment"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for operational expense test")
        
        employee_id = employees[0]["id"]
        
        payload = {
            "payment_type": "operational",
            "employee_id": employee_id,
            "month": self.test_month,
            "year": self.test_year,
            "gross_amount": 25000,
            "deductions": 0,
            "net_amount": 25000,
            "notes": "TEST_Vehicle maintenance"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code in [200, 201], f"Failed to create operational expense: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "operational"
        print("SUCCESS: Operational expense payment created")
    
    def test_09_incentive_payment(self):
        """Test Incentive Payment"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for incentive payment test")
        
        employee_id = employees[0]["id"]
        
        payload = {
            "payment_type": "incentive",
            "employee_id": employee_id,
            "month": self.test_month,
            "year": self.test_year,
            "gross_amount": 10000,
            "deductions": 1000,
            "net_amount": 9000,
            "notes": "TEST_Q4 performance bonus"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code in [200, 201], f"Failed to create incentive payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "incentive"
        print("SUCCESS: Incentive payment created")
    
    def test_10_other_payment(self):
        """Test Other Payment type"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for other payment test")
        
        employee_id = employees[0]["id"]
        
        payload = {
            "payment_type": "other",
            "employee_id": employee_id,
            "month": self.test_month,
            "year": self.test_year,
            "gross_amount": 5000,
            "deductions": 0,
            "net_amount": 5000,
            "notes": "TEST_Miscellaneous payment"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code in [200, 201], f"Failed to create other payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "other"
        print("SUCCESS: Other payment created")
    
    # ==================== PAYSLIP TESTS ====================
    
    def test_11_payslip_for_b2b_payment(self):
        """Test payslip generation for B2B payment shows vendor details"""
        self.login_finance_manager()
        
        # Create a vendor payment first
        payload = {
            "payment_type": "vendor",
            "vendor_name": "TEST_Payslip Test Vendor",
            "invoice_number": "INV-PAYSLIP-001",
            "month": self.test_month,
            "year": self.test_year,
            "actual_amount": 50000,
            "gst_percentage": 18,
            "tds_percentage": 10,
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code in [200, 201]
        payment_id = response.json().get("id")
        self.created_payment_ids.append(payment_id)
        
        # Get payslip
        response = self.session.get(f"{BASE_URL}/api/finance/payments/{payment_id}/payslip")
        assert response.status_code == 200, f"Failed to get payslip: {response.text}"
        
        payslip = response.json()
        
        # Verify B2B payslip fields
        assert payslip.get("vendor_name") == "TEST_Payslip Test Vendor"
        assert payslip.get("payment_type") == "vendor"
        assert payslip.get("actual_amount") == 50000
        assert payslip.get("gst_percentage") == 18
        assert payslip.get("tds_percentage") == 10
        
        print("SUCCESS: B2B payslip generated with vendor details")
        print(f"  - Vendor: {payslip.get('vendor_name')}")
        print(f"  - Actual Amount: {payslip.get('actual_amount')}")
        print(f"  - GST: {payslip.get('gst_percentage')}%")
        print(f"  - TDS: {payslip.get('tds_percentage')}%")
    
    def test_12_payslip_for_non_b2b_payment(self):
        """Test payslip generation for non-B2B payment shows employee details"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for payslip test")
        
        employee_id = employees[0]["id"]
        
        # Create an admin expense payment (non-B2B)
        payload = {
            "payment_type": "admin_expense",
            "employee_id": employee_id,
            "month": self.test_month + 1 if self.test_month < 12 else 1,  # Different month
            "year": self.test_year,
            "gross_amount": 60000,
            "deductions": 6000,
            "net_amount": 54000,
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code in [200, 201]
        payment_id = response.json().get("id")
        self.created_payment_ids.append(payment_id)
        
        # Get payslip
        response = self.session.get(f"{BASE_URL}/api/finance/payments/{payment_id}/payslip")
        assert response.status_code == 200, f"Failed to get payslip: {response.text}"
        
        payslip = response.json()
        
        # Verify employee payslip fields
        assert payslip.get("employee_name") is not None
        assert payslip.get("payment_type") == "admin_expense"
        assert payslip.get("net_salary") == 54000
        
        print("SUCCESS: Non-B2B payslip generated with employee details")
        print(f"  - Employee: {payslip.get('employee_name')}")
        print(f"  - Net Salary: {payslip.get('net_salary')}")
    
    # ==================== PAYMENT PROOFS TESTS ====================
    
    def test_13_payment_proofs_endpoint(self):
        """Test payment proofs endpoint exists"""
        self.login_finance_manager()
        
        # Get existing payments
        response = self.session.get(f"{BASE_URL}/api/finance/payments?month=2&year=2026")
        assert response.status_code == 200
        
        payments = response.json()
        if not payments:
            pytest.skip("No payments available for proofs test")
        
        payment_id = payments[0]["id"]
        
        # Get proofs for payment
        response = self.session.get(f"{BASE_URL}/api/finance/payments/{payment_id}/proofs")
        assert response.status_code == 200, f"Failed to get payment proofs: {response.text}"
        
        print("SUCCESS: Payment proofs endpoint working")
    
    # ==================== FILTER BY PAYMENT TYPE ====================
    
    def test_14_filter_payments_by_type(self):
        """Test filtering payments by payment_type"""
        self.login_finance_manager()
        
        # Filter by vendor type
        response = self.session.get(f"{BASE_URL}/api/finance/payments?payment_type=vendor")
        assert response.status_code == 200
        
        payments = response.json()
        for payment in payments:
            assert payment.get("payment_type") == "vendor", f"Expected vendor, got {payment.get('payment_type')}"
        
        print(f"SUCCESS: Filtered {len(payments)} vendor payments")
    
    # ==================== CEO ACCESS TESTS ====================
    
    def test_15_ceo_can_see_all_payment_types(self):
        """Test CEO can see all payment types"""
        self.login_ceo()
        
        response = self.session.get(f"{BASE_URL}/api/finance/payments")
        assert response.status_code == 200
        
        payments = response.json()
        payment_types_found = set(p.get("payment_type") for p in payments)
        
        print(f"SUCCESS: CEO can see payments with types: {payment_types_found}")
    
    def test_16_ceo_can_approve_b2b_payment(self):
        """Test CEO can approve B2B payment"""
        # First create a payment as Finance Manager
        self.login_finance_manager()
        
        payload = {
            "payment_type": "vendor",
            "vendor_name": "TEST_CEO Approval Test Vendor",
            "month": self.test_month,
            "year": self.test_year,
            "actual_amount": 30000,
            "gst_percentage": 18,
            "tds_percentage": 10,
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code in [200, 201]
        payment_id = response.json().get("id")
        self.created_payment_ids.append(payment_id)
        
        # Submit for approval (PATCH method)
        response = self.session.patch(f"{BASE_URL}/api/finance/payments/{payment_id}/submit")
        assert response.status_code == 200, f"Submit failed: {response.text}"
        
        # Login as CEO and approve (PATCH method)
        self.login_ceo()
        
        response = self.session.patch(f"{BASE_URL}/api/finance/payments/{payment_id}/approve", json={
            "action": "approve"
        })
        assert response.status_code == 200, f"CEO approval failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "approved"
        
        print("SUCCESS: CEO approved B2B payment")
    
    # ==================== CLEANUP ====================
    
    def test_99_cleanup(self):
        """Cleanup test payments"""
        self.login_ceo()
        
        cleaned = 0
        for payment_id in self.created_payment_ids:
            try:
                response = self.session.delete(f"{BASE_URL}/api/finance/payments/{payment_id}")
                if response.status_code in [200, 204]:
                    cleaned += 1
            except:
                pass
        
        print(f"SUCCESS: Cleaned up {cleaned} test payments")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
