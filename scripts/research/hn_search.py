#!/usr/bin/env python3
"""Search Hacker News for AI agent discussions via Algolia API."""
import json
import urllib.request
import urllib.parse
import time
import sys

def search_hn(query, sort_by="relevance", hits=20, days_back=30):
    """Search HN stories."""
    cutoff = int(time.time()) - (days_back * 86400)
    endpoint = "search" if sort_by == "relevance" else "search_by_date"
    url = f"https://hn.algolia.com/api/v1/{endpoint}?query={query}&tags=story&hitsPerPage={hits}&numericFilters=created_at_i>{cutoff}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    return data.get("hits", [])

def print_hits(hits, label=""):
    if label:
        print(f"\n{'='*70}")
        print(f"  {label}")
        print(f"{'='*70}")
    for h in hits:
        pts = h.get("points", 0)
        cmt = h.get("num_comments", 0)
        title = h.get("title", "")
        date = h.get("created_at", "")[:10]
        url = h.get("url", "N/A")
        hn_id = h.get("objectID", "")
        print(f"\n  [{pts} pts | {cmt} cmts] {title}")
        print(f"    Date: {date}")
        print(f"    URL: {url}")
        print(f"    HN: https://news.ycombinator.com/item?id={hn_id}")

# Run searches
queries = [
    ("AI agent", "relevance", "Top AI Agent Stories (by relevance, last 30 days)"),
    ("AI agents", "date", "Latest AI Agents Stories (by date, last 30 days)"),
    ("agentic AI", "relevance", "Agentic AI Stories (last 30 days)"),
    ("coding agent", "relevance", "Coding Agent Stories (last 30 days)"),
    ("AI agent framework", "relevance", "AI Agent Framework Stories (last 30 days)"),
    ("autonomous agent", "relevance", "Autonomous Agent Stories (last 30 days)"),
    ("MCP tool", "relevance", "MCP / Tool Use Stories (last 30 days)"),
    ("agent safety", "relevance", "Agent Safety Stories (last 30 days)"),
]

for query, sort, label in queries:
    try:
        hits = search_hn(query, sort, hits=10, days_back=30)
        print_hits(hits, label)
        time.sleep(0.3)  # Rate limit
    except Exception as e:
        print(f"\nError searching '{query}': {e}")

print("\n\nDone.")
