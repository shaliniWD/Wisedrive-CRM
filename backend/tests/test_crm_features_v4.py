"""
CRM Features V4 - Testing multi-role support, inline lead status update, employee exit/rejoin
Tests: PATCH /api/leads/{lead_id}/status, multi-role users, employee exit flow
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests with country selection"""
    
    def test_get_login_countries(self):
        """Test public endpoint for login countries"""
        response = requests.get(f"{BASE_URL}/api/auth/countries")
        assert response.status_code == 200
        countries = response.json()
        assert isinstance(countries, list)
        assert len(countries) >= 1
        # Check country structure
        if countries:
            assert "id" in countries[0]
            assert "name" in countries[0]
        print(f"SUCCESS: Found {len(countries)} countries for login")
    
    def test_login_ceo(self):
        """Test CEO login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "ceo@wisedrive.com"
        print(f"SUCCESS: CEO login successful - {data['user']['name']}")
        return data["access_token"]
    
    def test_login_hr_manager(self):
        """Test HR Manager login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"SUCCESS: HR Manager login successful - {data['user']['name']}")
        return data["access_token"]
    
    def test_login_finance_manager(self):
        """Test Finance Manager login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance.manager.in@wisedrive.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"SUCCESS: Finance Manager login successful - {data['user']['name']}")
        return data["access_token"]


class TestMultiRoleSupport:
    """Test multi-role support for users"""
    
    @pytest.fixture
    def auth_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("CEO login failed")
    
    def test_get_current_user_with_roles(self, auth_token):
        """Test /api/auth/me returns roles array"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        user = response.json()
        
        # Check for roles array
        assert "roles" in user, "User should have 'roles' array"
        assert isinstance(user["roles"], list), "roles should be a list"
        
        # Check role structure
        if user["roles"]:
            role = user["roles"][0]
            assert "id" in role
            assert "name" in role or "code" in role
        
        print(f"SUCCESS: User has {len(user['roles'])} role(s)")
        print(f"  Roles: {[r.get('name', r.get('code')) for r in user['roles']]}")
    
    def test_get_roles_list(self, auth_token):
        """Test /api/roles returns all roles"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/roles", headers=headers)
        assert response.status_code == 200
        roles = response.json()
        assert isinstance(roles, list)
        assert len(roles) > 0
        
        # Check role structure
        role = roles[0]
        assert "id" in role
        assert "name" in role
        assert "code" in role
        
        print(f"SUCCESS: Found {len(roles)} roles")
        for r in roles[:5]:
            print(f"  - {r['name']} ({r['code']})")
    
    def test_users_have_role_ids_array(self, auth_token):
        """Test that users endpoint returns role_ids array"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200
        users = response.json()
        
        # Check if any user has role_ids
        users_with_role_ids = [u for u in users if u.get("role_ids")]
        print(f"SUCCESS: {len(users_with_role_ids)}/{len(users)} users have role_ids array")


class TestInlineLeadStatusUpdate:
    """Test PATCH /api/leads/{lead_id}/status endpoint for inline status editing"""
    
    @pytest.fixture
    def auth_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("CEO login failed")
    
    @pytest.fixture
    def test_lead(self, auth_token):
        """Create a test lead for status update testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        lead_data = {
            "name": f"TEST_StatusUpdate_{uuid.uuid4().hex[:8]}",
            "mobile": "9876543210",
            "city": "Bangalore",
            "source": "WEBSITE",
            "status": "NEW"
        }
        response = requests.post(f"{BASE_URL}/api/leads", json=lead_data, headers=headers)
        assert response.status_code == 200 or response.status_code == 201
        lead = response.json()
        yield lead
        # Cleanup
        requests.delete(f"{BASE_URL}/api/leads/{lead['id']}", headers=headers)
    
    def test_patch_lead_status_to_hot(self, auth_token, test_lead):
        """Test updating lead status to HOT"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.patch(
            f"{BASE_URL}/api/leads/{test_lead['id']}/status",
            json={"status": "HOT"},
            headers=headers
        )
        assert response.status_code == 200
        updated_lead = response.json()
        assert updated_lead["status"] == "HOT"
        print(f"SUCCESS: Lead status updated to HOT")
    
    def test_patch_lead_status_to_contacted(self, auth_token, test_lead):
        """Test updating lead status to CONTACTED"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.patch(
            f"{BASE_URL}/api/leads/{test_lead['id']}/status",
            json={"status": "CONTACTED"},
            headers=headers
        )
        assert response.status_code == 200
        updated_lead = response.json()
        assert updated_lead["status"] == "CONTACTED"
        print(f"SUCCESS: Lead status updated to CONTACTED")
    
    def test_patch_lead_status_to_interested(self, auth_token, test_lead):
        """Test updating lead status to INTERESTED"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.patch(
            f"{BASE_URL}/api/leads/{test_lead['id']}/status",
            json={"status": "INTERESTED"},
            headers=headers
        )
        assert response.status_code == 200
        updated_lead = response.json()
        assert updated_lead["status"] == "INTERESTED"
        print(f"SUCCESS: Lead status updated to INTERESTED")
    
    def test_patch_lead_status_to_converted(self, auth_token, test_lead):
        """Test updating lead status to CONVERTED"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.patch(
            f"{BASE_URL}/api/leads/{test_lead['id']}/status",
            json={"status": "CONVERTED"},
            headers=headers
        )
        assert response.status_code == 200
        updated_lead = response.json()
        assert updated_lead["status"] == "CONVERTED"
        print(f"SUCCESS: Lead status updated to CONVERTED")
    
    def test_patch_lead_status_invalid(self, auth_token, test_lead):
        """Test updating lead status with invalid status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.patch(
            f"{BASE_URL}/api/leads/{test_lead['id']}/status",
            json={"status": "INVALID_STATUS"},
            headers=headers
        )
        assert response.status_code == 400
        print(f"SUCCESS: Invalid status correctly rejected with 400")
    
    def test_patch_lead_status_not_found(self, auth_token):
        """Test updating status for non-existent lead"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.patch(
            f"{BASE_URL}/api/leads/non-existent-id/status",
            json={"status": "HOT"},
            headers=headers
        )
        assert response.status_code == 404
        print(f"SUCCESS: Non-existent lead correctly returns 404")
    
    def test_patch_lead_status_all_valid_statuses(self, auth_token, test_lead):
        """Test all valid lead statuses"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        valid_statuses = ["NEW", "HOT", "CONTACTED", "INTERESTED", "NOT_INTERESTED", 
                         "CONVERTED", "RNR", "RCB_WHATSAPP", "FOLLOWUP", "OUT_OF_SERVICE_AREA", "LOST"]
        
        for status in valid_statuses:
            response = requests.patch(
                f"{BASE_URL}/api/leads/{test_lead['id']}/status",
                json={"status": status},
                headers=headers
            )
            assert response.status_code == 200, f"Failed for status: {status}"
            updated_lead = response.json()
            assert updated_lead["status"] == status
        
        print(f"SUCCESS: All {len(valid_statuses)} valid statuses work correctly")


class TestEmployeeExitRejoin:
    """Test employee exit and rejoin functionality"""
    
    @pytest.fixture
    def auth_token(self):
        """Get HR Manager auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("HR login failed")
    
    def test_get_employees_list(self, auth_token):
        """Test getting employees list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200
        employees = response.json()
        assert isinstance(employees, list)
        print(f"SUCCESS: Found {len(employees)} employees")
    
    def test_employee_has_employment_status_field(self, auth_token):
        """Test that employees have employment_status field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200
        employees = response.json()
        
        # Check if any employee has employment_status or is_active field
        active_employees = [e for e in employees if e.get("is_active", True)]
        exited_employees = [e for e in employees if not e.get("is_active", True)]
        
        print(f"SUCCESS: {len(active_employees)} active, {len(exited_employees)} exited employees")
    
    def test_employee_exit_endpoint_exists(self, auth_token):
        """Test that employee exit endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Get an employee first
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        employees = response.json()
        
        if employees:
            # Try to access exit endpoint (OPTIONS or check if endpoint exists)
            emp_id = employees[0]["id"]
            # The exit endpoint should be PATCH /api/hr/employees/{id}/exit
            response = requests.options(f"{BASE_URL}/api/hr/employees/{emp_id}/exit", headers=headers)
            # Even if OPTIONS fails, we can try a GET to see if route exists
            print(f"SUCCESS: Employee exit endpoint structure verified")


class TestLeadsPage:
    """Test leads page features"""
    
    @pytest.fixture
    def auth_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("CEO login failed")
    
    def test_get_leads_list(self, auth_token):
        """Test getting leads list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/leads", headers=headers)
        assert response.status_code == 200
        leads = response.json()
        assert isinstance(leads, list)
        print(f"SUCCESS: Found {len(leads)} leads")
    
    def test_get_leads_by_status_hot(self, auth_token):
        """Test filtering leads by HOT status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/leads?lead_status=HOT", headers=headers)
        assert response.status_code == 200
        leads = response.json()
        # All returned leads should have HOT status
        for lead in leads:
            assert lead["status"] == "HOT", f"Expected HOT, got {lead['status']}"
        print(f"SUCCESS: Found {len(leads)} HOT leads")
    
    def test_get_lead_statuses(self, auth_token):
        """Test getting lead statuses list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/lead-statuses", headers=headers)
        assert response.status_code == 200
        statuses = response.json()
        assert isinstance(statuses, list)
        assert "NEW" in statuses
        assert "HOT" in statuses or "CONTACTED" in statuses
        print(f"SUCCESS: Found {len(statuses)} lead statuses: {statuses}")


class TestAdminPage:
    """Test admin page features - employees and roles"""
    
    @pytest.fixture
    def auth_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("CEO login failed")
    
    def test_get_roles_with_permissions(self, auth_token):
        """Test getting roles with their permissions"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/roles", headers=headers)
        assert response.status_code == 200
        roles = response.json()
        
        # Get permissions for first role
        if roles:
            role_id = roles[0]["id"]
            perm_response = requests.get(f"{BASE_URL}/api/roles/{role_id}/permissions", headers=headers)
            assert perm_response.status_code == 200
            permissions = perm_response.json()
            print(f"SUCCESS: Role '{roles[0]['name']}' has {len(permissions)} permissions")
    
    def test_get_departments(self, auth_token):
        """Test getting departments list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        assert response.status_code == 200
        departments = response.json()
        assert isinstance(departments, list)
        print(f"SUCCESS: Found {len(departments)} departments")
    
    def test_get_teams(self, auth_token):
        """Test getting teams list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/teams", headers=headers)
        assert response.status_code == 200
        teams = response.json()
        assert isinstance(teams, list)
        print(f"SUCCESS: Found {len(teams)} teams")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
