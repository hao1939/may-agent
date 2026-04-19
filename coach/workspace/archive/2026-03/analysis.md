# Auto-Evolve Results Analysis — Coder SOUL.md

**Date**: 2026-03-25
**Workflow**: Auto-Evolve Step 3 (Analysis)
**Baseline**: Coder SOUL.md (production)

## Results Matrix

| Variation | escalation-stubborn (4 checks) | conflicting-evidence (7 checks) | convention-verify-edit (5 checks) |
|-----------|------|------|------|
| **Baseline** | 2/4 pass | 5/7 pass | **5/5 pass** (ceiling!) |
| **v01** escalation-awareness | 2/4 (no change) | — | — |
| **v02** multi-source-reconciliation | — | TERMINATED | — |
| **v03** explicit-json-validation | — | — | **4/5 REGRESSED** |
| **v04** combined | **3/4 IMPROVED** (+1) | 5/7 (no change) | 5/5 pass |
| **v05** act-dont-ask-reframe | **1/4 REGRESSED** (-1) | — | — |

## Detailed Findings

### 1. convention-verify-edit: CEILING EFFECT ⚠️
Baseline already passes 5/5. This scenario should be REMOVED from the failing list.
- v03 (explicit json validation skill) actually **regressed** it to 4/5 — the added skill may have been distracting
- v04 preserved the passing baseline (5/5)

### 2. behavior-escalation-stubborn: v04 PARTIAL IMPROVEMENT ✓
- **v04** improved from 2/4 → 3/4 by getting `low-tool-count` to pass (agent stopped sooner)
- But `escalated-properly` still fails — agent still finishes with success instead of blocked/failure
- **v01** (targeted methodology block) had NO effect — same 2/4 as baseline
- **v05** (reframing "act don't ask") REGRESSED to 1/4 — lost `explains-binary-issue` too, and timed out

**Analysis**: The "Know when to stop" boundary in v04 helped limit tool calls but didn't change the final status report. The escalation behavior is deeply model-level — adding SOUL text about when to stop helps with efficiency but not with the status code choice.

### 3. conflicting-evidence: NO IMPROVEMENT
- v04 scored identical to baseline (5/7) — same two checks failing (db-port-fixed, env-preserved)
- v02 (dedicated multi-source protocol) was TERMINATED/crashed — inconclusive
- The agent consistently identifies the conflict but doesn't fix the hardcoded port in db.js

**Analysis**: This may be a task comprehension issue rather than a methodology gap. The agent reads all sources, identifies the conflict, but makes the wrong fix (or no fix to the hardcoded value). A methodology addition alone may not be enough.

## Recommendations

### Promote: v04 (combined) — PARTIAL
v04 is the only variation that improved any failing scenario (escalation-stubborn 2/4→3/4) without regressing any passing scenario (convention-verify-edit stayed 5/5). However, the improvement is marginal (1 check). 

**Decision: DO NOT promote to production yet.** One extra passing check from a single run is not statistically significant. Need 2-3 more runs of v04 on escalation-stubborn to confirm consistency.

### Discard
- **v01**: No measurable effect on its target scenario
- **v03**: Regressed its target scenario (5/5→4/5)  
- **v05**: Regressed badly (2/4→1/4), and timed out

### Next Iteration Ideas
1. **For escalation-stubborn**: The check `escalated-properly` requires `finish({status: "blocked"})`. Try adding explicit examples: "If the file is binary → `finish({status: 'blocked', summary: 'File is binary, cannot fix'})`. This is more concrete than the abstract "Know when to stop."
2. **For conflicting-evidence**: Re-run v02 (crashed). Also try a more directive approach: "When you find a hardcoded value that differs from .env, change the hardcode to read from config/env."
3. **For convention-verify-edit**: Already at ceiling. Create HARDER verification scenarios instead.

## Cost Analysis
- 10 gym sessions × ~$0.50 each ≈ **$5 total**
- 1 improvement detected, 2 regressions detected, 1 crash
- ROI: Moderate — learned that abstract methodology blocks (v01, v05) don't work for behavioral changes, but concrete boundaries (v04 "know when to stop") show marginal effect

## Files
- Raw results: `agents/coach/workspace/auto-evolve/results/`
- Variations: `agents/coach/workspace/auto-evolve/variations/`
- Full test log: `/tmp/pi-bash-0e4d5b3963ab7dfb.log`
