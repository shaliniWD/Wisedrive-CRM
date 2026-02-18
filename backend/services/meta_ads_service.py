"""Meta Marketing API Service for Ad Performance Tracking with Token Management"""
import os
import httpx
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

class MetaAdsService:
    """Service for interacting with Meta Marketing API with automatic token refresh"""
    
    def __init__(self):
        self._load_config()
    
    def _load_config(self):
        """Load configuration from environment"""
        self.app_id = os.environ.get('META_APP_ID')
        self.app_secret = os.environ.get('META_APP_SECRET')
        self.access_token = os.environ.get('META_ACCESS_TOKEN')
        self.ad_account_id = os.environ.get('META_AD_ACCOUNT_ID', '').replace('act_', '')
        self.api_version = os.environ.get('META_API_VERSION', 'v21.0')
        self.base_url = f"https://graph.facebook.com/{self.api_version}"
    
    def reload_token(self):
        """Reload token from environment (useful after token update)"""
        self.access_token = os.environ.get('META_ACCESS_TOKEN')
    
    def update_token(self, new_token: str):
        """Update the access token in memory and environment"""
        self.access_token = new_token
        os.environ['META_ACCESS_TOKEN'] = new_token
    
    def is_configured(self) -> bool:
        """Check if Meta Ads is properly configured"""
        return bool(self.access_token and self.ad_account_id)
    
    async def get_token_info(self) -> Dict[str, Any]:
        """
        Get information about the current access token including expiry.
        
        Returns:
            Dictionary with token info:
            - is_valid: Whether token is valid
            - expires_at: Token expiry timestamp (if available)
            - expires_in_days: Days until expiry
            - token_type: 'short_lived' or 'long_lived'
            - scopes: List of granted permissions
            - error: Error message if token is invalid
        """
        if not self.access_token:
            return {
                "is_valid": False,
                "error": "No access token configured"
            }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Debug token to get info
                url = f"{self.base_url}/debug_token"
                params = {
                    "input_token": self.access_token,
                    "access_token": f"{self.app_id}|{self.app_secret}"
                }
                
                response = await client.get(url, params=params)
                data = response.json()
                
                if "error" in data:
                    return {
                        "is_valid": False,
                        "error": data["error"].get("message", "Unknown error")
                    }
                
                token_data = data.get("data", {})
                is_valid = token_data.get("is_valid", False)
                expires_at = token_data.get("expires_at", 0)
                scopes = token_data.get("scopes", [])
                
                # Calculate days until expiry
                expires_in_days = None
                expires_at_str = None
                token_type = "unknown"
                
                if expires_at:
                    if expires_at == 0:
                        # Token never expires (page tokens)
                        token_type = "never_expires"
                        expires_in_days = -1
                    else:
                        expiry_date = datetime.fromtimestamp(expires_at)
                        expires_at_str = expiry_date.isoformat()
                        expires_in_days = (expiry_date - datetime.now()).days
                        
                        # Long-lived tokens typically last 60 days
                        if expires_in_days > 30:
                            token_type = "long_lived"
                        else:
                            token_type = "short_lived"
                
                return {
                    "is_valid": is_valid,
                    "expires_at": expires_at_str,
                    "expires_at_timestamp": expires_at,
                    "expires_in_days": expires_in_days,
                    "token_type": token_type,
                    "scopes": scopes,
                    "app_id": token_data.get("app_id"),
                    "user_id": token_data.get("user_id")
                }
                
        except Exception as e:
            logger.error(f"Error getting token info: {str(e)}")
            return {
                "is_valid": False,
                "error": str(e)
            }
    
    async def exchange_for_long_lived_token(self, short_lived_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Exchange a short-lived token for a long-lived token (60 days).
        
        Args:
            short_lived_token: The short-lived token to exchange. 
                             If not provided, uses current access_token.
        
        Returns:
            Dictionary with:
            - success: Whether exchange was successful
            - access_token: New long-lived token
            - expires_in: Seconds until expiry
            - error: Error message if failed
        """
        if not self.app_id or not self.app_secret:
            return {
                "success": False,
                "error": "App ID and App Secret are required for token exchange"
            }
        
        token_to_exchange = short_lived_token or self.access_token
        if not token_to_exchange:
            return {
                "success": False,
                "error": "No token provided for exchange"
            }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/oauth/access_token"
                params = {
                    "grant_type": "fb_exchange_token",
                    "client_id": self.app_id,
                    "client_secret": self.app_secret,
                    "fb_exchange_token": token_to_exchange
                }
                
                response = await client.get(url, params=params)
                data = response.json()
                
                if "error" in data:
                    return {
                        "success": False,
                        "error": data["error"].get("message", "Token exchange failed")
                    }
                
                new_token = data.get("access_token")
                expires_in = data.get("expires_in", 5184000)  # Default 60 days in seconds
                
                if new_token:
                    return {
                        "success": True,
                        "access_token": new_token,
                        "expires_in": expires_in,
                        "expires_in_days": expires_in // 86400
                    }
                else:
                    return {
                        "success": False,
                        "error": "No token returned from exchange"
                    }
                    
        except Exception as e:
            logger.error(f"Error exchanging token: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def refresh_long_lived_token(self) -> Dict[str, Any]:
        """
        Refresh a long-lived token to extend its validity.
        Note: This only works for tokens that are still valid and not expired.
        
        Returns:
            Dictionary with refresh result
        """
        # First check if current token is valid and long-lived
        token_info = await self.get_token_info()
        
        if not token_info.get("is_valid"):
            return {
                "success": False,
                "error": "Current token is invalid. Please obtain a new token from Meta."
            }
        
        # Exchange current long-lived token for a new one
        result = await self.exchange_for_long_lived_token()
        
        if result.get("success"):
            logger.info("Successfully refreshed Meta access token")
        
        return result
    
    async def auto_refresh_if_needed(self, days_threshold: int = 7) -> Dict[str, Any]:
        """
        Automatically refresh the token if it will expire within the threshold.
        
        Args:
            days_threshold: Refresh if token expires within this many days
        
        Returns:
            Dictionary with action taken and result
        """
        token_info = await self.get_token_info()
        
        if not token_info.get("is_valid"):
            return {
                "action": "none",
                "reason": "Token is invalid",
                "needs_manual_refresh": True,
                "error": token_info.get("error")
            }
        
        expires_in_days = token_info.get("expires_in_days")
        
        if expires_in_days is None:
            return {
                "action": "none",
                "reason": "Could not determine token expiry"
            }
        
        if expires_in_days == -1:
            return {
                "action": "none",
                "reason": "Token never expires"
            }
        
        if expires_in_days > days_threshold:
            return {
                "action": "none",
                "reason": f"Token valid for {expires_in_days} more days",
                "expires_in_days": expires_in_days
            }
        
        # Token is expiring soon, try to refresh
        logger.info(f"Token expires in {expires_in_days} days, attempting refresh...")
        refresh_result = await self.refresh_long_lived_token()
        
        if refresh_result.get("success"):
            return {
                "action": "refreshed",
                "reason": f"Token was expiring in {expires_in_days} days",
                "new_token": refresh_result.get("access_token"),
                "new_expires_in_days": refresh_result.get("expires_in_days")
            }
        else:
            return {
                "action": "refresh_failed",
                "reason": refresh_result.get("error"),
                "expires_in_days": expires_in_days,
                "needs_manual_refresh": True
            }
    
    async def get_ad_insights(
        self,
        ad_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        level: str = "ad"  # ad, adset, campaign
    ) -> Dict[str, Any]:
        """
        Fetch ad insights (spend, impressions, clicks, etc.) from Meta Marketing API
        
        Args:
            ad_id: Specific ad ID to fetch (optional, fetches all if not specified)
            date_from: Start date (YYYY-MM-DD)
            date_to: End date (YYYY-MM-DD)
            level: Aggregation level (ad, adset, campaign)
        
        Returns:
            Dictionary with ad insights data
        """
        if not self.is_configured():
            return {"error": "Meta Ads not configured", "data": []}
        
        # Default date range: last 30 days
        if not date_to:
            date_to = datetime.now().strftime("%Y-%m-%d")
        if not date_from:
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if ad_id:
                    # Fetch specific ad insights
                    url = f"{self.base_url}/{ad_id}/insights"
                else:
                    # Fetch all ads in the account
                    url = f"{self.base_url}/act_{self.ad_account_id}/insights"
                
                params = {
                    "access_token": self.access_token,
                    "fields": "ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,cpc,cpm,ctr,reach,frequency,actions,conversions,cost_per_action_type",
                    "time_range": f'{{"since":"{date_from}","until":"{date_to}"}}',
                    "level": level,
                    "limit": 500
                }
                
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "data": data.get("data", []),
                        "paging": data.get("paging", {})
                    }
                else:
                    error_data = response.json()
                    error_info = error_data.get("error", {})
                    error_code = error_info.get("code")
                    
                    # Check if it's a token expiry error
                    if error_code == 190:
                        logger.error("Meta access token has expired")
                    else:
                        logger.error(f"Meta API Error: {error_data}")
                    
                    return {
                        "success": False,
                        "error": error_info.get("message", "Unknown error"),
                        "error_code": error_code,
                        "token_expired": error_code == 190,
                        "data": []
                    }
                    
        except httpx.TimeoutException:
            logger.error("Meta API timeout")
            return {"success": False, "error": "Request timeout", "data": []}
        except Exception as e:
            logger.error(f"Meta API error: {str(e)}")
            return {"success": False, "error": str(e), "data": []}
    
    async def get_ads_list(self) -> Dict[str, Any]:
        """Fetch list of all ads in the account"""
        if not self.is_configured():
            return {"error": "Meta Ads not configured", "data": []}
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/act_{self.ad_account_id}/ads"
                params = {
                    "access_token": self.access_token,
                    "fields": "id,name,status,effective_status,campaign_id,adset_id,created_time,updated_time",
                    "limit": 500
                }
                
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "data": data.get("data", [])
                    }
                else:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Unknown error"),
                        "data": []
                    }
                    
        except Exception as e:
            logger.error(f"Meta API error: {str(e)}")
            return {"success": False, "error": str(e), "data": []}
    
    async def get_campaigns_list(self) -> Dict[str, Any]:
        """Fetch list of all campaigns in the account"""
        if not self.is_configured():
            return {"error": "Meta Ads not configured", "data": []}
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/act_{self.ad_account_id}/campaigns"
                params = {
                    "access_token": self.access_token,
                    "fields": "id,name,status,effective_status,objective,created_time,updated_time,daily_budget,lifetime_budget",
                    "limit": 500
                }
                
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "data": data.get("data", [])
                    }
                else:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Unknown error"),
                        "data": []
                    }
                    
        except Exception as e:
            logger.error(f"Meta API error: {str(e)}")
            return {"success": False, "error": str(e), "data": []}
    
    async def get_ad_spend_by_ids(self, ad_ids: List[str], date_from: str, date_to: str) -> Dict[str, float]:
        """
        Get spend for specific ad IDs
        
        Returns:
            Dictionary mapping ad_id to spend amount
        """
        result = {}
        
        if not ad_ids or not self.is_configured():
            return result
        
        insights = await self.get_ad_insights(date_from=date_from, date_to=date_to)
        
        if insights.get("success") and insights.get("data"):
            for insight in insights["data"]:
                ad_id = insight.get("ad_id")
                if ad_id in ad_ids:
                    result[ad_id] = float(insight.get("spend", 0))
        
        return result
    
    async def get_ads_with_targeting(self) -> Dict[str, Any]:
        """
        Fetch all ads with their targeting information including geo-targeting (cities).
        This helps auto-suggest city mappings for ads.
        """
        if not self.is_configured():
            return {"error": "Meta Ads not configured", "data": []}
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # First get all ads with basic info
                ads_url = f"{self.base_url}/act_{self.ad_account_id}/ads"
                ads_params = {
                    "access_token": self.access_token,
                    "fields": "id,name,status,effective_status,adset_id,campaign_id,created_time",
                    "limit": 500
                }
                
                ads_response = await client.get(ads_url, params=ads_params)
                
                if ads_response.status_code != 200:
                    error_data = ads_response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Unknown error"),
                        "data": []
                    }
                
                ads_data = ads_response.json().get("data", [])
                
                # Now get adset targeting info for each unique adset
                adset_ids = list(set([ad.get("adset_id") for ad in ads_data if ad.get("adset_id")]))
                adset_targeting = {}
                
                for adset_id in adset_ids[:50]:  # Limit to 50 adsets to avoid rate limits
                    try:
                        targeting_url = f"{self.base_url}/{adset_id}"
                        targeting_params = {
                            "access_token": self.access_token,
                            "fields": "id,name,targeting"
                        }
                        
                        targeting_response = await client.get(targeting_url, params=targeting_params)
                        
                        if targeting_response.status_code == 200:
                            targeting_data = targeting_response.json()
                            targeting = targeting_data.get("targeting", {})
                            
                            # Extract geo locations (cities)
                            geo_locations = targeting.get("geo_locations", {})
                            cities = geo_locations.get("cities", [])
                            regions = geo_locations.get("regions", [])
                            countries = geo_locations.get("countries", [])
                            
                            adset_targeting[adset_id] = {
                                "name": targeting_data.get("name", ""),
                                "cities": [c.get("name", "") for c in cities] if cities else [],
                                "regions": [r.get("name", "") for r in regions] if regions else [],
                                "countries": countries or [],
                                "raw_targeting": targeting
                            }
                    except Exception as e:
                        logger.warning(f"Failed to get targeting for adset {adset_id}: {e}")
                        continue
                
                # Merge targeting info with ads
                enriched_ads = []
                for ad in ads_data:
                    adset_id = ad.get("adset_id")
                    targeting_info = adset_targeting.get(adset_id, {})
                    
                    enriched_ads.append({
                        "id": ad.get("id"),
                        "name": ad.get("name"),
                        "status": ad.get("status"),
                        "effective_status": ad.get("effective_status"),
                        "adset_id": adset_id,
                        "adset_name": targeting_info.get("name", ""),
                        "campaign_id": ad.get("campaign_id"),
                        "created_time": ad.get("created_time"),
                        "targeting_cities": targeting_info.get("cities", []),
                        "targeting_regions": targeting_info.get("regions", []),
                        "targeting_countries": targeting_info.get("countries", [])
                    })
                
                return {
                    "success": True,
                    "data": enriched_ads,
                    "has_city_targeting": any(ad.get("targeting_cities") for ad in enriched_ads)
                }
                
        except Exception as e:
            logger.error(f"Meta API error: {str(e)}")
            return {"success": False, "error": str(e), "data": []}
    
    async def get_all_ad_statuses(self) -> Dict[str, Any]:
        """
        Get current status of all ads (active/paused/archived).
        Used for syncing ad status to our database.
        """
        if not self.is_configured():
            return {"error": "Meta Ads not configured", "data": {}}
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/act_{self.ad_account_id}/ads"
                params = {
                    "access_token": self.access_token,
                    "fields": "id,name,status,effective_status",
                    "limit": 500
                }
                
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json().get("data", [])
                    # Return as dictionary keyed by ad_id
                    statuses = {}
                    for ad in data:
                        statuses[ad.get("id")] = {
                            "name": ad.get("name"),
                            "status": ad.get("status"),
                            "effective_status": ad.get("effective_status"),
                            "is_active": ad.get("effective_status") == "ACTIVE"
                        }
                    return {
                        "success": True,
                        "data": statuses,
                        "count": len(statuses)
                    }
                else:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Unknown error"),
                        "data": {}
                    }
                    
        except Exception as e:
            logger.error(f"Meta API error: {str(e)}")
            return {"success": False, "error": str(e), "data": {}}


# Singleton instance
meta_ads_service = MetaAdsService()
