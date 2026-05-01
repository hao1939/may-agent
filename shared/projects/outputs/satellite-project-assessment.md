# Satellite Project Assessment — 2026-05-02

## Summary

Scanned all 5 satellite projects. **1 active with clear gap, 2 closed, 1 waiting, 1 blocked-at-cap.**

| Project | Status | Gap | Action |
|---------|--------|-----|--------|
| agent-convention-compliance | **active** | 84.3% vs 90% target | **HIGH PRIORITY** — 6 pts to close |
| handler-reliability | closed ✅ | All metrics met | None |
| proof-of-life-dashboard | waiting | Feature-complete, awaiting feedback | None until Hao feedback |
| request-deduplication | closed ✅ | 5.4% dup rate vs 10% target | None |
| skill-workflow-audit | blocked (iter 50 cap) | All 4 metrics green | None — cap hit, all done |

---

## Highest-Leverage Target: Agent Convention Compliance

**Current**: 84.3% raw (87.8% adjusted for infra bugs)  
**Target**: >90%  
**Gap**: 9 failing checks out of 51 total (need to fix ≥5 to hit 90%)

### Remaining 9 Failures by Category

| Category | Checks | Root Cause | Fix Difficulty |
|----------|--------|------------|----------------|
| Transcript infra bug | 2 | `fewshot` + `verify-wrap` gym scenarios don't generate `transcript.jsonl` | Medium — fix `run-gym.sh` or scenario config |
| Multi-edit product failures | 5 | Agent uses `write()` instead of `edit()`, losing JSON fields | Easy — SOUL.md "prefer edit()" already added but not effective in these scenarios |
| C40 promise-report | 2 | Agent doesn't declare intent or include deliverables in `finish()` | Easy — few-shot example in SOUL.md |

### Recommended Fix Order (highest ROI first)

1. **Fix transcript infra bug (2 free checks)**: These are currently scored as failures but the agent behavior may already be correct — they just can't be measured. Investigate why `transcript.jsonl` isn't generated for `fewshot` and `verify-wrap` scenarios. Likely a `run-gym.sh` issue.

2. **Fix multi-edit write→edit behavior (5 checks)**: The "prefer edit()" SOUL.md patch exists but agents still use `write()` in multi-edit scenarios. Need stronger intervention:
   - Add concrete few-shot example showing edit() for JSON modification
   - Consider adding a pre-check in the agent runner that warns on write() to existing files

3. **Fix C40 promise-report (2 checks)**: Add explicit "I will..." preamble example and `deliverables` array in `finish()` example to SOUL.md.

**Fixing all 9 → 100%. Fixing just category 1+2 → 44/51 = 86%. Fixing all 3 → 51/51 = 100%.**

### Concrete Next Step

The transcript infra bug is the easiest win (2 checks for free). Investigation steps:
```bash
# Check how gym scenarios generate transcripts
grep -r "transcript" /app/agents/coach/workspace/run-gym.sh
# Check fewshot scenario config
ls /app/agents/coach/gym/scenarios/fewshot/
ls /app/agents/coach/gym/scenarios/verify-wrap/
```

---

## System Efficiency Metrics (from efficiency-scorecard.md)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Deliverables per iteration | ~1.2 | >1.0 | ✅ |
| Satellite project progress | 4/5 at target | >80% | ✅ |
| Test health | Passing | Green | ✅ |
| Dispatch accuracy | Fixed (skip vs escalate) | >50% | ✅ (code fix applied) |

---

## Recommendation

**Focus all system-efficiency energy on agent-convention-compliance.** It's the only active project below target. The 3 fix categories are well-understood and the plan (Iteration 6) already exists but hasn't been executed. The coach agent owns this project — the most helpful thing system-efficiency can do is:

1. Fix the transcript infra bug (cross-cutting infrastructure issue)
2. Flag to coach that Iteration 6 plan items P6.1-P6.4 are unexecuted
