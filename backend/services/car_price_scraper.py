"""
Indian Used Car Market Price Scraper
Scrapes prices from OLX, CarWale, CarDekho, Spinny, Cars24
"""
import os
import re
import json
import logging
import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# User agent for requests
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# KM tolerance for matching
KM_TOLERANCE = 20000


class UsedCarPriceScraper:
    """Scrapes used car prices from Indian car selling websites"""
    
    def __init__(self):
        self.headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
    
    async def get_market_price(
        self,
        make: str,
        model: str,
        year: int,
        fuel_type: str = None,
        transmission: str = None,
        kms_driven: int = None,
        city: str = None
    ) -> Dict[str, Any]:
        """
        Get market price for a vehicle from multiple sources.
        
        Args:
            make: Vehicle make (e.g., "Maruti", "Hyundai")
            model: Vehicle model (e.g., "Swift", "i20")
            year: Manufacturing year
            fuel_type: Petrol/Diesel/CNG/Electric
            transmission: Manual/Automatic
            kms_driven: Kilometers driven
            city: City for location-based pricing
        
        Returns:
            Dict with price estimates and sources
        """
        if not make or not model:
            return self._get_default_response("Missing make or model")
        
        logger.info(f"[PRICE_SCRAPER] Fetching prices for {make} {model} {year}")
        
        # Fetch prices from multiple sources concurrently
        tasks = [
            self._fetch_cardekho_price(make, model, year, fuel_type, transmission, kms_driven),
            self._fetch_carwale_price(make, model, year, fuel_type, transmission, kms_driven),
            self._fetch_cars24_price(make, model, year, fuel_type, transmission, kms_driven),
            self._fetch_spinny_price(make, model, year, fuel_type, transmission, kms_driven),
            self._fetch_olx_price(make, model, year, fuel_type, kms_driven, city),
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        prices = []
        sources = []
        
        source_names = ["CarDekho", "CarWale", "Cars24", "Spinny", "OLX"]
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"[PRICE_SCRAPER] {source_names[i]} failed: {result}")
                continue
            
            if result and result.get("success") and result.get("prices"):
                for price in result["prices"]:
                    if price > 0:
                        prices.append(price)
                        sources.append({
                            "source": source_names[i],
                            "price": price,
                            "url": result.get("url", "")
                        })
        
        if not prices:
            # If no prices found, use estimation based on vehicle age
            return self._estimate_price_fallback(make, model, year, kms_driven)
        
        # Calculate statistics
        avg_price = sum(prices) / len(prices)
        min_price = min(prices)
        max_price = max(prices)
        
        # Recommended price is 5-10% below average (for buyer)
        discount_percent = 0.075  # 7.5% average of 5-10%
        recommended_min = int(avg_price * (1 - 0.10))  # 10% below average
        recommended_max = int(avg_price * (1 - 0.05))  # 5% below average
        
        return {
            "success": True,
            "market_average": int(avg_price),
            "market_min": int(min_price),
            "market_max": int(max_price),
            "recommended_min": recommended_min,
            "recommended_max": recommended_max,
            "discount_applied": "5-10% below market average",
            "sources_count": len(prices),
            "sources": sources,
            "vehicle": {
                "make": make,
                "model": model,
                "year": year,
                "fuel_type": fuel_type,
                "transmission": transmission,
                "kms_driven": kms_driven
            },
            "fetched_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def _fetch_cardekho_price(
        self, make: str, model: str, year: int, 
        fuel_type: str, transmission: str, kms_driven: int
    ) -> Dict[str, Any]:
        """Fetch prices from CarDekho used cars section"""
        try:
            # CarDekho API-like endpoint for used car prices
            search_term = f"{make}-{model}".lower().replace(" ", "-")
            url = f"https://www.cardekho.com/used-cars+{search_term}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers, timeout=10) as response:
                    if response.status != 200:
                        return {"success": False, "error": f"Status {response.status}"}
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    prices = []
                    # Find price elements (CarDekho structure)
                    price_elements = soup.find_all(['span', 'div'], class_=re.compile(r'price|Price|amount'))
                    
                    for elem in price_elements[:10]:  # Limit to first 10
                        price_text = elem.get_text(strip=True)
                        price = self._extract_price(price_text)
                        if price and self._is_valid_price(price, year):
                            prices.append(price)
                    
                    return {
                        "success": True,
                        "prices": prices[:5],
                        "url": url
                    }
        except Exception as e:
            logger.error(f"[PRICE_SCRAPER] CarDekho error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _fetch_carwale_price(
        self, make: str, model: str, year: int,
        fuel_type: str, transmission: str, kms_driven: int
    ) -> Dict[str, Any]:
        """Fetch prices from CarWale used cars section"""
        try:
            search_term = f"{make}+{model}".replace(" ", "+")
            url = f"https://www.carwale.com/used/cars-for-sale/?q={search_term}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers, timeout=10) as response:
                    if response.status != 200:
                        return {"success": False, "error": f"Status {response.status}"}
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    prices = []
                    # CarWale uses data attributes and specific classes
                    price_elements = soup.find_all(['span', 'div'], attrs={'data-price': True})
                    
                    for elem in price_elements[:10]:
                        price = int(elem.get('data-price', 0))
                        if price and self._is_valid_price(price, year):
                            prices.append(price)
                    
                    # Fallback: search for price text
                    if not prices:
                        text_prices = soup.find_all(string=re.compile(r'₹\s*[\d,.]+\s*(Lakh|lakh|L)?'))
                        for text in text_prices[:10]:
                            price = self._extract_price(str(text))
                            if price and self._is_valid_price(price, year):
                                prices.append(price)
                    
                    return {
                        "success": True,
                        "prices": prices[:5],
                        "url": url
                    }
        except Exception as e:
            logger.error(f"[PRICE_SCRAPER] CarWale error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _fetch_cars24_price(
        self, make: str, model: str, year: int,
        fuel_type: str, transmission: str, kms_driven: int
    ) -> Dict[str, Any]:
        """Fetch prices from Cars24"""
        try:
            # Cars24 has a structured API
            make_lower = make.lower().replace(" ", "-")
            model_lower = model.lower().replace(" ", "-")
            url = f"https://www.cars24.com/buy-used-{make_lower}-{model_lower}-cars/"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers, timeout=10) as response:
                    if response.status != 200:
                        return {"success": False, "error": f"Status {response.status}"}
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    prices = []
                    # Cars24 price elements
                    price_elements = soup.find_all(['span', 'div'], class_=re.compile(r'price|_price'))
                    
                    for elem in price_elements[:10]:
                        price_text = elem.get_text(strip=True)
                        price = self._extract_price(price_text)
                        if price and self._is_valid_price(price, year):
                            prices.append(price)
                    
                    return {
                        "success": True,
                        "prices": prices[:5],
                        "url": url
                    }
        except Exception as e:
            logger.error(f"[PRICE_SCRAPER] Cars24 error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _fetch_spinny_price(
        self, make: str, model: str, year: int,
        fuel_type: str, transmission: str, kms_driven: int
    ) -> Dict[str, Any]:
        """Fetch prices from Spinny"""
        try:
            make_lower = make.lower().replace(" ", "-")
            model_lower = model.lower().replace(" ", "-")
            url = f"https://www.spinny.com/used-cars/{make_lower}/{model_lower}/"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers, timeout=10) as response:
                    if response.status != 200:
                        return {"success": False, "error": f"Status {response.status}"}
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    prices = []
                    # Spinny price elements
                    price_elements = soup.find_all(['span', 'div'], class_=re.compile(r'price|Price'))
                    
                    for elem in price_elements[:10]:
                        price_text = elem.get_text(strip=True)
                        price = self._extract_price(price_text)
                        if price and self._is_valid_price(price, year):
                            prices.append(price)
                    
                    return {
                        "success": True,
                        "prices": prices[:5],
                        "url": url
                    }
        except Exception as e:
            logger.error(f"[PRICE_SCRAPER] Spinny error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _fetch_olx_price(
        self, make: str, model: str, year: int,
        fuel_type: str, kms_driven: int, city: str
    ) -> Dict[str, Any]:
        """Fetch prices from OLX India"""
        try:
            search_term = f"{make}+{model}+{year}".replace(" ", "+")
            city_slug = (city or "india").lower().replace(" ", "-")
            url = f"https://www.olx.in/{city_slug}/q-{search_term}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers, timeout=10) as response:
                    if response.status != 200:
                        return {"success": False, "error": f"Status {response.status}"}
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    prices = []
                    # OLX price elements (they use specific data attributes)
                    price_elements = soup.find_all(['span'], attrs={'data-aut-id': 'itemPrice'})
                    
                    for elem in price_elements[:10]:
                        price_text = elem.get_text(strip=True)
                        price = self._extract_price(price_text)
                        if price and self._is_valid_price(price, year):
                            prices.append(price)
                    
                    # Fallback
                    if not prices:
                        price_texts = soup.find_all(string=re.compile(r'₹\s*[\d,.]+'))
                        for text in price_texts[:10]:
                            price = self._extract_price(str(text))
                            if price and self._is_valid_price(price, year):
                                prices.append(price)
                    
                    return {
                        "success": True,
                        "prices": prices[:5],
                        "url": url
                    }
        except Exception as e:
            logger.error(f"[PRICE_SCRAPER] OLX error: {e}")
            return {"success": False, "error": str(e)}
    
    def _extract_price(self, text: str) -> Optional[int]:
        """Extract numeric price from text"""
        if not text:
            return None
        
        # Remove currency symbols and spaces
        text = text.replace('₹', '').replace('Rs', '').replace('Rs.', '').strip()
        
        # Handle "X.XX Lakh" format
        lakh_match = re.search(r'([\d,.]+)\s*(Lakh|lakh|L|lac)', text, re.IGNORECASE)
        if lakh_match:
            try:
                value = float(lakh_match.group(1).replace(',', ''))
                return int(value * 100000)
            except:
                pass
        
        # Handle "X.XX Crore" format
        crore_match = re.search(r'([\d,.]+)\s*(Crore|crore|Cr)', text, re.IGNORECASE)
        if crore_match:
            try:
                value = float(crore_match.group(1).replace(',', ''))
                return int(value * 10000000)
            except:
                pass
        
        # Handle plain numbers with commas
        plain_match = re.search(r'([\d,]+)', text)
        if plain_match:
            try:
                return int(plain_match.group(1).replace(',', ''))
            except:
                pass
        
        return None
    
    def _is_valid_price(self, price: int, year: int) -> bool:
        """Check if price is within reasonable range for the vehicle age"""
        if price < 100000:  # Less than 1 lakh is too low for a car
            return False
        if price > 5000000:  # More than 50 lakh is too high for typical used cars
            return False
        
        # Age-based validation
        current_year = datetime.now().year
        age = current_year - year
        
        # Reasonable price ranges based on age
        if age <= 0:  # Brand new or future year
            if price > 4000000:  # New cars rarely above 40L (except luxury)
                return False
        elif age <= 3:  # 1-3 years old
            if price > 3000000:  # 3 year old cars rarely above 30L
                return False
        elif age <= 5:  # 4-5 years old
            if price > 2000000:  # 5 year old cars rarely above 20L
                return False
        elif age <= 10:  # 6-10 years old
            if price > 1500000:  # 10 year old cars rarely above 15L
                return False
        elif age <= 15:  # 11-15 years old
            if price > 800000:  # Old cars rarely above 8L
                return False
        else:  # 15+ years old
            if price > 500000:  # Very old cars rarely above 5L
                return False
        
        return True
    
    def _filter_outliers(self, prices: List[int]) -> List[int]:
        """Remove outlier prices using IQR method"""
        if len(prices) < 3:
            return prices
        
        sorted_prices = sorted(prices)
        n = len(sorted_prices)
        
        # Calculate quartiles
        q1_idx = n // 4
        q3_idx = (3 * n) // 4
        q1 = sorted_prices[q1_idx]
        q3 = sorted_prices[q3_idx]
        iqr = q3 - q1
        
        # Filter outliers (1.5 * IQR rule)
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        filtered = [p for p in prices if lower_bound <= p <= upper_bound]
        return filtered if filtered else prices  # Return original if all filtered
    
    def _estimate_price_fallback(
        self, make: str, model: str, year: int, kms_driven: int
    ) -> Dict[str, Any]:
        """Fallback price estimation when scraping fails"""
        current_year = datetime.now().year
        age = current_year - year
        
        # Base price estimation by segment (rough estimates in INR)
        # This is a very rough fallback when web scraping fails
        segment_base_prices = {
            # Hatchbacks
            "swift": 700000, "i10": 500000, "i20": 800000, "baleno": 750000,
            "alto": 350000, "wagon r": 500000, "celerio": 450000, "polo": 700000,
            # Sedans
            "dzire": 700000, "verna": 1000000, "city": 1100000, "ciaz": 900000,
            "amaze": 750000, "aura": 700000,
            # SUVs
            "creta": 1200000, "seltos": 1300000, "brezza": 1000000, "venue": 900000,
            "nexon": 900000, "xuv300": 950000, "xuv500": 1100000, "scorpio": 1200000,
            "fortuner": 3500000, "endeavour": 3200000, "harrier": 1600000,
            # Premium
            "innova": 1500000, "crysta": 2000000,
        }
        
        model_lower = model.lower()
        base_price = segment_base_prices.get(model_lower, 800000)
        
        # Depreciation: ~15% per year for first 3 years, then 10% per year
        depreciated_price = base_price
        for y in range(age):
            if y < 3:
                depreciated_price *= 0.85
            else:
                depreciated_price *= 0.90
        
        # KMs adjustment: -1% per 10,000 km over 50,000
        if kms_driven and kms_driven > 50000:
            excess_kms = kms_driven - 50000
            km_penalty = (excess_kms / 10000) * 0.01
            depreciated_price *= (1 - min(km_penalty, 0.20))  # Max 20% penalty
        
        estimated_price = int(depreciated_price)
        
        # Recommended is 5-10% below
        recommended_min = int(estimated_price * 0.90)
        recommended_max = int(estimated_price * 0.95)
        
        return {
            "success": True,
            "market_average": estimated_price,
            "market_min": int(estimated_price * 0.85),
            "market_max": int(estimated_price * 1.15),
            "recommended_min": recommended_min,
            "recommended_max": recommended_max,
            "discount_applied": "5-10% below estimated value",
            "sources_count": 0,
            "sources": [],
            "estimation_method": "fallback_depreciation",
            "note": "Price estimated using depreciation model (web scraping unavailable)",
            "vehicle": {
                "make": make,
                "model": model,
                "year": year,
                "kms_driven": kms_driven
            },
            "fetched_at": datetime.now(timezone.utc).isoformat()
        }
    
    def _get_default_response(self, error: str) -> Dict[str, Any]:
        """Return default response on error"""
        return {
            "success": False,
            "error": error,
            "market_average": 0,
            "market_min": 0,
            "market_max": 0,
            "recommended_min": 0,
            "recommended_max": 0,
            "sources_count": 0,
            "sources": [],
            "fetched_at": datetime.now(timezone.utc).isoformat()
        }


# Singleton instance
_scraper_instance = None

def get_price_scraper() -> UsedCarPriceScraper:
    """Get singleton instance of price scraper"""
    global _scraper_instance
    if _scraper_instance is None:
        _scraper_instance = UsedCarPriceScraper()
    return _scraper_instance
