import { Router } from "express";

const router = Router();

let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_MS = 10 * 60 * 1000;

router.get("/turbulence", async (req, res) => {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      res.json(cache.data);
      return;
    }

    // Fetch FAA/AWC Aviation Weather polygons for SIGMETs and AIRMETs
    const [rAirmet, rSigmet] = await Promise.all([
      fetch("https://aviationweather.gov/api/data/airmet?format=geojson", { signal: AbortSignal.timeout(8000) }).catch(() => null),
      fetch("https://aviationweather.gov/api/data/sigmet?format=geojson", { signal: AbortSignal.timeout(8000) }).catch(() => null)
    ]);

    const turbulence = [];
    const processFeatures = async (r: Response | null) => {
      if (!r || !r.ok) return;
      const json = await r.json() as any;
      if (!json.features) return;
      for (const f of json.features) {
        const hazard = f.properties?.hazard || "";
        if (hazard.includes("TURB") || f.properties?.airmetType?.includes("TANGO")) {
          turbulence.push({
            hazard: f.properties?.hazard || "Turbulence",
            severity: f.properties?.severity || "Mod",
            minAlt: f.properties?.minAlt || f.properties?.base || 0,
            maxAlt: f.properties?.maxAlt || f.properties?.top || 0,
            geometry: f.geometry
          });
        }
      }
    };

    await processFeatures(rAirmet);
    await processFeatures(rSigmet);

    const data = { turbulence, fetchedAt: Date.now() };
    cache = { data, expiresAt: Date.now() + CACHE_MS };
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch turbulence");
    res.status(502).json({ error: "Failed to fetch turbulence", turbulence: [] });
  }
});

export default router;

