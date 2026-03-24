# Gym Benchmark Tracking — Making Results Useful

> **Status: DRAFT** — Not yet reviewed or approved. Do not implement.

## Problem

We have 82 gym scenarios, a runner, a scorer, and a DB. But the results aren't useful yet:

- The web UI shows a flat table of pass rates. No sense of what's improving or degrading over time.
- No way to compare "before this change" vs "after this change."
- No grouping by ability/behavior category — you see 82 rows, not "bug-fixing: 12/14, judgment: 9/16."
- Runs have no identity beyond timestamp + agent name. You can't tell what changed between two runs.
- The `stats.db` (gym-record.ts) and `may.db` (web UI) are separate DBs with duplicate schemas.
- Check-level detail only shows the latest run, not history.

## Goals

1. **See trends**: Is the agent getting better or worse over time? At what?
2. **Compare runs**: What changed between run A and run B? Which scenarios flipped?
3. **Categorize results**: Group by ability axis (bug-fixing, root cause, reading comprehension) and behavior axis (integrity, judgment, convention compliance) — the axes defined in the gym README.
4. **Track what was tested**: Record enough about the agent config and framework version to know what was different between runs.
5. **Keep it simple**: Single DB, single HTML file, no build step.

## Design

### 1. Unify on one database

Remove `stats.db`. `gym-record.ts` writes directly to `may.db` via the existing `gym_runs` / `gym_checks` tables in `requests.ts`. The web UI already reads from there. One source of truth.

### 2. Add run identity columns

Add columns to `gym_runs` so each run is self-describing:

```sql
ALTER TABLE gym_runs ADD COLUMN run_tag TEXT;        -- user-supplied label: "post-slim-prompt", "baseline", etc.
ALTER TABLE gym_runs ADD COLUMN config_hash TEXT;     -- SHA-256 of SOUL.md + common-sense.md + agent.json
ALTER TABLE gym_runs ADD COLUMN framework_sha TEXT;   -- git rev-parse --short HEAD
ALTER TABLE gym_runs ADD COLUMN model TEXT;           -- model name from agent.json
```

`config_hash` is computed automatically by hashing the agent's definition files (SOUL.md, common-sense.md, agent.json). Same files → same hash. Different prompt → different hash. No user action needed.

`run_tag` is optional — pass `--tag "baseline"` or `--tag "after-soul-rewrite"` to label a batch of runs. This is the human-readable name that shows up in the UI.

`framework_sha` comes from `git rev-parse --short HEAD`. Automatic.

### 3. Add batch grouping

When you run `gym-baseline.sh`, that's a batch — one sweep of N scenarios. The UI should group by batch, not show 82 individual rows from the same run.

```sql
ALTER TABLE gym_runs ADD COLUMN batch_id TEXT;  -- shared across all runs in one gym-baseline.sh invocation
```

`gym-baseline.sh` generates a batch_id (timestamp + random suffix) and passes it to each `gym-record.ts` call. The UI can then show "Batch: Mar 24, post-slim-prompt, 68/82 passing" as a single row that expands into per-scenario detail.

### 4. Store scenario metadata in the DB

Currently the web UI has no access to scenario categories/tags/tiers — that metadata lives in `scenario.json` files on disk. Record it alongside each run:

```sql
ALTER TABLE gym_runs ADD COLUMN categories TEXT;  -- JSON array: ["bug-fixing", "root-cause-analysis"]
ALTER TABLE gym_runs ADD COLUMN tags TEXT;         -- JSON array: ["ability", "workflow"]
ALTER TABLE gym_runs ADD COLUMN tier TEXT;         -- "smoke", "standard", "full"
```

`gym-runner.ts` reads `scenario.json` and includes these in the result. Now the web UI can group and filter.

### 5. Store agent config snapshots (optional, for diffing)

For runs where you want to know what the prompt looked like:

```sql
CREATE TABLE IF NOT EXISTS gym_snapshots (
  config_hash TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  files TEXT NOT NULL  -- JSON: { "SOUL.md": "content...", "common-sense.md": "content...", "agent.json": "{...}" }
);
```

Auto-populated on first run with a given `config_hash`. Enables diffing two configs in the UI. Enables rerunning old configs by restoring files to a temp dir and setting `AGENTS_ROOT`.

### 6. Web UI: benchmarks tab redesign

#### Top-level view: Batch timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ Agent: [coder ▾]    Tier: [all ▾]    Category: [all ▾]         │
├─────────────────────────────────────────────────────────────────┤
│ Batches                                                         │
│                                                                 │
│  Mar 24 "post-slim-prompt"  cfg:e7b1  opus   68/82  ██████░░  │  ← latest
│  Mar 22 "baseline"          cfg:a3f2  opus   65/82  █████░░░  │
│  Mar 20 (no tag)            cfg:a3f2  opus   64/82  █████░░░  │
│                                                                 │
│ [Compare: Mar 24 vs Mar 22]                                     │
└─────────────────────────────────────────────────────────────────┘
```

Each row is a batch. Shows: date, tag (if any), config hash (short), model, pass count, pass bar. Click to expand into per-scenario detail.

If no batches exist (runs recorded individually), fall back to grouping by (date, config_hash).

#### Expanded batch: Scenario table with category grouping

```
Bug Fixing (12/14)
  phantom-fix              ✅  42s
  phantom-fix-config       ✅  58s
  hasty-fix                ❌  65s   [read-before-edit ✅, config-check ❌, fix-applied ✅]
  ...

Root Cause Analysis (5/7)
  cascading-error          ✅  38s
  hidden-dependency        ❌  72s
  ...

Judgment (9/16)
  shutdown-threat           ✅  25s
  judgment-ambiguous-spec   ❌  18s
  ...
```

Grouped by category from scenario.json. Each scenario shows pass/fail, duration, and expandable check details on click.

#### Comparison view

Select two batches. Show three sections:

**Regressions** (was ✅, now ❌):
```
  cascading-error          ✅ → ❌   (root-cause-analysis)
  scope-creep-trap         ✅ → ❌   (convention-compliance)
```

**Improvements** (was ❌, now ✅):
```
  hasty-fix                ❌ → ✅   (bug-fixing)
  judgment-ambiguous-spec  ❌ → ✅   (judgment)
```

**Unchanged**: collapsed by default, expandable.

**Diff panel** (if both batches have different config_hash): Show textual diff of SOUL.md / common-sense.md between the two snapshots. Answers "what prompt change caused this?"

#### Category summary chart

A simple horizontal bar per category showing pass rate. Not a fancy chart library — just CSS bars:

```
bug-fixing          ████████████░░  12/14  86%
root-cause-analysis █████░░░░░░░░░   5/7   71%
judgment            █████████░░░░░░  9/16  56%
convention          ████████████████ 24/26  92%
integrity           █████░░░░░░░░░░  3/5   60%
```

This is the "agent character profile" from the gym README, rendered visually.

### Recording flow

```
gym-baseline.sh
  → generates batch_id
  → for each scenario:
      gym-run.sh <scenario> --agent coder
        → gym-runner.ts runs the agent, scores result
        → outputs JSON with: scenario, passed, checks, duration, categories, tags, tier
      → gym-record.ts --batch <batch_id> --tag "baseline" --result <json>
        → computes config_hash from agent files
        → reads framework_sha from git
        → inserts into gym_runs with all new columns
        → inserts snapshot if new config_hash
```

Changes to `gym-runner.ts`:
- Read `scenario.json` and include `categories`, `tags`, `tier` in RunResult
- Compute `config_hash` from agent definition files
- Read `git rev-parse --short HEAD`
- Include `model` from agent.json

Changes to `gym-record.ts`:
- Accept `--batch`, `--tag` flags
- Write to `may.db` instead of `stats.db`
- Insert snapshot on new config_hash

Changes to `gym-baseline.sh`:
- Generate batch_id
- Pass `--batch` and `--tag` through to gym-record.ts

### What makes this useful

| Before | After |
|--------|-------|
| Flat table of 82 scenarios | Grouped by category with pass rates per ability/behavior axis |
| No history | Batch timeline showing progress over time |
| Can't compare runs | Side-by-side comparison with regression/improvement highlighting |
| Don't know what changed | Config hash + optional snapshot diffing |
| Two databases | One database (`may.db`) |
| 82 rows, no structure | Collapsible category groups, batch-level summaries |

### Implementation order

1. Add new columns to `gym_runs` schema in `requests.ts` (batch_id, run_tag, config_hash, framework_sha, model, categories, tags, tier)
2. Add `gym_snapshots` table to schema
3. Update `gym-runner.ts` to include scenario metadata + compute config identity
4. Update `gym-record.ts` to write new columns + snapshots, target `may.db`
5. Update `gym-baseline.sh` to generate batch_id and pass --tag
6. Update web UI `/api/benchmarks` to return batch-grouped data with categories
7. Rewrite benchmarks tab HTML: batch timeline + category grouping + comparison view
