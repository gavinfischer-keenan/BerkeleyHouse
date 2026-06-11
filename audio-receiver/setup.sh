#!/usr/bin/env bash
# =============================================================================
# setup.sh — Complete build script for Berkeley House audio-receiver
# =============================================================================
#
# Run this once on the processing host (Raspberry Pi, Jetson, home server).
# Re-running is safe: steps are idempotent where possible.
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# What this installs:
#   1. System packages: python3, pip3, ffmpeg, git
#   2. Python virtual environment + pip packages (PyYAML)
#   3. BirdNET-Analyzer (GitHub clone → /opt/BirdNET-Analyzer)
#   4. BatNET-Detector  (GitHub clone → /opt/BatNET-Detector)
#   5. Archive data directory (./data/audio)
#   6. PM2 process manager (Node.js) — if not already installed
#
# Tested on: Raspberry Pi OS Bookworm (64-bit), Ubuntu 22.04 LTS
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[SETUP]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN] ${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# =============================================================================
# STEP 1 — System packages
# =============================================================================
# Required:
#   python3      — runtime for audio-receiver, BirdNET-Analyzer, BatNET-Detector
#   python3-pip  — package installer
#   python3-venv — isolated Python environment (avoids system package conflicts)
#   ffmpeg       — RTSP stream capture and WAV chunk extraction
#                  Audio codec pipeline: RTSP → pcm_s16le / flac → WAV file
#                  Install docs: https://ffmpeg.org/download.html
#   git          — clones BirdNET-Analyzer and BatNET-Detector from GitHub
# =============================================================================

info "Step 1: Installing system packages..."

if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y \
        python3 \
        python3-pip \
        python3-venv \
        ffmpeg \
        git \
        curl
elif command -v dnf &>/dev/null; then
    sudo dnf install -y python3 python3-pip ffmpeg git curl
else
    warn "Unknown package manager — please install manually: python3 python3-pip ffmpeg git"
fi

# Verify ffmpeg is available (critical dependency)
if ! command -v ffmpeg &>/dev/null; then
    error "ffmpeg not found after install attempt. Install manually: sudo apt install ffmpeg"
fi
FFMPEG_VERSION=$(ffmpeg -version 2>&1 | head -1)
info "ffmpeg OK: $FFMPEG_VERSION"

# =============================================================================
# STEP 2 — Python virtual environment
# =============================================================================
# A venv isolates audio-receiver's Python packages from the system Python,
# preventing conflicts with BirdNET-Analyzer's own dependencies.
#
# Activate before running the service:
#   source .venv/bin/activate
#   python3 src/main.py
#
# PM2 is configured to activate the venv automatically via the interpreter
# path in ecosystem.config.cjs.
# =============================================================================

info "Step 2: Creating Python virtual environment (.venv)..."

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    info "Virtual environment created."
else
    info "Virtual environment already exists — skipping creation."
fi

# Upgrade pip inside venv
.venv/bin/pip install --upgrade pip --quiet

# Install Python packages
# PyYAML: config/microphones.yaml parser
#   https://pypi.org/project/PyYAML/
info "Installing Python packages from requirements.txt..."
.venv/bin/pip install PyYAML --quiet
info "Python packages installed."

# =============================================================================
# STEP 3 — BirdNET-Analyzer
# =============================================================================
# BirdNET-Analyzer v2.x by Stefan Kahl (Cornell Lab / Chemnitz University)
# GitHub: https://github.com/kahst/BirdNET-Analyzer
# License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0
#
# The analyzer requires:
#   python3, numpy, librosa, tensorflow (or tflite-runtime on ARM)
#   See /opt/BirdNET-Analyzer/requirements.txt for full list.
#
# On Raspberry Pi (ARM) use tflite-runtime instead of full tensorflow:
#   pip install tflite-runtime
#
# BirdNET CLI used by birdnet_runner.py:
#   python3 analyze.py --i <wav> --o <dir> --lat <lat> --lon <lng>
#                      --week <1-48> --min_conf <0-1> --rtype csv
# =============================================================================

BIRDNET_DIR="/opt/BirdNET-Analyzer"
BIRDNET_REPO="https://github.com/kahst/BirdNET-Analyzer.git"

info "Step 3: Installing BirdNET-Analyzer → $BIRDNET_DIR"

if [ -d "$BIRDNET_DIR/.git" ]; then
    info "BirdNET-Analyzer already cloned — pulling latest..."
    sudo git -C "$BIRDNET_DIR" pull --quiet
else
    info "Cloning BirdNET-Analyzer (this may take a few minutes)..."
    sudo git clone --depth=1 "$BIRDNET_REPO" "$BIRDNET_DIR"
fi

# Install BirdNET's own Python dependencies into the shared system Python
# (BirdNET-Analyzer is invoked as a subprocess, not imported as a library)
if [ -f "$BIRDNET_DIR/requirements.txt" ]; then
    info "Installing BirdNET-Analyzer Python dependencies..."
    # On Pi: tensorflow may fail — install tflite-runtime instead
    if [[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "armv7l" ]]; then
        warn "ARM detected — installing tflite-runtime instead of tensorflow"
        sudo pip3 install tflite-runtime --quiet || warn "tflite-runtime install failed — check manually"
        # Install remaining deps excluding tensorflow
        sudo grep -v "tensorflow" "$BIRDNET_DIR/requirements.txt" | sudo pip3 install -r /dev/stdin --quiet || true
    else
        sudo pip3 install -r "$BIRDNET_DIR/requirements.txt" --quiet
    fi
fi

info "BirdNET-Analyzer ready at $BIRDNET_DIR"

# =============================================================================
# STEP 4 — BatNET-Detector
# =============================================================================
# BatNET-Detector: neural network classifier for bat echolocation calls
# GitHub: https://github.com/kahst/BatNET-Detector (same author as BirdNET)
#
# IMPORTANT: BatNET requires audio recorded at ≥192 kHz to capture ultrasonic
# bat calls. Standard 48 kHz microphones CANNOT capture these calls.
# The audio-receiver will silently skip BatNET on nodes where
# sample_rate < 192000 in microphones.yaml.
#
# Hardware required for BatNET: Ultramic UM200K, AudioMoth, or
# similar ultrasonic-capable recorder.
#
# BatNET CLI used by batnet_runner.py:
#   python3 batnet.py --input <wav> --output <dir>
#                     --threshold <0-1> --format json
# =============================================================================

BATNET_DIR="/opt/BatNET-Detector"
BATNET_REPO="https://github.com/kahst/BatNET-Detector.git"

info "Step 4: Installing BatNET-Detector → $BATNET_DIR"

if [ -d "$BATNET_DIR/.git" ]; then
    info "BatNET-Detector already cloned — pulling latest..."
    sudo git -C "$BATNET_DIR" pull --quiet
else
    info "Cloning BatNET-Detector..."
    # NOTE: If the repo is not yet public, this step will fail.
    # In that case, manually place BatNET-Detector at $BATNET_DIR
    # and ensure batnet.py exists at that location.
    sudo git clone --depth=1 "$BATNET_REPO" "$BATNET_DIR" 2>/dev/null || {
        warn "BatNET-Detector clone failed — may not be publicly available yet."
        warn "Manually install at: $BATNET_DIR"
        warn "batnet_runner.py will gracefully no-op until the path exists."
        sudo mkdir -p "$BATNET_DIR"
    }
fi

if [ -f "$BATNET_DIR/requirements.txt" ]; then
    info "Installing BatNET-Detector Python dependencies..."
    sudo pip3 install -r "$BATNET_DIR/requirements.txt" --quiet
fi

info "BatNET-Detector step complete."

# =============================================================================
# STEP 5 — Archive data directory
# =============================================================================
# Audio clips judged "interesting" by archive rules are saved here.
# Structure:
#   data/audio/<node-id>/YYYY-MM-DD/<node-id>_<epoch>.wav
# =============================================================================

info "Step 5: Creating archive data directory..."
mkdir -p ./data/audio
info "Archive directory: $SCRIPT_DIR/data/audio"

# =============================================================================
# STEP 6 — PM2 process manager (Node.js)
# =============================================================================
# PM2 manages the audio-receiver as a persistent background process alongside
# the api-server and other Berkeley House services.
# Docs: https://pm2.keymetrics.io
#
# If PM2 is already installed (from the api-server setup), this step is a no-op.
# PM2 config: ../ecosystem.config.cjs
#
# To start all Berkeley House services:
#   cd .. && pm2 start ecosystem.config.cjs
#
# To view logs:
#   pm2 logs audio-receiver
# =============================================================================

info "Step 6: Checking PM2..."

if ! command -v pm2 &>/dev/null; then
    info "PM2 not found — installing globally via npm..."
    if ! command -v npm &>/dev/null; then
        warn "npm not found. Install Node.js first: https://nodejs.org"
        warn "Then run: sudo npm install -g pm2"
    else
        sudo npm install -g pm2 --quiet
        pm2 startup || warn "pm2 startup failed — run manually as root if needed"
    fi
else
    info "PM2 already installed: $(pm2 --version)"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Berkeley House audio-receiver setup complete!         ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "  ffmpeg:            $(command -v ffmpeg)"
echo "  Python venv:       $SCRIPT_DIR/.venv"
echo "  BirdNET-Analyzer:  $BIRDNET_DIR"
echo "  BatNET-Detector:   $BATNET_DIR"
echo "  Archive dir:       $SCRIPT_DIR/data/audio"
echo ""
echo "  Edit node IPs in:  config/microphones.yaml"
echo ""
echo "  Run manually:"
echo "    source .venv/bin/activate"
echo "    python3 src/main.py"
echo ""
echo "  Run via PM2 (from project root):"
echo "    pm2 start ecosystem.config.cjs --only audio-receiver"
echo ""
