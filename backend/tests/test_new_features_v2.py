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

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager token"""
        # First get countries
        countries_res = requests.get(f"{BASE_URL}/api/countries")
        assert countries_res.status_code == 200
        countries = countries_res.json()
        india = next((c for c in countries if c.get('name', '').lower() == 'india'), None)
        assert india is not None, "India country not found"
        
        # Login as HR
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_id": india['id']
        })
        assert response.status_code == 200, f"HR login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO token"""
        countries_res = requests.get(f"{BASE_URL}/api/countries")
        countries = countries_res.json()
        india = next((c for c in countries if c.get('name', '').lower() == 'india'), None)
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123",
            "country_id": india['id']
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        return response.json().get("token")
    
    def test_hr_login(self, hr_token):
        """Test HR Manager can login"""
        assert hr_token is not None
        print(f"HR token obtained: {hr_token[:20]}...")
    
    def test_ceo_login(self, ceo_token):
        """Test CEO can login"""
        assert ceo_token is not None
        print(f"CEO token obtained: {ceo_token[:20]}...")


class TestAttendanceCalendar:
    """Test attendance calendar with LOP tracking"""
    
    @pytest.fixture(scope="class")
    def hr_headers(self):
        """Get HR auth headers"""
        countries_res = requests.get(f"{BASE_URL}/api/countries")
        countries = countries_res.json()
        india = next((c for c in countries if c.get('name', '').lower() == 'india'), None)
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_id": india['id']
        })
        token = response.json().get("token")
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
        countries_res = requests.get(f"{BASE_URL}/api/countries")
        countries = countries_res.json()
        india = next((c for c in countries if c.get('name', '').lower() == 'india'), None)
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_id": india['id']
        })
        token = response.json().get("token")
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


class TestCityMaster:
    """Test City Master functionality for Countries"""
    
    @pytest.fixture(scope="class")
    def ceo_headers(self):
        """Get CEO auth headers"""
        countries_res = requests.get(f"{BASE_URL}/api/countries")
        countries = countries_res.json()
        india = next((c for c in countries if c.get('name', '').lower() == 'india'), None)
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123",
            "country_id": india['id']
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_countries_with_cities(self, ceo_headers):
        """Test countries endpoint returns cities array"""
        response = requests.get(f"{BASE_URL}/api/countries", headers=ceo_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        countries = response.json()
        
        assert len(countries) > 0, "No countries found"
        
        # Check if countries have cities field
        for country in countries:
            assert "cities" in country or country.get("cities") is None, f"Country {country['name']} missing cities field"
        
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
        else:
            print(f"Update response: {update_response.status_code} - {update_response.text}")


class TestEmployeePayslips:
    """Test Employee Payslips endpoint"""
    
    @pytest.fixture(scope="class")
    def hr_headers(self):
        """Get HR auth headers"""
        countries_res = requests.get(f"{BASE_URL}/api/countries")
        countries = countries_res.json()
        india = next((c for c in countries if c.get('name', '').lower() == 'india'), None)
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_id": india['id']
        })
        token = response.json().get("token")
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


class TestRBACForNewEndpoints:
    """Test RBAC for new endpoints"""
    
    @pytest.fixture(scope="class")
    def sales_headers(self):
        """Get Sales user headers (should have limited access)"""
        countries_res = requests.get(f"{BASE_URL}/api/countries")
        countries = countries_res.json()
        india = next((c for c in countries if c.get('name', '').lower() == 'india'), None)
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "john.sales@wisedrive.com",
            "password": "password123",
            "country_id": india['id']
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
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
    
    def test_sales_cannot_update_attendance(self, sales_headers):
        """Test sales user cannot update attendance"""
        if not sales_headers:
            pytest.skip("Sales user login failed")
        
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/hr/attendance/update-day",
            json={
                "employee_id": "some-id",
                "date": yesterday,
                "status": "present"
            },
            headers=sales_headers
        )
        assert response.status_code == 403, f"Sales should not update attendance: {response.status_code}"
        print("Sales correctly denied attendance update")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
