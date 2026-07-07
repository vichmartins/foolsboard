"""Document export endpoint wiring (pandoc-independent checks)."""
import io

from conftest import auth


def test_export_rejects_unknown_format(client, admin):
    token, _ = admin
    r = client.post(
        "/api/documents/export",
        json={"html": "<p>hi</p>", "title": "T", "format": "rtf"},
        headers=auth(token),
    )
    assert r.status_code == 400, r.text


def test_export_requires_auth(client):
    r = client.post(
        "/api/documents/export",
        json={"html": "<p>hi</p>", "title": "T", "format": "txt"},
    )
    assert r.status_code in (401, 403), r.text


def test_screenplay_docx_is_generated(client, admin):
    # Script-mode .docx is built directly (python-docx), so it works without pandoc
    # and returns a real DOCX (zip) carrying the scene/character text.
    token, _ = admin
    html = (
        '<p data-element="scene">INT. TOWER - NIGHT</p>'
        '<p data-element="character">SEDRIDOR</p>'
        '<p data-element="dialogue">The stars align.</p>'
    )
    r = client.post(
        "/api/documents/export",
        json={"html": html, "title": "My Script", "format": "docx", "mode": "script"},
        headers=auth(token),
    )
    assert r.status_code == 200, r.text
    assert r.content[:2] == b"PK"  # docx is a zip
    assert "wordprocessingml" in r.headers["content-type"]
    from docx import Document

    d = Document(io.BytesIO(r.content))
    text = "\n".join(p.text for p in d.paragraphs)
    assert "SEDRIDOR" in text and "TOWER" in text  # content carried through
