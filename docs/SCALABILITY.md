# Scalability

The 80,000-camera figure is an architectural target, not a claim about this laptop. Production partitions cameras by region and schedules independent stream/AI workers on GPU nodes. Kafka partitions events, Redis holds worker health and active tracks, and Postgres is indexed/partitioned by camera and time. `python3 tools/scale_test.py --cameras 80000` demonstrates metadata orchestration only; it opens no RTSP streams and is not a production benchmark.
