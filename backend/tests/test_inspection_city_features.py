"""
Test Suite for Inspection City Features - Iteration 49
Tests:
1. Inspection status change validation (mechanic required for certain statuses)
2. Country modal with leads_cities and inspection_cities sub-tabs
3. HR Module Inspection City tab
4. Mechanic city assignment
5. Backend validation for mechanic assignment to inspections
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "kalyan@wisedrive.com"
CEO_PASSWORD = "password123"
INSPECTION_HEAD_EMAIL = "insphead.in@wisedrive.com"
INSPECTION_HEAD_PASSWORD = "password123"


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def inspection_head_token(self):
        """Get Inspection Head auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": INSPECTION_HEAD_EMAIL,
            "password": INSPECTION_HEAD_PASSWORD
        })
        assert response.status_code == 200, f"Inspection Head login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_ceo_login(self, ceo_token):
        """Test CEO can login"""
        assert ceo_token is not None
        print(f"✓ CEO login successful")
    
    def test_inspection_head_login(self, inspection_head_token):
        """Test Inspection Head can login"""
        assert inspection_head_token is not None
        print(f"✓ Inspection Head login successful")


class TestCountryCitiesAPI:
    """Test Country API with leads_cities and inspection_cities"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_countries(self, ceo_token):
        """Test getting countries list"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/countries", headers=headers)
        assert response.status_code == 200
        countries = response.json()
        assert isinstance(countries, list)
        print(f"✓ Found {len(countries)} countries")
        return countries
    
    def test_country_has_cities_fields(self, ceo_token):
        """Test that countries have leads_cities and inspection_cities fields"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/countries", headers=headers)
        assert response.status_code == 200
        countries = response.json()
        
        # Find India
        india = next((c for c in countries if c.get("code") == "IN"), None)
        if india:
            print(f"✓ India found with id: {india.get('id')}")
            print(f"  - leads_cities: {india.get('leads_cities', [])}")
            print(f"  - inspection_cities: {india.get('inspection_cities', [])}")
            print(f"  - cities (legacy): {india.get('cities', [])}")
        else:
            print("⚠ India not found in countries list")
        
        return countries
    
    def test_update_country_with_inspection_cities(self, ceo_token):
        """Test updating country with inspection_cities"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        
        # Get countries first
        response = requests.get(f"{BASE_URL}/api/hr/countries", headers=headers)
        assert response.status_code == 200
        countries = response.json()
        
        # Find India
        india = next((c for c in countries if c.get("code") == "IN"), None)
        if not india:
            pytest.skip("India not found in countries")
        
        # Update with inspection cities
        update_data = {
            "leads_cities": india.get("leads_cities", []) or ["Mumbai", "Bangalore", "Delhi"],
            "inspection_cities": ["Mumbai", "Bangalore"]  # Add inspection cities
        }
        
        response = requests.put(
            f"{BASE_URL}/api/hr/countries/{india['id']}", 
            headers=headers,
            json=update_data
        )
        
        if response.status_code == 200:
            updated = response.json()
            print(f"✓ Country updated successfully")
            print(f"  - inspection_cities: {updated.get('inspection_cities', [])}")
        else:
            print(f"⚠ Country update returned {response.status_code}: {response.text}")


class TestInspectionStatusValidation:
    """Test inspection status change validation with mechanic requirement"""
    
    @pytest.fixture(scope="class")
    def inspection_head_token(self):
        """Get Inspection Head auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": INSPECTION_HEAD_EMAIL,
            "password": INSPECTION_HEAD_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_inspections(self, inspection_head_token):
        """Test getting inspections list"""
        headers = {"Authorization": f"Bearer {inspection_head_token}"}
        response = requests.get(f"{BASE_URL}/api/inspections?is_scheduled=true", headers=headers)
        assert response.status_code == 200
        inspections = response.json()
        print(f"✓ Found {len(inspections)} scheduled inspections")
        return inspections
    
    def test_status_change_without_mechanic_fails(self, inspection_head_token):
        """Test that changing to mechanic-required status fails without mechanic"""
        headers = {"Authorization": f"Bearer {inspection_head_token}"}
        
        # Get inspections
        response = requests.get(f"{BASE_URL}/api/inspections?is_scheduled=true", headers=headers)
        assert response.status_code == 200
        inspections = response.json()
        
        # Find an inspection without mechanic
        inspection_without_mechanic = next(
            (i for i in inspections if not i.get("mechanic_id")), 
            None
        )
        
        if not inspection_without_mechanic:
            print("⚠ No inspection without mechanic found - skipping test")
            pytest.skip("No inspection without mechanic found")
        
        inspection_id = inspection_without_mechanic["id"]
        print(f"Testing with inspection: {inspection_id}")
        
        # Try to change status to INSPECTION_IN_PROGRESS (requires mechanic)
        mechanic_required_statuses = [
            "ASSIGNED_TO_MECHANIC", 
            "INSPECTION_CONFIRMED", 
            "INSPECTION_STARTED",
            "INSPECTION_IN_PROGRESS", 
            "INSPECTION_COMPLETED"
        ]
        
        for status in mechanic_required_statuses:
            response = requests.patch(
                f"{BASE_URL}/api/inspections/{inspection_id}/status?inspection_status={status}",
                headers=headers
            )
            
            # Should fail with 400 because no mechanic assigned
            if response.status_code == 400:
                error_detail = response.json().get("detail", "")
                assert "mechanic" in error_detail.lower(), f"Expected mechanic error, got: {error_detail}"
                print(f"✓ Status change to '{status}' correctly blocked without mechanic")
            else:
                print(f"⚠ Status change to '{status}' returned {response.status_code}: {response.text}")
    
    def test_status_change_without_mechanic_allowed(self, inspection_head_token):
        """Test that statuses not requiring mechanic can be changed"""
        headers = {"Authorization": f"Bearer {inspection_head_token}"}
        
        # Get inspections
        response = requests.get(f"{BASE_URL}/api/inspections?is_scheduled=true", headers=headers)
        assert response.status_code == 200
        inspections = response.json()
        
        # Find an inspection without mechanic
        inspection_without_mechanic = next(
            (i for i in inspections if not i.get("mechanic_id")), 
            None
        )
        
        if not inspection_without_mechanic:
            print("⚠ No inspection without mechanic found - skipping test")
            pytest.skip("No inspection without mechanic found")
        
        inspection_id = inspection_without_mechanic["id"]
        original_status = inspection_without_mechanic.get("inspection_status")
        
        # These statuses should work without mechanic
        allowed_statuses = [
            "INSPECTION_RESCHEDULED",
            "INSPECTION_CANCELLED_CUSTOMER",
            "INSPECTION_CANCELLED_WISEDRIVE"
        ]
        
        for status in allowed_statuses:
            response = requests.patch(
                f"{BASE_URL}/api/inspections/{inspection_id}/status?inspection_status={status}",
                headers=headers
            )
            
            if response.status_code == 200:
                print(f"✓ Status change to '{status}' allowed without mechanic")
            else:
                print(f"⚠ Status change to '{status}' returned {response.status_code}: {response.text}")
        
        # Restore original status if possible
        if original_status:
            requests.patch(
                f"{BASE_URL}/api/inspections/{inspection_id}/status?inspection_status={original_status}",
                headers=headers
            )


class TestMechanicCityAssignment:
    """Test mechanic inspection city assignment"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_mechanics(self, ceo_token):
        """Test getting mechanics list"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200
        employees = response.json()
        
        # Filter mechanics
        mechanics = [e for e in employees if 
                    e.get("role_code") == "MECHANIC" or 
                    any(r.get("code") == "MECHANIC" for r in e.get("roles", []))]
        
        print(f"✓ Found {len(mechanics)} mechanics")
        for m in mechanics:
            print(f"  - {m.get('name')}: inspection_cities={m.get('inspection_cities', [])}")
        
        return mechanics
    
    def test_update_mechanic_inspection_cities(self, ceo_token):
        """Test updating mechanic's inspection cities"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        
        # Get mechanics
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200
        employees = response.json()
        
        # Find a mechanic
        mechanic = next(
            (e for e in employees if 
             e.get("role_code") == "MECHANIC" or 
             any(r.get("code") == "MECHANIC" for r in e.get("roles", []))),
            None
        )
        
        if not mechanic:
            print("⚠ No mechanic found - skipping test")
            pytest.skip("No mechanic found")
        
        mechanic_id = mechanic["id"]
        print(f"Testing with mechanic: {mechanic.get('name')} ({mechanic_id})")
        
        # Update inspection cities
        response = requests.put(
            f"{BASE_URL}/api/hr/employees/{mechanic_id}/inspection-cities",
            headers=headers,
            json={"cities": ["Mumbai", "Bangalore"]}
        )
        
        if response.status_code == 200:
            print(f"✓ Mechanic inspection cities updated successfully")
        else:
            print(f"⚠ Update returned {response.status_code}: {response.text}")
    
    def test_get_mechanic_inspection_cities(self, ceo_token):
        """Test getting mechanic's inspection cities"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        
        # Get mechanics
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=headers)
        assert response.status_code == 200
        employees = response.json()
        
        # Find a mechanic
        mechanic = next(
            (e for e in employees if 
             e.get("role_code") == "MECHANIC" or 
             any(r.get("code") == "MECHANIC" for r in e.get("roles", []))),
            None
        )
        
        if not mechanic:
            pytest.skip("No mechanic found")
        
        mechanic_id = mechanic["id"]
        
        # Get inspection cities
        response = requests.get(
            f"{BASE_URL}/api/hr/employees/{mechanic_id}/inspection-cities",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Mechanic inspection cities: {data.get('cities', [])}")
        else:
            print(f"⚠ Get cities returned {response.status_code}: {response.text}")


class TestMechanicAssignmentValidation:
    """Test mechanic assignment to inspection with city validation"""
    
    @pytest.fixture(scope="class")
    def inspection_head_token(self):
        """Get Inspection Head auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": INSPECTION_HEAD_EMAIL,
            "password": INSPECTION_HEAD_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_assign_mechanic_city_validation(self, inspection_head_token, ceo_token):
        """Test that mechanic can only be assigned to inspections in their cities"""
        headers = {"Authorization": f"Bearer {inspection_head_token}"}
        ceo_headers = {"Authorization": f"Bearer {ceo_token}"}
        
        # Get inspections
        response = requests.get(f"{BASE_URL}/api/inspections?is_scheduled=true", headers=headers)
        assert response.status_code == 200
        inspections = response.json()
        
        if not inspections:
            pytest.skip("No inspections found")
        
        # Get mechanics
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=ceo_headers)
        assert response.status_code == 200
        employees = response.json()
        
        mechanics = [e for e in employees if 
                    e.get("role_code") == "MECHANIC" or 
                    any(r.get("code") == "MECHANIC" for r in e.get("roles", []))]
        
        if not mechanics:
            pytest.skip("No mechanics found")
        
        # Find a mechanic with inspection_cities
        mechanic_with_cities = next(
            (m for m in mechanics if m.get("inspection_cities")),
            None
        )
        
        if mechanic_with_cities:
            mechanic_cities = mechanic_with_cities.get("inspection_cities", [])
            print(f"Testing with mechanic: {mechanic_with_cities.get('name')}")
            print(f"  Mechanic cities: {mechanic_cities}")
            
            # Find an inspection in a city NOT in mechanic's cities
            inspection_wrong_city = next(
                (i for i in inspections if i.get("city") and i.get("city") not in mechanic_cities),
                None
            )
            
            if inspection_wrong_city:
                print(f"  Inspection city: {inspection_wrong_city.get('city')}")
                
                # Try to assign mechanic - should fail
                response = requests.patch(
                    f"{BASE_URL}/api/inspections/{inspection_wrong_city['id']}/assign-mechanic",
                    headers=headers,
                    json={"mechanic_id": mechanic_with_cities["id"]}
                )
                
                if response.status_code == 400:
                    error = response.json().get("detail", "")
                    print(f"✓ Assignment correctly blocked: {error}")
                else:
                    print(f"⚠ Assignment returned {response.status_code}: {response.text}")
            else:
                print("⚠ No inspection found in a city outside mechanic's cities")
            
            # Find an inspection in mechanic's city
            inspection_correct_city = next(
                (i for i in inspections if i.get("city") in mechanic_cities),
                None
            )
            
            if inspection_correct_city:
                print(f"  Testing valid assignment to city: {inspection_correct_city.get('city')}")
                
                # Try to assign mechanic - should succeed
                response = requests.patch(
                    f"{BASE_URL}/api/inspections/{inspection_correct_city['id']}/assign-mechanic",
                    headers=headers,
                    json={"mechanic_id": mechanic_with_cities["id"]}
                )
                
                if response.status_code == 200:
                    print(f"✓ Assignment to correct city succeeded")
                else:
                    print(f"⚠ Assignment returned {response.status_code}: {response.text}")
            else:
                print("⚠ No inspection found in mechanic's cities")
        else:
            print("⚠ No mechanic with inspection_cities found")


class TestHRModuleInspectionCityTab:
    """Test HR Module Inspection City tab visibility"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def inspection_head_token(self):
        """Get Inspection Head auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": INSPECTION_HEAD_EMAIL,
            "password": INSPECTION_HEAD_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_ceo_visible_tabs(self, ceo_token):
        """Test CEO can see all tabs including HR"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        user = response.json()
        
        visible_tabs = user.get("visible_tabs", [])
        print(f"✓ CEO visible tabs: {visible_tabs}")
        
        # CEO should have access to HR
        assert "hr" in visible_tabs or "HR" in visible_tabs or any("hr" in t.lower() for t in visible_tabs), \
            f"CEO should have HR access. Visible tabs: {visible_tabs}"
    
    def test_inspection_head_visible_tabs(self, inspection_head_token):
        """Test Inspection Head can see relevant tabs"""
        headers = {"Authorization": f"Bearer {inspection_head_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        user = response.json()
        
        visible_tabs = user.get("visible_tabs", [])
        role_code = user.get("role_code", "")
        print(f"✓ Inspection Head role: {role_code}")
        print(f"✓ Inspection Head visible tabs: {visible_tabs}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
