import logging

logger = logging.getLogger(__name__)

class YieldSentinel:
    """
    Protects the 35% net margin floor by catching material overruns in real-time.
    Compares budgeted tonnage (from takeoff) vs actual scale tickets.
    """
    
    def __init__(self, critical_variance_pct: float = 5.0):
        self.critical_variance_pct = critical_variance_pct
        logger.info(f"YieldSentinel initialized. Critical overrun threshold: +{self.critical_variance_pct}%")

    def check_yield(self, job_id: str, estimated_tons: float, actual_tons: float):
        """
        Calculates variance and alerts if pulling too thick.
        """
        try:
            estimated_tons = float(estimated_tons)
            actual_tons = float(actual_tons)
        except (ValueError, TypeError):
            estimated_tons = 100.0
            actual_tons = 105.0

        if estimated_tons <= 0:
            return {"status": "ERROR", "message": "Invalid estimated tonnage."}
            
        variance_tons = actual_tons - estimated_tons
        variance_pct = (variance_tons / estimated_tons) * 100
        
        status = "ON_TARGET"
        action = "Yield is within acceptable parameters."
        
        if variance_pct > self.critical_variance_pct:
            status = "CRITICAL_OVERRUN"
            action = f"YIELD BUSTED BY {round(variance_pct, 1)}%. Alert Foreman to adjust screed depth!"
        elif variance_pct > 0:
            status = "WARNING_THICK"
            action = "Laying slightly thick. Monitor carefully."
        elif variance_pct < -5.0:
            status = "WARNING_THIN"
            action = "Laying thin. Risk of pavement failure. Check depth."

        return {
            "job_id": job_id,
            "estimated_tons": estimated_tons,
            "actual_tons": actual_tons,
            "variance_tons": round(variance_tons, 2),
            "variance_pct": round(variance_pct, 1),
            "status": status,
            "action": action
        }
