"""
Test suite for Employee Document Upload feature
Tests the document upload, download, list, and delete functionality in HR Module
"""
import pytest
import requests
import os
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
HR_EMAIL = "hr@wisedrive.com"
HR_PASSWORD = "password123"


class TestDocumentUpload:
    """Test employee document upload functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as HR Manager
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": HR_EMAIL, "password": HR_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get an employee ID for testing
        employees_response = self.session.get(f"{BASE_URL}/api/hr/employees")
        assert employees_response.status_code == 200
        employees = employees_response.json()
        assert len(employees) > 0, "No employees found for testing"
        self.employee_id = employees[0]["id"]
        
        yield
        
        # Cleanup - delete test documents
        self._cleanup_test_documents()
    
    def _cleanup_test_documents(self):
        """Clean up test documents created during testing"""
        try:
            docs_response = self.session.get(f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents")
            if docs_response.status_code == 200:
                docs = docs_response.json()
                for doc in docs:
                    if doc.get("document_name", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents/{doc['id']}")
        except Exception:
            pass
    
    def _create_test_pdf(self):
        """Create a minimal test PDF file"""
        pdf_content = b"""%PDF-1.0
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000052 00000 n
0000000101 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
176
%%EOF"""
        return pdf_content
    
    def test_login_as_hr_manager(self):
        """Test HR Manager can login successfully"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": HR_EMAIL, "password": HR_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role_code"] == "HR_MANAGER"
    
    def test_get_employee_documents_empty(self):
        """Test getting documents for an employee"""
        response = self.session.get(f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_upload_document_success(self):
        """Test uploading a document successfully"""
        # Create test PDF
        pdf_content = self._create_test_pdf()
        
        # Prepare multipart form data
        files = {
            'file': ('TEST_document.pdf', pdf_content, 'application/pdf')
        }
        data = {
            'document_type': 'pan',
            'document_name': 'TEST_PAN Card Upload'
        }
        
        # Remove Content-Type header for multipart upload
        headers = {"Authorization": self.session.headers["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents/upload",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        doc = response.json()
        
        # Verify response structure
        assert "id" in doc
        assert doc["document_type"] == "pan"
        assert doc["document_name"] == "TEST_PAN Card Upload"
        assert "document_url" in doc
        assert doc["file_name"] == "TEST_document.pdf"
        assert doc["content_type"] == "application/pdf"
        assert "uploaded_at" in doc
        assert "uploaded_by" in doc
        
        # Store doc ID for cleanup
        self.test_doc_id = doc["id"]
    
    def test_upload_document_with_different_types(self):
        """Test uploading documents with different document types"""
        pdf_content = self._create_test_pdf()
        headers = {"Authorization": self.session.headers["Authorization"]}
        
        document_types = ["aadhar", "passport", "driving_license", "education", "experience"]
        
        for doc_type in document_types:
            files = {
                'file': (f'TEST_{doc_type}.pdf', pdf_content, 'application/pdf')
            }
            data = {
                'document_type': doc_type,
                'document_name': f'TEST_{doc_type.upper()} Document'
            }
            
            response = requests.post(
                f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents/upload",
                files=files,
                data=data,
                headers=headers
            )
            
            assert response.status_code == 200, f"Upload failed for {doc_type}: {response.text}"
            doc = response.json()
            assert doc["document_type"] == doc_type
    
    def test_upload_document_missing_fields(self):
        """Test upload fails with missing required fields"""
        pdf_content = self._create_test_pdf()
        headers = {"Authorization": self.session.headers["Authorization"]}
        
        # Missing document_type
        files = {'file': ('test.pdf', pdf_content, 'application/pdf')}
        data = {'document_name': 'Test Document'}
        
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents/upload",
            files=files,
            data=data,
            headers=headers
        )
        assert response.status_code == 422  # Validation error
    
    def test_upload_document_invalid_file_type(self):
        """Test upload fails with invalid file type"""
        headers = {"Authorization": self.session.headers["Authorization"]}
        
        # Try uploading an executable file
        files = {
            'file': ('test.exe', b'fake executable content', 'application/x-msdownload')
        }
        data = {
            'document_type': 'other',
            'document_name': 'TEST_Invalid File'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents/upload",
            files=files,
            data=data,
            headers=headers
        )
        assert response.status_code == 400  # Bad request - invalid file type
    
    def test_download_document(self):
        """Test downloading an uploaded document"""
        # First upload a document
        pdf_content = self._create_test_pdf()
        headers = {"Authorization": self.session.headers["Authorization"]}
        
        files = {'file': ('TEST_download.pdf', pdf_content, 'application/pdf')}
        data = {'document_type': 'other', 'document_name': 'TEST_Download Test'}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents/upload",
            files=files,
            data=data,
            headers=headers
        )
        assert upload_response.status_code == 200
        doc = upload_response.json()
        
        # Now download the document
        download_url = f"{BASE_URL}{doc['document_url']}"
        download_response = self.session.get(download_url)
        
        assert download_response.status_code == 200
        assert download_response.headers.get("content-type") == "application/pdf"
        assert len(download_response.content) > 0
    
    def test_list_documents_after_upload(self):
        """Test that uploaded documents appear in the list"""
        # Upload a document first
        pdf_content = self._create_test_pdf()
        headers = {"Authorization": self.session.headers["Authorization"]}
        
        files = {'file': ('TEST_list.pdf', pdf_content, 'application/pdf')}
        data = {'document_type': 'bank_statement', 'document_name': 'TEST_List Test Document'}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents/upload",
            files=files,
            data=data,
            headers=headers
        )
        assert upload_response.status_code == 200
        uploaded_doc = upload_response.json()
        
        # Get documents list
        list_response = self.session.get(f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents")
        assert list_response.status_code == 200
        docs = list_response.json()
        
        # Verify the uploaded document is in the list
        doc_ids = [d["id"] for d in docs]
        assert uploaded_doc["id"] in doc_ids
    
    def test_delete_document(self):
        """Test deleting a document"""
        # Upload a document first
        pdf_content = self._create_test_pdf()
        headers = {"Authorization": self.session.headers["Authorization"]}
        
        files = {'file': ('TEST_delete.pdf', pdf_content, 'application/pdf')}
        data = {'document_type': 'salary_slip', 'document_name': 'TEST_Delete Test'}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents/upload",
            files=files,
            data=data,
            headers=headers
        )
        assert upload_response.status_code == 200
        doc = upload_response.json()
        doc_id = doc["id"]
        
        # Delete the document
        delete_response = self.session.delete(
            f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents/{doc_id}"
        )
        assert delete_response.status_code == 200
        assert delete_response.json().get("message") == "Document deleted"
        
        # Verify document is no longer in the list
        list_response = self.session.get(f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents")
        docs = list_response.json()
        doc_ids = [d["id"] for d in docs]
        assert doc_id not in doc_ids
    
    def test_delete_nonexistent_document(self):
        """Test deleting a document that doesn't exist"""
        fake_doc_id = "nonexistent-doc-id-12345"
        
        response = self.session.delete(
            f"{BASE_URL}/api/hr/employees/{self.employee_id}/documents/{fake_doc_id}"
        )
        assert response.status_code == 404


class TestDocumentUploadRBAC:
    """Test RBAC for document upload functionality"""
    
    def test_unauthorized_access(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.get(f"{BASE_URL}/api/hr/employees/some-id/documents")
        assert response.status_code == 403 or response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
