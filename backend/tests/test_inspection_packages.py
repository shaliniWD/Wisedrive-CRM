"""
Test Inspection Packages Feature - Categories and Packages CRUD
Tests for the new Inspection Packages feature in Settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mechanic-sync-fix.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "kalyan@wisedrive.com"
TEST_PASSWORD = "password123"


class TestInspectionPackagesAPI:
    """Test Inspection Categories and Packages API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token and country_id"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        login_data = login_response.json()
        self.token = login_data.get("access_token")
        self.user = login_data.get("user", {})
        self.country_id = self.user.get("country_id")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get countries to ensure we have a valid country_id
        countries_response = self.session.get(f"{BASE_URL}/api/countries")
        if countries_response.status_code == 200:
            countries = countries_response.json()
            if countries and not self.country_id:
                self.country_id = countries[0].get("id")
        
        print(f"Logged in as: {self.user.get('email')}, Country ID: {self.country_id}")
    
    # ==================== INSPECTION CATEGORIES TESTS ====================
    
    def test_get_inspection_categories_empty_or_list(self):
        """GET /api/inspection-categories - should return empty array or list of categories"""
        response = self.session.get(
            f"{BASE_URL}/api/inspection-categories",
            params={"country_id": self.country_id}
        )
        
        assert response.status_code == 200, f"Failed to get categories: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} existing categories")
    
    def test_create_inspection_category(self):
        """POST /api/inspection-categories - create a new category with items and benefits"""
        category_data = {
            "name": "TEST_Physical/Manual Inspection",
            "description": "Comprehensive physical inspection of the vehicle",
            "check_points": 135,
            "icon": "wrench",
            "color": "#3B82F6",
            "items": [
                {"name": "Engine & Transmission Check"},
                {"name": "Brake System Inspection"},
                {"name": "Suspension Check"},
                {"name": "Electrical System Test"}
            ],
            "benefits": [
                {"name": "Flood Vehicle Check"},
                {"name": "Accident History Verification"}
            ],
            "is_free": False,
            "order": 1
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json=category_data,
            params={"country_id": self.country_id}
        )
        
        assert response.status_code == 200, f"Failed to create category: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain id"
        assert data["name"] == category_data["name"], "Name should match"
        assert data["check_points"] == category_data["check_points"], "Check points should match"
        assert "items" in data, "Response should contain items"
        assert "benefits" in data, "Response should contain benefits"
        
        # Store for cleanup
        self.created_category_id = data["id"]
        print(f"Created category: {data['name']} with ID: {data['id']}")
        
        return data
    
    def test_create_obd2_category(self):
        """POST /api/inspection-categories - create OBD2 Scanner Test category"""
        category_data = {
            "name": "TEST_OBD2 Scanner Test",
            "description": "Electronic diagnostic scan of vehicle systems",
            "check_points": 76,
            "icon": "cpu",
            "color": "#10B981",
            "items": [
                {"name": "Engine Control Module Scan"},
                {"name": "Transmission Module Scan"},
                {"name": "ABS Module Scan"},
                {"name": "Airbag System Scan"}
            ],
            "benefits": [
                {"name": "Detailed Error Code Report"},
                {"name": "System Health Score"}
            ],
            "is_free": False,
            "order": 2
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json=category_data,
            params={"country_id": self.country_id}
        )
        
        assert response.status_code == 200, f"Failed to create OBD2 category: {response.text}"
        data = response.json()
        
        assert data["name"] == category_data["name"]
        assert data["check_points"] == 76
        print(f"Created OBD2 category with ID: {data['id']}")
        
        return data
    
    def test_update_inspection_category(self):
        """PUT /api/inspection-categories/:id - update a category"""
        # First create a category
        create_response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json={
                "name": "TEST_Category_To_Update",
                "check_points": 50,
                "items": [{"name": "Test Item"}],
                "benefits": []
            },
            params={"country_id": self.country_id}
        )
        assert create_response.status_code == 200
        category = create_response.json()
        category_id = category["id"]
        
        # Update the category
        update_data = {
            "name": "TEST_Updated_Category_Name",
            "check_points": 100,
            "items": [
                {"name": "Updated Item 1"},
                {"name": "Updated Item 2"}
            ]
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/inspection-categories/{category_id}",
            json=update_data
        )
        
        assert update_response.status_code == 200, f"Failed to update category: {update_response.text}"
        updated = update_response.json()
        
        assert updated["name"] == update_data["name"], "Name should be updated"
        assert updated["check_points"] == update_data["check_points"], "Check points should be updated"
        print(f"Updated category: {updated['name']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/inspection-categories/{category_id}")
    
    def test_delete_inspection_category(self):
        """DELETE /api/inspection-categories/:id - soft delete a category"""
        # First create a category
        create_response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json={
                "name": "TEST_Category_To_Delete",
                "check_points": 25,
                "items": [],
                "benefits": []
            },
            params={"country_id": self.country_id}
        )
        assert create_response.status_code == 200
        category = create_response.json()
        category_id = category["id"]
        
        # Delete the category
        delete_response = self.session.delete(
            f"{BASE_URL}/api/inspection-categories/{category_id}"
        )
        
        assert delete_response.status_code == 200, f"Failed to delete category: {delete_response.text}"
        print(f"Deleted category: {category_id}")
    
    # ==================== INSPECTION PACKAGES TESTS ====================
    
    def test_get_inspection_packages_empty_or_list(self):
        """GET /api/inspection-packages - should return empty array or list of packages"""
        response = self.session.get(
            f"{BASE_URL}/api/inspection-packages",
            params={"country_id": self.country_id}
        )
        
        assert response.status_code == 200, f"Failed to get packages: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} existing packages")
    
    def test_create_inspection_package(self):
        """POST /api/inspection-packages - create a new package with categories"""
        # First create categories to include in package
        cat1_response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json={
                "name": "TEST_Package_Category_1",
                "check_points": 100,
                "items": [{"name": "Item 1"}],
                "benefits": []
            },
            params={"country_id": self.country_id}
        )
        assert cat1_response.status_code == 200
        cat1 = cat1_response.json()
        
        cat2_response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json={
                "name": "TEST_Package_Category_2",
                "check_points": 50,
                "items": [{"name": "Item 2"}],
                "benefits": []
            },
            params={"country_id": self.country_id}
        )
        assert cat2_response.status_code == 200
        cat2 = cat2_response.json()
        
        # Create package with both categories
        package_data = {
            "name": "TEST_Standard Package",
            "description": "Standard inspection package",
            "price": 1300,
            "currency": "INR",
            "currency_symbol": "₹",
            "country_id": self.country_id,
            "categories": [cat1["id"], cat2["id"]],
            "is_recommended": False,
            "order": 1,
            "brands_covered": ["Maruti", "Hyundai", "Honda"]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/inspection-packages",
            json=package_data
        )
        
        assert response.status_code == 200, f"Failed to create package: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain id"
        assert data["name"] == package_data["name"], "Name should match"
        assert data["price"] == package_data["price"], "Price should match"
        assert "categories" in data, "Response should contain categories"
        assert len(data["categories"]) == 2, "Should have 2 categories"
        
        # Total check points should be calculated
        assert data.get("total_check_points", 0) == 150, f"Total check points should be 150, got {data.get('total_check_points')}"
        
        print(f"Created package: {data['name']} with price ₹{data['price']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/inspection-packages/{data['id']}")
        self.session.delete(f"{BASE_URL}/api/inspection-categories/{cat1['id']}")
        self.session.delete(f"{BASE_URL}/api/inspection-categories/{cat2['id']}")
        
        return data
    
    def test_create_recommended_package(self):
        """POST /api/inspection-packages - create a recommended package"""
        # Create a category first
        cat_response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json={
                "name": "TEST_Recommended_Category",
                "check_points": 200,
                "items": [{"name": "Premium Item"}],
                "benefits": [{"name": "Premium Benefit"}]
            },
            params={"country_id": self.country_id}
        )
        assert cat_response.status_code == 200
        cat = cat_response.json()
        
        # Create recommended package
        package_data = {
            "name": "TEST_Luxury Package",
            "description": "Premium inspection package with all features",
            "price": 2500,
            "currency": "INR",
            "currency_symbol": "₹",
            "country_id": self.country_id,
            "categories": [cat["id"]],
            "is_recommended": True,
            "order": 0,
            "brands_covered": ["BMW", "Mercedes", "Audi"]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/inspection-packages",
            json=package_data
        )
        
        assert response.status_code == 200, f"Failed to create recommended package: {response.text}"
        data = response.json()
        
        assert data["is_recommended"] == True, "Package should be marked as recommended"
        print(f"Created recommended package: {data['name']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/inspection-packages/{data['id']}")
        self.session.delete(f"{BASE_URL}/api/inspection-categories/{cat['id']}")
    
    def test_update_inspection_package(self):
        """PUT /api/inspection-packages/:id - update a package"""
        # Create category and package
        cat_response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json={
                "name": "TEST_Update_Package_Category",
                "check_points": 75,
                "items": [],
                "benefits": []
            },
            params={"country_id": self.country_id}
        )
        assert cat_response.status_code == 200
        cat = cat_response.json()
        
        pkg_response = self.session.post(
            f"{BASE_URL}/api/inspection-packages",
            json={
                "name": "TEST_Package_To_Update",
                "price": 1000,
                "country_id": self.country_id,
                "categories": [cat["id"]]
            }
        )
        assert pkg_response.status_code == 200
        pkg = pkg_response.json()
        
        # Update the package
        update_data = {
            "name": "TEST_Updated_Package_Name",
            "price": 1500,
            "is_recommended": True
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/inspection-packages/{pkg['id']}",
            json=update_data
        )
        
        assert update_response.status_code == 200, f"Failed to update package: {update_response.text}"
        updated = update_response.json()
        
        assert updated["name"] == update_data["name"], "Name should be updated"
        assert updated["price"] == update_data["price"], "Price should be updated"
        assert updated["is_recommended"] == True, "is_recommended should be updated"
        print(f"Updated package: {updated['name']} with price ₹{updated['price']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/inspection-packages/{pkg['id']}")
        self.session.delete(f"{BASE_URL}/api/inspection-categories/{cat['id']}")
    
    def test_toggle_package_status(self):
        """PATCH /api/inspection-packages/:id/toggle-status - toggle active status"""
        # Create category and package
        cat_response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json={
                "name": "TEST_Toggle_Package_Category",
                "check_points": 50,
                "items": [],
                "benefits": []
            },
            params={"country_id": self.country_id}
        )
        assert cat_response.status_code == 200
        cat = cat_response.json()
        
        pkg_response = self.session.post(
            f"{BASE_URL}/api/inspection-packages",
            json={
                "name": "TEST_Package_To_Toggle",
                "price": 800,
                "country_id": self.country_id,
                "categories": [cat["id"]]
            }
        )
        assert pkg_response.status_code == 200
        pkg = pkg_response.json()
        
        # Package should be active by default
        assert pkg.get("is_active", True) == True
        
        # Toggle status to inactive
        toggle_response = self.session.patch(
            f"{BASE_URL}/api/inspection-packages/{pkg['id']}/toggle-status"
        )
        
        assert toggle_response.status_code == 200, f"Failed to toggle status: {toggle_response.text}"
        toggle_data = toggle_response.json()
        
        assert toggle_data["is_active"] == False, "Package should be inactive after toggle"
        print(f"Toggled package status to: {toggle_data['is_active']}")
        
        # Toggle back to active
        toggle_response2 = self.session.patch(
            f"{BASE_URL}/api/inspection-packages/{pkg['id']}/toggle-status"
        )
        assert toggle_response2.status_code == 200
        toggle_data2 = toggle_response2.json()
        assert toggle_data2["is_active"] == True, "Package should be active after second toggle"
        print(f"Toggled package status back to: {toggle_data2['is_active']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/inspection-packages/{pkg['id']}")
        self.session.delete(f"{BASE_URL}/api/inspection-categories/{cat['id']}")
    
    def test_delete_inspection_package(self):
        """DELETE /api/inspection-packages/:id - soft delete a package"""
        # Create category and package
        cat_response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json={
                "name": "TEST_Delete_Package_Category",
                "check_points": 30,
                "items": [],
                "benefits": []
            },
            params={"country_id": self.country_id}
        )
        assert cat_response.status_code == 200
        cat = cat_response.json()
        
        pkg_response = self.session.post(
            f"{BASE_URL}/api/inspection-packages",
            json={
                "name": "TEST_Package_To_Delete",
                "price": 500,
                "country_id": self.country_id,
                "categories": [cat["id"]]
            }
        )
        assert pkg_response.status_code == 200
        pkg = pkg_response.json()
        
        # Delete the package
        delete_response = self.session.delete(
            f"{BASE_URL}/api/inspection-packages/{pkg['id']}"
        )
        
        assert delete_response.status_code == 200, f"Failed to delete package: {delete_response.text}"
        print(f"Deleted package: {pkg['id']}")
        
        # Cleanup category
        self.session.delete(f"{BASE_URL}/api/inspection-categories/{cat['id']}")
    
    def test_packages_include_category_details(self):
        """GET /api/inspection-packages - verify packages include category details"""
        # Create category
        cat_response = self.session.post(
            f"{BASE_URL}/api/inspection-categories",
            json={
                "name": "TEST_Details_Category",
                "check_points": 120,
                "items": [{"name": "Detail Item 1"}, {"name": "Detail Item 2"}],
                "benefits": [{"name": "Detail Benefit"}],
                "color": "#FF5733"
            },
            params={"country_id": self.country_id}
        )
        assert cat_response.status_code == 200
        cat = cat_response.json()
        
        # Create package
        pkg_response = self.session.post(
            f"{BASE_URL}/api/inspection-packages",
            json={
                "name": "TEST_Package_With_Details",
                "price": 1800,
                "country_id": self.country_id,
                "categories": [cat["id"]]
            }
        )
        assert pkg_response.status_code == 200
        pkg = pkg_response.json()
        
        # Get packages and verify category details are included
        get_response = self.session.get(
            f"{BASE_URL}/api/inspection-packages",
            params={"country_id": self.country_id}
        )
        
        assert get_response.status_code == 200
        packages = get_response.json()
        
        # Find our test package
        test_pkg = next((p for p in packages if p["id"] == pkg["id"]), None)
        assert test_pkg is not None, "Test package should be in the list"
        
        # Verify category_details is populated
        assert "category_details" in test_pkg, "Package should have category_details"
        assert len(test_pkg["category_details"]) > 0, "category_details should not be empty"
        
        cat_detail = test_pkg["category_details"][0]
        assert cat_detail["name"] == "TEST_Details_Category"
        assert cat_detail["check_points"] == 120
        print(f"Package includes category details: {cat_detail['name']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/inspection-packages/{pkg['id']}")
        self.session.delete(f"{BASE_URL}/api/inspection-categories/{cat['id']}")


class TestInspectionPackagesCleanup:
    """Cleanup test data after all tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_cleanup_test_data(self):
        """Clean up any remaining TEST_ prefixed data"""
        # Get all categories
        cat_response = self.session.get(f"{BASE_URL}/api/inspection-categories")
        if cat_response.status_code == 200:
            categories = cat_response.json()
            for cat in categories:
                if cat.get("name", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/inspection-categories/{cat['id']}")
                    print(f"Cleaned up category: {cat['name']}")
        
        # Get all packages
        pkg_response = self.session.get(f"{BASE_URL}/api/inspection-packages")
        if pkg_response.status_code == 200:
            packages = pkg_response.json()
            for pkg in packages:
                if pkg.get("name", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/inspection-packages/{pkg['id']}")
                    print(f"Cleaned up package: {pkg['name']}")
        
        print("Cleanup completed")
