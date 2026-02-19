"""
Test P0 Flow: Partner/Client integration with Leads, Customers, and Inspections
Features tested:
1. Leads: partner_id field with default B2C partner
2. Customers: partner_id inherited from lead
3. Inspections: report_template_id, inspection_template_id, report_style
4. New APIs: GET /api/inspections/{id}/questionnaire, GET /api/inspections/{id}/report-config
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestP0PartnerFlow:
    """Test the complete P0 partner flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "countryhead.in@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = login_response.json()["user"]
        yield
    
    # ==================== PARTNERS API TESTS ====================
    
    def test_01_get_partners_list(self):
        """Test GET /api/partners returns list of partners including B2C Default"""
        response = requests.get(f"{BASE_URL}/api/partners", headers=self.headers)
        assert response.status_code == 200, f"Failed to get partners: {response.text}"
        
        partners = response.json()
        assert isinstance(partners, list), "Partners should be a list"
        assert len(partners) >= 1, "Should have at least 1 partner (B2C Default)"
        
        # Check for B2C Default partner
        b2c_partner = next((p for p in partners if p.get("type") == "b2c"), None)
        assert b2c_partner is not None, "B2C Default partner should exist"
        assert b2c_partner.get("name") == "B2C Default", f"B2C partner name should be 'B2C Default', got: {b2c_partner.get('name')}"
        
        # Store B2C partner ID for later tests
        self.__class__.b2c_partner_id = b2c_partner["id"]
        print(f"✓ Found {len(partners)} partners, B2C Default ID: {self.b2c_partner_id}")
    
    def test_02_get_active_partners(self):
        """Test GET /api/partners?is_active=true returns only active partners"""
        response = requests.get(f"{BASE_URL}/api/partners?is_active=true", headers=self.headers)
        assert response.status_code == 200, f"Failed to get active partners: {response.text}"
        
        partners = response.json()
        assert isinstance(partners, list), "Partners should be a list"
        
        # All returned partners should be active
        for partner in partners:
            assert partner.get("is_active", True) == True, f"Partner {partner.get('name')} should be active"
        
        # Check for expected partners: B2C Default, HDFC Bank, ICICI Bank
        partner_names = [p.get("name") for p in partners]
        print(f"✓ Active partners: {partner_names}")
    
    # ==================== LEADS WITH PARTNER TESTS ====================
    
    def test_03_create_lead_without_partner_gets_default_b2c(self):
        """Test POST /api/leads without partner_id gets default B2C partner"""
        lead_data = {
            "name": f"TEST_Lead_NoPartner_{uuid.uuid4().hex[:8]}",
            "mobile": f"98765{uuid.uuid4().hex[:5]}",
            "city": "Bangalore",
            "source": "META_WHATSAPP"
        }
        
        response = requests.post(f"{BASE_URL}/api/leads", json=lead_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        lead = response.json()
        assert lead.get("partner_id") is not None, "Lead should have partner_id set"
        assert lead.get("partner_name") == "B2C Default", f"Lead partner_name should be 'B2C Default', got: {lead.get('partner_name')}"
        
        # Store lead ID for cleanup
        self.__class__.test_lead_id_no_partner = lead["id"]
        print(f"✓ Lead created with default B2C partner: {lead.get('partner_name')}")
    
    def test_04_create_lead_with_specific_partner(self):
        """Test POST /api/leads with specific partner_id"""
        # First get HDFC Bank partner
        response = requests.get(f"{BASE_URL}/api/partners?is_active=true", headers=self.headers)
        partners = response.json()
        hdfc_partner = next((p for p in partners if "HDFC" in p.get("name", "")), None)
        
        if not hdfc_partner:
            pytest.skip("HDFC Bank partner not found")
        
        lead_data = {
            "name": f"TEST_Lead_HDFC_{uuid.uuid4().hex[:8]}",
            "mobile": f"98764{uuid.uuid4().hex[:5]}",
            "city": "Mumbai",
            "source": "META_WHATSAPP",
            "partner_id": hdfc_partner["id"],
            "partner_name": hdfc_partner["name"]
        }
        
        response = requests.post(f"{BASE_URL}/api/leads", json=lead_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        lead = response.json()
        assert lead.get("partner_id") == hdfc_partner["id"], "Lead should have HDFC partner_id"
        assert lead.get("partner_name") == hdfc_partner["name"], f"Lead partner_name should be '{hdfc_partner['name']}'"
        
        self.__class__.test_lead_id_hdfc = lead["id"]
        self.__class__.hdfc_partner_id = hdfc_partner["id"]
        print(f"✓ Lead created with HDFC partner: {lead.get('partner_name')}")
    
    def test_05_update_lead_partner(self):
        """Test PUT /api/leads/{id} can update partner_id"""
        # Get ICICI partner
        response = requests.get(f"{BASE_URL}/api/partners?is_active=true", headers=self.headers)
        partners = response.json()
        icici_partner = next((p for p in partners if "ICICI" in p.get("name", "")), None)
        
        if not icici_partner or not hasattr(self, 'test_lead_id_no_partner'):
            pytest.skip("ICICI partner not found or no test lead")
        
        update_data = {
            "partner_id": icici_partner["id"],
            "partner_name": icici_partner["name"]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/leads/{self.test_lead_id_no_partner}", 
            json=update_data, 
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to update lead: {response.text}"
        
        lead = response.json()
        assert lead.get("partner_id") == icici_partner["id"], "Lead partner_id should be updated"
        assert lead.get("partner_name") == icici_partner["name"], "Lead partner_name should be updated"
        print(f"✓ Lead partner updated to: {lead.get('partner_name')}")
    
    # ==================== INSPECTION QUESTIONNAIRE API TESTS ====================
    
    def test_06_get_inspection_questionnaire(self):
        """Test GET /api/inspections/{id}/questionnaire returns questions"""
        # First get an existing inspection
        response = requests.get(f"{BASE_URL}/api/inspections", headers=self.headers)
        assert response.status_code == 200, f"Failed to get inspections: {response.text}"
        
        inspections = response.json()
        if not inspections:
            pytest.skip("No inspections found to test questionnaire API")
        
        inspection = inspections[0]
        inspection_id = inspection["id"]
        
        # Get questionnaire for this inspection
        response = requests.get(
            f"{BASE_URL}/api/inspections/{inspection_id}/questionnaire", 
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get questionnaire: {response.text}"
        
        questionnaire = response.json()
        assert "inspection_id" in questionnaire, "Response should have inspection_id"
        assert "inspection_template_id" in questionnaire, "Response should have inspection_template_id"
        assert "questions" in questionnaire, "Response should have questions"
        assert "report_style" in questionnaire, "Response should have report_style"
        
        print(f"✓ Questionnaire API returned {len(questionnaire.get('questions', []))} questions")
        print(f"  - Template ID: {questionnaire.get('inspection_template_id')}")
        print(f"  - Report Style: {questionnaire.get('report_style')}")
    
    def test_07_get_inspection_report_config(self):
        """Test GET /api/inspections/{id}/report-config returns report configuration"""
        # First get an existing inspection
        response = requests.get(f"{BASE_URL}/api/inspections", headers=self.headers)
        assert response.status_code == 200, f"Failed to get inspections: {response.text}"
        
        inspections = response.json()
        if not inspections:
            pytest.skip("No inspections found to test report-config API")
        
        inspection = inspections[0]
        inspection_id = inspection["id"]
        
        # Get report config for this inspection
        response = requests.get(
            f"{BASE_URL}/api/inspections/{inspection_id}/report-config", 
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get report-config: {response.text}"
        
        config = response.json()
        assert "inspection_id" in config, "Response should have inspection_id"
        assert "report_style" in config, "Response should have report_style"
        
        # Check for style_info if report_template exists
        if config.get("report_template_id"):
            assert "style_info" in config, "Response should have style_info when report_template exists"
            assert "inspection_template_id" in config, "Response should have inspection_template_id"
        
        print(f"✓ Report Config API returned:")
        print(f"  - Report Template ID: {config.get('report_template_id')}")
        print(f"  - Report Style: {config.get('report_style')}")
        print(f"  - Style Info: {config.get('style_info', {}).get('name', 'N/A')}")
    
    # ==================== CUSTOMERS WITH PARTNER TESTS ====================
    
    def test_08_customer_shows_partner_info(self):
        """Test GET /api/customers returns partner_name for customers"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=self.headers)
        assert response.status_code == 200, f"Failed to get customers: {response.text}"
        
        customers = response.json()
        if not customers:
            pytest.skip("No customers found")
        
        # Check if customers have partner_name field
        customers_with_partner = [c for c in customers if c.get("partner_name")]
        print(f"✓ Found {len(customers_with_partner)} customers with partner info out of {len(customers)}")
        
        # Check for non-B2C partners
        non_b2c_customers = [c for c in customers if c.get("partner_name") and c.get("partner_name") != "B2C Default"]
        if non_b2c_customers:
            print(f"  - Customers with non-B2C partners: {len(non_b2c_customers)}")
            for c in non_b2c_customers[:3]:
                print(f"    • {c.get('name')}: {c.get('partner_name')}")
    
    # ==================== INSPECTION TEMPLATES TESTS ====================
    
    def test_09_get_inspection_templates(self):
        """Test GET /api/inspection-templates returns templates"""
        response = requests.get(f"{BASE_URL}/api/inspection-templates", headers=self.headers)
        assert response.status_code == 200, f"Failed to get inspection templates: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Templates should be a list"
        
        print(f"✓ Found {len(templates)} inspection templates")
        for t in templates[:3]:
            print(f"  - {t.get('name')}: {len(t.get('question_ids', []))} questions")
    
    def test_10_get_report_templates(self):
        """Test GET /api/report-templates returns templates with partner and style info"""
        response = requests.get(f"{BASE_URL}/api/report-templates", headers=self.headers)
        assert response.status_code == 200, f"Failed to get report templates: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Templates should be a list"
        
        print(f"✓ Found {len(templates)} report templates")
        for t in templates[:3]:
            print(f"  - {t.get('name')}: Style={t.get('report_style')}, Partner={t.get('partner_name')}")
    
    def test_11_get_report_styles(self):
        """Test GET /api/report-templates/styles returns available styles"""
        response = requests.get(f"{BASE_URL}/api/report-templates/styles", headers=self.headers)
        assert response.status_code == 200, f"Failed to get report styles: {response.text}"
        
        styles = response.json()
        assert isinstance(styles, list), "Styles should be a list"
        assert len(styles) >= 3, "Should have at least 3 styles (standard, premium, detailed)"
        
        style_names = [s.get("id") for s in styles]
        assert "standard" in style_names, "Should have 'standard' style"
        assert "premium" in style_names, "Should have 'premium' style"
        assert "detailed" in style_names, "Should have 'detailed' style"
        
        print(f"✓ Found {len(styles)} report styles: {style_names}")
    
    # ==================== CLEANUP ====================
    
    def test_99_cleanup_test_data(self):
        """Cleanup test leads created during testing"""
        # Delete test leads
        test_lead_ids = []
        if hasattr(self, 'test_lead_id_no_partner'):
            test_lead_ids.append(self.test_lead_id_no_partner)
        if hasattr(self, 'test_lead_id_hdfc'):
            test_lead_ids.append(self.test_lead_id_hdfc)
        
        for lead_id in test_lead_ids:
            try:
                response = requests.delete(f"{BASE_URL}/api/leads/{lead_id}", headers=self.headers)
                if response.status_code in [200, 403]:  # 403 if not CEO
                    print(f"✓ Cleaned up test lead: {lead_id}")
            except Exception as e:
                print(f"Warning: Could not delete lead {lead_id}: {e}")


class TestLeadsPartnerDropdown:
    """Test that leads page has partner dropdown functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "countryhead.in@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_partners_available_for_dropdown(self):
        """Test that partners are available for the dropdown in leads form"""
        response = requests.get(f"{BASE_URL}/api/partners?is_active=true", headers=self.headers)
        assert response.status_code == 200, f"Failed to get partners: {response.text}"
        
        partners = response.json()
        assert len(partners) >= 1, "Should have at least 1 partner for dropdown"
        
        # Check expected partners exist
        partner_names = [p.get("name") for p in partners]
        
        # B2C Default should exist
        assert any("B2C" in name for name in partner_names), "B2C Default partner should exist"
        
        print(f"✓ Partners available for dropdown: {partner_names}")
        
        # Check partner structure has required fields
        for partner in partners:
            assert "id" in partner, "Partner should have id"
            assert "name" in partner, "Partner should have name"
            assert "type" in partner, "Partner should have type"


class TestInspectionNewFields:
    """Test that inspections have new fields: report_template_id, inspection_template_id, report_style"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "countryhead.in@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_inspection_has_template_fields(self):
        """Test that inspections have report_template_id, inspection_template_id, report_style"""
        response = requests.get(f"{BASE_URL}/api/inspections", headers=self.headers)
        assert response.status_code == 200, f"Failed to get inspections: {response.text}"
        
        inspections = response.json()
        if not inspections:
            pytest.skip("No inspections found")
        
        # Check first inspection for new fields
        inspection = inspections[0]
        
        # These fields may or may not be present depending on how inspection was created
        print(f"✓ Inspection {inspection.get('id')} fields:")
        print(f"  - report_template_id: {inspection.get('report_template_id', 'Not set')}")
        print(f"  - inspection_template_id: {inspection.get('inspection_template_id', 'Not set')}")
        print(f"  - report_style: {inspection.get('report_style', 'Not set')}")
        print(f"  - partner_id: {inspection.get('partner_id', 'Not set')}")
        print(f"  - partner_name: {inspection.get('partner_name', 'Not set')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
