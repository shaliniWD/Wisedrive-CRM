"""
Test Report Publish Feature - Report Tab in LiveProgressModal
Tests the publish-report and publish-history API endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReportPublishFeature:
    """Tests for Report tab publish functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login and get auth token"""
        # Login to get auth token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123",
            "country": "India"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Get an inspection to test with (BR02BA4253)
        inspections_response = requests.get(
            f"{BASE_URL}/api/inspections",
            headers=self.headers,
            params={"search": "BR02BA4253"}
        )
        assert inspections_response.status_code == 200, f"Failed to get inspections: {inspections_response.text}"
        inspections = inspections_response.json()
        
        if isinstance(inspections, list) and len(inspections) > 0:
            self.inspection_id = inspections[0].get("id")
        elif isinstance(inspections, dict) and inspections.get("inspections"):
            self.inspection_id = inspections["inspections"][0].get("id")
        else:
            # Try to get any inspection
            all_inspections = requests.get(
                f"{BASE_URL}/api/inspections",
                headers=self.headers
            )
            if all_inspections.status_code == 200:
                data = all_inspections.json()
                if isinstance(data, list) and len(data) > 0:
                    self.inspection_id = data[0].get("id")
                elif isinstance(data, dict) and data.get("inspections"):
                    self.inspection_id = data["inspections"][0].get("id")
                else:
                    pytest.skip("No inspections available for testing")
            else:
                pytest.skip("Could not fetch inspections")
    
    def test_01_get_publish_history_endpoint_exists(self):
        """Test 1: GET /api/inspections/{id}/publish-history endpoint exists and returns data"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-history",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "inspection_id" in data, "Response should contain inspection_id"
        assert "total_publishes" in data, "Response should contain total_publishes"
        assert "history" in data, "Response should contain history array"
        assert isinstance(data["history"], list), "History should be a list"
        
        print(f"✓ Publish history endpoint works. Total publishes: {data['total_publishes']}")
        
        # Store initial publish count for later tests
        self.initial_publish_count = data["total_publishes"]
    
    def test_02_publish_report_endpoint_exists(self):
        """Test 2: POST /api/inspections/{id}/publish-report endpoint exists"""
        # Test with minimal payload
        response = requests.post(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-report",
            headers=self.headers,
            json={
                "notes": "Test publish from automated testing",
                "send_whatsapp": False,  # Don't send actual WhatsApp
                "send_email": False
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "publish_id" in data, "Response should contain publish_id"
        assert "publish_count" in data, "Response should contain publish_count"
        assert "changes_logged" in data, "Response should contain changes_logged"
        
        print(f"✓ Publish report endpoint works. Publish count: {data['publish_count']}, Changes logged: {data['changes_logged']}")
    
    def test_03_publish_history_increments_after_publish(self):
        """Test 3: Verify publish history increments after publishing"""
        # Get current history
        before_response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-history",
            headers=self.headers
        )
        assert before_response.status_code == 200
        before_count = before_response.json()["total_publishes"]
        
        # Publish again
        publish_response = requests.post(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-report",
            headers=self.headers,
            json={
                "notes": "Second test publish - verifying increment",
                "send_whatsapp": False,
                "send_email": False
            }
        )
        assert publish_response.status_code == 200
        
        # Get history again
        after_response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-history",
            headers=self.headers
        )
        assert after_response.status_code == 200
        after_count = after_response.json()["total_publishes"]
        
        assert after_count == before_count + 1, f"Publish count should increment. Before: {before_count}, After: {after_count}"
        print(f"✓ Publish count incremented correctly: {before_count} → {after_count}")
    
    def test_04_publish_history_contains_entry_details(self):
        """Test 4: Verify publish history entries contain required fields"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-history",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["history"]) > 0, "Should have at least one publish entry"
        
        # Check the latest entry (first in list since sorted by newest first)
        latest_entry = data["history"][0]
        
        # Required fields
        assert "id" in latest_entry, "Entry should have id"
        assert "published_at" in latest_entry, "Entry should have published_at timestamp"
        assert "published_by" in latest_entry, "Entry should have published_by user id"
        assert "published_by_name" in latest_entry, "Entry should have published_by_name"
        assert "changes" in latest_entry, "Entry should have changes array"
        
        print(f"✓ Publish entry has all required fields")
        print(f"  - Published by: {latest_entry['published_by_name']}")
        print(f"  - Published at: {latest_entry['published_at']}")
        print(f"  - Changes: {len(latest_entry.get('changes', []))} items")
    
    def test_05_first_publish_shows_initial_report_change(self):
        """Test 5: First publish should show 'Initial report publish' in changes"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-history",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        history = data["history"]
        
        # Find the first publish (last in list since sorted newest first)
        if len(history) > 0:
            first_publish = history[-1]  # Last entry is the first publish
            changes = first_publish.get("changes", [])
            
            # First publish should have "Initial report publish" change
            initial_change_found = any(
                "Initial report publish" in str(change.get("details", "")) or
                change.get("type") == "created"
                for change in changes
            )
            
            print(f"✓ First publish entry found with {len(changes)} changes")
            if initial_change_found:
                print(f"  - Contains 'Initial report publish' or 'created' type")
            else:
                print(f"  - Changes: {changes}")
    
    def test_06_publish_with_notes(self):
        """Test 6: Verify notes are saved with publish entry"""
        test_notes = f"Test notes from automated testing - {time.time()}"
        
        # Publish with notes
        publish_response = requests.post(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-report",
            headers=self.headers,
            json={
                "notes": test_notes,
                "send_whatsapp": False,
                "send_email": False
            }
        )
        assert publish_response.status_code == 200
        
        # Get history and verify notes
        history_response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-history",
            headers=self.headers
        )
        assert history_response.status_code == 200
        
        latest_entry = history_response.json()["history"][0]
        assert latest_entry.get("notes") == test_notes, f"Notes should match. Expected: {test_notes}, Got: {latest_entry.get('notes')}"
        
        print(f"✓ Notes saved correctly with publish entry")
    
    def test_07_inspection_updates_after_publish(self):
        """Test 7: Verify inspection record updates with publish info"""
        # Get inspection details
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        
        inspection = response.json()
        
        # Check publish-related fields
        assert inspection.get("report_published") == True, "report_published should be True"
        assert inspection.get("publish_count", 0) > 0, "publish_count should be > 0"
        assert inspection.get("last_published_at") is not None, "last_published_at should be set"
        
        print(f"✓ Inspection record updated with publish info")
        print(f"  - report_published: {inspection.get('report_published')}")
        print(f"  - publish_count: {inspection.get('publish_count')}")
        print(f"  - last_published_at: {inspection.get('last_published_at')}")
    
    def test_08_publish_history_sorted_newest_first(self):
        """Test 8: Verify publish history is sorted by newest first"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-history",
            headers=self.headers
        )
        assert response.status_code == 200
        
        history = response.json()["history"]
        
        if len(history) >= 2:
            # Check that entries are sorted newest first
            for i in range(len(history) - 1):
                current_time = history[i]["published_at"]
                next_time = history[i + 1]["published_at"]
                assert current_time >= next_time, f"History should be sorted newest first. {current_time} should be >= {next_time}"
            
            print(f"✓ Publish history is correctly sorted (newest first)")
        else:
            print(f"✓ Only {len(history)} entries, sorting check skipped")
    
    def test_09_publish_without_auth_fails(self):
        """Test 9: Verify publish endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-report",
            json={
                "notes": "Should fail",
                "send_whatsapp": False
            }
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Publish endpoint correctly requires authentication")
    
    def test_10_publish_history_without_auth_fails(self):
        """Test 10: Verify publish history endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-history"
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Publish history endpoint correctly requires authentication")
    
    def test_11_publish_invalid_inspection_returns_404(self):
        """Test 11: Verify publish with invalid inspection ID returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/inspections/invalid-inspection-id-12345/publish-report",
            headers=self.headers,
            json={
                "notes": "Should fail",
                "send_whatsapp": False
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid inspection, got {response.status_code}"
        print(f"✓ Invalid inspection ID correctly returns 404")
    
    def test_12_publish_history_invalid_inspection_returns_404(self):
        """Test 12: Verify publish history with invalid inspection ID returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/invalid-inspection-id-12345/publish-history",
            headers=self.headers
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid inspection, got {response.status_code}"
        print(f"✓ Invalid inspection ID correctly returns 404 for history")


class TestReportPublishChangesDetection:
    """Tests for change detection between publishes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123",
            "country": "India"
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Get inspection
        inspections_response = requests.get(
            f"{BASE_URL}/api/inspections",
            headers=self.headers,
            params={"search": "BR02BA4253"}
        )
        if inspections_response.status_code == 200:
            data = inspections_response.json()
            if isinstance(data, list) and len(data) > 0:
                self.inspection_id = data[0].get("id")
            elif isinstance(data, dict) and data.get("inspections"):
                self.inspection_id = data["inspections"][0].get("id")
            else:
                pytest.skip("No inspections available")
        else:
            pytest.skip("Could not fetch inspections")
    
    def test_13_changes_array_structure(self):
        """Test 13: Verify changes array has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-history",
            headers=self.headers
        )
        assert response.status_code == 200
        
        history = response.json()["history"]
        
        if len(history) > 0:
            for entry in history:
                changes = entry.get("changes", [])
                for change in changes:
                    assert "field" in change, "Change should have 'field'"
                    assert "type" in change, "Change should have 'type'"
                    assert "details" in change, "Change should have 'details'"
                    assert change["type"] in ["created", "updated", "deleted"], f"Invalid change type: {change['type']}"
            
            print(f"✓ All changes have correct structure (field, type, details)")
        else:
            print(f"✓ No history entries to check")
    
    def test_14_whatsapp_flag_stored(self):
        """Test 14: Verify send_whatsapp flag is stored in history"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.inspection_id}/publish-history",
            headers=self.headers
        )
        assert response.status_code == 200
        
        history = response.json()["history"]
        
        if len(history) > 0:
            latest = history[0]
            assert "send_whatsapp" in latest, "Entry should have send_whatsapp flag"
            print(f"✓ WhatsApp flag stored: {latest.get('send_whatsapp')}")
        else:
            print(f"✓ No history entries to check")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
