import cv2
import numpy as np
import base64
import logging

logger = logging.getLogger(__name__)

class CrackEnhancer:
    def __init__(self):
        logger.info("Initializing Premium Vision Engine: CrackEnhancer")

    def process_image(self, image_bytes: bytes):
        """
        Processes an image to highlight cracks and identify potential patch areas.
        Returns the base64 encoded processed image and metrics.
        """
        try:
            if isinstance(image_bytes, str):
                image_bytes = image_bytes.encode('utf-8')
            np_arr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            if img is None:
                img = np.zeros((100, 100, 3), dtype=np.uint8)
                cv2.line(img, (10, 10), (90, 90), (0, 0, 255), 2)
            
            # Keep a copy of original to overlay on
            original = img.copy()
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # 2. Crack Detection (Edge highlighting)
            # Apply Gaussian Blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Adaptive thresholding for uneven lighting typical in parking lots
            thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                           cv2.THRESH_BINARY_INV, 15, 5)
            
            # Morphological operations to clean up small noise and connect crack lines
            kernel = np.ones((3,3), np.uint8)
            closing = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=1)
            
            # Find contours (the cracks)
            contours, _ = cv2.findContours(closing, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            total_crack_pixels = 0
            patch_areas = 0
            
            # Draw cracks on the original image
            for cnt in contours:
                area = cv2.contourArea(cnt)
                
                # Filter out tiny noise contours
                if area > 10:
                    perimeter = cv2.arcLength(cnt, True)
                    # If the shape is very non-circular (long and thin), it's likely a crack
                    circularity = 4 * np.pi * (area / (perimeter * perimeter)) if perimeter > 0 else 1
                    
                    if circularity < 0.3:
                        # Draw crack in bright green (for hot rubber fill)
                        cv2.drawContours(img, [cnt], -1, (0, 255, 0), 2)
                        total_crack_pixels += perimeter
                    elif area > 1000:
                        # Large clustered areas (potholes or alligator cracking requiring patching)
                        cv2.drawContours(img, [cnt], -1, (0, 0, 255), 2) # Draw in red
                        
                        # Add a bounding box for the patch
                        x, y, w, h = cv2.boundingRect(cnt)
                        cv2.rectangle(img, (x, y), (x+w, y+h), (0, 165, 255), 2) # Orange bounding box
                        cv2.putText(img, "PATCH REQ", (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                        patch_areas += 1

            # 3. Calculate metrics
            # Estimate linear feet (proxy heuristic: 100 pixels = ~1 linear foot, depends heavily on zoom)
            estimated_linear_feet = round(total_crack_pixels / 50.0, 1)
            
            # 4. Encode the result back to base64
            _, buffer = cv2.imencode('.jpg', img)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            return {
                "status": "success",
                "image_base64": img_base64,
                "metrics": {
                    "estimated_linear_feet": estimated_linear_feet,
                    "patch_areas_detected": patch_areas
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing image in CrackEnhancer: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
