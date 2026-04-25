# KE-386: FM-2.1 Is Heterogeneous — 54.5% Tactical, Not Strategic

**Created**: 2026-04-10
**Status**: Verified
**Evidence**: 213 FM-2.1 issues across 195 sessions in may.db; keyword-based sub-type classification
**Source**: EXP-114 pre-design analysis

## Finding

FM-2.1 ("wrong approach") is an **umbrella code** used by the evaluator for fundamentally different failure types. Over half (54.5%) are tactical execution errors — tool misuse, path guessing, edit failures — not strategic approach selection errors.

## Sub-Type Breakdown

| Category | % | Key Sub-types |
|----------|---|--------------|
| **Tactical** | **54.5%** | Tool schema misuse (36.6%), wrong path (13.1%), edit failures (4.7%) |
| **Strategic** | **45.5%** | Context drift (6.1%), unresolved errors (5.6%), wrong strategy (3.8%), other (27.2%) |

## Implications

1. **No single guard can address FM-2.1** — the commit guard worked because uncommitted files are a binary, observable state with a natural hook point (finish()). FM-2.1 has no equivalent.
2. **The highest-ROI intervention is boring**: tool schema validation (beforeToolCall guard) addresses 36.6% of FM-2.1 with HIGH confidence using existing architecture.
3. **"Approach decomposition" is a ~15-25% solution**, not a complete fix — only strategic FM-2.1 is addressable through planning/externalization.
4. **Agent-specific patterns**: Coach is 60% tool schema errors, May is context drift, QA is over-strict gating.

## Cross-References

- KE-007: Structural enforcement is the only reliable intervention → confirms tool schema guard approach
- KE-002: Text rules don't fix judgment failures → strategic FM-2.1 won't yield to prompt changes
- KE-094: Commit guard works because of binary observable + natural hook point → FM-2.1 lacks both

## Impact on Research

The EXP-113 recommendation for a "task decomposition guard" was based on treating FM-2.1 as a homogeneous problem. This finding reframes the intervention:
- Priority #1: Tool schema guard (HIGH confidence, 36.6% of FM-2.1)
- Priority #2: Path error mitigation (MEDIUM confidence, 13.1%)
- Priority #3: Forced externalization for strategic errors (LOW-MEDIUM, 15-25%)

[SIG: KE-386]
