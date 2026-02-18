"""
Test Meta Ads Integration and Ad City Mappings CRUD
Tests for:
- GET /api/settings/ad-city-mappings - List all ad mappings
- POST /api/settings/ad-city-mappings - Create new ad mapping
- PUT /api/settings/ad-city-mappings/{id} - Update ad mapping
- PATCH /api/settings/ad-city-mappings/{id}/toggle-status - Toggle active status
- DELETE /api/settings/ad-city-mappings/{id} - Delete mapping
- GET /api/meta-ads/status - Check Meta integration status
- GET /api/meta-ads/performance - Get ad performance analytics
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "shalini.vyshaka@gmail.com"
CEO_PASSWORD = "password123"
COUNTRY_HEAD_EMAIL = "countryhead.in@wisedrive.com"
COUNTRY_HEAD_PASSWORD = "password123"


class TestAdCityMappingsCRUD:
    """Test Ad City Mappings CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as CEO
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_mapping_ids = []
        yield
        # Cleanup created mappings
        for mapping_id in self.created_mapping_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/settings/ad-city-mappings/{mapping_id}")
            except:
                pass
    
    def test_get_ad_city_mappings_list(self):
        """Test GET /api/settings/ad-city-mappings - List all ad mappings"""
        response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        assert response.status_code == 200, f"Failed to get mappings: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET ad-city-mappings: Found {len(data)} mappings")
    
    def test_create_ad_city_mapping(self):
        """Test POST /api/settings/ad-city-mappings - Create new ad mapping"""
        test_ad_id = f"TEST_AD_{uuid.uuid4().hex[:8]}"
        payload = {
            "ad_id": test_ad_id,
            "city": "Bangalore",
            "ad_name": "Test Ad Campaign",
            "ad_amount": 5000.00,
            "language": "English",
            "campaign": "Test Campaign",
            "source": "Facebook",
            "is_active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=payload)
        assert response.status_code == 200, f"Failed to create mapping: {response.text}"
        data = response.json()
        assert "id" in data or "message" in data, "Response should contain id or message"
        
        # Store for cleanup
        if "id" in data:
            self.created_mapping_ids.append(data["id"])
        
        # Verify by fetching all mappings
        get_response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        assert get_response.status_code == 200
        mappings = get_response.json()
        created_mapping = next((m for m in mappings if m.get("ad_id") == test_ad_id), None)
        assert created_mapping is not None, "Created mapping should be in the list"
        assert created_mapping["city"] == "Bangalore"
        assert created_mapping["ad_name"] == "Test Ad Campaign"
        assert created_mapping["language"] == "English"
        
        # Store ID for cleanup
        if created_mapping.get("id"):
            self.created_mapping_ids.append(created_mapping["id"])
        
        print(f"✓ POST ad-city-mappings: Created mapping with ad_id={test_ad_id}")
    
    def test_create_ad_mapping_with_all_fields(self):
        """Test creating ad mapping with all optional fields"""
        test_ad_id = f"TEST_FULL_{uuid.uuid4().hex[:8]}"
        payload = {
            "ad_id": test_ad_id,
            "city": "Chennai",
            "ad_name": "Full Test Ad",
            "ad_amount": 10000.50,
            "language": "Tamil",
            "campaign": "Summer Sale",
            "source": "Instagram",
            "is_active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify all fields persisted
        get_response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        mappings = get_response.json()
        created = next((m for m in mappings if m.get("ad_id") == test_ad_id), None)
        
        assert created is not None
        assert created["city"] == "Chennai"
        assert created["ad_name"] == "Full Test Ad"
        assert created["ad_amount"] == 10000.50
        assert created["language"] == "Tamil"
        assert created["campaign"] == "Summer Sale"
        assert created["source"] == "Instagram"
        assert created["is_active"] == True
        
        if created.get("id"):
            self.created_mapping_ids.append(created["id"])
        
        print(f"✓ Created ad mapping with all fields verified")
    
    def test_update_ad_city_mapping(self):
        """Test PUT /api/settings/ad-city-mappings/{id} - Update ad mapping"""
        # First create a mapping
        test_ad_id = f"TEST_UPDATE_{uuid.uuid4().hex[:8]}"
        create_payload = {
            "ad_id": test_ad_id,
            "city": "Mumbai",
            "ad_name": "Original Name",
            "source": "Google"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=create_payload)
        assert create_response.status_code == 200
        
        # Get the created mapping ID
        get_response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        mappings = get_response.json()
        created = next((m for m in mappings if m.get("ad_id") == test_ad_id), None)
        assert created is not None
        mapping_id = created["id"]
        self.created_mapping_ids.append(mapping_id)
        
        # Update the mapping
        update_payload = {
            "city": "Delhi",
            "ad_name": "Updated Name",
            "ad_amount": 7500.00,
            "language": "Hindi"
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/settings/ad-city-mappings/{mapping_id}", json=update_payload)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify update persisted
        get_response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        mappings = get_response.json()
        updated = next((m for m in mappings if m.get("id") == mapping_id), None)
        
        assert updated is not None
        assert updated["city"] == "Delhi"
        assert updated["ad_name"] == "Updated Name"
        assert updated["ad_amount"] == 7500.00
        assert updated["language"] == "Hindi"
        
        print(f"✓ PUT ad-city-mappings: Updated mapping {mapping_id}")
    
    def test_toggle_ad_mapping_status(self):
        """Test PATCH /api/settings/ad-city-mappings/{id}/toggle-status"""
        # Create a mapping
        test_ad_id = f"TEST_TOGGLE_{uuid.uuid4().hex[:8]}"
        create_payload = {
            "ad_id": test_ad_id,
            "city": "Hyderabad",
            "is_active": True
        }
        
        self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=create_payload)
        
        # Get mapping ID
        get_response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        mappings = get_response.json()
        created = next((m for m in mappings if m.get("ad_id") == test_ad_id), None)
        assert created is not None
        mapping_id = created["id"]
        self.created_mapping_ids.append(mapping_id)
        
        # Toggle status (should become inactive)
        toggle_response = self.session.patch(f"{BASE_URL}/api/settings/ad-city-mappings/{mapping_id}/toggle-status")
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        toggle_data = toggle_response.json()
        assert toggle_data.get("is_active") == False, "Status should be toggled to False"
        
        # Verify in database
        get_response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        mappings = get_response.json()
        toggled = next((m for m in mappings if m.get("id") == mapping_id), None)
        assert toggled["is_active"] == False
        
        # Toggle again (should become active)
        toggle_response2 = self.session.patch(f"{BASE_URL}/api/settings/ad-city-mappings/{mapping_id}/toggle-status")
        assert toggle_response2.status_code == 200
        assert toggle_response2.json().get("is_active") == True
        
        print(f"✓ PATCH toggle-status: Toggled mapping {mapping_id} twice")
    
    def test_delete_ad_city_mapping(self):
        """Test DELETE /api/settings/ad-city-mappings/{id}"""
        # Create a mapping to delete
        test_ad_id = f"TEST_DELETE_{uuid.uuid4().hex[:8]}"
        create_payload = {
            "ad_id": test_ad_id,
            "city": "Pune"
        }
        
        self.session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=create_payload)
        
        # Get mapping ID
        get_response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        mappings = get_response.json()
        created = next((m for m in mappings if m.get("ad_id") == test_ad_id), None)
        assert created is not None
        mapping_id = created["id"]
        
        # Delete the mapping
        delete_response = self.session.delete(f"{BASE_URL}/api/settings/ad-city-mappings/{mapping_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        mappings = get_response.json()
        deleted = next((m for m in mappings if m.get("id") == mapping_id), None)
        assert deleted is None, "Mapping should be deleted"
        
        print(f"✓ DELETE ad-city-mappings: Deleted mapping {mapping_id}")
    
    def test_update_nonexistent_mapping_returns_404(self):
        """Test updating a non-existent mapping returns 404"""
        fake_id = str(uuid.uuid4())
        update_payload = {"city": "Test"}
        
        response = self.session.put(f"{BASE_URL}/api/settings/ad-city-mappings/{fake_id}", json=update_payload)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT non-existent mapping returns 404")
    
    def test_toggle_nonexistent_mapping_returns_404(self):
        """Test toggling a non-existent mapping returns 404"""
        fake_id = str(uuid.uuid4())
        
        response = self.session.patch(f"{BASE_URL}/api/settings/ad-city-mappings/{fake_id}/toggle-status")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PATCH toggle non-existent mapping returns 404")


class TestMetaAdsEndpoints:
    """Test Meta Ads Analytics endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as CEO
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_meta_ads_status(self):
        """Test GET /api/meta-ads/status - Check Meta integration status"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/status")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should have configured field
        assert "configured" in data, "Response should have 'configured' field"
        assert isinstance(data["configured"], bool)
        
        # If configured, should have ad_account_id
        if data["configured"]:
            assert "ad_account_id" in data
        
        print(f"✓ GET meta-ads/status: configured={data['configured']}")
    
    def test_get_meta_ads_performance(self):
        """Test GET /api/meta-ads/performance - Get ad performance analytics"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/performance")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "date_range" in data, "Response should have date_range"
        assert "meta_configured" in data, "Response should have meta_configured"
        assert "totals" in data, "Response should have totals"
        assert "data" in data, "Response should have data array"
        
        # Verify totals structure
        totals = data["totals"]
        expected_total_fields = [
            "total_ad_spend", "total_impressions", "total_clicks",
            "total_leads", "total_converted", "total_revenue",
            "overall_conversion_rate", "overall_roi"
        ]
        for field in expected_total_fields:
            assert field in totals, f"Totals should have {field}"
        
        # Verify data array structure (if any data exists)
        if data["data"]:
            item = data["data"][0]
            expected_item_fields = [
                "ad_id", "ad_name", "city", "source", "language",
                "ad_spend", "impressions", "clicks",
                "total_leads", "converted_leads", "total_revenue",
                "conversion_rate", "roi"
            ]
            for field in expected_item_fields:
                assert field in item, f"Data item should have {field}"
        
        print(f"✓ GET meta-ads/performance: {len(data['data'])} ads, totals verified")
    
    def test_get_meta_ads_performance_with_date_range(self):
        """Test GET /api/meta-ads/performance with date range parameters"""
        params = {
            "date_from": "2024-01-01",
            "date_to": "2024-12-31"
        }
        response = self.session.get(f"{BASE_URL}/api/meta-ads/performance", params=params)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify date range is reflected
        assert data["date_range"]["from"] == "2024-01-01"
        assert data["date_range"]["to"] == "2024-12-31"
        
        print(f"✓ GET meta-ads/performance with date range: verified")
    
    def test_meta_ads_insights_endpoint(self):
        """Test GET /api/meta-ads/insights"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/insights")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should have either data or error (if not configured)
        assert "data" in data or "error" in data
        print(f"✓ GET meta-ads/insights: response received")
    
    def test_meta_ads_campaigns_endpoint(self):
        """Test GET /api/meta-ads/campaigns"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/campaigns")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "data" in data or "error" in data
        print(f"✓ GET meta-ads/campaigns: response received")
    
    def test_meta_ads_ads_list_endpoint(self):
        """Test GET /api/meta-ads/ads"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/ads")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "data" in data or "error" in data
        print(f"✓ GET meta-ads/ads: response received")


class TestAdMappingsAuthorization:
    """Test authorization for ad mappings endpoints"""
    
    def test_country_head_cannot_create_ad_mapping(self):
        """Test that Country Head cannot create ad mappings (only CEO/HR_MANAGER/CTO)"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as Country Head
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": COUNTRY_HEAD_EMAIL,
            "password": COUNTRY_HEAD_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to create ad mapping
        payload = {
            "ad_id": "UNAUTHORIZED_TEST",
            "city": "Test"
        }
        create_response = session.post(f"{BASE_URL}/api/settings/ad-city-mappings", json=payload)
        assert create_response.status_code == 403, f"Expected 403, got {create_response.status_code}"
        
        print("✓ Country Head cannot create ad mappings (403)")
    
    def test_country_head_can_read_ad_mappings(self):
        """Test that Country Head can read ad mappings"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as Country Head
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": COUNTRY_HEAD_EMAIL,
            "password": COUNTRY_HEAD_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to read ad mappings
        get_response = session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        
        print("✓ Country Head can read ad mappings (200)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
