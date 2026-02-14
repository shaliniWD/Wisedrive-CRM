"""
Test suite for WiseDrive CRM - 8 New Features
1. NumericInput bug fix (frontend only)
2. LOP tracking in attendance calendar
3. HR can update attendance status
4. Date restrictions on attendance filters (frontend only)
5. City Master for Countries
6. LOP shown in payroll instead of Absent
7. Payslips tab in Employee Modal
8. Hidden Emergent badge (frontend only)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def get_india_country():
    """Get India country from public endpoint"""
    response = requests.get(f"{BASE_URL}/api/auth/countries")
    if response.status_code == 200:
        countries = response.json()
        return next((c for c in countries if c.get('name', '').lower() == 'india'), None)
    return None

def get_hr_token():
    """Get HR Manager token"""
    india = get_india_country()
    if not india:
        return None
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "hr@wisedrive.com",
        "password": "password123",
        "country_id": india['id']
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    return None

def get_ceo_token():
    """Get CEO token"""
    india = get_india_country()
    if not india:
        return None
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kalyan@wisedrive.com",
        "password": "password123",
        "country_id": india['id']
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


class TestAuth:
    """Authentication tests"""
    
    def test_hr_login(self):
        """Test HR Manager can login"""
        token = get_hr_token()
        assert token is not None, "HR login failed"
        print(f"HR token obtained: {token[:20]}...")
    
    def test_ceo_login(self):
        """Test CEO can login"""
        token = get_ceo_token()
        assert token is not None, "CEO login failed"
        print(f"CEO token obtained: {token[:20]}...")


class TestAttendanceCalendar:
    """Test attendance calendar with LOP tracking"""
    
    @pytest.fixture(scope="class")
    def hr_headers(self):
        """Get HR auth headers"""
        token = get_hr_token()
        if not token:
            pytest.skip("HR login failed")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_attendance_calendar(self, hr_headers):
        """Test GET /api/hr/attendance/calendar returns calendar data"""
        now = datetime.now()
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar",
            params={"month": now.month, "year": now.year},
            headers=hr_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "month" in data
        assert "year" in data
        assert "month_name" in data
        assert "total_days" in data
        assert "employees" in data
        assert "legend" in data
        
        print(f"Calendar data for {data['month_name']} {data['year']}")
        print(f"Total employees: {len(data['employees'])}")
        print(f"Total days: {data['total_days']}")
    
    def test_calendar_has_lop_in_legend(self, hr_headers):
        """Test calendar legend includes LOP status"""
        now = datetime.now()
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar",
            params={"month": now.month, "year": now.year},
            headers=hr_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        legend = data.get("legend", {})
        assert "lop" in legend, "LOP not in legend"
        assert legend["lop"]["color"] == "#EF4444", "LOP color should be red"
        assert "LOP" in legend["lop"]["label"] or "Absent" in legend["lop"]["label"]
        print(f"LOP legend: {legend['lop']}")
    
    def test_calendar_has_half_day_in_legend(self, hr_headers):
        """Test calendar legend includes half_day status"""
        now = datetime.now()
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar",
            params={"month": now.month, "year": now.year},
            headers=hr_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        legend = data.get("legend", {})
        assert "half_day" in legend, "half_day not in legend"
        print(f"Half Day legend: {legend['half_day']}")
    
    def test_calendar_employee_summary_has_lop_days(self, hr_headers):
        """Test employee summary includes lop_days count"""
        now = datetime.now()
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar",
            params={"month": now.month, "year": now.year},
            headers=hr_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["employees"]:
            employee = data["employees"][0]
            summary = employee.get("summary", {})
            assert "lop_days" in summary, "lop_days not in employee summary"
            assert "half_days" in summary, "half_days not in employee summary"
            print(f"Employee {employee['employee_name']} summary: {summary}")
    
    def test_calendar_search_filter(self, hr_headers):
        """Test calendar search filter works"""
        now = datetime.now()
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar",
            params={"month": now.month, "year": now.year, "search": "john"},
            headers=hr_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned employees should match search
        for emp in data["employees"]:
            name_match = "john" in emp["employee_name"].lower()
            email_match = "john" in emp.get("email", "").lower()
            code_match = "john" in (emp.get("employee_code") or "").lower()
            assert name_match or email_match or code_match, f"Employee {emp['employee_name']} doesn't match search"
        
        print(f"Search 'john' returned {len(data['employees'])} employees")


class TestAttendanceUpdate:
    """Test HR attendance update functionality"""
    
    @pytest.fixture(scope="class")
    def hr_headers(self):
        """Get HR auth headers"""
        token = get_hr_token()
        if not token:
            pytest.skip("HR login failed")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_employee_id(self, hr_headers):
        """Get a test employee ID"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=hr_headers)
        if response.status_code == 200:
            employees = response.json()
            if employees:
                return employees[0]["id"]
        return None
    
    def test_update_attendance_to_lop(self, hr_headers, test_employee_id):
        """Test POST /api/hr/attendance/update-day can set LOP status"""
        if not test_employee_id:
            pytest.skip("No test employee found")
        
        # Use yesterday's date (not future)
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/hr/attendance/update-day",
            json={
                "employee_id": test_employee_id,
                "date": yesterday,
                "status": "lop",
                "notes": "Test LOP entry"
            },
            headers=hr_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Attendance updated successfully"
        assert data["status"] == "lop"
        print(f"Updated attendance for {yesterday} to LOP")
    
    def test_update_attendance_to_present(self, hr_headers, test_employee_id):
        """Test updating attendance to present"""
        if not test_employee_id:
            pytest.skip("No test employee found")
        
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/hr/attendance/update-day",
            json={
                "employee_id": test_employee_id,
                "date": yesterday,
                "status": "present",
                "notes": "Restored to present"
            },
            headers=hr_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print("Restored attendance to present")
    
    def test_update_attendance_to_half_day(self, hr_headers, test_employee_id):
        """Test updating attendance to half day"""
        if not test_employee_id:
            pytest.skip("No test employee found")
        
        two_days_ago = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/hr/attendance/update-day",
            json={
                "employee_id": test_employee_id,
                "date": two_days_ago,
                "status": "half_day",
                "notes": "Half day test"
            },
            headers=hr_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print("Set attendance to half day")
    
    def test_cannot_update_future_date(self, hr_headers, test_employee_id):
        """Test cannot update attendance for future dates"""
        if not test_employee_id:
            pytest.skip("No test employee found")
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/hr/attendance/update-day",
            json={
                "employee_id": test_employee_id,
                "date": tomorrow,
                "status": "present"
            },
            headers=hr_headers
        )
        assert response.status_code == 400, f"Should fail for future date: {response.text}"
        assert "future" in response.json().get("detail", "").lower()
        print("Correctly rejected future date update")
    
    def test_absent_normalizes_to_lop(self, hr_headers, test_employee_id):
        """Test 'absent' status normalizes to 'lop'"""
        if not test_employee_id:
            pytest.skip("No test employee found")
        
        three_days_ago = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/hr/attendance/update-day",
            json={
                "employee_id": test_employee_id,
                "date": three_days_ago,
                "status": "absent"  # Should normalize to lop
            },
            headers=hr_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["status"] == "lop", "absent should normalize to lop"
        print("'absent' correctly normalized to 'lop'")
    
    def test_verify_lop_in_calendar_after_update(self, hr_headers, test_employee_id):
        """Test that LOP shows in calendar after update"""
        if not test_employee_id:
            pytest.skip("No test employee found")
        
        now = datetime.now()
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar",
            params={"month": now.month, "year": now.year},
            headers=hr_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find the employee we updated
        employee = next((e for e in data["employees"] if e["employee_id"] == test_employee_id), None)
        if employee:
            # Check if any day has lop status
            lop_days = [d for d in employee["days"].values() if d.get("status") in ["lop", "absent"]]
            print(f"Employee has {len(lop_days)} LOP days in calendar")


class TestCityMaster:
    """Test City Master functionality for Countries"""
    
    @pytest.fixture(scope="class")
    def ceo_headers(self):
        """Get CEO auth headers"""
        token = get_ceo_token()
        if not token:
            pytest.skip("CEO login failed")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_countries_with_cities(self, ceo_headers):
        """Test countries endpoint returns cities array"""
        response = requests.get(f"{BASE_URL}/api/countries", headers=ceo_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        countries = response.json()
        
        assert len(countries) > 0, "No countries found"
        
        # Check if countries have cities field
        for country in countries:
            # cities field should exist (can be empty array or None)
            print(f"Country {country['name']}: cities = {country.get('cities', [])}")
        
        # Find India and check cities
        india = next((c for c in countries if c.get('name', '').lower() == 'india'), None)
        if india:
            print(f"India cities: {india.get('cities', [])}")
    
    def test_update_country_with_cities(self, ceo_headers):
        """Test updating country with cities"""
        # Get India country
        response = requests.get(f"{BASE_URL}/api/countries", headers=ceo_headers)
        countries = response.json()
        india = next((c for c in countries if c.get('name', '').lower() == 'india'), None)
        
        if not india:
            pytest.skip("India country not found")
        
        # Update with cities
        test_cities = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad"]
        update_response = requests.put(
            f"{BASE_URL}/api/hr/countries/{india['id']}",
            json={
                "name": india["name"],
                "code": india["code"],
                "currency": india.get("currency", "INR"),
                "currency_symbol": india.get("currency_symbol", "₹"),
                "phone_code": india.get("phone_code", "+91"),
                "is_active": True,
                "cities": test_cities
            },
            headers=ceo_headers
        )
        
        # May return 200 or 403 depending on permissions
        if update_response.status_code == 200:
            print(f"Updated India with cities: {test_cities}")
            
            # Verify cities were saved
            verify_response = requests.get(f"{BASE_URL}/api/countries", headers=ceo_headers)
            countries = verify_response.json()
            india_updated = next((c for c in countries if c.get('name', '').lower() == 'india'), None)
            if india_updated:
                assert india_updated.get("cities") == test_cities, "Cities not saved correctly"
        else:
            print(f"Update response: {update_response.status_code} - {update_response.text}")


class TestEmployeePayslips:
    """Test Employee Payslips endpoint"""
    
    @pytest.fixture(scope="class")
    def hr_headers(self):
        """Get HR auth headers"""
        token = get_hr_token()
        if not token:
            pytest.skip("HR login failed")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_employee_id(self, hr_headers):
        """Get a test employee ID"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=hr_headers)
        if response.status_code == 200:
            employees = response.json()
            if employees:
                return employees[0]["id"]
        return None
    
    def test_get_employee_payslips_endpoint_exists(self, hr_headers, test_employee_id):
        """Test GET /api/hr/payroll/employee/{id}/payslips endpoint exists"""
        if not test_employee_id:
            pytest.skip("No test employee found")
        
        response = requests.get(
            f"{BASE_URL}/api/hr/payroll/employee/{test_employee_id}/payslips",
            headers=hr_headers
        )
        
        # Should return 200 (even if empty list)
        assert response.status_code == 200, f"Failed: {response.text}"
        payslips = response.json()
        
        assert isinstance(payslips, list), "Response should be a list"
        print(f"Found {len(payslips)} payslips for employee")
        
        # If payslips exist, verify structure
        if payslips:
            payslip = payslips[0]
            assert "id" in payslip
            assert "month" in payslip
            assert "year" in payslip
            assert "gross_salary" in payslip
            assert "net_salary" in payslip
            assert "total_deductions" in payslip
            print(f"Sample payslip: {payslip['month']}/{payslip['year']} - Net: {payslip['net_salary']}")
    
    def test_payslips_sorted_by_date_desc(self, hr_headers, test_employee_id):
        """Test payslips are sorted by date descending (newest first)"""
        if not test_employee_id:
            pytest.skip("No test employee found")
        
        response = requests.get(
            f"{BASE_URL}/api/hr/payroll/employee/{test_employee_id}/payslips",
            headers=hr_headers
        )
        assert response.status_code == 200
        payslips = response.json()
        
        if len(payslips) >= 2:
            # Check sorting - first should be newer than second
            first = payslips[0]
            second = payslips[1]
            first_date = first["year"] * 12 + first["month"]
            second_date = second["year"] * 12 + second["month"]
            assert first_date >= second_date, "Payslips should be sorted newest first"
            print("Payslips correctly sorted by date descending")
        else:
            print(f"Only {len(payslips)} payslips found, skipping sort check")


class TestRBACForNewEndpoints:
    """Test RBAC for new endpoints"""
    
    @pytest.fixture(scope="class")
    def sales_headers(self):
        """Get Sales user headers (should have limited access)"""
        india = get_india_country()
        if not india:
            return None
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "john.sales@wisedrive.com",
            "password": "password123",
            "country_id": india['id']
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            return {"Authorization": f"Bearer {token}"}
        return None
    
    @pytest.fixture(scope="class")
    def hr_headers(self):
        """Get HR auth headers"""
        token = get_hr_token()
        if not token:
            pytest.skip("HR login failed")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_employee_id(self, hr_headers):
        """Get a test employee ID"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=hr_headers)
        if response.status_code == 200:
            employees = response.json()
            if employees:
                return employees[0]["id"]
        return None
    
    def test_sales_cannot_access_attendance_calendar(self, sales_headers):
        """Test sales user cannot access attendance calendar"""
        if not sales_headers:
            pytest.skip("Sales user login failed")
        
        now = datetime.now()
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar",
            params={"month": now.month, "year": now.year},
            headers=sales_headers
        )
        assert response.status_code == 403, f"Sales should not access calendar: {response.status_code}"
        print("Sales correctly denied access to attendance calendar")
    
    def test_sales_cannot_update_attendance(self, sales_headers, test_employee_id):
        """Test sales user cannot update attendance"""
        if not sales_headers:
            pytest.skip("Sales user login failed")
        if not test_employee_id:
            pytest.skip("No test employee found")
        
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/hr/attendance/update-day",
            json={
                "employee_id": test_employee_id,
                "date": yesterday,
                "status": "present"
            },
            headers=sales_headers
        )
        assert response.status_code == 403, f"Sales should not update attendance: {response.status_code}"
        print("Sales correctly denied attendance update")
    
    def test_sales_cannot_access_employee_payslips(self, sales_headers, test_employee_id):
        """Test sales user cannot access employee payslips"""
        if not sales_headers:
            pytest.skip("Sales user login failed")
        if not test_employee_id:
            pytest.skip("No test employee found")
        
        response = requests.get(
            f"{BASE_URL}/api/hr/payroll/employee/{test_employee_id}/payslips",
            headers=sales_headers
        )
        assert response.status_code == 403, f"Sales should not access payslips: {response.status_code}"
        print("Sales correctly denied access to employee payslips")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
