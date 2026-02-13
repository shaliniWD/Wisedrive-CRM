"""
Test Customer Details and Transactions APIs
Tests the new Customer Details modal feature endpoints:
- GET /api/customers/{customer_id} - Get single customer by ID
- GET /api/transactions/{customer_id} - Get transactions for a customer
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomerDetailsAPI:
    """Tests for Customer Details modal feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@wisedrive.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get customers list
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        self.customers = customers_response.json()
        assert len(self.customers) > 0, "No customers found in database"
    
    def test_login_success(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@wisedrive.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@wisedrive.com"
        assert data["user"]["role"] == "admin"
    
    def test_get_customer_by_id_success(self):
        """Test GET /api/customers/{customer_id} returns customer details"""
        customer_id = self.customers[0]["id"]
        
        response = self.session.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert response.status_code == 200
        
        data = response.json()
        # Verify customer data structure
        assert "id" in data
        assert "name" in data
        assert "mobile" in data
        assert "city" in data
        assert "payment_status" in data
        assert data["id"] == customer_id
    
    def test_get_customer_by_id_not_found(self):
        """Test GET /api/customers/{customer_id} returns 404 for non-existent customer"""
        fake_id = "non-existent-customer-id-12345"
        
        response = self.session.get(f"{BASE_URL}/api/customers/{fake_id}")
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    def test_get_customer_transactions_success(self):
        """Test GET /api/transactions/{customer_id} returns transactions"""
        # Find a customer with transactions (Customer 1-10 have transactions)
        customer_with_txn = None
        for customer in self.customers:
            if "Customer 1" in customer["name"] or "Customer 2" in customer["name"]:
                customer_with_txn = customer
                break
        
        if not customer_with_txn:
            # Use first customer and check if they have transactions
            customer_with_txn = self.customers[0]
        
        customer_id = customer_with_txn["id"]
        response = self.session.get(f"{BASE_URL}/api/transactions/{customer_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_customer_transactions_with_data(self):
        """Test transactions endpoint returns proper transaction data structure"""
        # Find Customer 10 which has 3 transactions
        customer_10 = None
        for customer in self.customers:
            if customer["name"] == "Customer 10":
                customer_10 = customer
                break
        
        if not customer_10:
            pytest.skip("Customer 10 not found - skipping transaction data test")
        
        response = self.session.get(f"{BASE_URL}/api/transactions/{customer_10['id']}")
        assert response.status_code == 200
        
        transactions = response.json()
        assert len(transactions) > 0, "Customer 10 should have transactions"
        
        # Verify transaction data structure
        txn = transactions[0]
        assert "id" in txn
        assert "customer_id" in txn
        assert "transaction_type" in txn
        assert "order_id" in txn
        assert "amount" in txn
        assert "payment_status" in txn
        assert "car_number" in txn
        assert "car_make" in txn
        assert "car_model" in txn
        assert "car_year" in txn
        assert "payment_date" in txn
        
        # Verify customer_id matches
        assert txn["customer_id"] == customer_10["id"]
    
    def test_get_customer_transactions_empty(self):
        """Test transactions endpoint returns empty list for customer without transactions"""
        # Find a customer without transactions (Customer 11-15)
        customer_no_txn = None
        for customer in self.customers:
            if "Customer 1" in customer["name"] and len(customer["name"]) > 10:
                # Customer 11, 12, 13, 14, 15
                customer_no_txn = customer
                break
        
        if not customer_no_txn:
            pytest.skip("No customer without transactions found")
        
        response = self.session.get(f"{BASE_URL}/api/transactions/{customer_no_txn['id']}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0, f"Expected empty transactions for {customer_no_txn['name']}"
    
    def test_get_customers_list(self):
        """Test GET /api/customers returns list of customers"""
        response = self.session.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify customer structure
        customer = data[0]
        assert "id" in customer
        assert "name" in customer
        assert "mobile" in customer
        assert "city" in customer
        assert "payment_status" in customer
    
    def test_unauthorized_access_customer_by_id(self):
        """Test GET /api/customers/{customer_id} requires authentication"""
        customer_id = self.customers[0]["id"]
        
        # Make request without auth header
        response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
        assert response.status_code in [401, 403]
    
    def test_unauthorized_access_transactions(self):
        """Test GET /api/transactions/{customer_id} requires authentication"""
        customer_id = self.customers[0]["id"]
        
        # Make request without auth header
        response = requests.get(f"{BASE_URL}/api/transactions/{customer_id}")
        assert response.status_code in [401, 403]


class TestTransactionCreation:
    """Tests for creating transactions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@wisedrive.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get customers list
        customers_response = self.session.get(f"{BASE_URL}/api/customers")
        self.customers = customers_response.json()
    
    def test_create_transaction_success(self):
        """Test POST /api/transactions creates a new transaction"""
        customer_id = self.customers[0]["id"]
        
        txn_data = {
            "customer_id": customer_id,
            "transaction_type": "Gold",
            "order_id": "TEST_ORD123456",
            "amount": 1999,
            "payment_date": "2026-02-13",
            "payment_status": "Completed",
            "car_number": "KA01TEST1234",
            "car_make": "Honda",
            "car_model": "City",
            "car_year": "2023"
        }
        
        response = self.session.post(f"{BASE_URL}/api/transactions", json=txn_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["customer_id"] == customer_id
        assert data["transaction_type"] == "Gold"
        assert data["order_id"] == "TEST_ORD123456"
        assert data["amount"] == 1999
        
        # Verify transaction was persisted
        get_response = self.session.get(f"{BASE_URL}/api/transactions/{customer_id}")
        assert get_response.status_code == 200
        transactions = get_response.json()
        
        # Find our created transaction
        created_txn = next((t for t in transactions if t["order_id"] == "TEST_ORD123456"), None)
        assert created_txn is not None, "Created transaction not found in customer's transactions"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
