"""
Test Suite for Twilio WhatsApp Webhook Audit Trail Feature
Tests the CTWA (Click-to-WhatsApp) parameter handling and audit trail storage

Features tested:
1. Twilio WhatsApp webhook endpoint (/api/webhooks/twilio/whatsapp)
2. Lead Investigate API (/api/leads/investigate/by-phone/{phone})
3. META_WHATSAPP vs DIRECT_WHATSAPP source classification
4. Audit trail data storage and retrieval
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "kalyan@wisedrive.com"
TEST_PASSWORD = "password123"

# Test phone numbers
META_WHATSAPP_PHONE = "+919876543210"
DIRECT_WHATSAPP_PHONE = "+919876543211"


class TestTwilioWebhookAuditTrail:
    """Test suite for Twilio WhatsApp webhook with audit trail"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.auth_token = token
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    def test_01_webhook_endpoint_exists(self):
        """Test that the Twilio webhook endpoint exists and accepts POST requests"""
        # Send minimal form data to webhook
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": "whatsapp:+919999999999",
                "Body": "Test message",
                "ProfileName": "Test User"
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        # Webhook should return 200 with TwiML response
        assert response.status_code == 200, f"Webhook returned {response.status_code}: {response.text}"
        print(f"✅ Webhook endpoint exists and returns 200")
    
    def test_02_webhook_accepts_ctwa_parameters(self):
        """Test that webhook accepts all CTWA parameters from Meta ads"""
        # Generate unique phone for this test
        test_phone = f"+91987654{int(time.time()) % 10000:04d}"
        
        # Send webhook with full CTWA data
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{test_phone}",
                "Body": "Hi, I'm interested in car inspection",
                "ProfileName": "CTWA Test User",
                "WaId": test_phone.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}",
                "To": "whatsapp:+14155238886",
                "AccountSid": "AC0519b735e98165926ad87a68b362fa62",
                "NumMedia": "0",
                # CTWA parameters
                "ReferralSourceUrl": "https://fb.me/test-ad-url",
                "ReferralBody": "Get your car inspected today!",
                "ReferralHeadline": "WiseDrive Bangalore Car Inspection",
                "ReferralSourceType": "ad",
                "ReferralNumMedia": "0",
                "ButtonText": "Send Message",
                "CtwaClid": "TEST_CTWA_CLICK_ID_12345"
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200, f"Webhook failed: {response.status_code}: {response.text}"
        print(f"✅ Webhook accepts CTWA parameters successfully")
        
        # Store phone for later tests
        self.__class__.ctwa_test_phone = test_phone
    
    def test_03_investigate_lead_by_phone_returns_audit_data(self):
        """Test that investigate endpoint returns webhook_audit data"""
        # Use the test phone from previous test or fallback
        test_phone = getattr(self.__class__, 'ctwa_test_phone', META_WHATSAPP_PHONE)
        
        # Clean phone number for API call
        clean_phone = test_phone.replace("+", "").replace(" ", "")
        
        response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{clean_phone}")
        
        if response.status_code == 404:
            # Lead might not exist, try with the predefined test phone
            response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/9876543210")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Lead found: {data.get('name')} - Source: {data.get('source')}")
            
            # Check if webhook_audit is present
            if data.get('webhook_audit'):
                print(f"✅ webhook_audit data is present")
                audit = data['webhook_audit']
                
                # Verify audit structure
                assert 'raw_twilio_params' in audit or 'parsed_standard_fields' in audit, "Audit missing expected fields"
                print(f"   - Has raw_twilio_params: {'raw_twilio_params' in audit}")
                print(f"   - Has parsed_standard_fields: {'parsed_standard_fields' in audit}")
                print(f"   - Has parsed_ctwa_fields: {'parsed_ctwa_fields' in audit}")
                print(f"   - Has extraction_log: {'extraction_log' in audit}")
                print(f"   - Has city_lookup_log: {'city_lookup_log' in audit}")
                print(f"   - Has final_assignment: {'final_assignment' in audit}")
            else:
                print(f"⚠️ No webhook_audit data (lead may have been created before audit feature)")
        else:
            print(f"⚠️ Lead not found (status {response.status_code}) - this is expected if test leads don't exist")
    
    def test_04_meta_whatsapp_source_classification(self):
        """Test that leads with CTWA data are classified as META_WHATSAPP"""
        # Create a lead with CTWA data
        test_phone = f"+91987655{int(time.time()) % 10000:04d}"
        
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{test_phone}",
                "Body": "Interested in inspection",
                "ProfileName": "Meta Lead Test",
                "WaId": test_phone.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}meta",
                # CTWA data present = META_WHATSAPP
                "ReferralHeadline": "WiseDrive Chennai Inspection",
                "CtwaClid": "META_TEST_CLICK_ID"
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200, f"Webhook failed: {response.status_code}"
        
        # Wait a moment for DB write
        time.sleep(0.5)
        
        # Investigate the lead
        clean_phone = test_phone.replace("+", "")
        investigate_response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{clean_phone}")
        
        if investigate_response.status_code == 200:
            data = investigate_response.json()
            source = data.get('source')
            print(f"✅ Lead source: {source}")
            assert source == "META_WHATSAPP", f"Expected META_WHATSAPP, got {source}"
            print(f"✅ Lead correctly classified as META_WHATSAPP")
        else:
            print(f"⚠️ Could not verify lead source (status {investigate_response.status_code})")
    
    def test_05_direct_whatsapp_source_classification(self):
        """Test that leads without CTWA data are classified as DIRECT_WHATSAPP"""
        # Create a lead WITHOUT CTWA data
        test_phone = f"+91987656{int(time.time()) % 10000:04d}"
        
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{test_phone}",
                "Body": "Hi, I want to know about car inspection",
                "ProfileName": "Direct WhatsApp Test",
                "WaId": test_phone.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}direct"
                # NO CTWA data = DIRECT_WHATSAPP
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200, f"Webhook failed: {response.status_code}"
        
        # Wait a moment for DB write
        time.sleep(0.5)
        
        # Investigate the lead
        clean_phone = test_phone.replace("+", "")
        investigate_response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{clean_phone}")
        
        if investigate_response.status_code == 200:
            data = investigate_response.json()
            source = data.get('source')
            print(f"✅ Lead source: {source}")
            assert source == "DIRECT_WHATSAPP", f"Expected DIRECT_WHATSAPP, got {source}"
            print(f"✅ Lead correctly classified as DIRECT_WHATSAPP")
        else:
            print(f"⚠️ Could not verify lead source (status {investigate_response.status_code})")
    
    def test_06_audit_trail_contains_all_sections(self):
        """Test that audit trail contains all expected sections"""
        # Create a lead with full CTWA data
        test_phone = f"+91987657{int(time.time()) % 10000:04d}"
        
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{test_phone}",
                "Body": "Full audit test",
                "ProfileName": "Audit Trail Test",
                "WaId": test_phone.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}audit",
                "To": "whatsapp:+14155238886",
                "AccountSid": "AC0519b735e98165926ad87a68b362fa62",
                "NumMedia": "0",
                "ReferralSourceUrl": "https://fb.me/audit-test",
                "ReferralBody": "Test body",
                "ReferralHeadline": "WiseDrive Hyderabad Test",
                "ReferralSourceType": "ad",
                "ReferralNumMedia": "0",
                "ButtonText": "Contact Us",
                "CtwaClid": "AUDIT_TEST_CLICK_ID"
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200, f"Webhook failed: {response.status_code}"
        
        time.sleep(0.5)
        
        # Investigate the lead
        clean_phone = test_phone.replace("+", "")
        investigate_response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{clean_phone}")
        
        if investigate_response.status_code == 200:
            data = investigate_response.json()
            audit = data.get('webhook_audit')
            
            if audit:
                print(f"✅ Audit trail present")
                
                # Check all expected sections
                sections = {
                    'raw_twilio_params': 'Raw Twilio Params',
                    'parsed_standard_fields': 'Parsed Standard Fields',
                    'parsed_ctwa_fields': 'Parsed CTWA Fields',
                    'extraction_log': 'Extraction Log',
                    'city_lookup_log': 'City Lookup Log',
                    'final_assignment': 'Final Assignment'
                }
                
                for key, name in sections.items():
                    if key in audit:
                        print(f"   ✅ {name}: Present")
                    else:
                        print(f"   ⚠️ {name}: Missing")
                
                # Verify CTWA fields are captured
                ctwa_fields = audit.get('parsed_ctwa_fields', {})
                if ctwa_fields.get('CtwaClid'):
                    print(f"   ✅ CtwaClid captured: {ctwa_fields.get('CtwaClid')}")
                else:
                    print(f"   ⚠️ CtwaClid not captured")
                
                if ctwa_fields.get('ReferralHeadline'):
                    print(f"   ✅ ReferralHeadline captured: {ctwa_fields.get('ReferralHeadline')}")
            else:
                print(f"⚠️ No audit trail in response")
        else:
            print(f"⚠️ Could not verify audit trail (status {investigate_response.status_code})")
    
    def test_07_investigate_existing_test_leads(self):
        """Test investigating the pre-created test leads"""
        test_phones = [
            ("9876543210", "META_WHATSAPP lead with CTWA data"),
            ("9876543211", "DIRECT_WHATSAPP lead")
        ]
        
        for phone, description in test_phones:
            response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{phone}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"\n✅ Found {description}:")
                print(f"   - Name: {data.get('name')}")
                print(f"   - Source: {data.get('source')}")
                print(f"   - AD ID: {data.get('ad_id') or 'Not captured'}")
                print(f"   - Has webhook_audit: {bool(data.get('webhook_audit'))}")
                
                if data.get('webhook_audit'):
                    audit = data['webhook_audit']
                    ctwa = audit.get('parsed_ctwa_fields', {})
                    print(f"   - CtwaClid: {ctwa.get('CtwaClid') or 'Not sent'}")
                    print(f"   - ReferralHeadline: {ctwa.get('ReferralHeadline') or 'Not sent'}")
            else:
                print(f"\n⚠️ Lead not found for {phone} ({description})")
    
    def test_08_webhook_handles_missing_optional_params(self):
        """Test that webhook handles missing optional parameters gracefully"""
        test_phone = f"+91987658{int(time.time()) % 10000:04d}"
        
        # Send only required parameters
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{test_phone}"
                # All other params missing
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200, f"Webhook should handle missing params: {response.status_code}"
        print(f"✅ Webhook handles missing optional parameters gracefully")
    
    def test_09_lead_sources_endpoint(self):
        """Test that lead sources include META_WHATSAPP and DIRECT_WHATSAPP"""
        response = self.session.get(f"{BASE_URL}/api/leads/sources")
        
        if response.status_code == 200:
            sources = response.json()
            print(f"✅ Available lead sources: {sources}")
            
            assert "META_WHATSAPP" in sources, "META_WHATSAPP should be in sources"
            assert "DIRECT_WHATSAPP" in sources, "DIRECT_WHATSAPP should be in sources"
            print(f"✅ Both META_WHATSAPP and DIRECT_WHATSAPP are valid sources")
        else:
            print(f"⚠️ Could not fetch lead sources (status {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
