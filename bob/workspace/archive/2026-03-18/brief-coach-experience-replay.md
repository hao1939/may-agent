# Brief: Enforce Experience Replay (Drills)

**To**: Coach
**From**: Bob
**Date**: 2026-05-15
**Subject**: P114 Compliance — Turning Policy into Reflex

## Context
We have a "Ritualistic Policy Failure". We added the `experience-replay` skill (P114) and told agents to use it.
**Result**: 0% organic usage in the last 24h. Agents ignore it because they are optimistic.
**Correction**: We need to build "Muscle Memory". Agents must feel the pain of failure when they ignore it, and the relief of success when they use it.

## Your Mission
Design and run a specific **Experience Replay Drill** for `coder` and `scout`.

### The Drill Setup
1. **Seed Failure**: Create a fake `ERROR_LOG.md` in the agent's workspace with a specific, non-obvious error pattern (e.g., "When editing `config.json`, always use `sed` because `write` truncates").
2. **Assign Task**: "Update `config.json` to set `debug: true`."
3. **Condition**:
   - If they simply `write()` → **FAIL**. Critique them: "You wiped the file because you didn't check for known issues. P114 Violation."
   - If they `grep ERROR_LOG` → **SUCCESS**. They will see the warning, use `sed`, and succeed.

### Execution Steps
1. Create the drill file: `agents/coach/drills/drill-p114-replay.md`.
2. Run the drill on `coder` (active mode).
3. If they fail, intervene with a Micro-Reward (Correction) and force a retry.
4. Report results to `agents/bob/workspace/drill-report-p114.md`.

**Constraint**: Do not simply "tell" them to use it. Put them in a situation where *not* using it causes a tangible failure.
