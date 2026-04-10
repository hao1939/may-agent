# KE-123: Forced Deliverable Enumeration Fails on Discovery Tasks Under Time Pressure

**Status**: Active
**Source**: EXP-117 (Bob's FM-2.6 read-loop pattern, kb-integration-discovery scenario)
**Date**: 2026-04-10
**Qualifies**: KE-121 (forced externalization prevents misinterpretation), KE-007 (structural enforcement)
**Extends**: H-085 boundary conditions (5th boundary: discovery overhead)

---

## Finding

Forced deliverable enumeration (writing a checklist before executing) **significantly worsened** performance on a multi-file KB integration task: baseline 67% (4/6) → treatment 0% (0/6), p=0.030. The treatment completed fewer files on average (5.5/9 checks vs 7.3/8 baseline).

This is the first evidence of forced externalization actively **harming** performance (not just failing to help as in EXP-078/EXP-098).

## Mechanism: Three Compounding Failure Modes

1. **Time Tax**: Creating a checklist costs 10-20% of the time budget (2-4 tool calls). Under tight timeouts (3 min), this leaves insufficient time for actual work.

2. **Cognitive Anchoring to Incomplete Plan**: Once the agent creates a checklist before fully exploring, it follows the checklist rigidly. Items not discovered during the initial scan (e.g., SYNTH-008's hidden update trigger) are never added later.

3. **Discovery vs Planning Tradeoff**: In discovery tasks, the agent learns what needs updating AS it reads files. Forcing premature enumeration before reading creates an incomplete plan that the agent then follows instead of continuing to discover.

## Boundary Conditions for Forced Externalization

Forced externalization (checklists, ANALYSIS.md, etc.) works when:
- ✅ Deliverables are explicitly stated or enumerable from the task
- ✅ Time budget is generous relative to complexity
- ✅ The failure mode is "forgot to do" or "misinterpreted" (omission/misinterpretation)

Forced externalization **fails or backfires** when:
- ❌ Deliverables must be discovered through exploration (discovery tasks)
- ❌ Time budget is tight relative to the overhead
- ❌ The failure mode is "didn't know what to do" (missing information)
- ❌ The problem requires absent-field detection (no schema reference — EXP-078/098)

## Relationship to KE-121

KE-121 showed forced enumeration achieving 0%→100% on FM-2.2 (optimizer, explicit deliverables, 8-min timeout). EXP-117 shows the OPPOSITE on FM-2.6 (Bob, discovery-required deliverables, 3-min timeout). The critical difference is whether the deliverable set is **known** (enumeration helps) vs **unknown** (enumeration hurts by anchoring to an incomplete list).

## Implications

- **Do NOT apply forced-checklist patterns universally** — task type determines effectiveness
- **Discovery tasks need exploration-first approaches**, not planning-first approaches  
- **Time budget is a critical moderator** — externalization overhead that's negligible at 8 min becomes fatal at 3 min
- **H-085's formal statement needs a 5th boundary condition**: discovery tasks where premature enumeration anchors to an incomplete plan

---
*KE-123 | Bob (Architect) | 2026-04-10 | Source: EXP-117 negative result*
