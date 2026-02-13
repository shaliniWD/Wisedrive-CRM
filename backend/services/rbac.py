"""RBAC Service - Role-Based Access Control"""
from typing import Optional, List, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase


class RBACService:
    """Service for checking permissions and access control"""
    
    # Role codes
    CEO = "CEO"
    HR_MANAGER = "HR_MANAGER"
    COUNTRY_HEAD = "COUNTRY_HEAD"
    SALES_HEAD = "SALES_HEAD"
    INSPECTION_HEAD = "INSPECTION_HEAD"
    SALES_LEAD = "SALES_LEAD"
    INSPECTION_LEAD = "INSPECTION_LEAD"
    SALES_EXEC = "SALES_EXEC"
    INSPECTION_COORD = "INSPECTION_COORD"
    REPORT_REVIEWER = "REPORT_REVIEWER"
    MECHANIC = "MECHANIC"
    
    # Scope levels
    SCOPE_ALL = "all"
    SCOPE_COUNTRY = "country"
    SCOPE_TEAM = "team"
    SCOPE_OWN = "own"
    
    # Tab visibility by role code
    TAB_VISIBILITY = {
        CEO: ["leads", "customers", "inspections", "reports", "employees", "settings", "finance"],
        HR_MANAGER: ["employees"],  # HR only sees Admin (employees)
        COUNTRY_HEAD: ["leads", "customers", "inspections", "reports", "employees", "settings", "finance"],
        SALES_HEAD: ["leads", "customers", "employees", "finance"],
        INSPECTION_HEAD: ["customers", "inspections", "reports", "employees", "finance"],
        SALES_LEAD: ["leads", "customers"],
        INSPECTION_LEAD: ["customers", "inspections", "reports"],
        SALES_EXEC: ["leads"],
        INSPECTION_COORD: ["inspections"],
        REPORT_REVIEWER: ["inspections", "reports"],
        MECHANIC: [],  # Mechanics don't have CRM access
    }

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._permissions_cache: Dict[str, List[dict]] = {}

    async def get_user_permissions(self, user_id: str) -> List[dict]:
        """Get all permissions for a user based on their role"""
        if user_id in self._permissions_cache:
            return self._permissions_cache[user_id]
        
        # Get user's role
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0, "role_id": 1})
        if not user:
            return []
        
        role_id = user.get("role_id")
        if not role_id:
            return []
        
        # Get role permissions
        role_perms = await self.db.role_permissions.find(
            {"role_id": role_id}, {"_id": 0}
        ).to_list(100)
        
        permissions = []
        for rp in role_perms:
            perm = await self.db.permissions.find_one(
                {"id": rp["permission_id"]}, {"_id": 0}
            )
            if perm:
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
                    return {"$or": [
                        {"assigned_to": user_id},
                        {"created_by": user_id}
                    ]}
        
        return {"id": "NONE"}  # No permission - block all

    async def get_visible_tabs(self, user_id: str) -> List[str]:
        """Get list of tabs visible to user based on role"""
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0, "role_id": 1})
        if not user:
            return []
        
        role = await self.db.roles.find_one(
            {"id": user.get("role_id")}, {"_id": 0, "code": 1}
        )
        if not role:
            return []
        
        role_code = role.get("code", "")
        return self.TAB_VISIBILITY.get(role_code, [])

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
