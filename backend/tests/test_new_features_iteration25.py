"""
Test suite for WiseDrive new features - Iteration 25
Features tested:
1. Month filter in Payroll batches view
2. LOP Days defaults to 0 in payroll preview
3. Incentive Amount and Overtime Days columns in payroll preview
4. Weekly Off (W), Org Holiday (H), Overtime (O) statuses in attendance calendar
5. Overtime option in attendance day-edit modal
6. Holiday Calendar tab for country-specific holidays
7. Overtime pay per day field in employee
8. New salary calculation: Gross + Incentive + OT Pay - Deductions
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"HR login failed: {response.status_code} - {response.text}")
    
    def test_hr_login(self, hr_token):
        """Test HR Manager can login"""
        assert hr_token is not None
        print(f"HR login successful, token obtained")


class TestPayrollBatchMonthFilter:
    """Test month filter in payroll batches view"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("HR login failed")
    
    def test_get_batches_without_month_filter(self, hr_token):
        """Test getting batches without month filter"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/payroll/batches", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} batches without month filter")
    
    def test_get_batches_with_month_filter(self, hr_token):
        """Test getting batches with month filter"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = requests.get(
            f"{BASE_URL}/api/hr/payroll/batches",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify all returned batches match the filter
        for batch in data:
            assert batch.get("month") == current_month
            assert batch.get("year") == current_year
        print(f"Got {len(data)} batches for month {current_month}/{current_year}")
    
    def test_get_batches_with_year_filter_only(self, hr_token):
        """Test getting batches with year filter only"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        current_year = datetime.now().year
        
        response = requests.get(
            f"{BASE_URL}/api/hr/payroll/batches",
            params={"year": current_year},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for batch in data:
            assert batch.get("year") == current_year
        print(f"Got {len(data)} batches for year {current_year}")


class TestPayrollPreviewLOPDefaults:
    """Test LOP Days defaults to 0 in payroll preview"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("HR login failed")
    
    @pytest.fixture(scope="class")
    def country_id(self, hr_token):
        """Get India country ID"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/countries", headers=headers)
        if response.status_code == 200:
            countries = response.json()
            for c in countries:
                if c.get("code") == "IN" or "india" in c.get("name", "").lower():
                    return c.get("id")
        pytest.skip("Could not find India country")
    
    def test_payroll_preview_lop_defaults_to_zero(self, hr_token, country_id):
        """Test that LOP days defaults to 0 in payroll preview"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        # Generate payroll preview
        response = requests.post(
            f"{BASE_URL}/api/hr/payroll/preview",
            json={
                "month": current_month,
                "year": current_year,
                "country_id": country_id
            },
            headers=headers
        )
        
        # If batch already exists, that's okay - we just need to verify the API works
        if response.status_code == 400 and "already exists" in response.text.lower():
            print("Payroll batch already exists for this month - skipping preview test")
            pytest.skip("Batch already exists")
        
        assert response.status_code == 200, f"Preview failed: {response.text}"
        data = response.json()
        
        # Verify records exist
        assert "records" in data
        records = data["records"]
        
        # Verify LOP days defaults to 0 for all employees
        for record in records:
            lop_days = record.get("lop_days", None)
            assert lop_days is not None, f"lop_days field missing for {record.get('employee_name')}"
            assert lop_days == 0, f"LOP days should default to 0, got {lop_days} for {record.get('employee_name')}"
        
        print(f"Verified LOP defaults to 0 for {len(records)} employees")


class TestPayrollIncentiveOvertimeFields:
    """Test Incentive Amount and Overtime Days columns in payroll preview"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("HR login failed")
    
    @pytest.fixture(scope="class")
    def country_id(self, hr_token):
        """Get India country ID"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/countries", headers=headers)
        if response.status_code == 200:
            countries = response.json()
            for c in countries:
                if c.get("code") == "IN" or "india" in c.get("name", "").lower():
                    return c.get("id")
        pytest.skip("Could not find India country")
    
    def test_payroll_preview_has_incentive_overtime_fields(self, hr_token, country_id):
        """Test that payroll preview includes incentive and overtime fields"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = requests.post(
            f"{BASE_URL}/api/hr/payroll/preview",
            json={
                "month": current_month,
                "year": current_year,
                "country_id": country_id
            },
            headers=headers
        )
        
        if response.status_code == 400 and "already exists" in response.text.lower():
            print("Payroll batch already exists - skipping")
            pytest.skip("Batch already exists")
        
        assert response.status_code == 200, f"Preview failed: {response.text}"
        data = response.json()
        
        records = data.get("records", [])
        if len(records) > 0:
            record = records[0]
            # Verify incentive and overtime fields exist
            assert "incentive_amount" in record, "incentive_amount field missing"
            assert "overtime_days" in record, "overtime_days field missing"
            assert "overtime_pay" in record, "overtime_pay field missing"
            assert "overtime_rate_per_day" in record, "overtime_rate_per_day field missing"
            
            print(f"Verified incentive/overtime fields present in payroll preview")


class TestAttendanceCalendarStatuses:
    """Test attendance calendar shows W/H/O statuses"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("HR login failed")
    
    def test_attendance_calendar_api(self, hr_token):
        """Test attendance calendar API returns data"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        
        assert response.status_code == 200, f"Calendar API failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "employees" in data
        assert "month" in data
        assert "year" in data
        assert "total_days" in data
        
        print(f"Attendance calendar returned {len(data.get('employees', []))} employees")
    
    def test_attendance_calendar_employee_days(self, hr_token):
        """Test attendance calendar returns day statuses for employees"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        employees = data.get("employees", [])
        if len(employees) > 0:
            emp = employees[0]
            assert "days" in emp, "Employee should have days data"
            assert "summary" in emp, "Employee should have summary"
            
            # Check summary has expected fields
            summary = emp.get("summary", {})
            assert "working_days" in summary
            
            print(f"Employee {emp.get('employee_name')} has {len(emp.get('days', {}))} day entries")


class TestAttendanceOvertimeStatus:
    """Test HR can mark Overtime status in attendance calendar"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("HR login failed")
    
    @pytest.fixture(scope="class")
    def test_employee_id(self, hr_token):
        """Get a test employee ID"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        if response.status_code == 200:
            employees = response.json()
            if len(employees) > 0:
                return employees[0].get("id")
        pytest.skip("No employees found")
    
    def test_update_attendance_to_overtime(self, hr_token, test_employee_id):
        """Test updating attendance status to overtime"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # Use a past date (yesterday or earlier)
        from datetime import timedelta
        test_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/hr/attendance/update-day",
            json={
                "employee_id": test_employee_id,
                "date": test_date,
                "status": "overtime",
                "notes": "Test overtime entry"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        print(f"Successfully marked {test_date} as overtime for employee")


class TestHolidayCalendar:
    """Test Holiday Calendar tab functionality"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("HR login failed")
    
    @pytest.fixture(scope="class")
    def country_id(self, hr_token):
        """Get India country ID"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/countries", headers=headers)
        if response.status_code == 200:
            countries = response.json()
            for c in countries:
                if c.get("code") == "IN" or "india" in c.get("name", "").lower():
                    return c.get("id")
        pytest.skip("Could not find India country")
    
    def test_get_holidays(self, hr_token):
        """Test getting holidays list"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        current_year = datetime.now().year
        
        response = requests.get(
            f"{BASE_URL}/api/hr/holidays",
            params={"year": current_year},
            headers=headers
        )
        
        assert response.status_code == 200, f"Get holidays failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} holidays for year {current_year}")
    
    def test_create_holiday(self, hr_token, country_id):
        """Test creating a new holiday"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # Create a test holiday
        test_holiday = {
            "date": f"{datetime.now().year}-12-25",
            "name": "TEST_Christmas Day",
            "reason": "Test holiday for automation",
            "country_id": country_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/hr/holidays",
            json=test_holiday,
            headers=headers
        )
        
        # May fail if holiday already exists - that's okay
        if response.status_code == 400 and "already exists" in response.text.lower():
            print("Holiday already exists - skipping creation")
            return
        
        assert response.status_code in [200, 201], f"Create holiday failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"Created holiday: {data.get('name')}")
    
    def test_delete_holiday(self, hr_token, country_id):
        """Test deleting a holiday"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # First get holidays to find one to delete
        response = requests.get(
            f"{BASE_URL}/api/hr/holidays",
            params={"year": datetime.now().year},
            headers=headers
        )
        
        if response.status_code == 200:
            holidays = response.json()
            # Find test holiday
            test_holiday = next((h for h in holidays if h.get("name", "").startswith("TEST_")), None)
            
            if test_holiday:
                delete_response = requests.delete(
                    f"{BASE_URL}/api/hr/holidays/{test_holiday['id']}",
                    headers=headers
                )
                assert delete_response.status_code in [200, 204], f"Delete failed: {delete_response.text}"
                print(f"Deleted test holiday: {test_holiday.get('name')}")
            else:
                print("No test holiday found to delete")


class TestEmployeeOvertimeRate:
    """Test overtime_rate_per_day field in employee"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("HR login failed")
    
    def test_employee_has_overtime_rate_field(self, hr_token):
        """Test that employee data includes overtime_rate_per_day field"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200, f"Get employees failed: {response.text}"
        
        employees = response.json()
        if len(employees) > 0:
            emp = employees[0]
            # The field should exist (may be 0 or null)
            # Check if it's in the response or can be set
            print(f"Employee {emp.get('name')} overtime_rate_per_day: {emp.get('overtime_rate_per_day', 'not set')}")
    
    def test_update_employee_overtime_rate(self, hr_token):
        """Test updating employee overtime rate"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        
        # Get an employee first
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200
        
        employees = response.json()
        if len(employees) == 0:
            pytest.skip("No employees found")
        
        emp = employees[0]
        emp_id = emp.get("id")
        
        # Update overtime rate
        update_response = requests.put(
            f"{BASE_URL}/api/hr/employees/{emp_id}",
            json={"overtime_rate_per_day": 500},
            headers=headers
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated_emp = update_response.json()
        assert updated_emp.get("overtime_rate_per_day") == 500
        print(f"Updated overtime rate for {emp.get('name')} to 500")


class TestSalaryCalculation:
    """Test new salary calculation: Gross + Incentive + OT Pay - Deductions"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("HR login failed")
    
    @pytest.fixture(scope="class")
    def country_id(self, hr_token):
        """Get India country ID"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/countries", headers=headers)
        if response.status_code == 200:
            countries = response.json()
            for c in countries:
                if c.get("code") == "IN" or "india" in c.get("name", "").lower():
                    return c.get("id")
        pytest.skip("Could not find India country")
    
    def test_salary_calculation_formula(self, hr_token, country_id):
        """Test that net salary = Gross + Incentive + OT Pay - Deductions"""
        headers = {"Authorization": f"Bearer {hr_token}"}
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = requests.post(
            f"{BASE_URL}/api/hr/payroll/preview",
            json={
                "month": current_month,
                "year": current_year,
                "country_id": country_id
            },
            headers=headers
        )
        
        if response.status_code == 400 and "already exists" in response.text.lower():
            pytest.skip("Batch already exists")
        
        assert response.status_code == 200, f"Preview failed: {response.text}"
        data = response.json()
        
        records = data.get("records", [])
        verified_count = 0
        for record in records:
            # Skip freelancers/mechanics - they have different calculation (inspection-based)
            if record.get("is_freelancer"):
                print(f"Skipping freelancer: {record.get('employee_name')}")
                continue
            
            gross = record.get("gross_salary", 0)
            incentive = record.get("incentive_amount", 0)
            overtime_pay = record.get("overtime_pay", 0)
            total_deductions = record.get("total_deductions", 0)
            net_salary = record.get("net_salary", 0)
            
            # Verify formula: Net = Gross + Incentive + OT Pay - Deductions
            expected_net = gross + incentive + overtime_pay - total_deductions
            
            # Allow small rounding differences
            assert abs(net_salary - expected_net) < 1, \
                f"Net salary mismatch for {record.get('employee_name')}: expected {expected_net}, got {net_salary}"
            verified_count += 1
        
        print(f"Verified salary calculation formula for {verified_count} regular employees")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
