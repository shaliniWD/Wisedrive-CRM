"""
ESS Mobile API Tests
Tests for the Employee Self-Service Mobile API running on port 8002

Features tested:
- Health check endpoint
- Mobile login with device registration
- Single device policy (new login invalidates old sessions)
- Profile endpoint
- Leave management (balance, apply, history)
- Notifications endpoints
- Payslips endpoint
- Documents endpoint
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

# ESS API runs on port 8002
ESS_BASE_URL = "http://localhost:8002"

# Main CRM API for reference
CRM_BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USERS = [
    {"email": "kalyan@wisedrive.com", "password": "password123", "role": "CEO"},
    {"email": "hr@wisedrive.com", "password": "password123", "role": "HR Manager"},
    {"email": "salesexec1.in@wisedrive.com", "password": "password123", "role": "Sales Executive"}
]


def generate_device_info():
    """Generate unique device info for testing"""
    return {
        "device_id": str(uuid.uuid4()),
        "device_name": "Test Device",
        "platform": "android",
        "os_version": "14.0",
        "app_version": "1.0.0",
        "push_token": f"test_fcm_token_{uuid.uuid4().hex[:8]}"
    }


class TestESSHealthCheck:
    """Test ESS API health check endpoint"""
    
    def test_health_check(self):
        """Test /ess/v1/health endpoint"""
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "ess-mobile-api"
        assert data["version"] == "1.0.0"
        print("✓ Health check passed")
    
    def test_root_endpoint(self):
        """Test /ess/v1 root endpoint"""
        response = requests.get(f"{ESS_BASE_URL}/ess/v1")
        assert response.status_code == 200
        
        data = response.json()
        assert "WiseDrive ESS Mobile API" in data["message"]
        assert data["version"] == "1.0.0"
        print("✓ Root endpoint passed")
    
    def test_docs_endpoint(self):
        """Test OpenAPI docs endpoint"""
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/docs")
        assert response.status_code == 200
        print("✓ Docs endpoint accessible")


class TestESSAuthentication:
    """Test ESS Mobile authentication endpoints"""
    
    def test_login_success_ceo(self):
        """Test successful login for CEO user"""
        device = generate_device_info()
        
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0
        assert "user" in data
        assert data["user"]["email"] == "kalyan@wisedrive.com"
        print(f"✓ CEO login successful - User: {data['user']['name']}, Role: {data['user']['role']}")
        
        return data
    
    def test_login_success_hr(self):
        """Test successful login for HR Manager"""
        device = generate_device_info()
        
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "hr@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert data["user"]["email"] == "hr@wisedrive.com"
        print(f"✓ HR Manager login successful - User: {data['user']['name']}")
        
        return data
    
    def test_login_success_sales_exec(self):
        """Test successful login for Sales Executive"""
        device = generate_device_info()
        
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "salesexec1.in@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert data["user"]["email"] == "salesexec1.in@wisedrive.com"
        print(f"✓ Sales Executive login successful - User: {data['user']['name']}")
        
        return data
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        device = generate_device_info()
        
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "invalid@wisedrive.com",
                "password": "wrongpassword",
                "device": device
            }
        )
        
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_login_wrong_password(self):
        """Test login with wrong password"""
        device = generate_device_info()
        
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "wrongpassword",
                "device": device
            }
        )
        
        assert response.status_code == 401
        print("✓ Wrong password correctly rejected")


class TestSingleDevicePolicy:
    """Test single device session policy"""
    
    def test_new_login_invalidates_old_session(self):
        """Test that new login invalidates previous device session"""
        # First login
        device1 = generate_device_info()
        response1 = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "device": device1
            }
        )
        assert response1.status_code == 200
        token1 = response1.json()["access_token"]
        
        # Verify first token works
        headers1 = {"Authorization": f"Bearer {token1}"}
        profile_response1 = requests.get(f"{ESS_BASE_URL}/ess/v1/profile", headers=headers1)
        assert profile_response1.status_code == 200
        print("✓ First device session active")
        
        # Second login from different device
        device2 = generate_device_info()
        response2 = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "device": device2
            }
        )
        assert response2.status_code == 200
        token2 = response2.json()["access_token"]
        print("✓ Second device login successful")
        
        # Verify second token works
        headers2 = {"Authorization": f"Bearer {token2}"}
        profile_response2 = requests.get(f"{ESS_BASE_URL}/ess/v1/profile", headers=headers2)
        assert profile_response2.status_code == 200
        print("✓ Second device session active")
        
        # Verify first token is now invalid (session invalidated)
        profile_response1_after = requests.get(f"{ESS_BASE_URL}/ess/v1/profile", headers=headers1)
        assert profile_response1_after.status_code == 401
        print("✓ First device session correctly invalidated (single device policy working)")


class TestESSProfile:
    """Test ESS Profile endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        device = generate_device_info()
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_profile(self, auth_token):
        """Test GET /ess/v1/profile"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/profile", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "name" in data
        assert "employee_code" in data
        assert "employment_status" in data
        print(f"✓ Profile retrieved - Name: {data['name']}, Status: {data['employment_status']}")
    
    def test_get_profile_unauthorized(self):
        """Test profile access without token"""
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/profile")
        assert response.status_code in [401, 403]
        print("✓ Unauthorized profile access correctly rejected")
    
    def test_get_bank_details(self, auth_token):
        """Test GET /ess/v1/profile/bank-details"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/profile/bank-details", headers=headers)
        
        # May return 404 if no bank details configured
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            # Bank details should be masked
            if data.get("account_number_masked"):
                assert "X" in data["account_number_masked"] or "****" in str(data["account_number_masked"])
            print(f"✓ Bank details retrieved (masked)")
        else:
            print("✓ Bank details endpoint working (no data configured)")
    
    def test_get_salary_summary(self, auth_token):
        """Test GET /ess/v1/profile/salary"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/profile/salary", headers=headers)
        
        # May return 404 if no salary structure configured
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert "gross_salary" in data
            assert "net_salary" in data
            assert "currency" in data
            print(f"✓ Salary summary retrieved - Gross: {data['currency_symbol']}{data['gross_salary']}")
        else:
            print("✓ Salary endpoint working (no salary structure configured)")
    
    def test_get_attendance_summary(self, auth_token):
        """Test GET /ess/v1/profile/attendance"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/profile/attendance", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "month" in data
        assert "year" in data
        assert "working_days" in data
        assert "present_days" in data
        print(f"✓ Attendance summary retrieved - {data['month']} {data['year']}: {data['present_days']} present days")


class TestESSLeaveManagement:
    """Test ESS Leave Management endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        device = generate_device_info()
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "salesexec1.in@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_leave_balance(self, auth_token):
        """Test GET /ess/v1/leave/balance"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/leave/balance", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "employee_id" in data
        assert "year" in data
        assert "casual_leaves" in data
        assert "sick_leaves" in data
        assert "earned_leaves" in data
        
        print(f"✓ Leave balance retrieved for year {data['year']}")
        print(f"  - Casual: {data['casual_leaves']['available']} available")
        print(f"  - Sick: {data['sick_leaves']['available']} available")
        print(f"  - Earned: {data['earned_leaves']['available']} available")
    
    def test_get_leave_history(self, auth_token):
        """Test GET /ess/v1/leave/history"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/leave/history", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "leaves" in data
        assert "total" in data
        assert "page" in data
        assert "has_more" in data
        
        print(f"✓ Leave history retrieved - Total: {data['total']} records")
    
    def test_apply_leave(self, auth_token):
        """Test POST /ess/v1/leave/apply"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Apply for leave 30 days from now to avoid past date validation
        start_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=31)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/leave/apply",
            headers=headers,
            json={
                "leave_type": "casual",
                "start_date": start_date,
                "end_date": end_date,
                "reason": "ESS API Test - Family function attendance required",
                "is_half_day": False
            }
        )
        
        # May fail if overlapping leave exists
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert data["status"] == "pending"
            assert data["leave_type"] == "casual"
            print(f"✓ Leave application submitted - ID: {data['id']}, Status: {data['status']}")
            return data["id"]
        elif response.status_code == 400:
            # Overlapping leave or validation error
            print(f"✓ Leave application validation working - {response.json().get('detail', 'validation error')}")
        else:
            pytest.fail(f"Unexpected response: {response.status_code} - {response.text}")
    
    def test_apply_leave_past_date_rejected(self, auth_token):
        """Test that leave for past dates is rejected"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Try to apply for yesterday
        past_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/leave/apply",
            headers=headers,
            json={
                "leave_type": "casual",
                "start_date": past_date,
                "end_date": past_date,
                "reason": "Test leave for past date - should be rejected",
                "is_half_day": False
            }
        )
        
        assert response.status_code == 400
        print("✓ Past date leave correctly rejected")


class TestESSNotifications:
    """Test ESS Notifications endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        device = generate_device_info()
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_notifications(self, auth_token):
        """Test GET /ess/v1/notifications"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/notifications", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data
        assert "total" in data
        assert "unread_count" in data
        assert "page" in data
        assert "has_more" in data
        
        print(f"✓ Notifications retrieved - Total: {data['total']}, Unread: {data['unread_count']}")
    
    def test_get_unread_count(self, auth_token):
        """Test GET /ess/v1/notifications/unread-count"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/notifications/unread-count", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "unread_count" in data
        print(f"✓ Unread count: {data['unread_count']}")
    
    def test_get_notification_settings(self, auth_token):
        """Test GET /ess/v1/notifications/settings"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/notifications/settings", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "leave_updates" in data
        assert "payslip_alerts" in data
        assert "document_updates" in data
        assert "announcements" in data
        print(f"✓ Notification settings retrieved")
    
    def test_update_notification_settings(self, auth_token):
        """Test PATCH /ess/v1/notifications/settings"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.patch(
            f"{ESS_BASE_URL}/ess/v1/notifications/settings",
            headers=headers,
            json={
                "quiet_hours_enabled": True,
                "quiet_hours_start": "22:00",
                "quiet_hours_end": "07:00"
            }
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["quiet_hours_enabled"] == True
        print("✓ Notification settings updated")
    
    def test_mark_notifications_read(self, auth_token):
        """Test POST /ess/v1/notifications/read"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/notifications/read",
            headers=headers,
            json={"mark_all": True}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "marked_count" in data
        print(f"✓ Marked {data['marked_count']} notifications as read")


class TestESSPayslips:
    """Test ESS Payslips endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        device = generate_device_info()
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_payslips(self, auth_token):
        """Test GET /ess/v1/payslips"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/payslips", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "payslips" in data
        assert "total" in data
        assert "page" in data
        assert "has_more" in data
        
        print(f"✓ Payslips retrieved - Total: {data['total']}")
        
        if data["payslips"]:
            payslip = data["payslips"][0]
            print(f"  - Latest: {payslip['period']} - Net: {payslip['currency_symbol']}{payslip['net_salary']}")
    
    def test_get_available_years(self, auth_token):
        """Test GET /ess/v1/payslips/years"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/payslips/years", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "years" in data
        print(f"✓ Available years: {data['years']}")


class TestESSDocuments:
    """Test ESS Documents endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        device = generate_device_info()
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_documents(self, auth_token):
        """Test GET /ess/v1/documents"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/documents", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "documents" in data
        assert "total" in data
        
        print(f"✓ Documents retrieved - Total: {data['total']}")
        
        if data["documents"]:
            for doc in data["documents"][:3]:
                print(f"  - {doc['document_name']} ({doc['document_type']}): {doc['status']}")
    
    def test_get_document_requirements(self, auth_token):
        """Test GET /ess/v1/documents/requirements"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/documents/requirements", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "requirements" in data
        assert "completed_count" in data
        assert "total_required" in data
        assert "completion_percentage" in data
        
        print(f"✓ Document requirements - {data['completed_count']}/{data['total_required']} ({data['completion_percentage']}%)")


class TestESSAuthSession:
    """Test ESS Auth Session endpoints"""
    
    def test_get_current_session(self):
        """Test GET /ess/v1/auth/session"""
        device = generate_device_info()
        
        # Login first
        login_response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Get session
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{ESS_BASE_URL}/ess/v1/auth/session", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "device_id" in data
        assert data["device_id"] == device["device_id"]
        assert data["platform"] == device["platform"]
        print(f"✓ Session retrieved - Device: {data['device_name']}, Platform: {data['platform']}")
    
    def test_logout(self):
        """Test POST /ess/v1/auth/logout"""
        device = generate_device_info()
        
        # Login first
        login_response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Logout
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/logout",
            headers=headers,
            json={
                "device_id": device["device_id"],
                "all_devices": False
            }
        )
        
        assert response.status_code == 200
        print("✓ Logout successful")
        
        # Verify token is now invalid
        profile_response = requests.get(f"{ESS_BASE_URL}/ess/v1/profile", headers=headers)
        assert profile_response.status_code == 401
        print("✓ Token invalidated after logout")
    
    def test_refresh_token(self):
        """Test POST /ess/v1/auth/refresh"""
        device = generate_device_info()
        
        # Login first
        login_response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "device": device
            }
        )
        assert login_response.status_code == 200
        login_data = login_response.json()
        refresh_token = login_data["refresh_token"]
        
        # Refresh token
        response = requests.post(
            f"{ESS_BASE_URL}/ess/v1/auth/refresh",
            json={
                "refresh_token": refresh_token,
                "device_id": device["device_id"]
            }
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["access_token"] != login_data["access_token"]  # New token
        print("✓ Token refresh successful")
        
        # Verify new token works
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        profile_response = requests.get(f"{ESS_BASE_URL}/ess/v1/profile", headers=headers)
        assert profile_response.status_code == 200
        print("✓ New token is valid")


class TestMainCRMAPIStillWorking:
    """Verify main CRM API is still working alongside ESS API"""
    
    def test_crm_api_root(self):
        """Test main CRM API root endpoint"""
        if not CRM_BASE_URL:
            pytest.skip("CRM_BASE_URL not configured")
        
        response = requests.get(f"{CRM_BASE_URL}/api/")
        assert response.status_code == 200
        
        data = response.json()
        assert "WiseDrive CRM" in data.get("message", "")
        print(f"✓ Main CRM API working - {data.get('message')}")
    
    def test_crm_api_login(self):
        """Test main CRM API login still works"""
        if not CRM_BASE_URL:
            pytest.skip("CRM_BASE_URL not configured")
        
        response = requests.post(
            f"{CRM_BASE_URL}/api/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123"
            }
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        print("✓ Main CRM API login working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
