"""
Test ESS Data Sync - Testing field mapping between CRM and ESS Mobile App
Tests for: photo_url, bank_details, joining_date, conveyance/medical allowance, reporting_manager
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
HR_EMAIL = "hr@wisedrive.com"
HR_PASSWORD = "password123"
ADMIN_EMAIL = "kalyan@wisedrive.com"
ADMIN_PASSWORD = "password123"

# Test device info for ESS login
TEST_DEVICE = {
    "device_id": f"test-device-{uuid.uuid4()}",
    "device_name": "Test Device",
    "platform": "android",
    "os_version": "14.0",
    "app_version": "1.0.0"
}


class TestCRMLogin:
    """Test CRM login to get auth token for employee updates"""
    
    def test_crm_login_admin(self):
        """Login as admin to CRM"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"CRM login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ CRM Admin login successful: {data['user']['name']}")
        return data["access_token"]
    
    def test_crm_login_hr(self):
        """Login as HR to CRM"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD
        })
        assert response.status_code == 200, f"CRM HR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ CRM HR login successful: {data['user']['name']}")
        return data["access_token"]


class TestESSLogin:
    """Test ESS Mobile App login"""
    
    def test_ess_login_hr(self):
        """Login as HR user to ESS Mobile API"""
        response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": TEST_DEVICE
        })
        assert response.status_code == 200, f"ESS login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        print(f"✓ ESS login successful: {data['user']['name']}")
        return data["access_token"]
    
    def test_ess_login_admin(self):
        """Login as admin user to ESS Mobile API"""
        response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-device-admin-{uuid.uuid4()}"}
        })
        assert response.status_code == 200, f"ESS admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ ESS admin login successful: {data['user']['name']}")
        return data["access_token"]


class TestESSProfileEndpoint:
    """Test ESS Profile endpoint returns all required fields"""
    
    @pytest.fixture
    def ess_token(self):
        """Get ESS access token"""
        response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-device-profile-{uuid.uuid4()}"}
        })
        if response.status_code != 200:
            pytest.skip(f"ESS login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_profile_returns_all_fields(self, ess_token):
        """Test GET /api/ess/v1/profile returns all required fields"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"
        data = response.json()
        
        # Check required fields exist in response (may be null if not set)
        required_fields = [
            "id", "employee_code", "name", "email", "phone",
            "photo_url",  # Issue 1: Employee photo
            "date_of_joining",  # Issue 3: Joining date
            "reporting_manager_id",  # Issue 5: Reporting Manager
            "reporting_manager_name",  # Issue 5: Reporting Manager name
            "department_name", "role_name", "employment_status"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
            print(f"  ✓ Field '{field}' present: {data.get(field)}")
        
        print(f"✓ Profile endpoint returns all required fields")
        return data
    
    def test_profile_photo_url_field(self, ess_token):
        """Test that photo_url field is returned in profile"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # photo_url should be in response (can be null)
        assert "photo_url" in data, "photo_url field missing from profile response"
        print(f"✓ photo_url field present: {data.get('photo_url')}")
    
    def test_profile_date_of_joining_field(self, ess_token):
        """Test that date_of_joining field is returned in profile"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # date_of_joining should be in response (can be null)
        assert "date_of_joining" in data, "date_of_joining field missing from profile response"
        print(f"✓ date_of_joining field present: {data.get('date_of_joining')}")
    
    def test_profile_reporting_manager_fields(self, ess_token):
        """Test that reporting_manager fields are returned in profile"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # reporting_manager fields should be in response (can be null)
        assert "reporting_manager_id" in data, "reporting_manager_id field missing"
        assert "reporting_manager_name" in data, "reporting_manager_name field missing"
        print(f"✓ reporting_manager_id: {data.get('reporting_manager_id')}")
        print(f"✓ reporting_manager_name: {data.get('reporting_manager_name')}")


class TestESSBankDetailsEndpoint:
    """Test ESS Bank Details endpoint - Issue 2: Bank details not reflecting"""
    
    @pytest.fixture
    def ess_token(self):
        """Get ESS access token"""
        response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-device-bank-{uuid.uuid4()}"}
        })
        if response.status_code != 200:
            pytest.skip(f"ESS login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_bank_details_endpoint_exists(self, ess_token):
        """Test GET /api/ess/v1/profile/bank-details endpoint exists"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/bank-details", headers=headers)
        
        # Should return 200 or 404 (if no bank details set), not 500
        assert response.status_code in [200, 404], f"Bank details endpoint error: {response.text}"
        print(f"✓ Bank details endpoint accessible, status: {response.status_code}")
    
    def test_bank_details_returns_required_fields(self, ess_token):
        """Test bank details returns all required fields"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/bank-details", headers=headers)
        
        if response.status_code == 404:
            print("⚠ No bank details found for user (expected if not set)")
            pytest.skip("No bank details set for test user")
        
        assert response.status_code == 200, f"Bank details fetch failed: {response.text}"
        data = response.json()
        
        # Check required fields
        required_fields = ["bank_name", "account_number_masked", "ifsc_code", "account_holder_name"]
        for field in required_fields:
            assert field in data, f"Missing bank field: {field}"
            print(f"  ✓ Bank field '{field}': {data.get(field)}")
        
        print(f"✓ Bank details endpoint returns all required fields")


class TestESSSalaryEndpoint:
    """Test ESS Salary endpoint - Issues 4: Conveyance and medical allowance"""
    
    @pytest.fixture
    def ess_token(self):
        """Get ESS access token"""
        response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-device-salary-{uuid.uuid4()}"}
        })
        if response.status_code != 200:
            pytest.skip(f"ESS login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_salary_endpoint_exists(self, ess_token):
        """Test GET /api/ess/v1/profile/salary endpoint exists"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        
        # Should return 200 or 404 (if no salary structure), not 500
        assert response.status_code in [200, 404], f"Salary endpoint error: {response.text}"
        print(f"✓ Salary endpoint accessible, status: {response.status_code}")
    
    def test_salary_returns_conveyance_and_medical(self, ess_token):
        """Test salary returns conveyance and medical allowance fields"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        
        if response.status_code == 404:
            print("⚠ No salary structure found for user")
            pytest.skip("No salary structure set for test user")
        
        assert response.status_code == 200, f"Salary fetch failed: {response.text}"
        data = response.json()
        
        # Check conveyance and medical fields exist
        assert "conveyance" in data, "conveyance field missing from salary response"
        assert "medical" in data, "medical field missing from salary response"
        
        print(f"✓ conveyance: {data.get('conveyance')}")
        print(f"✓ medical: {data.get('medical')}")
        
        # Check other salary fields
        salary_fields = ["gross_salary", "net_salary", "basic_salary", "hra", "variable_pay"]
        for field in salary_fields:
            if field in data:
                print(f"  ✓ {field}: {data.get(field)}")


class TestCRMEmployeeUpdate:
    """Test CRM Employee Update endpoint saves all fields correctly"""
    
    @pytest.fixture
    def crm_token(self):
        """Get CRM access token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"CRM login failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_user_id(self, crm_token):
        """Get HR user ID"""
        headers = {"Authorization": f"Bearer {crm_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        if response.status_code != 200:
            pytest.skip("Could not fetch users")
        
        users = response.json()
        hr_user = next((u for u in users if u.get("email") == HR_EMAIL), None)
        if not hr_user:
            pytest.skip("HR user not found")
        return hr_user["id"]
    
    def test_update_employee_photo_url(self, crm_token, hr_user_id):
        """Test CRM can update employee photo_url"""
        headers = {"Authorization": f"Bearer {crm_token}"}
        
        test_photo_url = f"https://example.com/photos/test-{uuid.uuid4()}.jpg"
        
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=headers,
            json={"photo_url": test_photo_url}
        )
        
        assert response.status_code == 200, f"Update photo_url failed: {response.text}"
        data = response.json()
        assert data.get("photo_url") == test_photo_url, "photo_url not saved correctly"
        print(f"✓ photo_url updated successfully: {test_photo_url}")
    
    def test_update_employee_joining_date(self, crm_token, hr_user_id):
        """Test CRM can update employee joining_date"""
        headers = {"Authorization": f"Bearer {crm_token}"}
        
        test_joining_date = "2024-01-15"
        
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=headers,
            json={"joining_date": test_joining_date}
        )
        
        assert response.status_code == 200, f"Update joining_date failed: {response.text}"
        data = response.json()
        # Check both field names (CRM uses joining_date)
        saved_date = data.get("joining_date") or data.get("date_of_joining")
        assert saved_date == test_joining_date, f"joining_date not saved correctly: {saved_date}"
        print(f"✓ joining_date updated successfully: {test_joining_date}")
    
    def test_update_employee_reporting_manager(self, crm_token, hr_user_id):
        """Test CRM can update employee reporting_manager_id"""
        headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Get admin user ID to set as reporting manager
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        users = response.json()
        admin_user = next((u for u in users if u.get("email") == ADMIN_EMAIL), None)
        
        if not admin_user:
            pytest.skip("Admin user not found")
        
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=headers,
            json={"reporting_manager_id": admin_user["id"]}
        )
        
        assert response.status_code == 200, f"Update reporting_manager failed: {response.text}"
        data = response.json()
        # Check both field names
        saved_manager = data.get("reporting_manager_id") or data.get("reports_to")
        assert saved_manager == admin_user["id"], f"reporting_manager_id not saved: {saved_manager}"
        print(f"✓ reporting_manager_id updated successfully: {admin_user['id']}")
    
    def test_update_employee_bank_details(self, crm_token, hr_user_id):
        """Test CRM can update employee bank details"""
        headers = {"Authorization": f"Bearer {crm_token}"}
        
        bank_data = {
            "bank_name": "Test Bank",
            "bank_account_number": "1234567890",
            "ifsc_code": "TEST0001234",
            "account_holder_name": "Test HR User"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=headers,
            json=bank_data
        )
        
        assert response.status_code == 200, f"Update bank details failed: {response.text}"
        data = response.json()
        
        assert data.get("bank_name") == bank_data["bank_name"], "bank_name not saved"
        assert data.get("ifsc_code") == bank_data["ifsc_code"], "ifsc_code not saved"
        print(f"✓ Bank details updated successfully")


class TestEndToEndDataSync:
    """End-to-end test: Update in CRM, verify in ESS"""
    
    @pytest.fixture
    def crm_token(self):
        """Get CRM access token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"CRM login failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_user_id(self, crm_token):
        """Get HR user ID"""
        headers = {"Authorization": f"Bearer {crm_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        if response.status_code != 200:
            pytest.skip("Could not fetch users")
        
        users = response.json()
        hr_user = next((u for u in users if u.get("email") == HR_EMAIL), None)
        if not hr_user:
            pytest.skip("HR user not found")
        return hr_user["id"]
    
    def test_e2e_photo_url_sync(self, crm_token, hr_user_id):
        """Test photo_url updated in CRM appears in ESS profile"""
        crm_headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Step 1: Update photo_url in CRM
        test_photo_url = f"https://storage.wisedrive.com/photos/test-{uuid.uuid4()}.jpg"
        
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=crm_headers,
            json={"photo_url": test_photo_url}
        )
        assert response.status_code == 200, f"CRM update failed: {response.text}"
        print(f"✓ Step 1: Updated photo_url in CRM: {test_photo_url}")
        
        # Step 2: Login to ESS and check profile
        ess_login = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-e2e-photo-{uuid.uuid4()}"}
        })
        assert ess_login.status_code == 200, f"ESS login failed: {ess_login.text}"
        ess_token = ess_login.json()["access_token"]
        
        ess_headers = {"Authorization": f"Bearer {ess_token}"}
        profile_response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=ess_headers)
        assert profile_response.status_code == 200, f"ESS profile failed: {profile_response.text}"
        
        profile = profile_response.json()
        assert profile.get("photo_url") == test_photo_url, f"photo_url not synced: {profile.get('photo_url')}"
        print(f"✓ Step 2: Verified photo_url in ESS profile: {profile.get('photo_url')}")
    
    def test_e2e_joining_date_sync(self, crm_token, hr_user_id):
        """Test joining_date updated in CRM appears as date_of_joining in ESS"""
        crm_headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Step 1: Update joining_date in CRM
        test_date = "2024-03-15"
        
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=crm_headers,
            json={"joining_date": test_date}
        )
        assert response.status_code == 200, f"CRM update failed: {response.text}"
        print(f"✓ Step 1: Updated joining_date in CRM: {test_date}")
        
        # Step 2: Login to ESS and check profile
        ess_login = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-e2e-date-{uuid.uuid4()}"}
        })
        assert ess_login.status_code == 200
        ess_token = ess_login.json()["access_token"]
        
        ess_headers = {"Authorization": f"Bearer {ess_token}"}
        profile_response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=ess_headers)
        assert profile_response.status_code == 200
        
        profile = profile_response.json()
        # ESS uses date_of_joining field name
        assert profile.get("date_of_joining") == test_date, f"date_of_joining not synced: {profile.get('date_of_joining')}"
        print(f"✓ Step 2: Verified date_of_joining in ESS profile: {profile.get('date_of_joining')}")
    
    def test_e2e_reporting_manager_sync(self, crm_token, hr_user_id):
        """Test reporting_manager updated in CRM appears in ESS"""
        crm_headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Get admin user to set as manager
        response = requests.get(f"{BASE_URL}/api/users", headers=crm_headers)
        users = response.json()
        admin_user = next((u for u in users if u.get("email") == ADMIN_EMAIL), None)
        
        if not admin_user:
            pytest.skip("Admin user not found")
        
        # Step 1: Update reporting_manager in CRM
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=crm_headers,
            json={"reporting_manager_id": admin_user["id"]}
        )
        assert response.status_code == 200, f"CRM update failed: {response.text}"
        print(f"✓ Step 1: Updated reporting_manager_id in CRM: {admin_user['id']}")
        
        # Step 2: Login to ESS and check profile
        ess_login = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-e2e-manager-{uuid.uuid4()}"}
        })
        assert ess_login.status_code == 200
        ess_token = ess_login.json()["access_token"]
        
        ess_headers = {"Authorization": f"Bearer {ess_token}"}
        profile_response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=ess_headers)
        assert profile_response.status_code == 200
        
        profile = profile_response.json()
        assert profile.get("reporting_manager_id") == admin_user["id"], f"reporting_manager_id not synced"
        assert profile.get("reporting_manager_name") is not None, "reporting_manager_name should be populated"
        print(f"✓ Step 2: Verified reporting_manager in ESS: {profile.get('reporting_manager_name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
