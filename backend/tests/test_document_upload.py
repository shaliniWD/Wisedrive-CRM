"""
Test Document Upload and Download Feature for Loans Module
Tests the following endpoints:
- GET /api/loan-leads/{lead_id}/document-requirements
- POST /api/loan-leads/{lead_id}/documents/generate-upload-url
- POST /api/loan-leads/{lead_id}/documents
- POST /api/loan-leads/{lead_id}/documents/{document_id}/download-url
- DELETE /api/loan-leads/{lead_id}/documents/{document_id}
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "kalyan@wisedrive.com"
TEST_PASSWORD = "password123"

# Test lead ID (Rajesh Sharma - SELF_EMPLOYED)
TEST_LEAD_ID = "c6691f1f-ecbc-446a-ab92-be5386eff6f7"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


@pytest.fixture(scope="module")
def form_client(auth_token):
    """Create authenticated session for form data"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestDocumentRequirements:
    """Test document requirements endpoint"""
    
    def test_get_document_requirements_for_self_employed(self, api_client):
        """Test getting document requirements for SELF_EMPLOYED customer"""
        response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/document-requirements")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "customer_type" in data
        assert "requirements" in data
        assert "uploaded_documents" in data
        
        # Rajesh Sharma is SELF_EMPLOYED
        if data["customer_type"] == "SELF_EMPLOYED":
            requirements = data["requirements"]
            assert isinstance(requirements, list)
            assert len(requirements) > 0
            
            # Check for expected SELF_EMPLOYED documents
            doc_types = [r["document_type"] for r in requirements]
            assert "itr_1" in doc_types, "ITR Year 1 should be required for self-employed"
            assert "itr_2" in doc_types, "ITR Year 2 should be required for self-employed"
            assert "business_registration" in doc_types, "Business registration should be required"
            assert "bank_statement" in doc_types, "Bank statement should be required"
            
            print(f"✓ SELF_EMPLOYED requirements: {len(requirements)} documents")
            for req in requirements:
                print(f"  - {req['display_name']} ({'required' if req['required'] else 'optional'})")
    
    def test_document_requirements_structure(self, api_client):
        """Test that document requirements have correct structure"""
        response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/document-requirements")
        
        assert response.status_code == 200
        data = response.json()
        
        requirements = data.get("requirements", [])
        if isinstance(requirements, list) and len(requirements) > 0:
            req = requirements[0]
            assert "document_type" in req, "Missing document_type field"
            assert "display_name" in req, "Missing display_name field"
            assert "required" in req, "Missing required field"
            print(f"✓ Document requirement structure is correct")
    
    def test_document_requirements_invalid_lead(self, api_client):
        """Test 404 for invalid lead ID"""
        response = api_client.get(f"{BASE_URL}/api/loan-leads/invalid-lead-id/document-requirements")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for invalid lead ID")


class TestGenerateUploadUrl:
    """Test generate upload URL endpoint"""
    
    def test_generate_upload_url_success(self, form_client):
        """Test generating signed upload URL"""
        response = form_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents/generate-upload-url",
            data={
                "document_type": "test_document",
                "filename": "test_file.pdf",
                "content_type": "application/pdf"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "signed_url" in data, "Missing signed_url in response"
        assert "firebase_path" in data, "Missing firebase_path in response"
        assert "expires_at" in data, "Missing expires_at in response"
        
        # Verify signed URL format
        assert data["signed_url"].startswith("https://"), "Signed URL should be HTTPS"
        assert "storage.googleapis.com" in data["signed_url"], "Should be Google Cloud Storage URL"
        
        # Verify firebase path format
        assert data["firebase_path"].startswith("gs://"), "Firebase path should start with gs://"
        assert TEST_LEAD_ID in data["firebase_path"], "Firebase path should contain lead ID"
        
        print(f"✓ Generated upload URL successfully")
        print(f"  Firebase path: {data['firebase_path']}")
    
    def test_generate_upload_url_invalid_lead(self, form_client):
        """Test 404 for invalid lead ID"""
        response = form_client.post(
            f"{BASE_URL}/api/loan-leads/invalid-lead-id/documents/generate-upload-url",
            data={
                "document_type": "test_document",
                "filename": "test_file.pdf",
                "content_type": "application/pdf"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for invalid lead ID")
    
    def test_generate_upload_url_different_content_types(self, form_client):
        """Test generating URLs for different content types"""
        content_types = [
            ("application/pdf", "test.pdf"),
            ("image/jpeg", "test.jpg"),
            ("image/png", "test.png")
        ]
        
        for content_type, filename in content_types:
            response = form_client.post(
                f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents/generate-upload-url",
                data={
                    "document_type": "test_document",
                    "filename": filename,
                    "content_type": content_type
                }
            )
            
            assert response.status_code == 200, f"Failed for {content_type}: {response.text}"
            print(f"✓ Generated URL for {content_type}")


class TestUploadDocument:
    """Test document upload (save record) endpoint"""
    
    def test_upload_document_record(self, form_client):
        """Test saving document record to database"""
        # Generate a unique document type to avoid conflicts
        unique_doc_type = f"test_doc_{uuid.uuid4().hex[:8]}"
        
        response = form_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents",
            data={
                "document_type": unique_doc_type,
                "file_url": "gs://wisedrive-ess-app.firebasestorage.app/loan_documents/test/test.pdf",
                "file_name": "test_document.pdf"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "document" in data, "Missing document in response"
        assert "message" in data, "Missing message in response"
        
        doc = data["document"]
        assert "id" in doc, "Document should have an ID"
        assert doc["document_type"] == unique_doc_type
        assert doc["file_name"] == "test_document.pdf"
        assert "uploaded_at" in doc
        
        print(f"✓ Document record saved successfully")
        print(f"  Document ID: {doc['id']}")
        
        # Return document ID for cleanup
        return doc["id"]
    
    def test_upload_document_invalid_lead(self, form_client):
        """Test 404 for invalid lead ID"""
        response = form_client.post(
            f"{BASE_URL}/api/loan-leads/invalid-lead-id/documents",
            data={
                "document_type": "test_doc",
                "file_url": "gs://test/test.pdf",
                "file_name": "test.pdf"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for invalid lead ID")


class TestDownloadUrl:
    """Test document download URL endpoint"""
    
    def test_download_url_for_existing_document(self, api_client, form_client):
        """Test getting download URL for an existing document"""
        # First, get the lead to find existing documents
        response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}")
        
        assert response.status_code == 200
        lead = response.json()
        documents = lead.get("documents", [])
        
        if len(documents) == 0:
            # Create a test document first
            upload_response = form_client.post(
                f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents",
                data={
                    "document_type": "test_download",
                    "file_url": "gs://wisedrive-ess-app.firebasestorage.app/loan_documents/test/download_test.pdf",
                    "file_name": "download_test.pdf"
                }
            )
            assert upload_response.status_code == 200
            doc_id = upload_response.json()["document"]["id"]
        else:
            doc_id = documents[0]["id"]
        
        # Now test download URL
        response = api_client.post(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents/{doc_id}/download-url")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "download_url" in data, "Missing download_url in response"
        
        print(f"✓ Download URL generated successfully")
        if data.get("expires_at"):
            print(f"  Expires at: {data['expires_at']}")
    
    def test_download_url_invalid_document(self, api_client):
        """Test 404 for invalid document ID"""
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents/invalid-doc-id/download-url"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for invalid document ID")
    
    def test_download_url_invalid_lead(self, api_client):
        """Test 404 for invalid lead ID"""
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/invalid-lead-id/documents/some-doc-id/download-url"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for invalid lead ID")


class TestDeleteDocument:
    """Test document deletion endpoint"""
    
    def test_delete_document(self, form_client, api_client):
        """Test deleting a document"""
        # First create a document to delete
        unique_doc_type = f"delete_test_{uuid.uuid4().hex[:8]}"
        
        upload_response = form_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents",
            data={
                "document_type": unique_doc_type,
                "file_url": "gs://wisedrive-ess-app.firebasestorage.app/loan_documents/test/delete_test.pdf",
                "file_name": "delete_test.pdf"
            }
        )
        
        assert upload_response.status_code == 200
        doc_id = upload_response.json()["document"]["id"]
        print(f"  Created test document: {doc_id}")
        
        # Now delete it
        delete_response = api_client.delete(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents/{doc_id}"
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        data = delete_response.json()
        assert "message" in data
        assert "deleted" in data["message"].lower()
        
        print(f"✓ Document deleted successfully")
        
        # Verify document is gone
        lead_response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}")
        lead = lead_response.json()
        doc_ids = [d["id"] for d in lead.get("documents", [])]
        assert doc_id not in doc_ids, "Document should be removed from lead"
        print("✓ Verified document is removed from lead")
    
    def test_delete_document_invalid_document(self, api_client):
        """Test 404 for invalid document ID"""
        response = api_client.delete(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents/invalid-doc-id"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for invalid document ID")


class TestDocumentWorkflow:
    """Test complete document upload workflow"""
    
    def test_complete_upload_workflow(self, form_client, api_client):
        """Test the complete 3-step upload workflow"""
        print("\n=== Testing Complete Document Upload Workflow ===")
        
        # Step 1: Generate signed upload URL
        print("\nStep 1: Generate signed upload URL")
        url_response = form_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents/generate-upload-url",
            data={
                "document_type": "itr_1",
                "filename": "ITR_2024_Test.pdf",
                "content_type": "application/pdf"
            }
        )
        
        assert url_response.status_code == 200, f"Step 1 failed: {url_response.text}"
        url_data = url_response.json()
        print(f"  ✓ Signed URL generated")
        print(f"  Firebase path: {url_data['firebase_path']}")
        
        # Step 2: Would upload to Firebase (skipped in test - requires actual file)
        print("\nStep 2: Upload to Firebase (simulated)")
        print("  ✓ File would be uploaded to Firebase Storage using signed URL")
        
        # Step 3: Save document record
        print("\nStep 3: Save document record to database")
        save_response = form_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents",
            data={
                "document_type": "itr_1",
                "file_url": url_data["firebase_path"],
                "file_name": "ITR_2024_Test.pdf"
            }
        )
        
        assert save_response.status_code == 200, f"Step 3 failed: {save_response.text}"
        doc = save_response.json()["document"]
        print(f"  ✓ Document record saved")
        print(f"  Document ID: {doc['id']}")
        
        # Verify document appears in lead
        print("\nVerification: Check document in lead")
        lead_response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}")
        lead = lead_response.json()
        
        doc_found = any(d["id"] == doc["id"] for d in lead.get("documents", []))
        assert doc_found, "Document should appear in lead's documents"
        print(f"  ✓ Document found in lead's documents list")
        
        # Test download URL
        print("\nBonus: Test download URL generation")
        download_response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/documents/{doc['id']}/download-url"
        )
        
        assert download_response.status_code == 200, f"Download URL failed: {download_response.text}"
        print(f"  ✓ Download URL generated successfully")
        
        print("\n=== Complete Workflow Test PASSED ===")


class TestSalariedDocuments:
    """Test document requirements for SALARIED customers"""
    
    def test_salaried_document_requirements(self, api_client):
        """Test that SALARIED customers get correct document requirements"""
        # First, find a salaried customer or update test lead
        response = api_client.get(f"{BASE_URL}/api/loan-leads?limit=50")
        
        assert response.status_code == 200
        leads = response.json().get("items", [])
        
        # Find a SALARIED lead
        salaried_lead = next((l for l in leads if l.get("customer_type") == "SALARIED"), None)
        
        if salaried_lead:
            req_response = api_client.get(
                f"{BASE_URL}/api/loan-leads/{salaried_lead['id']}/document-requirements"
            )
            
            assert req_response.status_code == 200
            data = req_response.json()
            
            if data["customer_type"] == "SALARIED":
                requirements = data["requirements"]
                doc_types = [r["document_type"] for r in requirements]
                
                # Check for SALARIED-specific documents
                assert "salary_slip_1" in doc_types, "Salary slip 1 should be required"
                assert "salary_slip_2" in doc_types, "Salary slip 2 should be required"
                assert "salary_slip_3" in doc_types, "Salary slip 3 should be required"
                
                print(f"✓ SALARIED requirements verified: {len(requirements)} documents")
                for req in requirements:
                    print(f"  - {req['display_name']} ({'required' if req['required'] else 'optional'})")
        else:
            print("⚠ No SALARIED customer found - testing both types response")
            
            # Test with a lead that has no customer_type set
            req_response = api_client.get(
                f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/document-requirements"
            )
            
            assert req_response.status_code == 200
            data = req_response.json()
            
            # If customer_type is not set, should return both types
            if data["customer_type"] is None:
                assert "SALARIED" in data["requirements"]
                assert "SELF_EMPLOYED" in data["requirements"]
                print("✓ Both SALARIED and SELF_EMPLOYED requirements returned")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
