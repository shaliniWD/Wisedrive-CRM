"""
Wisedrive API Services - OBD Service
Business logic for OBD scan sessions and DTC management
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


class OBDService:
    """
    OBD Service handles all OBD-related business logic.
    
    Responsibilities:
    - Store and retrieve OBD scan sessions
    - Manage DTC codes and their descriptions
    - Link OBD data to inspections
    - Provide analytics on DTC trends
    """
    
    def __init__(self, obd_repository, inspection_repository, vehicle_repository):
        self.obd_repo = obd_repository
        self.inspection_repo = inspection_repository
        self.vehicle_repo = vehicle_repository
    
    async def create_session(
        self,
        inspection_id: str,
        vehicle_id: str,
        session_data: Dict[str, Any],
        scanned_by: str
    ) -> Dict[str, Any]:
        """
        Create a new OBD scan session linked to an inspection.
        
        Args:
            inspection_id: ID of the inspection
            vehicle_id: ID of the vehicle
            session_data: Raw OBD session data from the scanner
            scanned_by: ID of the mechanic who performed the scan
            
        Returns:
            Created OBD session with processed DTCs
        """
        # Validate inspection exists
        inspection = await self.inspection_repo.find_by_id(inspection_id)
        if not inspection:
            raise ValueError(f"Inspection {inspection_id} not found")
        
        # Validate vehicle exists
        vehicle = await self.vehicle_repo.find_by_id(vehicle_id)
        if not vehicle:
            raise ValueError(f"Vehicle {vehicle_id} not found")
        
        # Process DTCs - enrich with descriptions
        dtc_stored = await self._process_dtcs(session_data.get("dtc_stored", []))
        dtc_pending = await self._process_dtcs(session_data.get("dtc_pending", []))
        dtc_permanent = await self._process_dtcs(session_data.get("dtc_permanent", []))
        
        # Create session record
        session = {
            "inspection_id": inspection_id,
            "vehicle_id": vehicle_id,
            "vin": session_data.get("vin"),
            "protocol": session_data.get("protocol"),
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "scanned_by": scanned_by,
            "ecu_info": session_data.get("ecu_info", {}),
            "dtc_stored": dtc_stored,
            "dtc_pending": dtc_pending,
            "dtc_permanent": dtc_permanent,
            "dtc_count": len(dtc_stored) + len(dtc_pending) + len(dtc_permanent),
            "mil_status": session_data.get("mil_status", False),
            "freeze_frame": session_data.get("freeze_frame", {}),
            "live_data": session_data.get("live_data", {}),
            "readiness_monitors": session_data.get("readiness_monitors", {}),
            "raw_frames": session_data.get("raw_frames", []),
        }
        
        created_session = await self.obd_repo.create(session)
        
        # Update inspection with OBD session reference
        await self.inspection_repo.update(
            inspection_id, 
            {"obd_session_id": created_session["id"]}
        )
        
        logger.info(f"Created OBD session {created_session['id']} for inspection {inspection_id}")
        
        return created_session
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get OBD session by ID"""
        return await self.obd_repo.find_by_id(session_id)
    
    async def get_session_by_inspection(self, inspection_id: str) -> Optional[Dict[str, Any]]:
        """Get OBD session for an inspection"""
        return await self.obd_repo.find_by_inspection(inspection_id)
    
    async def get_vehicle_history(self, vehicle_id: str) -> List[Dict[str, Any]]:
        """Get all OBD sessions for a vehicle (history)"""
        return await self.obd_repo.find_by_vehicle(vehicle_id)
    
    async def get_vin_history(self, vin: str) -> List[Dict[str, Any]]:
        """Get all OBD sessions for a VIN"""
        return await self.obd_repo.find_by_vin(vin)
    
    async def _process_dtcs(self, dtc_codes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process raw DTC codes and enrich with descriptions.
        
        Args:
            dtc_codes: List of DTC codes from scanner
            
        Returns:
            Enriched DTC list with descriptions and recommendations
        """
        processed = []
        
        for dtc in dtc_codes:
            code = dtc.get("code", "")
            if not code:
                continue
            
            # Determine category from first letter
            category_map = {
                "P": "powertrain",
                "C": "chassis",
                "B": "body",
                "U": "network"
            }
            category = category_map.get(code[0].upper(), "unknown")
            
            # Get DTC description from library
            dtc_info = await self._get_dtc_info(code)
            
            processed.append({
                "code": code,
                "category": category,
                "description": dtc_info.get("description", f"Unknown code: {code}"),
                "severity": dtc_info.get("severity", "medium"),
                "possible_causes": dtc_info.get("possible_causes", []),
                "recommended_actions": dtc_info.get("recommended_actions", []),
                "raw_data": dtc.get("raw_data")
            })
        
        return processed
    
    async def _get_dtc_info(self, code: str) -> Dict[str, Any]:
        """
        Get DTC information from library.
        
        In production, this would query a DTC database.
        Here we provide common DTC definitions.
        """
        # Common DTC definitions (subset)
        DTC_LIBRARY = {
            "P0300": {
                "description": "Random/Multiple Cylinder Misfire Detected",
                "severity": "high",
                "possible_causes": [
                    "Worn or damaged spark plugs",
                    "Faulty ignition coils",
                    "Vacuum leak",
                    "Low fuel pressure"
                ],
                "recommended_actions": [
                    "Check spark plugs and ignition coils",
                    "Inspect for vacuum leaks",
                    "Check fuel pressure"
                ]
            },
            "P0301": {
                "description": "Cylinder 1 Misfire Detected",
                "severity": "high",
                "possible_causes": [
                    "Faulty spark plug in cylinder 1",
                    "Bad ignition coil",
                    "Fuel injector issue"
                ],
                "recommended_actions": [
                    "Replace spark plug",
                    "Test ignition coil",
                    "Check fuel injector"
                ]
            },
            "P0420": {
                "description": "Catalyst System Efficiency Below Threshold (Bank 1)",
                "severity": "medium",
                "possible_causes": [
                    "Worn catalytic converter",
                    "Faulty oxygen sensor",
                    "Exhaust leak"
                ],
                "recommended_actions": [
                    "Check oxygen sensor operation",
                    "Inspect catalytic converter",
                    "Check for exhaust leaks"
                ]
            },
            "P0171": {
                "description": "System Too Lean (Bank 1)",
                "severity": "medium",
                "possible_causes": [
                    "Vacuum leak",
                    "Faulty MAF sensor",
                    "Low fuel pressure",
                    "Clogged fuel injectors"
                ],
                "recommended_actions": [
                    "Check for vacuum leaks",
                    "Clean or replace MAF sensor",
                    "Check fuel pressure and injectors"
                ]
            },
            "P0442": {
                "description": "Evaporative Emission Control System Leak Detected (Small Leak)",
                "severity": "low",
                "possible_causes": [
                    "Loose gas cap",
                    "Faulty EVAP canister",
                    "Cracked hoses"
                ],
                "recommended_actions": [
                    "Check gas cap seal",
                    "Inspect EVAP system hoses",
                    "Perform smoke test"
                ]
            },
            "C0035": {
                "description": "Left Front Wheel Speed Sensor Circuit Malfunction",
                "severity": "high",
                "possible_causes": [
                    "Damaged wheel speed sensor",
                    "Wiring issue",
                    "Corroded connector"
                ],
                "recommended_actions": [
                    "Inspect wheel speed sensor",
                    "Check wiring and connectors",
                    "Replace sensor if needed"
                ]
            },
            "B0001": {
                "description": "Driver Frontal Stage 1 Deployment Control",
                "severity": "critical",
                "possible_causes": [
                    "Airbag system malfunction",
                    "Faulty clock spring",
                    "Wiring issue"
                ],
                "recommended_actions": [
                    "Do not attempt repair - professional service required",
                    "Have airbag system inspected immediately"
                ]
            },
            "U0100": {
                "description": "Lost Communication With ECM/PCM 'A'",
                "severity": "critical",
                "possible_causes": [
                    "ECM/PCM failure",
                    "CAN bus wiring issue",
                    "Power supply problem"
                ],
                "recommended_actions": [
                    "Check ECM power and ground",
                    "Inspect CAN bus wiring",
                    "Scan all modules for related codes"
                ]
            }
        }
        
        return DTC_LIBRARY.get(code.upper(), {})
    
    async def get_dtc_trends(
        self,
        vehicle_id: Optional[str] = None,
        days: int = 90
    ) -> Dict[str, Any]:
        """
        Analyze DTC trends for analytics dashboard.
        
        Returns:
            Aggregated DTC statistics
        """
        # This would run an aggregation pipeline in production
        query = {}
        if vehicle_id:
            query["vehicle_id"] = vehicle_id
        
        sessions = await self.obd_repo.find_many(query, limit=1000)
        
        # Count DTC occurrences
        dtc_counts = {}
        total_sessions = len(sessions)
        sessions_with_dtc = 0
        
        for session in sessions:
            all_dtcs = (
                session.get("dtc_stored", []) + 
                session.get("dtc_pending", []) + 
                session.get("dtc_permanent", [])
            )
            
            if all_dtcs:
                sessions_with_dtc += 1
            
            for dtc in all_dtcs:
                code = dtc.get("code", "")
                if code:
                    dtc_counts[code] = dtc_counts.get(code, 0) + 1
        
        # Get top DTCs
        top_dtcs = sorted(
            dtc_counts.items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:10]
        
        return {
            "total_sessions": total_sessions,
            "sessions_with_dtc": sessions_with_dtc,
            "dtc_rate": round(sessions_with_dtc / total_sessions * 100, 2) if total_sessions else 0,
            "top_dtcs": [{"code": code, "count": count} for code, count in top_dtcs],
            "period_days": days
        }
