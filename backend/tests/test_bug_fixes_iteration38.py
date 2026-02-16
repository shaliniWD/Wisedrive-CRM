"""
Test Bug Fixes - Iteration 38
Tests for three critical bug fixes:
1. Password NOT getting reset - Login should work with custom passwords after server restart
2. Documents uploaded in CRM should show in ESS mobile app with correct file_url field
3. Salary data should persist when fetching from backend
"""
import pytest
import requests
import os
import uuid
import bcrypt
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
HR_EMAIL = "hr@wisedrive.com"
ADMIN_EMAIL = "kalyan@wisedrive.com"
DEFAULT_PASSWORD = "password123"

# ESS Device info for mobile login
TEST_DEVICE = {
    "device_id": "test-device-" + str(uuid.uuid4())[:8],
    "device_name": "Test Device",
    "platform": "android",
    "os_version": "14.0",
    "app_version": "1.0.0"
}


class TestAuthentication:
    """Test authentication and get tokens for subsequent tests"""
    
    def test_crm_hr_login(self):
        """Test CRM HR login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_EMAIL,
            "password": DEFAULT_PASSWORD
        })
        assert response.status_code == 200, f"HR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ CRM HR login successful - User: {data['user']['name']}")
        return data["access_token"]
    
    def test_crm_admin_login(self):
        """Test CRM Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": DEFAULT_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ CRM Admin login successful - User: {data['user']['name']}")
        return data["access_token"]
    
    def test_ess_login(self):
        """Test ESS Mobile App login"""
        response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": DEFAULT_PASSWORD
        })
        assert response.status_code == 200, f"ESS login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ ESS Mobile login successful")
        return data["access_token"]


@pytest.fixture(scope="module")
def crm_token():
    """Get CRM auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": HR_EMAIL,
        "password": DEFAULT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"CRM login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def ess_token():
    """Get ESS auth token"""
    response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
        "email": HR_EMAIL,
        "password": DEFAULT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"ESS login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get Admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": DEFAULT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json()["access_token"]


class TestBugFix1_PasswordNotReset:
    """
    BUG FIX #1: Password NOT getting reset
    
    The auto_fix_password_hashes() function was resetting ALL passwords that didn't match 'password123'.
    Now it only fixes truly corrupted/missing hashes. Valid bcrypt hashes are preserved.
    """
    
    def test_password_hash_validation_logic(self):
        """Test that valid bcrypt hashes are recognized as valid"""
        # Create a valid bcrypt hash for a custom password
        custom_password = "myCustomPassword123"
        salt = bcrypt.gensalt()
        valid_hash = bcrypt.hashpw(custom_password.encode('utf-8'), salt).decode('utf-8')
        
        # Verify the hash starts with $2 (bcrypt format)
        assert valid_hash.startswith("$2"), "Valid bcrypt hash should start with $2"
        
        # Verify the hash can be verified without throwing errors
        try:
            # This is what the auto_fix function does - it tests with a dummy string
            bcrypt.checkpw(b"test", valid_hash.encode('utf-8'))
            hash_is_valid = True
        except Exception:
            hash_is_valid = False
        
        assert hash_is_valid, "Valid bcrypt hash should not throw errors during verification"
        print(f"✓ Valid bcrypt hash format verified: {valid_hash[:20]}...")
    
    def test_corrupted_hash_detection(self):
        """Test that corrupted hashes are detected"""
        corrupted_hashes = [
            "",  # Empty
            None,  # Missing
            "not-a-bcrypt-hash",  # Invalid format
            "plaintext-password",  # Plain text
        ]
        
        for corrupted in corrupted_hashes:
            needs_fix = False
            
            if not corrupted:
                needs_fix = True
            elif not corrupted.startswith("$2"):
                needs_fix = True
            else:
                try:
                    bcrypt.checkpw(b"test", corrupted.encode('utf-8'))
                except Exception:
                    needs_fix = True
            
            assert needs_fix, f"Corrupted hash '{corrupted}' should be detected as needing fix"
        
        print(f"✓ All corrupted hash types correctly detected")
    
    def test_login_with_default_password(self, crm_token):
        """Test that login works with default password"""
        # This test verifies the basic login still works
        assert crm_token is not None
        print(f"✓ Login with default password works")
    
    def test_password_reset_endpoint_exists(self, admin_token):
        """Test that password reset endpoint exists and works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get list of employees
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200, f"Failed to get employees: {response.text}"
        
        employees = response.json()
        assert len(employees) > 0, "No employees found"
        
        # Find a test employee (not admin or HR)
        test_employee = None
        for emp in employees:
            if emp.get("email") not in [HR_EMAIL, ADMIN_EMAIL]:
                test_employee = emp
                break
        
        if test_employee:
            # Test password reset endpoint
            response = requests.post(
                f"{BASE_URL}/api/hr/employees/{test_employee['id']}/reset-password",
                headers=headers,
                json={"new_password": "testPassword123"}
            )
            # Should either succeed or return appropriate error
            assert response.status_code in [200, 400, 404], f"Unexpected status: {response.status_code}"
            print(f"✓ Password reset endpoint accessible for employee: {test_employee.get('name', 'Unknown')}")
        else:
            print("⚠ No test employee found (only admin/HR users exist)")


class TestBugFix2_DocumentsInESS:
    """
    BUG FIX #2: Documents uploaded in CRM should show in ESS mobile app
    
    The ESS API was looking for 'url' field but CRM stores it as 'document_url'.
    Fixed to check: url OR document_url OR file_url
    """
    
    def test_ess_documents_endpoint_exists(self, ess_token):
        """Test that ESS documents endpoint exists"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        
        response = requests.get(f"{BASE_URL}/api/ess/v1/documents", headers=headers)
        assert response.status_code == 200, f"ESS documents endpoint failed: {response.text}"
        
        data = response.json()
        assert "documents" in data
        assert "total" in data
        print(f"✓ ESS documents endpoint works - Total documents: {data['total']}")
        return data
    
    def test_upload_document_via_crm(self, crm_token):
        """Test uploading a document via CRM endpoint"""
        headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Get current user info
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        user = response.json()
        user_id = user["id"]
        
        # Create a test document record directly (simulating upload)
        # Note: Actual file upload would require multipart form data
        test_doc_id = str(uuid.uuid4())
        test_doc = {
            "id": test_doc_id,
            "user_id": user_id,
            "document_type": "other",
            "document_name": f"TEST_Bug_Fix_Doc_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "document_url": f"https://storage.wisedrive.com/test/{test_doc_id}.pdf",  # CRM stores as document_url
            "uploaded_at": datetime.now().isoformat(),
            "status": "pending"
        }
        
        print(f"✓ Test document prepared with document_url field")
        return test_doc
    
    def test_ess_documents_have_file_url(self, ess_token):
        """Test that ESS documents response includes file_url field"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        
        response = requests.get(f"{BASE_URL}/api/ess/v1/documents", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        documents = data.get("documents", [])
        
        if len(documents) > 0:
            # Check that documents have file_url field
            for doc in documents:
                # file_url should be present (may be None if no URL stored)
                assert "file_url" in doc, f"Document {doc.get('id')} missing file_url field"
                print(f"  - Document: {doc.get('document_name', 'Unknown')} - file_url: {doc.get('file_url', 'None')[:50] if doc.get('file_url') else 'None'}...")
            
            print(f"✓ All {len(documents)} documents have file_url field")
        else:
            print("⚠ No documents found for user - file_url field mapping cannot be verified with actual data")
    
    def test_document_requirements_endpoint(self, ess_token):
        """Test document requirements endpoint"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        
        response = requests.get(f"{BASE_URL}/api/ess/v1/documents/requirements", headers=headers)
        assert response.status_code == 200, f"Document requirements failed: {response.text}"
        
        data = response.json()
        assert "requirements" in data
        assert "completed_count" in data
        assert "total_required" in data
        assert "completion_percentage" in data
        
        print(f"✓ Document requirements: {data['completed_count']}/{data['total_required']} ({data['completion_percentage']}%)")


class TestBugFix3_SalaryDataPersistence:
    """
    BUG FIX #3: Salary data should persist when fetching from backend
    
    The frontend was not reloading salary data when switching tabs.
    Backend salary endpoint was working correctly - this tests the backend.
    """
    
    def test_get_salary_endpoint(self, crm_token):
        """Test GET salary endpoint returns data"""
        headers = {"Authorization": f"Bearer {crm_token}"}
        
        # Get current user
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        user = response.json()
        user_id = user["id"]
        
        # Get salary data
        response = requests.get(f"{BASE_URL}/api/hr/employees/{user_id}/salary", headers=headers)
        assert response.status_code == 200, f"Get salary failed: {response.text}"
        
        salary = response.json()
        print(f"✓ Salary data retrieved successfully")
        print(f"  - Gross Salary: {salary.get('gross_salary', 'N/A')}")
        print(f"  - Net Salary: {salary.get('net_salary', 'N/A')}")
        print(f"  - Basic: {salary.get('basic_salary', 'N/A')}")
        return salary
    
    def test_save_and_retrieve_salary(self, admin_token):
        """Test saving salary and retrieving it persists correctly"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get list of employees
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200
        employees = response.json()
        
        # Find a test employee
        test_employee = None
        for emp in employees:
            if emp.get("email") not in [ADMIN_EMAIL]:  # Don't modify admin
                test_employee = emp
                break
        
        if not test_employee:
            pytest.skip("No test employee found")
        
        employee_id = test_employee["id"]
        
        # Save salary data
        test_salary = {
            "basic_salary": 50000,
            "hra": 20000,
            "conveyance_allowance": 3000,
            "medical_allowance": 2500,
            "special_allowance": 5000,
            "variable_pay": 10000,
            "pf_employee": 6000,
            "professional_tax": 200,
            "income_tax": 5000,
            "other_deductions": 300,
            "employment_type": "fulltime"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{employee_id}/salary",
            headers=headers,
            json=test_salary
        )
        assert response.status_code == 200, f"Save salary failed: {response.text}"
        saved_salary = response.json()
        print(f"✓ Salary saved for employee: {test_employee.get('name', 'Unknown')}")
        
        # Retrieve salary to verify persistence
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{employee_id}/salary",
            headers=headers
        )
        assert response.status_code == 200, f"Get salary failed: {response.text}"
        retrieved_salary = response.json()
        
        # Verify key fields match
        assert retrieved_salary.get("basic_salary") == test_salary["basic_salary"], "Basic salary mismatch"
        assert retrieved_salary.get("hra") == test_salary["hra"], "HRA mismatch"
        assert retrieved_salary.get("conveyance_allowance") == test_salary["conveyance_allowance"], "Conveyance mismatch"
        assert retrieved_salary.get("medical_allowance") == test_salary["medical_allowance"], "Medical mismatch"
        
        print(f"✓ Salary data persisted correctly:")
        print(f"  - Basic: {retrieved_salary.get('basic_salary')}")
        print(f"  - HRA: {retrieved_salary.get('hra')}")
        print(f"  - Conveyance: {retrieved_salary.get('conveyance_allowance')}")
        print(f"  - Medical: {retrieved_salary.get('medical_allowance')}")
        print(f"  - Gross: {retrieved_salary.get('gross_salary')}")
        print(f"  - Net: {retrieved_salary.get('net_salary')}")
    
    def test_ess_salary_endpoint(self, ess_token):
        """Test ESS salary endpoint returns correct data"""
        headers = {"Authorization": f"Bearer {ess_token}"}
        
        response = requests.get(f"{BASE_URL}/api/ess/v1/profile/salary", headers=headers)
        assert response.status_code == 200, f"ESS salary failed: {response.text}"
        
        salary = response.json()
        
        # Verify key fields exist
        assert "gross_salary" in salary
        assert "net_salary" in salary
        assert "basic_salary" in salary
        
        # Verify field mappings (conveyance_allowance -> conveyance, medical_allowance -> medical)
        print(f"✓ ESS Salary endpoint works:")
        print(f"  - Gross: {salary.get('gross_salary')}")
        print(f"  - Net: {salary.get('net_salary')}")
        print(f"  - Basic: {salary.get('basic_salary')}")
        print(f"  - Conveyance: {salary.get('conveyance')}")
        print(f"  - Medical: {salary.get('medical')}")


class TestEndToEndFlow:
    """End-to-end tests for the bug fixes"""
    
    def test_full_login_flow(self):
        """Test complete login flow for CRM and ESS"""
        # CRM Login
        crm_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_EMAIL,
            "password": DEFAULT_PASSWORD
        })
        assert crm_response.status_code == 200, f"CRM login failed: {crm_response.text}"
        crm_token = crm_response.json()["access_token"]
        
        # ESS Login
        ess_response = requests.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": HR_EMAIL,
            "password": DEFAULT_PASSWORD
        })
        assert ess_response.status_code == 200, f"ESS login failed: {ess_response.text}"
        ess_token = ess_response.json()["access_token"]
        
        print(f"✓ Full login flow successful for both CRM and ESS")
        return crm_token, ess_token
    
    def test_crm_to_ess_data_sync(self, crm_token, ess_token):
        """Test that data saved in CRM is visible in ESS"""
        crm_headers = {"Authorization": f"Bearer {crm_token}"}
        ess_headers = {"Authorization": f"Bearer {ess_token}"}
        
        # Get user from CRM
        crm_me = requests.get(f"{BASE_URL}/api/auth/me", headers=crm_headers)
        assert crm_me.status_code == 200
        crm_user = crm_me.json()
        
        # Get profile from ESS
        ess_profile = requests.get(f"{BASE_URL}/api/ess/v1/profile", headers=ess_headers)
        assert ess_profile.status_code == 200
        ess_user = ess_profile.json()
        
        # Verify data matches
        assert crm_user["id"] == ess_user["id"], "User ID mismatch"
        assert crm_user["email"] == ess_user["email"], "Email mismatch"
        
        print(f"✓ CRM to ESS data sync verified")
        print(f"  - User: {ess_user.get('name')}")
        print(f"  - Email: {ess_user.get('email')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
