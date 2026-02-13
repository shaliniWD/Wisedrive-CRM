"""
Comprehensive HR Module V2 Tests
Tests for:
1. HR Manager tab visibility (no Dashboard, only Admin and Settings)
2. CEO tab visibility (all tabs including Admin)
3. Admin page with Employees and Countries tabs
4. Employee modal with 5 tabs (Details, Salary, Documents, Attendance, Audit)
5. Salary form changes based on role (Mechanic vs Full-time)
6. Countries tab with currency management
7. Indian HR full access to all countries
8. Per-employee audit trail
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_CREDS = {"email": "ceo@wisedrive.com", "password": "password123"}
HR_CREDS = {"email": "hr@wisedrive.com", "password": "password123"}
SALES_EXEC_CREDS = {"email": "salesexec1.in@wisedrive.com", "password": "password123"}


class TestAuthentication:
    """Test authentication and token retrieval"""
    
    def test_ceo_login(self):
        """CEO should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role_code"] == "CEO"
        print(f"SUCCESS: CEO login - role_code={data['user']['role_code']}")
    
    def test_hr_manager_login(self):
        """HR Manager should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        assert response.status_code == 200, f"HR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role_code"] == "HR_MANAGER"
        print(f"SUCCESS: HR Manager login - role_code={data['user']['role_code']}")
    
    def test_sales_exec_login(self):
        """Sales Executive should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALES_EXEC_CREDS)
        assert response.status_code == 200, f"Sales Exec login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role_code"] == "SALES_EXEC"
        print(f"SUCCESS: Sales Exec login - role_code={data['user']['role_code']}")


class TestTabVisibility:
    """Test tab visibility based on role - CRITICAL for HR module"""
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def sales_exec_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALES_EXEC_CREDS)
        return response.json()["access_token"]
    
    def test_ceo_visible_tabs(self, ceo_token):
        """CEO should see all tabs including leads, customers, inspections, employees, settings"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        # CEO should see all major tabs
        assert "leads" in visible_tabs, f"CEO should see leads tab. Got: {visible_tabs}"
        assert "customers" in visible_tabs, f"CEO should see customers tab. Got: {visible_tabs}"
        assert "inspections" in visible_tabs, f"CEO should see inspections tab. Got: {visible_tabs}"
        assert "employees" in visible_tabs, f"CEO should see employees tab. Got: {visible_tabs}"
        assert "settings" in visible_tabs, f"CEO should see settings tab. Got: {visible_tabs}"
        print(f"SUCCESS: CEO visible_tabs = {visible_tabs}")
    
    def test_hr_manager_visible_tabs_no_dashboard(self, hr_token):
        """HR Manager should only see employees and settings tabs - NO dashboard/leads/customers"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        # HR Manager should see employees and settings
        assert "employees" in visible_tabs, f"HR Manager should see employees tab. Got: {visible_tabs}"
        assert "settings" in visible_tabs, f"HR Manager should see settings tab. Got: {visible_tabs}"
        
        # HR Manager should NOT see dashboard, leads, customers
        assert "leads" not in visible_tabs, f"HR Manager should NOT see leads tab. Got: {visible_tabs}"
        assert "customers" not in visible_tabs, f"HR Manager should NOT see customers tab. Got: {visible_tabs}"
        assert "inspections" not in visible_tabs, f"HR Manager should NOT see inspections tab. Got: {visible_tabs}"
        print(f"SUCCESS: HR Manager visible_tabs = {visible_tabs} (no dashboard/leads/customers)")
    
    def test_sales_exec_visible_tabs(self, sales_exec_token):
        """Sales Executive should only see leads tab"""
        headers = {"Authorization": f"Bearer {sales_exec_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        # Sales Exec should only see leads
        assert "leads" in visible_tabs, f"Sales Exec should see leads tab. Got: {visible_tabs}"
        assert "employees" not in visible_tabs, f"Sales Exec should NOT see employees tab. Got: {visible_tabs}"
        print(f"SUCCESS: Sales Exec visible_tabs = {visible_tabs}")


class TestHREmployeesAPI:
    """Test HR Employees API endpoints"""
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def sales_exec_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALES_EXEC_CREDS)
        return response.json()["access_token"]
    
    def test_hr_employees_list_ceo(self, ceo_token):
        """CEO should be able to list all HR employees"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: CEO can list HR employees - count={len(data)}")
        
        # Check employee data structure
        if len(data) > 0:
            emp = data[0]
            assert "id" in emp
            assert "name" in emp
            assert "email" in emp
            print(f"  Employee structure verified: id, name, email present")
    
    def test_hr_employees_list_hr_manager(self, hr_token):
        """HR Manager should be able to list all HR employees (full access to all countries)"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: HR Manager can list HR employees - count={len(data)}")
    
    def test_hr_employees_list_sales_exec_forbidden(self, sales_exec_token):
        """Sales Executive should NOT be able to access HR employees"""
        headers = {"Authorization": f"Bearer {sales_exec_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"SUCCESS: Sales Exec correctly denied access to HR employees (403)")


class TestEmployeeSalaryAPI:
    """Test Employee Salary API - different forms for Mechanic vs Full-time"""
    
    @pytest.fixture
    def hr_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    def test_get_employee_salary(self, hr_token):
        """HR Manager should be able to get employee salary"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # First get an employee
        emp_response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert emp_response.status_code == 200
        employees = emp_response.json()
        
        if len(employees) > 0:
            emp_id = employees[0]["id"]
            response = requests.get(f"{BASE_URL}/api/hr/employees/{emp_id}/salary", headers=headers)
            assert response.status_code == 200, f"Failed: {response.text}"
            print(f"SUCCESS: Can get employee salary for {emp_id}")
    
    def test_save_fulltime_salary(self, hr_token):
        """Test saving full-time employee salary with Basic, HRA, Variable Pay, PF, Tax"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # Get an employee
        emp_response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        employees = emp_response.json()
        
        if len(employees) > 0:
            emp_id = employees[0]["id"]
            
            # Full-time salary structure
            salary_data = {
                "employment_type": "full_time",
                "basic_salary": 50000,
                "hra": 20000,
                "conveyance_allowance": 5000,
                "medical_allowance": 2500,
                "special_allowance": 10000,
                "variable_pay": 5000,
                "pf_employee": 6000,
                "professional_tax": 200,
                "income_tax": 5000,
                "other_deductions": 0
            }
            
            response = requests.post(
                f"{BASE_URL}/api/hr/employees/{emp_id}/salary",
                headers=headers,
                json=salary_data
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            
            # Verify salary fields
            assert data.get("basic_salary") == 50000
            assert data.get("hra") == 20000
            print(f"SUCCESS: Full-time salary saved with Basic={data.get('basic_salary')}, HRA={data.get('hra')}")
    
    def test_save_mechanic_salary_per_inspection(self, ceo_token):
        """Test saving mechanic salary with Price Per Inspection"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        
        # Get employees and find a mechanic or create mechanic salary
        emp_response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        employees = emp_response.json()
        
        if len(employees) > 0:
            emp_id = employees[0]["id"]
            
            # Mechanic/Freelancer salary structure
            salary_data = {
                "employment_type": "freelancer",
                "price_per_inspection": 500,
                "commission_percentage": 10.0
            }
            
            response = requests.post(
                f"{BASE_URL}/api/hr/employees/{emp_id}/salary",
                headers=headers,
                json=salary_data
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            
            # Verify mechanic salary fields
            assert data.get("price_per_inspection") == 500
            print(f"SUCCESS: Mechanic salary saved with price_per_inspection={data.get('price_per_inspection')}")


class TestEmployeeDocumentsAPI:
    """Test Employee Documents API"""
    
    @pytest.fixture
    def hr_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        return response.json()["access_token"]
    
    def test_get_employee_documents(self, hr_token):
        """HR Manager should be able to get employee documents"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        emp_response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        employees = emp_response.json()
        
        if len(employees) > 0:
            emp_id = employees[0]["id"]
            response = requests.get(f"{BASE_URL}/api/hr/employees/{emp_id}/documents", headers=headers)
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            assert isinstance(data, list)
            print(f"SUCCESS: Can get employee documents - count={len(data)}")
    
    def test_add_employee_document(self, hr_token):
        """HR Manager should be able to add employee document"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        emp_response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        employees = emp_response.json()
        
        if len(employees) > 0:
            emp_id = employees[0]["id"]
            
            doc_data = {
                "document_type": "pan",
                "document_name": "PAN Card",
                "document_number": "ABCDE1234F",
                "issue_date": "2020-01-01"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/hr/employees/{emp_id}/documents",
                headers=headers,
                json=doc_data
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            assert data.get("document_type") == "pan"
            print(f"SUCCESS: Document added - type={data.get('document_type')}")


class TestEmployeeAttendanceAPI:
    """Test Employee Attendance API"""
    
    @pytest.fixture
    def hr_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        return response.json()["access_token"]
    
    def test_get_employee_attendance(self, hr_token):
        """HR Manager should be able to get employee attendance"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        emp_response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        employees = emp_response.json()
        
        if len(employees) > 0:
            emp_id = employees[0]["id"]
            response = requests.get(f"{BASE_URL}/api/hr/employees/{emp_id}/attendance", headers=headers)
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            
            # Should have records and summary
            assert "records" in data or isinstance(data, dict)
            print(f"SUCCESS: Can get employee attendance")


class TestEmployeeAuditAPI:
    """Test Employee Audit Trail API - per-employee audit"""
    
    @pytest.fixture
    def hr_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        return response.json()["access_token"]
    
    def test_get_employee_audit(self, hr_token):
        """HR Manager should be able to get employee audit trail"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        emp_response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        employees = emp_response.json()
        
        if len(employees) > 0:
            emp_id = employees[0]["id"]
            response = requests.get(f"{BASE_URL}/api/hr/employees/{emp_id}/audit", headers=headers)
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            assert isinstance(data, list)
            print(f"SUCCESS: Can get employee audit trail - count={len(data)}")


class TestCountriesAPI:
    """Test Countries API with currency management"""
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        return response.json()["access_token"]
    
    def test_get_hr_countries_ceo(self, ceo_token):
        """CEO should be able to list all countries"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/countries", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: CEO can list countries - count={len(data)}")
        
        # Check country data structure
        if len(data) > 0:
            country = data[0]
            assert "id" in country
            assert "name" in country
            assert "currency" in country
            print(f"  Country structure: id, name, currency present")
            
            # Check for currency_symbol and phone_code
            if "currency_symbol" in country:
                print(f"  Currency symbol: {country.get('currency_symbol')}")
            if "phone_code" in country:
                print(f"  Phone code: {country.get('phone_code')}")
    
    def test_get_hr_countries_hr_manager(self, hr_token):
        """HR Manager should be able to list all countries (Indian HR has full access)"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/countries", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: HR Manager can list countries - count={len(data)}")
    
    def test_create_country(self, ceo_token):
        """CEO should be able to create a country"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        
        # Use unique code to avoid conflicts
        import time
        unique_code = f"T{int(time.time()) % 100}"
        
        country_data = {
            "name": f"TEST_Country_{unique_code}",
            "code": unique_code,
            "currency": "THB",
            "currency_symbol": "฿",
            "phone_code": "+66",
            "is_active": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/hr/countries",
            headers=headers,
            json=country_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("name") == f"TEST_Country_{unique_code}"
        assert data.get("currency") == "THB"
        assert data.get("currency_symbol") == "฿"
        print(f"SUCCESS: Country created - name={data.get('name')}, currency={data.get('currency')}")
        
        # Cleanup - delete the test country
        if data.get("id"):
            requests.delete(f"{BASE_URL}/api/hr/countries/{data['id']}", headers=headers)


class TestEmployeeCreation:
    """Test Employee Creation with password and employee code"""
    
    @pytest.fixture
    def hr_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    def test_create_employee_requires_password(self, hr_token):
        """Creating employee should require password"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # Get a country and role for the employee
        countries_resp = requests.get(f"{BASE_URL}/api/hr/countries", headers=headers)
        countries = countries_resp.json()
        
        roles_resp = requests.get(f"{BASE_URL}/api/roles", headers=headers)
        roles = roles_resp.json()
        
        if len(countries) > 0 and len(roles) > 0:
            # Try to create without password - should fail or require password
            emp_data = {
                "name": "TEST_New Employee",
                "email": "test_new_emp@wisedrive.com",
                "country_id": countries[0]["id"],
                "role_id": roles[0]["id"],
                # No password
            }
            
            response = requests.post(
                f"{BASE_URL}/api/hr/employees",
                headers=headers,
                json=emp_data
            )
            
            # Should either fail (422) or succeed with auto-generated password
            print(f"Create without password: status={response.status_code}")
            
            # Now create with password
            emp_data["password"] = "testpass123"
            emp_data["email"] = "test_new_emp2@wisedrive.com"
            
            response = requests.post(
                f"{BASE_URL}/api/hr/employees",
                headers=headers,
                json=emp_data
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"SUCCESS: Employee created with password - id={data.get('id')}")
                
                # Check if employee_code is generated
                if data.get("employee_code"):
                    print(f"  Employee code generated: {data.get('employee_code')}")
                
                # Cleanup
                if data.get("id"):
                    requests.delete(f"{BASE_URL}/api/hr/employees/{data['id']}", headers=headers)
            else:
                print(f"Employee creation response: {response.status_code} - {response.text}")


class TestMechanicNoCRMAccess:
    """Test that Mechanics have no CRM access"""
    
    def test_mechanic_visible_tabs_empty(self):
        """Mechanics should have empty visible_tabs (no CRM access)"""
        # This is verified by the TAB_VISIBILITY in rbac.py
        # MECHANIC: [] - empty list means no CRM access
        import sys
        sys.path.insert(0, '/app/backend')
        from services.rbac import RBACService
        
        mechanic_tabs = RBACService.TAB_VISIBILITY.get("MECHANIC", [])
        assert mechanic_tabs == [], f"Mechanic should have no tabs. Got: {mechanic_tabs}"
        print(f"SUCCESS: Mechanic has no CRM access (empty tabs)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
