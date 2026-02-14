"""
Wisedrive API Services - Invincible Ocean Integration
Vehicle data lookup from external API
"""
from typing import Optional, Dict, Any
import logging
import hashlib
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


class InvincibleOceanClient:
    """
    Invincible Ocean API client for vehicle data lookup.
    
    IMPORTANT: 
    - API calls must ONLY be made from backend
    - API keys must NEVER be exposed to frontend
    - Responses should be cached to minimize API calls
    - All failures must be logged for debugging
    
    Flow:
    1. Frontend requests vehicle lookup via Wisedrive API
    2. Backend checks cache first
    3. If cache miss, call Invincible Ocean API
    4. Normalize response to Wisedrive format
    5. Cache result (24 hours)
    6. Return normalized data to frontend
    """
    
    CACHE_TTL_HOURS = 24
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.invincibleocean.com"
    ):
        self.api_key = api_key
        self.base_url = base_url
        self._cache: Dict[str, Dict] = {}  # In-memory cache (use Redis in production)
    
    def _get_cache_key(self, registration_number: str) -> str:
        """Generate cache key for registration number"""
        return hashlib.md5(registration_number.upper().encode()).hexdigest()
    
    def _is_cache_valid(self, cached: Dict) -> bool:
        """Check if cached data is still valid"""
        if not cached:
            return False
        
        cached_at = cached.get("_cached_at")
        if not cached_at:
            return False
        
        expiry = datetime.fromisoformat(cached_at) + timedelta(hours=self.CACHE_TTL_HOURS)
        return datetime.now(timezone.utc) < expiry
    
    async def lookup_vehicle(
        self,
        registration_number: str,
        include_owner: bool = False,
        include_insurance: bool = False,
        include_challan: bool = False
    ) -> Dict[str, Any]:
        """
        Lookup vehicle data by registration number.
        
        Args:
            registration_number: Vehicle registration (e.g., KA01AB1234)
            include_owner: Include owner details (may cost extra)
            include_insurance: Include insurance validity
            include_challan: Include pending challans
            
        Returns:
            Normalized vehicle data
        """
        reg_number = registration_number.upper().strip().replace(" ", "")
        cache_key = self._get_cache_key(reg_number)
        
        # Check cache
        cached = self._cache.get(cache_key)
        if self._is_cache_valid(cached):
            logger.info(f"Cache hit for vehicle {reg_number}")
            return cached["data"]
        
        # Make API call
        try:
            raw_response = await self._call_api(
                reg_number,
                include_owner,
                include_insurance,
                include_challan
            )
            
            # Normalize response
            normalized = self._normalize_response(raw_response)
            
            # Cache result
            self._cache[cache_key] = {
                "data": normalized,
                "_cached_at": datetime.now(timezone.utc).isoformat()
            }
            
            logger.info(f"Successfully fetched vehicle data for {reg_number}")
            
            return normalized
            
        except Exception as e:
            logger.error(f"Failed to lookup vehicle {reg_number}: {e}")
            raise
    
    async def _call_api(
        self,
        registration_number: str,
        include_owner: bool,
        include_insurance: bool,
        include_challan: bool
    ) -> Dict[str, Any]:
        """
        Make actual API call to Invincible Ocean.
        
        This is a placeholder - actual implementation would use httpx/aiohttp.
        """
        import httpx
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/rc/vehicle",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "registration_number": registration_number,
                    "include_owner": include_owner,
                    "include_insurance": include_insurance,
                    "include_challan": include_challan
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                return {"found": False}
            else:
                logger.error(f"API error: {response.status_code} - {response.text}")
                raise Exception(f"API error: {response.status_code}")
    
    def _normalize_response(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize Invincible Ocean response to Wisedrive format.
        
        This mapping handles differences between external API 
        and our internal data model.
        """
        if not raw.get("found", True):
            return {"found": False}
        
        # Map fields from Invincible Ocean format to Wisedrive format
        # Field names may vary based on actual API response
        data = raw.get("data", raw)
        
        return {
            "found": True,
            "registration_number": data.get("registration_number") or data.get("reg_no"),
            "vin": data.get("vin") or data.get("chassis_number"),
            "engine_number": data.get("engine_number") or data.get("engine_no"),
            "make": data.get("maker") or data.get("manufacturer"),
            "model": data.get("model") or data.get("model_name"),
            "variant": data.get("variant"),
            "fuel_type": self._normalize_fuel_type(data.get("fuel_type")),
            "color": data.get("color") or data.get("vehicle_color"),
            "manufacturing_year": data.get("manufacturing_year") or data.get("year_of_manufacture"),
            "registration_date": data.get("registration_date") or data.get("reg_date"),
            "owner_name": data.get("owner_name"),
            "owner_count": data.get("owner_count") or data.get("no_of_owners"),
            "rto": data.get("rto") or data.get("registering_authority"),
            "fitness_valid_until": data.get("fitness_upto") or data.get("fitness_validity"),
            "insurance_valid_until": data.get("insurance_upto") or data.get("insurance_validity"),
            "puc_valid_until": data.get("puc_upto") or data.get("puc_validity"),
            "hypothecated": data.get("hypothecation") == "Yes" or data.get("financed", False),
            "hypothecated_to": data.get("hypothecated_to") or data.get("financer"),
            "blacklisted": data.get("blacklisted", False) or data.get("noc_issued", False),
            "challan_pending": data.get("challan_count") or data.get("pending_challans", 0),
            "raw_response": raw  # Keep original for debugging
        }
    
    def _normalize_fuel_type(self, fuel: Optional[str]) -> Optional[str]:
        """Normalize fuel type to standard values"""
        if not fuel:
            return None
        
        fuel_lower = fuel.lower()
        
        if "petrol" in fuel_lower:
            return "petrol"
        elif "diesel" in fuel_lower:
            return "diesel"
        elif "cng" in fuel_lower:
            return "cng"
        elif "electric" in fuel_lower:
            return "electric"
        elif "hybrid" in fuel_lower:
            return "hybrid"
        else:
            return fuel
    
    def clear_cache(self, registration_number: Optional[str] = None):
        """Clear cache for specific vehicle or all"""
        if registration_number:
            cache_key = self._get_cache_key(registration_number)
            self._cache.pop(cache_key, None)
        else:
            self._cache.clear()
