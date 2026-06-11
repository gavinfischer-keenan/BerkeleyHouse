# audio-receiver — Berkeley House Audio Monitoring

Headless Python service that connects to remote RTSP microphone streams,
runs BirdNET-Analyzer and BatNET-Detector on captured audio, archives
interesting clips to disk, and posts all detections to the Berkeley
Command Center api-server over HTTP.

This is a first-class service in the Berkeley ecosystem — it runs on the
same Linux host as the api-server and feeds data into the same WebSocket/REST
bus that all other house monitoring data flows through. Future frontends
(Berkeley display screen, standalone audio monitor app, etc.) consume
the data via the api-server's `/api/audio/*` endpoints and `audio:detection`
WebSocket events without any changes to this service.

---

## Architecture

```
  Microphone Node (Pi Zero W / ESP32 LyraT)
      │  RTSP stream (TCP, local LAN)
      ▼
  audio-receiver/src/main.py   ← PM2-managed Python service (this package)
      │
      ├── RtspNode threads (one per enabled node)
      │     └── ffmpeg → WAV chunks (15s)
      │
      └── AudioPipeline (thread pool)
            ├── BirdNetAnalyzer  → /opt/BirdNET-Analyzer/analyze.py
            ├── BatNetAnalyzer   → /opt/BatNET-Detector/batnet.py
            │   (+ future analyzers via analyzers/__init__.py registry)
            │
            ├── AudioArchiver   → ./data/audio/<node>/<date>/<clip>.wav
            │   (only "interesting" clips per archive.rules in config)
            │
            └── HTTP POST → localhost:5050/api/ingest/audio-<nodeId>
                                │
                          api-server (Node.js, same host)
                                ├── AudioStore (ring buffer, REST queries)
                                ├── Socket.IO  audio:detection events
                                └── /api/audio/* REST endpoints
```

---

## Active Microphone Nodes

| ID | Location | Analyzers |
|----|----------|-----------|
| `front-porch` | Front porch facing street | BirdNET, BatNET |
| `shed` | Rear shed — open to backyard | BirdNET, BatNET |

Four additional nodes are pre-configured in `config/microphones.yaml`
(`garden-east`, `roof-north`, `backyard-west`, `study`) — enable them
by setting `enabled: true` when the hardware is installed.

---

## Dependencies

### System packages
Install these once on the Linux host (handled by `setup.sh`):

| Package | Purpose | Install |
|---------|---------|---------|
| `python3` | Runtime for all Python code | `apt install python3` |
| `python3-venv` | Isolated dependency environment | `apt install python3-venv` |
| `python3-pip` | Package installer | `apt install python3-pip` |
| `ffmpeg` | RTSP capture → WAV chunks | `apt install ffmpeg` |
| `git` | Clone analyzer repos | `apt install git` |

### Python packages (in `.venv/`)
| Package | Version | Purpose |
|---------|---------|---------|
| `PyYAML` | ≥6.0 | Parse `config/microphones.yaml` |

All other modules are Python stdlib (`subprocess`, `threading`, `urllib`, `json`, `csv`, `pathlib`, `logging`, `signal`, `collections.deque`).

### External analyzers
| Tool | Path | Source |
|------|------|--------|
| BirdNET-Analyzer | `/opt/BirdNET-Analyzer` | https://github.com/kahst/BirdNET-Analyzer |
| BatNET-Detector | `/opt/BatNET-Detector` | https://github.com/kahst/BatNET-Detector |

Both are cloned and their own `requirements.txt` files installed by `setup.sh`.

> **BatNET note:** Standard 48 kHz microphones cannot capture ultrasonic bat
> echolocation calls. BatNET will silently skip any node with
> `sample_rate < 192000`. To enable bat detection, use an AudioMoth, Ultramic
> UM200K, or similar ultrasonic recorder and set `sample_rate: 192000` in
> `config/microphones.yaml`.

---

## Installation

```bash
# 1. Clone the main Berkeley House repo (if not already done)
git clone <repo-url> BerkeleyHouse
cd BerkeleyHouse

# 2. Run the audio-receiver installer
chmod +x audio-receiver/setup.sh
./audio-receiver/setup.sh

# 3. Edit node IPs and locations
nano audio-receiver/config/microphones.yaml

# 4. Start everything via PM2 (from project root)
pnpm run build           # build the api-server first
pm2 start ecosystem.config.cjs
pm2 save                 # persist across reboots
```

---

## Running manually (without PM2)

```bash
cd audio-receiver
source .venv/bin/activate
python3 src/main.py

# Custom config path:
python3 src/main.py --config config/microphones.yaml
```

---

## Configuration

All settings are in `config/microphones.yaml`. Key sections:

### Node config
```yaml
nodes:
  - id: front-porch
    rtsp_url: "rtsp://192.168.1.101:8554/mic"
    analyzers: [birdnet, batnet]
    sample_rate: 48000
    chunk_secs: 15
    enabled: true
```

### Archive rules
Controls what gets saved to `./data/audio/`. The definition of "interesting"
is intentionally kept in config — no code changes needed to update it:

```yaml
archive:
  enabled: true
  rules:
    - name: "high_confidence_detection"
      min_confidence: 0.85
      analyzers: []          # empty = all analyzers

    - name: "bat_any"
      min_confidence: 0.0
      analyzers: [batnet]    # save ALL bat detections

    - name: "species_watchlist"
      species_contains: ["Owl", "Hawk", "Falcon"]
```

---

## API endpoints (served by api-server)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audio/nodes` | All node summaries + status |
| `GET` | `/api/audio/nodes/:nodeId` | Single node status |
| `GET` | `/api/audio/nodes/:nodeId/detections` | Recent detections (`?limit=50&analyzer=birdnet&min_conf=0.7`) |
| `GET` | `/api/audio/feed` | Cross-node global feed (`?limit=100`) |

## WebSocket events (Socket.IO)

| Event | Payload | Description |
|-------|---------|-------------|
| `audio:detection` | `AudioDetection` | Fires for every new detection |
| `audio:node:status` | `{ nodeId, status, detail }` | Node goes online/offline/degraded |

---

## Adding a new analyzer

1. Create `src/analyzers/<name>_runner.py` implementing `BaseAnalyzer`
2. Add it to `_REGISTRY` in `src/analyzers/__init__.py`
3. Add a config block in `config/microphones.yaml` (same key as `name`)
4. Add the key to the `analyzers:` list on relevant nodes

No changes to `main.py`, `rtsp_node.py`, or `audio_pipeline.py` needed.

---

## Archived clips

Clips saved by the archiver are stored at:
```
audio-receiver/data/audio/<node-id>/<YYYY-MM-DD>/<node-id>_<epoch_ms>_<rule>.wav
```

Retention is controlled by `archive.retention_days` in config. A cleanup
cron job (to be added) will enforce this. The audio-receiver itself never
deletes files.
