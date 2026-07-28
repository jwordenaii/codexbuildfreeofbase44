import logging
import math
import random

logger = logging.getLogger(__name__)

# --- TRADE DECAY CONFIGURATIONS ---
TRADE_LIFE_CYCLE_CONFIGS = {
    "asphalt": {
        "name": "Asphalt Paving & Sealcoating",
        "unit": "SQFT",
        "default_size": 50000.0,
        "unmaintained_base_years": 11.0,
        "maintained_lifespan_years": 25.0,
        "deferred_rebuild_cost_per_unit": 6.50,
        "routine_maint_cost_per_unit": 0.55,
        "routine_maint_freq_years": 3,
        "major_preservation_cost_per_unit": 1.85,
        "major_preservation_freq_years": 10,
        "routine_label": "Sealcoat & Rubberized Crack Injection",
        "major_label": "Micro-Mill & Heavy Polymer Overlay"
    },
    "concrete": {
        "name": "Concrete Flatwork & Foundations",
        "unit": "SQFT",
        "default_size": 25000.0,
        "unmaintained_base_years": 15.0,
        "maintained_lifespan_years": 35.0,
        "deferred_rebuild_cost_per_unit": 12.00,
        "routine_maint_cost_per_unit": 0.85,
        "routine_maint_freq_years": 5,
        "major_preservation_cost_per_unit": 3.20,
        "major_preservation_freq_years": 15,
        "routine_label": "Penetrating Silane Sealer & Joint Caulking",
        "major_label": "Slab Lifting & Epoxy Injection"
    },
    "roofing": {
        "name": "Commercial Roofing (TPO/EPDM/Metal)",
        "unit": "SQFT",
        "default_size": 30000.0,
        "unmaintained_base_years": 12.0,
        "maintained_lifespan_years": 30.0,
        "deferred_rebuild_cost_per_unit": 9.50,
        "routine_maint_cost_per_unit": 0.40,
        "routine_maint_freq_years": 2,
        "major_preservation_cost_per_unit": 2.50,
        "major_preservation_freq_years": 10,
        "routine_label": "Flashing & Seam Maintenance Inspection",
        "major_label": "High-Solid Silicone Elastomeric Coating"
    },
    "hvac": {
        "name": "HVAC & Mechanical Systems",
        "unit": "TONS",
        "default_size": 40.0,
        "unmaintained_base_years": 10.0,
        "maintained_lifespan_years": 20.0,
        "deferred_rebuild_cost_per_unit": 4500.00,
        "routine_maint_cost_per_unit": 220.00,
        "routine_maint_freq_years": 1,
        "major_preservation_cost_per_unit": 950.00,
        "major_preservation_freq_years": 7,
        "routine_label": "Coil Wash, Belt & Refrigerant Optimization",
        "major_label": "Compressor & Blower Overhaul"
    },
    "painting": {
        "name": "Exterior Painting & Building Envelope",
        "unit": "SQFT",
        "default_size": 20000.0,
        "unmaintained_base_years": 7.0,
        "maintained_lifespan_years": 25.0,
        "deferred_rebuild_cost_per_unit": 4.50,
        "routine_maint_cost_per_unit": 0.60,
        "routine_maint_freq_years": 4,
        "major_preservation_cost_per_unit": 1.75,
        "major_preservation_freq_years": 10,
        "routine_label": "Power Wash & Touch-up Sealant",
        "major_label": "Commercial Elastomeric Coating Recoat"
    },
    "decking": {
        "name": "Wood & Composite Decking/Structures",
        "unit": "SQFT",
        "default_size": 5000.0,
        "unmaintained_base_years": 9.0,
        "maintained_lifespan_years": 25.0,
        "deferred_rebuild_cost_per_unit": 28.00,
        "routine_maint_cost_per_unit": 2.50,
        "routine_maint_freq_years": 2,
        "major_preservation_cost_per_unit": 6.00,
        "major_preservation_freq_years": 8,
        "routine_label": "Deep Clean, Stain & Water Repellent Treatment",
        "major_label": "Board Replacement & Structural Tightening"
    },
    "pipelining": {
        "name": "Pipelining & Underground Utilities",
        "unit": "LF", # Linear Feet
        "default_size": 1500.0,
        "unmaintained_base_years": 15.0,
        "maintained_lifespan_years": 50.0,
        "deferred_rebuild_cost_per_unit": 140.00,
        "routine_maint_cost_per_unit": 8.00,
        "routine_maint_freq_years": 3,
        "major_preservation_cost_per_unit": 45.00,
        "major_preservation_freq_years": 15,
        "routine_label": "Hydro-Jetting & Acoustic Video Inspection",
        "major_label": "CIPP Trenchless Epoxy Pipe Relining"
    },
    "solar_electrical": {
        "name": "Solar Array & High-Voltage Electrical",
        "unit": "KW",
        "default_size": 250.0,
        "unmaintained_base_years": 12.0,
        "maintained_lifespan_years": 30.0,
        "deferred_rebuild_cost_per_unit": 2200.00,
        "routine_maint_cost_per_unit": 85.00,
        "routine_maint_freq_years": 1,
        "major_preservation_cost_per_unit": 450.00,
        "major_preservation_freq_years": 10,
        "routine_label": "Thermal Imaging, Panel Wash & Wire Retension",
        "major_label": "Inverter Component Recalibration & Swaps"
    }
}


class AgeDecaySimulatorEngine:
    """
    Universal Trade Predictive ML Lifecycle Simulation Engine.
    Models oxidation, environmental degradation, and financial ROI 
    comparing Proper Maintenance vs Deferred Maintenance across 8 specialized trades.
    """
    def __init__(self):
        self.module_id = "age_decay_simulator"
        self.supported_trades = list(TRADE_LIFE_CYCLE_CONFIGS.keys())
        
    def execute(self, params: dict = None) -> dict:
        params = params or {}
        
        # Determine trade (default to asphalt)
        raw_trade = (params.get("trade") or params.get("trade_type") or "asphalt").lower()
        trade_key = next((t for t in self.supported_trades if t in raw_trade), "asphalt")
        cfg = TRADE_LIFE_CYCLE_CONFIGS[trade_key]

        # Extract footprint size
        try:
            size_units = float(params.get("size") or params.get("sqft") or params.get("units") or cfg["default_size"])
        except (ValueError, TypeError):
            size_units = cfg["default_size"]

        # Environmental & Load Multiplier
        try:
            stress_level = int(params.get("stress_level") or params.get("uv_index") or random.randint(5, 8))
        except (ValueError, TypeError):
            stress_level = 6

        decay_multiplier = 1.0 + (stress_level * 0.04)

        # --- 1. UNMAINTAINED (DEFERRED CARE TRACK) ---
        unmaintained_crack_years = round((cfg["unmaintained_base_years"] * 0.5) / decay_multiplier, 1)
        unmaintained_failure_years = round(cfg["unmaintained_base_years"] / decay_multiplier, 1)
        
        rebuild_cost_single = size_units * cfg["deferred_rebuild_cost_per_unit"]
        analysis_window_years = 25.0 if trade_key != "pipelining" else 50.0
        
        rebuild_cycles = math.ceil(analysis_window_years / max(unmaintained_failure_years, 5.0))
        total_unmaintained_cost = rebuild_cycles * rebuild_cost_single
        annual_unmaintained_cost_per_unit = total_unmaintained_cost / (size_units * analysis_window_years)

        # --- 2. PREVENTIVE MAINTENANCE TRACK ---
        maintained_lifespan_years = round(cfg["maintained_lifespan_years"] / math.sqrt(decay_multiplier), 1)
        
        routine_count = math.floor(analysis_window_years / cfg["routine_maint_freq_years"])
        major_count = math.floor(analysis_window_years / cfg["major_preservation_freq_years"])
        
        total_routine_cost = size_units * cfg["routine_maint_cost_per_unit"] * routine_count
        total_major_cost = size_units * cfg["major_preservation_cost_per_unit"] * major_count
        
        total_maintained_cost = total_routine_cost + total_major_cost
        annual_maintained_cost_per_unit = total_maintained_cost / (size_units * analysis_window_years)

        # --- 3. ROI & SAVINGS ---
        net_savings = total_unmaintained_cost - total_maintained_cost
        savings_pct = round((net_savings / total_unmaintained_cost) * 100, 1) if total_unmaintained_cost > 0 else 0.0

        assessment = (
            f"/// ML PREDICTIVE DECAY & LIFE-CYCLE SIMULATOR [{cfg['name'].upper()}] ///\n"
            f"-> Asset Size: {size_units:,.0f} {cfg['unit']} | Stress Factor: {decay_multiplier:.2f}x\n"
            f"-> Analysis Time Horizon: {int(analysis_window_years)} Years\n\n"
            f"[DEFERRED / NO MAINTENANCE TRACK]:\n"
            f"  * Initial Degradation Manifested: Year {unmaintained_crack_years}\n"
            f"  * Critical Structural Failure: Year {unmaintained_failure_years}\n"
            f"  * Full Rebuild Cycles Required: {rebuild_cycles} Rebuild(s)\n"
            f"  * {int(analysis_window_years)}-Year Total Expenditure: ${total_unmaintained_cost:,.2f} (${annual_unmaintained_cost_per_unit:,.2f}/{cfg['unit']}/yr)\n\n"
            f"[PREVENTIVE MAINTENANCE TRACK]:\n"
            f"  * Extended Asset Lifespan: {maintained_lifespan_years} Years\n"
            f"  * Routine Protocol ({cfg['routine_label']}): Every {cfg['routine_maint_freq_years']} Yrs ({routine_count}x)\n"
            f"  * Major Preservation ({cfg['major_label']}): Every {cfg['major_preservation_freq_years']} Yrs ({major_count}x)\n"
            f"  * {int(analysis_window_years)}-Year Total Maintenance Spend: ${total_maintained_cost:,.2f} (${annual_maintained_cost_per_unit:,.2f}/{cfg['unit']}/yr)\n\n"
            f"[FINANCIAL ROI & ASSET PRESERVATION]:\n"
            f"  * Net Lifetime Capital Savings: ${net_savings:,.2f}\n"
            f"  * Total Lifecycle Cost Reduction: {savings_pct}%\n"
            f"  * Recommended Action: Schedule initial {cfg['routine_label']} by Year {math.floor(unmaintained_crack_years)}."
        )

        return {
            "status": "SIMULATION_COMPLETE",
            "trade": trade_key,
            "trade_name": cfg["name"],
            "unit": cfg["unit"],
            "engine": "AgeDecaySimulatorEngine",
            "assessment": assessment,
            "metrics": {
                "size_units": size_units,
                "stress_multiplier": round(decay_multiplier, 2),
                "analysis_years": analysis_window_years,
                "without_maintenance": {
                    "initial_degradation_year": unmaintained_crack_years,
                    "terminal_failure_year": unmaintained_failure_years,
                    "rebuild_cycles": rebuild_cycles,
                    "total_cost": round(total_unmaintained_cost, 2),
                    "annual_cost_per_unit": round(annual_unmaintained_cost_per_unit, 2)
                },
                "with_maintenance": {
                    "projected_lifespan_years": maintained_lifespan_years,
                    "routine_service_count": routine_count,
                    "major_preservation_count": major_count,
                    "total_cost": round(total_maintained_cost, 2),
                    "annual_cost_per_unit": round(annual_maintained_cost_per_unit, 2)
                },
                "financial_roi": {
                    "net_savings_dollars": round(net_savings, 2),
                    "savings_percentage": savings_pct
                }
            }
        }
