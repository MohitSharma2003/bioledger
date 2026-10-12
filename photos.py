"""Observation photo storage.

A photo is written to a managed directory on the server's filesystem; the
observation row keeps only a generated filename plus a little metadata
(mime type and byte size). We never trust the client's filename, and reads are
constrained to a strict pattern inside the photo directory, so a crafted
request cannot read anything else.
"""

from __future__ import annotations

import os
import re
import uuid

import config

_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

# Generated names only: 32 hex characters plus one known image extension.
_NAME_RE = re.compile(r"^[0-9a-f]{32}\.(?:jpg|png|webp|gif)$")


class PhotoError(Exception):
    """The photo could not be validated or stored."""


def sniff_mime(raw: bytes) -> str | None:
    """Identify an image from its leading bytes, ignoring the claimed type."""
    if len(raw) >= 3 and raw[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(raw) >= 8 and raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(raw) >= 6 and raw[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    return None


def directory() -> str:
    return os.path.abspath(config.PHOTO_DIR)


def ensure_dir() -> str:
    path = directory()
    os.makedirs(path, exist_ok=True)
    return path


def save(raw: bytes, declared_mime: str | None = None) -> dict:
    """Validate and store one photo, returning the row fields to persist.

    The declared content type is only a hint; the bytes decide the real type.
    Raises PhotoError when the upload is empty, too large, or not a readable
    image, so the caller can keep the observation and explain what happened.
    """
    if not raw:
        raise PhotoError("The photo was empty.")
    if len(raw) > config.MAX_IMAGE_BYTES:
        limit_mb = config.MAX_IMAGE_BYTES // (1024 * 1024)
        raise PhotoError(f"The photo is larger than {limit_mb} MB.")
    mime = sniff_mime(raw)
    if mime is None:
        raise PhotoError("That file is not a readable image (JPG, PNG, WebP, or GIF).")

    name = f"{uuid.uuid4().hex}{_EXTENSIONS[mime]}"
    target = os.path.join(ensure_dir(), name)
    with open(target, "wb") as handle:
        handle.write(raw)
    return {"photo_path": name, "photo_mime": mime, "photo_bytes": len(raw)}


def resolve(name: str | None) -> str | None:
    """Return the on-disk path for a stored photo, or None if it is not valid.

    Only names matching the generated pattern are accepted, and the resolved
    path must sit directly inside the photo directory.
    """
    if not name or not _NAME_RE.match(name):
        return None
    directory_path = directory()
    path = os.path.abspath(os.path.join(directory_path, name))
    if os.path.dirname(path) != directory_path:
        return None
    return path if os.path.isfile(path) else None


def media_type(name: str | None) -> str:
    ext = os.path.splitext(name or "")[1].lower()
    return _MEDIA_TYPES.get(ext, "application/octet-stream")


def url_for(name: str | None) -> str | None:
    """Public URL for a stored photo, or None when the file is missing."""
    if resolve(name) is None:
        return None
    return f"{config.PUBLIC_BASE}/api/photos/{name}"


def remove(name: str | None) -> None:
    path = resolve(name)
    if path:
        try:
            os.remove(path)
        except OSError:
            pass
