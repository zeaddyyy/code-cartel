"""Configurable ANPR stage. It never invents plates or owner details."""

import os
import re
import shutil
import subprocess
from pathlib import Path

import cv2
from ultralytics import YOLO


class ANPRProcessor:
    def __init__(self):
        # ANPR is opt-in: missing models or OCR tools must degrade to an
        # explicit unavailable state rather than produce guessed plate text.
        self.enabled = os.getenv("ANPR_ENABLED", "false").lower() == "true"
        self.plate_model_path = os.getenv("PLATE_MODEL_PATH", "")
        self.model = None
        self.available = False
        if self.enabled and self.plate_model_path and Path(self.plate_model_path).is_file() and shutil.which("tesseract"):
            self.model = YOLO(self.plate_model_path)
            self.available = True
            print(f"ANPR enabled with plate model {self.plate_model_path} and tesseract OCR")
        elif self.enabled:
            print("ANPR enabled but PLATE_MODEL_PATH or tesseract is unavailable; no plate values will be generated")

    def process_vehicle(self, frame, detection):
        # OCR is only attempted inside a detected vehicle crop; no plate is
        # returned unless both a plate detector and OCR result are available.
        if not self.available:
            return None
        height, width = frame.shape[:2]
        x1, y1, x2, y2 = detection["x1"], detection["y1"], detection["x2"], detection["y2"]
        crop = frame[max(0, y1):min(height, y2), max(0, x1):min(width, x2)]
        if crop.size == 0:
            return None
        for result in self.model(crop, conf=0.25, verbose=False):
            for box in result.boxes:
                px1, py1, px2, py2 = (int(v) for v in box.xyxy[0].tolist())
                plate = crop[max(0, py1):min(crop.shape[0], py2), max(0, px1):min(crop.shape[1], px2)]
                if plate.size == 0:
                    continue
                gray = cv2.resize(cv2.cvtColor(plate, cv2.COLOR_BGR2GRAY), None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
                ok, encoded = cv2.imencode(".png", gray)
                if not ok:
                    continue
                ocr = subprocess.run(["tesseract", "stdin", "stdout", "--psm", "7", "-l", "eng"], input=encoded.tobytes(), capture_output=True, check=False)
                normalized = re.sub(r"[^A-Z0-9]", "", ocr.stdout.decode(errors="ignore").upper())
                if normalized:
                    return {"plate_number": normalized, "plate_confidence": round(float(box.conf[0]), 4)}
        return None
