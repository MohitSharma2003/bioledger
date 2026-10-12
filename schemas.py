from typing import List, Optional

from pydantic import BaseModel, Field


class ParsedObservation(BaseModel):
    species: str = "unidentified sighting"
    common_name: Optional[str] = None
    category: str = "other"
    confidence: float = 0.0
    note: str = ""
    tags: List[str] = Field(default_factory=list)
    season_note: Optional[str] = None


class Observation(BaseModel):
    id: int
    created_at: str
    text: str
    place: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    species: str
    common_name: Optional[str] = None
    category: str
    confidence: float
    note: str
    tags: List[str] = Field(default_factory=list)
    season_note: Optional[str] = None
    source: str = "user"
    photo_url: Optional[str] = None
    photo_mime: Optional[str] = None
    photo_bytes: Optional[int] = None


class NewObservation(BaseModel):
    """A structured observation produced outside the server.

    Used when the parser ran in the browser (the Transformers.js runtime), so
    the server only validates and stores it. Every field is optional so a
    provider that cannot name a species still saves the raw note.
    """

    text: str = ""
    place: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    species: Optional[str] = None
    common_name: Optional[str] = None
    category: Optional[str] = None
    confidence: Optional[float] = None
    note: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    season_note: Optional[str] = None
    source: str = "user"


class SimilarResult(BaseModel):
    observation: Observation
    score: float


class ObserveResponse(BaseModel):
    observation: Observation
    similar: List[SimilarResult] = Field(default_factory=list)
    in_season: List[dict] = Field(default_factory=list)
    used_vision: bool = False
    ai_processed: bool = True
    notice: Optional[str] = None


class Stats(BaseModel):
    total: int
    species: int
    this_week: int
    streak_days: int
    top_species: List[dict] = Field(default_factory=list)


class AskIn(BaseModel):
    question: str = Field(..., min_length=1)


class AskOut(BaseModel):
    answer: str
    sources: List[Observation] = Field(default_factory=list)
    mode: str = "model"


class HealthOut(BaseModel):
    app: str
    backend: str
    ollama: bool
    model: str
    model_present: bool
    embed_model: str
    embed_present: bool
    vision_model: str
    vision_present: bool
