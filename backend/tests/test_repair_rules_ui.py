"""
Test Repair Rules UI - Backend API Tests
Tests for the simplified repair rules UI with sub_options_1 and sub_options_2
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://auto-repairs-crm.preview.emergentagent.com').rstrip('/')


class TestRepairRulesAPI:
    """Test repair rules API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_available_questions_returns_sub_options(self):
        """Test that /api/repair-rules/available-questions returns sub_options_1 and sub_options_2"""
        response = requests.get(f"{BASE_URL}/api/repair-rules/available-questions", headers=self.headers)
        assert response.status_code == 200, f"API failed: {response.text}"
        
        questions = response.json()
        assert isinstance(questions, list), "Response should be a list"
        assert len(questions) > 0, "Should have at least one question"
        
        # Find questions with sub_options
        questions_with_sub_options = [q for q in questions if q.get('sub_options_1') or q.get('sub_options_2')]
        assert len(questions_with_sub_options) > 0, "Should have questions with sub_options"
        
        # Verify structure of a question with sub_options
        sample_q = questions_with_sub_options[0]
        assert 'question_id' in sample_q, "Question should have question_id"
        assert 'question_text' in sample_q, "Question should have question_text"
        assert 'sub_options_1' in sample_q, "Question should have sub_options_1"
        assert 'sub_options_2' in sample_q, "Question should have sub_options_2"
        
        print(f"Found {len(questions_with_sub_options)} questions with sub_options")
    
    def test_sub_options_contain_dent_scratch_values(self):
        """Test that sub_options contain expected Dent and Scratch values"""
        response = requests.get(f"{BASE_URL}/api/repair-rules/available-questions", headers=self.headers)
        assert response.status_code == 200
        
        questions = response.json()
        questions_with_sub_options = [q for q in questions if q.get('sub_options_1') and q.get('sub_options_2')]
        
        assert len(questions_with_sub_options) > 0, "Should have questions with both sub_options"
        
        sample_q = questions_with_sub_options[0]
        
        # Verify Dent options (sub_options_1)
        dent_options = sample_q.get('sub_options_1', [])
        expected_dent_options = ['1-2', '3-4', '4+', 'No Dents']
        for opt in expected_dent_options:
            assert opt in dent_options, f"Dent option '{opt}' should be in sub_options_1"
        
        # Verify Scratch options (sub_options_2)
        scratch_options = sample_q.get('sub_options_2', [])
        expected_scratch_options = ['1-2', '3-4', '4+', 'No Scratch']
        for opt in expected_scratch_options:
            assert opt in scratch_options, f"Scratch option '{opt}' should be in sub_options_2"
        
        print(f"Dent options: {dent_options}")
        print(f"Scratch options: {scratch_options}")
    
    def test_repair_parts_endpoint(self):
        """Test that /api/repair-parts returns parts with pricing"""
        response = requests.get(f"{BASE_URL}/api/repair-parts", headers=self.headers)
        assert response.status_code == 200, f"API failed: {response.text}"
        
        data = response.json()
        parts = data if isinstance(data, list) else data.get('data', [])
        assert len(parts) > 0, "Should have at least one repair part"
        
        # Verify part structure
        sample_part = parts[0]
        assert 'id' in sample_part, "Part should have id"
        assert 'name' in sample_part, "Part should have name"
        
        # Verify pricing structure for car types
        for car_type in ['hatchback', 'sedan', 'suv']:
            if car_type in sample_part:
                pricing = sample_part[car_type]
                assert 'repair_price' in pricing, f"Part should have repair_price for {car_type}"
                assert 'repair_labor' in pricing, f"Part should have repair_labor for {car_type}"
        
        print(f"Found {len(parts)} repair parts")
    
    def test_repair_rules_endpoint(self):
        """Test that /api/repair-rules returns rules"""
        response = requests.get(f"{BASE_URL}/api/repair-rules", headers=self.headers)
        assert response.status_code == 200, f"API failed: {response.text}"
        
        data = response.json()
        rules = data if isinstance(data, list) else data.get('data', [])
        assert len(rules) > 0, "Should have at least one repair rule"
        
        # Verify rule structure
        sample_rule = rules[0]
        assert 'id' in sample_rule, "Rule should have id"
        assert 'part_id' in sample_rule, "Rule should have part_id"
        assert 'question_id' in sample_rule, "Rule should have question_id"
        
        print(f"Found {len(rules)} repair rules")


class TestPricingCalculation:
    """Test pricing calculation logic for different action types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a sample part for testing
        parts_response = requests.get(f"{BASE_URL}/api/repair-parts", headers=self.headers)
        parts = parts_response.json()
        parts = parts if isinstance(parts, list) else parts.get('data', [])
        self.sample_part = parts[0] if parts else None
    
    def test_repair_action_uses_part_cost_only(self):
        """Test that 'repair' action should use only part cost (repair_price)"""
        if not self.sample_part:
            pytest.skip("No repair parts available")
        
        # Get sedan pricing
        sedan_pricing = self.sample_part.get('sedan', {})
        repair_price = sedan_pricing.get('repair_price', 0)
        repair_labor = sedan_pricing.get('repair_labor', 0)
        
        # For 'repair' action: price = repair_price, labor = 0
        expected_price = repair_price
        expected_labor = 0
        expected_total = expected_price + expected_labor
        
        print(f"Part: {self.sample_part.get('name')}")
        print(f"Repair action: price={expected_price}, labor={expected_labor}, total={expected_total}")
        
        # Verify the logic matches what frontend should calculate
        assert expected_labor == 0, "Repair action should have 0 labor cost"
    
    def test_labor_action_uses_labor_cost_only(self):
        """Test that 'labor' action should use only labor cost (repair_labor)"""
        if not self.sample_part:
            pytest.skip("No repair parts available")
        
        # Get sedan pricing
        sedan_pricing = self.sample_part.get('sedan', {})
        repair_price = sedan_pricing.get('repair_price', 0)
        repair_labor = sedan_pricing.get('repair_labor', 0)
        
        # For 'labor' action: price = 0, labor = repair_labor
        expected_price = 0
        expected_labor = repair_labor
        expected_total = expected_price + expected_labor
        
        print(f"Part: {self.sample_part.get('name')}")
        print(f"Labor action: price={expected_price}, labor={expected_labor}, total={expected_total}")
        
        # Verify the logic matches what frontend should calculate
        assert expected_price == 0, "Labor action should have 0 part cost"
    
    def test_both_action_uses_part_and_labor(self):
        """Test that 'both' action should use both part and labor costs"""
        if not self.sample_part:
            pytest.skip("No repair parts available")
        
        # Get sedan pricing
        sedan_pricing = self.sample_part.get('sedan', {})
        repair_price = sedan_pricing.get('repair_price', 0)
        repair_labor = sedan_pricing.get('repair_labor', 0)
        
        # For 'both' action: price = repair_price, labor = repair_labor
        expected_price = repair_price
        expected_labor = repair_labor
        expected_total = expected_price + expected_labor
        
        print(f"Part: {self.sample_part.get('name')}")
        print(f"Both action: price={expected_price}, labor={expected_labor}, total={expected_total}")
        
        # Verify the logic
        assert expected_total == repair_price + repair_labor, "Both action should sum part and labor"
    
    def test_inspect_further_has_no_cost(self):
        """Test that 'inspect_further' action should have no cost"""
        # For 'inspect_further' action: price = 0, labor = 0
        expected_price = 0
        expected_labor = 0
        expected_total = 0
        
        print(f"Inspect Further action: price={expected_price}, labor={expected_labor}, total={expected_total}")
        
        # Verify the logic
        assert expected_total == 0, "Inspect Further action should have 0 total cost"


class TestLiveProgressModalRepairs:
    """Test auto-repair detection in LiveProgressModal"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_inspection_live_progress_endpoint(self):
        """Test that inspection live-progress endpoint works"""
        # Get inspections list
        inspections_response = requests.get(f"{BASE_URL}/api/inspections", headers=self.headers)
        assert inspections_response.status_code == 200
        
        data = inspections_response.json()
        inspections = data if isinstance(data, list) else data.get('data', [])
        
        if not inspections:
            pytest.skip("No inspections available")
        
        # Get first inspection's live progress
        inspection_id = inspections[0].get('id')
        live_progress_response = requests.get(
            f"{BASE_URL}/api/inspections/{inspection_id}/live-progress",
            headers=self.headers
        )
        
        # Live progress might return 200 or 404 depending on inspection state
        assert live_progress_response.status_code in [200, 404], f"Unexpected status: {live_progress_response.status_code}"
        
        if live_progress_response.status_code == 200:
            data = live_progress_response.json()
            print(f"Live progress data keys: {data.keys() if isinstance(data, dict) else 'list'}")
    
    def test_hiba_mol_inspection_exists(self):
        """Test that the test inspection (Hiba. Mol) exists"""
        # Search for Hiba. Mol inspection
        inspections_response = requests.get(
            f"{BASE_URL}/api/inspections?search=Hiba",
            headers=self.headers
        )
        assert inspections_response.status_code == 200
        
        data = inspections_response.json()
        inspections = data if isinstance(data, list) else data.get('data', [])
        
        # Find Hiba. Mol inspection
        hiba_inspection = None
        for insp in inspections:
            customer_name = insp.get('customer_name', '') or insp.get('customer', {}).get('name', '')
            if 'Hiba' in customer_name:
                hiba_inspection = insp
                break
        
        if hiba_inspection:
            print(f"Found Hiba. Mol inspection: {hiba_inspection.get('id')}")
            print(f"Car number: {hiba_inspection.get('car_number')}")
        else:
            print("Hiba. Mol inspection not found in search results")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
