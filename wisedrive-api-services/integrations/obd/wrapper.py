"""
Wisedrive API Services - OBD SDK Wrapper
Wrapper around OBD-Integration-v1.0 library
"""
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


class OBDIntegrationWrapper:
    """
    Wrapper for OBD-Integration-v1.0 SDK.
    
    IMPORTANT:
    - OBD-Integration-v1.0 is used ONLY by Mechanic app
    - This wrapper is for server-side processing of OBD data
    - Do NOT duplicate OBD communication logic here
    
    Purpose:
    - Validate OBD data received from Mechanic app
    - Process raw OBD frames for storage
    - Decode VIN numbers
    - Parse DTC codes
    """
    
    # OBD-II Service IDs
    SERVICE_01_LIVE_DATA = 0x01
    SERVICE_02_FREEZE_FRAME = 0x02
    SERVICE_03_DTC_STORED = 0x03
    SERVICE_04_CLEAR_DTC = 0x04
    SERVICE_07_DTC_PENDING = 0x07
    SERVICE_09_VIN = 0x09
    SERVICE_0A_DTC_PERMANENT = 0x0A
    
    # Protocol identifiers
    PROTOCOL_AUTO = "AUTO"
    PROTOCOL_CAN = "CAN"
    PROTOCOL_ISO9141 = "ISO9141"
    PROTOCOL_KWP2000 = "KWP2000"
    PROTOCOL_J1850_PWM = "J1850_PWM"
    PROTOCOL_J1850_VPW = "J1850_VPW"
    
    def validate_vin(self, vin: str) -> Dict[str, Any]:
        """
        Validate VIN format and extract information.
        
        VIN Structure (17 characters):
        - Positions 1-3: World Manufacturer Identifier (WMI)
        - Positions 4-9: Vehicle Descriptor Section (VDS)
        - Position 9: Check digit
        - Positions 10-17: Vehicle Identifier Section (VIS)
        
        Args:
            vin: 17-character VIN string
            
        Returns:
            Validation result with decoded information
        """
        if not vin or len(vin) != 17:
            return {
                "valid": False,
                "error": "VIN must be exactly 17 characters"
            }
        
        # VIN cannot contain I, O, Q
        invalid_chars = set("IOQ")
        vin_upper = vin.upper()
        
        if any(c in invalid_chars for c in vin_upper):
            return {
                "valid": False,
                "error": "VIN cannot contain I, O, or Q"
            }
        
        # Check if alphanumeric
        if not vin_upper.isalnum():
            return {
                "valid": False,
                "error": "VIN must be alphanumeric"
            }
        
        # Validate check digit (position 9)
        if not self._validate_check_digit(vin_upper):
            logger.warning(f"VIN {vin} has invalid check digit")
            # Don't fail - some VINs have incorrect check digits
        
        # Decode VIN
        return {
            "valid": True,
            "vin": vin_upper,
            "wmi": vin_upper[0:3],
            "vds": vin_upper[3:9],
            "vis": vin_upper[9:17],
            "model_year": self._decode_model_year(vin_upper[9]),
            "plant_code": vin_upper[10],
            "serial_number": vin_upper[11:17]
        }
    
    def _validate_check_digit(self, vin: str) -> bool:
        """Validate VIN check digit (position 9)"""
        transliteration = {
            'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
            'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
            'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
        }
        weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
        
        total = 0
        for i, char in enumerate(vin):
            if char.isdigit():
                value = int(char)
            else:
                value = transliteration.get(char, 0)
            total += value * weights[i]
        
        remainder = total % 11
        check_digit = vin[8]
        
        if remainder == 10:
            return check_digit == 'X'
        else:
            return check_digit == str(remainder)
    
    def _decode_model_year(self, char: str) -> Optional[int]:
        """Decode model year from VIN position 10"""
        year_codes = {
            'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
            'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
            'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
            'S': 2025, 'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029,
            'Y': 2030, '1': 2031, '2': 2032, '3': 2033, '4': 2034,
            '5': 2035, '6': 2036, '7': 2037, '8': 2038, '9': 2039,
        }
        return year_codes.get(char.upper())
    
    def parse_dtc_code(self, code: str) -> Dict[str, Any]:
        """
        Parse DTC code format.
        
        DTC Format: XNNNN where:
        - X = Category (P, C, B, U)
        - N = 4 hex digits
        
        Args:
            code: DTC code string
            
        Returns:
            Parsed DTC information
        """
        if not code or len(code) != 5:
            return {"valid": False, "error": "Invalid DTC format"}
        
        category_char = code[0].upper()
        category_map = {
            'P': ('powertrain', 'Engine, transmission, fuel system'),
            'C': ('chassis', 'ABS, suspension, steering'),
            'B': ('body', 'Airbags, lighting, HVAC'),
            'U': ('network', 'CAN bus, communication')
        }
        
        if category_char not in category_map:
            return {"valid": False, "error": "Invalid DTC category"}
        
        try:
            # Validate hex digits
            int(code[1:], 16)
        except ValueError:
            return {"valid": False, "error": "Invalid DTC number format"}
        
        category, description = category_map[category_char]
        
        # Determine if generic (0/2) or manufacturer-specific (1/3)
        second_digit = code[1]
        is_generic = second_digit in ['0', '2']
        
        return {
            "valid": True,
            "code": code.upper(),
            "category": category,
            "category_description": description,
            "is_generic": is_generic,
            "subsystem": code[2],
            "fault_index": code[3:5]
        }
    
    def process_raw_frames(self, frames: List[str]) -> Dict[str, Any]:
        """
        Process raw OBD frame data.
        
        Used for debugging and advanced analysis.
        
        Args:
            frames: List of raw frame strings
            
        Returns:
            Processed frame analysis
        """
        processed = []
        
        for frame in frames:
            # Basic frame parsing - actual implementation would be more complex
            frame_clean = frame.strip().upper()
            
            if len(frame_clean) >= 4:
                processed.append({
                    "raw": frame,
                    "header": frame_clean[:2] if len(frame_clean) >= 2 else None,
                    "data": frame_clean[2:] if len(frame_clean) > 2 else None,
                })
        
        return {
            "frame_count": len(processed),
            "frames": processed
        }
    
    def calculate_checksum(self, data: bytes) -> int:
        """Calculate OBD message checksum"""
        return sum(data) & 0xFF
