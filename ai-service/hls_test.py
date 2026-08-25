import subprocess
import requests
import time
import os
import signal
import sys

BASE = "https://live.corp8.cloud"
CAMERA_ID = "13"

MASTER = f"{BASE}/live/stream/{CAMERA_ID}/index.m3u8"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151.0 Safari/537.36",
    "Accept": "*/*",
    "Referer": f"{BASE}/",
    "Origin": BASE,
}

def create_session():
    print("Creating Sentinel HLS session...")

    s = requests.Session()
    s.headers.update(HEADERS)

    # First request triggers cookieCheck
    r = s.get(
        MASTER,
        allow_redirects=True,
        timeout=20
    )

    print("Master status:", r.status_code)
    print("Final URL:", r.url)
    print("Cookies:", s.cookies.get_dict())

    if r.status_code != 200:
        raise RuntimeError(
            f"Could not establish HLS session: HTTP {r.status_code}\n"
            f"{r.text[:500]}"
        )

    if "hlsSession" not in s.cookies:
        raise RuntimeError(
            "hlsSession cookie was not created."
        )

    return s, r.text


def get_child_playlist(s):
    child = f"{BASE}/live/stream/{CAMERA_ID}/main_stream.m3u8"

    print()
    print("Requesting child playlist...")
    print(child)

    r = s.get(
        child,
        headers={
            **HEADERS,
            "Referer": MASTER,
        },
        timeout=20
    )

    print("Child status:", r.status_code)
    print("Cookies:", s.cookies.get_dict())

    if r.status_code != 200:
        print("Child response:")
        print(r.text[:500])

        raise RuntimeError(
            f"Child playlist rejected: HTTP {r.status_code}"
        )

    print("Child playlist OK")
    print(r.text[:1000])

    return r.text


def build_cookie_header(s):
    return "; ".join(
        f"{c.name}={c.value}"
        for c in s.cookies
    )


def start_ffmpeg(s):
    cookies = build_cookie_header(s)

    print()
    print("FFmpeg cookies:")
    print(cookies)

    print()
    print("Starting FFmpeg...")

    # IMPORTANT:
    # Use the CHILD playlist directly.
    # Do not make FFmpeg follow the master playlist.
    child = f"{BASE}/live/stream/{CAMERA_ID}/main_stream.m3u8"

    header_string = (
        f"User-Agent: {HEADERS['User-Agent']}\r\n"
        f"Referer: {MASTER}\r\n"
        f"Origin: {BASE}\r\n"
        f"Cookie: {cookies}\r\n"
    )

    command = [
        "ffmpeg",

        "-hide_banner",
        "-loglevel",
        "warning",

        "-headers",
        header_string,

        # Start close to live edge.
        "-live_start_index",
        "-1",

        # Direct child playlist.
        "-i",
        child,

        # Small frame size for AI processing.
        "-vf",
        "scale=640:360",

        "-pix_fmt",
        "bgr24",

        "-f",
        "rawvideo",

        "pipe:1",
    ]

    print("Running:")
    print(" ".join(command[:8]) + " ...")

    return subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=10**8,
    )


def main():

    session = None
    process = None

    try:

        session, master = create_session()

        # Test authentication BEFORE FFmpeg.
        get_child_playlist(session)

        process = start_ffmpeg(session)

        width = 640
        height = 360
        frame_size = width * height * 3

        print()
        print("Waiting for video frames...")
        print("Frame size:", frame_size)

        frames = 0
        start = time.time()

        while True:

            raw = process.stdout.read(frame_size)

            if len(raw) != frame_size:

                elapsed = time.time() - start

                print()
                print(
                    f"❌ Frame stopped. "
                    f"Received {len(raw)}/{frame_size} bytes."
                )

                # Print FFmpeg error output.
                try:
                    stderr = process.stderr.read().decode(
                        errors="ignore"
                    )

                    if stderr:
                        print()
                        print("FFmpeg:")
                        print(stderr[-4000:])
                except Exception:
                    pass

                break

            frames += 1

            if frames == 1:
                print("✅ FIRST FRAME RECEIVED")

            if frames % 10 == 0:
                elapsed = time.time() - start

                fps = frames / elapsed if elapsed else 0

                print(
                    f"Frames: {frames} | "
                    f"FPS: {fps:.2f}"
                )

            # Stop test after 100 frames.
            if frames >= 100:
                print()
                print("✅ 100 frames received.")
                print("HLS → FFmpeg → Python is WORKING.")
                break

    except KeyboardInterrupt:
        print()
        print("Stopped.")

    except Exception as e:
        print()
        print("❌ ERROR:")
        print(e)

    finally:

        if process:
            try:
                process.terminate()
                process.wait(timeout=3)
            except Exception:
                try:
                    process.kill()
                except Exception:
                    pass


if __name__ == "__main__":
    main()
