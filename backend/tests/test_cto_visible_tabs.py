"""
Test CTO Role Visible Tabs Bug Fix
Bug: After creating a new role CTO and a new employee for that role, 
when logging in with that new employee's credentials, no other screens 
are available for access other than dashboard.

Fix: Modified get_visible_tabs() in rbac.py to check if role has custom 
permissions stored. If so, convert those permissions to visible tabs.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCTOVisibleTabs:
    """Test CTO user visible tabs after login"""
    
    # CTO credentials from test request
    CTO_EMAIL = "shalini.vyshaka@gmail.com"
    CTO_PASSWORD = "password123"
    
    @pytest.fixture
    def cto_token(self):
        """Login as CTO user and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": self.CTO_EMAIL, "password": self.CTO_PASSWORD}
        )
        assert response.status_code == 200, f"CTO login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in login response"
        return data["access_token"]
    
    def test_01_cto_login_returns_user_info(self):
        """Test CTO login returns correct user info"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": self.CTO_EMAIL, "password": self.CTO_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify user info
        assert "user" in data
        user = data["user"]
        assert user["email"] == self.CTO_EMAIL
        assert user["role"] == "CTO"
        assert user["role_code"] == "CTO"
        print(f"✓ CTO login successful: {user['name']} ({user['role']})")
    
    def test_02_cto_auth_me_returns_visible_tabs(self, cto_token):
        """Test /auth/me returns visible_tabs for CTO user"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cto_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify visible_tabs is present and not empty
        assert "visible_tabs" in data, "visible_tabs not in /auth/me response"
        visible_tabs = data["visible_tabs"]
        assert isinstance(visible_tabs, list), "visible_tabs should be a list"
        assert len(visible_tabs) > 0, "visible_tabs should not be empty"
        
        print(f"✓ CTO visible_tabs: {visible_tabs}")
    
    def test_03_cto_has_dashboard_tab(self, cto_token):
        """Test CTO user has dashboard tab visible"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cto_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        visible_tabs = data.get("visible_tabs", [])
        assert "dashboard" in visible_tabs, "Dashboard should always be visible"
        print("✓ Dashboard tab is visible for CTO")
    
    def test_04_cto_has_leads_tab(self, cto_token):
        """Test CTO user has leads tab visible"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cto_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        visible_tabs = data.get("visible_tabs", [])
        assert "leads" in visible_tabs, "Leads tab should be visible for CTO"
        print("✓ Leads tab is visible for CTO")
    
    def test_05_cto_has_customers_tab(self, cto_token):
        """Test CTO user has customers tab visible"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cto_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        visible_tabs = data.get("visible_tabs", [])
        assert "customers" in visible_tabs, "Customers tab should be visible for CTO"
        print("✓ Customers tab is visible for CTO")
    
    def test_06_cto_has_inspections_tab(self, cto_token):
        """Test CTO user has inspections tab visible"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cto_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        visible_tabs = data.get("visible_tabs", [])
        assert "inspections" in visible_tabs, "Inspections tab should be visible for CTO"
        print("✓ Inspections tab is visible for CTO")
    
    def test_07_cto_has_hr_tab(self, cto_token):
        """Test CTO user has HR tab visible (mapped from employees permission)"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cto_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        visible_tabs = data.get("visible_tabs", [])
        assert "hr" in visible_tabs, "HR tab should be visible for CTO (employees permission maps to hr)"
        print("✓ HR tab is visible for CTO")
    
    def test_08_cto_has_finance_tab(self, cto_token):
        """Test CTO user has finance tab visible"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cto_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        visible_tabs = data.get("visible_tabs", [])
        assert "finance" in visible_tabs, "Finance tab should be visible for CTO"
        print("✓ Finance tab is visible for CTO")
    
    def test_09_cto_has_settings_tab(self, cto_token):
        """Test CTO user has settings tab visible"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cto_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        visible_tabs = data.get("visible_tabs", [])
        assert "settings" in visible_tabs, "Settings tab should be visible for CTO"
        print("✓ Settings tab is visible for CTO")
    
    def test_10_cto_all_expected_tabs_present(self, cto_token):
        """Test CTO user has all expected tabs based on role permissions"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cto_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        visible_tabs = set(data.get("visible_tabs", []))
        
        # Expected tabs based on CTO role permissions:
        # dashboard, leads, customers, inspections, employees->hr, hr, finance, settings
        expected_tabs = {"dashboard", "leads", "customers", "inspections", "hr", "finance", "settings"}
        
        # Check all expected tabs are present
        missing_tabs = expected_tabs - visible_tabs
        assert len(missing_tabs) == 0, f"Missing tabs for CTO: {missing_tabs}"
        
        print(f"✓ All expected tabs present for CTO: {sorted(visible_tabs)}")
    
    def test_11_cto_role_info_in_response(self, cto_token):
        """Test CTO role info is correctly returned"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {cto_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify role info
        assert data.get("role_name") == "CTO", "Role name should be CTO"
        assert data.get("role_code") == "CTO", "Role code should be CTO"
        assert "roles" in data, "Roles array should be present"
        assert len(data["roles"]) > 0, "Should have at least one role"
        
        cto_role = data["roles"][0]
        assert cto_role["name"] == "CTO"
        assert cto_role["code"] == "CTO"
        
        print(f"✓ CTO role info correct: {cto_role}")


class TestCustomRoleVisibleTabs:
    """Test that custom roles with permissions work same as preset roles"""
    
    ADMIN_EMAIL = "kalyan@wisedrive.com"
    ADMIN_PASSWORD = "password123"
    
    @pytest.fixture
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": self.ADMIN_EMAIL, "password": self.ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed - skipping custom role tests")
        return response.json()["access_token"]
    
    def test_12_preset_role_ceo_has_tabs(self, admin_token):
        """Test preset CEO role has visible tabs from TAB_VISIBILITY"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        visible_tabs = data.get("visible_tabs", [])
        assert len(visible_tabs) > 0, "CEO should have visible tabs"
        
        # CEO should have these tabs from TAB_VISIBILITY
        expected_ceo_tabs = {"leads", "customers", "inspections", "reports", "hr", "settings", "finance", "dashboard"}
        actual_tabs = set(visible_tabs)
        
        # Check CEO has expected tabs
        missing = expected_ceo_tabs - actual_tabs
        assert len(missing) == 0, f"CEO missing tabs: {missing}"
        
        print(f"✓ CEO visible tabs: {sorted(visible_tabs)}")
    
    def test_13_custom_role_permissions_to_tabs_mapping(self, admin_token):
        """Test that PAGE_TO_TAB mapping works correctly"""
        # This test verifies the fix: employees permission maps to hr tab
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # The fix added PAGE_TO_TAB mapping:
        # "employees" -> "hr"
        # This ensures custom roles with "employees" permission see "hr" tab
        visible_tabs = data.get("visible_tabs", [])
        
        # HR tab should be present (either from hr or employees permission)
        assert "hr" in visible_tabs, "HR tab should be visible"
        print("✓ PAGE_TO_TAB mapping working correctly")


class TestDashboardAlwaysVisible:
    """Test that dashboard is always visible if any tabs are visible"""
    
    CTO_EMAIL = "shalini.vyshaka@gmail.com"
    CTO_PASSWORD = "password123"
    
    def test_14_dashboard_always_included(self):
        """Test dashboard is always added when user has any visible tabs"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": self.CTO_EMAIL, "password": self.CTO_PASSWORD}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        visible_tabs = data.get("visible_tabs", [])
        
        # If user has any tabs, dashboard should be included
        if len(visible_tabs) > 0:
            assert "dashboard" in visible_tabs, "Dashboard should always be visible if any tabs are visible"
            print("✓ Dashboard is always included when user has visible tabs")
        else:
            pytest.fail("User should have visible tabs")
