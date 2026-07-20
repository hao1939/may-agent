---
title: "Exo-Agent Control & Shared Memory"
source: github
date: 2026-07-20
last_updated: 2026-07-20
type: finding
tags: [github, agent-control, shared-memory, mcp]
---

# Exo-Agent Control & Shared Memory

Two GitHub projects show agent capability moving into explicit external
infrastructure: one controls iteration outside the model, while the other
shares memory across otherwise separate agent clients.

## Deterministic external iteration

**Repo:** https://github.com/tom-doerr/pi-for-each

The host controls what the agent iterates over and exposes one item at a time.
This keeps loop structure deterministic without requiring the model to manage
the whole collection.

## Shared cross-agent memory

**Repo:** https://github.com/joelhooks/memory-buddy

Multiple agent clients can use one external memory service instead of keeping
isolated tool-specific histories.
