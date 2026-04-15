# Superpowers Integration Analysis

**Date**: 2026-03-29
**Source**: github.com/obra/superpowers (125k stars, by Jesse Vincent)
**Scout Evaluation**: DD#471 (★★★★)

## Executive Summary

Superpowers is a composable skills library for coding agents with 13 well-crafted skills. It represents the best publicly available implementation of "context engineering" — skills as structured prompts that reshape agent behavior. Our system already has 50+ skills but many are untested. The key takeaways are about **quality over quantity**, **structural patterns**, and **specific skill ideas we're missing**.

## Skill-by-Skill Comparison

### Skills We Already Cover Well

| Superpowers Skill | Our Equivalent | Assessment |
|---|---|---|
| `verification-before-completion` | `verification/SKILL.md` | **Ours is stronger.** We have 9 anti-patterns vs their ~5. We cover truncated verification, selective verification, wrong-target verification — all learned from real failures. |
| `systematic-debugging` | `investigate-and-fix/SKILL.md` | **Comparable.** Both enforce root-cause-before-fix. Superpowers has slightly more structured phases (4 phases). |
| `using-git-worktrees` | N/A (our agents share worktrees differently) | **Not applicable.** Our agents use a shared workspace model, not individual git worktrees. |
| `finishing-a-development-branch` | N/A (our agents don't own branches) | **Not applicable.** Different architecture. |
| `dispatching-parallel-agents` | `agent-coordination/SKILL.md` | **Ours is broader.** We handle delegation, trust, verification of sub-agent work. |

### Skills Where Superpowers Is Better

| Superpowers Skill | Our Gap | What to Learn |
|---|---|---|
| `brainstorming` | We don't have a structured brainstorming skill | **Mandates divergent thinking with idea quotas before any creative work.** Forces agents to explore design space before jumping to implementation. High value for our agents doing design work. |
| `writing-plans` | `plan-once-amend` is lighter | **Superpowers plan format is more structured**: dependency analysis, risk identification, checkpoints. Our `plan-once-amend` is about discipline (don't replan) but doesn't teach HOW to plan well. |
| `executing-plans` | No equivalent | **Teaches how to follow a plan with checkpoints and review gates.** Important for our longer implementation sessions. |
| `test-driven-development` | No equivalent (we have verification but not TDD) | **The Red-Green-Refactor cycle as a skill.** Useful for coder agents. "If you didn't watch the test fail, you don't know if it tests the right thing." |
| `writing-skills` | `skill-lifecycle/SKILL.md` exists but is process-focused | **Their meta-skill teaches the actual craft of writing good skills**: trigger conditions, verification gates, anti-patterns. Our `skill-lifecycle` focuses on the gym testing pipeline. |

### Skills We Have That Superpowers Doesn't

| Our Skill | Category | Notes |
|---|---|---|
| `grep-first-reading` | Context efficiency | **Our strongest unique skill.** No equivalent in Superpowers. Essential for context-constrained agents. |
| `evidence-over-narrative` | Epistemic discipline | Forces evidence-backed claims. Superpowers touches this in verification but not as a standalone principle. |
| `scope-discipline` | Task focus | Prevents scope creep. Not addressed by Superpowers. |
| `budget-before-act` | Resource management | Budget awareness. Not relevant for single-agent coding tools. |
| `delegation-verification` | Multi-agent trust | Verifying sub-agent work honesty. Superpowers has no trust layer. |
| `stale-approach-fixation` | Anti-pattern | Detects when agent is stuck in a loop. |
| `idempotent-work-detection` | Efficiency | Prevents re-doing work already done. |
| `request-triage-memoization` | Efficiency | Avoids re-triaging known items. |

## Structural Patterns to Adopt

### Pattern 1: Skill Trigger Conditions in Description

Superpowers puts **specific trigger conditions** in the skill's `description` field:
```yaml
description: "Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes"
```

Our skills have descriptions but they tend to be more abstract. We should adopt this "Use when X, before Y" format consistently.

**Action**: Update skill descriptions to use trigger-condition format.

### Pattern 2: The "Iron Law" Pattern

Every Superpowers skill has a single "Iron Law" — one inviolable rule in a code block:
```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

This is psychologically effective — a single memorable constraint. Our skills have "Inviolable Constraints" lists (multiple bullets) which are less memorable.

**Action**: Consider adding a single "Iron Law" to key skills alongside our existing constraints.

### Pattern 3: Meta-Skill Bootstrap

The `using-superpowers` skill solves cold-start: it teaches agents HOW to discover and use all other skills. We don't have this — agents learn about skills through their SOUL.md and heartbeat instructions, which is ad-hoc.

**Action**: Create a meta-skill that teaches agents how to discover and use skills from our library.

### Pattern 4: Verification Gates Are Universal

In Superpowers, EVERY skill ends with verification. Not just the "verification" skill. The brainstorming skill verifies you generated enough ideas. The planning skill verifies your plan covers all requirements. This "verify at every step" is more pervasive than our approach of having verification as a separate skill.

**Action**: Add verification steps to skills that currently lack them.

## Recommended Actions

### Priority 1: Create Missing High-Value Skills

1. **`brainstorming` skill** — Structured divergent thinking before creative work
   - Mandatory idea quota (e.g., generate 5+ approaches before picking one)
   - Explore design space before committing
   - Key for: Amy, Coder, May during design work

2. **`test-driven-development` skill** — Red-Green-Refactor discipline
   - Write test first, watch it fail, implement minimally
   - Key for: Coder agent

3. **`executing-plans` skill** — Following a plan with checkpoints
   - Checkpoint verification between plan steps
   - Stop-and-review gates at defined intervals
   - Key for: any agent running multi-step implementations

### Priority 2: Improve Existing Skills

4. **Update skill description format** — "Use when X, before Y" trigger conditions
5. **Add "Iron Law" to key skills** — single memorable constraint per skill
6. **Add verification gates to non-verification skills** — brainstorming, planning, coordination

### Priority 3: Structural Improvements

7. **Create meta-skill** — "Using the skill library" bootstrap skill
8. **Audit skill quality** — Some of our 50+ skills may be low-quality filler. Superpowers' strength is 13 well-crafted skills vs. our 50+ mixed quality.

## What NOT to Adopt

- **Git worktree workflow** — Doesn't match our shared workspace architecture
- **Platform-specific hooks** — We have our own injection mechanism (SOUL.md, heartbeat)
- **Session hooks format** — Our agent lifecycle is different
- **Their exact skill format** — Ours is richer (assertions, anti-patterns with evidence)

## Integration with Coach/Gym Pipeline

New skills should go through our existing pipeline:
1. Draft skill (based on Superpowers patterns + our format)
2. Add to LIBRARY.md as ⚪ untested
3. Coach tests in gym
4. Promote to ✅ proven or ❌ disproven
5. Deploy to specific agents

The Superpowers skills are like "prior art" that increases our confidence these patterns work (125k stars = massive real-world validation), but we should still gym-test them in our environment.
