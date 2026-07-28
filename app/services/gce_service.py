"""
gce_service.py — Google Compute Engine Orchestrator for Jarvis OS
Enables autonomous cloud VM provisioning for heavy AI workloads, LiDAR processing, and 4K video rendering.
"""

import os
import logging
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

def get_compute_client():
    """
    Initializes Google Compute Engine client using Service Account or ADC.
    """
    try:
        from googleapiclient import discovery
        from google.auth import default
        
        credentials, project_id = default()
        service = discovery.build('compute', 'v1', credentials=credentials)
        return service, project_id
    except Exception as e:
        logger.warning(f"GCE Client init fallback: {e}")
        return None, None

def list_gce_instances(zone: str = "us-central1-a") -> List[Dict]:
    """
    Lists active Compute Engine virtual machines.
    """
    service, project_id = get_compute_client()
    if not service or not project_id:
        return []
        
    try:
        request = service.instances().list(project=project_id, zone=zone)
        response = request.execute()
        return response.get('items', [])
    except Exception as e:
        logger.error(f"Failed to list GCE instances: {e}")
        return []
