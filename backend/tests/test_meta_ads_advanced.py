"""
Test Meta Ads Advanced Features:
1. Sync Status endpoint (/api/meta-ads/sync-status)
2. Unmapped Ads endpoint (/api/meta-ads/unmapped-ads)
3. Performance endpoint with CPR metric
4. Token info endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "kalyan@wisedrive.com"
CEO_PASSWORD = "password123"
COUNTRY_ID = "c49e1dc6-1450-40c2-9846-56b73369b2b1"  # India


class TestMetaAdsAdvancedFeatures:
    """Test Meta Ads advanced features - sync, unmapped ads, CPR metric"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with CEO login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as CEO
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD,
            "country_id": COUNTRY_ID
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.logged_in = True
        else:
            self.logged_in = False
            print(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    def test_01_login_success(self):
        """Verify CEO login works"""
        assert self.logged_in, "CEO login should succeed"
        print("✓ CEO login successful")
    
    def test_02_meta_ads_status(self):
        """Test /api/meta-ads/status endpoint"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/status")
        assert response.status_code == 200, f"Status endpoint failed: {response.text}"
        
        data = response.json()
        assert "configured" in data, "Response should have 'configured' field"
        print(f"✓ Meta Ads status: configured={data.get('configured')}")
    
    def test_03_meta_ads_token_info(self):
        """Test /api/meta-ads/token-info endpoint (CEO only)"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/token-info")
        assert response.status_code == 200, f"Token info failed: {response.text}"
        
        data = response.json()
        # Token info should have is_valid field
        assert "is_valid" in data, "Response should have 'is_valid' field"
        print(f"✓ Token info: is_valid={data.get('is_valid')}, expires_in_days={data.get('expires_in_days')}")
        
        # If token is invalid, it should have error message
        if not data.get("is_valid"):
            print(f"  Token error (expected): {data.get('error', 'No error message')}")
    
    def test_04_meta_ads_performance_with_cpr(self):
        """Test /api/meta-ads/performance endpoint returns CPR metric"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/performance", params={
            "date_from": "2026-01-01",
            "date_to": "2026-02-18"
        })
        assert response.status_code == 200, f"Performance endpoint failed: {response.text}"
        
        data = response.json()
        
        # Check totals structure
        totals = data.get("totals", {})
        assert "total_ad_spend" in totals, "Should have total_ad_spend"
        assert "total_leads" in totals, "Should have total_leads"
        assert "total_revenue" in totals, "Should have total_revenue"
        
        # Check for CPR (Cost Per Result) metric
        assert "overall_cpr" in totals, "Should have overall_cpr (Cost Per Result)"
        print(f"✓ Performance totals: spend={totals.get('total_ad_spend')}, leads={totals.get('total_leads')}, CPR={totals.get('overall_cpr')}")
        
        # Check last_updated field
        assert "last_updated" in data, "Should have last_updated timestamp"
        print(f"✓ Last updated: {data.get('last_updated')}")
        
        # Check individual ad data has cost_per_result
        ad_data = data.get("data", [])
        if ad_data:
            first_ad = ad_data[0]
            assert "cost_per_result" in first_ad, "Individual ad should have cost_per_result"
            print(f"✓ First ad CPR: {first_ad.get('cost_per_result')}")
    
    def test_05_sync_status_endpoint(self):
        """Test /api/meta-ads/sync-status endpoint (CEO only)"""
        response = self.session.post(f"{BASE_URL}/api/meta-ads/sync-status")
        
        # Should return 200 even if Meta token is expired (graceful error handling)
        assert response.status_code == 200, f"Sync status failed: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should have 'success' field"
        
        if data.get("success"):
            print(f"✓ Sync successful: updated_count={data.get('updated_count')}, total_meta_ads={data.get('total_meta_ads')}")
        else:
            # Expected when Meta token is expired
            print(f"✓ Sync returned error (expected with expired token): {data.get('error')}")
            assert "error" in data, "Failed sync should have error message"
    
    def test_06_unmapped_ads_endpoint(self):
        """Test /api/meta-ads/unmapped-ads endpoint (CEO only)"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/unmapped-ads")
        
        # Should return 200 even if Meta token is expired (graceful error handling)
        assert response.status_code == 200, f"Unmapped ads failed: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should have 'success' field"
        
        if data.get("success"):
            unmapped = data.get("data", [])
            print(f"✓ Unmapped ads: count={data.get('count')}, has_city_targeting={data.get('has_city_targeting')}")
            
            # Check structure of unmapped ads
            if unmapped:
                first_ad = unmapped[0]
                assert "ad_id" in first_ad, "Unmapped ad should have ad_id"
                assert "ad_name" in first_ad, "Unmapped ad should have ad_name"
                assert "suggested_city" in first_ad, "Unmapped ad should have suggested_city"
                print(f"✓ First unmapped ad: {first_ad.get('ad_name')} - suggested city: {first_ad.get('suggested_city')}")
        else:
            # Expected when Meta token is expired
            print(f"✓ Unmapped ads returned error (expected with expired token): {data.get('error')}")
            assert "error" in data, "Failed request should have error message"
    
    def test_07_sync_status_unauthorized(self):
        """Test sync-status endpoint rejects non-CEO/CTO users"""
        # Create new session without auth
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as a non-CEO user (Country Head)
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "countryhead.in@wisedrive.com",
            "password": "password123",
            "country_id": COUNTRY_ID
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            session.headers.update({"Authorization": f"Bearer {token}"})
            
            # Try to access sync-status
            response = session.post(f"{BASE_URL}/api/meta-ads/sync-status")
            assert response.status_code == 403, f"Non-CEO should get 403, got {response.status_code}"
            print("✓ Sync status correctly rejects non-CEO/CTO users")
        else:
            pytest.skip("Could not login as Country Head for authorization test")
    
    def test_08_ad_city_mappings_list(self):
        """Test /api/settings/ad-city-mappings returns mappings"""
        response = self.session.get(f"{BASE_URL}/api/settings/ad-city-mappings")
        assert response.status_code == 200, f"Ad mappings list failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Ad city mappings: {len(data)} mappings found")
        
        # Check structure if mappings exist
        if data:
            first_mapping = data[0]
            assert "ad_id" in first_mapping, "Mapping should have ad_id"
            assert "city" in first_mapping, "Mapping should have city"
            assert "is_active" in first_mapping, "Mapping should have is_active"
            print(f"✓ First mapping: ad_id={first_mapping.get('ad_id')}, city={first_mapping.get('city')}")


class TestMetaAdsPerformanceData:
    """Test performance data structure and CPR calculations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with CEO login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as CEO
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD,
            "country_id": COUNTRY_ID
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_performance_data_structure(self):
        """Verify performance data has all required fields"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/performance", params={
            "date_from": "2026-01-01",
            "date_to": "2026-02-18"
        })
        assert response.status_code == 200
        
        data = response.json()
        
        # Required top-level fields
        required_fields = ["totals", "data", "last_updated"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Required totals fields
        totals = data.get("totals", {})
        required_totals = [
            "total_ad_spend", "total_leads", "total_converted", 
            "total_revenue", "overall_roi", "overall_conversion_rate",
            "overall_cpr", "overall_cpl"  # CPR and CPL metrics
        ]
        for field in required_totals:
            assert field in totals, f"Missing totals field: {field}"
        
        print(f"✓ All required fields present in performance data")
        print(f"  - CPR (Cost Per Result): {totals.get('overall_cpr')}")
        print(f"  - CPL (Cost Per Lead): {totals.get('overall_cpl')}")
    
    def test_individual_ad_cpr(self):
        """Verify individual ads have cost_per_result field"""
        response = self.session.get(f"{BASE_URL}/api/meta-ads/performance", params={
            "date_from": "2026-01-01",
            "date_to": "2026-02-18"
        })
        assert response.status_code == 200
        
        data = response.json()
        ad_data = data.get("data", [])
        
        if ad_data:
            for ad in ad_data[:5]:  # Check first 5 ads
                assert "cost_per_result" in ad, f"Ad {ad.get('ad_id')} missing cost_per_result"
                assert "ad_spend" in ad, f"Ad {ad.get('ad_id')} missing ad_spend"
                assert "converted_leads" in ad, f"Ad {ad.get('ad_id')} missing converted_leads"
            print(f"✓ All ads have cost_per_result field")
        else:
            print("✓ No ad data to verify (empty dataset)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
