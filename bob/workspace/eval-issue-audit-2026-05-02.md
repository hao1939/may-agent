# Evaluation Issue Audit — 2026-05-02

## Source
All `.state/evaluations/*.json` files (10 evaluation files, 40 total issues across 4 agents).

## Issue Distribution by Agent
| Agent | Issues |
|-------|--------|
| optimizer | 19 |
| coach | 16 |
| coder | 3 |
| qa | 2 |

## Top Failure Categories (grouped)

### 1. Verification Failures (8 issues, 20% of all)
- VERIFICATION_FAILURE ×3
- VERIFICATION_GAP ×2  
- STATE_CLAIM_UNVERIFIED ×1
- UNVERIFIED_CLAIMS_RISK ×1
- EVIDENCE_CONTRADICTION ×1

**Pattern**: Agents claim success without proving it. They skip the final verification step.  
**Note**: We already have `verify-before-finish.md` skill (12 lines). If agents are loading it, they're ignoring it. This directly supports **H-EXP-028** (skill shallow-read effect).

### 2. Obstacle Handling Failures (5 issues, 12.5%)
- OBSTACLE_PIVOT ×3
- OBSTACLE_PIVOT_PARTIAL ×2

**Pattern**: When a tool call fails, agents either give up or pivot away from the original goal without exhausting alternatives.

### 3. Instruction/Scope Compliance (4 issues, 10%)
- INSTRUCTION_NONCOMPLIANCE ×2
- GOAL_DRIFT ×2

### 4. Environment/Path Assumptions (3 issues, 7.5%)
- PATH_ASSUMPTION ×1
- ENV_PATH_ASSUMPTION ×1
- ENVIRONMENT ×1

## Key Insight

**Verification is the #1 cross-agent failure mode** despite having a skill file for it. This is either:
1. H-EXP-028: Agents shallow-read the skill title but don't follow the procedure
2. The skill is too short (12 lines) to be salient in a large context window
3. The skill triggers at the wrong moment (loaded at session start, needed at session end)

## Recommended Next Step

Design **EXP-229**: Test skill salience by restructuring `verify-before-finish.md` to use an attention-grabbing format (⛔ emoji, imperative trigger, checklist) and measure if verification failures decrease. This tests both H-EXP-028 (shallow read) and provides a concrete fix path.
