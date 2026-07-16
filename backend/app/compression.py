"""Recompress uploaded media to a smaller footprint at high ("visually
lossless") quality.

- Images -> WebP (animated GIFs become animated WebP) via Pillow.
- Video  -> H.264/AAC MP4 via ffmpeg, using NVIDIA NVENC (GPU) when available
            for a big speed-up, falling back to libx264 (CPU).
- Audio  -> Opus in an Ogg container via ffmpeg.

Media that is already in an efficient codec at a sane bitrate is skipped (probed
with ffprobe) to avoid wasted work and needless quality loss.

`compress()` returns the recompressed (path, filename, content_type) or None to
mean "keep the original". The path is a temp file the *caller owns and must
delete* once it has streamed it to storage -- the encoded bytes are never held
fully in memory (important for large videos). The caller still applies a size
check, so a result is only adopted when it is actually smaller. Every failure
path returns None, so a bad encode or a missing tool never breaks an upload.
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageSequence

from .config import settings

# Bound the image decoder's memory: Pillow raises on images whose pixel area
# exceeds this, so a "decompression bomb" can't blow up RAM. Process-wide (PIL
# reads this module global), so it also covers avatar decoding in auth.py.
if settings.max_image_pixels > 0:
    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels


def _persistent_tmp(suffix: str) -> Path:
    """Create a temp file that OUTLIVES this function so the caller can stream it
    to storage. The caller is responsible for deleting it."""
    fd, name = tempfile.mkstemp(prefix="fbcomp_", suffix=suffix)
    os.close(fd)
    return Path(name)

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


def _formats(info: dict) -> set[str]:
    """The container's ffprobe format names (a comma-separated list -- e.g. an
    mp4 reports "mov,mp4,m4a,3gp,3g2,mj2"; an mkv/webm both report "matroska,webm")."""
    raw = info.get("format", {}).get("format_name", "") or ""
    return {f.strip() for f in raw.split(",") if f.strip()}


def _is_web_video(info: dict) -> bool:
    """Whether the file is already a browser-playable video *as-is*. Playability
    needs BOTH a web container AND codecs that container supports in the browser:
    H.264(+AAC/MP3) only inside MP4, and VP8/VP9/AV1(+Opus/Vorbis) only inside
    WebM. An H.264 stream in a Matroska/AVI container is NOT playable -- which is
    why the old codec-only check let `.mkv` files through unplayable."""
    fmts = _formats(info)
    v = _stream(info, "video")
    if v is None:
        return False
    a = _stream(info, "audio")
    vcodec = v.get("codec_name")
    acodec = a.get("codec_name") if a else None
    if fmts & {"mp4", "mov", "m4a", "3gp", "3g2"}:
        return vcodec == "h264" and acodec in {None, "aac", "mp3"}
    if fmts & {"webm", "matroska"}:  # ffprobe can't tell .webm from .mkv apart --
        # so gate on the codecs: only the WebM subset actually plays in browsers.
        return vcodec in {"vp8", "vp9", "av1"} and acodec in {None, "opus", "vorbis"}
    return False


def _is_web_audio(info: dict) -> bool:
    """Whether the file is already a browser-playable audio file as-is. MP4-family
    audio (i.e. AAC in `.m4a`) is deliberately excluded so it transcodes to Opus,
    which every browser can decode (some Chromium builds ship without AAC)."""
    fmts = _formats(info)
    a = _stream(info, "audio")
    if a is None:
        return False
    acodec = a.get("codec_name")
    if "mp3" in fmts:
        return acodec == "mp3"
    if "ogg" in fmts:
        return acodec in {"opus", "vorbis"}
    if "wav" in fmts:
        return bool(acodec) and acodec.startswith("pcm")
    if fmts & {"webm", "matroska"}:
        return acodec in {"opus", "vorbis"}
    return False


def _skip_video(src: Path) -> bool:
    """Skip re-encoding only when the file is already web-playable AND already
    small enough that re-encoding wouldn't help."""
    cap = settings.video_skip_bitrate
    if cap <= 0:
        return False
    info = _probe(src)
    if not info or not _is_web_video(info):
        return False
    br = _bitrate(info, _stream(info, "video"))
    return 0 < br <= cap


def _skip_audio(src: Path) -> bool:
    cap = settings.audio_skip_bitrate
    if cap <= 0:
        return False
    info = _probe(src)
    if not info or not _is_web_audio(info):
        return False
    br = _bitrate(info, _stream(info, "audio"))
    return 0 < br <= cap


# --- Per-type encoders --------------------------------------------------------
def _compress_image(src: Path, content_type: str, stem: str) -> tuple[Path, str, str] | None:
    if content_type in _SKIP_IMAGE_TYPES:
        return None
    q = settings.image_webp_quality
    out_path = _persistent_tmp(".webp")
    try:
        with Image.open(src) as im:
            if getattr(im, "is_animated", False):
                frames = []
                durations: list[int] = []
                for frame in ImageSequence.Iterator(im):
                    frames.append(frame.convert("RGBA"))
                    durations.append(int(frame.info.get("duration", 100)))
                frames[0].save(
                    out_path,
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
                    out_path, "WEBP", quality=q, method=6
                )
    except Exception:
        out_path.unlink(missing_ok=True)
        raise
    return out_path, f"{stem}.webp", "image/webp"


def _compress_video(src: Path, stem: str) -> tuple[Path, str, str] | None:
    crf = str(settings.video_crf)
    out = _persistent_tmp(".mp4")
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
        if _ffmpeg(args) and out.exists() and out.stat().st_size > 0:
            print(f"[compress] video via {name} {time.monotonic() - t0:.1f}s", flush=True)
            return out, f"{stem}.mp4", "video/mp4"
        out.unlink(missing_ok=True)

    print("[compress] video encode FAILED", flush=True)
    out.unlink(missing_ok=True)
    return None


def _compress_audio(src: Path, stem: str) -> tuple[Path, str, str] | None:
    out = _persistent_tmp(".ogg")
    ok = _ffmpeg([
        "ffmpeg", "-y", "-i", str(src),
        "-vn", "-c:a", "libopus", "-b:a", settings.audio_bitrate,
        str(out),
    ])
    if not ok or not out.exists() or out.stat().st_size == 0:
        out.unlink(missing_ok=True)
        return None
    return out, f"{stem}.ogg", "audio/ogg"


def compress(src: Path, content_type: str, filename: str) -> tuple[Path, str, str] | None:
    """Return recompressed (temp-file path, filename, content_type), or None to
    keep the original. The caller must delete the returned path."""
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
