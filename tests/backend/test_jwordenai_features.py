"""
test_jwordenai_features.py — Integration tests for the JWORDENAI backend features:
  - Generative AI  (layout generation + 4D sequencing)
  - IoT integration (device registry + telemetry ingestion)
  - Safety AI monitor (field observation classification + alert management)
  - Workforce optimization (predictive staffing)

Paths match the production router prefixes:
  /api/v1/generative-ai/…   /api/v1/iot/…
  /api/v1/safety/…          /api/v1/workforce/…
"""

# ── Generative AI ─────────────────────────────────────────────────────────────

async def test_generative_ai_layout(client, auth_headers):
    """POST layout job → done with result; GET job by id succeeds."""
    r = await client.post('/api/v1/generative-ai/layout', json={
        'job_site': 'Riverside Paving',
        'area_sqft': 40000,
        'constraints': {'min_passes': 2, 'material': 'asphalt'},
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'done'
    assert 'job_id' in data
    result = data['result']
    assert result['optimized_area_sqft'] == 40000
    assert len(result['layout_zones']) == 3
    assert 0 <= result['energy_efficiency_score'] <= 100

    # Retrieve job by id
    job_id = data['job_id']
    r2 = await client.get(f'/api/v1/generative-ai/jobs/{job_id}', headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()['id'] == job_id


async def test_generative_ai_layout_requires_auth(client):
    r = await client.post('/api/v1/generative-ai/layout', json={
        'job_site': 'No Auth', 'area_sqft': 1000,
    })
    assert r.status_code == 403


async def test_generative_ai_layout_missing_job_404(client, auth_headers):
    r = await client.get('/api/v1/generative-ai/jobs/99999', headers=auth_headers)
    assert r.status_code == 404


async def test_generative_ai_sequencing(client, auth_headers):
    """POST sequencing → done with schedule and total_days."""
    r = await client.post('/api/v1/generative-ai/sequencing', json={
        'job_site': 'Route 1 Expansion',
        'phases': ['Site Prep', 'Base Layer', 'Surface Course'],
        'crew_size': 6,
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'done'
    result = data['result']
    assert result['total_days'] >= 1
    assert len(result['schedule']) == 3
    assert 'risk_summary' in result


async def test_generative_ai_jobs_list(client, auth_headers):
    """List endpoint returns jobs after some are created."""
    await client.post('/api/v1/generative-ai/layout', json={
        'job_site': 'List Test', 'area_sqft': 5000,
    }, headers=auth_headers)

    r = await client.get('/api/v1/generative-ai/jobs', headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['total'] >= 1
    assert isinstance(data['jobs'], list)

    # Filter by type
    r2 = await client.get('/api/v1/generative-ai/jobs?job_type=layout', headers=auth_headers)
    assert r2.status_code == 200
    for job in r2.json()['jobs']:
        assert job['job_type'] == 'layout'


# ── IoT Integration ───────────────────────────────────────────────────────────

async def test_iot_device_register_and_list(client, auth_headers):
    """Register a drone device; appears in list."""
    r = await client.post('/api/v1/iot/devices', json={
        'device_id': 'drone-test-01',
        'device_type': 'drone',
        'label': 'Site Survey Drone',
        'job_site': 'Broad Street',
        'meta': '{"max_altitude_ft": 400}',
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['result'] == 'registered'
    assert data['device_id'] == 'drone-test-01'
    assert data['device_type'] == 'drone'
    device_db_id = data['id']

    # List devices
    r2 = await client.get('/api/v1/iot/devices', headers=auth_headers)
    assert r2.status_code == 200
    assert any(d['device_id'] == 'drone-test-01' for d in r2.json()['devices'])

    # Filter by type
    r3 = await client.get('/api/v1/iot/devices?device_type=drone', headers=auth_headers)
    assert r3.status_code == 200
    assert all(d['device_type'] == 'drone' for d in r3.json()['devices'])

    # Duplicate registration should 409
    r4 = await client.post('/api/v1/iot/devices', json={
        'device_id': 'drone-test-01', 'device_type': 'drone',
    }, headers=auth_headers)
    assert r4.status_code == 409

    return device_db_id


async def test_iot_device_invalid_type(client, auth_headers):
    r = await client.post('/api/v1/iot/devices', json={
        'device_id': 'bad-device', 'device_type': 'spaceship',
    }, headers=auth_headers)
    assert r.status_code == 422


async def test_iot_telemetry_batch_and_query(client, auth_headers):
    """Batch-ingest readings; they appear in the readings query endpoint."""
    await client.post('/api/v1/iot/devices', json={
        'device_id': 'mixer-test-01', 'device_type': 'mixer', 'job_site': 'Main Ave',
    }, headers=auth_headers)

    # Batch ingest
    r = await client.post('/api/v1/iot/readings/batch', json=[
        {'device_id': 'mixer-test-01', 'metric': 'rpm',    'value': '1200', 'unit': 'rpm'},
        {'device_id': 'mixer-test-01', 'metric': 'temp_f', 'value': '325',  'unit': 'F'},
        {'device_id': 'mixer-test-01', 'metric': 'batch',  'value': 'B007', 'unit': ''},
    ], headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'ingested'
    assert data['count'] == 3

    # Query readings for this device
    r2 = await client.get('/api/v1/iot/readings?device_id=mixer-test-01', headers=auth_headers)
    assert r2.status_code == 200
    readings = r2.json()['readings']
    assert len(readings) == 3

    # Filter by metric
    r3 = await client.get('/api/v1/iot/readings?device_id=mixer-test-01&metric=rpm',
                          headers=auth_headers)
    assert r3.status_code == 200
    assert all(rd['metric'] == 'rpm' for rd in r3.json()['readings'])


async def test_iot_fleet_summary(client, auth_headers):
    """Fleet summary endpoint returns device counts."""
    await client.post('/api/v1/iot/devices', json={
        'device_id': 'wearable-01', 'device_type': 'wearable', 'status': 'active',
    }, headers=auth_headers)

    r = await client.get('/api/v1/iot/summary', headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert 'total_devices' in data
    assert 'by_type' in data
    assert data['total_devices'] >= 1


async def test_iot_device_update_and_delete(client, auth_headers):
    """Update a device's job_site; then delete it."""
    r = await client.post('/api/v1/iot/devices', json={
        'device_id': 'sensor-del-01', 'device_type': 'sensor',
    }, headers=auth_headers)
    device_db_id = r.json()['id']

    # Update
    r2 = await client.put(f'/api/v1/iot/devices/{device_db_id}', json={
        'job_site': 'Updated Site', 'status': 'maintenance',
    }, headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()['job_site'] == 'Updated Site'
    assert r2.json()['status'] == 'maintenance'

    # Delete
    r3 = await client.delete(f'/api/v1/iot/devices/{device_db_id}', headers=auth_headers)
    assert r3.status_code == 200
    assert r3.json()['result'] == 'deleted'

    # Confirm gone
    r4 = await client.delete(f'/api/v1/iot/devices/{device_db_id}', headers=auth_headers)
    assert r4.status_code == 404


# ── Safety AI Monitor ─────────────────────────────────────────────────────────

async def test_safety_monitor_ppe_violation(client, auth_headers):
    """PPE-related observation → high-severity alert created."""
    r = await client.post('/api/v1/safety/monitor', json={
        'job_site': 'Downtown Project',
        'source': 'camera',
        'source_device_id': 'cam-001',
        'raw_observation': 'Worker spotted with no helmet and no hard hat near the excavation zone',
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'alert_created'
    alert = data['alert']
    assert alert['alert_type'] == 'ppe_violation'
    assert alert['severity'] == 'high'
    assert alert['status'] == 'open'
    assert alert['source'] == 'camera'
    assert 0 < alert['ai_confidence'] <= 1.0


async def test_safety_monitor_hazard_detection(client, auth_headers):
    """Hazard keywords in observation → critical alert."""
    r = await client.post('/api/v1/safety/monitor', json={
        'job_site': 'Bridge Site', 'source': 'drone',
        'raw_observation': 'Potential fall risk detected at the edge of the structure collapse area',
    }, headers=auth_headers)
    assert r.status_code == 200
    alert = r.json()['alert']
    assert alert['alert_type'] == 'hazard'
    assert alert['severity'] == 'critical'


async def test_safety_monitor_invalid_source(client, auth_headers):
    r = await client.post('/api/v1/safety/monitor', json={
        'job_site': 'Site', 'source': 'satellite',
        'raw_observation': 'Test observation',
    }, headers=auth_headers)
    assert r.status_code == 422


async def test_safety_monitor_alerts_list_and_update(client, auth_headers):
    """Create an alert; list it; acknowledge it; resolve it."""
    r = await client.post('/api/v1/safety/monitor', json={
        'job_site': 'Warehouse', 'source': 'manual',
        'raw_observation': 'Equipment failure reported on paver unit',
    }, headers=auth_headers)
    assert r.status_code == 200
    alert_id = r.json()['alert']['id']

    # List alerts
    r2 = await client.get('/api/v1/safety/monitor/alerts', headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()['total'] >= 1
    assert alert_id in [a['id'] for a in r2.json()['alerts']]

    # Acknowledge
    r3 = await client.put(f'/api/v1/safety/monitor/alerts/{alert_id}', json={
        'status': 'acknowledged', 'notes': 'Crew foreman notified',
    }, headers=auth_headers)
    assert r3.status_code == 200
    assert r3.json()['alert']['status'] == 'acknowledged'
    assert r3.json()['alert']['notes'] == 'Crew foreman notified'

    # Resolve
    r4 = await client.put(f'/api/v1/safety/monitor/alerts/{alert_id}', json={
        'status': 'resolved',
    }, headers=auth_headers)
    assert r4.status_code == 200
    assert r4.json()['alert']['status'] == 'resolved'
    assert r4.json()['alert']['resolved_at'] is not None

    # 404 for missing alert
    r5 = await client.put('/api/v1/safety/monitor/alerts/99999', json={
        'status': 'resolved',
    }, headers=auth_headers)
    assert r5.status_code == 404


# ── Workforce Optimisation ────────────────────────────────────────────────────

async def test_workforce_predictive_staffing_basic(client, auth_headers):
    """Predictive staffing endpoint returns crew recommendations."""
    r = await client.post('/api/v1/workforce/predictive-staffing', json={
        'project_name': 'Route 1 Overlay',
        'project_area_sqft': 24000,
        'project_type': 'commercial',
        'project_duration_days': 4,
        'required_trades': ['paving', 'flagging'],
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'ok'
    assert data['project_name'] == 'Route 1 Overlay'
    assert data['recommended_crew_size'] >= 1
    assert 'recommendations' in data
    assert 'fatigue_risk' in data


async def test_workforce_predictive_staffing_with_members(client, auth_headers):
    """Available workforce members are matched to the required trades."""
    for i, trade in enumerate(['paving', 'flagging', 'paving'], 1):
        await client.post('/api/v1/workforce', json={
            'name': f'Worker {i}', 'member_type': 'employee',
            'trade': trade, 'available': 1,
        }, headers=auth_headers)

    r = await client.post('/api/v1/workforce/predictive-staffing', json={
        'project_name': 'Crew Match Test',
        'project_area_sqft': 12000,
        'project_type': 'residential',
        'project_duration_days': 2,
        'required_trades': ['paving'],
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'ok'
    for rec in data.get('recommendations', []):
        if rec['trade'] == 'paving':
            for member in rec.get('assigned_members', []):
                assert 'paving' in (member.get('trade') or '').lower()


async def test_workforce_predictive_staffing_validation(client, auth_headers):
    """Negative sqft should return 422."""
    r = await client.post('/api/v1/workforce/predictive-staffing', json={
        'project_name': 'Bad', 'project_area_sqft': -100,
        'project_type': 'commercial', 'project_duration_days': 1,
        'required_trades': ['paving'],
    }, headers=auth_headers)
    assert r.status_code == 422
