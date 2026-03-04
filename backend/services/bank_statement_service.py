"""
Bank Statement Analysis Service
Uses Gemini AI to extract financial data from bank statement PDFs
Supports password-protected PDFs
"""
import os
import logging
import json
import tempfile
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Emergent LLM Key for AI services
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Bank statement analysis prompt - keep it concise for faster processing
BANK_STATEMENT_ANALYSIS_PROMPT = """Analyze this Indian bank statement PDF and extract information in JSON format:

{
  "bank_name": "Bank name",
  "account_number_masked": "XXXX + last 4 digits",
  "statement_period_from": "YYYY-MM-DD",
  "statement_period_to": "YYYY-MM-DD",
  "average_bank_balance": number,
  "minimum_balance": number,
  "maximum_balance": number,
  "total_credits": number,
  "average_monthly_credits": number,
  "salary_credits_total": number or null,
  "salary_credits_count": number,
  "salary_source_company": "Company name paying salary" or null,
  "other_income_total": number,
  "other_income_count": number,
  "total_debits": number,
  "average_monthly_debits": number,
  "loan_repayments_total": number or null,
  "emi_payments_total": number or null,
  "bounce_count": number,
  "bounced_cheque_count": number,
  "bounced_cheque_details": ["list of bounce descriptions"] or [],
  "return_count": number,
  "analysis_notes": "Brief observations about account behavior",
  "confidence_score": number 0-100
}

SALARY IDENTIFICATION RULES (IMPORTANT):
- NEFT/IMPS/RTGS credits from companies with keywords like "PVT LTD", "PRIVATE LIMITED", "LLP", "TECHNOLOGIES", "SOLUTIONS" are likely SALARY
- Look for patterns: "NEFT CR-", "IMPS CR-", "RTGS CR-" followed by company names
- Example salary pattern: "NEFT CR-UTIB0003362-WISEDRIVE TECHNOLOGIES PRIVATE LIMITED-KALYANDHARREDDY" = SALARY from WISEDRIVE
- Regular monthly credits of same/similar amounts from same source = SALARY
- Add ALL such credits to salary_credits_total, NOT to other_income

BOUNCE/RETURN IDENTIFICATION:
- Look for: "CHQ RTN", "CHEQUE RETURN", "BOUNCE", "RETURN UNPAID", "INSUFFICIENT FUNDS", "ECS RETURN", "NACH RETURN"
- Count each unique bounced cheque in bounced_cheque_count
- Include description in bounced_cheque_details array

OTHER INCOME (non-salary credits):
- UPI receipts, cash deposits, refunds, interest credited
- Credits NOT from employer/company salary transfers

Guidelines:
- All amounts as numbers without currency symbols
- Carefully separate SALARY from OTHER INCOME
- Report ALL bounces and returns found in statement
- Use null for fields that cannot be determined

Return ONLY valid JSON, no markdown."""


def unlock_pdf(input_path: str, password: str, output_path: str, max_pages: int = 5) -> bool:
    """
    Unlock a password-protected PDF using pikepdf
    
    Args:
        input_path: Path to the encrypted PDF
        password: Password to unlock the PDF
        output_path: Path to save the unlocked PDF
        max_pages: Maximum number of pages to keep (to reduce processing time)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        import pikepdf
        
        with pikepdf.open(input_path, password=password) as pdf:
            # If PDF has too many pages, only keep the first N pages
            # Bank statement summaries are usually in the first few pages
            total_pages = len(pdf.pages)
            logger.info(f"PDF has {total_pages} pages")
            
            if total_pages > max_pages:
                logger.info(f"Trimming PDF from {total_pages} to {max_pages} pages for faster analysis")
                # Create a new PDF with only first N pages
                new_pdf = pikepdf.Pdf.new()
                for i in range(min(max_pages, total_pages)):
                    new_pdf.pages.append(pdf.pages[i])
                new_pdf.save(output_path)
            else:
                # Save without encryption
                pdf.save(output_path)
        
        logger.info(f"Successfully unlocked PDF")
        return True
        
    except Exception as e:
        logger.error(f"Failed to unlock PDF: {str(e)}")
        return False


class BankStatementAnalyzer:
    """Analyzes bank statements using Gemini AI"""
    
    def __init__(self):
        self.api_key = EMERGENT_LLM_KEY
        
    async def analyze_statement(self, file_path: str) -> Dict[str, Any]:
        """
        Analyze a bank statement PDF and extract financial data
        
        Args:
            file_path: Path to the PDF file (must be unencrypted)
            
        Returns:
            Dictionary with analyzed financial data
        """
        if not self.api_key:
            logger.error("EMERGENT_LLM_KEY not configured")
            return {"error": "AI service not configured", "success": False}
        
        # Models to try in order (fallback if one fails)
        # Note: Only Gemini supports file attachments in emergentintegrations
        models_to_try = [
            ("gemini", "gemini-2.5-flash"),  # Primary - supports file attachments
        ]
        
        # Retry logic for transient API errors
        max_retries = 2
        retry_delay = 2  # seconds
        
        last_error = None
        
        for model_provider, model_name in models_to_try:
            for attempt in range(max_retries):
                try:
                    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
                    import asyncio
                    
                    logger.info(f"Attempting bank statement analysis with {model_provider}/{model_name} (attempt {attempt + 1})")
                    
                    # Initialize chat with the current model
                    chat = LlmChat(
                        api_key=self.api_key,
                        session_id=f"bank_statement_{datetime.now(timezone.utc).timestamp()}",
                        system_message="You are a financial analyst AI. Always respond with valid JSON only, no markdown formatting or code blocks."
                    ).with_model(model_provider, model_name)
                    
                    # Create file attachment
                    pdf_file = FileContentWithMimeType(
                        file_path=file_path,
                        mime_type="application/pdf"
                    )
                    
                    # Send analysis request
                    user_message = UserMessage(
                        text=BANK_STATEMENT_ANALYSIS_PROMPT,
                        file_contents=[pdf_file]
                    )
                    
                    response = await chat.send_message(user_message)
                    
                    # Parse JSON response
                    try:
                        # Clean response - remove markdown code blocks if present
                        response_text = response.strip()
                        if response_text.startswith("```json"):
                            response_text = response_text[7:]
                        if response_text.startswith("```"):
                            response_text = response_text[3:]
                        if response_text.endswith("```"):
                            response_text = response_text[:-3]
                        
                        analysis = json.loads(response_text.strip())
                        analysis["success"] = True
                        analysis["analyzed_at"] = datetime.now(timezone.utc).isoformat()
                        analysis["model_used"] = f"{model_provider}/{model_name}"
                        logger.info(f"Bank statement analysis successful with {model_provider}/{model_name}")
                        return analysis
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse AI response as JSON: {e}")
                        logger.error(f"Raw response: {response[:1000] if response else 'None'}")
                        return {
                            "success": False,
                            "error": "Failed to parse analysis response",
                            "raw_response": response[:500] if response else None
                        }
                        
                except Exception as e:
                    error_str = str(e)
                    last_error = error_str
                    # Check for transient errors that should be retried
                    is_transient = any(err in error_str.lower() for err in ['502', '503', '504', 'bad gateway', 'service unavailable', 'timeout', 'connection'])
                    
                    if is_transient and attempt < max_retries - 1:
                        logger.warning(f"Bank statement analysis with {model_provider}/{model_name} attempt {attempt + 1} failed with transient error: {error_str}. Retrying in {retry_delay}s...")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                        continue
                    
                    logger.warning(f"Bank statement analysis with {model_provider}/{model_name} failed: {error_str}")
                    break  # Try next model
            
            # Reset retry delay for next model
            retry_delay = 2
        
        logger.error(f"Bank statement analysis failed with all models. Last error: {last_error}")
        return {
            "success": False,
            "error": f"Analysis failed: {last_error}"
        }
    
    async def analyze_from_url(
        self, 
        file_url: str, 
        storage_service=None,
        password: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Download file from URL and analyze it
        
        Args:
            file_url: URL of the PDF file (can be HTTP URL or local file path)
            storage_service: Storage service to download from Firebase
            password: Optional password for encrypted PDFs
            
        Returns:
            Dictionary with analyzed financial data
        """
        temp_file = None
        unlocked_file = None
        
        try:
            # Check if it's a local file path (not a URL)
            if file_url and not file_url.startswith(('http://', 'https://')):
                # It might be a local file path
                local_paths_to_check = [
                    file_url,  # Direct path
                    f"/app/storage/{file_url}",  # Relative to storage
                    f"/app/{file_url}",  # Relative to app
                ]
                
                local_file_found = None
                for path in local_paths_to_check:
                    if os.path.exists(path):
                        local_file_found = path
                        break
                
                if local_file_found:
                    logger.info(f"Using local file: {local_file_found}")
                    file_path = local_file_found
                else:
                    logger.error(f"File URL is not a valid HTTP URL and not found locally: {file_url}")
                    return {
                        "success": False,
                        "error": f"Invalid file URL: {file_url}. Expected HTTP URL or valid local path."
                    }
            elif storage_service and hasattr(storage_service, 'download_file'):
                # Download from Firebase/storage
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
                await storage_service.download_file(file_url, temp_file.name)
                file_path = temp_file.name
            else:
                # Direct HTTP download
                async with httpx.AsyncClient() as client:
                    response = await client.get(file_url, follow_redirects=True, timeout=60.0)
                    response.raise_for_status()
                    
                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
                    temp_file.write(response.content)
                    temp_file.close()
                    file_path = temp_file.name
            
            # If password provided, try to unlock the PDF
            if password:
                unlocked_file = tempfile.NamedTemporaryFile(delete=False, suffix='_unlocked.pdf')
                unlocked_file.close()
                
                if unlock_pdf(file_path, password, unlocked_file.name):
                    file_path = unlocked_file.name
                    logger.info("PDF unlocked successfully, proceeding with analysis")
                else:
                    return {
                        "success": False,
                        "error": "Failed to unlock PDF with provided password"
                    }
            
            # Analyze the downloaded file
            return await self.analyze_statement(file_path)
            
        except Exception as e:
            logger.error(f"Failed to download/analyze statement: {str(e)}")
            return {
                "success": False,
                "error": f"Download failed: {str(e)}"
            }
        finally:
            # Cleanup temp files
            if temp_file and os.path.exists(temp_file.name):
                try:
                    os.unlink(temp_file.name)
                except Exception:
                    pass
            if unlocked_file and os.path.exists(unlocked_file.name):
                try:
                    os.unlink(unlocked_file.name)
                except Exception:
                    pass


# Singleton instance
bank_statement_analyzer = BankStatementAnalyzer()


async def analyze_bank_statement(file_path: str) -> Dict[str, Any]:
    """Convenience function to analyze a bank statement"""
    return await bank_statement_analyzer.analyze_statement(file_path)


async def analyze_bank_statement_from_url(
    file_url: str, 
    storage_service=None,
    password: Optional[str] = None
) -> Dict[str, Any]:
    """Convenience function to analyze a bank statement from URL"""
    return await bank_statement_analyzer.analyze_from_url(file_url, storage_service, password)
