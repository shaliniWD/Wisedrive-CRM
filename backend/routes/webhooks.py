"""
Webhooks Routes
Handles Twilio WhatsApp webhooks and other external integrations
"""
from fastapi import APIRouter, Request, HTTPException, Form
from typing import Optional
from datetime import datetime, timezone
import logging

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

logger = logging.getLogger(__name__)

# These will be injected from main server
db = None


def init_webhooks_routes(database):
    """Initialize webhooks routes with database"""
    global db
    db = database


# Note: The actual webhook implementations remain in server.py for now
# This file serves as a template for future migration

"""
@router.post("/twilio/whatsapp")
async def twilio_whatsapp_webhook(
    request: Request,
    MessageSid: str = Form(None),
    AccountSid: str = Form(None),
    From: str = Form(None),
    To: str = Form(None),
    Body: str = Form(None),
    ProfileName: str = Form(None),
    # CTWA (Click-to-WhatsApp) parameters
    ReferralSourceUrl: Optional[str] = Form(None),
    ReferralHeadline: Optional[str] = Form(None),
    ReferralBody: Optional[str] = Form(None),
    ReferralSourceType: Optional[str] = Form(None),
    ReferralSourceId: Optional[str] = Form(None),
    ReferralCtwaClid: Optional[str] = Form(None),
    ButtonText: Optional[str] = Form(None),
    CtwaClid: Optional[str] = Form(None),
):
    '''
    Handle incoming WhatsApp messages from Twilio
    
    This webhook receives:
    - Direct WhatsApp messages
    - Click-to-WhatsApp (CTWA) messages from Meta Ads
    
    CTWA data includes:
    - ReferralSourceId: The Meta Ad ID (primary identifier)
    - ReferralCtwaClid: Secondary CTWA click ID
    - ReferralSourceUrl: The ad URL
    - ReferralHeadline: Ad headline
    - ReferralBody: Ad body text
    '''
    
    # Audit trail for debugging
    audit_data = {
        "webhook_received_at": datetime.now(timezone.utc).isoformat(),
        "raw_form_data": dict(await request.form()),
        "message_sid": MessageSid,
        "from": From,
        "profile_name": ProfileName,
        "body": Body,
        "ctwa_data": {
            "referral_source_id": ReferralSourceId,
            "referral_ctwa_clid": ReferralCtwaClid,
            "referral_source_url": ReferralSourceUrl,
            "referral_headline": ReferralHeadline,
            "referral_body": ReferralBody,
            "referral_source_type": ReferralSourceType,
            "button_text": ButtonText,
            "ctwa_clid": CtwaClid
        }
    }
    
    # Extract phone number
    phone = From.replace("whatsapp:", "").replace("+", "") if From else None
    if not phone:
        logger.error("No phone number in webhook")
        return {"status": "error", "message": "No phone number"}
    
    # ... rest of webhook processing
    # See server.py lines 2700-3500 for full implementation
    
    return {"status": "success"}


@router.post("/twilio/status")
async def twilio_status_webhook(request: Request):
    '''Handle Twilio message status callbacks'''
    form_data = await request.form()
    
    message_sid = form_data.get("MessageSid")
    message_status = form_data.get("MessageStatus")
    
    logger.info(f"Message {message_sid} status: {message_status}")
    
    return {"status": "received"}
"""
