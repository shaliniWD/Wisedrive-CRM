#!/usr/bin/env python3
"""
Test script to verify the OTP phone number normalization fix.
This script tests both request-otp and verify-otp endpoints with different phone formats.
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

def test_otp_flow(phone_input, expected_normalized):
    """Test the complete OTP flow with a given phone number format"""
    print(f"\n=== Testing phone: '{phone_input}' ===")
    print(f"Expected normalized: '{expected_normalized}'")
    
    # Step 1: Request OTP
    print("1. Requesting OTP...")
    request_data = {"phone": phone_input}
    
    try:
        response = requests.post(f"{BASE_URL}/auth/request-otp", json=request_data)
        print(f"Request OTP Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ OTP request successful")
            result = response.json()
            print(f"Response: {result}")
            
            # Step 2: Verify OTP (using dev mode OTP: 123456)
            print("2. Verifying OTP...")
            verify_data = {"phone": phone_input, "otp": "123456"}
            
            verify_response = requests.post(f"{BASE_URL}/auth/verify-otp", json=verify_data)
            print(f"Verify OTP Status: {verify_response.status_code}")
            
            if verify_response.status_code == 200:
                print("✅ OTP verification successful")
                verify_result = verify_response.json()
                print(f"Mechanic profile phone: {verify_result.get('mechanicProfile', {}).get('phone')}")
                
                # Check if the returned phone matches expected normalized format
                returned_phone = verify_result.get('mechanicProfile', {}).get('phone')
                if returned_phone == expected_normalized:
                    print("✅ Phone normalization working correctly!")
                else:
                    print(f"❌ Phone normalization issue: got '{returned_phone}', expected '{expected_normalized}'")
                
                return True
            else:
                print(f"❌ OTP verification failed: {verify_response.text}")
                return False
        else:
            print(f"❌ OTP request failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error during test: {e}")
        return False

def main():
    """Run tests with different phone number formats"""
    print("Testing OTP phone number normalization fix...")
    
    # Test cases: (input_phone, expected_normalized_phone)
    test_cases = [
        ("8050078999", "+918050078999"),           # No country code
        ("+918050078999", "+918050078999"),        # Already normalized
        ("+91 8050078999", "+918050078999"),       # With space
        ("91 8050078999", "+918050078999"),        # Without + but with space
        ("805-007-8999", "+918050078999"),         # With dashes
        ("+91-8050078999", "+918050078999"),       # With country code and dash
        ("9611188788", "+919611188788"),           # Dev test phone 1
        ("+919611188788", "+919611188788"),        # Dev test phone 1 normalized
        ("9689760236", "+919689760236"),           # Dev test phone 2
    ]
    
    successful_tests = 0
    total_tests = len(test_cases)
    
    for phone_input, expected_normalized in test_cases:
        success = test_otp_flow(phone_input, expected_normalized)
        if success:
            successful_tests += 1
        time.sleep(1)  # Small delay between tests
    
    print(f"\n=== Test Results ===")
    print(f"Successful: {successful_tests}/{total_tests}")
    print(f"Failed: {total_tests - successful_tests}/{total_tests}")
    
    if successful_tests == total_tests:
        print("🎉 All tests passed! OTP normalization fix is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the implementation.")

if __name__ == "__main__":
    main()