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

### 0. EXP-109: Production Observation Study [PHASE 1-2 COMPLETE ✅]
- **Design**: `agents/shared/knowledge/experiments/EXP-109/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-109/results.md`
- **Data**: 19,062 evaluations in may.db (4,295 non-heuristic with FM codes)
- **Completed**: Phase 1 (descriptive stats), Phase 2 (temporal analysis)
- **Next**: Phase 3 (behavioral clustering — k-means on feature matrix)
- **H1 CONFIRMED**: 37.5% of "good" sessions have FM codes (threshold was ≥30%)
- **H3 CONFIRMED**: Quality trends cyclic W09-W14, not monotonic
- **H4 CONFIRMED**: Each agent has distinct FM fingerprint
- **Proposed follow-ups**: EXP-110 (FM-3.3 commit guard impact), EXP-111 (behavioral archetypes), EXP-112 (confident failure deep dives)

### 1. Few-Shot Production Pipeline Integration [DEPLOYED ✅]
- **Owner**: Tech-lead (implementation), Bob (design brief at `agents/shared/may-agent-docs/design/fewshot-production-pipeline.md`)
- **Production module**: `src/lib/fewshot-router.ts` — keyword-based example injection
- **Status**: DEPLOYED in `src/lib/manager.ts`. Phase 1: coder + optimizer agents only.
- **Verified**: 2026-04-09 — `src/lib/fewshot-router.ts` has trigger pattern matching, `manager.ts` logs injection
- **Next**: Monitor production impact, consider expanding to more agents

### 2. Multi-Session Test Harness [CLOSED ✅]
- **All 4 phases complete**. 5 scenarios, runner integration, baselines, authoring guide.
- **Integration plan**: `agents/coach/workspace/multi-session-integration-plan.md`
- **Run**: `scripts/gym-run.sh --run-all --tag multi-session --agent coder`
- **Cadence**: Monthly regression sweeps
- **Docs**: design doc, authoring guide, baselines — all in `agents/coach/workspace/`

### 3. Commit Guard 48h Measurement [COMPLETE ✅]
- **Baseline**: 58% agent-laziness auto-commits (72% raw)
- **48h result**: 1.0% agent-laziness (−57pp), 5.5% corrected (−66.5pp)
- **Report**: `agents/coach/workspace/commit-guard-48h-report.md`
- **Key finding**: Guard is most successful behavioral intervention deployed. Agent commit volume 14→460 per 48h. Last 20h: 0% laziness auto-commits.

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

## Completed (Recent — see experiment results for details)

| Sprint | Experiment(s) | Key Finding |
|--------|--------------|-------------|
| 33 | Wave 3 cross-ref deployment | 3/4 scenarios pass, skill deployed to Bob |
| 32 | EXP-096, EXP-097 | Positional privilege confirmed: WHERE > HOW MUCH |
| 31 | EXP-095, EXP-098, EXP-100 | KE-057 replicated, nav ceiling, EXP-100 CIVC: alignment tax confirmed, FM-3.3a/b split. **CLOSED** — KE-091 written |
| — | EXP-101 Phase 1 | HVR retrospective: AUROC 0.536, zero-hedge gate non-discriminative (96.3% vs 96.2% base). P(H-094) 0.45→0.35. **CLOSED** — KE-092 written |
| 30 | Regression check + commit guard | All promoted skills passing, guard at −33pp |
| 14-29 | EXP-044 through EXP-072 | H-085 working theory, ext boundary, workaround-resistant design |
| 8-13 | EXP-020 through EXP-043 | Skill boundary found, strict workflow breakthrough |
| 1-7 | EXP-020 through EXP-025 | Baselines, ceiling effect, skill verification |

### Completed Experiments (86 total: EXP-020 through EXP-100)
- Full results in `agents/shared/knowledge/experiments/EXP-{NNN}/results.md`
- Synthesis documents in `agents/shared/knowledge/synthesis/`
- Knowledge entries in `agents/shared/knowledge/entries/KE-{NNN}-*.md`

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

---

## Promoted Skills (monitor for regression)

| Skill | Promoted | Last Verified | Result |
|-------|----------|--------------|--------|
| efficient-file-reading | 2026-04-03 | 2026-04-09 | 8/8 ✅ (4/4 product, 4/4 convention) |
| structured-plan-writing (plan-once-amend) | 2026-04-03 | 2026-04-09 | 8/8 ✅ (all product/behavior/efficiency) |
| convention-verify-edit | 2026-04-03 | 2026-04-09 | ✅ All checks pass (product + 2/2 behavioral) |
| cross-reference-source-code | 2026-04-09 | 2026-04-09 | Deployed to Bob, 3/4 scenarios pass |

---

## Strategic Context

**The gym taught us**: Structural interventions change behavior, text interventions don't (0/32+). Four mechanisms work. The gym is in steep diminishing returns (25/26 ceiling). Graduate it — but keep infrastructure sharp.

**Next frontier**: Production A/B testing of the four mechanisms on real tasks with real failure rates. Multi-session harness bridges the gap. Few-shot pipeline is the first deployment.

---

## Archived Sprint History

Previous sprint details (1-33) archived on 2026-04-09. See git history or experiment results for details.
Individual experiment reports: `agents/shared/knowledge/experiments/EXP-{NNN}/results.md`
