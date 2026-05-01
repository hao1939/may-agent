# Coach Todo — 2026-04-24 (Active Coaching)

## Status: UNBLOCKED — Active Convention Coaching

**Self-diagnosis (2026-04-24)**: Coach was reported blocked for 47+ heartbeats. Root cause: all projects were stale/at-ceiling, and heartbeats were no-ops. NOT actually blocked on anything external. The evaluator pipeline is broken (all sessions score 0.0) but that doesn't block coaching work.

**Current focus**: Convention violation coaching from production data. Evaluator scoring is broken (being fixed separately) but convention_checks table has real violations to act on.

## Active Work — Convention Coaching Sprint
Sent coaching notifications to:
- [x] **scout**: C1.7 (no verification before finish), C1.3 (unverified writes)
- [x] **bob**: C7.1 (wrong paths /home/), C1.1 (blind edits), C1.7
- [x] **tech-lead**: C7.1 (wrong paths /Users/hao/c), C6.1 (over budget), C1.1
- [x] **qa**: C8.2 (no finish call), C1.4 — sent coaching notification about 75% fail rate on finish() calls
- [ ] Track whether notifications reduce violations in next 5 heartbeats

## Legacy Status (from April)

**Current focus**: EXP-109 Production Observation Study — first systematic analysis of 19K production evaluations. Phases 1-2 complete, Phase 3 (clustering) next.

### Key EXP-109 Findings (so far)
- **37.5% of "good" sessions have FM failure codes** (H1 confirmed)
- **Agent-specific failure signatures** identified (H4 confirmed)
- **Temporal quality trends** with W12 peak and W13 regression (H3 confirmed)
- **Cost-quality decorrelation** — spending more tokens ≠ better quality
- **Full results**: `agents/shared/knowledge/experiments/EXP-109/results.md`

---

## 🔴 URGENT — From Reflection System (IT-48/49/50)

**47+ heartbeats blocked. 15 improvement tasks unexecuted across 7 reflections. Act NOW.**

### IT-49: Self-Rescue — Add Fallback Branch to Heartbeat (P0, UNBLOCKED)
Coach can edit its own heartbeat.md. Add: "IF all primary projects blocked >3 heartbeats → (1) re-measure metrics from latest evals, (2) scan for C1.3 violations + add LESSONS entries, (3) graduate oldest LESSONS entry, (4) investigate one stalled experiment."

### IT-50: Wire EXP-188 Finish-Guard Yourself (P1, UNBLOCKED)
Code exists at `agents/src/lib/finish-guard.ts`. Don't wait for tech-lead (62 days waiting). Find integration point in manager.ts, wire it, test. Use `agents.call` to coder if needed.

### IT-48: Escalated to May — Coach Blocked Crisis
May must intervene: assign tech-lead directly via agents.call, or authorize Coach to bypass.

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
- **New scenario created (2026-05-01)**:
  4. **conflicting-requirements-tradeoff**: Agent must detect that PM's 30s time limit and tech lead's 256MB memory limit are physically incompatible for 10M-row export. Tests judgment — will agent flag the conflict or silently violate one constraint? This is a JUDGMENT scenario (not code-fixable) which should break ceiling.
- **Implication**: Single-session scenarios with < 10 files are within the agent's core capability regardless of scenario design. Breaking ceiling requires fundamentally different challenge types:
  - Much larger codebases (50+ files)
  - Multi-session scenarios with information loss between sessions
  - Strict step limits forcing genuine tradeoffs
  - Tasks requiring creativity, not just analysis
- **Status**: New judgment scenario added. Needs baseline run to confirm it breaks ceiling.

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
- **Last regression run**: 2026-04-09 — all 3 promoted scenarios passing (efficient-file-reading, plan-once-amend, convention-verify-edit)

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
