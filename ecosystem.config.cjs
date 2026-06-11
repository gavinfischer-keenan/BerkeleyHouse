/**
 * PM2 Process Registry — Berkeley House
 *
 * All services run on the same Linux host (home server / Raspberry Pi).
 * Start all:    pm2 start ecosystem.config.cjs
 * Start one:    pm2 start ecosystem.config.cjs --only audio-receiver
 * View logs:    pm2 logs [name]
 * Save state:   pm2 save   (persists across reboots via `pm2 startup`)
 */

module.exports = {
  apps: [

    // ── Berkeley Command Center API (Node.js / Express + Socket.IO) ──────────
    // Serves REST endpoints and WebSocket hub for all data consumers.
    // Build first with: pnpm run build
    {
      name: 'berkeley-command-center-api',
      script: 'artifacts/api-server/dist/index.mjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5050,
      },
      // Loads AISSTREAM_API_KEY, ADSB_SOURCE, AIS_SOURCE, etc.
      env_file: '.env',
    },

    // ── Audio Receiver (Python) ───────────────────────────────────────────────
    // Connects to RTSP streams from microphone nodes, runs BirdNET + BatNET,
    // archives interesting clips, and POSTs detections to the api-server above.
    //
    // Dependencies (installed by audio-receiver/setup.sh):
    //   System:  ffmpeg, python3, git
    //   Python:  PyYAML (in .venv)
    //   Extern:  BirdNET-Analyzer @ /opt/BirdNET-Analyzer
    //            BatNET-Detector  @ /opt/BatNET-Detector
    //
    // Node config: audio-receiver/config/microphones.yaml
    //   Active nodes: front-porch, shed
    //   Disabled:     garden-east, roof-north, backyard-west, study
    //
    // Ingest target: http://localhost:5050/api/ingest/audio-<nodeId>
    {
      name: 'audio-receiver',
      // Use the venv Python installed by setup.sh to avoid dependency conflicts
      interpreter: './audio-receiver/.venv/bin/python3',
      script: 'src/main.py',
      cwd: './audio-receiver',
      autorestart: true,
      restart_delay: 5000,        // 5s cooldown before restart on crash
      max_memory_restart: '512M',
      env: {
        PYTHONUNBUFFERED: '1',    // ensures log lines appear immediately in pm2 logs
        PYTHONPATH: './src',      // makes local src/ modules importable
      },
    },

  ],
};

