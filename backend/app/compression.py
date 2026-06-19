"""Recompress uploaded media to a smaller footprint at high ("visually
lossless") quality.

- Images -> WebP (animated GIFs become animated WebP) via Pillow.
- Video  -> H.264/AAC MP4 via ffmpeg (universally playable in browsers).
- Audio  -> Opus in an Ogg container via ffmpeg.

`compress()` returns the recompressed (bytes, filename, content_type) or None to
mean "keep the original". The caller still applies a size check, so a result is
only adopted when it is actually smaller. Every failure path returns None, so a
bad encode or a missing tool never breaks an upload.
"""
from __future__ import annotations

import io
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageSequence

from .config import settings

_FFMPEG_TIMEOUT_S = 600

# Already-efficient or non-raster image types we leave alone.
_SKIP_IMAGE_TYPES = {"image/webp", "image/avif", "image/svg+xml"}


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
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.mp4"
        ok = _ffmpeg([
            "ffmpeg", "-y", "-i", str(src),
            "-c:v", "libx264", "-crf", str(settings.video_crf),
            "-preset", settings.video_preset,
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            str(out),
        ])
        if not ok or not out.exists():
            return None
        return out.read_bytes(), f"{stem}.mp4", "video/mp4"


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
            return _compress_video(src, stem)
        if main == "audio":
            return _compress_audio(src, stem)
    except Exception:
        return None
    return None
