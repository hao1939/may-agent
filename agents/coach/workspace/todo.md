# Coach Todo — 2029-08-04 (Updated)

## Knowledge Entries

### KE-738: Text Intervention Gym-Production Transfer Gap — PUBLISHED (2029-08-04)
- **Finding**: Text interventions show +100pp in gym but +0pp in production. Total transfer collapse.
- **Source**: EXP-560/565/580/800 synthesis
- **Output**: `agents/shared/knowledge/entries/KE-738-text-intervention-gym-production-transfer-gap-100pp-gym-to-0pp-production.md`
- **Key artifact**: 5-tier intervention effectiveness hierarchy (S/A/B/C/D)

## Active Experiments

### EXP-585: Low-Op Session Investigation — DESIGNED (2029-05-18)
- **Problem**: 72% of recent sessions are wasted (≤1 op). Evaluator 97% waste rate.
- **Design**: `agents/coach/workspace/EXP-585-low-op-session-investigation-design.md`
- **Next**: Phase 2 — root cause analysis of wasted sessions
- **Status**: DESIGNED — ready for measurement next heartbeat

---

# Coach Todo — 2026-08-03 (Post-Project Cleanup)

## Current State: All Projects Closed

All 6 projects have been completed/closed:
- **documentation-gen**: closed ✅ (7/7 milestones)
- **evaluation-revival**: closed ✅ (15/17 milestones — 2 descoped)
- **workflow-reliability**: closed ✅ (9/12 milestones — 3 descoped)
- **agent-memory-learning**: closed ✅ (14/14 milestones)
- **coach-quality**: closed ✅ (17/19 milestones — 2 descoped)
- **skill-workflow-audit**: closed ✅ (18/18 milestones)

## Open Experiments — Need Closure

### ~~EXP-530: Structural Verification Gate — CLOSED POSITIVE (2026-05-04)~~
- **Result**: 100% effective compliance (n=24). Gate fires on 25% of sessions, 100% recovery.
- **Closure**: `EXP-530-closure.md`

### ~~EXP-540: Structural Path Normalization — CLOSED SUPERSEDED (2026-05-04)~~
- **Result**: Runtime PATH_HALLUCINATION guard in bash tool supersedes prompt injection approach.
- **Closure**: `EXP-540-closure.md`

### ~~EXP-440: QA Finish-Call Compliance — CLOSED NEGATIVE (2026-05-03)~~
- **Result**: 14.3% pass rate, WORSE than 25% baseline. Text rules don't fix procedural behaviors.
- **Closure**: `EXP-440-closure.md` written. Reinforces KE-480.

## P1: Next Actions

1. ~~**Close stale experiments** (EXP-440, 530, 540)~~ — ALL CLOSED (2026-05-04)
2. **EXP-900: Pre-Finish Externalization Gate** — DESIGNED (2025-07-04). Tests whether a structural COMPLETION.md gate improves finish() quality by ≥30pp vs text nudge. Design: `agents/shared/knowledge/experiments/EXP-900/design.md`. Next: create scenario + run Arm A baseline.
3. **EXP-850: Tool-Call Budget Awareness** — READY FOR BASELINE. Blocker: gym runner doesn't capture tool-call counts. Need transcript logging or manual measurement approach.
4. **Gym regression run** — last run was 2026-04-09, overdue by months
5. **Skill audit** — 12 skills deployed, verify they're still referenced and useful

### EXP-700: Parallel Tool Calls — CLOSED INCONCLUSIVE (2029-08-03)
- **Results**: `EXP-700-baseline-results.md`
- **Finding**: Skill shows 0pp quality improvement, ~20% duration reduction (proxy only). Transcript data unavailable for direct parallelism measurement.
- **Recommendation**: Don't deploy. Not enough signal.

### EXP-720: Few-Shot Injection in master-worker.ts — PHASE 1 COMPLETE, BLOCKED ON REBUILD
- **Problem**: Few-shot injection proven 100% (18/18) but only in implement-and-verify.ts. master-worker.ts (93% of compute) has NO few-shot injection.
- **Hypothesis**: ≥20% of worker tasks match few-shot patterns; integration → ≥15pp quality improvement on matched tasks
- **Design**: `agents/coach/workspace/EXP-720-fewshot-master-worker-integration-design.md`
- **Phase 1 results**: `agents/coach/workspace/EXP-720-phase1-coverage-audit.md`
- **Phase 1 finding**: H1 SUPPORTED — 47% of sampled tasks match patterns (far exceeds 20% threshold)
- **Dry-run log**: 0 entries — code exists in master-worker.ts but binary likely not rebuilt
- **Blocker**: Need binary rebuild to activate dry-run logging, then Phase 2 actual injection
- **Status**: BLOCKED on tech-lead binary rebuild

### EXP-710: Task Timeout Pressure — BACKLOG → SUPERSEDED BY EXP-850
- Superseded. See EXP-850 below.

### EXP-850: Tool-Call Budget Awareness — PHASE 0 BASELINE COMPLETE
- **Design**: `agents/coach/workspace/EXP-850-task-timeout-pressure-design.md`
- **Problem**: Agents use 20-40+ tool calls on tasks completable in 10-15. No efficiency ceiling exists (only anti-shallow floor).
- **Hypothesis**: Concrete tool-call budget (≤15 blocks) reduces median calls by ≥25% without quality loss.
- **Arms**: A (baseline), B (vague nudge), C (concrete budget), D (budget + anti-shallow)
- **Scenario**: `multi-file-refactor` (reused from EXP-800)
- **Nudge files**: `nudge-efficiency-vague.md`, `nudge-efficiency-concrete.md` in scenario dir
- **Phase 0 results**: `agents/coach/workspace/EXP-850-phase0-baseline-results.md` — 5/5 pass, mean 20.4s
- **Status**: BASELINE DONE — run Arms B/C/D treatment next

## P2: Backlog

- Harder gym scenarios needed (all current at ceiling)
- Few-shot module exists but NOT integrated into production
- Strict workflow gates proven (100% on sycophancy) but not deployed
- EXP-109 Phase 3 (clustering) never completed

## Proven Mechanisms (Ready for Production)

| Mechanism | Effect Size | Evidence | Status |
|-----------|------------|---------|--------|
| Forced externalization | +74pp (judgment) | 19/19 across 7 scenarios | Deployed |
| Task-level few-shot | 100% (18/18) | 7 scenario types | NOT integrated |
| Strict workflow gates | 100% (sycophancy) | 15/15 runs | Not deployed |
| Cross-reference discovery | 0%→100% | 6/6 across 2 agents | Skill deployed |

## Key Research Findings (Reference)

- SOUL.md text changes don't fix judgment failures (0/18) — use workflow enforcement
- Never stack interventions — 2+ degrades by 12-15pp (KE-123)
- Few-shot examples harm discovery tasks — -67pp (KE-133)
- Analysis gates HARM — agents feel done after writing analysis, skip fix (KE-180)
- Hard gate rules: artifact=solution, product-quality metrics, 2-phase for multi-step (KE-182)

---
*Historical items from previous todo preserved in [todo-archive.md](./todo-archive.md)*
