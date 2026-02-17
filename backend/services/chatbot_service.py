"""
WhatsApp Chatbot Service for WiseDrive
AI-powered chatbot using GPT for intelligent customer interactions.
Handles greeting messages, option selection, and context-aware conversations.
"""

import os
import logging
import uuid
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Try to import emergentintegrations for AI
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    logger.warning("emergentintegrations not installed. Chatbot will use template responses.")


class ChatbotService:
    """
    WhatsApp Chatbot Service for WiseDrive CRM.
    Provides AI-powered responses and menu-driven interactions.
    """
    
    def __init__(self, db, twilio_service):
        self.db = db
        self.twilio = twilio_service
        self.api_key = os.environ.get("EMERGENT_LLM_KEY")
        
        # System prompt for AI
        self.system_prompt = """You are WiseDrive's friendly WhatsApp assistant. WiseDrive is India's premium used car inspection company.

Your role:
1. Greet customers warmly
2. Help them understand our services
3. Answer questions about car inspections
4. Guide them to either buy an inspection package or request a callback

Key information about WiseDrive:
- We provide comprehensive pre-purchase used car inspections
- Our inspections cover 200+ checkpoints including engine, transmission, body, electrical, etc.
- We operate in major Indian cities including Bangalore, Hyderabad, Chennai, Mumbai, Delhi, Vizag
- Inspection reports are delivered within 24 hours
- Prices start from ₹999 for basic inspection

Response guidelines:
- Keep responses concise (under 200 words)
- Be friendly and professional
- Use emojis sparingly but appropriately
- Always offer next steps
- If unsure, offer to connect with a sales representative

DO NOT:
- Make up prices or offers not mentioned
- Promise specific discounts without verification
- Share competitor information
"""
        
        # Menu options
        self.GREETING_MESSAGE = """🙏 *Welcome to WiseDrive!*

India's Premium Used Car Inspection Company

We help you make confident decisions when buying a used car with our comprehensive 200+ point inspection.

*How can we help you today?*

1️⃣ *Buy Inspection* - View our packages and pricing
2️⃣ *Request Call Back* - Speak with our expert

_Reply with 1 or 2 to continue_"""

        self.BUY_INSPECTION_MESSAGE = """📋 *Our Inspection Packages*

*Basic Inspection - ₹999*
✓ 100+ point check
✓ Engine & transmission
✓ Report in 24 hours

*Standard Inspection - ₹1,999*
✓ 150+ point check
✓ Road test included
✓ Detailed report

*Premium Inspection - ₹2,999*
✓ 200+ point check
✓ OBD diagnostic
✓ Expert consultation

*Reply with package name to proceed or type "callback" for assistance*"""

        self.CALLBACK_MESSAGE = """📞 *Request Received!*

Our sales representative will call you within the next 30 minutes.

In the meantime, feel free to ask any questions about:
• Our inspection process
• Pricing and packages
• Service areas

_Type your question or wait for our callback!_"""

    async def handle_message(
        self,
        phone: str,
        message: str,
        lead_id: str,
        is_existing_lead: bool = False
    ) -> Dict[str, Any]:
        """
        Handle incoming WhatsApp message and generate appropriate response.
        
        Args:
            phone: Customer's phone number
            message: Message content
            lead_id: Associated lead ID
            is_existing_lead: Whether this is an existing lead messaging again
        """
        try:
            # Get or create conversation state
            conversation = await self._get_conversation_state(lead_id)
            
            # Determine response based on state and message
            if is_existing_lead:
                # Existing lead messaging again - they want callback
                response = await self._handle_existing_lead(phone, message, lead_id, conversation)
            else:
                # New lead - send greeting
                response = await self._handle_new_lead(phone, message, lead_id)
            
            # Save conversation state
            await self._save_conversation_state(lead_id, conversation)
            
            # Send response via Twilio
            if response and self.twilio:
                await self.twilio.send_message(
                    to_number=phone,
                    message=response
                )
                
                # Log the bot response
                await self._log_bot_response(lead_id, response)
            
            return {"success": True, "response_sent": bool(response)}
            
        except Exception as e:
            logger.error(f"Chatbot error for lead {lead_id}: {e}")
            return {"success": False, "error": str(e)}
    
    async def _get_conversation_state(self, lead_id: str) -> Dict[str, Any]:
        """Get conversation state from database"""
        state = await self.db.chatbot_conversations.find_one(
            {"lead_id": lead_id},
            {"_id": 0}
        )
        if not state:
            state = {
                "lead_id": lead_id,
                "current_state": "initial",
                "messages": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        return state
    
    async def _save_conversation_state(self, lead_id: str, state: Dict[str, Any]):
        """Save conversation state to database"""
        state["updated_at"] = datetime.now(timezone.utc).isoformat()
        await self.db.chatbot_conversations.update_one(
            {"lead_id": lead_id},
            {"$set": state},
            upsert=True
        )
    
    async def _handle_new_lead(
        self,
        phone: str,
        message: str,
        lead_id: str
    ) -> str:
        """Handle message from new lead - send greeting"""
        return self.GREETING_MESSAGE
    
    async def _handle_existing_lead(
        self,
        phone: str,
        message: str,
        lead_id: str,
        conversation: Dict[str, Any]
    ) -> str:
        """Handle message from existing lead based on conversation state"""
        message_lower = message.lower().strip()
        current_state = conversation.get("current_state", "initial")
        
        # Add message to conversation history
        conversation.setdefault("messages", []).append({
            "role": "user",
            "content": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Handle menu selections
        if message_lower in ["1", "buy inspection", "buy", "inspection", "packages"]:
            conversation["current_state"] = "viewing_packages"
            return self.BUY_INSPECTION_MESSAGE
        
        elif message_lower in ["2", "callback", "call back", "call", "request call back", "rcb"]:
            conversation["current_state"] = "callback_requested"
            # Update lead status
            await self.db.leads.update_one(
                {"id": lead_id},
                {"$set": {"status": "RCB WHATSAPP"}}
            )
            return self.CALLBACK_MESSAGE
        
        elif message_lower in ["basic", "basic inspection"]:
            conversation["current_state"] = "package_selected"
            conversation["selected_package"] = "basic"
            return self._get_package_confirmation("Basic", 999)
        
        elif message_lower in ["standard", "standard inspection"]:
            conversation["current_state"] = "package_selected"
            conversation["selected_package"] = "standard"
            return self._get_package_confirmation("Standard", 1999)
        
        elif message_lower in ["premium", "premium inspection"]:
            conversation["current_state"] = "package_selected"
            conversation["selected_package"] = "premium"
            return self._get_package_confirmation("Premium", 2999)
        
        elif message_lower in ["hi", "hello", "hey", "menu", "start"]:
            conversation["current_state"] = "initial"
            return self.GREETING_MESSAGE
        
        else:
            # Use AI for context-aware response
            if AI_AVAILABLE and self.api_key:
                return await self._get_ai_response(message, lead_id, conversation)
            else:
                # Fallback to template
                return self._get_fallback_response(current_state)
    
    def _get_package_confirmation(self, package_name: str, price: int) -> str:
        """Generate package confirmation message"""
        return f"""✅ *{package_name} Inspection - ₹{price:,}*

Great choice! To proceed with booking:

1️⃣ Our sales representative will call you to confirm details
2️⃣ Share the vehicle registration number
3️⃣ Choose inspection date & location

*Would you like us to call you now?*

_Reply "yes" for immediate callback or type your questions_"""
    
    def _get_fallback_response(self, current_state: str) -> str:
        """Get fallback response when AI is not available"""
        if current_state == "viewing_packages":
            return """I'd be happy to help! 

You can:
• Reply with a *package name* (Basic/Standard/Premium) to proceed
• Type *"callback"* to speak with our expert
• Type *"menu"* to see all options"""
        
        return """Thank you for your message! 🙏

Our team will get back to you shortly. Meanwhile:

1️⃣ Type *"1"* to view inspection packages
2️⃣ Type *"2"* to request a callback

_Or type your question and we'll respond soon!_"""
    
    async def _get_ai_response(
        self,
        message: str,
        lead_id: str,
        conversation: Dict[str, Any]
    ) -> str:
        """Generate AI-powered response using GPT"""
        try:
            # Get lead details for context
            lead = await self.db.leads.find_one({"id": lead_id}, {"_id": 0})
            
            # Build context
            context = f"""
Customer Info:
- Name: {lead.get('name', 'Unknown')}
- City: {lead.get('city', 'Unknown')}
- Current Status: {lead.get('status', 'Unknown')}

Conversation State: {conversation.get('current_state', 'initial')}
"""
            
            # Initialize chat
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"wisedrive-{lead_id}",
                system_message=self.system_prompt + "\n\nContext:\n" + context
            ).with_model("openai", "gpt-5.2")
            
            # Build conversation history for context
            history_messages = conversation.get("messages", [])[-5:]  # Last 5 messages
            for msg in history_messages[:-1]:  # Exclude current message
                if msg["role"] == "user":
                    await chat.send_message(UserMessage(text=msg["content"]))
            
            # Send current message and get response
            user_message = UserMessage(text=message)
            response = await chat.send_message(user_message)
            
            # Add menu reminder
            response += "\n\n_Type \"menu\" for options or \"callback\" to speak with our team_"
            
            return response
            
        except Exception as e:
            logger.error(f"AI response error: {e}")
            return self._get_fallback_response(conversation.get("current_state", "initial"))
    
    async def _log_bot_response(self, lead_id: str, response: str):
        """Log chatbot response as activity"""
        activity = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "user_id": "chatbot",
            "user_name": "WiseDrive Bot",
            "action": "chatbot_response",
            "details": "Automated WhatsApp response sent",
            "new_value": response[:500],  # Truncate for storage
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await self.db.lead_activities.insert_one(activity)


# Singleton instance
chatbot_service: Optional[ChatbotService] = None


def get_chatbot_service() -> Optional[ChatbotService]:
    """Get or create ChatbotService instance"""
    global chatbot_service
    return chatbot_service


def init_chatbot_service(db, twilio_service) -> ChatbotService:
    """Initialize ChatbotService with database and Twilio"""
    global chatbot_service
    chatbot_service = ChatbotService(db, twilio_service)
    logger.info("ChatbotService initialized")
    return chatbot_service
