"""
Test suite for Customers Tab UI Fixes (Iteration 55)
Tests the 5 UI issues fixed:
1. Add visible option to add notes
2. Show Meta/Ad details (AD ID, Campaign)
3. Enable edit/delete for notes
4. Show package details with inspection status and Report button
5. Show payment in single row format
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomersUIFixes:
    """Test suite for Customers Tab UI Fixes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "countryhead.in@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        self.session.close()
    
    # ==================== TEST 1: Notes API - Add Note ====================
    
    def test_add_note_to_customer(self):
        """Test adding a note to a customer - verifies visible Add Note option works"""
        # First get a customer
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers found to test")
        
        customer_id = customers[0]["id"]
        
        # Add a note
        note_text = "TEST_Note from iteration 55 testing"
        add_note_response = self.session.post(
            f"{BASE_URL}/api/customers/{customer_id}/notes",
            json={"note": note_text}
        )
        
        assert add_note_response.status_code == 200, f"Add note failed: {add_note_response.text}"
        note_data = add_note_response.json()
        
        # Verify note structure
        assert "id" in note_data, "Note should have an ID"
        assert note_data.get("note") == note_text, "Note text should match"
        assert "user_name" in note_data, "Note should have user_name"
        assert "created_at" in note_data, "Note should have created_at"
        
        print(f"✓ Add note API working - Note ID: {note_data['id']}")
        return note_data
    
    # ==================== TEST 2: Notes API - Edit Note ====================
    
    def test_edit_note(self):
        """Test editing a note - verifies edit functionality works"""
        # First get a customer
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers found to test")
        
        customer_id = customers[0]["id"]
        
        # Add a note first
        original_text = "TEST_Original note for edit test"
        add_response = self.session.post(
            f"{BASE_URL}/api/customers/{customer_id}/notes",
            json={"note": original_text}
        )
        assert add_response.status_code == 200
        note_id = add_response.json()["id"]
        
        # Edit the note
        updated_text = "TEST_Updated note text after edit"
        edit_response = self.session.put(
            f"{BASE_URL}/api/customers/{customer_id}/notes/{note_id}",
            json={"note": updated_text}
        )
        
        assert edit_response.status_code == 200, f"Edit note failed: {edit_response.text}"
        updated_note = edit_response.json()
        
        # Verify update
        assert updated_note.get("note") == updated_text, "Note text should be updated"
        assert "updated_at" in updated_note, "Note should have updated_at timestamp"
        
        print(f"✓ Edit note API working - Note ID: {note_id}")
    
    # ==================== TEST 3: Notes API - Delete Note ====================
    
    def test_delete_note(self):
        """Test deleting a note - verifies delete functionality works"""
        # First get a customer
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers found to test")
        
        customer_id = customers[0]["id"]
        
        # Add a note first
        add_response = self.session.post(
            f"{BASE_URL}/api/customers/{customer_id}/notes",
            json={"note": "TEST_Note to be deleted"}
        )
        assert add_response.status_code == 200
        note_id = add_response.json()["id"]
        
        # Delete the note
        delete_response = self.session.delete(
            f"{BASE_URL}/api/customers/{customer_id}/notes/{note_id}"
        )
        
        assert delete_response.status_code == 200, f"Delete note failed: {delete_response.text}"
        result = delete_response.json()
        assert result.get("success") == True, "Delete should return success"
        
        print(f"✓ Delete note API working - Note ID: {note_id}")
    
    # ==================== TEST 4: Meta/Ad Info in Detailed Payments ====================
    
    def test_meta_info_in_detailed_payments(self):
        """Test that detailed-payments returns meta_info with source, ad_id, campaign_id"""
        # Get customers
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers found to test")
        
        customer_id = customers[0]["id"]
        
        # Get detailed payments
        detailed_response = self.session.get(
            f"{BASE_URL}/api/customers/{customer_id}/detailed-payments"
        )
        
        assert detailed_response.status_code == 200, f"Detailed payments failed: {detailed_response.text}"
        data = detailed_response.json()
        
        # Verify structure includes meta_info field
        assert "meta_info" in data, "Response should include meta_info field"
        assert "packages" in data, "Response should include packages"
        assert "total_paid" in data, "Response should include total_paid"
        assert "total_pending" in data, "Response should include total_pending"
        
        # If meta_info exists and has data, verify structure
        if data.get("meta_info"):
            meta = data["meta_info"]
            assert "source" in meta, "meta_info should have source"
            # ad_id and campaign_id may be null if not from ad
            print(f"✓ Meta info present: source={meta.get('source')}, ad_id={meta.get('ad_id')}")
        else:
            print("✓ meta_info field present (null for non-ad leads)")
        
        print(f"✓ Detailed payments API returns meta_info field")
    
    # ==================== TEST 5: Package Details with Inspection Status ====================
    
    def test_package_details_with_inspection_status(self):
        """Test that packages include inspection_status and has_report fields"""
        # Get customers
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers found to test")
        
        # Find a customer with packages
        customer_with_packages = None
        for customer in customers:
            customer_id = customer["id"]
            detailed_response = self.session.get(
                f"{BASE_URL}/api/customers/{customer_id}/detailed-payments"
            )
            if detailed_response.status_code == 200:
                data = detailed_response.json()
                if data.get("packages") and len(data["packages"]) > 0:
                    customer_with_packages = data
                    break
        
        if not customer_with_packages:
            pytest.skip("No customers with packages found")
        
        packages = customer_with_packages["packages"]
        
        # Verify package structure
        for pkg in packages:
            assert "inspection_id" in pkg, "Package should have inspection_id"
            assert "package_name" in pkg, "Package should have package_name"
            assert "inspection_status" in pkg, "Package should have inspection_status"
            assert "has_report" in pkg, "Package should have has_report flag"
            assert "payment_status" in pkg, "Package should have payment_status"
            
            # Verify inspection status is a valid value
            valid_statuses = [
                "NEW_INSPECTION", "SCHEDULED", "ASSIGNED_TO_MECHANIC",
                "INSPECTION_IN_PROGRESS", "INSPECTION_COMPLETED"
            ]
            assert pkg["inspection_status"] in valid_statuses, f"Invalid inspection_status: {pkg['inspection_status']}"
            
            # If completed, has_report should be True
            if pkg["inspection_status"] == "INSPECTION_COMPLETED":
                assert pkg["has_report"] == True, "Completed inspections should have has_report=True"
                assert pkg.get("report_url"), "Completed inspections should have report_url"
            
            print(f"✓ Package: {pkg['package_name']} - Status: {pkg['inspection_status']}, Has Report: {pkg['has_report']}")
        
        print(f"✓ Package details include inspection_status and has_report fields")
    
    # ==================== TEST 6: Get Notes API ====================
    
    def test_get_customer_notes(self):
        """Test getting all notes for a customer"""
        # Get customers
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers found to test")
        
        customer_id = customers[0]["id"]
        
        # Get notes
        notes_response = self.session.get(
            f"{BASE_URL}/api/customers/{customer_id}/notes"
        )
        
        assert notes_response.status_code == 200, f"Get notes failed: {notes_response.text}"
        notes = notes_response.json()
        
        # Verify it's a list
        assert isinstance(notes, list), "Notes should be a list"
        
        # If notes exist, verify structure
        if notes:
            note = notes[0]
            assert "id" in note, "Note should have id"
            assert "note" in note, "Note should have note text"
            assert "user_name" in note, "Note should have user_name"
            assert "created_at" in note, "Note should have created_at"
        
        print(f"✓ Get notes API working - Found {len(notes)} notes")
    
    # ==================== TEST 7: Activities API ====================
    
    def test_get_customer_activities(self):
        """Test getting activities for a customer (includes note activities)"""
        # Get customers
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers found to test")
        
        customer_id = customers[0]["id"]
        
        # Get activities
        activities_response = self.session.get(
            f"{BASE_URL}/api/customers/{customer_id}/activities"
        )
        
        assert activities_response.status_code == 200, f"Get activities failed: {activities_response.text}"
        activities = activities_response.json()
        
        # Verify it's a list
        assert isinstance(activities, list), "Activities should be a list"
        
        # If activities exist, verify structure
        if activities:
            activity = activities[0]
            assert "id" in activity, "Activity should have id"
            assert "action" in activity, "Activity should have action"
            assert "user_name" in activity, "Activity should have user_name"
            assert "created_at" in activity, "Activity should have created_at"
        
        print(f"✓ Get activities API working - Found {len(activities)} activities")
    
    # ==================== TEST 8: Payment Status in Customer List ====================
    
    def test_customer_list_payment_info(self):
        """Test that customer list includes payment info for single row display"""
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers found to test")
        
        # Verify customer structure includes payment fields
        customer = customers[0]
        assert "payment_status" in customer, "Customer should have payment_status"
        assert "total_paid" in customer, "Customer should have total_paid"
        assert "total_pending" in customer, "Customer should have total_pending"
        
        print(f"✓ Customer list includes payment info: status={customer['payment_status']}, paid={customer.get('total_paid', 0)}, pending={customer.get('total_pending', 0)}")
    
    # ==================== TEST 9: Seed Demo Customer ====================
    
    def test_seed_demo_customer(self):
        """Test creating demo customer with packages"""
        seed_response = self.session.post(f"{BASE_URL}/api/customers/seed-sample-data")
        
        assert seed_response.status_code == 200, f"Seed failed: {seed_response.text}"
        data = seed_response.json()
        
        assert "customer_id" in data, "Response should have customer_id"
        assert "customer_name" in data, "Response should have customer_name"
        assert "inspections_created" in data, "Response should have inspections_created"
        
        print(f"✓ Demo customer created: {data['customer_name']} with {data['inspections_created']} packages")
        
        # Verify the demo customer has packages with different statuses
        customer_id = data["customer_id"]
        detailed_response = self.session.get(
            f"{BASE_URL}/api/customers/{customer_id}/detailed-payments"
        )
        
        assert detailed_response.status_code == 200
        detailed_data = detailed_response.json()
        
        packages = detailed_data.get("packages", [])
        assert len(packages) >= 2, "Demo customer should have at least 2 packages"
        
        # Check for completed inspections
        completed_count = sum(1 for p in packages if p.get("inspection_status") == "INSPECTION_COMPLETED")
        print(f"✓ Demo customer has {completed_count} completed inspections with Report buttons")
        
        return data


class TestNotesEditDelete:
    """Focused tests for note edit/delete functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "countryhead.in@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        self.session.close()
    
    def test_note_crud_full_cycle(self):
        """Test complete CRUD cycle for notes"""
        # Get a customer
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        
        if not customers:
            pytest.skip("No customers found")
        
        customer_id = customers[0]["id"]
        
        # CREATE
        create_response = self.session.post(
            f"{BASE_URL}/api/customers/{customer_id}/notes",
            json={"note": "TEST_CRUD_Note_Create"}
        )
        assert create_response.status_code == 200
        note = create_response.json()
        note_id = note["id"]
        print(f"✓ CREATE: Note {note_id} created")
        
        # READ
        read_response = self.session.get(f"{BASE_URL}/api/customers/{customer_id}/notes")
        assert read_response.status_code == 200
        notes = read_response.json()
        assert any(n["id"] == note_id for n in notes), "Created note should be in list"
        print(f"✓ READ: Note {note_id} found in list")
        
        # UPDATE
        update_response = self.session.put(
            f"{BASE_URL}/api/customers/{customer_id}/notes/{note_id}",
            json={"note": "TEST_CRUD_Note_Updated"}
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["note"] == "TEST_CRUD_Note_Updated"
        print(f"✓ UPDATE: Note {note_id} updated")
        
        # DELETE
        delete_response = self.session.delete(
            f"{BASE_URL}/api/customers/{customer_id}/notes/{note_id}"
        )
        assert delete_response.status_code == 200
        print(f"✓ DELETE: Note {note_id} deleted")
        
        # Verify deletion
        read_after_delete = self.session.get(f"{BASE_URL}/api/customers/{customer_id}/notes")
        notes_after = read_after_delete.json()
        assert not any(n["id"] == note_id for n in notes_after), "Deleted note should not be in list"
        print(f"✓ VERIFY: Note {note_id} no longer in list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
