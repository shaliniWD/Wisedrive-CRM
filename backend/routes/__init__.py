"""Routes Package - Modular API Routes for WiseDrive CRM"""

from .auth import router as auth_router, init_auth_routes, get_current_user

__all__ = [
    'auth_router',
    'init_auth_routes', 
    'get_current_user'
]
