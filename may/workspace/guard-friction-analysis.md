# FM-3.3 Guard Friction Analysis (Corrected)

## Summary

The **only** guard file in the codebase is `agents/src/lib/finish-guard.ts` (235 lines). There is **no** separate `verification-depth-guard.ts` — previous iterations hallucinated that file.

## What finish-guard.ts Actually Does

Two exported validators, both called on `finish(status: "success")`:

### 1. `validateFinishDeliverables` (FM-3.1 — Ghost Deliverables)
- Checks that every path in `deliverables[]` exists on disk via `existsSync()`
- Only fires for status "success" or "partial"
- **False positive risk: Very low** — if you declare a file, it must exist

### 2. `validateVerificationEvidence` (FM-3.3 — Verification Evidence)
- **Rule 1 (blocking):** `finish(success)` with deliverables MUST have ≥1 `verification_evidence` entry
- **Rule 2 (warning only):** Entries shorter than 15 chars flagged as suspicious
- **Rule 3 (warning only):** Entries matching ghost keywords (e.g. "SYNTAX OK", "ALL TESTS PASS") flagged

### Key Observation
Rules 2 and 3 are **advisory only** — they return warnings but do NOT block the finish call. Only Rule 1 (missing evidence entirely) actually blocks.

## Sources of Friction

### Friction Point 1: Rule 1 Forces Extra Tool Call
When an agent finishes without `verification_evidence`, it gets blocked and must:
1. Run a verification step (read/bash/test)
2. Call finish() again with the evidence

This adds 2-3 tool calls per session. **This is by design** — it ensures agents verify work. The friction is intentional.

### Friction Point 2: Orchestration Sessions
When an agent delegates via `agents.call()` and the child produces deliverables, the parent agent may list those as deliverables. The parent needs to provide verification evidence, but the verification happened in the child session. The parent must redundantly re-verify (e.g., `read()` the file) to satisfy the guard.

### Friction Point 3: No Integration Point Found
Neither `enforceFinishDeliverables` nor `enforceVerificationEvidence` is imported anywhere in the main agent runtime (`agents/src/`). The guard exists as a library but **its integration point is unclear** — it may be integrated via the tool schema/harness layer not visible in this codebase, or it may not be active yet.

## Recommendations

### R1: Add orchestration exemption (Medium priority)
If the session used `agents.call()` or `agents.fork()` tools, the verification evidence requirement should be relaxed — allow citing child session success as evidence.

**Implementation:** In `validateVerificationEvidence`, accept evidence entries that reference child agent results (e.g., pattern matching "agents.call" or "child session").

### R2: Improve error message specificity (Low priority)  
The FM-3.3 error message says "citing a real tool output (e.g., 'Step 12: bun test exit code 0')". This is good guidance but could also suggest `read()` as verification for non-code deliverables (docs, configs).

### R3: Clarify integration status (High priority)
The guard functions are not visibly imported in the main codebase. Either:
- They're integrated via a layer not in this repo (e.g., injected by the harness)
- They're not yet active

If not active, the FM-3.3 friction agents experience may come from **prompt instructions** rather than code enforcement. This distinction matters for any fix.

## Conclusion

The previous analysis was inaccurate — it described a non-existent `verification-depth-guard.ts` with fabricated "Gate 2" and "T2" rules. The actual guard is simpler: one file, two validators, one blocking rule (must provide evidence). The real friction is modest and largely intentional. The main actionable improvement is the orchestration exemption (R1).
