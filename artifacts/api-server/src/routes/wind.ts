import { Router } from "express";

const router = Router();

// Key monitoring points across the SF Bay Area operating area
const POINTS = [
  { name: "Berkeley",        lat: 37.88, lng: -122.27 },
  { name: "San Francisco",   lat: 37.77, lng: -122.42 },
  { name: "Golden Gate",     lat: 37.82, lng: -122.48 },
  { name: "Oakland",         lat: 37.80, lng: -122.27 },
  { name: "Richmond",        lat: 37.94, lng: -122.35 },
  { name: "Point Reyes",     lat: 38.00, lng: -122.97 },
  { name: "Half Moon Bay",   lat: 37.46, lng: -122.43 },
  { name: "San Jose",        lat: 37.34, lng: -121.89 },
  { name: "Concord",         lat: 37.97, lng: -122.00 },
  { name: "Sausalito",       lat: 37.86, lng: -122.49 },
  { name: "Pacifica",        lat: 37.61, lng: -122.49 },
  { name: "Farallon Is.",    lat: 37.70, lng: -123.00 },
];

let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_MS = 30 * 60 * 1000; // 30 min — Open-Meteo updates hourly

// Wind FROM direction → map arrow (arrow points the way the air is going)
function dirToArrow(fromDeg: number): string {
  const toDeg = (fromDeg + 180) % 360;
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  return arrows[Math.round(toDeg / 45) % 8];
}

router.get("/wind", async (req, res) => {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      res.json(cache.data);
      return;
    }

    const lats = POINTS.map((p) => p.lat).join(",");
    const lngs = POINTS.map((p) => p.lng).join(",");
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lats}&longitude=${lngs}` +
      `&current=wind_speed_10m,wind_direction_10m` +
      `&wind_speed_unit=kn&timezone=America/Los_Angeles`;

    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);

    const json = (await r.json()) as Array<{
      latitude: number;
      longitude: number;
      current: { wind_speed_10m: number; wind_direction_10m: number };
    }>;

    const arr = Array.isArray(json) ? json : [json];
    const points = arr.map((loc, i) => ({
      name:      POINTS[i]?.name ?? `Point ${i}`,
      lat:       loc.latitude,
      lng:       loc.longitude,
      speedKt:   Math.round(loc.current.wind_speed_10m),
      direction: Math.round(loc.current.wind_direction_10m),
      arrow:     dirToArrow(loc.current.wind_direction_10m),
    }));

    const data = { points, fetchedAt: Date.now(), source: "open-meteo" };
    cache = { data, expiresAt: Date.now() + CACHE_MS };
    res.json(data);
  } catch (err) {
    req.log.warn({ err }, "Wind fetch failed — using westerly wind fallback");
    // Typical SF Bay Area westerly winds at ~12 kt
    const data = {
      points: POINTS.map((p) => ({
        ...p, speedKt: 16, direction: 70, arrow: "↙",
      })),
      fetchedAt: Date.now(),
      source: "fallback",
    };
    res.json(data);
  }
});

export default router;


