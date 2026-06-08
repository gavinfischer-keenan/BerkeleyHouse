import { Router } from "express";

const router = Router();

let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

router.get("/alerts", async (req, res) => {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      res.json(cache.data);
      return;
    }

    // Fetch active NWS alerts for SF Bay Area zones
    // CAZ508 = Berkeley/Alameda County, CAZ006 = San Francisco,
    // CAZ509 = Santa Clara Valley, CAZ507 = Eastern SF Bay Shoreline
    const zones = ["CAZ508", "CAZ006", "CAZ509", "CAZ507"];
    const zoneParam = zones.join(",");
    const [rCA, rMarine] = await Promise.all([
      fetch(`https://api.weather.gov/alerts/active?zone=${zoneParam}`, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "BerkeleyCommandCenter/1.0 (contact@example.com)" },
      }),
      fetch("https://api.weather.gov/alerts/active?area=CA", { signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "BerkeleyCommandCenter/1.0 (contact@example.com)" },
      })
    ]);

    if (!rCA.ok) throw new Error(`NWS alerts CA zones ${rCA.status}`);
    if (!rMarine.ok) throw new Error(`NWS alerts CA ${rMarine.status}`);

    const jsonCA = (await rCA.json()) as { features: any[] };
    const jsonMarine = (await rMarine.json()) as { features: any[] };

    // Deduplicate by alert ID across both queries
    const seen = new Set<string>();
    const allFeatures = [...(jsonCA.features || []), ...(jsonMarine.features || [])].filter((f: any) => {
      const id = f.properties?.id ?? f.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const alerts = allFeatures.map((f: any) => ({
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline,
      description: f.properties.description,
      areaDesc: f.properties.areaDesc,
      effective: f.properties.effective,
      expires: f.properties.expires,
      geometry: (f as any).geometry,
    }));

    const data = { alerts, fetchedAt: Date.now() };
    cache = { data, expiresAt: Date.now() + CACHE_MS };
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch NWS alerts");
    res.status(502).json({ error: "Failed to fetch alerts", alerts: [] });
  }
});

export default router;


