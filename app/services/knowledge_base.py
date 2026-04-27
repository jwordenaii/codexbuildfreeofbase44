"""
knowledge_base.py — Structured RAG knowledge base for J. Worden & Sons.

This module provides a curated, business-specific knowledge context that is
injected into AI prompts to make answers highly specific to the company's
actual history, services, pricing, and capabilities.

Rather than querying a vector DB for every request, we use a lightweight
"context assembly" pattern:
  1. CORE FACTS  — always injected (small, high-density)
  2. DOMAIN FACTS — injected when the query matches a domain
  3. STATE FACTS  — injected when a state code is provided

This keeps token usage minimal while dramatically improving answer quality
over a generic system prompt.
"""

from __future__ import annotations

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Core company facts (always injected) ─────────────────────────────────────

CORE_FACTS = """
=== J. WORDEN & SONS — VERIFIED COMPANY KNOWLEDGE BASE ===

IDENTITY:
• Full name: J. Worden & Sons Asphalt Paving LLC
• Founded: 1984 by Mr. Worden's grandfather (after 30+ years in roofing)
• Headquarters: 1601 Ware Bottom Springs Rd Suite 214, Chester, VA 23836
• Phone: (804) 446-1296 | Email: contact@jwordenasphaltpaving.com
• Website: https://jwordenasphaltpaving.com
• Owner: Mr. Worden (took over 2016 after grandfather passed 2015)
• Mr. Worden started working in the field at age 14
• Type: Family-owned, 4th-generation full-service contractor

SERVICES OFFERED:
• Asphalt paving (new construction, overlays, commercial & residential)
• Sealcoating, crack filling, and pavement maintenance plans
• Parking lot construction with ADA compliance and line striping
• General Contracting (GC) — full project management, permits, subcontractor coordination
• Interior Design & Decorating — Best of Houzz recognized; mood boards, 3D renders, FF&E procurement
• Cobblestone & Brick Paver Patios — herringbone, running bond, fan patterns; engineered base systems
• Stone Masonry — natural fieldstone walls, flagstone patios, retaining walls, outdoor fireplaces

CREDENTIALS & AWARDS:
• Pavement Magazine Top 75 — 4 categories
• Best of Houzz — multiple years (design & service)
• 2026 Top Contractor Award Nominee
• Fully licensed VA Class A General Contractor
• General liability + workers' compensation insured
• Licensed across all states where franchise work has been performed

QSR / FRANCHISE PROGRAM:
• KFC national franchise paving vendor (2000s–present)
• States: VA, NC, GA, FL, MI, TX, KS, MO, IA, MN, NY, NJ + others
• KFC new QSR store build program (ground-up GC construction), 2016–2023
• Also served: Arby's, Taco Bell regional franchise locations
• Documentation package: before/after photos, material certs, ADA compliance sign-offs

DOCUMENTATION:
• Full Dropbox archive of every major project (photos + records)
• Google Photos archive parallel to Dropbox
• Material certifications and compaction records maintained per project

GEOGRAPHIC ROOTS:
• Company built reputation from Motels, VA to Virginia Beach (1984–2000s)
• Currently based in Chester, VA serving Richmond metro + surrounding regions
• Commercial travel available for franchise and large commercial projects

=== END CORE FACTS ===
"""

# ── Domain-specific knowledge blocks ─────────────────────────────────────────

PRICING_FACTS = """
=== PRICING KNOWLEDGE (national baseline, adjusted by state) ===

RESIDENTIAL PAVING (new installation):
• Typical: $3.50–$8.00 / sq ft
• 2-car driveway (700 sqft): $2,450–$5,600
• Full replacement includes: base prep, grading, drainage, HMA, final grade
• Note: price varies heavily by base condition and access

COMMERCIAL PAVING:
• New construction: $2.50–$6.00 / sq ft (volume discount applies)
• Parking lot overlay: $2.00–$4.50 / sq ft (existing base intact)
• Large lots (>50,000 sqft) get better per-sqft pricing

SEALCOATING:
• Residential: $0.15–$0.30 / sq ft
• Commercial: $0.12–$0.28 / sq ft
• Minimum charge applies (usually $200–$400 for very small jobs)

CRACK FILLING:
• Hot-pour: $0.40–$1.00 / sq ft coverage (or $2–$6 / linear foot of crack)
• Saw-cut + rout + fill for wide cracks: add $1–$2 / linear foot

PARKING LOT CONSTRUCTION:
• Full new construction: $3.00–$7.00 / sq ft (includes base, drainage, asphalt, striping)
• Striping only: $0.10–$0.25 / sq ft

MAINTENANCE PLANS:
• Annual: $0.20–$0.45 / sq ft / year (sealcoat + crack fill + inspection)
• Multi-year contracts: 10–15% discount on per-service pricing

GENERAL CONTRACTING:
• GC fee: 15–20% of total hard-construction cost
• Managed commercial construction (shell): $75–$150 / sq ft
• Full commercial fit-out: $120–$200 / sq ft
• QSR / drive-thru restaurant: $180–$350 / sq ft
• Residential new construction: $150–$250 / sq ft (excluding lot)
• Residential addition (finished): $100–$200 / sq ft

INTERIOR DESIGN:
• Hourly consultation: $150–$250 / hour
• Flat-fee room package (concept through install): $2,500–$8,000 per room
• Full-home design retainer: custom quote
• FF&E procurement markup: 20–25% over trade pricing
• Design fee per sq ft of designed space: $5–$25

COBBLESTONE & BRICK PAVER PATIOS:
• Standard concrete pavers: $12–$20 / sq ft installed
• Tumbled brick pavers: $18–$30 / sq ft installed
• Reclaimed cobblestone: $30–$55 / sq ft installed
• Permeable paver systems: $22–$40 / sq ft installed

STONE MASONRY:
• Dry-stack fieldstone wall: $30–$50 / sq ft of wall face
• Mortared natural stone wall: $40–$75 / sq ft of wall face
• Stone veneer (cultured or natural): $30–$60 / sq ft applied
• Flagstone patio (mortared): $18–$35 / sq ft
• Flagstone patio (sand-set): $14–$25 / sq ft
• Outdoor fireplace surround: $4,000–$12,000 depending on size and stone

PRICING MODIFIERS:
• High-labor states (NY, CA, WA, MA, IL, etc.): +15–25%
• Material cost spikes (petroleum-driven): prices may shift seasonally
• Emergency / off-season work: +10–20%
• Free on-site estimate always available — final price requires site visit

=== END PRICING KNOWLEDGE ===
"""

TECHNICAL_FACTS = """
=== TECHNICAL / INSTALLATION KNOWLEDGE ===

HMA (HOT-MIX ASPHALT):
• Standard residential: 2–3 inches compacted HMA over 4–6 inch aggregate base
• Commercial / high-traffic: 3–4 inches HMA over 6–8 inch base (sometimes deeper)
• Laydown temperature: 275–325°F at placement; compaction must begin above 250°F
• Compaction density: 92–96% of lab density (Marshall or Superpave spec)
• Surface smoothness: profilograph IRI <95 in/mile for most commercial specs

SEALCOAT APPLICATION:
• Apply when ambient temp ≥ 50°F; pavement temp ≥ 55°F
• No rain within 24–48 hours of application
• Two-coat application recommended for best protection
• Coal-tar sealer: superior UV and oil resistance; not used in all states
• Asphalt-emulsion sealer: VOC-compliant alternative

CRACK FILLING:
• Hot-pour rubberized: melted at 375–400°F; applied by pour pot or wand
• Saw-cut and rout before filling cracks > ½ inch wide
• Routing: 3/4" wide × 3/4" deep groove for maximum sealant adhesion
• Cold pour acceptable only for very small/temporary repairs

DRAINAGE DESIGN:
• Minimum 1.5–2% cross slope for surface drainage
• ADA accessible spaces: maximum 2% slope in any direction
• French drain / catch basin installation for problem lots

PAVING SEASON (Virginia):
• Optimal: April–October (ambient > 50°F, no frost forecast)
• Best months: May, June, September, October
• Winter paving possible but quality is reduced below 40°F overnight

=== END TECHNICAL KNOWLEDGE ===
"""

ADA_QSR_FACTS = """
=== ADA & QSR FRANCHISE STANDARDS ===

ADA PARKING REQUIREMENTS (per 2010 ADA Standards):
• 1–25 total spaces: 1 accessible required
• 26–50 spaces: 2 accessible
• 51–75 spaces: 3 accessible
• 76–100 spaces: 4 accessible
• Van-accessible: 1 of every 6 accessible spaces (min 8-foot aisle)
• Accessible space dimensions: 8 ft wide minimum + 5 ft access aisle
• Cross slope: max 2% in any direction
• Surface: stable, firm, slip-resistant

KFC / QSR DRIVE-THRU STANDARDS:
• Lane width: 11–12 ft minimum clear width through queue
• Pick-up window approach: max 2% cross slope
• Drive-thru loop turning radius: accommodate 23-ft wheelbase vehicle
• Documentation required: material certs, compaction results, before/after photos
• ADA-compliant route from parking to entrance mandatory

GENERAL FRANCHISE REQUIREMENTS:
• Brand-standard documentation package for each project
• Thermoplastic striping (not traffic paint) for durability
• ADA compliance sign-off included in project closeout

=== END ADA / QSR KNOWLEDGE ===
"""

GC_FACTS = """
=== GENERAL CONTRACTING (GC) KNOWLEDGE ===

LICENSING & SCOPE:
• J. Worden & Sons holds a VA Class A General Contractor license
• Scope: new commercial construction, QSR/franchise ground-up builds, residential additions, full renovations
• GC experience: KFC new-store build program 2016–2023 (ground-up construction in 12+ states)
• Also served: Arby's, Taco Bell regional franchise locations as GC/paving vendor

GC PROCESS:
1. Pre-Construction: feasibility review, permit acquisition, trade-partner selection, schedule & budget baseline
2. Construction: weekly owner reports, quality inspections at every phase, RFI/change-order management
3. Close-Out: punch-list, final inspections, certificate of occupancy, warranty documentation handover

GC FEE STRUCTURE:
• GC fee: typically 15–20% of total hard-construction cost
• Guaranteed Maximum Price (GMP) contracts available for commercial clients
• Transparent open-book billing — clients see all subcontractor invoices

SUBCONTRACTOR NETWORK:
• Pre-vetted licensed subs for: concrete, framing, MEP (mechanical/electrical/plumbing), roofing, drywall, painting, sitework
• All subs carry required insurance; certificates filed before mobilization
• Preferred sub relationships built over 20+ years in Virginia market

MANAGED CONSTRUCTION COST BENCHMARKS (Virginia):
• Light commercial (shell): $75–$150 / sq ft
• Full commercial fit-out: $120–$200 / sq ft
• QSR / drive-thru restaurant: $180–$350 / sq ft (including kitchen equipment rough-in)
• Residential new construction: $150–$250 / sq ft (excluding lot)
• Residential addition (finished): $100–$200 / sq ft

=== END GC KNOWLEDGE ===
"""

INTERIOR_DESIGN_FACTS = """
=== INTERIOR DESIGN & DECORATING KNOWLEDGE ===

RECOGNITION:
• Best of Houzz — multiple years (design & service categories)
• Award-winning team specializing in residential and commercial interiors
• Portfolio includes luxury residential, QSR franchise interiors, office build-outs, and outdoor living rooms

DESIGN PROCESS:
1. Discovery Consultation (in-home or virtual): style survey, functional requirements, budget discussion
2. Concept Development: digital mood boards, color palettes, material samples
3. 3D Visualization: room renders for spatial planning and client approval
4. FF&E Procurement: furniture, fixtures & equipment sourcing, vendor coordination, purchase order management
5. Installation Coordination: contractor scheduling, delivery management, final styling & photography

DESIGN SPECIALTIES:
• Traditional, Transitional, Farmhouse, Modern Farmhouse, Contemporary, Coastal styles
• Open-concept kitchen/living renovations
• Primary suite transformations (bedroom + bath)
• Home office & multi-function room design
• Outdoor living rooms, covered patios, and entertainment spaces
• Commercial: restaurant / café interiors, hotel lobbies, office common areas

MATERIAL EXPERTISE:
• Hardwood, LVP, tile, and natural stone flooring
• Custom cabinetry and millwork design
• Quartz, granite, marble, and quartzite countertops
• Tile backsplash, wall treatments, and accent tile
• Window treatments, drapery, and motorized blinds
• Smart lighting design (Lutron, Hue, Control4)

DESIGN FEE STRUCTURE:
• Hourly consultation: $150–$250 / hour
• Flat-fee room package (consultation through install): $2,500–$8,000 per room
• Full-home design retainer: custom quote based on scope
• FF&E procurement: cost-plus (typically 20–25% markup over trade pricing)
• Virtual design packages available for remote clients

=== END INTERIOR DESIGN KNOWLEDGE ===
"""

MASONRY_FACTS = """
=== STONE MASONRY & HARDSCAPE KNOWLEDGE ===

COBBLESTONE & BRICK PAVER PATIOS:
• Materials: tumbled brick, reclaimed cobblestone, concrete pavers, permeable pavers
• Patterns: herringbone (45° and 90°), running bond, basket weave, pinwheel, fan/circle, custom
• Base specification: 6"–8" compacted aggregate base + 1" bedding sand (ICPI standard)
• Edge restraints: commercial-grade plastic or aluminum spike restraints required at all borders
• Joint fill: polymeric sand — swept in and activated with water to lock joints; resists weeds & ants
• Sealing: penetrating sealers for stain resistance; wet-look sealers for color enhancement
• Permeable systems: open-graded base allows stormwater infiltration; LEED-credit eligible

PAVER PRICING (installed, Virginia):
• Standard concrete pavers: $12–$20 / sq ft
• Tumbled brick pavers: $18–$30 / sq ft
• Reclaimed cobblestone: $30–$55 / sq ft
• Permeable paver systems: $22–$40 / sq ft
• Circle / fan focal feature: add $5–$15 / sq ft

NATURAL STONE MASONRY:
• Stone types: Pennsylvania bluestone, Virginia fieldstone, limestone, granite, slate, flagstone, quartzite
• Wall types: dry-stack (no mortar), dry-laid with geo-fabric backer, mortared (Type S mortar)
• Retaining wall rule of thumb: wall height × 0.6 = minimum base depth required
• Flagstone patio: set in sand-set or mortar-set depending on stability requirements
• Steps: 7" rise max / 11" tread min per IBC; natural stone preferred for outdoor aesthetics

STONE MASONRY PRICING (installed, Virginia):
• Dry-stack fieldstone wall: $30–$50 / sq ft of wall face
• Mortared natural stone wall: $40–$75 / sq ft of wall face
• Stone veneer (cultured or natural): $30–$60 / sq ft applied
• Flagstone patio (mortared): $18–$35 / sq ft
• Flagstone patio (sand-set): $14–$25 / sq ft
• Stone steps (per step): $300–$800 depending on material and width
• Outdoor fireplace surround: $4,000–$12,000 depending on size and stone type
• Stone retaining wall (engineered): $60–$120 / sq ft (includes footing and drainage)

OUTDOOR LIVING ROOM INTEGRATION:
• We design and build complete outdoor living spaces: paver patio + stone masonry + fire feature + pergola coordination
• Can coordinate with our interior design team for seamless indoor-outdoor aesthetic flow

=== END STONE MASONRY KNOWLEDGE ===
"""

_PRICING_KEYWORDS = {
    "cost", "price", "rate", "estimate", "quote", "sqft", "sq ft",
    "per foot", "how much", "expensive", "cheap", "afford", "budget",
    "charge", "fee", "billing",
}

_TECHNICAL_KEYWORDS = {
    "install", "thickness", "inches", "compaction", "hma", "hot mix",
    "base", "sub-base", "gravel", "temperature", "laydown", "cure",
    "density", "drainage", "slope", "grade", "rout", "saw cut",
}

_ADA_QSR_KEYWORDS = {
    "ada", "accessible", "handicap", "kfc", "qsr", "franchise", "drive-thru",
    "drive thru", "fast food", "restaurant", "documentation", "compliance",
    "brand", "arby", "taco bell",
}

_GC_KEYWORDS = {
    "general contractor", "gc", "permit", "subcontractor", "construction",
    "build", "project management", "schedule", "budget", "change order",
    "new build", "ground up", "renovation", "remodel", "addition",
}

_DESIGN_KEYWORDS = {
    "interior", "design", "decor", "decorating", "houzz", "mood board",
    "furniture", "color", "palette", "flooring", "cabinetry", "countertop",
    "lighting", "ff&e", "staging", "space planning", "render", "3d",
}

_MASONRY_KEYWORDS = {
    "cobblestone", "brick paver", "paver patio", "stone masonry", "stone wall",
    "flagstone", "retaining wall", "stone step", "fieldstone", "bluestone",
    "granite", "limestone", "outdoor fireplace", "fire pit", "stone veneer",
}


def assemble_context(
    question: str,
    state_code: Optional[str] = None,
    include_all: bool = False,
) -> str:
    """
    Assemble a targeted knowledge context string for injection into an AI prompt.

    Args:
        question:    The user's question (used for domain matching).
        state_code:  Optional 2-letter state code for state-specific context.
        include_all: If True, include all domain blocks (for complex queries).

    Returns:
        A formatted context string ready to prepend to the system prompt,
        or inject as a system message before the user's question.
    """
    q_lower = question.lower()
    q_words = set(q_lower.split())
    q_phrases = q_lower  # for multi-word keyword matching

    context_blocks = [CORE_FACTS]

    pricing_match   = bool(q_words & _PRICING_KEYWORDS)
    technical_match = bool(q_words & _TECHNICAL_KEYWORDS)
    ada_qsr_match   = bool(q_words & _ADA_QSR_KEYWORDS)
    gc_match        = bool(q_words & _GC_KEYWORDS) or any(p in q_phrases for p in ("general contractor", "ground up", "change order"))
    design_match    = bool(q_words & _DESIGN_KEYWORDS) or any(p in q_phrases for p in ("mood board", "space planning", "interior design"))
    masonry_match   = bool(q_words & _MASONRY_KEYWORDS) or any(p in q_phrases for p in ("brick paver", "stone wall", "retaining wall", "outdoor fireplace"))

    if include_all or pricing_match:
        context_blocks.append(PRICING_FACTS)
    if include_all or technical_match:
        context_blocks.append(TECHNICAL_FACTS)
    if include_all or ada_qsr_match:
        context_blocks.append(ADA_QSR_FACTS)
    if include_all or gc_match:
        context_blocks.append(GC_FACTS)
    if include_all or design_match:
        context_blocks.append(INTERIOR_DESIGN_FACTS)
    if include_all or masonry_match:
        context_blocks.append(MASONRY_FACTS)

    # State-specific fragment
    if state_code:
        try:
            from .state_data import get_state_prompt_fragment  # noqa: PLC0415
            frag = get_state_prompt_fragment(state_code.upper())
            if frag:
                context_blocks.append(f"\n=== {state_code.upper()} STATE CONTEXT ===\n{frag}\n=== END STATE CONTEXT ===\n")
        except Exception as exc:  # noqa: BLE001
            logger.debug("State context injection skipped for %s: %s", state_code, exc)

    return "\n".join(context_blocks)


def build_rag_system_prompt(
    question: str,
    state_code: Optional[str] = None,
    base_prompt: str = "",
) -> str:
    """
    Build a complete system prompt with RAG context injected.

    The RAG context is placed AFTER the base role prompt so the AI
    treats it as grounding facts rather than instructions.
    """
    kb_context = assemble_context(question, state_code=state_code)

    if base_prompt:
        return f"{base_prompt}\n\n{kb_context}"
    return kb_context
