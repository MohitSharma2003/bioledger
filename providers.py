"""Model runtimes Bioledger can use, from the server's point of view.

Only Ollama runs on the server. The browser runtime (Transformers.js) runs
entirely in the client, so the server advertises it but leaves its live status
to the browser. Keeping this registry here means the routes stay free of
provider details and another server-side provider is a one-file change.
"""

from __future__ import annotations

from typing import Any, Dict, List

import config
import llm


def _ollama_status(status: Dict[str, Any]) -> Dict[str, Any]:
    if not status.get("ollama"):
        return {
            "kind": "offline",
            "detail": f"Ollama is not reachable at {config.OLLAMA_HOST}.",
            "vision": False,
        }
    if status.get("model_present"):
        return {
            "kind": "ready",
            "detail": f"{config.MODEL} is running locally.",
            "vision": True,
        }
    return {
        "kind": "not_installed",
        "detail": f"{config.MODEL} is not installed in Ollama. Run: ollama pull {config.MODEL}",
        "vision": False,
    }


def registry() -> List[Dict[str, Any]]:
    """Describe every runtime the UI may offer, with the current status.

    The Ollama runtime is the default for this computer and uses the installed
    model. The browser runtime is a separate, optional, browser-local model for
    mobile; it reports its own status client-side and is never part of the
    server's startup path.
    """
    status = llm.status()
    return [
        {
            "id": "ollama",
            "label": "Ollama on this computer",
            "runtime": "ollama",
            "location": "server",
            # The server never advertises its Ollama address unless it is actually
            # reachable, so a public deploy cannot be probed for an internal host.
            "endpoint": config.OLLAMA_HOST if status.get("ollama") else None,
            "status": _ollama_status(status),
            "models": [
                {
                    "id": config.MODEL,
                    "label": config.MODEL,
                    "role": "text",
                    "vision": True,
                    "present": bool(status.get("model_present")),
                    "note": f"Run: ollama pull {config.MODEL}",
                },
                {
                    "id": config.EMBED_MODEL,
                    "label": config.EMBED_MODEL,
                    "role": "embedding",
                    "vision": False,
                    "present": bool(status.get("embed_present")),
                },
            ],
        },
        {
            "id": "browser",
            "label": "This browser",
            "runtime": "transformers.js",
            "location": "client",
            "endpoint": None,
            # The browser checks its own capabilities and model cache, so the
            # server never claims a status it cannot actually observe.
            "status": {
                "kind": "unknown",
                "detail": "Checked in the browser.",
                "vision": False,
            },
            "models": [],
        },
    ]
