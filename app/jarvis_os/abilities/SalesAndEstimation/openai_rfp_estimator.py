import os
import json
import logging

logger = logging.getLogger(__name__)

class OpenAIRFPEstimator:
    """
    OpenAI Deep Reasoning RFP Estimator
    Utilizes the newest ChatGPT models (gpt-4o / o1-ready) to deeply analyze
    heavy commercial paving RFPs and generate calculated cost estimates.
    """
    def __init__(self):
        # Routed through the shared multi-provider LLM client, so this runs on
        # whichever provider is live (Claude first, then OpenAI/Gemini/xAI)
        # rather than being dark whenever OPENAI_API_KEY is unset.
        self.model = "auto"

    def execute(self, params: dict = None) -> dict:
        params = params or {}
        rfp_text = params.get("rfp_text") or params.get("query") or params.get("prompt") or "Standard commercial parking lot asphalt paving RFP"
        import asyncio
        try:
            return asyncio.run(self.analyze_commercial_rfp(rfp_text))
        except Exception:
            return self._mock_analysis()

    async def analyze_commercial_rfp(self, rfp_text: str) -> dict:
        """
        Takes raw text from an RFP (up to 128k tokens) and reasons through the math.
        """
        prompt = f"""
You are the elite Chief Estimator for a multi-million dollar paving company.
Use deep reasoning to analyze the following commercial RFP and calculate our bid.
Assume liquid asphalt costs $600/ton.
Return your final reasoning and estimates STRICTLY in this JSON format:
{{
    "estimated_sqft": <int>,
    "estimated_asphalt_tons": <float>,
    "materials_cost": <int>,
    "recommended_bid_price": <int>,
    "win_probability_score": "<string (e.g., HIGH, MEDIUM, LOW)>",
    "reasoning": "<string summarizing your mathematical breakdown>"
}}

--- RFP TEXT ---
{rfp_text}
"""
        try:
            from starlette.concurrency import run_in_threadpool
            from app.services.llm_client import chat as llm_chat

            # llm_chat is synchronous — keep it off the event loop.
            response = await run_in_threadpool(
                llm_chat,
                task="reasoning",
                system=(
                    "You are a highly advanced estimation AI that only outputs valid JSON. "
                    "Return ONLY the raw JSON object — no markdown fences, no commentary."
                ),
                user=prompt,
                max_tokens=1500,
                temperature=0.2,
            )
            if response.error:
                logger.error("RFP estimation: no LLM provider available: %s", response.error_detail)
                return self._mock_analysis()

            raw = (response.text or "").strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()
            return json.loads(raw)

        except Exception as e:
            logger.error(f"RFP Estimation failed: {str(e)}")
            return self._mock_analysis()

    def _mock_analysis(self) -> dict:
        """Fallback for tests or if the key is missing."""
        return {
            "estimated_sqft": 150000,
            "estimated_asphalt_tons": 1875.5,
            "materials_cost": 1125300,
            "recommended_bid_price": 1850000,
            "win_probability_score": "HIGH",
            "reasoning": "Fallback calculation. Assuming 150k sqft at standard depth yields ~1875 tons. Added 60% margin."
        }
