"""
Test Document RBAC - Finance role should not see sensitive documents
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "ceo@wisedrive.com"
CEO_PASSWORD = "password123"
FINANCE_EMAIL = "finance.my@wisedrive.com"
FINANCE_PASSWORD = "password123"


class TestDocumentRBAC:
    """Test document RBAC enforcement"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Login as CEO"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def finance_token(self):
        """Login as Finance Manager"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FINANCE_EMAIL,
            "password": FINANCE_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Finance login failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def ceo_headers(self, ceo_token):
        return {"Authorization": f"Bearer {ceo_token}"}
    
    @pytest.fixture(scope="class")
    def finance_headers(self, finance_token):
        return {"Authorization": f"Bearer {finance_token}"}
    
    @pytest.fixture(scope="class")
    def test_employee_id(self, ceo_headers):
        """Get an employee ID for testing"""
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=ceo_headers)
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0
        return employees[0]["id"]
    
    def test_ceo_can_create_sensitive_document(self, ceo_headers, test_employee_id):
        """CEO can create sensitive documents (aadhaar, pan, passport)"""
        doc_data = {
            "document_type": "aadhaar",
            "document_name": "Test Aadhaar Card",
            "document_url": "https://example.com/aadhaar.pdf"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{test_employee_id}/documents",
            json=doc_data,
            headers=ceo_headers
        )
        assert response.status_code == 200, f"CEO should create sensitive docs: {response.text}"
        print("✓ CEO can create sensitive documents")
    
    def test_ceo_can_view_all_documents(self, ceo_headers, test_employee_id):
        """CEO can view all documents including sensitive"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{test_employee_id}/documents",
            headers=ceo_headers
        )
        assert response.status_code == 200, f"CEO should view all docs: {response.text}"
        
        docs = response.json()
        print(f"✓ CEO can view all {len(docs)} documents")
        
        # Check if sensitive docs are included
        sensitive_types = ["aadhaar", "pan", "passport", "bank_statement"]
        sensitive_docs = [d for d in docs if d.get("document_type") in sensitive_types]
        print(f"  - Including {len(sensitive_docs)} sensitive documents")
    
    def test_finance_cannot_view_sensitive_documents(self, finance_headers, test_employee_id):
        """Finance Manager should NOT see sensitive documents"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{test_employee_id}/documents",
            headers=finance_headers
        )
        
        if response.status_code == 403:
            print("✓ Finance cannot access documents at all (403)")
            return
        
        assert response.status_code == 200, f"Unexpected status: {response.text}"
        
        docs = response.json()
        
        # Check that no sensitive docs are returned
        sensitive_types = ["aadhaar", "pan", "passport", "bank_statement"]
        sensitive_docs = [d for d in docs if d.get("document_type") in sensitive_types]
        
        assert len(sensitive_docs) == 0, f"Finance should NOT see sensitive docs, but found: {[d['document_type'] for d in sensitive_docs]}"
        print(f"✓ Finance can only view {len(docs)} non-sensitive documents")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
