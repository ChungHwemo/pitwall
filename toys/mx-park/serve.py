#!/usr/bin/env python3
"""Serve the park at both / and /toys/mx-park/."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
PREFIX = "/toys/mx-park"
HOST = "127.0.0.1"
PORT = 8765


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        parsed = unquote(urlparse(path).path)
        if parsed == PREFIX or parsed.startswith(PREFIX + "/"):
            parsed = parsed[len(PREFIX) :] or "/"
        return super().translate_path(parsed)


if __name__ == "__main__":
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"MINI MX  http://{HOST}:{PORT}/")
    print(f"         http://{HOST}:{PORT}{PREFIX}/")
    httpd.serve_forever()
