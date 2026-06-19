"""Generate preview thumbnails for media files using ffmpeg.

ffmpeg covers both cases we need: a representative frame from a video, and the
embedded cover-art picture from an audio file (which ffmpeg exposes as a video
stream). No extra Python dependency is required -- only the ffmpeg binary on
PATH. Every failure path returns None so uploads never break if ffmpeg is
missing or a file has no usable image.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

# Longest edge of the generated thumbnail, in pixels.
_MAX_EDGE = 640
_TIMEOUT_S = 20


def _run(args: list[str]) -> bool:
    try:
        proc = subprocess.run(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=_TIMEOUT_S,
            check=False,
        )
        return proc.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


def _read(path: Path) -> bytes | None:
    try:
        data = path.read_bytes()
        return data or None
    except OSError:
        return None


def generate_thumbnail(src: Path, content_type: str) -> bytes | None:
    """Return JPEG bytes for a video frame / audio cover, or None if unavailable."""
    main = (content_type or "").split("/", 1)[0]
    if main not in {"video", "audio"}:
        return None

    scale = f"scale='min({_MAX_EDGE},iw)':-2"
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "thumb.jpg"

        if main == "video":
            # Seek ~1s in for a non-black frame; fall back to the very first frame
            # for clips shorter than that.
            ok = _run([
                "ffmpeg", "-y", "-ss", "1", "-i", str(src),
                "-frames:v", "1", "-vf", scale, str(out),
            ])
            if not ok or not out.exists():
                ok = _run([
                    "ffmpeg", "-y", "-i", str(src),
                    "-frames:v", "1", "-vf", scale, str(out),
                ])
        else:  # audio: extract the attached cover-art picture, if any
            ok = _run([
                "ffmpeg", "-y", "-i", str(src), "-an",
                "-frames:v", "1", "-vf", scale, str(out),
            ])

        if not ok or not out.exists():
            return None
        return _read(out)
