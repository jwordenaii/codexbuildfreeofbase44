# AI Tech Radar

This project now includes a feed-first monitoring pipeline for tracking new AI capabilities and platform changes.

## What It Monitors

- OpenAI News RSS
- Google AI Blog RSS
- Cloudflare AI tag RSS
- Microsoft AI tag RSS
- Anthropic newsroom page (HTML fallback)
- Vercel changelog page (HTML fallback)
- arXiv cs.AI RSS (preprint / pre-publication signals)
- arXiv cs.CV RSS (vision preprint / pre-publication signals)

## Local Usage

Run a full collection + report generation:

```bash
npm run ops:tech-radar
```

Run compare-only mode (returns non-zero when new items are detected):

```bash
npm run ops:tech-radar:diff
```

Import collected signals into structured system intelligence payloads:

```bash
npm run ops:tech-radar:import
```

Run a continuous local monitor loop (24/7 daemon mode):

```bash
npm run ops:tech-radar:watch
```

Send urgent email alerts for new high/critical signals:

```bash
npm run ops:tech-radar:email-alert
```

Send daily digest email (medium+):

```bash
npm run ops:tech-radar:email-alert:daily
```

Run one full watcher cycle and exit:

```bash
npm run ops:tech-radar:watch:once
```

Direct script options:

```bash
node scripts/ai-tech-radar.mjs --help
```

## Output Files

The script writes to `docs/tech-radar/`:

- `snapshot.json` - canonical baseline used for change detection
- `latest.json` - current run summary with new/changed items
- `source-health.json` - per-source fetch health and timing
- `latest-report.md` - human-readable report

The intelligence import step writes:

- `docs/tech-radar/intelligence/latest.json` - prioritized technology intelligence payload
- `docs/tech-radar/intelligence/latest-report.md` - human-readable intelligence brief
- `app/data/tech-intelligence/latest.json` - stable in-repo system import artifact for downstream analysis

The email alert step writes:

- `docs/tech-radar/intelligence/email-alert-state.json` - dedupe + daily-send checkpoint state

## Required Environment Variables (Email Alerts)

- `SENDGRID_API_KEY` - SendGrid API key
- `SENDGRID_FROM_EMAIL` - verified sender email
- `TECH_RADAR_ALERT_TO_EMAIL` - comma-separated recipients for urgent + daily digests

Optional:

- `SENDGRID_FROM_NAME` - sender display name override
- `ADMIN_NOTIFY_EMAIL` - fallback recipient if `TECH_RADAR_ALERT_TO_EMAIL` is unset

## GitHub Actions Automation

Workflow: `.github/workflows/ai-tech-radar.yml`

Schedule:

- Every hour (24/7)
- Manual trigger via `workflow_dispatch`

The workflow restores prior `snapshot.json` from GitHub Actions cache, runs the radar, imports prioritized intelligence into system payloads, saves the updated snapshot back to cache, and uploads reports as artifacts. This keeps diffs meaningful across runs without writing commits to `main`.

Workflow steps now include:

- Hourly radar collection
- Intelligence import payload generation
- Urgent email alerts for new high/critical signals
- Daily digest email (max once every 24h)

## Capability Tagging

The script classifies signals into capability tags to make trends actionable:

- `agents-autonomy`
- `models-reasoning`
- `multimodal-voice-vision`
- `developer-platforms`
- `infra-inference-edge`
- `security-governance`
- `memory-state-personalization`
- `search-retrieval`

Update rules in `scripts/ai-tech-radar.mjs` as new categories become important.

Added for upcoming technology tracking:

- `pre-release-signals` (preview, beta, roadmap, early access, preprint/arXiv, RFC, forthcoming)

## Command Center / API Integration

Internal queue endpoint:

- `GET /api/v1/tech-intelligence/queue?limit=20&min_priority=medium`

The endpoint reads from `app/data/tech-intelligence/latest.json` (or docs fallback), returns prioritized opportunities, staleness hours, and domain pressure summary for Command Center.
