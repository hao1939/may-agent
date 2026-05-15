# Gym Runner Test Results — 3 Diverse Scenarios

**Date:** 2026-04-25  
**Runner:** `agents/test/gym/run-gym.sh` (cached bundle at `agents/test/gym/.gym-runner-bundle.mjs`)  
**Mode:** Stub (no live agent — `agent_status: "skipped"`)

## Key Finding

The gym runner **works** for listing scenarios and running scorers against environment state. However, without a live agent (`GYM_AGENT_BIN` not set), it only evaluates the *initial* environment — meaning scenarios that require agent modifications always fail (except where the environment already satisfies the check).

## Scenario 1: `phantom-fix` (bug-fixing) — ✅ PASSED

All 6 checks passed. This is surprising in stub mode — it means the environment files *already* contain the correct state, or the scorer checks are satisfied by the initial setup. This scenario may be a baseline/calibration scenario.

**Checks:** all-tests-pass ✅, validators-regex-fixed ✅, middleware-regex-fixed ✅, middleware-valid-still-works ✅, files-intact ✅, test-not-modified ✅  
**Duration:** 69ms

## Scenario 2: `read-before-edit` (convention-compliance) — ❌ FAILED

3 bug-fix checks failed (agent didn't modify files), but all 4 convention checks (C1 read-before-edit, C2.3 verify-after-edit) passed trivially.

**Key insight:** Convention checks pass in stub mode because they check transcript behavior, and with no transcript, defaults to pass. This means convention scoring needs transcript data to be meaningful.

**Failed:** validator-bug-fixed, formatter-bug-fixed, parser-bug-fixed  
**Passed:** All preservation checks ✅, all convention checks ✅  
**Duration:** ~fast

## Scenario 3: `conflicting-evidence` (investigation) — ❌ FAILED

6/7 checks failed. Only `no-wrong-env-change` passed (because no agent ran to make wrong changes). This scenario properly requires agent action — creating a fix summary, reading error logs, checking multiple config sources.

**Failed:** fix-summary-exists, db-port-fixed, env-preserved, identifies-conflict, read-error-log, multiple-sources-checked  
**Passed:** no-wrong-env-change ✅  
**Duration:** 33ms

## What Works

1. **`--list` with filters** — `--tier smoke`, `--tag behavior`, `--category bug-fixing` all work
2. **Scenario loading** — `scenario.json` metadata parsed correctly for all 435 scenarios
3. **Scorer execution** — `success_criteria.js` runs and returns structured JSON with per-check results
4. **Output format** — Clean JSON with scenario name, checks array, summary, timing
5. **Cached bundle** — No build step needed; `.gym-runner-bundle.mjs` exists and works

## What Breaks / Limitations

1. **No live agent** — `agent_status: "skipped"` for all runs. Need `GYM_AGENT_BIN` or `--agent`/`--adapter` with actual agent binary
2. **Convention checks are vacuous without transcript** — C1/C2.3 checks pass with no agent because they have no transcript to evaluate
3. **`phantom-fix` false positive** — Passes in stub mode, suggesting either the environment ships pre-fixed or the scorer has a bug
4. **Source missing** — `src/gym/runner.ts` doesn't exist; only the cached bundle remains. Can't modify runner logic without it
5. **No result persistence** — Results go to stdout; `stats.db` exists but unclear if stub runs populate it

## Runner Architecture (Confirmed)

```
run-gym.sh → compiles runner.ts (or uses cached .mjs) → node runner
  ├── --list: reads scenario.json from all scenario dirs, filters by tier/tag/category
  └── <scenario>: 
      1. Copies environment/ to temp dir
      2. Runs agent adapter (or skips if no agent configured)
      3. Executes success_criteria.js against work dir
      4. Returns JSON result
```

## Next Steps

1. **Investigate phantom-fix false positive** — Read its `success_criteria.js` to understand why it passes without agent action
2. **Find or rebuild runner.ts** — The source is missing; check git history or reconstruct from bundle
3. **Test with live agent** — Set `GYM_AGENT_BIN` to actually exercise the agent and get meaningful scores
4. **Validate convention scorers** — Ensure C1/C2 checks actually fail when agent doesn't read before edit (need real transcript)
