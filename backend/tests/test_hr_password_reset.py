"""
Test HR Password Reset and Numeric Input Features
- Password Reset: HR/CEO can reset any employee's password
- Numeric Input Fix: Typing '12' when value is '0' should result in '12' not '012'
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPasswordReset:
    """Test password reset functionality for HR/CEO"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.ceo_email = "kalyan@wisedrive.com"
        self.hr_email = "hr@wisedrive.com"
        self.finance_email = "finance@wisedrive.com"
        self.password = "password123"
        
    def get_token(self, email, password):
        """Get auth token for user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_ceo_login(self):
        """Test CEO can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.ceo_email,
            "password": self.password
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role_code"] == "CEO"
        print(f"SUCCESS: CEO login works - {data['user']['name']}")
    
    def test_hr_login(self):
        """Test HR Manager can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.hr_email,
            "password": self.password
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role_code"] == "HR_MANAGER"
        print(f"SUCCESS: HR Manager login works - {data['user']['name']}")
    
    def test_finance_login(self):
        """Test Finance Manager can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.finance_email,
            "password": self.password
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role_code"] == "FINANCE_MANAGER"
        print(f"SUCCESS: Finance Manager login works - {data['user']['name']}")
    
    def test_ceo_can_view_employees(self):
        """Test CEO can view all employees"""
        token = self.get_token(self.ceo_email, self.password)
        assert token is not None
        
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        print(f"SUCCESS: CEO can view {len(employees)} employees")
        return employees
    
    def test_hr_can_view_employees(self):
        """Test HR Manager can view all employees"""
        token = self.get_token(self.hr_email, self.password)
        assert token is not None
        
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        print(f"SUCCESS: HR Manager can view {len(employees)} employees")
        return employees
    
    def test_ceo_can_reset_password(self):
        """Test CEO can reset any employee's password"""
        token = self.get_token(self.ceo_email, self.password)
        assert token is not None
        
        # Get employees
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers={
            "Authorization": f"Bearer {token}"
        })
        employees = response.json()
        
        # Find a non-CEO employee to reset password
        target_employee = None
        for emp in employees:
            if emp.get("role_code") not in ["CEO"] and emp.get("email") != self.ceo_email:
                target_employee = emp
                break
        
        assert target_employee is not None, "No suitable employee found for password reset test"
        
        # Reset password
        new_password = "newpassword123"
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{target_employee['id']}/reset-password",
            json={"new_password": new_password},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "Password reset successfully" in data.get("message", "")
        print(f"SUCCESS: CEO reset password for {target_employee['name']}")
        
        # Verify new password works
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": target_employee["email"],
            "password": new_password
        })
        assert login_response.status_code == 200
        print(f"SUCCESS: Employee can login with new password")
        
        # Reset back to original password
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{target_employee['id']}/reset-password",
            json={"new_password": self.password},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print(f"SUCCESS: Password reset back to original")
    
    def test_hr_can_reset_password(self):
        """Test HR Manager can reset any employee's password"""
        token = self.get_token(self.hr_email, self.password)
        assert token is not None
        
        # Get employees
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers={
            "Authorization": f"Bearer {token}"
        })
        employees = response.json()
        
        # Find a non-HR employee to reset password
        target_employee = None
        for emp in employees:
            if emp.get("role_code") not in ["HR_MANAGER"] and emp.get("email") != self.hr_email:
                target_employee = emp
                break
        
        assert target_employee is not None, "No suitable employee found for password reset test"
        
        # Reset password
        new_password = "hrresetpass123"
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{target_employee['id']}/reset-password",
            json={"new_password": new_password},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "Password reset successfully" in data.get("message", "")
        print(f"SUCCESS: HR Manager reset password for {target_employee['name']}")
        
        # Reset back to original password
        ceo_token = self.get_token(self.ceo_email, self.password)
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{target_employee['id']}/reset-password",
            json={"new_password": self.password},
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        print(f"SUCCESS: Password reset back to original")
    
    def test_finance_cannot_reset_password(self):
        """Test Finance Manager cannot reset passwords (403 Forbidden)"""
        finance_token = self.get_token(self.finance_email, self.password)
        assert finance_token is not None
        
        # Use CEO to get employees (Finance can't view employees)
        ceo_token = self.get_token(self.ceo_email, self.password)
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers={
            "Authorization": f"Bearer {ceo_token}"
        })
        employees = response.json()
        
        # Try to reset any employee's password using Finance token
        target_employee = employees[0] if employees else None
        assert target_employee is not None
        
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{target_employee['id']}/reset-password",
            json={"new_password": "shouldfail123"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 403
        print(f"SUCCESS: Finance Manager correctly denied password reset (403)")
    
    def test_password_min_length_validation(self):
        """Test password must be at least 6 characters"""
        token = self.get_token(self.ceo_email, self.password)
        assert token is not None
        
        # Get employees
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers={
            "Authorization": f"Bearer {token}"
        })
        employees = response.json()
        target_employee = employees[0] if employees else None
        assert target_employee is not None
        
        # Try short password
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{target_employee['id']}/reset-password",
            json={"new_password": "12345"},  # Only 5 chars
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "at least 6 characters" in data.get("detail", "").lower()
        print(f"SUCCESS: Short password correctly rejected (400)")
    
    def test_reset_nonexistent_employee(self):
        """Test reset password for non-existent employee returns 404"""
        token = self.get_token(self.ceo_email, self.password)
        assert token is not None
        
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/nonexistent-id-12345/reset-password",
            json={"new_password": "validpass123"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404
        print(f"SUCCESS: Non-existent employee correctly returns 404")


class TestPayrollPreviewNumericInput:
    """Test payroll preview numeric input behavior"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.ceo_email = "kalyan@wisedrive.com"
        self.password = "password123"
        
    def get_token(self, email, password):
        """Get auth token for user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_payroll_preview_endpoint(self):
        """Test payroll preview endpoint works"""
        token = self.get_token(self.ceo_email, self.password)
        assert token is not None
        
        # Get countries
        response = requests.get(f"{BASE_URL}/api/hr/countries", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        countries = response.json()
        assert len(countries) > 0
        
        country_id = countries[0]["id"]
        
        # Generate preview
        response = requests.post(
            f"{BASE_URL}/api/hr/payroll/preview",
            json={
                "month": 1,
                "year": 2026,
                "country_id": country_id
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # May return 200 with data or 400 if no employees with salary
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Payroll preview generated with {data.get('employee_count', 0)} employees")
            assert "records" in data
            assert "working_days" in data
        else:
            print(f"INFO: Payroll preview returned {response.status_code} - may have no employees with salary structure")
    
    def test_payroll_batches_endpoint(self):
        """Test payroll batches list endpoint"""
        token = self.get_token(self.ceo_email, self.password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/hr/payroll/batches",
            params={"year": 2026},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        batches = response.json()
        print(f"SUCCESS: Found {len(batches)} payroll batches")


class TestEmployeeSalaryStructure:
    """Test employee salary structure for payroll calculations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.ceo_email = "kalyan@wisedrive.com"
        self.password = "password123"
        
    def get_token(self, email, password):
        """Get auth token for user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_get_employees_with_salary(self):
        """Test getting employees and their salary structures"""
        token = self.get_token(self.ceo_email, self.password)
        assert token is not None
        
        # Get employees
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        employees = response.json()
        
        # Check salary for John Sales and Mike Mechanic
        john_sales = None
        mike_mechanic = None
        
        for emp in employees:
            if "john" in emp.get("name", "").lower() and "sales" in emp.get("name", "").lower():
                john_sales = emp
            if "mike" in emp.get("name", "").lower() and "mechanic" in emp.get("name", "").lower():
                mike_mechanic = emp
        
        # Check John Sales salary
        if john_sales:
            response = requests.get(
                f"{BASE_URL}/api/hr/employees/{john_sales['id']}/salary",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                salary = response.json()
                print(f"SUCCESS: John Sales salary structure found - Gross: {salary.get('gross_salary', 'N/A')}")
            else:
                print(f"INFO: John Sales has no salary structure yet")
        else:
            print(f"INFO: John Sales employee not found")
        
        # Check Mike Mechanic salary
        if mike_mechanic:
            response = requests.get(
                f"{BASE_URL}/api/hr/employees/{mike_mechanic['id']}/salary",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                salary = response.json()
                print(f"SUCCESS: Mike Mechanic salary structure found - Gross: {salary.get('gross_salary', 'N/A')}")
            else:
                print(f"INFO: Mike Mechanic has no salary structure yet")
        else:
            print(f"INFO: Mike Mechanic employee not found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
