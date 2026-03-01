"""
Meta Ads Module Routes - Facebook/Meta Advertising Integration
Handles all Meta Ads related endpoints including:
- Campaign management
- Lead sync from Meta
- Ad performance tracking
- Webhook handling for lead forms
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import logging

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/meta-ads", tags=["Meta Ads"])

# Security scheme
security = HTTPBearer()

# Dependencies - set via init_meta_ads_routes
db = None
_auth_validator = None
meta_ads_service = None


class CampaignCreate(BaseModel):
    name: str
    objective: str
    status: str = "PAUSED"
    budget: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class AdMapping(BaseModel):
    ad_id: str
    ad_name: str
    campaign_id: str
    campaign_name: str
    form_id: Optional[str] = None


def init_meta_ads_routes(_db, _get_current_user, _meta_ads_service=None):
    """Initialize meta ads routes with dependencies"""
    global db, _auth_validator, meta_ads_service
    db = _db
    _auth_validator = _get_current_user
    meta_ads_service = _meta_ads_service


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Authenticate user using the injected validator"""
    if _auth_validator is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _auth_validator(credentials)


# ==================== META ADS STATUS ====================

@router.get("/status")
async def get_meta_ads_status(current_user: dict = Depends(get_current_user)):
    """Get Meta Ads connection status"""
    # Check if we have a valid token stored
    token_doc = await db.meta_tokens.find_one({"type": "access_token"}, {"_id": 0})
    
    if not token_doc:
        return {"connected": False, "message": "No access token configured"}
    
    expires_at = token_doc.get("expires_at")
    if expires_at:
        try:
            expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expiry:
                return {"connected": False, "message": "Token expired", "expired_at": expires_at}
        except ValueError:
            pass
    
    return {
        "connected": True,
        "token_updated_at": token_doc.get("updated_at"),
        "account_id": token_doc.get("account_id")
    }


# ==================== CAMPAIGNS ====================

@router.get("/campaigns")
async def get_campaigns(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all Meta Ads campaigns"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "MARKETING_HEAD", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if status:
        query["status"] = status
    
    campaigns = await db.meta_campaigns.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return campaigns


@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific campaign details"""
    campaign = await db.meta_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return campaign


@router.get("/campaigns/{campaign_id}/leads")
async def get_campaign_leads(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get leads from a specific campaign"""
    leads = await db.leads.find(
        {"campaign_id": campaign_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return leads


@router.get("/campaigns/{campaign_id}/stats")
async def get_campaign_stats(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get statistics for a specific campaign"""
    # Count leads
    total_leads = await db.leads.count_documents({"campaign_id": campaign_id})
    
    # Count by status
    pipeline = [
        {"$match": {"campaign_id": campaign_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.leads.aggregate(pipeline).to_list(20)
    status_map = {s["_id"]: s["count"] for s in status_counts}
    
    # Count conversions (paid)
    conversions = await db.leads.count_documents({
        "campaign_id": campaign_id,
        "payment_status": "paid"
    })
    
    return {
        "campaign_id": campaign_id,
        "total_leads": total_leads,
        "conversions": conversions,
        "conversion_rate": round(conversions / total_leads * 100, 2) if total_leads > 0 else 0,
        "status_breakdown": status_map
    }


# ==================== AD MAPPINGS ====================

@router.get("/ad-mappings")
async def get_ad_mappings(current_user: dict = Depends(get_current_user)):
    """Get all ad-to-campaign mappings"""
    mappings = await db.ad_mappings.find({}, {"_id": 0}).to_list(500)
    return mappings


@router.post("/ad-mappings")
async def create_ad_mapping(
    data: AdMapping,
    current_user: dict = Depends(get_current_user)
):
    """Create or update ad mapping"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "MARKETING_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    mapping = {
        **data.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert by ad_id
    await db.ad_mappings.update_one(
        {"ad_id": data.ad_id},
        {"$set": mapping, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return mapping


# ==================== LEADS SYNC ====================

@router.get("/leads")
async def get_meta_leads(
    days: int = 30,
    campaign_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get leads from Meta Ads"""
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    query = {
        "source": "meta_ads",
        "created_at": {"$gte": cutoff_date}
    }
    
    if campaign_id:
        query["campaign_id"] = campaign_id
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return leads


@router.post("/sync-leads")
async def sync_leads_from_meta(
    campaign_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger lead sync from Meta"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "MARKETING_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if meta_ads_service is None:
        return {"message": "Meta Ads service not configured", "synced": 0}
    
    try:
        result = await meta_ads_service.sync_leads(campaign_id)
        return {"message": "Sync completed", "synced": result.get("count", 0)}
    except Exception as e:
        logger.error(f"Lead sync failed: {str(e)}")
        return {"message": f"Sync failed: {str(e)}", "synced": 0}


# ==================== ANALYTICS ====================

@router.get("/analytics/overview")
async def get_analytics_overview(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get Meta Ads analytics overview"""
    role_code = current_user.get("role_code", "")
    
    if role_code not in ["CEO", "MARKETING_HEAD", "COUNTRY_HEAD", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Total leads from Meta
    total_leads = await db.leads.count_documents({
        "source": "meta_ads",
        "created_at": {"$gte": cutoff_date}
    })
    
    # Conversions
    conversions = await db.leads.count_documents({
        "source": "meta_ads",
        "payment_status": "paid",
        "created_at": {"$gte": cutoff_date}
    })
    
    # Leads by campaign
    pipeline = [
        {"$match": {"source": "meta_ads", "created_at": {"$gte": cutoff_date}}},
        {"$group": {"_id": "$campaign_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    by_campaign = await db.leads.aggregate(pipeline).to_list(10)
    
    # Leads by day
    daily_pipeline = [
        {"$match": {"source": "meta_ads", "created_at": {"$gte": cutoff_date}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_counts = await db.leads.aggregate(daily_pipeline).to_list(days)
    
    return {
        "period_days": days,
        "total_leads": total_leads,
        "conversions": conversions,
        "conversion_rate": round(conversions / total_leads * 100, 2) if total_leads > 0 else 0,
        "by_campaign": by_campaign,
        "daily_trend": daily_counts
    }


@router.get("/analytics/campaign/{campaign_id}")
async def get_campaign_analytics(
    campaign_id: str,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed analytics for a campaign"""
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get campaign info
    campaign = await db.meta_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    
    # Lead stats
    total_leads = await db.leads.count_documents({
        "campaign_id": campaign_id,
        "created_at": {"$gte": cutoff_date}
    })
    
    conversions = await db.leads.count_documents({
        "campaign_id": campaign_id,
        "payment_status": "paid",
        "created_at": {"$gte": cutoff_date}
    })
    
    # Status breakdown
    status_pipeline = [
        {"$match": {"campaign_id": campaign_id, "created_at": {"$gte": cutoff_date}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_breakdown = await db.leads.aggregate(status_pipeline).to_list(20)
    
    # City breakdown
    city_pipeline = [
        {"$match": {"campaign_id": campaign_id, "created_at": {"$gte": cutoff_date}}},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    city_breakdown = await db.leads.aggregate(city_pipeline).to_list(10)
    
    return {
        "campaign": campaign,
        "period_days": days,
        "total_leads": total_leads,
        "conversions": conversions,
        "conversion_rate": round(conversions / total_leads * 100, 2) if total_leads > 0 else 0,
        "status_breakdown": {s["_id"]: s["count"] for s in status_breakdown},
        "city_breakdown": city_breakdown
    }


# ==================== WEBHOOK ====================

@router.post("/webhook")
async def meta_ads_webhook(request: Request):
    """Handle Meta Ads webhook for real-time lead updates"""
    try:
        payload = await request.json()
        logger.info(f"Meta Ads webhook received: {payload}")
        
        # Handle verification challenge
        if "hub.challenge" in request.query_params:
            return int(request.query_params["hub.challenge"])
        
        # Process lead form submissions
        if "entry" in payload:
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    if change.get("field") == "leadgen":
                        lead_data = change.get("value", {})
                        
                        # Extract lead info
                        lead = {
                            "id": str(uuid.uuid4()),
                            "meta_lead_id": lead_data.get("leadgen_id"),
                            "form_id": lead_data.get("form_id"),
                            "ad_id": lead_data.get("ad_id"),
                            "campaign_id": None,  # Will be enriched from ad mappings
                            "source": "meta_ads",
                            "status": "new",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "raw_data": lead_data
                        }
                        
                        # Get ad mapping for campaign info
                        if lead_data.get("ad_id"):
                            mapping = await db.ad_mappings.find_one({"ad_id": lead_data["ad_id"]}, {"_id": 0})
                            if mapping:
                                lead["campaign_id"] = mapping.get("campaign_id")
                                lead["campaign_name"] = mapping.get("campaign_name")
                                lead["ad_name"] = mapping.get("ad_name")
                        
                        await db.leads.insert_one(lead)
                        logger.info(f"Lead created from Meta webhook: {lead['id']}")
        
        return {"status": "received"}
    
    except Exception as e:
        logger.error(f"Meta webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}


@router.get("/webhook")
async def verify_meta_webhook(request: Request):
    """Handle Meta webhook verification"""
    import os
    
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    
    verify_token = os.environ.get("META_WEBHOOK_VERIFY_TOKEN", "wisedrive_meta_verify")
    
    if mode == "subscribe" and token == verify_token:
        logger.info("Meta webhook verified successfully")
        return int(challenge)
    
    raise HTTPException(status_code=403, detail="Verification failed")
