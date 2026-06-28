"""Run the foolsboard backend in development: `python -m app` (from backend/, with
the venv active). Serves the API on http://127.0.0.1:8000 with auto-reload. The
full ASCII banner prints once here; uvicorn's own startup/access logs are kept (they
carry the useful runtime info). Production launches the app via its systemd service.
"""
from __future__ import annotations

if __name__ == "__main__":
    import uvicorn

    from .banner import print_logo

    print_logo()
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
