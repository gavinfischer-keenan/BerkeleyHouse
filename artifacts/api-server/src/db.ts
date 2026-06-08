import fs from 'fs';
import path from 'path';
import { logger } from './lib/logger.js';

export interface DBVessel { mmsi: number; name: string; type: number | null; first_seen: number; last_seen: number; visit_count: number; image_url: string | null; }
export interface DBAircraft { icao24: string; callsign: string; first_seen: number; last_seen: number; visit_count: number; image_url: string | null; }

interface DatabaseStructure {
  vessels: Record<number, DBVessel>;
  aircraft: Record<string, DBAircraft>;
}

const dbPath = path.join(process.cwd(), 'data.json');

let db: DatabaseStructure = {
  vessels: {},
  aircraft: {}
};

// Load database
try {
  if (fs.existsSync(dbPath)) {
    const raw = fs.readFileSync(dbPath, 'utf8');
    db = JSON.parse(raw);
    logger.info(`Loaded database from ${dbPath}`);
  }
} catch (err) {
  logger.error({ err }, 'Failed to load database.json');
}

// Save database (debounced to avoid thrashing disk)
let saveTimeout: NodeJS.Timeout | null = null;
function saveDatabase() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const now = Date.now();
      const cutoff = now - 30 * 24 * 60 * 60 * 1000; // 30 days
      
      // Prune inactive vessels without custom images
      for (const mmsi in db.vessels) {
        const v = db.vessels[mmsi];
        if (v.last_seen < cutoff && !v.image_url) {
          delete db.vessels[mmsi];
        }
      }
      
      // Prune inactive aircraft without custom images
      for (const icao in db.aircraft) {
        const a = db.aircraft[icao];
        if (a.last_seen < cutoff && !a.image_url) {
          delete db.aircraft[icao];
        }
      }

      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    } catch (err) {
      logger.error({ err }, 'Failed to save database.json');
    }
  }, 5000);
}

export function logVesselObservation(mmsi: number, name: string, type: number | null) {
  const existing = db.vessels[mmsi];
  const now = Date.now();
  if (existing) {
    if (now - existing.last_seen > 6 * 60 * 60 * 1000) {
      existing.visit_count++;
    }
    existing.last_seen = now;
  } else {
    db.vessels[mmsi] = { mmsi, name, type, first_seen: now, last_seen: now, visit_count: 1, image_url: null };
  }
  saveDatabase();
}

export function getVesselMeta(mmsi: number): DBVessel | undefined {
  return db.vessels[mmsi];
}

export function setVesselImage(mmsi: number, url: string) {
  if (!db.vessels[mmsi]) {
    db.vessels[mmsi] = { mmsi, name: 'Unknown', type: null, first_seen: Date.now(), last_seen: Date.now(), visit_count: 1, image_url: url };
  } else {
    db.vessels[mmsi].image_url = url;
  }
  saveDatabase();
}

export function logAircraftObservation(icao24: string, callsign: string) {
  const existing = db.aircraft[icao24];
  const now = Date.now();
  if (existing) {
    if (now - existing.last_seen > 6 * 60 * 60 * 1000) {
      existing.visit_count++;
    }
    existing.last_seen = now;
  } else {
    db.aircraft[icao24] = { icao24, callsign, first_seen: now, last_seen: now, visit_count: 1, image_url: null };
  }
  saveDatabase();
}

export function getAircraftMeta(icao24: string): DBAircraft | undefined {
  return db.aircraft[icao24];
}

export function setAircraftImage(icao24: string, url: string) {
  if (!db.aircraft[icao24]) {
    db.aircraft[icao24] = { icao24, callsign: 'Unknown', first_seen: Date.now(), last_seen: Date.now(), visit_count: 1, image_url: url };
  } else {
    db.aircraft[icao24].image_url = url;
  }
  saveDatabase();
}
