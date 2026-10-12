import os

APP_NAME = "Bioledger"
APP_TAGLINE = "An offline, open-weight naturalist field notebook."

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")

# The model for this computer. It runs on the local Ollama server and is the
# default for the whole app: field notes, questions, and photo reading all use
# it. The optional mobile model (Gemma 4 E2B) is a separate, browser-local
# runtime that lives entirely in the client and is never loaded here. See
# web/src/lib/models/registry.ts for that provider.
MODEL = os.getenv("BIOLEDGER_MODEL", "gemma3:4b")

EMBED_MODEL = os.getenv("BIOLEDGER_EMBED_MODEL", "nomic-embed-text")
VISION_MODEL = os.getenv("BIOLEDGER_VISION_MODEL", "gemma3:4b")
EMBED_DIM = int(os.getenv("BIOLEDGER_EMBED_DIM", "768"))

DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("BIOLEDGER_DATABASE_URL")
    or ""
).strip()

SQLITE_PATH = os.getenv("BIOLEDGER_DB", os.path.join(os.getcwd(), "bioledger.db"))

# Observation photos are written to this managed directory. Only the generated
# filename (never the client's) is recorded on the observation row, and reads
# are constrained to that directory so a crafted request cannot escape it.
PHOTO_DIR = os.getenv("BIOLEDGER_PHOTO_DIR", os.path.join(os.getcwd(), "photos"))

REQUEST_TIMEOUT = float(os.getenv("BIOLEDGER_TIMEOUT", "180"))
MAX_IMAGE_BYTES = int(os.getenv("BIOLEDGER_MAX_IMAGE_MB", "10")) * 1024 * 1024

# Public origin the browser reaches the API at, used only to build absolute photo
# URLs for a split deployment. Leave empty when UI and API share one origin or a
# reverse proxy (e.g. the Vercel rewrite in web/vercel.json) forwards /api.
PUBLIC_BASE = os.getenv("BIOLEDGER_PUBLIC_BASE", "").rstrip("/")

# Comma-separated allowlist of browser origins allowed to call this API directly
# across origins. Empty by default (no CORS headers at all), which is correct for
# a same-origin UI or a proxied one; "*" is never used.
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("BIOLEDGER_CORS_ORIGINS", "").split(",")
    if origin.strip()
]
