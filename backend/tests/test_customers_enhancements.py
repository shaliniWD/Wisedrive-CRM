"""
Test suite for Customers Page Enhancements - Iteration 54
Tests: Date filter, Sales Rep filter, seed-sample-data endpoint, sales-reps-with-counts endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomersEnhancements:
    """Test suite for enhanced customers page features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "countryhead.in@wisedrive.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    # ==================== Sales Reps with Counts API ====================
    
    def test_get_sales_reps_with_counts_success(self):
        """Test GET /api/customers/sales-reps-with-counts returns sales reps with customer counts"""
        response = requests.get(
            f"{BASE_URL}/api/customers/sales-reps-with-counts",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Each item should have id, name, and customer_count
        if len(data) > 0:
            rep = data[0]
            assert "id" in rep, "Sales rep should have id"
            assert "name" in rep, "Sales rep should have name"
            assert "customer_count" in rep, "Sales rep should have customer_count"
            assert isinstance(rep["customer_count"], int), "customer_count should be integer"
            print(f"✓ Found {len(data)} sales reps with customer counts")
            print(f"  First rep: {rep['name']} with {rep['customer_count']} customers")
    
    def test_sales_reps_with_counts_unauthorized(self):
        """Test GET /api/customers/sales-reps-with-counts requires authentication"""
        response = requests.get(f"{BASE_URL}/api/customers/sales-reps-with-counts")
        assert response.status_code == 401, "Should require authentication"
    
    # ==================== Seed Sample Data API ====================
    
    def test_seed_sample_data_success(self):
        """Test POST /api/customers/seed-sample-data creates demo customer with packages"""
        response = requests.post(
            f"{BASE_URL}/api/customers/seed-sample-data",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "customer_id" in data, "Response should have customer_id"
        assert "customer_name" in data, "Response should have customer_name"
        assert "inspections_created" in data, "Response should have inspections_created"
        assert "notes_created" in data, "Response should have notes_created"
        
        # Verify demo customer was created with expected data
        assert "Rahul Sharma" in data["customer_name"], "Customer name should contain 'Rahul Sharma'"
        assert data["inspections_created"] >= 3, "Should create at least 3 inspections/packages"
        assert data["notes_created"] >= 4, "Should create at least 4 notes"
        
        print(f"✓ Created demo customer: {data['customer_name']}")
        print(f"  Packages: {data['inspections_created']}, Notes: {data['notes_created']}")
    
    def test_seed_sample_data_unauthorized(self):
        """Test POST /api/customers/seed-sample-data requires authentication"""
        response = requests.post(f"{BASE_URL}/api/customers/seed-sample-data")
        assert response.status_code == 401, "Should require authentication"
    
    # ==================== Customers List with Date Filter ====================
    
    def test_customers_list_with_date_filter(self):
        """Test GET /api/customers with date_from and date_to filters"""
        # Test with date range
        response = requests.get(
            f"{BASE_URL}/api/customers",
            headers=self.headers,
            params={"date_from": "2026-01-01", "date_to": "2026-12-31"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Date filter returned {len(data)} customers")
    
    def test_customers_list_with_sales_rep_filter(self):
        """Test GET /api/customers with sales_rep_id filter"""
        # First get a sales rep ID
        reps_response = requests.get(
            f"{BASE_URL}/api/customers/sales-reps-with-counts",
            headers=self.headers
        )
        
        if reps_response.status_code == 200 and len(reps_response.json()) > 0:
            rep_id = reps_response.json()[0]["id"]
            
            # Test with sales rep filter
            response = requests.get(
                f"{BASE_URL}/api/customers",
                headers=self.headers,
                params={"sales_rep_id": rep_id}
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            
            data = response.json()
            assert isinstance(data, list), "Response should be a list"
            print(f"✓ Sales rep filter returned {len(data)} customers")
        else:
            pytest.skip("No sales reps available for testing")
    
    # ==================== Customer Details with Packages ====================
    
    def test_customer_detailed_payments_with_packages(self):
        """Test GET /api/customers/{id}/detailed-payments returns packages with transactions"""
        # First get a customer with packages (search for demo customer)
        customers_response = requests.get(
            f"{BASE_URL}/api/customers",
            headers=self.headers,
            params={"search": "Rahul Sharma"}
        )
        
        if customers_response.status_code == 200 and len(customers_response.json()) > 0:
            customer_id = customers_response.json()[0]["id"]
            
            # Get detailed payments
            response = requests.get(
                f"{BASE_URL}/api/customers/{customer_id}/detailed-payments",
                headers=self.headers
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            
            data = response.json()
            assert "packages" in data, "Response should have packages"
            assert "summary" in data, "Response should have summary"
            
            packages = data["packages"]
            if len(packages) > 0:
                pkg = packages[0]
                assert "package_name" in pkg, "Package should have package_name"
                assert "payment_status" in pkg, "Package should have payment_status"
                assert "payments" in pkg, "Package should have payments array"
                
                # Check payment transaction structure
                if len(pkg["payments"]) > 0:
                    payment = pkg["payments"][0]
                    assert "amount" in payment, "Payment should have amount"
                    assert "status" in payment, "Payment should have status"
                    assert "date" in payment, "Payment should have date"
                    print(f"✓ Found {len(packages)} packages with payment transactions")
        else:
            pytest.skip("No demo customer found for testing")
    
    # ==================== Customer Notes ====================
    
    def test_customer_notes_list(self):
        """Test GET /api/customers/{id}/notes returns notes with user info"""
        # Get a customer with notes
        customers_response = requests.get(
            f"{BASE_URL}/api/customers",
            headers=self.headers,
            params={"search": "Rahul Sharma"}
        )
        
        if customers_response.status_code == 200 and len(customers_response.json()) > 0:
            customer_id = customers_response.json()[0]["id"]
            
            # Get notes
            response = requests.get(
                f"{BASE_URL}/api/customers/{customer_id}/notes",
                headers=self.headers
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            
            data = response.json()
            assert isinstance(data, list), "Response should be a list"
            
            if len(data) > 0:
                note = data[0]
                assert "note" in note, "Note should have note content"
                assert "user_name" in note, "Note should have user_name"
                assert "created_at" in note, "Note should have created_at"
                print(f"✓ Found {len(data)} notes for customer")
        else:
            pytest.skip("No demo customer found for testing")
    
    # ==================== Customer Activities ====================
    
    def test_customer_activities_list(self):
        """Test GET /api/customers/{id}/activities returns activity log"""
        # Get a customer
        customers_response = requests.get(
            f"{BASE_URL}/api/customers",
            headers=self.headers,
            params={"search": "Rahul Sharma"}
        )
        
        if customers_response.status_code == 200 and len(customers_response.json()) > 0:
            customer_id = customers_response.json()[0]["id"]
            
            # Get activities
            response = requests.get(
                f"{BASE_URL}/api/customers/{customer_id}/activities",
                headers=self.headers
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            
            data = response.json()
            assert isinstance(data, list), "Response should be a list"
            print(f"✓ Found {len(data)} activities for customer")
        else:
            pytest.skip("No demo customer found for testing")
    
    # ==================== Customer Update (Edit) ====================
    
    def test_customer_update_success(self):
        """Test PUT /api/customers/{id} updates customer details"""
        # Get a customer
        customers_response = requests.get(
            f"{BASE_URL}/api/customers",
            headers=self.headers
        )
        
        if customers_response.status_code == 200 and len(customers_response.json()) > 0:
            customer = customers_response.json()[0]
            customer_id = customer["id"]
            original_name = customer.get("name", "")
            
            # Update customer
            update_data = {
                "name": f"TEST_UPDATE_{original_name}",
                "mobile": customer.get("mobile", ""),
                "city": customer.get("city", ""),
            }
            
            response = requests.put(
                f"{BASE_URL}/api/customers/{customer_id}",
                headers=self.headers,
                json=update_data
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            
            # Verify update
            updated = response.json()
            assert "TEST_UPDATE_" in updated.get("name", ""), "Name should be updated"
            
            # Revert the change
            revert_data = {
                "name": original_name,
                "mobile": customer.get("mobile", ""),
                "city": customer.get("city", ""),
            }
            requests.put(
                f"{BASE_URL}/api/customers/{customer_id}",
                headers=self.headers,
                json=revert_data
            )
            print(f"✓ Customer update successful")
        else:
            pytest.skip("No customers found for testing")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
