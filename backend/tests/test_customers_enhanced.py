"""
Test Enhanced Customers Page APIs
Tests the new Customer Details modal feature endpoints:
- GET /api/customers - Enriched with sales_rep_name, notes_count, total_paid, total_packages
- GET /api/customers/{id}/detailed-payments - Package-wise payment breakdown
- POST /api/customers/{id}/notes - Add a note
- GET /api/customers/{id}/notes - Get customer notes
- GET /api/customers/{id}/activities - Get customer activities
- PUT /api/customers/{id} - Update customer details
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomersEnhancedAPI:
    """Tests for Enhanced Customers Page feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as country head (India)
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "countryhead.in@wisedrive.com",
            "password": "password123"
        })
        
        if login_response.status_code != 200:
            # Try alternate login
            login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": "kalyan@wisedrive.com",
                "password": "password123"
            })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = login_response.json().get("user", {})
        
        # Get customers list
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200, f"Failed to get customers: {customers_response.text}"
        self.customers = customers_response.json()
    
    # ==================== GET /api/customers Tests ====================
    
    def test_get_customers_returns_enriched_data(self):
        """Test GET /api/customers returns enriched data with sales_rep_name, notes_count, etc."""
        response = self.session.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            customer = data[0]
            # Verify enriched fields exist
            assert "id" in customer
            assert "name" in customer
            assert "mobile" in customer
            assert "city" in customer
            assert "payment_status" in customer
            # New enriched fields
            assert "sales_rep_name" in customer, "Missing sales_rep_name field"
            assert "notes_count" in customer, "Missing notes_count field"
            assert "total_paid" in customer, "Missing total_paid field"
            assert "total_packages" in customer, "Missing total_packages field"
            assert "total_pending" in customer, "Missing total_pending field"
            
            # Verify data types
            assert isinstance(customer["notes_count"], int)
            assert isinstance(customer["total_paid"], (int, float))
            assert isinstance(customer["total_packages"], int)
            print(f"Customer enriched data verified: {customer['name']}, sales_rep: {customer['sales_rep_name']}, notes: {customer['notes_count']}, packages: {customer['total_packages']}")
    
    def test_get_customers_with_search_filter(self):
        """Test GET /api/customers with search parameter"""
        if len(self.customers) == 0:
            pytest.skip("No customers to test search")
        
        search_term = self.customers[0]["name"][:3]
        response = self.session.get(f"{BASE_URL}/api/customers", params={"search": search_term})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Search for '{search_term}' returned {len(data)} customers")
    
    def test_get_customers_with_city_filter(self):
        """Test GET /api/customers with city filter"""
        if len(self.customers) == 0:
            pytest.skip("No customers to test city filter")
        
        city = self.customers[0].get("city")
        if not city:
            pytest.skip("No city data available")
        
        response = self.session.get(f"{BASE_URL}/api/customers", params={"city": city})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # All returned customers should have the filtered city
        for customer in data:
            assert customer.get("city") == city
        print(f"City filter '{city}' returned {len(data)} customers")
    
    def test_get_customers_with_payment_status_filter(self):
        """Test GET /api/customers with payment_status filter"""
        response = self.session.get(f"{BASE_URL}/api/customers", params={"payment_status": "Completed"})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Payment status 'Completed' filter returned {len(data)} customers")
    
    # ==================== GET /api/customers/{id} Tests ====================
    
    def test_get_customer_by_id_success(self):
        """Test GET /api/customers/{id} returns customer details"""
        if len(self.customers) == 0:
            pytest.skip("No customers available")
        
        customer_id = self.customers[0]["id"]
        response = self.session.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == customer_id
        assert "name" in data
        assert "mobile" in data
        print(f"Got customer by ID: {data['name']}")
    
    def test_get_customer_by_id_not_found(self):
        """Test GET /api/customers/{id} returns 404 for non-existent customer"""
        fake_id = f"non-existent-{uuid.uuid4()}"
        response = self.session.get(f"{BASE_URL}/api/customers/{fake_id}")
        assert response.status_code == 404
    
    # ==================== GET /api/customers/{id}/detailed-payments Tests ====================
    
    def test_get_detailed_payments_success(self):
        """Test GET /api/customers/{id}/detailed-payments returns package-wise breakdown"""
        if len(self.customers) == 0:
            pytest.skip("No customers available")
        
        customer_id = self.customers[0]["id"]
        response = self.session.get(f"{BASE_URL}/api/customers/{customer_id}/detailed-payments")
        assert response.status_code == 200
        
        data = response.json()
        # Verify response structure
        assert "customer_id" in data
        assert "customer_name" in data
        assert "total_paid" in data
        assert "total_pending" in data
        assert "packages" in data
        assert isinstance(data["packages"], list)
        
        # If packages exist, verify package structure
        if len(data["packages"]) > 0:
            pkg = data["packages"][0]
            assert "inspection_id" in pkg
            assert "package_name" in pkg
            assert "amount_paid" in pkg
            assert "balance_due" in pkg
            assert "payment_status" in pkg
            assert "sales_rep_name" in pkg
            assert "payments" in pkg
            print(f"Detailed payments for {data['customer_name']}: {len(data['packages'])} packages, total_paid: {data['total_paid']}")
        else:
            print(f"Customer {data['customer_name']} has no packages")
    
    def test_get_detailed_payments_not_found(self):
        """Test GET /api/customers/{id}/detailed-payments returns 404 for non-existent customer"""
        fake_id = f"non-existent-{uuid.uuid4()}"
        response = self.session.get(f"{BASE_URL}/api/customers/{fake_id}/detailed-payments")
        assert response.status_code == 404
    
    # ==================== Notes API Tests ====================
    
    def test_add_note_success(self):
        """Test POST /api/customers/{id}/notes adds a note"""
        if len(self.customers) == 0:
            pytest.skip("No customers available")
        
        customer_id = self.customers[0]["id"]
        note_text = f"TEST_NOTE_{uuid.uuid4().hex[:8]}: This is a test note for customer"
        
        response = self.session.post(
            f"{BASE_URL}/api/customers/{customer_id}/notes",
            json={"note": note_text}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["customer_id"] == customer_id
        assert data["note"] == note_text
        assert "user_name" in data
        assert "created_at" in data
        print(f"Added note: {data['id']} by {data['user_name']}")
        
        # Store note ID for cleanup
        self.created_note_id = data["id"]
    
    def test_add_note_not_found(self):
        """Test POST /api/customers/{id}/notes returns 404 for non-existent customer"""
        fake_id = f"non-existent-{uuid.uuid4()}"
        response = self.session.post(
            f"{BASE_URL}/api/customers/{fake_id}/notes",
            json={"note": "Test note"}
        )
        assert response.status_code == 404
    
    def test_get_notes_success(self):
        """Test GET /api/customers/{id}/notes returns customer notes"""
        if len(self.customers) == 0:
            pytest.skip("No customers available")
        
        customer_id = self.customers[0]["id"]
        
        # First add a note
        note_text = f"TEST_NOTE_{uuid.uuid4().hex[:8]}: Test note for get"
        self.session.post(
            f"{BASE_URL}/api/customers/{customer_id}/notes",
            json={"note": note_text}
        )
        
        # Now get notes
        response = self.session.get(f"{BASE_URL}/api/customers/{customer_id}/notes")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            note = data[0]
            assert "id" in note
            assert "customer_id" in note
            assert "note" in note
            assert "user_name" in note
            assert "created_at" in note
            print(f"Got {len(data)} notes for customer")
    
    # ==================== Activities API Tests ====================
    
    def test_get_activities_success(self):
        """Test GET /api/customers/{id}/activities returns customer activities"""
        if len(self.customers) == 0:
            pytest.skip("No customers available")
        
        customer_id = self.customers[0]["id"]
        
        # First add a note to create an activity
        note_text = f"TEST_NOTE_{uuid.uuid4().hex[:8]}: Activity test note"
        self.session.post(
            f"{BASE_URL}/api/customers/{customer_id}/notes",
            json={"note": note_text}
        )
        
        # Now get activities
        response = self.session.get(f"{BASE_URL}/api/customers/{customer_id}/activities")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            activity = data[0]
            assert "id" in activity
            assert "customer_id" in activity
            assert "action" in activity
            assert "user_name" in activity
            assert "created_at" in activity
            print(f"Got {len(data)} activities for customer, latest action: {activity['action']}")
    
    # ==================== Update Customer Tests ====================
    
    def test_update_customer_success(self):
        """Test PUT /api/customers/{id} updates customer details"""
        if len(self.customers) == 0:
            pytest.skip("No customers available")
        
        customer_id = self.customers[0]["id"]
        original_name = self.customers[0]["name"]
        
        # Update customer
        update_data = {
            "name": f"TEST_UPDATED_{original_name}",
            "mobile": self.customers[0].get("mobile", "9999999999"),
            "city": self.customers[0].get("city", "Bangalore"),
            "email": f"test_{uuid.uuid4().hex[:6]}@test.com",
            "address": "Test Address 123"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/customers/{customer_id}",
            json=update_data
        )
        assert response.status_code == 200
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert get_response.status_code == 200
        updated_customer = get_response.json()
        
        assert updated_customer["name"] == update_data["name"]
        print(f"Updated customer name from '{original_name}' to '{updated_customer['name']}'")
        
        # Restore original name
        restore_data = {
            "name": original_name,
            "mobile": self.customers[0].get("mobile", "9999999999"),
            "city": self.customers[0].get("city", "Bangalore")
        }
        self.session.put(f"{BASE_URL}/api/customers/{customer_id}", json=restore_data)
    
    def test_update_customer_not_found(self):
        """Test PUT /api/customers/{id} returns 404 for non-existent customer"""
        fake_id = f"non-existent-{uuid.uuid4()}"
        response = self.session.put(
            f"{BASE_URL}/api/customers/{fake_id}",
            json={"name": "Test", "mobile": "1234567890", "city": "Test"}
        )
        assert response.status_code == 404


class TestCustomersUnauthorized:
    """Tests for unauthorized access to customer endpoints"""
    
    def test_get_customers_unauthorized(self):
        """Test GET /api/customers requires authentication"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code in [401, 403]
    
    def test_get_customer_notes_unauthorized(self):
        """Test GET /api/customers/{id}/notes requires authentication"""
        response = requests.get(f"{BASE_URL}/api/customers/test-id/notes")
        assert response.status_code in [401, 403]
    
    def test_add_customer_note_unauthorized(self):
        """Test POST /api/customers/{id}/notes requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/customers/test-id/notes",
            json={"note": "Test"}
        )
        assert response.status_code in [401, 403]
    
    def test_get_detailed_payments_unauthorized(self):
        """Test GET /api/customers/{id}/detailed-payments requires authentication"""
        response = requests.get(f"{BASE_URL}/api/customers/test-id/detailed-payments")
        assert response.status_code in [401, 403]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
