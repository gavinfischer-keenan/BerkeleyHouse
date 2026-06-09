import { Router } from "express";
import { broadcast } from "../services/ws-hub";
import { recordServiceUpdate } from "../services/registry";

const router = Router();

// NOAA NDBC buoy stations around San Francisco Bay Area
const BUOYS = [
  { id: "46026", name: "San Francisco (18NM W of Golden Gate)" },
  { id: "46012", name: "Half Moon Bay (24NM SSW of SF)" },
  { id: "46042", name: "Monterey" },
  { id: "46237", name: "San Francisco Bar" },
  { id: "46214", name: "Point Reyes" },
  { id: "FTPC1", name: "San Francisco, CA" },
];

async function fetchBuoy(id: string): Promise<Record<string, string | number | null>> {
  const url = `https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`;
  const res = await fetch(url, { headers: { "User-Agent": "BerkeleyCommandCenter/1.0" }, signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`NDBC ${id} responded ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split("\n");

  // Row 0: header names, Row 1: units, Row 2+: data (newest first)
  const headers = lines[0].replace(/^#/, "").trim().split(/\s+/);
  const dataLine = lines[2]?.trim().split(/\s+/) ?? [];

  const row: Record<string, string> = {};
  headers.forEach((h, i) => {
    row[h] = dataLine[i] ?? "MM";
  });

  const num = (key: string): number | null => {
    const v = row[key];
    return v && v !== "MM" ? parseFloat(v) : null;
  };

  return {
    id,
    waveHeight: num("WVHT"),
    dominantPeriod: num("DPD"),
    windSpeed: num("WSPD"),
    windSpeedKt: num("WSPD") != null ? Math.round((num("WSPD") as number) * 1.94384) : null,
    windDir: num("WDIR"),
    waterTemp: num("WTMP"),
    airTemp: num("ATMP"),
    pressure: num("PRES"),
    time: `${row["YY"] ?? row["#YY"]}-${row["MM"]}-${row["DD"]} ${row["hh"]}:${row["mm"]} UTC`,
  };
}

router.get("/buoys", async (req, res) => {
  try {
    const results = await Promise.allSettled(
      BUOYS.map(async (b) => {
        const data = await fetchBuoy(b.id);
        return { ...data, name: b.name };
      }),
    );

    const buoys = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return { id: BUOYS[i].id, name: BUOYS[i].name, error: "unavailable" };
    });

    const data = { buoys, fetchedAt: Date.now() };
    broadcast('buoys:update', data);
    recordServiceUpdate('buoys');
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch buoys");
    res.status(502).json({ error: "Failed to fetch buoy data" });
  }
});

export default router;


