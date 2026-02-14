"""
Wisedrive API Services - RBAC Middleware
Role-Based Access Control enforcement
"""
from typing import Dict, List, Optional, Set
from functools import wraps
from fastapi import HTTPException, status, Request
import logging

logger = logging.getLogger(__name__)


class RBACService:
    """
    Role-Based Access Control service.
    Manages permissions and data access scopes.
    """
    
    # Permission scopes (from most restrictive to least)
    SCOPE_OWN = "own"
    SCOPE_TEAM = "team"
    SCOPE_COUNTRY = "country"
    SCOPE_ALL = "all"
    
    # Tab visibility by role code
    TAB_VISIBILITY = {
        "CEO": ["dashboard", "leads", "customers", "inspections", "hr", "finance", "admin", "reports", "settings"],
        "COUNTRY_HEAD": ["dashboard", "leads", "customers", "inspections", "hr", "finance", "reports"],
        "HR_MANAGER": ["dashboard", "hr", "finance"],
        "FINANCE_MANAGER": ["dashboard", "finance", "reports"],
        "SALES_HEAD": ["dashboard", "leads", "customers", "reports"],
        "SALES_LEAD": ["dashboard", "leads", "customers"],
        "SALES_EXEC": ["dashboard", "leads"],
        "INSPECTION_HEAD": ["dashboard", "inspections", "reports"],
        "INSPECTION_LEAD": ["dashboard", "inspections"],
        "MECHANIC": ["inspections"],
    }
    
    # Default permissions by role
    DEFAULT_PERMISSIONS = {
        "CEO": {
            "leads.view": "all",
            "leads.create": "all",
            "leads.update": "all",
            "leads.delete": "all",
            "customers.view": "all",
            "customers.create": "all",
            "employees.view": "all",
            "employees.create": "all",
            "employees.update": "all",
            "finance.view": "all",
            "finance.create": "all",
            "finance.approve": "all",
            "inspections.view": "all",
            "inspections.assign": "all",
            "reports.view": "all",
            "admin.view": "all",
            "admin.manage": "all",
        },
        "COUNTRY_HEAD": {
            "leads.view": "country",
            "leads.create": "country",
            "leads.update": "country",
            "customers.view": "country",
            "customers.create": "country",
            "employees.view": "country",
            "finance.view": "country",
            "finance.create": "country",
            "inspections.view": "country",
            "inspections.assign": "country",
            "reports.view": "country",
        },
        "SALES_HEAD": {
            "leads.view": "team",
            "leads.create": "team",
            "leads.update": "team",
            "leads.reassign": "team",
            "customers.view": "team",
            "customers.create": "team",
            "reports.view": "team",
        },
        "SALES_LEAD": {
            "leads.view": "team",
            "leads.create": "team",
            "leads.update": "team",
            "customers.view": "team",
        },
        "SALES_EXEC": {
            "leads.view": "own",
            "leads.update": "own",
            "customers.view": "own",
        },
        "HR_MANAGER": {
            "employees.view": "country",
            "employees.create": "country",
            "employees.update": "country",
            "finance.view": "country",
            "finance.create": "country",
        },
        "FINANCE_MANAGER": {
            "finance.view": "country",
            "finance.create": "country",
            "finance.approve": "country",
            "reports.view": "country",
        },
        "INSPECTION_HEAD": {
            "inspections.view": "country",
            "inspections.assign": "country",
            "reports.view": "country",
        },
        "MECHANIC": {
            "inspections.view": "own",
            "inspections.update": "own",
        },
    }
    
    def __init__(self, db):
        self.db = db
        self._permissions_cache: Dict[str, List[dict]] = {}
    
    async def get_user_permissions(self, user_id: str) -> List[dict]:
        """Get all permissions for a user based on their role(s)"""
        if user_id in self._permissions_cache:
            return self._permissions_cache[user_id]
        
        user = await self.db.users.find_one(
            {"id": user_id}, 
            {"_id": 0, "role_id": 1, "role_ids": 1}
        )
        if not user:
            return []
        
        # Collect all role IDs (support multi-role)
        role_ids = user.get("role_ids", [])
        if not role_ids and user.get("role_id"):
            role_ids = [user["role_id"]]
        
        if not role_ids:
            return []
        
        # Get permissions from all roles
        permissions = []
        seen_perms: Set[str] = set()
        
        for role_id in role_ids:
            role = await self.db.roles.find_one({"id": role_id}, {"_id": 0, "code": 1})
            if not role:
                continue
                
            role_code = role.get("code", "")
            role_perms = self.DEFAULT_PERMISSIONS.get(role_code, {})
            
            for perm_name, scope in role_perms.items():
                perm_key = f"{perm_name}_{scope}"
                if perm_key not in seen_perms:
                    seen_perms.add(perm_key)
                    resource, action = perm_name.rsplit(".", 1)
                    permissions.append({
                        "name": perm_name,
                        "resource": resource,
                        "action": action,
                        "scope": scope
                    })
        
        self._permissions_cache[user_id] = permissions
        return permissions
    
    async def check_permission(
        self, 
        user_id: str, 
        permission: str, 
        required_scope: str = "own"
    ) -> bool:
        """Check if user has specific permission with required scope"""
        permissions = await self.get_user_permissions(user_id)
        
        scope_levels = [self.SCOPE_OWN, self.SCOPE_TEAM, self.SCOPE_COUNTRY, self.SCOPE_ALL]
        required_level = scope_levels.index(required_scope)
        
        for perm in permissions:
            if perm["name"] == permission:
                user_level = scope_levels.index(perm["scope"])
                return user_level >= required_level
        
        return False
    
    async def get_data_filter(
        self, 
        user_id: str, 
        permission: str
    ) -> Dict:
        """Get MongoDB query filter based on user's data access scope"""
        user = await self.db.users.find_one(
            {"id": user_id},
            {"_id": 0, "id": 1, "country_id": 1, "team_id": 1, "role_ids": 1, "role_id": 1}
        )
        
        if not user:
            return {"id": "__none__"}  # Return impossible filter
        
        permissions = await self.get_user_permissions(user_id)
        
        for perm in permissions:
            if perm["name"] == permission:
                scope = perm["scope"]
                
                if scope == self.SCOPE_ALL:
                    return {}  # No filter
                elif scope == self.SCOPE_COUNTRY:
                    return {"country_id": user.get("country_id")}
                elif scope == self.SCOPE_TEAM:
                    return {"team_id": user.get("team_id")}
                else:  # own
                    return {"assigned_to": user_id}
        
        # No permission found - return impossible filter
        return {"id": "__none__"}
    
    async def get_visible_tabs(self, user_id: str) -> List[str]:
        """Get list of visible tabs for user based on roles"""
        user = await self.db.users.find_one(
            {"id": user_id}, 
            {"_id": 0, "role_id": 1, "role_ids": 1}
        )
        
        if not user:
            return []
        
        role_ids = user.get("role_ids", [])
        if not role_ids and user.get("role_id"):
            role_ids = [user["role_id"]]
        
        visible_tabs: Set[str] = set()
        
        for role_id in role_ids:
            role = await self.db.roles.find_one({"id": role_id}, {"_id": 0, "code": 1})
            if role:
                tabs = self.TAB_VISIBILITY.get(role.get("code", ""), [])
                visible_tabs.update(tabs)
        
        return list(visible_tabs)
    
    def clear_cache(self, user_id: Optional[str] = None):
        """Clear permissions cache"""
        if user_id:
            self._permissions_cache.pop(user_id, None)
        else:
            self._permissions_cache.clear()


def require_permission(permission: str, scope: str = "own"):
    """
    Decorator for route handlers to enforce permissions.
    
    Usage:
        @router.get("/leads")
        @require_permission("leads.view", "country")
        async def get_leads(current_user: dict = Depends(get_current_user)):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current_user from kwargs (injected by Depends)
            current_user = kwargs.get("current_user")
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Check permission
            rbac = kwargs.get("rbac_service")
            if rbac:
                has_permission = await rbac.check_permission(
                    current_user["id"], 
                    permission, 
                    scope
                )
                if not has_permission:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission denied: {permission}"
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
