# NetraX submission and scale readiness

## Sentinel integration compliance

- Catalogue is the source of camera IDs, URLs, live state, codec, resolution, and stream properties.
- AI ingestion uses RTSP over TCP only and never publishes to Sentinel.
- FFmpeg `showinfo` PTS drives inference cadence; declared FPS and frame-arrival time are not used as video timing.
- H.264/H.265 and per-camera resolutions are handled independently through FFprobe and per-camera workers.
- Join-time decoder warnings are retained in worker diagnostics; they do not immediately terminate a worker.
- Worker reconnects use 2, 4, 8, 16, then 30-second maximum backoff.
- Camera health records connected, disconnected, reconnecting, and error transitions.

## 80,000-camera deployment plan

The local PoC intentionally caps concurrent workers with `MAX_CAMERAS`. A statewide deployment must use a control plane and distributed ingest pools:

1. Catalogue poller writes camera metadata and desired state to a durable queue/database.
2. Scheduler shards cameras across ingest nodes based on CPU/GPU, bitrate, codec, and network capacity.
3. Each ingest node runs a bounded worker pool; one camera failure is isolated to its worker.
4. Frames are sampled at the edge and only detections, snapshots, health, and alerts traverse the central bus.
5. PostgreSQL is partitioned by detected date/camera shard; snapshots use object storage with lifecycle retention.
6. Dashboard APIs use pagination and indexed filters; no endpoint loads the entire statewide event set.
7. Prometheus-compatible metrics and alerting track connection state, decode errors, inference latency, queue depth, and dropped frames.

The current repository implements the bounded worker, pagination, health, event, and snapshot foundations. It does not claim that one development machine can run 80,000 live decoders.
