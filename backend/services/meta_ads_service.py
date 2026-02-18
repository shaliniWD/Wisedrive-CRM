"""Meta Marketing API Service for Ad Performance Tracking"""
import os
import httpx
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class MetaAdsService:
    """Service for interacting with Meta Marketing API"""
    
    def __init__(self):
        self.app_id = os.environ.get('META_APP_ID')
        self.app_secret = os.environ.get('META_APP_SECRET')
        self.access_token = os.environ.get('META_ACCESS_TOKEN')
        self.ad_account_id = os.environ.get('META_AD_ACCOUNT_ID', '').replace('act_', '')
        self.api_version = os.environ.get('META_API_VERSION', 'v21.0')
        self.base_url = f"https://graph.facebook.com/{self.api_version}"
    
    def is_configured(self) -> bool:
        """Check if Meta Ads is properly configured"""
        return bool(self.access_token and self.ad_account_id)
    
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
                    logger.error(f"Meta API Error: {error_data}")
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Unknown error"),
                        "error_code": error_data.get("error", {}).get("code"),
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


# Singleton instance
meta_ads_service = MetaAdsService()
