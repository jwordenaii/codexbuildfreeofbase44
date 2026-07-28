import logging
from datetime import datetime
try:
    from app.jarvis_os.abilities.OperationalAndDispatch.foreman_ai_client import ForemanAIClient
except ImportError:
    class ForemanAIClient: pass

logger = logging.getLogger(__name__)

class AIForeman:
    """
    Autonomous Dispatch Intelligence Engine.
    Ingests live telematics and biometric data to issue critical safety 
    and operational dispatch commands.
    """
    def __init__(self):
        logger.info("Initializing AI Foreman Autonomous Dispatch Engine...")
        self.foreman_api = ForemanAIClient()
        
    def evaluate_telematics(self, telematics_snapshot=None) -> dict:
        if not isinstance(telematics_snapshot, dict):
            telematics_snapshot = {}
        issues = []
        commands = []
        
        # 1. Evaluate Crew Health
        crew = telematics_snapshot.get("crew", {})
        raker = crew.get("raker", {})
        
        if raker.get("alert", False) or raker.get("temp", 0) > 101.0 or raker.get("bpm", 0) > 150:
            issues.append("CRITICAL: Heat stroke risk detected in Raker Dave.")
            commands.append("DISPATCH: Pull Raker Dave off the line. Dispatching automated water buffalo to sector 4. Mandating 15-minute OSHA heat recovery.")
            
        foreman = crew.get("foreman", {})
        if foreman.get("bpm", 0) > 120:
            issues.append("WARNING: Foreman Jim experiencing elevated heart rate.")
            
        # 2. Evaluate Fleet Operations
        fleet = telematics_snapshot.get("fleet", [])
        for unit in fleet:
            if unit.get("type") == "Dump Truck":
                # Parse temperature from metric string e.g., "Asphalt Temp: 251°F (WARNING)"
                metric_str = unit.get("metric", "")
                if "WARNING" in metric_str and "Temp" in metric_str:
                    issues.append(f"WARNING: Dump Truck #{unit.get('id')} asphalt is cooling rapidly.")
                    commands.append(f"DISPATCH: Prioritizing Truck #{unit.get('id')} for immediate hopper discharge to prevent cold joints.")
                    
        # 3. Evaluate Paving Intelligence
        intel = telematics_snapshot.get("intelligence", {})
        if intel.get("yield_overrun_pct", 0) > 5.0:
            issues.append("WARNING: Material yield overrun detected (> 5%).")
            commands.append("DISPATCH: Command 3D Topcon screed to reduce mat thickness by 0.25 inches immediately.")
            
        # 4. Evaluate Subcontractor Schedules
        if intel.get("grading_completed_early", False):
            issues.append("UPDATE: Grading completed ahead of schedule.")
            resp = self.foreman_api.trigger_vendor_communication(
                vendor_id="VEND-CONCRETE-01", 
                message="Grading finished early. Please pull concrete pour schedule forward by 2 days."
            )
            commands.append(f"DISPATCH [Foreman AI API]: {resp.get('response')}")
            
        # Formulate final response
        if not issues:
            final_assessment = "ALL CLEAR: Paving operations proceeding at optimal efficiency. No dispatch intervention required."
            status = "nominal"
        else:
            final_assessment = "\n".join(issues) + "\n\n" + "\n".join(commands)
            status = "intervention_required"
            
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "status": status,
            "assessment": final_assessment,
            "issues_detected": len(issues),
            "commands_issued": len(commands)
        }
