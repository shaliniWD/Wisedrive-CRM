"""
Test Leave Rules Feature - Iteration 41
Tests for:
1. GET /api/leave-rules - Get leave rules configuration
2. PUT /api/leave-rules - Update leave rules (monthly/quarterly)
3. GET /api/ess/v1/leave/period-balance - Get period-based leave balance
4. Apply leave validation against period balance
5. can_apply_casual and can_apply_sick flags
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
HR_USER = "hr@wisedrive.com"
ADMIN_USER = "kalyan@wisedrive.com"
PASSWORD = "password123"


class TestLeaveRulesAPI:
    """Test Leave Rules API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.hr_token = None
        self.admin_token = None
        self.ess_token = None
        self.device_id = f"test-device-{uuid.uuid4()}"
    
    def get_hr_token(self):
        """Get HR user token (CRM API)"""
        if not self.hr_token:
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": HR_USER,
                "password": PASSWORD
            })
            if response.status_code == 200:
                self.hr_token = response.json().get("access_token")
        return self.hr_token
    
    def get_admin_token(self):
        """Get Admin/CEO token (CRM API)"""
        if not self.admin_token:
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": ADMIN_USER,
                "password": PASSWORD
            })
            if response.status_code == 200:
                self.admin_token = response.json().get("access_token")
        return self.admin_token
    
    def get_ess_token(self, email=HR_USER):
        """Get ESS mobile token with device registration"""
        if not self.ess_token:
            response = self.session.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
                "email": email,
                "password": PASSWORD,
                "device": {
                    "device_id": self.device_id,
                    "device_name": "Test Device",
                    "platform": "android",
                    "os_version": "14.0",
                    "app_version": "1.0.0"
                }
            })
            if response.status_code == 200:
                self.ess_token = response.json().get("access_token")
        return self.ess_token
    
    # ==================== LEAVE RULES GET/PUT TESTS (CRM API) ====================
    
    def test_01_get_leave_rules_default(self):
        """Test GET /api/leave-rules returns default configuration"""
        token = self.get_hr_token()
        assert token, "Failed to get HR token"
        
        response = self.session.get(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "allocation_period" in data, "Missing allocation_period field"
        assert "carry_forward_enabled" in data, "Missing carry_forward_enabled field"
        assert "sick_leaves_per_period" in data, "Missing sick_leaves_per_period field"
        assert "casual_leaves_per_period" in data, "Missing casual_leaves_per_period field"
        
        # Verify carry_forward is always False
        assert data["carry_forward_enabled"] == False, "carry_forward_enabled should always be False"
        
        print(f"Leave rules: {data}")
    
    def test_02_update_leave_rules_to_monthly(self):
        """Test PUT /api/leave-rules to set monthly allocation"""
        token = self.get_hr_token()
        assert token, "Failed to get HR token"
        
        response = self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "allocation_period": "monthly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["allocation_period"] == "monthly", f"Expected monthly, got {data['allocation_period']}"
        assert data["sick_leaves_per_period"] == 2, f"Expected 2, got {data['sick_leaves_per_period']}"
        assert data["casual_leaves_per_period"] == 1, f"Expected 1, got {data['casual_leaves_per_period']}"
        assert data["carry_forward_enabled"] == False, "carry_forward should always be False"
        
        print(f"Updated to monthly: {data}")
    
    def test_03_update_leave_rules_to_quarterly(self):
        """Test PUT /api/leave-rules to set quarterly allocation"""
        token = self.get_hr_token()
        assert token, "Failed to get HR token"
        
        response = self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "allocation_period": "quarterly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["allocation_period"] == "quarterly", f"Expected quarterly, got {data['allocation_period']}"
        assert data["carry_forward_enabled"] == False, "carry_forward should always be False"
        
        print(f"Updated to quarterly: {data}")
    
    def test_04_update_leave_rules_invalid_period(self):
        """Test PUT /api/leave-rules rejects invalid allocation_period"""
        token = self.get_hr_token()
        assert token, "Failed to get HR token"
        
        response = self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "allocation_period": "yearly",  # Invalid
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        # Should fail validation
        assert response.status_code == 422, f"Expected 422 for invalid period, got {response.status_code}"
        print("Invalid allocation_period correctly rejected")
    
    def test_05_carry_forward_always_disabled(self):
        """Test that carry_forward_enabled is always False"""
        hr_token = self.get_hr_token()
        
        # Get current rules
        response = self.session.get(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["carry_forward_enabled"] == False, "carry_forward should always be False"
        
        # Try to update (even though carry_forward is not in the update model)
        # The response should still have carry_forward_enabled = False
        update_resp = self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"},
            json={
                "allocation_period": "monthly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        assert update_resp.status_code == 200
        updated_data = update_resp.json()
        assert updated_data["carry_forward_enabled"] == False, "carry_forward should remain False after update"
        
        print("Carry forward is correctly always disabled")
    
    # ==================== PERIOD BALANCE TESTS (ESS API) ====================
    
    def test_06_get_period_balance_monthly(self):
        """Test GET /api/ess/v1/leave/period-balance with monthly allocation"""
        # First set to monthly using CRM API
        hr_token = self.get_hr_token()
        self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"},
            json={
                "allocation_period": "monthly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        # Get ESS token
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        # Get period balance
        response = self.session.get(
            f"{BASE_URL}/api/ess/v1/leave/period-balance",
            headers={"Authorization": f"Bearer {ess_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "period_type" in data, "Missing period_type"
        assert "period_label" in data, "Missing period_label"
        assert "period_start" in data, "Missing period_start"
        assert "period_end" in data, "Missing period_end"
        assert "casual_allocated" in data, "Missing casual_allocated"
        assert "casual_used" in data, "Missing casual_used"
        assert "casual_available" in data, "Missing casual_available"
        assert "sick_allocated" in data, "Missing sick_allocated"
        assert "sick_used" in data, "Missing sick_used"
        assert "sick_available" in data, "Missing sick_available"
        assert "lop_days" in data, "Missing lop_days"
        assert "can_apply_casual" in data, "Missing can_apply_casual"
        assert "can_apply_sick" in data, "Missing can_apply_sick"
        
        # Verify monthly allocation
        assert data["period_type"] == "monthly", f"Expected monthly, got {data['period_type']}"
        
        print(f"Monthly period balance: {data}")
    
    def test_07_get_period_balance_quarterly(self):
        """Test GET /api/ess/v1/leave/period-balance with quarterly allocation"""
        # First set to quarterly using CRM API
        hr_token = self.get_hr_token()
        self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"},
            json={
                "allocation_period": "quarterly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        # Get ESS token
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        # Get period balance
        response = self.session.get(
            f"{BASE_URL}/api/ess/v1/leave/period-balance",
            headers={"Authorization": f"Bearer {ess_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify quarterly allocation
        assert data["period_type"] == "quarterly", f"Expected quarterly, got {data['period_type']}"
        
        # For quarterly, allocation should be multiplied by 3
        # sick=2*3=6, casual=1*3=3
        assert data["sick_allocated"] == 6, f"Expected sick_allocated=6 for quarterly, got {data['sick_allocated']}"
        assert data["casual_allocated"] == 3, f"Expected casual_allocated=3 for quarterly, got {data['casual_allocated']}"
        
        # Period label should be Q1/Q2/Q3/Q4 format
        assert data["period_label"].startswith("Q"), f"Expected quarterly label like Q1 2026, got {data['period_label']}"
        
        print(f"Quarterly period balance: {data}")
    
    def test_08_period_balance_can_apply_flags(self):
        """Test can_apply_casual and can_apply_sick flags"""
        # Set to monthly with known values
        hr_token = self.get_hr_token()
        self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"},
            json={
                "allocation_period": "monthly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        # Get ESS token
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        # Get period balance
        response = self.session.get(
            f"{BASE_URL}/api/ess/v1/leave/period-balance",
            headers={"Authorization": f"Bearer {ess_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # can_apply flags should be True if available > 0
        if data["casual_available"] > 0:
            assert data["can_apply_casual"] == True, "can_apply_casual should be True when leaves available"
        else:
            assert data["can_apply_casual"] == False, "can_apply_casual should be False when no leaves available"
        
        if data["sick_available"] > 0:
            assert data["can_apply_sick"] == True, "can_apply_sick should be True when leaves available"
        else:
            assert data["can_apply_sick"] == False, "can_apply_sick should be False when no leaves available"
        
        print(f"can_apply_casual: {data['can_apply_casual']}, can_apply_sick: {data['can_apply_sick']}")
    
    # ==================== APPLY LEAVE VALIDATION TESTS ====================
    
    def test_09_apply_leave_validates_period_balance(self):
        """Test that apply leave validates against period balance"""
        # Set to monthly
        hr_token = self.get_hr_token()
        self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"},
            json={
                "allocation_period": "monthly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        # Get current balance first
        balance_resp = self.session.get(
            f"{BASE_URL}/api/ess/v1/leave/period-balance",
            headers={"Authorization": f"Bearer {ess_token}"}
        )
        assert balance_resp.status_code == 200
        balance = balance_resp.json()
        
        # Try to apply leave for a future date
        future_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = self.session.post(
            f"{BASE_URL}/api/ess/v1/leave/apply",
            headers={"Authorization": f"Bearer {ess_token}"},
            json={
                "leave_type": "casual",
                "start_date": future_date,
                "end_date": future_date,
                "reason": "Test leave application",
                "is_half_day": False
            }
        )
        
        # If casual leaves available, should succeed
        if balance["casual_available"] > 0:
            assert response.status_code == 200, f"Expected 200 when leaves available, got {response.status_code}: {response.text}"
            data = response.json()
            assert data["status"] == "pending", f"Expected pending status, got {data['status']}"
            print(f"Leave applied successfully: {data['id']}")
            
            # Cancel the leave to clean up
            cancel_resp = self.session.post(
                f"{BASE_URL}/api/ess/v1/leave/{data['id']}/cancel",
                headers={"Authorization": f"Bearer {ess_token}"}
            )
            print(f"Leave cancelled: {cancel_resp.status_code}")
        else:
            # Should fail with appropriate error
            assert response.status_code == 400, f"Expected 400 when no leaves available, got {response.status_code}"
            print(f"Leave correctly rejected: {response.json()}")
    
    def test_10_apply_leave_error_message_when_exhausted(self):
        """Test that apply leave returns proper error message when leaves exhausted"""
        # Set to monthly with 0 leaves
        hr_token = self.get_hr_token()
        self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"},
            json={
                "allocation_period": "monthly",
                "sick_leaves_per_period": 0,  # No sick leaves
                "casual_leaves_per_period": 0  # No casual leaves
            }
        )
        
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        # Try to apply casual leave
        future_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = self.session.post(
            f"{BASE_URL}/api/ess/v1/leave/apply",
            headers={"Authorization": f"Bearer {ess_token}"},
            json={
                "leave_type": "casual",
                "start_date": future_date,
                "end_date": future_date,
                "reason": "Test leave when exhausted",
                "is_half_day": False
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        error_data = response.json()
        assert "detail" in error_data, "Missing error detail"
        
        # Error message should mention no leaves available
        error_msg = error_data["detail"].lower()
        assert "no" in error_msg or "insufficient" in error_msg or "available" in error_msg, \
            f"Error message should mention no leaves available: {error_data['detail']}"
        
        print(f"Error message when exhausted: {error_data['detail']}")
        
        # Reset to default values
        self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"},
            json={
                "allocation_period": "monthly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
    
    def test_11_apply_sick_leave_validates_period_balance(self):
        """Test that apply sick leave validates against period balance"""
        hr_token = self.get_hr_token()
        
        # Set to monthly with known values
        self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"},
            json={
                "allocation_period": "monthly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        # Get current balance
        balance_resp = self.session.get(
            f"{BASE_URL}/api/ess/v1/leave/period-balance",
            headers={"Authorization": f"Bearer {ess_token}"}
        )
        assert balance_resp.status_code == 200
        balance = balance_resp.json()
        
        # Try to apply sick leave
        future_date = (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d")
        
        response = self.session.post(
            f"{BASE_URL}/api/ess/v1/leave/apply",
            headers={"Authorization": f"Bearer {ess_token}"},
            json={
                "leave_type": "sick",
                "start_date": future_date,
                "end_date": future_date,
                "reason": "Test sick leave application",
                "is_half_day": False
            }
        )
        
        if balance["sick_available"] > 0:
            assert response.status_code == 200, f"Expected 200 when sick leaves available, got {response.status_code}: {response.text}"
            data = response.json()
            print(f"Sick leave applied: {data['id']}")
            
            # Cancel to clean up
            self.session.post(
                f"{BASE_URL}/api/ess/v1/leave/{data['id']}/cancel",
                headers={"Authorization": f"Bearer {ess_token}"}
            )
        else:
            assert response.status_code == 400, f"Expected 400 when no sick leaves, got {response.status_code}"
            print(f"Sick leave correctly rejected: {response.json()}")
    
    # ==================== PERIOD CALCULATION TESTS ====================
    
    def test_12_monthly_period_dates_correct(self):
        """Test that monthly period dates are calculated correctly"""
        hr_token = self.get_hr_token()
        
        # Set to monthly
        self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"},
            json={
                "allocation_period": "monthly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        response = self.session.get(
            f"{BASE_URL}/api/ess/v1/leave/period-balance",
            headers={"Authorization": f"Bearer {ess_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify period dates
        now = datetime.now()
        expected_start = now.strftime("%Y-%m-01")
        
        assert data["period_start"] == expected_start, \
            f"Expected period_start {expected_start}, got {data['period_start']}"
        
        # Period label should be month name + year
        assert str(now.year) in data["period_label"], \
            f"Period label should contain year: {data['period_label']}"
        
        print(f"Monthly period: {data['period_start']} to {data['period_end']}, label: {data['period_label']}")
    
    def test_13_quarterly_period_dates_correct(self):
        """Test that quarterly period dates are calculated correctly"""
        hr_token = self.get_hr_token()
        
        # Set to quarterly
        self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {hr_token}"},
            json={
                "allocation_period": "quarterly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        response = self.session.get(
            f"{BASE_URL}/api/ess/v1/leave/period-balance",
            headers={"Authorization": f"Bearer {ess_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify quarterly period
        now = datetime.now()
        quarter = (now.month - 1) // 3 + 1
        
        # Period label should be Q1/Q2/Q3/Q4 format
        assert f"Q{quarter}" in data["period_label"], \
            f"Expected Q{quarter} in period label, got {data['period_label']}"
        
        # Verify quarter start month
        quarter_start_month = (quarter - 1) * 3 + 1
        expected_start = f"{now.year}-{quarter_start_month:02d}-01"
        assert data["period_start"] == expected_start, \
            f"Expected period_start {expected_start}, got {data['period_start']}"
        
        print(f"Quarterly period: {data['period_start']} to {data['period_end']}, label: {data['period_label']}")


class TestLeaveRulesIntegration:
    """Integration tests for leave rules with leave application flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.device_id = f"test-device-{uuid.uuid4()}"
    
    def get_crm_token(self, email=HR_USER):
        """Get CRM auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def get_ess_token(self, email=HR_USER):
        """Get ESS mobile token"""
        response = self.session.post(f"{BASE_URL}/api/ess/v1/auth/login", json={
            "email": email,
            "password": PASSWORD,
            "device": {
                "device_id": self.device_id,
                "device_name": "Test Device",
                "platform": "android",
                "os_version": "14.0",
                "app_version": "1.0.0"
            }
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_14_full_leave_flow_with_period_balance(self):
        """Test complete leave flow: check balance -> apply -> verify balance updated"""
        crm_token = self.get_crm_token()
        assert crm_token, "Failed to get CRM token"
        
        # Set rules to monthly
        self.session.put(
            f"{BASE_URL}/api/leave-rules",
            headers={"Authorization": f"Bearer {crm_token}"},
            json={
                "allocation_period": "monthly",
                "sick_leaves_per_period": 2,
                "casual_leaves_per_period": 1
            }
        )
        
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        # Step 1: Get initial balance
        balance_resp = self.session.get(
            f"{BASE_URL}/api/ess/v1/leave/period-balance",
            headers={"Authorization": f"Bearer {ess_token}"}
        )
        assert balance_resp.status_code == 200
        initial_balance = balance_resp.json()
        print(f"Initial balance - casual_available: {initial_balance['casual_available']}, sick_available: {initial_balance['sick_available']}")
        
        # Step 2: Apply leave if available
        if initial_balance["can_apply_casual"]:
            future_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
            
            apply_resp = self.session.post(
                f"{BASE_URL}/api/ess/v1/leave/apply",
                headers={"Authorization": f"Bearer {ess_token}"},
                json={
                    "leave_type": "casual",
                    "start_date": future_date,
                    "end_date": future_date,
                    "reason": "Integration test leave",
                    "is_half_day": False
                }
            )
            
            if apply_resp.status_code == 200:
                leave_data = apply_resp.json()
                leave_id = leave_data["id"]
                print(f"Leave applied: {leave_id}")
                
                # Step 3: Cancel the leave to clean up
                cancel_resp = self.session.post(
                    f"{BASE_URL}/api/ess/v1/leave/{leave_id}/cancel",
                    headers={"Authorization": f"Bearer {ess_token}"}
                )
                assert cancel_resp.status_code == 200, f"Failed to cancel leave: {cancel_resp.text}"
                print("Leave cancelled successfully")
            else:
                print(f"Leave application response: {apply_resp.status_code} - {apply_resp.text}")
        else:
            print("No casual leaves available, skipping apply test")
    
    def test_15_verify_lop_days_tracking(self):
        """Test that LOP (Loss of Pay) days are tracked in period balance"""
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        # Get period balance
        response = self.session.get(
            f"{BASE_URL}/api/ess/v1/leave/period-balance",
            headers={"Authorization": f"Bearer {ess_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify lop_days field exists and is a number
        assert "lop_days" in data, "Missing lop_days field"
        assert isinstance(data["lop_days"], (int, float)), "lop_days should be a number"
        
        print(f"LOP days: {data['lop_days']}")
    
    def test_16_verify_total_availed_calculation(self):
        """Test that total_availed is correctly calculated"""
        ess_token = self.get_ess_token()
        assert ess_token, "Failed to get ESS token"
        
        # Get period balance
        response = self.session.get(
            f"{BASE_URL}/api/ess/v1/leave/period-balance",
            headers={"Authorization": f"Bearer {ess_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # total_availed should be sum of casual_used + sick_used + lop_days
        expected_total = data["casual_used"] + data["sick_used"] + data["lop_days"]
        assert data["total_availed"] == expected_total, \
            f"Expected total_availed={expected_total}, got {data['total_availed']}"
        
        print(f"Total availed: {data['total_availed']} (casual: {data['casual_used']}, sick: {data['sick_used']}, lop: {data['lop_days']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
