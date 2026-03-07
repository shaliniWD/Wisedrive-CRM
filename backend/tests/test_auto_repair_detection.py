"""
Test Auto-Repair Detection System
Tests the flow: Mechanic app → Inspections Q&A → Answers → Rules → Repairs display
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAutoRepairDetection:
    """Test auto-repair detection from Q&A answers based on repair rules"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test with authentication"""
        # Login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "country_id": "c49e1dc6-1450-40c2-9846-56b73369b2b1"
            }
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Test inspection ID (Hiba. Mol with HR29AH5542)
        self.test_inspection_id = "bb1c34e9-f226-45f8-8551-2dd164896e62"
    
    def test_repair_rules_exist(self):
        """Test that repair rules are configured in the database"""
        response = requests.get(
            f"{BASE_URL}/api/repair-rules",
            headers=self.headers
        )
        assert response.status_code == 200
        rules = response.json()
        assert len(rules) > 0, "No repair rules found"
        
        # Check for dent and scratch rules
        dent_rules = [r for r in rules if r.get('sub_answer_type') == 'dent']
        scratch_rules = [r for r in rules if r.get('sub_answer_type') == 'scratch']
        
        assert len(dent_rules) >= 30, f"Expected at least 30 dent rules, found {len(dent_rules)}"
        assert len(scratch_rules) >= 30, f"Expected at least 30 scratch rules, found {len(scratch_rules)}"
        print(f"Found {len(dent_rules)} dent rules and {len(scratch_rules)} scratch rules")
    
    def test_repair_rules_have_sub_answer_type(self):
        """Test that repair rules have sub_answer_type field for dent/scratch matching"""
        response = requests.get(
            f"{BASE_URL}/api/repair-rules",
            headers=self.headers
        )
        assert response.status_code == 200
        rules = response.json()
        
        # Sample a dent rule
        dent_rule = next((r for r in rules if r.get('sub_answer_type') == 'dent'), None)
        assert dent_rule is not None, "No dent rule found"
        assert dent_rule.get('question_id'), "Dent rule missing question_id"
        assert dent_rule.get('part_id'), "Dent rule missing part_id"
        assert dent_rule.get('condition_value') in ['1-2', '3-4', '4+'], f"Unexpected condition_value: {dent_rule.get('condition_value')}"
        
        # Sample a scratch rule
        scratch_rule = next((r for r in rules if r.get('sub_answer_type') == 'scratch'), None)
        assert scratch_rule is not None, "No scratch rule found"
        assert scratch_rule.get('question_id'), "Scratch rule missing question_id"
        assert scratch_rule.get('part_id'), "Scratch rule missing part_id"
        print(f"Dent rule sample: {dent_rule.get('part_name')} - {dent_rule.get('condition_value')}")
        print(f"Scratch rule sample: {scratch_rule.get('part_name')} - {scratch_rule.get('condition_value')}")
    
    def test_repair_parts_exist(self):
        """Test that repair parts are configured with pricing"""
        response = requests.get(
            f"{BASE_URL}/api/repair-parts",
            headers=self.headers
        )
        assert response.status_code == 200
        parts = response.json()
        assert len(parts) > 0, "No repair parts found"
        
        # Check that parts have pricing for different car types
        sample_part = parts[0]
        assert 'sedan' in sample_part or 'hatchback' in sample_part or 'suv' in sample_part, "Part missing car type pricing"
        print(f"Found {len(parts)} repair parts")
    
    def test_inspection_has_sub_answers(self):
        """Test that inspection has sub_answer_1 and sub_answer_2 in answers"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        inspection = response.json()
        
        # Check inspection_answers for sub_answer fields
        answers = inspection.get('inspection_answers', {})
        assert len(answers) > 0, "No inspection answers found"
        
        # Find answers with sub_answer_1 or sub_answer_2
        answers_with_sub = [
            (qid, ans) for qid, ans in answers.items()
            if isinstance(ans, dict) and (ans.get('sub_answer_1') or ans.get('sub_answer_2'))
        ]
        assert len(answers_with_sub) > 0, "No answers with sub_answer_1 or sub_answer_2 found"
        print(f"Found {len(answers_with_sub)} answers with sub_answer fields")
        
        # Verify sub_answer values
        for qid, ans in answers_with_sub[:3]:
            print(f"Question {qid}: Dent={ans.get('sub_answer_1')}, Scratch={ans.get('sub_answer_2')}")
    
    def test_live_progress_returns_sub_answers(self):
        """Test that live-progress API returns sub_answer_1 and sub_answer_2"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}/live-progress",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find Exterior Inspection category
        categories = data.get('categories', [])
        exterior_cat = next((c for c in categories if 'exterior' in c.get('category_name', '').lower()), None)
        assert exterior_cat is not None, "Exterior Inspection category not found"
        
        # Check questions for sub_answer fields
        questions = exterior_cat.get('questions', [])
        assert len(questions) > 0, "No questions in Exterior Inspection"
        
        questions_with_sub = [q for q in questions if q.get('sub_answer_1') or q.get('sub_answer_2')]
        assert len(questions_with_sub) > 0, "No questions with sub_answer fields in live-progress"
        
        for q in questions_with_sub[:3]:
            print(f"Q: {q.get('question_text', '')[:50]}...")
            print(f"  sub_answer_1 (Dent): {q.get('sub_answer_1')}")
            print(f"  sub_answer_2 (Scratch): {q.get('sub_answer_2')}")
    
    def test_repair_rules_match_question_ids(self):
        """Test that repair rules are linked to actual question IDs from exterior inspection"""
        # Get repair rules
        rules_response = requests.get(
            f"{BASE_URL}/api/repair-rules",
            headers=self.headers
        )
        assert rules_response.status_code == 200
        rules = rules_response.json()
        
        # Get inspection questions
        questions_response = requests.get(
            f"{BASE_URL}/api/inspection-qa/questions",
            headers=self.headers
        )
        assert questions_response.status_code == 200
        questions = questions_response.json()
        
        # Get question IDs from exterior inspection category
        exterior_questions = [q for q in questions if q.get('category_id') == 'exterior_inspection']
        exterior_question_ids = {q.get('id') for q in exterior_questions}
        
        # Check that rules reference valid question IDs
        rules_with_valid_questions = [
            r for r in rules 
            if r.get('question_id') in exterior_question_ids
        ]
        assert len(rules_with_valid_questions) > 0, "No rules linked to exterior inspection questions"
        print(f"Found {len(rules_with_valid_questions)} rules linked to exterior inspection questions")
    
    def test_repair_parts_have_pricing(self):
        """Test that repair parts have pricing for sedan (Maruti Suzuki)"""
        response = requests.get(
            f"{BASE_URL}/api/repair-parts",
            headers=self.headers
        )
        assert response.status_code == 200
        parts = response.json()
        
        # Find body panel parts (Front Bumper, Fender, Door, etc.)
        body_parts = [p for p in parts if p.get('category') == 'body_panels']
        assert len(body_parts) > 0, "No body panel parts found"
        
        for part in body_parts[:5]:
            sedan_pricing = part.get('sedan', {})
            assert sedan_pricing.get('repair_price', 0) > 0 or sedan_pricing.get('replace_price', 0) > 0, \
                f"Part {part.get('name')} has no sedan pricing"
            print(f"Part: {part.get('name')}")
            print(f"  Repair: ₹{sedan_pricing.get('repair_price', 0)} + ₹{sedan_pricing.get('repair_labor', 0)} labor")
            print(f"  Replace: ₹{sedan_pricing.get('replace_price', 0)} + ₹{sedan_pricing.get('replace_labor', 0)} labor")


class TestRepairRuleConditions:
    """Test repair rule condition matching logic"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test with authentication"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "country_id": "c49e1dc6-1450-40c2-9846-56b73369b2b1"
            }
        )
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dent_rules_condition_values(self):
        """Test that dent rules have correct condition values (1-2, 3-4, 4+)"""
        response = requests.get(
            f"{BASE_URL}/api/repair-rules",
            headers=self.headers
        )
        assert response.status_code == 200
        rules = response.json()
        
        dent_rules = [r for r in rules if r.get('sub_answer_type') == 'dent']
        condition_values = set(r.get('condition_value') for r in dent_rules)
        
        expected_values = {'1-2', '3-4', '4+'}
        assert condition_values == expected_values, f"Unexpected dent condition values: {condition_values}"
        print(f"Dent rules have correct condition values: {condition_values}")
    
    def test_scratch_rules_condition_values(self):
        """Test that scratch rules have correct condition values (1-2, 3-4, 4+)"""
        response = requests.get(
            f"{BASE_URL}/api/repair-rules",
            headers=self.headers
        )
        assert response.status_code == 200
        rules = response.json()
        
        scratch_rules = [r for r in rules if r.get('sub_answer_type') == 'scratch']
        condition_values = set(r.get('condition_value') for r in scratch_rules)
        
        expected_values = {'1-2', '3-4', '4+'}
        assert condition_values == expected_values, f"Unexpected scratch condition values: {condition_values}"
        print(f"Scratch rules have correct condition values: {condition_values}")
    
    def test_rules_have_action_types(self):
        """Test that rules have action types (REPAIR or REPLACE)"""
        response = requests.get(
            f"{BASE_URL}/api/repair-rules",
            headers=self.headers
        )
        assert response.status_code == 200
        rules = response.json()
        
        action_types = set(r.get('action_type') for r in rules if r.get('action_type'))
        assert 'REPAIR' in action_types, "No REPAIR action type found"
        
        # 4+ severity should have REPLACE action
        severe_rules = [r for r in rules if r.get('condition_value') == '4+' and r.get('sub_answer_type') == 'dent']
        replace_rules = [r for r in severe_rules if r.get('action_type') == 'REPLACE']
        assert len(replace_rules) > 0, "No REPLACE action for severe dent (4+)"
        print(f"Found action types: {action_types}")


class TestInspectionAnswerData:
    """Test inspection answer data structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test with authentication"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "kalyan@wisedrive.com",
                "password": "password123",
                "country_id": "c49e1dc6-1450-40c2-9846-56b73369b2b1"
            }
        )
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.test_inspection_id = "bb1c34e9-f226-45f8-8551-2dd164896e62"
    
    def test_inspection_answer_structure(self):
        """Test that inspection answers have correct structure with sub_answer fields"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        inspection = response.json()
        
        answers = inspection.get('inspection_answers', {})
        
        # Find an answer with sub_answer fields
        for qid, ans in answers.items():
            if isinstance(ans, dict) and ans.get('sub_answer_1'):
                assert 'sub_answer_1' in ans, "Missing sub_answer_1 field"
                assert 'sub_answer_2' in ans, "Missing sub_answer_2 field"
                
                # Verify values are valid
                valid_dent_values = ['No Dents', '1-2', '3-4', '4+']
                valid_scratch_values = ['No Scratch', '1-2', '3-4', '4+']
                
                assert ans.get('sub_answer_1') in valid_dent_values, \
                    f"Invalid sub_answer_1 value: {ans.get('sub_answer_1')}"
                assert ans.get('sub_answer_2') in valid_scratch_values, \
                    f"Invalid sub_answer_2 value: {ans.get('sub_answer_2')}"
                
                print(f"Answer structure verified: Dent={ans.get('sub_answer_1')}, Scratch={ans.get('sub_answer_2')}")
                break
    
    def test_exterior_inspection_has_5_questions(self):
        """Test that exterior inspection category has 5 questions with answers"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/{self.test_inspection_id}/live-progress",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get('categories', [])
        exterior_cat = next((c for c in categories if 'exterior' in c.get('category_name', '').lower()), None)
        assert exterior_cat is not None
        
        questions = exterior_cat.get('questions', [])
        assert len(questions) == 5, f"Expected 5 exterior questions, found {len(questions)}"
        
        # All questions should be answered
        answered = [q for q in questions if q.get('is_answered')]
        assert len(answered) == 5, f"Expected 5 answered questions, found {len(answered)}"
        print(f"Exterior Inspection: {len(answered)}/5 questions answered")
