/**
 * audio-store.ts — In-memory detection store for the Berkeley audio network.
 *
 * Receives data via POST /api/ingest/audio-<nodeId> (the existing generic
 * ingest endpoint). Data is indexed here for structured REST access via
 * /api/audio/* routes and re-broadcast over the Socket.IO WebSocket hub.
 *
 * This store is the TypeScript counterpart to the Python-side audio_store.py.
 * The Python store is ephemeral per-process; this store is the authoritative
 * source for all HTTP/WebSocket consumers (Berkeley display, future audio
 * monitor, etc.).
 *
 * WebSocket channels emitted:
 *   audio:detection   — single detection object, broadcast on every ingest
 *   audio:node:status — node status change (online/offline/degraded)
 *
 * All data is in-memory only — no database writes. The api-server is
 * stateless by design. Persistent storage lives in the archived WAV files
 * written by audio_archiver.py.
 */

import { broadcast } from "./ws-hub";
import { logger } from "../lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Analyzer = "birdnet" | "batnet" | string; // extensible

export interface NodeLocation {
  name: string;
  description: string;
  lat: number;
  lng: number;
}

export interface AudioDetection {
  nodeId: string;
  location: NodeLocation;
  timestamp: number;      // epoch ms, set by Python poster
  analyzer: Analyzer;
  species: string;        // scientific name
  commonName: string;
  confidence: number;     // 0.0–1.0
  startTime: number;      // seconds into the audio chunk
  endTime: number;
  chunkFile?: string;     // archive path if clip was saved
}

export interface NodeStatus {
  nodeId: string;
  status: "online" | "offline" | "degraded" | "initializing";
  detail: string;
  lastSeen: number;       // epoch ms
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Max detections kept per node (ring buffer) */
const MAX_PER_NODE = 500;

/** Max entries in the global cross-node feed */
const MAX_GLOBAL = 2000;

// ── Internal state ─────────────────────────────────────────────────────────────

const detectionsByNode = new Map<string, AudioDetection[]>();
const globalFeed: AudioDetection[] = [];
const nodeStatuses = new Map<string, NodeStatus>();

// ── Ingest ────────────────────────────────────────────────────────────────────

/**
 * Called by the /api/ingest route handler for any `audio-*` service name.
 * Parses the raw ingest payload, indexes detections, and broadcasts to WS.
 */
export function ingestAudioPayload(nodeId: string, data: any, metadata?: any): void {
  // ── Node status update ────────────────────────────────────────────────────
  if (metadata?.type === "status") {
    updateNodeStatus(nodeId, data.status ?? "online", data.detail ?? "");
    return;
  }

  // ── Detection batch ───────────────────────────────────────────────────────
  const analyzer: Analyzer = data.analyzer ?? "birdnet";
  const location: NodeLocation = data.location ?? { name: nodeId, description: "", lat: 0, lng: 0 };
  const rawDetections: any[] = Array.isArray(data.detections) ? data.detections : [];

  if (rawDetections.length === 0) return;

  const ts = typeof data.timestamp === "number" ? data.timestamp : Date.now();

  const detections: AudioDetection[] = rawDetections.map((d) => ({
    nodeId,
    location,
    timestamp: ts,
    analyzer,
    species: String(d.species ?? ""),
    commonName: String(d.commonName ?? ""),
    confidence: Number(d.confidence ?? 0),
    startTime: Number(d.startTime ?? 0),
    endTime: Number(d.endTime ?? 0),
    chunkFile: d.chunkFile,
  }));

  // Store per-node
  if (!detectionsByNode.has(nodeId)) {
    detectionsByNode.set(nodeId, []);
  }
  const nodeBuf = detectionsByNode.get(nodeId)!;
  nodeBuf.push(...detections);
  while (nodeBuf.length > MAX_PER_NODE) nodeBuf.shift();

  // Store in global feed
  globalFeed.push(...detections);
  while (globalFeed.length > MAX_GLOBAL) globalFeed.shift();

  // Mark node as online on any successful ingest
  updateNodeStatus(nodeId, "online");

  // Broadcast each detection individually for live feeds
  for (const det of detections) {
    broadcast("audio:detection", det);
  }

  logger.debug({ nodeId, analyzer, count: detections.length }, "Audio detections indexed");
}

// ── Node status ───────────────────────────────────────────────────────────────

export function updateNodeStatus(
  nodeId: string,
  status: NodeStatus["status"],
  detail = "",
): void {
  const existing = nodeStatuses.get(nodeId);
  const updated: NodeStatus = {
    nodeId,
    status,
    detail,
    lastSeen: Date.now(),
  };
  nodeStatuses.set(nodeId, updated);

  if (existing?.status !== status) {
    broadcast("audio:node:status", updated);
    logger.info({ nodeId, status, detail }, "Audio node status changed");
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getNodeDetections(nodeId: string, limit = 50): AudioDetection[] {
  const buf = detectionsByNode.get(nodeId) ?? [];
  return buf.slice(-Math.min(limit, MAX_PER_NODE));
}

export function getGlobalFeed(limit = 100): AudioDetection[] {
  return globalFeed.slice(-Math.min(limit, MAX_GLOBAL));
}

export function getAllNodeStatuses(): NodeStatus[] {
  return Array.from(nodeStatuses.values());
}

export function getNodeStatus(nodeId: string): NodeStatus | undefined {
  return nodeStatuses.get(nodeId);
}

export function getActiveNodeIds(): string[] {
  return Array.from(detectionsByNode.keys());
}

/**
 * Summary stats per node — used by /api/audio/nodes for a status overview.
 */
export function getNodeSummaries() {
  return Array.from(detectionsByNode.entries()).map(([nodeId, dets]) => {
    const status = nodeStatuses.get(nodeId);
    const recent = dets.slice(-10);
    const topSpecies = _topSpecies(recent);
    return {
      nodeId,
      status: status?.status ?? "unknown",
      lastSeen: status?.lastSeen ?? 0,
      totalDetections: dets.length,
      recentDetections: recent.length,
      topSpecies,
    };
  });
}

function _topSpecies(dets: AudioDetection[]): { commonName: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of dets) {
    counts.set(d.commonName, (counts.get(d.commonName) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([commonName, count]) => ({ commonName, count }));
}
