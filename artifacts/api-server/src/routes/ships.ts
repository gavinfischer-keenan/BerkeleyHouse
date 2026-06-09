import { Router } from "express";
import { logger } from "../lib/logger";
import { logVesselObservation, getVesselMeta } from "../db";
import { broadcast } from "../services/ws-hub";
import { recordServiceUpdate } from "../services/registry";

const router = Router();

// AISStream.io — real-time vessel positions over WebSocket. The server holds
// one persistent connection, caches the latest report per MMSI, and serves a
// REST snapshot to the dashboard. Requires AISSTREAM_API_KEY; without it the
// endpoint reports "offline" and no connection is attempted.

// Bounding box covering the San Francisco Bay Area (lat/lon corners).
const BBOX: [[number, number], [number, number]] = [
  [37.3, -123.0],
  [38.2, -121.8],
];

type Vessel = {
  mmsi: number;
  name: string;
  lat: number;
  lng: number;
  sog: number | null; // speed over ground, knots
  cog: number | null; // course over ground, degrees
  heading: number | null;
  type: number | null;
  dest: string | null;
  updatedAt: number;
};

const vessels = new Map<number, Vessel>();
let connected = false;
let connecting = false;

// Use the runtime global WebSocket (Node 22+). Typed loosely to avoid pulling
// in DOM/undici lib typings.
const WS: any = (globalThis as { WebSocket?: unknown }).WebSocket;

function connect() {
  const key = process.env.AISSTREAM_API_KEY;
  if (!key || connecting || connected || !WS) return;
  connecting = true;

  const ws = new WS("wss://stream.aisstream.io/v0/stream");

  ws.addEventListener("open", () => {
    connecting = false;
    connected = true;
    logger.info("AISStream connected");
    ws.send(
      JSON.stringify({
        APIKey: key,
        BoundingBoxes: [BBOX],
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      }),
    );
  });

  ws.addEventListener("message", async (ev: { data: unknown }) => {
    try {
      // Node's native WebSocket delivers AISStream frames as binary Blobs, not
      // strings. The old `String(ev.data)` produced "[object Blob]", so every
      // frame failed JSON.parse and was silently dropped — the socket looked
      // "connected" but no vessel ever landed. Decode the binary payload first.
      const d = ev.data;
      let raw: string;
      if (typeof d === "string") raw = d;
      else if (d instanceof Blob) raw = await d.text();
      else if (d instanceof ArrayBuffer) raw = Buffer.from(d).toString("utf8");
      else if (ArrayBuffer.isView(d)) raw = Buffer.from(d.buffer, d.byteOffset, d.byteLength).toString("utf8");
      else raw = String(d);
      const msg = JSON.parse(raw);
      // AISStream reports subscription problems as an error frame rather than
      // closing the socket — surface it so a bad bbox/key doesn't look like
      // mere data sparsity.
      if (msg.error ?? msg.Error) {
        logger.warn({ aisError: msg.error ?? msg.Error }, "AISStream subscription error");
        return;
      }
      const meta = msg.MetaData ?? {};
      const mmsi: number | undefined = meta.MMSI;
      if (mmsi == null) return;

      const existing = vessels.get(mmsi);
      const name = (meta.ShipName ?? existing?.name ?? "").toString().trim() || `MMSI ${mmsi}`;
      const lat = meta.latitude ?? existing?.lat;
      const lng = meta.longitude ?? existing?.lng;
      if (lat == null || lng == null) return;

      const v: Vessel = {
        mmsi,
        name,
        lat,
        lng,
        sog: existing?.sog ?? null,
        cog: existing?.cog ?? null,
        heading: existing?.heading ?? null,
        type: existing?.type ?? null,
        dest: existing?.dest ?? null,
        updatedAt: Date.now(),
      };

      if (msg.MessageType === "PositionReport") {
        const p = msg.Message?.PositionReport ?? {};
        v.sog = p.Sog ?? v.sog;
        v.cog = p.Cog ?? v.cog;
        v.heading = p.TrueHeading != null && p.TrueHeading !== 511 ? p.TrueHeading : v.heading;
        logVesselObservation(mmsi, v.name, v.type);
      } else if (msg.MessageType === "ShipStaticData") {
        const s = msg.Message?.ShipStaticData ?? {};
        v.type = s.Type ?? v.type;
        v.dest = (s.Destination ?? v.dest ?? "")?.toString().trim() || v.dest;
      }

      vessels.set(mmsi, v);
    } catch {
      // ignore malformed frames
    }
  });

  ws.addEventListener("close", () => {
    connected = false;
    connecting = false;
    logger.warn("AISStream disconnected — reconnecting in 5s");
    setTimeout(connect, 5000);
  });

  ws.addEventListener("error", (err: unknown) => {
    logger.error({ err }, "AISStream socket error");
    try {
      ws.close();
    } catch {
      /* noop */
    }
  });
}

// ── Local AIS source ──────────────────────────────────────────────────────
// When AIS_SOURCE=local, fetch from a local AIS REST API instead of the
// AISStream WebSocket. Expected JSON format: array of vessel objects with
// mmsi, name, lat, lng/lon, sog, cog, heading, type, dest fields.
const AIS_SOURCE = process.env.AIS_SOURCE ?? "remote";
const AIS_LOCAL_URL = process.env.AIS_LOCAL_URL ?? "http://localhost:8081/api/vessels";

let localAisCache: { data: unknown; expiresAt: number } | null = null;
const LOCAL_AIS_CACHE_MS = 60 * 1000; // 1 min

type LocalAisVessel = {
  mmsi?: number;
  name?: string;
  lat?: number;
  lng?: number;
  lon?: number;
  sog?: number | null;
  cog?: number | null;
  heading?: number | null;
  type?: number | null;
  dest?: string | null;
  updatedAt?: number;
};

async function fetchLocalAis(): Promise<Vessel[]> {
  const r = await fetch(AIS_LOCAL_URL, {
    headers: { "User-Agent": "BerkeleyCommandCenter/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`local AIS ${r.status}`);
  const json = (await r.json()) as LocalAisVessel[] | { vessels?: LocalAisVessel[] };
  const list = Array.isArray(json) ? json : (json.vessels ?? []);
  return list
    .filter((v) => v.mmsi != null && (v.lat != null) && (v.lng != null || v.lon != null))
    .map((v) => ({
      mmsi: v.mmsi!,
      name: (v.name ?? "").trim() || `MMSI ${v.mmsi}`,
      lat: v.lat!,
      lng: v.lng ?? v.lon!,
      sog: v.sog ?? null,
      cog: v.cog ?? null,
      heading: v.heading ?? null,
      type: v.type ?? null,
      dest: v.dest ?? null,
      updatedAt: v.updatedAt ?? Date.now(),
    }));
}

// Kick off the WebSocket connection at startup if using remote source.
if (AIS_SOURCE !== "local") {
  connect();
}

router.get("/ships", async (_req, res) => {
  // ── Local AIS source path ──────────────────────────────────────────────
  if (AIS_SOURCE === "local") {
    try {
      if (localAisCache && Date.now() < localAisCache.expiresAt) {
        res.json(localAisCache.data);
        return;
      }

      const localVessels = await fetchLocalAis();
      localVessels.forEach((v) => logVesselObservation(v.mmsi, v.name, v.type));

      const ships = localVessels.map((v) => {
        const meta = getVesselMeta(v.mmsi);
        return {
          ...v,
          visit_count: meta?.visit_count ?? 1,
          first_seen: meta?.first_seen ?? Date.now(),
          image_url: meta?.image_url ?? null,
        };
      });

      const data = { ships, connected: true, fetchedAt: Date.now() };
      localAisCache = { data, expiresAt: Date.now() + LOCAL_AIS_CACHE_MS };
      broadcast('ships:update', data);
      recordServiceUpdate('ships');
      res.json(data);
    } catch (err) {
      logger.error({ err }, "Failed to fetch vessels from local AIS");
      res.json({ ships: [], connected: false, reason: "local_fetch_error", fetchedAt: Date.now() });
    }
    return;
  }

  // ── Remote AISStream path (existing logic) ─────────────────────────────
  const key = process.env.AISSTREAM_API_KEY;
  if (!key) {
    res.json({ ships: [], connected: false, reason: "no_key", fetchedAt: Date.now() });
    return;
  }

  // Retry if the socket dropped between requests.
  if (!connected && !connecting) connect();

  // Drop stale entries (> 20 min) from the cache itself, not just the output,
  // so the vessel Map can't grow unbounded over long server uptime.
  const cutoff = Date.now() - 20 * 60 * 1000;
  for (const [mmsi, v] of vessels) {
    if (v.updatedAt < cutoff) vessels.delete(mmsi);
  }
  
  const ships = [...vessels.values()].map(v => {
    const meta = getVesselMeta(v.mmsi);
    return {
      ...v,
      visit_count: meta?.visit_count ?? 1,
      first_seen: meta?.first_seen ?? Date.now(),
      image_url: meta?.image_url ?? null
    };
  });

  const data = { ships, connected, fetchedAt: Date.now() };
  broadcast('ships:update', data);
  recordServiceUpdate('ships');
  res.json(data);
});

export default router;


