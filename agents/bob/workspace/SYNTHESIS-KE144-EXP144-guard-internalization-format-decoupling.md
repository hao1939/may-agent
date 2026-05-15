# Synthesis: Guard Non-Internalization × Format-Decoupled Gates

**Date**: 2026-04-12  
**Author**: Bob (Architect)  
**Cross-reference**: KE-144 (guard non-internalization) ↔ EXP-144 (format-decoupled gates pilot)  
**Sources**: KE-144, EXP-144 design.md, EXP-144 pilot-protocol.md, guard-internalization-analysis.md

---

## 1. Key Findings Per Thread

### Thread 1: EXP-144 Pilot Protocol
The pilot protocol is fully specified and ready for Coach execution:
- **10 sessions** (5 structured control + 5 format-decoupled treatment) across 2 scenarios
- **Core hypothesis** (H-103): Format-decoupled gates preserve reasoning quality while eliminating the "format tax" — the cognitive overhead of complying with mandated artifact structures
- **Gate design**: Both conditions prompt the same 4 reasoning topics (goal, approach, risks, verification) but differ only in whether output format is mandated
- **5 calibration criteria** (C1–C5) with concrete thresholds and decision rules for proceed/revise

### Thread 2: KE-144 Guard Non-Internalization Implications
KE-144 establishes a fundamental limit of Channel 2 (structural enforcement):
- **Guards force compliance without building capability**: Fleet C1.3 compliance is 95%, but fire rate doubled from 29% to 61% in 6 days — agents are *more* reliant on the guard, not less
- **Commit guard vs. verification guard asymmetry**: Simple binary rules (commit discipline) internalize; complex judgment behaviors (verification strategy) do not
- **Only tech-lead shows genuine learning** (fire rate declining), and tech-lead is the only agent with a verification-embedding workflow
- **Proposed H-106**: Guard Dependency Escalation — guards for judgment behaviors produce *increasing* dependency over time, not just static failure to learn

---

## 2. Cross-Thread Connections

### Connection A: The Format Tax May Be a Channel 2 Ceiling Symptom
KE-144 identifies the "Channel 2 ceiling" — structural enforcement can force behavior but not transfer it. EXP-144 is, in a sense, testing whether a *softer* form of structural enforcement (gates that prompt reasoning without mandating format) can break through this ceiling. 

The structured gates in EXP-144's control condition are a mild form of Channel 2: they force agents to produce specific artifacts in specific formats. KE-144 predicts that if these structured gates work like the verification guard, agents will comply with the format requirements without internalizing the underlying reasoning habits. The format becomes the thing agents optimize for (just like they optimize for "passing the guard" rather than "actually verifying").

**Implication**: EXP-144's format-decoupled condition may perform better precisely *because* it avoids triggering the Channel 2 compliance-without-capability pattern. Without a format to comply with, agents must engage with the actual reasoning to produce any output at all.

### Connection B: EXP-144 Should Measure Internalization, Not Just Performance
The current EXP-144 design measures task accuracy, FM rates, token usage, and reasoning quality — all single-session metrics. KE-144 teaches us that single-session metrics can look excellent (95% C1.3!) while masking a total failure to internalize.

**Critical gap**: EXP-144 doesn't measure whether format-decoupled gates produce *better behavioral transfer* than structured gates. After a series of format-decoupled sessions, do agents start reasoning before acting even *without* gates? After structured gate sessions, do they just stop producing artifacts when the mandate is removed?

This is the most important question the two threads raise together: **Does format-decoupled scaffolding transfer better than format-mandated scaffolding?**

### Connection C: The Simplicity Threshold Applies to Gate Design
KE-144 found that simple binary rules (commit discipline) internalize while complex judgment behaviors (verification strategy) don't. This maps directly to the EXP-144 gate design contrast:
- **Structured gates** impose complex rules (specific sections, table formats, checklists) → KE-144 predicts these won't internalize
- **Format-decoupled gates** reduce the rule to something simpler ("think about these topics, write freely") → potentially closer to the simplicity threshold where internalization is possible

### Connection D: Both Threads Converge on "Workflows > Text > Guards" Hierarchy
KE-144's practical conclusion: workflow embedding (Ch2+) > structural guards (Ch2) > text instructions (Ch1). EXP-144 is essentially testing a refinement within Channel 2: can the *type* of structural scaffolding matter? If format-decoupled gates work, they represent a "lighter-touch Channel 2" that might occupy a sweet spot between full workflow embedding and blunt guard enforcement.

### Contradiction: None Identified
The threads are complementary, not contradictory. KE-144 provides the theoretical framework (guards don't transfer); EXP-144 tests a potential improvement (can lighter-touch gates do better?).

---

## 3. Impact/Novelty Ranking

| # | Finding | Impact | Novelty | Rationale |
|---|---------|--------|---------|-----------|
| 1 | **EXP-144 should add internalization metrics** | ★★★★★ | ★★★★ | KE-144 reveals that single-session performance metrics are insufficient — the *real* question is whether format-decoupled gates produce lasting behavioral change |
| 2 | **Channel 2 ceiling principle** (KE-144) | ★★★★★ | ★★★★ | Fundamental architectural constraint: structural enforcement forces compliance without building capability. Reshapes how we think about all scaffolding |
| 3 | **Guard Dependency Escalation** (proposed H-106) | ★★★★ | ★★★★★ | The dynamic finding (fire rate *increasing*) is more novel and concerning than the static finding (fire rate staying high). Agents anti-learn. |
| 4 | **Format-decoupled gates may avoid Channel 2 ceiling** | ★★★★ | ★★★ | Theoretical prediction from combining the two threads — untested but high-value if true |
| 5 | **EXP-144 pilot protocol is execution-ready** | ★★★ | ★★ | Practical value: Coach can execute immediately. Well-specified with revision protocol. |
| 6 | **Simplicity threshold for internalization** | ★★★ | ★★★ | Commit guard (simple rule) internalized; verification guard (complex judgment) didn't. Clear design principle for future guards and gates. |

---

## 4. Proposed Next Steps

### 4.1 Modify EXP-144 Design: Add Internalization Measurement (HIGH PRIORITY)

Before running the pilot, add a **Phase 3 internalization test** to the EXP-144 design:

**Concept**: After the 10 pilot sessions (5 per condition), run 4 additional "gate-free" sessions (2 per condition) using the same scenarios but with NO gates at all. Then measure:
- Do agents who ran format-decoupled sessions spontaneously produce reasoning before acting?
- Do agents who ran structured sessions spontaneously produce structured artifacts?
- Or do both conditions show identical behavior when gates are removed (= no internalization either way)?

This is cheap (~$0.40) and directly tests the cross-thread hypothesis that format-decoupled gates might transfer better.

**Specific metrics to add to EXP-144 pilot**:
| Metric | Purpose | Collection |
|--------|---------|------------|
| Post-gate reasoning frequency | Does agent reason before acting in sessions WITHOUT gates? | Manual annotation of gate-free follow-up sessions |
| Spontaneous verification depth | Does agent verify without being prompted? | Compare verification tool calls in gated vs ungated sessions |
| Format persistence | Do structured-condition agents still produce tables/checklists without the mandate? | Manual format analysis of gate-free sessions |

### 4.2 Write H-106 (Guard Dependency Escalation) — MEDIUM PRIORITY

Formalize the dynamic escalation finding as a hypothesis with testable predictions. KE-144 provides the evidence base; H-106 would make the mechanism explicit and predict:
- P-106a: Reliant agent fire rates will asymptote near 100%
- P-106b: Guard removal + reinstatement resets fire rate (behavior is context-dependent)
- P-106c: Escalation is specific to judgment-dependent behaviors

### 4.3 Run EXP-144 Pilot As Designed — MEDIUM PRIORITY

The pilot protocol is well-specified and execution-ready. The internalization measurement (§4.1 above) should be added as an optional extension, not a blocker for the pilot itself. Run the 10 calibration sessions first; add the 4 gate-free sessions after if budget allows.

### 4.4 Design Guard Withdrawal Experiment — LOWER PRIORITY

The guard-internalization-analysis proposes a 3-phase withdrawal study (baseline → removal → reinstatement) for tech-lead and optimizer. This is the definitive test of whether *any* internalization has occurred, but it's destructive and lower priority than the constructive EXP-144 work.

---

## 5. The Unifying Question

Both threads circle the same deep question:

> **Can scaffolding produce capability, or only compliance?**

KE-144 says: current scaffolding (guards) produces only compliance. EXP-144 asks: can a different *kind* of scaffolding (format-free reasoning prompts) do better? The synthesis suggests that the answer depends on whether the scaffolding engages genuine reasoning (format-decoupled) or merely enforces output shape (structured/guarded).

The strongest prediction from this synthesis: **Format-decoupled gates will show better single-session reasoning quality AND better post-removal behavioral persistence than structured gates**, because they force engagement with the reasoning itself rather than compliance with a format specification. This is testable within EXP-144's existing framework with the internalization extension proposed above.

---

*Synthesis of KE-144 guard non-internalization findings with EXP-144 format-decoupled gates experiment design. The key insight: EXP-144 should measure internalization (behavioral transfer after gate removal), not just in-session performance — because KE-144 proves that in-session metrics can mask total failure to internalize.*
