import logging
import random

logger = logging.getLogger(__name__)

class FleetAcousticGuardian:
    """
    Simulates AI acoustic & vibration analysis for heavy paving equipment.
    Detects cavitation in hydraulic pumps or bearing whine in vibratory rollers.
    """
    
    def __init__(self):
        logger.info("FleetAcousticGuardian initialized. Listening for IoT telemetry anomalies.")

    def analyze_telemetry(self, equipment_id: str, equipment_type: str, vibration_hz: float, hydraulic_psi: float):
        """
        Analyzes live equipment sensor data for anomalies.
        """
        status = "HEALTHY"
        recommendation = "No action required."
        anomaly_score = 0.0

        if equipment_type.upper() == "ROLLER":
            if vibration_hz > 3500:
                status = "BEARING_WHINE_DETECTED"
                recommendation = "Schedule eccentric bearing lubrication immediately."
                anomaly_score = min(1.0, (vibration_hz - 3000) / 1000)
        elif equipment_type.upper() == "PAVER":
            if hydraulic_psi < 2500 and hydraulic_psi > 0: # Drop in pressure
                status = "CAVITATION_RISK"
                recommendation = "Check hydraulic fluid levels on screed extensions."
                anomaly_score = min(1.0, (3000 - hydraulic_psi) / 1000)
                
        # Inject random micro-anomalies for realism if healthy
        if status == "HEALTHY" and random.random() > 0.95:
            status = "MICRO_ANOMALY"
            recommendation = "Monitor. Normal wear variance detected."
            anomaly_score = round(random.uniform(0.1, 0.3), 2)

        return {
            "equipment_id": equipment_id,
            "equipment_type": equipment_type,
            "status": status,
            "anomaly_score": round(anomaly_score, 2),
            "recommendation": recommendation
        }
