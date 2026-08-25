#!/usr/bin/env python3
"""Generate a bounded in-memory camera registry plan without opening streams.

This is a capacity/partitioning demonstration only. It never connects to a
camera, starts FFmpeg, or inserts simulated cameras into PostgreSQL.
"""

import argparse
import json
from collections import Counter

REGIONS = ("REGION_NORTH", "REGION_SOUTH", "REGION_CENTRAL", "REGION_EAST", "REGION_WEST")


def build_plan(count: int):
    if count < 0:
        raise ValueError("count must be non-negative")
    rows = []
    for index in range(count):
        region_index = index % len(REGIONS)
        region = REGIONS[region_index]
        rows.append({
            "camera_id": f"SIM-{index + 1:06d}",
            "region": region,
            "worker_pool": f"{region.lower()}-pool-{(index // len(REGIONS)) % 32:02d}",
            "shard": index % 256,
            "source_type": "SIMULATION",
            "opens_stream": False,
        })
    return rows


def main():
    parser = argparse.ArgumentParser(description="Safe NetraX registry scale simulation")
    parser.add_argument("--count", type=int, default=80000)
    parser.add_argument("--sample", type=int, default=5)
    args = parser.parse_args()
    plan = build_plan(args.count)
    print(json.dumps({
        "simulated_camera_count": len(plan),
        "streams_opened": 0,
        "regions": dict(Counter(row["region"] for row in plan)),
        "shards": 256 if plan else 0,
        "sample": plan[:max(0, args.sample)],
    }, indent=2))


if __name__ == "__main__":
    main()
