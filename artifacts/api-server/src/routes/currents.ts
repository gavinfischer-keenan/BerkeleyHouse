import { Router } from "express";
import { broadcast } from "../services/ws-hub";
import { recordServiceUpdate } from "../services/registry";

const router = Router();

// Ocean surface currents from the Open-Meteo Marine model (keyless, global).
// Returns model-derived current speed + direction at a spread of offshore
// points around the San Francisco Bay Area coast. Cached server-side because
// the marine model only updates a few times per day.
const POINTS = [
  { name: "Farallon Islands", lat: 37.7, lng: -123.0 },
  { name: "Point Reyes", lat: 38.0, lng: -123.1 },
  { name: "Golden Gate", lat: 37.81, lng: -122.52 },
  { name: "Pacifica", lat: 37.6, lng: -122.55 },
  { name: "Half Moon Bay", lat: 37.46, lng: -122.5 },
  { name: "Bolinas", lat: 37.91, lng: -122.73 },
];

const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
// ocean_current_direction = the compass heading the current flows TOWARD.
function arrowFor(dirDeg: number): string {
  return ARROWS[Math.round(((dirDeg % 360) / 45)) % 8];
}

type MarineCurrent = {
  current?: {
    ocean_current_velocity?: number; // km/h
    ocean_current_direction?: number; // deg (toward)
    sea_level_height_msl?: number; // m
  };
};

let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_MS = 30 * 60 * 1000;

async function fetchPoint(p: (typeof POINTS)[number]) {
  const url =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${p.lat}&longitude=${p.lng}` +
    `&current=ocean_current_velocity,ocean_current_direction,sea_level_height_msl&timezone=auto`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Open-Meteo marine ${r.status}`);
  const j = (await r.json()) as MarineCurrent;
  const c = j.current ?? {};
  const kmh = c.ocean_current_velocity ?? null;
  const dir = c.ocean_current_direction ?? null;
  const kt = kmh != null ? Math.round(kmh * 0.539957 * 10) / 10 : null;
  return {
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    speedKt: kt,
    dirDeg: dir,
    arrow: dir != null ? arrowFor(dir) : "·",
    seaLevelM: c.sea_level_height_msl ?? null,
  };
}

router.get("/currents", async (req, res) => {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      res.json(cache.data);
      return;
    }

    const results = await Promise.allSettled(POINTS.map(fetchPoint));
    const points = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchPoint>>> => r.status === "fulfilled")
      .map((r) => r.value);

    const withSpeed = points.filter((p) => p.speedKt != null);
    const avgKt = withSpeed.length
      ? Math.round((withSpeed.reduce((s, p) => s + (p.speedKt as number), 0) / withSpeed.length) * 10) / 10
      : null;

    const data = { points, avgKt, source: "Open-Meteo Marine model", fetchedAt: Date.now() };
    cache = { data, expiresAt: Date.now() + CACHE_MS };
    broadcast('currents:update', data);
    recordServiceUpdate('currents');
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch ocean currents");
    res.status(502).json({ error: "Failed to fetch ocean currents", points: [] });
  }
});

export default router;


