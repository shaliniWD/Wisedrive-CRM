"""
Comprehensive ESS Data Sync Test - Testing ALL fields between CRM and ESS Mobile App
Tests for:
- Personal Profile: name, email, phone, employee_code, department, role, country, team, date_of_joining, reporting_manager
- Bank Details: bank_name, account_number (masked), ifsc_code, account_holder_name
- Salary: basic_salary, hra, variable_pay, conveyance, medical, special_allowance, pf_employee, professional_tax, income_tax, other_deductions, gross_salary, net_salary
- Photo URL sync
- Edit employee in CRM and verify changes in ESS
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
HR_EMAIL = "hr@wisedrive.com"
HR_PASSWORD = "password123"
ADMIN_EMAIL = "kalyan@wisedrive.com"
ADMIN_PASSWORD = "password123"

# Test employee data - will be created during test
TEST_EMPLOYEE_EMAIL = f"test_employee_{uuid.uuid4().hex[:8]}@wisedrive.com"
TEST_EMPLOYEE_DATA = {
    "name": "Test Employee Full Fields",
    "email": TEST_EMPLOYEE_EMAIL,
    "phone": "+91-9876543210",
    "employee_code": f"EMP-TEST-{uuid.uuid4().hex[:6].upper()}",
    "photo_url": "https://storage.wisedrive.com/photos/test-employee.jpg",
    "date_of_birth": "1990-05-15",
    "gender": "male",
    "blood_group": "O+",
    "emergency_contact_name": "Emergency Contact",
    "emergency_contact_phone": "+91-9876543211",
    "employment_type": "permanent",
    "employment_status": "active",
    # Bank details
    "bank_name": "HDFC Bank",
    "bank_account_number": "50100123456789",
    "ifsc_code": "HDFC0001234",
    "account_holder_name": "Test Employee Full Fields",
}

# Test salary structure
TEST_SALARY_DATA = {
    "basic_salary": 50000,
    "hra": 20000,
    "variable_pay": 10000,
    "conveyance_allowance": 3000,
    "medical_allowance": 2500,
    "special_allowance": 5000,
    "pf_employee": 6000,
    "professional_tax": 200,
    "income_tax": 5000,
    "other_deductions": 500,
}

# Test device info for ESS login
TEST_DEVICE = {
    "device_id": f"test-device-comprehensive-{uuid.uuid4()}",
    "device_name": "Test Device Comprehensive",
    "platform": "android",
    "os_version": "14.0",
    "app_version": "1.0.0"
}


class TestCRMAuthentication:
    """Test CRM authentication"""
    
    def test_crm_login_admin(self):
        """Login as admin to CRM"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"CRM admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
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


class TestCreateTestEmployeeWithAllFields:
    """Create a test employee with ALL fields populated in CRM"""
    
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
    def setup_data(self, crm_token):
        """Get required IDs for employee creation"""
        headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Get roles
        roles_resp = requests.get(f"{BASE_URL}/api/roles", headers=headers)
        roles = roles_resp.json() if roles_resp.status_code == 200 else []
        
        # Get departments
        depts_resp = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        departments = depts_resp.json() if depts_resp.status_code == 200 else []
        
        # Get countries
        countries_resp = requests.get(f"{BASE_URL}/api/countries", headers=headers)
        countries = countries_resp.json() if countries_resp.status_code == 200 else []
        
        # Get teams
        teams_resp = requests.get(f"{BASE_URL}/api/teams", headers=headers)
        teams = teams_resp.json() if teams_resp.status_code == 200 else []
        
        # Get users for reporting manager
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=headers)
        users = users_resp.json() if users_resp.status_code == 200 else []
        
        return {
            "roles": roles,
            "departments": departments,
            "countries": countries,
            "teams": teams,
            "users": users
        }
    
    def test_create_employee_with_all_fields(self, crm_token, setup_data):
        """Create a test employee with ALL fields populated"""
        headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Select first available options
        role_id = setup_data["roles"][0]["id"] if setup_data["roles"] else None
        dept_id = setup_data["departments"][0]["id"] if setup_data["departments"] else None
        country_id = setup_data["countries"][0]["id"] if setup_data["countries"] else None
        team_id = setup_data["teams"][0]["id"] if setup_data["teams"] else None
        
        # Get admin user as reporting manager
        admin_user = next((u for u in setup_data["users"] if u.get("email") == ADMIN_EMAIL), None)
        reporting_manager_id = admin_user["id"] if admin_user else None
        
        # Create employee with all fields
        employee_data = {
            **TEST_EMPLOYEE_DATA,
            "role_id": role_id,
            "department_id": dept_id,
            "country_id": country_id,
            "team_id": team_id,
            "reporting_manager_id": reporting_manager_id,
            "joining_date": "2024-06-01",
            "password": "password123"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/hr/employees",
            headers=headers,
            json=employee_data
        )
        
        assert response.status_code in [200, 201], f"Create employee failed: {response.text}"
        created_employee = response.json()
        
        print(f"✓ Created test employee: {created_employee.get('name')}")
        print(f"  - ID: {created_employee.get('id')}")
        print(f"  - Email: {created_employee.get('email')}")
        print(f"  - Employee Code: {created_employee.get('employee_code')}")
        print(f"  - Role ID: {created_employee.get('role_id')}")
        print(f"  - Department ID: {created_employee.get('department_id')}")
        print(f"  - Country ID: {created_employee.get('country_id')}")
        print(f"  - Team ID: {created_employee.get('team_id')}")
        print(f"  - Reporting Manager ID: {created_employee.get('reporting_manager_id')}")
        print(f"  - Joining Date: {created_employee.get('joining_date')}")
        print(f"  - Photo URL: {created_employee.get('photo_url')}")
        
        return created_employee


class TestESSMobileAppLogin:
    """Test ESS Mobile App login for test employee"""
    
    def test_ess_login_hr_user(self):
        """Login as HR user to ESS Mobile API"""
        response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-ess-hr-{uuid.uuid4()}"}
        })
        assert response.status_code == 200, f"ESS login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        print(f"✓ ESS login successful: {data['user']['name']}")
        return data


class TestVerifyPersonalProfileFields:
    """Verify Personal Profile fields in ESS API"""
    
    @pytest.fixture
    def ess_token(self):
        """Get ESS access token for HR user"""
        response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-profile-{uuid.uuid4()}"}
        })
        if response.status_code != 200:
            pytest.skip(f"ESS login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_profile_id_field(self, ess_token):
        """Test profile returns id field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data, "id field missing"
        assert data["id"] is not None, "id should not be null"
        print(f"✓ id: {data['id']}")
    
    def test_profile_name_field(self, ess_token):
        """Test profile returns name field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "name" in data, "name field missing"
        assert data["name"] is not None, "name should not be null"
        print(f"✓ name: {data['name']}")
    
    def test_profile_email_field(self, ess_token):
        """Test profile returns email field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data, "email field missing"
        assert data["email"] is not None, "email should not be null"
        print(f"✓ email: {data['email']}")
    
    def test_profile_phone_field(self, ess_token):
        """Test profile returns phone field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "phone" in data, "phone field missing"
        print(f"✓ phone: {data.get('phone')}")
    
    def test_profile_employee_code_field(self, ess_token):
        """Test profile returns employee_code field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "employee_code" in data, "employee_code field missing"
        print(f"✓ employee_code: {data.get('employee_code')}")
    
    def test_profile_department_name_field(self, ess_token):
        """Test profile returns department_name field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "department_name" in data, "department_name field missing"
        print(f"✓ department_name: {data.get('department_name')}")
    
    def test_profile_role_name_field(self, ess_token):
        """Test profile returns role_name field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "role_name" in data, "role_name field missing"
        print(f"✓ role_name: {data.get('role_name')}")
    
    def test_profile_country_name_field(self, ess_token):
        """Test profile returns country_name field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "country_name" in data, "country_name field missing"
        print(f"✓ country_name: {data.get('country_name')}")
    
    def test_profile_team_name_field(self, ess_token):
        """Test profile returns team_name field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "team_name" in data, "team_name field missing"
        print(f"✓ team_name: {data.get('team_name')}")
    
    def test_profile_date_of_joining_field(self, ess_token):
        """Test profile returns date_of_joining field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "date_of_joining" in data, "date_of_joining field missing"
        print(f"✓ date_of_joining: {data.get('date_of_joining')}")
    
    def test_profile_reporting_manager_id_field(self, ess_token):
        """Test profile returns reporting_manager_id field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "reporting_manager_id" in data, "reporting_manager_id field missing"
        print(f"✓ reporting_manager_id: {data.get('reporting_manager_id')}")
    
    def test_profile_reporting_manager_name_field(self, ess_token):
        """Test profile returns reporting_manager_name field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "reporting_manager_name" in data, "reporting_manager_name field missing"
        print(f"✓ reporting_manager_name: {data.get('reporting_manager_name')}")
    
    def test_profile_photo_url_field(self, ess_token):
        """Test profile returns photo_url field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "photo_url" in data, "photo_url field missing"
        print(f"✓ photo_url: {data.get('photo_url')}")
    
    def test_profile_all_fields_summary(self, ess_token):
        """Test profile returns all required fields - summary"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "id", "name", "email", "phone", "employee_code",
            "photo_url", "department_name", "role_name", "country_name", "team_name",
            "date_of_joining", "reporting_manager_id", "reporting_manager_name",
            "employment_type", "employment_status"
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        if missing_fields:
            print(f"⚠ Missing fields: {missing_fields}")
        
        assert len(missing_fields) == 0, f"Missing profile fields: {missing_fields}"
        print(f"✓ All {len(required_fields)} profile fields present")


class TestVerifyBankDetailsFields:
    """Verify Bank Details fields in ESS API"""
    
    @pytest.fixture
    def ess_token(self):
        """Get ESS access token"""
        response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-bank-{uuid.uuid4()}"}
        })
        if response.status_code != 200:
            pytest.skip(f"ESS login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_bank_details_endpoint_accessible(self, ess_token):
        """Test bank details endpoint is accessible"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/bank-details", headers=headers)
        assert response.status_code in [200, 404], f"Bank details endpoint error: {response.text}"
        print(f"✓ Bank details endpoint accessible, status: {response.status_code}")
    
    def test_bank_name_field(self, ess_token):
        """Test bank details returns bank_name field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/bank-details", headers=headers)
        if response.status_code == 404:
            pytest.skip("No bank details set")
        assert response.status_code == 200
        data = response.json()
        assert "bank_name" in data, "bank_name field missing"
        print(f"✓ bank_name: {data.get('bank_name')}")
    
    def test_account_number_masked_field(self, ess_token):
        """Test bank details returns account_number_masked field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/bank-details", headers=headers)
        if response.status_code == 404:
            pytest.skip("No bank details set")
        assert response.status_code == 200
        data = response.json()
        assert "account_number_masked" in data, "account_number_masked field missing"
        # Verify masking - should show only last 4 digits
        masked = data.get("account_number_masked")
        if masked:
            assert "X" in masked or "x" in masked or "*" in masked, "Account number should be masked"
        print(f"✓ account_number_masked: {data.get('account_number_masked')}")
    
    def test_ifsc_code_field(self, ess_token):
        """Test bank details returns ifsc_code field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/bank-details", headers=headers)
        if response.status_code == 404:
            pytest.skip("No bank details set")
        assert response.status_code == 200
        data = response.json()
        assert "ifsc_code" in data, "ifsc_code field missing"
        print(f"✓ ifsc_code: {data.get('ifsc_code')}")
    
    def test_account_holder_name_field(self, ess_token):
        """Test bank details returns account_holder_name field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/bank-details", headers=headers)
        if response.status_code == 404:
            pytest.skip("No bank details set")
        assert response.status_code == 200
        data = response.json()
        assert "account_holder_name" in data, "account_holder_name field missing"
        print(f"✓ account_holder_name: {data.get('account_holder_name')}")
    
    def test_bank_details_all_fields_summary(self, ess_token):
        """Test bank details returns all required fields - summary"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/bank-details", headers=headers)
        if response.status_code == 404:
            pytest.skip("No bank details set")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["bank_name", "account_number_masked", "ifsc_code", "account_holder_name"]
        
        missing_fields = []
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        assert len(missing_fields) == 0, f"Missing bank fields: {missing_fields}"
        print(f"✓ All {len(required_fields)} bank details fields present")


class TestVerifySalaryFields:
    """Verify Salary fields in ESS API"""
    
    @pytest.fixture
    def ess_token(self):
        """Get ESS access token"""
        response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-salary-{uuid.uuid4()}"}
        })
        if response.status_code != 200:
            pytest.skip(f"ESS login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_salary_endpoint_accessible(self, ess_token):
        """Test salary endpoint is accessible"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        assert response.status_code in [200, 404], f"Salary endpoint error: {response.text}"
        print(f"✓ Salary endpoint accessible, status: {response.status_code}")
    
    def test_basic_salary_field(self, ess_token):
        """Test salary returns basic_salary field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "basic_salary" in data, "basic_salary field missing"
        print(f"✓ basic_salary: {data.get('basic_salary')}")
    
    def test_hra_field(self, ess_token):
        """Test salary returns hra field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "hra" in data, "hra field missing"
        print(f"✓ hra: {data.get('hra')}")
    
    def test_variable_pay_field(self, ess_token):
        """Test salary returns variable_pay field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "variable_pay" in data, "variable_pay field missing"
        print(f"✓ variable_pay: {data.get('variable_pay')}")
    
    def test_conveyance_field(self, ess_token):
        """Test salary returns conveyance field (mapped from conveyance_allowance)"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "conveyance" in data, "conveyance field missing"
        print(f"✓ conveyance: {data.get('conveyance')}")
    
    def test_medical_field(self, ess_token):
        """Test salary returns medical field (mapped from medical_allowance)"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "medical" in data, "medical field missing"
        print(f"✓ medical: {data.get('medical')}")
    
    def test_special_allowance_field(self, ess_token):
        """Test salary returns special_allowance field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "special_allowance" in data, "special_allowance field missing"
        print(f"✓ special_allowance: {data.get('special_allowance')}")
    
    def test_pf_employee_field(self, ess_token):
        """Test salary returns pf_employee field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "pf_employee" in data, "pf_employee field missing"
        print(f"✓ pf_employee: {data.get('pf_employee')}")
    
    def test_professional_tax_field(self, ess_token):
        """Test salary returns professional_tax field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "professional_tax" in data, "professional_tax field missing"
        print(f"✓ professional_tax: {data.get('professional_tax')}")
    
    def test_income_tax_field(self, ess_token):
        """Test salary returns income_tax field (mapped from tds)"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "income_tax" in data, "income_tax field missing"
        print(f"✓ income_tax: {data.get('income_tax')}")
    
    def test_other_deductions_field(self, ess_token):
        """Test salary returns other_deductions field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "other_deductions" in data, "other_deductions field missing"
        print(f"✓ other_deductions: {data.get('other_deductions')}")
    
    def test_gross_salary_field(self, ess_token):
        """Test salary returns gross_salary field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "gross_salary" in data, "gross_salary field missing"
        print(f"✓ gross_salary: {data.get('gross_salary')}")
    
    def test_net_salary_field(self, ess_token):
        """Test salary returns net_salary field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "net_salary" in data, "net_salary field missing"
        print(f"✓ net_salary: {data.get('net_salary')}")
    
    def test_currency_fields(self, ess_token):
        """Test salary returns currency and currency_symbol fields"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        assert "currency" in data, "currency field missing"
        assert "currency_symbol" in data, "currency_symbol field missing"
        print(f"✓ currency: {data.get('currency')}, symbol: {data.get('currency_symbol')}")
    
    def test_salary_all_fields_summary(self, ess_token):
        """Test salary returns all required fields - summary"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        if response.status_code == 404:
            pytest.skip("No salary structure set")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "basic_salary", "hra", "variable_pay", "conveyance", "medical", "special_allowance",
            "pf_employee", "professional_tax", "income_tax", "other_deductions",
            "gross_salary", "net_salary", "currency", "currency_symbol"
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        assert len(missing_fields) == 0, f"Missing salary fields: {missing_fields}"
        print(f"✓ All {len(required_fields)} salary fields present")


class TestEditEmployeeAndVerifySync:
    """Test editing employee in CRM and verifying changes in ESS"""
    
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
    
    def test_edit_photo_url_and_verify_sync(self, crm_token, hr_user_id):
        """Edit photo_url in CRM and verify it syncs to ESS"""
        crm_headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Step 1: Update photo_url in CRM
        new_photo_url = f"https://storage.wisedrive.com/photos/updated-{uuid.uuid4()}.jpg"
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=crm_headers,
            json={"photo_url": new_photo_url}
        )
        assert response.status_code == 200, f"CRM update failed: {response.text}"
        print(f"✓ Updated photo_url in CRM: {new_photo_url}")
        
        # Step 2: Login to ESS and verify
        ess_login = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-edit-photo-{uuid.uuid4()}"}
        })
        assert ess_login.status_code == 200
        ess_token = ess_login.json()["access_token"]
        
        ess_headers = {"Authorization": f"Bearer {ess_token}"}
        profile = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=ess_headers)
        assert profile.status_code == 200
        
        assert profile.json().get("photo_url") == new_photo_url, "photo_url not synced to ESS"
        print(f"✓ Verified photo_url in ESS: {profile.json().get('photo_url')}")
    
    def test_edit_joining_date_and_verify_sync(self, crm_token, hr_user_id):
        """Edit joining_date in CRM and verify it syncs to ESS as date_of_joining"""
        crm_headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Step 1: Update joining_date in CRM
        new_date = "2024-07-15"
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=crm_headers,
            json={"joining_date": new_date}
        )
        assert response.status_code == 200, f"CRM update failed: {response.text}"
        print(f"✓ Updated joining_date in CRM: {new_date}")
        
        # Step 2: Login to ESS and verify
        ess_login = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-edit-date-{uuid.uuid4()}"}
        })
        assert ess_login.status_code == 200
        ess_token = ess_login.json()["access_token"]
        
        ess_headers = {"Authorization": f"Bearer {ess_token}"}
        profile = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=ess_headers)
        assert profile.status_code == 200
        
        assert profile.json().get("date_of_joining") == new_date, "date_of_joining not synced to ESS"
        print(f"✓ Verified date_of_joining in ESS: {profile.json().get('date_of_joining')}")
    
    def test_edit_reporting_manager_and_verify_sync(self, crm_token, hr_user_id):
        """Edit reporting_manager_id in CRM and verify it syncs to ESS"""
        crm_headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Get admin user ID
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=crm_headers)
        users = users_resp.json()
        admin_user = next((u for u in users if u.get("email") == ADMIN_EMAIL), None)
        if not admin_user:
            pytest.skip("Admin user not found")
        
        # Step 1: Update reporting_manager_id in CRM
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=crm_headers,
            json={"reporting_manager_id": admin_user["id"]}
        )
        assert response.status_code == 200, f"CRM update failed: {response.text}"
        print(f"✓ Updated reporting_manager_id in CRM: {admin_user['id']}")
        
        # Step 2: Login to ESS and verify
        ess_login = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-edit-manager-{uuid.uuid4()}"}
        })
        assert ess_login.status_code == 200
        ess_token = ess_login.json()["access_token"]
        
        ess_headers = {"Authorization": f"Bearer {ess_token}"}
        profile = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=ess_headers)
        assert profile.status_code == 200
        
        assert profile.json().get("reporting_manager_id") == admin_user["id"], "reporting_manager_id not synced"
        assert profile.json().get("reporting_manager_name") is not None, "reporting_manager_name should be populated"
        print(f"✓ Verified reporting_manager in ESS: {profile.json().get('reporting_manager_name')}")
    
    def test_edit_bank_details_and_verify_sync(self, crm_token, hr_user_id):
        """Edit bank details in CRM and verify they sync to ESS"""
        crm_headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Step 1: Update bank details in CRM
        new_bank_data = {
            "bank_name": "ICICI Bank",
            "bank_account_number": "9876543210123",
            "ifsc_code": "ICIC0001234",
            "account_holder_name": "HR Test User Updated"
        }
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}",
            headers=crm_headers,
            json=new_bank_data
        )
        assert response.status_code == 200, f"CRM update failed: {response.text}"
        print(f"✓ Updated bank details in CRM")
        
        # Step 2: Login to ESS and verify
        ess_login = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-edit-bank-{uuid.uuid4()}"}
        })
        assert ess_login.status_code == 200
        ess_token = ess_login.json()["access_token"]
        
        ess_headers = {"Authorization": f"Bearer {ess_token}"}
        bank_details = requests.get(f"{BASE_URL}/api/ess/v1/profile/bank-details", headers=ess_headers)
        
        if bank_details.status_code == 200:
            data = bank_details.json()
            assert data.get("bank_name") == new_bank_data["bank_name"], "bank_name not synced"
            assert data.get("ifsc_code") == new_bank_data["ifsc_code"], "ifsc_code not synced"
            assert data.get("account_holder_name") == new_bank_data["account_holder_name"], "account_holder_name not synced"
            # Account number should be masked
            assert "X" in data.get("account_number_masked", "") or "x" in data.get("account_number_masked", ""), "Account should be masked"
            print(f"✓ Verified bank details in ESS: {data}")
        else:
            print(f"⚠ Bank details endpoint returned {bank_details.status_code}")


class TestSalaryComponentSync:
    """Test salary component fields sync between CRM and ESS"""
    
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
    
    def test_update_salary_with_conveyance_and_medical(self, crm_token, hr_user_id):
        """Update salary structure with conveyance_allowance and medical_allowance"""
        crm_headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Create/update salary structure using correct endpoint
        salary_data = {
            "basic_salary": 55000,
            "hra": 22000,
            "variable_pay": 12000,
            "conveyance_allowance": 4000,  # CRM field name
            "medical_allowance": 3500,      # CRM field name
            "special_allowance": 6000,
            "pf_employee": 6600,
            "professional_tax": 200,
            "income_tax": 5500,
            "other_deductions": 300,
            "effective_from": "2024-01-01"
        }
        
        # Use the correct endpoint: /api/hr/employees/{employee_id}/salary
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{hr_user_id}/salary",
            headers=crm_headers,
            json=salary_data
        )
        
        # Accept both 200 and 201 as success
        assert response.status_code in [200, 201], f"Salary update failed: {response.text}"
        print(f"✓ Updated salary structure in CRM with conveyance_allowance={salary_data['conveyance_allowance']}, medical_allowance={salary_data['medical_allowance']}")
        
        # Verify in ESS
        ess_login = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD,
            "device": {**TEST_DEVICE, "device_id": f"test-salary-sync-{uuid.uuid4()}"}
        })
        assert ess_login.status_code == 200
        ess_token = ess_login.json()["access_token"]
        
        ess_headers = {"Authorization": f"Bearer {ess_token}"}
        salary_resp = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=ess_headers)
        
        if salary_resp.status_code == 200:
            salary = salary_resp.json()
            # ESS uses 'conveyance' and 'medical' field names
            assert salary.get("conveyance") == salary_data["conveyance_allowance"], f"conveyance not synced: {salary.get('conveyance')}"
            assert salary.get("medical") == salary_data["medical_allowance"], f"medical not synced: {salary.get('medical')}"
            print(f"✓ Verified in ESS: conveyance={salary.get('conveyance')}, medical={salary.get('medical')}")
        else:
            print(f"⚠ Salary endpoint returned {salary_resp.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
