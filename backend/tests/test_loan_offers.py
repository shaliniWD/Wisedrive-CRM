"""
Test Bank Loan Offers Feature
Tests all loan offer endpoints:
- GET /api/loan-leads/{lead_id}/offers - Get all offers for a lead
- POST /api/loan-leads/{lead_id}/offers - Create offer from application
- POST /api/loan-leads/{lead_id}/manual-offer - Create manual bank offer
- POST /api/loan-leads/{lead_id}/offers/{offer_id}/accept - Accept an offer
- PUT /api/loan-leads/{lead_id}/offers/{offer_id} - Update offer (negotiation)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "kalyan@wisedrive.com"
TEST_PASSWORD = "password123"

# Test data from main agent
TEST_LEAD_ID = "c6691f1f-ecbc-446a-ab92-be5386eff6f7"
TEST_VEHICLE_ID = "84bc65b7-1af7-4356-95ba-f5090f086381"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


@pytest.fixture(scope="module")
def banks_list(api_client):
    """Get list of banks"""
    response = api_client.get(f"{BASE_URL}/api/banks")
    assert response.status_code == 200
    return response.json()


class TestLoanOffersAPI:
    """Test Loan Offers CRUD operations"""
    
    def test_get_loan_lead(self, api_client):
        """Test getting loan lead details"""
        response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == TEST_LEAD_ID
        assert "customer_name" in data
        assert "vehicles" in data
        assert "applications" in data
        print(f"Lead: {data['customer_name']}, Vehicles: {len(data.get('vehicles', []))}")
    
    def test_get_offers_for_lead(self, api_client):
        """Test GET /api/loan-leads/{lead_id}/offers"""
        response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/offers")
        assert response.status_code == 200
        
        offers = response.json()
        assert isinstance(offers, list)
        print(f"Found {len(offers)} offers for lead")
        
        # Verify offer structure
        if offers:
            offer = offers[0]
            assert "id" in offer
            assert "bank_name" in offer
            assert "loan_amount_approved" in offer
            assert "total_loan_amount" in offer
            assert "charges" in offer
            assert "net_disbursal_amount" in offer
            assert "offer_status" in offer
    
    def test_get_offers_nonexistent_lead(self, api_client):
        """Test GET offers for non-existent lead returns 404"""
        fake_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/loan-leads/{fake_id}/offers")
        assert response.status_code == 404
    
    def test_create_offer_from_application(self, api_client):
        """Test POST /api/loan-leads/{lead_id}/offers - Create offer from application"""
        # First get applications for the lead
        lead_response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}")
        assert lead_response.status_code == 200
        applications = lead_response.json().get("applications", [])
        
        if not applications:
            pytest.skip("No applications found for testing")
        
        # Use first application
        app = applications[0]
        
        offer_data = {
            "application_id": app["id"],
            "loan_amount_approved": 350000,
            "loan_insurance": 10000,
            "interest_rate": 11.5,
            "tenure_months": 48,
            "bank_reference_number": f"TEST/{uuid.uuid4().hex[:8]}",
            "processing_fee_percent": 1.5,
            "document_handling_fee": 1200,
            "rto_charges": 2800,
            "insurance_charges": 6000
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/offers",
            json=offer_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "offer" in data
        offer = data["offer"]
        
        # Verify offer data
        assert offer["loan_amount_approved"] == 350000
        assert offer["loan_insurance"] == 10000
        assert offer["total_loan_amount"] == 360000  # 350000 + 10000
        assert offer["interest_rate"] == 11.5
        assert offer["tenure_months"] == 48
        assert offer["offer_status"] == "PENDING"
        
        # Verify charges
        assert len(offer["charges"]) >= 4
        charge_types = [c["charge_type"] for c in offer["charges"]]
        assert "processing_fee" in charge_types
        assert "document_handling" in charge_types
        assert "rto_charges" in charge_types
        assert "insurance_charges" in charge_types
        
        # Verify net disbursal calculation
        total_charges = sum(c["amount"] for c in offer["charges"] if not c.get("is_waived"))
        assert offer["total_charges"] == total_charges
        assert offer["net_disbursal_amount"] == offer["total_loan_amount"] - total_charges
        
        print(f"Created offer: {offer['id']}, Net Disbursal: {offer['net_disbursal_amount']}")
        return offer["id"]
    
    def test_create_manual_offer(self, api_client, banks_list):
        """Test POST /api/loan-leads/{lead_id}/manual-offer"""
        # Get a bank that's not already used
        bank = banks_list[0] if banks_list else None
        if not bank:
            pytest.skip("No banks available for testing")
        
        params = {
            "bank_id": bank["id"],
            "vehicle_loan_id": TEST_VEHICLE_ID,
            "loan_amount_approved": 400000,
            "loan_insurance": 15000,
            "interest_rate": 12.25,
            "tenure_months": 60,
            "processing_fee_percent": 1.25,
            "document_handling_fee": 1500,
            "rto_charges": 3000,
            "insurance_charges": 8000,
            "notes": "TEST_Manual offer for pytest"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/manual-offer",
            params=params
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "offer" in data
        offer = data["offer"]
        
        # Verify manual offer fields
        assert offer["is_manual"] == True
        assert offer["manual_notes"] == "TEST_Manual offer for pytest"
        assert offer["bank_name"] == bank["bank_name"]
        assert offer["loan_amount_approved"] == 400000
        assert offer["total_loan_amount"] == 415000  # 400000 + 15000
        
        print(f"Created manual offer: {offer['id']}, Bank: {offer['bank_name']}")
        return offer["id"]
    
    def test_update_offer_negotiation(self, api_client):
        """Test PUT /api/loan-leads/{lead_id}/offers/{offer_id} - Negotiation"""
        # First get offers
        offers_response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/offers")
        assert offers_response.status_code == 200
        offers = offers_response.json()
        
        # Find a PENDING offer to negotiate
        pending_offers = [o for o in offers if o["offer_status"] == "PENDING"]
        if not pending_offers:
            pytest.skip("No pending offers to negotiate")
        
        offer = pending_offers[0]
        offer_id = offer["id"]
        original_total_charges = offer["total_charges"]
        
        # Update with negotiation
        update_data = {
            "offer_status": "NEGOTIATING",
            "charges_updates": [
                {
                    "charge_type": "processing_fee",
                    "new_amount": 2000,
                    "notes": "Negotiated down"
                },
                {
                    "charge_type": "document_handling",
                    "is_waived": True,
                    "notes": "Waived as goodwill"
                }
            ],
            "negotiation_notes": "Customer requested lower charges"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/offers/{offer_id}",
            json=update_data
        )
        assert response.status_code == 200
        
        data = response.json()
        updated_offer = data["offer"]
        
        # Verify status changed
        assert updated_offer["offer_status"] == "NEGOTIATING"
        
        # Verify charges updated
        processing_fee = next((c for c in updated_offer["charges"] if c["charge_type"] == "processing_fee"), None)
        assert processing_fee is not None
        assert processing_fee["amount"] == 2000
        
        doc_handling = next((c for c in updated_offer["charges"] if c["charge_type"] == "document_handling"), None)
        assert doc_handling is not None
        assert doc_handling["is_waived"] == True
        
        # Verify negotiation history
        assert len(updated_offer["negotiation_history"]) > 0
        
        # Verify total charges decreased
        assert updated_offer["total_charges"] < original_total_charges
        
        print(f"Negotiated offer: {offer_id}, New total charges: {updated_offer['total_charges']}")
    
    def test_accept_offer(self, api_client):
        """Test POST /api/loan-leads/{lead_id}/offers/{offer_id}/accept"""
        # Get offers
        offers_response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/offers")
        assert offers_response.status_code == 200
        offers = offers_response.json()
        
        # Find a non-accepted offer
        available_offers = [o for o in offers if o["offer_status"] not in ["ACCEPTED", "REJECTED"]]
        if not available_offers:
            pytest.skip("No offers available to accept")
        
        offer = available_offers[0]
        offer_id = offer["id"]
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/offers/{offer_id}/accept"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "final_net_disbursal" in data
        assert data["final_net_disbursal"] > 0
        
        # Verify offer is now accepted
        verify_response = api_client.get(f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/offers")
        offers = verify_response.json()
        accepted_offer = next((o for o in offers if o["id"] == offer_id), None)
        assert accepted_offer is not None
        assert accepted_offer["offer_status"] == "ACCEPTED"
        assert accepted_offer["final_net_disbursal"] is not None
        
        print(f"Accepted offer: {offer_id}, Final disbursal: {data['final_net_disbursal']}")
    
    def test_offer_charges_calculation(self, api_client, banks_list):
        """Test that charges are calculated correctly"""
        bank = banks_list[0] if banks_list else None
        if not bank:
            pytest.skip("No banks available")
        
        # Create offer with specific amounts
        params = {
            "bank_id": bank["id"],
            "vehicle_loan_id": TEST_VEHICLE_ID,
            "loan_amount_approved": 500000,
            "loan_insurance": 20000,
            "interest_rate": 11.0,
            "tenure_months": 48,
            "processing_fee_percent": 2.0,  # 2% of 500000 = 10000
            "document_handling_fee": 2000,
            "rto_charges": 4000,
            "insurance_charges": 10000,
            "notes": "TEST_Calculation verification"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/manual-offer",
            params=params
        )
        assert response.status_code == 200
        
        offer = response.json()["offer"]
        
        # Verify calculations
        assert offer["total_loan_amount"] == 520000  # 500000 + 20000
        
        # Processing fee should be 2% of loan_amount_approved
        processing_fee = next((c for c in offer["charges"] if c["charge_type"] == "processing_fee"), None)
        assert processing_fee["amount"] == 10000  # 2% of 500000
        
        # Total charges
        expected_total_charges = 10000 + 2000 + 4000 + 10000  # 26000
        assert offer["total_charges"] == expected_total_charges
        
        # Net disbursal
        expected_net = 520000 - 26000  # 494000
        assert offer["net_disbursal_amount"] == expected_net
        
        print(f"Calculation verified: Total Loan={offer['total_loan_amount']}, Charges={offer['total_charges']}, Net={offer['net_disbursal_amount']}")


class TestLoanOffersEdgeCases:
    """Test edge cases and error handling"""
    
    def test_create_offer_invalid_application(self, api_client):
        """Test creating offer with invalid application ID"""
        offer_data = {
            "application_id": str(uuid.uuid4()),  # Non-existent
            "loan_amount_approved": 300000,
            "loan_insurance": 10000,
            "interest_rate": 11.0,
            "tenure_months": 48
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/offers",
            json=offer_data
        )
        assert response.status_code == 404
    
    def test_update_nonexistent_offer(self, api_client):
        """Test updating non-existent offer"""
        fake_offer_id = str(uuid.uuid4())
        update_data = {
            "offer_status": "NEGOTIATING",
            "negotiation_notes": "Test"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/offers/{fake_offer_id}",
            json=update_data
        )
        assert response.status_code == 404
    
    def test_accept_nonexistent_offer(self, api_client):
        """Test accepting non-existent offer"""
        fake_offer_id = str(uuid.uuid4())
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/offers/{fake_offer_id}/accept"
        )
        assert response.status_code == 404
    
    def test_manual_offer_invalid_bank(self, api_client):
        """Test creating manual offer with invalid bank ID"""
        params = {
            "bank_id": str(uuid.uuid4()),  # Non-existent
            "vehicle_loan_id": TEST_VEHICLE_ID,
            "loan_amount_approved": 300000,
            "loan_insurance": 10000,
            "interest_rate": 11.0,
            "tenure_months": 48
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/manual-offer",
            params=params
        )
        assert response.status_code == 404
    
    def test_manual_offer_invalid_vehicle(self, api_client, banks_list):
        """Test creating manual offer with invalid vehicle ID"""
        bank = banks_list[0] if banks_list else None
        if not bank:
            pytest.skip("No banks available")
        
        params = {
            "bank_id": bank["id"],
            "vehicle_loan_id": str(uuid.uuid4()),  # Non-existent
            "loan_amount_approved": 300000,
            "loan_insurance": 10000,
            "interest_rate": 11.0,
            "tenure_months": 48
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/loan-leads/{TEST_LEAD_ID}/manual-offer",
            params=params
        )
        assert response.status_code == 404


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_offers(api_client):
    """Cleanup test-created offers after tests"""
    yield
    # Note: In production, we'd delete TEST_ prefixed offers
    # For now, we leave them as they don't affect other tests
    print("Test cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
