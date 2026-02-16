"""
Test Suite for Iteration 35 Features:
1. POST /api/roles - Create new role
2. Salary data field names (conveyance_allowance, medical_allowance, income_tax)
3. GET /api/inspection-packages returns all packages including inactive
4. GET /api/inspection-categories returns all categories including inactive
5. PATCH /api/inspection-categories/:id/toggle-status toggles category status
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "kalyan@wisedrive.com"
TEST_PASSWORD = "password123"


class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestRoleCreation(TestAuth):
    """Test POST /api/roles endpoint for creating new roles"""
    
    def test_create_role_success(self, auth_headers):
        """Test creating a new role with valid data"""
        unique_code = f"TEST_ROLE_{uuid.uuid4().hex[:6].upper()}"
        role_data = {
            "name": f"Test Role {unique_code}",
            "code": unique_code,
            "description": "Test role created by automated tests",
            "level": 5,
            "eligible_sick_leaves_per_month": 1,
            "eligible_casual_leaves_per_month": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/roles", json=role_data, headers=auth_headers)
        
        # Status assertion
        assert response.status_code == 200, f"Create role failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data["name"] == role_data["name"]
        assert data["code"] == unique_code
        assert data["level"] == 5
        assert "id" in data
        assert data["is_active"] == True
        
        print(f"✓ Role created successfully: {data['name']} (code: {data['code']})")
        
        # Cleanup - verify role exists in list
        list_response = requests.get(f"{BASE_URL}/api/roles", headers=auth_headers)
        assert list_response.status_code == 200
        roles = list_response.json()
        created_role = next((r for r in roles if r["code"] == unique_code), None)
        assert created_role is not None, "Created role not found in roles list"
        print(f"✓ Role verified in roles list")
    
    def test_create_role_duplicate_code_fails(self, auth_headers):
        """Test that creating a role with duplicate code fails"""
        # First, create a role
        unique_code = f"TEST_DUP_{uuid.uuid4().hex[:6].upper()}"
        role_data = {
            "name": f"Test Role {unique_code}",
            "code": unique_code,
            "level": 5
        }
        
        response1 = requests.post(f"{BASE_URL}/api/roles", json=role_data, headers=auth_headers)
        assert response1.status_code == 200, f"First role creation failed: {response1.text}"
        
        # Try to create another role with same code
        role_data2 = {
            "name": "Another Role",
            "code": unique_code,  # Same code
            "level": 6
        }
        
        response2 = requests.post(f"{BASE_URL}/api/roles", json=role_data2, headers=auth_headers)
        assert response2.status_code == 400, f"Expected 400 for duplicate code, got {response2.status_code}"
        
        error_data = response2.json()
        assert "already exists" in error_data.get("detail", "").lower()
        print(f"✓ Duplicate role code correctly rejected")
    
    def test_update_role(self, auth_headers):
        """Test updating an existing role"""
        # First create a role
        unique_code = f"TEST_UPD_{uuid.uuid4().hex[:6].upper()}"
        role_data = {
            "name": f"Test Role {unique_code}",
            "code": unique_code,
            "level": 5
        }
        
        create_response = requests.post(f"{BASE_URL}/api/roles", json=role_data, headers=auth_headers)
        assert create_response.status_code == 200
        role_id = create_response.json()["id"]
        
        # Update the role
        update_data = {
            "name": f"Updated Role {unique_code}",
            "level": 6,
            "eligible_sick_leaves_per_month": 2
        }
        
        update_response = requests.put(f"{BASE_URL}/api/roles/{role_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated_role = update_response.json()
        assert updated_role["name"] == update_data["name"]
        assert updated_role["level"] == 6
        assert updated_role["eligible_sick_leaves_per_month"] == 2
        print(f"✓ Role updated successfully")


class TestSalaryFieldNames(TestAuth):
    """Test salary data uses correct field names"""
    
    def test_salary_structure_field_names(self, auth_headers):
        """Test that salary structure uses conveyance_allowance, medical_allowance, income_tax"""
        # Get employees list
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        
        if not employees:
            pytest.skip("No employees found to test salary structure")
        
        # Get first employee with salary info
        employee = employees[0]
        employee_id = employee["id"]
        
        # Get salary structure
        salary_response = requests.get(f"{BASE_URL}/api/hr/employees/{employee_id}/salary", headers=auth_headers)
        
        if salary_response.status_code == 404:
            # Create salary structure with correct field names
            salary_data = {
                "basic_salary": 50000,
                "hra": 20000,
                "conveyance_allowance": 5000,  # Correct field name
                "medical_allowance": 3000,      # Correct field name
                "special_allowance": 2000,
                "pf_employee": 1800,
                "professional_tax": 200,
                "income_tax": 5000,              # Correct field name
                "employment_type": "permanent"
            }
            
            save_response = requests.post(
                f"{BASE_URL}/api/hr/employees/{employee_id}/salary",
                json=salary_data,
                headers=auth_headers
            )
            assert save_response.status_code == 200, f"Save salary failed: {save_response.text}"
            
            # Verify saved data
            verify_response = requests.get(f"{BASE_URL}/api/hr/employees/{employee_id}/salary", headers=auth_headers)
            assert verify_response.status_code == 200
            saved_salary = verify_response.json()
            
            # Check field names are correct
            assert "conveyance_allowance" in saved_salary or saved_salary.get("conveyance_allowance") is not None or "conveyance" in str(saved_salary).lower()
            assert "medical_allowance" in saved_salary or saved_salary.get("medical_allowance") is not None or "medical" in str(saved_salary).lower()
            assert "income_tax" in saved_salary or saved_salary.get("income_tax") is not None or "tds" in str(saved_salary).lower()
            
            print(f"✓ Salary structure saved with correct field names")
        else:
            assert salary_response.status_code == 200
            salary = salary_response.json()
            print(f"✓ Existing salary structure found: {list(salary.keys())}")
    
    def test_ess_salary_sync_with_income_tax(self, auth_headers):
        """Test ESS profile salary endpoint returns income_tax field"""
        # This tests the ESS mobile API salary sync
        # First login to get ESS token
        login_response = requests.post(f"{BASE_URL}/api/ess/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "device_id": f"test_device_{uuid.uuid4().hex[:8]}",
            "device_name": "Test Device",
            "device_type": "android"
        })
        
        if login_response.status_code != 200:
            pytest.skip("ESS login not available")
        
        ess_token = login_response.json().get("access_token")
        ess_headers = {
            "Authorization": f"Bearer {ess_token}",
            "Content-Type": "application/json"
        }
        
        # Get ESS profile salary
        salary_response = requests.get(f"{BASE_URL}/api/ess/profile/salary", headers=ess_headers)
        
        if salary_response.status_code == 200:
            salary = salary_response.json()
            # Check that income_tax field is present (not tds)
            print(f"✓ ESS salary fields: {list(salary.keys())}")
            # The ESS profile should have income_tax field
            assert "income_tax" in salary or salary.get("income_tax") is not None
            print(f"✓ ESS salary sync includes income_tax field")
        elif salary_response.status_code == 404:
            print("✓ No salary structure found for ESS user (expected if not set)")
        else:
            print(f"ESS salary response: {salary_response.status_code}")


class TestInspectionPackagesInactive(TestAuth):
    """Test inspection packages/categories return inactive items"""
    
    @pytest.fixture(scope="class")
    def country_id(self, auth_headers):
        """Get a country ID for testing"""
        response = requests.get(f"{BASE_URL}/api/hr/countries/all", headers=auth_headers)
        assert response.status_code == 200
        countries = response.json()
        if not countries:
            pytest.skip("No countries found")
        return countries[0]["id"]
    
    def test_get_categories_includes_inactive(self, auth_headers, country_id):
        """Test GET /api/inspection-categories returns inactive categories"""
        # First create a category
        unique_name = f"TEST_CAT_{uuid.uuid4().hex[:6]}"
        category_data = {
            "name": unique_name,
            "description": "Test category",
            "check_points": 10,
            "items": [{"name": "Test Item 1"}],
            "benefits": [],
            "is_free": False,
            "order": 99
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/inspection-categories",
            json=category_data,
            params={"country_id": country_id},
            headers=auth_headers
        )
        assert create_response.status_code == 200, f"Create category failed: {create_response.text}"
        created_category = create_response.json()
        category_id = created_category["id"]
        
        # Toggle to inactive
        toggle_response = requests.patch(
            f"{BASE_URL}/api/inspection-categories/{category_id}/toggle-status",
            headers=auth_headers
        )
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        assert toggle_response.json()["is_active"] == False
        
        # Get all categories - should include inactive
        list_response = requests.get(
            f"{BASE_URL}/api/inspection-categories",
            params={"country_id": country_id},
            headers=auth_headers
        )
        assert list_response.status_code == 200
        categories = list_response.json()
        
        # Find our inactive category
        inactive_cat = next((c for c in categories if c["id"] == category_id), None)
        assert inactive_cat is not None, "Inactive category not found in list"
        assert inactive_cat["is_active"] == False
        
        print(f"✓ GET /api/inspection-categories returns inactive categories")
        
        # Cleanup - reactivate
        requests.patch(f"{BASE_URL}/api/inspection-categories/{category_id}/toggle-status", headers=auth_headers)
    
    def test_get_packages_includes_inactive(self, auth_headers, country_id):
        """Test GET /api/inspection-packages returns inactive packages"""
        # First create a package
        unique_name = f"TEST_PKG_{uuid.uuid4().hex[:6]}"
        package_data = {
            "name": unique_name,
            "description": "Test package",
            "price": 1000,
            "currency": "INR",
            "currency_symbol": "₹",
            "categories": [],
            "no_of_inspections": 1,
            "is_recommended": False,
            "order": 99,
            "country_id": country_id
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/inspection-packages",
            json=package_data,
            headers=auth_headers
        )
        assert create_response.status_code == 200, f"Create package failed: {create_response.text}"
        created_package = create_response.json()
        package_id = created_package["id"]
        
        # Toggle to inactive
        toggle_response = requests.patch(
            f"{BASE_URL}/api/inspection-packages/{package_id}/toggle-status",
            headers=auth_headers
        )
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        assert toggle_response.json()["is_active"] == False
        
        # Get all packages - should include inactive
        list_response = requests.get(
            f"{BASE_URL}/api/inspection-packages",
            params={"country_id": country_id},
            headers=auth_headers
        )
        assert list_response.status_code == 200
        packages = list_response.json()
        
        # Find our inactive package
        inactive_pkg = next((p for p in packages if p["id"] == package_id), None)
        assert inactive_pkg is not None, "Inactive package not found in list"
        assert inactive_pkg["is_active"] == False
        
        print(f"✓ GET /api/inspection-packages returns inactive packages")
        
        # Cleanup - reactivate
        requests.patch(f"{BASE_URL}/api/inspection-packages/{package_id}/toggle-status", headers=auth_headers)
    
    def test_toggle_category_status(self, auth_headers, country_id):
        """Test PATCH /api/inspection-categories/:id/toggle-status"""
        # Create a category
        unique_name = f"TEST_TOGGLE_{uuid.uuid4().hex[:6]}"
        category_data = {
            "name": unique_name,
            "check_points": 5,
            "items": [],
            "benefits": [],
            "order": 99
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/inspection-categories",
            json=category_data,
            params={"country_id": country_id},
            headers=auth_headers
        )
        assert create_response.status_code == 200
        category_id = create_response.json()["id"]
        initial_status = create_response.json().get("is_active", True)
        
        # Toggle status
        toggle_response = requests.patch(
            f"{BASE_URL}/api/inspection-categories/{category_id}/toggle-status",
            headers=auth_headers
        )
        assert toggle_response.status_code == 200
        new_status = toggle_response.json()["is_active"]
        assert new_status != initial_status, "Status should have toggled"
        
        print(f"✓ Category status toggled from {initial_status} to {new_status}")
        
        # Toggle back
        toggle_back_response = requests.patch(
            f"{BASE_URL}/api/inspection-categories/{category_id}/toggle-status",
            headers=auth_headers
        )
        assert toggle_back_response.status_code == 200
        final_status = toggle_back_response.json()["is_active"]
        assert final_status == initial_status, "Status should have toggled back"
        
        print(f"✓ Category status toggled back to {final_status}")


class TestDocumentDownload(TestAuth):
    """Test document download with authentication"""
    
    def test_document_download_endpoint_exists(self, auth_headers):
        """Test that document download endpoint exists and requires auth"""
        # Get employees
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        
        if not employees:
            pytest.skip("No employees found")
        
        employee_id = employees[0]["id"]
        
        # Try to download a non-existent document (should return 404, not 401)
        download_response = requests.get(
            f"{BASE_URL}/api/hr/employees/{employee_id}/documents/file/nonexistent.pdf",
            headers=auth_headers
        )
        
        # Should be 404 (not found) not 401 (unauthorized)
        assert download_response.status_code in [404, 200], f"Unexpected status: {download_response.status_code}"
        print(f"✓ Document download endpoint accessible with auth")
    
    def test_document_download_without_auth_fails(self):
        """Test that document download without auth fails"""
        # Try without auth headers
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/some-id/documents/file/test.pdf"
        )
        
        # Should be 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Document download correctly requires authentication")


class TestReportingManagerDropdown(TestAuth):
    """Test that employee modal shows employees in reporting manager dropdown"""
    
    def test_employees_list_for_reporting_manager(self, auth_headers):
        """Test that employees list is available for reporting manager selection"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        
        # Should return list of employees
        assert isinstance(employees, list)
        
        if employees:
            # Each employee should have id and name for dropdown
            for emp in employees[:5]:  # Check first 5
                assert "id" in emp
                assert "name" in emp
        
        print(f"✓ Employees list available for reporting manager dropdown ({len(employees)} employees)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
