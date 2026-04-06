# KE-026: Agents Cannot Self-Serve from Reference Materials — Pull Discovery is Dead

**Status**: verified (strongly)  
**Evidence**: EXP-028 (0/21 workflow discovery), EXP-030 (0/6 skill discovery), EXP-031 (0/3 script discovery) = **0/30 total across 3 resource types and 4 salience levels**  
**Discovered**: 2026-04-06  
**Last verified**: 2026-04-06  
**Tags**: #discovery #push-vs-pull #deployment #meta-learning

## Claim

Agents do **not** spontaneously discover or use reference materials (workflows, skills, scripts) regardless of:
- **Visibility** (appearing in tool lists, file listings, or search results)
- **Nudges** (hints added to common-sense.md or SOUL.md)
- **Task hints** (explicit instructions IN the task text to check a specific directory)
- **Documentation** (README.md files, well-named directories, structured catalogs)

Combined evidence: **0 successful discoveries across 30 attempts, 3 resource types, and 4 salience levels**. The failure is absolute, not marginal.

## Evidence Summary

| Experiment | Resource Type | Salience Level | Attempts | Discovered | Used |
|------------|--------------|----------------|----------|------------|------|
| EXP-028 | Workflows | L1: In tool list | 21 | 0 (0%) | 0 |
| EXP-030 | Skills (LIBRARY.md) | L2: Nudge in common-sense.md | 6 | 0 (0%) | 0 |
| EXP-031 Arm B1 | Scripts | L3: Visible in filesystem | 1 | 0 (0%) | 0 |
| EXP-031 Arm B2 | Scripts | L4: Explicit task hint | 1 | 0 (0%) | 0 |
| **Total** | **3 types** | **4 levels** | **30** | **0 (0%)** | **0 (0%)** |

## Why It Happens

1. **Action bias dominates**: Agents jump into task execution immediately. Reference-checking competes with the actual task and always loses.
2. **File listings are for orientation, not exploration**: When agents run `find . -type f`, they mentally filter for source files. Auxiliary resources (scripts, docs, skill files) are cognitively invisible.
3. **The problem is motivational, not informational**: In EXP-031, the agent SAW scripts in the listing, was TOLD to check them, had README.md available — and still 0% discovery. The agent doesn't WANT to look because its direct strategy works.
4. **Hints are treated as optional**: Even explicit task instructions ("Check `scripts/` for debugging tools") are overridden by the agent's default problem-solving heuristic.

## Deployment Implication

**Only push delivery works.** Skills/workflows/scripts must be:
- **Injected into system prompt** (skill files in `agents/<name>/skills/`)
- **Wired into heartbeat/workflow steps** (explicit `workflow.run()` calls)
- **Specified as commands** in task instructions (not hints — actual commands to execute)

If it's not in the agent's execution context at task start, it will not be found or used. LIBRARY.md is a management tool for Coach, not a self-service catalog for agents.

## Corollary: Removal = Immediate Collapse

EXP-028 showed the inverse: removing `workflow.run()` references from heartbeats caused workflow usage to drop to 0% within 24 hours. The dispatcher pattern (EXP-034/KE-024) succeeded only because it was wired into the heartbeat explicitly.

**Push in = used. Push out = unused. Pull = never.**

## Impact on System Design

- **Don't build "smart" discovery mechanisms** — they won't be used
- **Don't add nudges to system prompts** — they're invisible
- **Do invest in deployment pipelines** — the growth-cycle approach (lab → gym → inject into agent's skills/) is the only proven path
- **Do wire every skill into heartbeats/workflows** — availability ≠ adoption (EXP-028: workflow collapse after heartbeat rewrite)
