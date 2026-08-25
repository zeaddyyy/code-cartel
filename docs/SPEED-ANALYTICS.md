# Speed analytics and enforcement boundary

NetraX must not estimate speed from arbitrary pixel displacement. A defensible
measurement requires per-camera calibration: reference points or a homography
mapping image coordinates to the road plane, road direction, a configured
speed limit and tolerance, and PTS-derived time deltas. The resulting event is
an evidence-backed `SPEEDING` observation marked `REVIEW_REQUIRED`.

The current YOLO/ByteTrack pipeline supplies the camera-scoped track and
original-resolution boxes needed by that future stage, but it does not invent
speed, calibration, or legal fines. Automatic fine issuance is intentionally
not implemented: it requires an authorized government enforcement API,
jurisdiction-specific rules, evidentiary validation, retention, and human or
legally mandated review. A missing calibration or missing authorized service
must produce no speed violation and no fine.
