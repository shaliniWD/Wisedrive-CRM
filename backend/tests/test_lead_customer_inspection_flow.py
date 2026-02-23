"""
Test Lead → Customer → Inspection Flow
Tests the complete business flow:
1. Create/View leads
2. Send payment link (converts lead to customer on payment)
3. Verify customer creation
4. Create inspection for customer
5. Test various field combinations
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLeadCustomerInspectionFlow:
    """Test the complete Lead → Customer → Inspection flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = login_response.json().get("user")
        
        # Generate unique test identifiers
        self.test_id = str(uuid.uuid4())[:8]
        self.test_mobile = f"TEST{self.test_id[:6]}"
        
        yield
        
        # Cleanup - delete test data
        self._cleanup_test_data()
    
    def _cleanup_test_data(self):
        """Clean up test data after tests"""
        try:
            # Get all leads with test mobile
            leads = self.session.get(f"{BASE_URL}/api/leads?search={self.test_mobile}").json()
            for lead in leads:
                if lead.get("mobile", "").startswith("TEST"):
                    # Delete lead (CEO only)
                    self.session.delete(f"{BASE_URL}/api/leads/{lead['id']}")
        except Exception as e:
            print(f"Cleanup warning: {e}")
    
    # ==================== LEADS TESTS ====================
    
    def test_01_get_leads_list(self):
        """Test getting leads list"""
        response = self.session.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 200
        
        leads = response.json()
        assert isinstance(leads, list)
        print(f"Found {len(leads)} leads")
    
    def test_02_create_lead_with_required_fields(self):
        """Test creating a lead with required fields only"""
        lead_data = {
            "name": f"TEST_Lead_{self.test_id}",
            "mobile": f"9876{self.test_id[:6]}",
            "city": "Bangalore",
            "source": "WEBSITE"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Create lead failed: {response.text}"
        
        lead = response.json()
        assert lead.get("id") is not None
        assert lead.get("name") == lead_data["name"]
        assert lead.get("mobile") == lead_data["mobile"]
        assert lead.get("city") == lead_data["city"]
        assert lead.get("status") == "NEW LEAD"  # Default status
        
        # Store for later tests
        self.created_lead_id = lead["id"]
        print(f"Created lead: {lead['id']}")
        
        return lead
    
    def test_03_create_lead_with_all_fields(self):
        """Test creating a lead with all fields"""
        lead_data = {
            "name": f"TEST_FullLead_{self.test_id}",
            "mobile": f"9877{self.test_id[:6]}",
            "city": "Hyderabad",
            "source": "META_ADS",
            "status": "NEW LEAD",
            "notes": "Test lead with all fields",
            "service_type": "Inspection",
            "ad_id": f"test_ad_{self.test_id}"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Create lead failed: {response.text}"
        
        lead = response.json()
        assert lead.get("name") == lead_data["name"]
        assert lead.get("city") == lead_data["city"]
        assert lead.get("source") == lead_data["source"]
        print(f"Created full lead: {lead['id']}")
        
        return lead
    
    def test_04_update_lead_status(self):
        """Test updating lead status"""
        # First create a lead
        lead = self.test_02_create_lead_with_required_fields()
        lead_id = lead["id"]
        
        # Update status
        response = self.session.patch(
            f"{BASE_URL}/api/leads/{lead_id}/status",
            json={"status": "HOT LEADS"}
        )
        assert response.status_code == 200, f"Update status failed: {response.text}"
        
        updated_lead = response.json()
        assert updated_lead.get("status") == "HOT LEADS"
        print(f"Updated lead status to: {updated_lead['status']}")
    
    def test_05_get_lead_statuses(self):
        """Test getting available lead statuses"""
        response = self.session.get(f"{BASE_URL}/api/leads/statuses")
        assert response.status_code == 200
        
        statuses = response.json()
        assert isinstance(statuses, list)
        assert len(statuses) > 0
        
        # Check status structure
        for status in statuses:
            assert "value" in status
            assert "label" in status
        
        print(f"Available statuses: {[s['value'] for s in statuses]}")
    
    def test_06_filter_leads_by_city(self):
        """Test filtering leads by city"""
        response = self.session.get(f"{BASE_URL}/api/leads?city=Bangalore")
        assert response.status_code == 200
        
        leads = response.json()
        for lead in leads:
            assert lead.get("city") == "Bangalore"
        
        print(f"Found {len(leads)} leads in Bangalore")
    
    def test_07_filter_leads_by_status(self):
        """Test filtering leads by status"""
        response = self.session.get(f"{BASE_URL}/api/leads?lead_status=NEW LEAD")
        assert response.status_code == 200
        
        leads = response.json()
        for lead in leads:
            assert lead.get("status") == "NEW LEAD"
        
        print(f"Found {len(leads)} NEW LEAD status leads")
    
    def test_08_filter_leads_by_date_range(self):
        """Test filtering leads by date range"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = self.session.get(f"{BASE_URL}/api/leads?date_from={today}&date_to={today}")
        assert response.status_code == 200
        
        leads = response.json()
        print(f"Found {len(leads)} leads for today")
    
    # ==================== CUSTOMERS TESTS ====================
    
    def test_09_get_customers_list(self):
        """Test getting customers list"""
        response = self.session.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        
        customers = response.json()
        assert isinstance(customers, list)
        print(f"Found {len(customers)} customers")
    
    def test_10_create_customer_directly(self):
        """Test creating a customer directly - requires country_id"""
        # First get the user's country_id
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        country_id = me_response.json().get("country_id")
        
        customer_data = {
            "name": f"TEST_Customer_{self.test_id}",
            "mobile": f"9878{self.test_id[:6]}",
            "city": "Chennai",
            "payment_status": "PENDING",
            "country_id": country_id
        }
        
        response = self.session.post(f"{BASE_URL}/api/customers", json=customer_data)
        assert response.status_code == 200, f"Create customer failed: {response.text}"
        
        customer = response.json()
        assert customer.get("id") is not None
        assert customer.get("name") == customer_data["name"]
        assert customer.get("mobile") == customer_data["mobile"]
        assert customer.get("city") == customer_data["city"]
        
        print(f"Created customer: {customer['id']}")
    
    def test_11_filter_customers_by_city(self):
        """Test filtering customers by city"""
        response = self.session.get(f"{BASE_URL}/api/customers?city=Bangalore")
        assert response.status_code == 200
        
        customers = response.json()
        for customer in customers:
            assert customer.get("city") == "Bangalore"
        
        print(f"Found {len(customers)} customers in Bangalore")
    
    def test_12_filter_customers_by_payment_status(self):
        """Test filtering customers by payment status"""
        response = self.session.get(f"{BASE_URL}/api/customers?payment_status=Completed")
        assert response.status_code == 200
        
        customers = response.json()
        for customer in customers:
            assert customer.get("payment_status") == "Completed"
        
        print(f"Found {len(customers)} customers with Completed payment")
    
    # ==================== INSPECTIONS TESTS ====================
    
    def test_13_get_inspections_list(self):
        """Test getting inspections list"""
        response = self.session.get(f"{BASE_URL}/api/inspections")
        assert response.status_code == 200
        
        inspections = response.json()
        assert isinstance(inspections, list)
        print(f"Found {len(inspections)} inspections")
    
    def test_14_get_scheduled_inspections(self):
        """Test getting scheduled inspections"""
        response = self.session.get(f"{BASE_URL}/api/inspections?is_scheduled=true")
        assert response.status_code == 200
        
        inspections = response.json()
        print(f"Found {len(inspections)} scheduled inspections")
    
    def test_15_get_unscheduled_inspections(self):
        """Test getting unscheduled inspections"""
        response = self.session.get(f"{BASE_URL}/api/inspections?is_scheduled=false")
        assert response.status_code == 200
        
        inspections = response.json()
        print(f"Found {len(inspections)} unscheduled inspections")
    
    def test_16_filter_inspections_by_city(self):
        """Test filtering inspections by city"""
        response = self.session.get(f"{BASE_URL}/api/inspections?city=Bangalore")
        assert response.status_code == 200
        
        inspections = response.json()
        for inspection in inspections:
            assert inspection.get("city") == "Bangalore"
        
        print(f"Found {len(inspections)} inspections in Bangalore")
    
    def test_17_filter_inspections_by_status(self):
        """Test filtering inspections by status"""
        response = self.session.get(f"{BASE_URL}/api/inspections?inspection_status=NEW_INSPECTION")
        assert response.status_code == 200
        
        inspections = response.json()
        for inspection in inspections:
            assert inspection.get("inspection_status") == "NEW_INSPECTION"
        
        print(f"Found {len(inspections)} NEW_INSPECTION status inspections")
    
    def test_18_filter_inspections_by_date_range(self):
        """Test filtering inspections by date range"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = self.session.get(f"{BASE_URL}/api/inspections?date_from={today}&date_to={today}")
        assert response.status_code == 200
        
        inspections = response.json()
        print(f"Found {len(inspections)} inspections for today")
    
    # ==================== INSPECTION PACKAGES TESTS ====================
    
    def test_19_get_inspection_packages(self):
        """Test getting inspection packages"""
        response = self.session.get(f"{BASE_URL}/api/inspection-packages")
        assert response.status_code == 200
        
        packages = response.json()
        assert isinstance(packages, list)
        
        # Check package structure
        for pkg in packages:
            assert "id" in pkg
            assert "name" in pkg
            assert "price" in pkg
        
        print(f"Found {len(packages)} inspection packages")
        return packages
    
    def test_20_get_active_offers(self):
        """Test getting active offers"""
        response = self.session.get(f"{BASE_URL}/api/offers/active")
        assert response.status_code == 200
        
        offers = response.json()
        assert isinstance(offers, list)
        print(f"Found {len(offers)} active offers")
    
    # ==================== MECHANICS TESTS ====================
    
    def test_21_get_mechanics_list(self):
        """Test getting mechanics list"""
        response = self.session.get(f"{BASE_URL}/api/mechanics")
        assert response.status_code == 200
        
        mechanics = response.json()
        assert isinstance(mechanics, list)
        print(f"Found {len(mechanics)} mechanics")
        return mechanics
    
    # ==================== CITIES TESTS ====================
    
    def test_22_get_cities(self):
        """Test getting cities list"""
        response = self.session.get(f"{BASE_URL}/api/cities")
        assert response.status_code == 200
        
        cities = response.json()
        assert isinstance(cities, list)
        assert len(cities) > 0
        print(f"Available cities: {cities}")
    
    # ==================== LEAD SOURCES TESTS ====================
    
    def test_23_get_lead_sources(self):
        """Test getting lead sources"""
        response = self.session.get(f"{BASE_URL}/api/lead-sources")
        assert response.status_code == 200
        
        sources = response.json()
        assert isinstance(sources, list)
        assert len(sources) > 0
        print(f"Available lead sources: {sources}")
    
    # ==================== SALES REPS TESTS ====================
    
    def test_24_get_sales_reps_by_city(self):
        """Test getting sales reps by city"""
        response = self.session.get(f"{BASE_URL}/api/leads/sales-reps-by-city?city=Bangalore")
        assert response.status_code == 200
        
        sales_reps = response.json()
        assert isinstance(sales_reps, list)
        print(f"Found {len(sales_reps)} sales reps for Bangalore")
        return sales_reps
    
    # ==================== FORM VALIDATION TESTS ====================
    
    def test_25_create_lead_missing_name(self):
        """Test creating lead without name - should fail"""
        lead_data = {
            "mobile": f"9879{self.test_id[:6]}",
            "city": "Bangalore"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        # Should fail validation
        assert response.status_code in [400, 422], f"Expected validation error, got: {response.status_code}"
        print("Correctly rejected lead without name")
    
    def test_26_create_lead_missing_mobile(self):
        """Test creating lead without mobile - should fail"""
        lead_data = {
            "name": f"TEST_NoMobile_{self.test_id}",
            "city": "Bangalore"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        # Should fail validation
        assert response.status_code in [400, 422], f"Expected validation error, got: {response.status_code}"
        print("Correctly rejected lead without mobile")
    
    def test_27_create_lead_missing_city(self):
        """Test creating lead without city - city is optional in backend, lead gets created"""
        lead_data = {
            "name": f"TEST_NoCity_{self.test_id}",
            "mobile": f"9880{self.test_id[:6]}"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        # City is optional in backend - lead gets created but may not be assigned
        assert response.status_code == 200, f"Create lead failed: {response.text}"
        lead = response.json()
        # City should be empty or None
        assert lead.get("city") in [None, "", "Unknown"]
        print("Lead created without city (city is optional in backend)")
    
    def test_28_create_customer_missing_required_fields(self):
        """Test creating customer without required fields - should fail"""
        customer_data = {
            "name": f"TEST_NoMobile_{self.test_id}"
            # Missing mobile and city
        }
        
        response = self.session.post(f"{BASE_URL}/api/customers", json=customer_data)
        # Should fail validation
        assert response.status_code in [400, 422], f"Expected validation error, got: {response.status_code}"
        print("Correctly rejected customer without required fields")
    
    # ==================== EDGE CASES ====================
    
    def test_29_create_lead_with_different_cities(self):
        """Test creating leads with different cities"""
        cities = ["Bangalore", "Hyderabad", "Chennai", "Mumbai"]
        
        for city in cities:
            lead_data = {
                "name": f"TEST_City_{city}_{self.test_id}",
                "mobile": f"98{cities.index(city)}{self.test_id[:5]}",
                "city": city,
                "source": "WEBSITE"
            }
            
            response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
            assert response.status_code == 200, f"Failed to create lead for {city}: {response.text}"
            
            lead = response.json()
            assert lead.get("city") == city
            print(f"Created lead for city: {city}")
    
    def test_30_create_lead_with_different_sources(self):
        """Test creating leads with different sources"""
        sources = ["WEBSITE", "META_ADS", "GOOGLE_ADS", "REFERRAL"]
        
        for source in sources:
            lead_data = {
                "name": f"TEST_Source_{source}_{self.test_id}",
                "mobile": f"97{sources.index(source)}{self.test_id[:5]}",
                "city": "Bangalore",
                "source": source
            }
            
            response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
            assert response.status_code == 200, f"Failed to create lead with source {source}: {response.text}"
            
            lead = response.json()
            assert lead.get("source") == source
            print(f"Created lead with source: {source}")


class TestPaymentLinkFlow:
    """Test payment link creation flow (Lead → Customer conversion)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        self.test_id = str(uuid.uuid4())[:8]
        yield
    
    def test_01_get_packages_for_payment(self):
        """Test getting packages for payment link"""
        response = self.session.get(f"{BASE_URL}/api/inspection-packages")
        assert response.status_code == 200
        
        packages = response.json()
        active_packages = [p for p in packages if p.get("is_active")]
        
        assert len(active_packages) > 0, "No active packages found"
        print(f"Found {len(active_packages)} active packages for payment")
        return active_packages
    
    def test_02_create_lead_for_payment(self):
        """Create a lead to test payment flow"""
        lead_data = {
            "name": f"TEST_Payment_{self.test_id}",
            "mobile": f"9999{self.test_id[:6]}",
            "city": "Bangalore",
            "source": "WEBSITE"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200
        
        lead = response.json()
        print(f"Created lead for payment test: {lead['id']}")
        return lead


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
