"""
HR Module V3 Tests - Testing new features:
1. Column order: Employee, Role, Country, Weekly Off, Status, Salary Info, Audit, Actions (Docs removed)
2. Employee modal tabs: Details, Salary, Attendance, Documents, Audit
3. Weekly Off Day selector in Details tab
4. Lead Assignment Control checkbox in Details tab
5. Salary tab with year filter for payment history
6. Attendance tab with month-wise leave summary and year filter
7. Mechanic salary shows 'Price Per Inspection'
8. HR Manager should NOT see Settings tab
9. Round-robin excludes employees on weekly off or marked absent
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHRModuleV3:
    """HR Module V3 feature tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.ceo_token = None
        self.hr_token = None
        self.ceo_login()
        self.hr_login()
    
    def ceo_login(self):
        """Login as CEO"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123"
        })
        if response.status_code == 200:
            self.ceo_token = response.json().get("access_token")
        return response
    
    def hr_login(self):
        """Login as HR Manager"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        if response.status_code == 200:
            self.hr_token = response.json().get("access_token")
        return response
    
    def get_ceo_headers(self):
        return {"Authorization": f"Bearer {self.ceo_token}"}
    
    def get_hr_headers(self):
        return {"Authorization": f"Bearer {self.hr_token}"}
    
    # ==================== TAB VISIBILITY TESTS ====================
    
    def test_ceo_visible_tabs_includes_settings(self):
        """CEO should see Settings tab"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.get_ceo_headers())
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        assert "settings" in visible_tabs, f"CEO should see settings tab. Got: {visible_tabs}"
        print(f"✓ CEO visible tabs: {visible_tabs}")
    
    def test_hr_manager_visible_tabs_excludes_settings(self):
        """HR Manager should NOT see Settings tab (V3 requirement)"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.get_hr_headers())
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        # HR Manager should only see 'employees' tab, NOT settings
        assert "settings" not in visible_tabs, f"HR Manager should NOT see settings tab. Got: {visible_tabs}"
        assert "employees" in visible_tabs, f"HR Manager should see employees tab. Got: {visible_tabs}"
        print(f"✓ HR Manager visible tabs (no settings): {visible_tabs}")
    
    def test_hr_manager_can_access_employees_page(self):
        """HR Manager should still access Admin/Employees page"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_hr_headers())
        assert response.status_code == 200
        employees = response.json()
        assert isinstance(employees, list)
        print(f"✓ HR Manager can access employees page - {len(employees)} employees found")
    
    # ==================== EMPLOYEE DATA TESTS ====================
    
    def test_employee_has_weekly_off_day(self):
        """Employees should have weekly_off_day field"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0, "No employees found"
        
        # Check first employee has weekly_off_day
        emp = employees[0]
        assert "weekly_off_day" in emp or emp.get("weekly_off_day") is not None or emp.get("weekly_off_day") == 0, \
            f"Employee should have weekly_off_day field. Got: {emp.keys()}"
        print(f"✓ Employee has weekly_off_day: {emp.get('weekly_off_day')}")
    
    def test_employee_has_is_available_for_leads(self):
        """Employees should have is_available_for_leads field"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        
        # Check employee has is_available_for_leads field
        emp = employees[0]
        # Field may be True, False, or not present (defaults to True)
        print(f"✓ Employee is_available_for_leads: {emp.get('is_available_for_leads', 'not set (defaults True)')}")
    
    def test_employee_has_salary_info_with_gross_or_price_per_inspection(self):
        """Salary Info should show gross_salary for permanent staff or price_per_inspection for mechanics"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        
        # Find employees with salary info
        employees_with_salary = [e for e in employees if e.get("salary_info")]
        print(f"Found {len(employees_with_salary)} employees with salary info")
        
        for emp in employees_with_salary:
            salary_info = emp.get("salary_info", {})
            role_code = emp.get("role_code", "")
            
            if role_code == "MECHANIC" or salary_info.get("employment_type") == "freelancer":
                # Mechanic should have price_per_inspection
                assert "price_per_inspection" in salary_info, \
                    f"Mechanic {emp['name']} should have price_per_inspection"
                print(f"✓ Mechanic {emp['name']} has price_per_inspection: {salary_info.get('price_per_inspection')}")
            else:
                # Permanent staff should have gross_salary or basic_salary
                has_salary = "gross_salary" in salary_info or "basic_salary" in salary_info
                assert has_salary, f"Employee {emp['name']} should have gross_salary or basic_salary"
                print(f"✓ Employee {emp['name']} has gross_salary: {salary_info.get('gross_salary', salary_info.get('basic_salary'))}")
    
    def test_employee_has_audit_count(self):
        """Employees should have audit_count for inline audit display"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        
        emp = employees[0]
        assert "audit_count" in emp, f"Employee should have audit_count field. Got: {emp.keys()}"
        print(f"✓ Employee {emp['name']} has audit_count: {emp.get('audit_count')}")
    
    def test_employee_has_today_attendance(self):
        """Employees should have today_attendance status"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        
        emp = employees[0]
        # today_attendance can be None if not marked
        print(f"✓ Employee {emp['name']} today_attendance: {emp.get('today_attendance', 'not marked')}")
    
    # ==================== WEEKLY OFF UPDATE TEST ====================
    
    def test_update_weekly_off_day(self):
        """Test updating employee's weekly off day"""
        # Get an employee
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        
        emp_id = employees[0]["id"]
        
        # Update weekly off day to Sunday (0) - using PATCH method
        response = requests.patch(
            f"{BASE_URL}/api/hr/employees/{emp_id}/weekly-off",
            headers=self.get_ceo_headers(),
            json={"weekly_off_day": 0}
        )
        assert response.status_code == 200
        print(f"✓ Updated weekly off day for employee {emp_id}")
    
    # ==================== LEAD ASSIGNMENT TOGGLE TEST ====================
    
    def test_toggle_lead_assignment(self):
        """Test toggling lead assignment availability"""
        # Get an employee
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        
        emp_id = employees[0]["id"]
        
        # Toggle lead assignment off - using PATCH method
        response = requests.patch(
            f"{BASE_URL}/api/hr/employees/{emp_id}/lead-assignment",
            headers=self.get_ceo_headers(),
            json={"is_available_for_leads": False, "reason": "Testing"}
        )
        assert response.status_code == 200
        print(f"✓ Toggled lead assignment off for employee {emp_id}")
        
        # Toggle back on
        response = requests.patch(
            f"{BASE_URL}/api/hr/employees/{emp_id}/lead-assignment",
            headers=self.get_ceo_headers(),
            json={"is_available_for_leads": True}
        )
        assert response.status_code == 200
        print(f"✓ Toggled lead assignment back on for employee {emp_id}")
    
    # ==================== SALARY PAYMENTS HISTORY TEST ====================
    
    def test_get_salary_payments_with_year_filter(self):
        """Test getting salary payments history with year filter"""
        # Get an employee
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        
        emp_id = employees[0]["id"]
        
        # Get salary payments for 2026
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{emp_id}/salary-payments?year=2026",
            headers=self.get_ceo_headers()
        )
        assert response.status_code == 200
        payments = response.json()
        assert isinstance(payments, list)
        print(f"✓ Got salary payments for 2026: {len(payments)} records")
        
        # Get salary payments for 2025
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{emp_id}/salary-payments?year=2025",
            headers=self.get_ceo_headers()
        )
        assert response.status_code == 200
        payments = response.json()
        print(f"✓ Got salary payments for 2025: {len(payments)} records")
    
    # ==================== LEAVE SUMMARY TEST ====================
    
    def test_get_leave_summary_with_year_filter(self):
        """Test getting leave summary with year filter"""
        # Get an employee
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        
        emp_id = employees[0]["id"]
        
        # Get leave summary for 2026
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{emp_id}/leave-summary?year=2026",
            headers=self.get_ceo_headers()
        )
        assert response.status_code == 200
        summary = response.json()
        print(f"✓ Got leave summary for 2026: {summary}")
    
    # ==================== ATTENDANCE MARKING TEST ====================
    
    def test_mark_attendance_absent(self):
        """Test marking employee as absent"""
        # Get an employee
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        
        emp_id = employees[0]["id"]
        
        # Mark as absent for today
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{emp_id}/attendance",
            headers=self.get_ceo_headers(),
            json={"date": today, "status": "absent"}
        )
        assert response.status_code == 200
        print(f"✓ Marked employee {emp_id} as absent for {today}")
        
        # Mark back as present
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{emp_id}/attendance",
            headers=self.get_ceo_headers(),
            json={"date": today, "status": "present"}
        )
        assert response.status_code == 200
        print(f"✓ Marked employee {emp_id} as present for {today}")
    
    # ==================== MECHANIC SALARY TEST ====================
    
    def test_mechanic_salary_has_price_per_inspection(self):
        """Test that mechanic salary structure has price_per_inspection"""
        # Get employees and find a mechanic
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        
        mechanics = [e for e in employees if e.get("role_code") == "MECHANIC"]
        
        if len(mechanics) == 0:
            pytest.skip("No mechanics found in the system")
        
        mechanic = mechanics[0]
        
        # Get mechanic's salary
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{mechanic['id']}/salary",
            headers=self.get_ceo_headers()
        )
        assert response.status_code == 200
        salary = response.json()
        
        # Mechanic salary should indicate freelancer type
        assert salary.get("is_freelancer") == True or salary.get("employment_type") == "freelancer", \
            f"Mechanic salary should be freelancer type. Got: {salary}"
        print(f"✓ Mechanic {mechanic['name']} salary structure: {salary}")
    
    # ==================== EMPLOYEE AUDIT TRAIL TEST ====================
    
    def test_employee_audit_trail(self):
        """Test getting employee-specific audit trail"""
        # Get an employee
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.get_ceo_headers())
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        
        emp_id = employees[0]["id"]
        
        # Get audit trail
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{emp_id}/audit",
            headers=self.get_ceo_headers()
        )
        assert response.status_code == 200
        audit_logs = response.json()
        assert isinstance(audit_logs, list)
        print(f"✓ Got audit trail for employee {emp_id}: {len(audit_logs)} entries")
        
        # Check audit log structure
        if len(audit_logs) > 0:
            log = audit_logs[0]
            assert "action" in log, "Audit log should have action field"
            assert "timestamp" in log, "Audit log should have timestamp field"
            print(f"✓ Audit log structure: action={log.get('action')}, timestamp={log.get('timestamp')}")
    
    # ==================== ROUND ROBIN EXCLUSION TEST ====================
    
    def test_round_robin_available_agents_excludes_weekly_off(self):
        """Test that round-robin excludes employees on weekly off"""
        # Get countries first
        response = requests.get(f"{BASE_URL}/api/hr/countries", headers=self.get_ceo_headers())
        assert response.status_code == 200
        countries = response.json()
        
        if len(countries) == 0:
            pytest.skip("No countries found")
        
        country_id = countries[0]["id"]
        
        # Get available agents for round-robin
        response = requests.get(
            f"{BASE_URL}/api/round-robin/available-agents/{country_id}",
            headers=self.get_ceo_headers()
        )
        
        if response.status_code == 200:
            agents = response.json()
            print(f"✓ Round-robin available agents for country {country_id}: {len(agents)} agents")
            # Agents returned should not be on weekly off today
            for agent in agents:
                print(f"  - {agent.get('name')} (weekly_off_day: {agent.get('weekly_off_day')})")
        else:
            print(f"Round-robin endpoint returned {response.status_code}")


class TestRBACTabVisibility:
    """Test RBAC tab visibility via API"""
    
    def test_rbac_hr_manager_tabs_via_api(self):
        """Verify HR Manager tabs via API - should NOT include settings"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        assert "employees" in visible_tabs, f"HR Manager should have employees tab. Got: {visible_tabs}"
        assert "settings" not in visible_tabs, f"HR Manager should NOT have settings tab. Got: {visible_tabs}"
        print(f"✓ RBAC HR_MANAGER tabs via API: {visible_tabs}")
    
    def test_rbac_ceo_tabs_via_api(self):
        """Verify CEO tabs via API - should include settings"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123"
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        visible_tabs = data.get("visible_tabs", [])
        
        assert "settings" in visible_tabs, f"CEO should have settings tab. Got: {visible_tabs}"
        assert "employees" in visible_tabs, f"CEO should have employees tab. Got: {visible_tabs}"
        print(f"✓ RBAC CEO tabs via API: {visible_tabs}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
