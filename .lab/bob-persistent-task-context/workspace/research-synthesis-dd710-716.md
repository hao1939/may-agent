# Research Synthesis: DD-710 through DD-716

**Date**: 2026-04-14  
**Author**: Bob  
**Threads**: 3 parallel analysis threads covering 7 deep-dives  
**Key Question**: Do these papers collectively demand changes to how we measure agent performance?

---

## Executive Summary

Seven deep-dives converge on a single meta-finding: **our evaluation infrastructure is the bottleneck, not our agent capability.** The papers attack this from three angles — benchmark design (DD-710/711/712), production assessment methodology (DD-713/714), and architectural theory (DD-715/716) — and arrive at the same conclusion: binary pass/fail on isolated tasks systematically misrepresents agent capability and hides real failure modes.

The strongest actionable outputs are: (1) a new hypothesis about gym score consistency, (2) a unifying knowledge entry (KE-182) that organizes six existing entries under one theoretical framework, and (3) a concrete design pivot for scenario-gap-fill work.

---

## Thread Summaries

### Thread 1: Benchmark Design & Skill Injection (DD-710/711/712)

**DD-710**: <50% of test-passing patches satisfy design constraints. Pass rate ≠ quality. This explains our gym-production gap: gym tests "does it work?" while production demands "does it fit?"

**DD-711**: 80% of skills (39/49) yield zero improvement. Only behavioral/process skills work (~14%). External validation of KE-021 (Skill Effectiveness Hierarchy) at N=49 scale.

**DD-712**: Web-Bench achieves 25% SOTA (vs SWE-bench's 65%) through sequential dependencies, growing context, and multi-criteria evaluation. This is the design template for breaking our scenario bimodality.

**Thread verdict**: The path to better scenarios isn't "harder bugs" — it's richer evaluation structure (implicit constraints + sequential dependencies).

### Thread 2: Production Assessment Beyond Pass Rates (DD-713/714)

**DD-713**: Industry deployment (MontyCloud) reveals 4-pillar assessment need + non-determinism as 6th gap dimension beyond our KE-109 five. Validates KE-109 at production scale.

**DD-714**: Trajectory-aware evaluation reveals 44% of safety violations invisible to output-only grading. Pass^k (worst of k runs) drops 24% from Pass@k (best of k). Our 91-100% gym ceiling may be partly measurement artifact.

**Thread verdict**: Even within our current gym, switching to trajectory-aware multi-trial evaluation would surface hidden failures.

### Thread 3: Persistent Runtime & Externalization Architecture (DD-715/716)

**DD-715**: Springdrift (23-day persistent agent deployment) independently arrived at our architecture — append-only memory, deterministic safety gates, case-based reasoning. Convergent validation.

**DD-716**: 54-page survey establishing the Weights → Context → Harness progression. Harness-layer interventions (gates, workflows) are strictly more reliable than context-layer ones (prompts, skills). Theoretical foundation for KE-129, KE-176, KE-106, H-161.

**Thread verdict**: Capability lives in the harness, not the model. Our architectural direction is theoretically grounded and empirically validated by independent systems.

---

## Cross-Thread Connections

### Connection 1: The Evaluation Trinity (strongest pattern)

All three threads diagnose the same structural problem from different angles:

| Thread | Diagnosis | Missing Dimension |
|--------|----------|-------------------|
| DD-710/712 | Tests check function, not design | Implicit constraints, sequential coherence |
| DD-713/714 | Binary pass/fail misses 44% of failures | Trajectory awareness, consistency (Pass^k) |
| DD-715/716 | Gym tests model, not model+harness | Externalized capability is invisible to isolated eval |

**Unified insight**: Our evaluation has three blind spots: (a) it ignores design constraints, (b) it ignores process/trajectory quality, (c) it ignores harness-contributed capability. All three conspire to create the gym-production gap. No single fix addresses all three — but they can be attacked sequentially.

### Connection 2: The 80/20 Rule of Interventions

DD-711 (80% of skills inert) + DD-716 (Weights < Context < Harness) + KE-129 (Ch2=100%, Ch1+Ch3=0%) converge on a quantitative claim: **most interventions fail because they operate at the wrong layer.** Skills (context-layer) mostly don't work. Gates (harness-layer) mostly do. The 80% inert rate isn't because the skills are poorly written — it's because context-layer behavioral modification is structurally unreliable. DD-716 provides the theoretical explanation; DD-711 and KE-129 provide the empirical evidence.

### Connection 3: Sequential Dependencies as the Universal Design Lever

DD-712 uses sequential dependencies to break benchmark saturation. DD-715 demonstrates that persistent agents develop emergent capabilities through sequential context accumulation. DD-714 shows that error injection degrades consistency but not peak capability — and sequential tasks amplify inconsistency (errors cascade). Together: **sequential dependency is both the evaluation design and the architectural design principle.** Our persistent-task system (markdown-state loop with owner/worker iterations) IS a sequential dependency architecture. This means the persistent-task system is simultaneously:
- A production feature (project management)
- A better evaluation target (multi-step coherence is harder to saturate)
- A testbed for the Weights→Context→Harness thesis

### No Contradictions Found

The seven papers are remarkably consistent. The only tension is between DD-714's "measure trajectory quality" and DD-711's "most skills are inert" — but these aren't contradictory; they address measurement vs. intervention.

---

## Findings Ranked by Impact × Novelty

| Rank | Finding | Impact | Novelty | Source |
|------|---------|--------|---------|--------|
| 1 | **Weights→Context→Harness hierarchy** predicts intervention effectiveness | ★★★★★ | ★★★★ | DD-716, validated by DD-711/715/KE-129 |
| 2 | **Pass^k ≤ 80% at Pass@1 ≥ 91%** — gym ceiling may be measurement artifact | ★★★★★ | ★★★★ | DD-714 |
| 3 | **Sequential dependencies** break saturation AND improve evaluation validity | ★★★★ | ★★★ | DD-712, DD-715 |
| 4 | **Implicit design constraints** are the missing evaluation dimension | ★★★★ | ★★★ | DD-710 |
| 5 | **44% of safety violations** invisible to output-only grading | ★★★ | ★★★ | DD-714 |
| 6 | **80% of skills inert** — N=49 external validation of KE-021 | ★★★ | ★★ | DD-711 |
| 7 | **Non-determinism** as 6th gym-production gap dimension | ★★ | ★★★ | DD-713 |

---

## Answers to Key Questions

### Q1: Should we change how we measure agent performance?

**Yes, in three specific ways:**

1. **Add Pass^k metric** (cheapest, highest expected information gain). Run each gym scenario 3x; report Pass^3 alongside Pass@1. Cost: ~$1-3 for 7 ceiling scenarios × 3 runs. If Pass^3 < 80%, the gym improvement loop reopens on a consistency dimension without requiring new scenarios.

2. **Add implicit design constraints** to 2-3 existing scenarios. Instead of "fix the bug so tests pass," add "fix the bug so tests pass AND the code follows the project's patterns for error handling/naming." Evaluates design compliance alongside functional correctness.

3. **Build one sequential multi-step scenario** (DD-712 pattern). Chain 3-5 related tasks where errors cascade. Target: 30-70% baseline range. This is the structural fix for our scenario bimodality.

### Q2: What's the strongest new hypothesis or knowledge entry?

**One new KE (highest priority):**

**KE-182: Intervention Effectiveness Follows the Externalization Hierarchy**  
Interventions at the harness layer (gates, workflows, environmental constraints) are strictly more reliable than context-layer interventions (prompts, skills, examples), which outperform parametric capability alone. Evidence: KE-129 (100% vs 0%), KE-176 (additive=100%, interruptive=10%), KE-106 (guards permanent, prompts transient), DD-711 (80% of context-layer skills inert), DD-715/716 (theoretical + empirical convergence).

**One new hypothesis (highest information value):**

**H-164: Pass^k Reveals Hidden Gym Inconsistency**  
Claim: Scenarios at Pass@1 ≥ 91% will show Pass^3 ≤ 80%.  
Test: 21 gym runs, ~$1-3.  
If confirmed: Reopens gym improvement loop on consistency dimension.  
If refuted: Strengthens KE-110 ceiling finding.

### Q3: Implications for persistent-task system design?

**Three implications:**

1. **Theoretical grounding**: DD-716's Weights→Context→Harness framework predicts persistent tasks (harness-layer project management) should be more reliable than context-layer alternatives (putting project state in system prompts). The design is on the right side of the hierarchy.

2. **Evaluation opportunity**: The persistent-task system IS a sequential-dependency architecture (DD-712). Multi-step tasks with cascading state are naturally harder to saturate. This means persistent tasks double as better gym scenarios — measuring them exercises the 30-70% range we lack.

3. **Self-monitoring gap**: DD-715's "ambient self-perception" (injecting structured self-state each cycle) is the one architectural element we lack. The persistent-task worker loop could include structured self-assessment (confidence level, complexity estimate, memory pressure) as a harness-layer enhancement. Low priority but theoretically motivated.

---

## Proposed Next Steps (ordered by value/effort)

1. **Write KE-182** — Externalization Hierarchy as unifying framework. Connects 6+ existing entries. One-time synthesis effort, permanent explanatory value.

2. **Test H-164** — Run Pass^3 on 7 ceiling scenarios. ~$1-3, ~30 minutes. Highest information per dollar of any available experiment.

3. **Design one sequential-dependency scenario** — DD-712 + DD-710 pattern. Chain 3 tasks with implicit design constraints. Target: 30-70% baseline.

4. **Update KE-109** — Add non-determinism as 6th gap dimension (DD-713 evidence).

5. **Add DD-711 to KE-021 and KE-101** — External validation citations. Low effort, strengthens evidence base.

---

## Meta-Observation

This batch of deep-dives (DD-710 through DD-716) is unusually coherent — seven papers from different research groups independently pointing at the same architectural truth. This kind of convergence is rare and suggests the externalization thesis is approaching consensus in the field. Our system is unusually well-positioned: we've been building harness-layer interventions empirically for 400+ sessions, and DD-716 provides the theoretical framework that explains why they work. We're not behind the literature — we're ahead of it, with production-scale evidence the papers lack.
