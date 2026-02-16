"""Vaahan API Service for Vehicle RC Details"""
import httpx
import os
from typing import Optional, Dict, Any

class VaahanService:
    """Service for fetching vehicle details from Invincible Ocean Vaahan API"""
    
    def __init__(self):
        self.api_url = "https://api.invincibleocean.com/invincible/vehicleRcV6"
    
    def _get_credentials(self):
        """Get credentials at runtime (after dotenv is loaded)"""
        return {
            "client_id": os.environ.get("VAAHAN_CLIENT_ID", ""),
            "secret_key": os.environ.get("VAAHAN_SECRET_KEY", "")
        }
    
    async def get_vehicle_details(self, vehicle_number: str) -> Dict[str, Any]:
        """
        Fetch vehicle details from Vaahan API
        
        Args:
            vehicle_number: Vehicle registration number (e.g., KA48N1000)
            
        Returns:
            Dict with vehicle details or error
        """
        creds = self._get_credentials()
        if not creds["client_id"] or not creds["secret_key"]:
            return {
                "success": False,
                "error": "Vaahan API credentials not configured"
            }
        
        # Clean the vehicle number (remove spaces, convert to uppercase)
        clean_number = vehicle_number.replace(" ", "").replace("-", "").upper()
        
        headers = {
            "Content-Type": "application/json",
            "clientId": creds["client_id"],
            "secretKey": creds["secret_key"]
        }
        
        payload = {
            "vehicleNumber": clean_number
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.api_url,
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("code") == 200 and data.get("result", {}).get("data"):
                        vehicle_data = data["result"]["data"]
                        
                        # Parse and structure the response
                        return {
                            "success": True,
                            "data": {
                                # Basic Info
                                "registration_number": vehicle_data.get("regNo", ""),
                                "chassis_number": vehicle_data.get("chassis", ""),
                                "engine_number": vehicle_data.get("engine", ""),
                                
                                # Vehicle Details
                                "manufacturer": vehicle_data.get("vehicleManufacturerName", ""),
                                "model": vehicle_data.get("model", ""),
                                "color": vehicle_data.get("vehicleColour", ""),
                                "fuel_type": vehicle_data.get("type", ""),
                                "body_type": vehicle_data.get("bodyType", ""),
                                "vehicle_class": vehicle_data.get("class", ""),
                                "category": vehicle_data.get("vehicleCategory", ""),
                                
                                # Manufacturing & Registration
                                "manufacturing_date": vehicle_data.get("vehicleManufacturingMonthYear", ""),
                                "registration_date": vehicle_data.get("regDate", ""),
                                "registration_authority": vehicle_data.get("regAuthority", ""),
                                "rc_expiry_date": vehicle_data.get("rcExpiryDate", ""),
                                
                                # Owner Details
                                "owner_name": vehicle_data.get("owner", ""),
                                "owner_count": vehicle_data.get("ownerCount", ""),
                                "present_address": vehicle_data.get("presentAddress", ""),
                                "permanent_address": vehicle_data.get("permanentAddress", ""),
                                
                                # Insurance Details
                                "insurance_company": vehicle_data.get("vehicleInsuranceCompanyName", ""),
                                "insurance_valid_upto": vehicle_data.get("vehicleInsuranceUpto", ""),
                                "insurance_policy_number": vehicle_data.get("vehicleInsurancePolicyNumber", ""),
                                
                                # Tax & Fitness
                                "tax_valid_upto": vehicle_data.get("vehicleTaxUpto", ""),
                                "fitness_upto": vehicle_data.get("rcExpiryDate", ""),
                                
                                # Technical Specs
                                "cubic_capacity": vehicle_data.get("vehicleCubicCapacity", ""),
                                "gross_weight": vehicle_data.get("grossVehicleWeight", ""),
                                "unladen_weight": vehicle_data.get("unladenWeight", ""),
                                "seating_capacity": vehicle_data.get("vehicleSeatCapacity", ""),
                                "cylinders": vehicle_data.get("vehicleCylindersNo", ""),
                                "wheelbase": vehicle_data.get("wheelbase", ""),
                                "emission_norms": vehicle_data.get("normsType", ""),
                                
                                # Status
                                "status": vehicle_data.get("status", ""),
                                "status_as_on": vehicle_data.get("statusAsOn", ""),
                                "financed": vehicle_data.get("financed", False),
                                "financer": vehicle_data.get("rcFinancer", ""),
                                "blacklist_status": vehicle_data.get("blacklistStatus", False),
                                "is_commercial": vehicle_data.get("isCommercial", False),
                                
                                # PUCC Details
                                "pucc_number": vehicle_data.get("puccNumber", ""),
                                "pucc_valid_upto": vehicle_data.get("puccUpto", ""),
                                
                                # Permit Details (for commercial vehicles)
                                "permit_number": vehicle_data.get("permitNumber", ""),
                                "permit_type": vehicle_data.get("permitType", ""),
                                "permit_valid_from": vehicle_data.get("permitValidFrom", ""),
                                "permit_valid_upto": vehicle_data.get("permitValidUpto", ""),
                                
                                # Raw data for reference
                                "raw_data": vehicle_data
                            }
                        }
                    else:
                        return {
                            "success": False,
                            "error": data.get("message", "Failed to fetch vehicle details")
                        }
                else:
                    return {
                        "success": False,
                        "error": f"API returned status code {response.status_code}"
                    }
                    
        except httpx.TimeoutException:
            return {
                "success": False,
                "error": "Request timed out. Please try again."
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to fetch vehicle details: {str(e)}"
            }
    
    def format_display_name(self, data: Dict[str, Any]) -> str:
        """Format vehicle name for display (e.g., 'Ford Endeavor 2017 White')"""
        if not data.get("success"):
            return ""
        
        vehicle = data.get("data", {})
        manufacturer = vehicle.get("manufacturer", "").split()[0] if vehicle.get("manufacturer") else ""
        model = vehicle.get("model", "").split()[0] if vehicle.get("model") else ""
        year = vehicle.get("manufacturing_date", "").split("/")[-1] if vehicle.get("manufacturing_date") else ""
        color = vehicle.get("color", "")
        
        parts = [p for p in [manufacturer, model, year, color] if p]
        return " ".join(parts)


# Singleton instance
vaahan_service = VaahanService()
