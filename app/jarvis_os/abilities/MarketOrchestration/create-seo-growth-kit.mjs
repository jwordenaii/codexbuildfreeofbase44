import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function parseArgs(argv) {
  const args = {}
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue
    const [key, ...rest] = raw.slice(2).split('=')
    args[key] = rest.join('=').trim()
  }
  return args
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.+$/, '')
}

const args = parseArgs(process.argv.slice(2))
const domain = normalizeDomain(args.domain || '')
const brand = String(args.brand || '').trim()
const city = String(args.city || '').trim()
const region = String(args.region || '').trim()

if (!domain || !brand || !city || !region) {
  console.error('Usage: node scripts/create-seo-growth-kit.mjs --domain=example.com --brand="Brand Name" --city="City" --region="State"')
  process.exit(1)
}

const slug = normalizeSlug(domain)
const baseDir = path.resolve(__dirname, `../docs/seo-growth-kits/${slug}`)
fs.mkdirSync(baseDir, { recursive: true })

const files = {
  'README.md': `# SEO Growth Kit - ${brand}\n\nDomain: ${domain}\nPrimary Market: ${city}, ${region}\n\n## Use This Folder For\n\n1. Google Business Profile setup and weekly posting\n2. Citation and directory submissions\n3. Backlink outreach pipeline and status tracking\n4. Review generation workflow and KPI tracking\n5. Keyword and local rank movement tracking\n\n## Weekly Cadence\n\n1. Publish 2 GBP posts with fresh media\n2. Request 5 to 10 new customer reviews\n3. Send 10 contextual backlink outreach emails\n4. Publish 1 local service page or city content update\n5. Log ranking deltas and conversion KPIs\n`,
  'gbp-checklist.md': `# GBP Launch Checklist\n\n- [ ] Claim and verify Google Business Profile\n- [ ] Set primary category (most revenue-driving)\n- [ ] Add 2 to 4 secondary categories\n- [ ] Complete services list with commercial intent terms\n- [ ] Add opening date, service area, and business description\n- [ ] Add logo, cover image, team photos, and job photos\n- [ ] Add appointment and quote links with UTM tags\n- [ ] Seed initial Q&A (top 10 buyer questions)\n- [ ] Publish first 5 GBP posts\n- [ ] Configure review request SMS/email flow\n- [ ] Enable call tracking number forwarding if needed\n`,
  'citation-tracker.csv': 'directory,profile_url,status,submitted_date,live_date,notes\nGoogle Business Profile,,, , ,\nBing Places,,, , ,\nApple Business Connect,,, , ,\nYelp,,, , ,\nBetter Business Bureau,,, , ,\nMapQuest,,, , ,\nFoursquare,,, , ,\nYellow Pages,,, , ,\nChamber of Commerce,,, , ,\nIndustry Association,,, , ,\n',
  'backlink-outreach.csv': 'target_site,target_page,contact_name,contact_email,angle,status,next_follow_up,notes\nlocal-news.example.com,,,,Case study pitch,Not Started,,\ncity-blog.example.com,,,,Expert quote offer,Not Started,,\nindustry-supplier.example.com,,,,Partner page request,Not Started,,\nproperty-management-blog.example.com,,,,Maintenance guide contribution,Not Started,,\n',
  'keyword-rank-tracker.csv': 'keyword,intent,landing_page,current_rank,target_rank,search_volume,last_checked,notes\n${city.toLowerCase()} asphalt paving,commercial,/, ,Top 3,, ,\n${city.toLowerCase()} parking lot paving,commercial,/, ,Top 3,, ,\n${city.toLowerCase()} sealcoating,service,/, ,Top 3,, ,\n${region.toLowerCase()} asphalt contractor,regional,/, ,Top 5,, ,\n',
  'review-request-templates.md': `# Review Request Templates\n\n## SMS\n\nHi {{first_name}}, thanks again for trusting ${brand}. If the work met your expectations, would you mind leaving a quick Google review? It helps local owners find us: {{google_review_link}}\n\n## Email\n\nSubject: Quick favor from ${brand}\n\nHi {{first_name}},\n\nThank you for choosing ${brand}. We are grateful for your business. If you have 60 seconds, would you share your experience on Google?\n\n{{google_review_link}}\n\nYour feedback helps other customers in ${city} make confident decisions.\n\nThank you,\n${brand}\n`,
}

for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(baseDir, name), content)
}

console.log(`SEO growth kit created at ${baseDir}`)
