"""
Meta Ads Routes
Handles Meta/Facebook Ads API integration
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

router = APIRouter(prefix="/meta-ads", tags=["Meta Ads"])

# These will be injected from main server
db = None
get_current_user = None
meta_ads_service = None


def init_meta_ads_routes(database, auth_dependency, ads_service):
    """Initialize meta ads routes with dependencies"""
    global db, get_current_user, meta_ads_service
    db = database
    get_current_user = auth_dependency
    meta_ads_service = ads_service


class AdCityMapping(BaseModel):
    ad_id: str
    city: str
    city_id: Optional[str] = None
    ad_name: Optional[str] = None
    ad_amount: Optional[float] = None
    language: Optional[str] = None
    campaign: Optional[str] = None
    source: Optional[str] = None
    is_active: bool = True
    partner_id: Optional[str] = None
    partner_name: Optional[str] = None


class AdCityMappingUpdate(BaseModel):
    city: Optional[str] = None
    city_id: Optional[str] = None
    ad_name: Optional[str] = None
    ad_amount: Optional[float] = None
    language: Optional[str] = None
    campaign: Optional[str] = None
    source: Optional[str] = None
    is_active: Optional[bool] = None
    partner_id: Optional[str] = None
    partner_name: Optional[str] = None


# Note: The actual route implementations remain in server.py for now
# This file serves as a template for future migration

"""
@router.get("/token-info")
async def get_meta_token_info(current_user: dict = Depends(get_current_user)):
    '''Get Meta API token status'''
    settings = await db.settings.find_one({"key": "meta_access_token"}, {"_id": 0})
    
    if not settings or not settings.get("value"):
        return {
            "has_token": False,
            "is_valid": False,
            "message": "No token configured"
        }
    
    # Check token validity with Meta API
    token = settings.get("value")
    is_valid = await meta_ads_service.validate_token(token)
    
    return {
        "has_token": True,
        "is_valid": is_valid,
        "updated_at": settings.get("updated_at"),
        "expires_at": settings.get("expires_at")
    }


@router.post("/token")
async def set_meta_token(token: str, current_user: dict = Depends(get_current_user)):
    '''Set/Update Meta API access token'''
    # Validate token first
    is_valid = await meta_ads_service.validate_token(token)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid token")
    
    # Store token
    await db.settings.update_one(
        {"key": "meta_access_token"},
        {"$set": {
            "key": "meta_access_token",
            "value": token,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"message": "Token updated successfully"}


@router.get("/ad-city-mappings")
async def get_ad_city_mappings(current_user: dict = Depends(get_current_user)):
    '''Get all ad-to-city mappings'''
    mappings = await db.ad_city_mappings.find({}, {"_id": 0}).to_list(1000)
    return mappings


@router.post("/ad-city-mappings")
async def create_ad_city_mapping(data: AdCityMapping, current_user: dict = Depends(get_current_user)):
    '''Create a new ad-to-city mapping'''
    import uuid
    
    mapping = {
        "id": str(uuid.uuid4()),
        **data.dict(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.ad_city_mappings.insert_one(mapping)
    mapping.pop("_id", None)
    return mapping


@router.put("/ad-city-mappings/{mapping_id}")
async def update_ad_city_mapping(
    mapping_id: str, 
    data: AdCityMappingUpdate, 
    current_user: dict = Depends(get_current_user)
):
    '''Update an ad-to-city mapping'''
    existing = await db.ad_city_mappings.find_one({"id": mapping_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.ad_city_mappings.update_one({"id": mapping_id}, {"$set": update_data})
    updated = await db.ad_city_mappings.find_one({"id": mapping_id}, {"_id": 0})
    return updated


@router.delete("/ad-city-mappings/{mapping_id}")
async def delete_ad_city_mapping(mapping_id: str, current_user: dict = Depends(get_current_user)):
    '''Delete an ad-to-city mapping'''
    result = await db.ad_city_mappings.delete_one({"id": mapping_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"message": "Mapping deleted"}


@router.post("/sync-ad-name-mappings")
async def sync_ad_name_mappings(current_user: dict = Depends(get_current_user)):
    '''
    Sync ads from Meta API and create city mappings
    
    This fetches all ads from the connected Meta account and 
    creates ad_city_mappings based on the ad targeting data.
    '''
    # Get ads from Meta API
    ads = await meta_ads_service.get_all_ads()
    
    created_count = 0
    updated_count = 0
    
    for ad in ads:
        ad_id = ad.get("id")
        ad_name = ad.get("name")
        
        # Check if mapping already exists
        existing = await db.ad_city_mappings.find_one({"ad_id": ad_id}, {"_id": 0})
        
        if existing:
            # Update existing
            await db.ad_city_mappings.update_one(
                {"ad_id": ad_id},
                {"$set": {"ad_name": ad_name, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            updated_count += 1
        else:
            # Create new - will need manual city assignment
            mapping = {
                "id": str(uuid.uuid4()),
                "ad_id": ad_id,
                "ad_name": ad_name,
                "city": None,  # Needs manual assignment
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.ad_city_mappings.insert_one(mapping)
            created_count += 1
    
    return {
        "message": "Sync complete",
        "created": created_count,
        "updated": updated_count
    }
"""
