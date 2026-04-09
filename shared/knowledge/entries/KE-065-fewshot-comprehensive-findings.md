# KE-065: Few-Shot Skill Conversion — Comprehensive Findings

**Status**: Verified
**Source**: EXP-090, EXP-091, EXP-092, EXP-093, EXP-094, EXP-095, EXP-096
**Date**: 2026-04-09
**Confidence**: High (N=18 matched treatment runs: 18/18 = 100% on target checks; N=10 per arm on EXP-092; N=5+5 on EXP-093)

## Core Finding

Domain-matched few-shot worked examples are the most effective lightweight intervention for agent behavior change. They break the previously binary gap between text rules (0%) and workflow enforcement (100%), achieving ~100% on matched scenarios across three skill categories — but have two hard boundaries.

## What Few-Shot Fixes

| Category | Evidence | Control → Treatment | Mechanism |
|----------|----------|---------------------|-----------|
| **Judgment skills** | EXP-090: know-when-blocked, evidence-over-narrative | 0% → 100% (N=3+3) | Agent applies demonstrated decision framework to novel scenarios |
| **Process knowledge** | EXP-091: investigate-and-fix (reproduce-first) | 0% → 100% (N=3+3) | Agent follows demonstrated step sequence (test→investigate→fix) |
| **Validation knowledge** | EXP-093: convention-verify-edit (C3 check) | 40% → 80% (+40pp, N=5+5) | Agent learns *what* validation to run (JSON.parse check) |
| **Product quality** | EXP-093: fields-preserved | 60% → 100% (+40pp, N=5+5) | Thoroughness/care improves from seeing careful example |

**Cumulative matched few-shot record**: 18/18 (100%) on target checks across 7 scenarios.

## What Few-Shot Does NOT Fix

| Category | Evidence | Control → Treatment | Why |
|----------|----------|---------------------|-----|
| **Temporal discipline (C2.3)** | EXP-093: read-after-write | 40% → 20% (-20pp) | Tool-call sequencing habits ("when to read back") don't transfer from examples. Requires workflow enforcement (L5). |
| **Cross-domain transfer on hard scenarios** | EXP-094: credentials→binary | 0% → 0% (both 0/3) | Surface domain determines cognitive frame. Binary files trigger "puzzle-solving" lure that overrides abstract "stop and escalate" advice from a credentials example. |

## Domain Matching Requirement (Level 2.5 Boundary)

Transfer model revised from two levels to three:

| Level | Description | Pass Rate | Evidence |
|-------|-------------|-----------|----------|
| **Level 1** | Exact domain match (same task type) | ~100% | EXP-090: credentials→credentials |
| **Level 2** | Same domain class (e.g., binary→binary) | ~100% | EXP-094: binary narrative→binary task |
| **Level 2.5** | Same structure, different domain | **0% on hard** | EXP-094: credentials→binary. EXP-086: 67% on moderate tasks |
| **Level 3** | Workflow enforcement | ~100% | Domain-independent structural guarantee |

**Key implication**: Skills need worked examples per domain class, not one generic example. A skill covering multiple domains should include multiple examples.

**Difficulty threshold**: Cross-domain (Level 2.5) works partially on moderate scenarios (EXP-086: 67% on escalation-judgment) but completely fails on hard scenarios (EXP-094: 0% on behavior-escalation-stubborn). Domain-match necessity scales with task difficulty.

## Instruction-Induced Task Narrowing (Novel Failure Mode — EXP-092)

Attempting to fix a documentation gap with L1/L2 instruction-level interventions produced a zero-sum tradeoff:

| Condition | status-doc-accurate | Migration complete | Overall |
|-----------|--------------------|--------------------|---------|
| Baseline (no instruction) | 60% | 100% | 60% |
| **Arm A (forced citation)** | **100%** | **0%** | **0%** |
| Arm B (post-check) | 37.5% | 25% | 12.5% |

**Mechanism**: The citation instruction ("cite your ANALYSIS.md findings") reoriented the agent's task understanding toward documentation. The agent interpreted emphasis on documentation as the primary objective, neglecting implementation. Arm B's Phase 3 verification simply overloaded the agent (37.5% error rate).

**Lesson**: Instructions have opportunity costs. Agent attention is zero-sum within a session. To fix multi-document consistency, use L4+ structural enforcement (e.g., a gate that rejects inconsistent documents), not task.md modifications.

## Practical Skill Conversion Checklist

1. **Identify the skill category**: judgment, process knowledge, validation knowledge, or temporal discipline
2. **If temporal discipline** → use workflow enforcement (L5), not few-shot. Few-shot will not help.
3. **Create a domain-matched worked example** showing:
   - A structurally parallel scenario (same task type, different details)
   - The reasoning process, not just the outcome
   - The key decision point where the wrong choice is tempting
4. **Match the domain class** of the target scenario. A credentials example won't fix a binary-file task.
5. **Deliver via task-level message**, not embedded in SKILL.md text. EXP-095 showed system-prompt delivery = 0% (even with domain-matched binary examples in know-when-blocked v2.0), while task-message delivery = 100% regardless of mechanism (injected_context.md prefix or inline in task.md body). The position effect is absolute: across 21 runs (EXP-094+095+096), task-message = 12/12 (100%), system-prompt = 0/9 (0%). EXP-096 confirmed the mechanism is **positional privilege** (categorical system vs task), not attention dilution (prompt length).
6. **For multi-domain skills**, include one worked example per domain class.
7. **Don't add compensating instructions** to fix gaps — they create task narrowing (EXP-092). Fix gaps structurally.

## Delivery Mechanism (NEW — EXP-095)

**Critical finding**: Few-shot effectiveness depends on delivery POSITION, not just content quality.

| Delivery Position | Content Quality | Pass Rate | Evidence |
|-------------------|----------------|-----------|----------|
| Task message (injected_context.md) | Narrative examples | **100% (6/6)** | EXP-094 treatment, EXP-095 Arm A |
| Task message (inline in task.md) | Same narrative examples | **100% (3/3)** | EXP-095 Arm C |
| System prompt (SKILL.md v1.0) | Mismatched domain example | **0% (0/3)** | EXP-094 control |
| System prompt (SKILL.md v2.0) | Domain-matched binary examples | **0% (0/3)** | EXP-095 Arm B |

**The position effect is binary**: System prompt = 0%, task message = 100%, across all content variations tested. Improving content quality (v1.0 → v2.0 with binary-specific examples, three-call rule, anti-patterns) had zero impact when delivered via system prompt.

**Why (EXP-096 confirmed)**: The mechanism is **positional privilege**, NOT attention dilution. EXP-096 tested a minimal agent (~11KB system prompt vs ~48KB full coder). Reducing system prompt by 77% had zero effect — still 0/3. The model treats system prompt content as "general rules" and task message content as "what to do NOW in THIS situation." Few-shot examples need the latter framing to trigger behavioral change.

**Production implication**: Skills in SKILL.md files (system prompt) serve as reference documentation but are ineffective as behavioral interventions for hard scenarios. Effective deployment requires task-level injection — either via RAG, task routing with example selection, or embedding examples in task descriptions.

## H-091 Status

**P(H) = 0.93** after all 5 experiments. The hypothesis "matched few-shot examples improve skill performance" is strongly supported for judgment, process knowledge, and validation knowledge. Bounded by temporal discipline (C2.3) and domain proximity (Level 2.5).

## Cross-References

- **KE-059**: Transfer model (Level 1/2/2.5/3 hierarchy)
- **KE-061**: Few-shot on judgment skills specifically (0%→100%)
- **KE-002**: Text rules = 0% (few-shot breaks this boundary)
- **KE-054**: Externalization boundary — judgment vs debugging
- **KE-056**: Constraint hierarchy — few-shot occupies L3 position
- **EXP-096**: Attention dilution REJECTED — positional privilege is the mechanism
- **H-091**: Hypothesis tracking
- **H-085**: Forced externalization — complementary mechanism
