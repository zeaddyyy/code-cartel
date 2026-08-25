# Hackathon capability mapping

| Requirement | NetraX implementation | Status |
|---|---|---|
| Registry/GIS foundation | PostgreSQL/PostGIS cameras, health, streams and coordinates | IMPLEMENTED |
| Unified viewing and analytics | React camera grid, filters, detections and snapshots | IMPLEMENTED / TESTED |
| VMS federation | Sentinel catalogue and connector-oriented RTSP ingestion | ARCHITECTURE READY; Sentinel externally blocked |
| Central AI platform | FFmpeg → Python → YOLO → ByteTrack → API → PostgreSQL | TESTED locally |
| ANPR | Optional plate detector/OCR extension with no fabricated output | ARCHITECTURE READY; model unavailable |
| Vehicle tracking | Camera-scoped ByteTrack IDs and cooldown | TESTED locally |
| 80,000-camera target | Regional/shard simulator and horizontal scaling design | ARCHITECTURE READY; simulation safe |
| Speed analytics | Calibration and review boundary documented | ARCHITECTURE READY; not legally enforceable |
| Security/auditability | Helmet, server-side RTSP, backup discipline and security guidance | PARTIAL / ARCHITECTURE READY |
