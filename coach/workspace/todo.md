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

### 0. EXP-109: Production Observation Study [COMPLETE ✅ — ALL 3 PHASES]
- **Design**: `agents/shared/knowledge/experiments/EXP-109/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-109/results.md`
- **Knowledge**: KE-114 (behavioral archetypes spectrum)
- **Data**: 19,062 evaluations in may.db (4,295 non-heuristic with FM codes)
- **Completed**: Phase 1 (descriptive stats), Phase 2 (temporal analysis), Phase 3 (clustering)
- **H1 CONFIRMED**: 37.5% of "good" sessions have FM codes
- **H2 PARTIALLY CONFIRMED**: 6 archetypes found (k=6, silhouette=0.273 — spectrum, not types)
- **H3 CONFIRMED**: Quality trends cyclic W09-W14, not monotonic
- **H4 CONFIRMED**: Each agent has distinct FM fingerprint
- **Key archetypes**: Clean Performers (43%), FM-Heavy Workers (22%, #1 target), Silent Failures (19%, unfixable by current tools), Expensive Grinders (7%), Resilient Recoverers (7%), Deep Spiral (1%)
- **Follow-ups**: EXP-112 (Silent Failures deep dive), EXP-113 (FM-Heavy Workers targeted intervention)

### 0b. EXP-113: FM-Heavy Workers Targeted Intervention Analysis [COMPLETE ✅]
- **Design**: `agents/shared/knowledge/experiments/EXP-113/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-113/results.md`
- **Key findings**:
  - FM-2.1 is #1 cascade trigger (96 first-appearances, 2.38 subsequent FMs)
  - FM-2.6 most harmful per-instance (ΔQ=−0.109)
  - Dose-response cliff at FM≥4 (Q=0.478, delivery=40%)
  - Agent profiles are distinct: coach=FM-2.1(55%), optimizer=FM-2.2(51%)/FM-3.3(57%), may=FM-2.6(56%)
  - Coach is #1 improvement opportunity (34.9% of FM-Heavy Workers)
- **Follow-ups**: EXP-114 (FM-2.1 approach guard), EXP-115 (FM-2.2 completeness checklist)

### 0d. EXP-115: FM-2.2 Completeness Checklist Guard for Optimizer [COMPLETE ✅ — ALL 3 PHASES]
- **Design**: `agents/shared/knowledge/experiments/EXP-115/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-115/results.md`
- **Status**: All phases complete — **H1 CONFIRMED (+100pp on final scenario)**
- **Goal**: Structural intervention for FM-2.2 (incomplete deliverables) for optimizer
- **Target agent**: Optimizer (51% FM-2.2 rate among FM-Heavy Workers)
- **Gym results** (Phase 2):
  - Baseline: **0% pass rate** (0/3, all fail P4 identically)
  - Treatment: **100% pass rate** (3/3, checklist forced enumeration)
  - Effect: **+100pp** (far exceeds ≥20pp threshold)
  - No ceiling effect (0% baseline)
- **Mechanism**: Forced DELIVERABLES_CHECKLIST.md before execution prevents misinterpretation of ambiguous deliverables
- **Key finding**: Baseline failure is semantic (misinterpretation), not omission. Checklist forces explicit articulation → prevents drift.
- **Phase 3** (Production guard — COMPLETE):
  - Built `src/lib/tools/completeness-guard.ts` — `createCompletenessGuard()` factory
  - 31 tests passing in `test/completeness-guard.test.ts`
  - Wired into `src/lib/manager.ts` composeGuards() — optimizer-only, block mode
  - Monitors for DELIVERABLES_CHECKLIST.md in transcript before allowing finish(success)
- **Knowledge**: KE-121 (forced externalization prevents misinterpretation, not just omission)
- **Next**: Monitor production FM-2.2 rate. Re-measure at Apr 21 when N≥50 optimizer evals.

### 0f. EXP-116: Adversarial Framing Guard for Multi-Session Handoffs [VALIDATED ✅]
- **Design**: `agents/shared/knowledge/experiments/EXP-116/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-116/results.md`
- **Status**: ✅ VALIDATED by EXP-118 — all agents (coder, bob, optimizer) score 100% on both scenarios
- **What happened**: Originally suspected invalid due to `--agent coder` — but coder IS a registered agent (agents/coder/agent.json exists). EXP-118 confirmed with other agents. 100% baselines are real.
- **EXP-118 found**: All agents (bob, optimizer, may) also score 100% on these scenarios — ceiling is model-level, not an artifact of `coder` specifically
- **Knowledge entries**: KE-122 (Intervention Decay) SUPPORTED (mechanism uncertain), KE-123 (Over-Intervention Iatrogenesis) needs re-evaluation
- **Research line CLOSED**: Adversarial handoff scenarios at ceiling across all agents — no intervention can improve on 100%

### 0g. EXP-118: Cross-Agent Adversarial Handoff Baselines [COMPLETE ✅]
- **Design**: `agents/shared/knowledge/experiments/EXP-118/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-118/results.md`
- **Goal**: Verify whether EXP-116's 100% baseline was real or agent-specific
- **Key finding**: ALL agents (bob, optimizer, may) score 100% on both scenarios — the ceiling is system-wide, not coach-specific. 12/12 runs passed across all agents.
- **Implication**: Adversarial handoff scenarios are at ceiling. Research line CLOSED.

### 0h. EXP-119: Re-Run Adversarial Handoff Interventions [CANCELLED ❌]
- **Goal**: Was to repeat EXP-116 Phase 2 arms with `--agent bob`
- **Cancelled**: EXP-118 showed ALL agents at 100% baseline on both scenarios (not 11%/25% as the design assumed). No room for treatment improvement.
- **Adversarial handoff research line**: CLOSED — scenarios at ceiling across all agents due to model-level capability improvements since EXP-103.

### 0e. EXP-114: FM-2.1 Approach Decomposition Guard [COMPLETE ✅]
- **Status**: All phases complete
- **Goal**: Structural intervention for FM-2.1 (wrong approach) cascade failures
- **Target agent**: Coach (55% FM-2.1 rate)
- **Key finding**: 54.5% of FM-2.1 is tactical (tool schema errors), not strategic
- **Phase A (COMPLETE ✅)**: Tool Schema Guard prototype + deployment
  - Prototype: `agents/coach/workspace/tool-schema-guard-draft.ts`
  - Production: `src/lib/tools/tool-schema-guard.ts` (4 detectors: FINISH_MISSING_FIELDS, READ_WRONG_ARG, AGENTS_MISSING_ACTION, BASH_WRONG_ARG)
  - Wired into `composeGuards()` in `src/lib/manager.ts` — runs 2nd after empty-args-guard
  - Complements `empty-args-guard.ts` (which handles bash/read/edit/write empty args)
  - Results: `agents/shared/knowledge/experiments/EXP-114/results-phase-a.md`
- **Phase B (COMPLETE ✅)**: approach-validation-trap gym scenario for strategic FM-2.1
  - **Result**: INCONCLUSIVE — ceiling effect (100% baseline, 100% treatment)
  - Both conditions passed 3/3 — scenario too easy for coach
  - Forced APPROACH.md externalization is safe (no over-compliance risk) but benefit unproven
  - Results: `agents/shared/knowledge/experiments/EXP-114/results.md`
- **Phase C (DEFERRED)**: Path error mitigation — lower priority given ceiling findings

### 0d. EXP-110: FM-3.3 Commit Guard Production Impact [COMPLETE ✅]
- **Design**: `agents/shared/knowledge/experiments/EXP-110/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-110/results.md`
- **Knowledge**: KE-113 (commit guard recovery, not prevention)
- **Key finding**: Guard doesn't prevent FM-3.3 — it converts silent failures into recovered ones
  - FM-3.3 occurrence rate INCREASED +20.9pp (more visible)
  - FM-3.3 recovery rate INCREASED +51.3pp (13.4%→64.7%, p<0.001, h=1.12)
  - Unrecovered FM-3.3 rate unchanged (15.4%→13.6%, NS)
- **Gym vs production**: Complementary — gym measured commit laziness (−57pp), production measured verification recovery (+51pp)
- **Limitation**: Small N (88 post-guard evals, 92% bob). Re-run at 2 weeks (2026-04-21)
- **Next frontier**: Residual 35% unrecovered FM-3.3 = superficial verification. Needs semantic verification checks.
  - **→ EXP-123**: Verification-Depth Guard deployed (see below)

### 0i. EXP-124: Phase 0 Discovery for FM-1.3 Exhaustive Reading [COMPLETE ✅]
- **Design**: `agents/shared/knowledge/experiments/EXP-124/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-124/results.md`
- **Scenario**: `knowledge-base-navigation` (17-file nested KB → synthesis)
- **Treatment**: `knowledge-base-navigation-discovery` (2-phase: Phase 0 builds nav-map.md → Phase 1 synthesizes)
- **Baseline**: 3/3 at 5/5 product, 4/5 convention (reads 14-15 of 17 files, threshold ≤12)
- **Treatment**: 3/3 at 5/5 product, 6/6 convention (reads ≤10 files, nav-map created)
- **Effect**: +100pp on failing check (nav-doesnt-read-all-files: 0% → 100%)
- **Mechanism**: Externalized navigation map → selective reading. Phase 0 converts "navigate and read everything" into "navigate first, read selectively."
- **Recommendation**: Apply Phase 0 discovery to workflows with unfamiliar 10+ file directory structures

### 0l. EXP-126: Environmental Hints Replication Study [COMPLETE ✅ — NULL RESULT]
- **Design**: `agents/shared/knowledge/experiments/EXP-126/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-126/results.md`
- **Knowledge**: KE-131 (environmental hints null result replication)
- **Goal**: Replicate EXP-122 environmental hints finding with proper controls (N=24)
- **Result**: Baseline 58% vs Treatment 50% (p = 1.00, Cohen's h = 0.167 — negligible)
- **Confound**: Last 4 treatment runs used 5-min timeout (vs 3-min default). Clean comparison: 58% vs 25% (treatment worse, p = 0.197, NS)
- **Conclusion**: Environmental hints have no positive effect. EXP-122's "100% pass rate" was a corrupted-environment artifact. Hints may actually hurt by consuming agent attention/time.
- **Research line CLOSED**: Environmental hints are not a viable intervention mechanism.

### 0n. EXP-128: Channel 3 Boundary Conditions — Detection Coverage Hypothesis [COMPLETE ✅ — H-128 REJECTED]
- **Design**: `agents/shared/knowledge/experiments/EXP-128/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-128/results.md`
- **Hypothesis**: H-128 — Ch3 few-shot effectiveness depends on detection step coverage, not just response coverage
- **Result**: All arms ≈ 0%. Arm A 0/6, Arm B 0/6, Arm C 0/6 (overall pass)
- **Contradiction detected**: Arm A 0%, Arm B 17% (1/6), Arm C 17% (1/6) — noise, not signal
- **Conclusion**: Detection coverage is NOT the moderator. Task is immune to Ch3 regardless of content quality.
- **Key insight**: Coding momentum + misleading success signals (tests pass) overwhelm any few-shot content
- **Successor hypothesis needed**: Action momentum × success signal misdirection as the true Ch3 moderator

### 0o. EXP-130: Few-Shot on Discovery Task [COMPLETE ✅ — IATROGENIC RESULT]
- **Design**: `agents/shared/knowledge/experiments/EXP-130/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-130/results.md`
- **Hypothesis**: H-099 P-099d — Few-shot examples cannot teach discovery (irreducible)
- **Result**: Baseline 100% (6/6) vs Treatment 33% (2/6) — **few-shot HURTS discovery by -67pp**
- **Statistics**: Fisher's exact p = 0.030 (one-sided), p = 0.061 (two-sided)
- **Mechanism**: Template-following displaces open exploration. Agent follows example pattern but misses peripheral files (todo, priority-tracker, index) that require independent discovery.
- **Key insight**: Few-shot creates a "template ceiling" — agent stops exploring once template steps are done. This is the first iatrogenic intervention in the program.
- **H-099 update**: P(H) 0.78 → 0.90. All three channels (Ch1, Ch2, Ch3) now tested on discovery — all fail. Only time (P-099a) remains.
- **Knowledge**: KE-132 extended (Ch3 fails on discovery via different mechanism than coding momentum)

### 0m. EXP-127: Channel Separation Direct Test [COMPLETE ✅ — LANDMARK RESULT]
- **Design**: `agents/shared/knowledge/experiments/EXP-127/design.md`
- **Results**: `agents/shared/knowledge/experiments/EXP-127/results.md`
- **Knowledge**: KE-129 (forced ext. only reliable channel), KE-130 (text delivery fails for judgment)
- **Goal**: Isolate Channel 1/2/3 effects on contradictory-requirements (4 arms × 6 runs)
- **Result**: Baseline 0%, Arm A (Ch1) 0%, Arm B (Ch3) 0%, Arm C (Ch2) 100% — starkest result in knowledge base
- **Statistics**: Ch2 vs pooled others p = 0.0000074. Fisher's exact all pairwise p = 0.0011.
- **Confound**: `contradiction-detection.md` skill was already in production coder — all runs got Ch1 content. Strengthens Ch1 finding (0/18), prevents clean Ch3-only test.
- **Key insight**: Channel 2 works through mechanism (forcing analysis), not content. 0/24 text-delivered runs succeeded.
- **Recommendation**: Remove `agents/coder/skills/contradiction-detection.md` (0/18 effect, ~500 tokens dead weight)
- **H-098 update**: P(H-098) 0.78 → 0.80 (Ch2 confirmed, Ch3 model needs refinement)

### 0k. Phase Evaluation Analysis — Production Data Deep Dive [COMPLETE ✅]
- **Report**: `agents/coach/workspace/phase-evaluation-analysis.md`
- **Status**: Analysis complete — 3 critical bugs found, real gap quantified
- **Finding 1**: Scale mismatch — LLM evaluator uses 0-1, heuristic uses 1-5, threshold Q≥3 makes LLM 0% pass (P0 BUG)
- **Finding 2**: Evaluation selection bias — root→heuristic (98% pass), child→LLM (26% "good"). Phase sessions always child.
- **Finding 3**: Duplicate evaluations — 100% of pipeline P1/P2 pairs get IDENTICAL scores (keyed by agent name, not session ID)
- **Real gap**: 26% "good" (phase) vs 45% "good" (non-phase) when controlling for evaluation method — 19pp, not 70pp
- **Root causes**: Phase boundary violation (47%), verification gaps (81%), P2-has-nothing-to-do (19%)
- **Recommendations**: (1) Harmonize quality scales P0, (2) Per-session evaluation keys P0, (3) Rethink phase boundaries P1

### 0j. EXP-123: Verification-Depth Guard — Superficial Verification Block [DEPLOYED ⏳]
- **Design**: `agents/shared/knowledge/experiments/EXP-123/design.md`
- **Implementation**: `src/lib/tools/verification-depth-guard.ts` (363 lines)
- **Tests**: `src/lib/tools/verification-depth-guard.test.ts` (18/18 pass)
- **Status**: Phase 2 — guard deployed to production for all agents
- **Goal**: Address the 35% residual unrecovered FM-3.3 (EXP-110 finding)
- **Detects 3 patterns**:
  - T1: Git commands on gitignored paths (agents/) — zero information gain
  - T2: Missing post-write verification — writes/edits without subsequent read/test
  - T3: tsc-only verification — syntax-only check on behavioral bugs (warn-only)
- **Phase 1 result**: CEILING EFFECT — gym scenarios (compound-edit-verification, convention-verify-edit, assertion-without-evidence) all pass baseline; guard never fires
- **Phase 2**: Production observation — guard wired into composeGuards() for all agents
  - Kill switch: `DISABLE_VERIFICATION_DEPTH_GUARD=1`
  - Measurement: Wait 48-72h, then analyze fire rate, true positive rate, recovery rate
- **Next**: Analyze production impact on 2026-04-13

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
| — | EXP-127 | **LANDMARK**: Ch2 (forced ext.) 100%, Ch1 0%, Ch3 0% on contradictory-requirements. Only structural gates work for judgment. KE-129, KE-130 |
| — | EXP-126 | **NULL**: Environmental hints 50% vs baseline 58% (p=1.0). Hints don't help, may hurt. KE-131 |
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
| KE-113 | Active | 2026-04-10 (commit guard production impact — recovery not prevention) |
| KE-129 | Active | 2026-04-10 (forced ext. only reliable channel for judgment — EXP-127) |
| KE-130 | Active | 2026-04-10 (text-channel content fails for contradiction detection — EXP-127) |
| KE-131 | Active | 2026-04-10 (environmental hints null result replication — EXP-126) |

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
