"""
Test suite for Inspections Tab Enhancements
Features tested:
1. Collect Balance button in Payment Status column
2. Vehicle edit modal with Vaahan API integration
3. Inspection status dropdown with all statuses
4. Mechanic assignment modal (assign/unassign/reassign)
5. Schedule edit modal to change date/time
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "insphead.in@wisedrive.com"
TEST_PASSWORD = "password123"
TEST_COUNTRY = "IN"


class TestInspectionsEnhancements:
    """Test suite for Inspections Tab Enhancements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.inspection_id = None
        
    def get_auth_token(self):
        """Get authentication token"""
        if self.token:
            return self.token
            
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "country_id": TEST_COUNTRY
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return self.token
        return None
    
    def get_inspection_with_partial_payment(self):
        """Get an inspection with partial payment for testing"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/inspections", params={"is_scheduled": True})
        
        if response.status_code == 200:
            inspections = response.json()
            for insp in inspections:
                # Check for partial payment (old or new format)
                has_balance = (
                    (insp.get("payment_type") == "Partial" and insp.get("pending_amount", 0) > 0) or
                    (insp.get("payment_status") == "PARTIALLY_PAID" and insp.get("balance_due", 0) > 0)
                )
                if has_balance:
                    return insp
        return None
    
    def get_any_scheduled_inspection(self):
        """Get any scheduled inspection for testing"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/inspections", params={"is_scheduled": True})
        
        if response.status_code == 200:
            inspections = response.json()
            if inspections:
                return inspections[0]
        return None
    
    # ==================== Authentication Tests ====================
    
    def test_01_login_inspection_head(self):
        """Test login with Inspection Head credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "country_id": TEST_COUNTRY
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        print(f"✓ Login successful for {data['user'].get('name', TEST_EMAIL)}")
    
    # ==================== Inspections List Tests ====================
    
    def test_02_get_scheduled_inspections(self):
        """Test fetching scheduled inspections"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/inspections", params={"is_scheduled": True})
        
        assert response.status_code == 200, f"Failed to get inspections: {response.text}"
        inspections = response.json()
        assert isinstance(inspections, list), "Response should be a list"
        print(f"✓ Found {len(inspections)} scheduled inspections")
        
        # Verify inspection structure has required fields
        if inspections:
            insp = inspections[0]
            required_fields = ["id", "customer_name", "customer_mobile"]
            for field in required_fields:
                assert field in insp, f"Missing field: {field}"
            print(f"✓ Inspection structure verified")
    
    def test_03_get_unscheduled_inspections(self):
        """Test fetching unscheduled inspections"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/inspections", params={"is_scheduled": False})
        
        assert response.status_code == 200, f"Failed to get inspections: {response.text}"
        inspections = response.json()
        assert isinstance(inspections, list), "Response should be a list"
        print(f"✓ Found {len(inspections)} unscheduled inspections")
    
    # ==================== Status Update Tests ====================
    
    def test_04_update_inspection_status_valid(self):
        """Test updating inspection status with valid status"""
        inspection = self.get_any_scheduled_inspection()
        if not inspection:
            pytest.skip("No scheduled inspections available")
        
        inspection_id = inspection["id"]
        original_status = inspection.get("inspection_status", "SCHEDULED")
        
        # Test changing to INSPECTION_CONFIRMED
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/status",
            params={"inspection_status": "INSPECTION_CONFIRMED"}
        )
        
        assert response.status_code == 200, f"Status update failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Success flag not set"
        assert data.get("inspection_status") == "INSPECTION_CONFIRMED", "Status not updated"
        print(f"✓ Status updated to INSPECTION_CONFIRMED")
        
        # Restore original status
        self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/status",
            params={"inspection_status": original_status}
        )
    
    def test_05_update_inspection_status_all_valid_statuses(self):
        """Test all valid inspection statuses"""
        valid_statuses = [
            "NEW_INSPECTION", "ASSIGNED_TO_MECHANIC", "INSPECTION_CONFIRMED",
            "INSPECTION_STARTED", "INSPECTION_IN_PROGRESS", "INSPECTION_COMPLETED",
            "INSPECTION_CANCELLED_CUSTOMER", "INSPECTION_CANCELLED_WISEDRIVE",
            "SCHEDULED", "UNSCHEDULED"
        ]
        
        inspection = self.get_any_scheduled_inspection()
        if not inspection:
            pytest.skip("No scheduled inspections available")
        
        inspection_id = inspection["id"]
        original_status = inspection.get("inspection_status", "SCHEDULED")
        
        # Test each status
        for status in valid_statuses:
            response = self.session.patch(
                f"{BASE_URL}/api/inspections/{inspection_id}/status",
                params={"inspection_status": status}
            )
            assert response.status_code == 200, f"Failed to set status {status}: {response.text}"
        
        print(f"✓ All {len(valid_statuses)} valid statuses tested successfully")
        
        # Restore original status
        self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/status",
            params={"inspection_status": original_status}
        )
    
    def test_06_update_inspection_status_invalid(self):
        """Test updating inspection status with invalid status"""
        inspection = self.get_any_scheduled_inspection()
        if not inspection:
            pytest.skip("No scheduled inspections available")
        
        inspection_id = inspection["id"]
        
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/status",
            params={"inspection_status": "INVALID_STATUS"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
        print(f"✓ Invalid status correctly rejected with 400")
    
    # ==================== Vehicle Update Tests ====================
    
    def test_07_update_inspection_vehicle(self):
        """Test updating vehicle details for an inspection"""
        inspection = self.get_any_scheduled_inspection()
        if not inspection:
            pytest.skip("No scheduled inspections available")
        
        inspection_id = inspection["id"]
        original_car_number = inspection.get("car_number", "")
        
        # Update vehicle
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/vehicle",
            json={
                "car_number": "KA01TEST1234",
                "car_make": "Toyota",
                "car_model": "Camry",
                "car_year": "2022",
                "car_color": "White",
                "fuel_type": "Petrol"
            }
        )
        
        assert response.status_code == 200, f"Vehicle update failed: {response.text}"
        data = response.json()
        assert data.get("car_number") == "KA01TEST1234", "Car number not updated"
        assert data.get("car_make") == "Toyota", "Car make not updated"
        print(f"✓ Vehicle updated successfully")
        
        # Restore original vehicle number if it existed
        if original_car_number:
            self.session.patch(
                f"{BASE_URL}/api/inspections/{inspection_id}/vehicle",
                json={"car_number": original_car_number}
            )
    
    def test_08_update_inspection_vehicle_not_found(self):
        """Test updating vehicle for non-existent inspection"""
        self.get_auth_token()
        
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/non-existent-id/vehicle",
            json={"car_number": "KA01TEST1234"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent inspection correctly returns 404")
    
    # ==================== Mechanic Assignment Tests ====================
    
    def test_09_get_mechanics_list(self):
        """Test fetching mechanics list"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/mechanics")
        
        assert response.status_code == 200, f"Failed to get mechanics: {response.text}"
        mechanics = response.json()
        assert isinstance(mechanics, list), "Response should be a list"
        print(f"✓ Found {len(mechanics)} mechanics")
        
        if mechanics:
            mechanic = mechanics[0]
            assert "id" in mechanic, "Mechanic should have id"
            assert "name" in mechanic, "Mechanic should have name"
            print(f"✓ Mechanic structure verified: {mechanic.get('name')}")
    
    def test_10_assign_mechanic_to_inspection(self):
        """Test assigning a mechanic to an inspection"""
        inspection = self.get_any_scheduled_inspection()
        if not inspection:
            pytest.skip("No scheduled inspections available")
        
        # Get mechanics list
        response = self.session.get(f"{BASE_URL}/api/mechanics")
        if response.status_code != 200 or not response.json():
            pytest.skip("No mechanics available")
        
        mechanics = response.json()
        mechanic = mechanics[0]
        inspection_id = inspection["id"]
        original_mechanic_id = inspection.get("mechanic_id")
        
        # Assign mechanic
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/assign-mechanic",
            json={"mechanic_id": mechanic["id"]}
        )
        
        assert response.status_code == 200, f"Mechanic assignment failed: {response.text}"
        data = response.json()
        assert data.get("mechanic_id") == mechanic["id"], "Mechanic ID not set"
        assert data.get("mechanic_name") == mechanic.get("name"), "Mechanic name not set"
        print(f"✓ Mechanic {mechanic.get('name')} assigned successfully")
        
        # Restore original mechanic if any
        self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/assign-mechanic",
            json={"mechanic_id": original_mechanic_id}
        )
    
    def test_11_unassign_mechanic_from_inspection(self):
        """Test unassigning a mechanic from an inspection"""
        inspection = self.get_any_scheduled_inspection()
        if not inspection:
            pytest.skip("No scheduled inspections available")
        
        inspection_id = inspection["id"]
        original_mechanic_id = inspection.get("mechanic_id")
        
        # First assign a mechanic if not assigned
        response = self.session.get(f"{BASE_URL}/api/mechanics")
        if response.status_code == 200 and response.json():
            mechanic = response.json()[0]
            self.session.patch(
                f"{BASE_URL}/api/inspections/{inspection_id}/assign-mechanic",
                json={"mechanic_id": mechanic["id"]}
            )
        
        # Now unassign
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/assign-mechanic",
            json={"mechanic_id": None}
        )
        
        assert response.status_code == 200, f"Mechanic unassignment failed: {response.text}"
        data = response.json()
        assert data.get("mechanic_id") is None, "Mechanic ID should be None"
        print(f"✓ Mechanic unassigned successfully")
        
        # Restore original mechanic if any
        if original_mechanic_id:
            self.session.patch(
                f"{BASE_URL}/api/inspections/{inspection_id}/assign-mechanic",
                json={"mechanic_id": original_mechanic_id}
            )
    
    def test_12_assign_nonexistent_mechanic(self):
        """Test assigning a non-existent mechanic"""
        inspection = self.get_any_scheduled_inspection()
        if not inspection:
            pytest.skip("No scheduled inspections available")
        
        inspection_id = inspection["id"]
        
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/assign-mechanic",
            json={"mechanic_id": "non-existent-mechanic-id"}
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent mechanic, got {response.status_code}"
        print(f"✓ Non-existent mechanic correctly rejected with 404")
    
    # ==================== Schedule Update Tests ====================
    
    def test_13_update_inspection_schedule(self):
        """Test updating inspection schedule"""
        inspection = self.get_any_scheduled_inspection()
        if not inspection:
            pytest.skip("No scheduled inspections available")
        
        inspection_id = inspection["id"]
        original_date = inspection.get("scheduled_date")
        original_time = inspection.get("scheduled_time")
        
        # Update schedule
        new_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        new_time = "14:30"
        
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/schedule",
            json={
                "scheduled_date": new_date,
                "scheduled_time": new_time
            }
        )
        
        assert response.status_code == 200, f"Schedule update failed: {response.text}"
        data = response.json()
        assert data.get("scheduled_date") == new_date, "Date not updated"
        assert data.get("scheduled_time") == new_time, "Time not updated"
        print(f"✓ Schedule updated to {new_date} {new_time}")
        
        # Restore original schedule
        if original_date and original_time:
            self.session.patch(
                f"{BASE_URL}/api/inspections/{inspection_id}/schedule",
                json={
                    "scheduled_date": original_date,
                    "scheduled_time": original_time
                }
            )
    
    def test_14_update_schedule_not_found(self):
        """Test updating schedule for non-existent inspection"""
        self.get_auth_token()
        
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/non-existent-id/schedule",
            json={
                "scheduled_date": "2025-01-20",
                "scheduled_time": "10:00"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent inspection correctly returns 404")
    
    # ==================== Collect Balance Tests ====================
    
    def test_15_collect_balance_partial_payment(self):
        """Test collect balance for partial payment inspection"""
        inspection = self.get_inspection_with_partial_payment()
        if not inspection:
            pytest.skip("No partial payment inspections available")
        
        inspection_id = inspection["id"]
        balance_due = inspection.get("balance_due") or inspection.get("pending_amount", 0)
        
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{inspection_id}/collect-balance",
            json={
                "send_whatsapp": False,  # Don't actually send WhatsApp in test
                "notes": "Test collection"
            }
        )
        
        assert response.status_code == 200, f"Collect balance failed: {response.text}"
        data = response.json()
        assert "payment_link" in data, "Payment link not in response"
        assert data.get("balance_amount") == balance_due, f"Balance amount mismatch: expected {balance_due}"
        print(f"✓ Collect balance successful, payment link generated for ₹{balance_due}")
    
    def test_16_collect_balance_fully_paid(self):
        """Test collect balance for fully paid inspection (should fail)"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/inspections", params={"is_scheduled": True})
        
        if response.status_code != 200:
            pytest.skip("Could not fetch inspections")
        
        inspections = response.json()
        fully_paid = None
        for insp in inspections:
            if insp.get("payment_status") == "FULLY_PAID" or insp.get("payment_status") == "PAID":
                fully_paid = insp
                break
        
        if not fully_paid:
            pytest.skip("No fully paid inspections available")
        
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{fully_paid['id']}/collect-balance",
            json={"send_whatsapp": False}
        )
        
        assert response.status_code == 400, f"Expected 400 for fully paid, got {response.status_code}"
        print(f"✓ Collect balance correctly rejected for fully paid inspection")
    
    # ==================== Vaahan API Tests ====================
    
    def test_17_vaahan_api_vehicle_details(self):
        """Test Vaahan API for vehicle details"""
        self.get_auth_token()
        
        # Test with a sample vehicle number
        response = self.session.get(f"{BASE_URL}/api/vehicle/details/KA01AB1234")
        
        # API may return 400 if vehicle not found, which is acceptable
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Success flag not set"
            print(f"✓ Vaahan API returned vehicle details")
        else:
            print(f"✓ Vaahan API correctly handled vehicle not found")
    
    # ==================== Integration Tests ====================
    
    def test_18_full_inspection_workflow(self):
        """Test full inspection workflow: status change -> mechanic assign -> schedule update"""
        inspection = self.get_any_scheduled_inspection()
        if not inspection:
            pytest.skip("No scheduled inspections available")
        
        inspection_id = inspection["id"]
        original_status = inspection.get("inspection_status")
        original_mechanic_id = inspection.get("mechanic_id")
        original_date = inspection.get("scheduled_date")
        original_time = inspection.get("scheduled_time")
        
        # Step 1: Update status to INSPECTION_CONFIRMED
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/status",
            params={"inspection_status": "INSPECTION_CONFIRMED"}
        )
        assert response.status_code == 200, "Status update failed"
        print(f"✓ Step 1: Status updated to INSPECTION_CONFIRMED")
        
        # Step 2: Assign mechanic
        mechanics_response = self.session.get(f"{BASE_URL}/api/mechanics")
        if mechanics_response.status_code == 200 and mechanics_response.json():
            mechanic = mechanics_response.json()[0]
            response = self.session.patch(
                f"{BASE_URL}/api/inspections/{inspection_id}/assign-mechanic",
                json={"mechanic_id": mechanic["id"]}
            )
            assert response.status_code == 200, "Mechanic assignment failed"
            print(f"✓ Step 2: Mechanic {mechanic.get('name')} assigned")
        
        # Step 3: Update schedule
        new_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        response = self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/schedule",
            json={
                "scheduled_date": new_date,
                "scheduled_time": "11:00"
            }
        )
        assert response.status_code == 200, "Schedule update failed"
        print(f"✓ Step 3: Schedule updated to {new_date} 11:00")
        
        # Restore original state
        self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/status",
            params={"inspection_status": original_status or "SCHEDULED"}
        )
        self.session.patch(
            f"{BASE_URL}/api/inspections/{inspection_id}/assign-mechanic",
            json={"mechanic_id": original_mechanic_id}
        )
        if original_date and original_time:
            self.session.patch(
                f"{BASE_URL}/api/inspections/{inspection_id}/schedule",
                json={
                    "scheduled_date": original_date,
                    "scheduled_time": original_time
                }
            )
        
        print(f"✓ Full workflow test completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
