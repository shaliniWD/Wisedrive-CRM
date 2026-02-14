"""
Test Suite for Attendance Calendar and Admin Sync Users Features
Tests the new calendar-based attendance view and safe user sync endpoint
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAttendanceCalendar:
    """Tests for GET /api/hr/attendance/calendar endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as HR Manager"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as HR Manager
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        assert login_res.status_code == 200, f"HR login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.hr_token = token
        
        # Also get CEO token for comparison
        ceo_login = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        if ceo_login.status_code == 200:
            self.ceo_token = ceo_login.json()["access_token"]
        else:
            self.ceo_token = None
    
    def test_calendar_endpoint_returns_200(self):
        """Test that calendar endpoint returns 200 for HR Manager"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = self.session.get(f"{BASE_URL}/api/hr/attendance/calendar", params={
            "month": current_month,
            "year": current_year
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "month" in data, "Response should contain 'month'"
        assert "year" in data, "Response should contain 'year'"
        assert "month_name" in data, "Response should contain 'month_name'"
        assert "total_days" in data, "Response should contain 'total_days'"
        assert "employees" in data, "Response should contain 'employees'"
        assert "countries" in data, "Response should contain 'countries'"
        assert "legend" in data, "Response should contain 'legend'"
        
        print(f"Calendar data for {data['month_name']} {data['year']}: {len(data['employees'])} employees")
    
    def test_calendar_employee_structure(self):
        """Test that each employee in calendar has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/hr/attendance/calendar", params={
            "month": 1,
            "year": 2026
        })
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data["employees"]) > 0:
            employee = data["employees"][0]
            
            # Check employee fields
            assert "employee_id" in employee, "Employee should have 'employee_id'"
            assert "employee_name" in employee, "Employee should have 'employee_name'"
            assert "days" in employee, "Employee should have 'days'"
            assert "summary" in employee, "Employee should have 'summary'"
            
            # Check summary structure
            summary = employee["summary"]
            assert "working_days" in summary, "Summary should have 'working_days'"
            assert "leave_approved" in summary, "Summary should have 'leave_approved'"
            assert "leave_pending" in summary, "Summary should have 'leave_pending'"
            assert "holidays" in summary, "Summary should have 'holidays'"
            assert "total_days" in summary, "Summary should have 'total_days'"
            
            print(f"Employee: {employee['employee_name']}, Summary: {summary}")
    
    def test_calendar_day_structure(self):
        """Test that each day in calendar has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/hr/attendance/calendar", params={
            "month": 1,
            "year": 2026
        })
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data["employees"]) > 0:
            employee = data["employees"][0]
            days = employee["days"]
            
            # Get first day
            first_day_key = f"2026-01-01"
            if first_day_key in days:
                day_data = days[first_day_key]
                
                assert "date" in day_data, "Day should have 'date'"
                assert "day" in day_data, "Day should have 'day'"
                assert "weekday" in day_data, "Day should have 'weekday'"
                assert "weekday_name" in day_data, "Day should have 'weekday_name'"
                assert "status" in day_data, "Day should have 'status'"
                assert "is_weekend" in day_data, "Day should have 'is_weekend'"
                
                # Status should be one of the valid values
                valid_statuses = ["working", "holiday", "leave_approved", "leave_pending"]
                assert day_data["status"] in valid_statuses, f"Invalid status: {day_data['status']}"
                
                print(f"Day data for {first_day_key}: {day_data}")
    
    def test_calendar_legend_structure(self):
        """Test that legend has correct color codes"""
        response = self.session.get(f"{BASE_URL}/api/hr/attendance/calendar", params={
            "month": 1,
            "year": 2026
        })
        
        assert response.status_code == 200
        data = response.json()
        legend = data["legend"]
        
        # Check all legend entries
        expected_keys = ["working", "holiday", "leave_approved", "leave_pending"]
        for key in expected_keys:
            assert key in legend, f"Legend should have '{key}'"
            assert "color" in legend[key], f"Legend '{key}' should have 'color'"
            assert "label" in legend[key], f"Legend '{key}' should have 'label'"
        
        print(f"Legend: {legend}")
    
    def test_calendar_country_filter(self):
        """Test that country filter works"""
        # First get countries
        countries_res = self.session.get(f"{BASE_URL}/api/countries")
        assert countries_res.status_code == 200
        countries = countries_res.json()
        
        if len(countries) > 0:
            country_id = countries[0]["id"]
            
            response = self.session.get(f"{BASE_URL}/api/hr/attendance/calendar", params={
                "month": 1,
                "year": 2026,
                "country_id": country_id
            })
            
            assert response.status_code == 200
            data = response.json()
            print(f"Filtered by country {countries[0]['name']}: {len(data['employees'])} employees")
    
    def test_calendar_search_filter(self):
        """Test that search filter works"""
        response = self.session.get(f"{BASE_URL}/api/hr/attendance/calendar", params={
            "month": 1,
            "year": 2026,
            "search": "John"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # If there are results, they should match the search
        for emp in data["employees"]:
            name_match = "john" in emp["employee_name"].lower()
            email_match = "john" in emp.get("email", "").lower()
            code_match = "john" in emp.get("employee_code", "").lower()
            assert name_match or email_match or code_match, f"Employee {emp['employee_name']} doesn't match search 'John'"
        
        print(f"Search 'John' returned {len(data['employees'])} employees")
    
    def test_calendar_unauthorized_for_regular_user(self):
        """Test that regular users cannot access calendar"""
        # Login as a sales executive (if exists)
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "john.sales@wisedrive.com",
            "password": "password123"
        })
        
        if login_res.status_code == 200:
            token = login_res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            
            response = requests.get(f"{BASE_URL}/api/hr/attendance/calendar", 
                                   params={"month": 1, "year": 2026},
                                   headers=headers)
            
            assert response.status_code == 403, f"Expected 403 for regular user, got {response.status_code}"
            print("Regular user correctly denied access to calendar")
        else:
            print("Skipping unauthorized test - sales user not found")
    
    def test_calendar_ceo_access(self):
        """Test that CEO can access calendar"""
        if self.ceo_token:
            headers = {"Authorization": f"Bearer {self.ceo_token}", "Content-Type": "application/json"}
            
            response = requests.get(f"{BASE_URL}/api/hr/attendance/calendar", 
                                   params={"month": 1, "year": 2026},
                                   headers=headers)
            
            assert response.status_code == 200, f"CEO should have access, got {response.status_code}"
            print("CEO can access calendar successfully")
        else:
            print("Skipping CEO test - CEO login failed")


class TestAdminSyncUsers:
    """Tests for POST /api/admin/sync-users endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - no auth required for sync endpoint"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_sync_users_endpoint_exists(self):
        """Test that sync-users endpoint exists and returns 200"""
        response = self.session.post(f"{BASE_URL}/api/admin/sync-users")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "message" in data, "Response should contain 'message'"
        assert "created_count" in data, "Response should contain 'created_count'"
        assert "created_users" in data, "Response should contain 'created_users'"
        assert "skipped_count" in data, "Response should contain 'skipped_count'"
        assert "skipped_users" in data, "Response should contain 'skipped_users'"
        
        print(f"Sync result: {data['message']}")
        print(f"Created: {data['created_count']}, Skipped: {data['skipped_count']}")
    
    def test_sync_users_is_idempotent(self):
        """Test that running sync twice doesn't create duplicates"""
        # First sync
        response1 = self.session.post(f"{BASE_URL}/api/admin/sync-users")
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second sync
        response2 = self.session.post(f"{BASE_URL}/api/admin/sync-users")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Second sync should skip all users that were created in first sync
        # or skip all if they already existed
        assert data2["created_count"] == 0 or data2["skipped_count"] >= data1["created_count"], \
            "Second sync should not create duplicates"
        
        print(f"First sync: created={data1['created_count']}, skipped={data1['skipped_count']}")
        print(f"Second sync: created={data2['created_count']}, skipped={data2['skipped_count']}")
    
    def test_sync_users_preserves_existing_data(self):
        """Test that sync doesn't delete existing users"""
        # Get user count before sync
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        
        if login_res.status_code == 200:
            token = login_res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            
            users_before = requests.get(f"{BASE_URL}/api/users", headers=headers)
            count_before = len(users_before.json()) if users_before.status_code == 200 else 0
            
            # Run sync
            sync_res = self.session.post(f"{BASE_URL}/api/admin/sync-users")
            assert sync_res.status_code == 200
            
            # Get user count after sync
            users_after = requests.get(f"{BASE_URL}/api/users", headers=headers)
            count_after = len(users_after.json()) if users_after.status_code == 200 else 0
            
            # Count should be same or higher (never lower)
            assert count_after >= count_before, \
                f"User count decreased after sync: {count_before} -> {count_after}"
            
            print(f"Users before: {count_before}, after: {count_after}")
        else:
            print("Skipping preservation test - HR login failed")
    
    def test_sync_users_creates_required_users(self):
        """Test that sync creates the required users"""
        response = self.session.post(f"{BASE_URL}/api/admin/sync-users")
        assert response.status_code == 200
        data = response.json()
        
        # Required users that should exist after sync
        required_emails = [
            "kalyan@wisedrive.com",
            "hr@wisedrive.com",
            "finance@wisedrive.com",
            "john.sales@wisedrive.com",
            "mike.mechanic@wisedrive.com"
        ]
        
        # All required users should be either created or skipped (already exist)
        all_users = data["created_users"] + data["skipped_users"]
        for email in required_emails:
            assert email in all_users, f"Required user {email} not in sync results"
        
        print(f"All required users accounted for: {required_emails}")
    
    def test_synced_users_can_login(self):
        """Test that synced users can login with default password"""
        # First run sync
        self.session.post(f"{BASE_URL}/api/admin/sync-users")
        
        # Try to login with each required user
        test_users = [
            ("kalyan@wisedrive.com", "CEO"),
            ("hr@wisedrive.com", "HR Manager"),
            ("finance@wisedrive.com", "Finance Manager"),
        ]
        
        for email, role in test_users:
            login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "password123"
            })
            
            assert login_res.status_code == 200, f"Login failed for {email}: {login_res.text}"
            user_data = login_res.json()["user"]
            print(f"✓ {role} ({email}) can login successfully")


class TestLoginFlow:
    """Tests for login flow with country selection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_login_countries(self):
        """Test that login countries endpoint returns countries"""
        response = self.session.get(f"{BASE_URL}/api/auth/countries")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        countries = response.json()
        
        assert isinstance(countries, list), "Response should be a list"
        assert len(countries) > 0, "Should have at least one country"
        
        # Check country structure
        for country in countries:
            assert "id" in country, "Country should have 'id'"
            assert "name" in country, "Country should have 'name'"
            assert "code" in country, "Country should have 'code'"
        
        print(f"Available countries: {[c['name'] for c in countries]}")
    
    def test_login_with_hr_credentials(self):
        """Test login with HR Manager credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@wisedrive.com",
            "password": "password123"
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data, "Response should have access_token"
        assert "user" in data, "Response should have user"
        assert data["user"]["email"] == "hr@wisedrive.com"
        
        print(f"HR Manager logged in: {data['user']['name']}")
    
    def test_login_with_ceo_credentials(self):
        """Test login with CEO credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123"
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert data["user"]["email"] == "kalyan@wisedrive.com"
        
        print(f"CEO logged in: {data['user']['name']}")
    
    def test_login_with_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@wisedrive.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Invalid credentials correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
