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
    
    async def fetch_equifax_report(
        self,
        name: str,
        id_number: str,
        id_type: str = "aadhaar",
        mobile: str = "",
        consent: str = "Y"
    ) -> Dict[str, Any]:
        """
        Fetch Equifax credit report (JSON format)
        
        Args:
            name: Customer full name
            id_number: ID number (Aadhaar, PAN, etc.)
            id_type: Type of ID - 'aadhaar', 'pan', 'voter', 'passport', 'driving_license'
            mobile: Customer mobile number
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
        
        # Normalize mobile
        mobile_clean = ""
        if mobile:
            mobile_clean = mobile.replace("+91", "").replace(" ", "").replace("-", "")
            if mobile_clean.startswith("91") and len(mobile_clean) == 12:
                mobile_clean = mobile_clean[2:]
        
        payload = {
            "name": name.strip(),
            "id_number": id_number.strip(),
            "id_type": id_type.lower(),
            "mobile": mobile_clean,
            "consent": consent
        }
        
        logger.info(f"Fetching Equifax report for {id_type}: {id_number[:4]}****")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}{self.ENDPOINTS['equifax_json']}",
                    headers=self._get_headers(),
                    json=payload
                )
                
                result = response.json()
                
                if response.status_code == 200 and result.get("success"):
                    data = result.get("data", {})
                    return {
                        "success": True,
                        "provider": "Equifax",
                        "client_id": data.get("client_id"),
                        "credit_score": data.get("credit_score"),
                        "credit_report": data.get("credit_report", {}),
                        "raw_response": result,
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    logger.error(f"Equifax API error: {result.get('message')}")
                    return {
                        "success": False,
                        "error": result.get("message", "Failed to fetch credit report"),
                        "error_code": result.get("message_code", "UNKNOWN"),
                        "status_code": response.status_code
                    }
                    
        except httpx.TimeoutException:
            logger.error("Equifax API timeout")
            return {
                "success": False,
                "error": "Request timed out. Please try again.",
                "error_code": "TIMEOUT"
            }
        except Exception as e:
            logger.error(f"Equifax API exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "error_code": "EXCEPTION"
            }
    
    async def fetch_equifax_pdf(
        self,
        name: str,
        id_number: str,
        id_type: str = "aadhaar",
        mobile: str = "",
        consent: str = "Y"
    ) -> Dict[str, Any]:
        """
        Fetch Equifax credit report (PDF format)
        
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
        mobile_clean = ""
        if mobile:
            mobile_clean = mobile.replace("+91", "").replace(" ", "").replace("-", "")
            if mobile_clean.startswith("91") and len(mobile_clean) == 12:
                mobile_clean = mobile_clean[2:]
        
        payload = {
            "name": name.strip(),
            "id_number": id_number.strip(),
            "id_type": id_type.lower(),
            "mobile": mobile_clean,
            "consent": consent
        }
        
        logger.info(f"Fetching Equifax PDF report for {id_type}: {id_number[:4]}****")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}{self.ENDPOINTS['equifax_pdf']}",
                    headers=self._get_headers(),
                    json=payload
                )
                
                result = response.json()
                
                if response.status_code == 200 and result.get("success"):
                    data = result.get("data", {})
                    return {
                        "success": True,
                        "provider": "Equifax",
                        "client_id": data.get("client_id"),
                        "credit_score": data.get("credit_score"),
                        "pdf_link": data.get("credit_report_link"),
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    logger.error(f"Equifax PDF API error: {result.get('message')}")
                    return {
                        "success": False,
                        "error": result.get("message", "Failed to fetch PDF report"),
                        "error_code": result.get("message_code", "UNKNOWN"),
                        "status_code": response.status_code
                    }
                    
        except httpx.TimeoutException:
            logger.error("Equifax PDF API timeout")
            return {
                "success": False,
                "error": "Request timed out. Please try again.",
                "error_code": "TIMEOUT"
            }
        except Exception as e:
            logger.error(f"Equifax PDF API exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "error_code": "EXCEPTION"
            }
    
    def parse_equifax_report(self, credit_report: dict) -> Dict[str, Any]:
        """
        Parse Equifax credit report into a structured format for UI display
        
        Args:
            credit_report: Raw credit report dict from API
            
        Returns:
            Structured dict with parsed data
        """
        if not credit_report:
            logger.warning("Empty credit report received for parsing")
            return {}
        
        logger.info(f"Parsing Equifax report. Top-level keys: {list(credit_report.keys())}")
        
        parsed = {
            "personal_info": {},
            "id_info": [],
            "phone_info": [],
            "address_info": [],
            "email_info": [],
            "score_info": {},
            "SCORE": {},  # Equifax score format for frontend compatibility
            "accounts": [],
            "CAIS_Account": {},  # Equifax accounts format for frontend compatibility
            "enquiries": [],
            "CAPS": {},  # Equifax enquiries format for frontend compatibility
            "summary": {},
            "CreditProfileHeader": {}  # Report metadata
        }
        
        try:
            # Get CCR Response data
            ccr_response = credit_report.get("CCRResponse", {})
            logger.info(f"CCRResponse keys: {list(ccr_response.keys()) if ccr_response else 'None'}")
            
            cir_report_list = ccr_response.get("CIRReportDataLst", [])
            logger.info(f"CIRReportDataLst count: {len(cir_report_list)}")
            
            # Extract Score from root level or CCRResponse
            scores = credit_report.get("Score", []) or ccr_response.get("Score", [])
            if not scores:
                # Try alternate score locations
                inquiry_header = ccr_response.get("InquiryResponseHeader", {})
                if inquiry_header.get("Score"):
                    scores = [inquiry_header.get("Score")]
            
            logger.info(f"Scores found: {scores}")
            
            if scores and len(scores) > 0:
                first_score = scores[0] if isinstance(scores, list) else scores
                score_value = first_score.get("Value") if isinstance(first_score, dict) else first_score
                parsed["SCORE"] = {
                    "FCIREXScore": score_value,
                    "BureauScore": score_value,
                    "FCIREXScoreConfidLevel": first_score.get("Confidence", "") if isinstance(first_score, dict) else "",
                    "Type": first_score.get("Type") if isinstance(first_score, dict) else "",
                    "Version": first_score.get("Version") if isinstance(first_score, dict) else ""
                }
                parsed["score_info"] = {
                    "score": score_value,
                    "score_name": first_score.get("Type") if isinstance(first_score, dict) else "",
                    "score_version": first_score.get("Version") if isinstance(first_score, dict) else "",
                    "confidence": first_score.get("Confidence") if isinstance(first_score, dict) else ""
                }
            
            # Process CIRReportDataLst if available
            if cir_report_list:
                first_report = cir_report_list[0]
                cir_data = first_report.get("CIRReportData", {})
                logger.info(f"CIRReportData keys: {list(cir_data.keys()) if cir_data else 'None'}")
                
                id_contact_info = cir_data.get("IDAndContactInfo", {})
                
                # Extract score from ScoreDetails (inside CIRReportData)
                score_details = cir_data.get("ScoreDetails", [])
                if score_details:
                    logger.info(f"ScoreDetails found: {score_details}")
                    for sd in score_details:
                        score_value = sd.get("Value") or sd.get("Score") or sd.get("ScoreValue")
                        if score_value:
                            parsed["SCORE"] = {
                                "FCIREXScore": score_value,
                                "BureauScore": score_value,
                                "FCIREXScoreConfidLevel": sd.get("Confidence", sd.get("ConfidenceLevel", "")),
                                "Type": sd.get("Type", sd.get("ScoreType", "")),
                                "Version": sd.get("Version", "")
                            }
                            parsed["score_info"] = {
                                "score": score_value,
                                "score_name": sd.get("Type", sd.get("ScoreType", "")),
                                "score_version": sd.get("Version", ""),
                                "confidence": sd.get("Confidence", sd.get("ConfidenceLevel", ""))
                            }
                            logger.info(f"Score extracted from ScoreDetails: {score_value}")
                            break
                
                # Report Header
                profile_header = cir_data.get("ProfileHeader", {})
                if profile_header:
                    parsed["CreditProfileHeader"] = {
                        "ReportDate": profile_header.get("ReportDate"),
                        "ReportNumber": profile_header.get("ReportNumber"),
                        "Subscriber": profile_header.get("Subscriber"),
                        "Version": profile_header.get("Version"),
                        "ReportType": profile_header.get("ReportType")
                    }
                
                # Personal Info
                personal_info = id_contact_info.get("PersonalInfo", {})
                name_info = personal_info.get("Name", {})
                parsed["personal_info"] = {
                    "name": name_info.get("FullName"),
                    "first_name": name_info.get("FirstName"),
                    "last_name": name_info.get("LastName"),
                    "birth_date": personal_info.get("DateOfBirth"),
                    "gender": personal_info.get("Gender"),
                    "age": personal_info.get("Age", {}).get("Age") if isinstance(personal_info.get("Age"), dict) else personal_info.get("Age")
                }
                
                # Identity Info
                identity_info = id_contact_info.get("IdentityInfo", {})
                for id_type, id_list in [
                    ("PAN", identity_info.get("PANId", [])),
                    ("Passport", identity_info.get("Passport", [])),
                    ("Voter ID", identity_info.get("VoterID", [])),
                    ("Driving License", identity_info.get("DriverLicence", [])),
                    ("UID", identity_info.get("UID", []))
                ]:
                    if isinstance(id_list, list):
                        for doc in id_list:
                            parsed["id_info"].append({
                                "type": id_type,
                                "number": doc.get("IdNumber"),
                                "reported_date": doc.get("ReportedDate")
                            })
                
                # Address Info
                address_info = id_contact_info.get("AddressInfo", [])
                if isinstance(address_info, list):
                    for addr in address_info:
                        parsed["address_info"].append({
                            "address": addr.get("Address"),
                            "state": addr.get("State"),
                            "postal": addr.get("Postal"),
                            "type": addr.get("Type"),
                            "reported_date": addr.get("ReportedDate")
                        })
                
                # Phone Info
                phone_info = id_contact_info.get("PhoneInfo", [])
                phone_type_map = {"H": "Home", "M": "Mobile", "O": "Office"}
                if isinstance(phone_info, list):
                    for phone in phone_info:
                        parsed["phone_info"].append({
                            "number": phone.get("Number"),
                            "type": phone_type_map.get(phone.get("typeCode"), phone.get("typeCode")),
                            "reported_date": phone.get("ReportedDate")
                        })
                
                # Email Info
                email_info = id_contact_info.get("EmailAddressInfo", [])
                if isinstance(email_info, list):
                    for email in email_info:
                        parsed["email_info"].append({
                            "email": email.get("Email"),
                            "reported_date": email.get("ReportedDate")
                        })
                
                # Account Information - Try multiple possible locations
                retail_accounts = (
                    cir_data.get("RetailAccountDetails", []) or 
                    cir_data.get("Accounts", []) or 
                    cir_data.get("AccountDetails", []) or 
                    cir_data.get("TradeLines", []) or
                    credit_report.get("Accounts", []) or
                    credit_report.get("RetailAccountDetails", [])
                )
                
                logger.info(f"RetailAccountDetails count: {len(retail_accounts) if retail_accounts else 0}")
                
                if not retail_accounts:
                    # Log all keys in cir_data to find accounts
                    for key in cir_data.keys():
                        val = cir_data.get(key)
                        if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
                            logger.info(f"Potential accounts list in '{key}': {len(val)} items, keys: {list(val[0].keys())[:10]}")
                
                account_details_list = []
                total_outstanding = 0
                total_overdue = 0
                active_count = 0
                closed_count = 0
                secured_balance = 0
                unsecured_balance = 0
                written_off_count = 0
                negative_accounts_count = 0
                dpd_over_90_count = 0
                suit_filed_count = 0
                settled_count = 0
                total_written_off_amount = 0
                
                if isinstance(retail_accounts, list):
                    for idx, acc in enumerate(retail_accounts):
                        # Log first account structure for debugging
                        if idx == 0:
                            logger.info(f"First account keys: {list(acc.keys())}")
                            # Log potential payment history fields
                            for key in ['PaymentHistory', 'Payment_History', 'PaymentHistoryProfile', 'History48Months', 
                                       'PaymentHistoryList', 'AccountHistory', 'CAISAccountHistoryList', 'HistoryDetails']:
                                if acc.get(key):
                                    logger.info(f"Payment history found in '{key}': {str(acc.get(key))[:200]}")
                        
                        account_status = acc.get("AccountStatus") or acc.get("Account_Status") or acc.get("Status") or ""
                        is_active = str(account_status).lower() in ["active", "open", "current", "01", "02", "21", "22", "23"]
                        current_balance = float(acc.get("CurrentBalance") or acc.get("Balance") or acc.get("Current_Balance") or 0)
                        amount_overdue = float(acc.get("AmountPastDue") or acc.get("AmountOverdue") or acc.get("Amount_Past_Due") or 0)
                        credit_limit = float(acc.get("CreditLimit") or acc.get("HighCreditAmount") or acc.get("High_Credit_Amount") or acc.get("SanctionedAmount") or 0)
                        account_type = acc.get("AccountType") or acc.get("Type") or acc.get("Account_Type") or ""
                        written_off_amt = float(acc.get("WrittenOffAmount") or acc.get("WriteOffAmount") or acc.get("Written_Off_Amt_Total") or 0)
                        settlement_amt = float(acc.get("SettlementAmount") or acc.get("Settlement_Amount") or 0)
                        suit_filed = acc.get("SuitFiled", "") == "Y" or acc.get("WilfulDefault", "") == "Y" or acc.get("SuitFiledWilfulDefault", "") == "Y"
                        
                        # Parse payment history - try multiple formats
                        payment_history_raw = acc.get("PaymentHistory") or acc.get("Payment_History") or acc.get("PaymentHistoryProfile") or acc.get("History48Months") or []
                        cais_account_history = []
                        has_dpd_over_90 = False
                        current_dpd = 0
                        
                        # If payment history is a list of objects (Equifax History48Months format)
                        if isinstance(payment_history_raw, list):
                            for ph in payment_history_raw:
                                # Handle Equifax History48Months format: {'key': '07-24', 'PaymentStatus': 'CLSD', ...}
                                payment_status = ph.get("PaymentStatus", "") or ph.get("DPD") or ph.get("DaysPastDue") or ph.get("Days_Past_Due")
                                key = ph.get("key", "")
                                
                                # Parse month/year from key (e.g., "07-24" -> month=07, year=2024)
                                month = ph.get("Month") or ph.get("PaymentMonth") or ""
                                year = ph.get("Year") or ph.get("PaymentYear") or ""
                                if key and not month:
                                    parts = key.split("-")
                                    if len(parts) == 2:
                                        month = parts[0]
                                        year = f"20{parts[1]}" if len(parts[1]) == 2 else parts[1]
                                
                                # Convert PaymentStatus to DPD value
                                dpd_val = 0
                                if payment_status:
                                    status_str = str(payment_status).upper()
                                    if status_str in ["STD", "CLSD", "000", "CUR", "OK", "0"]:
                                        dpd_val = 0
                                    elif status_str in ["30+", "030", "1-30"]:
                                        dpd_val = 30
                                    elif status_str in ["60+", "060", "31-60"]:
                                        dpd_val = 60
                                    elif status_str in ["90+", "090", "61-90"]:
                                        dpd_val = 90
                                    elif status_str in ["120+", "120", "91-120"]:
                                        dpd_val = 120
                                    elif status_str in ["150+", "150", "121-150"]:
                                        dpd_val = 150
                                    elif status_str in ["180+", "180", "151-180"]:
                                        dpd_val = 180
                                    elif status_str in ["WO", "WRITTEN-OFF", "WRITEOFF"]:
                                        dpd_val = 999
                                    elif status_str in ["SMA", "SUB"]:
                                        dpd_val = 90
                                    else:
                                        # Try to parse as number
                                        try:
                                            dpd_val = int(ph.get("DPD") or ph.get("DaysPastDue") or ph.get("Days_Past_Due") or 0)
                                        except (ValueError, TypeError):
                                            dpd_val = 0
                                
                                cais_account_history.append({
                                    "Days_Past_Due": dpd_val,
                                    "Month": month,
                                    "Year": year,
                                    "PaymentStatus": payment_status
                                })
                                if dpd_val > 90:
                                    has_dpd_over_90 = True
                            if cais_account_history:
                                current_dpd = cais_account_history[0].get("Days_Past_Due", 0)
                        # If payment history is a string (like CIBIL format)
                        elif isinstance(payment_history_raw, str) and payment_history_raw:
                            months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
                            for i in range(0, min(len(payment_history_raw), 72), 3):
                                dpd_str = payment_history_raw[i:i+3]
                                try:
                                    dpd_val = int(dpd_str) if dpd_str.isdigit() else 0
                                except (ValueError, TypeError):
                                    dpd_val = 0
                                month_idx = (i // 3) % 12
                                year_offset = (i // 3) // 12
                                cais_account_history.append({
                                    "Days_Past_Due": dpd_val,
                                    "Month": months[month_idx],
                                    "Year": str(2026 - year_offset)
                                })
                                if dpd_val > 90:
                                    has_dpd_over_90 = True
                            if cais_account_history:
                                current_dpd = cais_account_history[0].get("Days_Past_Due", 0)
                        
                        # Count risk metrics
                        if written_off_amt > 0 or account_status in ["78", "89"]:
                            written_off_count += 1
                            total_written_off_amount += written_off_amt
                        if settlement_amt > 0:
                            settled_count += 1
                        if suit_filed:
                            suit_filed_count += 1
                        if has_dpd_over_90:
                            dpd_over_90_count += 1
                        if amount_overdue > 0 or written_off_amt > 0 or suit_filed:
                            negative_accounts_count += 1
                        
                        # Determine if secured or unsecured
                        secured_types = ["01", "02", "05", "07", "housing", "auto", "home", "property", "vehicle", "mortgage", "secured"]
                        is_secured = any(st in str(account_type).lower() for st in secured_types)
                        
                        account_entry = {
                            # Universal fields
                            "account_number": acc.get("AccountNumber") or acc.get("Account_Number") or "",
                            "institution": acc.get("Institution") or acc.get("Subscriber") or acc.get("CreditorName") or acc.get("Subscriber_Name") or "",
                            "account_type": account_type,
                            "ownership_type": acc.get("OwnershipType") or acc.get("Ownership") or acc.get("Ownership_Type") or "",
                            "open_date": acc.get("DateOpened") or acc.get("OpenDate") or acc.get("Date_Opened") or "",
                            "close_date": acc.get("DateClosed") or acc.get("CloseDate") or acc.get("Date_Closed") or "",
                            "credit_limit": credit_limit,
                            "current_balance": current_balance,
                            "amount_overdue": amount_overdue,
                            "credit_status": "Active" if is_active else "Closed",
                            "payment_history": payment_history_raw if isinstance(payment_history_raw, str) else "",
                            "last_payment_date": acc.get("LastPaymentDate") or acc.get("DateLastPayment") or acc.get("Date_Last_Payment") or "",
                            "written_off_amount": written_off_amt,
                            "settlement_amount": settlement_amt,
                            # Equifax specific fields for frontend compatibility
                            "Account_Status": account_status,
                            "Balance": current_balance,
                            "Current_Balance": current_balance,
                            "Amount_Past_Due": amount_overdue,
                            "Written_Off_Amt_Total": written_off_amt,
                            "Settlement_Amount": settlement_amt,
                            "Date_Opened": acc.get("DateOpened") or acc.get("Date_Opened") or "",
                            "Open_Date": acc.get("DateOpened") or acc.get("Date_Opened") or "",
                            "Date_Closed": acc.get("DateClosed") or acc.get("Date_Closed") or "",
                            "Subscriber_Name": acc.get("Institution") or acc.get("Subscriber") or acc.get("Subscriber_Name") or "",
                            "Account_Type": account_type,
                            "Credit_Limit_Amount": credit_limit,
                            "Highest_Credit_or_Original_Loan_Amount": credit_limit,
                            "SuitFiledWilfulDefault": "Y" if suit_filed else "N",
                            "CAIS_Account_History": cais_account_history,
                            "Days_Past_Due": current_dpd
                        }
                        
                        account_details_list.append(account_entry)
                        total_outstanding += current_balance
                        total_overdue += amount_overdue
                        if is_active:
                            active_count += 1
                            if is_secured:
                                secured_balance += current_balance
                            else:
                                unsecured_balance += current_balance
                        else:
                            closed_count += 1
                
                parsed["accounts"] = account_details_list
                parsed["CAIS_Account"] = {
                    "CAIS_Account_DETAILS": account_details_list,
                    "CAIS_Summary": {
                        "Credit_Account": {
                            "CreditAccountTotal": len(account_details_list),
                            "CreditAccountActive": active_count,
                            "CreditAccountClosed": closed_count,
                            "CreditAccountDefault": negative_accounts_count
                        },
                        "Total_Outstanding_Balance": {
                            "Outstanding_Balance_All": total_outstanding,
                            "Outstanding_Balance_Secured": secured_balance,
                            "Outstanding_Balance_UnSecured": unsecured_balance,
                            "Outstanding_Balance_All_Overdue": total_overdue
                        }
                    }
                }
                
                # Add risk metrics to summary
                parsed["risk_metrics"] = {
                    "written_off_accounts_count": written_off_count,
                    "negative_accounts_count": negative_accounts_count,
                    "dpd_over_90_count": dpd_over_90_count,
                    "suit_filed_count": suit_filed_count,
                    "settled_accounts_count": settled_count,
                    "total_written_off_amount": total_written_off_amount
                }
                
                logger.info(f"Parsed {len(account_details_list)} accounts, active: {active_count}, closed: {closed_count}")
                
                # Enquiries - Try multiple possible locations
                enquiry_list = (
                    cir_data.get("EnquiryDetails", []) or 
                    cir_data.get("Enquiries", []) or 
                    cir_data.get("InquiryDetails", []) or
                    cir_data.get("EnquirySummary", {}).get("EnquiryDetails", []) or
                    cir_data.get("RecentActivities", {}).get("EnquiryDetails", []) or
                    credit_report.get("Enquiries", []) or
                    credit_report.get("EnquiryDetails", [])
                )
                
                # Also check for EnquirySummary structure
                enquiry_summary = cir_data.get("EnquirySummary", {})
                if enquiry_summary:
                    logger.info(f"EnquirySummary keys: {list(enquiry_summary.keys())}")
                    logger.info(f"EnquirySummary content: {str(enquiry_summary)[:500]}")
                
                logger.info(f"Enquiries count: {len(enquiry_list) if enquiry_list else 0}")
                
                enquiry_details_list = []
                
                if isinstance(enquiry_list, list):
                    for enq in enquiry_list:
                        enquiry_entry = {
                            "institution": enq.get("Institution") or enq.get("Subscriber") or enq.get("EnquiryMemberName") or enq.get("Subscriber_Name") or "",
                            "date": enq.get("EnquiryDate") or enq.get("Date") or enq.get("Date_of_Request") or "",
                            "purpose": enq.get("EnquiryPurpose") or enq.get("Purpose") or enq.get("Reason") or enq.get("Enquiry_Purpose") or "",
                            "amount": float(enq.get("EnquiryAmount") or enq.get("Amount") or enq.get("Enquiry_Amount") or 0),
                            # Equifax specific fields for frontend
                            "Subscriber_Name": enq.get("Institution") or enq.get("Subscriber") or enq.get("Subscriber_Name") or "",
                            "Date_of_Request": enq.get("EnquiryDate") or enq.get("Date") or enq.get("Date_of_Request") or "",
                            "Enquiry_Purpose": enq.get("EnquiryPurpose") or enq.get("Purpose") or enq.get("Enquiry_Purpose") or "",
                            "Enquiry_Amount": float(enq.get("EnquiryAmount") or enq.get("Amount") or enq.get("Enquiry_Amount") or 0),
                        }
                        enquiry_details_list.append(enquiry_entry)
                
                parsed["enquiries"] = enquiry_details_list
                parsed["CAPS"] = {
                    "CAPS_Application_Details": enquiry_details_list,
                    "CAPS_Summary": {
                        "TotalCAPSLast7Days": 0,
                        "TotalCAPSLast30Days": 0,
                        "TotalCAPSLast90Days": 0,
                        "TotalCAPSLast180Days": len(enquiry_details_list)
                    }
                }
            
            # Summary
            parsed["summary"] = {
                "total_reports": len(cir_report_list) if cir_report_list else 0,
                "total_addresses": len(parsed["address_info"]),
                "total_phones": len(parsed["phone_info"]),
                "total_ids": len(parsed["id_info"]),
                "total_accounts": len(parsed["accounts"]),
                "active_accounts": parsed.get("CAIS_Account", {}).get("CAIS_Summary", {}).get("Credit_Account", {}).get("CreditAccountActive", 0),
                "total_enquiries": len(parsed["enquiries"]),
                "total_balance": parsed.get("CAIS_Account", {}).get("CAIS_Summary", {}).get("Total_Outstanding_Balance", {}).get("Outstanding_Balance_All", 0),
                "total_overdue": parsed.get("CAIS_Account", {}).get("CAIS_Summary", {}).get("Total_Outstanding_Balance", {}).get("Outstanding_Balance_All_Overdue", 0),
                "secured_balance": parsed.get("CAIS_Account", {}).get("CAIS_Summary", {}).get("Total_Outstanding_Balance", {}).get("Outstanding_Balance_Secured", 0),
                "unsecured_balance": parsed.get("CAIS_Account", {}).get("CAIS_Summary", {}).get("Total_Outstanding_Balance", {}).get("Outstanding_Balance_UnSecured", 0)
            }
            
            logger.info(f"Equifax parse complete. Summary: {parsed['summary']}")
            
        except Exception as e:
            logger.error(f"Error parsing Equifax report: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
        
        return parsed
    
    async def fetch_experian_report(
        self,
        name: str,
        pan: str,
        mobile: str,
        consent: str = "Y"
    ) -> Dict[str, Any]:
        """
        Fetch Experian credit report (JSON format)
        
        Args:
            name: Customer full name
            pan: Customer PAN number
            mobile: Customer mobile number
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
        
        # Normalize mobile
        mobile_clean = mobile.replace("+91", "").replace(" ", "").replace("-", "")
        if mobile_clean.startswith("91") and len(mobile_clean) == 12:
            mobile_clean = mobile_clean[2:]
        
        payload = {
            "name": name.strip(),
            "pan": pan.upper().strip(),
            "mobile": mobile_clean,
            "consent": consent
        }
        
        logger.info(f"Fetching Experian report for PAN: {pan[:4]}****")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}{self.ENDPOINTS['experian_json']}",
                    headers=self._get_headers(),
                    json=payload
                )
                
                result = response.json()
                
                if response.status_code == 200 and result.get("success"):
                    data = result.get("data", {})
                    return {
                        "success": True,
                        "provider": "Experian",
                        "client_id": data.get("client_id"),
                        "credit_score": data.get("credit_score"),
                        "credit_report": data.get("credit_report", {}),
                        "raw_response": result,
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    logger.error(f"Experian API error: {result.get('message')}")
                    return {
                        "success": False,
                        "error": result.get("message", "Failed to fetch credit report"),
                        "error_code": result.get("message_code", "UNKNOWN"),
                        "status_code": response.status_code
                    }
                    
        except httpx.TimeoutException:
            logger.error("Experian API timeout")
            return {
                "success": False,
                "error": "Request timed out. Please try again.",
                "error_code": "TIMEOUT"
            }
        except Exception as e:
            logger.error(f"Experian API exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "error_code": "EXCEPTION"
            }
    
    async def fetch_experian_pdf(
        self,
        name: str,
        pan: str,
        mobile: str,
        consent: str = "Y"
    ) -> Dict[str, Any]:
        """
        Fetch Experian credit report (PDF format)
        
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
            "name": name.strip(),
            "pan": pan.upper().strip(),
            "mobile": mobile_clean,
            "consent": consent
        }
        
        logger.info(f"Fetching Experian PDF report for PAN: {pan[:4]}****")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}{self.ENDPOINTS['experian_pdf']}",
                    headers=self._get_headers(),
                    json=payload
                )
                
                result = response.json()
                
                if response.status_code == 200 and result.get("success"):
                    data = result.get("data", {})
                    return {
                        "success": True,
                        "provider": "Experian",
                        "client_id": data.get("client_id"),
                        "credit_score": data.get("credit_score"),
                        "pdf_link": data.get("credit_report_link"),
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    logger.error(f"Experian PDF API error: {result.get('message')}")
                    return {
                        "success": False,
                        "error": result.get("message", "Failed to fetch PDF report"),
                        "error_code": result.get("message_code", "UNKNOWN"),
                        "status_code": response.status_code
                    }
                    
        except httpx.TimeoutException:
            logger.error("Experian PDF API timeout")
            return {
                "success": False,
                "error": "Request timed out. Please try again.",
                "error_code": "TIMEOUT"
            }
        except Exception as e:
            logger.error(f"Experian PDF API exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "error_code": "EXCEPTION"
            }
    
    def parse_experian_report(self, credit_report: dict) -> Dict[str, Any]:
        """
        Parse Experian credit report into a structured format for UI display
        
        Args:
            credit_report: Raw credit report dict from API
            
        Returns:
            Structured dict with parsed data
        """
        if not credit_report:
            return {}
        
        parsed = {
            "personal_info": {},
            "id_info": [],
            "phone_info": [],
            "address_info": [],
            "score_info": {},
            "accounts": [],
            "enquiries": [],
            "summary": {}
        }
        
        try:
            # Credit Profile Header
            header = credit_report.get("CreditProfileHeader", {})
            parsed["report_info"] = {
                "report_date": str(header.get("ReportDate", "")),
                "report_number": header.get("ReportNumber"),
                "version": header.get("Version")
            }
            
            # Current Application Details
            current_app = credit_report.get("Current_Application", {})
            app_details = current_app.get("Current_Application_Details", {})
            applicant = app_details.get("Current_Applicant_Details", {})
            
            # Personal Info
            parsed["personal_info"] = {
                "first_name": applicant.get("First_Name"),
                "last_name": applicant.get("Last_Name"),
                "name": f"{applicant.get('First_Name', '')} {applicant.get('Last_Name', '')}".strip(),
                "gender": "Male" if applicant.get("Gender_Code") == 1 else "Female" if applicant.get("Gender_Code") == 2 else "Unknown",
                "pan": applicant.get("IncomeTaxPan"),
                "birth_date": str(applicant.get("Date_Of_Birth_Applicant", ""))
            }
            
            # Phone Info
            if applicant.get("MobilePhoneNumber"):
                parsed["phone_info"].append({
                    "number": str(applicant.get("MobilePhoneNumber")),
                    "type": "Mobile"
                })
            if applicant.get("Telephone_Number_Applicant_1st"):
                parsed["phone_info"].append({
                    "number": applicant.get("Telephone_Number_Applicant_1st"),
                    "type": applicant.get("Telephone_Type", "Unknown")
                })
            
            # Address Info
            address_details = app_details.get("Current_Applicant_Address_Details", {})
            if address_details:
                address_parts = [
                    address_details.get("FlatNoPlotNoHouseNo"),
                    address_details.get("BldgNoSocietyName"),
                    address_details.get("RoadNoNameAreaLocality"),
                    address_details.get("Landmark")
                ]
                full_address = ", ".join([p for p in address_parts if p])
                parsed["address_info"].append({
                    "address": full_address,
                    "city": address_details.get("City"),
                    "state": address_details.get("State"),
                    "pin_code": address_details.get("PINCode"),
                    "country": address_details.get("Country_Code")
                })
            
            # ID Info
            if applicant.get("IncomeTaxPan"):
                parsed["id_info"].append({
                    "type": "PAN",
                    "number": applicant.get("IncomeTaxPan")
                })
            
            # Score Info
            score_data = credit_report.get("SCORE", {})
            parsed["score_info"] = {
                "score": score_data.get("FCIREXScore"),
                "confidence_level": score_data.get("FCIREXScoreConfidLevel")
            }
            
            # CAIS Account Summary
            cais_account = credit_report.get("CAIS_Account", {})
            cais_summary = cais_account.get("CAIS_Summary", {})
            credit_account = cais_summary.get("Credit_Account", {})
            outstanding = cais_summary.get("Total_Outstanding_Balance", {})
            
            parsed["summary"] = {
                "total_accounts": credit_account.get("CreditAccountTotal", 0),
                "active_accounts": credit_account.get("CreditAccountActive", 0),
                "closed_accounts": credit_account.get("CreditAccountClosed", 0),
                "default_accounts": credit_account.get("CreditAccountDefault", 0),
                "outstanding_balance_secured": outstanding.get("Outstanding_Balance_Secured", 0),
                "outstanding_balance_unsecured": outstanding.get("Outstanding_Balance_UnSecured", 0),
                "outstanding_balance_total": outstanding.get("Outstanding_Balance_All", 0)
            }
            
            # CAPS Summary (Credit Applications)
            caps = credit_report.get("TotalCAPS_Summary", {})
            parsed["caps_summary"] = {
                "last_7_days": caps.get("TotalCAPSLast7Days", 0),
                "last_30_days": caps.get("TotalCAPSLast30Days", 0),
                "last_90_days": caps.get("TotalCAPSLast90Days", 0),
                "last_180_days": caps.get("TotalCAPSLast180Days", 0)
            }
            
            # Parse Account Details
            account_details = cais_account.get("CAIS_Account_DETAILS", [])
            for acc in account_details[:20]:  # Limit to 20 for performance
                parsed["accounts"].append({
                    "member": acc.get("Subscriber_Name", "Not Disclosed"),
                    "account_type": acc.get("Account_Type"),
                    "ownership": acc.get("Ownership_Indicator"),
                    "date_opened": str(acc.get("Open_Date", "")),
                    "date_closed": str(acc.get("Date_Closed", "")),
                    "highest_credit": acc.get("Highest_Credit_or_Original_Loan_Amount", 0),
                    "current_balance": acc.get("Current_Balance", 0),
                    "amount_overdue": acc.get("Amount_Past_Due", 0),
                    "payment_status": acc.get("Payment_History_Profile"),
                    "account_status": acc.get("Account_Status")
                })
            
        except Exception as e:
            logger.error(f"Error parsing Experian report: {str(e)}")
        
        return parsed
    
    async def fetch_crif_report(
        self,
        first_name: str,
        last_name: str,
        pan: str,
        mobile: str,
        consent: str = "Y"
    ) -> Dict[str, Any]:
        """
        Fetch CRIF Consumer credit report (JSON format)
        
        Args:
            first_name: Customer first name
            last_name: Customer last name
            pan: Customer PAN number
            mobile: Customer mobile number
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
        
        # Normalize mobile
        mobile_clean = mobile.replace("+91", "").replace(" ", "").replace("-", "")
        if mobile_clean.startswith("91") and len(mobile_clean) == 12:
            mobile_clean = mobile_clean[2:]
        
        payload = {
            "first_name": first_name.strip(),
            "last_name": last_name.strip(),
            "pan": pan.upper().strip(),
            "mobile": mobile_clean,
            "consent": consent
        }
        
        logger.info(f"Fetching CRIF Consumer report for PAN: {pan[:4]}****")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}{self.ENDPOINTS['crif_json']}",
                    headers=self._get_headers(),
                    json=payload
                )
                
                result = response.json()
                
                if response.status_code == 200 and result.get("success"):
                    data = result.get("data", {})
                    # CRIF has nested credit_report structure
                    credit_report_data = data.get("credit_report", {})
                    inner_report = credit_report_data.get("credit_report", {})
                    
                    return {
                        "success": True,
                        "provider": "CRIF",
                        "client_id": data.get("client_id"),
                        "credit_score": data.get("credit_score") or credit_report_data.get("credit_score", ""),
                        "credit_report": inner_report,
                        "raw_response": result,
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    logger.error(f"CRIF API error: {result.get('message')}")
                    return {
                        "success": False,
                        "error": result.get("message", "Failed to fetch credit report"),
                        "error_code": result.get("message_code", "UNKNOWN"),
                        "status_code": response.status_code
                    }
                    
        except httpx.TimeoutException:
            logger.error("CRIF API timeout")
            return {
                "success": False,
                "error": "Request timed out. Please try again.",
                "error_code": "TIMEOUT"
            }
        except Exception as e:
            logger.error(f"CRIF API exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "error_code": "EXCEPTION"
            }
    
    async def fetch_crif_pdf(
        self,
        first_name: str,
        last_name: str,
        pan: str,
        mobile: str,
        consent: str = "Y"
    ) -> Dict[str, Any]:
        """
        Fetch CRIF Consumer credit report (PDF format)
        
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
            "first_name": first_name.strip(),
            "last_name": last_name.strip(),
            "pan": pan.upper().strip(),
            "mobile": mobile_clean,
            "consent": consent
        }
        
        logger.info(f"Fetching CRIF Consumer PDF report for PAN: {pan[:4]}****")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}{self.ENDPOINTS['crif_pdf']}",
                    headers=self._get_headers(),
                    json=payload
                )
                
                result = response.json()
                
                if response.status_code == 200 and result.get("success"):
                    data = result.get("data", {})
                    return {
                        "success": True,
                        "provider": "CRIF",
                        "client_id": data.get("client_id"),
                        "credit_score": data.get("credit_score"),
                        "pdf_link": data.get("credit_report_link"),
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    logger.error(f"CRIF PDF API error: {result.get('message')}")
                    return {
                        "success": False,
                        "error": result.get("message", "Failed to fetch PDF report"),
                        "error_code": result.get("message_code", "UNKNOWN"),
                        "status_code": response.status_code
                    }
                    
        except httpx.TimeoutException:
            logger.error("CRIF PDF API timeout")
            return {
                "success": False,
                "error": "Request timed out. Please try again.",
                "error_code": "TIMEOUT"
            }
        except Exception as e:
            logger.error(f"CRIF PDF API exception: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "error_code": "EXCEPTION"
            }
    
    def parse_crif_report(self, credit_report: dict) -> Dict[str, Any]:
        """
        Parse CRIF Consumer credit report into a structured format for UI display
        
        Args:
            credit_report: Raw credit report dict from API
            
        Returns:
            Structured dict with parsed data compatible with CreditRiskDashboard
        """
        if not credit_report:
            return {}
        
        parsed = {
            "personal_info": {},
            "id_info": [],
            "phone_info": [],
            "address_info": [],
            "email_info": [],
            "score_info": {},
            "SCORE": {},
            "accounts": [],
            "CAIS_Account": {},
            "enquiries": [],
            "CAPS": {},
            "summary": {},
            "employment_info": {}
        }
        
        try:
            # CRIF Consumer format based on sample response
            header = credit_report.get("HEADER", {})
            personal_info_variation = credit_report.get("PERSONAL-INFO-VARIATION", {})
            accounts_summary = credit_report.get("ACCOUNTS-SUMMARY", {})
            responses = credit_report.get("RESPONSES", {})
            inquiry_history = credit_report.get("INQUIRY-HISTORY", {})
            scores = credit_report.get("SCORES", {})
            employment = credit_report.get("EMPLOYMENT-DETAILS", {})
            
            # Parse Score
            score_data = scores.get("SCORE", {})
            score_value = score_data.get("SCORE-VALUE") or score_data.get("ScoreValue")
            if score_value:
                parsed["SCORE"] = {
                    "FCIREXScore": score_value,
                    "BureauScore": score_value,
                    "Type": score_data.get("SCORE-TYPE", ""),
                    "Version": ""
                }
                parsed["score_info"] = {
                    "score": score_value,
                    "score_name": score_data.get("SCORE-TYPE", ""),
                    "score_factors": score_data.get("SCORE-FACTORS", "")
                }
            
            # Parse Personal Info from variations
            name_variations = personal_info_variation.get("NAME-VARIATIONS", {}).get("VARIATION", [])
            if name_variations:
                if isinstance(name_variations, dict):
                    name_variations = [name_variations]
                parsed["personal_info"] = {
                    "name": name_variations[0].get("VALUE") if name_variations else "",
                    "reported_date": name_variations[0].get("REPORTED-DATE") if name_variations else ""
                }
            
            # Parse DOB
            dob_variations = personal_info_variation.get("DATE-OF-BIRTH-VARIATIONS", {}).get("VARIATION", {})
            if dob_variations:
                if isinstance(dob_variations, list):
                    dob_variations = dob_variations[0]
                parsed["personal_info"]["birth_date"] = dob_variations.get("VALUE", "")
            
            # Parse PAN
            pan_variations = personal_info_variation.get("PAN-VARIATIONS", {}).get("VARIATION", [])
            if pan_variations:
                if isinstance(pan_variations, dict):
                    pan_variations = [pan_variations]
                for pan in pan_variations:
                    parsed["id_info"].append({
                        "type": "PAN",
                        "number": pan.get("VALUE"),
                        "reported_date": pan.get("REPORTED-DATE")
                    })
            
            # Parse UID/Aadhaar
            uid_variations = personal_info_variation.get("UID-VARIATIONS", {}).get("VARIATION", {})
            if uid_variations:
                if isinstance(uid_variations, list):
                    uid_variations = uid_variations[0]
                parsed["id_info"].append({
                    "type": "Aadhaar",
                    "number": uid_variations.get("VALUE"),
                    "reported_date": uid_variations.get("REPORTED-DATE")
                })
            
            # Parse Address
            address_variations = personal_info_variation.get("ADDRESS-VARIATIONS", {}).get("VARIATION", [])
            if address_variations:
                if isinstance(address_variations, dict):
                    address_variations = [address_variations]
                for addr in address_variations:
                    parsed["address_info"].append({
                        "address": addr.get("VALUE"),
                        "reported_date": addr.get("REPORTED-DATE")
                    })
            
            # Parse Phone
            phone_variations = personal_info_variation.get("PHONE-NUMBER-VARIATIONS", {}).get("VARIATION", [])
            if phone_variations:
                if isinstance(phone_variations, dict):
                    phone_variations = [phone_variations]
                for phone in phone_variations:
                    parsed["phone_info"].append({
                        "number": phone.get("VALUE"),
                        "type": "Mobile",
                        "reported_date": phone.get("REPORTED-DATE")
                    })
            
            # Parse Email
            email_variations = personal_info_variation.get("EMAIL-VARIATIONS", {}).get("VARIATION", [])
            if email_variations:
                if isinstance(email_variations, dict):
                    email_variations = [email_variations]
                for email in email_variations:
                    parsed["email_info"].append({
                        "email": email.get("VALUE"),
                        "reported_date": email.get("REPORTED-DATE")
                    })
            
            # Parse Employment
            if employment:
                parsed["employment_info"] = {
                    "details": employment.get("EMPLOYMENT-DETAIL", "")
                }
            
            # Parse Accounts (RESPONSES)
            account_details_list = []
            written_off_count = 0
            negative_count = 0
            dpd_over_90_count = 0
            total_balance = 0
            total_overdue = 0
            active_count = 0
            closed_count = 0
            
            response_list = responses.get("RESPONSE", [])
            if isinstance(response_list, dict):
                response_list = [response_list]
            
            for resp in response_list:
                loan = resp.get("LOAN-DETAILS", {})
                
                account_status = loan.get("ACCOUNT-STATUS", "")
                is_active = account_status.lower() in ["active", "open", "current"]
                current_balance = self._parse_amount(loan.get("CURRENT-BAL", 0))
                overdue_amount = self._parse_amount(loan.get("OVERDUE-AMT", 0))
                write_off_amount = self._parse_amount(loan.get("WRITE-OFF-AMT", 0))
                disbursed_amount = self._parse_amount(loan.get("DISBURSED-AMT", 0))
                
                # Parse payment history from COMBINED-PAYMENT-HISTORY
                payment_history_str = loan.get("COMBINED-PAYMENT-HISTORY", "")
                cais_account_history = []
                has_dpd_over_90 = False
                
                if payment_history_str:
                    # Format: "Jul:2025,000/XXX|Jun:2025,000/XXX|"
                    entries = payment_history_str.split("|")
                    for entry in entries:
                        if ":" in entry and "," in entry:
                            try:
                                month_year, dpd_status = entry.split(",", 1)
                                month_part = month_year.split(":")[0]
                                year_part = month_year.split(":")[1] if ":" in month_year else ""
                                dpd_part = dpd_status.split("/")[0] if "/" in dpd_status else dpd_status
                                
                                dpd_val = 0
                                if dpd_part and dpd_part != "XXX":
                                    try:
                                        dpd_val = int(dpd_part)
                                    except ValueError:
                                        dpd_val = 0
                                
                                cais_account_history.append({
                                    "Days_Past_Due": dpd_val,
                                    "Month": month_part[:3],
                                    "Year": year_part,
                                    "PaymentStatus": dpd_part
                                })
                                
                                if dpd_val > 90:
                                    has_dpd_over_90 = True
                            except:
                                pass
                
                # Count metrics
                if write_off_amount > 0:
                    written_off_count += 1
                if overdue_amount > 0 or write_off_amount > 0:
                    negative_count += 1
                if has_dpd_over_90:
                    dpd_over_90_count += 1
                
                total_balance += current_balance
                total_overdue += overdue_amount
                
                if is_active:
                    active_count += 1
                else:
                    closed_count += 1
                
                account_entry = {
                    "account_number": loan.get("ACCT-NUMBER", ""),
                    "institution": loan.get("CREDIT-GUARANTOR", ""),
                    "account_type": loan.get("ACCT-TYPE", ""),
                    "ownership_type": loan.get("OWNERSHIP-IND", ""),
                    "open_date": loan.get("DISBURSED-DT", ""),
                    "close_date": loan.get("CLOSED-DATE", ""),
                    "credit_limit": disbursed_amount,
                    "current_balance": current_balance,
                    "amount_overdue": overdue_amount,
                    "credit_status": account_status,
                    "last_payment_date": loan.get("LAST-PAYMENT-DATE", ""),
                    "written_off_amount": write_off_amount,
                    "repayment_tenure": loan.get("REPAYMENT-TENURE", ""),
                    "security_details": loan.get("SECURITY-DETAILS", ""),
                    # Equifax-compatible fields for frontend
                    "Account_Status": account_status,
                    "Balance": current_balance,
                    "Current_Balance": current_balance,
                    "Amount_Past_Due": overdue_amount,
                    "Written_Off_Amt_Total": write_off_amount,
                    "Date_Opened": loan.get("DISBURSED-DT", ""),
                    "Open_Date": loan.get("DISBURSED-DT", ""),
                    "Date_Closed": loan.get("CLOSED-DATE", ""),
                    "Subscriber_Name": loan.get("CREDIT-GUARANTOR", ""),
                    "Account_Type": loan.get("ACCT-TYPE", ""),
                    "Highest_Credit_or_Original_Loan_Amount": disbursed_amount,
                    "SuitFiledWilfulDefault": "N",
                    "CAIS_Account_History": cais_account_history,
                    "Days_Past_Due": cais_account_history[0].get("Days_Past_Due", 0) if cais_account_history else 0
                }
                account_details_list.append(account_entry)
            
            parsed["accounts"] = account_details_list
            parsed["CAIS_Account"] = {
                "CAIS_Account_DETAILS": account_details_list,
                "CAIS_Summary": {
                    "Credit_Account": {
                        "CreditAccountTotal": len(account_details_list),
                        "CreditAccountActive": active_count,
                        "CreditAccountClosed": closed_count,
                        "CreditAccountDefault": negative_count
                    },
                    "Total_Outstanding_Balance": {
                        "Outstanding_Balance_All": total_balance,
                        "Outstanding_Balance_All_Overdue": total_overdue
                    }
                }
            }
            
            # Parse Accounts Summary from CRIF
            primary_summary = accounts_summary.get("PRIMARY-ACCOUNTS-SUMMARY", {})
            derived_attrs = accounts_summary.get("DERIVED-ATTRIBUTES", {})
            
            # Parse Enquiries (INQUIRY-HISTORY)
            enquiry_details_list = []
            history_list = inquiry_history.get("HISTORY", [])
            if isinstance(history_list, dict):
                history_list = [history_list]
            
            for hist in history_list:
                enquiry_entry = {
                    "institution": hist.get("MEMBER-NAME", ""),
                    "date": hist.get("INQUIRY-DATE", ""),
                    "purpose": hist.get("PURPOSE", ""),
                    "amount": self._parse_amount(hist.get("AMOUNT", 0)),
                    "ownership_type": hist.get("OWNERSHIP-TYPE", ""),
                    # Equifax-compatible
                    "Subscriber_Name": hist.get("MEMBER-NAME", ""),
                    "Date_of_Request": hist.get("INQUIRY-DATE", ""),
                    "Enquiry_Purpose": hist.get("PURPOSE", ""),
                    "Enquiry_Amount": self._parse_amount(hist.get("AMOUNT", 0))
                }
                enquiry_details_list.append(enquiry_entry)
            
            parsed["enquiries"] = enquiry_details_list
            parsed["CAPS"] = {
                "CAPS_Application_Details": enquiry_details_list,
                "CAPS_Summary": {
                    "TotalCAPSLast7Days": 0,
                    "TotalCAPSLast30Days": 0,
                    "TotalCAPSLast90Days": int(derived_attrs.get("INQURIES-IN-LAST-SIX-MONTHS", 0) or 0),
                    "TotalCAPSLast180Days": len(enquiry_details_list)
                }
            }
            
            # Summary
            parsed["summary"] = {
                "total_accounts": len(account_details_list),
                "active_accounts": active_count,
                "closed_accounts": closed_count,
                "total_balance": total_balance,
                "total_overdue": total_overdue,
                "total_enquiries": len(enquiry_details_list),
                "written_off_accounts_count": written_off_count,
                "negative_accounts_count": negative_count,
                "dpd_over_90_count": dpd_over_90_count,
                "credit_history_years": derived_attrs.get("LENGTH-OF-CREDIT-HISTORY-YEAR", ""),
                "credit_history_months": derived_attrs.get("LENGTH-OF-CREDIT-HISTORY-MONTH", ""),
                "avg_account_age_years": derived_attrs.get("AVERAGE-ACCOUNT-AGE-YEAR", ""),
                "avg_account_age_months": derived_attrs.get("AVERAGE-ACCOUNT-AGE-MONTH", "")
            }
            
            # Risk metrics
            parsed["risk_metrics"] = {
                "written_off_accounts_count": written_off_count,
                "negative_accounts_count": negative_count,
                "dpd_over_90_count": dpd_over_90_count,
                "suit_filed_count": 0,
                "settled_accounts_count": 0,
                "total_written_off_amount": sum(a.get("written_off_amount", 0) for a in account_details_list)
            }
            
            logger.info(f"CRIF Consumer parse complete. Accounts: {len(account_details_list)}, Score: {score_value}")
            
        except Exception as e:
            logger.error(f"Error parsing CRIF Consumer report: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
        
        return parsed
    
    def _parse_amount(self, value) -> float:
        """Parse amount string to float, handling commas"""
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        try:
            return float(str(value).replace(",", "").replace(" ", ""))
        except (ValueError, TypeError):
            return 0.0
    
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
        written_off_count = 0
        negative_accounts_count = 0
        dpd_over_90_count = 0
        suit_filed_count = 0
        settled_count = 0
        
        for acc in accounts:
            account_type_code = acc.get("accountType", "")
            account_status = acc.get("accountStatus", "")
            payment_history_str = acc.get("paymentHistory", "")
            written_off_amt = float(acc.get("woAmountTotal", 0) or 0)
            settlement_amt = float(acc.get("settlementAmount", 0) or 0)
            suit_filed = acc.get("suitFiled", "") == "Y" or acc.get("wilfulDefault", "") == "Y"
            
            # Parse payment history string into DPD array for heatmap
            # CIBIL format: "000000000030060090..." - each 3 chars represent DPD for a month
            cais_account_history = []
            if payment_history_str:
                months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
                for i in range(0, min(len(payment_history_str), 72), 3):  # 24 months max
                    dpd_str = payment_history_str[i:i+3]
                    try:
                        dpd_val = int(dpd_str) if dpd_str.isdigit() else 0
                    except (ValueError, TypeError):
                        dpd_val = 0
                    month_idx = (i // 3) % 12
                    year_offset = (i // 3) // 12
                    cais_account_history.append({
                        "Days_Past_Due": dpd_val,
                        "Month": months[month_idx],
                        "Year": str(2026 - year_offset)  # Approximate year
                    })
            
            # Count risk metrics
            if written_off_amt > 0 or account_status in ["78", "89"]:
                written_off_count += 1
            if settlement_amt > 0:
                settled_count += 1
            if suit_filed:
                suit_filed_count += 1
            
            # Check for DPD > 90 in history
            has_dpd_over_90 = False
            for h in cais_account_history:
                if h.get("Days_Past_Due", 0) > 90:
                    has_dpd_over_90 = True
                    break
            if has_dpd_over_90:
                dpd_over_90_count += 1
            
            # Count negative accounts (overdue, written-off, defaults)
            if float(acc.get("amountOverdue", 0) or 0) > 0 or written_off_amt > 0 or suit_filed:
                negative_accounts_count += 1
            
            account_entry = {
                "type": account_type_map.get(account_type_code, f"Type {account_type_code}"),
                "member": acc.get("memberShortName"),
                "account_number": acc.get("accountNumber", ""),
                "date_opened": acc.get("dateOpened"),
                "date_reported": acc.get("dateReported"),
                "high_credit": acc.get("highCreditAmount", 0),
                "current_balance": acc.get("currentBalance", 0),
                "amount_overdue": acc.get("amountOverdue", 0),
                "payment_history": payment_history_str,
                "last_payment_date": acc.get("lastPaymentDate"),
                "credit_status": acc.get("creditFacilityStatus"),
                "written_off_amount": written_off_amt,
                "settlement_amount": settlement_amt,
                # Equifax-compatible fields for frontend
                "Account_Type": account_type_code,
                "Account_Status": account_status,
                "Subscriber_Name": acc.get("memberShortName"),
                "Account_Number": acc.get("accountNumber", ""),
                "Open_Date": acc.get("dateOpened"),
                "Current_Balance": acc.get("currentBalance", 0),
                "Amount_Past_Due": acc.get("amountOverdue", 0),
                "Highest_Credit_or_Original_Loan_Amount": acc.get("highCreditAmount", 0),
                "Written_Off_Amt_Total": written_off_amt,
                "Settlement_Amount": settlement_amt,
                "SuitFiledWilfulDefault": "Y" if suit_filed else "N",
                "CAIS_Account_History": cais_account_history,
                "Days_Past_Due": cais_account_history[0].get("Days_Past_Due", 0) if cais_account_history else 0
            }
            account_info.append(account_entry)
        
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
        
        # Helper function for safe numeric conversion
        def safe_int(value, default=0):
            if value is None:
                return default
            try:
                return int(float(str(value).replace(',', '')))
            except (ValueError, TypeError):
                return default
        
        # Calculate summary stats
        total_accounts = len(account_info)
        active_accounts = len([a for a in account_info if safe_int(a.get("current_balance", 0)) > 0])
        closed_accounts = total_accounts - active_accounts
        total_balance = sum(safe_int(a.get("current_balance", 0)) for a in account_info)
        total_overdue = sum(safe_int(a.get("amount_overdue", 0)) for a in account_info)
        total_written_off = sum(safe_int(a.get("written_off_amount", 0)) for a in account_info)
        # Count enquiries for summary
        
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
                "closed_accounts": closed_accounts,
                "total_balance": total_balance,
                "total_overdue": total_overdue,
                "total_enquiries": len(enquiry_info),
                "written_off_accounts_count": written_off_count,
                "negative_accounts_count": negative_accounts_count,
                "dpd_over_90_count": dpd_over_90_count,
                "suit_filed_count": suit_filed_count,
                "settled_accounts_count": settled_count,
                "total_written_off_amount": total_written_off
            },
            # Equifax-compatible structure for frontend
            "CAIS_Account": {
                "CAIS_Account_DETAILS": account_info,
                "CAIS_Summary": {
                    "Credit_Account": {
                        "CreditAccountTotal": total_accounts,
                        "CreditAccountActive": active_accounts,
                        "CreditAccountClosed": closed_accounts,
                        "CreditAccountDefault": negative_accounts_count
                    },
                    "Total_Outstanding_Balance": {
                        "Outstanding_Balance_All": total_balance,
                        "Outstanding_Balance_All_Overdue": total_overdue
                    }
                }
            },
            "SCORE": {
                "FCIREXScore": score_info.get("score", 0),
                "BureauScore": score_info.get("score", 0)
            },
            "CAPS": {
                "CAPS_Application_Details": enquiry_info
            },
            "TotalCAPS_Summary": {
                "TotalCAPSLast7Days": 0,
                "TotalCAPSLast30Days": 0,
                "TotalCAPSLast90Days": 0,
                "TotalCAPSLast180Days": len(enquiry_info)
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
