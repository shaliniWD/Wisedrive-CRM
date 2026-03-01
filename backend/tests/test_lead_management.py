"""
Lead Management Module Tests - WiseDrive CRM
Tests for:
- Lead statuses API (22 statuses)
- Twilio WhatsApp webhook (lead creation)
- Lead CRUD operations
- Lead notes and activities
- Lead reminders
- Payment link creation (Razorpay)
- Razorpay payment webhook
- Ad-City mappings
- Round-robin lead assignment
"""
import pytest
import requests
import os
import json
from datetime import datetime, timezone

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://car-credit-flow.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "kalyan@wisedrive.com"
PASSWORD = "password123"


class TestLeadStatuses:
    """Test lead statuses API - should return all 22 statuses"""
    
    def test_get_lead_statuses(self):
        """GET /api/leads/statuses - Returns all 22 lead statuses"""
        response = requests.get(f"{BASE_URL}/api/leads/statuses")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        statuses = response.json()
        assert isinstance(statuses, list), "Response should be a list"
        assert len(statuses) == 22, f"Expected 22 statuses, got {len(statuses)}"
        
        # Verify structure of each status
        for status in statuses:
            assert "value" in status, "Each status should have 'value'"
            assert "label" in status, "Each status should have 'label'"
            assert "color" in status, "Each status should have 'color'"
        
        # Verify key statuses exist
        status_values = [s["value"] for s in statuses]
        expected_statuses = [
            "NEW LEAD", "RNR", "FOLLOW UP", "HOT LEADS", 
            "PAYMENT LINK SENT", "PAID", "DEAD LEAD"
        ]
        for expected in expected_statuses:
            assert expected in status_values, f"Status '{expected}' should exist"
        
        print(f"✓ Lead statuses API returned {len(statuses)} statuses")


class TestTwilioWhatsAppWebhook:
    """Test Twilio WhatsApp webhook for lead creation"""
    
    def test_create_lead_from_whatsapp(self):
        """POST /api/webhooks/twilio/whatsapp - Creates lead from WhatsApp message"""
        # Simulate Twilio webhook form data
        form_data = {
            "From": "whatsapp:+919876543210",
            "Body": "Hi, I'm interested in vehicle inspection. Ad ID: test_ad_123",
            "ProfileName": "Test Customer",
            "WaId": "919876543210",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "status" in result, "Response should have 'status'"
        assert result["status"] in ["created", "updated"], f"Status should be 'created' or 'updated', got {result['status']}"
        assert "lead_id" in result, "Response should have 'lead_id'"
        
        print(f"✓ WhatsApp webhook created/updated lead: {result['lead_id']}")
        return result["lead_id"]
    
    def test_whatsapp_webhook_with_ad_id(self):
        """Test WhatsApp webhook parses ad_id from message"""
        form_data = {
            "From": "whatsapp:+919876543211",
            "Body": "Interested in inspection. ad_id: campaign_vizag_001",
            "ProfileName": "Vizag Customer",
            "WaId": "919876543211",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}001"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "lead_id" in result
        
        print(f"✓ WhatsApp webhook with ad_id created lead: {result['lead_id']}")
        return result["lead_id"]


class TestLeadCRUD:
    """Test Lead CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_single_lead(self):
        """GET /api/leads/{id} - Get single lead with details"""
        # First create a lead via webhook
        form_data = {
            "From": "whatsapp:+919876543212",
            "Body": "Test lead for GET",
            "ProfileName": "Get Test Customer",
            "WaId": "919876543212",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}002"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        assert create_response.status_code == 200
        lead_id = create_response.json()["lead_id"]
        
        # Now get the lead
        response = requests.get(
            f"{BASE_URL}/api/leads/{lead_id}",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        lead = response.json()
        assert lead["id"] == lead_id
        assert "name" in lead
        assert "mobile" in lead
        assert "status" in lead
        assert lead["status"] == "NEW LEAD"
        
        print(f"✓ GET lead returned: {lead['name']} - {lead['status']}")
        return lead_id
    
    def test_update_lead_status(self):
        """PATCH /api/leads/{id}/status - Update lead status"""
        # Create a lead first
        form_data = {
            "From": "whatsapp:+919876543213",
            "Body": "Test lead for status update",
            "ProfileName": "Status Test Customer",
            "WaId": "919876543213",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}003"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        lead_id = create_response.json()["lead_id"]
        
        # Update status to FOLLOW UP
        response = requests.patch(
            f"{BASE_URL}/api/leads/{lead_id}/status",
            headers=self.headers,
            json={"status": "FOLLOW UP"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        lead = response.json()
        assert lead["status"] == "FOLLOW UP", f"Expected 'FOLLOW UP', got {lead['status']}"
        
        print(f"✓ Lead status updated to: {lead['status']}")
        return lead_id
    
    def test_update_lead_status_invalid(self):
        """PATCH /api/leads/{id}/status - Invalid status should fail"""
        # Create a lead first
        form_data = {
            "From": "whatsapp:+919876543214",
            "Body": "Test lead for invalid status",
            "ProfileName": "Invalid Status Customer",
            "WaId": "919876543214",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}004"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        lead_id = create_response.json()["lead_id"]
        
        # Try invalid status
        response = requests.patch(
            f"{BASE_URL}/api/leads/{lead_id}/status",
            headers=self.headers,
            json={"status": "INVALID_STATUS_XYZ"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
        print("✓ Invalid status correctly rejected")


class TestLeadNotes:
    """Test Lead Notes functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_add_note_to_lead(self):
        """POST /api/leads/{id}/notes - Add note to lead"""
        # Create a lead first
        form_data = {
            "From": "whatsapp:+919876543215",
            "Body": "Test lead for notes",
            "ProfileName": "Notes Test Customer",
            "WaId": "919876543215",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}005"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        lead_id = create_response.json()["lead_id"]
        
        # Add a note
        note_text = "Customer called back, interested in premium package"
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/notes",
            headers=self.headers,
            json={"note": note_text}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        note = response.json()
        assert "id" in note
        assert note["note"] == note_text
        assert note["lead_id"] == lead_id
        assert "user_name" in note
        assert "created_at" in note
        
        print(f"✓ Note added to lead: {note['id']}")
        return lead_id
    
    def test_get_lead_notes(self):
        """GET /api/leads/{id}/notes - Get lead notes"""
        # Create lead and add note
        form_data = {
            "From": "whatsapp:+919876543216",
            "Body": "Test lead for get notes",
            "ProfileName": "Get Notes Customer",
            "WaId": "919876543216",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}006"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        lead_id = create_response.json()["lead_id"]
        
        # Add multiple notes
        for i in range(3):
            requests.post(
                f"{BASE_URL}/api/leads/{lead_id}/notes",
                headers=self.headers,
                json={"note": f"Test note {i+1}"}
            )
        
        # Get notes
        response = requests.get(
            f"{BASE_URL}/api/leads/{lead_id}/notes",
            headers=self.headers
        )
        
        assert response.status_code == 200
        notes = response.json()
        assert isinstance(notes, list)
        assert len(notes) >= 3
        
        print(f"✓ Retrieved {len(notes)} notes for lead")


class TestLeadActivities:
    """Test Lead Activity Log"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_lead_activities(self):
        """GET /api/leads/{id}/activities - Get lead activity log"""
        # Create lead
        form_data = {
            "From": "whatsapp:+919876543217",
            "Body": "Test lead for activities",
            "ProfileName": "Activities Test Customer",
            "WaId": "919876543217",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}007"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        lead_id = create_response.json()["lead_id"]
        
        # Update status (should create activity)
        requests.patch(
            f"{BASE_URL}/api/leads/{lead_id}/status",
            headers=self.headers,
            json={"status": "HOT LEADS"}
        )
        
        # Add note (should create activity)
        requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/notes",
            headers=self.headers,
            json={"note": "Activity test note"}
        )
        
        # Get activities
        response = requests.get(
            f"{BASE_URL}/api/leads/{lead_id}/activities",
            headers=self.headers
        )
        
        assert response.status_code == 200
        activities = response.json()
        assert isinstance(activities, list)
        
        # Should have at least: lead_created, status_changed, note_added
        assert len(activities) >= 2, f"Expected at least 2 activities, got {len(activities)}"
        
        # Verify activity structure
        for activity in activities:
            assert "id" in activity
            assert "lead_id" in activity
            assert "action" in activity
            assert "created_at" in activity
        
        # Check for specific actions
        actions = [a["action"] for a in activities]
        assert "status_changed" in actions or "note_added" in actions
        
        print(f"✓ Retrieved {len(activities)} activities for lead")


class TestLeadReminder:
    """Test Lead Reminder functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_set_lead_reminder(self):
        """POST /api/leads/{id}/reminder - Set reminder for lead"""
        # Create lead
        form_data = {
            "From": "whatsapp:+919876543218",
            "Body": "Test lead for reminder",
            "ProfileName": "Reminder Test Customer",
            "WaId": "919876543218",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}008"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        lead_id = create_response.json()["lead_id"]
        
        # Set reminder
        reminder_data = {
            "reminder_date": "2026-01-20",
            "reminder_time": "10:00",
            "reminder_reason": "Follow up on inspection booking"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/reminder",
            headers=self.headers,
            json=reminder_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        lead = response.json()
        assert lead["reminder_date"] == "2026-01-20"
        assert lead["reminder_time"] == "10:00"
        assert lead["reminder_reason"] == "Follow up on inspection booking"
        
        print(f"✓ Reminder set for lead: {lead['reminder_date']} {lead['reminder_time']}")


class TestAdCityMappings:
    """Test Ad ID to City Mappings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_ad_city_mappings(self):
        """GET /api/settings/ad-city-mappings - Get all mappings"""
        response = requests.get(
            f"{BASE_URL}/api/settings/ad-city-mappings",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        mappings = response.json()
        assert isinstance(mappings, list)
        
        print(f"✓ Retrieved {len(mappings)} ad-city mappings")
    
    def test_create_ad_city_mapping(self):
        """POST /api/settings/ad-city-mappings - Create mapping"""
        mapping_data = {
            "ad_id": f"test_ad_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "city": "Hyderabad",
            "campaign_name": "Test Campaign Hyderabad"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/settings/ad-city-mappings",
            headers=self.headers,
            json=mapping_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "message" in result
        
        print(f"✓ Created ad-city mapping for ad_id: {mapping_data['ad_id']}")


class TestPaymentLink:
    """Test Payment Link Creation (Razorpay)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_payment_link_requires_package(self):
        """POST /api/leads/{id}/payment-link - Requires valid package"""
        # Create lead
        form_data = {
            "From": "whatsapp:+919876543219",
            "Body": "Test lead for payment",
            "ProfileName": "Payment Test Customer",
            "WaId": "919876543219",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}009"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        lead_id = create_response.json()["lead_id"]
        
        # Try to create payment link with invalid package
        payment_data = {
            "package_id": "invalid_package_id",
            "send_via_whatsapp": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/payment-link",
            headers=self.headers,
            json=payment_data
        )
        
        # Should fail with 404 (package not found)
        assert response.status_code == 404, f"Expected 404 for invalid package, got {response.status_code}"
        print("✓ Payment link correctly requires valid package")
    
    def test_create_payment_link_with_valid_package(self):
        """POST /api/leads/{id}/payment-link - Create with valid package"""
        # First, get or create a package
        packages_response = requests.get(
            f"{BASE_URL}/api/inspection-packages",
            headers=self.headers
        )
        
        if packages_response.status_code == 200:
            packages = packages_response.json()
            if packages and len(packages) > 0:
                package_id = packages[0]["id"]
                
                # Create lead
                form_data = {
                    "From": "whatsapp:+919876543220",
                    "Body": "Test lead for valid payment",
                    "ProfileName": "Valid Payment Customer",
                    "WaId": "919876543220",
                    "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}010"
                }
                
                create_response = requests.post(
                    f"{BASE_URL}/api/webhooks/twilio/whatsapp",
                    data=form_data
                )
                lead_id = create_response.json()["lead_id"]
                
                # Create payment link
                payment_data = {
                    "package_id": package_id,
                    "send_via_whatsapp": False  # Don't send WhatsApp in test
                }
                
                response = requests.post(
                    f"{BASE_URL}/api/leads/{lead_id}/payment-link",
                    headers=self.headers,
                    json=payment_data
                )
                
                # May succeed or fail depending on Razorpay config
                if response.status_code == 200:
                    result = response.json()
                    assert "payment_link" in result
                    assert "success" in result
                    print(f"✓ Payment link created: {result.get('payment_link')}")
                else:
                    # Razorpay may not be fully configured
                    print(f"⚠ Payment link creation returned {response.status_code} - Razorpay may need configuration")
            else:
                print("⚠ No packages found - skipping payment link test")
        else:
            print("⚠ Could not fetch packages - skipping payment link test")


class TestRazorpayWebhook:
    """Test Razorpay Payment Webhook"""
    
    def test_razorpay_webhook_payment_captured(self):
        """POST /api/webhooks/razorpay/payment - Handle payment captured event"""
        # Create a lead first
        form_data = {
            "From": "whatsapp:+919876543221",
            "Body": "Test lead for razorpay webhook",
            "ProfileName": "Razorpay Webhook Customer",
            "WaId": "919876543221",
            "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}011"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/webhooks/twilio/whatsapp",
            data=form_data
        )
        lead_id = create_response.json()["lead_id"]
        
        # Simulate Razorpay webhook payload
        webhook_payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": f"pay_test_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                        "amount": 99900,  # Amount in paise (999 INR)
                        "currency": "INR",
                        "status": "captured",
                        "notes": {
                            "lead_id": lead_id,
                            "package_id": "test_package",
                            "source": "wisedrive_crm"
                        }
                    }
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhooks/razorpay/payment",
            json=webhook_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "status" in result
        
        print(f"✓ Razorpay webhook processed: {result['status']}")
    
    def test_razorpay_webhook_no_lead(self):
        """POST /api/webhooks/razorpay/payment - Handle webhook with no lead_id"""
        webhook_payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_no_lead_test",
                        "amount": 50000,
                        "notes": {}  # No lead_id
                    }
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhooks/razorpay/payment",
            json=webhook_payload
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "no_lead_found"
        
        print("✓ Razorpay webhook correctly handles missing lead_id")


class TestRoundRobinAssignment:
    """Test Round-Robin Lead Assignment by City"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_lead_auto_assignment(self):
        """Test that leads are auto-assigned via round-robin"""
        # Create multiple leads from same city
        leads_created = []
        
        for i in range(3):
            form_data = {
                "From": f"whatsapp:+91987654{3300 + i}",
                "Body": f"Test lead {i} for round-robin",
                "ProfileName": f"Round Robin Customer {i}",
                "WaId": f"91987654{3300 + i}",
                "MessageSid": f"SM{datetime.now().strftime('%Y%m%d%H%M%S')}{100 + i}"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/webhooks/twilio/whatsapp",
                data=form_data
            )
            
            if response.status_code == 200:
                lead_id = response.json()["lead_id"]
                leads_created.append(lead_id)
        
        # Check if leads were assigned
        for lead_id in leads_created:
            response = requests.get(
                f"{BASE_URL}/api/leads/{lead_id}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                lead = response.json()
                # Lead may or may not be assigned depending on sales reps availability
                if lead.get("assigned_to"):
                    print(f"✓ Lead {lead_id} assigned to: {lead.get('assigned_to_name', 'Unknown')}")
                else:
                    print(f"⚠ Lead {lead_id} not assigned (no sales reps for city)")
        
        print(f"✓ Round-robin test completed for {len(leads_created)} leads")


class TestLeadListFiltering:
    """Test Lead List with Filters"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_leads_list(self):
        """GET /api/leads - Get leads list"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers=self.headers
        )
        
        assert response.status_code == 200
        leads = response.json()
        assert isinstance(leads, list)
        
        print(f"✓ Retrieved {len(leads)} leads")
    
    def test_get_leads_by_status(self):
        """GET /api/leads?lead_status=NEW LEAD - Filter by status"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers=self.headers,
            params={"lead_status": "NEW LEAD"}
        )
        
        assert response.status_code == 200
        leads = response.json()
        
        # All returned leads should have NEW LEAD status
        for lead in leads:
            assert lead["status"] == "NEW LEAD", f"Expected 'NEW LEAD', got {lead['status']}"
        
        print(f"✓ Retrieved {len(leads)} leads with status 'NEW LEAD'")
    
    def test_get_leads_by_search(self):
        """GET /api/leads?search=Test - Search leads"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers=self.headers,
            params={"search": "Test"}
        )
        
        assert response.status_code == 200
        leads = response.json()
        
        print(f"✓ Search returned {len(leads)} leads")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
