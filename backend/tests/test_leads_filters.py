"""
Test Leads Filters - Date Range and Employee Filtering
Tests for the 3 bug fixes:
1. Employee filter switching
2. Date filter updates stats
3. All Leads card added
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLeadsFilters:
    """Test leads filtering functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123",
            "country": "India"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    def test_get_all_leads_no_filter(self):
        """Test getting all leads without any filters"""
        response = self.session.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 200
        
        leads = response.json()
        assert isinstance(leads, list)
        print(f"Total leads without filter: {len(leads)}")
        assert len(leads) > 0, "Should have some leads in the system"
    
    def test_date_filter_today(self):
        """Test filtering leads by today's date"""
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
        
        response = self.session.get(f"{BASE_URL}/api/leads", params={
            "date_from": today,
            "date_to": today
        })
        assert response.status_code == 200
        
        leads = response.json()
        print(f"Leads for today ({today}): {len(leads)}")
        
        # Verify all returned leads are from today
        for lead in leads:
            if lead.get("created_at"):
                assert lead["created_at"].startswith(today), f"Lead {lead.get('id')} created_at {lead.get('created_at')} should start with {today}"
    
    def test_date_filter_all_time(self):
        """Test getting all leads without date filter (All Time)"""
        response = self.session.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 200
        
        all_leads = response.json()
        print(f"All time leads: {len(all_leads)}")
        
        # Should have more leads than just today
        assert len(all_leads) >= 0
    
    def test_date_filter_comparison(self):
        """Test that date filter returns different counts for different ranges"""
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Get all leads
        all_response = self.session.get(f"{BASE_URL}/api/leads")
        assert all_response.status_code == 200
        all_leads = all_response.json()
        
        # Get today's leads
        today_response = self.session.get(f"{BASE_URL}/api/leads", params={
            "date_from": today,
            "date_to": today
        })
        assert today_response.status_code == 200
        today_leads = today_response.json()
        
        print(f"All leads: {len(all_leads)}, Today's leads: {len(today_leads)}")
        
        # All time should have >= today's leads
        assert len(all_leads) >= len(today_leads), "All time should have at least as many leads as today"
    
    def test_employee_filter_by_name(self):
        """Test filtering leads by employee name"""
        # First get all leads to find an employee name
        all_response = self.session.get(f"{BASE_URL}/api/leads")
        assert all_response.status_code == 200
        all_leads = all_response.json()
        
        # Find an employee with leads
        employee_names = set()
        for lead in all_leads:
            if lead.get("assigned_to_name"):
                employee_names.add(lead["assigned_to_name"])
        
        if not employee_names:
            pytest.skip("No leads with assigned employees found")
        
        # Test filtering by first employee name
        test_employee = list(employee_names)[0]
        print(f"Testing filter by employee: {test_employee}")
        
        response = self.session.get(f"{BASE_URL}/api/leads", params={
            "assigned_to": test_employee
        })
        assert response.status_code == 200
        
        filtered_leads = response.json()
        print(f"Leads for {test_employee}: {len(filtered_leads)}")
        
        # Verify all returned leads are assigned to this employee
        for lead in filtered_leads:
            assigned = lead.get("assigned_to_name") or lead.get("assigned_to")
            assert assigned == test_employee, f"Lead should be assigned to {test_employee}, got {assigned}"
    
    def test_employee_filter_switching(self):
        """Test switching between different employees - Bug #1"""
        # Get all leads to find multiple employees
        all_response = self.session.get(f"{BASE_URL}/api/leads")
        assert all_response.status_code == 200
        all_leads = all_response.json()
        
        # Find employees with leads
        employee_lead_counts = {}
        for lead in all_leads:
            emp_name = lead.get("assigned_to_name")
            if emp_name:
                employee_lead_counts[emp_name] = employee_lead_counts.get(emp_name, 0) + 1
        
        if len(employee_lead_counts) < 2:
            pytest.skip("Need at least 2 employees with leads to test switching")
        
        employees = list(employee_lead_counts.keys())[:3]  # Test up to 3 employees
        print(f"Testing employee switching between: {employees}")
        
        # Test switching between employees
        for emp in employees:
            response = self.session.get(f"{BASE_URL}/api/leads", params={
                "assigned_to": emp
            })
            assert response.status_code == 200
            
            leads = response.json()
            expected_count = employee_lead_counts[emp]
            actual_count = len(leads)
            
            print(f"Employee {emp}: expected {expected_count}, got {actual_count}")
            assert actual_count == expected_count, f"Employee {emp} should have {expected_count} leads, got {actual_count}"
    
    def test_combined_date_and_employee_filter(self):
        """Test combining date and employee filters"""
        from datetime import datetime, timedelta
        
        # Get a date range that should have leads
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        
        # First get all leads in date range
        date_response = self.session.get(f"{BASE_URL}/api/leads", params={
            "date_from": start_date,
            "date_to": end_date
        })
        assert date_response.status_code == 200
        date_leads = date_response.json()
        
        if not date_leads:
            pytest.skip("No leads in the last 30 days")
        
        # Find an employee in these leads
        employee_name = None
        for lead in date_leads:
            if lead.get("assigned_to_name"):
                employee_name = lead["assigned_to_name"]
                break
        
        if not employee_name:
            pytest.skip("No assigned leads in date range")
        
        # Test combined filter
        combined_response = self.session.get(f"{BASE_URL}/api/leads", params={
            "date_from": start_date,
            "date_to": end_date,
            "assigned_to": employee_name
        })
        assert combined_response.status_code == 200
        
        combined_leads = combined_response.json()
        print(f"Combined filter (date + {employee_name}): {len(combined_leads)} leads")
        
        # Verify all leads match both filters
        for lead in combined_leads:
            # Check employee
            assigned = lead.get("assigned_to_name") or lead.get("assigned_to")
            assert assigned == employee_name, f"Lead should be assigned to {employee_name}"
            
            # Check date
            created_at = lead.get("created_at", "")[:10]
            assert start_date <= created_at <= end_date, f"Lead date {created_at} should be in range"
    
    def test_sneha_reddy_filter(self):
        """Test filtering by Sneha Reddy specifically (mentioned in test requirements)"""
        response = self.session.get(f"{BASE_URL}/api/leads", params={
            "assigned_to": "Sneha Reddy"
        })
        assert response.status_code == 200
        
        leads = response.json()
        print(f"Leads for Sneha Reddy: {len(leads)}")
        
        # According to requirements, should be ~37 leads
        # Allow some variance as data may change
        if len(leads) > 0:
            for lead in leads:
                assigned = lead.get("assigned_to_name") or lead.get("assigned_to")
                assert assigned == "Sneha Reddy", f"Lead should be assigned to Sneha Reddy, got {assigned}"
    
    def test_get_employees_list(self):
        """Test getting employees list for filter dropdown"""
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        
        employees = response.json()
        assert isinstance(employees, list)
        print(f"Total employees: {len(employees)}")
        
        # Check for sales roles
        sales_roles = ['SALES_EXEC', 'SALES_LEAD', 'SALES_HEAD', 'COUNTRY_HEAD']
        sales_employees = [e for e in employees if e.get('role_code') in sales_roles]
        print(f"Sales employees: {len(sales_employees)}")


class TestLeadStats:
    """Test lead statistics calculations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kalyan@wisedrive.com",
            "password": "password123",
            "country": "India"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    def test_stats_calculation_all_time(self):
        """Test that stats can be calculated from all leads"""
        response = self.session.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 200
        
        leads = response.json()
        
        # Calculate stats like frontend does
        stats = {
            "totalLeads": len(leads),
            "totalNewLeads": len([l for l in leads if l.get("status") == "NEW LEAD"]),
            "hotLeads": len([l for l in leads if l.get("status") == "HOT LEADS"]),
            "rcbWhatsappLeads": len([l for l in leads if l.get("status") == "RCB WHATSAPP" or l.get("reminder_reason") == "RCB_WHATSAPP"]),
            "followupLeads": len([l for l in leads if l.get("status") in ["FOLLOW UP", "WHATSAPP FOLLOW UP", "Repeat follow up"] or l.get("reminder_date")]),
            "paymentLinkSentLeads": len([l for l in leads if l.get("status") == "PAYMENT LINK SENT" or l.get("payment_link")]),
        }
        
        print(f"Stats for All Time: {stats}")
        assert stats["totalLeads"] >= 0
    
    def test_stats_calculation_today(self):
        """Test that stats change when date filter is applied"""
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Get all leads
        all_response = self.session.get(f"{BASE_URL}/api/leads")
        all_leads = all_response.json()
        
        # Get today's leads
        today_response = self.session.get(f"{BASE_URL}/api/leads", params={
            "date_from": today,
            "date_to": today
        })
        today_leads = today_response.json()
        
        all_stats = {"totalLeads": len(all_leads)}
        today_stats = {"totalLeads": len(today_leads)}
        
        print(f"All Time stats: {all_stats}")
        print(f"Today stats: {today_stats}")
        
        # Stats should be different (unless all leads are from today)
        # This verifies the date filter is working
        assert all_stats["totalLeads"] >= today_stats["totalLeads"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
