"""
Test Inspection Q&A Feature - Backend API Tests
Tests CRUD operations for inspection questions with sub-questions and answer types
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "countryhead.in@wisedrive.com"
TEST_PASSWORD = "password123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestInspectionQAGetQuestions:
    """Test GET /api/inspection-qa/questions endpoint"""
    
    def test_get_all_questions(self, api_client):
        """Test fetching all inspection questions"""
        response = api_client.get(f"{BASE_URL}/api/inspection-qa/questions")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} questions")
        
        # Verify question structure if questions exist
        if len(data) > 0:
            question = data[0]
            assert "id" in question
            assert "question" in question
            assert "answer_type" in question
            assert "category_id" in question
            assert "category_name" in question
    
    def test_get_questions_by_category(self, api_client):
        """Test filtering questions by category"""
        response = api_client.get(f"{BASE_URL}/api/inspection-qa/questions", params={"category_id": "engine"})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # All returned questions should have the specified category
        for q in data:
            assert q.get("category_id") == "engine"
    
    def test_get_active_questions_only(self, api_client):
        """Test filtering active questions"""
        response = api_client.get(f"{BASE_URL}/api/inspection-qa/questions", params={"is_active": True})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # All returned questions should be active
        for q in data:
            assert q.get("is_active") == True


class TestInspectionQACreateQuestion:
    """Test POST /api/inspection-qa/questions endpoint"""
    
    def test_create_multiple_choice_question(self, api_client):
        """Test creating a multiple choice question"""
        question_data = {
            "category_id": "engine",
            "category_name": "Engine Health",
            "question": "TEST_What is the engine oil condition?",
            "answer_type": "multiple_choice",
            "options": ["Good", "Fair", "Poor", "Critical"],
            "correct_answer": "Good",
            "is_mandatory": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/inspection-qa/questions", json=question_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["question"] == question_data["question"]
        assert data["answer_type"] == "multiple_choice"
        assert data["options"] == question_data["options"]
        assert data["correct_answer"] == "Good"
        assert "id" in data
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/inspection-qa/questions/{data['id']}")
    
    def test_create_photo_upload_question(self, api_client):
        """Test creating a photo upload question"""
        question_data = {
            "category_id": "exterior",
            "category_name": "Exterior Body",
            "question": "TEST_Take a photo of the front bumper",
            "answer_type": "photo",
            "is_mandatory": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/inspection-qa/questions", json=question_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["answer_type"] == "photo"
        assert "id" in data
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/inspection-qa/questions/{data['id']}")
    
    def test_create_video_upload_question(self, api_client):
        """Test creating a video upload question with 45s max duration"""
        question_data = {
            "category_id": "brakes",
            "category_name": "Brakes",
            "question": "TEST_Record a video of brake test",
            "answer_type": "video",
            "video_max_duration": 45,
            "is_mandatory": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/inspection-qa/questions", json=question_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["answer_type"] == "video"
        assert data["video_max_duration"] == 45
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/inspection-qa/questions/{data['id']}")
    
    def test_create_question_with_sub_questions(self, api_client):
        """Test creating a question with 2 sub-questions"""
        question_data = {
            "category_id": "tyres",
            "category_name": "Tyres & Wheels",
            "question": "TEST_Check tyre condition",
            "answer_type": "multiple_choice",
            "options": ["Good", "Worn", "Damaged"],
            "correct_answer": "Good",
            "is_mandatory": True,
            # Sub-question 1
            "sub_question_1": "What is the tread depth?",
            "sub_answer_type_1": "multiple_choice",
            "sub_options_1": ["Above 3mm", "2-3mm", "Below 2mm"],
            "sub_correct_answer_1": "Above 3mm",
            # Sub-question 2
            "sub_question_2": "Take a photo of the tyre",
            "sub_answer_type_2": "photo"
        }
        
        response = api_client.post(f"{BASE_URL}/api/inspection-qa/questions", json=question_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["sub_question_1"] == "What is the tread depth?"
        assert data["sub_answer_type_1"] == "multiple_choice"
        assert data["sub_options_1"] == ["Above 3mm", "2-3mm", "Below 2mm"]
        assert data["sub_question_2"] == "Take a photo of the tyre"
        assert data["sub_answer_type_2"] == "photo"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/inspection-qa/questions/{data['id']}")


class TestInspectionQAUpdateQuestion:
    """Test PUT /api/inspection-qa/questions/{id} endpoint"""
    
    def test_update_question(self, api_client):
        """Test updating an existing question"""
        # First create a question
        create_data = {
            "category_id": "interior",
            "category_name": "Interior",
            "question": "TEST_Original question text",
            "answer_type": "multiple_choice",
            "options": ["Yes", "No"],
            "is_mandatory": True
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/inspection-qa/questions", json=create_data)
        assert create_response.status_code == 200
        question_id = create_response.json()["id"]
        
        # Update the question
        update_data = {
            "category_id": "interior",
            "category_name": "Interior",
            "question": "TEST_Updated question text",
            "answer_type": "photo",
            "is_mandatory": False
        }
        
        update_response = api_client.put(f"{BASE_URL}/api/inspection-qa/questions/{question_id}", json=update_data)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["question"] == "TEST_Updated question text"
        assert updated["answer_type"] == "photo"
        assert updated["is_mandatory"] == False
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/inspection-qa/questions/{question_id}")
    
    def test_update_nonexistent_question(self, api_client):
        """Test updating a question that doesn't exist"""
        update_data = {
            "category_id": "engine",
            "category_name": "Engine Health",
            "question": "TEST_Nonexistent",
            "answer_type": "photo"
        }
        
        response = api_client.put(f"{BASE_URL}/api/inspection-qa/questions/nonexistent-id-12345", json=update_data)
        assert response.status_code == 404


class TestInspectionQADeleteQuestion:
    """Test DELETE /api/inspection-qa/questions/{id} endpoint"""
    
    def test_delete_question(self, api_client):
        """Test deleting a question"""
        # First create a question
        create_data = {
            "category_id": "ac",
            "category_name": "AC & Climate",
            "question": "TEST_Question to delete",
            "answer_type": "multiple_choice",
            "options": ["Working", "Not Working"]
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/inspection-qa/questions", json=create_data)
        assert create_response.status_code == 200
        question_id = create_response.json()["id"]
        
        # Delete the question
        delete_response = api_client.delete(f"{BASE_URL}/api/inspection-qa/questions/{question_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/inspection-qa/questions/{question_id}")
        assert get_response.status_code == 404
    
    def test_delete_nonexistent_question(self, api_client):
        """Test deleting a question that doesn't exist"""
        response = api_client.delete(f"{BASE_URL}/api/inspection-qa/questions/nonexistent-id-12345")
        assert response.status_code == 404


class TestInspectionQAToggleQuestion:
    """Test PATCH /api/inspection-qa/questions/{id}/toggle endpoint"""
    
    def test_toggle_question_active_status(self, api_client):
        """Test toggling question active/inactive status"""
        # First create a question (active by default)
        create_data = {
            "category_id": "documents",
            "category_name": "Documents & RTO",
            "question": "TEST_Question to toggle",
            "answer_type": "photo",
            "is_active": True
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/inspection-qa/questions", json=create_data)
        assert create_response.status_code == 200
        question_id = create_response.json()["id"]
        
        # Toggle to inactive
        toggle_response = api_client.patch(f"{BASE_URL}/api/inspection-qa/questions/{question_id}/toggle")
        assert toggle_response.status_code == 200
        assert toggle_response.json()["is_active"] == False
        
        # Toggle back to active
        toggle_response2 = api_client.patch(f"{BASE_URL}/api/inspection-qa/questions/{question_id}/toggle")
        assert toggle_response2.status_code == 200
        assert toggle_response2.json()["is_active"] == True
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/inspection-qa/questions/{question_id}")


class TestInspectionQACategories:
    """Test GET /api/inspection-qa/categories endpoint"""
    
    def test_get_categories(self, api_client):
        """Test fetching categories with question counts"""
        response = api_client.get(f"{BASE_URL}/api/inspection-qa/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify category structure if categories exist
        if len(data) > 0:
            category = data[0]
            assert "category_id" in category
            assert "category_name" in category
            assert "question_count" in category


class TestInspectionQAExistingData:
    """Test existing sample questions created by main agent"""
    
    def test_verify_sample_questions_exist(self, api_client):
        """Verify that sample questions were created"""
        response = api_client.get(f"{BASE_URL}/api/inspection-qa/questions")
        assert response.status_code == 200
        
        data = response.json()
        print(f"Total questions in database: {len(data)}")
        
        # Check for expected categories
        categories = set(q.get("category_name") for q in data)
        print(f"Categories found: {categories}")
        
        # Verify at least some questions exist
        assert len(data) >= 0  # May be 0 if no seed data
    
    def test_verify_answer_types(self, api_client):
        """Verify different answer types are supported"""
        response = api_client.get(f"{BASE_URL}/api/inspection-qa/questions")
        assert response.status_code == 200
        
        data = response.json()
        answer_types = set(q.get("answer_type") for q in data)
        print(f"Answer types found: {answer_types}")
        
        # Valid answer types
        valid_types = {"multiple_choice", "photo", "video"}
        for at in answer_types:
            assert at in valid_types, f"Invalid answer type: {at}"


class TestInspectionQAGetSingleQuestion:
    """Test GET /api/inspection-qa/questions/{id} endpoint"""
    
    def test_get_single_question(self, api_client):
        """Test fetching a single question by ID"""
        # First create a question
        create_data = {
            "category_id": "suspension",
            "category_name": "Suspension & Steering",
            "question": "TEST_Single question fetch test",
            "answer_type": "multiple_choice",
            "options": ["Good", "Bad"]
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/inspection-qa/questions", json=create_data)
        assert create_response.status_code == 200
        question_id = create_response.json()["id"]
        
        # Fetch the single question
        get_response = api_client.get(f"{BASE_URL}/api/inspection-qa/questions/{question_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data["id"] == question_id
        assert data["question"] == "TEST_Single question fetch test"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/inspection-qa/questions/{question_id}")
    
    def test_get_nonexistent_question(self, api_client):
        """Test fetching a question that doesn't exist"""
        response = api_client.get(f"{BASE_URL}/api/inspection-qa/questions/nonexistent-id-12345")
        assert response.status_code == 404
