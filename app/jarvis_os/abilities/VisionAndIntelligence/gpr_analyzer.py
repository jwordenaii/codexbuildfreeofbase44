import random
import logging

logger = logging.getLogger(__name__)

class GPRAnalyzer:
    def __init__(self):
        logger.info("Initializing Subsurface GPR Engine...")
        self.anomaly_types = [
            {"label": "VOID / SUBSURFACE HOLE", "color": "#f43f5e", "r": 5, "severity": "HIGH"},
            {"label": "WATER UTILITY PIPE", "color": "#00f3ff", "r": 3, "severity": "MEDIUM"},
            {"label": "HIGH SOIL MOISTURE", "color": "#10b981", "r": 4, "severity": "LOW"},
            {"label": "BURIED CONCRETE RUBBLE", "color": "#f59e0b", "r": 4, "severity": "MEDIUM"}
        ]

    def analyze_scan(self, grid_width=500, grid_height=500):
        try:
            grid_width = int(grid_width)
            grid_height = int(grid_height)
        except (ValueError, TypeError):
            grid_width = 500
            grid_height = 500

        if grid_width <= 50: grid_width = 500
        if grid_height <= 50: grid_height = 500

        logger.info(f"Running GPR analysis pulse over {grid_width}x{grid_height} area...")
        
        # Determine number of anomalies based on grid size (simulated)
        num_anomalies = random.randint(1, 4)
        anomalies = []
        
        for _ in range(num_anomalies):
            atype = random.choice(self.anomaly_types)
            x = random.randint(20, grid_width - 40)
            y = random.randint(20, grid_height - 20)
            
            anomalies.append({
                "x": x,
                "y": y,
                "r": atype["r"],
                "color": atype["color"],
                "label": atype["label"],
                "severity": atype["severity"]
            })
            
        # Sort anomalies by Y axis so they "appear" chronologically in the top-down sweep
        anomalies = sorted(anomalies, key=lambda a: a["y"])
        
        high_severity = any(a["severity"] == "HIGH" for a in anomalies)
        
        return {
            "status": "success",
            "anomalies": anomalies,
            "requires_engineering_review": high_severity,
            "message": "GPR Sweep complete. High-risk void detected." if high_severity else "GPR Sweep complete. Nominal subsurface integrity."
        }
