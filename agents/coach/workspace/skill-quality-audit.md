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

## Automated Measurement (2026-07-29)

**Checker built**: `agents/coach/workspace/skill-compliance-checker.ts`
**Run**: `bun agents/coach/workspace/skill-compliance-checker.ts --limit 300`

### Baseline Results (300 sessions)

| Agent | Sessions | read-before-edit | verify-after-write | verify-before-finish |
|-------|----------|-----------------|-------------------|---------------------|
| amy | 60 | **0%** (0/57) | **0%** (0/22) | 100% (191/191) |
| coach | 57 | 68% (23/34) | **3%** (1/36) | 99% (100/101) |
| may | 40 | 52% (14/27) | **0%** (0/15) | 99% (74/75) |
| bob | 39 | 26% (5/19) | **0%** (0/26) | 100% (70/70) |
| optimizer | 35 | 67% (8/12) | 16% (7/44) | 97% (97/100) |
| tech-lead | 31 | 25% (2/8) | **10%** (1/10) | 100% (73/73) |
| scout | 25 | 17% (1/6) | **0%** (0/13) | 98% (49/50) |
| qa | 12 | 100% (4/4) | 100% (6/6) | 100% (17/17) |
| **TOTAL** | **300** | **34%** (57/167) | **9%** (15/172) | **99%** (679/685) |

### Key Findings

1. **verify-after-write is 9% system-wide** — effectively non-compliant. Despite C1.3 convention existing.
2. **read-before-edit is 34%** — amy is 0% (57 violations in 60 sessions), worst in system.
3. **verify-before-finish is 99%** — the one skill that IS enforced (via C1.7 + structural guards).
4. **Structural enforcement works, text skills don't** — confirms KE-338. The only compliant skill has a guard.

### Interpretation

The answer to "do skills work?" is: **text-only skills achieve ~10-35% compliance; structurally-enforced skills achieve 99%**. This validates our pivot away from text coaching. Next step: build guards for verify-after-write and read-before-edit.

## Re-measurement (2026-04-28)

**Run**: Same checker, 300 sessions (more recent window)

| Agent | Sessions | read-before-edit | verify-after-write | verify-before-finish |
|-------|----------|-----------------|-------------------|---------------------|
| amy | 134 | 10% (28/285) | 0% (0/43) | 100% (370/370) |
| coach | 53 | 51% (22/43) | 3% (1/37) | 99% (95/96) |
| bob | 28 | 44% (8/18) | 0% (0/24) | 100% (45/45) |
| optimizer | 25 | 38% (3/8) | 8% (2/26) | 100% (68/68) |
| scout | 22 | N/A | 0% (0/14) | 100% (46/46) |
| may | 13 | N/A | 100% (1/1) | 98% (42/43) |
| qa | 13 | 100% (5/5) | 78% (7/9) | 100% (14/14) |
| tech-lead | 12 | 50% (1/2) | N/A | 100% (30/30) |
| **TOTAL** | **300** | **19% (67/361)** | **7% (11/154)** | **100% (710/712)** |

### Trend: Jul 29 → Apr 28

| Metric | Jul 29 | Apr 28 | Trend |
|--------|--------|--------|-------|
| read-before-edit | 34% | **19%** | 📉 -15pp — actively degrading |
| verify-after-write | 9% | **7%** | 📉 Flat/worse |
| verify-before-finish | 99% | **100%** | ✅ Stable |

**Conclusion**: Text skills continue to decay without structural enforcement. Only verify-before-finish (which has a guard) holds. This is now a 2-measurement proof that text-only skills don't sustain behavior.

## Next Steps

1. ~~Build automated checker~~ ✅ Done
2. ~~Establish baselines~~ ✅ Done (300 sessions)
3. ~~Re-measure~~ ✅ Done (Apr 28) — confirms decay
4. **PRIORITY: Build structural guard for read-before-edit** — amy is 10% (285 violations). This is the highest-volume fixable problem.
5. **Design guard for verify-after-write** — 7% system-wide, needs enforcement
6. **Monthly re-measurement**: Next check ~May 28

## Relation to Other Work

- IT-110 (from reflection): This document IS the skill quality measurement design — NOW WITH DATA
- IT-111 (gym ceiling): Separate issue — gym scenarios may be too easy
- IT-112 (training method taxonomy): Covered by KE-338 (text skills have boundaries)
- EXP-251 (context-coaching): Closed INCONCLUSIVE — now we know why (text coaching doesn't work)
