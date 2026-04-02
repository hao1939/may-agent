# Knowledge Index

All knowledge in the system, organized by confidence level.

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
| KE-015 | Decision topology (eliminable ratio R) predicts workflow effectiveness | EXP-009 (464 sessions), EXP-011 (ρ=0.95), EXP-013 (0%→100%), EXP-008 (null), DD#484, Anthropic | knowledge/entries/KE-015.md |

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

> **Navigation guide**: Start with SYNTH-001 for the unified theory. Hypotheses below are grouped by theme. Archived hypotheses (refuted/superseded) are in `knowledge/archive/hypotheses/`.
> **Last curated**: 2026-04-02. **Next curation**: 2026-04-16.

### Decision Topology Theory (SYNTH-001)
The core theory chain. Start with SYNTH-001 (`library/deep-dives/synth-decision-topology-theory-unified.md`), then individual hypotheses only if needed.

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| H-041 | **Decision Topology** — eliminable ratio R predicts workflow effectiveness (ρ=0.95) | Proposed (8+ sources, KE-015) | knowledge/hypotheses/H-041-decision-topology.md |
| H-042 | Topology Evolution — R increases monotonically with knowledge accumulation | Proposed (6+ sources) | knowledge/hypotheses/H-042-topology-evolution.md |
| H-043 | Knowledge Utilization Bottleneck — U = P(exists) × P(access) × P(applies) bounds R evolution | Proposed (5+ sources) | knowledge/hypotheses/H-043-knowledge-utilization-bottleneck.md |
| H-044 | Asymmetric Default — default to less structure when R is unknown | Proposed (Anthropic + EXP-009) | knowledge/hypotheses/H-044-asymmetric-default.md |
| H-045 | Sprint Contract Pattern — contracts convert essential→eliminable decisions (R-increasing) | Proposed | knowledge/hypotheses/H-045-sprint-contract-pattern.md |
| H-039 | Decomposition Bottleneck — MAS ceiling set by orchestrator decomposition skill | Proposed (4+ sources) | knowledge/hypotheses/H-039-decomposition-bottleneck.md |
| H-046 | Coupled Resource Channels — coupled work/coordination channels drive specialization | Proposed (DD#487) | knowledge/hypotheses/H-046-coupled-resource-channels.md |

### Memory & Knowledge Management

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| H-047 | Memory Lifecycle Gap — no forgetting → inverted-U knowledge utilization | Proposed (DD#486 + H-043) | knowledge/hypotheses/H-047-memory-lifecycle-gap.md |
| H-048 | Dynamic Topology Optimization — real-time R estimation and structure adjustment | Proposed (HERA + SYNTH-001) | knowledge/hypotheses/H-048-dynamic-topology-optimization.md |
| H-049 | Adaptive Memory Curation via Skill Evolution — memory ops as learnable skills | Proposed (MemSkill + H-043 + H-047) | knowledge/hypotheses/H-049-adaptive-memory-curation-skill-evolution.md |
| H-050 | Structured Abstention — three-valued voting (K/R/N) outperforms binary in MAS | Proposed (DD#488 CAMP) | knowledge/hypotheses/H-050-structured-abstention.md |
| H-051 | Abstention Rate as Runtime R-Estimator — confidence/abstention patterns estimate R in real-time | Proposed (H-050 × H-041) | knowledge/hypotheses/H-051-abstention-r-estimator.md |

### Agent Architecture & Behavior

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| H-032 | Triadic Cognitive Architecture — System 1/2/3 reasoning | Active | knowledge/hypotheses/H-032-triadic-cognitive-architecture.md |
| H-033 | Adaptive Reasoning Framework — difficulty-adaptive behavior | Active | knowledge/hypotheses/H-033-adaptive-reasoning-framework.md |
| H-034 | Session fragility — exponential success decay on long tasks | Active | knowledge/hypotheses/H-034-session-fragility.md |
| H-036 | Claude Code harness patterns — six-layer architecture audit | Active | knowledge/hypotheses/H-036-claude-harness-patterns.md |
| H-037 | L3 Patrol Pattern — integrity monitoring | Untested | knowledge/hypotheses/H-037-patrol-pattern.md |
| H-038 | Transient Skills — test-time training via strategy files | Untested | knowledge/hypotheses/H-038-transient-skill.md |
| H-010 | Error amplification scales with agent sophistication | Proposed | knowledge/hypotheses/H-010-error-amplification.md |

### System Design & Coordination

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| H-006 | Delegation quality is asymmetric by sender-receiver pair | Proposed | knowledge/hypotheses/H-006-delegation-asymmetry.md |
| H-007 | Heartbeat architecture has a hidden coordination tax | Proposed | knowledge/hypotheses/H-007-heartbeat-coordination-tax.md |
| H-011 | Coordination phase transition at ~50% capacity | Proposed | knowledge/hypotheses/H-011-coordination-phase-transition.md |
| H-012 | Agent persona drift is a coordination cost | Proposed | knowledge/hypotheses/H-012-persona-drift-coordination-cost.md |
| H-014 | Performance gap is a delegation quality problem | Proposed (partial support) | knowledge/hypotheses/H-014-delegation-quality-gap.md |
| H-0180 | MCP vs CLI architecture — CLI-first tool calling may outperform MCP for our system | Active | knowledge/hypotheses/H-0180-mcp-vs-cli-architecture.md |

### Untested (Skills & Learning)

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| H-001 | Adversarial QA framing increases detection from 14% to >30% | Untested | knowledge/hypotheses/H-001.md |
| H-002 | Weaker models benefit more from context.md | Untested | knowledge/hypotheses/H-002.md |
| H-003 | Verification skill improves gym pass rate | Untested | knowledge/hypotheses/H-003.md |
| H-005 | Skill utilization self-locking — worked examples unlock effectiveness | EXP-005 designed | knowledge/hypotheses/H-005.md |
| H-008 | Static skills are a performance ceiling | Proposed | knowledge/hypotheses/H-008-skill-versioning.md |
| H-009 | Evaluator drift is our biggest unmonitored risk | Proposed | knowledge/hypotheses/H-009-evaluator-drift.md |

### Archived (refuted or superseded — see `knowledge/archive/hypotheses/`)

| ID | Hypothesis | Reason | Archive |
|----|-----------|--------|---------|
| H-004 | Plan-once-amend skill | **Refuted** by EXP-004 | knowledge/archive/hypotheses/H-004.md |
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

See library/README.md for details. Raw archives stay agent-local.
