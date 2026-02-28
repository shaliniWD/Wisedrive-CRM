"""
Brand Mapper Service
Maps Vaahan API manufacturer names to standardized CRM brand names
"""

import re
from typing import Optional, List, Dict

# Mapping of Vaahan API manufacturer names to CRM brand names
# Format: CRM_Brand -> [list of possible Vaahan API variants]
BRAND_MAPPINGS: Dict[str, List[str]] = {
    # Japanese Brands
    "Toyota": [
        "toyota", "toyota kirloskar", "toyota kirloskar motor", "toyota kirloskar motors",
        "toyota motor", "toyota india", "toyota kirloskar motor pvt ltd",
        "toyota kirloskar motor private limited"
    ],
    "Honda": [
        "honda", "honda cars", "honda cars india", "honda cars india ltd",
        "honda siel cars india", "honda motor", "honda india",
        "honda cars india limited", "honda siel cars india ltd"
    ],
    "Maruti Suzuki": [
        "maruti", "maruti suzuki", "maruti suzuki india", "maruti suzuki india ltd",
        "maruti suzuki india limited", "maruti udyog", "maruti udyog ltd",
        "maruti udyog limited", "suzuki", "suzuki motor", "suzuki india"
    ],
    "Nissan": [
        "nissan", "nissan motor", "nissan india", "nissan motor india",
        "nissan motor india pvt ltd", "nissan motor india private limited"
    ],
    "Mitsubishi": [
        "mitsubishi", "mitsubishi motors", "mitsubishi india",
        "hindustan motors mitsubishi", "mitsubishi motor"
    ],
    "Mazda": ["mazda", "mazda motor", "mazda india"],
    "Suzuki": ["suzuki", "suzuki motor", "suzuki motorcycle"],
    "Isuzu": ["isuzu", "isuzu motors", "isuzu motors india"],
    "Lexus": ["lexus", "lexus india"],
    
    # Korean Brands
    "Hyundai": [
        "hyundai", "hyundai motor", "hyundai motor india", "hyundai motor india ltd",
        "hyundai motor india limited", "hyundai motor indian pvt ltd",
        "hyundai motor indian private limited", "hyundai india",
        "hyundai motors india"
    ],
    "Kia": [
        "kia", "kia motors", "kia motors india", "kia india",
        "kia motors india pvt ltd", "kia motors india private limited"
    ],
    "Genesis": ["genesis", "genesis motors"],
    
    # German Brands
    "BMW": [
        "bmw", "bmw india", "bmw ag", "bmw group", "bayerische motoren werke",
        "bmw india pvt ltd", "bmw india private limited"
    ],
    "Mercedes-Benz": [
        "mercedes", "mercedes-benz", "mercedes benz", "daimler", "daimler india",
        "mercedes-benz india", "mercedes benz india", "daimler ag",
        "mercedes-benz india pvt ltd", "mercedes-benz india private limited"
    ],
    "Audi": [
        "audi", "audi india", "audi ag", "audi india pvt ltd",
        "audi india private limited"
    ],
    "Volkswagen": [
        "volkswagen", "vw", "volkswagen india", "volkswagen group india",
        "volkswagen india pvt ltd", "volkswagen india private limited",
        "skoda auto volkswagen india"
    ],
    "Porsche": [
        "porsche", "porsche india", "porsche ag",
        "porsche india pvt ltd", "porsche india private limited"
    ],
    "Mini": ["mini", "mini cooper", "bmw mini"],
    
    # American Brands
    "Ford": [
        "ford", "ford india", "ford motor", "ford motor company",
        "ford india pvt ltd", "ford india private limited"
    ],
    "Jeep": [
        "jeep", "jeep india", "fca india", "fiat chrysler automobiles",
        "stellantis india"
    ],
    "Chevrolet": [
        "chevrolet", "chevrolet india", "general motors", "gm india",
        "general motors india"
    ],
    
    # British Brands
    "Jaguar": [
        "jaguar", "jaguar india", "jaguar land rover", "jlr india",
        "jaguar land rover india", "tata jaguar", "jaguar land rover india ltd"
    ],
    "Land Rover": [
        "land rover", "landrover", "range rover", "jaguar land rover",
        "jlr", "jaguar land rover india"
    ],
    "MG": [
        "mg", "mg motor", "mg motors", "mg motor india",
        "mg motor india pvt ltd", "mg motor india private limited",
        "morris garages", "saic motor"
    ],
    "Rolls-Royce": [
        "rolls royce", "rolls-royce", "rollsroyce",
        "rolls royce motor cars"
    ],
    "Bentley": ["bentley", "bentley motors"],
    
    # Indian Brands
    "Tata": [
        "tata", "tata motors", "tata motors ltd", "tata motors limited",
        "telco", "tata engineering"
    ],
    "Mahindra": [
        "mahindra", "mahindra & mahindra", "mahindra and mahindra",
        "m&m", "mahindra & mahindra ltd", "mahindra and mahindra limited",
        "mahindra automotive"
    ],
    "Force": [
        "force", "force motors", "force motors ltd", "force motors limited"
    ],
    "Ashok Leyland": [
        "ashok leyland", "ashok leyland ltd", "ashok leyland limited"
    ],
    "Hindustan Motors": [
        "hindustan motors", "hm", "hindustan motors ltd"
    ],
    
    # French Brands
    "Renault": [
        "renault", "renault india", "renault nissan", "renault india pvt ltd",
        "renault india private limited", "renault nissan automotive india"
    ],
    "Peugeot": [
        "peugeot", "peugeot india", "groupe psa", "stellantis"
    ],
    "Citroen": [
        "citroen", "citroën", "citroen india", "stellantis india"
    ],
    
    # Italian Brands
    "Fiat": [
        "fiat", "fiat india", "fiat india automobiles",
        "fiat chrysler automobiles", "fca india"
    ],
    "Lamborghini": [
        "lamborghini", "automobili lamborghini"
    ],
    "Ferrari": ["ferrari", "ferrari india"],
    "Maserati": ["maserati", "maserati india"],
    "Alfa Romeo": ["alfa romeo", "alfa", "alfa romeo india"],
    
    # Chinese Brands
    "BYD": ["byd", "byd india", "byd auto", "byd company"],
    "Great Wall": ["great wall", "great wall motors", "gwm"],
    "Haval": ["haval", "haval india"],
    
    # Swedish Brands
    "Volvo": [
        "volvo", "volvo india", "volvo cars", "volvo cars india",
        "volvo auto india", "volvo cars india pvt ltd"
    ],
    
    # Czech Brands
    "Skoda": [
        "skoda", "škoda", "skoda india", "skoda auto",
        "skoda auto india", "skoda auto india pvt ltd",
        "skoda auto volkswagen india"
    ],
    
    # Electric Vehicle Brands
    "Tesla": ["tesla", "tesla motors", "tesla india"],
    "Rivian": ["rivian", "rivian automotive"],
    "Lucid": ["lucid", "lucid motors"],
    "Ola Electric": ["ola", "ola electric", "ola electric mobility"],
    "Ather": ["ather", "ather energy"],
    "TVS": ["tvs", "tvs motor", "tvs motor company"],
    "Bajaj": ["bajaj", "bajaj auto", "bajaj auto ltd"],
    "Hero": ["hero", "hero motocorp", "hero honda"],
    "Royal Enfield": ["royal enfield", "enfield", "eicher motors"],
}


class BrandMapper:
    """Service to map Vaahan API manufacturer names to CRM brand names"""
    
    def __init__(self):
        # Build reverse lookup: normalized variant -> CRM brand
        self._variant_to_brand: Dict[str, str] = {}
        for brand, variants in BRAND_MAPPINGS.items():
            for variant in variants:
                normalized = self._normalize(variant)
                self._variant_to_brand[normalized] = brand
    
    def _normalize(self, text: str) -> str:
        """Normalize text for comparison"""
        if not text:
            return ""
        # Lowercase, remove extra spaces, remove common suffixes
        text = text.lower().strip()
        # Remove common suffixes
        suffixes = [
            "pvt ltd", "private limited", "pvt. ltd.", "pvt. ltd",
            "limited", "ltd", "ltd.", "inc", "inc.",
            "corporation", "corp", "corp.", "company", "co"
        ]
        for suffix in suffixes:
            if text.endswith(suffix):
                text = text[:-len(suffix)].strip()
        # Remove special characters but keep spaces
        text = re.sub(r'[^\w\s]', ' ', text)
        # Normalize whitespace
        text = ' '.join(text.split())
        return text
    
    def get_crm_brand(self, vaahan_manufacturer: str) -> Optional[str]:
        """
        Convert Vaahan API manufacturer name to CRM brand name
        
        Args:
            vaahan_manufacturer: The manufacturer name from Vaahan API
                                e.g., "Hyundai Motor Indian Pvt Ltd"
        
        Returns:
            CRM brand name if found, None otherwise
            e.g., "Hyundai"
        """
        if not vaahan_manufacturer:
            return None
        
        normalized = self._normalize(vaahan_manufacturer)
        
        # Direct lookup
        if normalized in self._variant_to_brand:
            return self._variant_to_brand[normalized]
        
        # Fuzzy match - check if normalized contains any known variant
        for variant, brand in self._variant_to_brand.items():
            if variant in normalized or normalized in variant:
                return brand
        
        # Try extracting first word as brand (common case)
        first_word = normalized.split()[0] if normalized else ""
        if first_word in self._variant_to_brand:
            return self._variant_to_brand[first_word]
        
        # Check if any brand name is contained in the manufacturer string
        for brand in BRAND_MAPPINGS.keys():
            if brand.lower() in normalized:
                return brand
        
        return None
    
    def get_brand_with_fallback(self, vaahan_manufacturer: str) -> str:
        """
        Get CRM brand with fallback to original string
        
        Args:
            vaahan_manufacturer: The manufacturer name from Vaahan API
        
        Returns:
            CRM brand name if found, otherwise the original manufacturer name
        """
        crm_brand = self.get_crm_brand(vaahan_manufacturer)
        if crm_brand:
            return crm_brand
        
        # Return cleaned version of original if no mapping found
        if vaahan_manufacturer:
            # Capitalize first letter of each word
            return ' '.join(word.capitalize() for word in vaahan_manufacturer.split())
        return ""
    
    def is_known_brand(self, brand: str) -> bool:
        """Check if a brand is known in the CRM system"""
        if not brand:
            return False
        return brand in BRAND_MAPPINGS or self._normalize(brand) in self._variant_to_brand


# Singleton instance
brand_mapper = BrandMapper()
