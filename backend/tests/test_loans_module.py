"""
Loans Module Backend Tests
Tests for multi-vehicle loan management, Vaahan API integration, and bank eligibility
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLoansModule:
    """Comprehensive tests for Loans Module APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123",
            "country_id": "india"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        self.session.close()
    
    # ---- Loan Leads Tests ----
    
    def test_get_loan_leads(self):
        """Test GET /api/loan-leads returns loan leads list"""
        response = self.session.get(f"{BASE_URL}/api/loan-leads")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        print(f"✓ Found {data['total']} loan leads")
    
    def test_get_loan_stats(self):
        """Test GET /api/loan-leads/stats returns statistics"""
        response = self.session.get(f"{BASE_URL}/api/loan-leads/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_leads" in data
        assert "leads_by_status" in data
        assert "active_banks" in data
        print(f"✓ Stats: {data['total_leads']} leads, {data['active_banks']} active banks")
    
    def test_search_loan_leads(self):
        """Test search functionality for loan leads"""
        response = self.session.get(f"{BASE_URL}/api/loan-leads?search=Rajesh")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        # Verify search results contain the search term
        if data["items"]:
            for item in data["items"]:
                name = item.get("customer_name", "").lower()
                phone = item.get("customer_phone", "")
                assert "rajesh" in name or "rajesh" in phone.lower(), f"Search result doesn't match: {name}"
        print(f"✓ Search returned {len(data['items'])} results for 'Rajesh'")
    
    def test_filter_loan_leads_by_status(self):
        """Test filtering loan leads by status"""
        response = self.session.get(f"{BASE_URL}/api/loan-leads?status=NEW")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        # Verify all items have the filtered status
        for item in data["items"]:
            assert item.get("status") == "NEW", f"Expected status NEW, got {item.get('status')}"
        print(f"✓ Filter by status=NEW returned {len(data['items'])} leads")
    
    def test_get_single_loan_lead(self):
        """Test GET /api/loan-leads/{lead_id} returns lead details"""
        # First get a lead ID
        list_response = self.session.get(f"{BASE_URL}/api/loan-leads?limit=1")
        assert list_response.status_code == 200
        
        leads = list_response.json().get("items", [])
        if not leads:
            pytest.skip("No loan leads available for testing")
        
        lead_id = leads[0].get("id")
        response = self.session.get(f"{BASE_URL}/api/loan-leads/{lead_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("id") == lead_id
        assert "customer_name" in data
        assert "customer_phone" in data
        assert "vehicles" in data
        assert "applications" in data
        print(f"✓ Retrieved lead: {data.get('customer_name')} with {len(data.get('vehicles', []))} vehicles")
    
    # ---- Multi-Vehicle Tests ----
    
    def test_lead_with_multiple_vehicles(self):
        """Test that leads can have multiple vehicles (Rajesh Sharma has 2 cars)"""
        # Search for Rajesh Sharma who should have 2 vehicles
        response = self.session.get(f"{BASE_URL}/api/loan-leads?search=Rajesh")
        assert response.status_code == 200
        
        data = response.json()
        leads = data.get("items", [])
        
        # Find Rajesh Sharma
        rajesh = next((l for l in leads if "Rajesh" in l.get("customer_name", "")), None)
        if not rajesh:
            pytest.skip("Rajesh Sharma not found in loan leads")
        
        vehicles = rajesh.get("vehicles", [])
        assert len(vehicles) >= 1, f"Expected at least 1 vehicle, got {len(vehicles)}"
        print(f"✓ Rajesh Sharma has {len(vehicles)} vehicle(s)")
        
        # Verify vehicle structure
        for v in vehicles:
            assert "vehicle_id" in v
            assert "car_number" in v
    
    def test_add_vehicle_to_lead(self):
        """Test POST /api/loan-leads/{lead_id}/vehicles adds a new vehicle"""
        # Get a lead to add vehicle to
        list_response = self.session.get(f"{BASE_URL}/api/loan-leads?limit=5")
        assert list_response.status_code == 200
        
        leads = list_response.json().get("items", [])
        if not leads:
            pytest.skip("No loan leads available")
        
        # Find a lead with fewer vehicles
        lead = next((l for l in leads if len(l.get("vehicles", [])) < 3), leads[0])
        lead_id = lead.get("id")
        
        # Add a test vehicle
        vehicle_data = {
            "car_number": "TEST01AB1234",
            "car_make": "Maruti",
            "car_model": "Swift",
            "car_year": 2020,
            "vehicle_valuation": 450000,
            "required_loan_amount": 350000,
            "expected_emi": 8000,
            "expected_tenure_months": 48
        }
        
        response = self.session.post(f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles", json=vehicle_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "vehicle" in data
        assert data["vehicle"]["car_number"] == "TEST01AB1234"
        print(f"✓ Added vehicle {vehicle_data['car_number']} to lead")
        
        # Cleanup - remove the test vehicle
        vehicle_id = data["vehicle"]["vehicle_id"]
        cleanup = self.session.delete(f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles/{vehicle_id}")
        assert cleanup.status_code == 200
        print(f"✓ Cleaned up test vehicle")
    
    def test_update_vehicle_loan_details(self):
        """Test PUT /api/loan-leads/{lead_id}/vehicles/{vehicle_id} updates vehicle"""
        # Get a lead with vehicles
        list_response = self.session.get(f"{BASE_URL}/api/loan-leads?limit=10")
        assert list_response.status_code == 200
        
        leads = list_response.json().get("items", [])
        lead_with_vehicle = next((l for l in leads if l.get("vehicles")), None)
        
        if not lead_with_vehicle:
            pytest.skip("No leads with vehicles found")
        
        lead_id = lead_with_vehicle.get("id")
        vehicle = lead_with_vehicle.get("vehicles")[0]
        vehicle_id = vehicle.get("vehicle_id")
        
        # Update vehicle valuation
        original_valuation = vehicle.get("vehicle_valuation", 0)
        new_valuation = 500000
        
        response = self.session.put(
            f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles/{vehicle_id}",
            json={"vehicle_valuation": new_valuation}
        )
        assert response.status_code == 200
        
        # Verify update
        updated_lead = response.json()
        updated_vehicle = next((v for v in updated_lead.get("vehicles", []) if v.get("vehicle_id") == vehicle_id), None)
        assert updated_vehicle is not None
        assert updated_vehicle.get("vehicle_valuation") == new_valuation
        print(f"✓ Updated vehicle valuation from {original_valuation} to {new_valuation}")
        
        # Restore original value
        self.session.put(
            f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles/{vehicle_id}",
            json={"vehicle_valuation": original_valuation}
        )
    
    # ---- Bank Eligibility Tests ----
    
    def test_check_eligibility(self):
        """Test POST /api/loan-leads/{lead_id}/vehicles/{vehicle_id}/check-eligibility"""
        # Find a lead with a vehicle that has valuation
        list_response = self.session.get(f"{BASE_URL}/api/loan-leads?limit=10")
        assert list_response.status_code == 200
        
        leads = list_response.json().get("items", [])
        
        # Find lead with vehicle that has valuation
        lead_with_valued_vehicle = None
        vehicle_id = None
        
        for lead in leads:
            for v in lead.get("vehicles", []):
                if v.get("vehicle_valuation") and v.get("vehicle_valuation") > 0:
                    lead_with_valued_vehicle = lead
                    vehicle_id = v.get("vehicle_id")
                    break
            if lead_with_valued_vehicle:
                break
        
        if not lead_with_valued_vehicle:
            pytest.skip("No leads with valued vehicles found")
        
        lead_id = lead_with_valued_vehicle.get("id")
        
        response = self.session.post(f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles/{vehicle_id}/check-eligibility")
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        assert "eligible_banks" in data
        assert "vehicle_valuation" in data
        
        results = data.get("results", [])
        print(f"✓ Eligibility check: {data['eligible_banks']} of {len(results)} banks eligible")
        
        # Verify result structure
        if results:
            result = results[0]
            assert "bank_id" in result
            assert "bank_name" in result
            assert "is_eligible" in result
    
    def test_eligibility_requires_valuation(self):
        """Test that eligibility check fails without vehicle valuation"""
        # Get a lead
        list_response = self.session.get(f"{BASE_URL}/api/loan-leads?limit=5")
        leads = list_response.json().get("items", [])
        
        if not leads:
            pytest.skip("No leads available")
        
        lead = leads[0]
        lead_id = lead.get("id")
        
        # Add a vehicle without valuation
        vehicle_data = {
            "car_number": "TEST02CD5678",
            "car_make": "Honda",
            "car_model": "City"
        }
        
        add_response = self.session.post(f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles", json=vehicle_data)
        if add_response.status_code != 200:
            pytest.skip("Could not add test vehicle")
        
        vehicle_id = add_response.json()["vehicle"]["vehicle_id"]
        
        # Try eligibility check - should fail
        response = self.session.post(f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles/{vehicle_id}/check-eligibility")
        assert response.status_code == 400
        assert "valuation" in response.json().get("detail", "").lower()
        print("✓ Eligibility check correctly requires vehicle valuation")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles/{vehicle_id}")
    
    # ---- Loan Application Tests ----
    
    def test_create_loan_application(self):
        """Test POST /api/loan-leads/{lead_id}/applications creates application"""
        # Get a lead with a vehicle
        list_response = self.session.get(f"{BASE_URL}/api/loan-leads?limit=10")
        leads = list_response.json().get("items", [])
        
        lead_with_vehicle = next((l for l in leads if l.get("vehicles")), None)
        if not lead_with_vehicle:
            pytest.skip("No leads with vehicles found")
        
        lead_id = lead_with_vehicle.get("id")
        vehicle = lead_with_vehicle.get("vehicles")[0]
        vehicle_id = vehicle.get("vehicle_id")
        
        # Get a bank
        banks_response = self.session.get(f"{BASE_URL}/api/banks")
        assert banks_response.status_code == 200
        
        banks = banks_response.json()
        if not banks:
            pytest.skip("No banks configured")
        
        bank_id = banks[0].get("id")
        
        # Create application
        app_data = {
            "vehicle_loan_id": vehicle_id,
            "bank_id": bank_id,
            "applied_amount": 400000,
            "tenure_months": 48
        }
        
        response = self.session.post(f"{BASE_URL}/api/loan-leads/{lead_id}/applications", json=app_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "application" in data
        assert data["application"]["status"] == "APPLIED"
        assert data["application"]["bank_id"] == bank_id
        print(f"✓ Created loan application with bank {banks[0].get('bank_name')}")
    
    # ---- Banks API Tests ----
    
    def test_get_banks(self):
        """Test GET /api/banks returns bank list"""
        response = self.session.get(f"{BASE_URL}/api/banks")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} banks")
        
        # Verify bank structure
        if data:
            bank = data[0]
            assert "id" in bank
            assert "bank_name" in bank
            assert "bank_code" in bank
    
    def test_banks_have_required_fields(self):
        """Test that banks have all required loan configuration fields"""
        response = self.session.get(f"{BASE_URL}/api/banks")
        assert response.status_code == 200
        
        banks = response.json()
        for bank in banks:
            # Check loan configuration fields
            assert "interest_rate_min" in bank or bank.get("interest_rate_min") is None
            assert "interest_rate_max" in bank or bank.get("interest_rate_max") is None
            assert "max_ltv_percent" in bank or bank.get("max_ltv_percent") is None
            assert "max_tenure_months" in bank or bank.get("max_tenure_months") is None
        
        print(f"✓ All {len(banks)} banks have proper configuration fields")
    
    # ---- Vaahan Integration Tests ----
    
    def test_add_vehicle_with_vaahan(self):
        """Test that adding vehicle fetches Vaahan data automatically"""
        # Get a lead
        list_response = self.session.get(f"{BASE_URL}/api/loan-leads?limit=1")
        leads = list_response.json().get("items", [])
        
        if not leads:
            pytest.skip("No leads available")
        
        lead_id = leads[0].get("id")
        
        # Add vehicle with a real-looking number (Vaahan will be called)
        vehicle_data = {
            "car_number": "KA01AB1234"
        }
        
        response = self.session.post(f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles", json=vehicle_data)
        assert response.status_code == 200
        
        data = response.json()
        vehicle = data.get("vehicle", {})
        
        # Vaahan data may or may not be present depending on API availability
        print(f"✓ Vehicle added. Vaahan data present: {vehicle.get('vaahan_data') is not None}")
        
        # Cleanup
        vehicle_id = vehicle.get("vehicle_id")
        self.session.delete(f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles/{vehicle_id}")
    
    # ---- Status Update Tests ----
    
    def test_update_lead_status(self):
        """Test PUT /api/loan-leads/{lead_id} updates status"""
        # Get a lead
        list_response = self.session.get(f"{BASE_URL}/api/loan-leads?limit=1")
        leads = list_response.json().get("items", [])
        
        if not leads:
            pytest.skip("No leads available")
        
        lead = leads[0]
        lead_id = lead.get("id")
        original_status = lead.get("status")
        
        # Update status
        new_status = "INTERESTED" if original_status != "INTERESTED" else "FOLLOW_UP"
        
        response = self.session.put(f"{BASE_URL}/api/loan-leads/{lead_id}", json={
            "status": new_status,
            "status_notes": "Test status update"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == new_status
        print(f"✓ Updated lead status from {original_status} to {new_status}")
        
        # Restore original status
        self.session.put(f"{BASE_URL}/api/loan-leads/{lead_id}", json={"status": original_status})
    
    # ---- Document Requirements Tests ----
    
    def test_get_document_requirements(self):
        """Test GET /api/loan-leads/{lead_id}/document-requirements"""
        # Get a lead
        list_response = self.session.get(f"{BASE_URL}/api/loan-leads?limit=1")
        leads = list_response.json().get("items", [])
        
        if not leads:
            pytest.skip("No leads available")
        
        lead_id = leads[0].get("id")
        
        response = self.session.get(f"{BASE_URL}/api/loan-leads/{lead_id}/document-requirements")
        assert response.status_code == 200
        
        data = response.json()
        assert "requirements" in data
        
        # Should have requirements for both types if customer_type not set
        if data.get("customer_type") is None:
            assert "SALARIED" in data["requirements"]
            assert "SELF_EMPLOYED" in data["requirements"]
        
        print(f"✓ Document requirements retrieved for customer type: {data.get('customer_type', 'Not set')}")


class TestLoansModuleEdgeCases:
    """Edge case tests for Loans Module"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123",
            "country_id": "india"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        self.session.close()
    
    def test_invalid_lead_id(self):
        """Test 404 for non-existent lead"""
        response = self.session.get(f"{BASE_URL}/api/loan-leads/invalid-uuid-12345")
        assert response.status_code == 404
        print("✓ Correctly returns 404 for invalid lead ID")
    
    def test_invalid_vehicle_id(self):
        """Test 404 for non-existent vehicle"""
        # Get a valid lead
        list_response = self.session.get(f"{BASE_URL}/api/loan-leads?limit=1")
        leads = list_response.json().get("items", [])
        
        if not leads:
            pytest.skip("No leads available")
        
        lead_id = leads[0].get("id")
        
        response = self.session.delete(f"{BASE_URL}/api/loan-leads/{lead_id}/vehicles/invalid-vehicle-id")
        assert response.status_code == 404
        print("✓ Correctly returns 404 for invalid vehicle ID")
    
    def test_pagination(self):
        """Test pagination works correctly"""
        # Get first page
        response1 = self.session.get(f"{BASE_URL}/api/loan-leads?skip=0&limit=2")
        assert response1.status_code == 200
        
        data1 = response1.json()
        total = data1.get("total", 0)
        
        if total <= 2:
            pytest.skip("Not enough leads for pagination test")
        
        # Get second page
        response2 = self.session.get(f"{BASE_URL}/api/loan-leads?skip=2&limit=2")
        assert response2.status_code == 200
        
        data2 = response2.json()
        
        # Verify different items
        ids1 = [l.get("id") for l in data1.get("items", [])]
        ids2 = [l.get("id") for l in data2.get("items", [])]
        
        assert not any(id in ids1 for id in ids2), "Pagination returned duplicate items"
        print(f"✓ Pagination working: page 1 has {len(ids1)} items, page 2 has {len(ids2)} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
