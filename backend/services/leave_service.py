"""Leave Service - Leave requests, approvals, and balance management"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import calendar


class LeaveService:
    """Service for managing leave requests and balances"""
    
    # Default annual leave allocation
    DEFAULT_CASUAL_LEAVE = 12
    DEFAULT_SICK_LEAVE = 12
    
    def __init__(self, db):
        self.db = db
    
    # ==================== LEAVE BALANCE ====================
    
    async def get_or_create_balance(self, employee_id: str, year: int) -> dict:
        """Get or create leave balance for an employee for a year"""
        balance = await self.db.leave_balances.find_one(
            {"employee_id": employee_id, "year": year},
            {"_id": 0}
        )
        
        if not balance:
            balance = {
                "id": str(uuid.uuid4()),
                "employee_id": employee_id,
                "year": year,
                "casual_leave_total": self.DEFAULT_CASUAL_LEAVE,
                "casual_leave_used": 0,
                "casual_leave_balance": self.DEFAULT_CASUAL_LEAVE,
                "sick_leave_total": self.DEFAULT_SICK_LEAVE,
                "sick_leave_used": 0,
                "sick_leave_balance": self.DEFAULT_SICK_LEAVE,
                "carried_forward_casual": 0,
                "carried_forward_sick": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await self.db.leave_balances.insert_one(balance)
            balance.pop("_id", None)
        
        return balance
    
    async def update_balance(
        self,
        employee_id: str,
        year: int,
        leave_type: str,
        days: float,
        operation: str = "deduct"  # "deduct" or "credit"
    ):
        """Update leave balance after approval/cancellation"""
        balance = await self.get_or_create_balance(employee_id, year)
        
        if leave_type == "CASUAL":
            used_field = "casual_leave_used"
            balance_field = "casual_leave_balance"
            total = balance["casual_leave_total"]
        else:  # SICK
            used_field = "sick_leave_used"
            balance_field = "sick_leave_balance"
            total = balance["sick_leave_total"]
        
        current_used = balance[used_field]
        
        if operation == "deduct":
            new_used = current_used + days
        else:  # credit (for cancellation)
            new_used = max(0, current_used - days)
        
        new_balance = total - new_used
        
        await self.db.leave_balances.update_one(
            {"employee_id": employee_id, "year": year},
            {"$set": {
                used_field: new_used,
                balance_field: new_balance,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # ==================== LEAVE REQUESTS ====================
    
    async def create_leave_request(
        self,
        employee_id: str,
        leave_type: str,
        start_date: str,
        end_date: str,
        duration_type: str,
        reason: str,
        applied_by_id: str = None
    ) -> dict:
        """Create a new leave request"""
        # Get employee name
        employee = await self.db.users.find_one(
            {"id": employee_id},
            {"_id": 0, "name": 1}
        )
        employee_name = employee.get("name", "") if employee else ""
        
        # Get applied_by name if different from employee
        applied_by_name = None
        if applied_by_id:
            applier = await self.db.users.find_one(
                {"id": applied_by_id},
                {"_id": 0, "name": 1}
            )
            applied_by_name = applier.get("name", "") if applier else None
        
        # Calculate total days
        total_days = self._calculate_leave_days(start_date, end_date, duration_type)
        
        # Check balance
        year = int(start_date[:4])
        balance = await self.get_or_create_balance(employee_id, year)
        
        if leave_type == "CASUAL":
            available = balance["casual_leave_balance"]
        else:
            available = balance["sick_leave_balance"]
        
        if total_days > available:
            raise ValueError(f"Insufficient leave balance. Available: {available}, Requested: {total_days}")
        
        # Check for overlapping requests
        overlapping = await self.db.leave_requests.find_one({
            "employee_id": employee_id,
            "status": {"$in": ["PENDING", "APPROVED"]},
            "$or": [
                {"start_date": {"$lte": end_date}, "end_date": {"$gte": start_date}}
            ]
        })
        if overlapping:
            raise ValueError("Overlapping leave request exists")
        
        now = datetime.now(timezone.utc).isoformat()
        
        request = {
            "id": str(uuid.uuid4()),
            "employee_id": employee_id,
            "employee_name": employee_name,
            "leave_type": leave_type,
            "start_date": start_date,
            "end_date": end_date,
            "duration_type": duration_type,
            "total_days": total_days,
            "reason": reason,
            "status": "PENDING",
            "applied_by_id": applied_by_id,
            "applied_by_name": applied_by_name,
            "approved_by": None,
            "approved_by_name": None,
            "approved_at": None,
            "rejection_reason": None,
            "cancelled_at": None,
            "cancellation_reason": None,
            "created_at": now,
            "updated_at": now
        }
        
        await self.db.leave_requests.insert_one(request)
        request.pop("_id", None)
        
        return request
    
    async def approve_leave(
        self,
        request_id: str,
        approved_by: str,
        approved_by_name: str
    ) -> dict:
        """Approve a leave request"""
        request = await self.db.leave_requests.find_one(
            {"id": request_id},
            {"_id": 0}
        )
        if not request:
            raise ValueError("Leave request not found")
        
        if request["status"] != "PENDING":
            raise ValueError("Can only approve pending requests")
        
        now = datetime.now(timezone.utc).isoformat()
        
        await self.db.leave_requests.update_one(
            {"id": request_id},
            {"$set": {
                "status": "APPROVED",
                "approved_by": approved_by,
                "approved_by_name": approved_by_name,
                "approved_at": now,
                "updated_at": now
            }}
        )
        
        # Deduct from balance
        year = int(request["start_date"][:4])
        await self.update_balance(
            request["employee_id"],
            year,
            request["leave_type"],
            request["total_days"],
            "deduct"
        )
        
        # Update attendance records for leave dates
        await self._mark_attendance_as_leave(
            request["employee_id"],
            request["start_date"],
            request["end_date"],
            request["leave_type"]
        )
        
        request["status"] = "APPROVED"
        request["approved_by"] = approved_by
        request["approved_by_name"] = approved_by_name
        request["approved_at"] = now
        
        return request
    
    async def reject_leave(
        self,
        request_id: str,
        rejected_by: str,
        rejected_by_name: str,
        rejection_reason: str
    ) -> dict:
        """Reject a leave request"""
        request = await self.db.leave_requests.find_one(
            {"id": request_id},
            {"_id": 0}
        )
        if not request:
            raise ValueError("Leave request not found")
        
        if request["status"] != "PENDING":
            raise ValueError("Can only reject pending requests")
        
        now = datetime.now(timezone.utc).isoformat()
        
        await self.db.leave_requests.update_one(
            {"id": request_id},
            {"$set": {
                "status": "REJECTED",
                "approved_by": rejected_by,
                "approved_by_name": rejected_by_name,
                "approved_at": now,
                "rejection_reason": rejection_reason,
                "updated_at": now
            }}
        )
        
        request["status"] = "REJECTED"
        request["rejection_reason"] = rejection_reason
        
        return request
    
    async def cancel_leave(
        self,
        request_id: str,
        cancelled_by: str,
        cancellation_reason: str
    ) -> dict:
        """Cancel an approved leave request"""
        request = await self.db.leave_requests.find_one(
            {"id": request_id},
            {"_id": 0}
        )
        if not request:
            raise ValueError("Leave request not found")
        
        if request["status"] not in ["PENDING", "APPROVED"]:
            raise ValueError("Cannot cancel this request")
        
        now = datetime.now(timezone.utc).isoformat()
        
        was_approved = request["status"] == "APPROVED"
        
        await self.db.leave_requests.update_one(
            {"id": request_id},
            {"$set": {
                "status": "CANCELLED",
                "cancelled_at": now,
                "cancellation_reason": cancellation_reason,
                "updated_at": now
            }}
        )
        
        # Credit back to balance if was approved
        if was_approved:
            year = int(request["start_date"][:4])
            await self.update_balance(
                request["employee_id"],
                year,
                request["leave_type"],
                request["total_days"],
                "credit"
            )
        
        request["status"] = "CANCELLED"
        request["cancelled_at"] = now
        
        return request
    
    async def _mark_attendance_as_leave(
        self,
        employee_id: str,
        start_date: str,
        end_date: str,
        leave_type: str
    ):
        """Mark attendance records as on_leave for approved leaves"""
        # This integrates with the attendance system
        # For future dates, we can create placeholder records
        current = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        
        while current <= end:
            date_str = current.strftime("%Y-%m-%d")
            
            # Check if record exists
            existing = await self.db.attendance_records.find_one(
                {"employee_id": employee_id, "date": date_str}
            )
            
            if existing and not existing.get("is_locked"):
                # Update existing unlocked record
                await self.db.attendance_records.update_one(
                    {"id": existing["id"]},
                    {"$set": {
                        "system_status": "PRESENT",  # Approved leave counts as present
                        "hr_override_status": "APPROVED",
                        "override_reason": f"Approved {leave_type} leave",
                        "override_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
            
            current += timedelta(days=1)
    
    # ==================== QUERIES ====================
    
    async def get_employee_leaves(
        self,
        employee_id: str,
        year: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[dict]:
        """Get leave requests for an employee"""
        query = {"employee_id": employee_id}
        if year:
            query["start_date"] = {"$regex": f"^{year}"}
        if status:
            query["status"] = status
        
        requests = await self.db.leave_requests.find(
            query, {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return requests
    
    async def get_pending_approvals(
        self,
        country_id: Optional[str] = None,
        team_id: Optional[str] = None
    ) -> List[dict]:
        """Get pending leave requests for approval"""
        # Get employee IDs for filtering
        emp_query = {"is_active": True}
        if country_id:
            emp_query["country_id"] = country_id
        if team_id:
            emp_query["team_id"] = team_id
        
        employees = await self.db.users.find(emp_query, {"_id": 0, "id": 1}).to_list(10000)
        emp_ids = [e["id"] for e in employees]
        
        requests = await self.db.leave_requests.find(
            {"employee_id": {"$in": emp_ids}, "status": "PENDING"},
            {"_id": 0}
        ).sort("created_at", 1).to_list(1000)
        
        return requests
    
    async def get_leave_summary(
        self,
        employee_id: str,
        year: int
    ) -> dict:
        """Get leave summary for an employee"""
        balance = await self.get_or_create_balance(employee_id, year)
        
        # Get employee name
        employee = await self.db.users.find_one(
            {"id": employee_id},
            {"_id": 0, "name": 1}
        )
        
        # Get pending requests count
        pending = await self.db.leave_requests.count_documents({
            "employee_id": employee_id,
            "status": "PENDING"
        })
        
        return {
            "employee_id": employee_id,
            "employee_name": employee.get("name", "") if employee else "",
            "year": year,
            "casual_leave_balance": balance["casual_leave_balance"],
            "sick_leave_balance": balance["sick_leave_balance"],
            "total_leave_balance": balance["casual_leave_balance"] + balance["sick_leave_balance"],
            "casual_leave_used": balance["casual_leave_used"],
            "sick_leave_used": balance["sick_leave_used"],
            "total_leave_used": balance["casual_leave_used"] + balance["sick_leave_used"],
            "pending_requests": pending
        }
    
    async def get_team_leave_summary(
        self,
        team_id: Optional[str] = None,
        country_id: Optional[str] = None
    ) -> dict:
        """Get team-level leave summary"""
        # Get employees
        emp_query = {"is_active": True}
        if team_id:
            emp_query["team_id"] = team_id
        if country_id:
            emp_query["country_id"] = country_id
        
        employees = await self.db.users.find(emp_query, {"_id": 0, "id": 1, "name": 1}).to_list(10000)
        emp_ids = [e["id"] for e in employees]
        emp_map = {e["id"]: e["name"] for e in employees}
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Get approved leaves for today
        on_leave_today = await self.db.leave_requests.find({
            "employee_id": {"$in": emp_ids},
            "status": "APPROVED",
            "start_date": {"$lte": today},
            "end_date": {"$gte": today}
        }, {"_id": 0}).to_list(1000)
        
        # Get pending approvals
        pending = await self.db.leave_requests.count_documents({
            "employee_id": {"$in": emp_ids},
            "status": "PENDING"
        })
        
        # Get upcoming leaves (next 7 days)
        next_week = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
        upcoming = await self.db.leave_requests.find({
            "employee_id": {"$in": emp_ids},
            "status": "APPROVED",
            "start_date": {"$gt": today, "$lte": next_week}
        }, {"_id": 0}).to_list(100)
        
        return {
            "team_id": team_id,
            "total_employees": len(employees),
            "employees_on_leave_today": len(on_leave_today),
            "pending_approvals": pending,
            "on_leave_today": [
                {"employee_id": leave["employee_id"], "employee_name": emp_map.get(leave["employee_id"], ""), "leave_type": leave["leave_type"]}
                for leave in on_leave_today
            ],
            "upcoming_leaves": [
                {"employee_id": leave["employee_id"], "employee_name": emp_map.get(leave["employee_id"], ""), "start_date": leave["start_date"], "leave_type": leave["leave_type"]}
                for leave in upcoming
            ]
        }
    
    # ==================== HELPERS ====================
    
    def _calculate_leave_days(self, start_date: str, end_date: str, duration_type: str) -> float:
        """Calculate total leave days"""
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        
        days = (end - start).days + 1
        
        if duration_type in ["HALF_DAY_FIRST", "HALF_DAY_SECOND"]:
            return days * 0.5
        
        return float(days)
