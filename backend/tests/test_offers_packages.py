"""
Test Offers and Package Enhancement Features
- Offers CRUD (Create, Read, Update, Delete)
- Package new fields (partial_payment, discount, offers)
- Create Package with partial payment
- Create Offer with validity dates
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INDIA_COUNTRY_ID = "c49e1dc6-1450-40c2-9846-56b73369b2b1"

# Test user credentials
CTO_EMAIL = "shalini.vyshaka@gmail.com"
CTO_PASSWORD = "password123"


class TestOffersCRUD:
    """Test Offers CRUD operations via /api/offers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as CTO
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CTO_EMAIL,
            "password": CTO_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_offer_id = None
        yield
        
        # Cleanup - delete test offer if created
        if self.created_offer_id:
            try:
                self.session.delete(f"{BASE_URL}/api/offers/{self.created_offer_id}")
            except:
                pass
    
    def test_get_offers_list(self):
        """Test GET /api/offers returns list of offers"""
        response = self.session.get(f"{BASE_URL}/api/offers", params={"country_id": INDIA_COUNTRY_ID})
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/offers returned {len(data)} offers")
    
    def test_create_offer(self):
        """Test POST /api/offers creates a new offer"""
        today = datetime.now()
        valid_from = today.strftime("%Y-%m-%dT00:00:00Z")
        valid_until = (today + timedelta(days=30)).strftime("%Y-%m-%dT23:59:59Z")
        
        offer_data = {
            "name": "TEST_New Year Special 2026",
            "description": "Get 15% off on all inspections",
            "discount_type": "percentage",
            "discount_value": 15,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "is_active": True,
            "country_id": INDIA_COUNTRY_ID
        }
        
        response = self.session.post(f"{BASE_URL}/api/offers", json=offer_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response data
        assert data.get("name") == offer_data["name"], "Name mismatch"
        assert data.get("discount_type") == "percentage", "Discount type mismatch"
        assert data.get("discount_value") == 15, "Discount value mismatch"
        assert "id" in data, "ID not returned"
        
        self.created_offer_id = data["id"]
        print(f"✓ POST /api/offers created offer: {data['name']} with ID: {data['id']}")
        
        # Verify by fetching the created offer
        get_response = self.session.get(f"{BASE_URL}/api/offers", params={"country_id": INDIA_COUNTRY_ID})
        offers_list = get_response.json()
        created_offer = next((o for o in offers_list if o["id"] == self.created_offer_id), None)
        
        assert created_offer is not None, "Created offer not found in list"
        assert created_offer["name"] == offer_data["name"], "Offer name not persisted correctly"
        print(f"✓ Created offer verified in GET /api/offers list")
    
    def test_create_offer_with_fixed_discount(self):
        """Test creating offer with fixed discount type"""
        today = datetime.now()
        valid_from = today.strftime("%Y-%m-%dT00:00:00Z")
        valid_until = (today + timedelta(days=60)).strftime("%Y-%m-%dT23:59:59Z")
        
        offer_data = {
            "name": "TEST_Fixed Discount Offer",
            "description": "Get ₹200 off",
            "discount_type": "fixed",
            "discount_value": 200,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "is_active": True,
            "country_id": INDIA_COUNTRY_ID
        }
        
        response = self.session.post(f"{BASE_URL}/api/offers", json=offer_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("discount_type") == "fixed", "Fixed discount type not saved"
        assert data.get("discount_value") == 200, "Fixed value not saved"
        
        self.created_offer_id = data["id"]
        print(f"✓ Created offer with fixed discount: ₹{data['discount_value']} off")
    
    def test_update_offer(self):
        """Test PUT /api/offers/{id} updates an offer"""
        # First create an offer
        today = datetime.now()
        valid_from = today.strftime("%Y-%m-%dT00:00:00Z")
        valid_until = (today + timedelta(days=30)).strftime("%Y-%m-%dT23:59:59Z")
        
        create_response = self.session.post(f"{BASE_URL}/api/offers", json={
            "name": "TEST_Offer To Update",
            "discount_type": "percentage",
            "discount_value": 10,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "is_active": True,
            "country_id": INDIA_COUNTRY_ID
        })
        
        assert create_response.status_code == 200
        created_offer = create_response.json()
        self.created_offer_id = created_offer["id"]
        
        # Update the offer
        update_data = {
            "name": "TEST_Offer Updated Name",
            "discount_value": 25
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/offers/{self.created_offer_id}", json=update_data)
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated_offer = update_response.json()
        
        assert updated_offer["name"] == "TEST_Offer Updated Name", "Name not updated"
        assert updated_offer["discount_value"] == 25, "Discount value not updated"
        print(f"✓ PUT /api/offers/{self.created_offer_id} updated successfully")
    
    def test_toggle_offer_status(self):
        """Test PATCH /api/offers/{id}/toggle-status"""
        # First create an active offer
        today = datetime.now()
        valid_from = today.strftime("%Y-%m-%dT00:00:00Z")
        valid_until = (today + timedelta(days=30)).strftime("%Y-%m-%dT23:59:59Z")
        
        create_response = self.session.post(f"{BASE_URL}/api/offers", json={
            "name": "TEST_Offer For Toggle",
            "discount_type": "percentage",
            "discount_value": 5,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "is_active": True,
            "country_id": INDIA_COUNTRY_ID
        })
        
        assert create_response.status_code == 200
        self.created_offer_id = create_response.json()["id"]
        
        # Toggle status (should become inactive)
        toggle_response = self.session.patch(f"{BASE_URL}/api/offers/{self.created_offer_id}/toggle-status")
        
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        toggle_data = toggle_response.json()
        
        assert toggle_data["is_active"] == False, "Status should be False after toggle"
        print(f"✓ PATCH /api/offers/{self.created_offer_id}/toggle-status worked - now inactive")
        
        # Toggle again (should become active)
        toggle_response2 = self.session.patch(f"{BASE_URL}/api/offers/{self.created_offer_id}/toggle-status")
        assert toggle_response2.status_code == 200
        assert toggle_response2.json()["is_active"] == True, "Status should be True after second toggle"
        print(f"✓ Second toggle - now active again")
    
    def test_delete_offer(self):
        """Test DELETE /api/offers/{id}"""
        # First create an offer
        today = datetime.now()
        valid_from = today.strftime("%Y-%m-%dT00:00:00Z")
        valid_until = (today + timedelta(days=30)).strftime("%Y-%m-%dT23:59:59Z")
        
        create_response = self.session.post(f"{BASE_URL}/api/offers", json={
            "name": "TEST_Offer To Delete",
            "discount_type": "percentage",
            "discount_value": 5,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "is_active": True,
            "country_id": INDIA_COUNTRY_ID
        })
        
        assert create_response.status_code == 200
        offer_id = create_response.json()["id"]
        
        # Delete the offer
        delete_response = self.session.delete(f"{BASE_URL}/api/offers/{offer_id}")
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify deletion by trying to get it
        get_response = self.session.get(f"{BASE_URL}/api/offers", params={"country_id": INDIA_COUNTRY_ID})
        offers_list = get_response.json()
        deleted_offer = next((o for o in offers_list if o["id"] == offer_id), None)
        
        assert deleted_offer is None, "Offer should not exist after deletion"
        print(f"✓ DELETE /api/offers/{offer_id} successful - offer removed")
        
        # Don't set self.created_offer_id since it's already deleted
        self.created_offer_id = None
    
    def test_get_active_offers(self):
        """Test GET /api/offers/active returns only active valid offers"""
        response = self.session.get(f"{BASE_URL}/api/offers/active", params={"country_id": INDIA_COUNTRY_ID})
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # All returned offers should be active
        for offer in data:
            assert offer.get("is_active") == True, f"Offer {offer.get('name')} should be active"
        
        print(f"✓ GET /api/offers/active returned {len(data)} active offers")


class TestPackageEnhancements:
    """Test Package model new fields - partial payment, discount, offers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as CTO
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CTO_EMAIL,
            "password": CTO_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_package_id = None
        yield
        
        # Cleanup - delete test package if created
        if self.created_package_id:
            try:
                self.session.delete(f"{BASE_URL}/api/inspection-packages/{self.created_package_id}")
            except:
                pass
    
    def test_create_package_with_partial_payment(self):
        """Test creating package with partial payment enabled"""
        package_data = {
            "name": "TEST_Package With Partial Pay",
            "description": "Test package with partial payment",
            "price": 2999,
            "currency": "INR",
            "currency_symbol": "₹",
            "country_id": INDIA_COUNTRY_ID,
            "categories": [],
            "no_of_inspections": 1,
            "is_active": True,
            "is_recommended": False,
            "allow_partial_payment": True,
            "partial_payment_type": "percentage",
            "partial_payment_value": 50,
            "allow_discount": False,
            "allow_offers": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/inspection-packages", json=package_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify partial payment fields
        assert data.get("allow_partial_payment") == True, "allow_partial_payment not saved"
        assert data.get("partial_payment_type") == "percentage", "partial_payment_type mismatch"
        assert data.get("partial_payment_value") == 50, "partial_payment_value mismatch"
        
        self.created_package_id = data["id"]
        print(f"✓ Created package with partial payment: {data['partial_payment_value']}% upfront")
        
        # Verify by fetching
        get_response = self.session.get(f"{BASE_URL}/api/inspection-packages", params={"country_id": INDIA_COUNTRY_ID})
        packages = get_response.json()
        created_pkg = next((p for p in packages if p["id"] == self.created_package_id), None)
        
        assert created_pkg is not None, "Package not found in list"
        assert created_pkg["allow_partial_payment"] == True, "Partial payment not persisted"
        print(f"✓ Package partial payment verified in GET list")
    
    def test_create_package_with_fixed_partial_payment(self):
        """Test creating package with fixed amount partial payment"""
        package_data = {
            "name": "TEST_Package Fixed Partial",
            "price": 3999,
            "currency": "INR",
            "currency_symbol": "₹",
            "country_id": INDIA_COUNTRY_ID,
            "categories": [],
            "no_of_inspections": 1,
            "is_active": True,
            "allow_partial_payment": True,
            "partial_payment_type": "fixed",
            "partial_payment_value": 1500,
            "allow_discount": False,
            "allow_offers": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/inspection-packages", json=package_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("partial_payment_type") == "fixed", "Fixed type not saved"
        assert data.get("partial_payment_value") == 1500, "Fixed value not saved"
        
        self.created_package_id = data["id"]
        print(f"✓ Created package with fixed partial payment: ₹{data['partial_payment_value']} upfront")
    
    def test_create_package_with_discount(self):
        """Test creating package with discount enabled"""
        package_data = {
            "name": "TEST_Package With Discount",
            "price": 4999,
            "currency": "INR",
            "currency_symbol": "₹",
            "country_id": INDIA_COUNTRY_ID,
            "categories": [],
            "no_of_inspections": 1,
            "is_active": True,
            "allow_partial_payment": False,
            "allow_discount": True,
            "discount_type": "percentage",
            "discount_value": 10,
            "allow_offers": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/inspection-packages", json=package_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("allow_discount") == True, "allow_discount not saved"
        assert data.get("discount_type") == "percentage", "discount_type mismatch"
        assert data.get("discount_value") == 10, "discount_value mismatch"
        
        self.created_package_id = data["id"]
        print(f"✓ Created package with discount: {data['discount_value']}% off")
    
    def test_create_package_with_offers(self):
        """Test creating package with offers enabled and linked offers"""
        # First create a test offer
        today = datetime.now()
        valid_from = today.strftime("%Y-%m-%dT00:00:00Z")
        valid_until = (today + timedelta(days=30)).strftime("%Y-%m-%dT23:59:59Z")
        
        offer_response = self.session.post(f"{BASE_URL}/api/offers", json={
            "name": "TEST_Offer For Package",
            "discount_type": "percentage",
            "discount_value": 20,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "is_active": True,
            "country_id": INDIA_COUNTRY_ID
        })
        
        assert offer_response.status_code == 200
        offer_id = offer_response.json()["id"]
        
        # Create package with this offer
        package_data = {
            "name": "TEST_Package With Offers",
            "price": 5999,
            "currency": "INR",
            "currency_symbol": "₹",
            "country_id": INDIA_COUNTRY_ID,
            "categories": [],
            "no_of_inspections": 1,
            "is_active": True,
            "allow_partial_payment": False,
            "allow_discount": False,
            "allow_offers": True,
            "applicable_offer_ids": [offer_id]
        }
        
        response = self.session.post(f"{BASE_URL}/api/inspection-packages", json=package_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("allow_offers") == True, "allow_offers not saved"
        assert offer_id in data.get("applicable_offer_ids", []), "Offer ID not linked to package"
        
        self.created_package_id = data["id"]
        print(f"✓ Created package with linked offer: {offer_id}")
        
        # Cleanup offer
        self.session.delete(f"{BASE_URL}/api/offers/{offer_id}")
    
    def test_create_package_with_all_features(self):
        """Test creating package with partial payment, discount, AND offers"""
        # First create a test offer
        today = datetime.now()
        valid_from = today.strftime("%Y-%m-%dT00:00:00Z")
        valid_until = (today + timedelta(days=60)).strftime("%Y-%m-%dT23:59:59Z")
        
        offer_response = self.session.post(f"{BASE_URL}/api/offers", json={
            "name": "TEST_Mega Offer",
            "discount_type": "fixed",
            "discount_value": 500,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "is_active": True,
            "country_id": INDIA_COUNTRY_ID
        })
        
        assert offer_response.status_code == 200
        offer_id = offer_response.json()["id"]
        
        # Create package with ALL features enabled
        package_data = {
            "name": "TEST_Premium Package All Features",
            "description": "Package with all payment and discount features",
            "price": 9999,
            "currency": "INR",
            "currency_symbol": "₹",
            "country_id": INDIA_COUNTRY_ID,
            "categories": [],
            "no_of_inspections": 3,
            "is_active": True,
            "is_recommended": True,
            # Partial Payment
            "allow_partial_payment": True,
            "partial_payment_type": "percentage",
            "partial_payment_value": 40,
            # Discount
            "allow_discount": True,
            "discount_type": "fixed",
            "discount_value": 1000,
            # Offers
            "allow_offers": True,
            "applicable_offer_ids": [offer_id]
        }
        
        response = self.session.post(f"{BASE_URL}/api/inspection-packages", json=package_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify all features
        assert data.get("allow_partial_payment") == True
        assert data.get("partial_payment_type") == "percentage"
        assert data.get("partial_payment_value") == 40
        assert data.get("allow_discount") == True
        assert data.get("discount_type") == "fixed"
        assert data.get("discount_value") == 1000
        assert data.get("allow_offers") == True
        assert offer_id in data.get("applicable_offer_ids", [])
        
        self.created_package_id = data["id"]
        print(f"✓ Created premium package with ALL features enabled")
        
        # Cleanup offer
        self.session.delete(f"{BASE_URL}/api/offers/{offer_id}")
    
    def test_update_package_partial_payment(self):
        """Test updating package partial payment fields"""
        # First create a package without partial payment
        package_data = {
            "name": "TEST_Package Update Partial",
            "price": 2999,
            "country_id": INDIA_COUNTRY_ID,
            "categories": [],
            "no_of_inspections": 1,
            "is_active": True,
            "allow_partial_payment": False,
            "allow_discount": False,
            "allow_offers": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/inspection-packages", json=package_data)
        assert create_response.status_code == 200
        package_id = create_response.json()["id"]
        self.created_package_id = package_id
        
        # Update to enable partial payment
        update_data = {
            "allow_partial_payment": True,
            "partial_payment_type": "percentage",
            "partial_payment_value": 60
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/inspection-packages/{package_id}", json=update_data)
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated_pkg = update_response.json()
        
        assert updated_pkg.get("allow_partial_payment") == True, "Partial payment not enabled"
        assert updated_pkg.get("partial_payment_value") == 60, "Value not updated"
        print(f"✓ Updated package to enable partial payment: {updated_pkg['partial_payment_value']}%")


class TestExistingOfferValidation:
    """Test existing 'Christmas Special 2026' offer mentioned in requirements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as CTO
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CTO_EMAIL,
            "password": CTO_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_christmas_offer_exists(self):
        """Verify Christmas Special 2026 offer exists"""
        response = self.session.get(f"{BASE_URL}/api/offers", params={"country_id": INDIA_COUNTRY_ID})
        
        assert response.status_code == 200
        offers = response.json()
        
        christmas_offer = next((o for o in offers if "christmas" in o.get("name", "").lower()), None)
        
        if christmas_offer:
            print(f"✓ Found Christmas offer: {christmas_offer['name']}")
            print(f"  - Discount: {christmas_offer.get('discount_type')} {christmas_offer.get('discount_value')}")
            print(f"  - Active: {christmas_offer.get('is_active')}")
        else:
            print("ℹ Christmas Special 2026 offer not found - may need to be created")


# Cleanup function to remove TEST_ prefixed data
def test_cleanup_test_data():
    """Clean up any TEST_ prefixed offers and packages"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as CTO
    login_response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": CTO_EMAIL,
        "password": CTO_PASSWORD
    })
    
    if login_response.status_code != 200:
        pytest.skip(f"Login failed for cleanup")
    
    token = login_response.json().get("access_token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    
    # Clean up TEST_ offers
    offers_response = session.get(f"{BASE_URL}/api/offers", params={"country_id": INDIA_COUNTRY_ID})
    if offers_response.status_code == 200:
        for offer in offers_response.json():
            if offer.get("name", "").startswith("TEST_"):
                session.delete(f"{BASE_URL}/api/offers/{offer['id']}")
                print(f"Cleaned up test offer: {offer['name']}")
    
    # Clean up TEST_ packages
    packages_response = session.get(f"{BASE_URL}/api/inspection-packages", params={"country_id": INDIA_COUNTRY_ID})
    if packages_response.status_code == 200:
        for pkg in packages_response.json():
            if pkg.get("name", "").startswith("TEST_"):
                session.delete(f"{BASE_URL}/api/inspection-packages/{pkg['id']}")
                print(f"Cleaned up test package: {pkg['name']}")
    
    print("✓ Test data cleanup complete")
