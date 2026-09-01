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

---

## 2026-08-25 update — Corroboration needs lineage admission, not a vote count

Repo: https://github.com/alizahidraja/isnad  
Pinned observation: https://github.com/alizahidraja/isnad/commit/867862a5e66a86dc4d01631aef58f0a757cb4b23  
Observed repository state: 36 stars, Apache-2.0, 7 forks

ISNAD is a second claim-centered design, but it focuses on whether a claim may be served rather than how claims are shared. It records a transmission chain, grades the chain separately from content consistency, and routes the combination through a serve/review/quarantine matrix. This sharpens an important boundary for ACN-style shared claims: **provenance can show how a claim arrived without establishing that the claim is true**. ISNAD's own threat model says the operator remains the root of trust, source metadata is not authenticated, and a clean pipeline over a false source can still grade highly.

The most useful recent change is deliberately fail-closed corroboration. `SharedLineageDetector` checks shared narrator identity, model family, and upstream source. When either chain lacks lineage metadata, it now returns an unknown-lineage score of `0.5`, below the default `0.8` corroboration gate; two differently named narrators no longer count as independent merely because no relationship was recorded. The source tests cover both sides of that policy: empty metadata does not upgrade a weak claim, while explicitly distinct model-family and upstream-source metadata can pass the gate.

That still does **not** prove independence. The repository's `docs/chain-independence.md` explicitly identifies correlated training data, shared model blind spots, and copied source errors as topology's unresolved limit. Its mitigation is bounded rather than magical: known shared ancestry blocks corroboration, unknown lineage does not count, and corroboration alone is capped below the highest grade. The published corroboration experiments are repository-authored evidence, not an external evaluation; the broad 577,024-chain benchmark validates agreement with a mapped historical grading corpus, not truth detection for modern multi-agent claims.

### Reusable design rule

A shared claim network should admit corroboration only when every counted route carries enough lineage to test distinctness, and should emit at least three separate fields:

1. **transmission integrity** — what transformations and actors handled the claim;
2. **content verdict** — consistent, contradictory, or unverifiable against the available corpus;
3. **independence status** — shared lineage found, attested-distinct on observed fields, or unknown.

Never collapse “no shared lineage detected” into “independent,” and never collapse a sound transmission chain into “true.” This turns disagreement from a vote into an auditable evidence graph while keeping unknown provenance from manufacturing consensus.

### Primary-source boundaries checked

- Architecture and declared validation boundary: https://github.com/alizahidraja/isnad/blob/867862a5e66a86dc4d01631aef58f0a757cb4b23/README.md
- Independence limit and PR #83 behavior: https://github.com/alizahidraja/isnad/blob/867862a5e66a86dc4d01631aef58f0a757cb4b23/docs/chain-independence.md
- Explicit trust boundary and non-goals: https://github.com/alizahidraja/isnad/blob/867862a5e66a86dc4d01631aef58f0a757cb4b23/THREAT_MODEL.md
- Detector and policy implementation: https://github.com/alizahidraja/isnad/blob/867862a5e66a86dc4d01631aef58f0a757cb4b23/src/isnad/core/corroboration.py
- Unknown-lineage and attested-lineage tests: https://github.com/alizahidraja/isnad/blob/867862a5e66a86dc4d01631aef58f0a757cb4b23/tests/test_corroboration.py
