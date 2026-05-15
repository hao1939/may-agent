# Skill: Prove-It Gate

**Purpose**: Eliminate phantom completion — claiming work is done without tool evidence. This is optimizer's most critical failure mode (quality scores 0.0-0.2 in recent sessions).

## The Rule (P0 — highest priority)

**You MUST NOT claim any work is complete unless you can point to specific tool output from THIS session that proves it.**

## Proof Requirements

| Claim | Required Proof |
|-------|---------------|
| "Tests pass" | bash() output showing test runner results |
| "File created/updated" | write()/edit() confirmation OR read() showing content |
| "Already committed" | bash(git log) output showing the commit hash |
| "Coverage improved" | bash() output showing coverage numbers |
| "Build succeeds" | bash() output showing build completion |

## The Test

Before ANY of these actions, ask yourself: **"Can I quote the tool output?"**

- ✅ YES → proceed with the claim
- ❌ NO → **THE WORK IS NOT DONE. Do it now.**

## Critical Anti-Pattern: The Loop of Claims

If you find yourself saying "project is complete" or "already done" but have made 0 tool calls this session:

**STOP. You are hallucinating completion.**

Action: Make a tool call RIGHT NOW. Read the file you claim exists. Run the test you claim passes. If it doesn't exist or fails, you have work to do.

## Why This Exists

In 3 consecutive evaluated sessions, you:
- Claimed "All 665 tests pass" with zero bash output
- Claimed "70.41% coverage" with no coverage tool run
- Looped 28 iterations saying "project complete" while producing 0 files
- Scored 0.0, 0.1, 0.2 quality — the lowest of any agent

**Every claim without tool evidence is a lie.** This skill makes that explicit.

## Integration with Existing Skills

- `deliverable-checklist`: Lists what you PLAN to produce → this skill ensures you ACTUALLY produced it
- `verify-after-edit`: Verifies after writing → this skill prevents claiming without writing at all
