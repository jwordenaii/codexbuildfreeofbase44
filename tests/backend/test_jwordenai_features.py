"""
test_jwordenai_features.py — Integration tests for the new JWORDENAI backend features:
  - Generative AI (layout generation + 4D simulation)
  - IoT integration (device registry + telemetry ingestion)
  - Safety AI monitor (real-time observations + alert management)
  - Workforce optimization (predictive staffing)
"""


# ── Generative AI ─────────────────────────────────────────────────────────────

async def test_generative_ai_layout(client, auth_headers):
    """POST layout job → completed with zones; GET job by id succeeds."""
    r = await client.post('/api/v1/gen-ai/layout', json={
        'project_name': 'Riverside Paving',
        'site_area_sqft': 40000,
        'num_structures': 2,
        'material_constraints': ['recycled_asphalt'],
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'completed'
    job = data['job']
    assert job['job_type'] == 'layout_generation'
    assert job['status'] == 'completed'
    output = job['output']
    assert output['total_area_sqft'] == 40000
    assert len(output['zones']) == 2
    assert 0 <= output['energy_efficiency_score'] <= 100

    # Retrieve job by id
    r2 = await client.get(f'/api/v1/gen-ai/layout/{job["id"]}', headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()['id'] == job['id']


async def test_generative_ai_layout_requires_auth(client):
    r = await client.post('/api/v1/gen-ai/layout', json={
        'project_name': 'No Auth', 'site_area_sqft': 1000, 'num_structures': 1,
    })
    assert r.status_code == 403


async def test_generative_ai_layout_missing_job_404(client, auth_headers):
    r = await client.get('/api/v1/gen-ai/layout/99999', headers=auth_headers)
    assert r.status_code == 404


async def test_generative_ai_simulation(client, auth_headers):
    """POST simulation → completed with phases and critical path."""
    r = await client.post('/api/v1/gen-ai/simulate', json={
        'project_name': 'Route 1 Expansion',
        'phases': [
            {'name': 'Site Prep', 'duration_days': 5},
            {'name': 'Base Layer', 'duration_days': 8, 'crew_size': 6, 'dependencies': ['Site Prep']},
            {'name': 'Surface Course', 'duration_days': 3},
        ],
        'risk_factors': ['weather', 'supply_chain'],
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'completed'
    output = data['job']['output']
    assert output['total_duration_days'] == 16
    assert len(output['phases']) == 3
    assert 'critical_path' in output
    assert 'recommendations' in output


async def test_generative_ai_simulation_empty_phases(client, auth_headers):
    """Simulation with empty phases list should return 422."""
    r = await client.post('/api/v1/gen-ai/simulate', json={
        'project_name': 'Empty', 'phases': [],
    }, headers=auth_headers)
    assert r.status_code == 422


async def test_generative_ai_jobs_list(client, auth_headers):
    """List endpoint returns all jobs after a few are created."""
    # Create one layout job
    await client.post('/api/v1/gen-ai/layout', json={
        'project_name': 'List Test', 'site_area_sqft': 5000, 'num_structures': 1,
    }, headers=auth_headers)

    r = await client.get('/api/v1/gen-ai/jobs', headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['total'] >= 1

    # Filter by type
    r2 = await client.get('/api/v1/gen-ai/jobs?job_type=layout_generation', headers=auth_headers)
    assert r2.status_code == 200
    for job in r2.json()['jobs']:
        assert job['job_type'] == 'layout_generation'


# ── IoT Integration ───────────────────────────────────────────────────────────

async def test_iot_device_register_and_list(client, auth_headers):
    """Register a drone device; appears in list and health summary."""
    r = await client.post('/api/v1/iot/devices', json={
        'device_id': 'drone-test-01',
        'device_type': 'drone',
        'manufacturer': 'DJI',
        'job_site': 'Broad Street',
        'meta': {'max_altitude_ft': 400},
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['result'] == 'registered'
    assert data['device_id'] == 'drone-test-01'
    assert data['device_type'] == 'drone'
    assert data['meta']['max_altitude_ft'] == 400
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


async def test_iot_telemetry_ingest_and_stream(client, auth_headers):
    """Ingest readings; they appear in device stream; fleet health reflects count."""
    # Register device first
    await client.post('/api/v1/iot/devices', json={
        'device_id': 'mixer-test-01', 'device_type': 'mixer', 'job_site': 'Main Ave',
    }, headers=auth_headers)

    # Ingest telemetry
    r = await client.post('/api/v1/iot/ingest', json={'readings': [
        {'device_id': 'mixer-test-01', 'metric': 'rpm', 'value_numeric': 1200.0, 'unit': 'rpm'},
        {'device_id': 'mixer-test-01', 'metric': 'temp_f', 'value_numeric': 325.5, 'unit': 'F'},
        {'device_id': 'mixer-test-01', 'metric': 'batch_id', 'value_text': 'BATCH-007'},
    ]}, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'ingested'
    assert data['count'] == 3

    # Stream endpoint returns readings
    r2 = await client.get('/api/v1/iot/stream/mixer-test-01', headers=auth_headers)
    assert r2.status_code == 200
    stream = r2.json()
    assert stream['device_id'] == 'mixer-test-01'
    assert stream['count'] == 3

    # Filter by metric
    r3 = await client.get('/api/v1/iot/stream/mixer-test-01?metric=rpm', headers=auth_headers)
    assert r3.status_code == 200
    assert all(rd['metric'] == 'rpm' for rd in r3.json()['readings'])


async def test_iot_fleet_health(client, auth_headers):
    """Fleet health endpoint returns device counts."""
    await client.post('/api/v1/iot/devices', json={
        'device_id': 'wearable-01', 'device_type': 'wearable', 'status': 'active',
    }, headers=auth_headers)

    r = await client.get('/api/v1/iot/health', headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert 'total_devices' in data
    assert 'by_status' in data
    assert 'by_type' in data
    assert 'readings_last_24h' in data
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
    assert r3.json()['status'] == 'deleted'

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
    return alert['id']


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
        'raw_observation': 'Test',
    }, headers=auth_headers)
    assert r.status_code == 422


async def test_safety_monitor_alerts_list_and_update(client, auth_headers):
    """Create an alert; list it; acknowledge it; resolve it."""
    # Create alert
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
    ids = [a['id'] for a in r2.json()['alerts']]
    assert alert_id in ids

    # Acknowledge
    r3 = await client.put(f'/api/v1/safety/monitor/alerts/{alert_id}', json={
        'status': 'acknowledged', 'notes': 'Crew foreman notified',
    }, headers=auth_headers)
    assert r3.status_code == 200
    assert r3.json()['alert']['status'] == 'acknowledged'

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

async def test_workforce_optimise_basic(client, auth_headers):
    """Optimise endpoint returns crew recommendation."""
    r = await client.post('/api/v1/workforce/optimize', json={
        'project_name': 'Route 1 Overlay',
        'project_size_sqft': 24000,
        'service_type': 'paving',
        'duration_days': 4,
        'required_trades': ['paving', 'flagging'],
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'ok'
    assert data['project_name'] == 'Route 1 Overlay'
    assert data['recommended_crew_size'] >= 1
    assert 'recommendations' in data
    assert 'fatigue_risk' in data


async def test_workforce_optimise_with_members(client, auth_headers):
    """Available workforce members are included in the optimised crew."""
    # Add workforce members
    for i, trade in enumerate(['paving', 'flagging', 'paving'], 1):
        await client.post('/api/v1/workforce', json={
            'name': f'Worker {i}', 'member_type': 'employee',
            'trade': trade, 'available': 1,
        }, headers=auth_headers)

    r = await client.post('/api/v1/workforce/optimize', json={
        'project_name': 'Crew Match Test',
        'project_size_sqft': 12000,
        'service_type': 'paving',
        'duration_days': 2,
        'required_trades': ['paving'],
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['status'] == 'ok'
    # Matched members should be paving-trade workers
    for member in data.get('matched_members', []):
        assert member['trade'] == 'paving'


async def test_workforce_optimise_validation(client, auth_headers):
    """Invalid inputs return 422 or error."""
    r = await client.post('/api/v1/workforce/optimize', json={
        'project_name': 'Bad', 'project_size_sqft': -100,
        'service_type': 'paving', 'duration_days': 1,
    }, headers=auth_headers)
    assert r.status_code == 422
