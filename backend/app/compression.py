"""Recompress uploaded media to a smaller footprint at high ("visually
lossless") quality.

- Images -> WebP (animated GIFs become animated WebP) via Pillow.
- Video  -> H.264/AAC MP4 via ffmpeg, using NVIDIA NVENC (GPU) when available
            for a big speed-up, falling back to libx264 (CPU).
- Audio  -> Opus in an Ogg container via ffmpeg.

Media that is already in an efficient codec at a sane bitrate is skipped (probed
with ffprobe) to avoid wasted work and needless quality loss.

`compress()` returns the recompressed (bytes, filename, content_type) or None to
mean "keep the original". The caller still applies a size check, so a result is
only adopted when it is actually smaller. Every failure path returns None, so a
bad encode or a missing tool never breaks an upload.
"""
from __future__ import annotations

import io
import json
import subprocess
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageSequence

from .config import settings

_FFMPEG_TIMEOUT_S = 600
_PROBE_TIMEOUT_S = 30

_SKIP_IMAGE_TYPES = {"image/webp", "image/avif", "image/svg+xml"}

# Cached NVENC availability (None = not yet probed).
_nvenc_available: bool | None = None


def _ffmpeg(args: list[str]) -> bool:
    try:
        proc = subprocess.run(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=_FFMPEG_TIMEOUT_S,
            check=False,
        )
        return proc.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


def _nvenc_works() -> bool:
    """Detect (once) whether NVENC H.264 encoding is usable on this machine."""
    global _nvenc_available
    if _nvenc_available is None:
        # Use a real test pattern at a valid size/pixel-format; NVENC rejects
        # tiny/empty inputs (a 64x64 nullsrc fails even when NVENC works).
        _nvenc_available = _ffmpeg([
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", "testsrc=size=640x480:rate=30:duration=0.2",
            "-c:v", "h264_nvenc", "-pix_fmt", "yuv420p", "-f", "null", "-",
        ])
    return _nvenc_available


# --- ffprobe-based "already efficient?" checks ---------------------------------
def _probe(src: Path) -> dict | None:
    try:
        proc = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", "-show_streams", str(src)],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=_PROBE_TIMEOUT_S,
            check=False,
            text=True,
        )
        if proc.returncode != 0:
            return None
        return json.loads(proc.stdout)
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError, json.JSONDecodeError):
        return None


def _stream(info: dict, codec_type: str) -> dict | None:
    for s in info.get("streams", []):
        if s.get("codec_type") == codec_type:
            return s
    return None


def _bitrate(info: dict, stream: dict) -> int:
    for value in (stream.get("bit_rate"), info.get("format", {}).get("bit_rate")):
        try:
            if value:
                return int(value)
        except (TypeError, ValueError):
            pass
    return 0


def _skip_video(src: Path) -> bool:
    cap = settings.video_skip_bitrate
    if cap <= 0:
        return False
    info = _probe(src)
    if not info:
        return False
    v = _stream(info, "video")
    if not v or v.get("codec_name") != "h264":
        return False
    br = _bitrate(info, v)
    return 0 < br <= cap


def _skip_audio(src: Path) -> bool:
    cap = settings.audio_skip_bitrate
    if cap <= 0:
        return False
    info = _probe(src)
    if not info:
        return False
    a = _stream(info, "audio")
    if not a or a.get("codec_name") not in {"opus", "aac", "mp3", "vorbis"}:
        return False
    br = _bitrate(info, a)
    return 0 < br <= cap


# --- Per-type encoders --------------------------------------------------------
def _compress_image(src: Path, content_type: str, stem: str) -> tuple[bytes, str, str] | None:
    if content_type in _SKIP_IMAGE_TYPES:
        return None
    q = settings.image_webp_quality
    with Image.open(src) as im:
        out = io.BytesIO()
        if getattr(im, "is_animated", False):
            frames = []
            durations: list[int] = []
            for frame in ImageSequence.Iterator(im):
                frames.append(frame.convert("RGBA"))
                durations.append(int(frame.info.get("duration", 100)))
            frames[0].save(
                out,
                "WEBP",
                save_all=True,
                append_images=frames[1:],
                duration=durations,
                loop=int(im.info.get("loop", 0)),
                quality=q,
                method=4,
            )
        else:
            has_alpha = im.mode in ("RGBA", "LA") or (
                im.mode == "P" and "transparency" in im.info
            )
            im.convert("RGBA" if has_alpha else "RGB").save(
                out, "WEBP", quality=q, method=6
            )
    return out.getvalue(), f"{stem}.webp", "image/webp"


def _compress_video(src: Path, stem: str) -> tuple[bytes, str, str] | None:
    crf = str(settings.video_crf)
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.mp4"
        tail = [
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            str(out),
        ]
        # Try fastest first: GPU decode + GPU encode, then GPU encode with CPU
        # decode, then full CPU. Each tier falls back if the previous fails.
        attempts: list[tuple[str, list[str]]] = []
        if _nvenc_works():
            nvenc = ["-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", crf, "-b:v", "0"]
            attempts.append(
                ("nvenc+cuda", ["ffmpeg", "-y", "-hwaccel", "cuda", "-i", str(src), *nvenc, *tail])
            )
            attempts.append(("nvenc", ["ffmpeg", "-y", "-i", str(src), *nvenc, *tail]))
        attempts.append((
            "libx264",
            ["ffmpeg", "-y", "-i", str(src), "-c:v", "libx264", "-crf", crf,
             "-preset", settings.video_preset, *tail],
        ))

        for name, args in attempts:
            t0 = time.monotonic()
            if _ffmpeg(args) and out.exists():
                print(f"[compress] video via {name} {time.monotonic() - t0:.1f}s", flush=True)
                return out.read_bytes(), f"{stem}.mp4", "video/mp4"
            out.unlink(missing_ok=True)

        print("[compress] video encode FAILED", flush=True)
        return None


def _compress_audio(src: Path, stem: str) -> tuple[bytes, str, str] | None:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.ogg"
        ok = _ffmpeg([
            "ffmpeg", "-y", "-i", str(src),
            "-vn", "-c:a", "libopus", "-b:a", settings.audio_bitrate,
            str(out),
        ])
        if not ok or not out.exists():
            return None
        return out.read_bytes(), f"{stem}.ogg", "audio/ogg"


def compress(src: Path, content_type: str, filename: str) -> tuple[bytes, str, str] | None:
    """Return recompressed (bytes, filename, content_type), or None to keep the original."""
    if not settings.compress_media:
        return None
    main = (content_type or "").split("/", 1)[0]
    stem = Path(filename).stem or "media"
    try:
        if main == "image":
            return _compress_image(src, content_type, stem)
        if main == "video":
            if _skip_video(src):
                print("[compress] video skipped (already efficient)", flush=True)
                return None
            return _compress_video(src, stem)
        if main == "audio":
            return None if _skip_audio(src) else _compress_audio(src, stem)
    except Exception:
        return None
    return None
