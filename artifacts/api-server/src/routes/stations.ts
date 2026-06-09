import { Router } from "express";
import { broadcast } from "../services/ws-hub";
import { recordServiceUpdate } from "../services/registry";

const router = Router();

// Land weather stations we pull temperature/wind from, shown live on the map.
// Observations come from the National Weather Service (free, no key). Each
// station's latest METAR-derived observation is fetched and normalized.
const STATIONS: Array<{ id: string; name: string; lat: number; lng: number }> = [
  { id: "KOAK", name: "Oakland Airport (OAK)", lat: 37.7213, lng: -122.2208 },
  { id: "KSFO", name: "SFO Airport (SFO)", lat: 37.6213, lng: -122.3790 },
  { id: "KSJC", name: "San Jose Airport (SJC)", lat: 37.3626, lng: -121.9291 },
  { id: "KCCR", name: "Concord/Buchanan Field", lat: 37.9897, lng: -122.0569 },
  { id: "KHWD", name: "Hayward", lat: 37.6592, lng: -122.1217 },
  { id: "KNUQ", name: "Moffett Field", lat: 37.4161, lng: -122.0490 },
  { id: "KSTS", name: "Santa Rosa", lat: 38.5091, lng: -122.8125 },
  { id: "KSQL", name: "San Carlos", lat: 37.5119, lng: -122.2494 },
];

let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_MS = 10 * 60 * 1000; // 10 minutes

const UA = "BerkeleyCommandCenter/1.0 (contact@example.com)";

type ObsProps = {
  temperature?: { value: number | null };
  windSpeed?: { value: number | null };
  windDirection?: { value: number | null };
  textDescription?: string | null;
  timestamp?: string;
};

function degToCompass(deg: number | null): string | null {
  if (deg == null) return null;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

router.get("/stations", async (req, res) => {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      res.json(cache.data);
      return;
    }

    const results = await Promise.all(
      STATIONS.map(async (s) => {
        try {
          // The /observations/latest record alternates between real METARs and
          // null placeholders (QC flag "Z"), so pull the recent list and pick
          // the newest entry that actually has a temperature.
          const r = await fetch(
            `https://api.weather.gov/stations/${s.id}/observations?limit=8`, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": UA } },
          );
          if (!r.ok) throw new Error(`NWS ${s.id} ${r.status}`);
          const json = (await r.json()) as { features: Array<{ properties: ObsProps }> };
          const feats = json.features ?? [];
          const p: ObsProps =
            feats.find((f) => f.properties.temperature?.value != null)?.properties ??
            feats[0]?.properties ??
            {};
          const tempC = p.temperature?.value ?? null;
          const windKmh = p.windSpeed?.value ?? null;
          return {
            ...s,
            tempF: tempC != null ? Math.round((tempC * 9) / 5 + 32) : null,
            windKt: windKmh != null ? Math.round(windKmh * 0.539957) : null,
            windDir: degToCompass(p.windDirection?.value ?? null),
            windDeg: p.windDirection?.value ?? null,
            conditions: p.textDescription ?? null,
            obsTime: p.timestamp ?? null,
          };
        } catch {
          return { ...s, tempF: null, windKt: null, windDir: null, conditions: null, obsTime: null };
        }
      }),
    );

    const data = { stations: results, fetchedAt: Date.now() };
    cache = { data, expiresAt: Date.now() + CACHE_MS };
    broadcast('stations:update', data);
    recordServiceUpdate('stations');
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch weather stations");
    res.status(502).json({ error: "Failed to fetch station data" });
  }
});

export default router;


