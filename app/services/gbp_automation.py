"""
gbp_automation.py — Google Business Profile Automation

Features:
1. Review requests (SMS/Email)
2. GBP Posts Drafting (Gemini) -> Push to API
3. Reviews sync -> Backend Cache
"""

import httpx
import logging
from datetime import datetime, timezone
import json

from . import runtime_config as _cfg

logger = logging.getLogger(__name__)

async def draft_gbp_post(topic: str = "seasonal maintenance") -> dict:
    """
    Drafts an SEO-optimized GBP post using Google Gemini.
    """
    gemini_key = _cfg.get("GEMINI_API_KEY")
    if not gemini_key:
        return {"ok": False, "reason": "GEMINI_API_KEY missing"}

    prompt = (
        f"Write a 150-word Google Business Profile post about {topic} for "
        "an asphalt paving contractor in Virginia. Include a call to action to get a free estimate. "
        "Ensure it is highly local and SEO optimized."
    )

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={gemini_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}]
                }
            )
            
            if resp.status_code != 200:
                logger.error(f"Gemini error: {resp.text}")
                return {"ok": False, "reason": "Gemini API failed"}
                
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            
            return {
                "ok": True,
                "draft": text,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    except Exception as e:
        logger.error(f"Failed to draft GBP post: {e}")
        return {"ok": False, "reason": str(e)}


async def push_gbp_post(location_id: str, content: str) -> dict:
    """
    Pushes an approved draft to the Google Business Profile API.
    """
    token = _cfg.get("GBP_OAUTH_TOKEN")
    if not token:
         return {"ok": False, "reason": "GBP_OAUTH_TOKEN missing"}
    account_id = _cfg.get("GBP_ACCOUNT_ID")
    if not account_id:
        return {"ok": False, "reason": "GBP_ACCOUNT_ID missing"}

    url = f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/localPosts"
    payload = {
        "languageCode": "en-US",
        "summary": content,
        "callToAction": {
            "actionType": "LEARN_MORE",
            "url": "https://www.jwordenasphaltpaving.com/quote"
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )
            if resp.status_code == 200:
                return {"ok": True, "data": resp.json()}
            return {"ok": False, "reason": f"GBP API error: {resp.text}"}
    except Exception as e:
        return {"ok": False, "reason": str(e)}


async def fetch_gbp_reviews(location_id: str) -> dict:
    """
    Fetches the latest reviews from GBP to cache for the homepage carousel.
    """
    token = _cfg.get("GBP_OAUTH_TOKEN")
    if not token:
        return {"ok": False, "reason": "GBP_OAUTH_TOKEN missing"}
    account_id = _cfg.get("GBP_ACCOUNT_ID")
    if not account_id:
        return {"ok": False, "reason": "GBP_ACCOUNT_ID missing"}

    url = f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/reviews"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"}
            )
            if resp.status_code == 200:
                return {"ok": True, "reviews": resp.json().get("reviews", [])}
            return {"ok": False, "reason": f"GBP Review fetch err: {resp.text}"}
    except Exception as e:
        return {"ok": False, "reason": str(e)}

async def send_review_request_sms(phone: str, customer_name: str, job_type: str, location: str) -> dict:
    """
    Sends a post-job SMS asking for a review (via Twilio).
    """
    sid = _cfg.get("TWILIO_ACCOUNT_SID")
    token = _cfg.get("TWILIO_AUTH_TOKEN")
    from_num = _cfg.get("ADMIN_2FA_PHONE") # As fallback sender
    gbp_link = _cfg.get("GBP_REVIEW_LINK", "https://g.page/r/YOUR_ID/review")
    
    if not all([sid, token, from_num]):
        return {"ok": False, "reason": "Twilio not configured"}
        
    msg = (f"Hi {customer_name}, thanks for choosing J. Worden & Sons for your {job_type} in {location}! "
           f"If you have 30 seconds, a quick Google review really helps our local family business: {gbp_link}")
           
    import base64
    import urllib.parse
    
    auth = base64.b64encode(f"{sid}:{token}".encode()).decode()
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                headers={
                    "Authorization": f"Basic {auth}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                content=urllib.parse.urlencode({
                    "From": from_num,
                    "To": phone,
                    "Body": msg
                })
            )
            if resp.status_code == 201:
                return {"ok": True, "sid": resp.json().get("sid")}
            return {"ok": False, "reason": resp.text}
    except Exception as e:
        return {"ok": False, "reason": str(e)}
