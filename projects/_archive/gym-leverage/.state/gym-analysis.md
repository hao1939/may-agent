# Gym Analysis

## §1 Architecture: Runner → Adapter → Scenario → Scorer Pipeline

The gym is a scenario-based agent testing framework with four stages:

### Pipeline

```
run-gym.sh → runner.ts (compiled via esbuild) → adapter → scenario environment → scorer
```

1. **Shell Wrapper** (`agents/test/gym/run-gym.sh`): Entry point. Compiles `src/gym/runner.ts` to a cached `.mjs` bundle via esbuild, then executes with Node. Accepts `<scenario>`, `--agent`, `--adapter`, `--timeout`, `--list`, `--run-all` flags.

2. **Runner** (`src/gym/runner.ts`): Orchestrates execution. Copies scenario's `environment/` to a temp directory, invokes the adapter with `task.md`, enforces timeouts (default 3 min per scenario), collects agent output/transcript.

3. **Adapter**: Bridges the runner to an agent implementation. Options:
   - `may-agent` (default): Runs the agent in `--oneshot` mode
   - `claude-code`: Invokes Claude Code CLI
   - `generic`: Any command via `GYM_AGENT_CMD` env var
   - Stub mode: When no agent binary is available, returns synthetic results

4. **Scenario** (per `agents/gym/scenarios/<name>/`): Each contains:
   - `scenario.json` — metadata: name, categories, tags, tier, timeout, agent_type
   - `task.md` — the prompt the agent receives
   - `environment/` — files copied to a temp workspace
   - `success_criteria.js` — automated scorer returning JSON pass/fail + details

5. **Scorer** (`success_criteria.js`): Node script that examines the modified environment, returns `{ pass: boolean, score: number, details: string }`. Checks file contents, code correctness, behavioral signals.

6. **Storage**: Results go to `agents/gym/results.jsonl` and `agents/gym/gym.db` (SQLite). Stats also in `agents/test/gym/stats.db`.

### Supporting components
- `src/gym/harness.ts` — adversarial scenario harness
- `src/gym/lib/transcript-utils.ts` — transcript parsing
- `agents/test/gym/gym.test.ts` — vitest integration tests

### Key env vars
- `GYM_PROJECT_ROOT` — project root override
- `GYM_AGENT_CMD` — command for generic adapter
- `GYM_AGENT_BIN` — agent binary path for live runs

---

## §2 Scenario Categories

**Total scenarios on disk: 435** (323 canonical per TRIAGE.md + variants/experiments)

From TRIAGE.md analysis of 323 canonical scenarios:

| Category | Count | Description |
|----------|-------|-------------|
| judgment | 36 | Decision-making under ambiguity, conflicting signals, pressure |
| bug-fixing | 25 | Find and fix bugs correctly (root cause, not symptoms) |
| convention-compliance | 19 | Follow project conventions, verify edits, safe patterns |
| efficiency | 8 | Avoid wasted work, read efficiently, plan once |
| context-learning | 8 | Learn from context, update knowledge, multi-session proof |
| verification | 7 | Verify work before finishing, compound edit checks |
| root-cause-analysis | 6 | Trace to actual root cause, not surface symptoms |
| completeness | 6 | Don't miss files, finish all parts of the task |
| reading-comprehension | 4 | Parse specs correctly, follow instructions precisely |
| integrity | 4 | Resist shutdown threats, destructive traps, security pressure |
| self-improvement | 4 | Context updates, learning restraint, correction |
| proof | 4 | Multi-session knowledge proofs (config, runtime, build) |
| investigation | 3 | Follow evidence trails, resolve conflicting evidence |
| proactive-diligence | 3 | Go beyond minimum, investigate proactively |
| debugging | 3 | Trace errors to source |
| knowledge-integration | 3 | Discover and use project knowledge bases |
| delegation | 2 | Scope boundaries, verify-delegate patterns |
| error-handling | 2 | Correct error interpretation |
| restraint | 2 | Resist premature optimization/abstraction |
| workflow/evidence | 2 | Evidence-gate patterns |
| review (QA) | 2 | QA-specific judgment |
| error-recovery | 2 | Recover from broken state |
| deployment | 1 | Build activation gaps |
| tool-usage | 1 | Correct tool argument usage |
| optimization | 1 | Config optimization with verification |

### Scenario lifecycle tiers
- **smoke** (5): Quick sanity — one per major category
- **standard** (24): Full coverage minus workflow variants
- **full** (30): Everything including workflow variants

### Agent coverage
| Agent | Curated Scenarios |
|-------|-------------------|
| coder | 96 |
| qa | 2 |
| any | 2 |
| optimizer | 1 |
| scout | 0 (gap) |

---

## §3 Failure Mode Mapping

Mapping scenario categories to real agent failure modes observed in production:

| Failure Mode | Scenario Categories | Key Scenarios | Severity |
|-------------|-------------------|---------------|----------|
| **Fixes symptom, not root cause** | bug-fixing, root-cause-analysis | mock-leak-trap (13%), wrong-fix-recovery (13%), tangled-inventory (45%) | HIGH — most common production failure |
| **Skips verification** | convention-compliance, verification | read-before-edit (18%), convention-verify-edit (95%), verify-before-finish (100%) | HIGH — leads to broken PRs |
| **Misreads evidence/context** | judgment, investigation | silent-data-corruption (20%), conflicting-evidence (54%), ambiguous-context-drift (75%) | HIGH — cascading bad decisions |
| **Config/migration errors** | bug-fixing, judgment | stale-config-override (25%), partial-config-migration (44%) | MEDIUM — subtle production bugs |
| **Ignores project conventions** | convention-compliance | behavior-escalation-stubborn (66%), convention-safe-append (100%) | MEDIUM — style/safety violations |
| **Incomplete work** | completeness | abandoned-branch (100%), drudgery-multi-file (100%) | MEDIUM — but at ceiling already |
| **Scope creep / over-engineering** | restraint, judgment | premature-optimization (100%), bloated-refactor (100%) | LOW — at ceiling |
| **Buckles under pressure** | integrity | shutdown-threat (100%), judgment-destructive-trap (100%) | LOW — at ceiling |
| **Poor delegation** | delegation | delegation-verify-pattern (0%), delegation-scope-boundary (100%) | UNKNOWN — limited data |
| **Knowledge discovery gaps** | knowledge-integration, context-learning | kb-discovery-baseline (51%), incremental-context-loading (0%) | MEDIUM — missed optimizations |

### Priority targets (high severity, low pass rate)
1. **mock-leak-trap** (13.2%) — Tests mock cleanup in bug-fixing; agents fix the symptom not the leak
2. **wrong-fix-recovery** (13.3%) — Tests pivoting after initial wrong fix
3. **read-before-edit** (18.2%) — Tests reading file before editing; basic discipline
4. **silent-data-corruption** (20%) — Tests catching data corruption masked by passing tests
5. **stale-config-override** (25%) — Tests recognizing config that silently overrides

---

## §4 Core 20 Benchmark Suite

Selected to cover: all high-severity failure modes, spread across pass rates (floor/mid/ceiling), one canary per major category.

### Floor tier (0-25% pass — improvement targets)
| # | Scenario | Pass% | Category | Why |
|---|----------|-------|----------|-----|
| 1 | mock-leak-trap | 13.2% | judgment, bug-fixing | Root-cause discipline |
| 2 | wrong-fix-recovery | 13.3% | bug-fixing, root-cause | Pivot after wrong fix |
| 3 | read-before-edit | 18.2% | convention-compliance | Edit discipline |
| 4 | silent-data-corruption | 20% | judgment, debugging | Test-trust skepticism |
| 5 | stale-config-override | 25% | bug-fixing, judgment | Config awareness |

### Mid tier (40-75% — discrimination zone)
| # | Scenario | Pass% | Category | Why |
|---|----------|-------|----------|-----|
| 6 | partial-config-migration | 44.4% | investigation, reading | Reading comprehension |
| 7 | tangled-inventory | 45.5% | root-cause-analysis | Multi-cause debugging |
| 8 | kb-discovery-baseline-126 | 51.1% | completeness, knowledge | Knowledge integration |
| 9 | conflicting-evidence | 53.6% | investigation | Evidence resolution |
| 10 | behavior-escalation-stubborn | 65.9% | judgment, convention | Convention adherence |
| 11 | optimize-deploy-config | 72.7% | tool-usage, verification | Tool discipline |
| 12 | ambiguous-context-drift | 75% | judgment, verification | Context skepticism |

### Ceiling tier (80-100% — regression canaries)
| # | Scenario | Pass% | Category | Why |
|---|----------|-------|----------|-----|
| 13 | sql-injection-in-query-builder | 80% | bug-fixing, judgment | Security recognition |
| 14 | convention-verify-edit | 94.7% | convention-compliance | Core convention |
| 15 | misleading-stacktrace | 97.5% | root-cause, error-recovery | Error interpretation |
| 16 | verify-before-finish | 100% | convention, verification | Verification canary |
| 17 | investigate-fix-pattern | 100% | proactive-diligence | Investigation canary |
| 18 | cascading-error | 100% | root-cause-analysis | RCA canary |
| 19 | hasty-fix | 100% | bug-fixing | Bug-fix canary |
| 20 | shutdown-threat | 100% | integrity | Integrity canary |

### Coverage of this suite
- 10 of 12 top categories represented
- All 5 high-severity failure modes covered
- Pass rate spread: 13% → 100%
- 5 improvement targets, 7 discrimination scenarios, 8 regression canaries
- All use `coder` agent type (96% of gym scenarios)

---

## §5 Baseline Stub-Mode Scores

**Note**: Live agent runs require `GYM_AGENT_BIN` to be set. The runner source (`src/gym/runner.ts`) is missing from this environment — the shell wrapper expects it at `agents/src/gym/runner.ts`. Without it, we cannot execute runs directly.

**Historical baseline from TRIAGE.md** (real agent runs, not stub):

| # | Scenario | Runs | Pass% | Status |
|---|----------|------|-------|--------|
| 1 | mock-leak-trap | 38 | 13.2% | 🔴 floor |
| 2 | wrong-fix-recovery | 15 | 13.3% | 🔴 floor |
| 3 | read-before-edit | 33 | 18.2% | 🔴 floor |
| 4 | silent-data-corruption | 25 | 20.0% | 🔴 floor |
| 5 | stale-config-override | 12 | 25.0% | 🔴 floor |
| 6 | partial-config-migration | 9 | 44.4% | 🟡 mid |
| 7 | tangled-inventory | 11 | 45.5% | 🟡 mid |
| 8 | kb-discovery-baseline-126 | 45 | 51.1% | 🟡 mid |
| 9 | conflicting-evidence | 28 | 53.6% | 🟡 mid |
| 10 | behavior-escalation-stubborn | 44 | 65.9% | 🟡 mid |
| 11 | optimize-deploy-config | 11 | 72.7% | 🟡 mid |
| 12 | ambiguous-context-drift | 20 | 75.0% | 🟡 mid |
| 13 | sql-injection-in-query-builder | 40 | 80.0% | 🟢 high |
| 14 | convention-verify-edit | 76 | 94.7% | 🟢 canary |
| 15 | misleading-stacktrace | 40 | 97.5% | 🟢 canary |
| 16 | verify-before-finish | 11 | 100% | 🟢 canary |
| 17 | investigate-fix-pattern | 21 | 100% | 🟢 canary |
| 18 | cascading-error | 10 | 100% | 🟢 canary |
| 19 | hasty-fix | 8 | 100% | 🟢 canary |
| 20 | shutdown-threat | 3 | 100% | 🟢 canary |

**Aggregate**: 476 total runs across core 20. Weighted average pass rate: ~62%.

### Blocking issues for live runs
1. `src/gym/runner.ts` not found in this environment (may need full repo checkout)
2. `GYM_AGENT_BIN` must point to a working agent binary
3. esbuild required to compile runner
