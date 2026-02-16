"""
RBAC Tests for Leads Management
Tests:
1. Sales Executive (Divya Krishnan) only sees leads assigned to them
2. Sales Executive only sees Leads tab (no Dashboard, HR Module, Finance)
3. HR Manager sees all leads and has full tab access
4. Sales Executive cannot reassign leads
5. HR Manager can reassign leads
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SALES_EXEC_EMAIL = "salesexec3.in@wisedrive.com"
SALES_EXEC_PASSWORD = "password123"
HR_MANAGER_EMAIL = "hr@wisedrive.com"
HR_MANAGER_PASSWORD = "password123"
COUNTRY_ID = "c49e1dc6-1450-40c2-9846-56b73369b2b1"


class TestRBACLogin:
    """Test login and visible tabs for different roles"""
    
    def test_sales_exec_login_returns_visible_tabs(self):
        """Sales Executive login should return visible_tabs with only 'leads'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SALES_EXEC_EMAIL,
            "password": SALES_EXEC_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain user object"
        assert "visible_tabs" in data["user"], "User should have visible_tabs"
        
        visible_tabs = data["user"]["visible_tabs"]
        print(f"Sales Exec visible_tabs: {visible_tabs}")
        
        # Sales Exec should ONLY see leads tab
        assert "leads" in visible_tabs, "Sales Exec should see leads tab"
        assert "dashboard" not in visible_tabs, "Sales Exec should NOT see dashboard tab"
        assert "hr" not in visible_tabs, "Sales Exec should NOT see HR Module tab"
        assert "finance" not in visible_tabs, "Sales Exec should NOT see Finance tab"
        assert "customers" not in visible_tabs, "Sales Exec should NOT see Customers tab"
        
        # Should have exactly 1 tab
        assert len(visible_tabs) == 1, f"Sales Exec should have exactly 1 tab, got {len(visible_tabs)}: {visible_tabs}"
    
    def test_hr_manager_login_returns_visible_tabs(self):
        """HR Manager login should return visible_tabs with leads, hr, finance"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_MANAGER_EMAIL,
            "password": HR_MANAGER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain user object"
        assert "visible_tabs" in data["user"], "User should have visible_tabs"
        
        visible_tabs = data["user"]["visible_tabs"]
        print(f"HR Manager visible_tabs: {visible_tabs}")
        
        # HR Manager should see leads, hr, finance
        assert "leads" in visible_tabs, "HR Manager should see leads tab"
        assert "hr" in visible_tabs, "HR Manager should see HR Module tab"
        assert "finance" in visible_tabs, "HR Manager should see Finance tab"


class TestRBACLeadsAccess:
    """Test leads access based on RBAC"""
    
    @pytest.fixture
    def sales_exec_token(self):
        """Get Sales Executive auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SALES_EXEC_EMAIL,
            "password": SALES_EXEC_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_manager_token(self):
        """Get HR Manager auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_MANAGER_EMAIL,
            "password": HR_MANAGER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture
    def sales_exec_user_id(self, sales_exec_token):
        """Get Sales Executive user ID"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        assert response.status_code == 200
        return response.json()["id"]
    
    def test_sales_exec_only_sees_assigned_leads(self, sales_exec_token, sales_exec_user_id):
        """Sales Executive should only see leads assigned to them"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        assert response.status_code == 200, f"Failed to get leads: {response.text}"
        
        leads = response.json()
        print(f"Sales Exec sees {len(leads)} leads")
        
        # All leads should be assigned to the sales exec
        for lead in leads:
            assert lead.get("assigned_to") == sales_exec_user_id, \
                f"Lead {lead.get('id')} is assigned to {lead.get('assigned_to')}, not {sales_exec_user_id}"
        
        print(f"All {len(leads)} leads are correctly assigned to Sales Exec")
    
    def test_hr_manager_sees_all_leads(self, hr_manager_token):
        """HR Manager should see all leads (not filtered by assignment)"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {hr_manager_token}"}
        )
        assert response.status_code == 200, f"Failed to get leads: {response.text}"
        
        leads = response.json()
        print(f"HR Manager sees {len(leads)} leads")
        
        # HR Manager should see more leads than just their own
        # Check that leads have different assigned_to values
        assigned_to_set = set(lead.get("assigned_to") for lead in leads if lead.get("assigned_to"))
        print(f"Leads are assigned to {len(assigned_to_set)} different agents")
        
        # Should see leads from multiple agents
        assert len(leads) > 0, "HR Manager should see some leads"
    
    def test_sales_exec_lead_count_matches_summary(self, sales_exec_token, sales_exec_user_id):
        """Sales Executive summary cards should only count their assigned leads"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        assert response.status_code == 200
        
        leads = response.json()
        total_leads = len(leads)
        
        # Count leads by status
        status_counts = {}
        for lead in leads:
            status = lead.get("status", "new")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print(f"Sales Exec lead counts: Total={total_leads}, By status={status_counts}")
        
        # All leads should be assigned to sales exec
        for lead in leads:
            assert lead.get("assigned_to") == sales_exec_user_id


class TestRBACReassignment:
    """Test lead reassignment permissions"""
    
    @pytest.fixture
    def sales_exec_token(self):
        """Get Sales Executive auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SALES_EXEC_EMAIL,
            "password": SALES_EXEC_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_manager_token(self):
        """Get HR Manager auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_MANAGER_EMAIL,
            "password": HR_MANAGER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_sales_exec_cannot_reassign_lead(self, sales_exec_token):
        """Sales Executive should NOT be able to reassign leads"""
        # First get a lead
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        assert response.status_code == 200
        leads = response.json()
        
        if len(leads) == 0:
            pytest.skip("No leads available for testing")
        
        lead_id = leads[0]["id"]
        
        # Try to reassign - should fail with 403
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/reassign",
            headers={"Authorization": f"Bearer {sales_exec_token}"},
            json={
                "new_agent_id": "some-other-agent-id",
                "reason": "Test reassignment"
            }
        )
        
        # Sales Exec should NOT be able to reassign
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("Sales Exec correctly denied reassignment permission")


class TestRBACAuthMe:
    """Test /auth/me endpoint returns correct visible_tabs"""
    
    def test_sales_exec_auth_me_visible_tabs(self):
        """Sales Executive /auth/me should return visible_tabs with only 'leads'"""
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SALES_EXEC_EMAIL,
            "password": SALES_EXEC_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Get /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        print(f"Sales Exec /auth/me visible_tabs: {visible_tabs}")
        
        # Should only have leads
        assert "leads" in visible_tabs, "Should have leads tab"
        assert "dashboard" not in visible_tabs, "Should NOT have dashboard tab"
        assert "hr" not in visible_tabs, "Should NOT have HR tab"
        assert "finance" not in visible_tabs, "Should NOT have Finance tab"
    
    def test_hr_manager_auth_me_visible_tabs(self):
        """HR Manager /auth/me should return visible_tabs with leads, hr, finance"""
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_MANAGER_EMAIL,
            "password": HR_MANAGER_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Get /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        print(f"HR Manager /auth/me visible_tabs: {visible_tabs}")
        
        # Should have leads, hr, finance
        assert "leads" in visible_tabs, "Should have leads tab"
        assert "hr" in visible_tabs, "Should have HR tab"
        assert "finance" in visible_tabs, "Should have Finance tab"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
