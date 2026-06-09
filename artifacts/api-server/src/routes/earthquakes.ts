import { Router } from "express";
import { broadcast } from "../services/ws-hub";
import { recordServiceUpdate } from "../services/registry";

const router = Router();

// USGS Earthquake API — free, no key required
// Returns recent quakes within ~200km of Berkeley / SF Bay Area
router.get("/earthquakes", async (req, res) => {
  try {
    const url = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
    url.searchParams.set("format", "geojson");
    url.searchParams.set("latitude", "37.8");
    url.searchParams.set("longitude", "-122.3");
    url.searchParams.set("maxradiuskm", "200");
    url.searchParams.set("minmagnitude", "1.0");
    url.searchParams.set("limit", "20");
    url.searchParams.set("orderby", "time");

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "BerkeleyCommandCenter/1.0" },
    });

    if (!response.ok) {
      throw new Error(`USGS responded ${response.status}`);
    }

    const raw = (await response.json()) as {
      features: Array<{
        id: string;
        geometry: { coordinates: [number, number, number] };
        properties: {
          mag: number;
          place: string;
          time: number;
          type: string;
        };
      }>;
    };

    const quakes = raw.features.map((f) => ({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
    }));

    const data = { quakes, fetchedAt: Date.now() };
    broadcast('quakes:update', data);
    recordServiceUpdate('earthquakes');
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch earthquakes");
    res.status(502).json({ error: "Failed to fetch earthquake data" });
  }
});

export default router;

