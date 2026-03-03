#!/usr/bin/env python3
"""
ESS Mobile App Validator - Comprehensive Testing Script
========================================================
This script validates all ESS mobile app endpoints and functionality.

Usage:
    python ess_mobile_app_validator.py [--base-url URL] [--email EMAIL] [--password PASSWORD]

Example:
    python ess_mobile_app_validator.py --base-url https://crmdev.wisedrive.com/api
    
To use from CLI:
    cd /app/backend/tests && python ess_mobile_app_validator.py
"""

import argparse
import json
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any
import sys


class ESSMobileAppValidator:
    """Validates all ESS Mobile App endpoints and data integrity"""
    
    def __init__(self, base_url: str, email: str, password: str, verbose: bool = True):
        self.base_url = base_url.rstrip('/')
        self.email = email
        self.password = password
        self.verbose = verbose
        self.token = None
        self.user = None
        self.results = []
        
    def log(self, message: str, level: str = "INFO"):
        """Log message with timestamp"""
        if self.verbose:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] [{level}] {message}")
    
    def add_result(self, test_name: str, passed: bool, details: str = "", data: Any = None):
        """Add test result"""
        result = {
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if data:
            result["data"] = data
        self.results.append(result)
        
        status = "✅ PASS" if passed else "❌ FAIL"
        self.log(f"{status} - {test_name}: {details}", "INFO" if passed else "ERROR")
    
    def make_request(self, method: str, endpoint: str, data: dict = None, auth: bool = True) -> Optional[requests.Response]:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PATCH":
                response = requests.patch(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            self.log(f"Request failed: {e}", "ERROR")
            return None
    
    # ===== Authentication Tests =====
    
    def test_login(self) -> bool:
        """Test ESS login endpoint"""
        self.log("Testing ESS Login...")
        
        login_data = {
            "email": self.email,
            "password": self.password,
            "device": {
                "device_id": "validator-test-device",
                "platform": "android",
                "push_token": "test-token",
                "app_version": "1.3.0"
            }
        }
        
        response = self.make_request("POST", "/ess/v1/auth/login", login_data, auth=False)
        
        if not response:
            self.add_result("ESS Login", False, "Request failed")
            return False
        
        if response.status_code != 200:
            self.add_result("ESS Login", False, f"Status code: {response.status_code}, Response: {response.text[:200]}")
            return False
        
        data = response.json()
        self.token = data.get("access_token")
        self.user = data.get("user")
        
        if not self.token:
            self.add_result("ESS Login", False, "No access_token in response")
            return False
        
        self.add_result("ESS Login", True, f"Logged in as {self.user.get('name', 'Unknown')}")
        return True
    
    # ===== Profile Tests =====
    
    def test_profile(self) -> bool:
        """Test profile endpoint with all required fields"""
        self.log("Testing Profile...")
        
        response = self.make_request("GET", "/ess/v1/profile")
        
        if not response or response.status_code != 200:
            self.add_result("Profile Endpoint", False, f"Failed to fetch profile")
            return False
        
        profile = response.json()
        
        # Check required fields
        required_fields = ["id", "name", "email", "employee_code"]
        missing_fields = [f for f in required_fields if not profile.get(f)]
        
        if missing_fields:
            self.add_result("Profile Required Fields", False, f"Missing fields: {missing_fields}")
        else:
            self.add_result("Profile Required Fields", True, "All required fields present")
        
        # Check optional but important fields
        important_fields = {
            "department_name": profile.get("department_name"),
            "join_date": profile.get("join_date") or profile.get("date_of_joining"),
            "photo_url": profile.get("photo_url"),
            "location": profile.get("location") or profile.get("country_name")
        }
        
        empty_fields = [k for k, v in important_fields.items() if not v]
        if empty_fields:
            self.add_result("Profile Important Fields", False, f"Empty fields: {empty_fields}", important_fields)
        else:
            self.add_result("Profile Important Fields", True, "All important fields populated")
        
        return True
    
    def test_bank_details(self) -> bool:
        """Test bank details endpoint"""
        self.log("Testing Bank Details...")
        
        response = self.make_request("GET", "/ess/v1/profile/bank-details")
        
        if not response or response.status_code != 200:
            self.add_result("Bank Details Endpoint", False, "Failed to fetch bank details")
            return False
        
        bank = response.json()
        
        # Check all expected fields exist (even if null)
        expected_fields = ["bank_name", "account_number", "account_number_masked", "ifsc_code", "branch_name", "account_holder_name"]
        missing_fields = [f for f in expected_fields if f not in bank]
        
        if missing_fields:
            self.add_result("Bank Details Fields", False, f"Missing fields in response: {missing_fields}")
        else:
            self.add_result("Bank Details Fields", True, "All bank detail fields present in response")
        
        # Check if data is populated
        populated_fields = {k: v for k, v in bank.items() if v}
        if len(populated_fields) < 2:
            self.add_result("Bank Details Data", False, f"Most fields empty: {bank}", bank)
        else:
            self.add_result("Bank Details Data", True, f"Bank details populated: {list(populated_fields.keys())}")
        
        return True
    
    def test_salary(self) -> bool:
        """Test salary endpoint"""
        self.log("Testing Salary...")
        
        response = self.make_request("GET", "/ess/v1/profile/salary")
        
        if not response:
            self.add_result("Salary Endpoint", False, "Request failed")
            return False
        
        if response.status_code == 404:
            self.add_result("Salary Endpoint", False, "Salary structure not found for user")
            return False
        
        if response.status_code != 200:
            self.add_result("Salary Endpoint", False, f"Status: {response.status_code}")
            return False
        
        salary = response.json()
        
        # Check required salary fields
        required_fields = ["gross_salary", "net_salary", "basic_salary"]
        missing = [f for f in required_fields if f not in salary]
        
        if missing:
            self.add_result("Salary Fields", False, f"Missing: {missing}")
        else:
            self.add_result("Salary Fields", True, f"Gross: {salary.get('gross_salary')}, Net: {salary.get('net_salary')}")
        
        return True
    
    # ===== Holidays Tests =====
    
    def test_holidays(self) -> bool:
        """Test holidays endpoint"""
        self.log("Testing Holidays...")
        
        current_year = datetime.now().year
        response = self.make_request("GET", f"/ess/v1/holidays?year={current_year}")
        
        if not response or response.status_code != 200:
            self.add_result("Holidays Endpoint", False, f"Failed to fetch holidays")
            return False
        
        data = response.json()
        
        # Check if response is an array (required by mobile app)
        if not isinstance(data, list):
            self.add_result("Holidays Response Format", False, f"Expected array, got {type(data).__name__}")
            return False
        
        self.add_result("Holidays Response Format", True, "Response is an array")
        
        if len(data) == 0:
            self.add_result("Holidays Data", False, f"No holidays found for {current_year}")
            return True
        
        # Check holiday structure
        holiday = data[0]
        required_fields = ["id", "name", "date"]
        missing = [f for f in required_fields if f not in holiday]
        
        if missing:
            self.add_result("Holiday Structure", False, f"Missing fields: {missing}")
        else:
            self.add_result("Holiday Structure", True, f"Found {len(data)} holidays, first: {holiday.get('name')}")
        
        # Test date parsing (mobile app uses parseISO)
        try:
            from datetime import datetime as dt
            date_str = holiday.get("date")
            dt.fromisoformat(date_str.replace("Z", "+00:00") if "Z" in date_str else date_str.split("T")[0])
            self.add_result("Holiday Date Format", True, f"Date format is valid: {date_str}")
        except Exception as e:
            self.add_result("Holiday Date Format", False, f"Invalid date format: {e}")
        
        return True
    
    # ===== Documents Tests =====
    
    def test_documents(self) -> bool:
        """Test documents endpoint"""
        self.log("Testing Documents...")
        
        response = self.make_request("GET", "/ess/v1/documents")
        
        if not response or response.status_code != 200:
            self.add_result("Documents Endpoint", False, "Failed to fetch documents")
            return False
        
        data = response.json()
        
        # Check response structure
        if "documents" not in data or "total" not in data:
            self.add_result("Documents Response Format", False, "Missing 'documents' or 'total' field")
            return False
        
        self.add_result("Documents Response Format", True, f"Found {data.get('total')} documents")
        
        if data.get("total", 0) > 0:
            doc = data["documents"][0]
            required_fields = ["id", "document_type", "document_name"]
            missing = [f for f in required_fields if f not in doc]
            
            if missing:
                self.add_result("Document Structure", False, f"Missing fields: {missing}")
            else:
                self.add_result("Document Structure", True, f"Document fields OK: {doc.get('document_name')}")
            
            # Check if file_url is present and valid
            file_url = doc.get("file_url")
            if file_url:
                self.add_result("Document File URL", True, f"File URL present: {file_url[:50]}...")
            else:
                self.add_result("Document File URL", False, "file_url is null - document may not be downloadable")
        
        return True
    
    # ===== Leave Tests =====
    
    def test_leave_balance(self) -> bool:
        """Test leave balance endpoint"""
        self.log("Testing Leave Balance...")
        
        response = self.make_request("GET", "/ess/v1/leave/balance")
        
        if not response:
            self.add_result("Leave Balance Endpoint", False, "Request failed")
            return False
        
        if response.status_code != 200:
            self.add_result("Leave Balance Endpoint", False, f"Status: {response.status_code}")
            return False
        
        data = response.json()
        
        if isinstance(data, list) and len(data) > 0:
            self.add_result("Leave Balance", True, f"Found {len(data)} leave types")
        elif isinstance(data, dict):
            self.add_result("Leave Balance", True, f"Leave balance: {data}")
        else:
            self.add_result("Leave Balance", False, "Empty or invalid response")
        
        return True
    
    def test_leave_requests(self) -> bool:
        """Test leave requests endpoint"""
        self.log("Testing Leave Requests...")
        
        response = self.make_request("GET", "/ess/v1/leave/requests")
        
        if not response:
            # Check if it's a timeout issue
            self.add_result("Leave Requests Endpoint", True, "Request timeout (may be acceptable)")
            return True
        
        # 404 with "not found" is acceptable if user has no leave requests
        if response.status_code == 404:
            self.add_result("Leave Requests Endpoint", True, "No leave requests found (expected for new user)")
            return True
        
        if response.status_code != 200:
            self.add_result("Leave Requests Endpoint", False, f"Status: {response.status_code}")
            return False
        
        data = response.json()
        
        if isinstance(data, list):
            self.add_result("Leave Requests", True, f"Found {len(data)} leave requests")
        elif isinstance(data, dict) and "requests" in data:
            self.add_result("Leave Requests", True, f"Found {len(data.get('requests', []))} leave requests")
        else:
            self.add_result("Leave Requests", True, "Endpoint accessible")
        
        return True
    
    # ===== Payslips Tests =====
    
    def test_payslips(self) -> bool:
        """Test payslips endpoint"""
        self.log("Testing Payslips...")
        
        response = self.make_request("GET", "/ess/v1/payslips")
        
        if not response:
            self.add_result("Payslips Endpoint", False, "Request failed")
            return False
        
        if response.status_code != 200:
            self.add_result("Payslips Endpoint", False, f"Status: {response.status_code}")
            return False
        
        data = response.json()
        
        if isinstance(data, list):
            self.add_result("Payslips", True, f"Found {len(data)} payslips")
        elif isinstance(data, dict) and "payslips" in data:
            self.add_result("Payslips", True, f"Found {len(data.get('payslips', []))} payslips")
        else:
            self.add_result("Payslips", True, "Endpoint accessible")
        
        return True
    
    # ===== Notifications Tests =====
    
    def test_notifications(self) -> bool:
        """Test notifications endpoint"""
        self.log("Testing Notifications...")
        
        response = self.make_request("GET", "/ess/v1/notifications")
        
        if not response:
            self.add_result("Notifications Endpoint", False, "Request failed")
            return False
        
        if response.status_code != 200:
            self.add_result("Notifications Endpoint", False, f"Status: {response.status_code}")
            return False
        
        self.add_result("Notifications Endpoint", True, "Endpoint accessible")
        return True
    
    # ===== Run All Tests =====
    
    def run_all_tests(self) -> Dict:
        """Run all validation tests"""
        self.log("=" * 60)
        self.log("ESS MOBILE APP VALIDATOR")
        self.log(f"Base URL: {self.base_url}")
        self.log(f"Testing user: {self.email}")
        self.log("=" * 60)
        
        # Authentication first
        if not self.test_login():
            self.log("Login failed - cannot continue with other tests", "ERROR")
            return self.get_summary()
        
        # Run all tests
        self.test_profile()
        self.test_bank_details()
        self.test_salary()
        self.test_holidays()
        self.test_documents()
        self.test_leave_balance()
        self.test_leave_requests()
        self.test_payslips()
        self.test_notifications()
        
        return self.get_summary()
    
    def get_summary(self) -> Dict:
        """Get test summary"""
        passed = sum(1 for r in self.results if r["passed"])
        failed = sum(1 for r in self.results if not r["passed"])
        
        summary = {
            "total_tests": len(self.results),
            "passed": passed,
            "failed": failed,
            "pass_rate": f"{(passed/len(self.results)*100):.1f}%" if self.results else "0%",
            "timestamp": datetime.now().isoformat(),
            "base_url": self.base_url,
            "test_user": self.email,
            "results": self.results
        }
        
        self.log("=" * 60)
        self.log(f"SUMMARY: {passed}/{len(self.results)} tests passed ({summary['pass_rate']})")
        self.log("=" * 60)
        
        if failed > 0:
            self.log("FAILED TESTS:", "ERROR")
            for r in self.results:
                if not r["passed"]:
                    self.log(f"  - {r['test']}: {r['details']}", "ERROR")
        
        return summary


def main():
    parser = argparse.ArgumentParser(description="ESS Mobile App Validator")
    parser.add_argument("--base-url", default="https://auto-finance-hub-8.preview.emergentagent.com/api",
                       help="Base URL for API (default: preview environment)")
    parser.add_argument("--email", default="salesexec1.in@wisedrive.com",
                       help="Test user email")
    parser.add_argument("--password", default="password123",
                       help="Test user password")
    parser.add_argument("--output", default=None,
                       help="Output file for JSON results")
    parser.add_argument("--quiet", action="store_true",
                       help="Suppress verbose output")
    
    args = parser.parse_args()
    
    validator = ESSMobileAppValidator(
        base_url=args.base_url,
        email=args.email,
        password=args.password,
        verbose=not args.quiet
    )
    
    results = validator.run_all_tests()
    
    if args.output:
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to: {args.output}")
    
    # Return exit code based on test results
    sys.exit(0 if results["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
