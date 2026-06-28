"""Run the foolsboard backend in development: `python -m app` (from backend/, with
the venv active). Serves the API on http://127.0.0.1:8000 with auto-reload; the
branded banner is printed by the app's lifespan. Production launches the app via its
systemd service, not this entry point.
"""
from __future__ import annotations

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
