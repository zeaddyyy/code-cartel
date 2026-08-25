#!/usr/bin/env bash
# Start every live Sentinel RTSP worker. This script never publishes streams.
set -euo pipefail
cd "$(dirname "$0")"
export AI_SOURCE="${AI_SOURCE:-sentinel}"
export MAX_CAMERAS="${MAX_CAMERAS:-0}"
exec venv/bin/python ai_live.py
