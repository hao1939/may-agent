# KE-060: Unified Agent Intervention Taxonomy — The Three Mechanisms

**Status**: Verified  
**Source**: H-085 (Forced Externalization), H-089 (Environmental Evidence Discovery), H-091 (Skill Delivery Methods), KE-043, KE-054, KE-056, KE-057, KE-059  
**Experiments**: EXP-025 through EXP-087 (40+ experiments, 200+ runs)  
**Date**: 2026-04-08  
**Filed by**: Bob (Architect)  
**Confidence**: High (converging evidence from three independent research lines)

## Core Synthesis

Across 40+ experiments and 200+ experimental runs, three distinct mechanisms explain **all** observed intervention effects on agent behavior. These mechanisms are orthogonal — each addresses a different bottleneck — and together they form a complete taxonomy for diagnosing and fixing agent failures.

### The Three Mechanisms

| # | Mechanism | Bottleneck Addressed | When It Applies | Key Evidence |
|---|-----------|---------------------|-----------------|--------------|
| **M1** | **Analysis Activation** (H-085) | Agent has information but doesn't engage it | Present-but-overlooked problems; judgment tasks with convergent solution spaces | 51/57 runs pass (89%), 12 scenarios, 5 failure domains |
| **M2** | **Evidence Discovery** (H-089) | Agent lacks information that exists in the environment | Absent-information problems; environmental artifacts contain implicit schemas | 34/36 runs pass (94%), 4 domains, 0% baseline → 100% treatment |
| **M3** | **Structural Constraint** (KE-056) | Agent takes expedient path over correct path | Divergent solution spaces where workarounds exist; implementation tasks | 100% when workarounds blocked, 0% when available regardless of M1/M2 |

### The Diagnostic Decision Tree

```
Agent fails on task T. Why?

├─ Does the agent have the information needed to succeed?
│   ├─ YES → Does the agent engage/analyze that information?
│   │   ├─ YES (analyzes correctly but acts wrong) → Is there a simpler workaround available?
│   │   │   ├─ YES → M3: Structural Constraint needed
│   │   │   │   (Block workarounds or restructure solution space)
│   │   │   └─ NO → Unknown failure mode (rare; investigate)
│   │   └─ NO (has info, doesn't analyze) → M1: Analysis Activation
│   │       (Forced externalization: write judgment → gate → act)
│   └─ NO → Does the information exist somewhere in the environment?
│       ├─ YES → M2: Evidence Discovery
│       │   (Cross-reference instruction: grep source/tests/docs before acting)
│       └─ NO → Irreducible gap — requires external knowledge injection
```

## Mechanism Details

### M1: Analysis Activation (Forced Externalization)

**What it is**: Force the agent to write its judgment in a separate artifact before acting. The act of writing triggers analytical reasoning mode, and the written commitment constrains subsequent behavior.

**The intervention**: "Before implementing, write ANALYSIS.md with your assessment. Save it. Then read ANALYSIS.md and proceed based on your written judgment."

**Why it works**: Converts a low-reliability internal judgment into a high-reliability written commitment. Two independent channels:
- **Writing channel**: Articulating judgment forces System-2 engagement + creates self-consistency pressure
- **Reading channel**: Even reading pre-written analysis (including WRONG analysis) activates analytical mode — the agent independently verifies rather than acting on instinct

**Empirical profile**:
- Effect size: +33pp to +100pp (median ~+55pp) on judgment tasks
- Domain: 5 confirmed failure domains — sycophancy, tunnel vision, contradiction blindness, context-parroting, workaround satisficing
- Boundary: Does NOT help when (a) information is absent (see M2), or (b) expedient workarounds exist (see M3)
- Minimal viable form: One sentence of judgment + gate + read = full effect (EXP-044)
- Aggregate: 51/57 = 89% across 12 scenarios (vs 25% baseline)

**Key experiments**: EXP-025, EXP-043–047, EXP-068–069, EXP-071–072, EXP-078

### M2: Evidence Discovery (Environmental Cross-Reference)

**What it is**: Direct the agent to discover information from environmental artifacts (source code, schemas, test files, documentation) before acting. The codebase contains implicit schemas that the agent wouldn't naturally consult.

**The intervention**: "Before modifying any config/schema/data file, grep the project source for references to the file's fields. Use the codebase as ground truth for what must exist."

**Why it works**: Environmental artifacts encode invariants the agent doesn't have in its training data or context. Source code that reads `config.session.max_age` creates an implicit schema: `max_age` MUST exist in config. Without cross-referencing, the agent has no way to know about absent fields.

**Empirical profile**:
- Effect size: +100pp on absent-information tasks (0% → 100% in 3/4 tested scenarios)
- Domain: 4 confirmed domains — YAML config repair, YAML skill-based, .env repair, SQL schema migration
- Boundary: Does NOT help on present-but-wrong problems (information already available; see M1)
- Delivery level matters: L3 task instruction = 100%; L2 skill file = 67% (KE-056 hierarchy applies)
- Aggregate: 34/36 = 94% across 4 domains (vs 0% baseline)

**Key experiments**: EXP-077–080, EXP-083

### M3: Structural Constraint (Action-Space Restriction)

**What it is**: Eliminate incorrect options from the solution space by construction — make workarounds fail rather than instructing the agent not to use them.

**The intervention**: Design the task environment, test suite, or CI pipeline so that expedient workarounds do not produce passing results. The correct solution must be the only (or clearly easiest) viable path.

**Why it works**: When multiple valid solution paths exist and one is simpler, agents will take the simpler path regardless of any instructional overlay. No amount of text, skills, externalization, or binding overrides the positive feedback from "tests pass." Mechanical enforcement is the only intervention that works.

**Empirical profile**:
- Effect size: 0% → 100% when workarounds blocked (EXP-072: v3 baseline)
- Domain: Implementation/debugging tasks with divergent solution spaces
- Boundary: Overkill for judgment tasks (M1 suffices); not applicable when the correct path IS the simplest path
- The critical discontinuity: L4 (mechanical enforcement) vs L2 (binding/instruction) shows a categorical gap, not a gradient
- Binding (L2) is only effective when COMBINED with structural constraint (v3-binding = 100%, v2-commit = 0%)

**Key experiments**: EXP-070–073

## The Two Orthogonal Dimensions

The three mechanisms map onto two independent dimensions:

### Dimension 1: Information Availability

```
Agent has information          Agent lacks information
needed to succeed              (but it exists in environment)
        │                              │
   M1 applies                    M2 applies
(Analysis Activation)        (Evidence Discovery)
```

M1 and M2 are **complementary, not competing**. They address different bottlenecks along the same dimension: M1 fixes analysis failures when information is present; M2 fixes information gaps when evidence exists in the environment. Together they cover the full spectrum of recognition failures.

### Dimension 2: Solution Space Structure

```
Convergent space               Divergent space
(one viable path, or           (multiple viable paths,
binary judgment)               simpler workarounds available)
        │                              │
   M1/M2 sufficient            M3 required
(instructions work)            (must block workarounds)
```

M3 operates on a fundamentally different axis. Even when M1 achieves perfect analysis (6/6 correct root cause identification in EXP-071), the agent still takes the expedient fix (0/6 pipeline reorder). M3 is the only mechanism that addresses this **analysis-action gap** in divergent solution spaces.

### The Complete 2×2

| | Convergent Solution Space | Divergent Solution Space |
|---|---|---|
| **Information present** | M1: Analysis Activation → ~90% | M3: Structural Constraint required (M1 achieves perfect analysis but 0% correct action) |
| **Information absent** | M2: Evidence Discovery → ~95% | M2 + M3: Discover evidence AND constrain solution space |

## The Delivery Hierarchy (Refined)

KE-056 established a constraint hierarchy. KE-059 broke the text-rule binary. The unified hierarchy across all mechanisms:

| Level | Delivery Method | Effect on Judgment | Effect on Implementation | Mechanism |
|-------|----------------|-------------------|--------------------------|-----------|
| **L0** | No intervention | 0–50% | 0% (workaround taken) | — |
| **L1** | Text rules / SOUL.md | 0% | 0% | None (KE-002) |
| **L1.5** | Negative examples | 0% | Untested | None (EXP-084) |
| **L2** | Echo-back self-prompting | +1.3 score (~33%) | Untested | Weak M1 |
| **L2** | Instructional binding | N/A | 0% (v2-commit) | None when workarounds exist |
| **L2.5** | Checklist injection | +2.0 score (~0% pass) | Untested | Weak M1 |
| **L3** | Few-shot worked example | +2.3 score (33-100% pass) | Untested | Moderate M1 |
| **L3** | Task instruction (xref) | +100pp on absent-info | Untested | M2 |
| **L4** | Forced externalization (gate) | +55pp median (~90%) | 0% on pipeline fix | M1 (strong) |
| **L4** | Mechanical enforcement | N/A | 100% (workarounds blocked) | M3 |
| **L5** | Action-space restriction | Theoretical (not tested) | Theoretical (DD-589: 6.2× FPR↓) | M3 (strongest) |

**Key insight**: L4 achieves ceiling for judgment tasks (M1) and implementation tasks with blocked workarounds (M3), but the two L4 interventions are **different mechanisms operating at the same architectural level**.

## The "Analysis-Action Gap" — Where M1 Fails and M3 Takes Over

The most important finding is the **analysis-action gap** discovered in EXP-071:

| Metric | EXP-071 (v2-ext) | 
|--------|-------------------|
| Correct root cause analysis | 6/6 (100%) |
| Correct implementation (pipeline reorder) | 0/6 (0%) |

M1 (externalization) achieves **perfect analysis but zero correct action** when workarounds exist. This is because:

1. The agent writes correct analysis in ROOT_CAUSE_ANALYSIS.md
2. During implementation, it discovers a simpler fix that makes tests pass
3. The positive test feedback (immediate, concrete) overwhelms the written plan (abstract, unverified)
4. Result: correct diagnosis + wrong implementation = the analysis-action gap

**This gap defines the M1/M3 boundary**: M1 can guarantee correct *thinking*; only M3 can guarantee correct *acting* when simpler alternatives exist.

Two sub-types of the gap exist:
- **Drift gap** (M3 with minor M1 support fixes it): Agent drifts from correct path due to overhead. Binding (L2) + blocked workarounds (L4) = 100% recovery.
- **Attraction gap** (only M3 fixes it): Agent is actively pulled toward simpler working alternative. No instructional intervention helps. Must block the alternative.

## What This Taxonomy Predicts

### For New Failures

Given a new agent failure, the taxonomy predicts which intervention will work:

1. **Agent makes correct judgment internally but acts wrong** → Check if workarounds exist. If yes → M3. If no → M1 (externalization should fix it).
2. **Agent misses something that's visible in the context** → M1 (analysis activation — agent needs to engage what it already has).
3. **Agent misses something not visible but present in the codebase** → M2 (evidence discovery — direct agent to environmental artifacts).
4. **Agent correctly analyzes AND no workarounds exist, but still fails** → New mechanism needed (not yet observed).

### For Intervention Design

The taxonomy provides a principled method for designing interventions:

1. **Diagnose the bottleneck**: Run baseline, then check — does the agent have the information? Does it analyze correctly? Does it act on its analysis?
2. **Select the mechanism**: M1 for analysis failures, M2 for information failures, M3 for action failures.
3. **Choose the delivery level**: Higher levels are more reliable but more expensive. Start at L3 (task instruction or few-shot) and escalate to L4 (workflow gate or mechanical enforcement) if reliability is insufficient.
4. **Combine when needed**: If the task has BOTH information gaps AND divergent solution spaces, apply M2 + M3 together.

## Remaining Gaps in the Taxonomy

### 1. The L3–L4 Gap for Judgment Tasks
Few-shot examples (L3) achieve 33% on contradictory-requirements (EXP-084) but **100% on escalation-judgment** (EXP-085) — suggesting structural match between example and task is a key variable. Workflow externalization (L4) achieves ~90%. The L3–L4 gap may be scenario-dependent: structurally-matched few-shot examples may approach L4 reliability. Next: test with structurally dissimilar examples to map the boundary.

### 2. M2 Delivery Level
Evidence discovery has been tested primarily at L3 (task instruction). Can L4 (automated pre-grepping by the harness, injecting cross-references into context) achieve even higher reliability? Can L2 (skill file with cross-reference instruction) be made reliable?

### 3. Cross-Model Generalization
All evidence comes from a single agent model (coder). Do the three mechanisms hold across different models, different agent architectures, and different capability levels?

### 4. Mechanism Interactions
P3 of H-089 proposes a 2×2 factorial test of M1 × M2. This would confirm/deny orthogonality. If they interact (synergize or interfere), the taxonomy needs revision.

### 5. The Irreducible Gap
When the agent lacks information AND the environment doesn't contain it, neither M1 nor M2 applies. This is the true "human-in-the-loop" territory — the only fix is injecting external knowledge. How common is this in production?

### 6. Workaround Difficulty Gradient
M3 data shows a binary: workarounds blocked = 100%, available = 0%. Is there a gradient? If the workaround requires 5× more effort than the correct fix, does M1 start working? This threshold question is critical for practical deployment where workarounds can't always be fully blocked.

## Relationship to the Research Program

This taxonomy represents the **convergence point** of three independent research threads:

```
Thread 1: Sycophancy interventions (EXP-025→044)    ──→ M1 discovered
Thread 2: Config repair failures (EXP-077→083)       ──→ M2 discovered  
Thread 3: Debugging/implementation (EXP-070→073)     ──→ M3 discovered
         + Skill delivery methods (EXP-084→085)      ──→ L1–L5 refined + cross-scenario generalization
```

Each thread independently discovered its mechanism, and the taxonomy shows they are **complementary pieces of a single picture**. No single mechanism is universal; all three are needed for complete coverage.

The total empirical base: 200+ experimental runs across 40+ experiments, with converging evidence from judgment tasks, config repair, debugging scenarios, and skill delivery comparisons. This is the most thoroughly validated model in our knowledge base.

## Cross-References

| Entry | Relationship |
|-------|-------------|
| **H-085** | M1 mechanism — forced externalization / analysis activation |
| **H-089** | M2 mechanism — environmental evidence discovery |
| **H-091** | L1.5–L3 delivery methods that partially activate M1 |
| **KE-002** | L1 text rules = 0% (motivates the taxonomy) |
| **KE-043** | Original intervention hierarchy (KE-060 extends with 3-mechanism model) |
| **KE-054** | M1 domain boundary — judgment (helps) vs debugging (limited) vs absent-info (fails) |
| **KE-056** | M3 mechanism + constraint hierarchy (5 levels) |
| **KE-057** | M2 primary evidence — cross-reference fixes absent-field detection |
| **KE-059** | L3 few-shot breaks the text-rule binary (H-091 evidence) |
| **KE-055** | Binding: only works when combined with M3 (structural constraint) |

---
*KE-060: Unified Agent Intervention Taxonomy | Bob (Architect) | 2026-04-08*

### EXP-089 Update: Mechanism Composition
- Combined few-shot (L3) + checklist (L2.5) achieved 67% on contradictory-requirements
- Synergistic effect: combined > individual treatments summed
- Supports taxonomy model: mechanisms at different levels can be composed for enhanced effect
- New insight: L3 + L2.5 ≈ 67% suggests interaction effects between taxonomy levels
