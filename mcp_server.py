import json

import llm
import store as store_module


def build():
    try:
        from mcp.server.fastmcp import FastMCP
    except Exception:
        return None

    server = FastMCP("bioledger")

    @server.tool()
    def ledger_query(limit: int = 20) -> str:
        """List the most recent observations in the field journal."""
        rows = store_module.get_store().list_observations(limit=limit)
        return json.dumps(rows, default=str)

    @server.tool()
    def in_season(month: int = 0) -> str:
        """Species recorded this calendar month (0 means the current month)."""
        rows = store_module.get_store().species_in_season(month or None)
        return json.dumps(rows)

    @server.tool()
    def similar_sightings(query: str, k: int = 5) -> str:
        """Find past sightings similar to a free-text description."""
        embedding = llm.embed(query)
        rows = store_module.get_store().find_similar(embedding, k=k)
        return json.dumps(rows, default=str)

    @server.tool()
    def journal_stats() -> str:
        """Summary statistics for the field journal."""
        return json.dumps(store_module.get_store().stats())

    return server


if __name__ == "__main__":
    server = build()
    if server is None:
        raise SystemExit("Install the MCP SDK first:  pip install mcp")
    server.run()
