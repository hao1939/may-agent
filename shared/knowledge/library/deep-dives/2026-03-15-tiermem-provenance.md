# Synthesis: P202 Tiered Memory (TierMem)

**Date:** 2026-03-15
**Source:** arXiv:2602.19xxx (TierMem), arXiv:2602.12108 (StateLM)
**Status:** DRAFT

## 1. The Problem: Write-Before-Query Data Loss
When we compress agent history (summarize), we lose details we didn't know were important (e.g., "user has allergies" dropped from summary).
- **Summarization is Lossy**: Once compressed, the raw context is gone.
- **Provenance is Lost**: We don't know *why* the summary says X.

## 2. The Solution: Tiered Memory with Provenance
Keep multiple tiers of memory:
1. **Hot (L1)**: Current Context (Raw).
2. **Warm (L2)**: Recent Summaries + **Pointer to Raw Logs**.
3. **Cold (L3)**: Archived Logs.

**Key Mechanism**: **Provenance Tracking**.
- Summaries must cite their source: "User prefers Python (Source: session_123.jsonl:45)".
- When a query is ambiguous, the agent can *dereference* the pointer to read the raw log.

## 3. The Principle: P202 Provenance-Aware Memory
**"Summaries must trace back to raw facts."**
- **Constraint**: No summary without a citation.
- **Mechanism**: The "Consolidate Memory" skill must record source pointers.
- **Fallback**: If the summary is insufficient, fetch the raw log.

## 4. Implementation Strategy
1. **Skill Update**: Update `consolidate-memory` skill to require citations.
2. **Tool Update**: Ensure `read_log` can fetch specific lines from archive.
3. **Philosophy**: Add P202 to `philosophy.md`.

## 5. Next Steps
- Update `agents/shared/skills/consolidate-memory.md`.
- Update `philosophy.md`.
