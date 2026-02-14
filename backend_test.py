import requests
import sys
from datetime import datetime
import json

class WiseDriveCRMTester:
    def __init__(self, base_url="https://crm-ui-refresh-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_user = None
        self.employee_user = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    elif isinstance(response_data, dict):
                        print(f"   Response keys: {list(response_data.keys())}")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if success and response.text else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_seed_data(self):
        """Seed initial test data"""
        print("\n🌱 Seeding test data...")
        success, response = self.run_test(
            "Seed Data",
            "POST",
            "seed",
            200
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@wisedrive.com", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.admin_user = response['user']
            print(f"   Logged in as: {self.admin_user['name']} ({self.admin_user['role']})")
            return True
        return False

    def test_employee_login(self):
        """Test employee login"""
        success, response = self.run_test(
            "Employee Login",
            "POST",
            "auth/login",
            200,
            data={"email": "bhavya@wisedrive.com", "password": "employee123"}
        )
        if success and 'access_token' in response:
            self.employee_user = response['user']
            print(f"   Employee login successful: {self.employee_user['name']}")
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        if success:
            required_fields = ['total_leads', 'total_customers', 'total_inspections', 'total_employees']
            for field in required_fields:
                if field not in response:
                    print(f"   ⚠️  Missing field: {field}")
                    return False
            print(f"   Stats: {response['total_leads']} leads, {response['total_customers']} customers")
        return success

    def test_leads_crud(self):
        """Test leads CRUD operations"""
        # Get all leads
        success, leads = self.run_test("Get All Leads", "GET", "leads", 200)
        if not success:
            return False
        
        initial_count = len(leads)
        print(f"   Found {initial_count} existing leads")

        # Create new lead
        new_lead = {
            "name": "Test Lead",
            "mobile": "9876543210",
            "city": "Bangalore",
            "source": "WEBSITE",
            "status": "NEW"
        }
        success, created_lead = self.run_test("Create Lead", "POST", "leads", 200, data=new_lead)
        if not success:
            return False
        
        lead_id = created_lead.get('id')
        if not lead_id:
            print("   ❌ No lead ID returned")
            return False

        # Update lead
        updated_data = {**new_lead, "status": "CONTACTED", "notes": "Test update"}
        success, _ = self.run_test(f"Update Lead", "PUT", f"leads/{lead_id}", 200, data=updated_data)
        if not success:
            return False

        # Get leads with filters
        success, filtered_leads = self.run_test("Filter Leads by Status", "GET", "leads", 200, params={"status": "NEW"})
        if not success:
            return False

        # Delete lead
        success, _ = self.run_test(f"Delete Lead", "DELETE", f"leads/{lead_id}", 200)
        return success

    def test_customers_crud(self):
        """Test customers CRUD operations"""
        # Get all customers
        success, customers = self.run_test("Get All Customers", "GET", "customers", 200)
        if not success:
            return False
        
        print(f"   Found {len(customers)} existing customers")

        # Create new customer
        new_customer = {
            "name": "Test Customer",
            "mobile": "9876543211",
            "city": "Mumbai",
            "payment_status": "PENDING"
        }
        success, created_customer = self.run_test("Create Customer", "POST", "customers", 200, data=new_customer)
        if not success:
            return False
        
        customer_id = created_customer.get('id')
        if not customer_id:
            print("   ❌ No customer ID returned")
            return False

        # Update customer
        updated_data = {**new_customer, "payment_status": "Completed"}
        success, _ = self.run_test(f"Update Customer", "PUT", f"customers/{customer_id}", 200, data=updated_data)
        if not success:
            return False

        # Delete customer
        success, _ = self.run_test(f"Delete Customer", "DELETE", f"customers/{customer_id}", 200)
        return success

    def test_inspections_crud(self):
        """Test inspections CRUD operations"""
        # Get all inspections
        success, inspections = self.run_test("Get All Inspections", "GET", "inspections", 200)
        if not success:
            return False
        
        print(f"   Found {len(inspections)} existing inspections")

        # Create new inspection
        new_inspection = {
            "customer_name": "Test Inspection Customer",
            "customer_mobile": "9876543212",
            "address": "Test Address",
            "city": "Chennai",
            "payment_status": "PENDING",
            "inspection_status": "SCHEDULED"
        }
        success, created_inspection = self.run_test("Create Inspection", "POST", "inspections", 200, data=new_inspection)
        if not success:
            return False
        
        inspection_id = created_inspection.get('id')
        if not inspection_id:
            print("   ❌ No inspection ID returned")
            return False

        # Update inspection
        updated_data = {**new_inspection, "inspection_status": "COMPLETED"}
        success, _ = self.run_test(f"Update Inspection", "PUT", f"inspections/{inspection_id}", 200, data=updated_data)
        if not success:
            return False

        # Filter inspections
        success, _ = self.run_test("Filter Inspections by Status", "GET", "inspections", 200, params={"inspection_status": "COMPLETED"})
        if not success:
            return False

        # Delete inspection
        success, _ = self.run_test(f"Delete Inspection", "DELETE", f"inspections/{inspection_id}", 200)
        return success

    def test_employees_management(self):
        """Test employee management (admin only)"""
        # Get all employees
        success, employees = self.run_test("Get All Employees", "GET", "employees", 200)
        if not success:
            return False
        
        print(f"   Found {len(employees)} existing employees")

        # Create new employee (admin only)
        new_employee = {
            "name": "Test Employee",
            "email": "test@wisedrive.com",
            "password": "testpass123",
            "role": "employee",
            "assigned_cities": ["Bangalore"]
        }
        success, created_employee = self.run_test("Create Employee", "POST", "employees", 200, data=new_employee)
        if not success:
            return False
        
        employee_id = created_employee.get('id')
        if not employee_id:
            print("   ❌ No employee ID returned")
            return False

        # Toggle employee status
        success, _ = self.run_test(f"Toggle Employee Status", "PATCH", f"employees/{employee_id}/toggle-status", 200)
        if not success:
            return False

        # Assign city to employee
        success, _ = self.run_test(f"Assign City to Employee", "PATCH", f"employees/{employee_id}/assign-city?city=Mumbai", 200)
        return success

    def test_utility_endpoints(self):
        """Test utility endpoints"""
        endpoints = [
            ("Get Cities", "cities"),
            ("Get Lead Sources", "lead-sources"),
            ("Get Lead Statuses", "lead-statuses")
        ]
        
        all_success = True
        for name, endpoint in endpoints:
            success, response = self.run_test(name, "GET", endpoint, 200)
            if success and isinstance(response, list) and len(response) > 0:
                print(f"   {name}: {len(response)} items")
            else:
                all_success = False
        
        return all_success

def main():
    print("🚀 Starting WiseDrive CRM Backend API Tests")
    print("=" * 50)
    
    tester = WiseDriveCRMTester()
    
    # Test sequence
    test_sequence = [
        ("Seed Test Data", tester.test_seed_data),
        ("Admin Login", tester.test_admin_login),
        ("Get Current User", tester.test_get_me),
        ("Dashboard Statistics", tester.test_dashboard_stats),
        ("Leads CRUD Operations", tester.test_leads_crud),
        ("Customers CRUD Operations", tester.test_customers_crud),
        ("Inspections CRUD Operations", tester.test_inspections_crud),
        ("Employee Management", tester.test_employees_management),
        ("Utility Endpoints", tester.test_utility_endpoints),
        ("Employee Login", tester.test_employee_login),
    ]
    
    failed_tests = []
    
    for test_name, test_func in test_sequence:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if not test_func():
                failed_tests.append(test_name)
                print(f"❌ {test_name} FAILED")
            else:
                print(f"✅ {test_name} PASSED")
        except Exception as e:
            failed_tests.append(test_name)
            print(f"❌ {test_name} FAILED with exception: {str(e)}")
    
    # Print final results
    print(f"\n{'='*50}")
    print(f"📊 FINAL RESULTS")
    print(f"{'='*50}")
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in failed_tests:
            print(f"   - {test}")
        return 1
    else:
        print(f"\n🎉 All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())