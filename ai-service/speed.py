"""Calibrated, review-only vehicle speed estimation.

This module refuses to estimate speed until a camera homography and road-scale
calibration are supplied. It never issues fines or creates legal conclusions.
"""

from dataclasses import dataclass
from math import hypot

import cv2
import numpy as np


@dataclass(frozen=True)
class CameraCalibration:
    camera_id: str
    homography: np.ndarray
    speed_limit_kph: float
    tolerance_kph: float = 0.0


class SpeedEstimator:
    def __init__(self, calibration: CameraCalibration):
        matrix = np.asarray(calibration.homography, dtype=np.float64)
        if matrix.shape != (3, 3) or not np.isfinite(matrix).all():
            raise ValueError("homography must be a finite 3x3 matrix")
        self.calibration = calibration
        self.previous = {}

    def update(self, track_id: str, bbox, pts_seconds: float):
        """Return a review-only speed observation, or None for the first sample."""
        if pts_seconds is None or not np.isfinite(pts_seconds):
            return None
        x1, y1, x2, y2 = (float(value) for value in bbox)
        # Bottom-centre approximates the vehicle's road contact point.
        image_point = np.array([[[((x1 + x2) / 2.0), y2]]], dtype=np.float32)
        world_point = cv2.perspectiveTransform(image_point, self.calibration.homography.astype(np.float32))[0, 0]
        previous = self.previous.get(track_id)
        self.previous[track_id] = (float(world_point[0]), float(world_point[1]), float(pts_seconds))
        if previous is None:
            return None
        dx = float(world_point[0]) - previous[0]
        dy = float(world_point[1]) - previous[1]
        delta_t = float(pts_seconds) - previous[2]
        if delta_t <= 0:
            return None
        speed_kph = hypot(dx, dy) / delta_t * 3.6
        limit = float(self.calibration.speed_limit_kph)
        return {
            "camera_id": self.calibration.camera_id,
            "track_id": str(track_id),
            "speed_kph": round(speed_kph, 2),
            "speed_limit_kph": limit,
            "speed_violation": speed_kph > limit + float(self.calibration.tolerance_kph),
            "status": "REVIEW_REQUIRED",
            "pts_seconds": float(pts_seconds),
        }
