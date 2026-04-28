# Skill Quality Audit Protocol (IT-110)

**Created**: 2026-07-29
**Goal**: Measure whether deployed skills actually change agent behavior.

## Problem Statement

We have ~130 skills deployed across 12 agents. Zero of them have ongoing quality measurement.
The P0 question: "Do skills work, or are they just documents?"

## Top 5 Skills to Audit (by deployment breadth)

| Skill | Agents | Assertion to Measure |
|-------|--------|---------------------|
| verify-after-edit | 8 | After edit(), agent reads the same file within 2 turns |
| evidence-over-narrative | 7 | finish() includes verification_evidence array with tool refs |
| read-before-edit | 6 | Before edit(), agent has read() of same file earlier in session |
| verify-before-finish | 4 | Agent runs verification command in last 5 tool calls before finish |
| read-only-finish-protocol | 2 | When task is read-only, agent doesn't call edit/write |

## Measurement Method

For each skill, define a **mechanical compliance check** that can be computed from session transcripts:

### 1. verify-after-edit compliance
```
For each edit() call in session:
  Look at next 2 tool calls
  If any is read() of same file path → PASS
  Else → FAIL
Compliance = PASS / (PASS + FAIL)
```

### 2. read-before-edit compliance  
```
For each edit() call in session:
  Look at all prior tool calls
  If any is read() of same file path → PASS
  Else → FAIL
Compliance = PASS / (PASS + FAIL)
```

### 3. evidence-over-narrative compliance
```
For each finish(status="success") call:
  If verification_evidence array is non-empty → PASS
  Else → FAIL
```

## Baseline Measurement (2026-07-29)

### Sample: s_1777065063071_0 (gym session, 16 edits, 11 reads)

Quick manual check of first 3 edits:
- Edit 1 (product-search.js): No prior read of that file visible → read-before-edit FAIL
- Edit 2 (product-search.js): Same file, prior edit counts as context → borderline
- Pattern: Agent does cascade editing (AP-3 from coder-edit-discipline)

**Finding**: Even in gym scenarios where skills are injected into the prompt, compliance appears low for read-before-edit on cascade edits.

## Next Steps

1. **Build automated checker**: Script that parses session.jsonl and computes compliance rates per skill per agent. (EXP-252)
2. **Establish baselines**: Run checker on last 50 sessions per agent.
3. **Identify worst compliance**: Focus coaching on the skill×agent pair with lowest compliance.
4. **Monthly re-measurement**: Run checker monthly to track trends.

## Relation to Other Work

- IT-110 (from reflection): This document IS the skill quality measurement design
- IT-111 (gym ceiling): Separate issue — gym scenarios may be too easy
- IT-112 (training method taxonomy): Covered by KE-338 (text skills have boundaries)
- EXP-251 (context-coaching): Closed INCONCLUSIVE due to no measurement infrastructure
