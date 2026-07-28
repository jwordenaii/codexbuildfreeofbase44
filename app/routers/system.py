from fastapi import APIRouter, Depends
import os

router = APIRouter(prefix="/api/v1/system", tags=["system"])

@router.get("/apis")
async def get_api_statuses():
    """
    Returns the configured status of all external APIs used by the J. Worden system.
    This reads from the environment and provides a single pane of glass for the Super Admin.
    """
    apis = []
    
    # AI Providers
    apis.append({
        "id": "openai",
        "name": "OpenAI",
        "provider": "openai",
        "category": "ai",
        "status": "connected" if os.getenv("OPENAI_API_KEY") else "missing",
        "models": ["gpt-5.6-turbo", "gpt-4o", "gpt-4o-mini"],
        "monthly_estimate": 450.00
    })
    
    apis.append({
        "id": "anthropic",
        "name": "Anthropic",
        "provider": "anthropic",
        "category": "ai",
        "status": "connected" if os.getenv("ANTHROPIC_API_KEY") else "missing",
        "models": ["claude-opus-4-6", "claude-sonnet-4-6"],
        "monthly_estimate": 120.00
    })
    
    apis.append({
        "id": "google",
        "name": "Google Gemini",
        "provider": "google",
        "category": "ai",
        "status": "connected" if os.getenv("GEMINI_API_KEY") else "missing",
        "models": ["gemini-2.5-pro", "gemini-2.5-flash"],
        "monthly_estimate": 15.50
    })
    
    apis.append({
        "id": "perplexity",
        "name": "Perplexity",
        "provider": "perplexity",
        "category": "ai",
        "status": "connected" if os.getenv("PERPLEXITY_API_KEY") else "missing",
        "models": ["sonar-pro"],
        "monthly_estimate": 5.00
    })
    
    apis.append({
        "id": "xai",
        "name": "xAI (Grok)",
        "provider": "xai",
        "category": "ai",
        "status": "connected" if os.getenv("XAI_API_KEY") else "missing",
        "models": ["grok-4"],
        "monthly_estimate": 8.00
    })
    
    # Comms & Voice
    apis.append({
        "id": "twilio",
        "name": "Twilio",
        "provider": "twilio",
        "category": "comms",
        "status": "connected" if os.getenv("TWILIO_ACCOUNT_SID") else "missing",
        "monthly_estimate": 45.00
    })
    
    apis.append({
        "id": "vapi",
        "name": "Vapi Voice AI",
        "provider": "vapi",
        "category": "comms",
        "status": "connected" if os.getenv("VAPI_API_KEY") else "missing",
        "monthly_estimate": 80.00
    })
    
    # Financial
    apis.append({
        "id": "stripe",
        "name": "Stripe Payments",
        "provider": "stripe",
        "category": "finance",
        "status": "connected" if os.getenv("STRIPE_SECRET_KEY") else "missing",
        "monthly_estimate": 0.00 # Percentage based
    })
    
    # Infrastructure
    apis.append({
        "id": "godaddy",
        "name": "GoDaddy DNS",
        "provider": "godaddy",
        "category": "infra",
        "status": "connected", # Validated via Powershell scripts
        "monthly_estimate": 25.00
    })
    
    apis.append({
        "id": "vercel",
        "name": "Vercel Frontend",
        "provider": "vercel",
        "category": "infra",
        "status": "connected",
        "monthly_estimate": 20.00
    })
    
    apis.append({
        "id": "flyio",
        "name": "Fly.io Backend",
        "provider": "flyio",
        "category": "infra",
        "status": "connected",
        "monthly_estimate": 29.00
    })

    return {"apis": apis}
