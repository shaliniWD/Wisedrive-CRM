"""
Report URL Encryption Service
Creates short, encrypted URLs for customer report access
"""
import os
import base64
import hashlib
import hmac
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Secret key for URL encryption (should be in .env in production)
URL_SECRET_KEY = os.environ.get("REPORT_URL_SECRET", "wisedrive-report-secret-2024")


def encode_inspection_id(inspection_id: str) -> str:
    """
    Encode inspection ID into a short, URL-safe code.
    Uses HMAC for integrity and base64 for encoding.
    
    Format: base64(inspection_id + signature)
    Result is ~22 chars for a UUID input
    """
    try:
        # Create a signature using HMAC
        signature = hmac.new(
            URL_SECRET_KEY.encode(),
            inspection_id.encode(),
            hashlib.sha256
        ).digest()[:8]  # Use first 8 bytes of signature
        
        # Combine ID and signature
        combined = inspection_id.encode() + signature
        
        # Encode to base64 and make URL-safe
        encoded = base64.urlsafe_b64encode(combined).decode()
        
        # Remove padding for shorter URL
        encoded = encoded.rstrip('=')
        
        logger.info(f"[URL_ENCODE] Encoded inspection {inspection_id[:8]}... to {encoded[:10]}...")
        return encoded
        
    except Exception as e:
        logger.error(f"[URL_ENCODE] Error encoding: {e}")
        raise ValueError("Failed to encode inspection ID")


def decode_inspection_id(encoded: str) -> Optional[str]:
    """
    Decode a short code back to inspection ID.
    Verifies the signature to prevent tampering.
    
    Returns None if code is invalid or tampered.
    """
    try:
        # Add back base64 padding if needed
        padding = 4 - (len(encoded) % 4)
        if padding != 4:
            encoded += '=' * padding
        
        # Decode from base64
        decoded = base64.urlsafe_b64decode(encoded.encode())
        
        # Split ID and signature (signature is last 8 bytes)
        inspection_id = decoded[:-8].decode()
        received_signature = decoded[-8:]
        
        # Verify signature
        expected_signature = hmac.new(
            URL_SECRET_KEY.encode(),
            inspection_id.encode(),
            hashlib.sha256
        ).digest()[:8]
        
        if not hmac.compare_digest(received_signature, expected_signature):
            logger.warning(f"[URL_DECODE] Invalid signature for code {encoded[:10]}...")
            return None
        
        logger.info(f"[URL_DECODE] Decoded {encoded[:10]}... to inspection {inspection_id[:8]}...")
        return inspection_id
        
    except Exception as e:
        logger.error(f"[URL_DECODE] Error decoding: {e}")
        return None


def generate_report_otp() -> str:
    """Generate a 6-digit OTP for report access"""
    import random
    return str(random.randint(100000, 999999))


def get_customer_report_url(inspection_id: str, base_url: str = "") -> str:
    """
    Generate the full customer-facing report URL.
    
    Args:
        inspection_id: The inspection UUID
        base_url: The base URL (e.g., https://crmdev.wisedrive.com)
    
    Returns:
        Full URL like: https://crmdev.wisedrive.com/r/abc123xyz
    """
    short_code = encode_inspection_id(inspection_id)
    return f"{base_url}/r/{short_code}"
