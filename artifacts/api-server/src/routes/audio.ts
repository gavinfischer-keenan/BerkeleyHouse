/**
 * audio.ts — REST routes for the Berkeley audio monitoring network.
 *
 * These endpoints expose the data ingested from the audio-receiver Python
 * service (running on the same Linux host) to any consumer on the local
 * network — the Berkeley display, a future audio monitor app, scripts, etc.
 *
 * All audio data also flows over WebSocket (Socket.IO) in real-time:
 *   audio:detection    — fires for every new BirdNET/BatNET detection
 *   audio:node:status  — fires when a node comes online/offline/degrades
 *
 * Routes:
 *   GET  /api/audio/nodes                    — all node summaries + status
 *   GET  /api/audio/nodes/:nodeId            — single node status
 *   GET  /api/audio/nodes/:nodeId/detections — recent detections from one node
 *   GET  /api/audio/feed                     — cross-node global detection feed
 *
 * Ingest (handled by the existing generic /api/ingest/:name route):
 *   POST /api/ingest/audio-<nodeId>          — Python audio-receiver posts here
 *   POST /api/ingest/audio-<nodeId>-status   — Python posts node status here
 */

import { Router } from "express";
import {
  getNodeSummaries,
  getNodeStatus,
  getNodeDetections,
  getGlobalFeed,
  getAllNodeStatuses,
  getActiveNodeIds,
} from "../services/audio-store";

const router = Router();

// ── GET /api/audio/nodes ──────────────────────────────────────────────────────
// Returns all known nodes with their current status and recent detection summary.
// "Known" means any node that has ever posted a detection since server start.
router.get("/audio/nodes", (_req, res) => {
  const summaries = getNodeSummaries();
  const statuses = getAllNodeStatuses();

  res.json({
    nodes: summaries,
    statuses,
    activeCount: getActiveNodeIds().length,
    timestamp: Date.now(),
  });
});

// ── GET /api/audio/nodes/:nodeId ─────────────────────────────────────────────
router.get("/audio/nodes/:nodeId", (req, res) => {
  const { nodeId } = req.params;
  const status = getNodeStatus(nodeId);
  if (!status) {
    res.status(404).json({ error: `Audio node '${nodeId}' not found` });
    return;
  }
  res.json(status);
});

// ── GET /api/audio/nodes/:nodeId/detections ───────────────────────────────────
// Returns the N most recent detections from a specific microphone node.
// Query params:
//   limit     (default 50, max 500)
//   analyzer  (optional: "birdnet" | "batnet" | ...)
//   min_conf  (optional: 0.0–1.0)
router.get("/audio/nodes/:nodeId/detections", (req, res) => {
  const { nodeId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const analyzerFilter = req.query.analyzer as string | undefined;
  const minConf = req.query.min_conf ? Number(req.query.min_conf) : 0;

  let detections = getNodeDetections(nodeId, limit);

  if (analyzerFilter) {
    detections = detections.filter((d) => d.analyzer === analyzerFilter);
  }
  if (minConf > 0) {
    detections = detections.filter((d) => d.confidence >= minConf);
  }

  res.json({
    nodeId,
    count: detections.length,
    detections,
    timestamp: Date.now(),
  });
});

// ── GET /api/audio/feed ───────────────────────────────────────────────────────
// Returns the most recent detections across ALL nodes, merged and time-sorted.
// Query params:
//   limit     (default 100, max 2000)
//   analyzer  (optional filter)
//   min_conf  (optional filter)
router.get("/audio/feed", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 2000);
  const analyzerFilter = req.query.analyzer as string | undefined;
  const minConf = req.query.min_conf ? Number(req.query.min_conf) : 0;

  let feed = getGlobalFeed(limit);

  if (analyzerFilter) {
    feed = feed.filter((d) => d.analyzer === analyzerFilter);
  }
  if (minConf > 0) {
    feed = feed.filter((d) => d.confidence >= minConf);
  }

  res.json({
    count: feed.length,
    detections: feed,
    timestamp: Date.now(),
  });
});

export default router;
