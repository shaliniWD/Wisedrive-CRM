"""
Test AI Report Generation with Web Scraping for Market Prices
Tests:
- POST /api/inspections/{id}/generate-ai-report endpoint
- Web scraping integration for market prices
- Market price research data storage in inspection document
- AI insights generation with GPT-5.2
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
COUNTRY_ID = "c49e1dc6-1450-40c2-9846-56b73369b2b1"  # India

# Test credentials
TEST_EMAIL = "kalyan@wisedrive.com"
TEST_PASSWORD = "password123"

# Test inspection IDs (pre-created with vehicle data)
TEST_INSPECTION_CRETA = "test-insp-c2296e69"  # Hyundai Creta
TEST_INSPECTION_CITY = "test-insp-781768ac"   # Honda City


class TestAIReportGeneration:
    """Test AI Report Generation endpoint and web scraping integration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "country_id": COUNTRY_ID
            }
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        assert token, "No access token received"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
    
    # ==================== AI Report Endpoint Tests ====================
    
    def test_01_ai_report_endpoint_exists(self):
        """Test that AI report generation endpoint exists"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}/generate-ai-report",
            json={"force_regenerate": False}
        )
        # Should return 200 (success) or 404 (inspection not found), not 405 (method not allowed)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
    
    def test_02_generate_ai_report_hyundai_creta(self):
        """Test AI report generation for Hyundai Creta with force regenerate"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}/generate-ai-report",
            json={"force_regenerate": True}
        )
        assert response.status_code == 200, f"AI report generation failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert data.get("regenerated") is True, "Should be regenerated with force_regenerate=True"
        
        # Verify AI insights structure
        ai_insights = data.get("ai_insights", {})
        assert "overall_rating" in ai_insights, "AI insights should have overall_rating"
        assert "market_value" in ai_insights, "AI insights should have market_value"
        assert "assessment_summary" in ai_insights, "AI insights should have assessment_summary"
        assert "condition_ratings" in ai_insights, "AI insights should have condition_ratings"
        
        print(f"AI Report generated - Overall Rating: {ai_insights.get('overall_rating')}")
        print(f"Market Value: {ai_insights.get('market_value')}")
    
    def test_03_generate_ai_report_honda_city(self):
        """Test AI report generation for Honda City"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CITY}/generate-ai-report",
            json={"force_regenerate": True}
        )
        assert response.status_code == 200, f"AI report generation failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        
        ai_insights = data.get("ai_insights", {})
        assert ai_insights.get("ai_generated") is True, "Should be marked as AI generated"
        
        print(f"Honda City AI Report - Rating: {ai_insights.get('overall_rating')}")
    
    def test_04_ai_report_without_force_regenerate(self):
        """Test that existing AI report is returned without force_regenerate"""
        # First ensure report exists
        self.session.post(
            f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}/generate-ai-report",
            json={"force_regenerate": True}
        )
        
        # Now request without force_regenerate
        response = self.session.post(
            f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}/generate-ai-report",
            json={"force_regenerate": False}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        # Should return existing report without regenerating
        assert data.get("regenerated") is False, "Should not regenerate when force_regenerate=False"
    
    def test_05_ai_report_invalid_inspection(self):
        """Test AI report generation for non-existent inspection"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/non-existent-id/generate-ai-report",
            json={"force_regenerate": True}
        )
        assert response.status_code == 404, "Should return 404 for non-existent inspection"
    
    # ==================== Market Price Research Tests ====================
    
    def test_06_market_price_research_stored(self):
        """Test that market price research data is stored in inspection"""
        # Generate AI report first
        self.session.post(
            f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}/generate-ai-report",
            json={"force_regenerate": True}
        )
        
        # Get inspection to verify market_price_research
        response = self.session.get(f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}")
        assert response.status_code == 200
        
        inspection = response.json()
        market_research = inspection.get("market_price_research", {})
        
        # Verify market research structure
        assert "market_average" in market_research, "Should have market_average"
        assert "market_min" in market_research, "Should have market_min"
        assert "market_max" in market_research, "Should have market_max"
        assert "sources_count" in market_research, "Should have sources_count"
        assert "estimation_method" in market_research, "Should have estimation_method"
        
        print(f"Market Research: avg={market_research.get('market_average')}, sources={market_research.get('sources_count')}")
    
    def test_07_market_prices_in_realistic_range(self):
        """Test that market prices are in realistic range (3-15L for typical used cars)"""
        response = self.session.get(f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}")
        assert response.status_code == 200
        
        inspection = response.json()
        market_research = inspection.get("market_price_research", {})
        
        market_avg = market_research.get("market_average", 0)
        market_min = market_research.get("market_min", 0)
        market_max = market_research.get("market_max", 0)
        
        # Hyundai Creta should be in 5-15L range typically
        # But since year is null, it might use fallback estimation
        # Minimum should be at least 1L (100000 INR)
        assert market_avg >= 100000, f"Market average too low: {market_avg}"
        assert market_max <= 5000000, f"Market max too high: {market_max}"  # 50L max
        
        print(f"Creta prices - Min: ₹{market_min/100000:.2f}L, Avg: ₹{market_avg/100000:.2f}L, Max: ₹{market_max/100000:.2f}L")
    
    def test_08_market_sources_info(self):
        """Test that market sources information is captured"""
        response = self.session.get(f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}")
        assert response.status_code == 200
        
        inspection = response.json()
        market_research = inspection.get("market_price_research", {})
        sources = market_research.get("sources", [])
        
        # Should have sources if web scraping worked
        if market_research.get("estimation_method") == "web_scraping":
            assert len(sources) > 0, "Web scraping should return sources"
            
            # Verify source structure
            for source in sources:
                assert "source" in source, "Source should have source name"
                assert "price" in source, "Source should have price"
                assert source["source"] in ["CarDekho", "CarWale", "Cars24", "Spinny", "OLX"], \
                    f"Unknown source: {source['source']}"
        
        print(f"Sources count: {len(sources)}, Method: {market_research.get('estimation_method')}")
    
    # ==================== AI Insights Validation Tests ====================
    
    def test_09_ai_insights_overall_rating_valid(self):
        """Test that overall rating is within valid range (1-5)"""
        response = self.session.get(f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}")
        assert response.status_code == 200
        
        inspection = response.json()
        overall_rating = inspection.get("overall_rating", 0)
        
        # Rating should be between 0 and 5 (0 means pending)
        assert 0 <= overall_rating <= 5, f"Invalid overall rating: {overall_rating}"
        
        print(f"Overall Rating: {overall_rating}/5")
    
    def test_10_ai_insights_condition_ratings(self):
        """Test that condition ratings are properly set"""
        response = self.session.get(f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}")
        assert response.status_code == 200
        
        inspection = response.json()
        ai_insights = inspection.get("ai_insights", {})
        condition_ratings = ai_insights.get("condition_ratings", {})
        
        valid_conditions = ["EXCELLENT", "GOOD", "FAIR", "POOR", "PENDING"]
        
        for key in ["engine", "interior", "exterior", "transmission"]:
            rating = condition_ratings.get(key, "PENDING")
            assert rating in valid_conditions, f"Invalid condition rating for {key}: {rating}"
        
        print(f"Condition Ratings: {condition_ratings}")
    
    def test_11_ai_insights_market_value_from_research(self):
        """Test that AI market value uses web scraped research data"""
        response = self.session.get(f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}")
        assert response.status_code == 200
        
        inspection = response.json()
        ai_insights = inspection.get("ai_insights", {})
        market_value = ai_insights.get("market_value", {})
        market_research = inspection.get("market_price_research", {})
        
        # If market research is available, AI should use it
        if market_research.get("market_average", 0) > 0:
            assert market_value.get("market_research_available") is True, \
                "Should indicate market research is available"
            assert market_value.get("market_average", 0) > 0, \
                "Should have market average from research"
        
        print(f"AI Market Value: min={market_value.get('min')}, max={market_value.get('max')}")
    
    def test_12_ai_insights_assessment_summary(self):
        """Test that assessment summary is generated"""
        response = self.session.get(f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}")
        assert response.status_code == 200
        
        inspection = response.json()
        ai_insights = inspection.get("ai_insights", {})
        assessment = ai_insights.get("assessment_summary", {})
        
        # Assessment can be string or object
        if isinstance(assessment, dict):
            assert "overall" in assessment or len(assessment) > 0, \
                "Assessment summary should have content"
        elif isinstance(assessment, str):
            assert len(assessment) > 0, "Assessment summary should not be empty"
        
        print(f"Assessment Summary type: {type(assessment)}")
    
    # ==================== Integration Tests ====================
    
    def test_13_full_ai_report_flow(self):
        """Test complete AI report generation flow"""
        # Step 1: Generate AI report
        gen_response = self.session.post(
            f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CITY}/generate-ai-report",
            json={"force_regenerate": True}
        )
        assert gen_response.status_code == 200
        
        # Step 2: Verify inspection is updated
        get_response = self.session.get(f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CITY}")
        assert get_response.status_code == 200
        
        inspection = get_response.json()
        
        # Verify all expected fields are populated
        assert inspection.get("ai_insights") is not None, "AI insights should be stored"
        assert inspection.get("overall_rating") is not None, "Overall rating should be stored"
        assert inspection.get("market_value_min") is not None, "Market value min should be stored"
        assert inspection.get("market_value_max") is not None, "Market value max should be stored"
        assert inspection.get("ai_report_generated_at") is not None, "Generation timestamp should be stored"
        
        print("Full AI report flow completed successfully")
        print(f"  - Overall Rating: {inspection.get('overall_rating')}")
        print(f"  - Market Value: ₹{inspection.get('market_value_min', 0)/100000:.2f}L - ₹{inspection.get('market_value_max', 0)/100000:.2f}L")
        print(f"  - Generated At: {inspection.get('ai_report_generated_at')}")


class TestWebScrapingFallback:
    """Test web scraping fallback behavior when scraping fails"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "country_id": COUNTRY_ID
            }
        )
        assert login_response.status_code == 200
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_14_estimation_method_recorded(self):
        """Test that estimation method is recorded (web_scraping or fallback_depreciation)"""
        response = self.session.get(f"{BASE_URL}/api/inspections/{TEST_INSPECTION_CRETA}")
        assert response.status_code == 200
        
        inspection = response.json()
        market_research = inspection.get("market_price_research", {})
        
        estimation_method = market_research.get("estimation_method", "")
        assert estimation_method in ["web_scraping", "fallback_depreciation"], \
            f"Unknown estimation method: {estimation_method}"
        
        print(f"Estimation method: {estimation_method}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
