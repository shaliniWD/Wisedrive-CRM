"""
Wisedrive API Services - Razorpay Integration
Server-side payment gateway integration
"""
from typing import Optional, Dict, Any
import hmac
import hashlib
import logging

logger = logging.getLogger(__name__)


class RazorpayClient:
    """
    Razorpay payment gateway client.
    
    IMPORTANT: This is a server-side only integration.
    Frontend should NEVER have access to Razorpay credentials.
    
    Flow:
    1. Frontend requests order creation via Wisedrive API
    2. Backend creates Razorpay order
    3. Frontend receives order_id and key_id (public)
    4. Frontend shows Razorpay checkout
    5. On success, frontend sends verification data to backend
    6. Backend verifies signature and confirms payment
    """
    
    def __init__(
        self,
        key_id: str,
        key_secret: str,
        webhook_secret: Optional[str] = None
    ):
        self.key_id = key_id
        self.key_secret = key_secret
        self.webhook_secret = webhook_secret
        self.base_url = "https://api.razorpay.com/v1"
        
        # Import razorpay SDK lazily
        self._client = None
    
    @property
    def client(self):
        """Lazy load Razorpay client"""
        if self._client is None:
            try:
                import razorpay
                self._client = razorpay.Client(auth=(self.key_id, self.key_secret))
            except ImportError:
                raise RuntimeError("razorpay package not installed")
        return self._client
    
    async def create_order(
        self,
        amount: int,
        currency: str = "INR",
        receipt: Optional[str] = None,
        notes: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Create a Razorpay order.
        
        Args:
            amount: Amount in smallest currency unit (paise for INR)
            currency: Currency code (INR, USD, etc.)
            receipt: Order receipt ID (your internal order ID)
            notes: Additional metadata
            
        Returns:
            Razorpay order object with order_id
        """
        order_data = {
            "amount": amount,
            "currency": currency,
        }
        
        if receipt:
            order_data["receipt"] = receipt
        if notes:
            order_data["notes"] = notes
        
        try:
            order = self.client.order.create(data=order_data)
            
            logger.info(f"Created Razorpay order: {order['id']}")
            
            return {
                "order_id": order["id"],
                "amount": order["amount"],
                "currency": order["currency"],
                "key": self.key_id,  # Public key for frontend
                "receipt": order.get("receipt"),
                "status": order["status"]
            }
            
        except Exception as e:
            logger.error(f"Failed to create Razorpay order: {e}")
            raise
    
    def verify_payment_signature(
        self,
        order_id: str,
        payment_id: str,
        signature: str
    ) -> bool:
        """
        Verify Razorpay payment signature.
        
        CRITICAL: Always verify before confirming payment.
        
        Args:
            order_id: Razorpay order ID
            payment_id: Razorpay payment ID
            signature: Signature from Razorpay checkout
            
        Returns:
            True if signature is valid
        """
        try:
            # Create signature verification payload
            payload = f"{order_id}|{payment_id}"
            
            # Generate expected signature
            expected_signature = hmac.new(
                self.key_secret.encode(),
                payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            # Compare signatures
            is_valid = hmac.compare_digest(signature, expected_signature)
            
            if is_valid:
                logger.info(f"Payment signature verified for {payment_id}")
            else:
                logger.warning(f"Invalid payment signature for {payment_id}")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"Signature verification failed: {e}")
            return False
    
    def verify_webhook_signature(
        self,
        body: str,
        signature: str
    ) -> bool:
        """
        Verify Razorpay webhook signature.
        
        Args:
            body: Raw request body
            signature: X-Razorpay-Signature header
            
        Returns:
            True if webhook is authentic
        """
        if not self.webhook_secret:
            logger.error("Webhook secret not configured")
            return False
        
        try:
            expected_signature = hmac.new(
                self.webhook_secret.encode(),
                body.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
            
        except Exception as e:
            logger.error(f"Webhook verification failed: {e}")
            return False
    
    async def fetch_payment(self, payment_id: str) -> Dict[str, Any]:
        """Fetch payment details from Razorpay"""
        try:
            payment = self.client.payment.fetch(payment_id)
            return payment
        except Exception as e:
            logger.error(f"Failed to fetch payment {payment_id}: {e}")
            raise
    
    async def create_refund(
        self,
        payment_id: str,
        amount: Optional[int] = None,
        notes: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Create a refund.
        
        Args:
            payment_id: Razorpay payment ID to refund
            amount: Amount to refund (smallest unit). None = full refund
            notes: Refund notes
            
        Returns:
            Refund object
        """
        refund_data = {}
        
        if amount:
            refund_data["amount"] = amount
        if notes:
            refund_data["notes"] = notes
        
        try:
            refund = self.client.payment.refund(payment_id, refund_data)
            
            logger.info(f"Created refund {refund['id']} for payment {payment_id}")
            
            return refund
            
        except Exception as e:
            logger.error(f"Failed to create refund for {payment_id}: {e}")
            raise
