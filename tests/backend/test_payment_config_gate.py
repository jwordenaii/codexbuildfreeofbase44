"""
Tests for the Stripe configuration gate on deposit checkout.

WHY THIS EXISTS
───────────────
`POST /api/v1/payments/checkout-session` builds a mock session when
STRIPE_SECRET_KEY is absent, and the mock's checkout_url points straight at
success_url. Deployed without a Stripe key, that turns "pay your deposit" into
a redirect to the thank-you page: the customer pays nothing and is told the
opposite. The transaction row is written 'pending', so the books stay honest —
the damage is entirely on the customer's side of the conversation.

The gate makes the unconfigured case answer 503 instead, while keeping the mock
available for pytest and for a developer who opts in with ALLOW_MOCK_PAYMENTS.
"""
from __future__ import annotations


def _quote_payload(**overrides):
    payload = {
        'name': 'Deposit Test',
        'email': 'deposit@example.com',
        'phone': '5551230000',
        'service_type': 'paving',
        'property_type': 'commercial',
        'urgency': 'within_1_month',
        'project_size_sqft': 5000,
        'address': '100 Deposit Way',
        'message': 'Deposit please',
    }
    payload.update(overrides)
    return payload


async def _create_lead(client, email):
    res = await client.post('/api/v1/leads/quote', json=_quote_payload(email=email))
    assert res.status_code == 200, res.text
    return res


def _lead_id(dbmod, email):
    from app.models import Lead
    with dbmod.SessionLocal() as db:
        lead = db.query(Lead).filter(Lead.email == email).first()
        assert lead is not None
        return lead.id


async def test_unconfigured_stripe_refuses_instead_of_faking_success(
    client, app_modules, auth_headers, monkeypatch
):
    """No Stripe key and no opt-in ⇒ 503, and no payment row is written."""
    _, dbmod = app_modules
    await _create_lead(client, 'refuse@example.com')
    lead_id = _lead_id(dbmod, 'refuse@example.com')

    from app.routers import payments as payments_router
    monkeypatch.delenv('STRIPE_SECRET_KEY', raising=False)
    # pytest is in sys.modules for the whole run, so the production condition
    # has to be simulated by closing the escape hatch directly.
    monkeypatch.setattr(payments_router, '_mock_payments_allowed', lambda: False)

    res = await client.post(
        '/api/v1/payments/checkout-session',
        json={'lead_id': lead_id},
        headers=auth_headers,
    )
    assert res.status_code == 503, res.text

    body = res.json()['detail']
    # The customer must not be told anything that sounds like a completed payment.
    assert 'not enabled' in body.lower()

    from app.models import PaymentTransaction
    with dbmod.SessionLocal() as db:
        rows = db.query(PaymentTransaction).filter(
            PaymentTransaction.lead_id == lead_id
        ).all()
    assert rows == [], 'a refused checkout must not leave a transaction behind'


async def test_refusal_never_hands_back_the_success_url(
    client, app_modules, auth_headers, monkeypatch
):
    """The precise regression: no response field may point at success_url."""
    _, dbmod = app_modules
    await _create_lead(client, 'nourl@example.com')
    lead_id = _lead_id(dbmod, 'nourl@example.com')

    from app.routers import payments as payments_router
    monkeypatch.delenv('STRIPE_SECRET_KEY', raising=False)
    monkeypatch.setenv('STRIPE_SUCCESS_URL', 'https://example.test/quote?payment=success')
    monkeypatch.setattr(payments_router, '_mock_payments_allowed', lambda: False)

    res = await client.post(
        '/api/v1/payments/checkout-session',
        json={'lead_id': lead_id},
        headers=auth_headers,
    )
    assert res.status_code == 503
    assert 'payment=success' not in res.text
    assert 'mock_cs_' not in res.text


async def test_opt_in_keeps_the_mock_for_local_development(
    client, app_modules, auth_headers, monkeypatch
):
    """ALLOW_MOCK_PAYMENTS=1 restores the old behavior for offline work."""
    _, dbmod = app_modules
    await _create_lead(client, 'mockok@example.com')
    lead_id = _lead_id(dbmod, 'mockok@example.com')

    monkeypatch.delenv('STRIPE_SECRET_KEY', raising=False)
    monkeypatch.setenv('ALLOW_MOCK_PAYMENTS', '1')

    res = await client.post(
        '/api/v1/payments/checkout-session',
        json={'lead_id': lead_id},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()['checkout_session_id'].startswith('mock_cs_')


def test_mock_allowed_helper_reads_the_opt_in(monkeypatch):
    """The env opt-in is parsed with the same truthy words as the rest of the app."""
    from app.routers.payments import _mock_payments_allowed
    import app.routers.payments as pmod

    # Neutralise the pytest auto-detection so the env var is what decides.
    monkeypatch.setattr(pmod.sys, 'modules', {})
    monkeypatch.delenv('PYTEST_CURRENT_TEST', raising=False)

    for truthy in ('1', 'true', 'YES', 'on'):
        monkeypatch.setenv('ALLOW_MOCK_PAYMENTS', truthy)
        assert _mock_payments_allowed() is True, truthy

    for falsy in ('', '0', 'false', 'no'):
        monkeypatch.setenv('ALLOW_MOCK_PAYMENTS', falsy)
        assert _mock_payments_allowed() is False, falsy
