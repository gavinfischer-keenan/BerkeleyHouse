/**
 * Service Discovery & Generic Data Ingest Routes
 * 
 * GET  /api/services              — list all registered services + status
 * GET  /api/services/:name        — get specific service info
 * GET  /api/services/:name/data   — get latest data from a push service
 * GET  /api/services/:name/history — get data history from a push service
 * POST /api/ingest/:name          — push data from any external device/service
 * GET  /api/ws-status             — WebSocket hub status
 */

import { Router } from "express";
import {
  getAllServices,
  getService,
  getLatestIngest,
  getIngestHistory,
  ingestData,
} from "../services/registry";
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
  const { data, metadata } = req.body;

  if (!data) {
    res.status(400).json({ error: "Request body must include a 'data' field" });
    return;
  }

  try {
    ingestData(name, data, metadata);
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
