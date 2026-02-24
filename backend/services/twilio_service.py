"""Twilio WhatsApp Service for Lead Management"""
import os
import logging
import json
from twilio.rest import Client
from twilio.request_validator import RequestValidator
from typing import Optional, List, Dict

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
    
    async def send_interactive_buttons(
        self,
        to_number: str,
        body_text: str,
        buttons: List[Dict[str, str]],
        header_text: Optional[str] = None,
        footer_text: Optional[str] = None
    ) -> dict:
        """
        Send an interactive button message via WhatsApp.
        Supports up to 3 buttons.
        
        Args:
            to_number: Phone number in E.164 format
            body_text: Main message body
            buttons: List of button dicts with 'id' and 'title' keys (max 3)
            header_text: Optional header text
            footer_text: Optional footer text
            
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
            
            # Build interactive message structure
            # WhatsApp Interactive Button format via Twilio Content API
            interactive_content = {
                "type": "button",
                "body": {
                    "text": body_text
                },
                "action": {
                    "buttons": [
                        {
                            "type": "reply",
                            "reply": {
                                "id": btn.get("id", f"btn_{i}"),
                                "title": btn.get("title", f"Option {i+1}")[:20]  # Max 20 chars
                            }
                        }
                        for i, btn in enumerate(buttons[:3])  # Max 3 buttons
                    ]
                }
            }
            
            if header_text:
                interactive_content["header"] = {
                    "type": "text",
                    "text": header_text
                }
            
            if footer_text:
                interactive_content["footer"] = {
                    "text": footer_text
                }
            
            # Send using Twilio's content_sid for templates or ContentType for interactive
            # For sandbox/testing, we use the MessagingServiceSid approach
            msg = self.client.messages.create(
                from_=from_whatsapp,
                to=to_whatsapp,
                content_sid=None,  # Will be set when using templates
                body=None,
                persistent_action=[
                    json.dumps({
                        "type": "interactive",
                        "interactive": interactive_content
                    })
                ]
            )
            
            logger.info(f"Interactive WhatsApp message sent to {to_number}, SID: {msg.sid}")
            return {
                "success": True,
                "message_sid": msg.sid,
                "status": msg.status
            }
            
        except Exception as e:
            error_str = str(e)
            logger.warning(f"Interactive message failed, falling back to text: {e}")
            
            # Fallback to regular text message with button instructions
            fallback_message = body_text
            if header_text:
                fallback_message = f"*{header_text}*\n\n{fallback_message}"
            
            fallback_message += "\n\n"
            for i, btn in enumerate(buttons[:3]):
                fallback_message += f"*Reply {btn.get('id', i+1)}* - {btn.get('title', f'Option {i+1}')}\n"
            
            if footer_text:
                fallback_message += f"\n_{footer_text}_"
            
            return await self.send_whatsapp_message(to_number, fallback_message)
    
    async def send_interactive_list(
        self,
        to_number: str,
        body_text: str,
        button_text: str,
        sections: List[Dict],
        header_text: Optional[str] = None,
        footer_text: Optional[str] = None
    ) -> dict:
        """
        Send an interactive list message via WhatsApp.
        Supports up to 10 items in list.
        
        Args:
            to_number: Phone number in E.164 format
            body_text: Main message body
            button_text: Text on the list button (max 20 chars)
            sections: List of section dicts with 'title' and 'rows' (list items)
            header_text: Optional header text
            footer_text: Optional footer text
        """
        if not self.client:
            return {"success": False, "error": "Twilio not configured"}
        
        try:
            from_whatsapp = f"whatsapp:{self.whatsapp_number}"
            to_whatsapp = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
            
            # For now, fall back to text message with list format
            # Interactive lists require WhatsApp Business API with templates
            fallback_message = body_text
            if header_text:
                fallback_message = f"*{header_text}*\n\n{fallback_message}"
            
            fallback_message += f"\n\n📋 *{button_text}*\n"
            
            for section in sections:
                if section.get("title"):
                    fallback_message += f"\n*{section['title']}*\n"
                for row in section.get("rows", []):
                    row_id = row.get("id", "")
                    row_title = row.get("title", "")
                    row_desc = row.get("description", "")
                    fallback_message += f"  • *{row_id}* - {row_title}"
                    if row_desc:
                        fallback_message += f"\n    {row_desc}"
                    fallback_message += "\n"
            
            if footer_text:
                fallback_message += f"\n_{footer_text}_"
            
            return await self.send_whatsapp_message(to_number, fallback_message)
            
        except Exception as e:
            logger.error(f"Failed to send interactive list: {e}")
            return {"success": False, "error": str(e)}
    
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
    
    async def send_sms(self, to_number: str, message: str) -> dict:
        """
        Send an SMS message to a phone number.
        Used for OTP verification.
        
        Args:
            to_number: Phone number in E.164 format (e.g., +919876543210)
            message: Message text to send
            
        Returns:
            dict with message_sid and status
        """
        if not self.client:
            logger.error("Twilio client not initialized")
            return {"success": False, "error": "Twilio not configured"}
        
        try:
            # Format number for SMS
            to_formatted = to_number if to_number.startswith("+") else f"+{to_number}"
            
            # Get the SMS-capable number from env or use default
            from_number = os.environ.get("TWILIO_SMS_NUMBER", os.environ.get("TWILIO_WHATSAPP_NUMBER", "+14155238886"))
            
            msg = self.client.messages.create(
                body=message,
                from_=from_number,
                to=to_formatted
            )
            
            logger.info(f"SMS sent to {to_number}, SID: {msg.sid}")
            return {
                "success": True,
                "message_sid": msg.sid,
                "status": msg.status
            }
            
        except Exception as e:
            logger.error(f"Failed to send SMS to {to_number}: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_otp_sms(self, to_number: str, otp: str) -> dict:
        """
        Send OTP via SMS for mechanic app login.
        
        Args:
            to_number: Phone number in E.164 format
            otp: The 6-digit OTP code
            
        Returns:
            dict with message_sid and status
        """
        message = f"Your WiseDrive verification code is: {otp}\n\nThis code expires in 10 minutes. Do not share this code with anyone."
        return await self.send_sms(to_number, message)


# Singleton instance
twilio_service: Optional[TwilioService] = None


def get_twilio_service() -> TwilioService:
    """Get or create Twilio service instance"""
    global twilio_service
    if twilio_service is None:
        twilio_service = TwilioService()
    return twilio_service
