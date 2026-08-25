#!/usr/bin/env python3
"""Read-only NetraX camera manager: Sentinel RTSP/TCP -> FFmpeg -> YOLO -> API."""

import argparse
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import cv2
import requests
from ultralytics import YOLO

from anpr import ANPRProcessor
from sentinel import SentinelCamera, discover, discover_persisted

SERVICE_DIR = Path(__file__).resolve().parent
LOCAL_SOURCE = "/tmp/sentinel_live.ts"
MODEL_PATH = SERVICE_DIR / "yolo11n.pt"
VEHICLE_CLASSES = {"car", "motorcycle", "bus", "truck"}


def load_dotenv():
    """Load a local developer .env without adding another runtime dependency."""
    env_file = SERVICE_DIR / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL", os.getenv("NETRAX_BACKEND_URL", "http://localhost:5001")).rstrip("/")
SENTINEL_BASE_URL = os.getenv("SENTINEL_BASE_URL", "https://live.corp8.cloud")
AI_SOURCE = os.getenv("AI_SOURCE", "auto").lower()
# Keep a bounded development default. MAX_CAMERAS=0 explicitly means all
# eligible cameras returned by the Sentinel catalogue.
MAX_CAMERAS = max(0, int(os.getenv("MAX_CAMERAS", "0")))
INFERENCE_FPS = max(0.1, float(os.getenv("INFERENCE_FPS", "5")))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", os.getenv("NETRAX_CONFIDENCE", "0.40")))
COOLDOWN_SECONDS = max(0.0, float(os.getenv("DETECTION_COOLDOWN_SECONDS", "2")))
LOCAL_CAMERA_DB_ID = os.getenv("CAMERA_ID") or os.getenv("NETRAX_CAMERA_DB_ID", "8baacee1-e4e2-4e20-bda9-05c96cb25d30")
SNAPSHOT_DIR = Path(os.getenv("SNAPSHOT_DIR", "/tmp/netrax_snapshots"))
SNAPSHOT_URL_BASE = os.getenv("SNAPSHOT_URL_BASE", f"{BACKEND_URL}/api/snapshots").rstrip("/")


def parse_args():
    parser = argparse.ArgumentParser(description="NetraX Sentinel camera manager")
    parser.add_argument("--source", help="explicit local file input (keeps the fixture testable)")
    parser.add_argument("--run-seconds", type=float, default=0, help="bounded worker test duration; 0 runs Sentinel workers continuously")
    return parser.parse_args()


def ffprobe_dimensions(source, is_rtsp):
    command = ["ffprobe", "-v", "error"]
    if is_rtsp:
        command += ["-rtsp_transport", "tcp", "-rw_timeout", "15000000"]
    command += ["-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", source]
    result = subprocess.run(command, capture_output=True, text=True, timeout=20, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffprobe returned no video stream")
    streams = json.loads(result.stdout).get("streams", [])
    if not streams or not streams[0].get("width") or not streams[0].get("height"):
        raise RuntimeError("ffprobe could not determine source dimensions")
    return int(streams[0]["width"]), int(streams[0]["height"])


class FrameStream:
    """FFmpeg raw-frame reader. showinfo PTS is preferred to declared camera FPS."""
    def __init__(self, source, width, height, is_rtsp):
        self.source, self.width, self.height, self.is_rtsp = source, width, height, is_rtsp
        self.process = None
        self.pts = queue.Queue(maxsize=128)
        self.stderr_tail = deque(maxlen=20)

    def start(self):
        # showinfo emits frame PTS at info level. Decoder warnings remain
        # diagnostic only and are not treated as fatal by the worker.
        command = ["ffmpeg", "-hide_banner", "-loglevel", "info"]
        if self.is_rtsp:
            command += ["-rtsp_transport", "tcp", "-rw_timeout", "15000000"]
        command += ["-copyts", "-i", self.source, "-an", "-vf", "showinfo", "-f", "rawvideo", "-pix_fmt", "bgr24", "pipe:1"]
        self.process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=10**7)
        threading.Thread(target=self._read_stderr, daemon=True).start()

    def _read_stderr(self):
        for raw in iter(self.process.stderr.readline, b""):
            line = raw.decode(errors="replace").strip()
            self.stderr_tail.append(line)
            match = re.search(r"pts_time:([\-0-9.]+)", line)
            if match:
                try:
                    self.pts.put_nowait(float(match.group(1)))
                except queue.Full:
                    pass

    def frames(self, stop_event):
        size = self.width * self.height * 3
        while not stop_event.is_set():
            raw = self.process.stdout.read(size)
            if len(raw) != size:
                details = " | ".join(self.stderr_tail)
                raise RuntimeError(f"FFmpeg frame stream ended ({len(raw)}/{size} bytes): {details[-800:]}")
            try:
                pts = self.pts.get(timeout=0.15)
            except queue.Empty:
                pts = None
            yield np.frombuffer(raw, dtype=np.uint8).reshape(self.height, self.width, 3), pts

    def close(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()


class CameraWorker(threading.Thread):
    def __init__(self, metadata, database_id, source, is_rtsp, stop_event, run_seconds=0):
        super().__init__(daemon=True, name=f"camera-{metadata.id}")
        self.metadata, self.database_id, self.source, self.is_rtsp = metadata, database_id, source, is_rtsp
        self.stop_event, self.run_seconds = stop_event, run_seconds
        self.last_events, self.inferences, self.saved = {}, 0, 0

    def health(self, status, latency_ms=None):
        try:
            requests.post(f"{BACKEND_URL}/api/cameras/{self.database_id}/health", json={
                "status": status, "last_seen": datetime.now(timezone.utc).isoformat(), "latency_ms": latency_ms,
            }, timeout=5)
        except requests.RequestException as error:
            print(f"[{self.metadata.id}] health update failed: {error}")

    def _event_key(self, detection):
        return (self.database_id, detection["object_class"], detection["track_id"])

    def post(self, detection):
        key, now = self._event_key(detection), time.monotonic()
        if now - self.last_events.get(key, float("-inf")) < COOLDOWN_SECONDS:
            return False
        payload = {"camera_id": self.database_id, "detected_at": datetime.now(timezone.utc).isoformat(), "source": "SENTINEL_AI", **detection}
        response = requests.post(f"{BACKEND_URL}/api/detections", json=payload, timeout=10)
        if response.status_code != 201:
            raise RuntimeError(f"detection API HTTP {response.status_code}: {response.text[:300]}")
        self.last_events[key] = now
        self.saved += 1
        print(f"[{self.metadata.id}] class={detection['object_class']} confidence={detection['confidence']:.4f} bbox={detection['x1']},{detection['y1']},{detection['x2']},{detection['y2']} track={detection['track_id']} db_id={response.json()['detection']['id']}")
        return True

    def save_snapshot(self, frame, detection):
        """Persist an evidence frame; no plate/owner values are inferred here."""
        SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
        safe_camera = re.sub(r"[^A-Za-z0-9_-]", "_", self.metadata.id)
        safe_track = re.sub(r"[^A-Za-z0-9_-]", "_", detection["track_id"])
        filename = f"{safe_camera}_{safe_track}_{int(time.time() * 1000)}.jpg"
        path = SNAPSHOT_DIR / filename
        if not cv2.imwrite(str(path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85]):
            raise RuntimeError(f"could not save snapshot {path}")
        return f"{SNAPSHOT_URL_BASE}/{filename}"

    def infer(self, model, frame, width, height, anpr):
        try:
            results = model.track(frame, persist=True, tracker="bytetrack.yaml", conf=CONFIDENCE_THRESHOLD, verbose=False)
        except Exception as error:
            print(f"[{self.metadata.id}] ByteTrack unavailable ({error}); using detector-only fallback")
            results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)
        detections = []
        for result in results:
            for index, box in enumerate(result.boxes):
                confidence = float(box.conf[0])
                if confidence < CONFIDENCE_THRESHOLD:
                    continue
                x1, y1, x2, y2 = (int(round(value)) for value in box.xyxy[0].tolist())
                raw_id = int(box.id[0]) if box.id is not None else None
                fallback = f"bbox-{x1 // 80}-{y1 // 80}-{x2 // 80}-{y2 // 80}"
                track_id = f"{self.metadata.id}:{raw_id if raw_id is not None else fallback}"
                detection = {"object_class": model.names[int(box.cls[0])], "confidence": round(confidence, 4),
                             "x1": max(0, min(x1, width)), "y1": max(0, min(y1, height)),
                             "x2": max(0, min(x2, width)), "y2": max(0, min(y2, height)), "track_id": track_id}
                detections.append(detection)
                if detection["object_class"] in VEHICLE_CLASSES:
                    detection["snapshot_path"] = self.save_snapshot(frame, detection)
                    anpr_result = anpr.process_vehicle(frame, detection)
                    if isinstance(anpr_result, dict):
                        detection.update(anpr_result)
        return detections

    def run(self):
        if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
            print(f"[{self.metadata.id}] ERROR FFmpeg and FFprobe are required")
            return
        model, anpr = YOLO(str(MODEL_PATH)), ANPRProcessor()
        retry, delay, started = 0, 2, time.monotonic()
        while not self.stop_event.is_set():
            if self.run_seconds and time.monotonic() - started >= self.run_seconds:
                break
            stream = None
            try:
                self.health("RECONNECTING" if retry else "CONNECTED")
                connection_start = time.monotonic()
                width, height = ffprobe_dimensions(self.source, self.is_rtsp)
                print(f"[{self.metadata.id}] connected source={width}x{height}; YOLO returns original-resolution boxes")
                stream = FrameStream(self.source, width, height, self.is_rtsp)
                stream.start()
                self.health("CONNECTED", int((time.monotonic() - connection_start) * 1000))
                retry, delay, last_video_time, last_health = 0, 2, None, 0
                for frame, pts in stream.frames(self.stop_event):
                    now = time.monotonic()
                    video_time = pts if pts is not None else now
                    # PTS is authoritative when available; monotonic is only a fallback.
                    if last_video_time is not None and video_time - last_video_time < 1 / INFERENCE_FPS:
                        continue
                    last_video_time = video_time
                    self.inferences += 1
                    for detection in self.infer(model, frame, width, height, anpr):
                        self.post(detection)
                    if now - last_health >= 5:
                        self.health("CONNECTED")
                        last_health = now
                self.health("DISCONNECTED")
            except Exception as error:
                if not self.is_rtsp:
                    self.health("DISCONNECTED")
                    print(f"[{self.metadata.id}] local fixture completed: {error}")
                    break
                self.health("ERROR")
                retry += 1
                print(f"[{self.metadata.id}] status=ERROR error={error} retry={retry} next_retry={delay}s")
                if not self.is_rtsp:  # Fixture is finite; preserve its normal one-pass behavior.
                    break
                self.stop_event.wait(delay)
                delay = min(delay * 2, 30)
            finally:
                if stream:
                    stream.close()
        print(f"[{self.metadata.id}] stopped inferences={self.inferences} saved={self.saved}")


class CameraManager:
    def __init__(self, run_seconds):
        self.run_seconds, self.stop_event, self.workers = run_seconds, threading.Event(), []

    def sync_camera(self, camera):
        payload = {key: getattr(camera, key) for key in ("name", "location", "codec", "live", "width", "height", "fps", "bitrate_kbps", "rtsp_url", "webrtc_url", "hls_live_url", "latitude", "longitude")}
        payload["sentinel_id"] = camera.id
        response = requests.post(f"{BACKEND_URL}/api/cameras/sentinel/upsert", json=payload, timeout=10)
        if response.status_code != 200:
            raise RuntimeError(f"camera upsert HTTP {response.status_code}: {response.text[:300]}")
        return response.json()["camera"]["id"]

    def local(self, source):
        camera = SentinelCamera(id="local-sentinel-13", number="13", name="Sentinel Camera 13 (local fixture)", location="Local test fixture", codec="H264", live=True, width=None, height=None, fps=None, bitrate_kbps=None, rtsp_url=None, webrtc_url=None, hls_live_url=None)
        worker = CameraWorker(camera, LOCAL_CAMERA_DB_ID, source, False, self.stop_event, self.run_seconds)
        self.workers = [worker]
        print(f"AI_SOURCE=local: using fallback fixture {source}")
        worker.start(); worker.join()

    def sentinel(self):
        try:
            cameras, catalogue_count = discover(SENTINEL_BASE_URL)
        except (RuntimeError, requests.RequestException, ValueError) as error:
            raise RuntimeError(f"Sentinel discovery failed: {error}") from error
        selected = cameras if MAX_CAMERAS == 0 else cameras[:MAX_CAMERAS]
        print(f"Sentinel catalogue cameras={catalogue_count} eligible_live_rtsp={len(cameras)} selected={len(selected)} ids={[camera.id for camera in selected]}")
        for camera in selected:
            try:
                database_id = self.sync_camera(camera)
                self.workers.append(CameraWorker(camera, database_id, camera.rtsp_url, True, self.stop_event, self.run_seconds))
            except Exception as error:
                # A malformed metadata row must not prevent other cameras from
                # receiving workers; the failed camera is reported explicitly.
                print(f"[{camera.id}] camera sync failed; skipping worker: {error}")
        for worker in self.workers: worker.start()
        try:
            if self.run_seconds:
                self.stop_event.wait(self.run_seconds)
            else:
                while any(worker.is_alive() for worker in self.workers): time.sleep(1)
        except KeyboardInterrupt:
            print("stopping Sentinel workers")
        finally:
            self.stop_event.set()
            for worker in self.workers: worker.join(timeout=5)

    def persisted_sentinel(self):
        cameras, count = discover_persisted(BACKEND_URL)
        selected = cameras if MAX_CAMERAS == 0 else cameras[:MAX_CAMERAS]
        print(f"Persisted Sentinel catalogue cameras={count} selected={len(selected)} ids={[camera.id for camera in selected]}")
        for camera in selected:
            try:
                database_id = self.sync_camera(camera)
                self.workers.append(CameraWorker(camera, database_id, camera.rtsp_url, True, self.stop_event, self.run_seconds))
            except Exception as error:
                print(f"[{camera.id}] persisted camera sync failed; skipping worker: {error}")
        for worker in self.workers: worker.start()
        try:
            if self.run_seconds:
                self.stop_event.wait(self.run_seconds)
            else:
                while any(worker.is_alive() for worker in self.workers): time.sleep(1)
        finally:
            self.stop_event.set()
            for worker in self.workers: worker.join(timeout=5)


def main():
    args, manager = parse_args(), None
    manager = CameraManager(args.run_seconds)
    if args.source:
        manager.local(args.source); return
    if AI_SOURCE == "local":
        manager.local(LOCAL_SOURCE); return
    if AI_SOURCE not in {"sentinel", "auto"}:
        raise SystemExit("AI_SOURCE must be local, sentinel, or auto")
    deadline = time.monotonic() + args.run_seconds if args.run_seconds else None
    retry, delay = 0, 2
    while deadline is None or time.monotonic() < deadline:
        try:
            manager.sentinel()
            return
        except RuntimeError as error:
            print(f"Sentinel discovery unavailable: {error}")
            try:
                manager.persisted_sentinel()
                return
            except (RuntimeError, requests.RequestException) as persisted_error:
                if AI_SOURCE == "auto":
                    print(f"AI_SOURCE=auto: persisted live catalogue unavailable ({persisted_error}); using local fixture.")
                    manager.local(LOCAL_SOURCE)
                    return
                print(f"Persisted live catalogue unavailable: {persisted_error}", file=sys.stderr)
            retry += 1
            remaining = max(0, deadline - time.monotonic()) if deadline is not None else delay
            wait_for = min(delay, remaining)
            print(f"Sentinel discovery status=ERROR error={error} retry={retry} next_retry={wait_for}s", file=sys.stderr)
            if wait_for <= 0:
                return
            time.sleep(wait_for)
            delay = min(delay * 2, 30)


if __name__ == "__main__":
    main()
