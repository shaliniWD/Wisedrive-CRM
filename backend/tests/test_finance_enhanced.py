"""
Finance Module Enhanced Tests - Testing new payment types and B2B fields
Tests: 9 payment types, B2B fields (GST/TDS), vendor payments, payslip generation
"""
import pytest
import requests
import os

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
    
    def login_finance_manager(self):
        """Login as Finance Manager India"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance.in@wisedrive.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Finance Manager login failed: {response.text}"
        data = response.json()
        self.finance_token = data.get("token")
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
        self.ceo_token = data.get("token")
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
        assert "token" in data
        assert data.get("user", {}).get("email") == "finance.in@wisedrive.com"
        print("SUCCESS: Finance Manager India login successful")
    
    def test_02_all_payment_types_available(self):
        """Verify all 9 payment types are supported by backend"""
        self.login_finance_manager()
        
        # Get employees for non-B2B payments
        employees = self.get_employees()
        employee_id = employees[0]["id"] if employees else None
        
        for payment_type in PAYMENT_TYPES:
            is_b2b = payment_type in B2B_PAYMENT_TYPES
            
            payload = {
                "payment_type": payment_type,
                "month": 2,
                "year": 2026,
                "gross_amount": 10000,
                "deductions": 1000,
                "net_amount": 9000,
                "notes": f"Test {payment_type} payment"
            }
            
            if is_b2b:
                # B2B payments need vendor_name
                payload["vendor_name"] = f"Test Vendor for {payment_type}"
                payload["actual_amount"] = 10000
                payload["gst_percentage"] = 18
                payload["tds_percentage"] = 10
            else:
                # Non-B2B payments need employee_id
                if employee_id:
                    payload["employee_id"] = employee_id
                else:
                    print(f"SKIP: No employees available for {payment_type} test")
                    continue
            
            response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
            
            if response.status_code == 201:
                data = response.json()
                self.created_payment_ids.append(data.get("id"))
                assert data.get("payment_type") == payment_type
                print(f"SUCCESS: Created {payment_type} payment")
            else:
                print(f"FAILED: Could not create {payment_type} payment - {response.status_code}: {response.text}")
                assert False, f"Failed to create {payment_type} payment"
    
    # ==================== B2B PAYMENT TESTS ====================
    
    def test_03_vendor_payment_b2b_fields(self):
        """Test Vendor Payment has B2B fields (Actual Amount, GST, TDS, Final Payout)"""
        self.login_finance_manager()
        
        payload = {
            "payment_type": "vendor",
            "vendor_name": "ABC Vendor Pvt Ltd",
            "invoice_number": "INV-2026-001",
            "month": 2,
            "year": 2026,
            "actual_amount": 100000,
            "gst_percentage": 18,
            "tds_percentage": 10,
            "notes": "Vendor payment with GST/TDS"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201, f"Failed to create vendor payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        # Verify B2B fields
        assert data.get("payment_type") == "vendor"
        assert data.get("vendor_name") == "ABC Vendor Pvt Ltd"
        assert data.get("invoice_number") == "INV-2026-001"
        assert data.get("actual_amount") == 100000
        assert data.get("gst_percentage") == 18
        assert data.get("tds_percentage") == 10
        
        # Verify calculated fields
        expected_gst = 100000 * 0.18  # 18000
        expected_tds = 100000 * 0.10  # 10000
        expected_net = 100000 + expected_gst - expected_tds  # 108000
        
        assert data.get("gst_amount") == expected_gst, f"GST amount mismatch: {data.get('gst_amount')} != {expected_gst}"
        assert data.get("tds_amount") == expected_tds, f"TDS amount mismatch: {data.get('tds_amount')} != {expected_tds}"
        assert data.get("net_amount") == expected_net, f"Net amount mismatch: {data.get('net_amount')} != {expected_net}"
        
        print(f"SUCCESS: Vendor payment created with B2B fields - GST: {expected_gst}, TDS: {expected_tds}, Net: {expected_net}")
    
    def test_04_statutory_payment_b2b_fields(self):
        """Test Statutory Payment has B2B fields"""
        self.login_finance_manager()
        
        payload = {
            "payment_type": "statutory",
            "vendor_name": "GST Department",
            "month": 2,
            "year": 2026,
            "actual_amount": 50000,
            "gst_percentage": 0,  # No GST on statutory
            "tds_percentage": 0,  # No TDS on statutory
            "notes": "GST payment for Q4"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201, f"Failed to create statutory payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "statutory"
        assert data.get("vendor_name") == "GST Department"
        print("SUCCESS: Statutory payment created with B2B fields")
    
    def test_05_legal_payment_b2b_fields(self):
        """Test Legal Payment has B2B fields"""
        self.login_finance_manager()
        
        payload = {
            "payment_type": "legal",
            "vendor_name": "XYZ Law Firm",
            "invoice_number": "LEG-2026-001",
            "month": 2,
            "year": 2026,
            "actual_amount": 75000,
            "gst_percentage": 18,
            "tds_percentage": 10,
            "notes": "Legal consultation fees"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201, f"Failed to create legal payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "legal"
        assert data.get("vendor_name") == "XYZ Law Firm"
        print("SUCCESS: Legal payment created with B2B fields")
    
    def test_06_b2b_payment_requires_vendor_name(self):
        """Test B2B payment fails without vendor_name"""
        self.login_finance_manager()
        
        payload = {
            "payment_type": "vendor",
            "month": 2,
            "year": 2026,
            "actual_amount": 10000,
            # Missing vendor_name
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 400, f"Expected 400 for missing vendor_name, got {response.status_code}"
        print("SUCCESS: B2B payment correctly requires vendor_name")
    
    # ==================== NON-B2B PAYMENT TESTS ====================
    
    def test_07_salary_payment_non_b2b_fields(self):
        """Test Salary Payment has non-B2B fields (Amount Payable, Deductions, Final Payout)"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for salary payment test")
        
        employee_id = employees[0]["id"]
        
        payload = {
            "payment_type": "salary",
            "employee_id": employee_id,
            "month": 2,
            "year": 2026,
            "gross_amount": 50000,  # Amount Payable
            "deductions": 5000,     # Deductions
            "net_amount": 45000,    # Final Payout
            "notes": "February 2026 salary"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201, f"Failed to create salary payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "salary"
        assert data.get("employee_id") == employee_id
        assert data.get("gross_amount") == 50000
        assert data.get("deductions") == 5000
        assert data.get("net_amount") == 45000
        
        print("SUCCESS: Salary payment created with non-B2B fields")
    
    def test_08_admin_expense_payment(self):
        """Test Admin Expense payment"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for admin expense test")
        
        employee_id = employees[0]["id"]
        
        payload = {
            "payment_type": "admin_expense",
            "employee_id": employee_id,
            "month": 2,
            "year": 2026,
            "gross_amount": 15000,
            "deductions": 0,
            "net_amount": 15000,
            "notes": "Office supplies reimbursement"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201, f"Failed to create admin expense: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "admin_expense"
        print("SUCCESS: Admin expense payment created")
    
    def test_09_operational_expense_payment(self):
        """Test Operational Expense payment"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for operational expense test")
        
        employee_id = employees[0]["id"]
        
        payload = {
            "payment_type": "operational",
            "employee_id": employee_id,
            "month": 2,
            "year": 2026,
            "gross_amount": 25000,
            "deductions": 0,
            "net_amount": 25000,
            "notes": "Vehicle maintenance"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201, f"Failed to create operational expense: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "operational"
        print("SUCCESS: Operational expense payment created")
    
    def test_10_incentive_payment(self):
        """Test Incentive Payment"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for incentive payment test")
        
        employee_id = employees[0]["id"]
        
        payload = {
            "payment_type": "incentive",
            "employee_id": employee_id,
            "month": 2,
            "year": 2026,
            "gross_amount": 10000,
            "deductions": 1000,
            "net_amount": 9000,
            "notes": "Q4 performance bonus"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201, f"Failed to create incentive payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "incentive"
        print("SUCCESS: Incentive payment created")
    
    def test_11_other_payment(self):
        """Test Other Payment type"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for other payment test")
        
        employee_id = employees[0]["id"]
        
        payload = {
            "payment_type": "other",
            "employee_id": employee_id,
            "month": 2,
            "year": 2026,
            "gross_amount": 5000,
            "deductions": 0,
            "net_amount": 5000,
            "notes": "Miscellaneous payment"
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201, f"Failed to create other payment: {response.text}"
        
        data = response.json()
        self.created_payment_ids.append(data.get("id"))
        
        assert data.get("payment_type") == "other"
        print("SUCCESS: Other payment created")
    
    # ==================== PAYSLIP TESTS ====================
    
    def test_12_payslip_for_b2b_payment(self):
        """Test payslip generation for B2B payment shows vendor details"""
        self.login_finance_manager()
        
        # Create a vendor payment first
        payload = {
            "payment_type": "vendor",
            "vendor_name": "Payslip Test Vendor",
            "invoice_number": "INV-PAYSLIP-001",
            "month": 2,
            "year": 2026,
            "actual_amount": 50000,
            "gst_percentage": 18,
            "tds_percentage": 10,
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201
        payment_id = response.json().get("id")
        self.created_payment_ids.append(payment_id)
        
        # Get payslip
        response = self.session.get(f"{BASE_URL}/api/finance/payments/{payment_id}/payslip")
        assert response.status_code == 200, f"Failed to get payslip: {response.text}"
        
        payslip = response.json()
        
        # Verify B2B payslip fields
        assert payslip.get("vendor_name") == "Payslip Test Vendor"
        assert payslip.get("payment_type") == "vendor"
        assert payslip.get("actual_amount") == 50000
        assert payslip.get("gst_percentage") == 18
        assert payslip.get("tds_percentage") == 10
        
        print("SUCCESS: B2B payslip generated with vendor details")
    
    def test_13_payslip_for_salary_payment(self):
        """Test payslip generation for salary payment shows employee details"""
        self.login_finance_manager()
        employees = self.get_employees()
        
        if not employees:
            pytest.skip("No employees available for payslip test")
        
        employee_id = employees[0]["id"]
        
        # Create a salary payment
        payload = {
            "payment_type": "salary",
            "employee_id": employee_id,
            "month": 2,
            "year": 2026,
            "gross_amount": 60000,
            "deductions": 6000,
            "net_amount": 54000,
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201
        payment_id = response.json().get("id")
        self.created_payment_ids.append(payment_id)
        
        # Get payslip
        response = self.session.get(f"{BASE_URL}/api/finance/payments/{payment_id}/payslip")
        assert response.status_code == 200, f"Failed to get payslip: {response.text}"
        
        payslip = response.json()
        
        # Verify employee payslip fields
        assert payslip.get("employee_name") is not None
        assert payslip.get("payment_type") == "salary"
        assert payslip.get("net_salary") == 54000
        
        print("SUCCESS: Salary payslip generated with employee details")
    
    # ==================== PAYMENT PROOFS TESTS ====================
    
    def test_14_payment_proofs_endpoint(self):
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
    
    def test_15_filter_payments_by_type(self):
        """Test filtering payments by payment_type"""
        self.login_finance_manager()
        
        # Filter by vendor type
        response = self.session.get(f"{BASE_URL}/api/finance/payments?payment_type=vendor&month=2&year=2026")
        assert response.status_code == 200
        
        payments = response.json()
        for payment in payments:
            assert payment.get("payment_type") == "vendor", f"Expected vendor, got {payment.get('payment_type')}"
        
        print(f"SUCCESS: Filtered {len(payments)} vendor payments")
    
    # ==================== CEO ACCESS TESTS ====================
    
    def test_16_ceo_can_see_all_payment_types(self):
        """Test CEO can see all payment types"""
        self.login_ceo()
        
        response = self.session.get(f"{BASE_URL}/api/finance/payments?month=2&year=2026")
        assert response.status_code == 200
        
        payments = response.json()
        payment_types_found = set(p.get("payment_type") for p in payments)
        
        print(f"SUCCESS: CEO can see payments with types: {payment_types_found}")
    
    def test_17_ceo_can_approve_b2b_payment(self):
        """Test CEO can approve B2B payment"""
        # First create a payment as Finance Manager
        self.login_finance_manager()
        
        payload = {
            "payment_type": "vendor",
            "vendor_name": "CEO Approval Test Vendor",
            "month": 2,
            "year": 2026,
            "actual_amount": 30000,
            "gst_percentage": 18,
            "tds_percentage": 10,
        }
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments", json=payload)
        assert response.status_code == 201
        payment_id = response.json().get("id")
        self.created_payment_ids.append(payment_id)
        
        # Submit for approval
        response = self.session.post(f"{BASE_URL}/api/finance/payments/{payment_id}/submit")
        assert response.status_code == 200
        
        # Login as CEO and approve
        self.login_ceo()
        
        response = self.session.post(f"{BASE_URL}/api/finance/payments/{payment_id}/approve", json={
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
        
        for payment_id in self.created_payment_ids:
            try:
                response = self.session.delete(f"{BASE_URL}/api/finance/payments/{payment_id}")
                if response.status_code in [200, 204]:
                    print(f"Cleaned up payment: {payment_id}")
            except:
                pass
        
        print(f"SUCCESS: Cleaned up {len(self.created_payment_ids)} test payments")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
