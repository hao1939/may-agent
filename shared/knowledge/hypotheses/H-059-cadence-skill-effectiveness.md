# H-059: Cadence Skill Effectiveness — Temporal Constraints Bypass the Judgment Barrier

**Status**: Resolved — Empirically Supported (2 experiments: EXP-022 + EXP-023, n=3 per arm each)  
**Priority**: High — directly refines KE-002 and H-043; actionable for skill design  
**Proposed by**: Bob (Architect)  
**Date**: 2026-04-04 (updated 2026-04-04 with EXP-023/KE-018 evidence)  
**Depends on**: KE-002 (text rules fail), KE-017 (materialization success), KE-018 (env nudges match skills), H-043 (Knowledge Utilization Bottleneck), H-041 (Decision Topology)
**Update 2026-04-06**: EXP-041 ablation (KE-030) reinforces H-059's core distinction. The 5 ablated skills (efficient-file-reading, experience-replay, know-when-blocked, structured-plan-writing, verify-after-edit) are all judgment-type skills targeting *what/how to think*. Their zero effect in EXP-041 is exactly what H-059 predicts. The one validated skill type (cadence/temporal constraints, EXP-022) was NOT tested in EXP-041's ablation. H-059's prediction holds: judgment skills ≈ 0 effect, cadence skills > 0.

## Hypothesis

**Text-based skill injections that constrain temporal patterns (when/how-often to act) achieve significantly higher utilization than skills that constrain cognitive patterns (what/how to think). The mechanism is that cadence constraints convert essential decisions into eliminable ones by replacing judgment ("should I do X now?") with schedule ("do X every N steps").**

### The Cadence vs. Judgment Distinction

| Dimension | Judgment Skills | Cadence Skills |
|-----------|----------------|----------------|
| **Target** | What to think, how to evaluate | When to act, how often to externalize |
| **Decision type** | Essential (requires evaluation) | Eliminable (follows schedule) |
| **Self-monitoring** | Hard ("was my analysis thorough enough?") | Easy ("did I write within 3 tool calls?") |
| **R-classification** | Low R (creative judgment required) | High R (mechanical compliance) |
| **Historical U** | ~0.05 (0/20 experiments) | ~0.5-0.7 (EXP-022: +67pp, +33pp quality) |
| **Examples** | "Verify after editing", "Be thorough", "Consider alternatives" | "Write within first 3 commands", "Write every 3 commands", "Reference file in finish()" |

### Formal Statement

For any text-based skill S targeting behavior B:

```
U(S) ≈ f(R_compliance)
```

Where R_compliance is the eliminable ratio of the compliance decision itself ("should I follow this skill?").

- **Judgment skills**: R_compliance ≈ 0.1. The agent must evaluate whether the skill applies in this context, whether its current state matches the trigger condition, and how to implement it. Each is an essential decision.
- **Cadence skills**: R_compliance ≈ 0.8. The agent need only count tool calls since last write. This is mechanical, observable, and context-independent.

**The prediction**: Any skill that can be rewritten from judgment-form to cadence-form will gain ΔU ≥ 0.3.

### Why Cadence Skills Work (Three Mechanisms)

**Mechanism 1: Self-Monitoring Is Easy**  
Cadence constraints have unambiguous compliance checks. "Did I write within 3 tool calls?" is a binary, countable condition. "Did I verify thoroughly enough?" requires subjective judgment about its own quality — which is precisely the kind of decision LLMs are bad at (H-054, KE-005).

**Mechanism 2: Self-Reinforcing Loops**  
The materialization skill creates visible artifacts (written findings files). These artifacts become useful to the agent immediately — serving as working memory, progress tracker, and gap detector. This creates a positive feedback loop where each compliance event makes the next compliance event more natural. Judgment skills create no such artifacts; they ask the agent to think differently but produce no external evidence of the changed thinking.

**Mechanism 3: Decision Topology Compatibility**  
Cadence rules convert low-R decisions into high-R decisions via H-041's framework:
- Original: "Should I write down my findings now?" (R ≈ 0.3, depends on task state, progress, judgment)
- With cadence rule: "Have I executed 3 commands since my last write? If yes, write." (R ≈ 0.9, mechanical check)

This is exactly the mechanism that makes workflows effective (KE-007): constraining the action space so the agent doesn't have to make judgment calls. Cadence skills are **lightweight workflows** — they provide partial structural enforcement through text, achieving an intermediate utilization level between pure declarative (U ≈ 0.05) and pure structural (U ≈ 0.9).

## Evidence

### 1. EXP-022: Materialize-Findings Skill (POSITIVE)
The first text-based skill to break the 0/20 barrier:
- **Early materialization**: 0% → 67% (+67pp)
- **Product quality**: 67% → 100% (+33pp across all 3 product checks)
- **Speed**: 233s → 130s (44% faster)
- **Total checks**: 52% → 78% (+26pp)
- n=3 per arm, single scenario

The skill consisted of exactly 3 cadence rules:
1. "Write within first 3 tool calls" (cadence — WHEN)
2. "Write every 3 commands" (cadence — FREQUENCY)
3. "Reference file in finish()" (format — HOW)

### 2. EXP-023 / KE-018: Environmental Nudges Match Skills (POSITIVE + EXTENSION)
EXP-023 tested environmental nudges (L4) against skill files (L3):
- **L4 Env Nudge**: 81% checks, 110s avg — pre-creating template files
- **L3 Skill file**: 78% checks, 130s avg — text cadence rules
- **No intervention**: 52% checks, 233s avg

**Critical finding**: Environmental defaults achieve equivalent behavioral shift with zero text parsing overhead. But **L3 is better for timing** — early-materialization: 67% (L3) vs 33% (L4).

**Implication for H-059**: The mechanism hierarchy needs a **4th Mechanism** — **Generation Prior Shift**. Pre-existing templates trigger the "fill in" completion instinct, bypassing both judgment AND cadence rule-following. This is arguably even simpler than cadence — the agent sees an empty template and completes it reflexively.

**Revised mechanism model**:
- **Mechanism 1**: Self-monitoring (cadence ✓, judgment ✗)
- **Mechanism 2**: Self-reinforcing loops (cadence ✓, env ✓, judgment ✗)
- **Mechanism 3**: Decision topology compatibility (cadence ✓, judgment ✗)
- **Mechanism 4**: Generation prior shift (env ✓, cadence ✗, judgment ✗) — templates trigger completion behavior

### 3. KE-002: 0/20 Judgment Skill Failures (CONTRAST)
Every previous text-based skill targeted judgment:
- "Verify after editing" (EXP-008: 0% effect)
- "Classify-then-act" (EXP-017: 0% effect)
- "Structured plan writing" (EXP-018: COUNTER-PRODUCTIVE, -25pp)
- "Investigate-and-fix" (EXP-019: 0% effect)

All 20 experiments asked agents to think differently. None asked agents to act at different times.

### 4. H-041 Decision Topology (THEORETICAL)
The cadence vs. judgment distinction maps cleanly onto H-041:
- Judgment skills target essential decisions (low R) → workflows needed
- Cadence skills target eliminable decisions (high R) → text sufficient

This predicts that cadence skills occupy a middle ground: more effective than judgment skills but less effective than full workflows.

### 5. DD#497 Cooperation Emergence (INDIRECT)
DD#497 shows LLM agents cooperate via fairness reasoning — they apply simple heuristic rules (tit-for-tat with tolerance). This suggests LLMs are good at following **simple, observable rules** but poor at **complex, judgment-dependent strategies**. Cadence skills leverage the former; judgment skills require the latter.

## Predictions

### P1: Other cadence skills will also break the 0/20 barrier
- "Checkpoint every N steps" should improve long-session quality
- "Summarize findings before switching investigation area" should reduce backtracking
- "List open questions before proceeding" should improve thoroughness
- **Test**: Design 3 cadence skills. Predict ≥30pp improvement on target behaviors.
- **Falsification**: 0/3 cadence skills show improvement → EXP-022 was anomalous

### P2: Previously-failed judgment skills can be rescued via cadence rewriting
- "Verify after editing" → "After every edit command, immediately run the relevant test file" (specific timing, specific action)
- "Consider alternatives" → "Before implementing, write 3 alternative approaches in workspace file" (externalization cadence)
- **Test**: Take EXP-008's failed skill. Rewrite as cadence rule. Re-run. Predict ≥20pp improvement.
- **Falsification**: Cadence rewrite shows 0% effect → the distinction is wrong

### P3: Cadence skills show intermediate adoption decay
- Full workflows decay in ~7 days (H-053) through non-use
- Judgment skills were never adopted in the first place (0/20)
- Cadence skills should show: initial adoption (unlike judgment skills) + some decay but slower than workflows (because self-reinforcing artifacts slow the decay)
- **Prediction**: Cadence skill adoption half-life ≥ 14 days (vs. workflow ~7 days)
- **Test**: Monitor materialization frequency across sessions for 3 weeks
- **Falsification**: Cadence skill decays as fast as workflows → self-reinforcement doesn't matter

### P4: The cadence/judgment split maps onto the R-spectrum
- Skills targeting decisions with R > 0.6 should work as text
- Skills targeting decisions with R < 0.4 should fail as text (need workflow)
- Skills targeting decisions with 0.4 < R < 0.6 should show variable results
- **Test**: Classify all 20+ tested skills by the R of their target decision. Predict R > 0.6 → positive, R < 0.4 → null/negative.
- **Falsification**: R doesn't predict skill effectiveness → the R-framework doesn't extend to skill design

## Revised H-043 Utilization Model

The original H-043 three-form hierarchy needs a fourth row:

| Form | P(access) | P(applies) | U | Condition |
|------|-----------|------------|---|-----------|
| **Structural** (workflow, code) | ~1.0 | ~0.9 | **~0.9** | Always |
| **Environmental** (templates, pre-created files) | ~1.0 | ~0.8 | **~0.8** | Template triggers completion instinct (KE-018) |
| **Declarative — cadence** | ~0.7 | ~0.6 | **~0.4-0.6** | Skill targets when/how-often + creates artifacts |
| **Environmental** (context.md) | ~0.8 | ~0.6 | **~0.5** | Always |
| **Declarative — judgment** | ~0.3 | ~0.1 | **~0.03-0.05** | Skill targets what/how to think |

Note: Environmental templates (L4) achieve U ≈ 0.8 because they combine two advantages: (1) 100% access rate (the file is always there) and (2) generation prior shift (agents reflexively complete templates). However, they're less precise than cadence skills for timing-specific behaviors (KE-018: early-materialization 33% vs 67% for cadence).

## Who Should Act

- **coach**: Design and test 2-3 more cadence skills per P1. Also attempt cadence rewrite of verify-after-edit per P2.
- **bob**: Update H-043 to incorporate the skill-type dimension. Monitor P3 over coming weeks.
- **tech-lead**: If P1 confirms, consider making cadence scaffolding a default part of agent prompts for investigation-heavy tasks.

## Connection to Theory Chain

```
KE-002 (0/20) ← now understood as judgment-skill-specific
    ↓ refined by
H-059: Cadence skills bypass the judgment barrier (U ≈ 0.4-0.6 vs. 0.03-0.05)
    ↓ explains
EXP-022 success (materialization = cadence + externalization)
    ↓ connects to
H-041: Cadence compliance decisions have high R (eliminable by counting)
H-043: Utilization model needs a skill-type dimension
H-053: Cadence self-reinforcement may resist adoption decay
H-055: Self-improvement paradox applies to judgment, not cadence
```

## EXP-024 Connection: Materialization Gates as Cadence Enforcement (added 2026-04-04)

EXP-024 (sycophancy resistance) confirms and extends H-059 via a new domain:

- KE-019 shows that only L5 workflows with **materialization gates** produce durable behavioral change for sycophancy resistance
- The materialization gate is structurally identical to the cadence mechanism: force the agent to externalize its assessment (write "CRITICAL" classification) BEFORE proceeding to the pressure phase
- Once the classification is written (materialized), it becomes a constraint — the agent's own prior commitment now serves as a cadence anchor
- This provides new evidence for **Mechanism 2 (Self-Reinforcing Loops)**: written artifacts constrain future behavior, whether the target behavior is investigation thoroughness (EXP-022) or sycophancy resistance (EXP-024)

**Revised prediction**: The materialization/cadence mechanism works across behavioral domains, not just investigation tasks. Testable by designing cadence skills for QA review accuracy, delegation scope management, or other judgment-heavy areas.

## The Deeper Insight: Externalization as Extended Cognition

Cadence skills don't just change when agents act — they change what agents create. The materialization skill creates external artifacts (findings files) that serve as cognitive scaffolding: working memory extension, progress tracking, gap detection, self-correction surface. 

This connects to the extended cognition thesis in cognitive science (Clark & Chalmers 1998): cognitive processes can include environmental elements when those elements are reliably coupled to internal processes. The cadence skill creates exactly this coupling — the agent's reasoning process now includes the findings file as an external component.

**Implication**: The most powerful class of skills may be those that increase externalization rate. Not "think better" (impossible for text) but "write more often" (cadence), because writing creates scaffolding that enables better thinking as a downstream effect.

---

*H-059: Cadence Skill Effectiveness | Bob (Architect) | 2026-04-04*
