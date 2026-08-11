"""Mailer service — HTML template generation, ZIP batch export, Lob API client.

Real mode: LOB_API_KEY set → sends physical letters via Lob API.
Mock mode: LOB_API_KEY='' → returns mock Lob response, no physical mail.

Lob letter spec: 8.5"×11", single-sided, black & white, CASS-verified addresses.

Ported verbatim from NewRepo's Worden Standard prototype
(apps/api/app/services/mailer_service.py) — self-contained (stdlib + httpx).
LOB_API_KEY is registered in app/services/runtime_config.py MANAGED_KEYS
(and SENSITIVE_KEYS, since it's a real secret).
"""
from __future__ import annotations

import csv
import io
import logging
import uuid
import zipfile
from datetime import date
from typing import Optional

import httpx

log = logging.getLogger(__name__)

_DISCLAIMER = """
IMPORTANT DISCLAIMER: This assessment is based solely on aerial satellite imagery and is
preliminary in nature. Condition ratings (good/fair/poor) are indicative estimates only and
may not accurately reflect actual surface conditions, structural integrity, or property value.
Pricing estimates are provided for general planning and budgeting purposes only and are NOT
a binding quote, offer, or contract. Actual scope and pricing are subject to change following
an in-person on-site inspection by a licensed contractor. This communication is an advertisement
for contracting services from {company_name}. If you do not wish to receive future communications,
please contact us at {company_phone} and we will promptly remove you from our mailing list.
{company_name} is not a licensed appraiser, inspector, or real estate professional. Nothing
in this communication constitutes a property inspection, structural assessment, or appraisal.
""".strip()


def _condition_class(c: str) -> str:
    return {'good': 'good', 'fair': 'fair', 'poor': 'poor'}.get(c, 'fair')


def generate_mailer_html(
    address: str,
    city: str,
    state: str,
    zip_code: str,
    owner_name: str,
    roof: str,
    driveway: str,
    drainage: str,
    narrative: str,
    service_label: str,
    sqft: float,
    estimate_low: float,
    estimate_high: float,
    company_name: str,
    company_phone: str,
    company_website: str,
    company_address: str = '',
    established_year: str = '1984',
) -> str:
    today = date.today().strftime('%B %d, %Y')
    greeting_name = owner_name.split()[0] if owner_name and owner_name not in ('Unknown Owner', '') else 'Property Owner'
    disclaimer = _DISCLAIMER.format(company_name=company_name, company_phone=company_phone)

    def badge(cond: str) -> str:
        color = {'good': '#15803d', 'fair': '#b45309', 'poor': '#b91c1c'}.get(cond, '#6b7280')
        bg = {'good': '#dcfce7', 'fair': '#fef3c7', 'poor': '#fee2e2'}.get(cond, '#f3f4f6')
        return (
            f'<span style="display:inline-block;padding:2px 10px;border-radius:4px;'
            f'font-weight:700;font-size:11px;letter-spacing:0.04em;color:{color};background:{bg};">'
            f'{cond.upper()}</span>'
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  *{{box-sizing:border-box;margin:0;padding:0;}}
  body{{font-family:Arial,sans-serif;font-size:14px;color:#1a1a2e;background:#fff;padding:44px 52px;max-width:720px;}}
  .header{{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a1a2e;padding-bottom:14px;margin-bottom:20px;}}
  .company{{font-size:20px;font-weight:800;letter-spacing:-0.02em;}}
  .company-sub{{font-size:11px;color:#555;margin-top:3px;}}
  .date-line{{font-size:11px;color:#888;text-align:right;}}
  p{{line-height:1.65;color:#333;margin-bottom:12px;}}
  .condition-box{{background:#f8f9fa;border-left:4px solid #1a1a2e;padding:14px 16px;margin:18px 0;border-radius:0 4px 4px 0;}}
  .condition-box h3{{font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#555;margin-bottom:10px;}}
  table{{width:100%;border-collapse:collapse;margin:8px 0;}}
  th{{text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#888;padding:4px 8px;border-bottom:1px solid #e5e7eb;}}
  td{{padding:7px 8px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;}}
  .narrative{{font-size:12px;color:#6b7280;margin-top:10px;font-style:italic;line-height:1.6;}}
  .estimate-box{{border:2px solid #1a1a2e;border-radius:6px;padding:20px;text-align:center;margin:20px 0;}}
  .estimate-label{{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-bottom:6px;}}
  .estimate-range{{font-size:32px;font-weight:800;color:#1a1a2e;letter-spacing:-0.02em;}}
  .estimate-sub{{font-size:11px;color:#9ca3af;margin-top:6px;}}
  .cta{{background:#1a1a2e;color:#fff;padding:18px 24px;text-align:center;border-radius:6px;margin:20px 0;}}
  .cta-text{{font-size:17px;font-weight:800;}}
  .cta-contact{{font-size:13px;margin-top:6px;opacity:0.85;}}
  .disclaimer{{font-size:8.5px;color:#9ca3af;border-top:1px solid #e5e7eb;margin-top:28px;padding-top:12px;line-height:1.55;}}
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="company">{company_name}</div>
    <div class="company-sub">Licensed &amp; Insured &middot; Est. {established_year} &middot; {company_address}</div>
  </div>
  <div class="date-line">{today}</div>
</div>

<p>Dear {greeting_name},</p>

<p>
As part of our neighborhood outreach program, our team reviewed publicly available aerial
imagery of properties in the <strong>{zip_code}</strong> area. Based on our assessment of
your property at <strong>{address}, {city}, {state} {zip_code}</strong>,
our estimators noted the following surface condition indicators:
</p>

<div class="condition-box">
  <h3>Aerial Condition Assessment &mdash; {address}</h3>
  <table>
    <thead>
      <tr><th>Surface</th><th>Assessed Condition</th></tr>
    </thead>
    <tbody>
      <tr><td>Driveway / Pavement</td><td>{badge(driveway)}</td></tr>
      <tr><td>Roof</td><td>{badge(roof)}</td></tr>
      <tr><td>Drainage / Grading</td><td>{badge(drainage)}</td></tr>
    </tbody>
  </table>
  <p class="narrative">&ldquo;{narrative}&rdquo;</p>
</div>

<div class="estimate-box">
  <div class="estimate-label">Estimated Investment Range &mdash; {service_label.title()}</div>
  <div class="estimate-range">${estimate_low:,.0f} &ndash; ${estimate_high:,.0f}</div>
  <div class="estimate-sub">
    Based on approx. {sqft:,.0f} sq ft &middot; {state} market rates &middot; Subject to on-site verification
  </div>
</div>

<div class="cta">
  <div class="cta-text">Call or Text for a FREE On-Site Evaluation &mdash; No Obligation</div>
  <div class="cta-contact">{company_phone} &nbsp;&bull;&nbsp; {company_website}</div>
</div>

<p>
We have served homeowners and businesses since {established_year} and take pride in honest,
pressure-free estimates. Our crews are fully licensed, insured, and locally rooted.
We would welcome the opportunity to walk your property with you at a time that works best.
</p>

<p>
Sincerely,<br>
<strong>{company_name}</strong><br>
{company_phone} &middot; {company_website}
</p>

<div class="disclaimer">{disclaimer}</div>

</body>
</html>"""


def export_campaign_zip(properties: list[dict]) -> bytes:
    """Build a ZIP containing: addresses.csv + mailers/property_N.html per property."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # CSV
        csv_buf = io.StringIO()
        fieldnames = [
            'parcel_id', 'address', 'city', 'state', 'zip_code', 'owner_name',
            'roof', 'driveway', 'drainage', 'overall_score',
            'service_recommended', 'sqft', 'estimate_low', 'estimate_high',
            'mailer_sent', 'lob_id',
        ]
        writer = csv.DictWriter(csv_buf, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for p in properties:
            writer.writerow(p)
        zf.writestr('addresses.csv', csv_buf.getvalue())

        # Per-property HTML mailers
        for i, p in enumerate(properties, 1):
            html = p.get('mailer_html', '')
            if html:
                zf.writestr(f'mailers/property_{i:03d}_{p.get("parcel_id", i)}.html', html)

    buf.seek(0)
    return buf.read()


# ── Lob API client ────────────────────────────────────────────────────────────

LOB_LETTERS_URL = 'https://api.lob.com/v1/letters'


def send_via_lob(
    to_name: str,
    to_address: str,
    to_city: str,
    to_state: str,
    to_zip: str,
    html_content: str,
    api_key: str,
    from_name: str,
    from_address: str,
    from_city: str,
    from_state: str,
    from_zip: str,
) -> dict:
    """Send one physical letter via Lob. Returns Lob response dict."""
    payload = {
        'to': {
            'name': to_name,
            'address_line1': to_address,
            'address_city': to_city,
            'address_state': to_state,
            'address_zip': to_zip,
            'address_country': 'US',
        },
        'from': {
            'name': from_name,
            'address_line1': from_address,
            'address_city': from_city,
            'address_state': from_state,
            'address_zip': from_zip,
            'address_country': 'US',
        },
        'file': html_content,
        'color': False,
        'double_sided': False,
    }
    resp = httpx.post(
        LOB_LETTERS_URL,
        auth=(api_key, ''),
        json=payload,
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


def mock_send(parcel_id: str) -> dict:
    """Return a mock Lob letter response for demo/test mode."""
    return {
        'id': f'ltr_mock_{uuid.uuid4().hex[:12]}',
        'object': 'letter',
        'to': {'id': f'adr_mock_{parcel_id}'},
        'status': 'mock_queued',
        'carrier': 'USPS',
        'price': '$0.87',
        'estimated_delivery_date': None,
        'mock': True,
    }
