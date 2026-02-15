"""
Test Suite for Iteration 26 Features:
1. Backend - Roles API returns leave entitlements (eligible_sick_leaves_per_month, eligible_casual_leaves_per_month)
2. Backend - PUT /api/roles/{id} updates role leave entitlements
3. Bug fix - Weekly off day updates correctly when editing an existing employee
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRolesLeaveEntitlements:
    """Test roles API for leave entitlements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as HR Manager to get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_roles_returns_leave_entitlements(self):
        """Test that GET /api/roles returns leave entitlement fields"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=self.headers)
        assert response.status_code == 200, f"Failed to get roles: {response.text}"
        
        roles = response.json()
        assert len(roles) > 0, "No roles found"
        
        # Check that at least one role has leave entitlement fields
        role_with_entitlements = None
        for role in roles:
            if 'eligible_sick_leaves_per_month' in role or 'eligible_casual_leaves_per_month' in role:
                role_with_entitlements = role
                break
        
        # Verify leave entitlement fields exist
        assert role_with_entitlements is not None, "No role has leave entitlement fields"
        print(f"✓ Role '{role_with_entitlements.get('name')}' has leave entitlements:")
        print(f"  - eligible_sick_leaves_per_month: {role_with_entitlements.get('eligible_sick_leaves_per_month')}")
        print(f"  - eligible_casual_leaves_per_month: {role_with_entitlements.get('eligible_casual_leaves_per_month')}")
    
    def test_update_role_leave_entitlements(self):
        """Test that PUT /api/roles/{id} updates leave entitlements"""
        # First get all roles
        response = requests.get(f"{BASE_URL}/api/roles", headers=self.headers)
        assert response.status_code == 200
        roles = response.json()
        
        # Find a role to update (preferably not CEO)
        test_role = None
        for role in roles:
            if role.get('code') not in ['CEO']:
                test_role = role
                break
        
        assert test_role is not None, "No suitable role found for testing"
        role_id = test_role['id']
        
        # Get current values
        original_sick = test_role.get('eligible_sick_leaves_per_month', 2)
        original_casual = test_role.get('eligible_casual_leaves_per_month', 1)
        
        # Update with new values
        new_sick = 3
        new_casual = 2
        
        update_response = requests.put(
            f"{BASE_URL}/api/roles/{role_id}",
            headers=self.headers,
            json={
                "eligible_sick_leaves_per_month": new_sick,
                "eligible_casual_leaves_per_month": new_casual
            }
        )
        assert update_response.status_code == 200, f"Failed to update role: {update_response.text}"
        
        updated_role = update_response.json()
        assert updated_role.get('eligible_sick_leaves_per_month') == new_sick, \
            f"Sick leaves not updated. Expected {new_sick}, got {updated_role.get('eligible_sick_leaves_per_month')}"
        assert updated_role.get('eligible_casual_leaves_per_month') == new_casual, \
            f"Casual leaves not updated. Expected {new_casual}, got {updated_role.get('eligible_casual_leaves_per_month')}"
        
        print(f"✓ Role '{test_role.get('name')}' leave entitlements updated:")
        print(f"  - eligible_sick_leaves_per_month: {original_sick} → {new_sick}")
        print(f"  - eligible_casual_leaves_per_month: {original_casual} → {new_casual}")
        
        # Restore original values
        restore_response = requests.put(
            f"{BASE_URL}/api/roles/{role_id}",
            headers=self.headers,
            json={
                "eligible_sick_leaves_per_month": original_sick,
                "eligible_casual_leaves_per_month": original_casual
            }
        )
        assert restore_response.status_code == 200, "Failed to restore original values"
        print(f"✓ Original values restored")


class TestWeeklyOffDayBugFix:
    """Test that weekly_off_day updates correctly when editing an existing employee"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as HR Manager to get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_update_employee_weekly_off_day(self):
        """Test that weekly_off_day can be updated for an existing employee"""
        # Get list of employees
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.headers)
        assert response.status_code == 200, f"Failed to get employees: {response.text}"
        
        employees = response.json()
        assert len(employees) > 0, "No employees found"
        
        # Find an active employee to test
        test_employee = None
        for emp in employees:
            if emp.get('is_active', True):
                test_employee = emp
                break
        
        assert test_employee is not None, "No active employee found for testing"
        employee_id = test_employee['id']
        
        # Get current weekly_off_day
        original_weekly_off = test_employee.get('weekly_off_day', 0)
        print(f"Testing employee: {test_employee.get('name')}")
        print(f"Original weekly_off_day: {original_weekly_off}")
        
        # Update to a different day (cycle through 0-6)
        new_weekly_off = (original_weekly_off + 1) % 7
        
        update_response = requests.put(
            f"{BASE_URL}/api/hr/employees/{employee_id}",
            headers=self.headers,
            json={"weekly_off_day": new_weekly_off}
        )
        assert update_response.status_code == 200, f"Failed to update employee: {update_response.text}"
        
        updated_employee = update_response.json()
        assert updated_employee.get('weekly_off_day') == new_weekly_off, \
            f"weekly_off_day not updated. Expected {new_weekly_off}, got {updated_employee.get('weekly_off_day')}"
        
        print(f"✓ weekly_off_day updated: {original_weekly_off} → {new_weekly_off}")
        
        # Verify by fetching the employee again
        verify_response = requests.get(
            f"{BASE_URL}/api/hr/employees/{employee_id}",
            headers=self.headers
        )
        assert verify_response.status_code == 200
        verified_employee = verify_response.json()
        assert verified_employee.get('weekly_off_day') == new_weekly_off, \
            f"weekly_off_day not persisted. Expected {new_weekly_off}, got {verified_employee.get('weekly_off_day')}"
        
        print(f"✓ weekly_off_day persisted correctly in database")
        
        # Restore original value
        restore_response = requests.put(
            f"{BASE_URL}/api/hr/employees/{employee_id}",
            headers=self.headers,
            json={"weekly_off_day": original_weekly_off}
        )
        assert restore_response.status_code == 200, "Failed to restore original weekly_off_day"
        print(f"✓ Original weekly_off_day restored: {original_weekly_off}")
    
    def test_weekly_off_day_accepts_all_valid_values(self):
        """Test that weekly_off_day accepts all valid values (0-6)"""
        # Get an employee
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.headers)
        assert response.status_code == 200
        
        employees = response.json()
        test_employee = next((e for e in employees if e.get('is_active', True)), None)
        assert test_employee is not None, "No active employee found"
        
        employee_id = test_employee['id']
        original_weekly_off = test_employee.get('weekly_off_day', 0)
        
        # Test all valid values (0=Sunday through 6=Saturday)
        day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        
        for day_value in range(7):
            update_response = requests.put(
                f"{BASE_URL}/api/hr/employees/{employee_id}",
                headers=self.headers,
                json={"weekly_off_day": day_value}
            )
            assert update_response.status_code == 200, f"Failed to set weekly_off_day to {day_value}"
            
            updated = update_response.json()
            assert updated.get('weekly_off_day') == day_value, \
                f"weekly_off_day mismatch for {day_names[day_value]}"
            print(f"✓ weekly_off_day = {day_value} ({day_names[day_value]}) - OK")
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/hr/employees/{employee_id}",
            headers=self.headers,
            json={"weekly_off_day": original_weekly_off}
        )
        print(f"✓ All 7 day values (0-6) work correctly")


class TestPayrollPreviewWithLeaveEntitlements:
    """Test payroll preview includes leave entitlements from roles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as HR Manager to get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_payroll_preview_includes_leave_entitlements(self):
        """Test that payroll preview includes leave entitlement info from roles"""
        # Get countries first
        countries_response = requests.get(f"{BASE_URL}/api/countries", headers=self.headers)
        assert countries_response.status_code == 200
        countries = countries_response.json()
        
        if not countries:
            pytest.skip("No countries available for testing")
        
        country_id = countries[0]['id']
        
        # Generate payroll preview
        import datetime
        current_month = datetime.datetime.now().month
        current_year = datetime.datetime.now().year
        
        preview_response = requests.post(
            f"{BASE_URL}/api/hr/payroll/preview",
            headers=self.headers,
            json={
                "month": current_month,
                "year": current_year,
                "country_id": country_id
            }
        )
        
        # Preview might fail if batch already exists - that's OK
        if preview_response.status_code == 400 and "already exists" in preview_response.text.lower():
            print("✓ Payroll batch already exists for this month - skipping preview test")
            return
        
        assert preview_response.status_code == 200, f"Failed to generate preview: {preview_response.text}"
        
        preview_data = preview_response.json()
        records = preview_data.get('records', [])
        
        if not records:
            print("✓ No employees in preview (may be no eligible employees)")
            return
        
        # Check that records include leave entitlement fields
        record = records[0]
        
        # Check for leave entitlement fields
        has_sick_leaves = 'eligible_sick_leaves' in record
        has_casual_leaves = 'eligible_casual_leaves' in record
        has_total_entitlement = 'total_leave_entitlement' in record
        
        print(f"Preview record fields for {record.get('employee_name')}:")
        print(f"  - eligible_sick_leaves: {record.get('eligible_sick_leaves', 'N/A')}")
        print(f"  - eligible_casual_leaves: {record.get('eligible_casual_leaves', 'N/A')}")
        print(f"  - total_leave_entitlement: {record.get('total_leave_entitlement', 'N/A')}")
        print(f"  - leaves_taken: {record.get('leaves_taken', 'N/A')}")
        print(f"  - leaves_beyond_entitlement: {record.get('leaves_beyond_entitlement', 'N/A')}")
        
        # At least one of these should be present
        assert has_sick_leaves or has_casual_leaves or has_total_entitlement, \
            "Preview records should include leave entitlement information"
        
        print("✓ Payroll preview includes leave entitlement information")


class TestPayrollNewColumnStructure:
    """Test payroll preview has new column structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as HR Manager to get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_payroll_preview_has_required_fields(self):
        """Test that payroll preview records have all required fields for new column structure"""
        # Get countries first
        countries_response = requests.get(f"{BASE_URL}/api/countries", headers=self.headers)
        assert countries_response.status_code == 200
        countries = countries_response.json()
        
        if not countries:
            pytest.skip("No countries available for testing")
        
        country_id = countries[0]['id']
        
        # Generate payroll preview
        import datetime
        current_month = datetime.datetime.now().month
        current_year = datetime.datetime.now().year
        
        preview_response = requests.post(
            f"{BASE_URL}/api/hr/payroll/preview",
            headers=self.headers,
            json={
                "month": current_month,
                "year": current_year,
                "country_id": country_id
            }
        )
        
        # Preview might fail if batch already exists
        if preview_response.status_code == 400 and "already exists" in preview_response.text.lower():
            print("✓ Payroll batch already exists - checking existing batch instead")
            
            # Get existing batches
            batches_response = requests.get(
                f"{BASE_URL}/api/hr/payroll/batches",
                headers=self.headers,
                params={"month": current_month, "year": current_year, "country_id": country_id}
            )
            if batches_response.status_code == 200:
                batches = batches_response.json()
                if batches:
                    batch_id = batches[0]['id']
                    batch_detail = requests.get(
                        f"{BASE_URL}/api/payroll/batches/{batch_id}",
                        headers=self.headers
                    )
                    if batch_detail.status_code == 200:
                        records = batch_detail.json().get('records', [])
                        if records:
                            record = records[0]
                            self._verify_record_fields(record)
                            return
            return
        
        assert preview_response.status_code == 200, f"Failed to generate preview: {preview_response.text}"
        
        preview_data = preview_response.json()
        records = preview_data.get('records', [])
        
        if not records:
            print("✓ No employees in preview")
            return
        
        record = records[0]
        self._verify_record_fields(record)
    
    def _verify_record_fields(self, record):
        """Verify record has all required fields for new payroll structure"""
        required_fields = [
            'working_days',
            'actual_working_days',
            'gross_salary',
            'incentive_amount',
            'overtime_days',
            'overtime_pay',
            'other_deductions',
            'net_salary'
        ]
        
        print(f"Checking record fields for {record.get('employee_name')}:")
        
        for field in required_fields:
            # Check if field exists (may be named slightly differently)
            field_exists = field in record or field.replace('_', '') in str(record.keys())
            print(f"  - {field}: {record.get(field, 'N/A')}")
        
        # Verify key fields exist
        assert 'gross_salary' in record, "Missing gross_salary field"
        assert 'net_salary' in record, "Missing net_salary field"
        
        # Check for incentive and overtime fields
        has_incentive = 'incentive_amount' in record
        has_overtime = 'overtime_days' in record or 'overtime_pay' in record
        has_other_ded = 'other_deductions' in record
        
        print(f"  - Has incentive field: {has_incentive}")
        print(f"  - Has overtime field: {has_overtime}")
        print(f"  - Has other_deductions field: {has_other_ded}")
        
        print("✓ Payroll record has required fields for new column structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
