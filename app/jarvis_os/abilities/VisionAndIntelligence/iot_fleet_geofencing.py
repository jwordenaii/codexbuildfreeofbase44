import logging
import random

logger = logging.getLogger(__name__)

class IotFleetGeofencingEngine:
    """
    GPS Operations AI.
    Installs a strict virtual geofence around a 500-acre job site. If a $500,000 
    articulated dump truck breaches the invisible boundary, it instantly kills the 
    engine via CAN bus to prevent theft.
    """
    def __init__(self):
        self.module_id = "iot_fleet_geofencing"
        
    def execute(self, params: dict = None) -> dict:
        asset_id = params.get("asset_id", f"VOLVO-A40G-{random.randint(10,99)}") if params else f"VOLVO-A40G-{random.randint(10,99)}"
        
        # Simulate Geofence Center (Lat/Lon) and Asset GPS
        center_lat, center_lon = 34.0522, -118.2437
        radius_meters = 2500.0 # ~500 acres
        
        # Simulate distance from center
        distance_from_center = random.uniform(500.0, 3000.0)
        
        # Telemetry
        engine_running = True
        
        if distance_from_center > radius_meters:
            status = "GEOFENCE_BREACHED"
            engine_running = False
            directive = f"DANGER: Asset {asset_id} breached the invisible perimeter by {distance_from_center - radius_meters:.0f} meters. Suspected theft. Engine killed via CAN bus override."
        else:
            status = "ASSET_SECURE"
            directive = f"Asset {asset_id} is operating {radius_meters - distance_from_center:.0f} meters inside the geofence perimeter. Tracking nominal."
            
        assessment = (
            f"/// IoT TRACKING: FLEET GEOFENCING MATRIX ///\\n"
            f"-> Asset Engaged: {asset_id}\\n"
            f"-> Geofence Radius: {radius_meters:,.0f} Meters\\n\\n"
            f"TELEMETRY MATRIX:\\n"
            f"-> Current Asset Distance from Center: {distance_from_center:,.0f} Meters\\n"
            f"-> ECM Engine Status: {'RUNNING' if engine_running else 'KILLED (LOCKDOWN)'}\\n\\n"
            f"STATUS: {status}\\n"
            f"DIRECTIVE: {directive}"
        )
        
        return {
            "status": status,
            "engine": "IotFleetGeofencingEngine",
            "assessment": assessment,
            "metrics": {
                "distance_m": round(distance_from_center, 1),
                "engine_killed": not engine_running
            }
        }
