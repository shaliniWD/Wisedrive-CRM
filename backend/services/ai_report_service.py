"""
AI Report Generation Service - Enhanced
Generates intelligent insights for vehicle inspection reports using OpenAI GPT-5.2
Includes:
- Section-wise assessment summary
- Category-wise ratings based on Q&A
- Overall rating determination
- Market value integration
"""
import os
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def generate_ai_report_insights(
    inspection_data: Dict[str, Any],
    vehicle_data: Dict[str, Any],
    obd_data: Dict[str, Any],
    answers_data: Dict[str, Any],
    categories_info: Dict[str, Any],
    market_price_data: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Generate AI-powered insights for inspection report
    
    Args:
        inspection_data: Basic inspection info
        vehicle_data: Vehicle details
        obd_data: OBD-2 diagnostics data
        answers_data: Inspection Q&A answers
        categories_info: Category-wise questions and answers
        market_price_data: Market price from web scraping (optional)
    
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
        
        # Add market price data if available
        if market_price_data and market_price_data.get("success"):
            data_summary["market_price_research"] = {
                "sources_count": market_price_data.get("sources_count", 0),
                "market_average": market_price_data.get("market_average", 0),
                "market_range": f"₹{market_price_data.get('market_min', 0):,} - ₹{market_price_data.get('market_max', 0):,}",
                "recommended_range": f"₹{market_price_data.get('recommended_min', 0):,} - ₹{market_price_data.get('recommended_max', 0):,}"
            }
        
        # Create enhanced AI prompt
        system_message = """You are an expert automotive inspector and vehicle valuation specialist in India.
Your task is to analyze vehicle inspection data and provide accurate, professional assessments.

IMPORTANT RULES:
1. Analyze EACH category's Q&A thoroughly
2. Provide SECTION-WISE assessment summaries
3. Rate each category based on the answers provided
4. Calculate overall rating as weighted average of category ratings
5. Consider negative answers (Poor, Bad, Damaged, etc.) seriously
6. You must respond ONLY with valid JSON - no markdown, no explanations, just the JSON object."""

        user_prompt = f"""Analyze this vehicle inspection data and provide a comprehensive assessment.

VEHICLE & INSPECTION DATA:
{json.dumps(data_summary, indent=2)}

Based on this data, provide your assessment in the following JSON format:
{{
    "overall_rating": <number 0-10, calculated as weighted average of category ratings>,
    "overall_rating_explanation": "<brief explanation of how rating was determined>",
    "recommended_to_buy": <true/false based on inspection findings>,
    "buy_recommendation_reason": "<reason for recommendation>",
    
    "market_value": {{
        "min": <recommended minimum value in INR - should be 5-10% below market if market data provided>,
        "max": <recommended maximum value in INR>,
        "confidence": "<high/medium/low based on data availability>"
    }},
    
    "assessment_summary": {{
        "overall": "<2-3 sentence professional summary of vehicle condition>",
        "engine_and_mechanical": "<assessment of engine, transmission, suspension based on Q&A>",
        "exterior_body": "<assessment of body, paint, dents, scratches based on Q&A>",
        "interior_comfort": "<assessment of seats, AC, electronics based on Q&A>",
        "safety_systems": "<assessment of brakes, airbags, safety features based on Q&A>",
        "documentation": "<assessment of papers, service history, insurance>"
    }},
    
    "key_highlights": [
        "<positive highlight 1>",
        "<positive highlight 2>"
    ],
    
    "concerns": [
        "<concern/issue 1 found in inspection>",
        "<concern/issue 2>"
    ],
    
    "condition_ratings": {{
        "engine": "<EXCELLENT/GOOD/FAIR/POOR based on engine-related Q&A>",
        "interior": "<EXCELLENT/GOOD/FAIR/POOR based on interior Q&A>",
        "exterior": "<EXCELLENT/GOOD/FAIR/POOR based on exterior Q&A>",
        "transmission": "<EXCELLENT/GOOD/FAIR/POOR based on transmission Q&A>"
    }},
    
    "category_ratings": {{
        "<EXACT_CATEGORY_NAME_FROM_DATA>": {{
            "rating": <number 0-10 based on analyzing ALL answers in this category>,
            "status": "<PASS if rating>=7, ATTENTION if rating>=4, FAIL if rating<4>",
            "summary": "<brief summary explaining why this rating was given based on Q&A answers>",
            "issues_found": ["<specific issue found from Q&A answers>"]
        }}
    }},
    
    "estimated_repairs": [
        {{
            "item": "<repair item identified from inspection>",
            "type": "<MINOR/MAJOR/CRITICAL>",
            "estimated_cost": <cost in INR>,
            "reason": "<why this repair is needed based on Q&A>"
        }}
    ],
    
    "risk_factors": [
        "<risk 1 based on inspection findings>"
    ],
    
    "recommendations": [
        "<recommendation 1 for buyer>",
        "<recommendation 2>"
    ]
}}

RATING GUIDELINES (0-10 scale):
- 10: Perfect - All answers positive, no issues at all
- 8-9: Excellent - Minor cosmetic issues only, fully functional
- 6-7: Good - Some wear but acceptable, minor attention needed
- 4-5: Fair - Multiple concerns, requires attention and repairs
- 2-3: Poor - Significant issues, major repairs needed
- 0-1: Bad - Critical problems, not recommended for purchase

IMPORTANT: You MUST provide a rating for EVERY category in the inspection_categories data.
Use the EXACT category name as provided in the data (e.g., "Engine Health and Diagnosis", "Exterior Inspection", etc.)
Analyze each question and answer carefully - negative answers should significantly reduce the rating.
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
                lines = cleaned_response.split("\n")
                lines = [line for line in lines if not line.strip().startswith("```")]
                cleaned_response = "\n".join(lines)
            
            ai_insights = json.loads(cleaned_response)
            logger.info("[AI_REPORT] Successfully parsed AI insights")
            
            # Validate and fill missing fields
            ai_insights = validate_ai_response(ai_insights, market_price_data)
            
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
        if isinstance(obd_data, dict):
            if "categories" in obd_data:
                for cat in obd_data.get("categories", []):
                    codes = cat.get("codes", [])
                    obd_summary["error_codes_count"] += len(codes)
                    obd_summary["error_codes"].extend([
                        {"code": c.get("code"), "description": c.get("description")}
                        for c in codes[:5]
                    ])
            elif "dtc_codes" in obd_data:
                obd_summary["error_codes"] = obd_data.get("dtc_codes", [])[:10]
                obd_summary["error_codes_count"] = len(obd_data.get("dtc_codes", []))
    
    # Process inspection answers by category - DETAILED Q&A
    categories_summary = {}
    for cat_id, cat_info in categories_info.items():
        cat_name = cat_info.get("name", cat_id)
        questions = cat_info.get("questions", [])
        
        answered_count = 0
        qa_pairs = []
        
        for q in questions:
            q_id = q.get("id") or q.get("question_id")
            q_text = q.get("text") or q.get("question_text", "")
            q_type = q.get("type") or q.get("question_type", "")
            q_options = q.get("options", [])
            
            # Get the answer for this question
            answer_data = answers_data.get(q_id, {})
            if answer_data:
                answered_count += 1
                
                # Extract the actual answer value
                if isinstance(answer_data, dict):
                    answer_value = answer_data.get("answer", "")
                    if isinstance(answer_value, dict):
                        answer_value = answer_value.get("selection", str(answer_value))
                else:
                    answer_value = str(answer_data)
                
                # Skip media URLs - just note that media was captured
                if isinstance(answer_value, str) and (
                    answer_value.startswith("http") or 
                    answer_value.startswith("gs://") or
                    answer_value.startswith("data:") or
                    answer_value.startswith("file://")
                ):
                    answer_value = "[Photo/Video Captured]"
                
                qa_pairs.append({
                    "question": q_text[:150],
                    "answer": str(answer_value)[:100] if answer_value else "Not answered",
                    "question_type": q_type,
                    "available_options": q_options[:5] if q_options else []
                })
        
        categories_summary[cat_name] = {
            "category_id": cat_id,
            "total_questions": len(questions),
            "answered": answered_count,
            "completion_rate": round((answered_count / len(questions) * 100) if questions else 0, 1),
            "questions_and_answers": qa_pairs
        }
    
    return {
        "vehicle": vehicle_summary,
        "obd_diagnostics": obd_summary,
        "inspection_categories": categories_summary,
        "inspection_date": inspection_data.get("created_at", ""),
        "city": inspection_data.get("city", "")
    }


def validate_ai_response(ai_response: Dict[str, Any], market_price_data: Dict[str, Any] = None) -> Dict[str, Any]:
    """Validate and fill missing fields in AI response"""
    
    defaults = get_default_insights()
    
    # Use market price data if AI didn't provide good values
    market_value = ai_response.get("market_value", {})
    if market_price_data and market_price_data.get("success"):
        if not market_value.get("min") or market_value.get("min") == 0:
            market_value["min"] = market_price_data.get("recommended_min", 0)
        if not market_value.get("max") or market_value.get("max") == 0:
            market_value["max"] = market_price_data.get("recommended_max", 0)
        market_value["market_research_available"] = True
        market_value["market_average"] = market_price_data.get("market_average", 0)
    
    # Ensure all required fields exist
    validated = {
        "overall_rating": ai_response.get("overall_rating", defaults["overall_rating"]),
        "overall_rating_explanation": ai_response.get("overall_rating_explanation", ""),
        "recommended_to_buy": ai_response.get("recommended_to_buy", defaults["recommended_to_buy"]),
        "buy_recommendation_reason": ai_response.get("buy_recommendation_reason", ""),
        "market_value": market_value or defaults["market_value"],
        "assessment_summary": ai_response.get("assessment_summary", defaults["assessment_summary"]),
        "key_highlights": ai_response.get("key_highlights", defaults["key_highlights"]),
        "concerns": ai_response.get("concerns", []),
        "condition_ratings": ai_response.get("condition_ratings", defaults["condition_ratings"]),
        "category_ratings": ai_response.get("category_ratings", defaults["category_ratings"]),
        "estimated_repairs": ai_response.get("estimated_repairs", []),
        "risk_factors": ai_response.get("risk_factors", defaults["risk_factors"]),
        "recommendations": ai_response.get("recommendations", defaults["recommendations"]),
        "ai_generated": True,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Validate rating is within bounds (0-10 scale)
    if not 0 <= validated["overall_rating"] <= 10:
        validated["overall_rating"] = 5
    
    return validated


def get_default_insights() -> Dict[str, Any]:
    """Return default insights when AI generation fails"""
    return {
        "overall_rating": 0,
        "overall_rating_explanation": "Assessment pending",
        "recommended_to_buy": False,
        "buy_recommendation_reason": "Complete inspection required",
        "market_value": {
            "min": 0,
            "max": 0,
            "confidence": "low"
        },
        "assessment_summary": {
            "overall": "Vehicle inspection completed. AI analysis pending.",
            "engine_and_mechanical": "Pending analysis",
            "exterior_body": "Pending analysis",
            "interior_comfort": "Pending analysis",
            "safety_systems": "Pending analysis",
            "documentation": "Pending analysis"
        },
        "key_highlights": [],
        "concerns": [],
        "condition_ratings": {
            "engine": "PENDING",
            "interior": "PENDING",
            "exterior": "PENDING",
            "transmission": "PENDING"
        },
        "category_ratings": {},
        "estimated_repairs": [],
        "risk_factors": [],
        "recommendations": ["Complete all inspection categories for accurate assessment"],
        "ai_generated": False,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


async def generate_category_rating(
    category_name: str,
    questions_and_answers: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Generate rating for a single category based on Q&A.
    Called when mechanic submits answers for a category.
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return {"rating": 0, "status": "PENDING", "summary": "AI unavailable"}
        
        # Prepare Q&A for analysis
        qa_text = "\n".join([
            f"Q: {qa['question']}\nA: {qa['answer']}"
            for qa in questions_and_answers
        ])
        
        prompt = f"""Analyze this inspection category and provide a rating.

Category: {category_name}

Questions and Answers:
{qa_text}

Respond with ONLY JSON in this format:
{{
    "rating": <1-5 number>,
    "status": "<PASS/ATTENTION/FAIL>",
    "summary": "<brief assessment>",
    "issues_found": ["<issue if any>"]
}}

Rating guide:
- 5: All answers indicate excellent condition
- 4: Good condition with minor issues
- 3: Fair, some concerns
- 2: Poor, needs repairs
- 1: Bad, major problems"""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"category-rating-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            system_message="You are a vehicle inspection expert. Respond only with JSON."
        ).with_model("openai", "gpt-5.2")
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse response
        cleaned = response.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)
        
        return json.loads(cleaned)
        
    except Exception as e:
        logger.error(f"[AI_CATEGORY_RATING] Error: {e}")
        return {"rating": 0, "status": "PENDING", "summary": "Rating pending"}
