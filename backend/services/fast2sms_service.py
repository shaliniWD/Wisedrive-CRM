"""Fast2SMS Service for OTP SMS delivery"""
import os
import logging
import httpx
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class Fast2SMSService:
    """Service for sending SMS via Fast2SMS DLT API"""
    
    def __init__(self):
        self.api_key = os.environ.get("FAST2SMS_API_KEY")
        self.sender_id = os.environ.get("FAST2SMS_SENDER_ID", "WISEDR")
        self.otp_template_id = os.environ.get("FAST2SMS_OTP_TEMPLATE_ID", "209919")
        self.otp_validity_minutes = int(os.environ.get("FAST2SMS_OTP_VALIDITY_MINUTES", "30"))
        self.base_url = "https://www.fast2sms.com/dev/bulkV2"
        self.wallet_url = "https://www.fast2sms.com/dev/wallet"
        self.db = None  # Will be set from server.py
        
        if self.api_key:
            logger.info(f"Fast2SMS service initialized (Template: {self.otp_template_id}, Validity: {self.otp_validity_minutes} mins)")
        else:
            logger.warning("Fast2SMS API key not configured - SMS messaging disabled")
    
    def set_db(self, db):
        """Set database reference for logging"""
        self.db = db
    
    def is_configured(self) -> bool:
        """Check if Fast2SMS is properly configured"""
        return self.api_key is not None
    
    async def get_wallet_balance(self) -> dict:
        """Get Fast2SMS wallet balance and SMS count"""
        if not self.api_key:
            return {"success": False, "error": "Fast2SMS not configured"}
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    self.wallet_url,
                    params={"authorization": self.api_key}
                )
                result = response.json()
                
                if result.get("return") == True:
                    return {
                        "success": True,
                        "balance": float(result.get("wallet", 0)),
                        "sms_count": int(result.get("sms_count", 0))
                    }
                else:
                    return {"success": False, "error": result.get("message", "Unknown error")}
                    
        except Exception as e:
            logger.error(f"Failed to get wallet balance: {e}")
            return {"success": False, "error": str(e)}
    
    async def log_sms_request(
        self,
        phone: str,
        template_id: str,
        variables: str,
        request_type: str,
        response_status: int,
        response_data: dict,
        success: bool,
        error_message: Optional[str] = None,
        inspection_id: Optional[str] = None,
        user_id: Optional[str] = None
    ):
        """Log SMS request to database"""
        if self.db is None:
            logger.warning("Database not set for SMS logging")
            return
        
        try:
            log_entry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "phone": phone,
                "phone_masked": f"{'*' * 6}{phone[-4:]}" if len(phone) >= 4 else phone,
                "template_id": template_id,
                "variables": variables,
                "request_type": request_type,
                "sender_id": self.sender_id,
                "response_status": response_status,
                "response_data": response_data,
                "success": success,
                "error_message": error_message,
                "request_id": response_data.get("request_id"),
                "inspection_id": inspection_id,
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc)
            }
            
            await self.db.sms_logs.insert_one(log_entry)
            logger.info(f"SMS log saved: {request_type} to {log_entry['phone_masked']} - {'Success' if success else 'Failed'}")
            
        except Exception as e:
            logger.error(f"Failed to log SMS request: {e}")
    
    async def send_otp_sms(
        self, 
        to_number: str, 
        otp: str,
        inspection_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> dict:
        """
        Send OTP via Fast2SMS DLT API.
        
        Template: "Your Wisedrive OTP to access Mechanic App is {#var#}. Valid for {#var#} minutes. 
        Do not share it with anyone."
        
        Args:
            to_number: Phone number (with or without country code)
            otp: The 6-digit OTP code
            inspection_id: Optional inspection ID for logging
            user_id: Optional user ID for logging
            
        Returns:
            dict with success status and details
        """
        if not self.api_key:
            logger.error("Fast2SMS API key not configured")
            return {"success": False, "error": "Fast2SMS not configured"}
        
        response_status = 0
        response_data = {}
        
        try:
            # Clean phone number - remove +91, spaces, etc.
            clean_number = to_number.replace(" ", "").replace("-", "")
            if clean_number.startswith("+91"):
                clean_number = clean_number[3:]
            elif clean_number.startswith("91") and len(clean_number) > 10:
                clean_number = clean_number[2:]
            
            # Ensure we have a 10-digit number
            clean_number = clean_number[-10:]
            
            # Build variables: OTP|validity_minutes (pipe-separated for template with 2 variables)
            variables = f"{otp}|{self.otp_validity_minutes}"
            
            # Build request parameters
            params = {
                "authorization": self.api_key,
                "route": "dlt",
                "sender_id": self.sender_id,
                "message": self.otp_template_id,
                "variables_values": variables,
                "flash": "0",
                "numbers": clean_number
            }
            
            logger.info(f"Sending OTP SMS to {clean_number[-4:].rjust(10, '*')} (valid for {self.otp_validity_minutes} mins)")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.base_url, params=params)
                response_status = response.status_code
                result = response.json()
                response_data = result
                
                if result.get("return") == True or result.get("status_code") == 200:
                    logger.info(f"OTP SMS sent successfully to {clean_number[-4:].rjust(10, '*')}")
                    
                    # Log successful request
                    await self.log_sms_request(
                        phone=to_number,
                        template_id=self.otp_template_id,
                        variables=variables,
                        request_type="OTP",
                        response_status=response_status,
                        response_data=result,
                        success=True,
                        inspection_id=inspection_id,
                        user_id=user_id
                    )
                    
                    return {
                        "success": True,
                        "message_id": result.get("request_id"),
                        "status": "sent"
                    }
                else:
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"Fast2SMS error: {error_msg}")
                    
                    # Log failed request
                    await self.log_sms_request(
                        phone=to_number,
                        template_id=self.otp_template_id,
                        variables=otp,
                        request_type="OTP",
                        response_status=response_status,
                        response_data=result,
                        success=False,
                        error_message=error_msg,
                        inspection_id=inspection_id,
                        user_id=user_id
                    )
                    
                    return {"success": False, "error": error_msg}
                    
        except httpx.TimeoutException:
            error_msg = "Request timed out"
            logger.error(f"Fast2SMS request timed out")
            
            await self.log_sms_request(
                phone=to_number,
                template_id=self.otp_template_id,
                variables=otp,
                request_type="OTP",
                response_status=0,
                response_data={"error": "timeout"},
                success=False,
                error_message=error_msg,
                inspection_id=inspection_id,
                user_id=user_id
            )
            
            return {"success": False, "error": error_msg}
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send OTP SMS: {e}")
            
            await self.log_sms_request(
                phone=to_number,
                template_id=self.otp_template_id,
                variables=otp,
                request_type="OTP",
                response_status=response_status,
                response_data=response_data,
                success=False,
                error_message=error_msg,
                inspection_id=inspection_id,
                user_id=user_id
            )
            
            return {"success": False, "error": error_msg}
    
    async def send_custom_sms(
        self, 
        to_number: str, 
        template_id: str, 
        variables: str,
        request_type: str = "CUSTOM",
        inspection_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> dict:
        """
        Send a custom DLT SMS with specific template.
        
        Args:
            to_number: Phone number (with or without country code)
            template_id: The DLT template message ID
            variables: Pipe-separated variables (e.g., "value1|value2|value3")
            request_type: Type of SMS for logging
            inspection_id: Optional inspection ID for logging
            user_id: Optional user ID for logging
            
        Returns:
            dict with success status and details
        """
        if not self.api_key:
            return {"success": False, "error": "Fast2SMS not configured"}
        
        response_status = 0
        response_data = {}
        
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
                response_status = response.status_code
                result = response.json()
                response_data = result
                
                success = result.get("return") == True or result.get("status_code") == 200
                error_msg = None if success else result.get("message", "Unknown error")
                
                # Log request
                await self.log_sms_request(
                    phone=to_number,
                    template_id=template_id,
                    variables=variables,
                    request_type=request_type,
                    response_status=response_status,
                    response_data=result,
                    success=success,
                    error_message=error_msg,
                    inspection_id=inspection_id,
                    user_id=user_id
                )
                
                if success:
                    return {
                        "success": True,
                        "message_id": result.get("request_id"),
                        "status": "sent"
                    }
                else:
                    return {"success": False, "error": error_msg}
                    
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send SMS: {e}")
            
            await self.log_sms_request(
                phone=to_number,
                template_id=template_id,
                variables=variables,
                request_type=request_type,
                response_status=response_status,
                response_data=response_data,
                success=False,
                error_message=error_msg,
                inspection_id=inspection_id,
                user_id=user_id
            )
            
            return {"success": False, "error": error_msg}


# Singleton instance
fast2sms_service: Optional[Fast2SMSService] = None


def get_fast2sms_service() -> Fast2SMSService:
    """Get or create Fast2SMS service instance"""
    global fast2sms_service
    if fast2sms_service is None:
        fast2sms_service = Fast2SMSService()
    return fast2sms_service
