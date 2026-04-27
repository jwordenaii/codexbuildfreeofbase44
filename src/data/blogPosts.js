/**
 * Blog data — static seed articles optimized for SEO.
 * All string values use double-quotes to avoid apostrophe escaping issues.
 * Blog post body content uses template literals.
 */

export const BLOG_CATEGORIES = [
  { value: "all",        label: "All Posts" },
  { value: "tips",       label: "Paving Tips" },
  { value: "how-to",     label: "How-To Guides" },
  { value: "industry",   label: "Industry News" },
  { value: "local",      label: "Local Virginia" },
  { value: "commercial", label: "Commercial" },
]

export const BLOG_POSTS = [
  {
    slug: "how-long-does-asphalt-paving-last",
    category: "tips",
    title: "How Long Does Asphalt Paving Last? (And How to Double It)",
    excerpt: "The honest answer: a properly installed asphalt surface lasts 20 to 30 years. Here is what actually drives lifespan — and the one maintenance step that doubles it.",
    date: "2025-10-15",
    readTime: "5 min",
    featured: true,
    body: `## The Short Answer

A properly installed asphalt driveway or parking lot lasts **20 to 30 years**. A poorly installed one? 8 to 12 years — or less.

The difference is not luck. It is base preparation, drainage, and maintenance.

---

## What Drives Asphalt Lifespan

### 1. Base Preparation
The asphalt layer is only as strong as what is underneath it. A compacted, well-drained aggregate base (typically 6 to 8 inches for commercial, 4 to 6 inches for residential) is what prevents the surface from cracking as the ground shifts through freeze-thaw cycles.

Contractors who skip base work or use undersized equipment get short-lived results. The job looks the same on day one. It does not look the same in year three.

### 2. Drainage Design
Water is the primary enemy of asphalt. When water sits on the surface or infiltrates through cracks, it softens the base, accelerates freeze-thaw damage, and causes alligator cracking. Proper slope grading (minimum 1.5 to 2% cross slope) keeps water moving off the surface.

### 3. Asphalt Mix and Thickness
Residential driveways are typically 2 to 3 inches of compacted hot-mix asphalt (HMA). Commercial lots and high-traffic areas often need 3 to 4 inches or more. The right mix specification depends on expected load — a homeowner driveway vs. a fast-food drive-thru lane have very different requirements.

### 4. Compaction
Temperature at laydown and roller pattern matter. Asphalt that is laid too cold or compacted improperly is porous and weak. Density testing (nuclear gauge or core sampling) is how you verify it was done right.

---

## The One Step That Doubles Lifespan: Sealcoating

Sealcoating is a protective coal-tar or asphalt-based coating applied over the surface. It:

- Blocks UV oxidation (the primary cause of asphalt brittleness)
- Repels fuel and oil spills
- Prevents water infiltration
- Gives pavement that deep-black finish

**Recommendation:** Sealcoat a new driveway after the first 12 to 18 months (let it fully cure first), then every **3 to 5 years** thereafter. In coastal areas with salt air exposure, every 3 years is better.

Cost for sealcoating is typically $0.15 to $0.30 per square foot — a fraction of what a new surface costs.

---

## The Maintenance Timeline That Works

| Year | Action |
|------|--------|
| 1 to 2 | New surface. Let it cure. Avoid heavy loads near edges. |
| 2 to 3 | First sealcoat application |
| 5 to 6 | Second sealcoat + crack filling inspection |
| 8 to 10 | Third sealcoat + targeted patching if needed |
| 15+ | Evaluate for overlay vs. full replacement |

Following this schedule, a well-built asphalt surface easily reaches 25 to 30 years before full replacement is needed.

---

## Bottom Line

The lifespan question is really a quality question. If the base prep is done right, the drainage is designed properly, and you maintain it — your asphalt will outlast the average contractor warranty by 10+ years.

If you are in Virginia or the mid-Atlantic and want a free estimate on a new driveway, parking lot, or sealcoating program, [contact us](/contact) or [fill out the quote form](/quote).
`,
  },
  {
    slug: "when-to-sealcoat-virginia-guide",
    category: "tips",
    title: "When to Sealcoat Your Driveway in Virginia (Best Season and Timing)",
    excerpt: "Sealcoating only works when applied in the right conditions. Virginia's climate has a specific window — get it wrong and you have wasted money on a coat that will not cure properly.",
    date: "2025-09-22",
    readTime: "4 min",
    featured: false,
    body: `## Virginia's Sealcoating Window

Sealcoat needs to be applied when:

- **Air temperature is 50 degrees F or above** — and staying there for at least 24 hours after application
- **No rain in the forecast for 24 to 48 hours**
- **Pavement surface temperature is above 55 degrees F**

In Virginia, this means the practical sealcoating season runs from **late April through mid-October** in most years. The sweet spots are:

- **May and June** — temperatures are warm but not extreme; humidity is manageable
- **September and early October** — excellent conditions; pavement has had a summer of UV exposure and is ready for protection

---

## Why Summer Heat Is Not Always Better

High summer temperatures (above 90 degrees F) can actually be problematic for sealcoating. When it is very hot:

- The sealant may dry too quickly on the surface, trapping moisture and causing bubbling
- Application becomes more difficult for the crew
- You risk having foot or vehicle traffic before it is fully cured

Early morning applications on hot summer days can work well, but experienced contractors plan accordingly.

---

## What Disqualifies a Day for Sealcoating

- Rain forecast within 24 hours
- Below 50 degrees F ambient temperature
- Pavement surface is wet from recent rain
- Direct overcast plus cold wind combination (slows curing)
- Temperatures expected to drop below 40 degrees F overnight after application

---

## How Often Should You Sealcoat in Virginia?

- **New asphalt:** Wait 12 to 18 months before the first coat
- **Existing driveways:** Every 3 to 5 years in inland Virginia
- **Coastal Virginia (Hampton Roads, Virginia Beach):** Every 3 years due to salt air exposure
- **High-traffic commercial lots:** Every 2 to 3 years, with crack filling between applications

---

## Signs Your Driveway Needs Sealcoating Now

- Surface is gray or faded instead of black
- Small surface cracks or hairline cracking
- Surface feels rough or sandy to the touch
- You can see aggregate (gravel) through the surface

If you are seeing these signs, the oxidation process has already begun. Sealcoating now prevents it from progressing to base damage — which is 10x more expensive to repair.

[Get a free sealcoating estimate](/quote)
`,
  },
  {
    slug: "commercial-parking-lot-maintenance-guide",
    category: "commercial",
    title: "The Commercial Parking Lot Maintenance Guide: What Property Managers Need to Know",
    excerpt: "A well-maintained parking lot says something about your business before a customer ever walks through your door. Here is the complete maintenance framework we use for commercial properties.",
    date: "2025-08-30",
    readTime: "7 min",
    featured: false,
    body: `## Why Parking Lot Maintenance Is a Business Decision

Commercial property managers often view parking lot maintenance as a cost center. The better frame is liability and asset protection:

- **Slip-and-fall liability** increases dramatically with unmaintained pavement
- **ADA compliance** requires maintained, clearly marked accessible spaces
- **Lease renewals** are influenced by property appearance
- **Tenant satisfaction** is affected by daily experience in your parking lot

The math is also straightforward: reactive repairs cost 4 to 6 times more than proactive maintenance.

---

## The Commercial Maintenance Lifecycle

### Annual Inspection (Every Year)

A qualified contractor walks the lot and documents:

- Crack inventory and progression
- Drainage issues (ponding, edge erosion)
- Line striping fade level
- ADA compliance status
- Surface grade changes from settling

This inspection drives the maintenance plan. It should happen every spring.

### Crack Filling (Every 1 to 3 Years)

Cracks wider than a quarter inch should be filled with hot-pour rubberized sealant. Cold-pour products from hardware stores work temporarily but fail quickly under traffic and temperature cycling.

### Sealcoating (Every 2 to 3 Years for Commercial)

Commercial lots take more abuse than residential driveways — higher traffic, heavier loads, oil and fuel from vehicles, and UV exposure across a larger surface area. A 2 to 3 year sealcoating cycle maintains the protective barrier that prevents base infiltration.

### Line Striping (Every 2 to 3 Years, or After Sealcoating)

Lines fade. Faded lines mean:
- Confused traffic flow
- Reduced accessible space count (legal compliance risk)
- Poor visual presentation

Thermoplastic striping is more durable than traffic paint and our recommendation for high-traffic commercial lots.

### Mill and Overlay (Every 12 to 20 Years)

When surface cracks have progressed to structural cracking (alligator cracking), milling the top 2 inches and applying a fresh overlay is the right move — assuming the base is still sound.

---

## Building a Multi-Year Maintenance Contract

For commercial properties over 10,000 sq ft, a multi-year maintenance agreement typically makes financial sense:

- Predictable annual cost vs. reactive emergency repairs
- Priority scheduling in peak season
- Documented inspection reports for insurance and tenant records
- Consistent contractor relationship means fewer surprises

[Contact us to discuss a maintenance program for your property](/contact)
`,
  },
  {
    slug: "asphalt-crack-types-guide",
    category: "how-to",
    title: "Asphalt Crack Types: How to Identify What You Have (And What to Do About It)",
    excerpt: "Not all asphalt cracks are equal. Some are surface-level and easily fixed. Others indicate base failure. Here is how to read your pavement before calling a contractor.",
    date: "2025-07-18",
    readTime: "6 min",
    featured: false,
    body: `## Why Crack Type Matters

Treating the wrong crack the wrong way wastes money. More importantly, sealing over a base-failure crack does not fix it — it hides the problem while water continues to destroy the structure underneath.

---

## The 6 Main Crack Types

### 1. Hairline Cracks
**What they look like:** Very thin, surface-only cracks in a generally uniform pattern. Often appear in older asphalt.

**Cause:** Surface oxidation and drying out of the asphalt binder over time.

**What to do:** Sealcoating fills hairline cracks effectively.

### 2. Longitudinal Cracks
**What they look like:** Long cracks running parallel to the direction of paving.

**Cause:** Poor joint construction during paving, edge settlement, or thermal expansion and contraction.

**What to do:** Hot-pour crack fill. If the crack is wide (over half an inch), saw-cut and rout before filling for better adhesion.

### 3. Transverse Cracks
**What they look like:** Cracks running perpendicular to the pavement direction.

**Cause:** Temperature cycling — asphalt contracts in cold weather and the weakest points crack first.

**What to do:** Hot-pour crack fill.

### 4. Edge Cracks
**What they look like:** Cracks near the edge of the pavement, sometimes with crumbling.

**Cause:** Lack of lateral support at the pavement edge, water infiltration from the side, or vehicles driving on the edge.

**What to do:** Fill the cracks, address drainage, and consider edge repair if crumbling is significant.

### 5. Alligator Cracking
**What they look like:** Interconnected cracks forming a pattern resembling alligator skin or chicken wire.

**Cause:** This is a **base failure indicator**. The structural section has lost its load-bearing capacity — usually from water infiltration compromising the sub-base.

**What to do:** Crack filling and sealcoating will not fix this. The failed section needs to be removed and rebuilt from the base up.

### 6. Pothole Formation
**What they look like:** Bowls or holes in the surface.

**Cause:** Advanced alligator cracking that has progressed to surface failure under traffic.

**What to do:** Infrared repair or cut-and-patch.

---

## Quick Reference

| Crack Type | Severity | Fix |
|------------|----------|-----|
| Hairline | Low | Sealcoating |
| Longitudinal | Low-Medium | Hot-pour crack fill |
| Transverse | Low-Medium | Hot-pour crack fill |
| Edge | Medium | Fill plus drainage work |
| Alligator | High | Base repair required |
| Pothole | High | Cut-and-patch or infrared |

---

[Get a free on-site assessment from our team](/quote)
`,
  },
  {
    slug: "kfc-franchise-paving-standards",
    category: "commercial",
    title: "What KFC Franchise Paving Actually Requires (From a National QSR Vendor)",
    excerpt: "We have paved KFC locations across 12+ states under the national franchise program. Here is what operators need to know about QSR paving standards and why most local contractors cannot meet them.",
    date: "2025-06-12",
    readTime: "8 min",
    featured: false,
    body: `## The QSR Standard Is Different

Paving a residential driveway and paving a KFC are not the same job. The tolerance requirements, documentation packages, ADA specifications, and traffic load design are all in a different class.

We have been in the KFC national program since the early 2000s. Here is what that actually means.

---

## Drive-Thru Lane Design

The drive-thru lane is the most critical element of QSR site design. Key specs:

- **Lane width:** Minimum 11 to 12 feet clear for single-lane; branded specs may require 13 to 14 feet at certain queue positions
- **Grade tolerance:** Maximum 2% cross slope on the pick-up window approach; steeper grades cause door clearance issues
- **Turning radius:** Must accommodate a full-size SUV or delivery truck through the queue loop without conflict
- **Surface smoothness:** Rideability standards apply — a rough drive-thru is a brand presentation problem and a vehicle clearance risk

Getting these wrong means rework. QSR operators do not have flexibility on brand standards.

---

## Documentation Requirements

National franchise programs require documentation packages that most paving contractors have never produced:

- Pre-construction site photos (complete lot coverage)
- Material certifications (HMA mix design, aggregate gradation, asphalt binder grade)
- Compaction test results (minimum density per spec, typically 92 to 96% of lab density)
- Post-construction photos (matching pre-construction coverage)
- As-built drawings for ADA compliance certification
- Sign-off paperwork for the franchisor real estate and construction department

If you are dealing with a contractor who does not mention documentation until you ask, that is a gap.

---

## ADA Requirements

Every QSR site renovation that includes paving work needs an ADA compliance review:

- Accessible parking stalls (number, dimension, signage)
- Accessible route from parking to entrance (slope, width, surface condition)
- Cross slope of accessible spaces (max 2% in any direction)
- Van-accessible stall (1 per every 6 accessible spaces, minimum 8-foot wide aisle)

---

## Are You a Franchise Operator Evaluating Contractors?

If you are a QSR or franchise operator evaluating paving contractors, here is the checklist:

1. **Documentation package** — have they produced one before? Can they show you a sample?
2. **Drive-thru experience** — specifically, not just general commercial
3. **ADA certification process** — how do they document accessible route compliance?
4. **State licensing** — are they licensed in the state where your location is?
5. **Reference network** — can they provide references from same-brand operators?

[Contact us to discuss your franchise paving project](/contact)
`,
  },
  {
    slug: "best-time-pave-driveway-virginia",
    category: "local",
    title: "The Best Time of Year to Pave a Driveway in Virginia",
    excerpt: "Virginia's four seasons all affect asphalt differently. Paving in the wrong conditions means a shorter-lasting result. Here is the seasonal guide for homeowners in Central Virginia and Hampton Roads.",
    date: "2025-05-05",
    readTime: "4 min",
    featured: false,
    body: `## Virginia Has a Wide Paving Window

Good news for Virginia homeowners: compared to northern states, Virginia's climate allows for a long paving season — roughly **April through November** in most years.

But not all months are equal.

---

## By Season

### Spring (April to May): Excellent

Early spring is one of the best times to pave in Virginia:

- Ground temperatures have come up from winter
- Daytime temperatures in the 60s and 70s are ideal for HMA laydown
- No extreme heat to cause premature surface hardening
- Projects scheduled in spring beat the summer rush

### Summer (June to August): Good (with caveats)

Summer works well, but very hot days (90 degrees F and above) require extra care:

- Material needs to be placed and compacted before it cools too much
- Crews work early mornings on the hottest days
- High demand season — book early

### Fall (September to October): Best

September and October are arguably the optimal months for driveway paving in Virginia:

- Temperatures in the 60s and 75s are perfect for asphalt
- Lower demand than peak summer
- Paving now means it is cured before winter freeze
- Sealcoating can follow in the same season

### Late Fall and Winter (November to March): Risky

November can work in central and southern Virginia — but it is weather-dependent. Once overnight temperatures regularly drop below 40 degrees F, paving quality is hard to guarantee.

Most reputable contractors will not pave when temperatures are forecast to drop below 40 degrees F within 24 hours of installation.

---

## The Virginia Homeowner Checklist

Before scheduling your paving project:

- Check the 5-day forecast for sustained temperatures above 50 degrees F
- No rain forecast for 24 hours post-paving
- Ground is dry (not saturated from recent heavy rain)
- Fall work: schedule sealcoating for the following spring

[Get on the schedule for this season](/quote)
`,
  },
]

export default BLOG_POSTS
