#!/usr/bin/env python3
"""
Simple test to verify phone number normalization logic
"""

def normalize_phone(phone_input):
    """Same normalization logic as in the server"""
    phone = phone_input.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+91" + phone[-10:]
    else:
        # Ensure +91 format for Indian numbers
        phone = "+91" + phone[-10:]
    return phone

def test_normalization():
    """Test the normalization logic"""
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
        ("+1234567890", "+911234567890"),          # Different country code (should become +91)
    ]
    
    print("Testing phone number normalization logic...")
    print("=" * 60)
    
    all_passed = True
    for input_phone, expected in test_cases:
        result = normalize_phone(input_phone)
        status = "✅ PASS" if result == expected else "❌ FAIL"
        print(f"{status} | Input: '{input_phone}' -> Output: '{result}' | Expected: '{expected}'")
        if result != expected:
            all_passed = False
    
    print("=" * 60)
    if all_passed:
        print("🎉 All normalization tests passed!")
    else:
        print("⚠️  Some normalization tests failed!")
    
    return all_passed

if __name__ == "__main__":
    test_normalization()