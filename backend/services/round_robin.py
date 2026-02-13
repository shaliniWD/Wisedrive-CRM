"""Round Robin Assignment Service"""
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import uuid


class RoundRobinService:
    """Service for round-robin lead assignment"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_available_agents(
        self, 
        country_id: str, 
        team_id: Optional[str] = None
    ) -> List[dict]:
        """Get all available sales agents for assignment"""
        # Get Sales department and Sales Executive role
        sales_dept = await self.db.departments.find_one({"code": "SALES"}, {"_id": 0, "id": 1})
        sales_exec_role = await self.db.roles.find_one({"code": "SALES_EXEC"}, {"_id": 0, "id": 1})
        
        if not sales_dept or not sales_exec_role:
            return []
        
        query = {
            "country_id": country_id,
            "department_id": sales_dept["id"],
            "role_id": sales_exec_role["id"],
            "is_active": True,
            "is_available_for_assignment": True
        }
        
        if team_id:
            query["team_id"] = team_id
        
        agents = await self.db.users.find(
            query, 
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        ).sort("name", 1).to_list(100)
        
        return agents

    async def get_next_agent(
        self, 
        country_id: str, 
        team_id: Optional[str] = None
    ) -> Optional[dict]:
        """Get the next agent in round-robin sequence"""
        agents = await self.get_available_agents(country_id, team_id)
        
        if not agents:
            return None
        
        if len(agents) == 1:
            return agents[0]
        
        # Get current round-robin state
        state_query = {"country_id": country_id}
        if team_id:
            state_query["team_id"] = team_id
        else:
            state_query["team_id"] = None
        
        state = await self.db.round_robin_state.find_one(state_query, {"_id": 0})
        
        agent_ids = [a["id"] for a in agents]
        
        if not state or state.get("last_assigned_user_id") not in agent_ids:
            # Start from first agent
            next_agent = agents[0]
        else:
            # Find next agent in sequence
            last_idx = agent_ids.index(state["last_assigned_user_id"])
            next_idx = (last_idx + 1) % len(agents)
            next_agent = agents[next_idx]
        
        return next_agent

    async def assign_lead(
        self, 
        lead_id: str, 
        country_id: str,
        team_id: Optional[str] = None,
        assigner_id: Optional[str] = None,
        manual_agent_id: Optional[str] = None,
        reason: str = "Round Robin Assignment"
    ) -> Optional[str]:
        """
        Assign a lead to an agent.
        If manual_agent_id is provided, assigns to that agent (manual override).
        Otherwise uses round-robin.
        Returns the assigned agent ID or None if failed.
        """
        # Check if lead is locked (manual assignment should not be overridden)
        lead = await self.db.leads.find_one({"id": lead_id}, {"_id": 0, "is_locked": 1, "assigned_to": 1})
        
        if lead and lead.get("is_locked") and lead.get("assigned_to"):
            # Lead is locked, don't reassign via round robin
            if not manual_agent_id:
                return lead.get("assigned_to")
        
        # Determine assignment type and agent
        if manual_agent_id:
            agent_id = manual_agent_id
            assignment_type = "manual"
        else:
            agent = await self.get_next_agent(country_id, team_id)
            if not agent:
                return None
            agent_id = agent["id"]
            assignment_type = "round_robin"
        
        old_agent_id = lead.get("assigned_to") if lead else None
        
        # Update lead with assignment
        await self.db.leads.update_one(
            {"id": lead_id},
            {
                "$set": {
                    "assigned_to": agent_id,
                    "is_locked": manual_agent_id is not None,  # Lock if manual
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Log the reassignment
        log_entry = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "old_agent_id": old_agent_id,
            "new_agent_id": agent_id,
            "reassigned_by": assigner_id or "system",
            "reason": reason,
            "reassignment_type": assignment_type,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.db.lead_reassignment_logs.insert_one(log_entry)
        
        # Update round-robin state if this was a round-robin assignment
        if assignment_type == "round_robin":
            state_query = {"country_id": country_id}
            if team_id:
                state_query["team_id"] = team_id
            else:
                state_query["team_id"] = None
            
            await self.db.round_robin_state.update_one(
                state_query,
                {
                    "$set": {
                        "last_assigned_user_id": agent_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$setOnInsert": {
                        "id": str(uuid.uuid4()),
                        "country_id": country_id,
                        "team_id": team_id
                    }
                },
                upsert=True
            )
        
        return agent_id

    async def get_assignment_stats(self, country_id: str, team_id: Optional[str] = None) -> dict:
        """Get lead assignment statistics per agent"""
        match_query = {"country_id": country_id}
        if team_id:
            match_query["team_id"] = team_id
        
        pipeline = [
            {"$match": match_query},
            {"$group": {
                "_id": "$assigned_to",
                "total_leads": {"$sum": 1},
                "new_leads": {"$sum": {"$cond": [{"$eq": ["$status", "NEW"]}, 1, 0]}},
                "converted": {"$sum": {"$cond": [{"$ne": ["$customer_id", None]}, 1, 0]}}
            }}
        ]
        
        results = await self.db.leads.aggregate(pipeline).to_list(100)
        
        stats = {}
        for r in results:
            agent_id = r["_id"]
            if agent_id:
                agent = await self.db.users.find_one({"id": agent_id}, {"_id": 0, "name": 1})
                stats[agent_id] = {
                    "agent_name": agent.get("name") if agent else "Unknown",
                    "total_leads": r["total_leads"],
                    "new_leads": r["new_leads"],
                    "converted": r["converted"]
                }
        
        return stats
