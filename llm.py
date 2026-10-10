import json
import re
from typing import List, Optional

import httpx

import config

PARSE_SYSTEM = (
    "You are Bioledger, an offline field-notebook assistant. "
    "A person just came back from spending time outside and described what they noticed. "
    "Turn it into ONE tidy observation. Respond with ONLY a JSON object (no prose, no code fences) "
    "using exactly these keys: "
    '"species" (a plain everyday name, or a short honest descriptor like a red ladybird; '
    "do NOT output a Latin binomial unless you are highly confident), "
    '"common_name" (plain everyday name), '
    '"category" (one of: plant, bird, insect, fungus, animal, cloud, weather, mineral, other), '
    '"confidence" (number from 0 to 1), '
    '"note" (one vivid sentence, first person), '
    '"tags" (array of 2 to 5 short lowercase tags), '
    '"season_note" (one sentence on whether this is typical for the season). '
    "Be honest about uncertainty: if unsure, say so in the note and lower the confidence. "
    "Never invent certainty you do not have."
)

ANSWER_SYSTEM = (
    "You are Bioledger, a warm naturalist helping someone understand their own field journal. "
    "Answer using ONLY the provided journal context. Be concise (2 to 4 sentences). "
    "If the context does not contain the answer, say you have not logged that yet."
)


class LLMError(RuntimeError):
    pass


def _client() -> httpx.Client:
    return httpx.Client(base_url=config.OLLAMA_HOST, timeout=config.REQUEST_TIMEOUT)


def _base(name: str) -> str:
    return name.split(":")[0]


def _available(names: List[str], wanted: str) -> bool:
    return any(_base(n) == _base(wanted) for n in names)


def status() -> dict:
    try:
        with _client() as client:
            response = client.get("/api/tags")
            response.raise_for_status()
            models = [m.get("name", "") for m in response.json().get("models", [])]
        return {
            "ollama": True,
            "models": models,
            "model": config.MODEL,
            "model_present": _available(models, config.MODEL),
            "embed_model": config.EMBED_MODEL,
            "embed_present": _available(models, config.EMBED_MODEL),
            "vision_model": config.VISION_MODEL,
            "vision_present": _available(models, config.VISION_MODEL),
        }
    except Exception as exc:
        return {
            "ollama": False,
            "error": str(exc),
            "models": [],
            "model": config.MODEL,
            "model_present": False,
            "embed_model": config.EMBED_MODEL,
            "embed_present": False,
            "vision_model": config.VISION_MODEL,
            "vision_present": False,
        }


def _extract_json(text: str) -> dict:
    if not text:
        raise LLMError("empty model response")
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


def _chat(messages: List[dict], model: Optional[str] = None) -> str:
    payload = {
        "model": model or config.MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.4},
    }
    try:
        with _client() as client:
            response = client.post("/api/chat", json=payload)
            response.raise_for_status()
            return response.json()["message"]["content"]
    except httpx.HTTPError as exc:
        raise LLMError(f"ollama chat failed: {exc}") from exc


def embed(text: str, model: Optional[str] = None) -> Optional[List[float]]:
    payload = {"model": model or config.EMBED_MODEL, "prompt": text or ""}
    try:
        with _client() as client:
            response = client.post("/api/embeddings", json=payload)
            response.raise_for_status()
            return response.json().get("embedding")
    except Exception:
        return None


def describe_image(image_b64: str, model: Optional[str] = None) -> str:
    payload = {
        "model": model or config.VISION_MODEL,
        "prompt": (
            "Describe this photo in two sentences. Focus on any plant, animal, fungus, "
            "insect, or natural feature. Do not guess a species name you are unsure of."
        ),
        "images": [image_b64],
        "stream": False,
    }
    try:
        with _client() as client:
            response = client.post("/api/generate", json=payload)
            response.raise_for_status()
            return response.json().get("response", "").strip()
    except Exception as exc:
        raise LLMError(f"vision failed: {exc}") from exc


def parse_observation(text: str, image_b64: Optional[str] = None) -> dict:
    user_content = f"Field note: {text.strip()}" if text and text.strip() else "Field note: (a photo with no text)"
    message = {"role": "user", "content": user_content}
    model = config.MODEL
    if image_b64:
        model = config.VISION_MODEL
        message["images"] = [image_b64]
    try:
        content = _chat([{"role": "system", "content": PARSE_SYSTEM}, message], model=model)
        data = _extract_json(content)
    except Exception:
        data = {}
    return {
        "species": str(data.get("species") or "unidentified sighting").strip(),
        "common_name": (data.get("common_name") or None),
        "category": str(data.get("category") or "other").strip().lower(),
        "confidence": float(data.get("confidence") or 0.0),
        "note": str(data.get("note") or "").strip(),
        "tags": [str(t).lower() for t in (data.get("tags") or [])][:5],
        "season_note": (data.get("season_note") or None),
    }


def answer(question: str, context: str) -> str:
    try:
        return _chat(
            [
                {"role": "system", "content": ANSWER_SYSTEM},
                {"role": "user", "content": f"Journal context:\n{context}\n\nQuestion: {question}"},
            ]
        ).strip()
    except LLMError:
        return ""
