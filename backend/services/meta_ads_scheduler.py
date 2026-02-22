"""Background Scheduler for Meta Ads Data Sync"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

class MetaAdsScheduler:
    """
    Background scheduler that periodically syncs Meta Ads data:
    - Fetches ad spend/performance data every 6 hours
    - Syncs ad status (active/paused) to our database
    - Stores last sync timestamp
    """
    
    def __init__(self, db, meta_service):
        self.db = db
        self.meta_service = meta_service
        self.is_running = False
        self.sync_interval_hours = 6  # Changed from 15 minutes to 6 hours
        self._task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start the background scheduler"""
        if self.is_running:
            logger.info("Meta Ads scheduler already running")
            return
        
        self.is_running = True
        self._task = asyncio.create_task(self._run_scheduler())
        logger.info(f"Meta Ads scheduler started (interval: {self.sync_interval_hours} hours)")
    
    async def stop(self):
        """Stop the background scheduler"""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Meta Ads scheduler stopped")
    
    async def _run_scheduler(self):
        """Main scheduler loop"""
        while self.is_running:
            try:
                await self.sync_all()
            except Exception as e:
                logger.error(f"Error in Meta Ads sync: {e}")
            
            # Wait for next interval (6 hours)
            await asyncio.sleep(self.sync_interval_hours * 60 * 60)
    
    async def sync_all(self):
        """Run all sync operations"""
        logger.info("Starting Meta Ads sync...")
        
        if not self.meta_service.is_configured():
            logger.warning("Meta Ads not configured, skipping sync")
            return {"success": False, "error": "Meta Ads not configured"}
        
        results = {
            "ad_statuses": None,
            "performance_data": None,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Sync ad statuses
        results["ad_statuses"] = await self.sync_ad_statuses()
        
        # Sync performance data
        results["performance_data"] = await self.sync_performance_data()
        
        # Update last sync timestamp
        await self.update_sync_timestamp()
        
        logger.info("Meta Ads sync completed")
        return results
    
    async def sync_ad_statuses(self):
        """Sync ad active/paused status from Meta to our database"""
        try:
            statuses = await self.meta_service.get_all_ad_statuses()
            
            if not statuses.get("success"):
                error_msg = statuses.get("error", "Unknown error")
                logger.error(f"Failed to fetch ad statuses: {error_msg}")
                return {"success": False, "error": error_msg}
            
            status_data = statuses.get("data", {})
            updated_count = 0
            
            for ad_id, status_info in status_data.items():
                # Update our ad mapping if it exists
                result = await self.db.ad_city_mappings.update_one(
                    {"ad_id": ad_id},
                    {
                        "$set": {
                            "meta_status": status_info.get("status"),
                            "meta_effective_status": status_info.get("effective_status"),
                            "is_active": status_info.get("is_active"),
                            "meta_ad_name": status_info.get("name"),
                            "status_synced_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                if result.modified_count > 0:
                    updated_count += 1
            
            logger.info(f"Synced status for {updated_count} ads")
            return {"success": True, "updated_count": updated_count}
            
        except Exception as e:
            logger.error(f"Error syncing ad statuses: {e}")
            return {"success": False, "error": str(e)}
    
    async def sync_performance_data(self):
        """Sync performance data (spend, impressions, clicks) from Meta"""
        try:
            # Get data for last 30 days
            date_to = datetime.now().strftime("%Y-%m-%d")
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            
            insights = await self.meta_service.get_ad_insights(
                date_from=date_from,
                date_to=date_to
            )
            
            if not insights.get("success"):
                error_msg = insights.get("error", "Unknown error")
                logger.error(f"Failed to fetch ad insights: {error_msg}")
                return {"success": False, "error": error_msg, "token_expired": insights.get("token_expired", False)}
            
            # Store aggregated cache data
            cache_data = {
                "type": "meta_ads_insights",
                "date_range": {"from": date_from, "to": date_to},
                "data": insights.get("data", []),
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.db.meta_ads_cache.update_one(
                {"type": "meta_ads_insights"},
                {"$set": cache_data},
                upsert=True
            )
            
            # Also store per-ad performance data for offline access
            ads_updated = 0
            for ad_insight in insights.get("data", []):
                ad_id = ad_insight.get("ad_id")
                if ad_id:
                    await self.db.ad_performance.update_one(
                        {"ad_id": ad_id},
                        {
                            "$set": {
                                "ad_id": ad_id,
                                "ad_name": ad_insight.get("ad_name"),
                                "campaign_id": ad_insight.get("campaign_id"),
                                "campaign_name": ad_insight.get("campaign_name"),
                                "adset_id": ad_insight.get("adset_id"),
                                "adset_name": ad_insight.get("adset_name"),
                                "spend": float(ad_insight.get("spend", 0)),
                                "impressions": int(ad_insight.get("impressions", 0)),
                                "clicks": int(ad_insight.get("clicks", 0)),
                                "reach": int(ad_insight.get("reach", 0)),
                                "cpc": float(ad_insight.get("cpc", 0)),
                                "cpm": float(ad_insight.get("cpm", 0)),
                                "ctr": float(ad_insight.get("ctr", 0)),
                                "frequency": float(ad_insight.get("frequency", 0)),
                                "actions": ad_insight.get("actions", []),
                                "date_range": {"from": date_from, "to": date_to},
                                "synced_at": datetime.now(timezone.utc).isoformat()
                            }
                        },
                        upsert=True
                    )
                    ads_updated += 1
            
            logger.info(f"Cached performance data for {len(insights.get('data', []))} ads, updated {ads_updated} ad records")
            return {"success": True, "ads_count": len(insights.get("data", [])), "updated": ads_updated}
            
        except Exception as e:
            logger.error(f"Error syncing performance data: {e}")
            return {"success": False, "error": str(e)}
    
    async def update_sync_timestamp(self):
        """Update the last sync timestamp in database"""
        await self.db.system_config.update_one(
            {"key": "meta_ads_last_sync"},
            {
                "$set": {
                    "key": "meta_ads_last_sync",
                    "value": datetime.now(timezone.utc).isoformat(),
                    "sync_interval_hours": self.sync_interval_hours
                }
            },
            upsert=True
        )
    
    async def get_last_sync_time(self) -> Optional[str]:
        """Get the last sync timestamp"""
        config = await self.db.system_config.find_one({"key": "meta_ads_last_sync"})
        return config.get("value") if config else None
    
    async def get_cached_insights(self) -> dict:
        """Get cached insights data"""
        cache = await self.db.meta_ads_cache.find_one({"type": "meta_ads_insights"})
        if cache:
            return {
                "data": cache.get("data", []),
                "synced_at": cache.get("synced_at"),
                "date_range": cache.get("date_range")
            }
        return {"data": [], "synced_at": None, "date_range": None}
    
    async def get_cached_ad_performance(self, ad_id: str = None) -> dict:
        """Get cached performance data for a specific ad or all ads"""
        if ad_id:
            perf = await self.db.ad_performance.find_one({"ad_id": ad_id}, {"_id": 0})
            return perf or {}
        else:
            perfs = await self.db.ad_performance.find({}, {"_id": 0}).to_list(1000)
            return {"data": perfs, "count": len(perfs)}


# Scheduler instance (initialized in server.py)
meta_ads_scheduler = None
