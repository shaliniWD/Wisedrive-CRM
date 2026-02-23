"""
Routes Package - Modular API Routes for WiseDrive CRM

This package contains organized route modules that can be gradually
migrated from the monolithic server.py file.

Current structure:
- auth.py: Authentication routes (login, token, user info) - MIGRATED
- leads.py: Lead management routes (CRUD, status, notes, reminders)
- partners.py: Partner/client management
- webhooks.py: Twilio WhatsApp and external webhooks
- meta_ads.py: Meta/Facebook Ads API integration
- inspections.py: Vehicle inspection management

Migration Strategy:
1. Use factory functions (create_*_router) to inject dependencies
2. Each router is self-contained with its own auth dependency
3. server.py includes routers with app.include_router()
4. Gradual migration with thorough testing

Usage Example:
    from routes.auth import create_auth_router
    auth_router = create_auth_router(db, SECRET_KEY, rbac_service)
    app.include_router(auth_router, prefix="/api")
"""

# Auth module - MIGRATED to factory pattern
from .auth import create_auth_router, Token, UserLogin, TokenUser

# Legacy exports for backward compatibility
from .auth import router as auth_router, init_auth_routes, get_current_user
from .leads import router as leads_router, init_leads_routes
from .partners import router as partners_router, init_partners_routes
from .webhooks import router as webhooks_router, init_webhooks_routes
from .meta_ads import router as meta_ads_router, init_meta_ads_routes
from .inspections import router as inspections_router, init_inspections_routes

__all__ = [
    # New factory functions (recommended)
    'create_auth_router',
    'Token',
    'UserLogin', 
    'TokenUser',
    
    # Legacy Auth (deprecated - use create_auth_router)
    'auth_router',
    'init_auth_routes',
    'get_current_user',
    
    # Leads
    'leads_router',
    'init_leads_routes',
    
    # Partners
    'partners_router',
    'init_partners_routes',
    
    # Webhooks
    'webhooks_router',
    'init_webhooks_routes',
    
    # Meta Ads
    'meta_ads_router',
    'init_meta_ads_routes',
    
    # Inspections
    'inspections_router',
    'init_inspections_routes',
]
