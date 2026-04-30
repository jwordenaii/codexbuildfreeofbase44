# Email Service — SendGrid Integration

Automated transactional and nurture email delivery for J. Worden & Sons Asphalt Paving, powered by the SendGrid API.

---

## Table of Contents

1. [SendGrid Setup](#sendgrid-setup)
2. [Environment Variables](#environment-variables)
3. [Email Templates Reference](#email-templates-reference)
4. [Follow-Up Automation Flow](#follow-up-automation-flow)
5. [API Endpoints](#api-endpoints)
6. [Testing Instructions](#testing-instructions)
7. [Unsubscribe Handling](#unsubscribe-handling)
8. [Troubleshooting](#troubleshooting)

---

## SendGrid Setup

### 1. Create a SendGrid account

Sign up at [sendgrid.com](https://sendgrid.com). The free tier allows 100 emails/day — sufficient for most lead volumes.

### 2. Generate an API key

1. Go to **Settings → API Keys → Create API Key**
2. Choose **Restricted Access** and enable **Mail Send → Full Access**
3. Copy the key — it is only shown once

### 3. Verify your sender email

SendGrid requires a verified sender before it will deliver email.

**Option A — Single Sender Verification (quickest):**
1. Go to **Settings → Sender Authentication → Single Sender Verification**
2. Add and verify `j.wordenandsonspaving@gmail.com` (or your preferred address)

**Option B — Domain Authentication (recommended for production):**
1. Go to **Settings → Sender Authentication → Authenticate Your Domain**
2. Follow the DNS record instructions for your domain
3. Domain authentication improves deliverability and removes the "via sendgrid.net" label

### 4. Set environment variables

```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=j.wordenandsonspaving@gmail.com
SENDGRID_FROM_NAME=J. Worden & Sons Asphalt Paving   # optional, defaults to above
ADMIN_NOTIFY_EMAIL=j.wordenandsonspaving@gmail.com    # where admin alerts go
```

On Railway: add these in **Service → Variables**.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SENDGRID_API_KEY` | ✅ Yes | — | SendGrid API key for mail send |
| `SENDGRID_FROM_EMAIL` | ✅ Yes | — | Verified sender email address |
| `SENDGRID_FROM_NAME` | No | `J. Worden & Sons Asphalt Paving` | Display name in From header |
| `ADMIN_NOTIFY_EMAIL` | No | `j.wordenandsonspaving@gmail.com` | Admin notification recipient |
| `COMPANY_PHONE` | No | `(804) 555-0100` | Phone shown in email footers |
| `COMPANY_WEBSITE` | No | `https://jwordenasphaltpaving.com` | Website URL in email CTAs |
| `COMPANY_ADDRESS` | No | `Richmond, VA` | Address shown in email footers |

If `SENDGRID_API_KEY` or `SENDGRID_FROM_EMAIL` is not set, all email sends are silently skipped and a warning is logged. The API continues to function normally — no errors are returned to customers.

---

## Email Templates Reference

All templates are defined in `app/services/email_templates.py`. Each returns `(subject, html_body, plain_text_body)`.

### 1. `quote_confirmation` — Quote Confirmation (Customer)

**Trigger:** `POST /api/v1/leads/quote` — sent immediately after a quote request is saved  
**Recipient:** Customer  
**Content:** Confirms receipt, shows request summary (service, urgency, address), states the response SLA based on lead score (HOT → 1 hour, WARM → 24 hours, COOL → 2–3 days), includes phone CTA

### 2. `admin_new_lead` — New Lead Notification (Admin)

**Trigger:** `POST /api/v1/leads/quote` — sent immediately alongside the customer confirmation  
**Recipient:** `ADMIN_NOTIFY_EMAIL`  
**Content:** Full lead details (name, email, phone, service, score, address, message), colour-coded score badge (red/orange/blue), CRM dashboard link

### 3. `follow_up_hot` — Hot Lead Follow-Up (1 Hour)

**Trigger:** Celery task `send_follow_up_email` with `task_type=hot_1h`, dispatched 3,600 seconds after quote submission  
**Recipient:** Customer  
**Content:** Urgent tone, direct call-to-action, phone number prominently displayed

### 4. `follow_up_warm` — Warm Lead Re-Engagement (3 Days)

**Trigger:** Celery task `send_follow_up_email` with `task_type=warm_3d`, dispatched 3 days after quote submission  
**Recipient:** Customer  
**Content:** Value proposition, bullet list of differentiators, soft CTA to schedule a free estimate

### 5. `follow_up_cool` — Cool Lead Earn-Your-Business (7 Days)

**Trigger:** Celery task `send_follow_up_email` with `task_type=cool_7d`, dispatched 7 days after quote submission  
**Recipient:** Customer  
**Content:** Final outreach, complimentary site assessment offer, low-pressure closing

### 6. `contact_response` — Contact Form Auto-Response

**Trigger:** `POST /api/v1/leads/contact` — sent immediately after a contact form submission  
**Recipient:** Customer  
**Content:** Confirms message received, echoes their message back, 1-business-day response commitment

---

## Follow-Up Automation Flow

```
Customer submits quote form
         │
         ▼
  Lead saved to DB
  Score calculated (HOT / WARM / COOL)
         │
         ├─► Background task: send_quote_confirmation(lead)   ← immediate
         ├─► Background task: send_admin_notification(lead)   ← immediate
         ├─► schedule_follow_up() → FollowUpTask record created (status=pending)
         └─► Celery: send_follow_up_email.apply_async(countdown=N)
                      │
                      │  HOT  → countdown=3,600s  (1 hour)
                      │  WARM → countdown=259,200s (3 days)
                      └─ COOL → countdown=604,800s (7 days)

When countdown expires, Celery worker executes send_follow_up_email:
  1. Load Lead from DB
  2. Find pending FollowUpTask record
  3. Call send_follow_up(lead, task_type) via SendGrid
  4. Update FollowUpTask.status = "sent" | "error"
  5. Update FollowUpTask.sent_at = now()
```

### Celery Worker Requirements

Follow-up emails are only sent if a Celery worker is running:

```bash
# Start worker (required for scheduled follow-ups)
celery -A app.celery_app worker --loglevel=info --concurrency=4

# Start beat scheduler (for periodic checks — optional)
celery -A app.celery_app beat --loglevel=info
```

On Railway, add a second service with the start command:
```
celery -A app.celery_app worker --loglevel=info
```

---

## API Endpoints

All email endpoints require a bearer token (`Authorization: Bearer <token>`).

### `POST /api/v1/email/send-test`

Send a test email using any registered template.

**Request body:**
```json
{
  "to_email": "you@example.com",
  "template": "quote_confirmation"
}
```

**Response:**
```json
{
  "sent": true,
  "to_email": "you@example.com",
  "template": "quote_confirmation",
  "message": "Test email sent successfully to you@example.com."
}
```

Available `template` values: `quote_confirmation`, `admin_new_lead`, `follow_up_hot`, `follow_up_warm`, `follow_up_cool`, `contact_response`

---

### `GET /api/v1/email/templates`

List all registered email templates with metadata.

**Response:**
```json
{
  "total": 6,
  "templates": [
    {
      "key": "quote_confirmation",
      "name": "Quote Confirmation (Customer)",
      "description": "Sent to the customer immediately after submitting a quote request.",
      "trigger": "POST /api/v1/leads/quote",
      "recipient": "customer"
    },
    ...
  ]
}
```

---

### `POST /api/v1/email/resend/{lead_id}`

Resend the quote confirmation email for a specific lead.

**Example:** `POST /api/v1/email/resend/42`

**Response:**
```json
{
  "sent": true,
  "lead_id": 42,
  "to_email": "customer@example.com",
  "message": "Confirmation email resent to customer@example.com."
}
```

---

## Testing Instructions

### 1. Verify SendGrid configuration

```bash
# Check env vars are set
echo $SENDGRID_API_KEY
echo $SENDGRID_FROM_EMAIL

# Send a test email via the API
curl -X POST https://your-api.railway.app/api/v1/email/send-test \
  -H "Authorization: Bearer $JWORDEN_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to_email": "your@email.com", "template": "quote_confirmation"}'
```

### 2. Test quote confirmation flow

Submit a quote via the public endpoint and check your inbox:

```bash
curl -X POST https://your-api.railway.app/api/v1/leads/quote \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "email": "your@email.com",
    "phone": "8045550100",
    "service_type": "asphalt_paving",
    "property_type": "residential",
    "urgency": "within_1_week",
    "project_size_sqft": 2000
  }'
```

Expected: customer confirmation email + admin notification within seconds.

### 3. Test admin notification

The admin notification is sent automatically with every quote. Check `ADMIN_NOTIFY_EMAIL` inbox.

### 4. Test follow-up scheduling

Check the `follow_up_tasks` table to confirm a pending task was created:

```sql
SELECT * FROM follow_up_tasks ORDER BY created_at DESC LIMIT 5;
```

To test the Celery task immediately (bypassing the countdown):

```bash
# From a Python shell with the app context
from app.tasks.email_tasks import send_follow_up_email
send_follow_up_email(_execute_follow_up(lead_id=1, task_type="hot_1h"))
```

### 5. Test with an invalid email

The service validates email addresses before sending. Passing a malformed address will log a warning and return `sent=False` without raising an exception.

### 6. Test the resend endpoint

```bash
curl -X POST https://your-api.railway.app/api/v1/email/resend/1 \
  -H "Authorization: Bearer $JWORDEN_MASTER_KEY"
```

---

## Unsubscribe Handling

All customer-facing emails include an unsubscribe link in the footer pointing to `{COMPANY_WEBSITE}/unsubscribe`.

**Implementation notes:**

- The unsubscribe URL is rendered from the `COMPANY_WEBSITE` environment variable
- You must implement the `/unsubscribe` page on your frontend to capture opt-outs
- For CAN-SPAM / GDPR compliance, honour unsubscribe requests within 10 business days
- Consider adding an `unsubscribed` boolean column to the `Lead` and `ContactMessage` models and checking it before sending follow-ups

**SendGrid unsubscribe groups (recommended for production):**

1. In SendGrid, go to **Email API → Unsubscribe Groups**
2. Create groups: "Quote Follow-Ups", "Promotional"
3. Add the group ID to the `Mail` object in `email_service.py`:
   ```python
   from sendgrid.helpers.mail import Asm
   message.asm = Asm(group_id=12345, groups_to_display=[12345])
   ```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| No emails sent, no errors | `SENDGRID_API_KEY` or `SENDGRID_FROM_EMAIL` not set | Add env vars and redeploy |
| `403 Forbidden` from SendGrid | API key lacks Mail Send permission | Regenerate key with correct permissions |
| `400 Bad Request` from SendGrid | Sender not verified | Complete Single Sender Verification in SendGrid dashboard |
| Emails go to spam | Domain not authenticated | Set up Domain Authentication in SendGrid |
| Follow-up emails never arrive | Celery worker not running | Start worker: `celery -A app.celery_app worker` |
| `FollowUpTask` stuck in `pending` | Celery countdown not elapsed yet | Wait for the countdown, or check worker logs |
| `sendgrid` import error | Package not installed | Ensure `sendgrid==7.0.0` is in `requirements.txt` |

### Checking logs

```bash
# Railway logs
railway logs --tail

# Look for SendGrid-related entries
railway logs | grep -i sendgrid
railway logs | grep -i "email sent"
railway logs | grep -i "email.*failed"
```
