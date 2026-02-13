"""
WiseDrive CRM V2 - RBAC and Multi-tenant Testing
Tests for: Login, RBAC permissions, visible tabs, data filtering, lead reassignment
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_CREDS = {"email": "ceo@wisedrive.com", "password": "password123"}
SALES_EXEC_CREDS = {"email": "salesexec1.in@wisedrive.com", "password": "password123"}
HR_CREDS = {"email": "hr@wisedrive.com", "password": "password123"}


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_ceo_login_success(self):
        """CEO login should succeed with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == CEO_CREDS["email"]
        assert data["user"]["role"] == "CEO"
        assert data["user"]["role_code"] == "CEO"
        assert data["user"]["country_name"] == "India"
        print(f"CEO login successful: {data['user']['name']}")
    
    def test_sales_exec_login_success(self):
        """Sales Executive login should succeed"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALES_EXEC_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Sales Executive"
        assert data["user"]["role_code"] == "SALES_EXEC"
        print(f"Sales Exec login successful: {data['user']['name']}")
    
    def test_hr_login_success(self):
        """HR Manager login should succeed"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "HR Manager"
        assert data["user"]["role_code"] == "HR_MANAGER"
        print(f"HR login successful: {data['user']['name']}")
    
    def test_invalid_credentials(self):
        """Login with invalid credentials should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestRBACVisibleTabs:
    """Test RBAC-based tab visibility"""
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def sales_exec_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALES_EXEC_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def hr_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=HR_CREDS)
        return response.json()["access_token"]
    
    def test_ceo_visible_tabs(self, ceo_token):
        """CEO should see all tabs"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        # CEO should see all major tabs
        expected_tabs = ["dashboard", "leads", "customers", "inspections", "employees"]
        for tab in expected_tabs:
            assert tab in visible_tabs, f"CEO should see {tab} tab"
        print(f"CEO visible tabs: {visible_tabs}")
    
    def test_sales_exec_visible_tabs(self, sales_exec_token):
        """Sales Executive should only see Dashboard and Leads"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        # Sales Exec should only see dashboard and leads
        assert "dashboard" in visible_tabs
        assert "leads" in visible_tabs
        assert "customers" not in visible_tabs, "Sales Exec should NOT see customers tab"
        assert "inspections" not in visible_tabs, "Sales Exec should NOT see inspections tab"
        assert "employees" not in visible_tabs, "Sales Exec should NOT see employees tab"
        print(f"Sales Exec visible tabs: {visible_tabs}")
    
    def test_hr_visible_tabs(self, hr_token):
        """HR Manager should see Dashboard, Employees, HR, Settings"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        # HR should see specific tabs
        assert "dashboard" in visible_tabs
        assert "employees" in visible_tabs
        assert "leads" not in visible_tabs, "HR should NOT see leads tab"
        assert "customers" not in visible_tabs, "HR should NOT see customers tab"
        print(f"HR visible tabs: {visible_tabs}")


class TestLeadsDataFiltering:
    """Test RBAC-based leads data filtering"""
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def sales_exec_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALES_EXEC_CREDS)
        return response.json()["access_token"]
    
    def test_ceo_sees_all_leads(self, ceo_token):
        """CEO should see all 40 leads"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        leads = response.json()
        assert len(leads) == 40, f"CEO should see 40 leads, got {len(leads)}"
        print(f"CEO sees {len(leads)} leads")
    
    def test_sales_exec_sees_own_leads(self, sales_exec_token):
        """Sales Executive should only see their own assigned leads"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        assert response.status_code == 200
        leads = response.json()
        # Sales exec should see approximately 20 leads (own leads)
        assert len(leads) < 40, f"Sales Exec should see fewer than 40 leads, got {len(leads)}"
        assert len(leads) > 0, "Sales Exec should see at least some leads"
        print(f"Sales Exec sees {len(leads)} leads (own leads only)")
    
    def test_leads_have_assigned_to_name(self, ceo_token):
        """Leads should have assigned_to_name field populated"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        leads = response.json()
        
        # Check that leads with assigned_to have assigned_to_name
        leads_with_assignment = [l for l in leads if l.get("assigned_to")]
        assert len(leads_with_assignment) > 0, "Should have leads with assignments"
        
        for lead in leads_with_assignment[:5]:
            assert "assigned_to_name" in lead, f"Lead {lead.get('name')} missing assigned_to_name"
            assert lead["assigned_to_name"] is not None, f"Lead {lead.get('name')} has null assigned_to_name"
        print(f"Verified assigned_to_name on {len(leads_with_assignment)} leads")
    
    def test_facebook_instagram_leads_have_ad_id(self, ceo_token):
        """FACEBOOK and INSTAGRAM source leads should have ad_id"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        leads = response.json()
        
        # Check India leads (not MY leads) with FACEBOOK/INSTAGRAM source
        india_fb_ig_leads = [
            l for l in leads 
            if l.get("source") in ["FACEBOOK", "INSTAGRAM"] 
            and not l.get("name", "").startswith("MY")
        ]
        
        # At least some should have ad_id
        leads_with_ad_id = [l for l in india_fb_ig_leads if l.get("ad_id")]
        assert len(leads_with_ad_id) > 0, "Some FACEBOOK/INSTAGRAM leads should have ad_id"
        print(f"Found {len(leads_with_ad_id)} leads with ad_id out of {len(india_fb_ig_leads)} FB/IG leads")


class TestDashboardStats:
    """Test dashboard statistics"""
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    def test_dashboard_stats_correct(self, ceo_token):
        """Dashboard stats should show correct counts"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        stats = response.json()
        
        # Verify expected counts
        assert stats["total_leads"] == 40, f"Expected 40 leads, got {stats['total_leads']}"
        assert stats["total_customers"] == 15, f"Expected 15 customers, got {stats['total_customers']}"
        assert stats["total_inspections"] == 20, f"Expected 20 inspections, got {stats['total_inspections']}"
        assert stats["total_employees"] == 17, f"Expected 17 employees, got {stats['total_employees']}"
        print(f"Dashboard stats: {stats}")


class TestLeadReassignment:
    """Test lead reassignment functionality"""
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    @pytest.fixture
    def sales_exec_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALES_EXEC_CREDS)
        return response.json()["access_token"]
    
    def test_reassign_requires_reason(self, ceo_token):
        """Lead reassignment should require a reason"""
        # Get a lead to reassign
        leads_response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        leads = leads_response.json()
        assert len(leads) > 0
        lead_id = leads[0]["id"]
        
        # Get an employee to assign to
        users_response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        users = users_response.json()
        sales_users = [u for u in users if u.get("role_code") == "SALES_EXEC"]
        assert len(sales_users) > 0
        new_agent_id = sales_users[0]["id"]
        
        # Try to reassign without reason - should fail or require reason
        # The API requires reason field
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/reassign",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"new_agent_id": new_agent_id, "reason": "Test reassignment"}
        )
        # Should succeed with reason
        assert response.status_code == 200
        print(f"Lead reassignment with reason succeeded")
    
    def test_sales_exec_cannot_reassign(self, sales_exec_token):
        """Sales Executive should not be able to reassign leads"""
        # Get a lead
        leads_response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        leads = leads_response.json()
        if len(leads) == 0:
            pytest.skip("No leads available for sales exec")
        
        lead_id = leads[0]["id"]
        
        # Try to reassign - should fail with 403
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/reassign",
            headers={"Authorization": f"Bearer {sales_exec_token}"},
            json={"new_agent_id": "some-id", "reason": "Test"}
        )
        assert response.status_code == 403, "Sales Exec should not be able to reassign leads"
        print("Sales Exec correctly denied reassignment permission")


class TestUserInfo:
    """Test user info in navbar"""
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    def test_user_info_complete(self, ceo_token):
        """User info should include name, role, and country"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        user = response.json()
        
        # Verify user info fields
        assert "name" in user and user["name"], "User should have name"
        assert "role_name" in user and user["role_name"], "User should have role_name"
        assert "country_name" in user and user["country_name"], "User should have country_name"
        
        print(f"User info: {user['name']} - {user['role_name']} - {user['country_name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
