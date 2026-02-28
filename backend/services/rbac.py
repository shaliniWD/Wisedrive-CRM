"""RBAC Service - Role-Based Access Control"""
from typing import Optional, List, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase


class RBACService:
    """Service for checking permissions and access control"""
    
    # Role codes
    CEO = "CEO"
    CTO = "CTO"
    HR_MANAGER = "HR_MANAGER"
    FINANCE_MANAGER = "FINANCE_MANAGER"
    COUNTRY_HEAD = "COUNTRY_HEAD"
    SALES_HEAD = "SALES_HEAD"
    INSPECTION_HEAD = "INSPECTION_HEAD"
    SALES_LEAD = "SALES_LEAD"
    INSPECTION_LEAD = "INSPECTION_LEAD"
    SALES_EXEC = "SALES_EXEC"
    INSPECTION_COORD = "INSPECTION_COORD"
    REPORT_REVIEWER = "REPORT_REVIEWER"
    MECHANIC = "MECHANIC"
    FREELANCER = "FREELANCER"
    
    # Scope levels
    SCOPE_ALL = "all"
    SCOPE_COUNTRY = "country"
    SCOPE_TEAM = "team"
    SCOPE_OWN = "own"
    
    # Tab visibility by role code
    TAB_VISIBILITY = {
        CEO: ["leads", "customers", "inspections", "loans", "reports", "hr", "settings", "finance", "ad-analytics"],
        CTO: ["leads", "customers", "inspections", "loans", "reports", "hr", "settings", "finance", "ad-analytics"],
        HR_MANAGER: ["leads", "hr", "finance", "ad-analytics"],  # HR sees Leads, HR Module (includes employees) and Finance
        FINANCE_MANAGER: ["finance", "hr", "loans"],  # Finance Manager sees Finance, HR Module and Loans
        COUNTRY_HEAD: ["leads", "customers", "inspections", "loans", "reports", "hr", "settings", "finance", "ad-analytics"],
        SALES_HEAD: ["leads", "customers", "loans", "hr", "ad-analytics"],
        INSPECTION_HEAD: ["customers", "inspections", "loans", "reports", "hr"],
        SALES_LEAD: ["leads", "customers", "loans", "hr"],
        INSPECTION_LEAD: ["customers", "inspections", "loans", "reports", "hr"],
        SALES_EXEC: ["leads"],  # Sales executives ONLY see leads tab
        INSPECTION_COORD: ["inspections", "hr"],
        REPORT_REVIEWER: ["inspections", "reports", "hr"],
        MECHANIC: ["hr"],  # Mechanics can access HR for leave/attendance
        FREELANCER: ["hr"],  # Freelancers only access HR for their own leave/attendance/payslips
    }

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._permissions_cache: Dict[str, List[dict]] = {}

    async def get_user_permissions(self, user_id: str) -> List[dict]:
        """Get all permissions for a user based on their role(s) - supports multiple roles"""
        if user_id in self._permissions_cache:
            return self._permissions_cache[user_id]
        
        # Get user's roles (supporting both single role_id and multiple role_ids)
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0, "role_id": 1, "role_ids": 1})
        if not user:
            return []
        
        # Collect all role IDs (primary + additional roles)
        role_ids = []
        if user.get("role_ids"):
            role_ids.extend(user["role_ids"])
        elif user.get("role_id"):
            role_ids.append(user["role_id"])
        
        if not role_ids:
            return []
        
        # Get permissions from all roles and aggregate them
        permissions = []
        seen_perms = set()  # Track unique permissions
        
        for role_id in role_ids:
            role_perms = await self.db.role_permissions.find(
                {"role_id": role_id}, {"_id": 0}
            ).to_list(100)
            
            for rp in role_perms:
                perm = await self.db.permissions.find_one(
                    {"id": rp["permission_id"]}, {"_id": 0}
                )
                if perm:
                    perm_key = f"{perm['name']}_{rp.get('scope', 'own')}"
                    if perm_key not in seen_perms:
                        seen_perms.add(perm_key)
                        permissions.append({
                            "name": perm["name"],
                            "resource": perm["resource"],
                            "action": perm["action"],
                            "scope": rp.get("scope", "own")
                        })
        
        self._permissions_cache[user_id] = permissions
        return permissions

    async def has_permission(
        self, 
        user_id: str, 
        permission_name: str,
        resource_country_id: Optional[str] = None,
        resource_team_id: Optional[str] = None,
        resource_owner_id: Optional[str] = None
    ) -> bool:
        """Check if user has a specific permission with scope validation"""
        permissions = await self.get_user_permissions(user_id)
        
        for perm in permissions:
            if perm["name"] == permission_name:
                scope = perm["scope"]
                
                # ALL scope - full access
                if scope == self.SCOPE_ALL:
                    return True
                
                # Get user details for scope checking
                user = await self.db.users.find_one(
                    {"id": user_id}, 
                    {"_id": 0, "country_id": 1, "team_id": 1}
                )
                if not user:
                    return False
                
                # COUNTRY scope - check country match
                if scope == self.SCOPE_COUNTRY:
                    if resource_country_id and user.get("country_id") == resource_country_id:
                        return True
                    return False
                
                # TEAM scope - check team match
                if scope == self.SCOPE_TEAM:
                    if resource_team_id and user.get("team_id") == resource_team_id:
                        return True
                    return False
                
                # OWN scope - check ownership
                if scope == self.SCOPE_OWN:
                    if resource_owner_id == user_id:
                        return True
                    return False
        
        return False

    async def get_data_filter(self, user_id: str, permission_name: str) -> dict:
        """Get MongoDB filter based on user's permission scope"""
        permissions = await self.get_user_permissions(user_id)
        
        for perm in permissions:
            if perm["name"] == permission_name:
                scope = perm["scope"]
                
                if scope == self.SCOPE_ALL:
                    return {}  # No filter - access all
                
                user = await self.db.users.find_one(
                    {"id": user_id}, 
                    {"_id": 0, "country_id": 1, "team_id": 1}
                )
                if not user:
                    return {"id": "NONE"}  # Block all access
                
                if scope == self.SCOPE_COUNTRY:
                    return {"country_id": user.get("country_id")}
                
                if scope == self.SCOPE_TEAM:
                    return {"team_id": user.get("team_id")}
                
                if scope == self.SCOPE_OWN:
                    # For leads.view, only filter by assigned_to (not created_by)
                    # This ensures sales execs only see leads currently assigned to them
                    if permission_name == "leads.view":
                        return {"assigned_to": user_id}
                    # For other resources, use both assigned_to and created_by
                    return {"$or": [
                        {"assigned_to": user_id},
                        {"created_by": user_id}
                    ]}
        
        return {"id": "NONE"}  # No permission - block all

    async def get_visible_tabs(self, user_id: str) -> List[str]:
        """Get list of tabs visible to user based on their role(s) - aggregates from all roles"""
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0, "role_id": 1, "role_ids": 1})
        if not user:
            return []
        
        # Collect all role IDs
        role_ids = []
        if user.get("role_ids"):
            role_ids.extend(user["role_ids"])
        elif user.get("role_id"):
            role_ids.append(user["role_id"])
        
        if not role_ids:
            return []
        
        # Mapping from page permission names to tab names
        PAGE_TO_TAB = {
            "dashboard": "dashboard",
            "leads": "leads",
            "customers": "customers",
            "inspections": "inspections",
            "loans": "loans",
            "employees": "hr",
            "hr": "hr",
            "finance": "finance",
            "settings": "settings",
            "reports": "reports",
            "ad-analytics": "ad-analytics",
        }
        
        # Aggregate visible tabs from all roles
        visible_tabs = set()
        for role_id in role_ids:
            role = await self.db.roles.find_one(
                {"id": role_id}, {"_id": 0, "code": 1, "permissions": 1}
            )
            if role:
                role_code = role.get("code", "")
                role_permissions = role.get("permissions", [])
                
                # If role has custom permissions stored, use those
                if role_permissions and len(role_permissions) > 0:
                    for perm in role_permissions:
                        page = perm.get("page", "")
                        if perm.get("view", False):
                            # Map page to tab name
                            tab = PAGE_TO_TAB.get(page, page)
                            visible_tabs.add(tab)
                else:
                    # Fall back to preset visibility for known roles
                    tabs = self.TAB_VISIBILITY.get(role_code, [])
                    visible_tabs.update(tabs)
        
        # Note: Dashboard is included in TAB_VISIBILITY for roles that should see it
        # SALES_EXEC intentionally only has ["leads"] without dashboard
        
        return list(visible_tabs)

    async def can_reassign_lead(self, user_id: str, lead_team_id: Optional[str] = None) -> bool:
        """Check if user can reassign leads"""
        user = await self.db.users.find_one(
            {"id": user_id}, 
            {"_id": 0, "role_id": 1, "team_id": 1}
        )
        if not user:
            return False
        
        role = await self.db.roles.find_one(
            {"id": user.get("role_id")}, {"_id": 0, "code": 1}
        )
        if not role:
            return False
        
        role_code = role.get("code", "")
        
        # CEO and Sales Head can reassign any lead in their scope
        if role_code in [self.CEO, self.SALES_HEAD]:
            return True
        
        # Sales Lead can only reassign within their team
        if role_code == self.SALES_LEAD:
            user_team_id = user.get("team_id")
            if lead_team_id and user_team_id == lead_team_id:
                return True
            return False
        
        return False

    async def can_view_salary(self, viewer_id: str, target_user_id: str) -> bool:
        """Check if viewer can see target user's salary"""
        viewer = await self.db.users.find_one(
            {"id": viewer_id}, 
            {"_id": 0, "role_id": 1, "country_id": 1, "department_id": 1}
        )
        if not viewer:
            return False
        
        role = await self.db.roles.find_one(
            {"id": viewer.get("role_id")}, {"_id": 0, "code": 1}
        )
        if not role:
            return False
        
        role_code = role.get("code", "")
        
        # CEO and HR can view all salaries
        if role_code in [self.CEO, self.HR_MANAGER]:
            return True
        
        target = await self.db.users.find_one(
            {"id": target_user_id}, 
            {"_id": 0, "country_id": 1, "department_id": 1}
        )
        if not target:
            return False
        
        # Country Head can view salaries in their country
        if role_code == self.COUNTRY_HEAD:
            return viewer.get("country_id") == target.get("country_id")
        
        # Sales Head can view sales team salaries in their country
        if role_code == self.SALES_HEAD:
            sales_dept = await self.db.departments.find_one({"code": "SALES"}, {"_id": 0, "id": 1})
            if sales_dept and target.get("department_id") == sales_dept.get("id"):
                return viewer.get("country_id") == target.get("country_id")
            return False
        
        # Inspection Head can view inspection team salaries
        if role_code == self.INSPECTION_HEAD:
            insp_dept = await self.db.departments.find_one({"code": "INSPECTION"}, {"_id": 0, "id": 1})
            if insp_dept and target.get("department_id") == insp_dept.get("id"):
                return viewer.get("country_id") == target.get("country_id")
            return False
        
        return False

    def clear_cache(self, user_id: Optional[str] = None):
        """Clear permission cache"""
        if user_id:
            self._permissions_cache.pop(user_id, None)
        else:
            self._permissions_cache.clear()
