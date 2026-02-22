"""
Routes Package - Modular API Routes for WiseDrive CRM

This package contains organized route modules that can be gradually
migrated from the monolithic server.py file.

Current structure:
- auth.py: Authentication routes (login, token, user info)
- leads.py: Lead management routes (CRUD, status, notes, reminders)
- partners.py: Partner/client management
- webhooks.py: Twilio WhatsApp and external webhooks
- meta_ads.py: Meta/Facebook Ads API integration
- inspections.py: Vehicle inspection management

Migration Strategy:
1. Route templates are created in separate files
2. Actual implementations remain in server.py until tested
3. Gradual migration with thorough testing
4. server.py will eventually just import and mount routers
"""

from .auth import router as auth_router, init_auth_routes, get_current_user
from .leads import router as leads_router, init_leads_routes
from .partners import router as partners_router, init_partners_routes
from .webhooks import router as webhooks_router, init_webhooks_routes
from .meta_ads import router as meta_ads_router, init_meta_ads_routes
from .inspections import router as inspections_router, init_inspections_routes

__all__ = [
    # Auth
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
