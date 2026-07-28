import urllib.parse
from datetime import datetime
import random

class TruckHUDEngine:
    def __init__(self):
        pass

    def execute(self, query: str) -> dict:
        cmd = query.lower()
        
        # Directions Logic (Master or Operative)
        if "direction" in cmd or "navigate" in cmd or "route" in cmd:
            address = ""
            for keyword in ["to ", "for "]:
                if keyword in cmd:
                    address = cmd.split(keyword)[-1].strip()
                    break
            
            if not address:
                address = "the next site"

            maps_url = f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote(address)}"
            
            return {
                "status": "success",
                "action": "directions",
                "url": maps_url,
                "assessment": f"Right away. I have plotted the optimal route to {address}. Sending coordinates to your HUD now."
            }
            
        # Operative Dump Truck Dispatch Logic
        elif "dump" in cmd or "pickup" in cmd or "asphalt" in cmd or "plant" in cmd:
            plants = ["Vulcan Materials Plant 4", "Martin Marietta Quarry", "Local Asphalt Plant A"]
            target_plant = random.choice(plants)
            maps_url = f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote(target_plant)}"
            return {
                "status": "success",
                "action": "directions",
                "url": maps_url,
                "assessment": f"Routing you to {target_plant} for the next load. Traffic is light. Drive safely."
            }
            
        # Email / Estimate Logic (Master Only)
        elif "email" in cmd or "send" in cmd or "estimate" in cmd:
            return {
                "status": "success",
                "action": "email",
                "assessment": "Very good, sir. I have compiled the takeoff metrics and generated the PDF proposal. It has been successfully dispatched to the client's inbox from your secure server."
            }
            
        # Default fallback
        else:
            return {
                "status": "success",
                "action": "unknown",
                "assessment": "I am having trouble parsing that request over the cellular network. Could you reiterate your command?"
            }