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

# Bank statement analysis prompt
BANK_STATEMENT_ANALYSIS_PROMPT = """You are a financial analyst AI specialized in analyzing Indian bank statements. 
Analyze the uploaded bank statement PDF and extract the following information in JSON format:

{
  "bank_name": "Name of the bank (e.g., HDFC Bank, ICICI Bank, SBI)",
  "account_number_masked": "Last 4 digits only (e.g., XXXX1234)",
  "statement_period_from": "Start date in YYYY-MM-DD format",
  "statement_period_to": "End date in YYYY-MM-DD format",
  
  "average_bank_balance": "Average of all daily/monthly balances as a number",
  "minimum_balance": "Lowest balance in the period as a number",
  "maximum_balance": "Highest balance in the period as a number",
  "end_of_month_balances": [{"month": "YYYY-MM", "balance": 50000}],
  
  "total_credits": "Sum of all credit transactions as a number",
  "average_monthly_credits": "Total credits divided by number of months as a number",
  "salary_credits_identified": "Monthly salary/income credits if identifiable as a number",
  "regular_income_sources": [{"source": "Company Name/UPI ID", "amount": 50000, "frequency": "monthly"}],
  
  "total_debits": "Sum of all debit transactions as a number",
  "average_monthly_debits": "Total debits divided by number of months as a number",
  "emi_payments_identified": [{"lender": "Bank/NBFC name", "amount": 15000, "frequency": "monthly"}],
  "loan_repayments_total": "Total identified loan EMI payments as a number",
  "high_value_transactions": [{"date": "YYYY-MM-DD", "amount": 100000, "description": "Transfer to XYZ", "type": "credit/debit"}],
  
  "bounce_count": "Number of returned cheques/failed transactions as a number",
  "low_balance_days": "Approximate days when balance was below 5000 as a number",
  "cash_withdrawal_ratio": "Percentage of debits that are ATM/cash withdrawals as a number",
  
  "spending_pattern": {
    "utilities": "Total spending on utilities/bills",
    "food_dining": "Total spending on food and dining",
    "shopping": "Total spending on shopping/retail",
    "transfers": "Total transfers to other accounts",
    "emi_loans": "Total EMI/loan payments",
    "others": "Other miscellaneous spending"
  },
  
  "analysis_notes": "Any important observations about the account including spending behavior, savings pattern, red flags",
  "confidence_score": "0-100 confidence in the analysis accuracy"
}

Important guidelines:
1. All amounts should be numbers without currency symbols or commas
2. Look for patterns in salary credits (usually same date, same amount each month)
3. Identify EMI payments (regular fixed debits to banks/NBFCs)
4. Flag bounced transactions or insufficient fund incidents
5. Calculate average bank balance as the mean of all closing balances
6. If any field cannot be determined, use null
7. Be thorough in analyzing spending patterns and categorize transactions

Analyze the statement thoroughly and provide accurate financial insights."""


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
        
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
            
            # Initialize Gemini chat (supports file attachments)
            # Using gemini-2.5-pro for better accuracy with complex PDF analysis
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"bank_statement_{datetime.now(timezone.utc).timestamp()}",
                system_message="You are a financial analyst AI. Always respond with valid JSON only, no markdown formatting."
            ).with_model("gemini", "gemini-2.5-pro")
            
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
            logger.error(f"Bank statement analysis failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
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
            file_url: URL of the PDF file
            storage_service: Storage service to download from Firebase
            password: Optional password for encrypted PDFs
            
        Returns:
            Dictionary with analyzed financial data
        """
        temp_file = None
        unlocked_file = None
        
        try:
            # Download file to temp location
            if storage_service and hasattr(storage_service, 'download_file'):
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
