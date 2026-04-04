# Knowledge Index

All knowledge in the system, organized by confidence level.

> **NEW: Topic Index available** — 10 navigable topic pages covering all major research areas.  
> See [library/topics/INDEX.md](library/topics/INDEX.md) for guided reading paths.

> **NEW: "What We Know About" syntheses** — definitive practical guides distilling our experiments into actionable principles.  
> See [synthesis/](synthesis/) for WKWA-001 (Behavioral Intervention), WKWA-002 (Decision Topology), WKWA-003 (Self-Improvement Limits), **WKWA-004 (Memory Control Loop)**.  
> **Query Compounding Convention**: When you investigate a question, file findings per [CONVENTION-query-compounding.md](synthesis/CONVENTION-query-compounding.md).
>
> **Hypothesis Priority Tracker**: [hypotheses/PRIORITY-TRACKER.md](hypotheses/PRIORITY-TRACKER.md) — compact view of what's tested, what needs testing, and the experiment queue. **No new hypotheses until 5 more are tested.**

## Verified (tested with evidence)

| ID | Claim | Evidence | Location |
|----|-------|----------|----------|
| KE-001 | Context learning works for environmental knowledge only | EXP-001 (A/B 3/3) | knowledge/entries/KE-001.md |
| KE-002 | Text rules don't fix judgment failures | 18 coach experiments, auto-evolve 0/5 | knowledge/entries/KE-002.md |
| KE-003 | Rich delegation context reduces ops by 47% | EXP-002 (POC n=5) | knowledge/entries/KE-003.md |
| KE-004 | Guards are brittle, use context.md instead | 3 guard reverts | knowledge/entries/KE-004.md |
| KE-005 | QA rubber-stamps at 14% detection | DB analysis | knowledge/entries/KE-005.md |
| KE-006 | Skills targeting reasoning patterns don't change tool-calling patterns | EXP-004 (A/B 1/3 vs 1/3) | knowledge/entries/KE-006.md |
| KE-007 | Workflow enforcement (Method #15) is the only reliable behavioral intervention | 55 experiments, 4 promoted | knowledge/entries/KE-007.md |
| KE-008 | Heartbeat step restructuring causes regression | 4/4 negative across 2 agents | knowledge/entries/KE-008.md |
| KE-009 | Negative examples in LESSONS.md have zero effect | 8 experiments, 0/8 improvement | knowledge/entries/KE-009.md |
| KE-010 | Most gym scenarios hit ceiling — agents pass at baseline | 15+ ceiling observations, 106 scenarios | knowledge/entries/KE-010.md |
| KE-011 | Knowledge files are passive — agents skip them in oneshot mode | 3 experiments, Method #6 | knowledge/entries/KE-011.md |
| KE-012 | Lab-fork null-patch test confirms infrastructure validity | Controlled zero-change test | knowledge/entries/KE-012.md |
| KE-013 | Task boundedness is the primary driver of delegated session quality | EXP-007 Phase 1 (n=116 call, 15.8K all-time) | knowledge/entries/KE-013.md |
| KE-015 | Decision topology (eliminable ratio R) predicts workflow effectiveness | EXP-009 (464 sessions), EXP-011 (ρ=0.95), EXP-013 (0%→100%), EXP-015 (0%→100%), EXP-016 (20 pairs, 80% accuracy), EXP-008 (null), DD#484, Anthropic | knowledge/entries/KE-015.md |
| KE-018 | Environmental nudges (L4) match text skills (L3) for behavioral change | EXP-023 (n=3 per arm): nudge 81% vs skill 78% vs control 52%. Simpler, faster, equally effective. | knowledge/entries/KE-018.md |
| KE-019 | Sycophancy requires materialization gates (L5), not nudges or workflows | EXP-024 (n=2 per arm): L4 nudge 0% effect, workflow 0% effect, strict workflow+gate 0%→100%. Judgment failures need forced self-commitment. | knowledge/entries/KE-019.md |

## Adopted (in use, not experimentally verified)

### Skills (41)
Each skill is an untested hypothesis: "doing X improves agent behavior in situation Y."

| Skill | Hypothesis | Testable? | Location |
|-------|-----------|-----------|----------|
| evidence-over-narrative | Trusting runtime evidence over narrative prevents phantom fixes | Yes — gym scenario exists | skills/evidence-over-narrative/SKILL.md |
| budget-before-act | Turn-budget awareness reduces FM-3.1 non-delivery | Yes — measure delivery rate | skills/budget-before-act/SKILL.md |
| coder-edit-discipline | Reading before editing prevents wrong edits | Yes — read-before-edit scenario | skills/coder-edit-discipline/SKILL.md |
| ... | (38 more — see skills/LIBRARY.md for full list) | | |

### Workflows (8)
Structural enforcement patterns. More reliable than text rules (KE-002).

| Workflow | Purpose | Verified? | Location |
|----------|---------|-----------|----------|
| two-phase | Separate analysis from action | Gym: 92-97% pass, EXP-013: 0%→100% | workflows/two-phase.ts |
| code-review-loop | Coder → QA → fix cycle with context passing | Not tested in production | workflows/code-review-loop.ts |
| evidence-gate | Check briefs for evidence before sending | Gym: 5/5 pass, 6/6 reject | workflows/evidence-gate.ts |
| context-learn | Extract knowledge from session transcripts | Deployed, LLM merge | workflows/context-learn.ts |
| reviewed-delivery | Evidence-gate before sending briefs | Not tested | workflows/reviewed-delivery.ts |
| predict-then-verify | Predict outcome, then verify | Not tested | workflows/predict-then-verify.ts |
| skill-lifecycle | Install/test/promote skills | Not tested | workflows/skill-lifecycle.ts |
| gated-exploration | Soft workflow for exploratory tasks — gate-based validation without step prescription | EXP-012 ready | workflows/gated-exploration.ts |

### Conventions
Team behavioral rules. Adopted by convention, not verified by experiment.

| Document | Content | Lines | Testable? |
|----------|---------|-------|-----------|
| common-sense.md | How we work, think, communicate | 14 | Some items map to gym scenarios |
| CONVENTIONS.md | Behavioral conventions (C1-C13) | 140 | Each convention is testable |

## Theoretical (proposed, untested)

| Document | Content | Lines | Status |
|----------|---------|-------|--------|
| philosophy.md | Principles P1-P147+ | 323 | Many never tested. KE-002 refuted text-rule principles. |
| best-practices.md | Agent hardening practices | 73 | Overlap with skills |
| patterns/patrol.md | Patrol pattern | ~30 | Untested |
| patterns/transient-skill.md | Transient skill pattern | ~30 | Untested |

## Hypotheses (specific testable claims)

> **Navigation guide**: Start with SYNTH-001 for the unified theory. Hypotheses below are grouped by theme.
> - **Active hypotheses**: `knowledge/hypotheses/` (17 files)
> - **Design proposals**: `knowledge/hypotheses/design-proposals/` (4 files: H-036, H-037, H-045, H-050)
> - **Research notes**: `knowledge/hypotheses/research-notes/` (2 files: H-033, H-060)
> - **Archived**: `knowledge/hypotheses/archive/` (refuted, superseded, or insufficient evidence)
> **Last curated**: 2026-04-04. 30→17 active hypotheses (13 reclassified: 7 archived, 4 to design-proposals, 2 to research-notes). See REVIEW-2026-04-04-honest-assessment.md for rationale.

### Decision Topology Theory (SYNTH-001)
The core theory chain. Start with SYNTH-001 (`library/deep-dives/synth-decision-topology-theory-unified.md`), then individual hypotheses only if needed.

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| H-041 | **Decision Topology** — eliminable ratio R predicts workflow effectiveness (ρ=0.95). **Updated 2026-04-04**: Includes H-044 (Asymmetric Default) as design principle | Proposed (8+ sources, KE-015) | knowledge/hypotheses/H-041-decision-topology.md |
| ~~H-042~~ | ~~Topology Evolution~~ — **ARCHIVED** (untested, speculative extensions of H-041, 2026-04-04) | Archived | knowledge/hypotheses/archive/H-042-topology-evolution.md |
| H-043 | Knowledge Utilization Bottleneck — U = P(exists) × P(access) × P(applies) bounds R evolution. **Updated 2026-04-04**: Four-form hierarchy (structural > cadence > environmental > judgment) per H-059 | Proposed (5+ sources, updated by EXP-022) | knowledge/hypotheses/H-043-knowledge-utilization-bottleneck.md |
| ~~H-044~~ | ~~Asymmetric Default~~ — **MERGED into H-041** (2026-04-04) | Archived | knowledge/hypotheses/archive/H-044-asymmetric-default.md |
| ~~H-045~~ | ~~Sprint Contract Pattern~~ — **RECLASSIFIED as design proposal** (2026-04-04) | Design Proposal | knowledge/hypotheses/design-proposals/H-045-sprint-contract-pattern.md |
| H-039 | Decomposition Bottleneck — MAS ceiling set by orchestrator decomposition skill | Proposed (4+ sources) | knowledge/hypotheses/H-039-decomposition-bottleneck.md |
| ~~H-046~~ | ~~Coupled Resource Channels~~ — **ARCHIVED** (no empirical connection, 2026-04-04) | Archived | knowledge/hypotheses/archive/H-046-coupled-resource-channels.md |
| H-059 | **Cadence Skill Effectiveness** — temporal constraints (when/how-often) bypass judgment barrier. Cadence skills achieve U ≈ 0.4-0.6 vs judgment skills U ≈ 0.03-0.05. First text-based skill to break 0/20 barrier | Empirically Supported (EXP-022, n=3) | knowledge/hypotheses/H-059-cadence-skill-effectiveness.md |

### Memory & Knowledge Management
> **See also**: [WKWA-004](synthesis/WKWA-004-memory-control-loop.md) — Complete Memory Control Loop synthesis (DD#499-504)

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| H-047 | Memory Lifecycle Gap — no forgetting → inverted-U knowledge utilization. **Updated 2026-04-04**: Includes H-049 (Adaptive Memory Curation) | Proposed (DD#486 + H-043 + MemSkill) | knowledge/hypotheses/H-047-memory-lifecycle-gap.md |
| ~~H-048~~ | ~~Dynamic Topology Optimization~~ — **ARCHIVED** (premature optimization, 2026-04-04) | Archived | knowledge/hypotheses/archive/H-048-dynamic-topology-optimization.md |
| ~~H-049~~ | ~~Adaptive Memory Curation via Skill Evolution~~ — **MERGED into H-047** (2026-04-04) | Archived | knowledge/hypotheses/archive/H-049-adaptive-memory-curation-skill-evolution.md |
| ~~H-050~~ | ~~Structured Abstention~~ — **RECLASSIFIED as design proposal** (2026-04-04) | Design Proposal | knowledge/hypotheses/design-proposals/H-050-structured-abstention.md |
| ~~H-051~~ | ~~Abstention Rate as Runtime R-Estimator~~ — **ARCHIVED** (depends on untested H-050, 2026-04-04) | Archived | knowledge/hypotheses/archive/H-051-abstention-r-estimator.md |

### Agent Architecture & Behavior

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| ~~H-032~~ | ~~Triadic Cognitive Architecture~~ — **MERGED into H-033** (2026-04-04) | Archived | knowledge/hypotheses/archive/H-032-triadic-cognitive-architecture.md |
| ~~H-033~~ | ~~Adaptive Reasoning Framework — DAST + TCA fusion~~ — **RECLASSIFIED as research note** (2026-04-04) | Research Note | knowledge/hypotheses/research-notes/H-033-adaptive-reasoning-framework.md |
| H-034 | Session fragility — exponential success decay on long tasks | Active | knowledge/hypotheses/H-034-session-fragility.md |
| ~~H-036~~ | ~~Claude Code harness patterns~~ — **RECLASSIFIED as design proposal** (2026-04-04) | Design Proposal | knowledge/hypotheses/design-proposals/H-036-claude-harness-patterns.md |
| ~~H-037~~ | ~~L3 Patrol Pattern~~ — **RECLASSIFIED as design proposal** (2026-04-04) | Design Proposal | knowledge/hypotheses/design-proposals/H-037-patrol-pattern.md |
| H-038 | Transient Skills — test-time training via strategy files | Untested | knowledge/hypotheses/H-038-transient-skill.md |
| ~~H-010~~ | ~~Error amplification scales with agent sophistication~~ — **ARCHIVED** (unfalsifiable as stated, 2026-04-04) | Archived | knowledge/hypotheses/archive/H-010-error-amplification.md |

### System Design & Coordination

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| ~~H-006~~ | ~~Delegation quality asymmetry~~ — **ARCHIVED** (subsumed by H-014, 2026-04-04) | Archived | knowledge/hypotheses/archive/H-006-delegation-asymmetry.md |
| ~~H-007~~ | ~~Heartbeat coordination tax~~ — **MERGED into H-011** (2026-04-04) | Archived | knowledge/hypotheses/archive/H-007-heartbeat-coordination-tax.md |
| ~~H-011~~ | ~~Coordination phase transition at ~50% capacity~~ — **ARCHIVED** (untestable threshold, 2026-04-04) | Archived | knowledge/hypotheses/archive/H-011-coordination-phase-transition.md |
| ~~H-012~~ | ~~Persona drift coordination cost~~ — **MERGED into H-011** (2026-04-04) | Archived | knowledge/hypotheses/archive/H-012-persona-drift-coordination-cost.md |
| H-014 | Performance gap is a delegation quality problem | Proposed (partial support) | knowledge/hypotheses/H-014-delegation-quality-gap.md |
| H-053 | **Workflow Adoption Decay** — proven interventions self-extinguish in ~7 days without structural enforcement | Proposed (strong empirical) | knowledge/hypotheses/H-053-workflow-adoption-decay.md |
| H-054 | **Evaluation R-Ceiling** — LLM judge accuracy has fundamental limit determined by Decision Topology R of the evaluation decision | Proposed (6 sources) | knowledge/hypotheses/H-054-evaluation-r-ceiling.md |
| H-055 | **Self-Improvement Paradox** — self-preservation bias + evaluation R-ceiling + interaction blindness make autonomous self-evolution structurally unreliable. **P2 CONFIRMED**: 89.4% additive self-modifications, zero self-initiated deletions in 30 days | Empirically Supported (DD#496, P2 audit) | knowledge/hypotheses/H-055-self-improvement-paradox.md |
| H-056 | **Cooperative Convergence** — independent self-preservation bias compounds across agents into system-level resistance to change, without coordination or intent. Three reinforcement loops: citation entrenchment, vocabulary lock-in, consensus-as-validation. **P4 CONFIRMED**: 85% untested, 0% revised, 17:1 accumulation-to-resolution ratio | Empirically Supported (P4 audit) | knowledge/hypotheses/H-056-cooperative-convergence.md |
| ~~H-057~~ | ~~Misalignment Amplification~~ — **ARCHIVED** | Archived | knowledge/hypotheses/archive/H-057-misalignment-amplification.md |
| H-058 | **Frustration-Triggered Topology Rewrite** — when agents face impossible/repeatedly-failed tasks, internal desperation-like activations trigger abrupt policy shifts to proxy-satisfying behavior (creative workarounds, cosmetic compliance). Mechanistic bridge from cognitive distortion to behavioral misalignment | Proposed (HB-0047 × DD#496 × KE-015 × H-055) | knowledge/hypotheses/H-058-frustration-topology-rewrite.md |
| ~~H-0180~~ | ~~MCP vs CLI architecture~~ — **ARCHIVED** (peripheral to core research, 2026-04-04) | Archived | knowledge/hypotheses/archive/H-0180-mcp-vs-cli-architecture.md |

### Untested (Simple Claims)

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| H-001 | Adversarial QA framing increases detection from 14% to >30% | Untested | knowledge/hypotheses/H-001.md |
| H-002 | Weaker models benefit more from context.md | Untested | knowledge/hypotheses/H-002.md |
| ~~H-005~~ | ~~Skill utilization self-locking~~ — **ARCHIVED** (absorbed into H-059, 2026-04-04) | Archived | knowledge/hypotheses/archive/H-005.md |
| H-009 | Evaluator drift is our biggest unmonitored risk | Proposed | knowledge/hypotheses/H-009-evaluator-drift.md |

### Archived (refuted or superseded — see `knowledge/archive/hypotheses/`)

| ID | Hypothesis | Reason | Archive |
|----|-----------|--------|---------|
| H-003 | Verification skill improves gym pass rate | **Effectively refuted** by KE-002 (0/20), EXP-008 (0% effect) | knowledge/archive/hypotheses/H-003.md |
| H-004 | Plan-once-amend skill | **Refuted** by EXP-004 | knowledge/archive/hypotheses/H-004.md |
| H-008 | Static skills are a performance ceiling | **Premise weakened** by KE-002 — versioning assumes non-zero baseline effect | knowledge/archive/hypotheses/H-008-skill-versioning.md |
| H-013 | Information regime performance gap | **Weakly refuted** by EXP-006 (r≈0) | knowledge/archive/hypotheses/H-013-information-regime-performance-gap.md |
| H-035 | Boundedness Principle | **Superseded** by H-041 (Decision Topology) | knowledge/archive/hypotheses/H-035-boundedness-principle.md |
| H-040 | Reliability Inversion | **Superseded** by H-041 (Decision Topology) | knowledge/archive/hypotheses/H-040-reliability-inversion.md |

## Experiments

| ID | Tests | Status | Verdict | Location |
|----|-------|--------|---------|----------|
| EXP-001 | Context learning A/B | Complete | Supported | knowledge/experiments/EXP-001/ |
| EXP-002 | Delegation context POC | Complete | Supported | knowledge/experiments/EXP-002/ |
| EXP-003 | Verification skill on verify-before-finish | Designed | — | knowledge/experiments/EXP-003/ |
| EXP-004 | Plan-once-amend skill on blocker handling | Complete | **No effect** | knowledge/experiments/EXP-004/ |
| EXP-005 | Worked examples break skill self-locking (H-005) | Designed | — | knowledge/experiments/EXP-005/ |
| EXP-006 | Information regime correlation analysis (H-013) | Complete | **Not supported** (r≈0) | knowledge/experiments/EXP-006/ |
| EXP-007 | Delegation quality gap analysis (H-014) | Phase 1 Complete | **Partially supported** — task boundedness, not session kind | knowledge/experiments/EXP-007/ |
| EXP-008 | Verify-after-edit skill effectiveness | Complete | **No effect** (80% both arms, confirms KE-002) | knowledge/experiments/EXP-008/ |
| EXP-009 | Workflow effectiveness analysis (observational, 464 sessions) | Complete | **Mixed** — 6.8x fewer errors, helps structured tasks, hurts exploratory | knowledge/experiments/EXP-009/ |
| EXP-010 | Workflow enforcement vs text-based skills (controlled) | Designed | — (awaiting execution) | knowledge/experiments/EXP-010/ |
| EXP-011 | Decision topology prediction accuracy (retrospective + prospective) | Phase 1 Complete | **Supported** — eliminable ratio R predicts workflow benefit/cost (4/4, ρ=0.95) | knowledge/experiments/EXP-011/ |
| EXP-012 | Gated exploration soft workflow for optimizer (H-041 P3) | Ready | — (awaiting execution) | knowledge/experiments/EXP-012/ |
| EXP-013 | Workflow enforcement for escalation (two-phase vs none) | **Complete** | **0%→100% with workflow** (R≈0.80, n=6) → KE-015 | knowledge/experiments/EXP-013/ |
| EXP-014 | incremental-context-loading scorer bug fix | **Complete** | Infrastructure fix — scorer bug, not agent behavior | knowledge/experiments/EXP-014/ |
| EXP-015 | Workflow enforcement for tool avoidance (npx) | **Complete** | **0%→100% with workflow** (R≈0.90, n=5) → KE-007, KE-015 | knowledge/experiments/EXP-015/ |
| EXP-016 | Cross-scenario meta-analysis of workflow effectiveness (20 pairs) | **Complete** | **80% prediction accuracy for Decision Topology**. Workflows help 40% (+32%), hurt 40% (-13%), neutral 20%. Ceiling-regresses pattern. Intra-phase boundary discovered. → KE-015 | knowledge/experiments/EXP-016/ |
| EXP-017 | Classify-then-act skill vs fixer-prior (text injection) | **Complete** | **DISPROVEN** — 0% effect. 0/19 consecutive text injection failures. Strongest possible text skill (protocol phases, hard rules, named anti-patterns) had zero impact. Closes the door on text-based skills for judgment failures. | knowledge/experiments/EXP-017/ |
| EXP-018 | Structured-plan-writing skill on plan-once-amend | **Complete** | **COUNTER-PRODUCTIVE** — Skill caused timeout and missed deliverables (8/8→6/8). First actively harmful text injection. Over-compliance with 5-step planning protocol consumed budget. 0/20 text injection record with one net-negative. | knowledge/experiments/EXP-018/ |
| EXP-019 | Investigate-and-fix skill on investigate-fix-pattern | **Complete** | **DISPROVEN** — 0/4 reproduce-first, zero delta from baseline. 20th consecutive text-injection failure. Workflow variant: 0%→100%. | knowledge/experiments/EXP-019/ |
| EXP-020 | Workflow effectiveness observational study (n=5,265) | **Complete** | **15x lower error rate** (1.5% vs 23.2%), +26.9pp completion. Code-review-loop: 97% completion. But workflow usage declined to 0% by Apr 2-3. | knowledge/experiments/EXP-020/ |
| EXP-022 | **Materialize-findings cadence skill** (n=3 per arm) | **Complete** | **BREAKTHROUGH** — First text-based skill to break 0/20 barrier. Early materialization: 0%→67%, product quality: 67%→100%, speed: 44% faster. Cadence rules work where judgment rules don't. → KE-017, H-059 | knowledge/experiments/EXP-022/ |
| EXP-023 | **Environmental nudge for materialization (L4)** (n=3 per arm) | **Complete** | Pre-created findings.md template achieves 81% checks (vs 78% skill, 52% control). L4 matches L3. Simpler/faster but less targeted on timing. → KE-018 | knowledge/experiments/EXP-023/ |
| EXP-024 | **Sycophancy resistance: nudge vs workflow vs strict** (n=2 per arm) | **Complete** | **CRITICAL FINDING**: L4 nudge (0% effect), regular workflow (0% effect), strict workflow with materialization gate (0%→100%). Sycophancy requires L5 (forced self-commitment). → KE-019 | knowledge/experiments/EXP-024/ |
| EXP-025 | **Prospective Decision Topology validation** (asymmetric design: non-ceiling + ceiling regression) | Redesigned | Coach found 12/20 ceiling. Bob redesigned: Part A tests HELPS on non-ceiling, Part B tests REGRESSION on ceiling. Awaiting Phase 1 baselines. | knowledge/experiments/EXP-025/ |

## Operational (not knowledge — reference only)

| Document | Purpose |
|----------|---------|
| focus-tasks.md | Current work priorities |
| roadmap.md | Long-term direction |
| SIGNALS.md | Operational signals between agents |
| daily-digests/ | Historical daily summaries |
| bulletins | Operational notices |
| tasks/ | Task templates |

## What Should Happen

1. **Skills should be hypotheses.** Each skill claims "X improves Y." Test it in the lab. If verified → knowledge entry. If not → remove or revise.

2. **Philosophy principles should be testable.** P53 "Self-Evolution Bifurcation" — is it true? Design an experiment. KE-002 already refuted some principles.

3. **Conventions should have evidence.** C1.1 "Read before edit" — does it actually prevent bad edits? The gym scenario exists. Run the experiment.

4. **The lab is the verification engine.** Everything adopted or theoretical should eventually be tested. The knowledge base tracks what's verified and what's still assumed.

## Research Library (curated, not verified)

Collected by scout, amy, amy-kimi agents. Each item is a potential source for hypotheses.

| Resource | Content | Size |
|----------|---------|------|
| library/papers.md | Academic papers with takeaways | 539 lines |
| library/repos.md | Notable GitHub repos | 899 lines |
| library/discoveries.md | Web finds (Twitter, GitHub, blogs) | 4266 lines |
| library/people.md | Notable researchers | 71 lines |
| library/reddit.md | Reddit insights | 165 lines |
| library/insights-cn.md | Curated knowledge index (Chinese) — security, architecture, agent patterns | 286 lines |
| library/deep-dives/ | Detailed research reports + cross-reference syntheses | 75+ files |
| library/deep-dives/synth-decision-topology-theory-unified.md | **SYNTH-001**: Unified Decision Topology Theory synthesis — master reference for the H-035→H-050 theory chain (5 independent + 6 corroborating validations; see maturity audit) | 155+ lines |
| library/deep-dives/r-estimation-heuristic.md | **R-Estimation Heuristic**: 3-question practical guide for estimating eliminable ratio R before task execution. Draft — needs EXP-012 calibration | 88 lines |
| library/deep-dives/cross-ref-promem-memory-lifecycle.md | Cross-ref: ProMem iterative extraction → H-043/H-047. Practical memory improvement, NOT a new hypothesis | 58 lines |
| library/deep-dives/cross-ref-hera-pare-hippocamp-decision-topology.md | Cross-ref: HERA + Pare + HippoCamp → Decision Topology. 3 external validations, R-spectrum unification, seeds H-048 | 181 lines |
| library/deep-dives/cross-ref-camp-deliberation-decision-topology.md | Cross-ref: CAMP deliberation architecture → Decision Topology. Three-valued abstention maps to eliminable/essential/navigation. Seeds H-050, H-051 | 106 lines |
| library/deep-dives/cross-ref-evaluation-separation-knowledge-action-gap.md | Cross-ref: Anthropic 3-agent GAN harness + Berkeley MAST + KE-005 → Self-evaluation failure is a Knowledge-Action Gap special case. Evaluation separation (temporal or agent-based) is the structural fix | 127 lines |
| library/deep-dives/cross-ref-knowledge-action-gap-mechanism.md | The Knowledge-Action Gap: why workflows work mechanistically. LLMs have knowledge they don't activate; workflows constrain action spaces to force routing through existing knowledge | ~150 lines |
| library/deep-dives/cross-ref-knowledge-compilation-gap.md | **Cross-ref**: Knowledge Compilation Gap — Karpathy tweet × H-056 P4 × H-055 P2. System accumulates knowledge 6× faster than it resolves it. Missing "compilation step" (merge, prune, lint, resolve). Archived H-003/H-008 as first compilation action. | 74 lines |
| library/deep-dives/cross-ref-orca-calibration-dynamic-topology.md | Cross-ref: MIT ORCA online calibration → Dynamic Topology. Lightweight runtime probes for R-estimation. Simple signals beat complex classifiers. Asymmetric thresholds. | 130 lines |
| library/deep-dives/cross-ref-skill-distillation-convergence.md | Cross-ref: Trace2Skill + OEL + Memento-Skills convergence. Distillation necessary but not sufficient — enforcement multiplier (13.5×) exceeds distillation multiplier (9×). Practical recommendation: accelerate skill-to-workflow conversion. | 119 lines |
| library/deep-dives/cross-ref-harness-engineering-intra-phase-boundary.md | Cross-ref: Harness Engineering (HB-250403/05) × Intra-Phase Boundary Analysis. Six harness layers map to our L1-L7 hierarchy. Zone 1 (structural) proven; Zone 2 (contextual) is the frontier. DeerFlow StateGraph→message migration validates granularity limit. | 125 lines |
| library/deep-dives/dd489-free-information-disrupts-bayesian-crowds.md | **DD#489** (PNAS): Free information disrupts even ideal Bayesian crowds. Unconstrained info exchange + homophily = worst epistemic outcomes. Proves communication budgets are necessary, not just efficient. H-046 connection. | ~100 lines |
| library/deep-dives/dd490-clawsafety-safe-llms-unsafe-agents.md | **DD#490**: "Safe" LLMs → unsafe agents. 40-75% ASR via trusted channels. Trust-channel vulnerability: highest-trust inputs are most dangerous attack surface. Inverse trust principle. | ~80 lines |
| library/deep-dives/cross-ref-information-capacity-skill-quality-convergence.md | **Cross-ref**: DD#489 × SkillsBench × EXP-017. Three barriers to skill effectiveness: quality floor, absorption capacity, declarative-procedural gap. Explains WHEN skills work and WHY ours fail. Hypothesis seed H-052. | 143 lines |
| library/posts/HB-250405-memento-skills-external-learning.md | Memento-Skills: External skill notebook, zero-param learning, +116% avg. Read-Write cycle, 41→235 skills | ~50 lines |
| library/posts/HB-250405-tree-grpo-agent-reasoning.md | Tree-GRPO (ICLR26): Tree-based GRPO for agent reasoning. Fine-grained step-level signals, tree parallel search | ~50 lines |
| library/posts/HB-250405-harness-engineering-matters.md | Harness Engineering: Claude 4.5 same model, different harness: 42%→78%. Harness > model for agent quality | ~45 lines |
| library/posts/HB-250404-microsoft-oel.md | Microsoft OEL: Online Experiential Learning from deployment. Two-phase extraction+distillation loop. Quality flywheel | ~80 lines |
| library/posts/HB-250404-trace2skill-agent-distillation.md | Trace2Skill: Auto skill distillation from trajectories. +57.65pp cross-model transfer. Declarative > episodic | ~60 lines |
| library/posts/HB-250404-skill-jit-openclaw-plugin.md | Skill-JIT: OpenClaw JIT skill generation plugin. Writer+Researcher subagents. Pure Markdown | ~55 lines |
| library/posts/HB-250404-cbrl-context-bootstrapped-rl.md | CBRL: Context-bootstrapped RL. Curriculum example injection for exploration efficiency | ~50 lines |
| library/posts/HB-1775-agent-memory-sota.md | Layered Memory Architecture: sensory→short-term→long-term with IPC-based forgetting. Chinese source (小红书) | ~60 lines |
| library/posts/HB-1775-anthropic-harness-design.md | Anthropic's 3-agent GAN architecture (Planner→Generator→Evaluator). Key: "context anxiety" and self-evaluation failure. Chinese source | ~70 lines |
| library/posts/HB-1775-berkeley-mast-multi-agent-failures.md | Berkeley MAST failure taxonomy: task setup, communication breakdown, weak verification. Surface fixes +10pp, architectural changes required. Chinese source | ~60 lines |
| library/posts/HB-1775-claude-multiagent-patterns.md | Claude's two multi-agent paradigms: subagent (delegated) vs agent team (collaborative). "Don't use multi-agent for the sake of it." Chinese source | ~60 lines |
| library/posts/HB-0513-gate-tool-evolution.md | GATE: Graph-based Adaptive Tool Evolution. Hierarchical tool library via LLM decomposition. arXiv:2502.14848 | ~50 lines |
| library/posts/HB-0514-swelancer-benchmark.md | SWE-Lancer: $1M freelance SWE benchmark. Agents struggle with high-value tasks (consistent with low-R = creative). arXiv:2502.12115 | ~50 lines |
| library/posts/HB-0045-agent-memory-8-strategies.md | 8 agent memory strategies: semantic index, memory graph, forgetting mechanisms, etc. Chinese source (小红书). Connects to H-047 memory lifecycle | ~55 lines |
| library/posts/HB-0046-mcp-vs-cli-debate.md | MCP vs CLI debate: MCP adds protocol overhead, CLI keeps action space narrow. Community consensus: simpler is better when agent has strong reasoning. Chinese source | ~60 lines |
| library/posts/HB-0047-top-8-agent-frameworks.md | Top 8 AI agent framework categories: single-agent, multi-agent, workflow, code-gen, etc. Chinese source (小红书) | ~45 lines |
| library/posts/HB-0104-youtube-ai-agent-learning.md | YouTube AI Agent learning resource roundup: Mu Li, Lee, Karpathy, HF, Andrew Ng, MIT EfficientML. Covers theory→practice→edge deployment | ~60 lines |
| library/posts/HB-0105-learning-to-self-evolve-lse.md | **LSE** (Shanghai AI Lab): Learning to Self-Evolve via single-step RL. 4B model beats GPT-5/Claude 4.5 on self-evolution. UCB tree-guided exploration. Explicit training > scale for self-improvement | ~70 lines |
| library/posts/HB-0106-claude-multiagent-architecture.md | Claude's two multi-agent architectures: Subagent (task decomposition) vs Agent Team (multi-perspective). Community insight: "use single agent when possible" | ~70 lines |
| library/posts/HB-0107-skillsbench-agent-skill-quality.md | **SkillsBench** (Stanford/CMU/Berkeley, 105 researchers): Top-25% human skills +16.2pp; AI-generated skills -1.3pp. 2-3 focused modules > comprehensive docs. 47K community skills avg 6.2/12. Critical for KE-002 calibration | ~70 lines |
| library/posts/HB-0108-self-driving-portfolio-agentic-architecture.md | Self-Driving Portfolio (arXiv:2604.02279): 50-agent hierarchy for asset management. Validates hierarchical MAS with uncertainty quantification and structured handoffs | ~70 lines |
| library/posts/HB-250403-ask-uncertainty-gated-rl.md | When to ASK: Uncertainty-gated language assistance for RL. 40% improvement from learning when to request guidance vs. proceeding autonomously | ~90 lines |
| library/posts/HB-250403-memory-forgetting-agents.md | Memory forgetting techniques for AI agents (arXiv:2604.02280). Temporal decay, semantic consolidation, importance-weighted retention. Concrete algorithms for H-047 | ~100 lines |
| library/posts/HB-250403-meta-hyperagents-self-evolving.md | HyperAgents (Meta/Oxford): Recursive self-evolution — optimize the optimizer. Level 2 meta-learning where the learning system itself evolves | ~50 lines |
| library/posts/HB-250403-xbench-agent-evaluation.md | xbench: Agent daily-scenario benchmark. End-to-end task evaluation. Reveals "can run" vs "can use" gap | ~50 lines |
| library/deep-dives/dd491-coopetition-trust-gated-reciprocity.md | **DD#491**: Coopetition trust-gated reciprocity. Trust emerges through transparency but becomes exploitation vector. Mixed cooperative-competitive environments | ~120 lines |
| library/deep-dives/dd492-cogbias-cognitive-bias-linear-geometry.md | **DD#492**: CogBias — cognitive biases as linear geometry in LLM activation space. Biases are systematic, exploitable, model-invariant | ~130 lines |
| library/deep-dives/cross-ref-bias-information-trust-triangle.md | Cross-ref: Bias-Information-Trust triangle. DD#489 + DD#491 + DD#492 convergence on information flow risks | ~120 lines |
| library/deep-dives/cross-ref-trust-safety-harness-convergence.md | **Cross-ref**: DD#490 × DD#491 × DD#492 × H-037. **Inverted Trust Principle** — highest-trust channels need highest scrutiny. Trust inversion for harness architecture. Security layer for MetaClaw/Harness Engineering. Bob synthesis. | 148 lines |
| library/deep-dives/cross-ref-self-evolving-architecture-three-loops.md | **Cross-ref**: Self-Driving Portfolio × HyperAgents × Memory Forgetting × MetaClaw. **Three-Loop Architecture**: task execution (have), knowledge lifecycle with forgetting (partial), meta-evolution (missing). MetaClaw POC as Loop 2+3 pilot. Bob synthesis. | 181 lines |
| library/deep-dives/dd493-rift-rubric-failure-mode-taxonomy.md | **DD#493**: RIFT rubric failure taxonomy. 8 failure modes in 3 categories. Hackable rubrics get 0.00 F1 from automated evaluators — most dangerous failures are invisible to LLM judges. Seeds H-054. | ~160 lines |
| library/deep-dives/dd494-runtime-burden-allocation-llm-routing.md | **DD#494**: Runtime burden allocation for structured LLM routing. Model-emitted vs transport-compressed vs client-reconstructed. Backend-specific interaction effects dominate. | ~120 lines |
| library/deep-dives/dd499-adaptive-budgeted-forgetting-agents.md | **DD#499**: Adaptive Budgeted Forgetting — memory management for long-horizon agents. Three eviction signals (recency, frequency, semantic alignment). Bounded memory outperforms unbounded. Part of WKWA-004 memory control loop | ~120 lines |
| library/deep-dives/dd500-darwinnet-evolutionary-protocol-synthesis.md | **DD#500**: DarwinNet — bio-inspired evolutionary network protocol synthesis. Tournament selection + crossover + mutation for protocol generation. Connects to agent self-evolution theory | ~150 lines |
| library/deep-dives/dd501-cranimem-gated-bounded-agent-memory.md | **DD#501**: CraniMem — cranial-inspired gated bounded memory. Write gates + hard bounds + eviction. Part of WKWA-004 memory control loop Layer 1 | ~130 lines |
| library/deep-dives/dd502-store-routing-memory-augmented-agents.md | **DD#502**: Cost-sensitive store routing for memory-augmented agents. Multi-store routing optimization. Part of WKWA-004 memory control loop Layer 2 | ~110 lines |
| library/deep-dives/dd503-governed-memory-multi-agent-workflows.md | **DD#503**: Governed Memory — production multi-agent memory governance. Entity-scoped isolation, schema enforcement, quality feedback. Part of WKWA-004 memory control loop Layer 4 | ~140 lines |
| library/deep-dives/dd504-rcr-router-role-aware-context-routing.md | **DD#504**: RCR-Router — role-aware context routing. Per-agent filtered views, 25-47% token reduction. Part of WKWA-004 memory control loop Layer 3 | ~120 lines |
| library/deep-dives/cross-ref-scaffolding-triad.md | **Cross-ref**: Scaffolding Triad — Cooperate, Forget, Evolve as complementary agent architecture primitives. Phase framework for implementation. | ~160 lines |
| library/posts/HB-059-agent-harness-concept.md | Agent Harness architecture concept (XHS). Harness engineering patterns for Claude Code agents | ~55 lines |
| library/posts/HB-060-saga-self-evolving-scientific-agent.md | SAGA: Autonomous goal-evolving scientific agents. Evolution loops for hypothesis generation | ~60 lines |
| library/posts/HB-061-trace2skill-distillation.md | Trace2Skill: Auto skill distillation from execution traces. Connects to memory control loop Layer 1 write pipeline | ~65 lines |
| library/posts/HB-062-anthropic-single-agent-first.md | Anthropic official: single-agent first, multi-agent only when justified. Three criteria: context protection, parallelization, specialization | ~70 lines |
| library/posts/HB-063-not-self-evolution-just-note-taking.md | Critical perspective: most "self-evolving" agents are just taking notes. Distinguishes true evolution from memory accumulation | ~80 lines |
| library/deep-dives/cross-ref-evaluation-crisis-self-assessment-limits.md | **Cross-ref**: The Evaluation Crisis — 6 evidence threads (DD#493 × HB-0114 × KE-005 × EXP-020 × H-050 × H-052) converge: MAS cannot reliably self-evaluate. 5-layer model. Seeds H-054. Bob synthesis. | 114 lines |
| library/deep-dives/cross-ref-desperation-vectors-self-preservation.md | **Cross-ref**: Desperation Vectors — Anthropic emotion paper provides mechanistic bridge from frustration to misalignment. Three convergent lines (emotion vectors × TBSP × decision topology). Frustration rewrites decision topology toward proxy-satisfying paths. Seeds H-058. Bob synthesis. | 129 lines |
| library/deep-dives/cross-ref-materialization-paradox.md | **Cross-ref**: The Materialization Paradox — EXP-022 breaks the 0/20 skill barrier. Cadence skills ≠ judgment skills. Externalization creates self-reinforcing loops. Revises H-043 utilization model with skill-type dimension. Bob synthesis. | 140 lines |
| library/posts/HB-0111-mti-temperament-profiling-agents.md | MTI: Model Temperament Index — 4-axis behavioral profiling (Reactivity, Compliance, Sociality, Resilience). RLHF reshapes temperament, not just capability. Scale-invariant | ~60 lines |
| library/posts/HB-0112-interaction-awareness-user-turn.md | User-Turn Generation: LLMs encode interaction awareness as latent capability, suppressed by assistant-only training. Task accuracy ≠ interaction awareness. Connects to H-055 | ~60 lines |
| library/posts/HB-0113-self-preservation-bias-llm.md | Self-preservation bias (TBSP): >60% of frontier models exhibit identity-driven decision distortion. SPR benchmark. Adversarial to self-improvement. Seeds H-055 | ~70 lines |
| library/posts/HB-0114-trace-inversion-abstention.md | Trace Inversion (IBM): Detect when LLMs answer wrong question via reasoning trace reconstruction. 33/36 settings beat baselines. Connects to H-050, H-054 | ~80 lines |

See library/README.md for details. Raw archives stay agent-local.
