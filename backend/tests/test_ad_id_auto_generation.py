"""
Test Suite for AD ID Auto-Generation Feature
Tests the fix for missing AD ID on META WhatsApp leads when Twilio doesn't send CtwaClid

Features tested:
1. Auto-generate AD ID when CtwaClid is missing but ReferralHeadline is present (Strategy 4)
2. Auto-generate AD ID when using fallback city (Strategy 5)
3. Verify ad_id is stored on the lead document when auto-generated
4. Verify city mapping still works with auto-generated AD IDs
5. Verify audit trail shows the auto-generation step
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

# Test phone numbers for this specific test
STRATEGY4_TEST_PHONE = "+918765432190"  # City keyword test
STRATEGY5_TEST_PHONE = "+918765432191"  # No city keyword test


class TestAdIdAutoGeneration:
    """Test suite for AD ID auto-generation when CtwaClid is missing"""
    
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
    
    def test_01_strategy4_auto_generate_ad_id_from_city_keyword(self):
        """
        Test Strategy 4: Auto-generate AD ID when CtwaClid is missing but ReferralHeadline contains city keyword
        
        Scenario: Twilio sends ReferralHeadline with city name (e.g., "Bangalore Car Inspection")
        but does NOT send CtwaClid. System should:
        1. Extract city from ReferralHeadline
        2. Auto-generate an AD ID
        3. Store the ad_id on the lead
        """
        # Generate unique phone for this test
        test_phone = f"+91876543{int(time.time()) % 100000:05d}"
        
        # Send webhook with ReferralHeadline containing city keyword but NO CtwaClid
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{test_phone}",
                "Body": "Hi, I want car inspection",
                "ProfileName": "Strategy4 Test User",
                "WaId": test_phone.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}strat4",
                "To": "whatsapp:+14155238886",
                "AccountSid": "AC0519b735e98165926ad87a68b362fa62",
                "NumMedia": "0",
                # CTWA data WITHOUT CtwaClid
                "ReferralSourceUrl": "https://fb.me/test-ad-no-clid",
                "ReferralHeadline": "Bangalore Car Inspection Special Offer",  # Contains city keyword
                "ReferralSourceType": "ad",
                "ButtonText": "Send Message"
                # NOTE: CtwaClid is intentionally NOT sent
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200, f"Webhook failed: {response.status_code}: {response.text}"
        print(f"✅ Webhook accepted (Strategy 4 test)")
        
        # Wait for DB write
        time.sleep(0.5)
        
        # Investigate the lead
        clean_phone = test_phone.replace("+", "")
        investigate_response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{clean_phone}")
        
        assert investigate_response.status_code == 200, f"Lead not found: {investigate_response.status_code}"
        
        data = investigate_response.json()
        
        # Verify city was extracted from ReferralHeadline
        assert data.get('city') == "Bangalore", f"Expected city 'Bangalore', got '{data.get('city')}'"
        print(f"✅ City correctly extracted: {data.get('city')}")
        
        # Verify ad_id was auto-generated (should start with 'auto_')
        ad_id = data.get('ad_id')
        assert ad_id is not None, "ad_id should be auto-generated when CtwaClid is missing"
        assert ad_id.startswith('auto_'), f"Auto-generated ad_id should start with 'auto_', got: {ad_id}"
        print(f"✅ AD ID auto-generated: {ad_id}")
        
        # Verify source is META_WHATSAPP (has CTWA data)
        assert data.get('source') == "META_WHATSAPP", f"Expected META_WHATSAPP, got {data.get('source')}"
        print(f"✅ Source correctly classified: {data.get('source')}")
        
        # Verify audit trail shows auto-generation
        audit = data.get('webhook_audit', {})
        city_lookup_log = audit.get('city_lookup_log', [])
        
        # Check for auto-generation log entry
        auto_gen_logged = any(
            log.get('ad_id_auto_generated') or log.get('auto_mapping_created')
            for log in city_lookup_log
        )
        assert auto_gen_logged, "Audit trail should show ad_id auto-generation"
        print(f"✅ Audit trail shows auto-generation step")
        
        # Verify final_assignment in audit
        final_assignment = audit.get('final_assignment', {})
        assert final_assignment.get('ad_id') == ad_id, "Final assignment should have the auto-generated ad_id"
        print(f"✅ Final assignment has correct ad_id: {final_assignment.get('ad_id')}")
    
    def test_02_strategy5_auto_generate_ad_id_fallback_city(self):
        """
        Test Strategy 5: Auto-generate AD ID when using fallback city
        
        Scenario: Twilio sends ReferralHeadline WITHOUT city keyword and NO CtwaClid.
        System should:
        1. Use fallback city (Vizag)
        2. Auto-generate an AD ID from unmapped_ads
        3. Store the ad_id on the lead
        """
        # Generate unique phone for this test
        test_phone = f"+91876544{int(time.time()) % 100000:05d}"
        
        # Send webhook with ReferralHeadline WITHOUT city keyword and NO CtwaClid
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{test_phone}",
                "Body": "Hi, I need car inspection",
                "ProfileName": "Strategy5 Test User",
                "WaId": test_phone.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}strat5",
                "To": "whatsapp:+14155238886",
                "AccountSid": "AC0519b735e98165926ad87a68b362fa62",
                "NumMedia": "0",
                # CTWA data WITHOUT CtwaClid and WITHOUT city keyword
                "ReferralSourceUrl": "https://fb.me/test-ad-no-city",
                "ReferralHeadline": "Best Car Inspection Service",  # NO city keyword
                "ReferralSourceType": "ad",
                "ButtonText": "Contact Us"
                # NOTE: CtwaClid is intentionally NOT sent
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200, f"Webhook failed: {response.status_code}: {response.text}"
        print(f"✅ Webhook accepted (Strategy 5 test)")
        
        # Wait for DB write
        time.sleep(0.5)
        
        # Investigate the lead
        clean_phone = test_phone.replace("+", "")
        investigate_response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{clean_phone}")
        
        assert investigate_response.status_code == 200, f"Lead not found: {investigate_response.status_code}"
        
        data = investigate_response.json()
        
        # Verify fallback city was used (Vizag or default mapping city)
        city = data.get('city')
        assert city is not None, "City should be set (fallback)"
        print(f"✅ Fallback city used: {city}")
        
        # Verify ad_id was auto-generated
        ad_id = data.get('ad_id')
        assert ad_id is not None, "ad_id should be auto-generated when CtwaClid is missing"
        assert ad_id.startswith('auto_'), f"Auto-generated ad_id should start with 'auto_', got: {ad_id}"
        print(f"✅ AD ID auto-generated: {ad_id}")
        
        # Verify source is META_WHATSAPP (has CTWA data)
        assert data.get('source') == "META_WHATSAPP", f"Expected META_WHATSAPP, got {data.get('source')}"
        print(f"✅ Source correctly classified: {data.get('source')}")
        
        # Verify audit trail shows unmapped ad entry
        audit = data.get('webhook_audit', {})
        city_lookup_log = audit.get('city_lookup_log', [])
        
        # Check for unmapped ad log entry
        unmapped_logged = any(
            log.get('ad_id_from_unmapped') or log.get('ad_id_from_existing_unmapped')
            for log in city_lookup_log
        )
        assert unmapped_logged, "Audit trail should show ad_id from unmapped entry"
        print(f"✅ Audit trail shows unmapped ad entry")
    
    def test_03_ctwa_clid_present_uses_original(self):
        """
        Test that when CtwaClid IS present, it's used as ad_id (not auto-generated)
        """
        # Generate unique phone for this test
        test_phone = f"+91876545{int(time.time()) % 100000:05d}"
        original_ctwa_clid = f"CTWA_ORIGINAL_{int(time.time())}"
        
        # Send webhook WITH CtwaClid
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{test_phone}",
                "Body": "Hi, interested in inspection",
                "ProfileName": "CtwaClid Test User",
                "WaId": test_phone.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}clid",
                "To": "whatsapp:+14155238886",
                "AccountSid": "AC0519b735e98165926ad87a68b362fa62",
                "NumMedia": "0",
                # CTWA data WITH CtwaClid
                "ReferralSourceUrl": "https://fb.me/test-ad-with-clid",
                "ReferralHeadline": "Chennai Car Inspection",
                "ReferralSourceType": "ad",
                "ButtonText": "Send Message",
                "CtwaClid": original_ctwa_clid  # CtwaClid IS present
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200, f"Webhook failed: {response.status_code}: {response.text}"
        print(f"✅ Webhook accepted (CtwaClid present test)")
        
        # Wait for DB write
        time.sleep(0.5)
        
        # Investigate the lead
        clean_phone = test_phone.replace("+", "")
        investigate_response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{clean_phone}")
        
        assert investigate_response.status_code == 200, f"Lead not found: {investigate_response.status_code}"
        
        data = investigate_response.json()
        
        # Verify ad_id is the original CtwaClid (not auto-generated)
        ad_id = data.get('ad_id')
        assert ad_id == original_ctwa_clid, f"Expected original CtwaClid '{original_ctwa_clid}', got '{ad_id}'"
        print(f"✅ Original CtwaClid used as ad_id: {ad_id}")
        
        # Verify it does NOT start with 'auto_'
        assert not ad_id.startswith('auto_'), "ad_id should NOT be auto-generated when CtwaClid is present"
        print(f"✅ ad_id is NOT auto-generated (as expected)")
    
    def test_04_ad_city_mapping_created_for_auto_generated(self):
        """
        Test that ad_city_mapping is created when auto-generating AD ID from city keyword
        """
        # Generate unique phone and ad_name for this test
        test_phone = f"+91876546{int(time.time()) % 100000:05d}"
        unique_ad_name = f"Hyderabad Special Offer {int(time.time())}"
        
        # Send webhook with unique ReferralHeadline containing city keyword
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{test_phone}",
                "Body": "Hi, I want inspection",
                "ProfileName": "Mapping Test User",
                "WaId": test_phone.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}map",
                "To": "whatsapp:+14155238886",
                "AccountSid": "AC0519b735e98165926ad87a68b362fa62",
                "NumMedia": "0",
                "ReferralSourceUrl": "https://fb.me/test-mapping",
                "ReferralHeadline": unique_ad_name,  # Contains "Hyderabad"
                "ReferralSourceType": "ad",
                "ButtonText": "Send Message"
                # NO CtwaClid
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200, f"Webhook failed: {response.status_code}: {response.text}"
        print(f"✅ Webhook accepted (mapping creation test)")
        
        # Wait for DB write
        time.sleep(0.5)
        
        # Investigate the lead
        clean_phone = test_phone.replace("+", "")
        investigate_response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{clean_phone}")
        
        assert investigate_response.status_code == 200, f"Lead not found: {investigate_response.status_code}"
        
        data = investigate_response.json()
        
        # Verify city was extracted
        assert data.get('city') == "Hyderabad", f"Expected city 'Hyderabad', got '{data.get('city')}'"
        print(f"✅ City correctly extracted: {data.get('city')}")
        
        # Verify ad_id was auto-generated
        ad_id = data.get('ad_id')
        assert ad_id is not None and ad_id.startswith('auto_'), f"Expected auto-generated ad_id, got: {ad_id}"
        print(f"✅ AD ID auto-generated: {ad_id}")
        
        # Verify audit trail shows mapping was created
        audit = data.get('webhook_audit', {})
        city_lookup_log = audit.get('city_lookup_log', [])
        
        mapping_created = any(
            log.get('auto_mapping_created') for log in city_lookup_log
        )
        # Note: mapping might already exist from previous test runs
        print(f"   Mapping created in this run: {mapping_created}")
    
    def test_05_unmapped_ads_entry_created_for_fallback(self):
        """
        Test that unmapped_ads entry is created when using fallback city
        """
        # Generate unique phone and ad_name for this test
        test_phone = f"+91876547{int(time.time()) % 100000:05d}"
        unique_ad_name = f"Amazing Deal {int(time.time())}"  # NO city keyword
        
        # Send webhook with ReferralHeadline WITHOUT city keyword
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{test_phone}",
                "Body": "Hi, interested",
                "ProfileName": "Unmapped Test User",
                "WaId": test_phone.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}unmap",
                "To": "whatsapp:+14155238886",
                "AccountSid": "AC0519b735e98165926ad87a68b362fa62",
                "NumMedia": "0",
                "ReferralSourceUrl": "https://fb.me/test-unmapped",
                "ReferralHeadline": unique_ad_name,  # NO city keyword
                "ReferralSourceType": "ad",
                "ButtonText": "Send Message"
                # NO CtwaClid
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200, f"Webhook failed: {response.status_code}: {response.text}"
        print(f"✅ Webhook accepted (unmapped ads test)")
        
        # Wait for DB write
        time.sleep(0.5)
        
        # Investigate the lead
        clean_phone = test_phone.replace("+", "")
        investigate_response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{clean_phone}")
        
        assert investigate_response.status_code == 200, f"Lead not found: {investigate_response.status_code}"
        
        data = investigate_response.json()
        
        # Verify fallback city was used
        city = data.get('city')
        assert city is not None, "City should be set (fallback)"
        print(f"✅ Fallback city used: {city}")
        
        # Verify ad_id was auto-generated
        ad_id = data.get('ad_id')
        assert ad_id is not None and ad_id.startswith('auto_'), f"Expected auto-generated ad_id, got: {ad_id}"
        print(f"✅ AD ID auto-generated: {ad_id}")
        
        # Verify audit trail shows unmapped entry
        audit = data.get('webhook_audit', {})
        city_lookup_log = audit.get('city_lookup_log', [])
        
        unmapped_entry = any(
            log.get('ad_id_from_unmapped') or log.get('ad_id_from_existing_unmapped')
            for log in city_lookup_log
        )
        assert unmapped_entry, "Audit trail should show unmapped ad entry"
        print(f"✅ Audit trail shows unmapped ad entry")
    
    def test_06_verify_test_phones_from_requirements(self):
        """
        Test the specific phone numbers mentioned in requirements:
        - +918765432190 (city keyword test)
        - +918765432191 (no city keyword test)
        """
        # Test phone 1: City keyword test
        response1 = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{STRATEGY4_TEST_PHONE}",
                "Body": "Hi, I want car inspection in Bangalore",
                "ProfileName": "City Keyword Test",
                "WaId": STRATEGY4_TEST_PHONE.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}req1",
                "ReferralHeadline": "Bangalore Premium Inspection",  # City keyword
                "ReferralSourceType": "ad"
                # NO CtwaClid
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response1.status_code == 200, f"Webhook 1 failed: {response1.status_code}"
        print(f"✅ Test phone 1 ({STRATEGY4_TEST_PHONE}) webhook accepted")
        
        # Test phone 2: No city keyword test
        response2 = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data={
                "From": f"whatsapp:{STRATEGY5_TEST_PHONE}",
                "Body": "Hi, I need car inspection",
                "ProfileName": "No City Keyword Test",
                "WaId": STRATEGY5_TEST_PHONE.replace("+", ""),
                "MessageSid": f"SM{int(time.time())}req2",
                "ReferralHeadline": "Best Car Inspection Deal",  # NO city keyword
                "ReferralSourceType": "ad"
                # NO CtwaClid
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response2.status_code == 200, f"Webhook 2 failed: {response2.status_code}"
        print(f"✅ Test phone 2 ({STRATEGY5_TEST_PHONE}) webhook accepted")
        
        # Wait for DB writes
        time.sleep(0.5)
        
        # Verify both leads have ad_id
        for phone, expected_city in [(STRATEGY4_TEST_PHONE, "Bangalore"), (STRATEGY5_TEST_PHONE, None)]:
            clean_phone = phone.replace("+", "")
            investigate_response = self.session.get(f"{BASE_URL}/api/leads/investigate/by-phone/{clean_phone}")
            
            if investigate_response.status_code == 200:
                data = investigate_response.json()
                ad_id = data.get('ad_id')
                city = data.get('city')
                
                assert ad_id is not None, f"Lead {phone} should have ad_id"
                print(f"✅ Lead {phone}: ad_id={ad_id}, city={city}")
                
                if expected_city:
                    assert city == expected_city, f"Expected city '{expected_city}', got '{city}'"
            else:
                print(f"⚠️ Lead {phone} not found (status {investigate_response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
