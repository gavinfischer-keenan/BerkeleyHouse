import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initWebSocketHub } from "./services/ws-hub";
import { registerService } from "./services/registry";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Create HTTP server (required for Socket.IO to attach alongside Express)
const httpServer = createServer(app);

// Initialize WebSocket hub
initWebSocketHub(httpServer);

// Register all built-in services for discovery
registerService("aircraft", "ADS-B Aircraft", "poll", 
  process.env.ADSB_SOURCE === "local" ? "local" : "remote",
  { ADSB_SOURCE: process.env.ADSB_SOURCE || "remote" }
);
registerService("ships", "AIS Vessels", 
  process.env.AIS_SOURCE === "local" ? "poll" : "stream",
  process.env.AIS_SOURCE === "local" ? "local" : "remote",
  { AIS_SOURCE: process.env.AIS_SOURCE || "remote" }
);
registerService("weather", "NWS Weather", "poll", "remote");
registerService("buoys", "NDBC Buoys", "poll", "remote");
registerService("earthquakes", "USGS Earthquakes", "poll", "remote");
registerService("alerts", "NWS Alerts", "poll", "remote");
registerService("stations", "Weather Stations", "poll", "remote");
registerService("currents", "Ocean Currents", "poll", "remote");
registerService("tide", "NOAA Tides", "poll", "remote");
registerService("turbulence", "FAA Turbulence", "poll", "remote");
registerService("airquality", "Air Quality", "poll", "remote");
registerService("airport", "Airport Status", "poll", "remote");
registerService("earthquake-engine", "Earthquake Prediction Engine", "push", "local");

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + WebSocket)");
});
