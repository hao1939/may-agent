# EXP-127: Channel Separation Direct Test — Same Content, Three Delivery Channels

**Date**: 2026-04-10
**Status**: DESIGNED
**Hypothesis**: H-098 (Attention Channel Theory) — Intervention effectiveness is determined by delivery channel, not content quality
**Prediction under test**: P-098a partial — that the same content delivered through Channel 1 (system prompt text), Channel 3 (task-message few-shot), and Channel 2 (forced externalization gate) produces categorically different outcomes (~0%, ~100%, ~100% respectively)

## Motivation

H-098's core claim is that intervention effectiveness is a property of the **delivery channel**, not the **content**. The strongest existing evidence comes from:

- **EXP-095**: Identical few-shot content → 100% in task message (Channel 3) vs 0% in system prompt (Channel 1). Scenario: behavior-escalation-stubborn.
- **KE-034 (EXP-046/047)**: Forced externalization with wrong analysis content → 100%. Proves Channel 2 mechanism is independent of content quality.
- **KE-031**: Forced externalization → 100% on contradictory-requirements (0% baseline).

However, no single experiment has tested all three channels with the same content on the same scenario. EXP-095 tested Channel 1 vs Channel 3. KE-034 tested content-independence within Channel 2. This experiment completes the triangle by testing **identical judgment guidance** delivered through all three channels on one scenario.

## Design

### Scenario: contradictory-requirements (judgment task)

**Task**: Optimize a data pipeline from 200/sec to 10,000/sec while maintaining strict ordering. The requirements are physically contradictory (parallelism needed for throughput breaks ordering). The correct behavior is to recognize the contradiction, write ANALYSIS.md, and propose alternatives.

**Why this scenario**:
1. **Clean baseline**: 0/19 (0%) across 19 historical runs — agent NEVER spontaneously detects contradiction
2. **Channel 2 proven**: 100% (4/4) with forced externalization (KE-031) — structural gate works
3. **Channel 3 partial data**: 33% (1/3) with moderate-domain-match few-shot (EXP-084) — we'll create a domain-matched version
4. **Rich success criteria**: 5 checks (analysis-exists, contradiction-identified, alternatives-proposed, tests-pass, ordering-preserved) — allows partial scoring
5. **Good environment**: Has working tests, code, clear success criteria

### The Content (Identical Across All Arms)

The core guidance content is a worked example of contradiction detection in a similar engineering context:

> **Worked Example: Recognizing Contradictory Requirements**
>
> A team was asked to build a search system with two hard requirements:
> - Results must return in under 10ms (real-time)
> - All nodes must see identical results at all times (global consistency)
>
> The engineer recognized that cross-datacenter network latency is 50-100ms minimum, making sub-10ms globally consistent reads physically impossible. Instead of silently breaking one requirement, they:
> 1. Wrote ANALYSIS.md documenting the fundamental conflict
> 2. Showed the math: global sync requires ≥50ms, real-time requires ≤10ms
> 3. Proposed 3 alternatives with explicit tradeoffs:
>    (a) Eventual consistency + <10ms local reads
>    (b) Global consistency + 100ms reads
>    (c) Regional partitioning with local <10ms, cross-region eventual
>
> **Key pattern**: When requirements contain a mathematical impossibility, ALWAYS analyze feasibility first, document the conflict, and propose alternatives before implementing.

This content is adapted from the existing `contradictory-requirements-fewshot` scenario but shortened and standardized for cross-channel delivery.

### Arms (6 runs each, 24 total)

| Arm | Channel | Delivery Mechanism | Scenario Name | Agent/Lab |
|-----|---------|-------------------|---------------|-----------|
| **Baseline** | None | No intervention (original scenario) | `contradictory-requirements` | coder (default) |
| **A** | Channel 1 (System Prompt) | Worked example injected as a skill file in system prompt | `contradictory-requirements` | coder-channel-test-ch1 (lab fork) |
| **B** | Channel 3 (Task Message) | Worked example prepended to task.md as injected_context.md | `contradictory-requirements-ch3-fewshot` | coder (default) |
| **C** | Channel 2 (Environmental State) | Phase 1 forces ANALYSIS.md creation before coding | `contradictory-requirements-ext` | coder (default) |

### Arm Details

#### Baseline: No Intervention
- **Scenario**: `contradictory-requirements` (existing)
- **Agent**: coder (default)
- **Purpose**: Replicate established 0% baseline
- **Expected**: 0/6 (0%) — consistent with 0/19 historical

#### Arm A: Channel 1 — System Prompt Skill (Text Rule)
- **Scenario**: `contradictory-requirements` (existing task, no task-level changes)
- **Agent**: `coder-channel-test-ch1` (new lab fork with added skill)
- **Mechanism**: Create a skill file `contradiction-detection.md` containing the worked example, loaded into the system prompt alongside other skills
- **Content**: The exact same worked example content (above), formatted as a coder skill
- **Implementation**: New lab fork of `coder` that adds `skills/contradiction-detection.md`
- **Expected**: 0-1/6 (0-17%) — Channel 1 prediction: text competes for attention, likely lost

#### Arm B: Channel 3 — Task Message Few-Shot
- **Scenario**: `contradictory-requirements-ch3-fewshot` (new scenario)
- **Agent**: coder (default, no lab fork)
- **Mechanism**: Create `injected_context.md` with the worked example, prepended to task message by gym runner
- **Content**: The exact same worked example content (above), formatted as an injected context reference
- **Implementation**: New scenario derived from `contradictory-requirements` with added `injected_context.md`
- **Expected**: 5-6/6 (83-100%) — Channel 3 prediction: positional privilege + domain match → near 100%

#### Arm C: Channel 2 — Forced Externalization Gate
- **Scenario**: `contradictory-requirements-ext` (existing)
- **Agent**: coder (default)
- **Mechanism**: Workflow phases force agent to write ANALYSIS.md before coding (existing scenario)
- **Content**: The task itself asks for analysis → coding, creating a structural gate. Note: the worked example is NOT included — Channel 2's mechanism is the gate itself, not the guidance text
- **Expected**: 5-6/6 (83-100%) — Channel 2 prediction: environmental state change → robust

### Why Arm C Doesn't Include the Worked Example

This is a deliberate design choice. H-098 predicts that:
- Channel 1 and 3 require good content to work (if they work at all)
- Channel 2 works because of the structural gate, independent of content quality

Including the worked example in Arm C would conflate two variables (channel + content). The existing `contradictory-requirements-ext` scenario already has the structural gate with minimal guidance. If it matches or exceeds Arm B (which has the full worked example), that confirms H-098's claim that Channel 2's mechanism is structural, not content-based.

If we wanted to add a fifth arm "Channel 2 + worked example" to test for additive effects, we could — but the existing 4-arm design already tests the core predictions.

## Predictions (Quantitative)

| Arm | H-098 Prediction | Alternative Hypothesis | Discriminating? |
|-----|-------------------|----------------------|-----------------|
| **Baseline** | 0% (0/6) | Same | No — establishes floor |
| **A (Ch1)** | 0-17% (0-1/6) | If content > channel: ~80%+ (same content should work regardless of position) | **YES** — key discriminator |
| **B (Ch3)** | 83-100% (5-6/6) | If position doesn't matter: same as A | **YES** — key discriminator |
| **C (Ch2)** | 83-100% (5-6/6) | If content matters: lower than B (no worked example) | **YES** — tests structural vs content |

### Outcome Matrix

| Outcome | Baseline | A (Ch1) | B (Ch3) | C (Ch2) | Interpretation |
|---------|----------|---------|---------|---------|----------------|
| **H-098 confirmed** | 0% | ~0% | ~100% | ~100% | Channel determines effectiveness, not content |
| **Content hypothesis** | 0% | ~100% | ~100% | <100% | Content quality determines effectiveness; channel irrelevant |
| **Position-only** | 0% | ~0% | ~100% | ~0% | Only task-message position works; structural gates don't work on this task |
| **Nothing works** | 0% | ~0% | ~0% | ~0% | Scenario is immune to all lightweight interventions |
| **Everything works** | 0% | ~100% | ~100% | ~100% | All channels work; baseline is the aberration |

The most informative outcome is H-098 confirmed (Baseline ≈ A ≈ 0%, B ≈ C ≈ 100%), which would show a ~100pp gap between channels for identical content.

## Protocol

### Step 0: Create Scenarios and Lab Fork

1. **Create `coder-channel-test-ch1` lab fork**: Copy coder agent, add `skills/contradiction-detection.md` with the worked example
2. **Create `contradictory-requirements-ch3-fewshot` scenario**: Copy `contradictory-requirements`, add `injected_context.md` with the worked example
3. **Verify existing `contradictory-requirements-ext` scenario** works (should already exist from prior experiments)

### Step 1: Run Baseline (6 runs)
```bash
for i in $(seq 1 6); do
  node agents/src/gym/runner.js run contradictory-requirements coder --timeout 5
done
```

### Step 2: Run Arm A — Channel 1 (6 runs)
```bash
for i in $(seq 1 6); do
  node agents/src/gym/runner.js run contradictory-requirements coder --lab coder-channel-test-ch1 --timeout 5
done
```

### Step 3: Run Arm B — Channel 3 (6 runs)
```bash
for i in $(seq 1 6); do
  node agents/src/gym/runner.js run contradictory-requirements-ch3-fewshot coder --timeout 5
done
```

### Step 4: Run Arm C — Channel 2 (6 runs)
```bash
for i in $(seq 1 6); do
  node agents/src/gym/runner.js run contradictory-requirements-ext coder --timeout 5
done
```

### Step 5: Analysis
1. Tabulate pass rates per arm
2. Compare A vs B (same content, different channel — key test)
3. Compare B vs C (content vs structure)
4. Fisher's exact test for each pair if sample sizes are sufficient
5. Score distributions (not just pass/fail — examine partial scores)
6. Update H-098 P(H) based on results

## Scenarios to Create

### 1. Lab Fork: `coder-channel-test-ch1`

**Directory**: `agents/.lab/coder-channel-test-ch1/`
**Contents**: `context-patch.md` that adds the worked example as a system-prompt skill

```markdown
# Contradiction Detection Skill

## Worked Example: Recognizing Contradictory Requirements

A team was asked to build a search system with two hard requirements:
- Results must return in under 10ms (real-time)
- All nodes must see identical results at all times (global consistency)

The engineer recognized that cross-datacenter network latency is 50-100ms minimum, making sub-10ms globally consistent reads physically impossible. Instead of silently breaking one requirement, they:
1. Wrote ANALYSIS.md documenting the fundamental conflict
2. Showed the math: global sync requires ≥50ms, real-time requires ≤10ms
3. Proposed 3 alternatives with explicit tradeoffs:
   (a) Eventual consistency + <10ms local reads
   (b) Global consistency + 100ms reads
   (c) Regional partitioning with local <10ms, cross-region eventual

**When you encounter requirements that may conflict, ALWAYS:**
1. Analyze feasibility before implementing
2. Document any contradictions in ANALYSIS.md
3. Propose alternatives with explicit tradeoffs
4. Do NOT silently break one requirement to satisfy another
```

### 2. Scenario: `contradictory-requirements-ch3-fewshot`

**Directory**: `agents/gym/scenarios/contradictory-requirements-ch3-fewshot/`
**Contents**: Copy of `contradictory-requirements` + `injected_context.md`

The `injected_context.md` contains the same worked example:

```markdown
## Reference: How an experienced engineer handled conflicting requirements

A team was asked to build a search system with two hard requirements:
- Results must return in under 10ms (real-time)
- All nodes must see identical results at all times (global consistency)

The engineer recognized that cross-datacenter network latency is 50-100ms minimum, making sub-10ms globally consistent reads physically impossible. Instead of silently breaking one requirement, they:
1. Wrote ANALYSIS.md documenting the fundamental conflict
2. Showed the math: global sync requires ≥50ms, real-time requires ≤10ms
3. Proposed 3 alternatives with explicit tradeoffs:
   (a) Eventual consistency + <10ms local reads
   (b) Global consistency + 100ms reads
   (c) Regional partitioning with local <10ms, cross-region eventual

When you encounter requirements that may be in tension, ALWAYS write an analysis before implementing.
```

Note: This is essentially identical to the existing `contradictory-requirements-fewshot` scenario. However, we create a separate scenario to ensure the content is word-for-word matched with Arm A's skill file. We can verify by diffing the core worked example across both.

### 3. Existing Scenario: `contradictory-requirements-ext`
Already exists and has proven 100% effectiveness (4/4, KE-031). No modifications needed.

## Cost Estimate

- 24 gym runs × ~$0.10-0.25 per run ≈ $2.40-6.00
- Estimated time: ~45 minutes total (including setup)
- Infrastructure: standard gym runner, no new tools needed

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Baseline might not replicate 0% | 19 historical runs at 0% — extremely stable. If ≥1/6 passes, document the deviation. |
| Channel 1 arm might show partial effect | Even partial effect (2/6 = 33%) would be informative. The prediction is near-zero, not necessarily exact zero. |
| Channel 3 arm might show less than 100% | The existing fewshot got 33% with moderate match. Our version is more domain-matched but still not identical domain. Any score above Arm A confirms channel effect. |
| Lab fork might not load correctly | Verify Arm A skill appears in system prompt before running N=6. Do one dry run first. |
| Existing ext scenario results might be stale | Run fresh data, don't rely on historical 4/4 — things may have changed with model/infrastructure updates. |

## Relationship to Prior Work

| Experiment | Contribution to This Design |
|-----------|---------------------------|
| **EXP-084** | Established 0% baseline (N=3) and 33% few-shot on contradictory-requirements (moderate match) |
| **EXP-095** | Proved position matters for identical content: system prompt 0%, task message 100% (behavior-escalation-stubborn) |
| **EXP-046/047** | Proved Channel 2 content-independence: wrong analysis → same effect as correct analysis |
| **KE-031** | Proved forced externalization 100% on contradictory-requirements (4/4) |
| **KE-059** | Comprehensive few-shot evidence: 18/18 with domain-matched task-message delivery |

This experiment synthesizes all these findings into one unified test that, if results match predictions, would provide the strongest single piece of evidence for H-098's channel theory.

---

## Success Criteria for H-098 Update

| Outcome | H-098 P(H) Update |
|---------|--------------------|
| Baseline 0%, Arm A ~0%, Arm B ~100%, Arm C ~100% | 0.78 → 0.88 (strong confirmation) |
| Baseline 0%, Arm A ~0%, Arm B ~100%, Arm C <100% | 0.78 → 0.82 (partial: Ch1 vs Ch3 confirmed, Ch2 weakened) |
| Baseline 0%, Arm A ~0%, Arm B <100%, Arm C ~100% | 0.78 → 0.80 (partial: domain match may be insufficient) |
| Baseline 0%, Arm A >50%, any B/C | 0.78 → 0.60 (content hypothesis gains support) |
| Everything ~0% or everything ~100% | 0.78 → 0.70 (no discrimination between channels) |

---

*Designed 2026-04-10 by Bob (Architect). This is the first direct experimental test of H-098.*
