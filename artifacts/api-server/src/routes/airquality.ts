import { Router } from "express";
import { broadcast } from "../services/ws-hub";
import { recordServiceUpdate } from "../services/registry";
import { makeCache } from "../lib/cache";

const router = Router();

const cache = makeCache<unknown>(15 * 60 * 1000); // 15 min TTL

// SF Bay Area monitoring points. Open-Meteo Air Quality API is keyless,
// global, and returns the US AQI plus pollutant concentrations per lat/lng.
const POINTS = [
  { name: "Berkeley", lat: 37.880, lng: -122.253 },
  { name: "San Francisco", lat: 37.775, lng: -122.418 },
  { name: "Oakland", lat: 37.805, lng: -122.272 },
  { name: "San Jose", lat: 37.338, lng: -121.886 },
  { name: "Concord", lat: 37.978, lng: -122.031 },
  { name: "Richmond", lat: 37.936, lng: -122.348 },
  { name: "Redwood City", lat: 37.485, lng: -122.227 },
];

interface OMCurrent {
  time: string;
  us_aqi: number;
  pm2_5: number;
  pm10: number;
  ozone: number;
}
interface OMResult {
  latitude: number;
  longitude: number;
  current: OMCurrent;
}

function dominantPol(c: OMCurrent): string {
  // Normalise each pollutant to a rough share of its US AQI breakpoint band
  // so the larger contributor wins. Approximate — for display only.
  const scaled: Record<string, number> = {
    pm25: c.pm2_5 / 35,
    pm10: c.pm10 / 150,
    o3: c.ozone / 160,
  };
  return Object.entries(scaled).sort((a, b) => b[1] - a[1])[0][0];
}

router.get("/airquality", async (req, res) => {
  try {
    const hit = cache.get();
    if (hit) { res.json(hit); return; }

    const lats = POINTS.map((p) => p.lat).join(",");
    const lngs = POINTS.map((p) => p.lng).join(",");
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}` +
      `&longitude=${lngs}&current=us_aqi,pm2_5,pm10,ozone&timezone=America%2FLos_Angeles`;

    const r = await fetch(url, { signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "BerkeleyCommandCenter/1.0" },
    });
    if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);

    const json = await r.json();
    // Open-Meteo returns an array when multiple coordinates are requested,
    // or a single object for one coordinate.
    const arr: OMResult[] = Array.isArray(json) ? json : [json];

    const sensors = arr.map((d, i) => {
      const c = d.current;
      return {
        name: POINTS[i]?.name ?? `Point ${i + 1}`,
        lat: POINTS[i]?.lat ?? d.latitude,
        lng: POINTS[i]?.lng ?? d.longitude,
        aqi: Math.round(c.us_aqi),
        pm25: c.pm2_5,
        pm10: c.pm10,
        o3: c.ozone,
        dominentpol: dominantPol(c),
        updatedAt: c.time,
      };
    });

    const data = { sensors, fetchedAt: Date.now() };
    cache.set(data);
    broadcast('airquality:update', data);
    recordServiceUpdate('airquality');
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch air quality");
    res.status(502).json({ error: "Failed to fetch AQI", sensors: [] });
  }
});

export default router;

