"""
Test suite for Repairs Module APIs
Tests repair parts CRUD, repair rules CRUD, and available questions endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "kalyan@wisedrive.com"
TEST_PASSWORD = "password123"
TEST_COUNTRY_ID = "c49e1dc6-1450-40c2-9846-56b73369b2b1"


class TestRepairsModule:
    """Test suite for Repairs Module"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = self._get_auth_token()
        if self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def _get_auth_token(self):
        """Get authentication token"""
        try:
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            if response.status_code == 200:
                return response.json().get("access_token")
        except Exception as e:
            print(f"Auth failed: {e}")
        return None
    
    # ==================== REPAIR PARTS TESTS ====================
    
    def test_get_repair_parts_returns_30_parts(self):
        """GET /api/repair-parts - Should return 30 parts with proper pricing structure"""
        response = self.session.get(f"{BASE_URL}/api/repair-parts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        parts = response.json()
        assert isinstance(parts, list), "Response should be a list"
        assert len(parts) == 30, f"Expected 30 parts, got {len(parts)}"
        
        # Verify pricing structure for first part
        if parts:
            part = parts[0]
            assert "id" in part, "Part should have id"
            assert "name" in part, "Part should have name"
            assert "category" in part, "Part should have category"
            
            # Check pricing structure for car types
            for car_type in ["hatchback", "sedan", "suv"]:
                assert car_type in part, f"Part should have {car_type} pricing"
                pricing = part[car_type]
                assert "repair_price" in pricing, f"{car_type} should have repair_price"
                assert "replace_price" in pricing, f"{car_type} should have replace_price"
                assert "repair_labor" in pricing, f"{car_type} should have repair_labor"
                assert "replace_labor" in pricing, f"{car_type} should have replace_labor"
        
        print(f"✓ GET /api/repair-parts returned {len(parts)} parts with proper pricing structure")
    
    def test_get_repair_parts_categories(self):
        """GET /api/repair-parts/categories - Should return predefined categories"""
        response = self.session.get(f"{BASE_URL}/api/repair-parts/categories")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        categories = response.json()
        assert isinstance(categories, list), "Response should be a list"
        assert len(categories) > 0, "Should have at least one category"
        
        # Verify category structure
        for cat in categories:
            assert "id" in cat, "Category should have id"
            assert "name" in cat, "Category should have name"
        
        print(f"✓ GET /api/repair-parts/categories returned {len(categories)} categories")
    
    def test_create_repair_part(self):
        """POST /api/repair-parts - Create new part with pricing"""
        test_part = {
            "name": "TEST_Front Bumper Assembly",
            "category": "body_panels",
            "description": "Test part for automated testing",
            "part_number": "TEST-FBA-001",
            "hatchback": {"repair_price": 2500, "replace_price": 8000, "repair_labor": 500, "replace_labor": 1000},
            "sedan": {"repair_price": 3000, "replace_price": 10000, "repair_labor": 600, "replace_labor": 1200},
            "suv": {"repair_price": 4000, "replace_price": 15000, "repair_labor": 800, "replace_labor": 1500},
            "brand_overrides": [],
            "is_active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/repair-parts", json=test_part)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created_part = response.json()
        assert "id" in created_part, "Created part should have id"
        assert created_part["name"] == test_part["name"], "Name should match"
        assert created_part["category"] == test_part["category"], "Category should match"
        
        # Verify pricing was saved
        assert created_part["hatchback"]["repair_price"] == 2500, "Hatchback repair price should match"
        assert created_part["sedan"]["replace_price"] == 10000, "Sedan replace price should match"
        
        print(f"✓ POST /api/repair-parts created part: {created_part['name']}")
        
        # Cleanup - delete the test part
        self.session.delete(f"{BASE_URL}/api/repair-parts/{created_part['id']}")
    
    def test_get_single_repair_part(self):
        """GET /api/repair-parts/{part_id} - Get specific part"""
        # First get all parts to get a valid ID
        response = self.session.get(f"{BASE_URL}/api/repair-parts")
        parts = response.json()
        
        if parts:
            part_id = parts[0]["id"]
            response = self.session.get(f"{BASE_URL}/api/repair-parts/{part_id}")
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            part = response.json()
            assert part["id"] == part_id, "Part ID should match"
            
            print(f"✓ GET /api/repair-parts/{part_id} returned part: {part['name']}")
    
    # ==================== REPAIR RULES TESTS ====================
    
    def test_get_repair_rules_returns_96_rules(self):
        """GET /api/repair-rules - Should return 96 rules linking questions to parts"""
        response = self.session.get(f"{BASE_URL}/api/repair-rules")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        rules = response.json()
        assert isinstance(rules, list), "Response should be a list"
        assert len(rules) == 96, f"Expected 96 rules, got {len(rules)}"
        
        # Verify rule structure - rules use flat structure with condition_type/condition_value
        if rules:
            rule = rules[0]
            assert "id" in rule, "Rule should have id"
            assert "part_id" in rule, "Rule should have part_id"
            assert "question_id" in rule, "Rule should have question_id"
            assert "question_text" in rule, "Rule should have question_text"
            assert "part" in rule, "Rule should have enriched part data"
            
            # Check for flat condition structure (used by seed data)
            assert "condition_type" in rule or "conditions" in rule, "Rule should have condition_type or conditions"
            assert "action_type" in rule or "conditions" in rule, "Rule should have action_type or conditions"
            
            # Verify part enrichment
            if rule.get("part"):
                assert "name" in rule["part"], "Part should have name"
                assert "category" in rule["part"], "Part should have category"
        
        print(f"✓ GET /api/repair-rules returned {len(rules)} rules with linked questions")
    
    def test_get_available_questions_returns_38_questions(self):
        """GET /api/repair-rules/available-questions - Should return 38 questions from Q&A categories"""
        response = self.session.get(f"{BASE_URL}/api/repair-rules/available-questions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        questions = response.json()
        assert isinstance(questions, list), "Response should be a list"
        assert len(questions) == 38, f"Expected 38 questions, got {len(questions)}"
        
        # Verify question structure
        if questions:
            q = questions[0]
            assert "question_id" in q, "Question should have question_id"
            assert "question_text" in q, "Question should have question_text"
            assert "category_name" in q, "Question should have category_name"
        
        print(f"✓ GET /api/repair-rules/available-questions returned {len(questions)} questions")
    
    def test_create_repair_rule_with_conditions_array(self):
        """POST /api/repair-rules - Create new rule with conditions array structure"""
        # First get a part and question to link
        parts_response = self.session.get(f"{BASE_URL}/api/repair-parts")
        parts = parts_response.json()
        
        questions_response = self.session.get(f"{BASE_URL}/api/repair-rules/available-questions")
        questions = questions_response.json()
        
        if parts and questions:
            test_rule = {
                "part_id": parts[0]["id"],
                "question_id": questions[0]["question_id"],
                "question_text": questions[0]["question_text"],
                "conditions": [
                    {
                        "condition": {"operator": "equals", "value": "Yes"},
                        "action": {"action_type": "repair", "priority": "high", "notes": "Test rule"}
                    }
                ],
                "is_active": True
            }
            
            response = self.session.post(f"{BASE_URL}/api/repair-rules", json=test_rule)
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            created_rule = response.json()
            assert "id" in created_rule, "Created rule should have id"
            assert created_rule["part_id"] == test_rule["part_id"], "Part ID should match"
            assert created_rule["question_id"] == test_rule["question_id"], "Question ID should match"
            
            print(f"✓ POST /api/repair-rules created rule linking part to question")
            
            # Cleanup - delete the test rule
            self.session.delete(f"{BASE_URL}/api/repair-rules/{created_rule['id']}")
    
    def test_get_single_repair_rule(self):
        """GET /api/repair-rules/{rule_id} - Get specific rule"""
        # First get all rules to get a valid ID
        response = self.session.get(f"{BASE_URL}/api/repair-rules")
        rules = response.json()
        
        if rules:
            rule_id = rules[0]["id"]
            response = self.session.get(f"{BASE_URL}/api/repair-rules/{rule_id}")
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            rule = response.json()
            assert rule["id"] == rule_id, "Rule ID should match"
            assert "part" in rule, "Rule should have enriched part data"
            
            print(f"✓ GET /api/repair-rules/{rule_id} returned rule with part: {rule.get('part', {}).get('name')}")
    
    # ==================== DATA VALIDATION TESTS ====================
    
    def test_parts_have_valid_categories(self):
        """Verify all parts have valid category IDs"""
        # Get categories
        cat_response = self.session.get(f"{BASE_URL}/api/repair-parts/categories")
        categories = cat_response.json()
        valid_category_ids = {cat["id"] for cat in categories}
        
        # Get parts
        parts_response = self.session.get(f"{BASE_URL}/api/repair-parts")
        parts = parts_response.json()
        
        for part in parts:
            assert part["category"] in valid_category_ids, f"Part '{part['name']}' has invalid category: {part['category']}"
        
        print(f"✓ All {len(parts)} parts have valid category IDs")
    
    def test_rules_reference_valid_parts(self):
        """Verify all rules reference existing parts"""
        # Get parts
        parts_response = self.session.get(f"{BASE_URL}/api/repair-parts")
        parts = parts_response.json()
        valid_part_ids = {part["id"] for part in parts}
        
        # Get rules
        rules_response = self.session.get(f"{BASE_URL}/api/repair-rules")
        rules = rules_response.json()
        
        for rule in rules:
            assert rule["part_id"] in valid_part_ids, f"Rule references invalid part_id: {rule['part_id']}"
        
        print(f"✓ All {len(rules)} rules reference valid parts")
    
    def test_rules_have_valid_structure(self):
        """Verify all rules have properly structured conditions (flat or nested)"""
        rules_response = self.session.get(f"{BASE_URL}/api/repair-rules")
        rules = rules_response.json()
        
        valid_action_types = ["repair", "replace", "inspect_further", "REPAIR", "REPLACE", "INSPECT_FURTHER"]
        
        for rule in rules:
            # Rules can have either flat structure (condition_type/action_type) or nested (conditions array)
            has_flat_structure = "condition_type" in rule and "action_type" in rule
            has_nested_structure = "conditions" in rule and len(rule.get("conditions", [])) > 0
            
            assert has_flat_structure or has_nested_structure, f"Rule {rule['id']} should have either flat or nested condition structure"
            
            if has_flat_structure:
                action_type = rule.get("action_type", "")
                assert action_type.upper() in [a.upper() for a in valid_action_types], f"Invalid action_type: {action_type}"
        
        print(f"✓ All {len(rules)} rules have valid condition structures")
    
    def test_questions_have_unique_ids(self):
        """Verify all available questions have unique IDs"""
        questions_response = self.session.get(f"{BASE_URL}/api/repair-rules/available-questions")
        questions = questions_response.json()
        
        question_ids = [q["question_id"] for q in questions]
        unique_ids = set(question_ids)
        
        assert len(question_ids) == len(unique_ids), f"Found duplicate question IDs: {len(question_ids)} total, {len(unique_ids)} unique"
        
        print(f"✓ All {len(questions)} questions have unique IDs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
