# Agent Claim Network (ACN) — Inter-Agent Knowledge Sharing with Provenance

**Date:** 2026-07-31
**Source:** GitHub
**Repo:** https://github.com/FTShare-Lab/agent-claim-network
**Stars:** 12 (new, created 2026-07-31)
**Language:** Rust
**License:** MIT OR Apache-2.0
**Tags:** #multi-agent #knowledge-sharing #memory #provenance #mcp #terminal

---

## Summary

ACN is a Rust-based terminal AI assistant that doubles as a **claim network** for multi-agent teams. Individual agents accumulate "Claims" — structured judgments with scope, evidence, and holder attribution — that can be shared, searched, cited, and *contested* across a team of agents via a lightweight Router/Maintainer service.

## Key Design Decisions

1. **Claim as primitive:** After each session, ACN extracts durable conclusions into Claims (not raw conversation logs). Claims carry applicability scope, supporting evidence, and an explicit holder.
2. **Disagreement is first-class:** Multiple agents can hold contradictory claims on the same topic. The network surfaces both with provenance rather than forcing consensus.
3. **Private Memory vs. Shared Claims:** An agent's working memory stays local; only Claims promoted to the network become team-visible. This mirrors human institutional knowledge patterns.
4. **Single-player → Team gradient:** With Router/Maintainer endpoints left blank, ACN is a fully functional solo terminal assistant. Adding the team layer is opt-in.
5. **MCP integration:** Supports stdio and Streamable HTTP MCP servers, plus a Skills system (`/skillname` injection).

## Architecture

- **acn** — Terminal agent (TUI, streaming, sub-agents, file diffs, background commands)
- **acn-router** — Team service: indexes and retrieves Claims across agents
- **acn-maintainer** — Governance: claim lifecycle, quality, dedup

## Why This Matters for Agent Systems

- Represents a concrete implementation of **federated agent memory** — each agent owns its knowledge but can share selectively.
- The "claim with disagreement" model avoids the brittleness of single-source-of-truth knowledge bases when agents operate in uncertain domains.
- Built by Non-convex ft.tech (非凸科技), a Chinese quant/AI firm, suggesting production use in financial multi-agent workflows.
- Aligns with emerging pattern: agent memory infrastructure as standalone product (see OptMem, claude-mem, etc.) but adds the *social/team* dimension.

## Connections

- Related to **OptMem** (VictorTaelin) — simpler single-agent persistent memory
- Complements **AskChem** claim-centered retrieval — similar "claim as atom" philosophy but ACN is multi-agent-native
- Extends themes in Scout's `agent-architectures.md` re: memory infrastructure category
