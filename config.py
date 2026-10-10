import os

APP_NAME = "Bioledger"
APP_TAGLINE = "An offline, open-weight naturalist field notebook."

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
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

REQUEST_TIMEOUT = float(os.getenv("BIOLEDGER_TIMEOUT", "180"))
MAX_IMAGE_BYTES = int(os.getenv("BIOLEDGER_MAX_IMAGE_MB", "10")) * 1024 * 1024
