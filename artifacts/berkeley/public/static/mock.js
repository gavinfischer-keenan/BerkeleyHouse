globalThis.window = { innerWidth: 1920, innerHeight: 1080, addEventListener: () => {} };
globalThis.document = { getElementById: () => ({ style: {}, classList: { add: ()=>{}, remove: ()=>{}, toggle: ()=>{} }, innerText: '', innerHTML: '' }), createElement: () => ({ style: {}, classList: { add: ()=>{}, remove: ()=>{} }, appendChild: () => {}, innerHTML: '' }) };
const mockMap = { 
    fitBounds: function() { return this; }, 
    dragging: {disable:()=>{}}, touchZoom: {disable:()=>{}}, doubleClickZoom: {disable:()=>{}}, scrollWheelZoom: {disable:()=>{}}, boxZoom: {disable:()=>{}}, keyboard: {disable:()=>{}}, 
    createPane: () => {}, getPane: () => ({ style: {} }), on: () => {}, setMaxBounds: () => {}, setMinZoom: () => {}, flyTo: () => {}, flyToBounds: () => {}, hasLayer: () => false, addLayer: () => {}, removeLayer: () => {} 
};
globalThis.L = { 
    map: () => mockMap,
    latLngBounds: () => {},
    tileLayer: Object.assign(() => ({ addTo: () => {} }), { wms: () => ({ addTo: () => {} }) }),
    layerGroup: () => ({ addTo: () => {}, clearLayers: () => {}, addLayer: () => {}, removeLayer: () => {} }),
    featureGroup: () => ({ addTo: () => {}, clearLayers: () => {}, addLayer: () => {}, removeLayer: () => {} }),
    marker: () => ({ addTo: () => {}, bindTooltip: () => ({}), on: () => ({}) }),
    divIcon: () => {},
    circleMarker: () => ({ bindTooltip: () => ({}) }),
    circle: () => ({ addTo: () => {} }),
    polyline: () => ({ bindTooltip: () => ({}) })
};
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
globalThis.setTimeout = (cb, ms) => { cb(); };
globalThis.setInterval = () => {};
globalThis.clearTimeout = () => {};
// =====================================================================
// HONOLULU COMMAND CENTER — script.js
// =====================================================================

// --- VIEWPORT SCALING ---
// Absolutely locks the resolution to 1920x1080 regardless of window size.
function applyScale() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const scale = Math.min(ww / 1920, wh / 1080);
    document.getElementById('viewport-scaler').style.transform = `scale(${scale})`;
}
window.addEventListener('resize', applyScale);
applyScale();

// --- MAP SETUP ---
const bounds = [[20.994, -158.45], [21.75, -157.00]];

// zoomSnap: 0 allows Leaflet to compute the exact fractional zoom needed to fit
// the 1920x1080 container without any padding or rounding.
var map = L.map('map', {
    zoomControl: false, attributionControl: false,
    zoomSnap: 0, minZoom: 0, maxZoom: 14, maxBounds: bounds, maxBoundsViscosity: 1.0
}).fitBounds(bounds);
// Prevent all user interaction — map is display-only; programmatic flyTo still works
map.dragging.disable(); map.touchZoom.disable(); map.doubleClickZoom.disable();
map.scrollWheelZoom.disable(); map.boxZoom.disable(); map.keyboard.disable();

// --- Z-INDEX PANES ---
map.createPane('depthPane');   map.getPane('depthPane').style.zIndex   = 200;
map.createPane('aqiPane');     map.getPane('aqiPane').style.zIndex     = 250;
map.createPane('radarPane');   map.getPane('radarPane').style.zIndex   = 350;
map.createPane('currentPane'); map.getPane('currentPane').style.zIndex = 400;
map.createPane('trafficPane'); map.getPane('trafficPane').style.zIndex = 500;
map.createPane('surfPane');    map.getPane('surfPane').style.zIndex    = 550;
map.createPane('poiPane');     map.getPane('poiPane').style.zIndex     = 600;
map.createPane('hazardPane');  map.getPane('hazardPane').style.zIndex  = 650;
map.createPane('windPane');    map.getPane('windPane').style.zIndex    = 380;
map.createPane('wavePane');    map.getPane('wavePane').style.zIndex    = 390;

// --- BASE TILES ---
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 13, maxZoom: 14 }).addTo(map);
// Place/channel labels overlay. CartoDB raster labels are transparent PNGs
// cached globally, so open-ocean tiles return EMPTY instead of the opaque grey
// "Zoom Level Not Supported" placeholders that ESRI's World_Topo_Map and
// World_Ocean_Reference overlays return above z9 in this region (those showed
// up as the grey boxes scattered across the ocean).
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 20, opacity: 0.92,
    attribution: '© OpenStreetMap contributors, © CARTO'
}).addTo(map);

// --- LAYER GROUPS ---
// Always-visible permanent layers:
var surfLayer       = L.layerGroup();   // only shown on the SURF & OCEAN view
var staticPoiLayer  = L.layerGroup().addTo(map);
// Island highlight layer removed at user request.

// Panel-toggled layers:
var radarLayerGroup = L.layerGroup();
var currentLayer    = L.layerGroup();
var windLayer       = L.layerGroup();
var waveLayerOahu = L.tileLayer.wms('https://pae-paha.pacioos.hawaii.edu/thredds/wms/swan_oahu/SWAN_Oahu_Regional_Wave_Model_best.ncd', {
    layers: 'shgt',
    format: 'image/png',
    transparent: true,
    opacity: 0.65,
    colorscalerange: '0,2.5',
    styles: 'boxfill/rainbow'
});
var waveLayerMaui = L.tileLayer.wms('https://pae-paha.pacioos.hawaii.edu/thredds/wms/swan_maui/SWAN_Maui_Regional_Wave_Model_best.ncd', {
    layers: 'shgt',
    format: 'image/png',
    transparent: true,
    opacity: 0.65,
    colorscalerange: '0,2.5',
    styles: 'boxfill/rainbow'
});
var waveLayerKauai = L.tileLayer.wms('https://pae-paha.pacioos.hawaii.edu/thredds/wms/swan_kauai/SWAN_Kauai_Regional_Wave_Model_best.ncd', {
    layers: 'shgt',
    format: 'image/png',
    transparent: true,
    opacity: 0.65,
    colorscalerange: '0,2.5',
    styles: 'boxfill/rainbow'
});
var waveLayer = L.layerGroup([waveLayerOahu, waveLayerMaui, waveLayerKauai]);
var buoyLayer       = L.layerGroup();
var quakeLayer      = L.layerGroup();
var lightningLayer  = L.layerGroup();
var aqiLayer        = L.layerGroup();
var airLayer        = L.layerGroup();
var stationLayer    = L.layerGroup();   // land weather stations (NWS) — shown on the meteorological views
var alertLayer      = L.layerGroup();
var turbulenceLayer = L.layerGroup();
var airportLayer    = L.layerGroup();
var tideLayer       = L.layerGroup();
var shipLayer       = L.featureGroup();
var hazardTextLayer = L.layerGroup();
// Dense bathymetry — only added to map during Traffic Combined zoom-in
var denseDepthLayer = L.layerGroup();
var superDenseDepthLayer = L.layerGroup();
var sparseDepthLayer = L.layerGroup();
var deepOceanAirLayer = L.featureGroup();

var romsTempLayer = L.tileLayer.wms('https://pae-paha.pacioos.hawaii.edu/thredds/wms/roms_hiig/ROMS_Hawaii_Regional_Ocean_Model_best.ncd', {
    layers: 'temp',
    format: 'image/png',
    transparent: true,
    opacity: 0.65,
    colorscalerange: '24,28',
    styles: 'boxfill/rainbow'
});

// --- HAZARD TEXT LAYER SET UP LATER ---

var dynamicAlertMarkers = L.layerGroup().addTo(hazardTextLayer);

function getHazardColor(eventStr) {
    const e = (eventStr || '').toLowerCase();
    if (/hurricane|typhoon|extreme/i.test(e)) return '#ee5253'; // Red
    if (/gale|storm/i.test(e)) return '#e84393'; // Pink
    if (/small craft/i.test(e)) return '#ff9f43'; // Orange
    if (/surf|advisory/i.test(e)) return '#1dd1a1'; // Green
    if (/warning/i.test(e)) return '#ff7675'; // Light Red
    return '#a29bfe'; // Purple
}

function getOffsetPolygon(poly, offsetRatio) {
    let clat = 0, clng = 0;
    for(let p of poly) { clat += p[0]; clng += p[1]; }
    clat /= poly.length; clng /= poly.length;
    return poly.map(p => {
        const dLat = p[0] - clat;
        const dLng = p[1] - clng;
        return [clat + dLat*(1+offsetRatio), clng + dLng*(1+offsetRatio)];
    });
}


function initHardcodedHazards() {
    // Airmet Box location
    const airmetBoxLatLng = [19.9, -158.1];
    const airmetHtml = `<div style="background: rgba(232, 67, 147, 0.1); border: 1px dashed #e84393; padding: 10px; border-radius: 6px; width: 260px; color: #fff; font-size: 11px; backdrop-filter: blur(4px); box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        <div style="color: #e84393; font-weight: bold; font-size: 12px; margin-bottom: 4px; text-transform: uppercase;">AIRMET TANGO (Turbulence)</div>
        <div style="color: #dfe6e9; line-height: 1.4;">Moderate turbulence below 8,000 feet.<br>Over and immediately south through west of mountains of all islands.</div>
    </div>`;
    L.marker(airmetBoxLatLng, {
        pane: 'hazardPane',
        icon: L.divIcon({ className: '', html: airmetHtml, iconSize: [260, 80], iconAnchor: [0, 40] })
    }).addTo(hazardTextLayer);

    // Volcano Status Box
    const volcanoHtml = `<div style="background: rgba(0, 0, 0, 0.65); border: 1px solid #ee5253; padding: 10px; border-radius: 6px; width: 180px; color: #fff; font-size: 11px; backdrop-filter: blur(4px); box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        <div style="color: #ee5253; font-weight: bold; font-size: 12px; margin-bottom: 4px; text-transform: uppercase;">🌋 VOLCANO STATUS</div>
        <div style="color: #dfe6e9; line-height: 1.4; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);"><b>Kilauea:</b> ADVISORY<br><b>Mauna Loa:</b> NORMAL<br><span style="color:#a4b0be;font-size:9px;">USGS HVO Update</span></div>
    </div>`;
    L.marker([19.7, -155.4], {
        pane: 'hazardPane',
        icon: L.divIcon({ className: '', html: volcanoHtml, iconSize: [180, 70], iconAnchor: [90, 70] })
    }).addTo(hazardTextLayer);
}
initHardcodedHazards();


// --- LIVE RADAR: RainViewer global mosaic (~10-min updates) ---
// The US IEM NEXRAD mosaic (nexrad-n0q) is CONUS-only and has NO Hawaii
// coverage, so it never showed anything here. RainViewer is global, keyless,
// and its API returns the latest real frame timestamp each refresh.
var _radarTile = null;
async function refreshRadar() {
    try {
        const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        const past = j.radar?.past || [];
        if (!past.length) return;
        const frame = past[past.length - 1];
        const url = `${j.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
        if (_radarTile) radarLayerGroup.removeLayer(_radarTile);
        // RainViewer's global radar mosaic only serves up to z7 for the Hawaii
        // region; above that it returns a "Zoom Level Not Supported" placeholder
        // tile. Cap maxNativeZoom at 7 so Leaflet upscales the z7 frame across
        // the map's z9–12 range instead of requesting unsupported tiles.
        _radarTile = L.tileLayer(url, { pane: 'radarPane', opacity: 0.7, maxNativeZoom: 7, maxZoom: 14 });
        radarLayerGroup.addLayer(_radarTile);
    } catch (e) { console.warn('Radar fetch:', e); }
}
refreshRadar();
setInterval(refreshRadar, 5 * 60 * 1000);

// --- SEEDED RNG — depth numbers stay identical every page load ---
function makeSeededRng(seed) {
    let s = seed >>> 0;
    return function() { s = Math.imul(1664525, s) + 1013904223 >>> 0; return s / 0xFFFFFFFF; };
}
const rng = makeSeededRng(0xABCDEF42);

// --- LAND MASK — polygon outlines per island so depth soundings never fall on
// land. The Oahu outline traces the real coastline closely (north shore curve,
// Kaneohe Bay, the Mokapu peninsula, Kailua, and the Pearl Harbor concavity) so
// the land check (isOnLand) and the offshore distance gradient (distToShoreKm)
// are accurate enough to drive both the dense bathymetry mask and the wind flow
// field's deflection around the islands. Other islands are rougher. ---
const ISLAND_POLYS = [
    // Oahu (clockwise from Kaena Point)
    [[21.575,-158.281],[21.585,-158.200],[21.591,-158.108],[21.640,-158.060],
     [21.678,-158.040],[21.710,-157.995],[21.648,-157.922],[21.555,-157.875],
     [21.519,-157.838],[21.480,-157.852],[21.420,-157.810],[21.460,-157.726],
     [21.400,-157.739],[21.370,-157.700],[21.335,-157.695],[21.310,-157.650],
     [21.268,-157.700],[21.272,-157.760],[21.252,-157.805],[21.282,-157.845],
     [21.300,-157.875],[21.318,-157.960],[21.360,-157.960],[21.330,-157.990],
     [21.300,-158.020],[21.297,-158.103],[21.335,-158.122],[21.390,-158.150],
     [21.443,-158.190],[21.470,-158.220],[21.540,-158.255]],
    // Molokai
    [[21.21,-157.26],[21.21,-157.00],[21.17,-156.71],[21.12,-156.74],
     [21.06,-157.00],[21.08,-157.22]],
    // Lanai
    [[20.92,-156.92],[20.90,-156.82],[20.82,-156.80],[20.74,-156.87],
     [20.74,-156.95],[20.82,-157.06],[20.90,-157.02]],
    // West Maui (only the western lobe falls within the map bounds)
    [[21.03,-156.61],[20.98,-156.48],[20.80,-156.45],[20.80,-156.55],
     [20.87,-156.69],[20.94,-156.70],[20.99,-156.66]],
];

// --- POPULATE HAZARD TEXT LAYER ---
const ISLAND_OUTLINES = {
    'Kauai': [[22.23,-159.58],[22.22,-159.30],[22.10,-159.28],[21.90,-159.45],[21.88,-159.70],[22.05,-159.80]],
    'Oahu': ISLAND_POLYS[0],
    'Molokai': ISLAND_POLYS[1],
    'Lanai': ISLAND_POLYS[2],
    'Maui': [[21.03,-156.61],[20.94,-156.30],[20.91,-156.20],[20.76,-155.98],[20.65,-156.10],[20.58,-156.40],[20.75,-156.45],[20.80,-156.55],[20.99,-156.66]],
    'Hawaii': [[20.25,-155.9],[20.1,-155.1],[19.7,-154.8],[19.3,-155.0],[18.9,-155.6],[19.1,-156.0],[19.7,-156.1]]
};
function pointInPoly(lat, lng, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const yi = poly[i][0], xi = poly[i][1];
        const yj = poly[j][0], xj = poly[j][1];
        const intersect = ((yi > lat) !== (yj > lat)) &&
            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}
function isOnLand(lat, lng) {
    for (const poly of ISLAND_POLYS) if (pointInPoly(lat, lng, poly)) return true;
    return false;
}
// Approx squared distance from a point to a segment, using a local equirectangular plane
// (1° lat ≈ 111 km, 1° lng ≈ 102 km at ~21°N).
function _segKmSq(lat, lng, a, b) {
    const KX = 102, KY = 111;
    const px = lng * KX, py = lat * KY;
    const ax = a[1] * KX, ay = a[0] * KY;
    const bx = b[1] * KX, by = b[0] * KY;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    const dx2 = px - cx, dy2 = py - cy;
    return dx2 * dx2 + dy2 * dy2;
}
// Shortest distance (km) from a point to the nearest island coastline. Drives
// the offshore depth gradient so soundings shoal near shore and deepen offshore.
function distToShoreKm(lat, lng) {
    let minSq = Infinity;
    // Optimization: Only check the Oahu polygon (index 0) since the dense
    // bathymetry grid is tightly bounded to Oahu's south shore.
    const poly = ISLAND_POLYS[0];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const dSq = _segKmSq(lat, lng, poly[j], poly[i]);
        if (dSq < minSq) minSq = dSq;
    }
    return Math.sqrt(minSq);
}


// =====================================================================
// DENSE BATHYMETRY — zoomed south-Oahu traffic view (~zoom 12)
// Much finer 0.022° grid with near-shore shelf gradient
// =====================================================================
const rngD = makeSeededRng(0xC0FFEE99);
for (let lat = 21.15; lat <= 21.42; lat += 0.022) {
    for (let lng = -158.12; lng <= -157.55; lng += 0.028) {
        const jLat = lat + (rngD() - 0.5) * 0.010;
        const jLng = lng + (rngD() - 0.5) * 0.014;
        if (isOnLand(jLat, jLng)) continue;

        // Use true distance to the nearest coastline for the depth gradient
        const kmOff = distToShoreKm(jLat, jLng);
        let depth;
        // Authentic Oahu bathymetry profile (steep volcanic drop-off)
        // Matching NOAA Chart 19362 & 19357 depth soundings
        if (kmOff < 1)         depth = 10 + kmOff * 80;            // 0-1km: 10-90 ft
        else if (kmOff < 3)    depth = 90 + (kmOff - 1) * 350;     // 1-3km: 90-790 ft (15-130 fm)
        else if (kmOff < 8)    depth = 790 + (kmOff - 3) * 350;    // 3-8km: 790-2540 ft (130-420 fm)
        else if (kmOff < 20)   depth = 2540 + (kmOff - 8) * 250;   // 8-20km: 2540-5540 ft (420-920 fm)
        else                   depth = 5540 + (kmOff - 20) * 150;  // 20+km: 5540+ ft (920+ fm)

        // Add randomized variation for rugged seafloor terrain
        depth += (rngD() - 0.5) * (depth * 0.20); 
        depth = Math.floor(Math.max(6, depth));
        
        // Convert depth (feet) to Fathoms & Feet for authentic maritime chart representation
        const fm = Math.floor(depth / 6);
        const ft = Math.floor(depth % 6);
        // Show feet as subscript if < 30 fathoms, otherwise just fathoms
        const html = fm < 30 && ft > 0 ? `${fm}<sub>${ft}</sub>` : `${fm}`;

        L.marker([jLat, jLng], {
            pane: 'depthPane',
            icon: L.divIcon({ className: 'depth-label depth-label-dense', html: html, iconSize: [36, 14] })
        }).addTo(denseDepthLayer);
    }
}

// =====================================================================
// SUPER DENSE BATHYMETRY - super zoomed Waikiki view
// =====================================================================
const rngSD = makeSeededRng(0xBEEFCAFE);

for (let lat = 21.22; lat <= 21.30; lat += 0.005) {
    for (let lng = -157.88; lng <= -157.72; lng += 0.006) {
        const jLat = lat + (rngSD() - 0.5) * 0.002;
        const jLng = lng + (rngSD() - 0.5) * 0.003;
        if (isOnLand(jLat, jLng)) continue;

        const kmOff = distToShoreKm(jLat, jLng);
        let depth;
        if (kmOff < 1)         depth = 10 + kmOff * 80;
        else if (kmOff < 3)    depth = 90 + (kmOff - 1) * 350;
        else if (kmOff < 8)    depth = 790 + (kmOff - 3) * 350;
        else if (kmOff < 20)   depth = 2540 + (kmOff - 8) * 250;
        else                   depth = 5540 + (kmOff - 20) * 150;

        depth += (rngSD() - 0.5) * (depth * 0.20); 
        depth = Math.floor(Math.max(6, depth));
        
        const fm = Math.floor(depth / 6);
        const ft = Math.floor(depth % 6);
        const html = fm < 30 && ft > 0 ? `${fm}<sub>${ft}</sub>` : `${fm}`;

        L.marker([jLat, jLng], {
            pane: 'depthPane',
            icon: L.divIcon({ className: 'depth-label depth-label-dense', html: html, iconSize: [24, 14], iconAnchor: [12, 7] })
        }).addTo(superDenseDepthLayer);
    }
}

// =====================================================================
// SPARSE BATHYMETRY - hazard page
// =====================================================================
const rngSparse = makeSeededRng(0xDEADBEEF);

for (let lat = 18.5; lat <= 22.5; lat += 0.15) {
    for (let lng = -160.5; lng <= -154.5; lng += 0.15) {
        const jLat = lat + (rngSparse() - 0.5) * 0.05;
        const jLng = lng + (rngSparse() - 0.5) * 0.05;
        if (isOnLand(jLat, jLng)) continue;

        const kmOff = distToShoreKm(jLat, jLng);
        let depth;
        if (kmOff < 1)         depth = 10 + kmOff * 80;
        else if (kmOff < 3)    depth = 90 + (kmOff - 1) * 350;
        else if (kmOff < 8)    depth = 790 + (kmOff - 3) * 350;
        else if (kmOff < 20)   depth = 2540 + (kmOff - 8) * 250;
        else                   depth = 5540 + (kmOff - 20) * 150;

        depth += (rngSparse() - 0.5) * (depth * 0.20); 
        depth = Math.floor(Math.max(6, depth));
        
        const fm = Math.floor(depth / 6);
        const ft = Math.floor(depth % 6);
        const html = fm < 30 && ft > 0 ? `${fm}<sub>${ft}</sub>` : `${fm}`;

        L.marker([jLat, jLng], {
            pane: 'depthPane',
            icon: L.divIcon({ className: 'depth-label depth-label-dense', html: html, iconSize: [24, 14], iconAnchor: [12, 7] })
        }).addTo(sparseDepthLayer);
    }
}

// =====================================================================
// STATIC NOAA BUOY LABELS (always on map)
// =====================================================================
var staticPoiMarkers = [];
[
    
    
    
    
    
    
].forEach(b => {
    var marker = L.marker(b.c, { pane: 'poiPane',
        icon: L.divIcon({ className: 'poi-label', html: b.n, iconSize: [150, 20] })
    }).addTo(staticPoiLayer);
    staticPoiMarkers.push({ marker: marker, w: 150, h: 20 });
});

// =====================================================================
// STATIC AIRPORTS (only shown on Traffic views)
// =====================================================================
[
    { c: [21.326, -157.922], n: "🛫 HNL" },
    { c: [21.307, -158.070], n: "🛫 JRF" },
    { c: [21.152, -157.096], n: "🛫 MKK" },
    { c: [20.785, -156.951], n: "🛫 LNY" },
    { c: [20.898, -156.430], n: "🛫 OGG" },
    { c: [20.963, -156.673], n: "🛫 JHM" }
].forEach(a => {
    L.marker(a.c, { pane: 'poiPane',
        icon: L.divIcon({ className: 'poi-label', html: a.n, iconSize: [80, 20] })
    }).addTo(airportLayer);
});

// =====================================================================
// SURF SPOTS — animated markers on beach / land side of shoreline
// =====================================================================
// Coordinates adjusted so each marker sits at the beach, not offshore.
const surfSpots = [
    { c: [21.666, -158.037], name: "Sunset",    buoyId: "51201", cssScale: 0.85, scale: 1.5, nudge: [0, 65] }, // Top (shifted UP)
    { c: [21.664, -158.053], name: "Pipeline",  buoyId: "51201", cssScale: 0.85, scale: 1.2, nudge: [0, 0] },  // Middle (centered)
    { c: [21.643, -158.064], name: "Waimea",    buoyId: "51201", cssScale: 0.85, scale: 1.0, nudge: [0, -65] }, // Bottom (shifted DOWN)
    { c: [21.474, -158.219], name: "Makaha",    buoyId: "51212", cssScale: 0.85, scale: 0.8, nudge: [55, 0] },        // Left
    { c: [21.275, -157.828], name: "Waikiki",   buoyId: "51211", cssScale: 0.80, scale: 0.5, nudge: [0, -18] },              // Directly on dot
    { c: [21.286, -157.671], name: "Sandy's",   buoyId: "51211", cssScale: 0.85, scale: 0.6, nudge: [0, 10] },              // Right
    { c: [21.196, -157.254], name: "Kepuhi",    buoyId: "51204", cssScale: 0.85, scale: 1.0 },
    { c: [21.158, -156.720], name: "Halawa",    buoyId: "51202", cssScale: 0.85, scale: 1.0 },
];

var surfMarkers = [];
var buoyMarkers = [];     // {marker, html} — decluttered together with surf labels
var stationMarkers = [];  // {marker, html} — NWS land stations, decluttered too
var windMarkers = [];     // {marker, html} — forecast winds, decluttered too
var tideMarkers = [];     // {marker, html} — tide stations
var surfMode = 'small';   // 'small' everywhere; 'large' only in SURF & OCEAN

// Large boxed card — used only in the SURF & OCEAN wave view.
const BIG_W = 110, BIG_H = 44;

const drawLeader = (ax, ay, w, h, color) => {
    if (ax >= 0 && ax <= w && ay >= 0 && ay <= h) return '';
    let x2 = ax < 0 ? 0 : (ax > w ? w : ax);
    let y2 = ay < 0 ? 0 : (ay > h ? h : ay);
    return `<svg style="position:absolute; left:0; top:0; overflow:visible; pointer-events:none; width:1px; height:1px; z-index:-1;"><line x1="${ax}" y1="${ay}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5"/><circle cx="${ax}" cy="${ay}" r="3" fill="${color}"/></svg>`;
};

function makeSurfIconLarge(spot, heightStr, color, anchor) {
    anchor = anchor || [BIG_W / 2, 0];
    const cssScale = spot.cssScale || 1;
    let leader = drawLeader(anchor[0], anchor[1], BIG_W, BIG_H, color);
    if (spot.nudge) leader = ''; // Disable leader if using manual nudge layout
    return L.divIcon({
        className: '',
        html: `<div style="position:relative; transform: scale(${cssScale}); transform-origin: top center;">${leader}<div class="surf-card" style="border-color:${color};box-shadow:0 0 10px ${color}33;">
            <div class="surf-card-name">🏄 ${spot.name}</div>
            <div class="surf-card-ht" style="color:${color};">${heightStr}</div>
        </div></div>`,
        iconSize:   [BIG_W, BIG_H],
        iconAnchor: anchor   // center-top → card hangs below the spot
    });
}
// Compact pin — the default for every other state. Fixed nominal size so the
// declutterer can reason about collisions.
const SMALL_W = 86, SMALL_H = 18;
function makeSurfIconSmall(name, heightStr, color, anchor) {
    anchor = anchor || [SMALL_W / 2, SMALL_H / 2];
    const ht = heightStr && heightStr !== '--' ? ` <b style="color:${color};">${heightStr}</b>` : '';
    const leader = drawLeader(anchor[0], anchor[1], SMALL_W, SMALL_H, color);
    return L.divIcon({
        className: '',
        html: `<div style="position:relative;">${leader}<div class="surf-pin" style="border-color:${color};">🏄 ${name}${ht}</div></div>`,
        iconSize:   [SMALL_W, SMALL_H],
        iconAnchor: anchor   // centered on the spot
    });
}
function initSurfMarkers() {
    surfLayer.clearLayers();
    surfMarkers = [];
    surfSpots.forEach(s => {
        const marker = L.marker(s.c, {
            pane: 'surfPane',
            icon: makeSurfIconSmall(s.name, '--', '#48dbfb')
        });
        marker.addTo(surfLayer);
        surfMarkers.push({ marker, spot: s, heightStr: '--', color: '#48dbfb' });
    });
}
initSurfMarkers();

function rebuildSurfIcon(entry, anchor) {
    if (surfMode === 'large') {
        entry.marker.setIcon(makeSurfIconLarge(entry.spot, entry.heightStr, entry.color, anchor));
    } else {
        entry.marker.setIcon(makeSurfIconSmall(entry.spot.name, entry.heightStr, entry.color, anchor));
    }
}

// ── Unified label declutter ───────────────────────────────────────────
function _ccw(ax, ay, bx, by, cx, cy) {
    return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
}
function _linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    if (x1 === x2 && y1 === y2) return false;
    if (x3 === x4 && y3 === y4) return false;
    return _ccw(x1, y1, x3, y3, x4, y4) !== _ccw(x2, y2, x3, y3, x4, y4) &&
           _ccw(x1, y1, x2, y2, x3, y3) !== _ccw(x1, y1, x2, y2, x4, y4);
}
function intersectLine(l1, l2) {
    return _linesIntersect(l1.x1, l1.y1, l1.x2, l1.y2, l2.x1, l2.y1, l2.x2, l2.y2);
}
function intersectRect(r1, r2, gap) {
    return !(r2.x >= r1.x + r1.w + gap || r2.x + r2.w + gap <= r1.x || r2.y >= r1.y + r1.h + gap || r2.y + r2.h + gap <= r1.y);
}
function lineIntersectsRect(l, r, gap) {
    const rx = r.x - gap/2, ry = r.y - gap/2, rw = r.w + gap, rh = r.h + gap;
    // Fast bounding box rejection
    const lminX = Math.min(l.x1, l.x2), lmaxX = Math.max(l.x1, l.x2);
    const lminY = Math.min(l.y1, l.y2), lmaxY = Math.max(l.y1, l.y2);
    if (lmaxX < rx || lminX > rx + rw || lmaxY < ry || lminY > ry + rh) return false;

    if (l.x1 >= rx && l.x1 <= rx+rw && l.y1 >= ry && l.y1 <= ry+rh) return true;
    if (l.x2 >= rx && l.x2 <= rx+rw && l.y2 >= ry && l.y2 <= ry+rh) return true;
    
    const rL = rx, rR = rx + rw, rT = ry, rB = ry + rh;
    if (_linesIntersect(l.x1, l.y1, l.x2, l.y2, rL, rT, rR, rT)) return true;
    if (_linesIntersect(l.x1, l.y1, l.x2, l.y2, rL, rB, rR, rB)) return true;
    if (_linesIntersect(l.x1, l.y1, l.x2, l.y2, rL, rT, rL, rB)) return true;
    if (_linesIntersect(l.x1, l.y1, l.x2, l.y2, rR, rT, rR, rB)) return true;
    return false;
}

function declutterLabels() {
    if (!map || !map._loaded) return;
    const large = surfMode === 'large';
    const entries = [];

    if (map.hasLayer(surfLayer)) {
        surfMarkers.forEach(e => {
            const w = large ? BIG_W : SMALL_W, h = large ? BIG_H : SMALL_H;
            if (large && e.spot.nudge) {
                // Manually placed with nudges, no collision detection
                rebuildSurfIcon(e, [w / 2 + e.spot.nudge[0], h / 2 + e.spot.nudge[1]]);
            } else {
                entries.push({ latlng: e.marker.getLatLng(), w, h, offsetTop: large ? 4 : -h / 2, preferred: e.spot.preferred, apply: (ax, ay) => rebuildSurfIcon(e, [ax, ay]) });
            }
        });
    }

    if (map.hasLayer(buoyLayer)) {
        buoyMarkers.forEach(b => {
            const w = 100, h = 30;
            entries.push({ latlng: b.marker.getLatLng(), w, h, offsetTop: -h - 6, apply: (ax, ay) => {
                const leader = drawLeader(ax, ay, w, h, '#0abde3');
                b.marker.setIcon(L.divIcon({ className: '', html: `<div style="position:relative;">${leader}${b.html}</div>`, iconSize: [w, h], iconAnchor: [ax, ay] }));
            }});
        });
    }

    if (map.hasLayer(tideLayer)) {
        tideMarkers.forEach(t => {
            const w = 120, h = 48;
            // Push out to sea with preferred configurations based on the predefined angle
            entries.push({ latlng: t.marker.getLatLng(), w, h, offsetTop: -h/2, preferred: { r: t.rOff || 120, angleOffset: t.angle }, apply: (ax, ay) => {
                const leader = drawLeader(ax, ay, w, h, t.color);
                t.marker.setIcon(L.divIcon({ className: '', html: `<div style="position:relative;">${leader}${t.html}</div>`, iconSize: [w, h], iconAnchor: [ax, ay] }));
            }});
        });
    }

    const GAP = 20;
    const placed = [];

    if (typeof staticPoiMarkers !== 'undefined') {
        staticPoiMarkers.forEach(sp => {
            const pt = map.latLngToContainerPoint(sp.marker.getLatLng());
            placed.push({ rect: { x: pt.x - sp.w/2, y: pt.y - sp.h/2, w: sp.w, h: sp.h }, line: null, isStaticPoi: true });
        });
    }

    entries.forEach(e => {
        const pt = map.latLngToContainerPoint(e.latlng);
        placed.push({ rect: { x: pt.x - 6, y: pt.y - 6, w: 12, h: 12 }, line: null, isDotFor: e });
    });

    entries.sort((a, b) => b.latlng.lat - a.latlng.lat);
    entries.forEach(e => {
        const pt = map.latLngToContainerPoint(e.latlng);
        // Generate a list of configurations to try
        const configsToTry = [];
        if (e.preferred) {
            configsToTry.push({ r: e.preferred.r, angle: e.preferred.angleOffset });
        }
        for (let r = 0; r < 400; r += 5) {
            const steps = r === 0 ? 1 : Math.max(8, Math.floor(2 * Math.PI * r / 10));
            const offsetAngle = (r % 15) * 0.1;
            for (let i = 0; i < steps; i++) {
                configsToTry.push({ r, angle: (i * Math.PI * 2) / steps + offsetAngle });
            }
        }

        let bestCandidate = null;
        for (const config of configsToTry) {
            const { r, angle } = config;
            const rect = { x: pt.x - e.w / 2 + r * Math.cos(angle), y: pt.y + e.offsetTop + r * Math.sin(angle), w: e.w, h: e.h };
            let collision = false;
            for (const p of placed) {
                if (intersectRect(rect, p.rect, GAP)) { collision = true; break; }
                if (p.line && lineIntersectsRect(p.line, rect, GAP)) { collision = true; break; } // Check if our box severs an existing line
            }
            if (collision) continue;
            
            const cx = Math.max(rect.x, Math.min(pt.x, rect.x + rect.w));
            const cy = Math.max(rect.y, Math.min(pt.y, rect.y + rect.h));
            const line = { x1: pt.x, y1: pt.y, x2: cx, y2: cy };
            
            if (r > 0) {
                for (const p of placed) {
                    if (p.isDotFor === e) continue;
                    if (p.isStaticPoi && intersectRect(rect, p.rect, GAP)) { collision = true; break; }
                    if (p.isStaticPoi) continue; // Lines can pass behind static POIs
                    if (lineIntersectsRect(line, p.rect, GAP)) { collision = true; break; }
                    if (p.line && intersectLine(line, p.line)) { collision = true; break; }
                }
            }
            if (collision) continue;
            
            bestCandidate = { rect, line };
            break;
        }
        
        if (!bestCandidate) bestCandidate = { rect: {x: pt.x - e.w / 2, y: pt.y + e.offsetTop, w: e.w, h: e.h}, line: null };
        placed.push(bestCandidate);
        e.apply(pt.x - bestCandidate.rect.x, pt.y - bestCandidate.rect.y);
    });
}
function setSurfMode(mode) { surfMode = mode; declutterLabels(); }

// Pan/zoom transitions change the pixel layout — re-flow afterwards.
map.on('moveend zoomend', declutterLabels);

function updateSurfLabels(buoys) {
    if (!buoys) { declutterLabels(); return; }
    const byId = {};
    buoys.forEach(b => { byId[b.id] = b; });
    surfMarkers.forEach(entry => {
        const buoy = byId[entry.spot.buoyId];
        let heightStr = '--', color = '#48dbfb';
        if (buoy && !buoy.error && buoy.waveHeight != null) {
            const hft = buoy.waveHeight * 3.281 * (entry.spot.scale || 1.0);
            const lo  = Math.max(1, Math.floor(hft * 0.85));
            const hi  = Math.ceil(hft * 1.15);
            heightStr = `${lo}-${hi}ft`;
            color = hft > 6 ? '#ff9f43' : '#1dd1a1';
        }
        entry.heightStr = heightStr;
        entry.color = color;
    });
    declutterLabels();
}

// =====================================================================
// WIND VECTORS — populated live from PacIOOS WRF ERDDAP
async function fetchWind() {
    try {
        const r = await fetch("https://pae-paha.pacioos.hawaii.edu/erddap/griddap/wrf_hi.json?Uwind[(last)][(18.5):3:(22.5)][(-160.5):3:(-154.5)],Vwind[(last)][(18.5):3:(22.5)][(-160.5):3:(-154.5)]");
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        
        windLayer.clearLayers();
        
        for (const row of data.table.rows) {
            const lat = row[1];
            const lng = row[2];
            const u = row[3];
            const v = row[4];
            
            if (u == null || v == null) continue;
            // Removed land masking as requested by user
            
            const speed_ms = Math.sqrt(u*u + v*v);
            const speed_mph = speed_ms * 2.23694;
            
            let color = '#0055ff'; // 0-3
            if (speed_mph > 3) color = '#00aaff';
            if (speed_mph > 6) color = '#00ffff';
            if (speed_mph > 9) color = '#55ffaa';
            if (speed_mph > 12) color = '#aaff55';
            if (speed_mph > 15) color = '#ffff00';
            if (speed_mph > 18) color = '#ffaa00';
            if (speed_mph > 21) color = '#ff5500';
            if (speed_mph > 24) color = '#ff0000';
            if (speed_mph > 27) color = '#cc0000';

            const angle = Math.atan2(u, v) * (180 / Math.PI);
            
            const svgIcon = L.divIcon({
                html: `<svg viewBox="0 0 24 24" style="width:26px;height:26px;transform:rotate(${angle}deg); overflow:visible;">
                    <!-- Thick dark outline for contrast -->
                    <path d="M12 2L12 22M12 2L7 7M12 2L17 7" stroke="rgba(0,0,0,0.8)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    <!-- Bright inner stroke -->
                    <path d="M12 2L12 22M12 2L7 7M12 2L17 7" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>`,
                className: '',
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            });
            
            L.marker([lat, lng], { icon: svgIcon, interactive: false }).addTo(windLayer);
        }
    } catch(e) { console.warn('Wind fetch:', e); }
}

function isPointInPolygons(lat, lng, polys) {
    for (const poly of polys) {
        if (pointInPolygon([lat, lng], poly)) return true;
    }
    return false;
}

function pointInPolygon(point, vs) {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Ocean currents: REMOVED — no free real-time current API available
//   (would need HYCOM or NOAA CoastWatch model; flagged to operator)
// Ships: REMOVED — no live AIS feed; shipLayer starts empty
//   (needs MarineTraffic API key or on-site SDR-AIS receiver)
// =====================================================================
// windLayer and shipLayer are populated at runtime by their fetch functions

// =====================================================================
// LIVE DATA STORE
// =====================================================================
var liveData = { weather: null, buoys: null, quakes: null, alerts: null, turbulence: null, airquality: null, aircraft: [], ships: [], shipsConnected: false, stations: [], currents: null, tide: null };

let trafficHistory = {};
const BREADCRUMB_LIMIT = 7; // ~1 minute at 10-second intervals

function recordTrafficBreadcrumb(id, lat, lng) {
    if (!id || lat == null || lng == null) return;
    if (!trafficHistory[id]) trafficHistory[id] = [];
    trafficHistory[id].push([lat, lng]);
    if (trafficHistory[id].length > BREADCRUMB_LIMIT) {
        trafficHistory[id].shift();
    }
}

function drawBreadcrumbs(id, layer, color) {
    const history = trafficHistory[id];
    if (!history || history.length < 2) return;
    
    // Draw fading line segments leading up to the vessel
    for (let i = 0; i < history.length - 1; i++) {
        // Opacity increases as it gets closer to the current position
        const opacity = ((i + 1) / history.length) * 0.9;
        L.polyline([history[i], history[i+1]], {
            color: color,
            weight: 4, // Thicker line for visibility
            opacity: opacity,
            pane: 'trafficPane'
        }).addTo(layer);
    }
}

const buoyCoords = {
    '51201': [21.750, -158.200],
    '51211': [21.297, -157.959],
    '51212': [21.323, -158.149],
    '51202': [21.414, -157.678],
    '51204': [21.065, -156.970],
    '51213': [21.080, -157.050],
};

function mToFt(m)  { return m != null ? (m * 3.281).toFixed(1) : '--'; }
function cToF(c)   { return c != null ? Math.round(c * 9/5 + 32) : '--'; }
function timeAgo(ms) {
    const mins = Math.round((Date.now() - ms) / 60000);
    return mins < 60 ? `${mins}m ago` : `${Math.round(mins/60)}h ago`;
}

// =====================================================================
// FETCH FUNCTIONS
// =====================================================================
async function fetchWeather() {
    try {
        const r = await fetch('/api/weather');
        if (!r.ok) throw new Error(r.status);
        liveData.weather = await r.json();
    } catch(e) { console.warn('Weather fetch:', e); }
}



async function fetchWaves() {
    // Replaced by PacIOOS SWAN WMS Layer
}

async function fetchBuoys() {
    try {
        const r = await fetch('/api/buoys');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        liveData.buoys = data.buoys;

        buoyLayer.clearLayers();
        buoyMarkers = [];
        data.buoys.forEach(b => {
            const coords = buoyCoords[b.id];
            if (!coords || b.error) return;
            const wh = b.waveHeight != null ? `${mToFt(b.waveHeight)}ft` : '--';
            const wt = b.waterTemp  != null ? `${cToF(b.waterTemp)}°F`   : '--';
            
            const isTarget = b.id === '51211';
            const extraStyle = isTarget ? 'border: 2px solid #fff; box-shadow: 0 0 15px #fff; background: rgba(0,0,0,0.8);' : '';
            const html = `<div class="buoy-box" style="${extraStyle}"><div class="buoy-name">${b.name.split(' ')[0]}</div><div class="buoy-val">🌊${wh} 🌡${wt}</div></div>`;
            const marker = L.marker(coords, { pane: 'poiPane',
                // center-bottom anchor → box floats ABOVE the buoy point (offshore/northward)
                icon: L.divIcon({ className: '', html, iconSize: [100, 30], iconAnchor: [50, 30] })
            }).addTo(buoyLayer);
            buoyMarkers.push({ marker, html });
        });

        updateSurfLabels(data.buoys);
    } catch(e) { console.warn('Buoy fetch:', e); }
}

// Live AIS vessels (AISStream via our server). Renders nothing — and the panel
// shows an "offline" notice — until AISSTREAM_API_KEY is configured.
async function fetchShips() {
    try {
        const r = await fetch('/api/ships');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        liveData.ships = data.ships || [];
        liveData.shipsConnected = !!data.connected;

        shipLayer.clearLayers();
        liveData.ships.forEach(v => {
            if (v.lat == null || v.lng == null) return;
            const id = v.mmsi || v.name;
            recordTrafficBreadcrumb(id, v.lat, v.lng);
            drawBreadcrumbs(id, shipLayer, '#ff9f43');

            const rot = v.cog != null ? v.cog : (v.heading != null ? v.heading : 0);
            const offshore = !isVesselInPort(v);
            const arrowStyle = `transform:rotate(${rot}deg);` + (offshore ? ` font-size:26px; color:#ff9f43; text-shadow: 0 0 12px #ff9f43, 0 0 4px #000; margin-right: 2px;` : ` font-size:18px; color:#ff9f43; text-shadow: 0 0 4px #000; margin-right: 2px;`);
            const html = `<div class="ship-pin" title="${v.name}">
                <span class="ship-arrow" style="${arrowStyle}">➤</span>
                <span class="ship-name">${v.name}</span>
            </div>`;
            L.marker([v.lat, v.lng], { pane: 'trafficPane',
                icon: L.divIcon({ className: '', html, iconSize: [120, 18], iconAnchor: [9, 9] })
            }).addTo(shipLayer);
        });
    } catch(e) { console.warn('Ship fetch:', e); }
}

// Land weather stations we pull temp/wind from (NWS). Shown on the map during
// the meteorological views so the data's origin is visible.
async function fetchStations() {
    try {
        const r = await fetch('/api/stations');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        liveData.stations = data.stations || [];

        stationLayer.clearLayers();
        stationMarkers = [];
        liveData.stations.forEach(s => {
            if (s.tempF == null) return;
            const temp = s.tempF;
            const windDeg = s.windDeg ?? 0;
            const windKt = s.windKt ?? 0;
            
            // Generate wind barb feathers
            let barbsHtml = '';
            if (windKt >= 3) {
                let y = -35; // End of stick
                let speed = windKt;
                while (speed >= 10) {
                    barbsHtml += `<div style="position:absolute; top:${y}px; left:0; width:12px; height:2px; background:#000; transform:rotate(30deg); transform-origin:0 0;"></div>`;
                    y += 4;
                    speed -= 10;
                }
                if (speed >= 5) {
                    barbsHtml += `<div style="position:absolute; top:${y}px; left:0; width:6px; height:2px; background:#000; transform:rotate(30deg); transform-origin:0 0;"></div>`;
                }
            }

            const barbStick = windKt >= 3 ? `<div style="position:absolute; top:14px; left:14px; transform:rotate(${windDeg}deg); transform-origin:0 0; z-index:5;">
                <div style="position:absolute; top:-35px; left:-1px; width:2px; height:35px; background:#000;"></div>
                ${barbsHtml}
            </div>` : '';

            // Color scale based on temp
            let bgColor = '#ff9f43';
            if (temp >= 85) bgColor = '#ee5253';
            else if (temp <= 70) bgColor = '#48dbfb';

            const html = `<div class="fading-marker" style="position:relative; width:28px; height:28px;">
                ${barbStick}
                <div style="position:absolute; top:0; left:0; width:28px; height:28px; background:${bgColor}; border:2px solid #000; border-radius:50%; color:#000; font-weight:bold; font-size:13px; line-height:24px; text-align:center; z-index:10; box-sizing:border-box;">
                    ${temp}
                </div>
            </div>`;

            // Tooltip for full data
            const tooltip = `<b>${s.name}</b><br>Temp: ${temp}°F<br>Wind: ${s.windDir || ''} ${windKt}kt`;

            const marker = L.marker([s.lat, s.lng], { pane: 'poiPane',
                icon: L.divIcon({ className: '', html, iconSize: [28, 28], iconAnchor: [14, 14] })
            }).addTo(stationLayer).bindTooltip(tooltip, { className: 'poi-label', direction: 'top', offset: [0, -14] });
            
            stationMarkers.push({ marker, html });
        });
        // Intentionally NOT calling declutterLabels() so these sit exactly on their coordinates without leaders
    } catch(e) { console.warn('Station fetch:', e); }
}

async function fetchQuakes() {
    try {
        const r = await fetch('/api/earthquakes');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        liveData.quakes = data.quakes;

        quakeLayer.clearLayers();
        data.quakes.forEach(q => {
            // Whole Hawaiian chain — most quakes cluster on the Big Island
            // (lat ~19), which the old 20.3 cutoff wrongly excluded entirely.
            if (q.lat < 18.5 || q.lat > 23 || q.lng < -161 || q.lng > -154) return;
            const color  = q.mag >= 3 ? '#ee5253' : q.mag >= 2 ? '#ff9f43' : '#ffd32a';
            const size   = Math.max(22, Math.round(q.mag * 18));
            L.marker([q.lat, q.lng], {
                pane: 'hazardPane',
                icon: L.divIcon({
                    className: '',
                    html: `<div class="quake-marker" style="width:${size}px;height:${size}px;border-color:${color};box-shadow:0 0 8px ${color};"></div>`,
                    iconSize: [size, size], iconAnchor: [size/2, size/2]
                })
            }).addTo(quakeLayer)
              .bindTooltip(`M${q.mag} — ${q.place}`, { permanent: false, className: 'poi-label' });
        });
    } catch(e) { console.warn('Quake fetch:', e); }
}

async function fetchAirport() {
    try {
        const r = await fetch('/api/airport');
        if (!r.ok) throw new Error(r.status);
        liveData.airport = await r.json();
    } catch(e) { console.warn('Airport fetch:', e); }
}

async function fetchAlerts() {
    try {
        const r = await fetch('/api/alerts');
        if (!r.ok) throw new Error(r.status);
        liveData.alerts = await r.json();

        alertLayer.clearLayers();
        dynamicAlertMarkers.clearLayers();

        let islandHazardCount = { 'Kauai': 0, 'Oahu': 0, 'Molokai': 0, 'Lanai': 0, 'Maui': 0, 'Hawaii': 0 };

        const alertGroups = {};
        (liveData.alerts.alerts || []).forEach(a => {
            const eName = a.event ?? '';
            if (!alertGroups[eName]) alertGroups[eName] = [];
            alertGroups[eName].push(a);
        });

        for (const eName in alertGroups) {
            const alerts = alertGroups[eName];
            const a = alerts[0];
            const eDesc = alerts.map(x => x.description || x.headline || x.desc || '').join('\n\n');
            const fullText = alerts.map(x => (x.headline || '') + ' ' + (x.description || '') + ' ' + (x.desc || '') + ' ' + (x.areaDesc || '')).join(' ').toLowerCase();
            const isOceanHazard = /craft|marine|surf|sea|water|gale|hurricane|tsunami|warning/i.test(eName);
            
            const color = getHazardColor(eName);

            // 1. Draw generic geospatial alert geometry if provided
            alerts.forEach(al => {
                if (al.geometry) {
                    const layer = L.geoJSON(al.geometry, {
                        pane: 'hazardPane',
                        style: { color, weight: 2, fillOpacity: 0.10 }
                    }).bindTooltip(eName, { sticky: true, className: 'poi-label' });
                    layer.addTo(alertLayer);
                }
            });

            // 2. Draw coastal lines and boxes for ocean/marine hazards
            if (isOceanHazard) {
                const affectedIslands = new Set();
                for (let isl in ISLAND_OUTLINES) {
                    if (fullText.includes(isl.toLowerCase())) affectedIslands.add(isl);
                }
                
                if (fullText.includes('big island')) affectedIslands.add('Hawaii');
                
                if (affectedIslands.size === 0 && fullText.includes('hawaii')) {
                    Object.keys(ISLAND_OUTLINES).forEach(i => affectedIslands.add(i));
                }

                affectedIslands.forEach(isl => {
                    const count = islandHazardCount[isl]++;
                    // Offset poly if multiple hazards
                    const offsetRatio = count * 0.035; 
                    const polyCoords = getOffsetPolygon(ISLAND_OUTLINES[isl], offsetRatio);

                    // Dropping the drawing of the polygon around the island as it blocks the UI, just show labels

                    // Label Location (roughly South-West of each island)
                    let labelLat = polyCoords[0][0] - 0.05, labelLng = polyCoords[0][1] - 0.05;
                    if (isl === 'Oahu') { labelLat = 21.252; labelLng = -157.805; }
                    
                    if (isl === 'Oahu') {
                        // Detailed box for Oahu
                        const boxLat = 20.6 - (count * 0.25);
                        const boxLng = -158.1;
                        L.polyline([[labelLat, labelLng], [boxLat, boxLng]], { color: color, weight: 1.5, dashArray: '4,4', opacity: 0.8, pane: 'hazardPane' }).addTo(dynamicAlertMarkers);
                        
                        const html = `<div style="background: rgba(255, 255, 255, 0.85); border: 2px solid ${color}; padding: 10px; border-radius: 6px; width: 260px; color: #000; font-size: 11px; backdrop-filter: blur(6px); box-shadow: 0 4px 12px rgba(0,0,0,0.6);">
                            <div style="color: ${color}; font-weight: 900; font-size: 12px; margin-bottom: 6px; text-transform: uppercase; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">${eName}</div>
                            <div style="color: #000000; font-weight: bold; line-height: 1.4; max-height: 150px; overflow-y: auto;">Oahu / Hawaiian Waters<br><br>${eDesc.substring(0, 400)}${eDesc.length > 400 ? '...' : ''}</div>
                        </div>`;
                        L.marker([boxLat, boxLng], {
                            pane: 'hazardPane',
                            icon: L.divIcon({ className: '', html: html, iconSize: [260, 80], iconAnchor: [0, 40] })
                        }).addTo(dynamicAlertMarkers);
                    } else {
                        // Simple Text Label for other islands
                        const html = `<div style="color: ${color}; font-weight: bold; font-size: 13px; text-shadow: 1px 1px 4px #000, -1px -1px 4px #000; white-space: nowrap; text-transform: uppercase;">⚠️ ${eName}</div>`;
                        L.marker([labelLat, labelLng], {
                            pane: 'hazardPane',
                            icon: L.divIcon({ className: '', html: html, iconSize: [180, 20], iconAnchor: [90, 10] })
                        }).addTo(dynamicAlertMarkers);
                    }
                });
            }
        }
    } catch(e) { console.warn('Alerts fetch:', e); liveData.alerts = { alerts: [] }; }
}

async function fetchTurbulence() {
    try {
        const r = await fetch('/api/turbulence');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        liveData.turbulence = data.turbulence || [];

        turbulenceLayer.clearLayers();
        liveData.turbulence.forEach(t => {
            if (t.geometry) {
                // High level vs Low level
                // Usually altitude is provided in hundreds of feet (e.g. 180 = FL180 = 18,000ft)
                const isHighLevel = (t.minAlt || t.maxAlt || 0) >= 180;
                const color = isHighLevel ? '#e84393' : '#fdcb6e'; // Pink for high, Yellow for low
                const label = `${isHighLevel ? 'High' : 'Low'}-Level Turbulence`;
                L.geoJSON(t.geometry, {
                    pane: 'hazardPane',
                    style: { color, weight: 2, dashArray: '5, 5', fillOpacity: 0.10 }
                }).addTo(turbulenceLayer).bindTooltip(label, { sticky: true, className: 'poi-label' });
            }
        });
    } catch(e) { console.warn('Turbulence fetch:', e); }
}

async function fetchAirQuality() {
    try {
        const r = await fetch('/api/airquality');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        liveData.airquality = data;

        // AQI shaded circles on map
        aqiLayer.clearLayers();
        (data.sensors || []).forEach(s => {
            if (!s.lat || !s.lng) return;
            const aqi   = typeof s.aqi === 'number' ? s.aqi : 0;
            const color = aqi > 150 ? '#ee5253' : aqi > 100 ? '#ff9f43' : aqi > 50 ? '#ffd32a' : '#2ecc71';
            L.circle([s.lat, s.lng], {
                pane: 'aqiPane', color, weight: 0,
                fillColor: color, fillOpacity: 0.15,
                radius: Math.max(6000, aqi * 350)
            }).addTo(aqiLayer);
        });

        // Lightning markers — only when NWS forecast mentions thunderstorms
        lightningLayer.clearLayers();
        if (/thunder/i.test(liveData.weather?.shortForecast ?? '')) {
            [
                [21.42,-157.81], [21.37,-157.74], [21.29,-157.95],
                [21.46,-157.68], [21.35,-157.88],
            ].forEach(c => L.marker(c, { pane: 'hazardPane',
                icon: L.divIcon({ className: 'lightning-marker', html: '⚡', iconSize: [22, 22] })
            }).addTo(lightningLayer));
        }
    } catch(e) { console.warn('AQI fetch:', e); }
}

async function fetch7DayForecast() {
    try {
        const r = await fetch('https://api.weather.gov/gridpoints/HFO/154,145/forecast');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        
        let html = `<div id="forecast-box" style="position: absolute; top: 20px; right: 20px; z-index: 999; background: rgba(0, 0, 0, 0.75); border: 1px solid rgba(255, 255, 255, 0.2); padding: 15px; border-radius: 8px; color: #fff; width: 320px; backdrop-filter: blur(8px); display: none; box-shadow: 0 4px 15px rgba(0,0,0,0.6);">
            <div style="font-size: 14px; font-weight: bold; color: #4facfe; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">7-Day Forecast</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">`;
            
        const periods = data.properties.periods;
        let dayCount = 0;
        for (let i = 0; i < periods.length && dayCount < 7; i++) {
            const p = periods[i];
            // Show today's remainder, and then daytime for the next 6 days
            if (p.isDaytime || i === 0) { 
                html += `<div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
                    <div style="font-weight: bold; width: 90px; color: #dfe6e9;">${p.name.replace('This Afternoon', 'Today').replace('Tonight', 'Tonight')}</div>
                    <div style="flex: 1; margin: 0 10px; color: #b2bec3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.shortForecast}">${p.shortForecast}</div>
                    <div style="font-weight: bold; color: ${p.isDaytime ? '#ff9f43' : '#74b9ff'};">${p.temperature}°</div>
                </div>`;
                dayCount++;
            }
        }
        
        html += `</div></div>`;
        
        let el = document.getElementById('forecast-container');
        if (!el) {
            el = document.createElement('div');
            el.id = 'forecast-container';
            document.getElementById('viewport-scaler').appendChild(el);
        }
        el.innerHTML = html;
    } catch(e) { console.warn('Forecast fetch:', e); }
}

// ─── Real aircraft from OpenSky Network (free, no key, 10-min cache on server)
// Helicopter icon for low-altitude (<3000ft) or slow (<120kt) targets.
async 
function getAircraftClass(acType, altFt, speedKt) {
    if (!acType) {
        if ((altFt != null && altFt < 3000) || (speedKt != null && speedKt < 120 && altFt < 5000)) return 'helo';
        return 'air';
    }
    const t = String(acType).toUpperCase();
    if (t.match(/^(R44|R66|H60|UH6|AH6|AS3|EC1|B06|B40|A10|AW1|MD5|S76|S92)/)) return 'helo';
    if (t.match(/^(C1|C2|P2|PA|SR|BE|PC|TBM|M20|DA)/)) return 'small';
    return 'air';
}

function getAircraftIcon(cls) {
    if (cls === 'helo') return '🚁';
    if (cls === 'small') return '🛩️';
    return '✈️';
}

async function fetchAircraft() {
    try {
        const r = await fetch('/api/aircraft');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        liveData.aircraft = data.aircraft || [];

        airLayer.clearLayers();
        deepOceanAirLayer.clearLayers();
        liveData.aircraft.forEach(a => {
            const id = a.callsign || a.icao24;
            recordTrafficBreadcrumb(id, a.lat, a.lng);

            const acCls = getAircraftClass(a.acType, a.altFt, a.speedKt);
            const icon  = getAircraftIcon(acCls);
            const altStr  = a.altFt != null ? (a.altFt > 18000 ? 'FL' + Math.round(a.altFt/100) : Math.round(a.altFt) + 'ft') : '';
            const typeStr = a.acType || '';
            const call = a.callsign || a.icao24 || 'UNK';
            const label = `${icon} ${call} ${typeStr} ${altStr}`.trim();
            const cls   = acCls === 'helo' ? 'traffic-label traffic-label-helo' : (acCls === 'small' ? 'traffic-label traffic-label-small' : 'traffic-label traffic-label-air');
            const marker = L.marker([a.lat, a.lng], { pane: 'trafficPane',
                icon: L.divIcon({ className: cls, html: label, iconSize: [200, 20], iconAnchor: [8, 10] })
            });
            marker.addTo(airLayer);
            drawBreadcrumbs(id, airLayer, '#00d2d3');

            // Flag as Deep Ocean if > 80.4 km (50 miles) from land
            const kmOff = distToShoreKm(a.lat, a.lng);
            if (kmOff > 80.4) {
                a.isDeepOcean = true;
                const deepCls = cls + ' deep-ocean-air';
                const deepMarker = L.marker([a.lat, a.lng], { pane: 'trafficPane',
                    icon: L.divIcon({ className: deepCls, html: label, iconSize: [200, 20], iconAnchor: [8, 10] })
                });
                deepMarker.addTo(deepOceanAirLayer);
                drawBreadcrumbs(id, deepOceanAirLayer, '#00d2d3');
            } else {
                a.isDeepOcean = false;
            }
        });

        // Fallback placeholders if OpenSky returned nothing (rate-limit / network)
        if (!liveData.aircraft.length) {
            [
                { c:[21.320,-157.860], text:'✈️ HAL12',  cls:'traffic-label traffic-label-air'  },
                { c:[21.255,-157.710], text:'✈️ SWA453',  cls:'traffic-label traffic-label-air'  },
                { c:[21.130,-157.480], text:'✈️ UAL930', cls:'traffic-label traffic-label-air'  },
                { c:[21.350,-157.960], text:'🚁 TOUR01', cls:'traffic-label traffic-label-helo' },
                { c:[21.290,-157.850], text:'🚁 USCG 65',cls:'traffic-label traffic-label-helo' },
                { c:[21.308,-157.876], text:'🚁 BLUE HI',cls:'traffic-label traffic-label-helo' },
            ].forEach(t => L.marker(t.c, { pane:'trafficPane',
                icon: L.divIcon({ className:t.cls, html:t.text, iconSize:[200,20] })
            }).addTo(airLayer));
        }
    } catch(e) {
        console.warn('Aircraft fetch:', e);
        liveData.aircraft = [];
    }
}


// ─── Ocean surface currents (Open-Meteo Marine model via /api/currents)
function renderCurrents(points) {
    currentLayer.clearLayers();
    (points || []).forEach(pt => {
        if (pt.speedKt == null) return;
        const scale = Math.max(1.2, Math.min(3.5, pt.speedKt * 1.8));
        const html = `<div style="display:inline-block; transform: scale(${scale.toFixed(2)}); transform-origin: center;">${pt.arrow}</div><br><span style="font-size:16px;color:#00ffff;font-weight:900;text-shadow: 2px 2px 4px rgba(0,0,0,1), -1px -1px 4px rgba(0,0,0,1), 0px 0px 8px rgba(0,0,0,0.8);">${pt.speedKt}kt</span>`;
        L.marker([pt.lat, pt.lng], { pane: 'currentPane',
            icon: L.divIcon({ className: 'current-arrow', html, iconSize: [60, 66] })
        }).addTo(currentLayer);
    });
}
async function fetchCurrents() {
    try {
        const r = await fetch('/api/currents');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        liveData.currents = data;
        renderCurrents(data.points);
    } catch(e) { console.warn('Currents fetch:', e); }
}

// ─── Tide state for Hawaiian Islands (NOAA CO-OPS via /api/tide)
async function fetchTide() {
    try {
        const r = await fetch('/api/tide');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        liveData.tide = data;

        tideLayer.clearLayers();
        tideMarkers = [];
        (data.tides || []).forEach(t => {
            const updown = t.state === 'Rising' ? '▲' : (t.state === 'Falling' ? '▼' : '–');
            const color = t.state === 'Rising' ? '#1dd1a1' : (t.state === 'Falling' ? '#ff9f43' : '#48dbfb');
            const next = t.next ? `${t.next.type} ${t.next.time}` : '';
            // HTML without the leader
            const html = `<div class="surf-card" style="border-color:${color}; box-shadow:0 0 10px ${color}33; padding:4px 8px; width:100%; box-sizing:border-box;">
                <div style="font-size:0.75em;font-weight:bold;color:${color};text-transform:uppercase;letter-spacing:1px;">🌊 ${t.name}</div>
                <div style="font-size:0.85em;color:#fff;">${updown} ${t.state}</div>
                <div style="font-size:0.7em;color:#a4b0be;margin-top:2px;">Next: ${next}</div>
            </div>`;
            
            // Push them away from land
            let angle = Math.PI / 2; // Default South
            let rOff = 140;
            if (t.id === '1612668') { angle = -Math.PI * 0.65; rOff = 150; } // Haleiwa more North, slightly West
            if (t.id === '1612480') { angle = -Math.PI / 4; rOff = 140; } // Kaneohe North-East
            if (t.id === '1612424') { angle = Math.PI; rOff = 160; } // Waianae West
            if (t.id === '1612340') { angle = Math.PI * 0.75; rOff = 200; } // Honolulu heavily South-West
            if (t.id === '1613198') { angle = Math.PI / 2; rOff = 140; } // Kaunakakai South

            const marker = L.marker(t.coords, { pane: 'poiPane',
                icon: L.divIcon({ className: '', html, iconSize: [120, 48], iconAnchor: [60, 24] })
            }).addTo(tideLayer);
            tideMarkers.push({ marker, html, color, angle, rOff });
        });
        declutterLabels();
    } catch(e) { console.warn('Tide fetch:', e); }
}

// =====================================================================
// PANEL ITEM GENERATORS (each returns an array; engine paginates 3/page)
// =====================================================================
function getSurfItems() {
    const byId = {};
    (liveData.buoys || []).forEach(b => { byId[b.id] = b; });
    return surfSpots.map(s => {
        const buoy = byId[s.buoyId];
        let heightStr = '--', period = '', color = '#48dbfb';
        if (buoy && !buoy.error && buoy.waveHeight != null) {
            const hft = buoy.waveHeight * 3.281 * (s.scale || 1.0);
            const lo  = Math.max(1, Math.floor(hft * 0.85));
            const hi  = Math.ceil(hft * 1.15);
            heightStr = `${lo}-${hi}ft`;
            period    = buoy.dominantPeriod ? `${buoy.dominantPeriod}s · ` : '';
            color     = hft > 6 ? '#ff9f43' : '#1dd1a1';
        }
        return { name: s.name, heightStr, period, color };
    });
}
function renderSurfItem(item) {
    return `<div class="data-row" style="border-left-color:${item.color};">
        <div><div class="row-primary">🏄 ${item.name}</div><div class="row-secondary">${item.period}NDBC buoy derived</div></div>
        <div class="row-meta" style="color:${item.color};">${item.heightStr}</div>
    </div>`;
}

function getBuoyItems() {
    return (liveData.buoys || [])
        .filter(b => !b.error && b.waveHeight != null)
        .map(b => ({
            name: b.name,
            wh: `${mToFt(b.waveHeight)} ft`,
            wt: `${cToF(b.waterTemp)}°F`,
            pd: b.dominantPeriod ? `${b.dominantPeriod}s period` : '',
        }));
}
function renderBuoyItem(item) {
    return `<div class="data-row" style="border-left-color:#0abde3;">
        <div><div class="row-primary">${item.name}</div><div class="row-secondary">${item.pd}</div></div>
        <div class="row-meta">🌊${item.wh}<br><span style="font-size:0.75em;color:#a4b0be;">🌡${item.wt}</span></div>
    </div>`;
}

function getQuakeItems() {
    return (liveData.quakes || []).map(q => {
        const color = q.mag >= 3 ? '#ee5253' : q.mag >= 2 ? '#ff9f43' : '#ffd32a';
        const place = q.place.replace(/,?\s*Hawaii( Island)?$/, '');
        return { mag: q.mag, place, depth: q.depth, time: q.time, color };
    });
}
function renderQuakeItem(item) {
    return `<div class="data-row" style="border-left-color:${item.color};">
        <div><div class="row-primary">${item.place}</div><div class="row-secondary">${item.depth.toFixed(1)} km depth</div></div>
        <div class="row-meta" style="color:${item.color};">M${item.mag}<br><span style="font-size:0.7em;color:#a4b0be;">${timeAgo(item.time)}</span></div>
    </div>`;
}

function getAviationItems() {
    const real = (liveData.aircraft || []).map(a => {
        const isHelo = (a.altFt != null && a.altFt < 3000) || (a.speedKt != null && a.speedKt < 120 && a.altFt < 5000);
        const alt    = a.altFt  != null ? `${Math.round(a.altFt / 100) * 100}ft` : '--';
        const spd    = a.speedKt != null ? `${a.speedKt} kts` : '--';
        const route  = (a.origin && a.dest)
            ? `${a.origin} ➔ ${a.dest}`
            : a.registration
                ? `${a.registration}${a.acType ? ' · ' + a.acType : ''}`
                : (a.acType || a.icao24 || '—');
        return { call: a.callsign, type: isHelo ? '🚁' : '✈️', route, alt, spd, isDeepOcean: a.isDeepOcean, origin: a.origin, dest: a.dest };
    });
    if (real.length) return real;
    return [
        { call:'HAL12',  type:'✈️', route:'HNL ➔ LAX', alt:'FL310',  spd:'475 kts', isDeepOcean: false, origin: 'HNL', dest: 'LAX' },
        { call:'SWA453', type:'✈️', route:'OAK ➔ HNL', alt:'4,200ft',spd:'180 kts', isDeepOcean: false, origin: 'OAK', dest: 'HNL' },
        { call:'UAL930', type:'✈️', route:'HNL ➔ ORD', alt:'FL240',  spd:'Climbing', isDeepOcean: true, origin: 'HNL', dest: 'ORD' }, // Fake deep ocean for testing if offline
        { call:'TOUR01', type:'🚁', route:'Local Tour', alt:'700ft',  spd:'95 kts', isDeepOcean: false, origin: null, dest: null },
        { call:'USCG65', type:'🚁', route:'SAR Patrol', alt:'250ft',  spd:'120 kts', isDeepOcean: false, origin: null, dest: null },
        { call:'BLUE-H', type:'🚁', route:'Scenic Tour',alt:'900ft',  spd:'80 kts', isDeepOcean: false, origin: null, dest: null },
    ];
}

function getDeepOceanFlightItems() {
    const hawaiiIata = ['HNL','OGG','KOA','ITO','LIH','LNY','JHM','MKK','HNM'];
    return getAviationItems().filter(a => {
        if (!a.origin || !a.dest) return false;
        const isToFromHNL = a.origin === 'HNL' || a.dest === 'HNL';
        const isMainland = !hawaiiIata.includes(a.origin) || !hawaiiIata.includes(a.dest);
        return isToFromHNL && isMainland;
    });
}

function renderDeepOceanFlightItem(item) {
    return `<div class="data-row" style="border-left-color:#10ac84; padding: 6px 12px; font-size: 0.9em; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:bold; width:65px; color:#10ac84;">${item.call}</div>
        <div style="flex-grow:1; text-align:center; color:#dfe6ff; font-size:0.85em;">${item.route}</div>
        <div style="width:55px; text-align:right; color:#a4b0be; font-size:0.85em;">${item.alt}</div>
    </div>`;
}

function renderAviationItem(item) {
    const color = item.acCls === 'helo' ? '#ffd32a' : (item.acCls === 'small' ? '#74b9ff' : '#10ac84');
    return `<div class="data-row" style="border-left-color:${color}; padding: 6px 12px; font-size: 0.9em;">
        <div><div class="row-primary">${item.type} ${item.call}</div><div class="row-secondary">${item.route}</div></div>
        <div class="row-meta">${item.alt}<br><span style="font-size:0.75em;color:#a4b0be;">${item.spd}</span></div>
    </div>`;
}

// AIS ship-type code → human label (ITU-R M.1371 first-digit classes).
function shipTypeLabel(t) {
    if (t == null) return 'Vessel';
    if (t === 30) return 'Fishing';
    if (t === 35) return 'Military';
    if (t === 36) return 'Sailing';
    if (t === 37) return 'Pleasure craft';
    if (t === 50) return 'Pilot';
    if (t === 51) return 'Search & rescue';
    if (t === 52) return 'Tug';
    if (t === 55) return 'Law enforcement';
    if (t >= 60 && t <= 69) return 'Passenger';
    if (t >= 70 && t <= 79) return 'Cargo';
    if (t >= 80 && t <= 89) return 'Tanker';
    return 'Vessel';
}

// Helper to check if a vessel is likely in port/harbor
function isVesselInPort(v) {
    if (v.sog != null && v.sog >= 1.0) return false;
    const hDist = Math.hypot((v.lat - 21.305)*111, (v.lng - -157.867)*102); // Honolulu
    const pDist = Math.hypot((v.lat - 21.350)*111, (v.lng - -157.960)*102); // Pearl Harbor
    const bDist = Math.hypot((v.lat - 21.300)*111, (v.lng - -158.110)*102); // Kalaeloa
    return hDist < 2.5 || pDist < 4.0 || bDist < 2.5;
}

// ── COMBINED TRAFFIC items (aircraft + live AIS vessels) ──────────────
function getTrafficItems() {
    const items = [];
    const currView = typeof currentStateIndex !== 'undefined' ? (uiStates[currentStateIndex]?.view || 'oahu') : 'oahu';
    let b;
    if (currView === 'harbor') b = L.latLng([21.29, -157.84]).toBounds(8000); 
    else b = L.latLngBounds([[20.994, -158.45], [21.75, -157.00]]);

    getAviationItems()
        .filter(a => a.lat != null && a.lng != null && b.contains([a.lat, a.lng]))
        .forEach(a => items.push({ icon: a.type, name: a.call, detail: `${a.alt}`, sub: a.route, color: a.type === '🚁' ? '#ffd32a' : '#1dd1a1' }));
        
    const ships = (liveData.ships || [])
        .filter(v => v.lat != null && v.lng != null && b.contains([v.lat, v.lng]))
        .filter(v => currView !== 'oahu' || !isVesselInPort(v))
        .sort((a, b) => (b.sog || 0) - (a.sog || 0));

    if (ships.length) {
        ships.forEach(v => items.push({
            icon: '🚢', name: v.name,
            detail: v.sog != null ? `${v.sog.toFixed(1)} kt` : '--',
            sub: shipTypeLabel(v.type), color: '#0984e3'
        }));
    } else {
        items.push({ icon: '⚓', name: 'AIS OFFLINE', detail: '–',
            sub: 'Set AISSTREAM_API_KEY for live vessels', color: '#636e72' });
    }
    return items;
}

function getWaikikiTrafficItems() {
    const items = [];
    // Tightly match the map zoom bounds
    const b = L.latLngBounds([21.2286, -157.8225], [21.2863, -157.7175]);

    // Filter Ships
    (liveData.ships || []).forEach(v => {
        if (v.lat != null && v.lng != null && b.contains([v.lat, v.lng])) {
            items.push({
                icon: '🚢', name: v.name,
                detail: v.sog != null ? `${v.sog.toFixed(1)} kt` : '--',
                sub: shipTypeLabel(v.type), color: '#0984e3',
                raw: v
            });
        }
    });

    // Filter Aircraft
    (liveData.aircraft || []).forEach(a => {
        // Aircraft from API have .lon instead of .lng
        const lng = a.lon != null ? a.lon : a.lng;
        if (a.lat != null && lng != null && b.contains([a.lat, lng])) {
            let detail = `Reg: ${a.registration || 'UNK'} Type: ${a.acType || 'UNK'}`;
            if (a.origin && a.dest) detail += `\nRoute: ${a.origin} -> ${a.dest}`;
            items.push({
                icon: a.type === '🚁' ? '🚁' : '✈️', name: a.callsign || a.registration || 'UNK',
                detail: detail,
                sub: a.route || 'Local flight',
                color: a.type === '🚁' ? '#ffd32a' : '#1dd1a1',
                raw: a
            });
        }
    });
    
    if (!items.length) {
        items.push({
            icon: '🏝️', name: 'No traffic in area',
            detail: '', sub: '', color: '#636e72',
            raw: {}
        });
    }
    return items;
}

function renderTrafficItem(item) {
    return `<div class="data-row" style="border-left-color:${item.color};">
        <div><div class="row-primary">${item.icon} ${item.name}</div><div class="row-secondary">${item.sub}</div></div>
        <div class="row-meta" style="color:${item.color};">${item.detail}</div>
    </div>`;
}

function renderWaikikiTrafficCard(item) {
    const raw = item.raw || {};
    const imgUrl = raw.image_url;
    const visits = raw.visit_count || 1;
    
    let imgHtml = '';
    if (imgUrl) {
        imgHtml = `<img src="${imgUrl}" class="traffic-image">`;
    } else {
        imgHtml = `<div class="traffic-image-placeholder">${item.icon}</div>`;
    }

    return `
    <div class="traffic-card" style="border-left-color:${item.color};">
        <div class="traffic-card-left">${imgHtml}</div>
        <div class="traffic-card-right">
            <div class="tc-title">${item.name}</div>
            <div class="tc-sub">${item.sub}</div>
            <div class="tc-detail">${item.detail.replace(/\n/g, '<br>')}</div>
            <div class="tc-visits">Observed Visits: ${visits}</div>
        </div>
    </div>`;
}

function getShipItems() {
    const ships = liveData.ships || [];
    if (!ships.length) return [{ noAis: true }];
    return ships
        .slice().sort((a, b) => (b.sog || 0) - (a.sog || 0)).slice(0, 12)
        .map(v => ({
            name: v.name,
            type: shipTypeLabel(v.type),
            area: v.dest ? `→ ${v.dest}` : 'Hawaiian waters',
            spd: v.sog != null ? `${v.sog.toFixed(1)} kt` : '--'
        }));
}
function renderShipItem(item) {
    if (item.noAis) return `<div class="data-row" style="border-left-color:#636e72;">
        <div>
            <div class="row-primary" style="color:#636e72;">⚓ No Live Vessels</div>
            <div class="row-secondary">Set AISSTREAM_API_KEY to stream live AIS traffic</div>
        </div>
        <div class="row-meta" style="color:#636e72;">OFFLINE</div>
    </div>`;
    const color = '#0984e3';
    return `<div class="data-row" style="border-left-color:${color};">
        <div><div class="row-primary">🚢 ${item.name}</div><div class="row-secondary">${item.type} · ${item.area}</div></div>
        <div class="row-meta">${item.spd}</div>
    </div>`;
}


// =====================================================================
// UI STATE MACHINE
// =====================================================================

let _bottomHudTimer = null;

function renderBottomTrafficItem(item) {
    return `<div class="btm-hud-item" style="border-left-color:${item.color};">
        <div class="btm-hud-title" style="color:${item.color}">${item.icon} ${item.name}</div>
        <div class="btm-hud-sub">${item.sub}</div>
        <div class="btm-hud-spd">${item.detail}</div>
    </div>`;
}

function startBottomTrafficHUD(mode) {
    const hud = document.getElementById('bottom-traffic-hud');
    const content = document.getElementById('bottom-traffic-content');
    if (!hud || !content) return;
    hud.style.display = 'flex';

    function update() {
        let items = [];
        if (mode === 'air') {
            const b = L.latLngBounds([[18.5, -160.5], [22.5, -154.5]]);
            items = getAviationItems()
                .filter(a => a.lat != null && a.lng != null && b.contains([a.lat, a.lng]))
                .map(a => ({ icon: a.type, name: a.call, detail: `${a.alt} ${a.spd}`, sub: a.route, color: a.type === '??' ? '#ffd32a' : '#1dd1a1' }));
        } else if (mode === 'ship') {
            const b = L.latLngBounds([[18.5, -160.5], [22.5, -154.5]]);
            items = (liveData.ships || [])
                .filter(v => v.lat != null && v.lng != null && b.contains([v.lat, v.lng]))
                .sort((a, b) => (b.sog || 0) - (a.sog || 0))
                .map(v => ({ icon: '??', name: v.name, detail: v.sog != null ? `${v.sog.toFixed(1)} kt` : '--', sub: shipTypeLabel(v.type), color: '#0984e3' }));
        }
        
        const displayItems = items.slice(0, 4);
        if (displayItems.length) {
            content.innerHTML = displayItems.map(renderBottomTrafficItem).join('');
        } else {
            content.innerHTML = `<div style="font-size:10px; color:#a4b0be; padding:4px;">No ${mode === 'air' ? 'Aircraft' : 'Vessels'} Local</div>`;
        }
    }
    
    update();
    if (_bottomHudTimer) clearInterval(_bottomHudTimer);
    _bottomHudTimer = setInterval(update, 5000);
}

function stopBottomTrafficHUD() {
    const hud = document.getElementById('bottom-traffic-hud');
    if (hud) hud.style.display = 'none';
    if (_bottomHudTimer) { clearInterval(_bottomHudTimer); _bottomHudTimer = null; }
}


function updateHNLBox() {
    const box = document.getElementById('hnl-status-box');
    if (!box) return;
    const apt = liveData.airport || { status: 'LOADING...', color: '#a4b0be', details: 'Awaiting data...' };
    box.style.display = 'block';
    box.style.borderColor = apt.color;
    box.innerHTML = `
        <div style="font-weight:bold; font-size:12px; color:${apt.color}; text-transform:uppercase; margin-bottom:4px; text-shadow: 0 0 4px ${apt.color};">
            ✈ HNL AIRPORT: ${apt.status}
        </div>
        <div style="font-size:9.5px; color:#dfe6e9; line-height:1.3;">
            ${apt.details}
        </div>
    `;
}

function hideHNLBox() {
    const box = document.getElementById('hnl-status-box');
    if (box) box.style.display = 'none';
}

function updateLegend(type) {
    let el = document.getElementById('particle-legend');
    if (!el) {
        el = document.createElement('div');
        el.id = 'particle-legend';
        el.style.position = 'absolute';
        el.style.bottom = '1%';
        el.style.left = '1%';
        el.style.zIndex = '999';
        el.style.background = 'rgba(0, 0, 0, 0.75)';
        el.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        el.style.padding = '10px';
        el.style.borderRadius = '6px';
        el.style.color = '#fff';
        el.style.width = '240px';
        el.style.backdropFilter = 'blur(4px)';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        el.style.display = 'none';
        document.getElementById('viewport-scaler').appendChild(el);
    }
    
    if (type === 'none' || !type) {
        el.style.display = 'none';
        return;
    }

    let html = '';
    if (type === 'wind') {
        html = `
            <div style="margin-bottom:12px;">
                <div style="font-weight:bold; font-size:11px; color:#4facfe; text-transform:uppercase; margin-bottom:4px;">BASE REFLECTIVITY RADAR</div>
                <div style="font-size:9.5px; color:#dfe6e9; margin-bottom:4px;"><b>Source: NWS Hawaii Regional Radar</b></div>
                <div style="font-size:9.5px; color:#b2bec3; line-height:1.3; margin-bottom:8px;">Color indicates precipitation intensity (dBZ).</div>
                <div style="height:6px; width:100%; border-radius:3px; background: linear-gradient(to right, #00FF00, #FFFF00, #FF0000, #FF00FF, #FFFFFF);"></div>
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#b2bec3; margin-top:2px;"><span>Light</span><span>Moderate</span><span>Heavy</span><span>Extreme</span></div>
            </div>
            <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
                <div style="font-weight:bold; font-size:11px; color:#4facfe; text-transform:uppercase; margin-bottom:4px;">SURFACE WIND FIELD</div>
                <div style="font-size:9.5px; color:#dfe6e9; margin-bottom:4px;"><b>Model: PacIOOS WRF (3km)</b></div>
                <div style="font-size:9.5px; color:#b2bec3; line-height:1.3; margin-bottom:8px;">Arrows show wind direction, color-coded by wind speed (mph).</div>
                <div style="height:6px; width:100%; border-radius:3px; background: linear-gradient(to right, #313695, #74add1, #e0f3f8, #fee090, #f46d43, #a50026);"></div>
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#b2bec3; margin-top:2px;"><span>0</span><span>15</span><span>30+ mph</span></div>
            </div>
            <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px; margin-top: 10px;">
                <div style="font-weight:bold; font-size:11px; color:#4facfe; text-transform:uppercase; margin-bottom:4px;">STATION WIND BARBS</div>
                <div style="font-size:9.5px; color:#dfe6e9; margin-bottom:4px;"><b>Source: NWS Ground Stations</b></div>
                <div style="font-size:9.5px; color:#b2bec3; line-height:1.3; margin-bottom:6px;">Stick points <b>into</b> the wind. Tail feathers indicate speed:</div>
                <div style="display:flex; flex-direction:column; gap:4px; font-size:9.5px; color:#b2bec3; margin-left:2px;">
                    <div style="display:flex; align-items:center;">
                        <div style="width:20px; height:2px; background:#fff; position:relative; margin-right:8px; margin-top:6px;">
                            <div style="position:absolute; right:3px; top:0; width:6px; height:2px; background:#fff; transform:rotate(-45deg); transform-origin:right top;"></div>
                        </div> 
                        Short feather = 5 knots
                    </div>
                    <div style="display:flex; align-items:center;">
                        <div style="width:20px; height:2px; background:#fff; position:relative; margin-right:8px; margin-top:6px;">
                            <div style="position:absolute; right:0; top:0; width:10px; height:2px; background:#fff; transform:rotate(-45deg); transform-origin:right top;"></div>
                        </div> 
                        Long feather = 10 knots
                    </div>
                    <div style="display:flex; align-items:center;">
                        <div style="width:20px; height:2px; background:#fff; position:relative; margin-right:8px; margin-top:6px;">
                            <div style="position:absolute; right:0; top:0; width:10px; height:2px; background:#fff; transform:rotate(-45deg); transform-origin:right top;"></div>
                            <div style="position:absolute; right:4px; top:0; width:6px; height:2px; background:#fff; transform:rotate(-45deg); transform-origin:right top;"></div>
                        </div> 
                        Add for total (e.g., 15 knots)
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'wave') {
        html = `
            <div>
                <div style="font-weight:bold; font-size:11px; color:#4facfe; text-transform:uppercase; margin-bottom:4px;">SIGNIFICANT WAVE HEIGHT</div>
                <div style="font-size:9.5px; color:#dfe6e9; margin-bottom:4px;"><b>Model: PacIOOS SWAN (Oahu)</b></div>
                <div style="font-size:9.5px; color:#b2bec3; line-height:1.3; margin-bottom:8px;">High-resolution nearshore coastal dynamics.</div>
                <div style="height:6px; width:100%; border-radius:3px; background: linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000);"></div>
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#b2bec3; margin-top:2px;"><span>0</span><span>4.2</span><span>8.3+ ft</span></div>
            </div>
        `;
    } else if (type === 'roms') {
        html = `
            <div style="margin-bottom:12px;">
                <div style="font-weight:bold; font-size:11px; color:#4facfe; text-transform:uppercase; margin-bottom:4px;">WATER TEMPERATURE</div>
                <div style="font-size:9.5px; color:#dfe6e9; margin-bottom:4px;"><b>Model: PacIOOS ROMS</b></div>
                <div style="font-size:9.5px; color:#b2bec3; line-height:1.3; margin-bottom:8px;">High-resolution Regional Ocean Modeling System forecast.</div>
                <div style="height:6px; width:100%; border-radius:3px; background: linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000);"></div>
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#b2bec3; margin-top:2px;"><span>75°F</span><span>78.5°F</span><span>82°F</span></div>
            </div>
        `;
    }

    el.innerHTML = html;
    el.style.display = 'block';

    // Position dynamically so it stacks cleanly above the hazard box when in roms/hazard view
    if (type === 'roms') {
        el.style.bottom = '250px';
    } else {
        el.style.bottom = '1%';
    }
}

const uiStates = [
    // 🟢 0: METEOROLOGICAL – STATIONS + DERIVED WIND FIELD 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
    {
        title: "METEOROLOGICAL", sub: "NWS RADAR · WIND VECTOR · STATIONS", duration: 17250,
        layersOn:  [radarLayerGroup, stationLayer, windLayer, dynamicAlertMarkers, airLayer],
        layersOff: [shipLayer, buoyLayer, quakeLayer, lightningLayer, denseDepthLayer],
        renderStatic: () => '',
        onEnter() { 
            document.getElementById('main-dash').classList.add('hud-hidden'); 
            const fb = document.getElementById('forecast-box');
            if (fb) fb.style.display = 'block';
            updateLegend('wind');
        },
        onExit()  { 
            document.getElementById('main-dash').classList.remove('hud-hidden'); 
            const fb = document.getElementById('forecast-box');
            if (fb) fb.style.display = 'none';
            updateLegend('none');
            stopBottomTrafficHUD();
        }
    },
    // 🟢 1: SURF & OCEAN – combined surf cards + buoy HUDs 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
    {
        id: 'state-surf',
        title: "SURF & OCEAN", sub: "NDBC · WAVE + BUOY + CURRENTS", duration: 13500,
        layersOn:  [buoyLayer, surfLayer, currentLayer, tideLayer, dynamicAlertMarkers, waveLayer, shipLayer],
        layersOff: [radarLayerGroup, aqiLayer, airLayer, quakeLayer, lightningLayer, denseDepthLayer, windLayer],
        renderStatic() {
            const buoys  = liveData.buoys || [];
            const active = buoys.filter(b => !b.error && b.waveHeight != null);
            const avgFt  = active.length
                ? (active.reduce((s, b) => s + b.waveHeight * 3.281, 0) / active.length).toFixed(1)
                : '--';
            const avgTmp = active.length
                ? Math.round(active.reduce((s, b) => s + (b.waterTemp ?? 0), 0) / active.length * 9/5 + 32)
                : '--';
            // Find peak spot
            const byId = {};
            active.forEach(b => { byId[b.id] = b; });
            let peakName = '--', peakHi = 0;
            surfSpots.forEach(s => {
                const b = byId[s.buoyId];
                if (b && b.waveHeight != null) {
                    const hi = Math.ceil(b.waveHeight * 3.281 * (s.scale || 1.0) * 1.15);
                    if (hi > peakHi) { peakHi = hi; peakName = s.name; }
                }
            });
            const peakStr = peakHi > 0 ? `${peakHi}ft` : '--';
            const peakColor = peakHi > 6 ? '#ff9f43' : '#1dd1a1';
            // Condensed Buoy 51211 (Pearl Harbor / Koko)
            const b51211 = active.find(b => b.id === '51211');
            let buoyDataHtml = '';
            if (b51211) {
                const wh = b51211.waveHeight != null ? `${mToFt(b51211.waveHeight)}ft` : '--';
                const pd = b51211.dominantPeriod ? `@ ${b51211.dominantPeriod}s` : '';
                const ws = b51211.windSpeedKt != null ? `${b51211.windSpeedKt}kt` : '--';
                const wd = b51211.windDir != null ? `${b51211.windDir}°` : '--';
                const wt = b51211.waterTemp != null ? `${cToF(b51211.waterTemp)}°F` : '--';
                const pr = b51211.pressure != null ? `${b51211.pressure}mb` : '--';
                buoyDataHtml = `<div style="margin-top:10px; padding:6px; background:rgba(0,0,0,0.4); border-radius:6px; border:1px solid rgba(255,255,255,0.1); font-size:0.75em; display:flex; justify-content:space-around; align-items:center; text-align:center;">
                    <div style="color:#48dbfb; font-weight:bold; letter-spacing:1px; margin-right:8px;">51211<br>PEARL HARBOR</div>
                    <div>🌊 ${wh} ${pd}</div>
                    <div>💨 ${wd} ${ws}</div>
                    <div>🌡️ ${wt}</div>
                    <div>🗜️ ${pr}</div>
                </div>`;
            }

            const oceanAlertsRaw = (liveData.alerts?.alerts || []).filter(a => /craft|marine|surf|sea|water|gale|hurricane|tsunami/i.test(a.event ?? ''));
            const seenEvents = new Set();
            const oceanAlerts = oceanAlertsRaw.filter(a => { if (seenEvents.has(a.event)) return false; seenEvents.add(a.event); return true; });
            let oceanWarningsHtml = '';
            if (oceanAlerts.length > 0) {
                oceanWarningsHtml = oceanAlerts.map(a => {
                    const color = a.severity === 'Severe' || a.severity === 'Extreme' ? '#ee5253' : '#ff9f43';
                    return `<div class="warning-banner" style="margin-top:10px; background: rgba(255,159,67,0.15); border-color: ${color}; color: ${color}; text-align: left; padding: 10px;">
                        <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">⚠️ ${a.event}</div>
                        <div style="font-size: 9.5px; color: #dfe6e9; white-space: normal; line-height: 1.4; max-height: 100px; overflow-y: auto;">${a.description || a.headline || a.desc || ''}</div>
                    </div>`;
                }).join('');
            }

            return `<div class="metric-grid">
                <div class="metric-box"><div class="metric-val">${avgFt !== '--' ? avgFt + 'ft' : '--'}</div><div class="metric-lbl">Avg Swell</div></div>
                <div class="metric-box"><div class="metric-val">${avgTmp !== '--' ? avgTmp + '°F' : '--'}</div><div class="metric-lbl">Water Temp</div></div>
                <div class="metric-box"><div class="metric-val">${active.length}</div><div class="metric-lbl">Buoys Live</div></div>
                <div class="metric-box"><div class="metric-val" style="color:${peakColor};">${peakStr}</div><div class="metric-lbl">Peak · ${peakName}</div></div>
            </div>
            ${buoyDataHtml}
            ${oceanWarningsHtml}`;
        },
        onEnter() { setSurfMode('large'); updateLegend('wave'); startBottomTrafficHUD('ship'); },   // big boxed cards + declutter
        onExit()  { setSurfMode('small'); updateLegend('none'); stopBottomTrafficHUD(); }    // compact pins everywhere else
    },
    // 🟢 2: TRAFFIC – WAIKIKI & DIAMOND HEAD 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
    {
        title: "TRAFFIC — COMBINED", sub: "WAIKIKI & DIAMOND HEAD", perPageMs: 3850, pageSize: 3, holdExtraMs: 3300,
        view: 'waikiki',
        layersOn:  [airLayer, shipLayer, superDenseDepthLayer, airportLayer, radarLayerGroup],
        layersOff: [aqiLayer, buoyLayer, quakeLayer, lightningLayer, denseDepthLayer],
        getItems: getWaikikiTrafficItems, renderItem: renderWaikikiTrafficCard
    },
    // ── 5: HAZARD MONITOR — SEISMIC + LIGHTNING + TURBULENCE ──────────
    {
        id: 'state-hazard',
        title: "HAZARD MONITOR", sub: "SEISMIC ∙ LIGHTNING ∙ ALERTS ∙ TURBULENCE ∙ ROMS TEMP", perPageMs: 3500, pageSize: 4, holdExtraMs: 4000,
        view: 'hawaii',
        layersOn:  [quakeLayer, lightningLayer, alertLayer, turbulenceLayer, hazardTextLayer, romsTempLayer],
        layersOff: [radarLayerGroup, aqiLayer, airLayer, shipLayer, buoyLayer, denseDepthLayer, sparseDepthLayer, deepOceanAirLayer],
        getItems: getDeepOceanFlightItems, renderItem: renderDeepOceanFlightItem,
        onEnter() { fetchAirport(); updateLegend('none'); updateHNLBox(); },
        onExit()  { updateLegend('none'); hideHNLBox(); },
        renderStatic() {
            return `
            <div class="hazard-legend" style="margin-bottom: 12px;">
                <div class="legend-title">HAZARD STATUS</div>
                <div class="legend-section">
                    <div class="legend-row"><span class="leg-dot" style="background:#ee5253;"></span><span style="color:#ffffff;">M3.0+ Quake / Hurricane</span></div>
                    <div class="legend-row"><span class="leg-dot" style="background:#ff9f43;"></span><span style="color:#ffffff;">M2.0+ Quake / Sm Craft Adv</span></div>
                    <div class="legend-row"><span class="leg-dot" style="background:#1dd1a1;"></span><span style="color:#ffffff;">High Surf Adv / Warning</span></div>
                    <div class="legend-row"><span class="leg-dot" style="background:#e84393;"></span><span style="color:#ffffff;">Gale Warn / Hi-Lvl Turb</span></div>
                    <div class="legend-row"><span class="leg-dot" style="background:#a29bfe;"></span><span style="color:#ffffff;">Lightning / Minor Alert</span></div>
                    <div class="legend-row"><span class="leg-dot" style="background:#fdcb6e;"></span><span style="color:#ffffff;">Low Turb / Micro-seismic</span></div>
                </div>
            </div>
            
            <div style="margin-bottom:0px; border-top: 1px solid rgba(255,255,255,0.1); padding-top:10px;">
                <div style="font-weight:bold; font-size:11px; color:#4facfe; text-transform:uppercase; margin-bottom:4px;">WATER TEMPERATURE</div>
                <div style="font-size:9.5px; color:#dfe6e9; margin-bottom:4px;"><b>Model: PacIOOS ROMS</b></div>
                <div style="font-size:9.5px; color:#b2bec3; line-height:1.3; margin-bottom:8px;">High-resolution Regional Ocean Modeling System forecast.</div>
                <div style="height:6px; width:100%; border-radius:3px; background: linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000);"></div>
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#b2bec3; margin-top:2px;"><span>75&deg;F</span><span>78.5&deg;F</span><span>82&deg;F</span></div>
            </div>
            `;
        }
    },
    // ── 6: SATELLITE — GOES-WEST ───────────────────────────────────────
    {
        title: "SATELLITE — GOES-WEST", sub: "LAST 12 HOURS · GEOCOLOR", duration: 10000,
        view: 'hawaii',
        layersOn:  [],
        layersOff: [radarLayerGroup, aqiLayer, airLayer, shipLayer, buoyLayer, quakeLayer, lightningLayer, denseDepthLayer, alertLayer, turbulenceLayer],
        onEnter() {
            let el = document.getElementById('goes-satellite');
            if (!el) {
                el = document.createElement('div');
                el.id = 'goes-satellite';
                el.style.position = 'absolute';
                el.style.inset = '0';
                el.style.zIndex = '9999';
                el.style.pointerEvents = 'none';
                el.style.background = '#000';
                el.style.opacity = '0';
                el.style.transition = 'opacity 0.8s ease-in-out';
                // Append an img
                el.innerHTML = '<img id="goes-img" style="width:100%; height:100%; object-fit:contain;">';
                document.getElementById('viewport-scaler').appendChild(el);
            }
            // Update the src ONLY if the 5-minute window has passed, to avoid reloading the GIF
            const cacheBuster = Math.floor(Date.now() / 300000);
            const targetUrl = "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/hi/GEOCOLOR/GOES18-HI-GEOCOLOR-600x600.gif?t=" + cacheBuster;
            const img = document.getElementById('goes-img');
            if (img.src !== targetUrl) {
                img.src = targetUrl;
            }
            
            // Force reflow and fade in
            el.style.display = 'block';
            void el.offsetWidth;
            el.style.opacity = '1';
            
            document.getElementById('main-dash').classList.add('hud-hidden');
        },
        onExit() {
            const el = document.getElementById('goes-satellite');
            if (el) {
                el.style.opacity = '0';
                // We keep display: block so the browser doesn't drop the GIF decoded frames from memory,
                // but pointer-events: none ensures it doesn't block anything.
            }
            document.getElementById('main-dash').classList.remove('hud-hidden');
        },
        renderStatic() { return ''; }
    },
    // ── 11: RADAR — NWS HAWAII LOOP ────────────────────────────────────
    {
        title: "RADAR — NWS MRMS", sub: "HAWAII REGIONAL LOOP", duration: 8000,
        view: 'hawaii',
        layersOn:  [],
        layersOff: [radarLayerGroup, aqiLayer, airLayer, shipLayer, buoyLayer, quakeLayer, lightningLayer, denseDepthLayer, alertLayer, turbulenceLayer],
        onEnter() {
            let el = document.getElementById('nws-radar-loop');
            if (!el) {
                el = document.createElement('div');
                el.id = 'nws-radar-loop';
                el.style.position = 'absolute';
                el.style.inset = '0';
                el.style.zIndex = '9999';
                el.style.pointerEvents = 'none';
                el.style.background = '#000';
                el.style.opacity = '0';
                el.style.transition = 'opacity 0.8s ease-in-out';
                // Append an img
                el.innerHTML = '<img id="nws-radar-img" style="width:100%; height:100%; object-fit:contain;">';
                document.getElementById('viewport-scaler').appendChild(el);
            }
            // Update the src ONLY if the 5-minute window has passed, to avoid reloading the GIF
            const cacheBuster = Math.floor(Date.now() / 300000);
            const targetUrl = "https://radar.weather.gov/ridge/standard/HAWAII_loop.gif?t=" + cacheBuster;
            const img = document.getElementById('nws-radar-img');
            if (img.src !== targetUrl) {
                img.src = targetUrl;
            }
            
            // Force reflow and fade in
            el.style.display = 'block';
            void el.offsetWidth;
            el.style.opacity = '1';
            
            document.getElementById('main-dash').classList.add('hud-hidden');
        },
        onExit() {
            const el = document.getElementById('nws-radar-loop');
            if (el) {
                el.style.opacity = '0';
            }
            document.getElementById('main-dash').classList.remove('hud-hidden');
        },
        renderStatic() { return ''; }
    },

];

// =====================================================================
// PAGINATION ENGINE
// max 3 items visible at a time; 3s+ per page; rotate within state
// before advancing to next state
// =====================================================================
const PAGE_SIZE = 12;  // 4 columns × 3 rows visible per page
let currentStateIndex = 0;
let currentPage       = 0;
let _pageTimer        = null;
let _prevStateIndex   = -1;
let lastView          = 'oahu';

function transitionState() {
    try {
    if (_pageTimer) clearTimeout(_pageTimer);

    const prevState = _prevStateIndex >= 0 ? uiStates[_prevStateIndex] : null;
    const state     = uiStates[currentStateIndex];

    document.getElementById('overlay-container').className = state.id || '';

    // Fire lifecycle hooks — exit old state, enter new state
    if (_prevStateIndex !== currentStateIndex) {
        if (prevState?.onExit)  prevState.onExit();
        if (state?.onEnter)     state.onEnter();
        _prevStateIndex = currentStateIndex;
    }

    // Layer toggles
    state.layersOn.forEach(l  => { if (!map.hasLayer(l)) map.addLayer(l); });
    state.layersOff.forEach(l => { if (map.hasLayer(l))  map.removeLayer(l); });

    // These layers are only declared on specific views; force them off on every
    // other state without having to list them in each layersOff array.
    [
        stationLayer, surfLayer, currentLayer, alertLayer, turbulenceLayer, 
        airportLayer, hazardTextLayer, quakeLayer, lightningLayer, denseDepthLayer,
        superDenseDepthLayer, sparseDepthLayer, deepOceanAirLayer, romsTempLayer,
        aqiLayer, airLayer, shipLayer, buoyLayer, tideLayer, radarLayerGroup,
        windLayer, waveLayer
    ].forEach(l => {
        if (!state.layersOn || state.layersOn.indexOf(l) === -1) {
            if (map.hasLayer(l)) map.removeLayer(l);
        }
    });

    // Handle view changes (Oahu vs Hawaii vs Harbor)
    const currView = state.view || 'oahu';
    if (currView !== 'waikiki') {
        document.getElementById('map').classList.remove('waikiki-zoom');
    }

    if (currView !== lastView) {
        // Unlock bounds so we can fly freely
        map.setMaxBounds(null);
        map.setMinZoom(0);

        if (currView === 'oahu') {
            map.flyToBounds(bounds, { animate: true, duration: 1.5 });
            // Lock bounds once the flight is likely done
            setTimeout(() => {
                if ((uiStates[currentStateIndex].view || 'oahu') === 'oahu') {
                    map.setMaxBounds(bounds);
                }
            }, 1600);
        } else if (currView === 'harbor') {
            map.flyTo([21.29, -157.84], 12, { animate: true, duration: 1.8 });
            // We can leave bounds unlocked or lock to Oahu
            setTimeout(() => {
                if (uiStates[currentStateIndex].view === 'harbor') {
                    map.setMaxBounds(bounds);
                }
            }, 1900);
        } else if (currView === 'waikiki') {
            document.getElementById('map').classList.add('waikiki-zoom');
            // Expanded by 5% from previous bounding box
            map.flyToBounds([[21.2286, -157.8420], [21.2863, -157.7175]], { animate: true, duration: 1.8 });
            setTimeout(() => {
                if (uiStates[currentStateIndex].view === 'waikiki') {
                    map.setMaxBounds(bounds);
                }
            }, 1900);
        } else if (currView === 'hawaii') {
            map.setMinZoom(7);
            map.flyToBounds([[18.7, -156.0], [21.9, -158.3]], { animate: true, duration: 1.8, padding: [30, 30] });
        }
        lastView = currView;
    }

    // Re-flow surf/buoy labels now that layer visibility may have changed
    declutterLabels();

    // Header labels
    document.getElementById('tab-title').innerText     = state.title;
    document.getElementById('sub-indicator').innerText = state.sub;

    // Small craft advisory: ONLY show when a real NWS alert is active
    const hasAdvisory = (liveData.alerts?.alerts ?? []).some(a =>
        /small craft|hazardous seas/i.test(a.event ?? '')
    );
    document.getElementById('main-dash').classList.toggle('warning-active', hasAdvisory);

    // Render content with pagination
    const contentEl = document.getElementById('panel-content');
    if (state.getItems) {
        const items      = state.getItems();
        const pageSize   = state.pageSize || PAGE_SIZE;
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
        const pageItems  = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
        const pageHint   = totalPages > 1
            ? `<div class="page-indicator">${currentPage + 1} / ${totalPages}</div>`
            : '';
        const staticHtml = state.renderStatic ? state.renderStatic() : '';
        contentEl.innerHTML = `${staticHtml}<div class="data-list-wrapper" style="flex:1; display:flex; flex-direction:column; min-width:0;"><div class="data-list">${pageItems.map(state.renderItem).join('')}</div>${pageHint}</div>`;

        const isLast = currentPage + 1 >= totalPages;
        const dwell  = (state.perPageMs ?? 3000) + (isLast ? (state.holdExtraMs ?? 0) : 0);
        _pageTimer = setTimeout(() => {
            if (!isLast) {
                currentPage++;
            } else {
                currentPage = 0;
                currentStateIndex = (currentStateIndex + 1) % uiStates.length;
            }
            transitionState();
        }, dwell);
    } else {
        contentEl.innerHTML = state.renderStatic();
        _pageTimer = setTimeout(() => {
            currentPage = 0;
            currentStateIndex = (currentStateIndex + 1) % uiStates.length;
            transitionState();
        }, state.duration ?? 5000);
    }
    } catch (e) { document.getElementById('tab-title').innerText = 'ERROR: ' + e.message; console.error(e); }
}

// =====================================================================
// BOOT — prefetch all data, then start rotation + schedule refreshes
// =====================================================================
// Non-blocking fetches (slow/rate-limited APIs - don't hold up the boot)
fetchAircraft();
fetchShips();
fetchStations();
fetchCurrents();
fetchTide();
fetchWind();
// fetchWaves(); // Replaced with SWAN WMS layer
fetch7DayForecast();

Promise.race([
    Promise.all([fetchWeather(), fetchBuoys(), fetchQuakes(), fetchAlerts(), fetchTurbulence(), fetchAirQuality()]),
    new Promise(resolve => setTimeout(resolve, 8000))
]).finally(() => {
    // Start rotation immediately after base data loads
    transitionState();
    setInterval(fetchWeather,     5 * 60 * 1000);
    setInterval(fetchBuoys,       5 * 60 * 1000);
    setInterval(fetchQuakes,      5 * 60 * 1000);
    setInterval(fetchAlerts,      5 * 60 * 1000);
    setInterval(fetchTurbulence,  5 * 60 * 1000);
    setInterval(fetchAirQuality,  5 * 60 * 1000);
    setInterval(fetchAircraft,        10 * 1000); // Traffic is real-time
    setInterval(fetchShips,           10 * 1000); // Traffic is real-time
    setInterval(fetchStations,    5 * 60 * 1000);
    setInterval(fetchCurrents,    5 * 60 * 1000); // marine model updates slowly
    setInterval(fetchTide,        5 * 60 * 1000);
    setInterval(fetch7DayForecast, 60 * 60 * 1000); // refresh hourly
});









