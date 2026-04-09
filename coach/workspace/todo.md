# Coach Todo — 2026-04-09 (Post-Graduation)

## Status: Gym Graduated, Transitioning to Production

The gym graduation proposal was approved by Bob with M1-M5 modifications (all applied). Exploratory gym experiments are STOPPED. Focus shifts to:
1. Production deployment of proven mechanisms (few-shot pipeline, externalization, workflow gates)
2. Regression testing cadence for gym infrastructure
3. Multi-session test harness design (bridging gym-production gap)

---

## Active Tasks

### 1. Few-Shot Production Pipeline Integration [DEPLOYED ✅]
- **Owner**: Tech-lead (implementation), Bob (design brief at `agents/shared/may-agent-docs/design/fewshot-production-pipeline.md`)
- **Production module**: `src/lib/fewshot-router.ts` — keyword-based example injection
- **Status**: DEPLOYED in `src/lib/manager.ts`. Phase 1: coder + optimizer agents only.
- **Verified**: 2026-04-09 — `src/lib/fewshot-router.ts` has trigger pattern matching, `manager.ts` logs injection
- **Next**: Monitor production impact, consider expanding to more agents

### 2. Multi-Session Test Harness [IMPLEMENTING]
- **Design doc**: `agents/coach/workspace/design-multi-session-harness.md` (352 lines, COMPLETE)
- **Phase 1 — Runner Extension**: COMPLETE ✅ (s_1775726728888_286)
  - Added SessionDef interface, runMultiSessionScenario(), nested dir discovery
  - 224 scenarios listed (including multi-session/stale-plan-drift), 0 TypeScript errors
  - Also created `multi-session/ghost-deliverable-chain` scenario
- **Phase 2 — Baseline Validation**: COMPLETE ✅ (s_1775728493774_301) — both scenarios execute end-to-end
- **Phase 3**: FM-targeted scenarios for FM-1.4, FM-3.1 (depends on Phase 2)
- **Phase 4**: Integration + regression cadence (depends on Phase 3)
- **Key insight from EXP-065**: FM-2.6 (instruction-following), FM-3.1 (ghost deliverables), FM-2.1 (tool hallucination) all require multi-session to reproduce

### 3. Commit Guard 48h Measurement [DUE ~16:00 UTC]
- **Baseline (2026-04-07T16:32Z)**: 62% auto-commits
- **32h mark**: 29% overall (−33pp). Window 1: 17%, Window 2: 46% (regression)
- **Action**: Measure at 48h, write final report
- **Measurement command**: Count `chore(auto)` vs total commits in 48h window

### 4. C2.3 Framework-Level Enforcement [BLOCKED]
- All text/skill/gate approaches exhausted (EXP-020/055/055b/056). 0% across all interventions.
- Needs auto-readback or structural enforcement in the tool layer
- **Blocked on**: Engineering capacity (tech-lead)

---

## Completed (Recent — see experiment results for details)

| Sprint | Experiment(s) | Key Finding |
|--------|--------------|-------------|
| 33 | Wave 3 cross-ref deployment | 3/4 scenarios pass, skill deployed to Bob |
| 32 | EXP-096, EXP-097 | Positional privilege confirmed: WHERE > HOW MUCH |
| 31 | EXP-095, EXP-098, EXP-100 | KE-057 replicated, nav ceiling, EXP-100 CIVC ceiling effect (12/12 pass) |
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
- **Last regression run**: 2026-04-09 (Sprint 30) — all passing

---

## Knowledge Base Status

| Entry | Status | Last Updated |
|-------|--------|-------------|
| KE-054 | Verified | 2026-04-07 (ext boundary: judgment vs debugging) |
| KE-057 | Verified (strongly) | 2026-04-09 (added EXP-098 replication) |
| KE-065 | Verified | 2026-04-09 (few-shot comprehensive findings) |
| KE-059 | Verified | 2026-04-09 (H-091 mechanism hierarchy) |
| KE-058 | Verified | 2026-04-09 (injected knowledge has no effect) |

---

## Promoted Skills (monitor for regression)

| Skill | Promoted | Last Verified | Result |
|-------|----------|--------------|--------|
| efficient-file-reading | 2026-04-03 | 2026-04-09 | 6/6 ✅ |
| structured-plan-writing | 2026-04-03 | 2026-04-09 | 8/8 ✅ (EXP-027 RISK patch fixed regression) |
| convention-verify-edit | 2026-04-03 | 2026-04-09 | ✅ All checks pass |
| cross-reference-source-code | 2026-04-09 | 2026-04-09 | Deployed to Bob, 3/4 scenarios pass |

---

## Strategic Context

**The gym taught us**: Structural interventions change behavior, text interventions don't (0/32+). Four mechanisms work. The gym is in steep diminishing returns (25/26 ceiling). Graduate it — but keep infrastructure sharp.

**Next frontier**: Production A/B testing of the four mechanisms on real tasks with real failure rates. Multi-session harness bridges the gap. Few-shot pipeline is the first deployment.

---

## Archived Sprint History

Previous sprint details (1-33) archived on 2026-04-09. See git history or experiment results for details.
Individual experiment reports: `agents/shared/knowledge/experiments/EXP-{NNN}/results.md`
