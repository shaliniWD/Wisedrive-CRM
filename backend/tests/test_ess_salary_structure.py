"""
ESS Mobile API - Salary Structure Tests
Tests for salary API returning individual earnings/deductions fields matching CRM structure
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "kalyan@wisedrive.com"
TEST_USER_PASSWORD = "password123"
DEVICE_INFO = {
    "device_id": "test-salary-device-001",
    "device_name": "Test Device",
    "platform": "android",
    "os_version": "14.0",
    "app_version": "1.0.0"
}


class TestESSAuth:
    """Authentication tests for ESS Mobile API"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/ess/v1/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
                "device": DEVICE_INFO
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0
        
        # Verify user data
        assert data["user"]["email"] == TEST_USER_EMAIL
        assert "id" in data["user"]
        assert "name" in data["user"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/ess/v1/auth/login",
            json={
                "email": "invalid@example.com",
                "password": "wrongpassword",
                "device": DEVICE_INFO
            }
        )
        assert response.status_code == 401


class TestESSSalaryAPI:
    """Tests for salary API with individual earnings/deductions fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/ess/v1/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
                "device": DEVICE_INFO
            }
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_salary_returns_individual_earnings_fields(self):
        """Test salary API returns individual earnings fields matching CRM structure"""
        response = requests.get(
            f"{BASE_URL}/api/ess/v1/profile/salary",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all individual earnings fields are present
        assert "basic_salary" in data, "Missing basic_salary field"
        assert "hra" in data, "Missing hra field"
        assert "variable_pay" in data, "Missing variable_pay field"
        assert "conveyance" in data, "Missing conveyance field"
        assert "medical" in data, "Missing medical field"
        assert "special_allowance" in data, "Missing special_allowance field"
        
        # Verify gross and net salary
        assert "gross_salary" in data
        assert "net_salary" in data
        assert "currency" in data
        assert "currency_symbol" in data
    
    def test_salary_returns_individual_deductions_fields(self):
        """Test salary API returns individual deductions fields matching CRM structure"""
        response = requests.get(
            f"{BASE_URL}/api/ess/v1/profile/salary",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all individual deductions fields are present
        assert "pf_employee" in data, "Missing pf_employee field"
        assert "professional_tax" in data, "Missing professional_tax field"
        assert "income_tax" in data, "Missing income_tax field"
        assert "other_deductions" in data, "Missing other_deductions field"
    
    def test_salary_values_are_numeric(self):
        """Test all salary values are numeric (float or int)"""
        response = requests.get(
            f"{BASE_URL}/api/ess/v1/profile/salary",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        numeric_fields = [
            "gross_salary", "net_salary", "basic_salary", "hra",
            "variable_pay", "conveyance", "medical", "special_allowance",
            "pf_employee", "professional_tax", "income_tax", "other_deductions"
        ]
        
        for field in numeric_fields:
            if data.get(field) is not None:
                assert isinstance(data[field], (int, float)), f"{field} should be numeric"
    
    def test_salary_gross_calculation(self):
        """Test gross salary equals sum of earnings"""
        response = requests.get(
            f"{BASE_URL}/api/ess/v1/profile/salary",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Calculate expected gross
        expected_gross = (
            (data.get("basic_salary") or 0) +
            (data.get("hra") or 0) +
            (data.get("variable_pay") or 0) +
            (data.get("conveyance") or 0) +
            (data.get("medical") or 0) +
            (data.get("special_allowance") or 0)
        )
        
        # Allow small floating point difference
        assert abs(data["gross_salary"] - expected_gross) < 1, \
            f"Gross salary {data['gross_salary']} doesn't match calculated {expected_gross}"
    
    def test_salary_unauthorized_access(self):
        """Test salary API returns 401 without auth token"""
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary")
        assert response.status_code in [401, 403]


class TestESSProfile:
    """Tests for profile API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/ess/v1/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
                "device": DEVICE_INFO
            }
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_profile_returns_employee_data(self):
        """Test profile API returns employee data"""
        response = requests.get(
            f"{BASE_URL}/api/ess/v1/profile",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "id" in data
        assert "name" in data
        assert "email" in data
        assert data["email"] == TEST_USER_EMAIL


class TestESSLeaveBalance:
    """Tests for leave balance API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/ess/v1/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
                "device": DEVICE_INFO
            }
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_leave_balance_returns_all_types(self):
        """Test leave balance returns all leave types"""
        response = requests.get(
            f"{BASE_URL}/api/ess/v1/leave/balance",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify leave types
        assert "casual_leaves" in data
        assert "sick_leaves" in data
        assert "earned_leaves" in data
        
        # Verify structure of each leave type
        for leave_type in ["casual_leaves", "sick_leaves", "earned_leaves"]:
            assert "total" in data[leave_type]
            assert "used" in data[leave_type]
            assert "available" in data[leave_type]


class TestESSHolidays:
    """Tests for holidays API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/ess/v1/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
                "device": DEVICE_INFO
            }
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_holidays_returns_list(self):
        """Test holidays API returns list of holidays"""
        response = requests.get(
            f"{BASE_URL}/api/ess/v1/holidays",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "holidays" in data
        assert "year" in data
        assert isinstance(data["holidays"], list)
        
        # Verify holiday structure if any exist
        if len(data["holidays"]) > 0:
            holiday = data["holidays"][0]
            assert "name" in holiday
            assert "date" in holiday


class TestESSHealthCheck:
    """Tests for ESS API health check"""
    
    def test_health_check(self):
        """Test ESS API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/ess/v1/health")
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert data["service"] == "ess-mobile-api"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
