"""Twilio WhatsApp Service for Lead Management"""
import os
import logging
from twilio.rest import Client
from twilio.request_validator import RequestValidator
from typing import Optional

logger = logging.getLogger(__name__)


class TwilioService:
    """Service for sending and receiving WhatsApp messages via Twilio"""
    
    def __init__(self):
        self.account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        self.auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
        self.whatsapp_number = os.environ.get("TWILIO_WHATSAPP_NUMBER", "+14155238886")
        self.client = None
        self.validator = None
        
        if self.account_sid and self.auth_token:
            try:
                self.client = Client(self.account_sid, self.auth_token)
                self.validator = RequestValidator(self.auth_token)
                logger.info("Twilio WhatsApp service initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {e}")
        else:
            logger.warning("Twilio credentials not configured - WhatsApp messaging disabled")
    
    def is_configured(self) -> bool:
        """Check if Twilio is properly configured"""
        return self.client is not None
    
    def validate_webhook(self, url: str, params: dict, signature: str) -> bool:
        """Validate incoming webhook request from Twilio"""
        if not self.validator:
            return False
        return self.validator.validate(url, params, signature)
    
    async def send_whatsapp_message(
        self,
        to_number: str,
        message: str,
        media_url: Optional[str] = None
    ) -> dict:
        """
        Send a WhatsApp message to a phone number.
        
        Args:
            to_number: Phone number in E.164 format (e.g., +919876543210)
            message: Message text to send
            media_url: Optional URL of media to attach
            
        Returns:
            dict with message_sid and status
        """
        if not self.client:
            logger.error("Twilio client not initialized")
            return {"success": False, "error": "Twilio not configured"}
        
        try:
            # Format numbers for WhatsApp
            from_whatsapp = f"whatsapp:{self.whatsapp_number}"
            to_whatsapp = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
            
            # Send message
            if media_url:
                msg = self.client.messages.create(
                    body=message,
                    from_=from_whatsapp,
                    to=to_whatsapp,
                    media_url=[media_url]
                )
            else:
                msg = self.client.messages.create(
                    body=message,
                    from_=from_whatsapp,
                    to=to_whatsapp
                )
            
            logger.info(f"WhatsApp message sent to {to_number}, SID: {msg.sid}")
            return {
                "success": True,
                "message_sid": msg.sid,
                "status": msg.status
            }
            
        except Exception as e:
            logger.error(f"Failed to send WhatsApp message to {to_number}: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_payment_link(
        self,
        to_number: str,
        customer_name: str,
        amount: float,
        payment_link: str,
        package_name: str
    ) -> dict:
        """Send payment link via WhatsApp"""
        message = f"""Hi {customer_name}! 👋

Thank you for choosing WiseDrive! 🚗

Your inspection package: *{package_name}*
Amount: *₹{amount:,.2f}*

Click here to pay securely: {payment_link}

Payment link is valid for 24 hours.

For any queries, please reply to this message.

Thank you! 🙏
Team WiseDrive"""
        
        return await self.send_whatsapp_message(to_number, message)
    
    async def send_payment_confirmation(
        self,
        to_number: str,
        customer_name: str,
        amount: float,
        package_name: str,
        payment_id: str
    ) -> dict:
        """Send payment confirmation via WhatsApp"""
        message = f"""Hi {customer_name}! 🎉

Your payment of *₹{amount:,.2f}* has been received successfully!

Package: *{package_name}*
Payment ID: {payment_id}

Our team will contact you shortly to schedule your vehicle inspection.

Thank you for choosing WiseDrive! 🚗

Team WiseDrive"""
        
        return await self.send_whatsapp_message(to_number, message)
    
    async def send_message(self, to_number: str, message: str) -> dict:
        """
        Simple wrapper to send a WhatsApp message.
        Used by chatbot service.
        """
        return await self.send_whatsapp_message(to_number, message)


# Singleton instance
twilio_service: Optional[TwilioService] = None


def get_twilio_service() -> TwilioService:
    """Get or create Twilio service instance"""
    global twilio_service
    if twilio_service is None:
        twilio_service = TwilioService()
    return twilio_service
