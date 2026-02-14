"""Attendance Service - Session tracking, attendance calculation, HR approval"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
import hashlib
import calendar


class AttendanceService:
    """Service for managing attendance tracking and calculation"""
    
    # Constants
    INACTIVITY_TIMEOUT_MINUTES = 10
    MINIMUM_HOURS_FOR_PRESENT = 9  # 9 hours = 540 minutes
    LOCK_TIME_HOUR = 0  # 00:30 AM
    LOCK_TIME_MINUTE = 30
    
    def __init__(self, db):
        self.db = db
    
    # ==================== SESSION MANAGEMENT ====================
    
    async def create_session(
        self, 
        user_id: str, 
        token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> dict:
        """Create a new session on login"""
        import uuid
        
        now = datetime.now(timezone.utc).isoformat()
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        session = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "token_hash": token_hash,
            "login_at": now,
            "logout_at": None,
            "last_activity_at": now,
            "is_active": True,
            "logout_reason": None,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": now
        }
        
        await self.db.user_sessions.insert_one(session)
        session.pop("_id", None)
        
        return session
    
    async def update_heartbeat(self, user_id: str, token: str) -> bool:
        """Update last activity timestamp on heartbeat"""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        result = await self.db.user_sessions.update_one(
            {"user_id": user_id, "token_hash": token_hash, "is_active": True},
            {"$set": {"last_activity_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return result.modified_count > 0
    
    async def end_session(
        self, 
        user_id: str, 
        token: Optional[str] = None,
        session_id: Optional[str] = None,
        reason: str = "manual"
    ) -> Optional[dict]:
        """End a session (logout)"""
        now = datetime.now(timezone.utc).isoformat()
        
        query = {"user_id": user_id, "is_active": True}
        if token:
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            query["token_hash"] = token_hash
        elif session_id:
            query["id"] = session_id
        
        session = await self.db.user_sessions.find_one(query, {"_id": 0})
        if not session:
            return None
        
        # Update session
        await self.db.user_sessions.update_one(
            {"id": session["id"]},
            {"$set": {
                "logout_at": now,
                "is_active": False,
                "logout_reason": reason
            }}
        )
        
        # Handle midnight crossing
        await self._handle_midnight_session(session, now)
        
        # Blacklist token if provided
        if token:
            await self._blacklist_token(user_id, token, reason)
        
        session["logout_at"] = now
        session["is_active"] = False
        session["logout_reason"] = reason
        
        return session
    
    async def force_end_inactive_sessions(self) -> int:
        """Background job: Force end sessions inactive for > 10 minutes"""
        cutoff_time = (datetime.now(timezone.utc) - timedelta(minutes=self.INACTIVITY_TIMEOUT_MINUTES)).isoformat()
        
        # Find inactive sessions
        inactive_sessions = await self.db.user_sessions.find({
            "is_active": True,
            "last_activity_at": {"$lt": cutoff_time}
        }, {"_id": 0}).to_list(1000)
        
        count = 0
        for session in inactive_sessions:
            await self.end_session(
                user_id=session["user_id"],
                session_id=session["id"],
                reason="inactivity"
            )
            count += 1
        
        return count
    
    async def _blacklist_token(self, user_id: str, token: str, reason: str):
        """Add token to blacklist with expiry"""
        import jwt
        from datetime import datetime
        
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # Decode token to get expiry
        try:
            import os
            SECRET_KEY = os.environ.get('JWT_SECRET', 'wisedrive-crm-secret-key-2024')
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False})
            expires_at = datetime.fromtimestamp(payload.get("exp", 0), tz=timezone.utc).isoformat()
        except Exception:
            # Default expiry: 24 hours from now
            expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        
        blacklist_entry = {
            "token_hash": token_hash,
            "user_id": user_id,
            "blacklisted_at": datetime.now(timezone.utc).isoformat(),
            "reason": reason,
            "expires_at": expires_at
        }
        
        # Upsert to avoid duplicates
        await self.db.token_blacklist.update_one(
            {"token_hash": token_hash},
            {"$set": blacklist_entry},
            upsert=True
        )
    
    async def is_token_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted"""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        entry = await self.db.token_blacklist.find_one({"token_hash": token_hash})
        return entry is not None
    
    # ==================== MIDNIGHT SESSION HANDLING ====================
    
    async def _handle_midnight_session(self, session: dict, logout_time: str):
        """Handle sessions that cross midnight - split across days"""
        login_dt = datetime.fromisoformat(session["login_at"].replace("Z", "+00:00"))
        logout_dt = datetime.fromisoformat(logout_time.replace("Z", "+00:00"))
        
        # Check if session crosses midnight
        if login_dt.date() == logout_dt.date():
            # Same day - update single attendance record
            await self._update_attendance_from_session(
                session["user_id"],
                login_dt.date().isoformat(),
                session["login_at"],
                logout_time
            )
        else:
            # Crosses midnight - split into multiple days
            current_date = login_dt.date()
            while current_date <= logout_dt.date():
                if current_date == login_dt.date():
                    # First day: login time to 23:59:59
                    day_end = datetime.combine(current_date, datetime.max.time().replace(microsecond=0))
                    day_end = day_end.replace(tzinfo=timezone.utc)
                    await self._update_attendance_from_session(
                        session["user_id"],
                        current_date.isoformat(),
                        session["login_at"],
                        day_end.isoformat()
                    )
                elif current_date == logout_dt.date():
                    # Last day: 00:00:00 to logout time
                    day_start = datetime.combine(current_date, datetime.min.time())
                    day_start = day_start.replace(tzinfo=timezone.utc)
                    await self._update_attendance_from_session(
                        session["user_id"],
                        current_date.isoformat(),
                        day_start.isoformat(),
                        logout_time
                    )
                else:
                    # Middle days: full day (00:00 to 23:59)
                    day_start = datetime.combine(current_date, datetime.min.time()).replace(tzinfo=timezone.utc)
                    day_end = datetime.combine(current_date, datetime.max.time().replace(microsecond=0)).replace(tzinfo=timezone.utc)
                    await self._update_attendance_from_session(
                        session["user_id"],
                        current_date.isoformat(),
                        day_start.isoformat(),
                        day_end.isoformat()
                    )
                
                current_date += timedelta(days=1)
    
    async def _update_attendance_from_session(
        self, 
        user_id: str, 
        date: str, 
        login_time: str, 
        logout_time: str
    ):
        """Update attendance record with session data (while not locked)"""
        import uuid
        
        # Calculate minutes
        login_dt = datetime.fromisoformat(login_time.replace("Z", "+00:00"))
        logout_dt = datetime.fromisoformat(logout_time.replace("Z", "+00:00"))
        minutes = int((logout_dt - login_dt).total_seconds() / 60)
        
        # Get existing record
        record = await self.db.attendance_records.find_one(
            {"employee_id": user_id, "date": date},
            {"_id": 0}
        )
        
        if record:
            if record.get("is_locked"):
                # Cannot modify locked record
                return
            
            # Update existing record
            new_total = record.get("total_active_minutes", 0) + minutes
            first_login = record.get("first_login") or login_time
            
            await self.db.attendance_records.update_one(
                {"id": record["id"]},
                {"$set": {
                    "total_active_minutes": new_total,
                    "first_login": first_login,
                    "last_logout": logout_time,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # Create new record
            new_record = {
                "id": str(uuid.uuid4()),
                "employee_id": user_id,
                "date": date,
                "total_active_minutes": minutes,
                "first_login": login_time,
                "last_logout": logout_time,
                "system_status": "ABSENT",  # Will be calculated by cron
                "hr_override_status": None,
                "override_by": None,
                "override_reason": None,
                "override_at": None,
                "calculated_at": None,
                "is_locked": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await self.db.attendance_records.insert_one(new_record)
    
    # ==================== ATTENDANCE CALCULATION (CRON JOB) ====================
    
    async def calculate_daily_attendance(self, date: Optional[str] = None) -> dict:
        """
        Daily cron job: Calculate attendance for previous day
        Runs at 00:30 AM, processes previous day
        """
        if not date:
            # Default: previous day
            yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
            date = yesterday.isoformat()
        
        # Get all unlocked records for this date
        records = await self.db.attendance_records.find(
            {"date": date, "is_locked": False},
            {"_id": 0}
        ).to_list(10000)
        
        processed = 0
        for record in records:
            minutes = record.get("total_active_minutes", 0)
            
            # Calculate status
            if minutes >= self.MINIMUM_HOURS_FOR_PRESENT * 60:  # 540 minutes
                status = "PRESENT"
            elif minutes > 0:
                status = "PENDING"  # Needs HR approval
            else:
                status = "ABSENT"
            
            # Lock the record
            await self.db.attendance_records.update_one(
                {"id": record["id"]},
                {"$set": {
                    "system_status": status,
                    "calculated_at": datetime.now(timezone.utc).isoformat(),
                    "is_locked": True
                }}
            )
            processed += 1
        
        # Create ABSENT records for employees without any session
        absent_created = await self._create_absent_records(date)
        
        return {
            "date": date,
            "processed": processed,
            "absent_created": absent_created
        }
    
    async def _create_absent_records(self, date: str) -> int:
        """Create ABSENT records for employees who didn't log in"""
        import uuid
        
        # Get all active employees
        employees = await self.db.users.find(
            {"is_active": True},
            {"_id": 0, "id": 1}
        ).to_list(10000)
        
        # Get employees who have records for this date
        existing = await self.db.attendance_records.find(
            {"date": date},
            {"_id": 0, "employee_id": 1}
        ).to_list(10000)
        existing_ids = {r["employee_id"] for r in existing}
        
        # Create ABSENT records for missing employees
        created = 0
        now = datetime.now(timezone.utc).isoformat()
        
        for emp in employees:
            if emp["id"] not in existing_ids:
                record = {
                    "id": str(uuid.uuid4()),
                    "employee_id": emp["id"],
                    "date": date,
                    "total_active_minutes": 0,
                    "first_login": None,
                    "last_logout": None,
                    "system_status": "ABSENT",
                    "hr_override_status": None,
                    "is_locked": True,
                    "calculated_at": now,
                    "created_at": now,
                    "updated_at": now
                }
                await self.db.attendance_records.insert_one(record)
                created += 1
        
        return created
    
    # ==================== HR OVERRIDE ====================
    
    async def override_attendance(
        self,
        record_id: str,
        override_status: str,  # APPROVED or REJECTED
        reason: str,
        hr_user_id: str
    ) -> Optional[dict]:
        """HR override for PENDING attendance records"""
        record = await self.db.attendance_records.find_one(
            {"id": record_id},
            {"_id": 0}
        )
        
        if not record:
            return None
        
        if not record.get("is_locked"):
            raise ValueError("Cannot override unlocked record")
        
        if record.get("system_status") != "PENDING":
            raise ValueError("Can only override PENDING records")
        
        now = datetime.now(timezone.utc).isoformat()
        
        await self.db.attendance_records.update_one(
            {"id": record_id},
            {"$set": {
                "hr_override_status": override_status,
                "override_by": hr_user_id,
                "override_reason": reason,
                "override_at": now,
                "updated_at": now
            }}
        )
        
        record["hr_override_status"] = override_status
        record["override_by"] = hr_user_id
        record["override_reason"] = reason
        record["override_at"] = now
        
        return record
    
    # ==================== ATTENDANCE QUERIES ====================
    
    async def get_employee_attendance(
        self,
        employee_id: str,
        month: Optional[int] = None,
        year: Optional[int] = None
    ) -> List[dict]:
        """Get attendance records for an employee"""
        query = {"employee_id": employee_id}
        
        if month and year:
            # Filter by month
            start_date = f"{year}-{str(month).zfill(2)}-01"
            last_day = calendar.monthrange(year, month)[1]
            end_date = f"{year}-{str(month).zfill(2)}-{last_day}"
            query["date"] = {"$gte": start_date, "$lte": end_date}
        
        records = await self.db.attendance_records.find(
            query, {"_id": 0}
        ).sort("date", -1).to_list(100)
        
        return records
    
    async def get_attendance_summary(
        self,
        employee_id: str,
        month: int,
        year: int
    ) -> dict:
        """Get monthly attendance summary for payroll
        
        Includes data from both:
        - attendance_records (session-based)
        - attendance_overrides (HR manual entries)
        """
        start_date = f"{year}-{str(month).zfill(2)}-01"
        last_day = calendar.monthrange(year, month)[1]
        end_date = f"{year}-{str(month).zfill(2)}-{last_day}"
        
        # Get attendance records (session-based)
        records = await self.db.attendance_records.find(
            {
                "employee_id": employee_id,
                "date": {"$gte": start_date, "$lte": end_date},
                "is_locked": True
            },
            {"_id": 0}
        ).to_list(31)
        
        # Get attendance overrides (HR manual entries)
        overrides = await self.db.attendance_overrides.find(
            {
                "employee_id": employee_id,
                "date": {"$gte": start_date, "$lte": end_date}
            },
            {"_id": 0}
        ).to_list(31)
        
        # Create override map for quick lookup
        override_map = {o["date"]: o["status"] for o in overrides}
        
        # Create record map for quick lookup
        record_map = {}
        for r in records:
            record_map[r["date"]] = r
        
        # Calculate summary considering both sources
        present = 0
        pending = 0
        lop_days = 0  # LOP (Loss of Pay) days
        approved = 0
        rejected = 0
        half_days = 0
        total_minutes = 0
        
        # Process each day of the month
        for day in range(1, last_day + 1):
            date_str = f"{year}-{str(month).zfill(2)}-{str(day).zfill(2)}"
            
            # Check override first (takes precedence)
            if date_str in override_map:
                status = override_map[date_str]
                if status == "present":
                    present += 1
                elif status == "lop" or status == "absent":
                    lop_days += 1
                elif status == "half_day":
                    half_days += 1
                    present += 0.5  # Count half day as 0.5 present
                elif status == "leave_approved":
                    approved += 1
                # Holiday status doesn't count
                continue
            
            # Then check session-based records
            if date_str in record_map:
                r = record_map[date_str]
                status = r.get("system_status", "ABSENT")
                override = r.get("hr_override_status")
                
                if status == "PRESENT":
                    present += 1
                elif status == "PENDING":
                    pending += 1
                    if override == "APPROVED":
                        approved += 1
                    elif override == "REJECTED":
                        rejected += 1
                        lop_days += 1  # Rejected becomes LOP
                elif status == "ABSENT":
                    lop_days += 1
                
                total_minutes += r.get("total_active_minutes", 0)
        
        # Working days (excluding Sundays by default, can be enhanced)
        working_days = last_day - self._count_sundays(year, month)
        
        # Unapproved absent = LOP + (PENDING without APPROVED override)
        unapproved_absent = lop_days + max(0, pending - approved)
        
        return {
            "employee_id": employee_id,
            "month": month,
            "year": year,
            "working_days": working_days,
            "present_days": present,
            "pending_days": pending,
            "lop_days": lop_days,  # Changed from absent_days
            "absent_days": lop_days,  # Keep for backward compatibility
            "half_days": half_days,
            "approved_days": approved,
            "rejected_days": rejected,
            "unapproved_absent_days": unapproved_absent,
            "total_hours_worked": round(total_minutes / 60, 2),
            "average_hours_per_day": round(total_minutes / 60 / max(present + approved, 1), 2)
        }
    
    def _count_sundays(self, year: int, month: int) -> int:
        """Count Sundays in a month"""
        c = calendar.Calendar()
        return sum(1 for day in c.itermonthdays2(year, month) if day[0] != 0 and day[1] == 6)
    
    async def get_pending_approvals(self, country_id: Optional[str] = None) -> List[dict]:
        """Get all pending attendance records for HR approval"""
        # Get employee IDs for country filter
        emp_query = {"is_active": True}
        if country_id:
            emp_query["country_id"] = country_id
        
        employees = await self.db.users.find(emp_query, {"_id": 0, "id": 1, "name": 1}).to_list(10000)
        emp_map = {e["id"]: e["name"] for e in employees}
        emp_ids = list(emp_map.keys())
        
        # Get pending records
        records = await self.db.attendance_records.find(
            {
                "employee_id": {"$in": emp_ids},
                "system_status": "PENDING",
                "hr_override_status": None,
                "is_locked": True
            },
            {"_id": 0}
        ).sort("date", -1).to_list(1000)
        
        # Enrich with employee name
        for r in records:
            r["employee_name"] = emp_map.get(r["employee_id"], "Unknown")
        
        return records
    
    async def get_active_sessions(self, country_id: Optional[str] = None) -> List[dict]:
        """Get all currently active sessions"""
        # Get employee IDs for country filter
        emp_query = {"is_active": True}
        if country_id:
            emp_query["country_id"] = country_id
        
        employees = await self.db.users.find(emp_query, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(10000)
        emp_map = {e["id"]: {"name": e["name"], "email": e["email"]} for e in employees}
        emp_ids = list(emp_map.keys())
        
        sessions = await self.db.user_sessions.find(
            {"user_id": {"$in": emp_ids}, "is_active": True},
            {"_id": 0}
        ).sort("login_at", -1).to_list(1000)
        
        for s in sessions:
            emp_info = emp_map.get(s["user_id"], {})
            s["employee_name"] = emp_info.get("name", "Unknown")
            s["employee_email"] = emp_info.get("email", "")
        
        return sessions
