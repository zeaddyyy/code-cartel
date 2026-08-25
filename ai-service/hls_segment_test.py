import requests
import time
from urllib.parse import urljoin

BASE = "https://live.corp8.cloud"
CAMERA = "13"

MASTER = f"{BASE}/live/stream/{CAMERA}/index.m3u8"
CHILD = f"{BASE}/live/stream/{CAMERA}/main_stream.m3u8"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151.0 Safari/537.36",
    "Accept": "*/*",
    "Origin": BASE,
    "Referer": f"{BASE}/",
}

s = requests.Session()
s.headers.update(HEADERS)

print("Creating Sentinel session...")

r = s.get(
    MASTER,
    allow_redirects=True,
    timeout=10,
)

print("Master:", r.status_code)
print("Final URL:", r.url)
print("Cookies:", s.cookies.get_dict())

if r.status_code != 200:
    raise SystemExit("Master failed")

print("\nTesting LIVE segments...\n")

for attempt in range(20):

    try:

        # Get the CURRENT playlist
        r = s.get(
            CHILD,
            headers={
                **HEADERS,
                "Referer": r.url,
            },
            timeout=5,
        )

        if r.status_code != 200:
            print(
                f"[{attempt+1}] Child HTTP {r.status_code}"
            )
            time.sleep(0.5)
            continue

        lines = r.text.splitlines()

        segments = [
            x.strip()
            for x in lines
            if x.strip() and not x.startswith("#")
        ]

        if not segments:
            print("No segments")
            time.sleep(0.3)
            continue

        # VERY IMPORTANT:
        # use the newest segment, not an old one
        segment = segments[-1]

        segment_url = urljoin(
            CHILD,
            segment
        )

        print(
            f"[{attempt+1}] "
            f"Latest segment: {segment}"
        )

        # Immediately request it
        sr = s.get(
            segment_url,
            headers={
                **HEADERS,
                "Referer": CHILD,
            },
            timeout=5,
        )

        print(
            "    HTTP:",
            sr.status_code,
            "bytes:",
            len(sr.content)
        )

        if sr.status_code == 200:

            if len(sr.content) > 1000:

                print()
                print("======================================")
                print("✅ LIVE HLS SEGMENT WORKS")
                print("======================================")
                print("URL:", segment_url)
                print("Bytes:", len(sr.content))

                with open("/tmp/sentinel_live.ts", "wb") as f:
                    f.write(sr.content)

                print(
                    "Saved: /tmp/sentinel_live.ts"
                )

                break

        time.sleep(0.3)

    except Exception as e:

        print(
            "Error:",
            e
        )

else:

    print()
    print("❌ Could not retrieve a live segment.")
