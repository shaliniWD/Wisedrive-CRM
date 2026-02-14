"""Encryption Service - AES-256 encryption for sensitive data"""
import os
import base64
import hashlib
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Optional


class EncryptionService:
    """
    AES-256 encryption service for sensitive data like bank account numbers.
    Uses Fernet (symmetric encryption) with PBKDF2 key derivation.
    """
    
    def __init__(self):
        # Get encryption key from environment (or generate a default for dev)
        self.master_key = os.environ.get('ENCRYPTION_KEY', 'wisedrive-dev-encryption-key-2024')
        self.salt = os.environ.get('ENCRYPTION_SALT', 'wisedrive-salt-v1').encode()
        self._fernet = self._create_fernet()
    
    def _create_fernet(self) -> Fernet:
        """Create Fernet instance with derived key"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt,
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.master_key.encode()))
        return Fernet(key)
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a plaintext string.
        Returns base64-encoded encrypted string.
        """
        if not plaintext:
            return ""
        
        encrypted_bytes = self._fernet.encrypt(plaintext.encode())
        return base64.urlsafe_b64encode(encrypted_bytes).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt an encrypted string.
        Returns the original plaintext.
        """
        if not ciphertext:
            return ""
        
        try:
            encrypted_bytes = base64.urlsafe_b64decode(ciphertext.encode())
            decrypted_bytes = self._fernet.decrypt(encrypted_bytes)
            return decrypted_bytes.decode()
        except Exception as e:
            # Log error but don't expose details
            print(f"Decryption error: {type(e).__name__}")
            return ""
    
    def mask_bank_account(self, account_number: str) -> str:
        """
        Mask bank account number for display.
        Shows only last 4 digits: XXXX XXXX 1234
        """
        if not account_number:
            return ""
        
        # Remove any spaces or dashes
        clean_number = ''.join(filter(str.isdigit, account_number))
        
        if len(clean_number) <= 4:
            return clean_number
        
        # Show only last 4 digits
        masked = 'X' * (len(clean_number) - 4) + clean_number[-4:]
        
        # Add spacing for readability
        return ' '.join([masked[i:i+4] for i in range(0, len(masked), 4)])
    
    def encrypt_bank_details(self, bank_account_number: str) -> dict:
        """
        Encrypt bank account number and return both encrypted and masked versions.
        """
        if not bank_account_number:
            return {
                "encrypted": None,
                "masked": None
            }
        
        return {
            "encrypted": self.encrypt(bank_account_number),
            "masked": self.mask_bank_account(bank_account_number)
        }


# Singleton instance
_encryption_service: Optional[EncryptionService] = None


def get_encryption_service() -> EncryptionService:
    """Get or create encryption service singleton"""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service
