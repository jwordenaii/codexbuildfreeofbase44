import os
import requests
import logging
from .crack_enhancer import CrackEnhancer

logger = logging.getLogger(__name__)

class SatelliteScanner:
    def __init__(self):
        logger.info("Initializing Premium Vision Engine: SatelliteScanner")
        # In a real production scenario, you would set GOOGLE_MAPS_API_KEY in your .env
        self.api_key = os.getenv("GOOGLE_MAPS_API_KEY", "DEMO_KEY")
        self.crack_enhancer = CrackEnhancer()

    def scan_address(self, address: str):
        """
        Fetches satellite imagery for the given address and runs it through the CrackEnhancer.
        """
        logger.info(f"Initiating satellite scan for address: {address}")
        
        # 1. Fetch from Google Maps Static API
        zoom = 20 # Max zoom for close-up property view
        size = "640x640"
        maptype = "satellite"
        
        # If no real API key is provided, we simulate the fetch with a placeholder mechanism 
        # or error out gracefully requesting the key.
        # To make this fully complete, we implement the actual HTTP call.
        
        url = f"https://maps.googleapis.com/maps/api/staticmap?center={address.replace(' ', '+')}&zoom={zoom}&size={size}&maptype={maptype}&key={self.api_key}"
        
        try:
            if self.api_key == "DEMO_KEY":
                # For demo purposes when no key is present, we raise an error to inform the user
                return {
                    "status": "error",
                    "message": "GOOGLE_MAPS_API_KEY not configured in environment. Cannot fetch live satellite data."
                }

            response = requests.get(url)
            if response.status_code != 200:
                logger.error(f"Failed to fetch satellite imagery: {response.text}")
                return {
                    "status": "error",
                    "message": f"Failed to fetch satellite image. Status: {response.status_code}"
                }
                
            image_bytes = response.content
            
            # 2. Process the image bytes through the CrackEnhancer
            result = self.crack_enhancer.process_image(image_bytes)
            
            if result.get("status") == "success":
                return {
                    "status": "success",
                    "address": address,
                    "image_base64": result["image_base64"],
                    "metrics": result["metrics"],
                    "source": "satellite"
                }
            else:
                return result

        except Exception as e:
            logger.error(f"Error in satellite scanning: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
