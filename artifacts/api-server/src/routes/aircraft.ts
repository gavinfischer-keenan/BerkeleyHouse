import { Router } from "express";
import { logAircraftObservation, getAircraftMeta, setAircraftImage } from "../db";
import { logger } from "../lib/logger";

const router = Router();

// adsb.fi — free community ADS-B aggregator, no API key, global coverage.
// Replaces OpenSky, whose anonymous API times out from Replit's outbound IPs.
// Query is a radius around the SF Bay Area.
const CENTER = { lat: 37.75, lon: -122.4 };
const RADIUS_NM = 100;

let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_MS = 60 * 1000; // 1 min — adsb.fi is generous, keep it fresh

// ── Flight-route enrichment (adsbdb.com, keyless) ─────────────────────────
// adsb.fi exposes only the callsign, not the origin/destination. adsbdb maps a
// callsign to its scheduled route. Routes are static so we cache resolved (and
// unresolved) callsigns indefinitely and only ever look up a bounded number of
// NEW callsigns per refresh to stay polite to the free service.
type RouteInfo = { origin: string | null; dest: string | null };
const routeCache = new Map<string, RouteInfo>();
const MAX_LOOKUPS_PER_REFRESH = 12;

async function lookupRoute(callsign: string): Promise<RouteInfo> {
  try {
    const r = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`, { headers: { "User-Agent": "BerkeleyCommandCenter/1.0" }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { origin: null, dest: null };
    const j = (await r.json()) as {
      response?: { flightroute?: { origin?: { iata_code?: string }; destination?: { iata_code?: string } } };
    };
    const fr = j.response?.flightroute;
    return { origin: fr?.origin?.iata_code ?? null, dest: fr?.destination?.iata_code ?? null };
  } catch {
    return { origin: null, dest: null };
  }
}

// Airline-style callsign (3-letter ICAO airline + flight number), e.g. UAL930.
function isAirlineCallsign(cs: string): boolean {
  return /^[A-Z]{3}\d{1,4}[A-Z]?$/.test(cs);
}

type AdsbAircraft = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  alt_geom?: number;
  gs?: number;
  track?: number;
};

// ── hexdb.io photo auto-fetch ─────────────────────────────────────────────
// After enrichment, attempt to fetch aircraft photos from hexdb.io for aircraft
// that don't have an image_url. Rate-limited to 3 per refresh cycle. Retries
// after 7 days if photo_fetched_at is stale.
const MAX_PHOTO_FETCHES_PER_REFRESH = 3;
const PHOTO_RETRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function fetchHexdbPhoto(icao24: string): Promise<string | null> {
  try {
    const hexUrl = `https://hexdb.io/hex-image?hex=${encodeURIComponent(icao24)}`;
    const r = await fetch(hexUrl, {
      headers: { "User-Agent": "BerkeleyCommandCenter/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return null;
    return r.url;
  } catch {
    return null;
  }
}

// ── Local ADS-B source (dump1090 / readsb) ────────────────────────────────
// dump1090/readsb JSON format: { aircraft: [{ hex, flight, lat, lon, alt_baro,
// alt_geom, gs, track, r, t, ... }], now: epoch }
// Conveniently uses the same field names as adsb.fi so we can reuse AdsbAircraft.
const ADSB_SOURCE = process.env.ADSB_SOURCE ?? "remote";
const ADSB_LOCAL_URL = process.env.ADSB_LOCAL_URL ?? "http://localhost:8080/data/aircraft.json";

async function fetchAircraftRaw(): Promise<{ aircraft: AdsbAircraft[]; now: number | null }> {
  if (ADSB_SOURCE === "local") {
    const r = await fetch(ADSB_LOCAL_URL, {
      headers: { "User-Agent": "BerkeleyCommandCenter/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`local ADS-B ${r.status}`);
    const json = (await r.json()) as { aircraft?: AdsbAircraft[]; now?: number };
    return { aircraft: json.aircraft ?? [], now: json.now ?? null };
  }

  // Default: adsb.fi remote
  const url = `https://opendata.adsb.fi/api/v2/lat/${CENTER.lat}/lon/${CENTER.lon}/dist/${RADIUS_NM}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "BerkeleyCommandCenter/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`adsb.fi ${r.status}`);
  const json = (await r.json()) as { aircraft?: AdsbAircraft[]; now?: number };
  return { aircraft: json.aircraft ?? [], now: json.now ?? null };
}

router.get("/aircraft", async (req, res) => {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      res.json(cache.data);
      return;
    }

    const raw = await fetchAircraftRaw();

    const aircraft = raw.aircraft
      .filter((a) => a.lat != null && a.lon != null)
      .map((a) => {
        const onGround = a.alt_baro === "ground";
        const altFt = typeof a.alt_baro === "number" ? a.alt_baro : null;
        return {
          icao24: a.hex ?? "",
          callsign: (a.flight ?? "").trim() || "UNKNWN",
          registration: a.r ?? null,
          acType: a.t ?? null,
          lat: a.lat as number,
          lng: a.lon as number,
          altFt,
          geoAltFt: a.alt_geom ?? null,
          speedKt: a.gs != null ? Math.round(a.gs) : null,
          heading: a.track ?? null,
          onGround,
        };
      })
      .filter((a) => !a.onGround);

    // Resolve a bounded number of NOT-yet-cached airline callsigns this refresh.
    const pending = Array.from(
      new Set(aircraft.map((a) => a.callsign).filter((cs) => isAirlineCallsign(cs) && !routeCache.has(cs))),
    ).slice(0, MAX_LOOKUPS_PER_REFRESH);
    if (pending.length) {
      const looked = await Promise.allSettled(pending.map((cs) => lookupRoute(cs)));
      pending.forEach((cs, i) => {
        const v = looked[i];
        routeCache.set(cs, v.status === "fulfilled" ? v.value : { origin: null, dest: null });
      });
    }

    const enriched = aircraft.map((a) => {
      const route = routeCache.get(a.callsign) ?? null;
      logAircraftObservation(a.icao24, a.callsign);
      const meta = getAircraftMeta(a.icao24);
      return { 
        ...a, 
        origin: route?.origin ?? null, 
        dest: route?.dest ?? null,
        visit_count: meta?.visit_count ?? 1,
        first_seen: meta?.first_seen ?? Date.now(),
        image_url: meta?.image_url ?? null
      };
    });

    // ── hexdb.io photo auto-fetch pass ──────────────────────────────────────
    // Pick up to MAX_PHOTO_FETCHES_PER_REFRESH aircraft without photos (or with
    // stale photo_fetched_at) and try to resolve an image from hexdb.io.
    try {
      const now = Date.now();
      const candidates = enriched.filter((a) => {
        if (a.image_url) return false;
        const meta = getAircraftMeta(a.icao24);
        if (!meta) return false;
        if (meta.photo_fetched_at == null) return true;
        return now - meta.photo_fetched_at > PHOTO_RETRY_MS;
      }).slice(0, MAX_PHOTO_FETCHES_PER_REFRESH);

      if (candidates.length) {
        const results = await Promise.allSettled(
          candidates.map((a) => fetchHexdbPhoto(a.icao24)),
        );
        candidates.forEach((a, i) => {
          const result = results[i];
          const finalUrl = result.status === "fulfilled" ? result.value : null;
          const meta = getAircraftMeta(a.icao24);
          if (finalUrl) {
            setAircraftImage(a.icao24, finalUrl);
            if (meta) {
              meta.photo_source = "hexdb";
              meta.photo_fetched_at = Date.now();
            }
            a.image_url = finalUrl;
            logger.info({ icao24: a.icao24 }, "Auto-fetched photo from hexdb.io");
          } else {
            // Mark as attempted to avoid retrying constantly
            if (meta) meta.photo_fetched_at = Date.now();
          }
        });
      }
    } catch (photoErr) {
      logger.warn({ err: photoErr }, "hexdb.io photo auto-fetch pass failed");
    }

    const data = { aircraft: enriched, fetchedAt: Date.now(), dataTime: raw.now ?? null };
    cache = { data, expiresAt: Date.now() + CACHE_MS };
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch aircraft");
    res.json({ aircraft: [], fetchedAt: Date.now(), source: "fallback" });
  }
});

export default router;




