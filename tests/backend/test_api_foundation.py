def _quote_payload(**overrides):
    payload = {
        'name': 'Test User',
        'email': 'test@example.com',
        'phone': '5551234567',
        'service_type': 'paving',
        'property_type': 'residential',
        'urgency': 'within_1_week',
        'project_size_sqft': 2000,
        'address': '123 Main St',
        'message': 'Need quote soon',
    }
    payload.update(overrides)
    return payload


async def test_health_route(client):
    res = await client.get('/health')
    assert res.status_code == 200
    assert res.json()['status'] == 'ok'


async def test_quote_submission_and_crm_listing(client, auth_headers):
    res = await client.post('/api/v1/leads/quote', json=_quote_payload())
    assert res.status_code == 200
    body = res.json()
    assert body['status'] == 'received'
    assert body['lead_score'] in {'HOT', 'WARM', 'COOL'}

    crm = await client.get('/api/v1/crm/leads', headers=auth_headers)
    assert crm.status_code == 200
    data = crm.json()
    assert data['total'] >= 1
    assert any(l['email'] == 'test@example.com' for l in data['leads'])


async def test_proposal_generation_flow(client, auth_headers, monkeypatch, app_modules):
    _, dbmod = app_modules

    monkeypatch.setattr('app.routers.proposals.generate_proposal_text', lambda lead: 'Mock proposal text')
    monkeypatch.setattr('app.routers.proposals.generate_proposal_pdf', lambda lead: b'%PDF-1.4 mock')

    quote = await client.post('/api/v1/leads/quote', json=_quote_payload(email='proposal@example.com'))
    assert quote.status_code == 200

    from app.models import Lead

    with dbmod.SessionLocal() as db:
        lead = db.query(Lead).filter(Lead.email == 'proposal@example.com').first()
        assert lead is not None
        lead_id = lead.id

    gen = await client.post('/api/v1/proposals/generate', json={'lead_id': lead_id, 'include_pdf': True}, headers=auth_headers)
    assert gen.status_code == 200
    data = gen.json()
    assert data['proposal_text'] == 'Mock proposal text'
    assert data['proposal_id'] == lead_id
    assert data['pdf_b64']

    status = await client.get(f'/api/v1/payments/status/{lead_id}', headers=auth_headers)
    assert status.status_code == 200
    assert status.json()['lead_id'] == lead_id
