"""
Test Notification Configuration API
Tests for CRM notification config endpoints at /api/notification-config/*
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://wise-drive-hub.preview.emergentagent.com')


class TestNotificationConfigAPI:
    """Test notification configuration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as HR user to get token"""
        # Login as HR user
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "hr@wisedrive.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.user = login_response.json()["user"]
    
    def test_get_triggers(self):
        """Test GET /api/notification-config/triggers"""
        response = requests.get(
            f"{BASE_URL}/api/notification-config/triggers",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        triggers = response.json()
        assert isinstance(triggers, list), "Response should be a list"
        assert len(triggers) > 0, "Should have at least one trigger"
        
        # Verify trigger structure
        trigger = triggers[0]
        assert "id" in trigger, "Trigger should have id"
        assert "event_type" in trigger, "Trigger should have event_type"
        assert "is_enabled" in trigger, "Trigger should have is_enabled"
        assert "send_push" in trigger, "Trigger should have send_push"
        assert "send_in_app" in trigger, "Trigger should have send_in_app"
        
        print(f"SUCCESS: Found {len(triggers)} triggers")
    
    def test_get_templates(self):
        """Test GET /api/notification-config/templates"""
        response = requests.get(
            f"{BASE_URL}/api/notification-config/templates",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Response should be a list"
        assert len(templates) > 0, "Should have at least one template"
        
        # Verify template structure
        template = templates[0]
        assert "id" in template, "Template should have id"
        assert "event_type" in template, "Template should have event_type"
        assert "title_template" in template, "Template should have title_template"
        assert "body_template" in template, "Template should have body_template"
        
        print(f"SUCCESS: Found {len(templates)} templates")
    
    def test_get_stats(self):
        """Test GET /api/notification-config/stats"""
        response = requests.get(
            f"{BASE_URL}/api/notification-config/stats",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        stats = response.json()
        assert "period_days" in stats, "Stats should have period_days"
        assert "notifications_by_type" in stats, "Stats should have notifications_by_type"
        assert "fcm_delivery_status" in stats, "Stats should have fcm_delivery_status"
        assert "registered_devices" in stats, "Stats should have registered_devices"
        
        print(f"SUCCESS: Stats - {stats['registered_devices']} registered devices")
    
    def test_update_trigger(self):
        """Test PUT /api/notification-config/triggers/{id}"""
        # First get triggers to get an ID
        triggers_response = requests.get(
            f"{BASE_URL}/api/notification-config/triggers",
            headers=self.headers
        )
        triggers = triggers_response.json()
        trigger_id = triggers[0]["id"]
        original_enabled = triggers[0]["is_enabled"]
        
        # Update trigger
        update_response = requests.put(
            f"{BASE_URL}/api/notification-config/triggers/{trigger_id}",
            headers=self.headers,
            json={"is_enabled": not original_enabled}
        )
        assert update_response.status_code == 200, f"Failed: {update_response.text}"
        
        updated = update_response.json()
        assert updated["is_enabled"] == (not original_enabled), "is_enabled should be toggled"
        
        # Revert the change
        revert_response = requests.put(
            f"{BASE_URL}/api/notification-config/triggers/{trigger_id}",
            headers=self.headers,
            json={"is_enabled": original_enabled}
        )
        assert revert_response.status_code == 200
        
        print(f"SUCCESS: Updated and reverted trigger {trigger_id}")
    
    def test_send_announcement(self):
        """Test POST /api/notification-config/send-announcement"""
        response = requests.post(
            f"{BASE_URL}/api/notification-config/send-announcement",
            headers=self.headers,
            params={
                "title": "TEST_Announcement",
                "message": "This is a test announcement from automated testing"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert "message" in result, "Response should have message"
        assert "recipients_count" in result, "Response should have recipients_count"
        assert result["recipients_count"] >= 0, "Recipients count should be >= 0"
        
        print(f"SUCCESS: Announcement sent to {result['recipients_count']} recipients")
    
    def test_unauthorized_access(self):
        """Test that endpoints require authentication"""
        # Test without token
        response = requests.get(f"{BASE_URL}/api/notification-config/stats")
        assert response.status_code == 401, "Should require authentication"
        
        print("SUCCESS: Unauthorized access properly rejected")
    
    def test_non_hr_access_denied(self):
        """Test that non-HR users cannot access notification config"""
        # Login as a non-HR user (sales exec)
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "salesexec1.in@wisedrive.com", "password": "password123"}
        )
        
        if login_response.status_code == 200:
            non_hr_token = login_response.json()["access_token"]
            non_hr_headers = {
                "Authorization": f"Bearer {non_hr_token}",
                "Content-Type": "application/json"
            }
            
            # Try to access stats (requires HR role)
            response = requests.get(
                f"{BASE_URL}/api/notification-config/stats",
                headers=non_hr_headers
            )
            assert response.status_code == 403, f"Non-HR user should be denied access, got {response.status_code}"
            print("SUCCESS: Non-HR access properly denied")
        else:
            pytest.skip("Could not login as non-HR user")


class TestESSHealthCheck:
    """Test ESS API health check"""
    
    def test_ess_health(self):
        """Test GET /ess/v1/health"""
        response = requests.get("http://localhost:8002/ess/v1/health")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "healthy", "ESS should be healthy"
        print(f"SUCCESS: ESS API is healthy - {data}")
    
    def test_ess_auth_login(self):
        """Test POST /ess/v1/auth/login"""
        response = requests.post(
            "http://localhost:8002/ess/v1/auth/login",
            json={
                "email": "hr@wisedrive.com",
                "password": "password123",
                "device": {
                    "device_id": "test-device-001",
                    "device_name": "Test Device",
                    "platform": "android",
                    "app_version": "1.0.0"
                }
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Should have access_token"
        assert "user" in data, "Should have user info"
        print(f"SUCCESS: ESS login works - user: {data['user']['name']}")


class TestMainCRMAPI:
    """Test main CRM API is still working"""
    
    def test_crm_root(self):
        """Test GET /api/"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Should have message"
        assert "WiseDrive" in data["message"], "Should be WiseDrive CRM"
        print(f"SUCCESS: Main CRM API working - {data['message']}")
    
    def test_crm_login(self):
        """Test POST /api/auth/login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "hr@wisedrive.com", "password": "password123"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Should have access_token"
        print(f"SUCCESS: CRM login works - user: {data['user']['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
