import { Router } from "express";
import { logger } from "../lib/logger";
import { logVesselObservation, getVesselMeta } from "../db";

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

// Kick off the connection at startup if a key is present.
connect();

router.get("/ships", (_req, res) => {
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

  res.json({ ships, connected, fetchedAt: Date.now() });
});

export default router;

