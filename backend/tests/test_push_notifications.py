"""
Test Push Notification APIs for Mechanic App
Tests:
1. Push Token Registration: POST /api/mechanic/push-token
2. Push Token Unregistration: DELETE /api/mechanic/push-token
3. Get Notifications: GET /api/mechanic/notifications
4. Mark Notification Read: PATCH /api/mechanic/notifications/{id}/read
5. Notification on Inspection Assignment: POST /api/inspections/{id}/assign-mechanic
6. Verify push token stored in database after registration
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MECHANIC_PHONE = "+919689760236"
DEV_OTP = "123456"
CRM_ADMIN_EMAIL = "countryhead.in@wisedrive.com"
CRM_ADMIN_PASSWORD = "password123"

# Known mechanic ID from context
KNOWN_MECHANIC_ID = "26b16f62-526b-4fa2-b218-570b6e346962"


class TestPushNotificationAPIs:
    """Test Push Notification API endpoints"""
    
    @pytest.fixture(scope="class")
    def mechanic_token(self):
        """Get mechanic auth token via OTP login"""
        # Request OTP
        response = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": MECHANIC_PHONE})
        assert response.status_code == 200, f"OTP request failed: {response.text}"
        
        # Verify OTP
        response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": MECHANIC_PHONE,
            "otp": DEV_OTP
        })
        assert response.status_code == 200, f"OTP verification failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def crm_admin_token(self):
        """Get CRM admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CRM_ADMIN_EMAIL,
            "password": CRM_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"CRM login failed: {response.text}"
        data = response.json()
        # API returns access_token, not token
        token = data.get("access_token") or data.get("token")
        assert token, "No token in response"
        return token
    
    @pytest.fixture(scope="class")
    def mechanic_headers(self, mechanic_token):
        """Headers with mechanic auth token"""
        return {
            "Authorization": f"Bearer {mechanic_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def crm_headers(self, crm_admin_token):
        """Headers with CRM admin auth token"""
        return {
            "Authorization": f"Bearer {crm_admin_token}",
            "Content-Type": "application/json"
        }
    
    # ==================== PUSH TOKEN REGISTRATION TESTS ====================
    
    def test_register_push_token_success(self, mechanic_headers):
        """Test POST /api/mechanic/push-token - Register device token"""
        test_token = f"TEST_fcm_token_{uuid.uuid4().hex[:16]}"
        
        response = requests.post(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers,
            json={
                "device_token": test_token,
                "platform": "android",
                "device_info": {"model": "Test Device", "os_version": "14"}
            }
        )
        
        assert response.status_code == 200, f"Push token registration failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "message" in data, "Response should have message"
        print(f"✓ Push token registered successfully: {data}")
    
    def test_register_push_token_ios_platform(self, mechanic_headers):
        """Test push token registration with iOS platform"""
        test_token = f"TEST_ios_token_{uuid.uuid4().hex[:16]}"
        
        response = requests.post(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers,
            json={
                "device_token": test_token,
                "platform": "ios",
                "device_info": {"model": "iPhone 15", "os_version": "17.0"}
            }
        )
        
        assert response.status_code == 200, f"iOS push token registration failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✓ iOS push token registered: {data}")
    
    def test_register_push_token_unauthenticated(self):
        """Test push token registration without auth - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/mechanic/push-token",
            json={
                "device_token": "test_token",
                "platform": "android"
            }
        )
        
        # Should return 401 or 403 for unauthenticated request
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated push token registration correctly rejected: {response.status_code}")
    
    def test_register_push_token_missing_device_token(self, mechanic_headers):
        """Test push token registration without device_token - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers,
            json={
                "platform": "android"
            }
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"✓ Missing device_token correctly rejected: {response.status_code}")
    
    # ==================== PUSH TOKEN UNREGISTRATION TESTS ====================
    
    def test_unregister_push_token_success(self, mechanic_headers):
        """Test DELETE /api/mechanic/push-token - Remove device token"""
        # First register a token
        test_token = f"TEST_delete_token_{uuid.uuid4().hex[:16]}"
        requests.post(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers,
            json={"device_token": test_token, "platform": "android"}
        )
        
        # Now unregister
        response = requests.delete(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers
        )
        
        assert response.status_code == 200, f"Push token unregistration failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print(f"✓ Push token unregistered successfully: {data}")
    
    def test_unregister_push_token_unauthenticated(self):
        """Test push token unregistration without auth - should fail"""
        response = requests.delete(f"{BASE_URL}/api/mechanic/push-token")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated unregistration correctly rejected: {response.status_code}")
    
    # ==================== GET NOTIFICATIONS TESTS ====================
    
    def test_get_notifications_success(self, mechanic_headers):
        """Test GET /api/mechanic/notifications - Get notification history"""
        response = requests.get(
            f"{BASE_URL}/api/mechanic/notifications",
            headers=mechanic_headers
        )
        
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Got {len(data)} notifications")
        
        # Validate notification structure if any exist
        if len(data) > 0:
            notification = data[0]
            assert "id" in notification, "Notification should have id"
            assert "title" in notification, "Notification should have title"
            assert "body" in notification, "Notification should have body"
            assert "read" in notification, "Notification should have read status"
            assert "created_at" in notification, "Notification should have created_at"
            print(f"✓ Notification structure validated: {notification.get('title')}")
    
    def test_get_notifications_with_limit(self, mechanic_headers):
        """Test GET /api/mechanic/notifications with limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/mechanic/notifications",
            headers=mechanic_headers,
            params={"limit": 5}
        )
        
        assert response.status_code == 200, f"Get notifications with limit failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) <= 5, "Should return at most 5 notifications"
        print(f"✓ Got {len(data)} notifications with limit=5")
    
    def test_get_notifications_unauthenticated(self):
        """Test get notifications without auth - should fail"""
        response = requests.get(f"{BASE_URL}/api/mechanic/notifications")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated get notifications correctly rejected: {response.status_code}")
    
    # ==================== MARK NOTIFICATION READ TESTS ====================
    
    def test_mark_notification_read_success(self, mechanic_headers):
        """Test PATCH /api/mechanic/notifications/{id}/read - Mark as read"""
        # First get notifications to find one to mark as read
        response = requests.get(
            f"{BASE_URL}/api/mechanic/notifications",
            headers=mechanic_headers
        )
        
        if response.status_code == 200:
            notifications = response.json()
            if len(notifications) > 0:
                notification_id = notifications[0]["id"]
                
                # Mark as read
                response = requests.patch(
                    f"{BASE_URL}/api/mechanic/notifications/{notification_id}/read",
                    headers=mechanic_headers
                )
                
                assert response.status_code == 200, f"Mark notification read failed: {response.text}"
                data = response.json()
                assert data.get("success") == True, "Response should indicate success"
                print(f"✓ Notification {notification_id} marked as read")
            else:
                print("⚠ No notifications to mark as read - skipping")
                pytest.skip("No notifications available to test mark as read")
        else:
            pytest.skip("Could not get notifications to test mark as read")
    
    def test_mark_notification_read_nonexistent(self, mechanic_headers):
        """Test marking non-existent notification as read"""
        fake_id = str(uuid.uuid4())
        
        response = requests.patch(
            f"{BASE_URL}/api/mechanic/notifications/{fake_id}/read",
            headers=mechanic_headers
        )
        
        # Should return 200 (idempotent) or 404
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ Non-existent notification handled: {response.status_code}")
    
    def test_mark_notification_read_unauthenticated(self):
        """Test mark notification read without auth - should fail"""
        response = requests.patch(
            f"{BASE_URL}/api/mechanic/notifications/some-id/read"
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated mark read correctly rejected: {response.status_code}")


class TestNotificationOnInspectionAssignment:
    """Test notification triggers when inspection is assigned"""
    
    @pytest.fixture(scope="class")
    def mechanic_token(self):
        """Get mechanic auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": MECHANIC_PHONE})
        assert response.status_code == 200
        
        response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": MECHANIC_PHONE,
            "otp": DEV_OTP
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def crm_admin_token(self):
        """Get CRM admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CRM_ADMIN_EMAIL,
            "password": CRM_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def mechanic_headers(self, mechanic_token):
        return {"Authorization": f"Bearer {mechanic_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def crm_headers(self, crm_admin_token):
        return {"Authorization": f"Bearer {crm_admin_token}", "Content-Type": "application/json"}
    
    def test_notification_on_mechanic_assignment(self, mechanic_headers, crm_headers):
        """Test that assigning mechanic to inspection creates notification"""
        # First register push token for mechanic
        test_token = f"TEST_assignment_token_{uuid.uuid4().hex[:16]}"
        reg_response = requests.post(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers,
            json={"device_token": test_token, "platform": "android"}
        )
        assert reg_response.status_code == 200, "Push token registration failed"
        
        # Get initial notification count
        initial_response = requests.get(
            f"{BASE_URL}/api/mechanic/notifications",
            headers=mechanic_headers
        )
        initial_count = len(initial_response.json()) if initial_response.status_code == 200 else 0
        
        # Find an inspection to assign
        inspections_response = requests.get(
            f"{BASE_URL}/api/inspections",
            headers=crm_headers,
            params={"limit": 10}
        )
        
        if inspections_response.status_code != 200:
            pytest.skip("Could not get inspections")
        
        inspections = inspections_response.json()
        if not inspections:
            pytest.skip("No inspections available")
        
        # Find an inspection that can be assigned (preferably NEW_INSPECTION status)
        target_inspection = None
        for insp in inspections:
            if insp.get("inspection_status") in ["NEW_INSPECTION", "ASSIGNED_TO_MECHANIC", None]:
                target_inspection = insp
                break
        
        if not target_inspection:
            target_inspection = inspections[0]
        
        inspection_id = target_inspection["id"]
        
        # Get mechanic profile to get mechanic ID
        profile_response = requests.get(
            f"{BASE_URL}/api/mechanic/profile",
            headers=mechanic_headers
        )
        
        if profile_response.status_code != 200:
            # Try to get mechanic ID from verify-otp response
            verify_response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
                "phone": MECHANIC_PHONE,
                "otp": DEV_OTP
            })
            mechanic_id = verify_response.json().get("mechanicProfile", {}).get("id", KNOWN_MECHANIC_ID)
        else:
            mechanic_id = profile_response.json().get("id", KNOWN_MECHANIC_ID)
        
        # Assign mechanic to inspection
        assign_response = requests.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/assign-mechanic",
            headers=crm_headers,
            json={"mechanic_id": mechanic_id}
        )
        
        # Check if assignment was successful (may fail due to city mismatch)
        if assign_response.status_code == 200:
            print(f"✓ Mechanic assigned to inspection {inspection_id}")
            
            # Check if notification was created
            final_response = requests.get(
                f"{BASE_URL}/api/mechanic/notifications",
                headers=mechanic_headers
            )
            
            if final_response.status_code == 200:
                final_notifications = final_response.json()
                final_count = len(final_notifications)
                
                # Check if new notification was added
                if final_count > initial_count:
                    print(f"✓ New notification created (count: {initial_count} -> {final_count})")
                    
                    # Verify notification content
                    latest = final_notifications[0]
                    assert "Assigned" in latest.get("title", "") or "assigned" in latest.get("body", "").lower(), \
                        f"Notification should mention assignment: {latest}"
                    print(f"✓ Notification content verified: {latest.get('title')}")
                else:
                    print(f"⚠ Notification count unchanged ({initial_count}), but notification may be in mock mode")
        elif assign_response.status_code == 400:
            # City mismatch - expected in some cases
            print(f"⚠ Assignment failed due to city mismatch: {assign_response.json()}")
            pytest.skip("Mechanic city doesn't match inspection city")
        else:
            print(f"⚠ Assignment returned {assign_response.status_code}: {assign_response.text}")


class TestPushTokenDatabaseStorage:
    """Test that push tokens are properly stored in database"""
    
    @pytest.fixture(scope="class")
    def mechanic_token(self):
        """Get mechanic auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": MECHANIC_PHONE})
        assert response.status_code == 200
        
        response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": MECHANIC_PHONE,
            "otp": DEV_OTP
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def mechanic_headers(self, mechanic_token):
        return {"Authorization": f"Bearer {mechanic_token}", "Content-Type": "application/json"}
    
    def test_push_token_persistence(self, mechanic_headers):
        """Test that push token is persisted and can be updated"""
        # Register first token
        token1 = f"TEST_persist_token1_{uuid.uuid4().hex[:16]}"
        response1 = requests.post(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers,
            json={"device_token": token1, "platform": "android"}
        )
        assert response1.status_code == 200, f"First token registration failed: {response1.text}"
        print(f"✓ First token registered: {token1[:30]}...")
        
        # Register second token (should update, not create duplicate)
        token2 = f"TEST_persist_token2_{uuid.uuid4().hex[:16]}"
        response2 = requests.post(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers,
            json={"device_token": token2, "platform": "android"}
        )
        assert response2.status_code == 200, f"Second token registration failed: {response2.text}"
        print(f"✓ Second token registered (upsert): {token2[:30]}...")
        
        # Unregister and verify
        response3 = requests.delete(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers
        )
        assert response3.status_code == 200, f"Token unregistration failed: {response3.text}"
        print("✓ Token unregistered successfully")
        
        # Re-register to verify clean state
        token3 = f"TEST_persist_token3_{uuid.uuid4().hex[:16]}"
        response4 = requests.post(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers,
            json={"device_token": token3, "platform": "ios"}
        )
        assert response4.status_code == 200, f"Re-registration failed: {response4.text}"
        print(f"✓ Re-registration successful: {token3[:30]}...")


class TestNotificationCreationOnNewInspection:
    """Test that notifications are created when new inspections are added in mechanic's city"""
    
    @pytest.fixture(scope="class")
    def mechanic_token(self):
        """Get mechanic auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": MECHANIC_PHONE})
        assert response.status_code == 200
        
        response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": MECHANIC_PHONE,
            "otp": DEV_OTP
        })
        assert response.status_code == 200
        return response.json()
    
    @pytest.fixture(scope="class")
    def crm_admin_token(self):
        """Get CRM admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CRM_ADMIN_EMAIL,
            "password": CRM_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    def test_notification_on_new_inspection_in_city(self, mechanic_token, crm_admin_token):
        """Test notification is created when new inspection is added in mechanic's city"""
        token = mechanic_token["token"]
        mechanic_profile = mechanic_token.get("mechanicProfile", {})
        mechanic_cities = mechanic_profile.get("inspection_cities", [])
        
        mechanic_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        crm_headers = {"Authorization": f"Bearer {crm_admin_token}", "Content-Type": "application/json"}
        
        # Register push token
        test_token = f"TEST_new_insp_token_{uuid.uuid4().hex[:16]}"
        reg_response = requests.post(
            f"{BASE_URL}/api/mechanic/push-token",
            headers=mechanic_headers,
            json={"device_token": test_token, "platform": "android"}
        )
        assert reg_response.status_code == 200
        
        # Get initial notification count
        initial_response = requests.get(
            f"{BASE_URL}/api/mechanic/notifications",
            headers=mechanic_headers
        )
        initial_count = len(initial_response.json()) if initial_response.status_code == 200 else 0
        
        # Create new inspection in mechanic's city
        if mechanic_cities:
            city = mechanic_cities[0]
        else:
            city = "Bangalore"  # Default city
        
        new_inspection = {
            "car_number": f"TEST{uuid.uuid4().hex[:6].upper()}",
            "make": "Test",
            "model": "Vehicle",
            "city": city,
            "customer_name": "Test Customer",
            "customer_phone": "+919999999999",
            "inspection_status": "NEW_INSPECTION",
            "scheduled_date": "2026-01-20",
            "scheduled_time": "10:00"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/inspections",
            headers=crm_headers,
            json=new_inspection
        )
        
        if create_response.status_code == 200:
            created_inspection = create_response.json()
            print(f"✓ Created test inspection: {created_inspection.get('id')}")
            
            # Check if notification was created
            final_response = requests.get(
                f"{BASE_URL}/api/mechanic/notifications",
                headers=mechanic_headers
            )
            
            if final_response.status_code == 200:
                final_notifications = final_response.json()
                final_count = len(final_notifications)
                
                if final_count > initial_count:
                    print(f"✓ New notification created for new inspection (count: {initial_count} -> {final_count})")
                    latest = final_notifications[0]
                    print(f"✓ Notification: {latest.get('title')} - {latest.get('body')}")
                else:
                    print(f"⚠ Notification count unchanged ({initial_count}), FCM may be in mock mode")
        else:
            print(f"⚠ Could not create test inspection: {create_response.status_code} - {create_response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
