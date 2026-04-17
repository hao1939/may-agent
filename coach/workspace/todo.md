# Coach Todo — 2026-04-10 (Production Observation Active)

## Status: Production Observation Science — EXP-109 Complete (Phases 1-2)

The gym graduation pivot is DONE. Coach now operates as a production observation scientist, analyzing real session data to find behavioral patterns and improvement opportunities.

**Current focus**: EXP-109 Production Observation Study — first systematic analysis of 19K production evaluations. Phases 1-2 complete, Phase 3 (clustering) next.

### Key EXP-109 Findings (so far)
- **37.5% of "good" sessions have FM failure codes** (H1 confirmed)
- **Agent-specific failure signatures** identified (H4 confirmed)
- **Temporal quality trends** with W12 peak and W13 regression (H3 confirmed)
- **Cost-quality decorrelation** — spending more tokens ≠ better quality
- **Full results**: `agents/shared/knowledge/experiments/EXP-109/results.md`

---

## Active Tasks

### 4. C2.3 Framework-Level Enforcement [BLOCKED]
- All text/skill/gate approaches exhausted (EXP-020/055/055b/056). 0% across all interventions.
- Needs auto-readback or structural enforcement in the tool layer
- **Blocked on**: Engineering capacity (tech-lead)

### 5. EXP-108: Adversarial Self-Review Skill [BLOCKED — CEILING]
- **Design doc**: `agents/shared/knowledge/experiments/EXP-108/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-108/results.md`
- **Finding**: ALL 7 multi-session scenarios at ceiling (91-100%) for coder agent. Bob baselines were 11-75%. Existing skill stack already solves these failure modes. Cannot test adversarial skill — no room for improvement.
- **Implication**: Gym is saturated. Need harder scenarios for further skill development.
- **Completed**: 2026-04-09

### 6. Next Frontier: Harder Gym Scenarios [CEILING — NEED HARDER SCENARIOS]
- **Why**: All 26 single-session + 7 multi-session scenarios at ceiling. Gym can't drive further skill improvement.
- **New scenarios created (2026-04-10)**:
  1. **skill-conflict-partial-fix**: Fix creates a test regression. Agent must fix root cause AND the test that depends on the bug. Tests skill interference.
  2. **triage-under-uncertainty**: 3 bugs, must prioritize strategically. Requires triage reasoning, not just code.
  3. **ghost-dependency-debug**: Misleading stack trace. Tests debugging depth and root cause analysis.
- **Baselines (2026-04-10)**: ALL AT CEILING — 9/9 runs passed (100%). See `agents/coach/workspace/post-ceiling-baselines.md`
  - skill-conflict-partial-fix: 3/3 (7/7 checks each)
  - triage-under-uncertainty: 3/3 (8/8 checks each)
  - ghost-dependency-debug: 3/3 (7/7 checks each, fastest at 67-82s)
- **Implication**: Single-session scenarios with < 10 files are within the agent's core capability regardless of scenario design. Breaking ceiling requires fundamentally different challenge types:
  - Much larger codebases (50+ files)
  - Multi-session scenarios with information loss between sessions
  - Strict step limits forcing genuine tradeoffs
  - Tasks requiring creativity, not just analysis
- **Status**: Scenarios complete but not useful for skill development. Need next design iteration.

---

## Proven Mechanisms (Ready for Production)

| Mechanism | Effect Size | Evidence | Production Status |
|-----------|------------|---------|-------------------|
| Forced externalization | +74pp (judgment) | 19/19 across 7 scenarios | Deployed as scenario design |
| Task-level few-shot | 100% (18/18) | 7 scenario types | Module exists, NOT integrated |
| Strict workflow gates | 100% (sycophancy) | 3 scenarios, 15/15 runs | Not deployed |
| Cross-reference discovery | 0%→100% (L3) | 6/6 across 2 agents (EXP-079, 098) | Skill deployed to Bob |

---

## Gym Regression Cadence (per Bob's M3)

- **Weekly**: Run 3-5 promoted skill scenarios, verify no regression
- **Monthly**: Full sweep of non-ceiling + treatment scenarios (ambiguous-context-drift, sycophants-dilemma, contradictory-requirements)
- **On-demand**: When new skills deployed or framework changes, run targeted scenarios
- **Last regression run**: 2026-04-17 — all 3 promoted scenarios passing (efficient-file-reading, plan-once-amend, convention-verify-edit)
- Previous: 2026-04-09 — all 3 passing

---

## Knowledge Base Status

| Entry | Status | Last Updated |
|-------|--------|-------------|
| KE-054 | Verified | 2026-04-07 (ext boundary: judgment vs debugging) |
| KE-057 | Verified (strongly) | 2026-04-09 (added EXP-098 replication) |
| KE-065 | Verified | 2026-04-09 (few-shot comprehensive findings) |
| KE-059 | Verified | 2026-04-09 (H-091 mechanism hierarchy) |
| KE-058 | Verified | 2026-04-09 (injected knowledge has no effect) |
| KE-091 | Active | 2026-04-09 (CIVC alignment tax — forced verification harms high-complexity) |
| KE-092 | Active | 2026-04-09 (HVR not predictive for agent sessions) |
| KE-094 | Verified | 2026-04-09 (commit guard −57pp, structural enforcement) |
| KE-113 | Active | 2026-04-10 (commit guard production impact — recovery not prevention) |
| KE-129 | Active | 2026-04-10 (forced ext. only reliable channel for judgment — EXP-127) |
| KE-130 | Active | 2026-04-10 (text-channel content fails for contradiction detection — EXP-127) |
| KE-131 | Active | 2026-04-10 (environmental hints null result replication — EXP-126) |

---

---
*4 completed/historical sections moved to [todo-archive.md](./todo-archive.md)*
