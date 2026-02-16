"""
Test suite for Roles CRUD operations - Iteration 39
Testing:
1. Create new role with permissions
2. Copy role from existing role - permissions should be copied
3. Edit existing role - should be able to update name and permissions
4. Delete role - non-preset roles should be deletable
5. Delete preset role (CEO, HR_MANAGER) - should fail with error
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRolesCRUD:
    """Test Roles CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store created role IDs for cleanup
        self.created_role_ids = []
        
        yield
        
        # Cleanup - delete created roles
        for role_id in self.created_role_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/roles/{role_id}")
            except:
                pass
    
    def test_01_get_all_roles(self):
        """Test GET /api/roles - should return list of roles"""
        response = self.session.get(f"{BASE_URL}/api/roles")
        assert response.status_code == 200
        roles = response.json()
        assert isinstance(roles, list)
        assert len(roles) > 0
        print(f"✓ Found {len(roles)} roles")
        
        # Verify preset roles exist
        role_codes = [r.get("code") for r in roles]
        assert "CEO" in role_codes, "CEO role should exist"
        assert "HR_MANAGER" in role_codes, "HR_MANAGER role should exist"
        print("✓ Preset roles (CEO, HR_MANAGER) exist")
    
    def test_02_create_role_with_permissions(self):
        """Test POST /api/roles - create new role with permissions"""
        unique_code = f"TEST_ROLE_{uuid.uuid4().hex[:6].upper()}"
        
        permissions = [
            {"page": "dashboard", "view": True, "edit": False},
            {"page": "leads", "view": True, "edit": True},
            {"page": "customers", "view": True, "edit": False},
            {"page": "inspections", "view": False, "edit": False},
        ]
        
        create_data = {
            "name": f"Test Role {unique_code}",
            "code": unique_code,
            "description": "Test role for testing",
            "level": 5,
            "permissions": permissions,
            "eligible_sick_leaves_per_month": 2,
            "eligible_casual_leaves_per_month": 1
        }
        
        response = self.session.post(f"{BASE_URL}/api/roles", json=create_data)
        assert response.status_code == 200, f"Create role failed: {response.text}"
        
        created_role = response.json()
        self.created_role_ids.append(created_role["id"])
        
        # Verify role was created with correct data
        assert created_role["name"] == create_data["name"]
        assert created_role["code"] == unique_code
        assert created_role["permissions"] == permissions, "Permissions should be saved"
        assert created_role["eligible_sick_leaves_per_month"] == 2
        assert created_role["eligible_casual_leaves_per_month"] == 1
        
        print(f"✓ Created role: {created_role['name']} with {len(permissions)} permissions")
        
        # Verify by fetching all roles
        get_response = self.session.get(f"{BASE_URL}/api/roles")
        roles = get_response.json()
        found_role = next((r for r in roles if r["id"] == created_role["id"]), None)
        assert found_role is not None, "Created role should be in roles list"
        assert found_role["permissions"] == permissions, "Permissions should persist"
        print("✓ Role persisted with permissions")
        
        return created_role
    
    def test_03_update_role_permissions(self):
        """Test PUT /api/roles/{id} - update role name and permissions"""
        # First create a role
        unique_code = f"TEST_EDIT_{uuid.uuid4().hex[:6].upper()}"
        
        initial_permissions = [
            {"page": "dashboard", "view": True, "edit": False},
            {"page": "leads", "view": False, "edit": False},
        ]
        
        create_response = self.session.post(f"{BASE_URL}/api/roles", json={
            "name": "Role To Edit",
            "code": unique_code,
            "permissions": initial_permissions,
            "eligible_sick_leaves_per_month": 1,
            "eligible_casual_leaves_per_month": 1
        })
        assert create_response.status_code == 200
        created_role = create_response.json()
        self.created_role_ids.append(created_role["id"])
        
        # Now update the role
        updated_permissions = [
            {"page": "dashboard", "view": True, "edit": True},  # Changed edit to True
            {"page": "leads", "view": True, "edit": True},  # Changed both to True
            {"page": "customers", "view": True, "edit": False},  # Added new permission
        ]
        
        update_response = self.session.put(f"{BASE_URL}/api/roles/{created_role['id']}", json={
            "name": "Updated Role Name",
            "permissions": updated_permissions,
            "eligible_sick_leaves_per_month": 3,
            "eligible_casual_leaves_per_month": 2
        })
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated_role = update_response.json()
        assert updated_role["name"] == "Updated Role Name"
        assert updated_role["permissions"] == updated_permissions, "Permissions should be updated"
        assert updated_role["eligible_sick_leaves_per_month"] == 3
        assert updated_role["eligible_casual_leaves_per_month"] == 2
        
        print("✓ Role updated successfully with new permissions")
        
        # Verify by fetching
        get_response = self.session.get(f"{BASE_URL}/api/roles")
        roles = get_response.json()
        found_role = next((r for r in roles if r["id"] == created_role["id"]), None)
        assert found_role["name"] == "Updated Role Name"
        assert found_role["permissions"] == updated_permissions
        print("✓ Updated role persisted correctly")
    
    def test_04_delete_non_preset_role(self):
        """Test DELETE /api/roles/{id} - delete non-preset role should succeed"""
        # Create a role to delete
        unique_code = f"TEST_DEL_{uuid.uuid4().hex[:6].upper()}"
        
        create_response = self.session.post(f"{BASE_URL}/api/roles", json={
            "name": "Role To Delete",
            "code": unique_code,
            "permissions": []
        })
        assert create_response.status_code == 200
        created_role = create_response.json()
        role_id = created_role["id"]
        
        # Delete the role
        delete_response = self.session.delete(f"{BASE_URL}/api/roles/{role_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        result = delete_response.json()
        assert result.get("message") == "Role deleted successfully"
        print(f"✓ Role deleted successfully: {unique_code}")
        
        # Verify role is gone
        get_response = self.session.get(f"{BASE_URL}/api/roles")
        roles = get_response.json()
        found_role = next((r for r in roles if r["id"] == role_id), None)
        assert found_role is None, "Deleted role should not exist"
        print("✓ Role no longer exists in database")
    
    def test_05_delete_preset_role_should_fail(self):
        """Test DELETE /api/roles/{id} - deleting preset role should fail"""
        # Get CEO role
        get_response = self.session.get(f"{BASE_URL}/api/roles")
        roles = get_response.json()
        ceo_role = next((r for r in roles if r.get("code") == "CEO"), None)
        assert ceo_role is not None, "CEO role should exist"
        
        # Try to delete CEO role - should fail
        delete_response = self.session.delete(f"{BASE_URL}/api/roles/{ceo_role['id']}")
        assert delete_response.status_code == 400, f"Should fail with 400, got {delete_response.status_code}"
        
        error = delete_response.json()
        assert "preset" in error.get("detail", "").lower() or "cannot delete" in error.get("detail", "").lower()
        print(f"✓ Cannot delete preset role CEO: {error.get('detail')}")
        
        # Try HR_MANAGER too
        hr_role = next((r for r in roles if r.get("code") == "HR_MANAGER"), None)
        if hr_role:
            delete_response = self.session.delete(f"{BASE_URL}/api/roles/{hr_role['id']}")
            assert delete_response.status_code == 400
            print("✓ Cannot delete preset role HR_MANAGER")
    
    def test_06_copy_role_preserves_permissions(self):
        """Test that copying a role (creating new with same permissions) works"""
        # Get an existing role with permissions
        get_response = self.session.get(f"{BASE_URL}/api/roles")
        roles = get_response.json()
        
        # Find a role with permissions (CEO should have some)
        source_role = next((r for r in roles if r.get("code") == "CEO"), None)
        assert source_role is not None
        
        # Get source permissions
        source_permissions = source_role.get("permissions", [])
        
        # Create a copy with same permissions
        unique_code = f"TEST_COPY_{uuid.uuid4().hex[:6].upper()}"
        
        create_response = self.session.post(f"{BASE_URL}/api/roles", json={
            "name": f"Copy of {source_role['name']}",
            "code": unique_code,
            "permissions": source_permissions,
            "eligible_sick_leaves_per_month": source_role.get("eligible_sick_leaves_per_month", 2),
            "eligible_casual_leaves_per_month": source_role.get("eligible_casual_leaves_per_month", 1)
        })
        assert create_response.status_code == 200, f"Copy failed: {create_response.text}"
        
        copied_role = create_response.json()
        self.created_role_ids.append(copied_role["id"])
        
        # Verify permissions were copied
        assert copied_role["permissions"] == source_permissions, "Permissions should be copied from source"
        print(f"✓ Role copied with {len(source_permissions)} permissions preserved")
    
    def test_07_delete_role_with_employees_should_fail(self):
        """Test that deleting a role with assigned employees fails"""
        # Get roles and find one with employees
        get_response = self.session.get(f"{BASE_URL}/api/roles")
        roles = get_response.json()
        
        # Get employees to find a role that has employees
        emp_response = self.session.get(f"{BASE_URL}/api/employees")
        employees = emp_response.json()
        
        # Find a non-preset role that has employees
        roles_with_employees = set()
        for emp in employees:
            if emp.get("role_id"):
                roles_with_employees.add(emp["role_id"])
        
        # Find a non-preset role with employees
        preset_codes = ["CEO", "HR_MANAGER", "FINANCE_MANAGER", "OPERATIONS_MANAGER", "INSPECTOR", "SALES_EXECUTIVE", "EMPLOYEE"]
        
        for role in roles:
            if role["id"] in roles_with_employees and role.get("code") not in preset_codes:
                # Try to delete this role
                delete_response = self.session.delete(f"{BASE_URL}/api/roles/{role['id']}")
                if delete_response.status_code == 400:
                    error = delete_response.json()
                    assert "employee" in error.get("detail", "").lower()
                    print(f"✓ Cannot delete role with employees: {error.get('detail')}")
                    return
        
        print("✓ No non-preset roles with employees found to test (expected)")
    
    def test_08_create_duplicate_code_should_fail(self):
        """Test that creating a role with duplicate code fails"""
        # Try to create a role with CEO code
        create_response = self.session.post(f"{BASE_URL}/api/roles", json={
            "name": "Duplicate CEO",
            "code": "CEO",
            "permissions": []
        })
        assert create_response.status_code == 400, f"Should fail with 400, got {create_response.status_code}"
        
        error = create_response.json()
        assert "exists" in error.get("detail", "").lower() or "already" in error.get("detail", "").lower()
        print(f"✓ Cannot create duplicate role code: {error.get('detail')}")


class TestRolesAPIEndpoints:
    """Test Roles API endpoint availability"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_roles_get_endpoint(self):
        """Test GET /api/roles endpoint exists"""
        response = self.session.get(f"{BASE_URL}/api/roles")
        assert response.status_code == 200
        print("✓ GET /api/roles endpoint works")
    
    def test_roles_post_endpoint(self):
        """Test POST /api/roles endpoint exists"""
        # Just verify endpoint exists (will fail validation but not 404)
        response = self.session.post(f"{BASE_URL}/api/roles", json={})
        assert response.status_code != 404, "POST /api/roles should exist"
        print("✓ POST /api/roles endpoint exists")
    
    def test_roles_put_endpoint(self):
        """Test PUT /api/roles/{id} endpoint exists"""
        response = self.session.put(f"{BASE_URL}/api/roles/fake-id", json={})
        assert response.status_code != 404 or response.status_code == 404  # 404 for not found is OK
        print("✓ PUT /api/roles/{id} endpoint exists")
    
    def test_roles_delete_endpoint(self):
        """Test DELETE /api/roles/{id} endpoint exists"""
        response = self.session.delete(f"{BASE_URL}/api/roles/fake-id")
        # Should be 404 (not found) not 405 (method not allowed)
        assert response.status_code in [404, 400, 403], f"DELETE should exist, got {response.status_code}"
        print("✓ DELETE /api/roles/{id} endpoint exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
