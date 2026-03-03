"""
Surepass API Integration Service
Provides credit report fetching from CIBIL, Equifax, Experian, and CRIF
"""

import os
import httpx
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class SurepassService:
    """Service for interacting with Surepass KYC APIs"""
    
    # Use sandbox URL for development, change to production when ready
    # Production: https://kyc-api.surepass.io/api/v1
    # Sandbox: https://sandbox.surepass.io/api/v1
    BASE_URL = os.environ.get("SUREPASS_BASE_URL", "https://sandbox.surepass.io/api/v1")
    
    # Credit report endpoints
    ENDPOINTS = {
        "cibil_json": "/credit-report-cibil/fetch-report",
        "cibil_pdf": "/credit-report-cibil/fetch-report-pdf",
        "equifax_json": "/credit-report-v2/fetch-report",
        "equifax_pdf": "/credit-report-v2/fetch-pdf-report",
        "experian_json": "/credit-report-experian/fetch-report",
        "experian_pdf": "/credit-report-experian/fetch-report-pdf",
        "crif_json": "/credit-report-crif/fetch-report",
        "crif_pdf": "/credit-report-crif/fetch-report-pdf",
    }
    
    def __init__(self):
        self.api_token = os.environ.get("SUREPASS_API_TOKEN")
        if not self.api_token:
            logger.warning("SUREPASS_API_TOKEN not configured")
    
    def is_configured(self) -> bool:
        """Check if the service is properly configured"""
        return bool(self.api_token)
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authorization"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_token}"
        }
    
    async def fetch_cibil_report(
        self,
        mobile: str,
        pan: str,
        name: str,
        gender: str = "male",
        consent: str = "Y"
    ) -> Dict[str, Any]:
        """
        Fetch CIBIL credit report (JSON format)
        
        Args:
            mobile: Customer mobile number (10 digits)
            pan: Customer PAN number
            name: Customer full name
            gender: 'male' or 'female'
            consent: 'Y' for consent given
            
        Returns:
            Dict with credit score, report data, and status
        """
        if not self.is_configured():
            return {
                "success": False,
                "error": "Surepass API not configured",
                "error_code": "NOT_CONFIGURED"
            }
        
        # Normalize mobile - remove +91 or 91 prefix
        mobile_clean = mobile.replace("+91", "").replace(" ", "").replace("-", "")
        if mobile_clean.startswith("91") and len(mobile_clean) == 12:
            mobile_clean = mobile_clean[2:]
        
        payload = {
            "mobile": mobile_clean,
            "pan": pan.upper().strip(),
            "name": name.strip(),
            "gender": gender.lower(),
            "consent": consent
        }
        
        logger.info(f"Fetching CIBIL report for PAN: {pan[:4]}****{pan[-1]}")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}{self.ENDPOINTS['cibil_json']}",
                    headers=self._get_headers(),
                    json=payload
                )
                
                result = response.json()
                
                if response.status_code == 200 and result.get("success"):
                    data = result.get("data", {})
                    return {
                        "success": True,
                        "provider": "CIBIL",
                        "client_id": data.get("client_id"),
                        "credit_score": data.get("credit_score"),
                        "credit_report": data.get("credit_report", []),
                        "raw_response": result,
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    logger.error(f"CIBIL API error: {result.get('message')}")
                    return {
                        "success": False,
                        "error": result.get("message", "Failed to fetch credit report"),
                        "error_code": result.get("message_code", "UNKNOWN"),
                        "status_code": response.status_code
                    }
                    
        except httpx.TimeoutException:
            logger.error("CIBIL API timeout")
            return {
                "success": False,
                "error": "Request timed out. Please try again.",
                "error_code": "TIMEOUT"
            }
        except Exception as e:
            logger.error(f"CIBIL API exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "error_code": "EXCEPTION"
            }
    
    async def fetch_cibil_pdf(
        self,
        mobile: str,
        pan: str,
        name: str,
        gender: str = "male",
        consent: str = "Y"
    ) -> Dict[str, Any]:
        """
        Fetch CIBIL credit report (PDF format)
        
        Returns:
            Dict with credit score and PDF download link
        """
        if not self.is_configured():
            return {
                "success": False,
                "error": "Surepass API not configured",
                "error_code": "NOT_CONFIGURED"
            }
        
        # Normalize mobile
        mobile_clean = mobile.replace("+91", "").replace(" ", "").replace("-", "")
        if mobile_clean.startswith("91") and len(mobile_clean) == 12:
            mobile_clean = mobile_clean[2:]
        
        payload = {
            "mobile": mobile_clean,
            "pan": pan.upper().strip(),
            "name": name.strip(),
            "gender": gender.lower(),
            "consent": consent
        }
        
        logger.info(f"Fetching CIBIL PDF report for PAN: {pan[:4]}****{pan[-1]}")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}{self.ENDPOINTS['cibil_pdf']}",
                    headers=self._get_headers(),
                    json=payload
                )
                
                result = response.json()
                
                if response.status_code == 200 and result.get("success"):
                    data = result.get("data", {})
                    return {
                        "success": True,
                        "provider": "CIBIL",
                        "client_id": data.get("client_id"),
                        "credit_score": data.get("credit_score"),
                        "pdf_link": data.get("credit_report_link"),
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    logger.error(f"CIBIL PDF API error: {result.get('message')}")
                    return {
                        "success": False,
                        "error": result.get("message", "Failed to fetch PDF report"),
                        "error_code": result.get("message_code", "UNKNOWN"),
                        "status_code": response.status_code
                    }
                    
        except httpx.TimeoutException:
            logger.error("CIBIL PDF API timeout")
            return {
                "success": False,
                "error": "Request timed out. Please try again.",
                "error_code": "TIMEOUT"
            }
        except Exception as e:
            logger.error(f"CIBIL PDF API exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "error_code": "EXCEPTION"
            }
    
    def parse_credit_report(self, credit_report: list) -> Dict[str, Any]:
        """
        Parse CIBIL credit report into a structured format for UI display
        
        Args:
            credit_report: Raw credit report array from API
            
        Returns:
            Structured dict with parsed data
        """
        if not credit_report or len(credit_report) == 0:
            return {}
        
        report = credit_report[0]
        
        # Parse personal info
        names = report.get("names", [])
        personal_info = {}
        if names:
            personal_info = {
                "name": names[0].get("name"),
                "birth_date": names[0].get("birthDate"),
                "gender": "Male" if names[0].get("gender") == "2" else "Female"
            }
        
        # Parse IDs
        ids = report.get("ids", [])
        id_info = []
        id_type_map = {"01": "PAN", "02": "Passport", "03": "Voter ID", "04": "UID/Aadhaar", "09": "Unknown"}
        for id_item in ids:
            id_info.append({
                "type": id_type_map.get(id_item.get("idType"), id_item.get("idType")),
                "number": id_item.get("idNumber")
            })
        
        # Parse phones
        phones = report.get("telephones", [])
        phone_type_map = {"00": "Unknown", "01": "Home", "02": "Office", "03": "Mobile"}
        phone_info = []
        for phone in phones:
            phone_info.append({
                "number": phone.get("telephoneNumber"),
                "type": phone_type_map.get(phone.get("telephoneType"), phone.get("telephoneType"))
            })
        
        # Parse addresses
        addresses = report.get("addresses", [])
        address_category_map = {"01": "Residence", "02": "Office", "03": "Permanent", "04": "Other"}
        address_info = []
        for addr in addresses:
            address_info.append({
                "line1": addr.get("line1"),
                "line2": addr.get("line2"),
                "pin_code": addr.get("pinCode"),
                "category": address_category_map.get(addr.get("addressCategory"), addr.get("addressCategory")),
                "date_reported": addr.get("dateReported")
            })
        
        # Parse credit score
        scores = report.get("scores", [])
        score_info = {}
        if scores:
            score = scores[0]
            score_info = {
                "score": int(score.get("score", "0").lstrip("0") or "0"),
                "score_name": score.get("scoreName"),
                "score_date": score.get("scoreDate"),
                "reason_codes": score.get("reasonCodes", [])
            }
        
        # Parse accounts (credit history)
        accounts = report.get("accounts", [])
        account_type_map = {
            "01": "Auto Loan", "02": "Housing Loan", "03": "Property Loan",
            "04": "Loan Against Shares", "05": "Personal Loan", "06": "Consumer Loan",
            "07": "Gold Loan", "08": "Education Loan", "09": "Loan to Professional",
            "10": "Credit Card", "11": "Leasing", "12": "Overdraft",
            "13": "Two-Wheeler Loan", "16": "Business Loan - Secured",
            "17": "Business Loan - Unsecured", "18": "Telco Wireless",
            "31": "Kisan Credit Card", "32": "Loan On Credit Card",
            "33": "Prime Minister Jaan Dhan Yojana", "34": "Mudra Shishu",
            "35": "Mudra Kishor", "36": "Mudra Tarun", "41": "Corporate Credit Card",
            "42": "Business Loan - Priority Sector - SHG", "43": "Business Loan - Priority Sector - Others",
            "51": "Used Car Loan", "52": "Commercial Vehicle Loan", "53": "Tractors",
            "59": "Microfinance - Others", "61": "Microfinance - SHG", "69": "Other"
        }
        
        account_info = []
        for acc in accounts:
            account_info.append({
                "type": account_type_map.get(acc.get("accountType"), f"Type {acc.get('accountType')}"),
                "member": acc.get("memberShortName"),
                "date_opened": acc.get("dateOpened"),
                "date_reported": acc.get("dateReported"),
                "high_credit": acc.get("highCreditAmount", 0),
                "current_balance": acc.get("currentBalance", 0),
                "amount_overdue": acc.get("amountOverdue", 0),
                "payment_history": acc.get("paymentHistory"),
                "last_payment_date": acc.get("lastPaymentDate"),
                "credit_status": acc.get("creditFacilityStatus"),
                "written_off_amount": acc.get("woAmountTotal", 0)
            })
        
        # Parse enquiries
        enquiries = report.get("enquiries", [])
        enquiry_purpose_map = {
            "00": "Others", "01": "Auto Loan", "02": "Housing Loan", "03": "Property Loan",
            "04": "Loan Against Shares", "05": "Personal Loan", "06": "Consumer Loan",
            "07": "Gold Loan", "08": "Education Loan", "09": "Loan to Professional",
            "10": "Credit Card", "11": "Leasing", "12": "Overdraft"
        }
        
        enquiry_info = []
        for enq in enquiries:
            enquiry_info.append({
                "date": enq.get("enquiryDate"),
                "member": enq.get("memberShortName"),
                "purpose": enquiry_purpose_map.get(enq.get("enquiryPurpose"), enq.get("enquiryPurpose")),
                "amount": enq.get("enquiryAmount", 0)
            })
        
        # Calculate summary stats
        total_accounts = len(account_info)
        active_accounts = len([a for a in account_info if a.get("current_balance", 0) > 0])
        total_balance = sum(a.get("current_balance", 0) for a in account_info)
        total_overdue = sum(a.get("amount_overdue", 0) for a in account_info)
        enquiries_last_6_months = len([e for e in enquiry_info if e.get("date")])  # Simplified
        
        return {
            "personal_info": personal_info,
            "id_info": id_info,
            "phone_info": phone_info,
            "address_info": address_info,
            "score_info": score_info,
            "accounts": account_info,
            "enquiries": enquiry_info,
            "summary": {
                "total_accounts": total_accounts,
                "active_accounts": active_accounts,
                "total_balance": total_balance,
                "total_overdue": total_overdue,
                "total_enquiries": len(enquiry_info)
            }
        }


# Singleton instance
_surepass_service = None

def get_surepass_service() -> SurepassService:
    """Get or create the Surepass service singleton"""
    global _surepass_service
    if _surepass_service is None:
        _surepass_service = SurepassService()
    return _surepass_service
