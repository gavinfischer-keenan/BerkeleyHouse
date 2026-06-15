/**
 * Service Discovery & Generic Data Ingest Routes
 * 
 * GET  /api/services              — list all registered services + status
 * GET  /api/services/:name        — get specific service info
 * GET  /api/services/:name/data   — get latest data from a push service
 * GET  /api/services/:name/history — get data history from a push service
 * POST /api/ingest/:name          — push data from any external device/service
 * GET  /api/ws-status             — WebSocket hub status
 *
 * Special ingest namespaces:
 *   audio-<nodeId>          — audio detection batches from audio-receiver.py
 *   audio-<nodeId>-status   — node connection status from audio-receiver.py
 * These are routed through the AudioStore for structured indexing before
 * the generic registry handler also records them for service discovery.
 */

import { Router } from "express";
import {
  getAllServices,
  getService,
  getLatestIngest,
  getIngestHistory,
  ingestData,
} from "../services/registry";
import { ingestAudioPayload } from "../services/audio-store";
import { getHubStatus, broadcast } from "../services/ws-hub";
import { logger } from "../lib/logger";

const router = Router();

// List all registered services
router.get("/services", (_req, res) => {
  const services = getAllServices();
  const hub = getHubStatus();
  res.json({
    services,
    websocket: hub,
    timestamp: Date.now(),
  });
});

// Get specific service info
router.get("/services/:name", (req, res) => {
  const svc = getService(req.params.name);
  if (!svc) {
    res.status(404).json({ error: `Service '${req.params.name}' not found` });
    return;
  }
  res.json(svc);
});

// Get latest data from a push/ingest service
router.get("/services/:name/data", (req, res) => {
  const latest = getLatestIngest(req.params.name);
  if (!latest) {
    res.status(404).json({ error: `No data available for '${req.params.name}'` });
    return;
  }
  res.json(latest);
});

// Get data history from a push/ingest service
router.get("/services/:name/history", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const history = getIngestHistory(req.params.name, limit);
  res.json({ service: req.params.name, count: history.length, data: history });
});

// Generic data ingest — any device can POST data here
router.post("/ingest/:name", (req, res) => {
  const name = req.params.name;

  // Accept two payload shapes:
  //   { data: {...}, metadata: {...} }  — audio-receiver and structured senders
  //   { ...flat payload... }           — BerkeleyMQTTBridge and simple senders
  const hasDataField = req.body != null && typeof req.body === "object" && "data" in req.body;
  const data: unknown     = hasDataField ? req.body.data     : req.body;
  const metadata: unknown = hasDataField ? req.body.metadata : undefined;

  if (data == null) {
    res.status(400).json({ error: "Empty request body" });
    return;
  }

  try {
    // ── Audio network: structured ingest via AudioStore ──────────────────
    if (name.startsWith("audio-")) {
      const nodeId = name.replace(/^audio-/, "").replace(/-status$/, "");
      ingestAudioPayload(nodeId, data, metadata);
    }

    // ── EQ engine alert: broadcast on the earthquake-engine channel ──────
    // BerkeleyMQTTBridge posts to eqengine-alert; the frontend listens on
    // ingest:earthquake-engine (registered in index.ts). Re-broadcast on
    // both so both the legacy name and the bridge name work.
    if (name === "eqengine-alert") {
      broadcast("ingest:earthquake-engine", { data, timestamp: Date.now() });
    }

    // Always also record in the generic service registry so these services
    // appear in /api/services and get the standard health tracking.
    ingestData(name, data, metadata as Record<string, any> | undefined);

    logger.info({ service: name }, "Data ingested");
    res.json({ success: true, service: name, timestamp: Date.now() });
  } catch (err: any) {
    logger.error({ service: name, err }, "Ingest error");
    res.status(500).json({ error: err.message });
  }
});

// WebSocket hub status
router.get("/ws-status", (_req, res) => {
  res.json(getHubStatus());
});

export default router;
