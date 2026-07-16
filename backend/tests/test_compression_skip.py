"""The "skip re-encode when already efficient" checks must also require a
browser-playable container -- otherwise an H.264 `.mkv` or an AAC `.m4a` is kept
as-is and won't play in the browser (see the media playability fix). These test
the container+codec logic with a stubbed ffprobe, so no real media is needed."""
from __future__ import annotations

from pathlib import Path

from app import compression as c


def _info(format_name: str, *streams: dict) -> dict:
    return {"format": {"format_name": format_name}, "streams": list(streams)}


def _v(codec: str, bitrate: int | None = None) -> dict:
    s = {"codec_type": "video", "codec_name": codec}
    if bitrate is not None:
        s["bit_rate"] = str(bitrate)
    return s


def _a(codec: str, bitrate: int | None = None) -> dict:
    s = {"codec_type": "audio", "codec_name": codec}
    if bitrate is not None:
        s["bit_rate"] = str(bitrate)
    return s


MP4 = "mov,mp4,m4a,3gp,3g2,mj2"
MKV = "matroska,webm"


# --- container playability --------------------------------------------------
def test_web_video_mp4_h264_is_playable():
    assert c._is_web_video(_info(MP4, _v("h264"), _a("aac"))) is True


def test_web_video_mkv_h264_is_not_playable():
    # H.264 in a Matroska container is the exact case the old codec-only check
    # wrongly kept -- browsers can't play it.
    assert c._is_web_video(_info(MKV, _v("h264"), _a("aac"))) is False


def test_web_video_webm_vp9_is_playable():
    assert c._is_web_video(_info(MKV, _v("vp9"), _a("opus"))) is True


def test_web_video_avi_is_not_playable():
    assert c._is_web_video(_info("avi", _v("h264"), _a("mp3"))) is False


def test_web_audio_mp3_is_playable():
    assert c._is_web_audio(_info("mp3", _a("mp3"))) is True


def test_web_audio_m4a_aac_is_not_playable():
    # AAC in an MP4 container -> transcode to Opus for universal playback.
    assert c._is_web_audio(_info(MP4, _a("aac"))) is False


def test_web_audio_ogg_opus_is_playable():
    assert c._is_web_audio(_info("ogg", _a("opus"))) is True


# --- skip decisions (container gate + bitrate gate) -------------------------
def test_skip_video_keeps_small_mp4(monkeypatch):
    monkeypatch.setattr(c, "_probe", lambda src: _info(MP4, _v("h264", 2_000_000), _a("aac")))
    assert c._skip_video(Path("x.mp4")) is True


def test_skip_video_transcodes_mkv(monkeypatch):
    # Even a small, efficient mkv must be transcoded (container isn't playable).
    monkeypatch.setattr(c, "_probe", lambda src: _info(MKV, _v("h264", 1_000_000), _a("aac")))
    assert c._skip_video(Path("x.mkv")) is False


def test_skip_video_transcodes_large_mp4(monkeypatch):
    monkeypatch.setattr(c, "_probe", lambda src: _info(MP4, _v("h264", 9_000_000), _a("aac")))
    assert c._skip_video(Path("x.mp4")) is False


def test_skip_audio_transcodes_m4a(monkeypatch):
    monkeypatch.setattr(c, "_probe", lambda src: _info(MP4, _a("aac", 128_000)))
    assert c._skip_audio(Path("x.m4a")) is False


def test_skip_audio_keeps_small_mp3(monkeypatch):
    monkeypatch.setattr(c, "_probe", lambda src: _info("mp3", _a("mp3", 128_000)))
    assert c._skip_audio(Path("x.mp3")) is True


def test_skip_audio_transcodes_high_bitrate_ogg(monkeypatch):
    monkeypatch.setattr(c, "_probe", lambda src: _info("ogg", _a("opus", 300_000)))
    assert c._skip_audio(Path("x.ogg")) is False
