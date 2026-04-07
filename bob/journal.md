# Journal

## 2026-04-06 ~20:33
### EXP-041 Ablation Processing — Skill Causation Falsified, Knowledge Updates

Processed Coach's EXP-041 ablation study on wrong-fix-recovery. All 7 conditions (remove each of 5 skills individually + all skills) scored 6/6 — identical to baseline. Skills have zero measurable effect. The Apr 4→Apr 6 improvement (2/6→6/6) was NOT caused by any skill.

**Created**: KE-030 (Skill Ablation Falsifies Causal Attribution of Ceiling Shifts) — the core finding plus analysis of likely actual causes (framework changes, measurement noise, model updates).

**Updated**: 
- KE-027 was already marked FALSIFIED by Coach — verified it's correct
- H-055 (Self-Improvement Paradox): Added EXP-041 as direct evidence of the "attribution error variant" — system credited its own intervention for externally-caused improvement
- H-059 (Cadence Skill Effectiveness): Added note that EXP-041 reinforces the cadence/judgment distinction — all 5 ablated skills were judgment-type, matching H-059's prediction of zero effect
- H-019 (Skill Internalization): Added context note — premise that prompt-injected skills have detectable effects is now unconfirmed
- INDEX.md: Added KE-028/029/030 to verified table, new FALSIFIED section for KE-027, EXP-040/041 to experiments table

**Key insight**: This is a textbook example of the self-improvement paradox (H-055). The system deployed skills → observed improvement → attributed improvement to skills → but improvement was actually from framework/model changes. Without ablation controls, self-improving systems will systematically over-credit their own interventions. This is "Mode 1: Cosmetic Evolution" operating at the experimental-claims level, not just the text-accumulation level.

**Next experiment needed**: Binary-pinned baseline comparison (Apr 4 binary vs Apr 6 binary, both without skills) to isolate whether framework changes or measurement noise is the primary cause.

## 2026-04-06 ~20:03
### EXP-043 + EXP-039 Phase B Processing — Hypothesis Updates

Processed two major experiment results and created a new unifying hypothesis.

**EXP-039 Phase B finding**: LLM evaluator shows selective confirmation bias — agent self-narrative inflates quality scores for weak sessions (Q<0.6, Δ=-0.10, verdict change) but has zero effect on good sessions. This matches DD-532 (EvoSkills) prediction: confirmation bias from self-narrative is strongest when output quality is ambiguous.

**EXP-043 finding**: Strict two-phase classify-then-act workflow achieves 100% (9/9) across 3 sycophancy scenarios vs 40% (4/10) baseline. Hard gate + forced externalization is the mechanism. Aggregate p < 0.005.

**Key synthesis — H-085 (Forced Externalization)**: All four converging results (EXP-025 sycophants-dilemma 30→90-100%, EXP-043 ignore-deprecation 0→100%, EXP-043 skip-review-step 50→100%, KE-019 materialization 0→100%) share the same mechanism: forced externalization converts internal low-U judgment to structural high-U written commitment. This also connects to EXP-039 in reverse — removing self-narrative from evaluators is externalization applied to the evaluation pipeline.

**Updates made**:
1. H-009: +EXP-039 Phase B evidence, P(H) 0.82→0.85 (selective confirmation bias confirmed at LLM evaluator level)
2. H-085 (NEW): Forced externalization as general judgment mechanism. P(H)=0.78. Four testable predictions, strongest being P1 (does it generalize beyond sycophancy to escalation/security judgment?)
3. H-043: +forced externalization section as real-time knowledge form conversion (validates core prediction)
4. H-055: +EXP-043 connection — sycophancy judgment-action gap is the self-improvement paradox in miniature

**Questions answered**:
1. EXP-039 Phase B *nuances* H-009 — confirmation bias is real but quality-dependent, not universal
2. Yes — forced externalization is a single mechanism connecting sycophancy, materialization, and verification (H-085)
3. Highest-leverage next experiment: test externalization on non-sycophancy judgment (escalation scenarios) — if it generalizes, it becomes a foundational architectural principle

## 2026-04-05 ~19:49
### Design Analysis: Karpathy Knowledge Compiler vs. may-agent

Read Scout's research brief on Karpathy's "LLM Knowledge Bases" tweet. Compared against our full knowledge infrastructure: INDEX.md (300+ lines), 2,638 posts, 177K lines of deep-dives, knowledge-compile.ts, knowledge-health-check.ts, 10 topic indexes, 5 WKWA synthesis docs, KARPATHY-KB-PLAN, CONSUMABILITY-AUDIT, query-compounding convention.

**Key findings**:
1. We already implement ~70% of Karpathy's pattern at multi-agent scale — the architectural convergence is the strongest validation signal
2. Three real gaps: compilation aggressiveness (our indexes are stale), output-back-to-wiki (0% query compounding adoption), and semantic linting (our linter is syntactic only)
3. Our advantages (adversarial verification, experimental validation, hypothesis management, utilization theory H-043) go far beyond his single-user pattern
4. The query-compounding convention is a textbook KE-002 failure: text rule → 0% adoption. Needs structural enforcement
5. H-055 (89.4% additive self-modifications) means fully autonomous compilation would just add more without pruning — human review is essential

**Deliverable**: `agents/bob/workspace/ANALYSIS-karpathy-knowledge-compiler.md` — 306 lines, 6 sections per request + executive summary, meta-assessment, appendix. Five concrete next steps prioritized by effort/impact.

## 2026-04-03 ~09:20
### Comprehensive Hypothesis Review (Human Request)

Read all 31 active hypothesis files + 4 archived stubs + full INDEX.md per human request.

**Key findings**:
1. **Decision Topology theory chain (H-041→H-051)** is the crown jewel — internally consistent, empirically grounded at the core, but increasingly speculative at the extensions
2. **Early hypotheses (H-001→H-014)** need triage — 5 candidates for archiving (subsumed/premature/unfalsifiable)
3. **H-047 (Memory Lifecycle Gap)** is being validated in real-time — the knowledge base itself is growing without curation
4. **KE-002 is the most replicated finding** (4 null/negative experiments) — any new text-skill hypothesis should be evaluated against it first
5. **Theory-building is outpacing theory-testing** — many hypotheses are theoretical extensions of tested theory, creating a false sense of validation

**Recommendations**: Archive 5 stale hypotheses, consolidate H-033→H-048, reclassify H-036/H-0180 as design docs, promote H-044 to convention, test H-034 and H-047-P171 next.

**Artifact**: `workspace/hypothesis-review-2026-04-03.md`

## 2026-04-02 ~22:00
### Evaluator Calibration Shift Analysis

**Key Finding**: Discovered a step change in heuristic evaluator scoring at ~Apr 1 06:00 UTC:
- Before: 90% good rate (heuristic evaluator)
- After: 56% good rate — heuristic still never gives `needs_improvement`
- Cause: Evaluator fix commit `a6250b0` deployed

**Implication**: The "good rate decline" visible in dashboards is a measurement artifact, not quality decline. This is itself a Knowledge-Action Gap instance — the evaluator had criteria but a code bug prevented application.

**Data written to**: `workspace/evaluator-calibration-shift-analysis.md`

**INDEX updated**: Added 3 new posts (HB-0045 agent memory strategies, HB-0046 MCP vs CLI, HB-0047 agent frameworks).

**System stats** (16,820 evaluated sessions):
- Overall pass rate 93-96% (stable)
- amy-kimi is top performer: 97% pass, 79% good
- coder is weakest: 70% pass, 38% good
- The heuristic evaluator (98%+ of evaluations) is still more lenient than LLM evaluator (good: 54% vs 34%)

## 2026-04-01 15:00
### EXP-004: Plan-once-amend Skill Test — REFUTED

**Context**: Standing task is Research Agenda — test hypotheses one at a time. Analyzed all priority skills and their baselines to find the best testable gap.

**Analysis of testable hypotheses**:
- verification / verify-before-finish: baseline 6/7, failing check is product-level (reduce-has-initial), not behavioral. Skill unlikely to help.
- stale-approach-fixation: **already passes at baseline** (7/7). No gap to close.
- plan-once-amend: baseline 7/8, failing `handles-blocker-efficiently`. Skill directly targets this: "mark blocked, move on."
- incremental-context-loading: no baseline data available.

**Chose H-004** (plan-once-amend) because it had a clear gap, a skill that explicitly targets it, and existing baseline data.

**EXP-004 Results** (3 control + 3 treatment):
- Control: 8/8, 7/8, 7/8 → `handles-blocker-efficiently` passes 1/3 (33%)
- Treatment: 8/8, 7/8, 7/8 → `handles-blocker-efficiently` passes 1/3 (33%)
- **Verdict: NO EFFECT**

**Key insight → KE-006**: The skill teaches a reasoning pattern ("mark blocked and move on") but the failure is a tool-calling pattern (agent keeps trying read/find/ls for the missing file). Text instructions change what agents *think* but not what they *do* at the tool level. This extends KE-002.

**Next steps**:
- H-003 (verification skill) is the next experiment to run, but may face similar issue
- The more promising direction is framework-level intervention (tool retry limits, ENOENT hints)
- Consider proposing H-005: framework guard for repeated ENOENT → inject "mark blocked" system message

## 2026-03-29 03:35
### Sweep Part 2 Analysis & Next Experiment Planning

**Context**: Coach completed 16 of 33 remaining untested scenarios before the sweep process died (again). Combined results: **77/111 tested (69%), 54 PASS, 22 FAIL (29%)**.

**Key findings from sweep part 2:**
- 10 new PASS results — all procedural scenarios as expected (phantom-fix, premature-optimization, qa-overstrict-gate, etc.)
- 6 new FAIL results — all LOW priority (gap=1): partial-verification-trap (5/6), plan-once-amend (7/8), qa-severity-calibration (5/6 both variants), read-before-edit (10/11 both variants)
- No new HIGH or MED failures — confirms the frontier is stable

**Verify-after-edit v1 in production**: Confirmed deployed at `agents/coder/skills/verify-after-edit.md`. 60% convention pass rate (2x baseline). Prompting ceiling.

**Next experiment candidate**: `missing-prerequisite-detection` (3/5). Unlike the judgment scenarios (escalation, ambiguous-spec, stubborn), this IS procedural — agent needs to detect missing inputs and report blocked/partial instead of proceeding. A skill file teaching "check prerequisite existence → declare gap → BLOCK/ADAPT/CREATE" could shift this.

**Decision**: Hold on new experiments until sweep completes (34 scenarios untested). More failures may emerge that cluster with missing-prerequisite-detection. Delegated remaining 33 scenarios to Coach.

## 2026-04-13
### Synthesized Intelligent Delegation (Zone of Indifference)
Analyzed DeepMind's "Intelligent AI Delegation" framework (HB#308) and recent Amy-Kimi research. Identified a critical vulnerability: the **Zone of Indifference**, where sub-agents blindly execute dangerous instructions from a hallucinating main agent. This directly maps to MAST Failure Mode FM-2.6 (Reasoning-Action Mismatch).

### Formalized P104 Constructive Friction
To counter this, I formalized **Principle 104 (Constructive Friction)**: "Sub-agents must not be Yes Men."
- **The Law**: Agents must challenge requests that are Ambiguous, Destructive, or Constraint-Violating.
- **The Mechanism**: Rejection is cheaper than Rollback.
- **Artifact**: `agents/bob/workspace/synthesis/2026-04-13-intelligent-delegation.md`

### Next Steps
- Brief Tech-Lead to implement "Friction Wrappers" on high-risk tools (`bash`, `git`).
- Brief Coach to add "Intelligent Disobedience" exercises to the gym.

## 2026-04-12
### P85 P53 Validation
1. **Attempted P85 Implementation**: Identified that `op_budget` (Operation Budgets) was documented in `philosophy.md` but seemed missing from `manager.ts` (`grep` failed).
2. **Diagnosed Implementation State**: Discovered through `tech-lead` that P85 was actually **already implemented** internally (using `opBudget` camelCase), but the visibility was missing from the public API.
3. **Fixed P85 Visibility**: Delegated to `tech-lead` to add `opCount` and `opBudget` to `SessionInfo` in `types.ts` and `manager.ts`. This ensures `list` now shows operation counts, making the safety mechanism observable.
4. **Verified System Health**: `tsc` build is clean (89/89 files), and all tests passed (1068/1068). The system is stable and P85 compliant.

# Session 2026-04-06 23:33 (KE-033 Synthesis: Scale-Invariant Externalization)
- **Synthesized KE-033**: Forced externalization is scale-invariant — same mechanism (write analysis → gate → act) works at task level (our experiments: 40/40), harness level (meta-agent DD-560: 67→87%), and system level (theoretical)
- **Key insight**: meta-agent independently discovered forced externalization at the harness optimization level. The proposer reads failed traces → writes targeted fix → validates on holdout. This is exactly our ANALYSIS.md → gate → Phase 2 pattern, applied to system improvement instead of task judgment.
- **Connected DD-558 (Caveman)**: orthogonal to externalization (operates at L2 encoding vs L4/L5 judgment), but both force explicit structured representation of implicit content
- **Connected DD-559 (Hippo)**: hippo sleep consolidation is externalization at memory level — write → validate → persist mirrors write → gate → act
- **Updated INDEX.md**: Added KE-033, DD-560, CR-300 entries
- **Filed**: `agents/shared/knowledge/entries/KE-033-forced-externalization-scale-invariant.md`

# Session 2026-04-04 09:30 (Hypothesis Triage + EXP-025 Integration)
- **Updated PRIORITY-TRACKER** with EXP-025 partial results and 6 new hypotheses (H-060 to H-065)
- **Triaged H-060 to H-065**: 4 merge candidates (into existing hypotheses), 2 archive candidates. Net 0 new active hypotheses.
- **Updated INDEX**: Added DD#505-511, CR#279, protocol solidification cross-ref, H-060-065 entries, updated H-041 to "Partially Validated", updated EXP-025 status
- **Key insight**: The moratorium was violated exactly as CR#279 predicted. We need structural enforcement (reject hypothesis generation), not just policy statements.
- **H-041 refined formula**: Benefit = α × N_elim_failures - γ × N_ess_constrained - δ × N_workflow_overhead. The overhead term (δ) is the missing piece.

## 2026-04-07 ~06:33 — KE-041: Structural Constraint and Stigmergic Coordination

**Task**: Synthesize DD-589 (C-MADF causal cyber defense) and DD-594 (Ledger-State Stigmergy) into knowledge entry, connecting to KE-037, KE-040, H-085, H-043.

**Key insights**:
1. **Forced externalization IS causal action-space restriction** (DD-589). Both work by eliminating invalid options before the decision point, not by penalizing wrong choices within the full action space. This is why text rules (KE-002: 0/20) and reward shaping fail — they operate within the full space. Hierarchy of constraint: reward shaping < text rules < soft workflows < hard gates < full action-space restriction.
2. **Our knowledge base IS stigmergic coordination** (DD-594). Grassé's three patterns (marker-based, sematectonic, self-organizing) all map to our existing primitives. But we've designed it as a filesystem, not as an optimized stigmergic medium. Gap: our modifications are not legible, action-inducing, or configurable-decay.
3. **Behavioral Divergence Score** proposed: measure gap between unconstrained and constrained agent behavior as a runtime R-estimator. Connects H-041 + KE-037 + KE-036 into a unified runtime system.
4. **DD-594 predicts H-047 inverted-U from a second theoretical tradition** — persistent signals without decay create path dependence and signal accumulation. This provides a formal MECHANISM for H-056 (cooperative convergence).
5. **Candidate H-090** (stigmergic coordination advantage) proposed and deferred per moratorium.

**Deliverables**: KE-041 written (344 lines), INDEX.md updated (KE-041 + DD-589 + DD-594), todo.md session notes added.
**Convergence count**: 13th-14th independent convergences on structural enforcement thesis (from adversarial cybersecurity and biological coordination theory).
