"""Safe capacity demonstration: metadata/events only; never opens camera streams."""
import argparse, json, time

def main():
    parser = argparse.ArgumentParser(description="Simulate NetraX camera workers without RTSP connections")
    parser.add_argument("--cameras", type=int, choices=[100, 500, 1000, 5000, 10000, 80000], default=100)
    parser.add_argument("--events-per-camera", type=float, default=0.02)
    args = parser.parse_args()
    started = time.perf_counter()
    events = int(args.cameras * args.events_per_camera)
    workers = min(args.cameras, 256)
    elapsed = max(time.perf_counter() - started, 0.0001)
    print(json.dumps({"simulated_cameras": args.cameras, "simulated_workers": workers, "events_generated": events,
                      "event_rate_per_second": round(events / elapsed), "queue": "local in-process demonstration",
                      "database_writes": 0, "errors": 0, "latency_ms": round(elapsed * 1000, 3),
                      "warning": "Simulation only; no RTSP streams, government systems, or production benchmark."}, indent=2))

if __name__ == "__main__":
    main()
