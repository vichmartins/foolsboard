"""Link preview: fetch a URL server-side and extract Open Graph / meta tags so
the UI can render WhatsApp/Telegram-style reference cards.

Uses only the standard library (urllib + html.parser) to avoid extra
dependencies. The route is declared `def` (not `async`) so FastAPI runs the
blocking fetch in a threadpool.

Security note: this fetches arbitrary user-supplied URLs. We reject non-http(s)
schemes and hosts that resolve to private/loopback/link-local addresses to
limit SSRF. Redirects are followed by urllib and only the initial host is
re-checked, which is an accepted limitation for this local, single-user tool.
"""
from __future__ import annotations

import gzip
import ipaddress
import socket
import zlib
from html.parser import HTMLParser
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import get_current_user

router = APIRouter(
    prefix="/api/links", tags=["links"], dependencies=[Depends(get_current_user)]
)

MAX_BYTES = 600_000
TIMEOUT = 6
USER_AGENT = "Mozilla/5.0 (compatible; FoolsboardBot/1.0; +link-preview)"
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif", ".ico")


def _image_name(path: str) -> str | None:
    return unquote(path.rstrip("/").rsplit("/", 1)[-1]) or None


class LinkPreview(BaseModel):
    url: str
    title: str | None = None
    description: str | None = None
    image: str | None = None
    site_name: str | None = None


class _MetaParser(HTMLParser):
    """Collects <meta> property/name -> content and the <title> text."""

    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.title: str | None = None
        self._in_title = False
        self._title_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "meta":
            a = {k.lower(): (v or "") for k, v in attrs}
            key = (a.get("property") or a.get("name") or "").lower()
            content = a.get("content")
            if key and content and key not in self.meta:
                self.meta[key] = content
        elif tag == "title" and self.title is None:
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_parts.append(data)

    def finalize(self) -> None:
        if self._title_parts and not self.title:
            self.title = "".join(self._title_parts).strip()


def _host_is_blocked(host: str) -> bool:
    host = host.lower().strip("[]")
    if not host or host == "localhost":
        return True
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return True  # unresolvable -> can't (and shouldn't) fetch
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            return True
    return False


def _decompress(raw: bytes, encoding: str) -> bytes:
    encoding = (encoding or "").lower()
    try:
        if encoding == "gzip":
            return gzip.decompress(raw)
        if encoding == "deflate":
            try:
                return zlib.decompress(raw)
            except zlib.error:
                return zlib.decompress(raw, -zlib.MAX_WBITS)
    except Exception:
        pass
    return raw


def _fetch(url: str) -> LinkPreview:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Only http(s) links are supported")
    if _host_is_blocked(parsed.hostname):
        raise HTTPException(status_code=400, detail="That host can't be previewed")

    # A URL that points straight at an image is its own preview -- no fetch needed.
    if parsed.path.lower().endswith(IMAGE_EXTS):
        return LinkPreview(url=url, image=url, title=_image_name(parsed.path))

    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    try:
        with urlopen(req, timeout=TIMEOUT) as resp:  # noqa: S310 (scheme checked above)
            ctype = resp.headers.get("Content-Type", "")
            if ctype.lower().startswith("image/"):
                return LinkPreview(url=url, image=url, title=_image_name(parsed.path))
            if "html" not in ctype and "xml" not in ctype:
                return LinkPreview(url=url)  # not a web page (pdf, video, ...)
            charset = resp.headers.get_content_charset() or "utf-8"
            raw = _decompress(resp.read(MAX_BYTES), resp.headers.get("Content-Encoding", ""))
    except HTTPException:
        raise
    except Exception:
        # Timeout / TLS / unreachable: degrade to a bare link rather than erroring.
        return LinkPreview(url=url)

    parser = _MetaParser()
    try:
        parser.feed(raw.decode(charset, errors="ignore"))
    except Exception:
        pass
    parser.finalize()
    meta = parser.meta

    def pick(*keys: str) -> str | None:
        for k in keys:
            v = meta.get(k)
            if v and v.strip():
                return v.strip()
        return None

    image = pick("og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src")
    if image:
        image = urljoin(url, image)

    return LinkPreview(
        url=url,
        title=pick("og:title", "twitter:title") or parser.title,
        description=pick("og:description", "twitter:description", "description"),
        image=image,
        site_name=pick("og:site_name"),
    )


@router.get("/preview", response_model=LinkPreview)
def preview(url: str = Query(..., max_length=2048)) -> LinkPreview:
    return _fetch(url)
