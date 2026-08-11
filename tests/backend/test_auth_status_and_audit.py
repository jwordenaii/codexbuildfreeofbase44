async def test_auth_status_defaults_to_required(client):
    res = await client.get("/api/v1/auth/status")
    assert res.status_code == 200
    body = res.json()
    assert body["auth_required"] is True
    assert body["auth_mode"] == "required"
    # This used to assert "/.netlify/functions/get-token", pinning a value that
    # was wrong in production: the frontend runs on Vercel, where that path is
    # not a function and POSTing it returns 405, so the client's token
    # bootstrap threw on every cold start. There is deliberately no
    # unauthenticated bootstrap endpoint on this backend, so null is the honest
    # answer and the client falls through to PIN login.
    assert body["token_endpoint"] is None


async def test_auth_status_token_endpoint_is_overridable(client, monkeypatch):
    """A deployment that really does run a bootstrap shim can still declare it."""
    monkeypatch.setenv("AUTH_TOKEN_ENDPOINT", "/api/internal/bootstrap")
    res = await client.get("/api/v1/auth/status")
    assert res.json()["token_endpoint"] == "/api/internal/bootstrap"


async def test_token_issuance_writes_audit_event(client, app_modules):
    _, dbmod = app_modules

    token_res = await client.post(
        "/api/v1/auth/token",
        headers={"Authorization": "Bearer test-master-key-for-ci-use-only-not-prod"},
    )
    assert token_res.status_code == 200
    body = token_res.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"

    from app.models import AuditEvent

    with dbmod.SessionLocal() as db:
        event = (
            db.query(AuditEvent)
            .filter(AuditEvent.event_type == "auth.token_issued")
            .order_by(AuditEvent.id.desc())
            .first()
        )
        assert event is not None
        assert event.entity_type == "auth_token"
        assert event.summary


async def test_token_issuance_accepts_basic_admin_credentials(client):
    import base64

    creds = base64.b64encode(b"admin:test-admin-password").decode("ascii")
    token_res = await client.post(
        "/api/v1/auth/token",
        headers={"Authorization": f"Basic {creds}"},
    )
    assert token_res.status_code == 200
    body = token_res.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


async def test_pin_token_issuance_writes_audit_event(client, app_modules):
    _, dbmod = app_modules

    rejected = await client.post("/api/v1/auth/pin-token", json={"pin": "0000"})
    assert rejected.status_code == 403

    token_res = await client.post("/api/v1/auth/pin-token", json={"pin": "1234"})
    assert token_res.status_code == 200
    body = token_res.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"

    from app.models import AuditEvent

    with dbmod.SessionLocal() as db:
        event = (
            db.query(AuditEvent)
            .filter(AuditEvent.event_type == "auth.pin_token_issued")
            .order_by(AuditEvent.id.desc())
            .first()
        )
        assert event is not None
        assert event.entity_type == "auth_token"


async def test_quote_submission_writes_audit_event(client, app_modules):
    _, dbmod = app_modules

    res = await client.post(
        "/api/v1/leads/quote",
        json={
            "name": "Audit Lead",
            "email": "audit@example.com",
            "phone": "5551234567",
            "service_type": "paving",
            "property_type": "residential",
            "urgency": "within_1_week",
            "project_size_sqft": 1500,
            "address": "123 Main St",
            "message": "Audit test",
        },
    )
    assert res.status_code == 200

    from app.models import AuditEvent

    with dbmod.SessionLocal() as db:
        event = (
            db.query(AuditEvent)
            .filter(AuditEvent.event_type == "lead.quote_submitted")
            .order_by(AuditEvent.id.desc())
            .first()
        )
        assert event is not None
        assert event.entity_type == "lead"
        assert event.actor_type == "customer"


async def test_operations_lifecycle_and_audit_feed(client, auth_headers):
    lead_res = await client.post(
        "/api/v1/leads/quote",
        json={
            "name": "Ops Lead",
            "email": "ops@example.com",
            "phone": "5559991234",
            "service_type": "parking_lot",
            "property_type": "commercial",
            "urgency": "within_30_days",
            "project_size_sqft": 12000,
            "address": "500 Commerce Rd",
            "message": "Need a phased milling and overlay estimate.",
        },
    )
    assert lead_res.status_code == 200
    lead_id = lead_res.json()["lead_id"]

    estimate_res = await client.post(
        "/api/v1/operations/estimates/from-lead",
        headers=auth_headers,
        json={"lead_id": lead_id, "scope_summary": "Phase 1 mill and overlay"},
    )
    assert estimate_res.status_code == 200
    estimate = estimate_res.json()
    assert estimate["lead_id"] == lead_id
    assert estimate["estimate_number"].startswith("EST-")

    job_res = await client.post(
        "/api/v1/operations/jobs/from-estimate",
        headers=auth_headers,
        json={"estimate_id": estimate["id"], "name": "Commerce Road Phase 1"},
    )
    assert job_res.status_code == 200
    job = job_res.json()
    assert job["estimate_id"] == estimate["id"]
    assert job["job_number"].startswith("JOB-")

    work_order_res = await client.post(
        "/api/v1/operations/work-orders",
        headers=auth_headers,
        json={
            "job_id": job["id"],
            "title": "Crew mobilization and traffic control",
            "assigned_crew": "Crew A",
        },
    )
    assert work_order_res.status_code == 200
    work_order = work_order_res.json()
    assert work_order["job_id"] == job["id"]
    assert work_order["work_order_number"].startswith("WO-")

    audit_res = await client.get(
        "/api/v1/admin/audit/events?entity_type=job", headers=auth_headers
    )
    assert audit_res.status_code == 200
    payload = audit_res.json()
    assert payload["total"] >= 1
    assert any(event["event_type"] == "job.created" for event in payload["events"])


async def test_recent_operations_leads_and_admin_audit_page(client, auth_headers):
    lead_res = await client.post(
        "/api/v1/leads/quote",
        json={
            "name": "Admin Audit Lead",
            "email": "admin-audit@example.com",
            "phone": "5552223333",
            "service_type": "driveway",
            "property_type": "residential",
            "urgency": "within_2_weeks",
            "project_size_sqft": 1800,
            "address": "10 Audit Lane",
            "message": "Need driveway replacement.",
        },
    )
    assert lead_res.status_code == 200

    recent_res = await client.get(
        "/api/v1/operations/leads/recent?limit=5", headers=auth_headers
    )
    assert recent_res.status_code == 200
    recent_payload = recent_res.json()
    assert recent_payload["total"] >= 1
    assert any(lead["name"] == "Admin Audit Lead" for lead in recent_payload["leads"])

    page_res = await client.get("/admin/audit?pin=1234")
    assert page_res.status_code == 200
    assert "Audit Feed" in page_res.text


async def test_job_progress_and_project_documents_persist(client, auth_headers):
    lead_res = await client.post(
        "/api/v1/leads/quote",
        json={
            "name": "Portal Lead",
            "email": "portal@example.com",
            "phone": "5554447777",
            "service_type": "driveway",
            "property_type": "residential",
            "urgency": "within_2_weeks",
            "project_size_sqft": 2200,
            "address": "44 Progress Way",
            "message": "Customer portal test",
        },
    )
    assert lead_res.status_code == 200
    lead_id = lead_res.json()["lead_id"]

    estimate_res = await client.post(
        "/api/v1/operations/estimates/from-lead",
        headers=auth_headers,
        json={"lead_id": lead_id},
    )
    assert estimate_res.status_code == 200

    job_res = await client.post(
        "/api/v1/operations/jobs/from-estimate",
        headers=auth_headers,
        json={"estimate_id": estimate_res.json()["id"], "name": "Portal Test Job"},
    )
    assert job_res.status_code == 200
    job_id = job_res.json()["id"]

    update_res = await client.patch(
        f"/api/v1/operations/jobs/{job_id}",
        headers=auth_headers,
        json={
            "status": "in_progress",
            "progress_percent": 45,
            "progress_notes": "Base prep completed. Paving scheduled for tomorrow morning.",
        },
    )
    assert update_res.status_code == 200
    job_payload = update_res.json()
    assert job_payload["status"] == "in_progress"
    assert job_payload["progress_percent"] == 45
    assert job_payload["client_email"] == "portal@example.com"
    assert job_payload["title"] == "Portal Test Job"

    upload_res = await client.post(
        "/api/v1/operations/job-documents/upload",
        headers=auth_headers,
        files={"file": ("invoice.pdf", b"%PDF-1.4 fake invoice", "application/pdf")},
        data={
            "job_id": str(job_id),
            "client_email": "portal@example.com",
            "document_type": "invoice",
            "title": "Initial Invoice",
            "description": "Uploaded from test",
            "visible_to_client": "true",
        },
    )
    assert upload_res.status_code == 200
    document = upload_res.json()["document"]
    assert document["job_id"] == job_id
    assert document["visible_to_client"] is True
    assert document["file_url"].startswith("data:application/pdf;base64,")

    docs_res = await client.get(
        f"/api/v1/operations/job-documents?job_id={job_id}&visible_to_client=true",
        headers=auth_headers,
    )
    assert docs_res.status_code == 200
    docs_payload = docs_res.json()
    assert docs_payload["total"] == 1
    assert docs_payload["documents"][0]["title"] == "Initial Invoice"

    hide_res = await client.patch(
        f"/api/v1/operations/job-documents/{document['id']}",
        headers=auth_headers,
        json={"visible_to_client": False},
    )
    assert hide_res.status_code == 200
    assert hide_res.json()["visible_to_client"] is False

    delete_res = await client.delete(
        f"/api/v1/operations/job-documents/{document['id']}",
        headers=auth_headers,
    )
    assert delete_res.status_code == 200
    assert delete_res.json()["status"] == "deleted"
