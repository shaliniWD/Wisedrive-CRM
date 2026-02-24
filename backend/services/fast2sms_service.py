"""Fast2SMS Service for OTP SMS delivery"""
import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)


class Fast2SMSService:
    """Service for sending SMS via Fast2SMS DLT API"""
    
    def __init__(self):
        self.api_key = os.environ.get("FAST2SMS_API_KEY")
        self.sender_id = os.environ.get("FAST2SMS_SENDER_ID", "WISEDR")
        self.otp_template_id = os.environ.get("FAST2SMS_OTP_TEMPLATE_ID", "15")
        self.base_url = "https://www.fast2sms.com/dev/bulkV2"
        
        if self.api_key:
            logger.info("Fast2SMS service initialized successfully")
        else:
            logger.warning("Fast2SMS API key not configured - SMS messaging disabled")
    
    def is_configured(self) -> bool:
        """Check if Fast2SMS is properly configured"""
        return self.api_key is not None
    
    async def send_otp_sms(self, to_number: str, otp: str) -> dict:
        """
        Send OTP via Fast2SMS DLT API.
        
        Uses template: "Your OTP is {#VAR#}. OTP is confidential for security reasons.
        Please don't share this OTP with anyone. Team Wisedrive"
        
        Args:
            to_number: Phone number (with or without country code)
            otp: The 6-digit OTP code
            
        Returns:
            dict with success status and details
        """
        if not self.api_key:
            logger.error("Fast2SMS API key not configured")
            return {"success": False, "error": "Fast2SMS not configured"}
        
        try:
            # Clean phone number - remove +91, spaces, etc.
            clean_number = to_number.replace(" ", "").replace("-", "")
            if clean_number.startswith("+91"):
                clean_number = clean_number[3:]
            elif clean_number.startswith("91") and len(clean_number) > 10:
                clean_number = clean_number[2:]
            
            # Ensure we have a 10-digit number
            clean_number = clean_number[-10:]
            
            # Build request parameters
            params = {
                "authorization": self.api_key,
                "route": "dlt",
                "sender_id": self.sender_id,
                "message": self.otp_template_id,
                "variables_values": otp,
                "flash": "0",
                "numbers": clean_number
            }
            
            logger.info(f"Sending OTP SMS to {clean_number[-4:].rjust(10, '*')}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.base_url, params=params)
                result = response.json()
                
                if result.get("return") == True or result.get("status_code") == 200:
                    logger.info(f"OTP SMS sent successfully to {clean_number[-4:].rjust(10, '*')}")
                    return {
                        "success": True,
                        "message_id": result.get("request_id"),
                        "status": "sent"
                    }
                else:
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"Fast2SMS error: {error_msg}")
                    return {"success": False, "error": error_msg}
                    
        except httpx.TimeoutException:
            logger.error("Fast2SMS request timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Failed to send OTP SMS: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_custom_sms(
        self, 
        to_number: str, 
        template_id: str, 
        variables: str
    ) -> dict:
        """
        Send a custom DLT SMS with specific template.
        
        Args:
            to_number: Phone number (with or without country code)
            template_id: The DLT template message ID
            variables: Pipe-separated variables (e.g., "value1|value2|value3")
            
        Returns:
            dict with success status and details
        """
        if not self.api_key:
            return {"success": False, "error": "Fast2SMS not configured"}
        
        try:
            # Clean phone number
            clean_number = to_number.replace(" ", "").replace("-", "")
            if clean_number.startswith("+91"):
                clean_number = clean_number[3:]
            elif clean_number.startswith("91") and len(clean_number) > 10:
                clean_number = clean_number[2:]
            clean_number = clean_number[-10:]
            
            params = {
                "authorization": self.api_key,
                "route": "dlt",
                "sender_id": self.sender_id,
                "message": template_id,
                "variables_values": variables,
                "flash": "0",
                "numbers": clean_number
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.base_url, params=params)
                result = response.json()
                
                if result.get("return") == True or result.get("status_code") == 200:
                    return {
                        "success": True,
                        "message_id": result.get("request_id"),
                        "status": "sent"
                    }
                else:
                    return {"success": False, "error": result.get("message", "Unknown error")}
                    
        except Exception as e:
            logger.error(f"Failed to send SMS: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
fast2sms_service: Optional[Fast2SMSService] = None


def get_fast2sms_service() -> Fast2SMSService:
    """Get or create Fast2SMS service instance"""
    global fast2sms_service
    if fast2sms_service is None:
        fast2sms_service = Fast2SMSService()
    return fast2sms_service
