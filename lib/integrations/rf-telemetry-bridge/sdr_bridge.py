import subprocess
import json
import logging
import os
import sys
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

# Configuration
INFLUXDB_URL = os.environ.get("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.environ.get("INFLUXDB_TOKEN", "your-influxdb-token")
INFLUXDB_ORG = os.environ.get("INFLUXDB_ORG", "your-org")
INFLUXDB_BUCKET = os.environ.get("INFLUXDB_BUCKET", "sensors")

RTL_433_CMD = ["rtl_433", "-F", "json"]

def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Initialize InfluxDB Client
    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    write_api = client.write_api(write_options=SYNCHRONOUS)

    logging.info("SDR Bridge starting. Monitoring rtl_433...")

    # Start rtl_433 process
    try:
        process = subprocess.Popen(RTL_433_CMD, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    except FileNotFoundError:
        logging.error("rtl_433 executable not found in PATH.")
        sys.exit(1)

    while True:
        try:
            line = process.stdout.readline()
            if not line:
                # Process ended
                break
            
            line = line.strip()
            if not line:
                continue

            # 1. Parse incoming JSON payloads
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                # Silently discard malformed JSON strings
                continue

            # 2. Extract standard environmental variables
            device_id = payload.get("id", payload.get("model", "unknown"))
            model = payload.get("model", "unknown")
            
            temperature = payload.get("temperature_C")
            if temperature is None:
                temperature = payload.get("temperature_F")

            humidity = payload.get("humidity")
            
            wind_speed = payload.get("wind_speed_km_h", payload.get("wind_speed_m_s", payload.get("wind_speed")))
            
            battery = payload.get("battery_ok", payload.get("battery"))

            # Discard unsupported radio packet types that don't have our target variables
            if temperature is None and humidity is None and wind_speed is None and battery is None:
                continue

            # 3. Format into InfluxDB Line Protocol
            point = Point("rf_sensor") \
                .tag("device_id", str(device_id)) \
                .tag("model", str(model))
            
            if "time" in payload:
                point.time(payload["time"], WritePrecision.S)
            
            if temperature is not None:
                point.field("temperature", float(temperature))
            if humidity is not None:
                point.field("humidity", float(humidity))
            if wind_speed is not None:
                point.field("wind_speed", float(wind_speed))
            if battery is not None:
                try:
                    point.field("battery", float(battery))
                except ValueError:
                    if str(battery).upper() == "OK":
                        point.field("battery", 1.0)
                    elif str(battery).upper() == "LOW":
                        point.field("battery", 0.0)
                    else:
                        point.field("battery_status", str(battery))

            # 4. Push the Line Protocol data directly to local InfluxDB v2.x
            try:
                write_api.write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=point)
            except Exception:
                # Silently discard according to instructions "without crashing the daemon"
                pass

        except Exception:
            # Catch all exception in loop to ensure daemon doesn't crash
            pass

    client.close()

if __name__ == "__main__":
    main()
