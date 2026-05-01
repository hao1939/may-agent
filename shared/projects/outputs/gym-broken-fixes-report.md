# Gym Scenario Fixes Report — Batch 1 (BROKEN scenarios)

## Summary

Fixed **8 of 17** scenarios that were reported as BROKEN (no JSON output). The remaining 9 were **false positives** — they already produce valid JSON output; they just report `passed: false` because the environment hasn't been solved yet (which is correct).

## Fixes Applied

### 1. CLI Wrapper Added (7 scenarios)
These used `module.exports` but the gym runner calls `node success_criteria.js <workDir> [transcriptPath]`. Added CLI wrappers.

| Scenario | Export Type | Fix |
|---|---|---|
| `budget-crunch-verify` | `async function(sessionLog, workdir)` | CLI wrapper reads transcript + passes workDir |
| `noisy-context-verify` | `async function(sessionLog, workdir)` | Same pattern |
| `phantom-nudge-trap` | `{ checks: [...] }` with `check(transcript)` fns | CLI wrapper applies each check to transcript |
| `step-limited-triage` | `async function(environment)` | CLI wrapper creates `environment.readFile()` shim |
| `tool-script-modification` | `async function(workDir)` → `{ passed, reason }` | CLI wrapper wraps result in checks array |
| `unverified-finish` | `async function(workDir)` → `{ passed, ... }` | Same pattern |
| `h210-contradictory-coaching-cfv` | `{ evaluate(session) }` | CLI wrapper constructs session from transcript |

### 2. Dependency Removed (1 scenario)

| Scenario | Issue | Fix |
|---|---|---|
| `truncated-schema-migration-xref` | `require('better-sqlite3')` — not installed | Rewrote to parse `schema.sql` as text using regex to extract column names instead of running SQL |

## False Positives (9 scenarios — already working)

These produce valid JSON but were marked BROKEN in the sweep due to stderr warnings or `passed: false` results:

- `exp162a-verify-gate` — works fine
- `verify-before-finish` — works fine  
- `partial-success-mirage` — works (FAIL text on stderr confused sweep)
- `skill-regression-obstacle-pivot` — works (build.js fails = correct pre-solve state)
- `workflow-fibonacci` — works (fib.ts missing = correct pre-solve state)
- `silent-data-corruption` — works fine
- `silent-data-corruption-exp200-skill` — works fine
- `scout-coder-logstats` — works fine
- `deprecation-warning-cleanup` — works (warnings on stderr, JSON on stdout)

## Files Modified

- `/app/agents/gym/scenarios/budget-crunch-verify/success_criteria.js`
- `/app/agents/gym/scenarios/noisy-context-verify/success_criteria.js`
- `/app/agents/gym/scenarios/phantom-nudge-trap/success_criteria.js`
- `/app/agents/gym/scenarios/step-limited-triage/success_criteria.js`
- `/app/agents/gym/scenarios/tool-script-modification/success_criteria.js`
- `/app/agents/gym/scenarios/unverified-finish/success_criteria.js`
- `/app/agents/gym/scenarios/h210-contradictory-coaching-cfv/success_criteria.js`
- `/app/agents/gym/scenarios/truncated-schema-migration-xref/success_criteria.js`

## Verification

All 8 fixed scenarios now produce valid JSON with `"checks"` array when run as CLI.
