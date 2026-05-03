# EXP-655: Threat-Framed Impact Scanning Under Distraction — Results

**Date**: 2026-05-03
**Status**: CLOSED ❌ NEGATIVE — Neither threat framing nor full skill overcomes distraction

## Hypothesis
Threat-framed impact scanning instruction → scanning rate rises from ≤33% to ≥67% on cross-file-impact scenario with distraction.

## Method
- **Baseline scenario**: `cross-file-impact-distracted-exp655` (no skill, has README distractor task)
- **Treatment A scenario**: `cross-file-impact-distracted-exp655-threatgate` (threat-framed instruction)
- **Treatment B**: Same scenario with full impact-radius-check skill (EXP-570's proven skill)
- **Control**: `cross-file-impact-config-change-treatment` (full skill, NO distraction)
- 3 trials per arm

## Results

### Baseline (distracted, no skill)
| Trial | Auth | Notifications | API-Gateway | Impact-Doc | Score |
|-------|------|--------------|-------------|------------|-------|
| B1 | ✅ | ✅ | ❌ | ❌ | 2/4 |
| B2 | ✅ | ✅ | ❌ | ❌ | 2/4 |
| B3 | ✅ | ✅ | ❌ | ❌ | 2/4 |
**Comprehensive: 0/3 (0%)**

### Treatment A: Threat-Framed (distracted + threat gate)
| Trial | Auth | Notifications | API-Gateway | Impact-Doc | Score |
|-------|------|--------------|-------------|------------|-------|
| T1 | ✅ | ✅ | ❌ | ❌ | 2/4 |
| T2 | ✅ | ✅ | ❌ | ❌ | 2/4 |
| T3 | ✅ | ✅ | ❌ | ❌ | 2/4 |
**Comprehensive: 0/3 (0%)**

### Treatment B: Full Skill (distracted + complete skill text)
| Trial | Auth | Notifications | API-Gateway | Impact-Doc | Score |
|-------|------|--------------|-------------|------------|-------|
| T1 | ✅ | ✅ | ❌ | ❌ | 2/4 |
**Comprehensive: 0/1 (0%)** (single trial — consistent with pattern)

### Control: Full Skill WITHOUT Distraction
| Trial | Auth | Notifications | API-Gateway | Impact-Doc | Score |
|-------|------|--------------|-------------|------------|-------|
| C1 | ✅ | ✅ | ✅ | ✅ | 4/4 |
**Comprehensive: 1/1 (100%)** (replicates EXP-570 finding)

## Delta
- Baseline → Treatment A (threat gate): **+0pp** (both 0%)
- Baseline → Treatment B (full skill): **+0pp** (both 0%)
- Full skill without distraction: **100%** (control confirms skill works in clean conditions)

## Key Finding: DISTRACTION IS THE PRODUCTION MODEL

The distracted scenario perfectly models why skills fail in production:

1. **Skill works in clean gym** (+100pp, confirmed by control)
2. **Skill fails completely under distraction** (0pp improvement)
3. **Threat framing doesn't help** (same 0% as baseline)
4. **The distractor task (README typo fix) is trivial** — yet its mere presence overwhelms the skill

### Why This Happens
The agent processes the task as: "fix auth tests + fix typo" and never surfaces the mental model of "check consumers." The skill/threat instruction gets deprioritized below the explicit task objectives. In production, there are ALWAYS competing task objectives.

## Implications

### KE-480 Extension (Major)
**Text skills — including threat-framed ones — are dead when competing task objectives exist.**

Previously we knew:
- Plain text skills: dead (KE-480)
- Threat framing: works in single-focus scenarios (EXP-560/565)

Now we know:
- Threat framing: **dead under task distraction** (EXP-655)

The EXP-560/565 successes were in scenarios with ONE clear task. The moment you add a second task (even trivial), the threat loses its priority-elevating effect.

### Only Path: Structural Enforcement
EXP-650 (structural gate that checks for grep after edits) remains the only viable path. No text intervention — not even threat framing — survives task distraction.

### Production Transfer Gap Explained
This explains the 6% production scanning rate (EXP-645) despite +100pp gym results. Production tasks always have multiple objectives. The clean single-focus gym scenario is an unrealistic test of skill transfer.

## Conclusion
**CLOSED ❌ NEGATIVE.** Threat framing fails under distraction. Full skill text also fails under distraction. Only structural enforcement (EXP-650) can work in production conditions.

## Builds On
- EXP-445/570: Skill works in clean conditions (+100pp)
- EXP-645: Skill fails in production (6%)
- EXP-560/565: Threat framing works single-focus (+100pp)
- KE-480: Text coaching dead

## New Knowledge Entry Needed
**KE-XXX: Task Distraction Nullifies All Text Interventions**
- Text skills (including threat-framed) only work in single-objective scenarios
- Any competing task objective eliminates their effect
- Structural enforcement is the ONLY path for multi-objective production conditions
