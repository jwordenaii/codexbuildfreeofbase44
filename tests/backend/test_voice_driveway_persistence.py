async def test_voice_review_queue_persists_and_verifies(client, auth_headers):
    ingest_payload = {
        "project_id": "proj-123",
        "site_id": "site-123",
        "zone_id": "zone-a",
        "trade_id": "trade-paving",
        "speaker_id": "worker-7",
        "speaker_role": "foreman",
        "transcript_text": "Crew says we have a safety issue near the roller and need barriers.",
        "source": "push_to_talk",
    }

    ingest = await client.post(
        "/api/v1/voice/ambient-ingest",
        json=ingest_payload,
        headers=auth_headers,
    )
    assert ingest.status_code == 200, ingest.text
    ingest_body = ingest.json()
    assert ingest_body["status"] == "queued"
    event_id = ingest_body["event_id"]

    queue = await client.get(
        "/api/v1/voice/ops/review-queue",
        headers=auth_headers,
    )
    assert queue.status_code == 200, queue.text
    queue_body = queue.json()
    assert queue_body["queue_count"] >= 1
    found = next(
        (item for item in queue_body["queue"] if item["event_id"] == event_id), None
    )
    assert found is not None
    assert found["status"] == "pending_review"

    verify = await client.post(
        f"/api/v1/voice/ops/review-queue/{event_id}/verify",
        json={
            "status": "verified",
            "reviewed_by": "ops-supervisor",
            "review_note": "Confirmed and escalated",
        },
        headers=auth_headers,
    )
    assert verify.status_code == 200, verify.text
    verify_body = verify.json()
    assert verify_body["event"]["status"] == "verified"
    assert verify_body["event"]["reviewed_by"] == "ops-supervisor"

    verified = await client.get(
        "/api/v1/voice/ops/review-queue?status=verified",
        headers=auth_headers,
    )
    assert verified.status_code == 200, verified.text
    verified_body = verified.json()
    assert any(item["event_id"] == event_id for item in verified_body["queue"])


async def test_driveway_campaign_and_opt_in_persist(client, auth_headers):
    draft = await client.post(
        "/api/v1/driveway-growth/direct-mail/campaign-draft",
        json={
            "campaign_name": "Henrico May Batch",
            "source": "manual",
            "targets": [
                {
                    "property_id": "prop-001",
                    "address": "123 Main St",
                    "owner_name": "Owner One",
                    "mailing_address": "PO Box 1",
                    "state": "va",
                    "estimated_total_usd": 4500,
                }
            ],
        },
        headers=auth_headers,
    )
    assert draft.status_code == 200, draft.text
    draft_body = draft.json()
    assert draft_body["status"] == "ok"
    assert draft_body["piece_count"] == 1

    landing_url = draft_body["sample_landing_url"]
    token = landing_url.rsplit("/", 1)[-1]

    landing = await client.get(f"/api/v1/driveway-growth/opt-in/{token}")
    assert landing.status_code == 200, landing.text
    landing_body = landing.json()
    assert landing_body["campaign_id"] == draft_body["campaign_id"]
    assert landing_body["state"] == "VA"

    submit = await client.post(
        f"/api/v1/driveway-growth/opt-in/{token}/submit",
        json={
            "full_name": "Jane Homeowner",
            "email": "jane@example.com",
            "phone": "8045550101",
            "consent_email": True,
            "consent_sms": True,
            "consent_tcpa": True,
        },
    )
    assert submit.status_code == 200, submit.text
    submit_body = submit.json()
    assert submit_body["status"] == "ok"
    assert submit_body["property_id"] == "prop-001"
    assert submit_body["consent_sms"] is True


async def test_driveway_campaign_idempotency_replay(client, auth_headers):
    payload = {
        "campaign_name": "Idempotent Batch",
        "source": "manual",
        "targets": [
            {
                "property_id": "prop-200",
                "address": "200 Broad St",
                "owner_name": "Owner Two",
                "mailing_address": "PO Box 200",
                "state": "VA",
                "estimated_total_usd": 6800,
            }
        ],
    }

    first = await client.post(
        "/api/v1/driveway-growth/direct-mail/campaign-draft",
        json=payload,
        headers={**auth_headers, "Idempotency-Key": "campaign-abc-123"},
    )
    assert first.status_code == 200, first.text
    first_body = first.json()
    assert first_body.get("idempotent_replay") is not True

    replay = await client.post(
        "/api/v1/driveway-growth/direct-mail/campaign-draft",
        json=payload,
        headers={**auth_headers, "Idempotency-Key": "campaign-abc-123"},
    )
    assert replay.status_code == 200, replay.text
    replay_body = replay.json()
    assert replay_body["campaign_id"] == first_body["campaign_id"]
    assert replay_body["idempotent_replay"] is True


async def test_driveway_opt_in_duplicate_guardrails(client, auth_headers):
    draft = await client.post(
        "/api/v1/driveway-growth/direct-mail/campaign-draft",
        json={
            "campaign_name": "Duplicate Opt-In Batch",
            "source": "manual",
            "targets": [
                {
                    "property_id": "prop-300",
                    "address": "300 Main St",
                    "owner_name": "Owner Three",
                    "mailing_address": "PO Box 300",
                    "state": "VA",
                    "estimated_total_usd": 7200,
                }
            ],
        },
        headers=auth_headers,
    )
    assert draft.status_code == 200, draft.text
    token = draft.json()["sample_landing_url"].rsplit("/", 1)[-1]

    first_submit = await client.post(
        f"/api/v1/driveway-growth/opt-in/{token}/submit",
        json={
            "full_name": "Owner Three",
            "email": "owner3@example.com",
            "phone": "8045550300",
            "consent_email": True,
            "consent_sms": True,
            "consent_tcpa": True,
        },
        headers={"Idempotency-Key": "optin-xyz-1"},
    )
    assert first_submit.status_code == 200, first_submit.text

    replay_submit = await client.post(
        f"/api/v1/driveway-growth/opt-in/{token}/submit",
        json={
            "full_name": "Owner Three",
            "email": "owner3@example.com",
            "phone": "8045550300",
            "consent_email": True,
            "consent_sms": True,
            "consent_tcpa": True,
        },
        headers={"Idempotency-Key": "optin-xyz-1"},
    )
    assert replay_submit.status_code == 200, replay_submit.text
    assert replay_submit.json().get("idempotent_replay") is True

    conflict_submit = await client.post(
        f"/api/v1/driveway-growth/opt-in/{token}/submit",
        json={
            "full_name": "Different Owner",
            "email": "different@example.com",
            "phone": "8045550999",
            "consent_email": True,
            "consent_sms": False,
            "consent_tcpa": False,
        },
    )
    assert conflict_submit.status_code == 409
