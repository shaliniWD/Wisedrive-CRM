"""
Test Suite for Loans Module Features - Iteration 82
Tests:
1. Stats cards on Loans page showing correct counts
2. Token refresh endpoint POST /api/auth/refresh-token
3. LOAN_EXEC role user only sees 'loans' tab in visible_tabs
4. Bank seeding endpoint POST /api/banks/seed-indian-banks
5. Banks endpoint GET /api/banks returns list of seeded banks
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://car-credit-flow.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "kalyan@wisedrive.com"
ADMIN_PASSWORD = "password123"
LOAN_EXEC_EMAIL = "loanexec@wisedrive.com"
LOAN_EXEC_PASSWORD = "password123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def loan_exec_token():
    """Get loan executive authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": LOAN_EXEC_EMAIL, "password": LOAN_EXEC_PASSWORD}
    )
    assert response.status_code == 200, f"Loan exec login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def loan_exec_user_data():
    """Get loan executive user data from login"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": LOAN_EXEC_EMAIL, "password": LOAN_EXEC_PASSWORD}
    )
    assert response.status_code == 200, f"Loan exec login failed: {response.text}"
    return response.json().get("user", {})


class TestTokenRefresh:
    """Test token refresh endpoint - Feature 2"""
    
    def test_refresh_token_returns_new_token(self, admin_token):
        """POST /api/auth/refresh-token should return new access token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/refresh-token",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Token refresh failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in refresh response"
        assert "token_type" in data, "No token_type in refresh response"
        assert data["token_type"] == "bearer", f"Expected bearer token type, got {data['token_type']}"
        
        # Verify new token is a valid JWT format
        new_token = data["access_token"]
        assert new_token.count('.') == 2, "Token should be valid JWT format (3 parts)"
        
        # Verify new token works for authentication
        verify_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {new_token}"}
        )
        assert verify_response.status_code == 200, f"New token verification failed: {verify_response.text}"
        
        # Verify user data is returned correctly
        user_data = verify_response.json()
        assert user_data.get("email") == ADMIN_EMAIL, "Token should authenticate same user"
    
    def test_refresh_token_requires_auth(self):
        """POST /api/auth/refresh-token should require authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/refresh-token")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestLoanExecRole:
    """Test LOAN_EXEC role visibility - Feature 3"""
    
    def test_loan_exec_login_success(self):
        """LOAN_EXEC user should be able to login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": LOAN_EXEC_EMAIL, "password": LOAN_EXEC_PASSWORD}
        )
        assert response.status_code == 200, f"Loan exec login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
    
    def test_loan_exec_visible_tabs_only_loans(self, loan_exec_user_data):
        """LOAN_EXEC user should only see 'loans' tab in visible_tabs"""
        visible_tabs = loan_exec_user_data.get("visible_tabs", [])
        
        assert visible_tabs == ["loans"], f"Expected ['loans'], got {visible_tabs}"
    
    def test_loan_exec_role_code(self, loan_exec_user_data):
        """LOAN_EXEC user should have role_code 'LOAN_EXEC'"""
        role_code = loan_exec_user_data.get("role_code", "")
        assert role_code == "LOAN_EXEC", f"Expected LOAN_EXEC, got {role_code}"
    
    def test_loan_exec_can_access_auth_me(self, loan_exec_token):
        """LOAN_EXEC user should be able to access /auth/me"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {loan_exec_token}"}
        )
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        
        data = response.json()
        assert data.get("role_code") == "LOAN_EXEC", f"Expected LOAN_EXEC role_code"
        assert data.get("visible_tabs") == ["loans"], f"Expected only loans tab"


class TestBankSeeding:
    """Test bank seeding endpoint - Feature 4"""
    
    def test_seed_indian_banks_success(self, admin_token):
        """POST /api/banks/seed-indian-banks should create 20+ banks"""
        response = requests.post(
            f"{BASE_URL}/api/banks/seed-indian-banks",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Bank seeding failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "total_banks" in data, "No total_banks in response"
        assert data["total_banks"] >= 20, f"Expected 20+ banks, got {data['total_banks']}"
    
    def test_seed_indian_banks_requires_admin(self, loan_exec_token):
        """POST /api/banks/seed-indian-banks should require CEO/HR role"""
        response = requests.post(
            f"{BASE_URL}/api/banks/seed-indian-banks",
            headers={"Authorization": f"Bearer {loan_exec_token}"}
        )
        # LOAN_EXEC should not be able to seed banks
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"


class TestBanksEndpoint:
    """Test banks list endpoint - Feature 5"""
    
    def test_get_banks_returns_list(self, admin_token):
        """GET /api/banks should return list of seeded banks"""
        response = requests.get(
            f"{BASE_URL}/api/banks",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get banks failed: {response.text}"
        
        banks = response.json()
        assert isinstance(banks, list), f"Expected list, got {type(banks)}"
        assert len(banks) >= 20, f"Expected 20+ banks, got {len(banks)}"
    
    def test_get_banks_has_required_fields(self, admin_token):
        """GET /api/banks should return banks with required fields"""
        response = requests.get(
            f"{BASE_URL}/api/banks",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        banks = response.json()
        assert len(banks) > 0, "No banks returned"
        
        # Check first bank has required fields
        bank = banks[0]
        required_fields = ["id", "bank_name", "bank_code", "is_active"]
        for field in required_fields:
            assert field in bank, f"Missing field: {field}"
    
    def test_get_banks_includes_major_banks(self, admin_token):
        """GET /api/banks should include major Indian banks"""
        response = requests.get(
            f"{BASE_URL}/api/banks",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        banks = response.json()
        bank_codes = [b.get("bank_code") for b in banks]
        
        # Check for major banks
        major_banks = ["SBI", "HDFC", "ICICI", "AXIS", "KOTAK"]
        for code in major_banks:
            assert code in bank_codes, f"Missing major bank: {code}"
    
    def test_get_banks_includes_nbfcs(self, admin_token):
        """GET /api/banks should include NBFCs"""
        response = requests.get(
            f"{BASE_URL}/api/banks",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        banks = response.json()
        bank_codes = [b.get("bank_code") for b in banks]
        
        # Check for NBFCs
        nbfcs = ["BAJAJ", "TATACAP", "MAHFIN", "SHRIRAM", "CHOLA"]
        found_nbfcs = [code for code in nbfcs if code in bank_codes]
        assert len(found_nbfcs) >= 3, f"Expected at least 3 NBFCs, found {found_nbfcs}"


class TestLoanLeadStats:
    """Test loan lead stats endpoint - Feature 1"""
    
    def test_get_loan_lead_stats(self, admin_token):
        """GET /api/loan-leads/stats should return correct stats structure"""
        response = requests.get(
            f"{BASE_URL}/api/loan-leads/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get stats failed: {response.text}"
        
        stats = response.json()
        
        # Check required fields
        assert "total" in stats, "Missing 'total' in stats"
        assert "by_status" in stats, "Missing 'by_status' in stats"
        assert "with_credit_score" in stats, "Missing 'with_credit_score' in stats"
        
        # Verify by_status is a dict
        assert isinstance(stats["by_status"], dict), f"by_status should be dict, got {type(stats['by_status'])}"
    
    def test_stats_total_matches_sum(self, admin_token):
        """Stats total should be >= sum of by_status counts"""
        response = requests.get(
            f"{BASE_URL}/api/loan-leads/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        stats = response.json()
        total = stats.get("total", 0)
        by_status = stats.get("by_status", {})
        
        # Sum of status counts should not exceed total
        status_sum = sum(by_status.values())
        assert status_sum <= total, f"Status sum ({status_sum}) exceeds total ({total})"
    
    def test_stats_has_expected_status_keys(self, admin_token):
        """Stats by_status should have expected status keys if leads exist"""
        response = requests.get(
            f"{BASE_URL}/api/loan-leads/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        stats = response.json()
        by_status = stats.get("by_status", {})
        
        # Valid status keys
        valid_statuses = ["NEW", "INTERESTED", "NOT_INTERESTED", "RNR", "CALL_BACK", "FOLLOW_UP"]
        
        # All keys in by_status should be valid
        for key in by_status.keys():
            assert key in valid_statuses, f"Unexpected status key: {key}"


class TestLoanExecCanAccessLoans:
    """Test LOAN_EXEC can access loan endpoints"""
    
    def test_loan_exec_can_get_loan_leads(self, loan_exec_token):
        """LOAN_EXEC should be able to access loan leads"""
        response = requests.get(
            f"{BASE_URL}/api/loan-leads",
            headers={"Authorization": f"Bearer {loan_exec_token}"}
        )
        assert response.status_code == 200, f"Loan exec cannot access loan leads: {response.text}"
    
    def test_loan_exec_can_get_loan_stats(self, loan_exec_token):
        """LOAN_EXEC should be able to access loan stats"""
        response = requests.get(
            f"{BASE_URL}/api/loan-leads/stats",
            headers={"Authorization": f"Bearer {loan_exec_token}"}
        )
        assert response.status_code == 200, f"Loan exec cannot access loan stats: {response.text}"
    
    def test_loan_exec_can_get_banks(self, loan_exec_token):
        """LOAN_EXEC should be able to access banks list"""
        response = requests.get(
            f"{BASE_URL}/api/banks",
            headers={"Authorization": f"Bearer {loan_exec_token}"}
        )
        assert response.status_code == 200, f"Loan exec cannot access banks: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
