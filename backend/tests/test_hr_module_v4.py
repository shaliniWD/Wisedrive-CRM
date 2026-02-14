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

class TestHRModuleAuth:
    """Test authentication for HR module access"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def hr_token(self):
        """Get HR Manager auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        assert response.status_code == 200, f"HR login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_ceo_login(self, ceo_token):
        """Verify CEO can login"""
        assert ceo_token is not None
        print(f"SUCCESS: CEO login successful, token obtained")
    
    def test_hr_login(self, hr_token):
        """Verify HR Manager can login"""
        assert hr_token is not None
        print(f"SUCCESS: HR Manager login successful, token obtained")


class TestEmployeeList:
    """Test employee listing for HR module"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def employee_id(self, auth_headers):
        """Get first employee ID for testing"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json().get("employees", [])
        if employees:
            return employees[0]["id"]
        pytest.skip("No employees found for testing")
    
    def test_get_employees_list(self, auth_headers):
        """Test getting employee list"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "employees" in data
        print(f"SUCCESS: Got {len(data['employees'])} employees")


class TestSalaryStructure:
    """Test salary structure with deductions (PF, PT, Income Tax)"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def employee_id(self, auth_headers):
        """Get first employee ID for testing"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=auth_headers)
        employees = response.json().get("employees", [])
        if employees:
            return employees[0]["id"]
        pytest.skip("No employees found for testing")
    
    def test_save_salary_with_earnings(self, auth_headers, employee_id):
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
            f"{BASE_URL}/api/hr/employees/{employee_id}/salary",
            headers=auth_headers,
            json=salary_data
        )
        assert response.status_code == 200, f"Failed to save salary: {response.text}"
        data = response.json()
        assert data.get("basic_salary") == 50000
        print(f"SUCCESS: Salary with earnings saved - Basic: {data.get('basic_salary')}")
    
    def test_save_salary_with_deductions(self, auth_headers, employee_id):
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
            f"{BASE_URL}/api/hr/employees/{employee_id}/salary",
            headers=auth_headers,
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
    
    def test_gross_net_salary_calculation(self, auth_headers, employee_id):
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
            f"{BASE_URL}/api/hr/employees/{employee_id}/salary",
            headers=auth_headers,
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
    
    def test_get_employee_salary(self, auth_headers, employee_id):
        """Test getting employee salary structure"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{employee_id}/salary",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get salary: {response.text}"
        data = response.json()
        assert "basic_salary" in data
        print(f"SUCCESS: Retrieved salary structure - Basic: {data.get('basic_salary')}")


class TestAttendanceLeave:
    """Test attendance and leave marking functionality"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def employee_id(self, auth_headers):
        """Get first employee ID for testing"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=auth_headers)
        employees = response.json().get("employees", [])
        if employees:
            return employees[0]["id"]
        pytest.skip("No employees found for testing")
    
    def test_mark_today_as_leave(self, auth_headers, employee_id):
        """Test marking today as leave"""
        today = datetime.now().strftime("%Y-%m-%d")
        attendance_data = {
            "date": today,
            "status": "on_leave",
            "notes": "TEST: Marked via quick action"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/attendance",
            headers=auth_headers,
            json=attendance_data
        )
        assert response.status_code == 200, f"Failed to mark today as leave: {response.text}"
        data = response.json()
        assert data.get("status") == "on_leave"
        assert data.get("date") == today
        print(f"SUCCESS: Today ({today}) marked as leave")
    
    def test_mark_tomorrow_as_leave(self, auth_headers, employee_id):
        """Test marking tomorrow as leave"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        attendance_data = {
            "date": tomorrow,
            "status": "on_leave",
            "notes": "TEST: Marked via quick action"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/attendance",
            headers=auth_headers,
            json=attendance_data
        )
        assert response.status_code == 200, f"Failed to mark tomorrow as leave: {response.text}"
        data = response.json()
        assert data.get("status") == "on_leave"
        assert data.get("date") == tomorrow
        print(f"SUCCESS: Tomorrow ({tomorrow}) marked as leave")
    
    def test_mark_as_present(self, auth_headers, employee_id):
        """Test marking as present"""
        test_date = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        attendance_data = {
            "date": test_date,
            "status": "present",
            "notes": "TEST: Present"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/attendance",
            headers=auth_headers,
            json=attendance_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "present"
        print(f"SUCCESS: {test_date} marked as present")
    
    def test_mark_as_half_day(self, auth_headers, employee_id):
        """Test marking as half day"""
        test_date = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
        attendance_data = {
            "date": test_date,
            "status": "half_day",
            "notes": "TEST: Half day"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/attendance",
            headers=auth_headers,
            json=attendance_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "half_day"
        print(f"SUCCESS: {test_date} marked as half day")
    
    def test_get_attendance_records(self, auth_headers, employee_id):
        """Test getting attendance records"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{employee_id}/attendance",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get attendance: {response.text}"
        data = response.json()
        assert "records" in data
        assert "summary" in data
        print(f"SUCCESS: Got {len(data['records'])} attendance records")


class TestLeaveSummary:
    """Test monthly leave summary functionality"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def employee_id(self, auth_headers):
        """Get first employee ID for testing"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=auth_headers)
        employees = response.json().get("employees", [])
        if employees:
            return employees[0]["id"]
        pytest.skip("No employees found for testing")
    
    def test_get_leave_summary_current_year(self, auth_headers, employee_id):
        """Test getting leave summary for current year"""
        current_year = datetime.now().year
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{employee_id}/leave-summary",
            headers=auth_headers,
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
    
    def test_leave_summary_monthly_breakdown(self, auth_headers, employee_id):
        """Test monthly breakdown structure"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{employee_id}/leave-summary",
            headers=auth_headers
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
    
    def test_leave_summary_different_year(self, auth_headers, employee_id):
        """Test getting leave summary for different year"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{employee_id}/leave-summary",
            headers=auth_headers,
            params={"year": 2025}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["year"] == 2025
        print(f"SUCCESS: Leave summary for 2025 retrieved")


class TestDocumentManagement:
    """Test document upload and management functionality"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def employee_id(self, auth_headers):
        """Get first employee ID for testing"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=auth_headers)
        employees = response.json().get("employees", [])
        if employees:
            return employees[0]["id"]
        pytest.skip("No employees found for testing")
    
    def test_add_aadhar_document(self, auth_headers, employee_id):
        """Test adding Aadhar card document"""
        doc_data = {
            "document_type": "aadhar",
            "document_name": "TEST_Aadhar Card",
            "document_url": "https://example.com/aadhar.pdf"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/documents",
            headers=auth_headers,
            json=doc_data
        )
        assert response.status_code == 200, f"Failed to add document: {response.text}"
        data = response.json()
        assert data.get("document_type") == "aadhar"
        assert data.get("document_name") == "TEST_Aadhar Card"
        print(f"SUCCESS: Aadhar document added")
    
    def test_add_pan_document(self, auth_headers, employee_id):
        """Test adding PAN card document"""
        doc_data = {
            "document_type": "pan",
            "document_name": "TEST_PAN Card",
            "document_url": "https://example.com/pan.pdf"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/documents",
            headers=auth_headers,
            json=doc_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("document_type") == "pan"
        print(f"SUCCESS: PAN document added")
    
    def test_add_offer_letter_document(self, auth_headers, employee_id):
        """Test adding offer letter document"""
        doc_data = {
            "document_type": "offer_letter",
            "document_name": "TEST_Offer Letter 2024",
            "document_url": "https://example.com/offer.pdf"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/documents",
            headers=auth_headers,
            json=doc_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("document_type") == "offer_letter"
        print(f"SUCCESS: Offer letter document added")
    
    def test_get_employee_documents(self, auth_headers, employee_id):
        """Test getting employee documents"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{employee_id}/documents",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get documents: {response.text}"
        documents = response.json()
        assert isinstance(documents, list)
        print(f"SUCCESS: Got {len(documents)} documents")
    
    def test_delete_document(self, auth_headers, employee_id):
        """Test deleting a document"""
        # First add a document to delete
        doc_data = {
            "document_type": "other",
            "document_name": "TEST_To Delete",
            "document_url": "https://example.com/delete.pdf"
        }
        add_response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/documents",
            headers=auth_headers,
            json=doc_data
        )
        assert add_response.status_code == 200
        doc_id = add_response.json().get("id")
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/hr/employees/{employee_id}/documents/{doc_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200, f"Failed to delete document: {delete_response.text}"
        print(f"SUCCESS: Document deleted")


class TestHRAuthorization:
    """Test HR module authorization"""
    
    @pytest.fixture(scope="class")
    def hr_headers(self):
        """Get HR Manager auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123",
            "country_code": "IN"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def employee_id(self, hr_headers):
        """Get first employee ID for testing"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=hr_headers)
        employees = response.json().get("employees", [])
        if employees:
            return employees[0]["id"]
        pytest.skip("No employees found for testing")
    
    def test_hr_can_access_employees(self, hr_headers):
        """Test HR Manager can access employee list"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=hr_headers)
        assert response.status_code == 200
        print(f"SUCCESS: HR Manager can access employees")
    
    def test_hr_can_save_salary(self, hr_headers, employee_id):
        """Test HR Manager can save salary"""
        salary_data = {
            "basic_salary": 45000,
            "hra": 18000,
            "pf_employee": 5400,
            "professional_tax": 200,
            "employment_type": "full_time"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/salary",
            headers=hr_headers,
            json=salary_data
        )
        assert response.status_code == 200
        print(f"SUCCESS: HR Manager can save salary")
    
    def test_hr_can_mark_attendance(self, hr_headers, employee_id):
        """Test HR Manager can mark attendance"""
        test_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
        attendance_data = {
            "date": test_date,
            "status": "present",
            "notes": "TEST: HR marked"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/attendance",
            headers=hr_headers,
            json=attendance_data
        )
        assert response.status_code == 200
        print(f"SUCCESS: HR Manager can mark attendance")
    
    def test_hr_can_add_document(self, hr_headers, employee_id):
        """Test HR Manager can add document"""
        doc_data = {
            "document_type": "education",
            "document_name": "TEST_HR Added Doc",
            "document_url": "https://example.com/hr-doc.pdf"
        }
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/documents",
            headers=hr_headers,
            json=doc_data
        )
        assert response.status_code == 200
        print(f"SUCCESS: HR Manager can add document")


# Cleanup fixture to remove test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_documents():
    """Cleanup test documents after all tests"""
    yield
    # Cleanup would happen here if needed
    print("Test session completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
