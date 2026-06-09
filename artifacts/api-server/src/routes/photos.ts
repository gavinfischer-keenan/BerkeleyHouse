import { Router } from "express";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";
import { getAircraftMeta, setAircraftImage, getVesselMeta, setVesselImage } from "../db";
import type { DBAircraft, DBVessel } from "../db";

const router = Router();

// Ensure the images directory exists at startup.
const imagesDir = path.join(process.cwd(), "public", "images");
fs.mkdirSync(imagesDir, { recursive: true });

// ── GET /api/photos/:type/:id — photo metadata ──────────────────────────────
router.get("/:type/:id", (req, res) => {
  const { type, id } = req.params;

  if (type !== "aircraft" && type !== "vessel") {
    res.status(400).json({ error: "type must be 'aircraft' or 'vessel'" });
    return;
  }

  let meta: DBAircraft | DBVessel | undefined;
  if (type === "aircraft") {
    meta = getAircraftMeta(id);
  } else {
    meta = getVesselMeta(Number(id));
  }

  if (!meta) {
    res.status(404).json({ error: `${type} not found` });
    return;
  }

  res.json({
    image_url: meta.image_url,
    photo_source: meta.photo_source,
    photo_fetched_at: meta.photo_fetched_at,
  });
});

// ── POST /api/photos/:type/:id/upload — manual image upload ──────────────────
router.post("/:type/:id/upload", (req, res) => {
  try {
    const { type, id } = req.params;

    if (type !== "aircraft" && type !== "vessel") {
      res.status(400).json({ error: "type must be 'aircraft' or 'vessel'" });
      return;
    }

    const { image_base64 } = req.body as { image_base64?: string };
    if (!image_base64) {
      res.status(400).json({ error: "image_base64 is required" });
      return;
    }

    const filename = `${type}_${id}.jpg`;
    const filePath = path.join(imagesDir, filename);
    const buffer = Buffer.from(image_base64, "base64");
    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/images/${filename}`;

    if (type === "aircraft") {
      setAircraftImage(id, imageUrl);
      const meta = getAircraftMeta(id);
      if (meta) {
        meta.photo_source = "manual";
        meta.photo_fetched_at = Date.now();
      }
    } else {
      const mmsi = Number(id);
      setVesselImage(mmsi, imageUrl);
      const meta = getVesselMeta(mmsi);
      if (meta) {
        meta.photo_source = "manual";
        meta.photo_fetched_at = Date.now();
      }
    }

    logger.info({ type, id }, "Photo uploaded manually");
    res.json({ success: true, image_url: imageUrl });
  } catch (err) {
    req.log.error({ err }, "Failed to upload photo");
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

// ── POST /api/photos/:type/:id/fetch — auto-fetch from external service ──────
router.post("/:type/:id/fetch", async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type !== "aircraft" && type !== "vessel") {
      res.status(400).json({ error: "type must be 'aircraft' or 'vessel'" });
      return;
    }

    if (type === "aircraft") {
      // Fetch from hexdb.io
      const hexUrl = `https://hexdb.io/hex-image?hex=${encodeURIComponent(id)}`;
      const r = await fetch(hexUrl, {
        headers: { "User-Agent": "BerkeleyCommandCenter/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(3000),
      });

      if (!r.ok) {
        // Mark as attempted so we don't retry constantly
        const meta = getAircraftMeta(id);
        if (meta) meta.photo_fetched_at = Date.now();
        res.status(404).json({ error: `hexdb.io returned ${r.status}` });
        return;
      }

      const finalUrl = r.url;
      setAircraftImage(id, finalUrl);
      const meta = getAircraftMeta(id);
      if (meta) {
        meta.photo_source = "hexdb";
        meta.photo_fetched_at = Date.now();
      }

      logger.info({ icao24: id }, "Photo fetched from hexdb.io");
      res.json({ success: true, image_url: finalUrl });
    } else {
      // Vessel — fetch from MarineTraffic
      const apiKey = process.env.MARINETRAFFIC_API_KEY;
      if (!apiKey) {
        res.status(400).json({ error: "MARINETRAFFIC_API_KEY not configured" });
        return;
      }

      const mtUrl = `https://services.marinetraffic.com/api/exportvesselphoto/v:1/${apiKey}/mmsi:${id}`;
      const r = await fetch(mtUrl, {
        headers: { "User-Agent": "BerkeleyCommandCenter/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(3000),
      });

      if (!r.ok) {
        const mmsi = Number(id);
        const meta = getVesselMeta(mmsi);
        if (meta) meta.photo_fetched_at = Date.now();
        res.status(404).json({ error: `MarineTraffic returned ${r.status}` });
        return;
      }

      const finalUrl = r.url;
      const mmsi = Number(id);
      setVesselImage(mmsi, finalUrl);
      const meta = getVesselMeta(mmsi);
      if (meta) {
        meta.photo_source = "marinetraffic";
        meta.photo_fetched_at = Date.now();
      }

      logger.info({ mmsi: id }, "Photo fetched from MarineTraffic");
      res.json({ success: true, image_url: finalUrl });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to fetch photo");
    res.status(500).json({ error: "Failed to fetch photo" });
  }
});

export default router;
