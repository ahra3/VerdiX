import time
import random
import sys
from confluent_kafka import Producer

LOG_FILE_PATH = r"HDFS_demo.log"
KAFKA_BROKER = 'localhost:9092'
KAFKA_TOPIC = 'hdfs_raw_logs'


def delivery_report(err, msg):
    if err is not None:
        print(f"Delivery failed for record {msg.key()}: {err}")
    else:
        pass

def simulate_live_stream():
    print("Starting Kafka Producer...")
    print(f"Connecting to broker: {KAFKA_BROKER}")

    producer = Producer({'bootstrap.servers': KAFKA_BROKER})
    print(f"Connected! Streaming logs to topic: {KAFKA_TOPIC}")

    print("Press CTRL+C to stop the simulation.")
    count=0
    try:
        with open(LOG_FILE_PATH, 'r') as log_file:
            for line in log_file:
                time.sleep(0.05)

                producer.produce(KAFKA_TOPIC, value=line.strip().encode('utf-8'), callback=delivery_report)
                producer.poll(0)
                count += 1
                if count % 100 == 0:
                    print(f"Sent {count} log entries to Kafka.")
    except KeyboardInterrupt:
        print("\nSimulation stopped by user.")
    finally:
        print("Flushing remaining messages...")
        producer.flush()
        print(f"Total log entries sent: {count}")
        print("Kafka Producer stopped.")

if __name__ == "__main__":
    simulate_live_stream()
