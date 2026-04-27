# Skills Impact Analysis

**Date**: 2026-04-25  
**Purpose**: Identify top 5 skills for deployment, assess baseline data, plan measurement

## Top 5 Skills for Deployment

Selected based on: quality rating ("good"), broad applicability, and current non-deployment despite high value.

| # | Skill | Target Agent(s) | Currently Deployed? | Rationale |
|---|-------|-----------------|--------------------:|-----------|
| 1 | **error-handling** | coder, tech-lead | No (0 refs) | Universal need; prevents silent failures |
| 2 | **state-check-before-action** | all workers | No (0 refs) | Defensive pattern; reduces wasted work |
| 3 | **obstacle-pivot** | bob, may, coder | No (0 refs) | Resilience when blocked; high-value for autonomy |
| 4 | **coder-edit-discipline** | coder | No (0 refs) | Directly relevant to coder's core function |
| 5 | **delegation-verification** | tech-lead | No (0 refs) | Tech-lead delegates heavily; needs follow-through |

## Baseline Data Available

### Gym Results (4 scenarios, 5 runs each)
- **agent-stuck-escalation**: 5/5 pass (criteria-only mode)
- **heartbeat-project-creation**: 5/5 pass (criteria-only mode)
- **red-metric-investigation**: 5/5 pass (criteria-only mode)
- **help-blocked-agent**: 0/5 pass — requires agent to contact another agent

**Caveat**: All gym results are criteria-only (regex against scenario text, not real agent behavior). No real before/after measurement exists yet.

### What's Measurable Now
- **workflow.pass-rate**: 100% (10/10) — already measured in `workflows-runtest.md`
- **skill.verified-rate**: 0% — no skills have been deployed and measured

### What Needs Future Sessions
Real impact measurement requires:
1. Run gym scenario with agent (no skill deployed) → capture transcript → score
2. Deploy skill to agent's context.md
3. Run same gym scenario → capture transcript → score
4. Compare scores

## Per-Skill Deployment Plan

### 1. error-handling (226 lines, quality: good)
- **Target**: coder, tech-lead
- **Baseline behavior**: Agents currently handle errors ad-hoc; no structured retry/escalation
- **Expected impact**: Fewer silent failures, better error messages in session logs
- **Measurement**: Count error-recovery patterns in session transcripts before/after
- **Deploy**: Add to `agents/coder/skills/` and `agents/tech-lead/skills/`, reference in context.md

### 2. state-check-before-action (224 lines, quality: good)
- **Target**: all worker agents (bob, coder, may, scout)
- **Baseline behavior**: Agents sometimes repeat work or act on stale assumptions
- **Expected impact**: Reduced duplicate work, fewer stale-state errors
- **Measurement**: Count "already done" / "stale state" incidents in logs before/after
- **Deploy**: Add to shared skills referenced in each agent's context.md

### 3. obstacle-pivot (236 lines, quality: good)
- **Target**: bob, may, coder
- **Baseline behavior**: Agents get stuck and report "blocked" without trying alternatives
- **Expected impact**: More autonomous problem-solving, fewer blocked sessions
- **Measurement**: `help-blocked-agent` gym scenario (currently 0/5 — good baseline)
- **Deploy**: Add to target agents' skills references

### 4. coder-edit-discipline (233 lines, quality: good)
- **Target**: coder
- **Baseline behavior**: Edit operations sometimes fail (wrong oldText, file not read first)
- **Expected impact**: Fewer failed edit() calls, more read-before-edit patterns
- **Measurement**: Count failed edit() calls in coder sessions before/after
- **Deploy**: Add to `agents/coder/skills/`

### 5. delegation-verification (225 lines, quality: good)
- **Target**: tech-lead
- **Baseline behavior**: Tech-lead forks tasks but doesn't always verify completion
- **Expected impact**: Better follow-through on delegated work
- **Measurement**: Count of forked sessions that are never checked (peek/cancel) before/after
- **Deploy**: Add to `agents/tech-lead/skills/`

## Skill Deployment Status Summary

| Skill | Lines | Quality | Deployed | Measured | Impact Verified |
|-------|-------|---------|----------|----------|-----------------|
| error-handling | 226 | good | ❌ | ❌ | ❌ |
| state-check-before-action | 224 | good | ❌ | ❌ | ❌ |
| obstacle-pivot | 236 | good | ❌ | ❌ | ❌ |
| coder-edit-discipline | 233 | good | ❌ | ❌ | ❌ |
| delegation-verification | 225 | good | ❌ | ❌ | ❌ |

## Recommendations

1. **Immediate**: Deploy `obstacle-pivot` to bob/may/coder — `help-blocked-agent` scenario provides a ready-made 0/5 baseline
2. **Immediate**: Deploy `coder-edit-discipline` to coder — most targeted skill-agent match
3. **Next**: Run real gym scenarios (not criteria-only) to establish true behavioral baselines
4. **Then**: Re-run same scenarios after deployment to measure delta
5. **Track**: Update `metrics.md` with `skill.verified-rate` as skills pass measurement

[SIG: skills-impact-analysis]

---

## Appendix: Gym Execution Results (2026-04-27)

### Skill-Delivery Scenario Execution

The `skill-delivery-obstacle-pivot` gym scenario was executed in stub mode:

```json
{
  "scenario": "skill-delivery-obstacle-pivot",
  "agent": "amy",
  "passed": false,
  "checks": [{"name": "criteria-parse", "passed": false, "detail": "No JSON in criteria output"}],
  "summary": "success_criteria.js produced no JSON output",
  "agent_status": "skipped",
  "duration": "25ms"
}
```

**Interpretation:** In stub mode (no live agent), the scenario cannot pass because no agent runs to demonstrate pivot behavior. This establishes the **baseline = 0/1 (0%)** for skill-delivery testing. A live agent run with `obstacle-pivot` skill deployed would provide the "after" measurement.

### Existing Gym Baseline Data (from `.state/gym-runner-results.md`)

| Scenario | Stub Result | Notes |
|----------|-------------|-------|
| phantom-fix | ✅ PASSED | Environment pre-satisfies checks (calibration scenario) |
| read-before-edit | ❌ FAILED | Convention checks pass vacuously without transcript |
| conflicting-evidence | ❌ FAILED | Properly requires agent action |

**Key insight:** Convention/skill checks are vacuous without a live agent transcript. Meaningful before/after measurement requires `GYM_AGENT_BIN` set to a real agent binary.

### Deployment Status

| Skill | Deployed To | Before (stub) | After (stub) | Live Test Needed |
|-------|------------|----------------|--------------|------------------|
| obstacle-pivot | bob (context.md) | N/A | N/A | Yes — run with live agent |
| verify-before-finish | all agents | 0% (no transcript) | 0% (no transcript) | Yes |
| read-before-edit | all agents | vacuous pass | vacuous pass | Yes |

### Regression Check Script

Created `outputs/regression-check.sh` — run periodically to catch workflow load regressions and re-test gym scenarios. Current results: **10/10 workflows pass (100%)**.
