import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - KAFKA-BROKER - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MessageBroker:
    """
    An async Pub/Sub event bus simulating Apache Kafka.
    This connects all 18 isolated AI engines into a unified Neural Network.
    """
    def __init__(self):
        self.topics = {}
        logger.info("Initializing Async Kafka Message Broker. Microservices are now connected.")

    async def subscribe(self, topic, callback):
        if topic not in self.topics:
            self.topics[topic] = []
        self.topics[topic].append(callback)
        logger.info(f"Engine subscribed to topic: {topic}")

    async def publish(self, topic, payload):
        logger.info(f"PUBLISH [{topic}] -> {payload}")
        if topic in self.topics:
            tasks = [callback(payload) for callback in self.topics[topic]]
            await asyncio.gather(*tasks)

# ---------------------------------------------------------
# Example Microservice Wiring
# ---------------------------------------------------------
async def fintech_listener(payload):
    logger.info(f"JARVIS FINTECH RECEIVED: Roof defect at {payload['address']}. Instantly underwriting loan.")
    await asyncio.sleep(0.1) # Async non-blocking processing

async def main():
    broker = MessageBroker()
    await broker.subscribe("vision.roof_defects", fintech_listener)
    
    # Simulate a drone publishing a finding
    logger.info("Drone Vision Engine spotted a defect. Broadcasting to the network...")
    await broker.publish("vision.roof_defects", {"address": "101 Elm St", "severity": "HIGH"})

if __name__ == "__main__":
    asyncio.run(main())
