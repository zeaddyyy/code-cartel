import requests
import subprocess
import time
import re
import sys
import numpy as np

from urllib.parse import urljoin
from ultralytics import YOLO


# ============================================================
# CONFIG
# ============================================================

CAMERA_ID = "13"

BASE_URL = "https://live.corp8.cloud"

MASTER_URL = (
    f"{BASE_URL}/live/stream/{CAMERA_ID}/index.m3u8"
)

WIDTH = 640
HEIGHT = 360

MODEL_PATH = "yolo11n.pt"


# ============================================================
# YOLO
# ============================================================

print("Loading YOLO...")

model = YOLO(MODEL_PATH)

print("✅ YOLO loaded")


# ============================================================
# SESSION
# ============================================================

session = requests.Session()

session.headers.update({
    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 "
        "(KHTML, like Gecko) "
        "Chrome/151.0 Safari/537.36",

    "Accept": "*/*",

    "Referer":
        f"{BASE_URL}/",

    "Origin":
        BASE_URL,
})


# ============================================================
# CREATE SENTINEL SESSION
# ============================================================

def create_sentinel_session():

    print("\nCreating Sentinel HLS session...")

    # IMPORTANT:
    # First request WITHOUT manually forcing cookieCheck.
    # Sentinel may return a redirect that establishes cookieCheck.

    r = session.get(
        MASTER_URL,
        timeout=15,
        allow_redirects=True,
    )

    print("Master:", r.status_code)
    print("Final URL:", r.url)

    print(
        "Response Set-Cookie:",
        r.headers.get("set-cookie")
    )

    print(
        "Session cookies:",
        session.cookies.get_dict()
    )

    # --------------------------------------------------------
    # Sometimes requests does not expose the cookie normally.
    # Extract it manually from Set-Cookie if necessary.
    # --------------------------------------------------------

    set_cookie = r.headers.get("set-cookie")

    if set_cookie:

        match = re.search(
            r"hlsSession=([^;]+)",
            set_cookie
        )

        if match:

            value = match.group(1)

            session.cookies.set(
                "hlsSession",
                value,
                domain="live.corp8.cloud",
                path=f"/live/stream/{CAMERA_ID}/",
            )

            print(
                "✅ Extracted hlsSession:",
                value
            )

    # --------------------------------------------------------
    # cookieCheck
    # --------------------------------------------------------

    if "cookieCheck" not in session.cookies:

        session.cookies.set(
            "cookieCheck",
            "1",
            domain="live.corp8.cloud",
            path=f"/live/stream/{CAMERA_ID}/",
        )

    print(
        "Final cookies:",
        session.cookies.get_dict()
    )

    # We don't abort just because hlsSession isn't visible.
    # The child/segment request is the real test.

    return r.text


# ============================================================
# CHILD PLAYLIST
# ============================================================

def get_child_playlist():

    child_url = (
        f"{BASE_URL}/live/stream/"
        f"{CAMERA_ID}/main_stream.m3u8"
    )

    r = session.get(
        child_url,
        timeout=15,
        headers={
            "Referer":
                f"{BASE_URL}/live/stream/"
                f"{CAMERA_ID}/index.m3u8",

            "Origin":
                BASE_URL,
        },
    )

    print(
        "Child:",
        r.status_code
    )

    if r.status_code != 200:

        print(
            "⚠️ Child playlist unavailable:",
            r.text[:200]
        )

        return None, child_url

    return r.text, child_url


# ============================================================
# GET SEGMENTS
# ============================================================

def get_segments(playlist):

    return re.findall(
        r"(?m)^([^#\s][^\s]*\.ts)\s*$",
        playlist
    )


# ============================================================
# DOWNLOAD SEGMENT
# ============================================================

def download_segment(url):

    r = session.get(
        url,
        timeout=15,
        headers={
            "Referer":
                f"{BASE_URL}/live/stream/"
                f"{CAMERA_ID}/main_stream.m3u8",

            "Origin":
                BASE_URL,

            "Accept":
                "*/*",
        },
    )

    if r.status_code != 200:

        print(
            f"⚠️ Segment HTTP {r.status_code}"
        )

        return None

    if len(r.content) < 1000:

        print(
            "⚠️ Segment too small:",
            len(r.content)
        )

        return None

    return r.content


# ============================================================
# DECODE SEGMENT
# ============================================================

def decode_segment(data):

    command = [
        "ffmpeg",

        "-hide_banner",
        "-loglevel",
        "error",

        "-i",
        "pipe:0",

        "-vf",
        f"scale={WIDTH}:{HEIGHT}",

        "-f",
        "rawvideo",

        "-pix_fmt",
        "bgr24",

        "pipe:1",
    ]

    process = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    stdout, stderr = process.communicate(
        input=data,
        timeout=15,
    )

    if process.returncode != 0:

        print(
            "FFmpeg error:",
            stderr.decode(
                errors="ignore"
            )[:500]
        )

        return []

    frame_size = WIDTH * HEIGHT * 3

    frames = []

    for offset in range(
        0,
        len(stdout) - frame_size + 1,
        frame_size
    ):

        frame = stdout[
            offset:
            offset + frame_size
        ]

        frames.append(frame)

    return frames


# ============================================================
# YOLO
# ============================================================

def run_yolo(frame):

    results = model(
        frame,
        verbose=False,
    )

    detections = []

    for result in results:

        for box in result.boxes:

            confidence = float(
                box.conf[0]
            )

            if confidence < 0.40:
                continue

            class_id = int(
                box.cls[0]
            )

            class_name = model.names[
                class_id
            ]

            detections.append({
                "class": class_name,
                "confidence": round(
                    confidence,
                    3
                ),
            })

    return detections


# ============================================================
# MAIN
# ============================================================

def main():

    processed = set()

    while True:

        try:

            # ----------------------------------------------
            # CREATE SESSION
            # ----------------------------------------------

            create_sentinel_session()

            # ----------------------------------------------
            # LOOP
            # ----------------------------------------------

            for attempt in range(20):

                playlist, child_url = (
                    get_child_playlist()
                )

                if not playlist:

                    print(
                        "🔄 Recreating session..."
                    )

                    break

                segments = get_segments(
                    playlist
                )

                if not segments:

                    print(
                        "⚠️ No live segments"
                    )

                    time.sleep(0.5)

                    continue

                # Process latest segment
                latest = segments[-1]

                if latest in processed:

                    time.sleep(0.3)

                    continue

                segment_url = urljoin(
                    child_url,
                    latest
                )

                print(
                    f"\n🎥 Latest: {latest}"
                )

                data = download_segment(
                    segment_url
                )

                if data is None:

                    # Important:
                    # A segment can briefly return 401.
                    # Don't kill the whole application.

                    time.sleep(0.5)

                    continue

                print(
                    f"✅ Downloaded "
                    f"{len(data)} bytes"
                )

                # ------------------------------------------
                # DECODE
                # ------------------------------------------

                frames = decode_segment(
                    data
                )

                print(
                    f"🎞️ Frames: {len(frames)}"
                )

                # ------------------------------------------
                # YOLO
                # ------------------------------------------

                for frame_bytes in frames:

                    frame = np.frombuffer(
                        frame_bytes,
                        dtype=np.uint8,
                    ).reshape(
                        HEIGHT,
                        WIDTH,
                        3,
                    )

                    detections = run_yolo(
                        frame
                    )

                    if detections:

                        print(
                            "🚨 DETECTIONS:",
                            detections
                        )

                processed.add(
                    latest
                )

                # Keep memory bounded
                if len(processed) > 30:

                    processed = set(
                        list(processed)[-15:]
                    )

                time.sleep(0.1)

        except KeyboardInterrupt:

            print(
                "\nStopping NetraX AI..."
            )

            sys.exit(0)

        except Exception as e:

            print(
                "\n❌ Pipeline error:",
                e
            )

            print(
                "Reconnecting in 3 seconds..."
            )

            time.sleep(3)


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    main()
