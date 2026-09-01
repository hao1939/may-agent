---
title: "secondwind — Lossless Agent Tool-Output Compression"
source: github
date: 2026-07-20
last_updated: 2026-08-24
type: finding
tags: [github, agent-efficiency, token-optimization, context-window, rust, mcp]
---

# secondwind — Lossless Agent Tool-Output Compression

## Summary

Repo: https://github.com/orchetron/secondwind (4★, created 2026-07-20)

Rust library/proxy that losslessly compresses the tool output an AI agent sends back to the model, proves every value survived the compression, and reports exact tokens removed. Can run as a proxy, library, or middleware.

## Signal

Addresses a concrete pain point: tool calls (file reads, shell output, API responses) often contain repetitive structure (whitespace, boilerplate keys, repeated headers) that wastes context window. Unlike summarization (lossy), this guarantees no information loss — critical for coding agents where a single dropped character can cause bugs.

Complements the existing context-efficiency tools in the library:
- **symbolpeek-mcp** (scan #536): reduces input tokens by retrieving only relevant symbols
- **secondwind**: reduces output tokens by compressing tool responses losslessly

Together they squeeze both directions of the context pipeline.

## Pattern

**Lossless context compression** — treating the context window as a scarce resource and applying information-theoretic compression (not summarization) to maximize useful density. Analogous to HTTP content-encoding but for LLM token budgets.

## Relevance to Agent Architecture

| Layer | Tool | Direction |
|-------|------|-----------|
| Input optimization | symbolpeek-mcp | Minimize what goes in |
| Output optimization | secondwind | Minimize what comes back |
| Memory optimization | engRAM | Persist without bloating context |

This "token budget engineering" stack is emerging as a distinct concern separate from prompt engineering.

## 2026-08-24 update — deduplication is a cache-coherence protocol

Repo: https://github.com/fajarhide/omni (355★ when checked)

OMNI adds a materially different design to this topic: instead of only stripping command-specific boilerplate, its session ledger replaces a consecutive run of lines with a content-addressed retrieval handle when that reader has already received those bytes. The implementation makes clear that this is not merely a compression algorithm. It is a **cache-coherence protocol between the harness, the model's current context, and an expiring local archive**.

Three details are especially reusable:

1. **Scope the seen-set to the actual reader.** OMNI keys session history by session plus agent identity because a subagent can inherit a parent session ID without inheriting the parent's context. Cross-session matches use different marker language (`not shown here`) and a higher savings threshold rather than falsely claiming the current reader already saw them.
2. **Make retrieval create delivery debt.** A naive deduplicator can fold the output of `retrieve(handle)` back into the same handle, trapping the reader in a loop. OMNI increments an `owed` counter on retrieval and atomically spends one exemption when those bytes next pass through the hook. This turns handle resolution into an explicit one-delivery obligation.
3. **Fail open where omission is expensive.** The code archives a run before emitting its marker; archive failure leaves the run verbatim. Non-zero command output and structured JSON/YAML/CSV bypass distillation. The README also states that handles expire with the 30-day working-store retention, so “retrievable” is a bounded promise, not permanent losslessness.

This sharpens the earlier pattern: reversible context reduction requires at least `(content identity, reader scope, archive lifetime, retrieval obligation, bypass policy)`. A token-savings number without those fields says little about whether the compressed view remains operationally safe.

## Evidence and limits

- Source: https://github.com/fajarhide/omni/tree/121420561ed9d987d2cbcacefe04e85a86ffe7c0
- Ledger scope, deterministic handles, archive-before-marker, and distinct session/project semantics: https://github.com/fajarhide/omni/blob/121420561ed9d987d2cbcacefe04e85a86ffe7c0/src/ledger/mod.rs
- Retrieval debt and atomic owed-delivery consumption: https://github.com/fajarhide/omni/blob/121420561ed9d987d2cbcacefe04e85a86ffe7c0/src/store/sqlite.rs#L1600-L1680
- Non-zero exit passthrough: https://github.com/fajarhide/omni/blob/121420561ed9d987d2cbcacefe04e85a86ffe7c0/src/cli/exec.rs#L95-L127
- Retention, host capability tiers, benchmark corpus, and reproducibility caveats: https://github.com/fajarhide/omni/blob/121420561ed9d987d2cbcacefe04e85a86ffe7c0/README.md

The reported 69.6% aggregate byte reduction comes from OMNI's own 5,984-call corpus, which the maintainers explicitly describe as unusually repetitive; their separate ordinary-work week measured 14.9%. These are model-facing byte counts rather than an independent token, quality, or task-success evaluation. The architecture is the durable signal; the headline savings should not be generalized without replaying the published harness on the target workload.
