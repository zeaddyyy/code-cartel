import numpy as np

from speed import CameraCalibration, SpeedEstimator


def test_calibrated_speed_uses_pts_and_world_coordinates():
    estimator = SpeedEstimator(CameraCalibration("cam-a", np.eye(3), 50, 5))
    assert estimator.update("track-1", (0, 0, 10, 0), 1.0) is None
    observation = estimator.update("track-1", (10, 0, 20, 0), 2.0)
    assert observation["speed_kph"] == 36.0
    assert observation["speed_violation"] is False
    assert observation["status"] == "REVIEW_REQUIRED"
