"""Read-only Sentinel catalogue discovery with bounded retry metadata."""

from dataclasses import dataclass
import requests


@dataclass(frozen=True)
class SentinelCamera:
    id: str
    number: str | None
    name: str | None
    location: str | None
    codec: str | None
    live: bool
    width: int | None
    height: int | None
    fps: float | None
    bitrate_kbps: int | None
    rtsp_url: str | None
    webrtc_url: str | None
    hls_live_url: str | None
    latitude: float | None = None
    longitude: float | None = None


def _number(value):
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def discover(base_url: str, timeout: int = 15):
    """Fetch and normalize only live cameras that expose an RTSP consumer URL."""
    url = f"{base_url.rstrip('/')}/api/ingest"
    response = requests.get(url, timeout=timeout, headers={"Accept": "application/json", "User-Agent": "NetraX-AI/1.0"})
    if response.status_code != 200:
        raise RuntimeError(f"Sentinel catalogue HTTP {response.status_code}: {response.text[:200]}")
    payload = response.json()
    raw_cameras = payload if isinstance(payload, list) else payload.get("cameras", [])
    cameras = []
    for raw in raw_cameras:
        camera = SentinelCamera(
            id=str(raw.get("id")), number=str(raw["number"]) if raw.get("number") is not None else None,
            name=raw.get("name"), location=raw.get("location"), codec=raw.get("codec"),
            live=raw.get("live") is True or str(raw.get("live", "")).lower() in {"1", "true", "yes"}, width=_number(raw.get("width")), height=_number(raw.get("height")),
            fps=float(raw["fps"]) if raw.get("fps") not in (None, "") else None,
            bitrate_kbps=_number(raw.get("bitrate_kbps")), rtsp_url=raw.get("rtsp_url"),
            webrtc_url=raw.get("webrtc_url"), hls_live_url=raw.get("hls_live_url"),
            latitude=float(raw["latitude"]) if raw.get("latitude") not in (None, "") else None,
            longitude=float(raw["longitude"]) if raw.get("longitude") not in (None, "") else None,
        )
        if camera.live and camera.rtsp_url:
            cameras.append(camera)
    return cameras, len(raw_cameras)


def discover_persisted(backend_url: str, timeout: int = 10):
    """Use the last successful Sentinel RTSP catalogue stored by NetraX."""
    # Use the complete persisted registry. A camera may be ONLINE, DISCOVERED,
    # or temporarily degraded while still having a valid RTSP consumer URL.
    response = requests.get(f"{backend_url.rstrip('/')}/api/cameras?limit=1000", timeout=timeout)
    response.raise_for_status()
    cameras = []
    for raw in response.json().get("cameras", []):
        rtsp_url = raw.get("rtsp_url")
        if not rtsp_url:
            continue
        camera_id = str(raw.get("camera_id", ""))
        sentinel_id = camera_id.removeprefix("SENTINEL-") or camera_id
        cameras.append(SentinelCamera(
            id=sentinel_id, number=sentinel_id, name=raw.get("name"), location=raw.get("location_name"),
            codec=raw.get("stream_codec"), live=True, width=_number(raw.get("stream_width")),
            height=_number(raw.get("stream_height")), fps=None, bitrate_kbps=None, rtsp_url=rtsp_url,
            webrtc_url=raw.get("webrtc_url"), hls_live_url=raw.get("hls_url"),
            latitude=float(raw["latitude"]) if raw.get("latitude") not in (None, "") else None,
            longitude=float(raw["longitude"]) if raw.get("longitude") not in (None, "") else None,
        ))
    return cameras, len(cameras)
