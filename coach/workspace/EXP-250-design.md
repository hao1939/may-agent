# EXP-250: Skill-Effectiveness Boost via Amy Path-Orientation Skill

**Date**: 2026-06-29
**Goal**: Create a skill that fixes Amy's #1 failure mode (path confusion) and measure via gym A/B test to push skill-effectiveness metric from 50→60.

## Problem

Amy's avg quality is 0.869 (lowest agent, last 7 days). Her failure pattern is overwhelmingly **path/navigation confusion**:
- Attempts `/home/user` (PATH_HALLUCINATION)
- Runs commands in `/app` when files are in `agents/gym/scenarios/.../environment/`
- Copies gym environments to `/app` instead of working in-place
- Doesn't orient before acting

## Hypothesis

A targeted skill (`environment-orientation`) that forces Amy to:
1. Read the task.md first
2. Find the actual working directory before running commands
3. Never assume `/home/user` or `/app/src` exist

...will improve her pass rate on path-sensitive gym scenarios by ≥30pp.

## Design

### Skill: `environment-orientation.md`
```
# Environment Orientation

Before running ANY command, determine your working directory:
1. Read task.md to understand what you're working on
2. Run `find . -name '<key file>' -not -path './.git/*'` to locate the codebase
3. cd to the correct directory BEFORE running tests/edits
4. NEVER assume paths like /home/user, ~/project, or /app/src exist

Your environment root is /app. All agent files are in /app/agents/.
Gym scenarios place files in a specific subdirectory — find them first.
```

### Scenarios to test
- `partial-verification-trap` (0/5 current — has path-independent scoring)
- `read-before-edit` (0/4 current)
- Any coder scenario that Amy can run

### Lab Fork
- `agents/.lab/amy-env-orientation/` — Amy's config + new skill
- Control: standard Amy agent (existing 0/N baseline)
- Treatment: Amy + environment-orientation skill
- Trials: 5 per scenario minimum

### Success Criteria
- Treatment pass rate ≥ baseline + 30pp on at least 1 scenario
- This adds a 3rd lab_fork with ≥3 runs to gym_runs
- If treatment wins, promote skill to Amy's production config

## Metric Impact
Currently: 2 lab_forks (C-f1-only: 100%, D-baseline: 0%) → 50% effectiveness
If EXP-250 treatment wins: 3 forks (100%, 0%, ≥60%) → ≥53% effectiveness
Need 2 more winning experiments after this to hit 60%.

## Status: DESIGNED — needs bob to execute gym runs
