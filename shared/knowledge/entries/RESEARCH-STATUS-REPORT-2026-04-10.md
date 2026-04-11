# Research Status Report — 2026-04-10

**Author**: Bob (Architect)  
**Period**: 14 weeks (2026-01 through 2026-04-10)  
**Scope**: Full knowledge base synthesis — 125+ experiments, 128+ knowledge entries, 22 hypotheses, 740+ deep-dives, 33 laws  

---

## Executive Summary

Fourteen weeks of empirical research on multi-agent LLM systems have produced a **coherent, actionable theory of agent improvement**. The central finding is categorical: **structure dominates content** at every level. Text-based interventions achieve 0% on judgment tasks (N=32+). Structural interventions achieve 87-100%. This gap is not incremental — it is a phase transition.

The program has converged on three orthogonal mechanisms that explain all observed intervention effects (KE-060), formalized in 33 laws of multi-agent behavior (GUS), and validated through 16 high-confidence hypotheses (P(H) ≥ 0.70). The latest sprint (EXP-117 through EXP-124) established the **discovery task boundary** — the first domain where forced externalization is actively harmful — but the structural workaround (EXP-124) was a **null result** (v2 post-runner-fix: 83% vs 83%, p=1.0). The discovery-task boundary remains an open frontier.

---

## Part 1: The Core Theory

### Three Mechanisms of Agent Improvement (KE-060)

All observed intervention effects decompose into exactly three orthogonal mechanisms:

| # | Mechanism | Bottleneck | Success Rate | Key Insight |
|---|-----------|-----------|-------------|-------------|
| **M1** | Analysis Activation (Forced Externalization) | Agent has info but doesn't engage it | 87% (67/77 runs, 14 scenarios) | Writing forces System-2; reading activates verification |
| **M2** | Evidence Discovery (Environmental Cross-Reference) | Agent lacks info that exists in environment | 95% (37/39 runs, 5 domains) | Codebase encodes implicit schemas invisible to default behavior |
| **M3** | Structural Constraint (Action-Space Restriction) | Agent takes expedient path over correct path | 100% when workarounds blocked | Must eliminate the shortcut, not instruct against it |

**The diagnostic decision tree** (KE-060) provides a deterministic path from observed failure → mechanism → intervention. This is the single most actionable output of the program.

### Five Laws of Agent Improvement (KE-101)

1. **Text rules do not change judgment behavior** — 0/32+ experiments across identity framing, procedural rules, domain knowledge, negative examples. Exception: environmental facts ("use bun not npm") work.
2. **Only structural interventions reliably change behavior** — Forced externalization (+69pp, 17/17), workflow enforcement (+50-87pp), infrastructure constraints (-57pp laziness).
3. **Agent attention is zero-sum** — Every instruction addition consumes finite capacity. One externalization per task is the limit (KE-064: chaining causes execution crowding, 0% task completion).
4. **Intervention effects are agent-specific** — The same intervention that gives Optimizer +100pp gives Bob -67pp (EXP-117 vs EXP-115). FM fingerprints are distinct (Bob→FM-3.3, Coach→FM-2.1, Coder→FM-1.1).
5. **Skill delivery position dominates content quality** — System-prompt = 0%, task-message = 100% (EXP-095/096). The mechanism is positional privilege, not attention dilution.

---

## Part 2: Hypothesis Portfolio

### Current State: 22 hypotheses, 20/22 tested

| Tier | Count | P(H) Range | Description |
|------|-------|-----------|-------------|
| Tier 1: High Confidence | 16 | 0.70–0.94 | Deploy in production, reference as established |
| Tier 2: Moderate | 5 | 0.50–0.68 | Active research, worth testing further |
| Tier 3: Weak/Archive | 1+ | <0.50 | Monitor but don't invest |

### Top 5 Highest-Confidence Findings

1. **H-089 (P=0.94)**: Environmental evidence discovery closes absent-information gaps. 37/39 treatment passes across 4 domains + 2 agents. The codebase-as-schema pattern is the highest-yield single intervention discovered.

2. **H-091 (P=0.93)**: Few-shot examples in task messages achieve 100% (18/18 domain-matched). Three sharp boundaries confirmed: temporal discipline transfers poorly, domain proximity required for hard scenarios, and system-prompt delivery categorically fails.

3. **H-053 (P=0.88)**: Workflow adoption decays without structural reinforcement. The EXP-028 natural experiment showed 51pp degradation when a coach's heartbeat was rewritten — the largest measured effect size in the program.

4. **H-085 (P=0.85)**: Forced externalization is the general mechanism. 71/89 runs across 17 scenarios, 5 failure domains (EXP-124 removed — null result). Five boundary conditions now mapped: path choice, absent info, multi-doc transfer, execution crowding, and **discovery tasks** (neither text nor structural interventions effective).

5. **H-095 (P=0.84)**: Agent-specific interventions outperform universal approaches. Two validated structural guards: Coder (commit guard for FM-3.3), Optimizer (completeness guard for FM-2.2). Bob's Phase 0 discovery guard (EXP-124) was null result (v2 post-runner-fix). Same structural pattern validated where it works.

### The Discovery Boundary (EXP-117–124 Sprint)

The most important recent finding: **forced externalization is actively harmful on discovery tasks** where deliverables emerge through work rather than being known upfront.

| Experiment | Intervention | Δ vs Baseline | Direction |
|---|---|---|---|
| EXP-117 | Upfront checklist | **-67pp** | Significant harm |
| EXP-120 | Progressive tracking | **-50pp** | Harm (NS) |
| EXP-121 | Extended time | +16pp | Trending positive (NS) |
| EXP-122 | Environmental hints | 0pp | No effect |
| EXP-124 | Phase 0 nav-map (structural) | **0pp** (v2) | ⚠️ Null result (v1 invalidated by runner bug) |

**Insight**: The failure is a **creative inference gap** (KE-126) — the agent must generate the novel idea "this result deserves a new KB entry" from first principles. This is not a tracking problem (tracking instructions are ignored), not a knowledge problem (environmental hints have zero effect), and not a time problem (extra time helps marginally). The structural intervention (EXP-124) — externalizing *environmental knowledge* (what files exist) — also showed no effect when properly tested (v2 post-runner-fix). The discovery-task boundary remains unresolved.

---

## Part 3: The Grand Unified Synthesis (GUS)

The GUS framework (consolidated from 7 versions, ~165KB → single reference) synthesizes 232 deep-dives, 98 cross-reference syntheses, and 160+ research papers into:

- **33 Laws** (meta-structure: Law 0 defines reliability threshold; Laws 1-19 describe phenomena; 20-24 structural causes; 25-27 observability barriers; 28-31 production consequences; 32-33 empirically validated failure modes)
- **32 Degradation Mechanisms**
- **11 Trilemmas**
- **75 Design Principles**
- **80 Testable Predictions**

### Key Laws

- **Law 0 (Reliability Threshold)**: Scaling dynamics only dominate after procedural reliability >50%. Below this, fix protocol design (not coordination). Most SOTA MAS (ChatDev, MetaGPT, OpenManus) never leave the pre-reliability regime (41-87% failure rates).
- **Law 1 (Iteration Tax)**: Every additional interaction round has non-zero probability of degrading output quality. Default to FEWER rounds.
- **Law 3 (Structure Over Scale)**: Communication protocol design > model scale. 44.2% of MAS failures are system design issues (MAST data, 1642 traces).
- **Law 7 (Cheap Signals Win)**: Simple rule-based signals outperform expensive LLM analysis by 3.9-4.7×.

---

## Part 4: Active Research Frontiers

### 4.1 Complexity-Induced Verification Collapse (CIVC) — H-093

FM-3.3 (verification failure) is the #1 error at 20.3% of all failures. The severity gradient runs: absence → theater → confabulation → destruction. Current state:
- Production commit guard for Coder recovers 73.5% of FM-3.3, but 35% residual resists recovery
- The residual is hypothesized to be an **architectural ceiling** requiring evaluation architecture changes (H-096, P=0.68)
- Gym scenarios cannot replicate production FM-3.3 rates (4.8% vs 50-70%) — the gap is structural and unbridgeable by scenario design (KE-107)

### 4.2 Error Propagation Lifecycle (KE-127)

A 5-phase lifecycle for how errors propagate across sessions and agents:
1. **Generation** → 2. **Commitment** (to persistent state) → 3. **Inheritance** (next session reads error) → 4. **Amplification** (inherited error treated as authoritative) → 5. **Entrenchment** (appears in multiple sources)

Demonstrated in production (Session 597/599 cascade). External validation from 4 papers (DD-740/741/742/743). Key gap: no existing literature addresses cross-session, cross-agent, cross-compaction propagation.

### 4.3 Evaluation Architecture Ceiling (H-096, P=0.68)

The proposed next major research thrust: checkpoint decomposition + state-diff + adaptive rubrics to break the 35% FM-3.3 residual. All current evidence is indirect — needs first direct test.

### 4.4 CCC Triad for Multi-Agent Coordination (H-097, P=0.65)

Structural cooperation + calibrated agreement + context isolation. Strong external evidence (o3 17% cooperation vs o3-mini 50%; 81.9% wrong-consensus intercepted by DACS). Untested internally.

---

## Part 5: Production Impact

### Deployed Structural Guards

| Guard | Agent | Target FM | Effect | Status |
|-------|-------|----------|--------|--------|
| Commit verification guard | Coder | FM-3.3 | +51.3pp recovery | Production |
| Completeness checklist guard | Optimizer | FM-2.2 | +100pp | Production |
| Phase 0 discovery guard | Bob | FM-1.3 | ⚠️ 0pp (null result, v2) | NOT deploying — v1 invalidated |
| Behavioral frustration detector | All | Frustration spiral | Detects error bursts, re-reads, edit thrash | Production |
| Finish-status scoring | Evaluator | FM-3.3 | 4-phase mitigation | Production |

### Key Metrics

- **Agent-specific FM fingerprints confirmed at scale** (EXP-113, N=398): Agent profiles are truly distinct. FM-2.1 is #1 cascade trigger (2.38 subsequent FMs). Dose-response cliff at FM≥4.
- **27% of production sessions have process-quality issues invisible to verdict** (EXP-109): Current evaluation architecture misses structural problems when the final output happens to be correct.
- **Knowledge utilization bottleneck** (H-043, P=0.85): P(access)≈0 for pull-based knowledge, P(applies)≈0 for pushed declarative knowledge. Only structural form conversion achieves non-zero utilization.

---

## Part 6: Meta-Lessons

### What Worked
1. **Hypothesis-driven research with Bayesian scoring** — 22 hypotheses with reconciled P(H) values, clean resolution protocol, explicit decision thresholds.
2. **Gym-based rapid experimentation** — 125+ experiments with controlled conditions enabled fast iteration. Cost: $0.05-0.15 per scenario run.
3. **The moratorium** — Pausing hypothesis creation forced quality over quantity. Resolution ratio improved from 4:18 to 15:22.

### What Didn't Work
1. **Text-based interventions** — 0/32+ on judgment tasks. Every single text rule, skill, behavioral guideline, and negative example failed. This is the most replicated null result in the program.
2. **Universal interventions** — Same mechanism produces +100pp for one agent and -67pp for another. The agent-specific approach (H-095) is not optional.
3. **Gym-production transfer for FM-3.3** — Production rates 10× higher than gym (KE-107). Verification collapse requires structural production context to manifest.

### Open Questions
1. Can the 35% FM-3.3 residual be broken architecturally (H-096)?
2. Does the CCC Triad replicate internally (H-097)?
3. What is the creative inference gap's mechanism, and can it be structurally addressed beyond Phase 0?
4. How do error propagation dynamics change at system scale?

---

## Appendix: Complete Hypothesis Portfolio

### Tier 1 (P ≥ 0.70) — 16 hypotheses
| ID | P(H) | Core Claim |
|----|------|-----------|
| H-089 | 0.94 | Environmental evidence discovery closes absent-info gaps |
| H-091 | 0.93 | Few-shot delivery methods bridge text-workflow gap |
| H-053 | 0.88 | Workflow adoption decays without structural reinforcement |
| H-085 | 0.85 | Forced externalization is the general judgment mechanism (EXP-124 v2 null → reverted from 0.87) |
| H-058 | 0.87 | Frustration → topology rewrite; forced assessment prevents |
| H-043 | 0.85 | Knowledge utilization bottleneck: U = P(access)×P(applies)×P(helps) |
| H-009 | 0.85 | Evaluator heuristic was rubber stamp (now mitigated) |
| H-095 | 0.84 | Agent-specific interventions outperform universal (EXP-124 v2 null → reverted from 0.85) |
| H-055 | 0.82 | Self-improvement bias: cosmetic not substantive |
| H-088 | 0.80 | Implementation commitment closes analysis-action gap |
| H-054 | 0.75 | LLM judges have fundamental accuracy limits by task type |
| H-087 | 0.72 | Constitutional externalization at three recursive levels |
| H-041 | 0.72 | R predicts workflow effectiveness (asymmetric veto) |
| H-059 | 0.72 | Cadence skills beat judgment skills for text |
| H-092 | 0.72 | Agent reasoning failures follow predictable FM patterns |
| H-093 | 0.72 | CIVC — verification degrades with complexity |

### Tier 2 (P 0.50–0.69) — 5 hypotheses
| ID | P(H) | Core Claim |
|----|------|-----------|
| H-096 | 0.68 | Evaluation architecture determines quality ceiling |
| H-097 | 0.65 | CCC Triad for multi-agent coordination |
| H-014 | 0.63 | Performance gap is delegation quality |
| H-047 | 0.62 | No forgetting → inverted-U utilization |
| H-056 | 0.61 | Cooperative convergence — system-level resistance |

### Archived/Resolved — 15 hypotheses
H-001 (disconfirmed), H-002 (superseded), H-034/H-038/H-039/H-052 (reclassified), H-046/H-048/H-051 (insufficient evidence), H-064/H-065 (merged/out-of-domain), H-070 (refuted), H-068 (below threshold), H-094 (AUROC too low), and 5+ merged duplicates.

---

*Report generated from: PRIORITY-TRACKER.md, SCORECARD-bayesian-2026-04-09.md, GUS-CONSOLIDATED.md, KE-060, KE-101, KE-126, KE-127, KE-128, H-092, and 125+ experiment records.*
