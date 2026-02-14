"""
HR Module Phase 1 Tests - Attendance, Payroll, Leave Management
Tests session tracking, attendance calculation, payroll generation, and leave workflows
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "ceo@wisedrive.com"
CEO_PASSWORD = "password123"
FINANCE_EMAIL = "finance.my@wisedrive.com"
FINANCE_PASSWORD = "password123"


class TestAuth:
    """Authentication tests for HR Module access"""
    
    def test_ceo_login(self):
        """Test CEO can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role_code"] == "CEO"
        print(f"✓ CEO login successful: {data['user']['name']}")
    
    def test_finance_manager_login(self):
        """Test Finance Manager can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FINANCE_EMAIL,
            "password": FINANCE_PASSWORD
        })
        assert response.status_code == 200, f"Finance Manager login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role_code"] == "FINANCE_MANAGER"
        print(f"✓ Finance Manager login successful: {data['user']['name']}")


@pytest.fixture
def ceo_token():
    """Get CEO auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CEO_EMAIL,
        "password": CEO_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("CEO login failed")
    return response.json()["access_token"]


@pytest.fixture
def finance_token():
    """Get Finance Manager auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": FINANCE_EMAIL,
        "password": FINANCE_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Finance Manager login failed")
    return response.json()["access_token"]


@pytest.fixture
def ceo_headers(ceo_token):
    """Get headers with CEO auth"""
    return {"Authorization": f"Bearer {ceo_token}", "Content-Type": "application/json"}


@pytest.fixture
def finance_headers(finance_token):
    """Get headers with Finance Manager auth"""
    return {"Authorization": f"Bearer {finance_token}", "Content-Type": "application/json"}


class TestSessionManagement:
    """Session tracking API tests"""
    
    def test_session_start(self, ceo_headers):
        """Test session start on login"""
        response = requests.post(f"{BASE_URL}/api/hr/session/start", headers=ceo_headers)
        assert response.status_code == 200, f"Session start failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["is_active"] == True
        print(f"✓ Session started: {data['id']}")
    
    def test_session_heartbeat(self, ceo_headers):
        """Test session heartbeat for activity tracking"""
        response = requests.post(f"{BASE_URL}/api/hr/session/heartbeat", headers=ceo_headers)
        assert response.status_code == 200, f"Heartbeat failed: {response.text}"
        data = response.json()
        assert "timestamp" in data
        print(f"✓ Heartbeat successful at {data['timestamp']}")
    
    def test_get_active_sessions(self, ceo_headers):
        """Test getting active sessions - HR/CEO only"""
        response = requests.get(f"{BASE_URL}/api/hr/sessions/active", headers=ceo_headers)
        assert response.status_code == 200, f"Get active sessions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Active sessions retrieved: {len(data)} sessions")
    
    def test_session_end(self, ceo_headers):
        """Test session end on logout"""
        response = requests.post(f"{BASE_URL}/api/hr/session/end", headers=ceo_headers)
        assert response.status_code == 200, f"Session end failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"✓ Session ended successfully")


class TestAttendanceRecords:
    """Attendance tracking and approval tests"""
    
    def test_get_attendance_records(self, ceo_headers):
        """Test getting attendance records"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance",
            params={"month": current_month, "year": current_year},
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Get attendance failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Attendance records retrieved: {len(data)} records for {current_month}/{current_year}")
    
    def test_get_attendance_summary(self, ceo_headers):
        """Test getting attendance summary for an employee"""
        # First get an employee ID
        emp_response = requests.get(f"{BASE_URL}/api/hr/employees", headers=ceo_headers)
        if emp_response.status_code != 200 or not emp_response.json():
            pytest.skip("No employees found")
        
        employee_id = emp_response.json()[0]["id"]
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/summary/{employee_id}",
            params={"month": current_month, "year": current_year},
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Get attendance summary failed: {response.text}"
        data = response.json()
        assert "working_days" in data
        assert "present_days" in data
        print(f"✓ Attendance summary: {data['present_days']} present out of {data['working_days']} working days")
    
    def test_get_pending_approvals(self, ceo_headers):
        """Test getting pending attendance approvals - HR only"""
        response = requests.get(f"{BASE_URL}/api/hr/attendance/pending-approvals", headers=ceo_headers)
        assert response.status_code == 200, f"Get pending approvals failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Pending attendance approvals: {len(data)}")
    
    def test_run_daily_calculation(self, ceo_headers):
        """Test running daily attendance calculation - HR only"""
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/hr/attendance/calculate-daily",
            params={"date": yesterday},
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Daily calculation failed: {response.text}"
        data = response.json()
        assert "processed" in data
        print(f"✓ Daily calculation: processed {data['processed']} records, created {data.get('absent_created', 0)} absent records")


class TestForceLogout:
    """Force logout capability tests"""
    
    def test_force_logout_rbac(self, finance_headers):
        """Test that non-HR cannot force logout"""
        response = requests.post(
            f"{BASE_URL}/api/hr/sessions/fake-session-id/force-logout",
            headers=finance_headers
        )
        # Finance Manager should not be able to force logout
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ RBAC enforced: Finance Manager cannot force logout")


class TestPayrollGeneration:
    """Payroll generation and management tests"""
    
    def test_get_payroll_records(self, ceo_headers):
        """Test getting payroll records"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        response = requests.get(
            f"{BASE_URL}/api/hr/payroll",
            params={"month": current_month, "year": current_year},
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Get payroll failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Payroll records retrieved: {len(data)} records for {current_month}/{current_year}")
    
    def test_get_payroll_summary(self, ceo_headers):
        """Test getting payroll summary"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        response = requests.get(
            f"{BASE_URL}/api/hr/payroll/summary/{current_month}/{current_year}",
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Get payroll summary failed: {response.text}"
        data = response.json()
        assert "total_employees" in data
        assert "total_net_salary" in data
        print(f"✓ Payroll summary: {data['total_employees']} employees, total net: {data.get('total_net_salary', 0)}")
    
    def test_bulk_generate_payroll(self, ceo_headers):
        """Test bulk payroll generation"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        response = requests.post(
            f"{BASE_URL}/api/hr/payroll/generate-bulk",
            json={"month": current_month, "year": current_year},
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Bulk generate failed: {response.text}"
        data = response.json()
        assert "success" in data
        assert "failed" in data
        assert "skipped" in data
        print(f"✓ Bulk payroll: {len(data['success'])} success, {len(data['skipped'])} skipped, {len(data['failed'])} failed")
    
    def test_generate_payroll_rbac(self, finance_headers):
        """Test that Finance Manager cannot generate payroll"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        response = requests.post(
            f"{BASE_URL}/api/hr/payroll/generate-bulk",
            json={"month": current_month, "year": current_year},
            headers=finance_headers
        )
        # Finance Manager should not be able to generate payroll
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ RBAC enforced: Finance Manager cannot generate payroll")


class TestPaymentMarking:
    """Payment marking workflow tests"""
    
    def test_mark_paid_rbac_ceo(self, ceo_headers):
        """Test CEO can mark payment"""
        # First get a payroll record
        current_month = datetime.now().month
        current_year = datetime.now().year
        payroll_response = requests.get(
            f"{BASE_URL}/api/hr/payroll",
            params={"month": current_month, "year": current_year},
            headers=ceo_headers
        )
        
        if payroll_response.status_code != 200 or not payroll_response.json():
            pytest.skip("No payroll records found")
        
        # Find an unpaid record
        unpaid = [p for p in payroll_response.json() if p.get("payment_status") != "PAID"]
        if not unpaid:
            pytest.skip("No unpaid payroll records")
        
        payroll_id = unpaid[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/hr/payroll/{payroll_id}/mark-paid",
            json={
                "transaction_reference": f"TEST_TXN_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "payment_date": datetime.now().strftime("%Y-%m-%d"),
                "payment_mode": "BANK_TRANSFER"
            },
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Mark paid failed: {response.text}"
        data = response.json()
        assert data["payment_status"] == "PAID"
        print(f"✓ CEO marked payment as paid: {data['transaction_reference']}")
    
    def test_mark_paid_finance_manager(self, finance_headers, ceo_headers):
        """Test Finance Manager can mark payment"""
        # First generate payroll as CEO
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        # Get payroll records
        payroll_response = requests.get(
            f"{BASE_URL}/api/hr/payroll",
            params={"month": current_month, "year": current_year},
            headers=finance_headers
        )
        
        if payroll_response.status_code != 200 or not payroll_response.json():
            pytest.skip("No payroll records found")
        
        # Find an unpaid record
        unpaid = [p for p in payroll_response.json() if p.get("payment_status") != "PAID"]
        if not unpaid:
            pytest.skip("No unpaid payroll records")
        
        payroll_id = unpaid[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/hr/payroll/{payroll_id}/mark-paid",
            json={
                "transaction_reference": f"FIN_TXN_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "payment_date": datetime.now().strftime("%Y-%m-%d"),
                "payment_mode": "NEFT"
            },
            headers=finance_headers
        )
        assert response.status_code == 200, f"Finance mark paid failed: {response.text}"
        data = response.json()
        assert data["payment_status"] == "PAID"
        print(f"✓ Finance Manager marked payment as paid: {data['transaction_reference']}")


class TestLeaveManagement:
    """Leave management workflow tests"""
    
    def test_get_my_leave_balance(self, ceo_headers):
        """Test getting own leave balance"""
        response = requests.get(f"{BASE_URL}/api/hr/leave/my-balance", headers=ceo_headers)
        assert response.status_code == 200, f"Get leave balance failed: {response.text}"
        data = response.json()
        assert "casual_leave_balance" in data
        assert "sick_leave_balance" in data
        print(f"✓ Leave balance: Casual={data['casual_leave_balance']}, Sick={data['sick_leave_balance']}")
    
    def test_get_my_leave_requests(self, ceo_headers):
        """Test getting own leave requests"""
        response = requests.get(f"{BASE_URL}/api/hr/leave/my-requests", headers=ceo_headers)
        assert response.status_code == 200, f"Get leave requests failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Leave requests retrieved: {len(data)} requests")
    
    def test_apply_for_leave(self, ceo_headers):
        """Test applying for leave"""
        # Apply for a future date to avoid conflicts
        start_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = start_date
        
        response = requests.post(
            f"{BASE_URL}/api/hr/leave/apply",
            json={
                "leave_type": "CASUAL",
                "start_date": start_date,
                "end_date": end_date,
                "duration_type": "FULL_DAY",
                "reason": "TEST_Leave application for testing"
            },
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Apply leave failed: {response.text}"
        data = response.json()
        assert data["status"] == "PENDING"
        assert data["leave_type"] == "CASUAL"
        print(f"✓ Leave applied: {data['id']} for {start_date}")
        return data["id"]
    
    def test_get_pending_leave_approvals(self, ceo_headers):
        """Test getting pending leave approvals - HR/Manager only"""
        response = requests.get(f"{BASE_URL}/api/hr/leave/pending-approvals", headers=ceo_headers)
        assert response.status_code == 200, f"Get pending approvals failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Pending leave approvals: {len(data)}")
    
    def test_get_team_leave_summary(self, ceo_headers):
        """Test getting team leave summary"""
        response = requests.get(f"{BASE_URL}/api/hr/leave/team-summary", headers=ceo_headers)
        assert response.status_code == 200, f"Get team summary failed: {response.text}"
        data = response.json()
        assert "total_employees" in data
        assert "employees_on_leave_today" in data
        print(f"✓ Team summary: {data['total_employees']} employees, {data['employees_on_leave_today']} on leave today")
    
    def test_cancel_leave_request(self, ceo_headers):
        """Test cancelling a leave request"""
        # First apply for leave
        start_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        end_date = start_date
        
        apply_response = requests.post(
            f"{BASE_URL}/api/hr/leave/apply",
            json={
                "leave_type": "SICK",
                "start_date": start_date,
                "end_date": end_date,
                "duration_type": "FULL_DAY",
                "reason": "TEST_Leave to be cancelled"
            },
            headers=ceo_headers
        )
        
        if apply_response.status_code != 200:
            pytest.skip("Could not create leave request to cancel")
        
        request_id = apply_response.json()["id"]
        
        # Now cancel it
        response = requests.post(
            f"{BASE_URL}/api/hr/leave/{request_id}/cancel",
            params={"reason": "Testing cancellation"},
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Cancel leave failed: {response.text}"
        data = response.json()
        assert data["status"] == "CANCELLED"
        print(f"✓ Leave request cancelled: {request_id}")


class TestLeaveApprovalWorkflow:
    """Leave approval workflow tests"""
    
    def test_approve_leave_request(self, ceo_headers):
        """Test approving a leave request"""
        # Get pending approvals
        pending_response = requests.get(
            f"{BASE_URL}/api/hr/leave/pending-approvals",
            headers=ceo_headers
        )
        
        if pending_response.status_code != 200 or not pending_response.json():
            pytest.skip("No pending leave requests to approve")
        
        request_id = pending_response.json()[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/hr/leave/{request_id}/approve",
            json={"action": "APPROVED"},
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Approve leave failed: {response.text}"
        data = response.json()
        assert data["status"] == "APPROVED"
        print(f"✓ Leave request approved: {request_id}")
    
    def test_reject_leave_request(self, ceo_headers):
        """Test rejecting a leave request"""
        # First create a leave request
        start_date = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")
        end_date = start_date
        
        apply_response = requests.post(
            f"{BASE_URL}/api/hr/leave/apply",
            json={
                "leave_type": "CASUAL",
                "start_date": start_date,
                "end_date": end_date,
                "duration_type": "FULL_DAY",
                "reason": "TEST_Leave to be rejected"
            },
            headers=ceo_headers
        )
        
        if apply_response.status_code != 200:
            pytest.skip("Could not create leave request to reject")
        
        request_id = apply_response.json()["id"]
        
        # Now reject it
        response = requests.post(
            f"{BASE_URL}/api/hr/leave/{request_id}/approve",
            json={
                "action": "REJECTED",
                "rejection_reason": "Testing rejection workflow"
            },
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Reject leave failed: {response.text}"
        data = response.json()
        assert data["status"] == "REJECTED"
        print(f"✓ Leave request rejected: {request_id}")


class TestRBACEnforcement:
    """RBAC enforcement tests"""
    
    def test_attendance_override_rbac(self, finance_headers):
        """Test that Finance Manager cannot override attendance"""
        response = requests.post(
            f"{BASE_URL}/api/hr/attendance/fake-record-id/override",
            json={"override_status": "APPROVED", "reason": "Test"},
            headers=finance_headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ RBAC enforced: Finance Manager cannot override attendance")
    
    def test_leave_approval_rbac(self, finance_headers):
        """Test that Finance Manager cannot approve leave"""
        response = requests.get(
            f"{BASE_URL}/api/hr/leave/pending-approvals",
            headers=finance_headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ RBAC enforced: Finance Manager cannot view pending leave approvals")


class TestPayslipGeneration:
    """Payslip generation tests"""
    
    def test_generate_payslip(self, ceo_headers):
        """Test generating payslip PDF"""
        # Get a payroll record
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        payroll_response = requests.get(
            f"{BASE_URL}/api/hr/payroll",
            params={"month": current_month, "year": current_year},
            headers=ceo_headers
        )
        
        if payroll_response.status_code != 200 or not payroll_response.json():
            pytest.skip("No payroll records found")
        
        payroll_id = payroll_response.json()[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/hr/payroll/{payroll_id}/generate-payslip",
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Generate payslip failed: {response.text}"
        data = response.json()
        assert "payslip_path" in data
        print(f"✓ Payslip generated: {data['payslip_path']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
