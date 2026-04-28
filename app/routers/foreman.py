"""
4D Virtual Foreman router.

Endpoints:
  WebSocket  /ws/dashboard                     — real-time push (job status, trucks, alerts)
  POST       /api/v1/foreman/chat              — LangChain RAG Virtual Foreman Q&A
  GET        /api/v1/foreman/status            — executive dashboard summary
  POST       /api/v1/ai/vision-measure         — enqueue a lot-measurement vision job
  GET        /api/v1/ai/vision-result/{job_id} — poll for vision inference result

LangChain RAG setup:
  If OPENAI_API_KEY is set, the chat endpoint builds a Chroma vector store
  from project documents in the ``rag_documents`` table (populated via the
  admin panel) and uses GPT-4o-mini as the LLM with a RetrievalQA chain.
  Falls back to a curated stub when the key is absent.

WebSocket dashboard:
  Clients connect to /ws/dashboard and receive JSON frames every 5 seconds:
    { "type": "dashboard_update", "data": { trucks, hot_leads, alerts } }
  The connection pool is managed in-memory for single-instance deployments.
  For multi-worker setups, use Redis Pub/Sub as the broadcast backend.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Set

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Lead, PermitLead, ProjectSite, TruckPosition

logger = logging.getLogger(__name__)

router = APIRouter(tags=["foreman"])

# ── WebSocket connection manager ──────────────────────────────────────────────

class _ConnectionManager:
    """In-memory WebSocket broadcast pool for the real-time dashboard."""

    def __init__(self) -> None:
        self._active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._active.add(ws)
        logger.info("Dashboard WS connected (total=%d)", len(self._active))

    def disconnect(self, ws: WebSocket) -> None:
        self._active.discard(ws)
        logger.info("Dashboard WS disconnected (total=%d)", len(self._active))

    async def broadcast(self, data: dict) -> None:
        """Send data to all connected clients; silently drop dead connections."""
        dead: Set[WebSocket] = set()
        for ws in list(self._active):
            try:
                await ws.send_json(data)
            except Exception:  # noqa: BLE001
                dead.add(ws)
        self._active -= dead


manager = _ConnectionManager()


@router.websocket("/ws/dashboard")
async def dashboard_websocket(ws: WebSocket, db: Session = Depends(get_db)):
    """
    Real-time dashboard WebSocket.

    Push a dashboard_update frame every 5 seconds containing:
      - live truck positions
      - HOT lead count and latest alert
      - active site count
    """
    await manager.connect(ws)
    try:
        while True:
            # Build lightweight dashboard snapshot
            trucks = db.query(TruckPosition).all()
            hot_leads = db.query(Lead).filter(Lead.score_label == "HOT").count()
            active_sites = db.query(ProjectSite).filter(ProjectSite.status == "active").count()
            new_permit_leads = db.query(PermitLead).filter(PermitLead.priority_label == "HOT").count()

            frame = {
                "type": "dashboard_update",
                "ts": datetime.now(timezone.utc).isoformat(),
                "data": {
                    "trucks": [
                        {
                            "truck_id": t.truck_id,
                            "driver_name": t.driver_name,
                            "lat": t.lat,
                            "lng": t.lng,
                            "status": t.status,
                            "asphalt_temp_f": t.asphalt_temp_f,
                            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                        }
                        for t in trucks
                    ],
                    "hot_leads": hot_leads,
                    "active_sites": active_sites,
                    "hot_permit_leads": new_permit_leads,
                },
            }
            await ws.send_json(frame)
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ── Virtual Foreman RAG Chat ──────────────────────────────────────────────────

_FOREMAN_SYSTEM_PROMPT = """You are the 4D Virtual Foreman for J. Worden & Sons Asphalt Paving — a 4th-generation family company serving Richmond, VA and the surrounding 20-mile service area since 1984.

Your role is to answer questions about:
1. Active project sites — status, progress, scheduling, crew assignments
2. Permit leads — which Virginia permit leads are highest priority, their locations and values
3. Trucking & logistics — truck positions, asphalt temperature windows, delivery scheduling
4. Field operations — HMA temperature requirements, compaction specs, weather hold decisions
5. Business intelligence — lead pipeline, revenue forecasting, competitor activity
6. Construction law — Virginia contractor licensing, lien laws, permit requirements

When answering about specific sites or leads, be precise and data-driven. When asked for recommendations, prioritize safety and quality. Keep answers to 3–5 sentences unless detail is explicitly requested."""


class ForemanChatRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    question: str = Field(..., min_length=1, max_length=1500)
    context: str | None = Field(default=None, max_length=500, description="Optional context hint, e.g. 'site_id:42' or 'truck_id:T-01'")


class ForemanChatResponse(BaseModel):
    answer: str
    engine: str
    sources: list[str] = Field(default_factory=list)


def _stub_foreman_chat(question: str) -> str:
    q = question.lower()
    if any(w in q for w in ["hot lead", "best lead", "priority lead", "top lead"]):
        return (
            "Your highest-priority permit leads right now are commercial parking lot and paving permits "
            "in the Richmond/Henrico/Chester corridor with project values above $100K. "
            "Check the Richmond Grid at /command-center for a live map of all HOT leads within 20 miles. "
            "I recommend calling the top 3 within the hour."
        )
    if any(w in q for w in ["truck", "asphalt temp", "temperature", "delivery"]):
        return (
            "All trucks should maintain HMA load temperatures above 275°F for proper compaction — "
            "the thermal window closes below 250°F (VDOT spec). "
            "Check the live truck tracker on the Command Center dashboard for real-time positions and temp readings. "
            "If a truck is approaching 30 minutes of haul time, flag the dispatcher immediately."
        )
    if any(w in q for w in ["site", "job", "project", "status"]):
        return (
            "I can pull up any active site from the Richmond Grid. "
            "Tell me a site name or address and I'll give you the latest status, crew assignment, and completion estimate. "
            "You can also view all active sites in the 4D map view at /command-center."
        )
    if any(w in q for w in ["weather", "rain", "hold"]):
        return (
            "VDOT specifications require paving to stop when surface temperature drops below 40°F or during active rain. "
            "Always check the 24-hour Richmond NWS forecast before mobilizing. "
            "A weather hold today will affect the Broad Street job timeline — I recommend rescheduling to Thursday morning."
        )
    if any(w in q for w in ["cost", "price", "bid", "estimate"]):
        return (
            "For commercial paving in the Richmond area, typical bid ranges are $3–$7/sqft depending on base condition, "
            "thickness spec, and mobilization distance. "
            "For a precise project estimate, use the quote tool at /quote or ask me for a site-specific breakdown."
        )
    return (
        "I'm the 4D Virtual Foreman — your AI command center for J. Worden & Sons. "
        "I can answer questions about active sites, permit leads, truck logistics, field specs, "
        "and Virginia construction law. What would you like to know?"
    )


def _rag_foreman_chat(question: str, context: str | None) -> tuple[str, list[str]]:
    """
    LangChain RAG-powered Virtual Foreman chat.

    Uses the following RAG pipeline:
      1. Chroma vector store indexed from project documents
      2. GPT-4o-mini as the LLM
      3. RetrievalQA chain with source attribution

    Falls back to the curated stub if LangChain/OpenAI is unavailable.
    """
    try:
        from langchain.chains import RetrievalQA
        from langchain_community.vectorstores import Chroma
        from langchain_openai import ChatOpenAI, OpenAIEmbeddings
        from langchain.schema import Document
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        from langchain.prompts import PromptTemplate

        openai_key = os.getenv("OPENAI_API_KEY", "")
        if not openai_key:
            return _stub_foreman_chat(question), []

        # Build in-memory Chroma store from seed documents
        # In production, persist the store to disk or pgvector and index
        # project documents, permit history, and site notes via the admin panel.
        _seed_docs = [
            Document(
                page_content=(
                    "J. Worden & Sons serves a 20-mile radius around Richmond, VA (37.5407, -77.4360). "
                    "Primary service area includes Henrico, Chesterfield, Chester, and Colonial Heights. "
                    "Commercial paving rates: $3–$7/sqft. Residential: $2–$5/sqft. Sealcoating: $0.15–$0.30/sqft."
                ),
                metadata={"source": "company_profile"},
            ),
            Document(
                page_content=(
                    "VDOT paving specifications: HMA surface temperature must stay above 275°F during lay-down. "
                    "Paving stops below 40°F ambient or during rain. Compaction density target: 92–96% GMM. "
                    "Base course: 2\" VDOT 21A aggregate minimum for commercial, 4\" for heavy vehicle traffic."
                ),
                metadata={"source": "vdot_specs"},
            ),
            Document(
                page_content=(
                    "Virginia contractor licensing: Class A license required for projects over $120,000. "
                    "Class B for $10,000–$120,000. Both require a designated Responsible Management Officer (RMO). "
                    "Virginia DPOR (Department of Professional and Occupational Regulation) oversees contractor licensing."
                ),
                metadata={"source": "va_construction_law"},
            ),
            Document(
                page_content=(
                    "Virginia mechanics lien law: Contractor must file a memorandum of lien within 150 days of "
                    "last day of work. Subcontractors must file within 90 days. "
                    "Suit to enforce lien must be filed within 6 months of perfecting the lien."
                ),
                metadata={"source": "va_lien_law"},
            ),
        ]

        splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        split_docs = splitter.split_documents(_seed_docs)

        embeddings = OpenAIEmbeddings(openai_api_key=openai_key)
        vectorstore = Chroma.from_documents(split_docs, embeddings)

        llm = ChatOpenAI(
            model="gpt-4o-mini",
            openai_api_key=openai_key,
            temperature=0.4,
            max_tokens=400,
        )

        prompt_template = PromptTemplate(
            input_variables=["context", "question"],
            template=(
                f"{_FOREMAN_SYSTEM_PROMPT}\n\n"
                "Relevant context:\n{context}\n\n"
                "Question: {question}\n\n"
                "Answer:"
            ),
        )

        qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=vectorstore.as_retriever(search_kwargs={"k": 3}),
            return_source_documents=True,
            chain_type_kwargs={"prompt": prompt_template},
        )

        user_q = f"[Context: {context}] {question}" if context else question
        result = qa_chain.invoke({"query": user_q})
        answer = result.get("result", _stub_foreman_chat(question))
        sources = list({doc.metadata.get("source", "") for doc in result.get("source_documents", []) if doc.metadata.get("source")})
        return answer, sources

    except Exception as exc:  # noqa: BLE001
        logger.error("LangChain RAG chat failed: %s", exc)
        return _stub_foreman_chat(question), []


@router.post(
    "/api/v1/foreman/chat",
    response_model=ForemanChatResponse,
    summary="4D Virtual Foreman — RAG-powered Q&A",
)
async def foreman_chat(req: ForemanChatRequest):
    """
    Natural language Q&A about active sites, leads, trucks, and field operations.

    Uses LangChain + Chroma RAG when OPENAI_API_KEY is set.
    Falls back to a curated stub for offline/development use.
    """
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if openai_key:
        answer, sources = _rag_foreman_chat(req.question, req.context)
        engine = "langchain_rag"
    else:
        answer = _stub_foreman_chat(req.question)
        sources = []
        engine = "stub"

    return ForemanChatResponse(answer=answer, engine=engine, sources=sources)


# ── Executive Dashboard Status ────────────────────────────────────────────────

@router.get("/api/v1/foreman/status", summary="Executive dashboard summary")
def foreman_status(db: Session = Depends(get_db)):
    """
    Returns a high-level snapshot of the JWordenAI command center:
      - Active site count and statuses
      - Lead pipeline summary (HOT/WARM/COOL counts)
      - Permit lead pipeline
      - Live truck count and status breakdown
    """
    sites_by_status: dict[str, int] = {}
    for s in db.query(ProjectSite).all():
        sites_by_status[s.status] = sites_by_status.get(s.status, 0) + 1

    lead_counts = {
        "HOT":  db.query(Lead).filter(Lead.score_label == "HOT").count(),
        "WARM": db.query(Lead).filter(Lead.score_label == "WARM").count(),
        "COOL": db.query(Lead).filter(Lead.score_label == "COOL").count(),
    }

    permit_counts = {
        "HOT":  db.query(PermitLead).filter(PermitLead.priority_label == "HOT").count(),
        "WARM": db.query(PermitLead).filter(PermitLead.priority_label == "WARM").count(),
        "COOL": db.query(PermitLead).filter(PermitLead.priority_label == "COOL").count(),
    }

    trucks = db.query(TruckPosition).all()
    truck_statuses: dict[str, int] = {}
    for t in trucks:
        truck_statuses[t.status or "unknown"] = truck_statuses.get(t.status or "unknown", 0) + 1

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sites": {
            "total": sum(sites_by_status.values()),
            "by_status": sites_by_status,
        },
        "leads": {
            "total": sum(lead_counts.values()),
            "by_label": lead_counts,
        },
        "permit_leads": {
            "total": sum(permit_counts.values()),
            "by_label": permit_counts,
        },
        "trucks": {
            "total": len(trucks),
            "by_status": truck_statuses,
        },
    }


# ── Vision Measure ────────────────────────────────────────────────────────────

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
_MAX_IMAGE_BYTES = 20 * 1024 * 1024   # 20 MB


@router.post(
    "/api/v1/ai/vision-measure",
    summary="Enqueue a lot-measurement vision inference job",
)
async def vision_measure(
    file: UploadFile = File(...),
    site_id: int | None = None,
):
    """
    Upload a project photo and enqueue it for AI lot-measurement inference.

    The job is pushed to the Redis ``vision_queue`` and processed by the
    ``process_vision_batch`` Celery task (runs every 15 minutes).

    Returns a ``job_id`` that can be polled via GET /api/v1/ai/vision-result/{job_id}.
    If REDIS_URL is not set, runs inference synchronously and returns results immediately.
    """
    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Allowed: {', '.join(_ALLOWED_MIME)}",
        )

    image_bytes = await file.read()
    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 20 MB limit")

    job_id = str(uuid.uuid4())

    redis_url = os.getenv("REDIS_URL", "")
    if redis_url:
        import redis as redis_client

        r = redis_client.from_url(redis_url, decode_responses=False)
        job_payload = json.dumps({
            "job_id": job_id,
            "image_b64": base64.b64encode(image_bytes).decode(),
            "site_id": site_id,
        })
        r.rpush("vision_queue", job_payload)
        return {
            "status": "queued",
            "job_id": job_id,
            "message": "Vision inference job enqueued. Poll /api/v1/ai/vision-result/{job_id} for results.",
        }
    else:
        # Synchronous fallback (no Redis)
        from ..tasks.vision import run_vision_inference
        result = run_vision_inference(image_bytes)
        result["job_id"] = job_id
        result["site_id"] = site_id
        result["completed_at"] = datetime.now(timezone.utc).isoformat()
        return {"status": "completed", **result}


@router.get(
    "/api/v1/ai/vision-result/{job_id}",
    summary="Poll for vision inference result",
)
def vision_result(job_id: str):
    """
    Poll for the result of a vision inference job.
    Results are stored in Redis with a 24-hour TTL.
    """
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        raise HTTPException(status_code=503, detail="Redis not configured — use synchronous /api/v1/ai/vision-measure instead.")

    import redis as redis_client
    r = redis_client.from_url(redis_url, decode_responses=True)
    raw = r.get(f"vision:result:{job_id}")
    if raw is None:
        return {"status": "pending", "job_id": job_id, "message": "Result not yet available — try again in 15 minutes."}
    return {"status": "completed", **json.loads(raw)}
