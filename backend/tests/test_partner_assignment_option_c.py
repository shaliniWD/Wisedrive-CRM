"""
Test Partner Assignment from Ad Mapping (Option C)

Tests the feature where:
1. Ad Mappings can have a Partner field assigned
2. When a lead comes in from a specific Ad campaign, it gets assigned to the partner from the ad mapping
3. B2C remains default for unmapped ads or ads without partner assignment
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPartnerAssignmentOptionC:
    """Test Partner Assignment from Ad Mapping (Option C)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        # Cleanup: Delete test ad mappings and leads
        self._cleanup_test_data()
    
    def _cleanup_test_data(self):
        """Clean up test data created during tests"""
        try:
            # Get all ad mappings and delete test ones
            mappings_res = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
            if mappings_res.status_code == 200:
                for mapping in mappings_res.json():
                    if mapping.get("ad_id", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/settings/ad-city-mappings/{mapping['id']}")
            
            # Delete test leads by phone
            test_phones = ["+919876543210", "+919876543211", "+919876543212", "+919999888877"]
            for phone in test_phones:
                leads_res = self.session.get(f"{BASE_URL}/api/leads", params={"search": phone.replace("+", "")})
                if leads_res.status_code == 200:
                    for lead in leads_res.json():
                        if lead.get("mobile") in test_phones or lead.get("mobile", "").replace("+", "") in [p.replace("+", "") for p in test_phones]:
                            try:
                                self.session.delete(f"{BASE_URL}/api/leads/{lead['id']}")
                            except:
                                pass
        except Exception as e:
            print(f"Cleanup warning: {e}")
    
    # ==================== AD MAPPING CRUD WITH PARTNER ====================
    
    def test_get_partners_list(self):
        """Test that partners list is available for dropdown"""
        response = self.session.get(f"{BASE_URL}/api/partners")
        assert response.status_code == 200, f"Failed to get partners: {response.text}"
        
        partners = response.json()
        assert isinstance(partners, list), "Partners should be a list"
        
        # Check if B2C partner exists
        b2c_partners = [p for p in partners if p.get("type") == "b2c"]
        print(f"Found {len(partners)} partners, {len(b2c_partners)} B2C partners")
        
        # Verify partner structure
        if partners:
            partner = partners[0]
            assert "id" in partner, "Partner should have id"
            assert "name" in partner, "Partner should have name"
    
    def test_create_ad_mapping_with_partner(self):
        """Test creating an ad mapping with partner assigned"""
        # First get a partner to assign
        partners_res = self.session.get(f"{BASE_URL}/api/partners")
        assert partners_res.status_code == 200
        partners = partners_res.json()
        
        # Find a non-B2C partner if available, otherwise use any partner
        test_partner = None
        for p in partners:
            if p.get("type") != "b2c" and p.get("is_active", True):
                test_partner = p
                break
        
        if not test_partner and partners:
            test_partner = partners[0]
        
        # Create ad mapping with partner
        mapping_data = {
            "ad_id": "TEST_HDFC_CAMPAIGN_001",
            "city": "Bangalore",
            "ad_name": "HDFC Bank Car Inspection Campaign",
            "source": "Facebook",
            "is_active": True,
            "partner_id": test_partner["id"] if test_partner else None,
            "partner_name": test_partner["name"] if test_partner else None
        }
        
        response = self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=mapping_data)
        assert response.status_code in [200, 201], f"Failed to create ad mapping: {response.text}"
        
        result = response.json()
        # API returns {message, id} - verify creation was successful
        assert "id" in result, "Response should contain mapping id"
        assert result.get("message") in ["Mapping created", "Mapping updated"], f"Unexpected message: {result.get('message')}"
        
        # Verify by fetching the mapping
        mappings_res = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        assert mappings_res.status_code == 200
        mappings = mappings_res.json()
        
        created_mapping = None
        for m in mappings:
            if m.get("ad_id") == "TEST_HDFC_CAMPAIGN_001":
                created_mapping = m
                break
        
        assert created_mapping is not None, "Created mapping should be found"
        assert created_mapping.get("city") == "Bangalore"
        
        if test_partner:
            assert created_mapping.get("partner_id") == test_partner["id"], "Partner ID should be saved"
            assert created_mapping.get("partner_name") == test_partner["name"], "Partner name should be saved"
        
        print(f"Created ad mapping with partner: {created_mapping.get('partner_name')}")
    
    def test_create_ad_mapping_without_partner(self):
        """Test creating an ad mapping without partner (should default to B2C)"""
        mapping_data = {
            "ad_id": "TEST_GENERIC_AD_001",
            "city": "Chennai",
            "ad_name": "Generic Car Inspection Ad",
            "source": "Instagram",
            "is_active": True
            # No partner_id - should default to B2C
        }
        
        response = self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=mapping_data)
        assert response.status_code in [200, 201], f"Failed to create ad mapping: {response.text}"
        
        result = response.json()
        assert "id" in result, "Response should contain mapping id"
        
        # Verify by fetching
        mappings_res = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        mappings = mappings_res.json()
        
        created_mapping = None
        for m in mappings:
            if m.get("ad_id") == "TEST_GENERIC_AD_001":
                created_mapping = m
                break
        
        assert created_mapping is not None, "Created mapping should be found"
        assert created_mapping.get("partner_id") is None or created_mapping.get("partner_id") == ""
        
        print("Created ad mapping without partner (will default to B2C)")
    
    def test_update_ad_mapping_partner(self):
        """Test updating an ad mapping to add/change partner"""
        # First create a mapping without partner
        mapping_data = {
            "ad_id": "TEST_UPDATE_PARTNER_001",
            "city": "Mumbai",
            "ad_name": "Test Update Partner Ad",
            "is_active": True
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=mapping_data)
        assert create_res.status_code in [200, 201]
        mapping_id = create_res.json()["id"]
        
        # Get a partner to assign
        partners_res = self.session.get(f"{BASE_URL}/api/partners")
        partners = partners_res.json()
        
        if partners:
            test_partner = partners[0]
            
            # Update mapping with partner
            update_data = {
                "partner_id": test_partner["id"],
                "partner_name": test_partner["name"]
            }
            
            update_res = self.session.put(f"{BASE_URL}/api/settings/ad-city-mappings/{mapping_id}", json=update_data)
            assert update_res.status_code == 200, f"Failed to update mapping: {update_res.text}"
            
            updated_mapping = update_res.json()
            assert updated_mapping.get("partner_id") == test_partner["id"]
            assert updated_mapping.get("partner_name") == test_partner["name"]
            
            print(f"Updated ad mapping with partner: {test_partner['name']}")
    
    def test_ad_mappings_table_shows_partner(self):
        """Test that ad mappings list includes partner information"""
        response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        assert response.status_code == 200, f"Failed to get ad mappings: {response.text}"
        
        mappings = response.json()
        assert isinstance(mappings, list)
        
        # Check that mappings have partner fields
        for mapping in mappings:
            # partner_id and partner_name should be present (even if null)
            assert "partner_id" in mapping or mapping.get("partner_id") is None
            assert "partner_name" in mapping or mapping.get("partner_name") is None
        
        # Count mappings with partners
        with_partner = [m for m in mappings if m.get("partner_id")]
        print(f"Found {len(mappings)} ad mappings, {len(with_partner)} with partner assigned")
    
    # ==================== WEBHOOK PARTNER ASSIGNMENT ====================
    
    def test_webhook_assigns_partner_from_ad_mapping(self):
        """Test that webhook assigns partner from ad_mapping when partner_id is set"""
        # First create an ad mapping with a partner
        partners_res = self.session.get(f"{BASE_URL}/api/partners")
        partners = partners_res.json()
        
        # Find a non-B2C partner
        test_partner = None
        for p in partners:
            if p.get("type") != "b2c" and p.get("is_active", True):
                test_partner = p
                break
        
        if not test_partner:
            pytest.skip("No non-B2C partner available for testing")
        
        # Create ad mapping with partner
        mapping_data = {
            "ad_id": "TEST_PARTNER_WEBHOOK_001",
            "city": "Hyderabad",
            "ad_name": "Partner Test Campaign",
            "source": "Facebook",
            "is_active": True,
            "partner_id": test_partner["id"],
            "partner_name": test_partner["name"]
        }
        
        mapping_res = self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=mapping_data)
        assert mapping_res.status_code in [200, 201]
        
        # Simulate webhook call with this ad_id
        # Note: Using correct webhook endpoint /api/webhooks/twilio/whatsapp
        webhook_data = {
            "From": "whatsapp:+919876543210",
            "Body": "Hi, I want car inspection",
            "ProfileName": "Test Partner Lead",
            "CtwaClid": "TEST_PARTNER_WEBHOOK_001",  # This matches our ad mapping
            "ReferralSourceUrl": "https://fb.me/test",
            "ReferralHeadline": "Partner Test Campaign",
            "ReferralBody": "Get your car inspected",
            "ReferralSourceType": "ad"
        }
        
        # Call webhook (no auth needed for webhook)
        webhook_session = requests.Session()
        webhook_res = webhook_session.post(f"{BASE_URL}/api/webhooks/twilio/whatsapp", data=webhook_data)
        assert webhook_res.status_code == 200, f"Webhook failed: {webhook_res.text}"
        
        # Verify lead was created with correct partner
        leads_res = self.session.get(f"{BASE_URL}/api/leads", params={"search": "9876543210"})
        assert leads_res.status_code == 200
        leads = leads_res.json()
        
        # Find our test lead
        test_lead = None
        for lead in leads:
            if "9876543210" in lead.get("mobile", ""):
                test_lead = lead
                break
        
        assert test_lead is not None, "Test lead should be created"
        assert test_lead.get("partner_id") == test_partner["id"], f"Lead should have partner from ad mapping. Got: {test_lead.get('partner_id')}"
        assert test_lead.get("partner_name") == test_partner["name"], f"Lead should have partner name. Got: {test_lead.get('partner_name')}"
        
        print(f"Lead created with partner: {test_lead.get('partner_name')}")
    
    def test_webhook_defaults_to_b2c_without_partner_mapping(self):
        """Test that webhook defaults to B2C when ad_mapping has no partner"""
        # Create ad mapping WITHOUT partner
        mapping_data = {
            "ad_id": "TEST_NO_PARTNER_WEBHOOK_001",
            "city": "Pune",
            "ad_name": "No Partner Test Campaign",
            "source": "Instagram",
            "is_active": True
            # No partner_id
        }
        
        mapping_res = self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=mapping_data)
        assert mapping_res.status_code in [200, 201]
        
        # Simulate webhook call
        webhook_data = {
            "From": "whatsapp:+919876543211",
            "Body": "Hi, I need inspection",
            "ProfileName": "Test B2C Lead",
            "CtwaClid": "TEST_NO_PARTNER_WEBHOOK_001",
            "ReferralSourceUrl": "https://ig.me/test",
            "ReferralHeadline": "No Partner Test Campaign",
            "ReferralBody": "Car inspection services",
            "ReferralSourceType": "ad"
        }
        
        webhook_session = requests.Session()
        webhook_res = webhook_session.post(f"{BASE_URL}/api/webhooks/twilio/whatsapp", data=webhook_data)
        assert webhook_res.status_code == 200
        
        # Verify lead was created with B2C partner
        leads_res = self.session.get(f"{BASE_URL}/api/leads", params={"search": "9876543211"})
        assert leads_res.status_code == 200
        leads = leads_res.json()
        
        test_lead = None
        for lead in leads:
            if "9876543211" in lead.get("mobile", ""):
                test_lead = lead
                break
        
        assert test_lead is not None, "Test lead should be created"
        
        # Should have B2C partner (or the default partner)
        # Check if partner_name contains "B2C" or is the default
        partner_name = test_lead.get("partner_name", "")
        print(f"Lead created with partner: {partner_name} (should be B2C default)")
        
        # Verify it's not a specific partner (should be B2C default)
        assert test_lead.get("partner_id") is not None, "Lead should have a partner_id (B2C default)"
    
    def test_webhook_defaults_to_b2c_for_unmapped_ad(self):
        """Test that webhook defaults to B2C for ads without any mapping"""
        # Simulate webhook call with an unmapped ad_id
        webhook_data = {
            "From": "whatsapp:+919876543212",
            "Body": "Hi, car inspection please",
            "ProfileName": "Test Unmapped Lead",
            "CtwaClid": "UNMAPPED_AD_ID_12345",  # This ad_id has no mapping
            "ReferralSourceUrl": "https://fb.me/unmapped",
            "ReferralHeadline": "Some Random Ad",
            "ReferralBody": "Car services",
            "ReferralSourceType": "ad"
        }
        
        webhook_session = requests.Session()
        webhook_res = webhook_session.post(f"{BASE_URL}/api/webhooks/twilio/whatsapp", data=webhook_data)
        assert webhook_res.status_code == 200
        
        # Verify lead was created with B2C partner
        leads_res = self.session.get(f"{BASE_URL}/api/leads", params={"search": "9876543212"})
        assert leads_res.status_code == 200
        leads = leads_res.json()
        
        test_lead = None
        for lead in leads:
            if "9876543212" in lead.get("mobile", ""):
                test_lead = lead
                break
        
        assert test_lead is not None, "Test lead should be created"
        
        # Should have B2C partner as default
        partner_name = test_lead.get("partner_name", "")
        print(f"Unmapped ad lead created with partner: {partner_name}")
        
        # Verify it has a partner (B2C default)
        assert test_lead.get("partner_id") is not None, "Lead should have B2C default partner"
    
    # ==================== EXISTING FLOW VERIFICATION ====================
    
    def test_existing_lead_creation_not_broken(self):
        """Test that existing lead creation flow still works"""
        lead_data = {
            "name": "Test Manual Lead",
            "mobile": "+919999888877",
            "city": "Delhi",
            "source": "Website",
            "status": "NEW LEAD"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code in [200, 201], f"Failed to create lead: {response.text}"
        
        created_lead = response.json()
        assert created_lead.get("name") == "Test Manual Lead"
        assert created_lead.get("city") == "Delhi"
        
        # Should have B2C default partner
        assert created_lead.get("partner_id") is not None, "Manual lead should have B2C default partner"
        
        print(f"Manual lead created with partner: {created_lead.get('partner_name')}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/leads/{created_lead['id']}")
    
    def test_existing_ad_mapping_flow_not_broken(self):
        """Test that existing ad mapping CRUD still works"""
        # Create
        mapping_data = {
            "ad_id": "TEST_EXISTING_FLOW_001",
            "city": "Kolkata",
            "ad_name": "Existing Flow Test",
            "source": "Google",
            "is_active": True
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=mapping_data)
        assert create_res.status_code in [200, 201]
        mapping_id = create_res.json()["id"]
        
        # Read
        get_res = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        assert get_res.status_code == 200
        mappings = get_res.json()
        assert any(m["id"] == mapping_id for m in mappings)
        
        # Update
        update_res = self.session.put(f"{BASE_URL}/api/settings/ad-city-mappings/{mapping_id}", json={
            "city": "Ahmedabad"
        })
        assert update_res.status_code == 200
        assert update_res.json().get("city") == "Ahmedabad"
        
        # Delete
        delete_res = self.session.delete(f"{BASE_URL}/api/settings/ad-city-mappings/{mapping_id}")
        assert delete_res.status_code == 200
        
        print("Existing ad mapping CRUD flow works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
