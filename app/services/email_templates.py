"""
email_templates.py — HTML + plain-text email templates for J. Worden & Sons.

Templates
─────────
  quote_confirmation   — Sent to the customer immediately after quote submission
  admin_new_lead       — Sent to J. Worden when a new lead arrives
  follow_up_hot        — 1-hour follow-up for HOT leads
  follow_up_warm       — 3-day re-engagement for WARM leads
  follow_up_cool       — 7-day earn-your-business for COOL leads
  contact_response     — Auto-reply to contact form submissions

Each template function returns a (subject, html_body, plain_text_body) tuple.
"""

from __future__ import annotations

import os
from typing import Any

# ── Brand constants ────────────────────────────────────────────────────────────

COMPANY_NAME = "J. Worden & Sons Asphalt Paving"
COMPANY_PHONE = os.getenv("COMPANY_PHONE", "(804) 555-0100")
COMPANY_EMAIL = os.getenv("COMPANY_EMAIL", "j.wordenandsonspaving@gmail.com")
COMPANY_WEBSITE = os.getenv("COMPANY_WEBSITE", "https://jwordenasphaltpaving.com")
COMPANY_ADDRESS = os.getenv("COMPANY_ADDRESS", "Richmond, VA")

_BRAND_COLOR = "#f5a623"
_DARK_COLOR = "#1a1a2e"
_LIGHT_BG = "#f9f9f9"

# ── Shared layout helpers ──────────────────────────────────────────────────────


def _html_wrapper(title: str, body_content: str, unsubscribe_url: str = "") -> str:
    """Wrap content in a consistent branded HTML email shell."""
    unsubscribe_block = ""
    if unsubscribe_url:
        unsubscribe_block = (
            f"<p style='margin:0;'>"
            f"<a href='{unsubscribe_url}' style='color:#aaa;'>Unsubscribe</a>"
            f"</p>"
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:{_LIGHT_BG};font-family:Arial,Helvetica,sans-serif;color:{_DARK_COLOR};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:{_LIGHT_BG};padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:{_BRAND_COLOR};padding:24px 32px;">
              <h1 style="margin:0;font-size:22px;color:{_DARK_COLOR};font-weight:700;">
                🏗 {COMPANY_NAME}
              </h1>
              <p style="margin:4px 0 0;font-size:13px;color:{_DARK_COLOR};opacity:0.75;">
                Richmond, VA · Professional Asphalt Paving
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              {body_content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:{_LIGHT_BG};padding:20px 32px;border-top:1px solid #e8e8e8;
                        text-align:center;font-size:12px;color:#888;">
              <p style="margin:0 0 6px;">
                {COMPANY_NAME} · {COMPANY_ADDRESS}
              </p>
              <p style="margin:0 0 6px;">
                <a href="tel:{COMPANY_PHONE}" style="color:{_BRAND_COLOR};text-decoration:none;">
                  {COMPANY_PHONE}
                </a>
                &nbsp;·&nbsp;
                <a href="{COMPANY_WEBSITE}" style="color:{_BRAND_COLOR};text-decoration:none;">
                  {COMPANY_WEBSITE}
                </a>
              </p>
              {unsubscribe_block}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _kv_table(rows: list[tuple[str, Any]]) -> str:
    """Render a simple key-value HTML table."""
    cells = "".join(
        f"<tr>"
        f"<td style='padding:8px 12px;font-weight:600;color:#555;white-space:nowrap;"
        f"border-bottom:1px solid #f0f0f0;width:40%;'>{k}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #f0f0f0;'>{v}</td>"
        f"</tr>"
        for k, v in rows
        if v is not None
    )
    return (
        f"<table width='100%' cellpadding='0' cellspacing='0' "
        f"style='border-collapse:collapse;border:1px solid #e8e8e8;border-radius:6px;"
        f"overflow:hidden;margin:16px 0;'>{cells}</table>"
    )


def _cta_button(text: str, url: str) -> str:
    return (
        f"<p style='text-align:center;margin:28px 0;'>"
        f"<a href='{url}' style='background:{_BRAND_COLOR};color:{_DARK_COLOR};"
        f"padding:14px 32px;border-radius:6px;text-decoration:none;"
        f"font-weight:700;font-size:15px;display:inline-block;'>"
        f"{text}"
        f"</a></p>"
    )


# ── Template 1: Quote confirmation (customer) ──────────────────────────────────


def quote_confirmation(lead: Any) -> tuple[str, str, str]:
    """
    Confirmation email sent to the customer right after they submit a quote request.

    Args:
        lead: Lead ORM object or dict with name, email, service_type, urgency, etc.

    Returns:
        (subject, html_body, plain_text_body)
    """
    name = getattr(lead, "name", None) or lead.get("name", "Valued Customer")
    service = getattr(lead, "service_type", None) or lead.get("service_type", "paving")
    urgency = getattr(lead, "urgency", None) or lead.get("urgency", "flexible")
    address = getattr(lead, "address", None) or lead.get("address", "")
    message = getattr(lead, "message", None) or lead.get("message", "")
    score_label = getattr(lead, "score_label", None) or lead.get("score_label", "")

    service_display = service.replace("_", " ").title()
    urgency_display = urgency.replace("_", " ").title()

    sla_map = {"HOT": "within 1 hour", "WARM": "within 24 hours", "COOL": "within 2–3 business days"}
    sla = sla_map.get(score_label, "within 24 hours")

    subject = f"✅ Quote Request Received — {COMPANY_NAME}"

    detail_rows = [
        ("Service Requested", service_display),
        ("Urgency", urgency_display),
        ("Property Address", address or "Not provided"),
        ("Additional Notes", message or "None"),
    ]

    body_html = f"""
      <h2 style="margin:0 0 8px;font-size:20px;color:{_DARK_COLOR};">
        Hi {name}, we received your quote request!
      </h2>
      <p style="margin:0 0 20px;color:#555;line-height:1.6;">
        Thank you for reaching out to <strong>{COMPANY_NAME}</strong>.
        Our team will review your request and get back to you <strong>{sla}</strong>.
      </p>

      <h3 style="margin:0 0 8px;font-size:15px;color:{_DARK_COLOR};">Your Request Summary</h3>
      {_kv_table(detail_rows)}

      <p style="margin:20px 0;color:#555;line-height:1.6;">
        In the meantime, feel free to call us directly at
        <a href="tel:{COMPANY_PHONE}" style="color:{_BRAND_COLOR};font-weight:600;">{COMPANY_PHONE}</a>
        if you have any questions.
      </p>

      {_cta_button("Visit Our Website", COMPANY_WEBSITE)}

      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        — The {COMPANY_NAME} Team
      </p>
    """

    html_body = _html_wrapper(subject, body_html, unsubscribe_url=f"{COMPANY_WEBSITE}/unsubscribe")

    plain_text = (
        f"Hi {name},\n\n"
        f"Thank you for contacting {COMPANY_NAME}!\n\n"
        f"We received your quote request for {service_display} ({urgency_display}).\n"
        f"Our team will follow up {sla}.\n\n"
        f"Service: {service_display}\n"
        f"Urgency: {urgency_display}\n"
        f"Address: {address or 'Not provided'}\n\n"
        f"Questions? Call us: {COMPANY_PHONE}\n"
        f"Website: {COMPANY_WEBSITE}\n\n"
        f"— The {COMPANY_NAME} Team\n\n"
        f"To unsubscribe: {COMPANY_WEBSITE}/unsubscribe"
    )

    return subject, html_body, plain_text


# ── Template 2: Admin new-lead notification ────────────────────────────────────


def admin_new_lead(lead: Any) -> tuple[str, str, str]:
    """
    Internal notification sent to J. Worden when a new lead is created.

    Args:
        lead: Lead ORM object or dict.

    Returns:
        (subject, html_body, plain_text_body)
    """
    name = getattr(lead, "name", None) or lead.get("name", "Unknown")
    email = getattr(lead, "email", None) or lead.get("email", "")
    phone = getattr(lead, "phone", None) or lead.get("phone", "")
    service = getattr(lead, "service_type", None) or lead.get("service_type", "")
    property_type = getattr(lead, "property_type", None) or lead.get("property_type", "")
    urgency = getattr(lead, "urgency", None) or lead.get("urgency", "")
    address = getattr(lead, "address", None) or lead.get("address", "")
    sqft = getattr(lead, "project_size_sqft", None) or lead.get("project_size_sqft", "")
    score_label = getattr(lead, "score_label", None) or lead.get("score_label", "—")
    score_value = getattr(lead, "score_value", None) or lead.get("score_value", "—")
    lead_id = getattr(lead, "id", None) or lead.get("id", "—")
    message = getattr(lead, "message", None) or lead.get("message", "")

    label_colors = {"HOT": "#e74c3c", "WARM": "#f39c12", "COOL": "#3498db"}
    label_color = label_colors.get(score_label, "#888")

    subject = f"🔔 [{score_label}] New Lead #{lead_id} — {name} | {COMPANY_NAME} CRM"

    detail_rows = [
        ("Lead ID", f"#{lead_id}"),
        ("Name", name),
        ("Email", f"<a href='mailto:{email}'>{email}</a>"),
        ("Phone", f"<a href='tel:{phone}'>{phone}</a>"),
        ("Service", service.replace("_", " ").title()),
        ("Property Type", property_type.replace("_", " ").title()),
        ("Urgency", urgency.replace("_", " ").title()),
        ("Project Size", f"{sqft:,.0f} sq ft" if sqft else "Not specified"),
        ("Address", address or "Not provided"),
        ("Message", message or "None"),
    ]

    body_html = f"""
      <div style="background:{label_color};color:#fff;padding:12px 16px;border-radius:6px;
                  margin-bottom:20px;font-size:18px;font-weight:700;">
        🎯 {score_label} Lead — Score {score_value}
      </div>

      <h2 style="margin:0 0 16px;font-size:18px;color:{_DARK_COLOR};">
        New quote request from {name}
      </h2>

      {_kv_table(detail_rows)}

      {_cta_button("View in CRM Dashboard", f"{COMPANY_WEBSITE}/admin/leads")}

      <p style="margin:0;font-size:12px;color:#aaa;">
        Auto-generated by JWordenAI · Do not reply to this email.
      </p>
    """

    html_body = _html_wrapper(subject, body_html)

    plain_text = (
        f"NEW {score_label} LEAD — Score {score_value}\n"
        f"{'=' * 40}\n\n"
        f"Lead ID:  #{lead_id}\n"
        f"Name:     {name}\n"
        f"Email:    {email}\n"
        f"Phone:    {phone}\n"
        f"Service:  {service}\n"
        f"Urgency:  {urgency}\n"
        f"Address:  {address or 'Not provided'}\n"
        f"Sq Ft:    {sqft or 'Not specified'}\n"
        f"Message:  {message or 'None'}\n\n"
        f"CRM: {COMPANY_WEBSITE}/admin/leads\n"
    )

    return subject, html_body, plain_text


# ── Template 3: Follow-up — HOT lead (1 hour) ─────────────────────────────────


def follow_up_hot(lead: Any) -> tuple[str, str, str]:
    """
    Follow-up email for HOT leads sent ~1 hour after submission.

    Args:
        lead: Lead ORM object or dict.

    Returns:
        (subject, html_body, plain_text_body)
    """
    name = getattr(lead, "name", None) or lead.get("name", "there")
    service = getattr(lead, "service_type", None) or lead.get("service_type", "paving")
    service_display = service.replace("_", " ").title()

    subject = f"⚡ Quick Follow-Up on Your {service_display} Quote — {COMPANY_NAME}"

    body_html = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:{_DARK_COLOR};">
        Hi {name} — just checking in!
      </h2>
      <p style="margin:0 0 16px;color:#555;line-height:1.6;">
        We noticed you submitted a quote request for <strong>{service_display}</strong>
        a little while ago. We want to make sure you get the fast response you deserve.
      </p>
      <p style="margin:0 0 16px;color:#555;line-height:1.6;">
        Our team is ready to discuss your project right now. Give us a call or reply
        to this email and we'll get you a detailed estimate today.
      </p>

      <div style="background:#fff8e1;border-left:4px solid {_BRAND_COLOR};
                  padding:16px;border-radius:0 6px 6px 0;margin:20px 0;">
        <p style="margin:0;font-weight:600;color:{_DARK_COLOR};">
          📞 Call us now: <a href="tel:{COMPANY_PHONE}" style="color:{_BRAND_COLOR};">{COMPANY_PHONE}</a>
        </p>
        <p style="margin:8px 0 0;font-size:13px;color:#666;">
          Available Monday–Saturday, 7 AM – 6 PM EST
        </p>
      </div>

      {_cta_button("Get Your Free Estimate", COMPANY_WEBSITE)}

      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        — The {COMPANY_NAME} Team
      </p>
    """

    html_body = _html_wrapper(subject, body_html, unsubscribe_url=f"{COMPANY_WEBSITE}/unsubscribe")

    plain_text = (
        f"Hi {name},\n\n"
        f"We noticed you submitted a quote request for {service_display} a little while ago.\n\n"
        f"Our team is ready to discuss your project right now. Give us a call or reply "
        f"to this email and we'll get you a detailed estimate today.\n\n"
        f"📞 Call us: {COMPANY_PHONE}\n"
        f"🌐 Website: {COMPANY_WEBSITE}\n\n"
        f"— The {COMPANY_NAME} Team\n\n"
        f"To unsubscribe: {COMPANY_WEBSITE}/unsubscribe"
    )

    return subject, html_body, plain_text


# ── Template 4: Follow-up — WARM lead (3 days) ────────────────────────────────


def follow_up_warm(lead: Any) -> tuple[str, str, str]:
    """
    Re-engagement email for WARM leads sent ~3 days after submission.

    Args:
        lead: Lead ORM object or dict.

    Returns:
        (subject, html_body, plain_text_body)
    """
    name = getattr(lead, "name", None) or lead.get("name", "there")
    service = getattr(lead, "service_type", None) or lead.get("service_type", "paving")
    service_display = service.replace("_", " ").title()

    subject = f"Still Thinking It Over? We're Here to Help — {COMPANY_NAME}"

    body_html = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:{_DARK_COLOR};">
        Hi {name}, still considering your {service_display} project?
      </h2>
      <p style="margin:0 0 16px;color:#555;line-height:1.6;">
        We know big paving decisions take time. We wanted to follow up and let you know
        we're still here whenever you're ready to move forward.
      </p>

      <h3 style="margin:0 0 12px;font-size:15px;color:{_DARK_COLOR};">
        Why choose {COMPANY_NAME}?
      </h3>
      <ul style="margin:0 0 20px;padding-left:20px;color:#555;line-height:1.8;">
        <li>✅ Free, no-obligation estimates</li>
        <li>✅ Licensed &amp; insured in Virginia</li>
        <li>✅ 20+ years of residential &amp; commercial experience</li>
        <li>✅ Competitive pricing with quality materials</li>
        <li>✅ Local Richmond-area team — fast response times</li>
      </ul>

      <p style="margin:0 0 16px;color:#555;line-height:1.6;">
        Have questions? We're happy to walk you through the process, explain pricing,
        or schedule a free on-site assessment.
      </p>

      {_cta_button("Schedule a Free Estimate", COMPANY_WEBSITE)}

      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        — The {COMPANY_NAME} Team<br/>
        <a href="tel:{COMPANY_PHONE}" style="color:{_BRAND_COLOR};">{COMPANY_PHONE}</a>
      </p>
    """

    html_body = _html_wrapper(subject, body_html, unsubscribe_url=f"{COMPANY_WEBSITE}/unsubscribe")

    plain_text = (
        f"Hi {name},\n\n"
        f"Still considering your {service_display} project? We're here whenever you're ready.\n\n"
        f"Why choose {COMPANY_NAME}?\n"
        f"  - Free, no-obligation estimates\n"
        f"  - Licensed & insured in Virginia\n"
        f"  - 20+ years of experience\n"
        f"  - Competitive pricing\n"
        f"  - Local Richmond-area team\n\n"
        f"Ready to move forward? Call us: {COMPANY_PHONE}\n"
        f"Or visit: {COMPANY_WEBSITE}\n\n"
        f"— The {COMPANY_NAME} Team\n\n"
        f"To unsubscribe: {COMPANY_WEBSITE}/unsubscribe"
    )

    return subject, html_body, plain_text


# ── Template 5: Follow-up — COOL lead (7 days) ────────────────────────────────


def follow_up_cool(lead: Any) -> tuple[str, str, str]:
    """
    Earn-your-business email for COOL leads sent ~7 days after submission.

    Args:
        lead: Lead ORM object or dict.

    Returns:
        (subject, html_body, plain_text_body)
    """
    name = getattr(lead, "name", None) or lead.get("name", "there")
    service = getattr(lead, "service_type", None) or lead.get("service_type", "paving")
    service_display = service.replace("_", " ").title()

    subject = f"One Last Thing Before We Close Your File — {COMPANY_NAME}"

    body_html = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:{_DARK_COLOR};">
        Hi {name} — we don't want to lose you!
      </h2>
      <p style="margin:0 0 16px;color:#555;line-height:1.6;">
        It's been about a week since you asked about <strong>{service_display}</strong>.
        We understand life gets busy, so this will be our last follow-up — no pressure.
      </p>
      <p style="margin:0 0 16px;color:#555;line-height:1.6;">
        If you're still interested, we'd love the opportunity to earn your business.
        We're confident we can offer you the best value in the Richmond area.
      </p>

      <div style="background:#f0f7ff;border:1px solid #c8e0ff;border-radius:6px;
                  padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:{_DARK_COLOR};">
          🎁 Mention this email for a complimentary site assessment
        </p>
        <p style="margin:0;font-size:13px;color:#666;">
          We'll come to you, evaluate your project, and provide a detailed written estimate — free.
        </p>
      </div>

      {_cta_button("Claim Your Free Site Assessment", COMPANY_WEBSITE)}

      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        If you've already chosen another contractor, no worries — we wish you the best!
        Feel free to reach out any time in the future.<br/><br/>
        — The {COMPANY_NAME} Team<br/>
        <a href="tel:{COMPANY_PHONE}" style="color:{_BRAND_COLOR};">{COMPANY_PHONE}</a>
      </p>
    """

    html_body = _html_wrapper(subject, body_html, unsubscribe_url=f"{COMPANY_WEBSITE}/unsubscribe")

    plain_text = (
        f"Hi {name},\n\n"
        f"It's been about a week since you asked about {service_display}. "
        f"This will be our last follow-up — no pressure.\n\n"
        f"If you're still interested, mention this email for a complimentary site assessment. "
        f"We'll come to you, evaluate your project, and provide a detailed written estimate — free.\n\n"
        f"Call us: {COMPANY_PHONE}\n"
        f"Website: {COMPANY_WEBSITE}\n\n"
        f"If you've already chosen another contractor, no worries — we wish you the best!\n\n"
        f"— The {COMPANY_NAME} Team\n\n"
        f"To unsubscribe: {COMPANY_WEBSITE}/unsubscribe"
    )

    return subject, html_body, plain_text


# ── Template 6: Contact form auto-response ────────────────────────────────────


def contact_response(contact: Any) -> tuple[str, str, str]:
    """
    Auto-reply sent to a customer who submitted the contact form.

    Args:
        contact: ContactMessage ORM object or dict with name, email, message.

    Returns:
        (subject, html_body, plain_text_body)
    """
    name = getattr(contact, "name", None) or contact.get("name", "there")
    message = getattr(contact, "message", None) or contact.get("message", "")

    subject = f"We Got Your Message — {COMPANY_NAME}"

    body_html = f"""
      <h2 style="margin:0 0 12px;font-size:20px;color:{_DARK_COLOR};">
        Hi {name}, thanks for reaching out!
      </h2>
      <p style="margin:0 0 16px;color:#555;line-height:1.6;">
        We received your message and a member of our team will get back to you
        <strong>within 1 business day</strong>.
      </p>

      <div style="background:{_LIGHT_BG};border:1px solid #e8e8e8;border-radius:6px;
                  padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#888;
                  text-transform:uppercase;letter-spacing:0.5px;">Your Message</p>
        <p style="margin:0;color:#555;line-height:1.6;font-style:italic;">
          "{message}"
        </p>
      </div>

      <p style="margin:0 0 16px;color:#555;line-height:1.6;">
        Need a faster response? Give us a call:
        <a href="tel:{COMPANY_PHONE}" style="color:{_BRAND_COLOR};font-weight:600;">{COMPANY_PHONE}</a>
      </p>

      {_cta_button("Learn More About Our Services", COMPANY_WEBSITE)}

      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        — The {COMPANY_NAME} Team
      </p>
    """

    html_body = _html_wrapper(subject, body_html, unsubscribe_url=f"{COMPANY_WEBSITE}/unsubscribe")

    plain_text = (
        f"Hi {name},\n\n"
        f"Thanks for reaching out to {COMPANY_NAME}!\n\n"
        f"We received your message and will get back to you within 1 business day.\n\n"
        f"Your message:\n\"{message}\"\n\n"
        f"Need a faster response? Call us: {COMPANY_PHONE}\n"
        f"Website: {COMPANY_WEBSITE}\n\n"
        f"— The {COMPANY_NAME} Team\n\n"
        f"To unsubscribe: {COMPANY_WEBSITE}/unsubscribe"
    )

    return subject, html_body, plain_text


# ── Template registry ──────────────────────────────────────────────────────────

TEMPLATE_REGISTRY: dict[str, dict] = {
    "quote_confirmation": {
        "name": "Quote Confirmation (Customer)",
        "description": "Sent to the customer immediately after submitting a quote request.",
        "trigger": "POST /api/v1/leads/quote",
        "recipient": "customer",
    },
    "admin_new_lead": {
        "name": "New Lead Notification (Admin)",
        "description": "Internal alert sent to J. Worden when a new lead arrives.",
        "trigger": "POST /api/v1/leads/quote",
        "recipient": "admin",
    },
    "follow_up_hot": {
        "name": "Hot Lead Follow-Up (1 Hour)",
        "description": "Sent to HOT leads approximately 1 hour after submission.",
        "trigger": "Celery task: send_follow_up_email (hot_1h)",
        "recipient": "customer",
    },
    "follow_up_warm": {
        "name": "Warm Lead Re-Engagement (3 Days)",
        "description": "Sent to WARM leads approximately 3 days after submission.",
        "trigger": "Celery task: send_follow_up_email (warm_3d)",
        "recipient": "customer",
    },
    "follow_up_cool": {
        "name": "Cool Lead Earn-Your-Business (7 Days)",
        "description": "Final outreach to COOL leads approximately 7 days after submission.",
        "trigger": "Celery task: send_follow_up_email (cool_7d)",
        "recipient": "customer",
    },
    "contact_response": {
        "name": "Contact Form Auto-Response",
        "description": "Auto-reply sent to customers who submit the contact form.",
        "trigger": "POST /api/v1/leads/contact",
        "recipient": "customer",
    },
}
