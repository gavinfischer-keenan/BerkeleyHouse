import { Router } from 'express';
import { logger } from '../lib/logger.js';
import { setVesselImage, setAircraftImage, getVesselMeta, getAircraftMeta } from '../db.js';
import fs from 'fs';
import path from 'path';

export const uploadRouter = Router();

// Make sure public/images exists
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

uploadRouter.post('/', (req, res) => {
  try {
    const { type, id, image_base64 } = req.body;
    
    if (!type || !id || !image_base64) {
      res.status(400).json({ error: 'Missing type, id, or image_base64' });
      return;
    }

    // Extract base64 data
    const matches = image_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.status(400).json({ error: 'Invalid base64 image data' });
      return;
    }

    const mimeType = matches[1];
    const imageData = matches[2];
    const buffer = Buffer.from(imageData, 'base64');
    
    // Determine extension
    let ext = '.jpg';
    if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('gif')) ext = '.gif';
    else if (mimeType.includes('webp')) ext = '.webp';

    const filename = `${type}_${id}_${Date.now()}${ext}`;
    const filepath = path.join(IMAGES_DIR, filename);

    fs.writeFileSync(filepath, buffer);
    
    const imageUrl = `/images/${filename}`;

    if (type === 'ship') {
      const mmsi = parseInt(id, 10);
      setVesselImage(mmsi, imageUrl);
    } else if (type === 'aircraft') {
      setAircraftImage(id, imageUrl);
    } else {
      res.status(400).json({ error: 'Invalid type (must be ship or aircraft)' });
      return;
    }

    logger.info(`Uploaded image for ${type} ${id}: ${filename}`);
    res.json({ success: true, url: imageUrl });

  } catch (err) {
    logger.error({ err }, 'Failed to process image upload');
    res.status(500).json({ error: 'Internal server error' });
  }
});

