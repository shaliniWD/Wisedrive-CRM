"""
Test Partners and Inspection Templates APIs
Tests for the new Partners and Inspection Templates management system
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "countryhead.in@wisedrive.com"
TEST_PASSWORD = "password123"


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
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestPartnersAPI:
    """Test Partners CRUD operations"""
    
    created_partner_id = None
    
    def test_get_partners_list(self, api_client):
        """Test GET /api/partners - should return list of partners"""
        response = api_client.get(f"{BASE_URL}/api/partners")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} partners")
        
        # Check if HDFC Bank partner exists (mentioned in context)
        partner_names = [p.get("name") for p in data]
        print(f"Partner names: {partner_names}")
    
    def test_create_partner_bank(self, api_client):
        """Test POST /api/partners - create a new Bank partner"""
        unique_name = f"TEST_ICICI_Bank_{uuid.uuid4().hex[:6]}"
        partner_data = {
            "name": unique_name,
            "type": "bank",
            "contact_person": "Test Contact",
            "contact_email": "test@icicibank.com",
            "contact_phone": "+91 9876543210",
            "address": "Mumbai, India",
            "notes": "Test bank partner",
            "is_active": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/partners", json=partner_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("name") == unique_name
        assert data.get("type") == "bank"
        assert data.get("contact_person") == "Test Contact"
        assert data.get("is_active") == True
        assert "id" in data
        
        TestPartnersAPI.created_partner_id = data["id"]
        print(f"Created partner: {data['name']} with ID: {data['id']}")
    
    def test_get_partner_by_id(self, api_client):
        """Test GET /api/partners/{id} - get specific partner"""
        if not TestPartnersAPI.created_partner_id:
            pytest.skip("No partner created to fetch")
        
        response = api_client.get(f"{BASE_URL}/api/partners/{TestPartnersAPI.created_partner_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("id") == TestPartnersAPI.created_partner_id
        assert data.get("type") == "bank"
        print(f"Fetched partner: {data['name']}")
    
    def test_update_partner(self, api_client):
        """Test PUT /api/partners/{id} - update partner"""
        if not TestPartnersAPI.created_partner_id:
            pytest.skip("No partner created to update")
        
        update_data = {
            "name": f"TEST_ICICI_Bank_Updated_{uuid.uuid4().hex[:4]}",
            "type": "bank",
            "contact_person": "Updated Contact",
            "notes": "Updated notes"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/partners/{TestPartnersAPI.created_partner_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("contact_person") == "Updated Contact"
        assert data.get("notes") == "Updated notes"
        print(f"Updated partner: {data['name']}")
    
    def test_toggle_partner_status(self, api_client):
        """Test PATCH /api/partners/{id}/toggle - toggle active status"""
        if not TestPartnersAPI.created_partner_id:
            pytest.skip("No partner created to toggle")
        
        # First get current status
        response = api_client.get(f"{BASE_URL}/api/partners/{TestPartnersAPI.created_partner_id}")
        current_status = response.json().get("is_active", True)
        
        # Toggle status
        response = api_client.patch(f"{BASE_URL}/api/partners/{TestPartnersAPI.created_partner_id}/toggle")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("is_active") != current_status, "Status should be toggled"
        print(f"Toggled partner status from {current_status} to {data.get('is_active')}")
        
        # Toggle back
        response = api_client.patch(f"{BASE_URL}/api/partners/{TestPartnersAPI.created_partner_id}/toggle")
        assert response.status_code == 200
    
    def test_filter_partners_by_type(self, api_client):
        """Test GET /api/partners?type=bank - filter by type"""
        response = api_client.get(f"{BASE_URL}/api/partners", params={"type": "bank"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        for partner in data:
            assert partner.get("type") == "bank", f"Expected type 'bank', got {partner.get('type')}"
        print(f"Found {len(data)} bank partners")
    
    def test_create_partner_b2c(self, api_client):
        """Test creating B2C partner type"""
        partner_data = {
            "name": f"TEST_B2C_Partner_{uuid.uuid4().hex[:6]}",
            "type": "b2c",
            "is_active": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/partners", json=partner_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("type") == "b2c"
        print(f"Created B2C partner: {data['name']}")
    
    def test_create_partner_insurance(self, api_client):
        """Test creating Insurance partner type"""
        partner_data = {
            "name": f"TEST_Insurance_Partner_{uuid.uuid4().hex[:6]}",
            "type": "insurance",
            "contact_person": "Insurance Agent",
            "is_active": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/partners", json=partner_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("type") == "insurance"
        print(f"Created Insurance partner: {data['name']}")
    
    def test_create_partner_b2b(self, api_client):
        """Test creating B2B partner type"""
        partner_data = {
            "name": f"TEST_B2B_Partner_{uuid.uuid4().hex[:6]}",
            "type": "b2b",
            "contact_person": "B2B Contact",
            "is_active": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/partners", json=partner_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("type") == "b2b"
        print(f"Created B2B partner: {data['name']}")


class TestInspectionTemplatesAPI:
    """Test Inspection Templates CRUD operations"""
    
    created_template_id = None
    test_partner_id = None
    
    def test_get_templates_list(self, api_client):
        """Test GET /api/inspection-templates - should return list of templates"""
        response = api_client.get(f"{BASE_URL}/api/inspection-templates")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} inspection templates")
        
        # Check template structure
        if data:
            template = data[0]
            print(f"Sample template: {template.get('name')}, partner: {template.get('partner_name')}, questions: {template.get('question_count')}")
    
    def test_get_questions_for_template(self, api_client):
        """Test GET /api/inspection-qa/questions - get questions pool"""
        response = api_client.get(f"{BASE_URL}/api/inspection-qa/questions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} questions in pool")
        
        # Store question IDs for template creation
        TestInspectionTemplatesAPI.question_ids = [q.get("id") for q in data[:4]]  # Use first 4 questions
    
    def test_get_partners_for_template(self, api_client):
        """Get active partners for template creation"""
        response = api_client.get(f"{BASE_URL}/api/partners", params={"is_active": True})
        assert response.status_code == 200
        
        data = response.json()
        if data:
            TestInspectionTemplatesAPI.test_partner_id = data[0].get("id")
            print(f"Using partner: {data[0].get('name')} for template tests")
    
    def test_create_inspection_template(self, api_client):
        """Test POST /api/inspection-templates - create new template"""
        if not TestInspectionTemplatesAPI.test_partner_id:
            pytest.skip("No partner available for template creation")
        
        if not hasattr(TestInspectionTemplatesAPI, 'question_ids') or not TestInspectionTemplatesAPI.question_ids:
            pytest.skip("No questions available for template creation")
        
        template_data = {
            "name": f"TEST_Template_{uuid.uuid4().hex[:6]}",
            "partner_id": TestInspectionTemplatesAPI.test_partner_id,
            "description": "Test inspection template",
            "question_ids": TestInspectionTemplatesAPI.question_ids,
            "report_template_id": None,
            "is_default": False,
            "is_active": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/inspection-templates", json=template_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("name") == template_data["name"]
        assert data.get("partner_id") == TestInspectionTemplatesAPI.test_partner_id
        assert "id" in data
        
        TestInspectionTemplatesAPI.created_template_id = data["id"]
        print(f"Created template: {data['name']} with ID: {data['id']}")
    
    def test_get_template_by_id(self, api_client):
        """Test GET /api/inspection-templates/{id} - get specific template"""
        if not TestInspectionTemplatesAPI.created_template_id:
            pytest.skip("No template created to fetch")
        
        response = api_client.get(f"{BASE_URL}/api/inspection-templates/{TestInspectionTemplatesAPI.created_template_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("id") == TestInspectionTemplatesAPI.created_template_id
        assert "question_ids" in data
        assert "partner" in data or "partner_name" in data
        print(f"Fetched template: {data['name']} with {len(data.get('question_ids', []))} questions")
    
    def test_update_template(self, api_client):
        """Test PUT /api/inspection-templates/{id} - update template"""
        if not TestInspectionTemplatesAPI.created_template_id:
            pytest.skip("No template created to update")
        
        update_data = {
            "name": f"TEST_Template_Updated_{uuid.uuid4().hex[:4]}",
            "partner_id": TestInspectionTemplatesAPI.test_partner_id,
            "description": "Updated description",
            "question_ids": TestInspectionTemplatesAPI.question_ids[:2] if hasattr(TestInspectionTemplatesAPI, 'question_ids') else [],
            "is_active": True
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/inspection-templates/{TestInspectionTemplatesAPI.created_template_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("description") == "Updated description"
        print(f"Updated template: {data['name']}")
    
    def test_toggle_template_status(self, api_client):
        """Test PATCH /api/inspection-templates/{id}/toggle - toggle active status"""
        if not TestInspectionTemplatesAPI.created_template_id:
            pytest.skip("No template created to toggle")
        
        # Get current status
        response = api_client.get(f"{BASE_URL}/api/inspection-templates/{TestInspectionTemplatesAPI.created_template_id}")
        current_status = response.json().get("is_active", True)
        
        # Toggle status
        response = api_client.patch(f"{BASE_URL}/api/inspection-templates/{TestInspectionTemplatesAPI.created_template_id}/toggle")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("is_active") != current_status, "Status should be toggled"
        print(f"Toggled template status from {current_status} to {data.get('is_active')}")
        
        # Toggle back
        response = api_client.patch(f"{BASE_URL}/api/inspection-templates/{TestInspectionTemplatesAPI.created_template_id}/toggle")
        assert response.status_code == 200
    
    def test_set_template_as_default(self, api_client):
        """Test PATCH /api/inspection-templates/{id}/set-default - set as default"""
        if not TestInspectionTemplatesAPI.created_template_id:
            pytest.skip("No template created to set as default")
        
        response = api_client.patch(f"{BASE_URL}/api/inspection-templates/{TestInspectionTemplatesAPI.created_template_id}/set-default")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("is_default") == True, "Template should be set as default"
        print(f"Set template as default: {data['name']}")
    
    def test_delete_template(self, api_client):
        """Test DELETE /api/inspection-templates/{id} - delete template"""
        if not TestInspectionTemplatesAPI.created_template_id:
            pytest.skip("No template created to delete")
        
        response = api_client.delete(f"{BASE_URL}/api/inspection-templates/{TestInspectionTemplatesAPI.created_template_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify deletion
        response = api_client.get(f"{BASE_URL}/api/inspection-templates/{TestInspectionTemplatesAPI.created_template_id}")
        assert response.status_code == 404, "Template should be deleted"
        print("Template deleted successfully")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_partners(self, api_client):
        """Delete test partners created during testing"""
        response = api_client.get(f"{BASE_URL}/api/partners")
        if response.status_code == 200:
            partners = response.json()
            for partner in partners:
                if partner.get("name", "").startswith("TEST_"):
                    # Check if partner is used in templates
                    templates_response = api_client.get(f"{BASE_URL}/api/inspection-templates")
                    if templates_response.status_code == 200:
                        templates = templates_response.json()
                        partner_in_use = any(t.get("partner_id") == partner["id"] for t in templates)
                        if not partner_in_use:
                            delete_response = api_client.delete(f"{BASE_URL}/api/partners/{partner['id']}")
                            if delete_response.status_code == 200:
                                print(f"Deleted test partner: {partner['name']}")
        print("Cleanup completed")
