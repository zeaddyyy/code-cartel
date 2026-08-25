# NetraX 80,000-camera scalability architecture

NetraX is not claiming that one laptop can decode or infer 80,000 live
streams. The 80,000 figure is a registry and distributed deployment target.
The safe demonstration is available through `python tools/registry_simulator.py
--count 80000`; it creates metadata in memory only, opens zero streams, and
does not write simulated government data to PostgreSQL.

## Deployment shape

`camera registry → regional gateways → stream workers → GPU inference pools →
event bus → event processors → PostgreSQL/PostGIS + object storage → command
center`.

Cameras are assigned to regional gateways and shards. Stream workers are
bounded processes that own connection state and reconnect independently.
Inference workers should be scaled horizontally by GPU capacity, while event
processors and the API should scale independently. A production deployment
would use Kubernetes or an equivalent scheduler, node pools with GPU labels,
autoscaling on queue depth, and separate hot/warm/cold evidence storage.

Actual sizing must be measured from the selected codec, resolution, bitrate,
sampling rate, model, GPU, retention policy, and network topology. No
unmeasured bandwidth, FPS, or GPU-capacity claims are made here.

## Failure and security boundaries

Regional gateways isolate WAN failures. Workers use bounded exponential
backoff and do not retry dead endpoints in a tight loop. RTSP credentials must
remain server-side; the React application receives metadata and browser-safe
preview URLs only. Production access requires TLS, RBAC, rate limiting, audit
logs, secret management, and network segmentation.
