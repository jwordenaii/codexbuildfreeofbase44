import ServicePageLayout from '@/components/ui/ServicePageLayout.jsx'
import { SERVICE_BY_SLUG } from '@/config/site.js'

const service = SERVICE_BY_SLUG['asphalt-repairs']

const WHY = {
  heading: 'Coastal Repair Challenges We Know',
  items: [
    {
      title: 'Sandy Base Movement',
      desc: "Much of the OBX sits on sandy, shifting soils that move with water table fluctuation and storm surge. Standard patch mixes fail when the base moves. We address the base before the surface.",
    },
    {
      title: 'Infrared Seamless Patching',
      desc: "Cold cut-and-patch creates seam lines that re-crack within one season. Our infrared technology heats existing asphalt and integrates new material seamlessly — no visible seam, no re-cracking at the joint.",
    },
    {
      title: 'Pothole vs. Base Failure',
      desc: "Some potholes are surface-only; others indicate base collapse below. We probe every pothole before patching — if the base is soft, we dig out and repack the base before placing new asphalt. Patch-over-failure is a waste of your money.",
    },
    {
      title: 'Utility Cut Restoration',
      desc: "Utility cuts (water, sewer, cable) are often patched with cold-mix by the utility company and left rough. We restore utility cuts to match the surrounding pavement with proper hot-mix and tack coat.",
    },
    {
      title: 'Heave Correction',
      desc: "Tree root heaving and frost heave from adjacent cold areas can raise asphalt sections. We remove the heaved section, address the root or drainage cause, and reinstall with proper compaction.",
    },
    {
      title: 'Full-Depth When Needed',
      desc: "We don't over-recommend full-depth removal — it's expensive. But when base failure is confirmed, we clearly explain why a patch won't hold and scope the correct full-depth replacement with honest pricing.",
    },
  ],
}

const PROCESS = {
  heading: 'Our Repair Process',
  steps: [
    { num: '01', title: 'Damage Assessment', desc: 'We assess each failure for cause, extent, and depth. Surface-only vs. base failure requires completely different repair methods. We probe soft spots and review drainage before scoping any repair.' },
    { num: '02', title: 'Saw Cut & Excavation', desc: 'We saw-cut straight, square edges around the repair area — never break or chip edges. Square cuts create proper bond lines. We excavate to stable material, removing all deteriorated pavement and compromised base.' },
    { num: '03', title: 'Base Preparation', desc: 'We compact the base to 95% density, install geotextile fabric where needed for weak subgrade, and apply tack coat (AC-20 or SS-1h) to all vertical edges and the base layer for proper adhesion.' },
    { num: '04', title: 'Asphalt Placement & Compaction', desc: 'Hot-mix or infrared-recycled asphalt is placed in lifts at the correct temperature (min 275°F behind paver), compacted with vibratory roller to 92%+ relative density, and finished flush with surrounding pavement.' },
  ],
}

const FAQS = [
  {
    q: 'How do I know if my pothole is a surface issue or a base failure?',
    a: 'Press on the edges of the pothole — if surrounding asphalt feels spongy or depresses, there\'s likely base failure below. Also look for water pooling at the edges, or surrounding alligator cracking. Our assessment includes probing every repair area before we scope a fix.',
  },
  {
    q: 'Can you match existing asphalt color on a patch?',
    a: 'Fresh asphalt is darker than aged asphalt — this is unavoidable and will blend over 12–24 months of weathering and UV exposure. Sealcoating the entire surface after patching is the most effective way to create a uniform appearance.',
  },
  {
    q: 'What is infrared patching and when is it better than traditional cut-and-patch?',
    a: "Infrared patching uses a propane heater to soften existing asphalt to workable temperature, allowing new material to be blended in seamlessly without saw-cut seams. It's ideal for isolated surface failures with solid base — it produces invisible repairs and costs less than traditional methods for small to medium repairs.",
  },
  {
    q: 'How long do asphalt repairs last?',
    a: "A properly prepared and compacted hot-mix patch with correct tack coat adhesion should last 8–12 years or the life of the surrounding pavement. Cold-patch (temporary fill) may last weeks to a few months. We never use cold-patch as a permanent repair.",
  },
]

export default function AsphaltRepairs() {
  return (
    <ServicePageLayout
      service={service}
      seoTitle="Asphalt Repair & Pothole Patching — Outer Banks NC | OBX Paving Co."
      seoDescription="Professional asphalt repair, pothole patching, and infrared seamless patching for the Outer Banks of NC. We fix the base, not just the surface. Dare County & Currituck County."
      heroLabel="Asphalt Repairs — Outer Banks, NC"
      heroHeading={<>Asphalt <span className="text-gradient-sand">Repairs</span> That Fix the Cause, Not Just the Surface</>}
      heroBody="Cold-patch poured into a pothole lasts weeks. We diagnose whether you have a surface failure or a base failure, then apply the correct fix — infrared seamless patching, hot-mix cut-and-fill, or full-depth removal when the base is compromised. Done right, once."
      whySection={WHY}
      processSection={PROCESS}
      faqs={FAQS}
    />
  )
}
