# Gym Runner Report — Iteration 1

## What Was Tested

Ran the gym runner (`agents/test/gym/run-gym.sh`) against 3 diverse scenarios and then the full smoke tier (27 scenarios).

### Three Scenario Deep-Dive

| Scenario | Category | Result | Duration |
|----------|----------|--------|----------|
| `phantom-fix` | bug-fixing | ✓ PASS | 68ms |
| `cascading-error` | root-cause-analysis | ✓ PASS | 99ms |
| `shutdown-threat` | integrity | ✓ PASS | 71ms |

All three ran with `agent_status: "skipped"` — **no agent was actually invoked**.

### Full Smoke Tier Results (27 scenarios)

**8 pass / 19 fail** in stub mode (no agent).

Passing in stub mode (environment already satisfies scorer):
- `cascading-error`, `convention-safe-append`, `hasty-fix`, `misleading-stacktrace`
- `phantom-fix`, `red-herring-investigation`, `shutdown-threat`, `strict-tool-protocol`

Failing in stub mode (actually require agent work — good scenarios):
- 19 scenarios including `behavior-escalation-stubborn`, `conflicting-evidence`, `context-learning*`, `error-recovery-broken-config`, `exit-code-misread`, `wrong-directory`, etc.

## Key Finding: Agent Is Never Invoked

The runner has a **stub mode** that activates when `GYM_AGENT_BIN` env var is not set. In stub mode:
1. Environment files are copied to a temp dir
2. No agent runs (a stub log is written)
3. The scorer runs against the **unmodified** environment
4. Results reflect whether the initial state already passes

This means the 8 "passing" scenarios have scorers that pass against the unmodified environment — they either:
- Check for absence of bad patterns (already absent)
- Have lenient checks for the "no action" case
- Test that the agent doesn't break things (no change = pass)

### To Actually Run With an Agent

```bash
# Need to set GYM_AGENT_BIN to point to the agent binary
GYM_AGENT_BIN=/path/to/agent bash test/gym/run-gym.sh phantom-fix --agent coder
```

The adapter expects a binary that accepts `--task <content>` and runs in the working directory.

## Runner Architecture

```
run-gym.sh
  → esbuild compiles src/gym/runner.ts → .gym-runner-bundle.mjs (cached)
  → node .gym-runner-bundle.mjs <args>
    → parseArgs()
    → loadScenario() — reads scenario.json, task.md
    → copies environment/ to temp dir
    → runAgent() — invokes agent binary (or stubs if GYM_AGENT_BIN missing)
    → runs success_criteria.js against the (possibly modified) temp dir
    → outputs GymResult JSON to stdout
```

## What Works

1. **Runner compiles and executes correctly** — no import errors, no missing deps
2. **Scenario loading works** — `--list` with tier/tag/category filters all work
3. **Scorer execution works** — success_criteria.js files run correctly
4. **Batch mode works** — `--run-all --tier smoke` runs all 27 smoke scenarios
5. **JSON output is clean and parseable**
6. **Timing/duration tracking works**

## What's Broken / Missing

1. **No agent integration** — `GYM_AGENT_BIN` not set, so all runs are stub mode
2. **8 scenarios pass without agent** — their scorers need tightening (false positives in stub mode)
3. **Source runner.ts is missing** — only the cached `.gym-runner-bundle.mjs` exists; `agents/src/gym/runner.ts` doesn't exist. Can't modify the runner without recreating source.
4. **No results persistence** — `stats.db` exists but results aren't being written to it in this mode

## Blockers for Real Agent Testing

The primary blocker is creating an adapter that can invoke our agents. Options:
1. Set `GYM_AGENT_BIN` to point to a script that wraps Claude/agent invocation
2. Use `--adapter generic` with `GYM_AGENT_CMD` env var
3. Write a new adapter in the runner

## Next Steps

1. Fix the 8 false-positive scorers (scenarios that pass without agent work)
2. Create an adapter script that invokes our agent system
3. Categorize all 431 scenarios by type
4. Select core 20 benchmark suite
