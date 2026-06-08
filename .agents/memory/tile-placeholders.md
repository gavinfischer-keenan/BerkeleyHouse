---
name: Tile-server placeholder boxes
description: Why "Zoom Level Not Supported"/grey tiles appear on Leaflet maps and how to diagnose + fix
---

Several public tile servers (ESRI ArcGIS, RainViewer) return an **opaque placeholder
image** with text like "Zoom Level Not Supported" when a tile is requested above the
zoom that source actually serves for that region. Key traps:

- The response is **HTTP 200** with `content-type: image/png`. Leaflet's `tileerror`
  does NOT fire, and grepping the bytes for the text FAILS (text is rasterized pixels,
  not file text). Detect placeholders by **md5 frequency** — the same placeholder image
  repeats across many tiles, so a repeated md5 = placeholder.
- RainViewer's global radar mosaic only serves up to **z7 for the Hawaii region**; z8+
  returns its grey placeholder. (Coverage/native-max zoom is region-dependent.)

**Why:** these placeholders silently cover the map and are easy to misattribute to the
base layer. In Honolulu Command Center the grey boxes were the *radar* layer, not the
ocean base — confirmed only by hiding each layer in turn and md5-testing each source.

**How to apply:** when grey/blank tiles persist, (1) enumerate `document.images` and
group by host to see which sources are actually loading; (2) hide one source at a time
to find the culprit; (3) curl the exact tile URLs and md5 them across a grid to find the
repeating placeholder and the max real zoom; (4) fix by setting Leaflet
`maxNativeZoom` to the source's real max so Leaflet upscales lower-zoom tiles instead
of requesting unsupported ones (keep `maxZoom` at the map's max).
