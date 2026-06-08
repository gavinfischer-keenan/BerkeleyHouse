# Berkeley Telemetry & Command Center

**Version:** 1.7
**Architecture:** Node.js (Express) Backend API + Vanilla JS/Leaflet.js Frontend

## Overview
The Berkeley Telemetry Command Center is an autonomous, rotating dashboard designed for continuous, unattended display. It fuses real-time data from over 10 distinct government and scientific APIs into a unified geographical interface. 

The system operates via a state machine that automatically cycles through specific views (Meteorological, Ocean, Air Quality, Traffic, and Hazards), toggling map layers, zoom levels, and HUD elements based on the active state.

---

## Data Sources
All data is proxied, normalized, and cached by the local Node.js backend to prevent client-side rate limiting and CORS issues. Connection drops to external APIs are mitigated via strict 8-second timeout abort signals to ensure continuous system uptime.

*   **Aviation Traffic:** ADSB.fi (Live ADS-B telemetry)
*   **Maritime Traffic:** AISStream / ADSB.fi (Live AIS telemetry)
*   **Airport Status:** FAA NAS Status (Live delay/closure data)
*   **Meteorology (Weather, Radar, Alerts, Stations):** National Weather Service (`api.weather.gov`)
*   **Earthquakes / Seismic:** USGS Earthquake Hazards Program
*   **Ocean Buoys:** NOAA National Data Buoy Center (NDBC)
*   **Ocean Currents:** Open-Meteo Marine API
*   **Ocean Temperatures & Wave Models:** NOAA ERDDAP / NDBC (SST & Wave WMS layers)
*   **Tides:** NOAA CO-OPS
*   **Aviation Hazards / Turbulence:** Aviation Weather Center (AWC)
*   **Air Quality (AQI):** PurpleAir API
*   **Wind Vectors:** Open-Meteo

---

## Core UI States & Features (v1.6)

The dashboard automatically rotates through the following states:

### 1. Meteorological (SF Bay Area View)
*   **Visuals:** NWS Doppler Radar overlay, localized wind vectors, and NWS land weather station markers.
*   **HUD:** A 7-day wrapping forecast box (top right) and dedicated SFO, OAK, and SJC Airport operational status boxes.
*   **Focus:** Immediate atmospheric conditions over the SF Bay Area.

### 2. Surf & Ocean (SF Bay Area View)
*   **Visuals:** Significant Wave Height WMS overlay.
*   **HUD:** NDBC buoy cards showing wave heights, water temperatures, and periods. Includes NOAA tide charts and localized current speeds.
*   **Focus:** Marine conditions for vessels and surf tracking.

### 3. Air Quality (SF Bay Area View)
*   **Visuals:** Real-time PurpleAir sensor markers color-coded to EPA standards.
*   **HUD:** AQI legend and sensor-specific readouts.
*   **Focus:** Particulate matter and localized air safety.

### 4. Traffic - Regional (SF Bay Area View)
*   **Visuals:** Live rendering of all aircraft and vessels within the regional SF Bay Area bounding box. 
*   **HUD:** Aircraft include altitude, speed, and origin/destination pairs. Vessels include speed and ship type.
*   **Focus:** Macro-level airspace and maritime awareness.

### 5. Traffic - Combined (Berkeley Marina Zoom)
*   **Visuals:** A specialized, hyper-zoomed viewport locked from the Berkeley Marina (left edge) to the Golden Gate Bridge (right edge). Includes super-dense bathymetry overlays.
*   **HUD:** Real-time algorithmic tracker that specifically isolates and logs vessels moving within this tight coordinate box.
*   **Focus:** Micro-level monitoring of harbor exits and recreational zones.

### 6. Hazard Monitor (Northern California View)
*   **Visuals:** Zooms out to view the greater Northern California region. Displays USGS seismic events, AWC turbulence polygons, NWS active weather alerts, and an ocean temperature underlay.
*   **HUD:** Consolidated hazard status legend, SFO/OAK/SJC airport status, and regional flight tracker (tracking flights across Bay Area airspace).
*   **Focus:** Macro-level threat assessment and tectonic activity.

---

## Out of Scope / Not Included
*   **Routing/Drive Times:** Real-time street-level traffic routing (e.g., Google Maps drive times) is not currently implemented.
*   **Interactive Input:** The UI is designed as a passive heads-up display (HUD); manual map panning/zooming will be overridden by the state machine's internal timers.
*   **Historical Data:** All visuals represent strictly *real-time* or *forecasted* data; historical playback is not supported.

---

## Release Notes

### v1.7 - Point Release
*   **Bay Area 7-Day Surf Forecast:** Integrated the Open-Meteo Marine API to fetch a 7-day maximum wave height forecast specifically for the SF Bay Area coastal coordinate, visualized as a horizontally scrolling card in the Surf & Ocean tab.
*   **Intelligent Alert Filtering:** The NWS Small Craft Advisory logic was refined to scan alert descriptions for explicit mentions of the SF Bay Area, Berkeley, or the Golden Gate Strait. Broad state-wide advisories are now suppressed from the zoomed-in Bay Area views, appearing only on the macro Northern California map.
*   **AIS Vessel Plotting Fix:** Resolved a critical Javascript type coercion bug where numeric MMSI identifiers were failing strict Set checks against string property keys, which was causing live AIS pins to instantly delete themselves after rendering. The pins now correctly persist and feature a distinct semi-transparent background to ensure visibility over complex bathymetry map tiles.
*   **Hazard HUD Optimization:** The Deep Ocean Flight Monitor was removed from the Hazard Monitor page, and the Hazard Legend box was heavily minimized to maximize map visibility.

### v1.6 - Persistent Image Tracking & PIC WANTED System
*   **Persistent SQLite Backend Tracking:** Upgraded the Node.js backend to persistently log the first seen timestamps and visit counts for every localized vessel and aircraft via a persistent local JSON datastore, allowing the system to remember ships across reboots.
*   **PIC WANTED Bounty System:** Introduced a smart visual flag on both the bottom Ocean Traffic HUD and the Berkeley Marina Zoom HUD. Any aircraft or vessel tracked for more than 3 consecutive days without an uploaded custom image is automatically flagged with a solid red "[PIC WANTED]" badge.
*   **Custom Image Admin Portal:** Created an entirely new `/admin.html` upload portal interface for the user to upload Base64 images directly to the Node.js backend mapped to specific ship MMSI or aircraft ICAO/Callsigns.
*   **Dynamic Harbor Hiding:** Encoded the exact coordinates for the Berkeley Marina. The Marina Super-Zoom frame algorithmically detects if tracked ships are docked in the marina to suppress image displays, automatically materializing images only when the ship sails out into the bay.
*   **Berkeley Marina Viewport Expansion:** Widened the geographic bounding box of the Berkeley Marina Traffic tab to properly encompass the marina and César Chávez Park. 

### v1.5 - Raspberry Pi Standalone Architecture Support
*   **Hardware Graceful Degradation (FPS Monitor):** Added an ongoing `requestAnimationFrame` loop that monitors client rendering FPS. If the FPS drops below 20 for 5 consecutive seconds (due to excessive SVG aircraft rendering or GPU constraints on a Raspberry Pi), the system automatically strips all GPU-heavy `backdrop-filter: blur(...)` elements to instantly restore performance without crashing the kiosk.
*   **Kiosk Auto-Flush:** Implemented a daily 24-hour automatic browser refresh to forcibly clear any creeping Chromium memory leaks during continuous 24/7 runtimes.
*   **Deployment Configurations:** Shipped with a `.env.example` template for secure local secret management and an `ecosystem.config.cjs` to enable robust background process management via PM2.
*   **API Resilience:** Rebuilt the Node.js backend to forcefully append `AbortSignal.timeout(8000)` to all 15+ external government/API data fetches, completely insulating the system against memory exhaustion from hanging remote sockets.

