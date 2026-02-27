"""
AI Report Generation Service
Generates intelligent insights for vehicle inspection reports using OpenAI GPT-5.2
"""
import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# AI Report Generation using emergentintegrations
async def generate_ai_report_insights(
    inspection_data: Dict[str, Any],
    vehicle_data: Dict[str, Any],
    obd_data: Dict[str, Any],
    answers_data: Dict[str, Any],
    categories_info: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generate AI-powered insights for inspection report
    
    Args:
        inspection_data: Basic inspection info (customer, vehicle number, etc.)
        vehicle_data: Vehicle details from Vaahan API (make, model, year, etc.)
        obd_data: OBD-2 diagnostics data
        answers_data: Inspection Q&A answers
        categories_info: Category-wise questions and answers
    
    Returns:
        Dictionary containing AI-generated insights
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            logger.error("EMERGENT_LLM_KEY not found in environment")
            return get_default_insights()
        
        # Prepare the data summary for AI analysis
        data_summary = prepare_data_for_ai(
            inspection_data, vehicle_data, obd_data, answers_data, categories_info
        )
        
        # Create the AI prompt
        system_message = """You are an expert automotive inspector and vehicle valuation specialist. 
Your task is to analyze vehicle inspection data and provide accurate, professional assessments.
You must respond ONLY with valid JSON - no markdown, no explanations, just the JSON object."""

        user_prompt = f"""Analyze this vehicle inspection data and provide a comprehensive assessment.

VEHICLE & INSPECTION DATA:
{json.dumps(data_summary, indent=2)}

Based on this data, provide your assessment in the following JSON format:
{{
    "overall_rating": <number 1-5, with 5 being excellent>,
    "recommended_to_buy": <true/false>,
    "market_value": {{
        "min": <minimum value in INR>,
        "max": <maximum value in INR>,
        "confidence": "<high/medium/low>"
    }},
    "assessment_summary": "<2-3 sentence professional summary of the vehicle condition>",
    "key_highlights": [
        "<highlight 1>",
        "<highlight 2>",
        "<highlight 3>"
    ],
    "condition_ratings": {{
        "engine": "<EXCELLENT/GOOD/FAIR/POOR>",
        "interior": "<EXCELLENT/GOOD/FAIR/POOR>",
        "exterior": "<EXCELLENT/GOOD/FAIR/POOR>",
        "transmission": "<EXCELLENT/GOOD/FAIR/POOR>"
    }},
    "category_ratings": {{
        "<category_name>": {{
            "rating": <number 1-5>,
            "status": "<PASS/ATTENTION/FAIL>",
            "summary": "<brief summary>"
        }}
    }},
    "risk_factors": [
        "<risk 1 if any>",
        "<risk 2 if any>"
    ],
    "recommendations": [
        "<recommendation 1>",
        "<recommendation 2>"
    ]
}}

Consider these factors in your analysis:
1. Vehicle age and mileage
2. OBD diagnostic codes (if any)
3. Inspection answers and their implications
4. Market conditions for this make/model
5. Overall condition based on category responses

Respond with ONLY the JSON object, no other text."""

        # Initialize the chat
        chat = LlmChat(
            api_key=api_key,
            session_id=f"inspection-report-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            system_message=system_message
        ).with_model("openai", "gpt-5.2")
        
        # Send message and get response
        user_message = UserMessage(text=user_prompt)
        response = await chat.send_message(user_message)
        
        logger.info(f"[AI_REPORT] Raw AI response received, length: {len(response)}")
        
        # Parse the AI response
        try:
            # Clean up response - remove markdown code blocks if present
            cleaned_response = response.strip()
            if cleaned_response.startswith("```"):
                # Remove markdown code blocks
                lines = cleaned_response.split("\n")
                # Remove first line (```json) and last line (```)
                lines = [l for l in lines if not l.strip().startswith("```")]
                cleaned_response = "\n".join(lines)
            
            ai_insights = json.loads(cleaned_response)
            logger.info(f"[AI_REPORT] Successfully parsed AI insights")
            
            # Validate and fill missing fields
            ai_insights = validate_ai_response(ai_insights)
            
            return ai_insights
            
        except json.JSONDecodeError as e:
            logger.error(f"[AI_REPORT] Failed to parse AI response as JSON: {e}")
            logger.error(f"[AI_REPORT] Response was: {response[:500]}...")
            return get_default_insights()
            
    except Exception as e:
        logger.error(f"[AI_REPORT] Error generating AI insights: {e}")
        return get_default_insights()


def prepare_data_for_ai(
    inspection_data: Dict[str, Any],
    vehicle_data: Dict[str, Any],
    obd_data: Dict[str, Any],
    answers_data: Dict[str, Any],
    categories_info: Dict[str, Any]
) -> Dict[str, Any]:
    """Prepare and structure data for AI analysis"""
    
    # Extract relevant vehicle info
    vehicle_summary = {
        "make": vehicle_data.get("make") or vehicle_data.get("vehicle_make", "Unknown"),
        "model": vehicle_data.get("model") or vehicle_data.get("vehicle_model", "Unknown"),
        "year": vehicle_data.get("year") or vehicle_data.get("vehicle_year", 0),
        "fuel_type": vehicle_data.get("fuel_type", "Unknown"),
        "transmission": vehicle_data.get("transmission", "Unknown"),
        "color": vehicle_data.get("colour") or vehicle_data.get("vehicle_colour", "Unknown"),
        "registration_number": vehicle_data.get("reg_no") or inspection_data.get("car_number", ""),
        "engine_cc": vehicle_data.get("engine_cc", 0),
        "owners": vehicle_data.get("owners", 0),
        "kms_driven": inspection_data.get("kms_driven", 0)
    }
    
    # Extract OBD summary
    obd_summary = {
        "scan_completed": bool(obd_data),
        "error_codes_count": 0,
        "error_codes": []
    }
    
    if obd_data:
        # Handle different OBD data formats
        if isinstance(obd_data, dict):
            if "categories" in obd_data:
                for cat in obd_data.get("categories", []):
                    codes = cat.get("codes", [])
                    obd_summary["error_codes_count"] += len(codes)
                    obd_summary["error_codes"].extend([
                        {"code": c.get("code"), "description": c.get("description")}
                        for c in codes[:5]  # Limit to 5 codes per category
                    ])
            elif "dtc_codes" in obd_data:
                obd_summary["error_codes"] = obd_data.get("dtc_codes", [])[:10]
                obd_summary["error_codes_count"] = len(obd_data.get("dtc_codes", []))
    
    # Process inspection answers by category
    categories_summary = {}
    for cat_id, cat_info in categories_info.items():
        cat_name = cat_info.get("name", cat_id)
        questions = cat_info.get("questions", [])
        
        answered_count = 0
        answers_list = []
        
        for q in questions:
            q_id = q.get("id") or q.get("question_id")
            q_text = q.get("text") or q.get("question_text", "")
            
            # Get the answer for this question
            answer_data = answers_data.get(q_id, {})
            if answer_data:
                answered_count += 1
                answer_value = answer_data.get("answer", answer_data) if isinstance(answer_data, dict) else answer_data
                
                # Skip media URLs in the summary
                if isinstance(answer_value, str) and (
                    answer_value.startswith("http") or 
                    answer_value.startswith("gs://") or
                    answer_value.startswith("data:") or
                    answer_value.startswith("file://")
                ):
                    answer_value = "[Media Captured]"
                
                answers_list.append({
                    "question": q_text[:100],  # Truncate long questions
                    "answer": str(answer_value)[:100] if answer_value else "Not answered"
                })
        
        categories_summary[cat_name] = {
            "total_questions": len(questions),
            "answered": answered_count,
            "completion_rate": round((answered_count / len(questions) * 100) if questions else 0, 1),
            "responses": answers_list[:10]  # Limit responses per category
        }
    
    return {
        "vehicle": vehicle_summary,
        "obd_diagnostics": obd_summary,
        "inspection_categories": categories_summary,
        "inspection_date": inspection_data.get("created_at", ""),
        "city": inspection_data.get("city", "")
    }


def validate_ai_response(ai_response: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and fill missing fields in AI response"""
    
    defaults = get_default_insights()
    
    # Ensure all required fields exist
    validated = {
        "overall_rating": ai_response.get("overall_rating", defaults["overall_rating"]),
        "recommended_to_buy": ai_response.get("recommended_to_buy", defaults["recommended_to_buy"]),
        "market_value": ai_response.get("market_value", defaults["market_value"]),
        "assessment_summary": ai_response.get("assessment_summary", defaults["assessment_summary"]),
        "key_highlights": ai_response.get("key_highlights", defaults["key_highlights"]),
        "condition_ratings": ai_response.get("condition_ratings", defaults["condition_ratings"]),
        "category_ratings": ai_response.get("category_ratings", defaults["category_ratings"]),
        "risk_factors": ai_response.get("risk_factors", defaults["risk_factors"]),
        "recommendations": ai_response.get("recommendations", defaults["recommendations"]),
        "ai_generated": True,
        "generated_at": datetime.now().isoformat()
    }
    
    # Validate rating is within bounds
    if not 1 <= validated["overall_rating"] <= 5:
        validated["overall_rating"] = 3
    
    return validated


def get_default_insights() -> Dict[str, Any]:
    """Return default insights when AI generation fails"""
    return {
        "overall_rating": 0,
        "recommended_to_buy": False,
        "market_value": {
            "min": 0,
            "max": 0,
            "confidence": "low"
        },
        "assessment_summary": "Vehicle inspection completed. AI analysis pending.",
        "key_highlights": [],
        "condition_ratings": {
            "engine": "PENDING",
            "interior": "PENDING",
            "exterior": "PENDING",
            "transmission": "PENDING"
        },
        "category_ratings": {},
        "risk_factors": [],
        "recommendations": ["Complete all inspection categories for accurate assessment"],
        "ai_generated": False,
        "generated_at": datetime.now().isoformat()
    }
