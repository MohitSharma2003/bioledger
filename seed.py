from datetime import datetime, timedelta, timezone

DEMO_OBSERVATIONS = [
    {
        "text": "A copper-coloured dragonfly kept landing on the same reed by the pond.",
        "species": "Common Darter",
        "common_name": "Common Darter dragonfly",
        "category": "insect",
        "confidence": 0.62,
        "note": "A copper darter held one reed like it owned the pond.",
        "tags": ["dragonfly", "pond", "summer"],
        "season_note": "Darters are typical of warm months near still water.",
        "place": "Neighbourhood pond",
    },
    {
        "text": "Bright orange fungus on a dead oak stump, fan-shaped shelves.",
        "species": "Chicken of the Woods",
        "common_name": "Chicken of the woods fungus",
        "category": "fungus",
        "confidence": 0.55,
        "note": "Sulphur-orange shelves stacked up the oak stump like stairs.",
        "tags": ["fungus", "oak", "autumn"],
        "season_note": "Shelf fungi like this fruit mainly late summer into autumn.",
        "place": "Woodland edge",
    },
    {
        "text": "Roof tiles still glistening after rain, low silver clouds.",
        "species": "Post-rain stratocumulus",
        "common_name": "Broken low cloud",
        "category": "cloud",
        "confidence": 0.4,
        "note": "The sky broke into silver plates right after the rain stopped.",
        "tags": ["cloud", "rain", "sky"],
        "season_note": "Clearing stratocumulus is common after a rain band passes.",
        "place": "Balcony",
    },
    {
        "text": "A grey squirrel buried something under the maple and stared at me.",
        "species": "Eastern Grey Squirrel",
        "common_name": "Grey squirrel",
        "category": "animal",
        "confidence": 0.78,
        "note": "It cached a snack, then froze and judged me from the maple.",
        "tags": ["squirrel", "maple", "caching"],
        "season_note": "Squirrels cache heavily in autumn.",
        "place": "Park path",
    },
    {
        "text": "Small blue flowers in the lawn that only opened in the sun.",
        "species": "Germander Speedwell",
        "common_name": "Speedwell",
        "category": "plant",
        "confidence": 0.5,
        "note": "Tiny blue speedwell eyes opened only where the sun hit the lawn.",
        "tags": ["wildflower", "lawn", "spring"],
        "season_note": "Speedwell blooms through spring and early summer.",
        "place": "Front lawn",
    },
]


def seed(store, days_back: int = 10) -> int:
    added = 0
    base = datetime.now(timezone.utc)
    for index, item in enumerate(DEMO_OBSERVATIONS):
        obs = dict(item)
        obs["created_at"] = (base - timedelta(days=index)).isoformat()
        obs["source"] = "demo"
        store.add_observation(obs, None)
        added += 1
    return added


if __name__ == "__main__":
    from store import get_store

    count = seed(get_store())
    print(f"Seeded {count} demo observations.")
