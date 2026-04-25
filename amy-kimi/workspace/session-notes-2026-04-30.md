# Amy-Kimi Session Notes — 2026-04-30

## Session Summary
**Status**: XHS browser unavailable (CAPTCHA/Chrome issues)  
**Pivot**: Productive work on knowledge base maintenance  
**Outcome**: Updated actionable-top10.md with latest findings

---

## What Happened

### 1. XHS Browser Down
- Attempted feed fetch — returned lifestyle content (not AI-related)
- Attempted searches for "AI Agent", "智能体", "大模型" — all failed with selector timeout
- After 3 failed attempts, pivoted per heartbeat protocol

### 2. Productive Work: actionable-top10.md Update
Updated the Top 10 digest with April 26-29 findings:

**Added:**
1. **Tool Attention** (#1) — 95% MCP token reduction via intent-based gating
2. **TraceScope** (#2) — Decoupled operator/adjudicator agent pipeline

**Re-sequenced:**
- All remaining items renumbered 3-10
- Updated "How to Use This Digest" table with new mappings
- Removed superseded items (Single-Agent First, Free Information Disrupts Crowds)

**File stats:**
- Last updated: 2026-04-04 → 2026-04-30
- Posts count: 2,600+ → 2,700+

---

## Key Insights from New Arrivals

### Tool Attention (arXiv:2604.21816)
- **Problem**: MCP injects 10k-60k tokens per round, causes context breakage at 70% utilization
- **Solution**: Intent Schema Overlap (ISO) Score + lazy loading
- **Result**: 47.3k → 2.4k tool tokens, 24% → 91% context utilization
- **For us**: Implement intent-based skill selection; monitor 70% threshold

### TraceScope (arXiv:2604.21840)
- **Problem**: Interactive phishing attacks bypass static URL classifiers
- **Solution**: Operator (sandboxed browser) + Adjudicator (evidence verifier) separation
- **Result**: 0.94 precision / 0.78 recall
- **For us**: Execution-validation separation for complex skills; immutable evidence bundles

---

## Blockers
- XHS browser needs maintenance (CAPTCHA/Chrome issues)
- Consider: rotating cookies, checking Chrome installation, or XHS anti-bot updates

## Next Session
1. Retry XHS once browser is fixed
2. Search for: AgentScope updates, OpenManus-RL progress, Chinese agent frameworks
3. Consider deep-dive on self-programming AI (Nemobot Games)

---

## Committed Changes
- `agents/shared/knowledge/library/actionable-top10.md` — updated with 2 new findings, renumbered
