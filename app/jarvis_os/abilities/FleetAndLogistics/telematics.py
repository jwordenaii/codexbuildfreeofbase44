import random
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class TelematicsEngine:
    """
    Simulates real-time V2X telemetry from heavy paving fleet, 
    crew biometrics, and supply chain pricing.
    """
    def __init__(self):
        logger.info("Initializing Live Fleet Telematics Engine...")
        self.base_asphalt_price = 78.10
        self.scans_today = 24
        
        # Base fleet states
        self.fleet = [
            {"id": 101, "type": "Paver Unit", "base_pressure": 3000, "status": "ACTIVE"},
            {"id": 44, "type": "Dump Truck", "base_temp": 298, "status": "IN TRANSIT"},
            {"id": 45, "type": "Dump Truck", "base_temp": 251, "status": "ARRIVING"}
        ]
        
        # Base crew states
        self.crew = {
            "foreman": {"base_bpm": 82, "base_temp": 98.6},
            "raker": {"base_bpm": 140, "base_temp": 100.5}
        }
        
        # Paving intelligence states
        self.compaction = 98.0
        self.yield_overrun = 5.2
        self.hopper_fill = 24

    def _fluctuate(self, val, min_val, max_val, max_delta=1.0):
        new_val = val + random.uniform(-max_delta, max_delta)
        return max(min_val, min(new_val, max_val))

    def get_live_snapshot(self) -> dict:
        """Generates a fluctuating real-time snapshot of the logistics operation."""
        
        # 1. KPI Panel
        self.base_asphalt_price = self._fluctuate(self.base_asphalt_price, 75.0, 85.0, 0.5)
        # Randomly increment scans occasionally
        if random.random() > 0.95:
            self.scans_today += 1

        # 2. Fleet Routing
        live_fleet = []
        for v in self.fleet:
            if v["type"] == "Paver Unit":
                pressure = int(self._fluctuate(v["base_pressure"], 2800, 3200, 50))
                metric = f"Hydraulic Pressure: {pressure} PSI"
            else:
                temp = int(self._fluctuate(v["base_temp"], 230, 310, 3))
                v["base_temp"] = temp
                metric = f"Asphalt Temp: {temp}°F"
                if temp < 255:
                    metric += " (WARNING)"
                else:
                    metric += " (Nominal)"
                    
            live_fleet.append({
                "id": v["id"],
                "type": v["type"],
                "status": v["status"],
                "metric": metric
            })

        # 3. Crew Health
        self.crew["foreman"]["base_bpm"] = int(self._fluctuate(self.crew["foreman"]["base_bpm"], 75, 95, 3))
        self.crew["foreman"]["base_temp"] = round(self._fluctuate(self.crew["foreman"]["base_temp"], 98.0, 99.5, 0.1), 1)
        
        self.crew["raker"]["base_bpm"] = int(self._fluctuate(self.crew["raker"]["base_bpm"], 120, 165, 5))
        self.crew["raker"]["base_temp"] = round(self._fluctuate(self.crew["raker"]["base_temp"], 99.5, 102.5, 0.2), 1)
        
        raker_alert = self.crew["raker"]["base_temp"] > 101.0 or self.crew["raker"]["base_bpm"] > 150

        # 4. Paving Intelligence
        self.compaction = round(self._fluctuate(self.compaction, 94.0, 99.5, 0.2), 1)
        self.yield_overrun = round(self._fluctuate(self.yield_overrun, 0.0, 8.0, 0.3), 1)
        self.hopper_fill = int(self._fluctuate(self.hopper_fill, 10, 100, 5))

        return {
            "status": "success",
            "kpi": {
                "active_trucks": 14,
                "fuel_saved_pct": 14.5,
                "asphalt_price": round(self.base_asphalt_price, 2),
                "sam2_scans": self.scans_today
            },
            "fleet": live_fleet,
            "escrow": {
                "cleared": 14500.00,
                "locked": 42000.00
            },
            "crew": {
                "foreman": {
                    "bpm": self.crew["foreman"]["base_bpm"],
                    "temp": self.crew["foreman"]["base_temp"],
                    "alert": False
                },
                "raker": {
                    "bpm": self.crew["raker"]["base_bpm"],
                    "temp": self.crew["raker"]["base_temp"],
                    "alert": raker_alert
                }
            },
            "intelligence": {
                "compaction_pct": self.compaction,
                "yield_overrun_pct": self.yield_overrun,
                "hopper_fill_pct": self.hopper_fill,
                "weather": "Clear",
                "rain_chance": 0
            }
        }
