"""
HR Module V4 Tests - Testing restored HR features:
1. Salary structure with deductions (PF, PT, Income Tax)
2. Attendance/Leave marking (today/tomorrow)
3. Monthly leave summary
4. Document upload and management
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def get_auth_token(email, password):
    """Helper to get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password,
        "country_code": "IN"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


def get_auth_headers(email="ceo@wisedrive.com", password="password123"):
    """Helper to get auth headers"""
    token = get_auth_token(email, password)
    return {"Authorization": f"Bearer {token}"} if token else {}


def get_first_employee_id(headers):
    """Helper to get first employee ID"""
    response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
    if response.status_code == 200:
        employees = response.json()
        if isinstance(employees, list) and len(employees) > 0:
            return employees[0]["id"]
    return None


class TestHRModuleAuth:
    """Test authentication for HR module access"""
    
    def test_ceo_login(self):
        """Verify CEO can login"""
        token = get_auth_token("ceo@wisedrive.com", "password123")
        assert token is not None
        print(f"SUCCESS: CEO login successful, token obtained")
    
    def test_hr_login(self):
        """Verify HR Manager can login"""
        token = get_auth_token("hr@wisedrive.com", "password123")
        assert token is not None
        print(f"SUCCESS: HR Manager login successful, token obtained")


class TestEmployeeList:
    """Test employee listing for HR module"""
    
    def test_get_employees_list(self):
        """Test getting employee list"""
        headers = get_auth_headers()
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} employees")


class TestSalaryStructure:
    """Test salary structure with deductions (PF, PT, Income Tax)"""
    
    @pytest.fixture(scope="class")
    def setup(self):
        """Setup for salary tests"""
        headers = get_auth_headers()
        employee_id = get_first_employee_id(headers)
        if not employee_id:
            pytest.skip("No employees found for testing")
        return {"headers": headers, "employee_id": employee_id}
    
    def test_save_salary_with_earnings(self, setup):
        """Test saving salary with earnings components"""
        salary_data = {
            "basic_salary": 50000,
            "hra": 20000,
            "variable_pay": 5000,
            "conveyance_allowance": 2000,
            "medical_allowance": 1500,
            "special_allowance": 3000,
            "employment_type": "full_time"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/salary",
            headers=setup['headers'],
            json=salary_data
        )
        assert response.status_code == 200, f"Failed to save salary: {response.text}"
        data = response.json()
        assert data.get("basic_salary") == 50000
        print(f"SUCCESS: Salary with earnings saved - Basic: {data.get('basic_salary')}")
    
    def test_save_salary_with_deductions(self, setup):
        """Test saving salary with deductions (PF, PT, Income Tax)"""
        salary_data = {
            "basic_salary": 50000,
            "hra": 20000,
            "variable_pay": 5000,
            "conveyance_allowance": 2000,
            "medical_allowance": 1500,
            "special_allowance": 3000,
            "pf_employee": 6000,
            "professional_tax": 200,
            "income_tax": 5000,
            "other_deductions": 500,
            "employment_type": "full_time"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/salary",
            headers=setup['headers'],
            json=salary_data
        )
        assert response.status_code == 200, f"Failed to save salary with deductions: {response.text}"
        data = response.json()
        
        # Verify deductions are saved
        assert data.get("pf_employee") == 6000, "PF Employee not saved correctly"
        assert data.get("professional_tax") == 200, "Professional Tax not saved correctly"
        assert data.get("income_tax") == 5000, "Income Tax not saved correctly"
        assert data.get("other_deductions") == 500, "Other Deductions not saved correctly"
        
        print(f"SUCCESS: Salary with deductions saved - PF: {data.get('pf_employee')}, PT: {data.get('professional_tax')}, IT: {data.get('income_tax')}")
    
    def test_gross_net_salary_calculation(self, setup):
        """Test gross and net salary calculation"""
        salary_data = {
            "basic_salary": 50000,
            "hra": 20000,
            "variable_pay": 5000,
            "conveyance_allowance": 2000,
            "medical_allowance": 1500,
            "special_allowance": 3000,
            "pf_employee": 6000,
            "professional_tax": 200,
            "income_tax": 5000,
            "other_deductions": 500,
            "employment_type": "full_time"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/salary",
            headers=setup['headers'],
            json=salary_data
        )
        assert response.status_code == 200
        data = response.json()
        
        # Calculate expected values
        expected_gross = 50000 + 20000 + 5000 + 2000 + 1500 + 3000  # 81500
        expected_deductions = 6000 + 200 + 5000 + 500  # 11700
        expected_net = expected_gross - expected_deductions  # 69800
        
        assert data.get("gross_salary") == expected_gross, f"Gross salary mismatch: expected {expected_gross}, got {data.get('gross_salary')}"
        assert data.get("net_salary") == expected_net, f"Net salary mismatch: expected {expected_net}, got {data.get('net_salary')}"
        
        print(f"SUCCESS: Gross: {data.get('gross_salary')}, Net: {data.get('net_salary')}")
    
    def test_get_employee_salary(self, setup):
        """Test getting employee salary structure"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/salary",
            headers=setup['headers']
        )
        assert response.status_code == 200, f"Failed to get salary: {response.text}"
        data = response.json()
        assert "basic_salary" in data
        print(f"SUCCESS: Retrieved salary structure - Basic: {data.get('basic_salary')}")


class TestAttendanceLeave:
    """Test attendance and leave marking functionality"""
    
    @pytest.fixture(scope="class")
    def setup(self):
        """Setup for attendance tests"""
        headers = get_auth_headers()
        employee_id = get_first_employee_id(headers)
        if not employee_id:
            pytest.skip("No employees found for testing")
        return {"headers": headers, "employee_id": employee_id}
    
    def test_mark_today_as_leave(self, setup):
        """Test marking today as leave"""
        today = datetime.now().strftime("%Y-%m-%d")
        attendance_data = {
            "date": today,
            "status": "on_leave",
            "notes": "TEST: Marked via quick action"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/attendance",
            headers=setup['headers'],
            json=attendance_data
        )
        assert response.status_code == 200, f"Failed to mark today as leave: {response.text}"
        data = response.json()
        assert data.get("status") == "on_leave"
        assert data.get("date") == today
        print(f"SUCCESS: Today ({today}) marked as leave")
    
    def test_mark_tomorrow_as_leave(self, setup):
        """Test marking tomorrow as leave"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        attendance_data = {
            "date": tomorrow,
            "status": "on_leave",
            "notes": "TEST: Marked via quick action"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/attendance",
            headers=setup['headers'],
            json=attendance_data
        )
        assert response.status_code == 200, f"Failed to mark tomorrow as leave: {response.text}"
        data = response.json()
        assert data.get("status") == "on_leave"
        assert data.get("date") == tomorrow
        print(f"SUCCESS: Tomorrow ({tomorrow}) marked as leave")
    
    def test_mark_as_present(self, setup):
        """Test marking as present"""
        test_date = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        attendance_data = {
            "date": test_date,
            "status": "present",
            "notes": "TEST: Present"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/attendance",
            headers=setup['headers'],
            json=attendance_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "present"
        print(f"SUCCESS: {test_date} marked as present")
    
    def test_mark_as_half_day(self, setup):
        """Test marking as half day"""
        test_date = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
        attendance_data = {
            "date": test_date,
            "status": "half_day",
            "notes": "TEST: Half day"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/attendance",
            headers=setup['headers'],
            json=attendance_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "half_day"
        print(f"SUCCESS: {test_date} marked as half day")
    
    def test_get_attendance_records(self, setup):
        """Test getting attendance records"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/attendance",
            headers=setup['headers']
        )
        assert response.status_code == 200, f"Failed to get attendance: {response.text}"
        data = response.json()
        assert "records" in data
        assert "summary" in data
        print(f"SUCCESS: Got {len(data['records'])} attendance records")


class TestLeaveSummary:
    """Test monthly leave summary functionality"""
    
    @pytest.fixture(scope="class")
    def setup(self):
        """Setup for leave summary tests"""
        headers = get_auth_headers()
        employee_id = get_first_employee_id(headers)
        if not employee_id:
            pytest.skip("No employees found for testing")
        return {"headers": headers, "employee_id": employee_id}
    
    def test_get_leave_summary_current_year(self, setup):
        """Test getting leave summary for current year"""
        current_year = datetime.now().year
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/leave-summary",
            headers=setup['headers'],
            params={"year": current_year}
        )
        assert response.status_code == 200, f"Failed to get leave summary: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "year" in data
        assert "monthly_summary" in data
        assert "total_leaves_taken" in data
        assert "total_present" in data
        assert data["year"] == current_year
        
        # Verify monthly breakdown has 12 months
        assert len(data["monthly_summary"]) == 12
        
        print(f"SUCCESS: Leave summary for {current_year} - Total leaves: {data['total_leaves_taken']}, Total present: {data['total_present']}")
    
    def test_leave_summary_monthly_breakdown(self, setup):
        """Test monthly breakdown structure"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/leave-summary",
            headers=setup['headers']
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check each month has required fields
        for month_data in data["monthly_summary"]:
            assert "month" in month_data
            assert "present" in month_data
            assert "absent" in month_data
            assert "half_day" in month_data
            assert "on_leave" in month_data
            assert "working_days" in month_data
        
        print(f"SUCCESS: Monthly breakdown structure verified for all 12 months")
    
    def test_leave_summary_different_year(self, setup):
        """Test getting leave summary for different year"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/leave-summary",
            headers=setup['headers'],
            params={"year": 2025}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["year"] == 2025
        print(f"SUCCESS: Leave summary for 2025 retrieved")


class TestDocumentManagement:
    """Test document upload and management functionality"""
    
    @pytest.fixture(scope="class")
    def setup(self):
        """Setup for document tests"""
        headers = get_auth_headers()
        employee_id = get_first_employee_id(headers)
        if not employee_id:
            pytest.skip("No employees found for testing")
        return {"headers": headers, "employee_id": employee_id}
    
    def test_add_aadhar_document(self, setup):
        """Test adding Aadhar card document"""
        doc_data = {
            "document_type": "aadhar",
            "document_name": "TEST_Aadhar Card",
            "document_url": "https://example.com/aadhar.pdf"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/documents",
            headers=setup['headers'],
            json=doc_data
        )
        assert response.status_code == 200, f"Failed to add document: {response.text}"
        data = response.json()
        assert data.get("document_type") == "aadhar"
        assert data.get("document_name") == "TEST_Aadhar Card"
        print(f"SUCCESS: Aadhar document added")
    
    def test_add_pan_document(self, setup):
        """Test adding PAN card document"""
        doc_data = {
            "document_type": "pan",
            "document_name": "TEST_PAN Card",
            "document_url": "https://example.com/pan.pdf"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/documents",
            headers=setup['headers'],
            json=doc_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("document_type") == "pan"
        print(f"SUCCESS: PAN document added")
    
    def test_add_offer_letter_document(self, setup):
        """Test adding offer letter document"""
        doc_data = {
            "document_type": "offer_letter",
            "document_name": "TEST_Offer Letter 2024",
            "document_url": "https://example.com/offer.pdf"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/documents",
            headers=setup['headers'],
            json=doc_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("document_type") == "offer_letter"
        print(f"SUCCESS: Offer letter document added")
    
    def test_get_employee_documents(self, setup):
        """Test getting employee documents"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/documents",
            headers=setup['headers']
        )
        assert response.status_code == 200, f"Failed to get documents: {response.text}"
        documents = response.json()
        assert isinstance(documents, list)
        print(f"SUCCESS: Got {len(documents)} documents")
    
    def test_delete_document(self, setup):
        """Test deleting a document"""
        # First add a document to delete
        doc_data = {
            "document_type": "other",
            "document_name": "TEST_To Delete",
            "document_url": "https://example.com/delete.pdf"
        }
        add_response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/documents",
            headers=setup['headers'],
            json=doc_data
        )
        assert add_response.status_code == 200
        doc_id = add_response.json().get("id")
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/documents/{doc_id}",
            headers=setup['headers']
        )
        assert delete_response.status_code == 200, f"Failed to delete document: {delete_response.text}"
        print(f"SUCCESS: Document deleted")


class TestHRAuthorization:
    """Test HR module authorization"""
    
    @pytest.fixture(scope="class")
    def setup(self):
        """Setup for HR authorization tests"""
        headers = get_auth_headers("hr@wisedrive.com", "password123")
        employee_id = get_first_employee_id(headers)
        if not employee_id:
            pytest.skip("No employees found for testing")
        return {"headers": headers, "employee_id": employee_id}
    
    def test_hr_can_access_employees(self):
        """Test HR Manager can access employee list"""
        headers = get_auth_headers("hr@wisedrive.com", "password123")
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200
        print(f"SUCCESS: HR Manager can access employees")
    
    def test_hr_can_save_salary(self, setup):
        """Test HR Manager can save salary"""
        salary_data = {
            "basic_salary": 45000,
            "hra": 18000,
            "pf_employee": 5400,
            "professional_tax": 200,
            "employment_type": "full_time"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/salary",
            headers=setup['headers'],
            json=salary_data
        )
        assert response.status_code == 200
        print(f"SUCCESS: HR Manager can save salary")
    
    def test_hr_can_mark_attendance(self, setup):
        """Test HR Manager can mark attendance"""
        test_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
        attendance_data = {
            "date": test_date,
            "status": "present",
            "notes": "TEST: HR marked"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/attendance",
            headers=setup['headers'],
            json=attendance_data
        )
        assert response.status_code == 200
        print(f"SUCCESS: HR Manager can mark attendance")
    
    def test_hr_can_add_document(self, setup):
        """Test HR Manager can add document"""
        doc_data = {
            "document_type": "education",
            "document_name": "TEST_HR Added Doc",
            "document_url": "https://example.com/hr-doc.pdf"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{setup['employee_id']}/documents",
            headers=setup['headers'],
            json=doc_data
        )
        assert response.status_code == 200
        print(f"SUCCESS: HR Manager can add document")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
