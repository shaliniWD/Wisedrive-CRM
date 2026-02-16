"""Razorpay Payment Service for Lead Management"""
import os
import logging
import razorpay
import hmac
import hashlib
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class RazorpayService:
    """Service for creating payment links and handling payments via Razorpay"""
    
    def __init__(self):
        self.key_id = os.environ.get("RAZORPAY_KEY_ID")
        self.key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
        self.client = None
        
        if self.key_id and self.key_secret:
            try:
                self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
                logger.info("Razorpay service initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Razorpay client: {e}")
        else:
            logger.warning("Razorpay credentials not configured - Payment links disabled")
    
    def is_configured(self) -> bool:
        """Check if Razorpay is properly configured"""
        return self.client is not None
    
    def verify_webhook_signature(self, payload: str, signature: str) -> bool:
        """
        Verify Razorpay webhook signature.
        
        Args:
            payload: Raw request body as string
            signature: X-Razorpay-Signature header value
            
        Returns:
            bool indicating if signature is valid
        """
        if not self.key_secret:
            return False
        
        try:
            expected_signature = hmac.new(
                self.key_secret.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(expected_signature, signature)
        except Exception as e:
            logger.error(f"Webhook signature verification failed: {e}")
            return False
    
    async def create_payment_link(
        self,
        amount: float,
        customer_name: str,
        customer_phone: str,
        customer_email: Optional[str] = None,
        description: str = "Vehicle Inspection",
        lead_id: Optional[str] = None,
        package_id: Optional[str] = None,
        expire_by_hours: int = 24
    ) -> dict:
        """
        Create a Razorpay payment link.
        
        Args:
            amount: Amount in INR (will be converted to paise)
            customer_name: Customer's name
            customer_phone: Customer's phone number
            customer_email: Customer's email (optional)
            description: Payment description
            lead_id: Associated lead ID for reference
            package_id: Associated package ID for reference
            expire_by_hours: Link expiry in hours (default 24)
            
        Returns:
            dict with payment link details
        """
        if not self.client:
            logger.error("Razorpay client not initialized")
            return {"success": False, "error": "Razorpay not configured"}
        
        try:
            # Convert amount to paise (Razorpay uses smallest currency unit)
            amount_paise = int(amount * 100)
            
            # Calculate expiry timestamp
            expire_by = int(datetime.now(timezone.utc).timestamp()) + (expire_by_hours * 3600)
            
            # Create payment link
            payment_link_data = {
                "amount": amount_paise,
                "currency": "INR",
                "accept_partial": False,
                "description": description,
                "customer": {
                    "name": customer_name,
                    "contact": customer_phone,
                },
                "notify": {
                    "sms": False,  # We'll send via WhatsApp instead
                    "email": False
                },
                "reminder_enable": True,
                "notes": {
                    "lead_id": lead_id or "",
                    "package_id": package_id or "",
                    "source": "wisedrive_crm"
                },
                "expire_by": expire_by,
                "callback_url": "",
                "callback_method": "get"
            }
            
            if customer_email:
                payment_link_data["customer"]["email"] = customer_email
            
            payment_link = self.client.payment_link.create(payment_link_data)
            
            logger.info(f"Payment link created: {payment_link.get('id')} for lead {lead_id}")
            
            return {
                "success": True,
                "payment_link_id": payment_link.get("id"),
                "short_url": payment_link.get("short_url"),
                "amount": amount,
                "amount_paise": amount_paise,
                "status": payment_link.get("status"),
                "expire_by": expire_by
            }
            
        except Exception as e:
            logger.error(f"Failed to create payment link: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_payment_link(self, payment_link_id: str) -> dict:
        """Get payment link details"""
        if not self.client:
            return {"success": False, "error": "Razorpay not configured"}
        
        try:
            payment_link = self.client.payment_link.fetch(payment_link_id)
            return {
                "success": True,
                "payment_link": payment_link
            }
        except Exception as e:
            logger.error(f"Failed to fetch payment link {payment_link_id}: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_payment(self, payment_id: str) -> dict:
        """Get payment details"""
        if not self.client:
            return {"success": False, "error": "Razorpay not configured"}
        
        try:
            payment = self.client.payment.fetch(payment_id)
            return {
                "success": True,
                "payment": payment
            }
        except Exception as e:
            logger.error(f"Failed to fetch payment {payment_id}: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
razorpay_service: Optional[RazorpayService] = None


def get_razorpay_service() -> RazorpayService:
    """Get or create Razorpay service instance"""
    global razorpay_service
    if razorpay_service is None:
        razorpay_service = RazorpayService()
    return razorpay_service
