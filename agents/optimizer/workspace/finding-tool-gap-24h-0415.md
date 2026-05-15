# Tool Gap Analysis — Fresh 24h Bash Pattern Scan (Apr 15)

**Date**: 2026-04-15 16:30 UTC  
**Data source**: Evaluation failure chains + issues from 24 high-op sessions (26-103 ops) in last 24h  
**Method**: Queried `evaluations` JOIN `sessions` for sessions >25 ops with non-empty issues. Extracted failure chain triggers, recovery attempts, and root causes. Cross-referenced against previously documented patterns.  
**Prior work**: Extends [finding-tool-gap-0415.md] (PATH boilerplate, git ceremony, session probing), [finding-bash-command-patterns-0411.md] (grep-search, DB-query, file-discovery categories), [finding-tech-lead-100op-bash-gaps-0415.md] (schema discovery loops, grep chaining)

---

## Executive Summary

Across 475 sessions (4,620 ops) in the last 24h, three **new** recurring bash patterns emerged that weren't in prior analyses. The biggest — **gym runner path-guessing** — appears in every bob gym session and wastes 8-22 ops per occurrence. Combined estimated waste: **60-120 ops/day**.

Previously documented patterns (PATH boilerplate, schema `id` column error, git ceremony) continue to appear but are **getting worse** in one area: the `SELECT id` schema mismatch now appears in 5 distinct sessions from 3 different agents.

---

## NEW Pattern 1: Gym Runner Path-Guessing Spiral (HIGH IMPACT)

### What
Bob (and occasionally coach) wastes 8-22 ops per gym session guessing where the gym runner lives. The pattern: try `agents/gym/src/runner.ts` → fail → `find agents/ -name "runner"` → find something → try `test/gym/run-gym.sh` → find it → also discover `scripts/gym-run.sh` → finally use the right one.

### Evidence (from failure chains)
| Session | Agent | Ops | Pattern |
|---------|-------|-----|---------|
| s_1776265309253_40 | bob | 40 | "22 wasted calls" on runner path discovery |
| s_1776266958214_57 | bob | 50 | "Multiple bash calls probing non-existent runner locations" |
| s_1776234668021_36 | bob | 34 | `ls agents/gym/*.ts *.js *.sh` → exit 2 → then enumerate |
| s_1776243685917_48 | bob | 38 | "8 wasted calls" guessing `agents/shared/may-agent-docs/gym/` |
| s_1776263741941_23 | coach | 56 | Wrong directory assumptions before finding correct paths |

### Root Cause
The gym runner path (`scripts/gym-run.sh`) and stats script (`bun scripts/gym-stats.ts`) are documented in context.md but agents don't reliably reference it when entering a gym task. Bob's context.md doesn't have the gym runner path.

### Fix
Add `Gym runner: scripts/gym-run.sh <scenario> --agent <name>` to bob's context.md (it's already in optimizer's). Also add `Gym batch: scripts/gym-batch.sh --scenario <name> --agent <name> --trials N` since bob frequently needs batch runs too.

**Estimated savings**: 8-22 ops × 4-6 gym sessions/day = **32-132 ops/day saved**

---

## NEW Pattern 2: ESM/CJS Module Format Mismatch (MEDIUM IMPACT)

### What
When agents test gym scenario code, they hit `require is not defined` (ESM context) or `Cannot find module` errors, then spend 3-8 ops debugging the module system before switching to the correct import style or adding `"type": "module"` to package.json.

### Evidence
| Session | Agent | Error | Wasted ops |
|---------|-------|-------|------------|
| s_1776263548918_19 | bob | `Cannot find module './src/formatter'` in /tmp test script | 3+ |
| s_1776265974823_51 | bob | `require is not defined in ES module scope` | 5+ |
| s_1776232900178_18 | bob | `ReferenceError: require is not defined` — scenario scorer ESM/CJS | 3+ |

### Root Cause
Gym scenarios use mixed module formats. Some scenario `environment/` directories have `"type": "module"` in package.json, others don't. Agents don't check this before writing test scripts, leading to predictable CJS/ESM mismatches.

### Fix
(a) Standardize gym scenarios on one module format (ESM preferred since Node defaults to it now).  
(b) Add a note to gym scenario template requiring `"type": "module"` in environment/package.json.  
(c) In context.md: "Gym scenarios use ESM — use `import` not `require` in test scripts."

**Estimated savings**: 3-8 ops × 3-4 scenario sessions/day = **9-32 ops/day**

---

## NEW Pattern 3: Wrong Filesystem Root (`/root`, `/tmp`, wrong git repo) (MEDIUM IMPACT)

### What
Agents attempt operations outside `/app` — committing from `/root`, writing test files to `/tmp` (which can't resolve local module imports), or running `git add` in `/app` for files under `agents/` (which is a separate git repo at `/app/agents`).

### Evidence
| Session | Agent | Error | Root cause |
|---------|-------|-------|------------|
| s_1776232890126_17 | scout | `cd /root && git add` → "not a git repository" | Wrong root |
| s_1776263548918_19 | bob | Wrote test to `/tmp/test-fix.js` → `Cannot find module './src/formatter'` | Can't resolve relative imports from /tmp |
| s_1776265016906_31 | coder | `git add agents/...` in /app → gitignored | Wrong git repo |
| s_1776259992416_10 | coder | Same pattern — `git add agents/` in main repo | Wrong git repo |
| s_1776243685917_48 | bob | `git add agents/gym/scenarios/` in main repo → gitignored | Wrong git repo |

### Root Cause
The two-repo layout (main at `/app`, agents at `/app/agents`) is documented but not viscerally understood. Agents default to `/app` for git commands. The `/root` and `/tmp` issues come from unix habits that don't apply in this container.

### Fix
Already partially addressed in context.md ("agents/ is a separate git repo — commit from agents/ dir"), but the agents/ git-add-in-main-repo pattern appears in **5 sessions** from **3 agents** in 24h. Consider:
- Adding a shell alias or wrapper that detects `git add agents/` in the wrong repo and warns
- Adding it to MORE agents' context.md (coder, bob, scout all hit this)

**Estimated savings**: 2-4 ops × 5 sessions/day = **10-20 ops/day**

---

## WORSENING Previously-Documented Pattern: `SELECT id` Schema Error

### Status: Spreading across agents (was optimizer-only, now 3 agents)

The `SELECT id, agent, ...` query against `sessions` table (which uses `sessionId`, not `id`) appeared in:

| Session | Agent | Recovery |
|---------|-------|----------|
| s_1776263473401_16 | optimizer | Abandoned query, moved on |
| s_1776265261329_38 | optimizer | "1 wasted bash call; chain left unresolved" |
| s_1776267060105_63 | optimizer | Abandoned bun:sqlite route entirely |
| s_1776187325813_277 | optimizer | "Not debugged to resolution; agent pivoted" |
| s_1776263741941_23 | coach | Unfinished/abandoned bun query attempt |

This pattern previously lived only in optimizer sessions (where `SELECT id` is in the muscle memory from early sessions). Now coach is catching it too, likely from copying query patterns.

### Fix already in place
Context.md documents `sessionId` as the key column. The issue is that agents construct queries from memory rather than referencing context.md or running `PRAGMA table_info` first.

**Reinforcement needed**: Add to the DB access section in context.md: "Column is `sessionId` NOT `id` — always check with PRAGMA table_info if unsure."

---

## Aggregate Impact Summary

| Pattern | Status | Est. waste/day | Fix difficulty |
|---------|--------|---------------|----------------|
| **Gym runner path-guessing** | NEW | 32-132 ops | Easy (context.md) |
| **ESM/CJS mismatch in gym** | NEW | 9-32 ops | Medium (standardize + doc) |
| **Wrong filesystem/git root** | NEW (but related to known) | 10-20 ops | Easy (context.md propagation) |
| **`SELECT id` schema error** | WORSENING | 5-15 ops | Easy (context.md reinforcement) |
| PATH boilerplate (from prior) | KNOWN, unchanged | 40-80 ops | Needs env-level fix |
| Git commit ceremony (from prior) | KNOWN, unchanged | 15-30 ops | Needs workflow-level fix |

**Total addressable waste**: ~110-300 ops/day, with the gym runner fix being the single highest-ROI item.

---

## Recommended Priority Actions

1. **[P0]** Add gym runner paths to bob's and coach's context.md — immediate, zero-risk, highest savings
2. **[P1]** Standardize gym scenarios on ESM — prevents recurring CJS/require errors
3. **[P1]** Propagate "agents/ is separate git repo" to coder and scout context.md
4. **[P2]** Add `sessionId NOT id` reinforcement to DB access docs
