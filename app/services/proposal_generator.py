"""
proposal_generator.py — GPT-4o professional proposal generator for JWordenAI.

Generates polished PDF proposals for asphalt paving projects.
Falls back to a template-based response when OpenAI is unavailable.

Public API
──────────
  generate_proposal_text(lead: dict) → str
  generate_proposal_pdf(lead: dict) → bytes
"""

from __future__ import annotations

import base64
import io
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_COMPANY_NAME = "J. Worden & Sons Asphalt Paving"
_COMPANY_ADDRESS = "1601 Ware Bottom Springs Rd Suite 214, Chester, VA 23836"
_COMPANY_PHONE = "(804) 446-1296"
_COMPANY_EMAIL = os.getenv("NOTIFY_TO_EMAIL", "").split(",")[0].strip() or "info@jwordenasphalt.com"
_COMPANY_LICENSE = "Licensed & Insured | VA Class A General Contractor"
_DEFAULT_SERVICE_TYPE = "paving"


def generate_proposal_text(lead: dict) -> str:
    """
    Call GPT-4o to generate a professional proposal text.
    Falls back to a formatted template if OpenAI is unavailable.
    """
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        return _template_proposal(lead)

    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=openai_key)
        prompt = _build_gpt_prompt(lead)

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a senior estimator and project manager at J. Worden & Sons, "
                        "a VA Class A General Contractor and Best of Houzz–recognized firm. "
                        "The company provides: asphalt paving, sealcoating, crack filling, "
                        "parking lot construction, general contracting (new builds, QSR/franchise "
                        "ground-up construction), interior design & decorating, cobblestone & brick "
                        "paver patios, and natural stone masonry. "
                        "Write polished, client-ready project proposals. Be specific, confident, "
                        "and professional. Include all sections requested. Tailor the scope of work, "
                        "materials, and specifications to the exact service type requested."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=1400,
            temperature=0.4,
        )
        return response.choices[0].message.content or _template_proposal(lead)
    except Exception as exc:  # noqa: BLE001
        logger.error("GPT-4o proposal generation failed: %s", exc)
        return _template_proposal(lead)


_SERVICE_SCOPE_HINTS: dict[str, str] = {
    "general_contracting": (
        "Include: full scope of general contracting services (permit pull, subcontractor "
        "management, schedule milestones, budget tracking, weekly owner reports, punch-list "
        "and warranty documentation). Reference VA Class A GC license."
    ),
    "interior_design": (
        "Include: design process phases (discovery, mood board, 3D renders, FF&E procurement, "
        "install coordination). Reference Best of Houzz recognition. Note that FF&E costs are "
        "separate from the design fee and will be itemized in a procurement schedule."
    ),
    "cobblestone_pavers": (
        "Include: base engineering (compacted aggregate depth, bedding sand), paver pattern options "
        "(herringbone, running bond, fan, custom), edge restraints, polymeric sand jointing, "
        "and optional sealing. Note ICPI installation standards."
    ),
    "stone_masonry": (
        "Include: stone type options (fieldstone, bluestone, limestone, flagstone), wall construction "
        "method (dry-stack or mortared with Type S mortar), drainage behind retaining walls, "
        "and any outdoor fireplace or fire feature integration. Note structural footing requirements."
    ),
    "paving": (
        "Include: base prep, hot-mix asphalt (HMA) specs, compaction density targets (92–96%), "
        "drainage grades, and any ADA transition requirements."
    ),
    "driveway": (
        "Include: demo and haul-off of existing surface, compacted stone base, 2\"–3\" HMA "
        "wearing course, edging, apron tie-in, and cleanup."
    ),
    "parking_lot": (
        "Include: site grading, 4\"–6\" HMA over compacted base, ADA parking and curb ramps, "
        "thermoplastic line striping, wheel stops, and signage."
    ),
    "sealcoating": (
        "Include: surface inspection, crack filling before sealing, surface cleaning and "
        "oil-spot priming, two-coat sealer application, and 24–48 hour cure period."
    ),
    "crackfill": (
        "Include: crack inspection and classification, saw-cut & rout for wide/working cracks, "
        "hot-pour rubberized sealant application and compatibility with upcoming sealcoating."
    ),
    "maintenance": (
        "Include: annual inspection schedule, priority mobilization commitment, multi-year "
        "volume pricing, and documentation for property records."
    ),
}


def _build_gpt_prompt(lead: dict) -> str:
    service_key = (lead.get("service_type") or _DEFAULT_SERVICE_TYPE).lower().strip()
    scope_hint = _SERVICE_SCOPE_HINTS.get(service_key, "")

    return f"""Write a professional project proposal for the following client.

CLIENT INFO:
  Name: {lead.get('name', 'Valued Customer')}
  Address: {lead.get('address', 'N/A')}
  State: {lead.get('state_code') or lead.get('state', 'N/A')}
  Email: {lead.get('email', 'N/A')}
  Phone: {lead.get('phone', 'N/A')}

PROJECT DETAILS:
  Service: {lead.get('service_type', 'Asphalt Paving').replace('_', ' ').title()}
  Property Type: {lead.get('property_type', 'Commercial')}
  Area: {lead.get('project_size_sqft', 'TBD')} sq ft
  Urgency: {lead.get('urgency', 'flexible')}
  Special Notes: {lead.get('message', 'None')}

PRICING RANGE: ${lead.get('price_low', 'TBD')} – ${lead.get('price_high', 'TBD')}

SERVICE-SPECIFIC SCOPE GUIDANCE:
{scope_hint}

Please write a complete proposal including:
1. Professional greeting and project overview
2. Detailed scope of work (tailored to the service type above)
3. Materials and specifications
4. Pricing summary with the range above
5. Project timeline estimate
6. 1-year workmanship warranty terms
7. Payment terms (50% mobilization, 50% on completion)
8. Professional closing with call to action

Format with clear section headers."""


_SERVICE_WORK_ITEMS: dict[str, list[str]] = {
    "general_contracting": [
        "• Permit acquisition and code compliance management",
        "• Licensed subcontractor procurement, vetting, and scheduling",
        "• Detailed project schedule with milestone tracking",
        "• Budget management and transparent change-order process",
        "• Weekly owner progress reports and on-site quality inspections",
        "• Final punch-list, certificate of occupancy, and warranty documentation",
    ],
    "interior_design": [
        "• Discovery consultation — style survey, functional requirements, budget review",
        "• Digital mood boards and curated material palettes",
        "• 3D visualization renders for spatial planning and client approval",
        "• FF&E (furniture, fixtures & equipment) procurement and vendor coordination",
        "• Installation coordination, delivery management, and final styling",
        "• Post-install walkthrough and project photography",
    ],
    "cobblestone_pavers": [
        "• Site preparation and subgrade inspection",
        "• 6\"–8\" compacted aggregate base installation per ICPI standards",
        "• 1\" bedding sand course, screeded to grade",
        "• Paver installation in approved pattern with commercial edge restraints",
        "• Polymeric sand jointing, compacted and activated",
        "• Optional penetrating sealer application for stain protection",
        "• Site cleanup and project documentation",
    ],
    "stone_masonry": [
        "• Site survey, layout, and footing design",
        "• Excavation and compacted aggregate footing installation",
        "• Stone selection and hand-fitting of natural stone units",
        "• Wall construction per specified method (dry-stack or mortared)",
        "• Drainage fabric and gravel backfill behind retaining walls",
        "• Capstone installation and mortar finishing",
        "• Site cleanup and final inspection",
    ],
}

_DEFAULT_WORK_ITEMS = [
    "• Site preparation and subgrade inspection",
    "• Installation of specified materials per industry standards",
    "• Proper compaction or bonding to achieve specified density/adhesion",
    "• Final grading and cleanup",
]


def _template_proposal(lead: dict) -> str:
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    name = lead.get("name", "Valued Customer")
    address = lead.get("address", "Project Address TBD")
    service_key = (lead.get("service_type") or _DEFAULT_SERVICE_TYPE).lower().strip()
    service = service_key.replace("_", " ").title()
    sqft = lead.get("project_size_sqft", "TBD")
    price_low = lead.get("price_low", "Contact for pricing")
    price_high = lead.get("price_high", "")

    price_str = f"${price_low:,} – ${price_high:,}" if isinstance(price_low, (int, float)) else str(price_low)

    work_items = _SERVICE_WORK_ITEMS.get(service_key, _DEFAULT_WORK_ITEMS)
    work_block = "\n".join(work_items)

    return f"""J. WORDEN & SONS
Project Proposal
Date: {today}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PREPARED FOR:
{name}
{address}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCOPE OF WORK:
Service Type: {service}
Estimated Area: {sqft} sq ft

J. Worden & Sons proposes to furnish all materials, equipment, and labor
necessary to complete the {service.lower()} project at the above-referenced location.

WORK INCLUDES:
{work_block}

PRICING SUMMARY:
Estimated Total: {price_str}
(Final price subject to site inspection and material costs at time of work)

TIMELINE:
• Mobilization within 5–10 business days of signed contract
• Project duration: 1–5 days depending on scope

WARRANTY:
J. Worden & Sons provides a 1-year workmanship warranty on all work.
Material warranties follow manufacturer specifications.

PAYMENT TERMS:
• 50% deposit due upon contract execution
• 50% balance due upon project completion

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{_COMPANY_NAME}
{_COMPANY_ADDRESS}
Phone: {_COMPANY_PHONE}
{_COMPANY_LICENSE}

To accept this proposal, please sign and return with your deposit.
We look forward to earning your business!
"""


def generate_proposal_pdf(lead: dict) -> bytes:
    """
    Generate a branded PDF proposal using ReportLab.
    Returns raw PDF bytes. Falls back to plain-text PDF if ReportLab unavailable.
    """
    try:
        from reportlab.lib import colors  # type: ignore
        from reportlab.lib.pagesizes import letter  # type: ignore
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # type: ignore
        from reportlab.lib.units import inch  # type: ignore
        from reportlab.platypus import (  # type: ignore
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )

        proposal_text = generate_proposal_text(lead)
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
        )

        styles = getSampleStyleSheet()
        brand_orange = colors.HexColor("#f5a623")
        dark = colors.HexColor("#1a1a2e")

        header_style = ParagraphStyle(
            "Header",
            parent=styles["Title"],
            fontSize=22,
            textColor=dark,
            spaceAfter=4,
        )
        sub_style = ParagraphStyle(
            "Sub",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.grey,
            spaceAfter=12,
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            spaceAfter=6,
        )

        story = []

        # Header
        story.append(Paragraph(_COMPANY_NAME, header_style))
        story.append(Paragraph(f"{_COMPANY_ADDRESS} | {_COMPANY_PHONE}", sub_style))
        story.append(HRFlowable(width="100%", thickness=3, color=brand_orange, spaceAfter=12))

        story.append(Paragraph("PROJECT PROPOSAL", styles["Heading2"]))
        story.append(Paragraph(f"Date: {datetime.now(timezone.utc).strftime('%B %d, %Y')}", body_style))
        story.append(Spacer(1, 0.15 * inch))

        # Client info table
        client_data = [
            ["Prepared For:", lead.get("name", "Valued Customer")],
            ["Address:", lead.get("address", "TBD")],
            ["Email:", lead.get("email", "N/A")],
            ["Phone:", lead.get("phone", "N/A")],
            ["Service:", lead.get("service_type", "Paving").replace("_", " ").title()],
            ["Area:", f"{lead.get('project_size_sqft', 'TBD')} sq ft"],
        ]
        t = Table(client_data, colWidths=[1.5 * inch, 5 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f9f9f9")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.2 * inch))

        # Proposal body (split by lines)
        story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey, spaceAfter=8))
        for line in proposal_text.split("\n"):
            clean = line.strip()
            if not clean:
                story.append(Spacer(1, 0.05 * inch))
            elif clean.startswith("━") or clean.startswith("─"):
                story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
            elif clean.isupper() and len(clean) < 50:
                story.append(Paragraph(clean, styles["Heading3"]))
            else:
                story.append(Paragraph(clean.replace("•", "&#8226;"), body_style))

        # Footer
        story.append(Spacer(1, 0.3 * inch))
        story.append(HRFlowable(width="100%", thickness=2, color=brand_orange, spaceAfter=8))
        story.append(Paragraph(
            f"<i>{_COMPANY_NAME} · {_COMPANY_LICENSE}</i>",
            ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.grey, alignment=1),
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer.read()

    except ImportError:
        logger.warning("ReportLab not installed — returning plain text as PDF bytes")
        text = generate_proposal_text(lead)
        return text.encode("utf-8")
    except Exception as exc:  # noqa: BLE001
        logger.error("PDF generation error: %s", exc)
        text = generate_proposal_text(lead)
        return text.encode("utf-8")
