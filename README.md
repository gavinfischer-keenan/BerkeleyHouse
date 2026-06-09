# Berkeley Command Center & Telemetry Dashboard

**Version:** 1.0.0 (Berkeley House Major Release)
**Architecture:** Node.js (Express) + Socket.IO Backend + Vanilla JS / Leaflet.js Frontend
**Deployment Target:** 4K TV (Insignia NS-50F501NA26) and local home server / Raspberry Pi controllers

---

## Overview

The **Berkeley Command Center** is a high-performance, real-time telemetry dashboard designed for a passive, 24/7 heads-up display (HUD). Originating as a port of the Hawaii Telemetry Dashboard, this codebase has been completely refactored, localized to the San Francisco Bay Area, and upgraded with WebSocket push channels, an active service registry, and local ingest pipelines.

The system features a centralized map view (focused on the Golden Gate, Berkeley Hills, and the Richmond Refinery) that automatically cycles through critical views:
1. **Meteorological** (Local radar centered on 11 Mosswood Rd, land weather stations)
2. **Surf & Ocean** (SF Bay buoys, tides, and currents)
3. **Air Quality** (EPA-standard PurpleAir PM2.5 sensors)
4. **Traffic** (Real-time aircraft and marine vessels with heading-aligned SVG silhouettes and 30-second trailing paths)
5. **Hazards** (USGS seismic tremors, NWS warnings, and FAA turbulence sectors)

---

## System Architecture

```mermaid
graph TD
    subgraph Data Sources
        NWS[National Weather Service]
        USGS[USGS Seismic API]
        PurpleAir[PurpleAir API]
        OpenMeteo[Open-Meteo Currents/Wind]
        NOAA[NOAA Tide & Buoys]
        ADSB[ADSB.fi API / Local Feed]
        AIS[AISStream / Local Feed]
        LocalPi[Raspberry Pi / Ingest API]
    end

    subgraph Backend: @workspace/api-server
        Express[Express 5 Server]
        WSHub[Socket.IO WebSocket Hub]
        Registry[Service Registry]
        Cache[Local JSON DB & Cache]
    end

    subgraph Client: @workspace/berkeley
        DataBus[data-bus.js Socket.IO Client]
        Leaflet[Leaflet.js Map Canvas]
        TVScale[CSS Scale Engine]
    end

    %% Ingest connections
    NWS --> Express
    USGS --> Express
    PurpleAir --> Express
    OpenMeteo --> Express
    NOAA --> Express
    ADSB --> Express
    AIS --> Express
    LocalPi -->|POST /api/ingest| Express

    %% Internal routing
    Express --> WSHub
    Express --> Registry
    Express --> Cache

    %% Telemetry Stream
    WSHub -->|Real-Time Push| DataBus
    Express -->|Fallback Polling| DataBus
    DataBus --> Leaflet
```

---

## Core Features

### 1. Real-Time Tracking & Visualization
*   **SVG Silhouette Rendering:** Replaced standard emojis/markers with vector graphics that dynamically rotate to align with the entity's exact heading/direction of travel.
*   **30-Second Trails:** Every moving target (aircraft, helicopter, boat) generates a fading path reflecting its previous 30 seconds of travel, color-coded by type (e.g., Airliners, Helicopters, Cargo, Pleasures).
*   **Photo Management Engine:** Fetches real-time vessel photos automatically from hexdb.io, supports MarineTraffic fallback links, and includes a web portal (`/admin.html`) to upload custom images stored as local Base64 payloads.

### 2. WebSocket Push Layer & Data Bus
*   **Socket.IO Integration:** The backend hosts a Socket.IO namespace that broadcasts data updates in real-time as they are fetched or pushed.
*   **Dynamic Data Bus:** The client-side `data-bus.js` handles WebSocket streams automatically, falling back seamlessly to HTTP polling if the WebSocket server is offline.
*   **Kiosk Connectivity Indicator:** A live connection badge displays status in the bottom-left corner of the viewport (Green = Connected, Yellow = Polling Fallback, Red = Disconnected).

### 3. Resilient Service Registry & Ingest
*   **Health Dashboard:** View active backend workers and data sources in real-time.
*   **Generic Ingest API:** External devices (e.g. Raspberry Pi, BirdNET-Pi, RaspberryShake) can register and push data directly via HTTP POST:
    ```bash
    POST /api/ingest/:service_name
    Content-Type: application/json
    ```
*   **Time-Out Abort Signals:** All remote API calls enforce a strict 8-second timeout, preventing hanging sockets from exhausting backend memory.

### 4. 4K Kiosk Calibration
*   **Responsive Viewport:** Hardcoded to a logical resolution of `1920x1080` and scaled 2x via CSS to fit a 4K TV perfectly without requiring microscopic font sizes.
*   **Hardware-Aware Performance:** Strips complex CSS backdrop filters dynamically if rendering frame rate (FPS) drops below 20, maintaining smooth map rendering on lightweight clients (like a Raspberry Pi kiosk).

---

## Getting Started

### Prerequisites
*   Node.js (v18+)
*   `pnpm` (v9+)

### Installation
Clone the repository and install dependencies:
```powershell
pnpm install
```

### Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=5050
AISSTREAM_API_KEY=your_aisstream_api_key
ADSB_SOURCE=remote  # or 'local' to pull from a dump1090/tar1090 json feed
AIS_SOURCE=remote   # or 'local' for local AIS receiver feeds
```

### Development
Start the Express API backend:
```powershell
pnpm --filter @workspace/api-server run dev
```

Start the Vite frontend development server:
```powershell
pnpm --filter @workspace/berkeley run dev
```

The frontend will run at `http://localhost:3001` and proxy requests to the backend at `http://localhost:5050`.

### Production Deployment
Build the TypeScript backend and bundle the frontend assets:
```powershell
pnpm run build
```

Manage the API process in the background using PM2:
```powershell
pm2 start ecosystem.config.cjs
```

---

## API Documentation

### System Routes
*   `GET /api/services` - Returns the registry of active services and their last update timestamps.
*   `POST /api/ingest/:name` - Ingests data for custom telemetry feeds (e.g. RaspberryShake, BirdNET-Pi).

### Data Proxies
*   `GET /api/aircraft` - Returns active regional flights.
*   `GET /api/ships` - Returns active marine vessels.
*   `GET /api/weather` - Retrieves regional NWS meteorological metrics.
*   `GET /api/buoys` - Gets current wave/water telemetry from SF Bay buoys.
*   `GET /api/earthquakes` - Fetches recent seismic activity.
*   `GET /api/airquality` - Retrieves PurpleAir PM2.5 indices.
*   `GET /api/tide` - Returns tidal heights and predictions.
*   `GET /api/currents` - Retrieves SF Bay current models.

---

## Future Integration Hooks

1.  **RaspberryShake Seismometer:**
    The generic ingest endpoint can receive real-time UDP triggers or SeedLink data packages from the local RaspberryShake seismometer and map tremors locally on the Hazard page.
2.  **BirdNET-Pi Integration:**
    Allows a Raspberry Pi running BirdNET-Pi to send bird call identifications directly to `POST /api/ingest/birdnet` to display localized bird statistics.
3.  **Local Environmental Sensors:**
    Provides telemetry hooks to plot local temperature, barometric pressure, and humidity from custom GPIO sensors around the house.

---

## License
MIT License.
