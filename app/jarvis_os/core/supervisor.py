import time
import subprocess
import logging
import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - SUPERVISOR - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("supervisor.log"),
        logging.StreamHandler()
    ]
)

API_URL = "http://127.0.0.1:8080"
START_COMMAND = ["uvicorn", "api_gateway:app", "--host", "0.0.0.0", "--port", "8080"]

def start_server():
    logging.info("Starting API Gateway process...")
    return subprocess.Popen(START_COMMAND)

def check_health():
    try:
        response = requests.get(API_URL, timeout=3)
        if response.status_code == 200:
            return True
    except requests.exceptions.RequestException:
        pass
    return False

def main():
    logging.info("JWorden OS Self-Healing Supervisor Daemon Started.")
    process = start_server()
    
    # Wait for initial boot
    time.sleep(5)
    
    while True:
        is_healthy = check_health()
        
        if not is_healthy:
            logging.error("API Gateway heartbeat FAILED or process died! Initiating resurrection...")
            
            # Kill the zombie process
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    
            # Restart
            process = start_server()
            logging.info("System resurrected successfully.")
            time.sleep(5) # Wait for it to bind to port
            
        else:
            logging.debug("Heartbeat OK.")
            
        time.sleep(10) # Check every 10 seconds

if __name__ == "__main__":
    main()
