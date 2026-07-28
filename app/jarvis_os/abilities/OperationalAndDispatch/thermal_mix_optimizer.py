import logging
import math

logger = logging.getLogger(__name__)

class ThermalMixOptimizer:
    """
    Predicts asphalt temperature decay during transit to ensure mix arrives above 
    the minimum required temperature (250F) for 96% Marshall compaction.
    """
    
    def __init__(self, min_arrival_temp: float = 250.0):
        self.min_arrival_temp = min_arrival_temp
        logger.info(f"ThermalMixOptimizer initialized. Minimum arrival temp: {self.min_arrival_temp}°F")

    def calculate_decay(self, start_temp: float, transit_minutes: float, ambient_temp: float, wind_speed_mph: float):
        """
        Calculates projected arrival temperature.
        Basic Newton's law of cooling modified for mass and wind shear.
        """
        # A highly simplified constant for an insulated asphalt truck bed (cooling rate per minute)
        k = 0.0012 
        
        # Wind shear increases cooling rate
        wind_factor = 1.0 + (wind_speed_mph * 0.015)
        effective_k = k * wind_factor
        
        # Temp_t = Temp_env + (Temp_start - Temp_env) * e^(-kt)
        temp_decay = (start_temp - ambient_temp) * math.exp(-effective_k * transit_minutes)
        arrival_temp = ambient_temp + temp_decay
        
        status = "OPTIMAL"
        if arrival_temp < self.min_arrival_temp:
            status = "CRITICAL_COLD_MAT"
        elif arrival_temp < self.min_arrival_temp + 15:
            status = "WARNING_MARGINAL"

        return {
            "start_temp": start_temp,
            "ambient_temp": ambient_temp,
            "transit_minutes": transit_minutes,
            "projected_arrival_temp": round(arrival_temp, 1),
            "status": status,
            "margin": round(arrival_temp - self.min_arrival_temp, 1)
        }
