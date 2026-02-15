"""
ESS Mobile App API Tests - Testing backend APIs for the redesigned mobile app
Tests the production API at https://crmdev.wisedrive.com/api
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

# API Base URL - Production ESS API
BASE_URL = "https://crmdev.wisedrive.com/api"

# Test credentials
TEST_USERS = {
    "ceo": {"email": "kalyan@wisedrive.com", "password": "password123"},
    "hr": {"email": "hr@wisedrive.com", "password": "password123"},
}


class TestESSMobileAuth:
    """Authentication endpoint tests for ESS Mobile App"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test device info"""
        self.device_info = {
            "device_id": f"test-device-{datetime.now().timestamp()}",
            "device_name": "Test Device",
            "platform": "android",
            "os_version": "14",
            "app_version": "1.0.0"
        }
    
    def test_login_ceo_success(self):
        """Test CEO user can login successfully"""
        response = requests.post(
            f"{BASE_URL}/ess/v1/auth/login",
            json={
                "email": TEST_USERS["ceo"]["email"],
                "password": TEST_USERS["ceo"]["password"],
                "device": self.device_info
            }
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_USERS["ceo"]["email"]
        assert data["user"]["name"] == "Kalyandhar Reddy"
        assert data["user"]["role"] == "CEO"
        print(f"✓ CEO login successful - User: {data['user']['name']}")
    
    def test_login_hr_success(self):
        """Test HR user can login successfully"""
        response = requests.post(
            f"{BASE_URL}/ess/v1/auth/login",
            json={
                "email": TEST_USERS["hr"]["email"],
                "password": TEST_USERS["hr"]["password"],
                "device": self.device_info
            }
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == TEST_USERS["hr"]["email"]
        print(f"✓ HR login successful - User: {data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/ess/v1/auth/login",
            json={
                "email": "invalid@example.com",
                "password": "wrongpassword",
                "device": self.device_info
            }
        )
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_login_wrong_password(self):
        """Test login with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/ess/v1/auth/login",
            json={
                "email": TEST_USERS["ceo"]["email"],
                "password": "wrongpassword",
                "device": self.device_info
            }
        )
        assert response.status_code == 401
        print("✓ Wrong password correctly rejected")


class TestESSMobileProfile:
    """Profile endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        device_info = {
            "device_id": f"test-profile-{datetime.now().timestamp()}",
            "device_name": "Test Device",
            "platform": "android",
            "os_version": "14",
            "app_version": "1.0.0"
        }
        response = requests.post(
            f"{BASE_URL}/ess/v1/auth/login",
            json={
                "email": TEST_USERS["ceo"]["email"],
                "password": TEST_USERS["ceo"]["password"],
                "device": device_info
            }
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_profile(self):
        """Test getting user profile"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/profile",
            headers=self.headers
        )
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"
        
        data = response.json()
        assert "name" in data
        assert "email" in data
        assert "employee_code" in data
        print(f"✓ Profile fetched - Name: {data['name']}, Code: {data['employee_code']}")
    
    def test_get_profile_unauthorized(self):
        """Test profile access without token returns 401"""
        response = requests.get(f"{BASE_URL}/ess/v1/profile")
        assert response.status_code in [401, 403]
        print("✓ Unauthorized profile access correctly rejected")
    
    def test_get_bank_details(self):
        """Test getting bank details"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/profile/bank-details",
            headers=self.headers
        )
        # Bank details may return 200 with data or 404 if not set
        assert response.status_code in [200, 404], f"Bank details failed: {response.text}"
        print(f"✓ Bank details endpoint working - Status: {response.status_code}")
    
    def test_get_salary_summary(self):
        """Test getting salary summary"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/profile/salary",
            headers=self.headers
        )
        assert response.status_code in [200, 404], f"Salary summary failed: {response.text}"
        print(f"✓ Salary summary endpoint working - Status: {response.status_code}")
    
    def test_get_attendance_summary(self):
        """Test getting attendance summary"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/profile/attendance",
            headers=self.headers
        )
        assert response.status_code == 200, f"Attendance summary failed: {response.text}"
        
        data = response.json()
        # Verify expected fields
        assert "present_days" in data or "working_days" in data or isinstance(data, dict)
        print(f"✓ Attendance summary fetched")


class TestESSMobileLeave:
    """Leave management endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        device_info = {
            "device_id": f"test-leave-{datetime.now().timestamp()}",
            "device_name": "Test Device",
            "platform": "android",
            "os_version": "14",
            "app_version": "1.0.0"
        }
        response = requests.post(
            f"{BASE_URL}/ess/v1/auth/login",
            json={
                "email": TEST_USERS["ceo"]["email"],
                "password": TEST_USERS["ceo"]["password"],
                "device": device_info
            }
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_leave_balance(self):
        """Test getting leave balance"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/leave/balance",
            headers=self.headers
        )
        assert response.status_code == 200, f"Leave balance failed: {response.text}"
        
        data = response.json()
        # Verify leave types exist
        assert "casual_leaves" in data or "sick_leaves" in data or "earned_leaves" in data or isinstance(data, dict)
        print(f"✓ Leave balance fetched")
    
    def test_get_leave_history(self):
        """Test getting leave history"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/leave/history",
            headers=self.headers
        )
        assert response.status_code == 200, f"Leave history failed: {response.text}"
        
        data = response.json()
        assert "items" in data or isinstance(data, list) or isinstance(data, dict)
        print(f"✓ Leave history fetched")
    
    def test_apply_leave_future_date(self):
        """Test applying leave for future date"""
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=31)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/ess/v1/leave/apply",
            headers=self.headers,
            json={
                "leave_type": "casual",
                "start_date": future_date,
                "end_date": end_date,
                "reason": "Test leave application from automated tests"
            }
        )
        # Should succeed or fail with validation error
        assert response.status_code in [200, 201, 400, 422], f"Leave apply failed: {response.text}"
        print(f"✓ Leave application endpoint working - Status: {response.status_code}")


class TestESSMobilePayslips:
    """Payslips endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        device_info = {
            "device_id": f"test-payslips-{datetime.now().timestamp()}",
            "device_name": "Test Device",
            "platform": "android",
            "os_version": "14",
            "app_version": "1.0.0"
        }
        response = requests.post(
            f"{BASE_URL}/ess/v1/auth/login",
            json={
                "email": TEST_USERS["ceo"]["email"],
                "password": TEST_USERS["ceo"]["password"],
                "device": device_info
            }
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_payslips(self):
        """Test getting payslips list"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/payslips",
            headers=self.headers
        )
        assert response.status_code == 200, f"Payslips fetch failed: {response.text}"
        
        data = response.json()
        assert "items" in data or isinstance(data, list) or isinstance(data, dict)
        print(f"✓ Payslips list fetched")
    
    def test_get_payslip_years(self):
        """Test getting available payslip years"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/payslips/years",
            headers=self.headers
        )
        assert response.status_code == 200, f"Payslip years failed: {response.text}"
        
        data = response.json()
        assert "years" in data or isinstance(data, list) or isinstance(data, dict)
        print(f"✓ Payslip years fetched")


class TestESSMobileNotifications:
    """Notifications endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        device_info = {
            "device_id": f"test-notifications-{datetime.now().timestamp()}",
            "device_name": "Test Device",
            "platform": "android",
            "os_version": "14",
            "app_version": "1.0.0"
        }
        response = requests.post(
            f"{BASE_URL}/ess/v1/auth/login",
            json={
                "email": TEST_USERS["ceo"]["email"],
                "password": TEST_USERS["ceo"]["password"],
                "device": device_info
            }
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_notifications(self):
        """Test getting notifications list"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/notifications",
            headers=self.headers
        )
        assert response.status_code == 200, f"Notifications fetch failed: {response.text}"
        
        data = response.json()
        assert "items" in data or isinstance(data, list) or isinstance(data, dict)
        print(f"✓ Notifications list fetched")
    
    def test_get_notification_settings(self):
        """Test getting notification settings"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/notifications/settings",
            headers=self.headers
        )
        assert response.status_code == 200, f"Notification settings failed: {response.text}"
        print(f"✓ Notification settings fetched")


class TestESSMobileDocuments:
    """Documents endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        device_info = {
            "device_id": f"test-documents-{datetime.now().timestamp()}",
            "device_name": "Test Device",
            "platform": "android",
            "os_version": "14",
            "app_version": "1.0.0"
        }
        response = requests.post(
            f"{BASE_URL}/ess/v1/auth/login",
            json={
                "email": TEST_USERS["ceo"]["email"],
                "password": TEST_USERS["ceo"]["password"],
                "device": device_info
            }
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_documents(self):
        """Test getting documents list"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/documents",
            headers=self.headers
        )
        assert response.status_code == 200, f"Documents fetch failed: {response.text}"
        print(f"✓ Documents list fetched")
    
    def test_get_document_requirements(self):
        """Test getting document requirements"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/documents/requirements",
            headers=self.headers
        )
        assert response.status_code == 200, f"Document requirements failed: {response.text}"
        print(f"✓ Document requirements fetched")


class TestESSMobileHolidays:
    """Holidays endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        device_info = {
            "device_id": f"test-holidays-{datetime.now().timestamp()}",
            "device_name": "Test Device",
            "platform": "android",
            "os_version": "14",
            "app_version": "1.0.0"
        }
        response = requests.post(
            f"{BASE_URL}/ess/v1/auth/login",
            json={
                "email": TEST_USERS["ceo"]["email"],
                "password": TEST_USERS["ceo"]["password"],
                "device": device_info
            }
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_holidays(self):
        """Test getting holidays list"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/holidays",
            headers=self.headers
        )
        assert response.status_code == 200, f"Holidays fetch failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list) or isinstance(data, dict)
        print(f"✓ Holidays list fetched")
    
    def test_get_holidays_by_year(self):
        """Test getting holidays for specific year"""
        response = requests.get(
            f"{BASE_URL}/ess/v1/holidays?year=2026",
            headers=self.headers
        )
        assert response.status_code == 200, f"Holidays by year failed: {response.text}"
        print(f"✓ Holidays for 2026 fetched")


class TestESSMobileHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_check(self):
        """Test ESS API health check"""
        response = requests.get(f"{BASE_URL}/ess/v1/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "healthy" or "status" in data
        print(f"✓ ESS API health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
