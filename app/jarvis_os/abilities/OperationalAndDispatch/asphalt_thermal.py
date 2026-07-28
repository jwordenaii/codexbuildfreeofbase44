import logging
from datetime import datetime
import random
import math

logger = logging.getLogger(__name__)

class AsphaltThermalEngine:
    """
    Advanced Thermodynamics Engine.
    Calculates Newtonian cooling and heat loss (ΔT) of Hot Mix Asphalt (HMA) 
    during transport based on ambient temperature, wind chill, and delay times.
    """
    def __init__(self):
        self.module_id = "asphalt_thermal"
        self.load_temp_f = 310.0  # Plant discharge temp
        self.min_laydown_temp = 250.0 # Absolute minimum for compaction
        
    def _calculate_heat_loss(self, transit_time_mins, ambient_temp_f, wind_speed_mph):
        # Simulated cooling coefficient based on Newton's Law of Cooling
        k = 0.002 + (wind_speed_mph * 0.0001)
        temp_loss = (self.load_temp_f - ambient_temp_f) * (1 - math.exp(-k * transit_time_mins))
        return self.load_temp_f - temp_loss

    def execute(self, params: dict = None) -> dict:
        transit_time = params.get("transit_time_mins", random.randint(25, 90)) if params else random.randint(25, 90)
        ambient_temp = 68.0
        wind_speed = 12.0
        
        arrival_temp = self._calculate_heat_loss(transit_time, ambient_temp, wind_speed)
        
        status = "NOMINAL"
        alert = "Asphalt will arrive within optimal compaction temperature threshold."
        
        if arrival_temp < self.min_laydown_temp:
            status = "CRITICAL_FAILURE"
            alert = f"DANGER: Transit time ({transit_time} min) will result in COLD JOINT. Arrival temp {arrival_temp:.1f}F is below {self.min_laydown_temp}F."
            
        assessment = (
            f"/// THERMODYNAMICS: ASPHALT TRANSIT MATRIX ///\\n"
            f"-> Plant Load Temp: {self.load_temp_f}F\\n"
            f"-> Ambient Weather: {ambient_temp}F, Wind {wind_speed}mph\\n"
            f"-> Est. Transit Time: {transit_time} mins\\n"
            f"-> Proj. Arrival Temp: {arrival_temp:.1f}F\\n\\n"
            f"STATUS: {status}\\n"
            f"DIRECTIVE: {alert}"
        )
        
        return {
            "status": status,
            "engine": "AsphaltThermalEngine",
            "assessment": assessment,
            "metrics": {
                "arrival_temp": round(arrival_temp, 2),
                "transit_time": transit_time
            }
        }
