"""
WiseDrive CRM V2 - HR Module and Audit Trail Testing
Tests for: Salary CRUD, Audit logs, RBAC for HR/Audit tabs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_CREDS = {"email": "ceo@wisedrive.com", "password": "password123"}
SALES_EXEC_CREDS = {"email": "salesexec1.in@wisedrive.com", "password": "password123"}
HR_CREDS = {"email": "hr@wisedrive.com", "password": "password123"}


class TestSalaryAPI:
    """Test Salary/HR API endpoints"""
    
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
    
    def test_ceo_can_view_salaries(self, ceo_token):
        """CEO should be able to view all salaries"""
        response = requests.get(
            f"{BASE_URL}/api/salaries",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        salaries = response.json()
        assert isinstance(salaries, list)
        print(f"CEO can view {len(salaries)} salary records")
    
    def test_hr_can_view_salaries(self, hr_token):
        """HR Manager should be able to view all salaries"""
        response = requests.get(
            f"{BASE_URL}/api/salaries",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        assert response.status_code == 200
        salaries = response.json()
        assert isinstance(salaries, list)
        print(f"HR can view {len(salaries)} salary records")
    
    def test_sales_exec_cannot_view_salaries(self, sales_exec_token):
        """Sales Executive should NOT be able to view salaries"""
        response = requests.get(
            f"{BASE_URL}/api/salaries",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        assert response.status_code == 403
        print("Sales Exec correctly denied access to salaries")
    
    def test_salary_has_user_info(self, ceo_token):
        """Salary records should include user name, email, and role"""
        response = requests.get(
            f"{BASE_URL}/api/salaries",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        salaries = response.json()
        
        if len(salaries) > 0:
            salary = salaries[0]
            assert "user_name" in salary, "Salary should have user_name"
            assert "user_email" in salary, "Salary should have user_email"
            assert "role_name" in salary, "Salary should have role_name"
            print(f"Salary record has user info: {salary.get('user_name')} - {salary.get('role_name')}")
    
    def test_ceo_can_create_salary(self, ceo_token):
        """CEO should be able to create salary structure"""
        # Get a user to create salary for
        users_response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        users = users_response.json()
        # Find a user without salary (or any user for testing)
        test_user = [u for u in users if u.get("role_code") == "MECHANIC"]
        if not test_user:
            test_user = users[:1]
        
        if test_user:
            user_id = test_user[0]["id"]
            salary_data = {
                "user_id": user_id,
                "ctc": 300000,
                "fixed_pay": 20000,
                "variable_pay": 5000,
                "commission_percentage": 0,
                "per_inspection_payout": 500,
                "currency": "INR"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/salaries",
                headers={"Authorization": f"Bearer {ceo_token}"},
                json=salary_data
            )
            assert response.status_code == 200
            created = response.json()
            assert created["user_id"] == user_id
            assert created["ctc"] == 300000
            assert "id" in created
            print(f"Created salary for user {user_id}")
    
    def test_sales_exec_cannot_create_salary(self, sales_exec_token):
        """Sales Executive should NOT be able to create salary"""
        salary_data = {
            "user_id": "some-user-id",
            "ctc": 100000,
            "fixed_pay": 8000,
            "currency": "INR"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salaries",
            headers={"Authorization": f"Bearer {sales_exec_token}"},
            json=salary_data
        )
        assert response.status_code == 403
        print("Sales Exec correctly denied salary creation")


class TestAuditLogsAPI:
    """Test Audit Logs API endpoints"""
    
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
    
    def test_ceo_can_view_audit_logs(self, ceo_token):
        """CEO should be able to view audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/audit-logs",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        logs = response.json()
        assert isinstance(logs, list)
        print(f"CEO can view {len(logs)} audit logs")
    
    def test_hr_can_view_audit_logs(self, hr_token):
        """HR Manager should be able to view audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/audit-logs",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        assert response.status_code == 200
        logs = response.json()
        assert isinstance(logs, list)
        print(f"HR can view {len(logs)} audit logs")
    
    def test_sales_exec_cannot_view_audit_logs(self, sales_exec_token):
        """Sales Executive should NOT be able to view audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/audit-logs",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        assert response.status_code == 403
        print("Sales Exec correctly denied access to audit logs")
    
    def test_audit_log_has_required_fields(self, ceo_token):
        """Audit logs should have required fields"""
        response = requests.get(
            f"{BASE_URL}/api/audit-logs",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        logs = response.json()
        
        if len(logs) > 0:
            log = logs[0]
            required_fields = ["id", "entity_type", "entity_id", "action", "user_id", "timestamp"]
            for field in required_fields:
                assert field in log, f"Audit log should have {field}"
            print(f"Audit log has all required fields: {log.get('entity_type')} - {log.get('action')}")
    
    def test_audit_stats_endpoint(self, ceo_token):
        """Audit stats endpoint should return statistics"""
        response = requests.get(
            f"{BASE_URL}/api/audit-logs/stats",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        stats = response.json()
        
        assert "total" in stats, "Stats should have total count"
        assert "recent_24h" in stats, "Stats should have recent_24h count"
        assert "by_entity" in stats, "Stats should have by_entity breakdown"
        assert "by_action" in stats, "Stats should have by_action breakdown"
        print(f"Audit stats: total={stats['total']}, recent_24h={stats['recent_24h']}")
    
    def test_sales_exec_cannot_view_audit_stats(self, sales_exec_token):
        """Sales Executive should NOT be able to view audit stats"""
        response = requests.get(
            f"{BASE_URL}/api/audit-logs/stats",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        assert response.status_code == 403
        print("Sales Exec correctly denied access to audit stats")


class TestHRAuditTabVisibility:
    """Test RBAC-based HR and Audit tab visibility"""
    
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
    
    def test_ceo_sees_hr_tab(self, ceo_token):
        """CEO should see HR tab in visible_tabs"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        assert "hr" in visible_tabs, "CEO should see HR tab"
        print(f"CEO visible tabs include 'hr': {visible_tabs}")
    
    def test_hr_sees_hr_tab(self, hr_token):
        """HR Manager should see HR tab in visible_tabs"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        assert "hr" in visible_tabs, "HR Manager should see HR tab"
        print(f"HR visible tabs include 'hr': {visible_tabs}")
    
    def test_sales_exec_does_not_see_hr_tab(self, sales_exec_token):
        """Sales Executive should NOT see HR tab"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {sales_exec_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        assert "hr" not in visible_tabs, "Sales Exec should NOT see HR tab"
        print(f"Sales Exec visible tabs (no 'hr'): {visible_tabs}")
    
    def test_ceo_sees_employees_tab(self, ceo_token):
        """CEO should see employees tab (for Admin page access)"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        assert "employees" in visible_tabs, "CEO should see employees tab"
        print(f"CEO can access Admin page via employees tab")
    
    def test_hr_sees_employees_tab(self, hr_token):
        """HR Manager should see employees tab"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        assert "employees" in visible_tabs, "HR Manager should see employees tab"
        print(f"HR can access Admin page via employees tab")


class TestEmployeeDataEnrichment:
    """Test that employee data includes role_name and country_name"""
    
    @pytest.fixture
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        return response.json()["access_token"]
    
    def test_employees_have_role_name(self, ceo_token):
        """Employees should have role_name field"""
        response = requests.get(
            f"{BASE_URL}/api/employees",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        employees = response.json()
        
        assert len(employees) > 0, "Should have employees"
        
        # Check first few employees have role_name
        for emp in employees[:5]:
            assert "role_name" in emp, f"Employee {emp.get('name')} should have role_name"
            assert emp["role_name"] is not None, f"Employee {emp.get('name')} role_name should not be null"
        print(f"Verified role_name on {len(employees)} employees")
    
    def test_employees_have_country_name(self, ceo_token):
        """Employees should have country_name field"""
        response = requests.get(
            f"{BASE_URL}/api/employees",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        employees = response.json()
        
        # Check employees with country_id have country_name
        employees_with_country = [e for e in employees if e.get("country_id")]
        assert len(employees_with_country) > 0, "Should have employees with country"
        
        for emp in employees_with_country[:5]:
            assert "country_name" in emp, f"Employee {emp.get('name')} should have country_name"
        print(f"Verified country_name on employees with country_id")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
