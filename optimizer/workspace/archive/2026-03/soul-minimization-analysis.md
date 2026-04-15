# SOUL.md Minimization Analysis (Phase 2 of AUTORESEARCH LOOP)

**Date**: 2026-03-26
**Prerequisite**: common-sense.md V4 deployed and gym-validated (Phase 1)
**Status**: ANALYSIS — identifying reduction opportunities

## Current SOUL.md Sizes (bytes, descending)

| Agent | Bytes | Sections |
|-------|-------|----------|
| master | 6,834 | 11 |
| gym/forks/coder-identity | 6,729 | ? |
| amy | 6,042 | 10 |
| qa | 5,865 | 18 |
| evaluator | 5,417 | 16 |
| _archetypes/coach | 5,367 | ? |
| optimizer | 5,145 | 17 |
| amy-kimi | 5,101 | ? |
| _archetypes/scout | 4,161 | ? |
| tech-lead | 4,101 | 8 |
| _archetypes/coder | 3,201 | 6 |
| may | 2,456 | ? |
| judge | 2,261 | ? |
| bob | 1,761 | ? |

## Reduction Strategy

Same as common-sense V4: identify sections that are redundant with common-sense.md (now V4) or with other loaded context.

### Categories of potential removal:

1. **Redundant with common-sense.md V4**: Evidence-first, verify-before-finish, environment paths — these are in V4. Any SOUL.md that repeats them can trim.

2. **Example sections**: master has 3 examples (500+ bytes?). If agents don't demonstrably use them, remove.

3. **Verbose constraint lists**: qa has 18 sections. Some may overlap or be covered by guards.

4. **Skills sections**: Many agents have `## Skills` that just list loaded skill files. If skills are auto-loaded, the listing is redundant.

5. **Reference sections**: Boilerplate that may not be needed.

### Approach per agent:
1. Identify which sections duplicate common-sense.md content
2. Identify which sections are covered by loaded skills/handlers
3. Draft minimal version keeping only role-specific instructions
4. Gym-test the minimal version
5. Deploy

### Priority (largest → smallest, skip gym forks):
1. master (6,834) — likely has most redundancy
2. amy (6,042) — many behavioral guardrails
3. qa (5,865) — very structured, some may be essential
4. evaluator (5,417) — role-specific, may need most of it
5. optimizer (5,145) — can self-experiment

## Next Steps
- Wait for Phase 1 completion (V4 deployment + gym confirmation)
- Start with optimizer SOUL.md (can self-experiment safely)
- Then master → amy → qa → evaluator → tech-lead → coder
