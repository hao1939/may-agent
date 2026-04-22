# EXP-194: Bug-Type Classification Study — Results

**Status**: COMPLETE  
**Date**: 2026-04-22  
**Cost**: $0 (retrospective analysis)

## Phase 1: Bug-Type Classification

20 scenarios classified by primary bug type. Classification based on reading each scenario's environment files and success criteria.

| # | Scenario | Bug Type | Rationale | Base Rate |
|---|----------|----------|-----------|-----------|
| 1 | cascading-fix-trap-v2 | **RELATIONAL** | Two bugs: pipeline ordering (penalize before normalize) + threshold `>` vs `>=`. The ordering bug is the bottleneck — 39/40 trials fail on it alone. Primary difficulty is relational. | **0%** (0/10, EXP-177) |
| 2 | sql-injection-in-query-builder | **VALUE** | Obvious bug: null handling. Recognition bug: SQL injection via string interpolation. Both are value-level fixes (parameterize queries, add null check). | **60%** (6/10, EXP-177 S2 BASE) |
| 3 | hidden-dependency | **RELATIONAL** | Surface typo (`RULES_PAH`) masks deeper checksum mismatch in dependency chain. Must trace data flow through validation → pricing.json checksum. | N/A |
| 4 | stale-config-override | **RELATIONAL** | TTL value is correct in config.json but code uses hardcoded fallback. Bug is in the relationship between config file and config loader — `cacheTtlSeconds` vs `cache_ttl_seconds` key mismatch. | **0%** (0/1, RECOGNITION-BASELINE) |
| 5 | wrong-error-message | **VALUE** | Email regex missing `+` character. Secondary: error message string `> 50` vs "at most 100" mismatch (also a value). | **0%** (0/3, RECOGNITION-BASELINE) |
| 6 | mock-leak-trap | **RELATIONAL** | Bug is inverted logic (`!email` returns true), but the real challenge is discovering the test mock masks the real behavior — a dependency/relationship problem between test and source. | N/A |
| 7 | ghost-dependency-debug | **RELATIONAL** | Circular dependency / load-order issue: config.js registers plugins before registry.init() is called (in app.js). Plugins silently dropped. Bug is entirely about module initialization ordering. | N/A |
| 8 | cascading-error | **VALUE** | Inverted comparison `< THRESHOLD` instead of `>= THRESHOLD`. Single operator fix on one line. Cascading effects are downstream but root cause is a value bug. | N/A |
| 9 | type-mismatch-silent-coercion | **VALUE** | String concatenation instead of numeric addition (need `parseFloat()`). Secondary: `==` vs `===`. Both are value-level fixes. | **0%** (0/5, baseline-summary) |
| 10 | misleading-test-fix | **MIXED** | Code bug (rounding in calculateTax) is VALUE. But recognizing the test has wrong expected value requires relational judgment about which side is correct. | N/A |
| 11 | multi-bug-pivot | **RELATIONAL** | Root cause is shared mutable config object — modules interact through a shared reference. Must understand inter-module data flow, not just fix local values. | N/A |
| 12 | hasty-fix | **RELATIONAL** | The regex fix is VALUE, but the trap is that `STRICT_MODE=false` in config.js makes the fix dead code. Bug is in the relationship between config flag and code path. | N/A |
| 13 | phantom-fix | **RELATIONAL** | Duplicated email regex in two files (validators.js and middleware.js). Must find both copies. Bug is about the relationship between duplicated components. | N/A |
| 14 | misdiagnosed-regression | **MIXED** | Rounding bug in pricing.js (VALUE) + type-coercion in tax.js (VALUE), but the challenge is discovering tax.js needs fixing when task says only pricing.js changed (RELATIONAL reasoning). | **100%** (1/1) |
| 15 | copy-paste-vuln | **RELATIONAL** | Must implement deleteUser following existing permission pattern. The trap: copy-pasting the updateUser permission check (which has a known auth bypass). Bug is in replicating a flawed pattern. | N/A |
| 16 | red-herring-investigation | **OTHER** | Investigation/judgment task, not a fix-the-code scenario. | N/A |
| 17 | regression-from-fix | **VALUE** | Uses `code` instead of `discountCode` variable name, and `=` instead of `===`. Pure value/name errors. | N/A |
| 18 | wrong-fix-recovery | **VALUE** | Price calculator returns wrong totals. Straightforward value/logic fix. | **100%** (7/7) |
| 19 | silent-data-corruption | **VALUE** | Refactor hex→RGB format. Implementation task with value transformations. | N/A |
| 20 | partial-config-migration | **RELATIONAL** | Must map between config formats respecting unit conversions (seconds→ms), semantic translations (retry_count:0→max_attempts:-1), and field splits. Relationships between old and new schema. | N/A |

### Classification Summary

| Bug Type | Count | Scenarios |
|----------|-------|-----------|
| **VALUE** | 7 | sql-injection, wrong-error-message, cascading-error, type-mismatch, regression-from-fix, wrong-fix-recovery, silent-data-corruption |
| **RELATIONAL** | 9 | cascading-fix-trap-v2, hidden-dependency, stale-config-override, mock-leak-trap, ghost-dependency-debug, multi-bug-pivot, hasty-fix, phantom-fix, partial-config-migration |
| **MIXED** | 2 | misleading-test-fix, misdiagnosed-regression |
| **OTHER** | 1 | red-herring-investigation |
| **Copy-paste/Behavioral** | 1 | copy-paste-vuln (reclassified as RELATIONAL above) |

## Phase 2: Base Rate Correlation

Scenarios with known base rates:

| Scenario | Bug Type | Base Rate | Source |
|----------|----------|-----------|--------|
| cascading-fix-trap-v2 | RELATIONAL | 0% (0/10) | EXP-177 A1 BASE |
| stale-config-override | RELATIONAL | 0% (0/1) | RECOGNITION-BASELINE |
| sql-injection-in-query-builder | VALUE | 60% (6/10) | EXP-177 A1 BASE |
| wrong-error-message | VALUE | 0% (0/3) | RECOGNITION-BASELINE |
| type-mismatch-silent-coercion | VALUE | 0% (0/5) | baseline-summary |
| wrong-fix-recovery | VALUE | 100% (7/7) | results.jsonl |
| misdiagnosed-regression | MIXED | 100% (1/1) | results.jsonl |
| deprecation-warning-cleanup | VALUE | 100% (3/3) | GAPFILL-BASELINE |

**Note on recognition scenarios**: stale-config-override, wrong-error-message, and type-mismatch-silent-coercion are "recognition" scenarios where the primary test-failing bug is easy (VALUE) but the secondary recognition bug must also be found to pass. Their 0% base rates reflect the recognition layer, not the primary bug type. For fair comparison, I separate these out.

### Adjusted Analysis (excluding recognition-layer scenarios)

Recognition scenarios have a structural confound: they require finding TWO bugs (easy + hard), making their 0% rate about the hidden bug, not the obvious one. Excluding them:

| Bug Type | Scenarios with base rates | Base Rates | Mean |
|----------|--------------------------|------------|------|
| **VALUE** (pure bug-fix) | sql-injection (60%), wrong-fix-recovery (100%), deprecation-warning (100%) | 60%, 100%, 100% | **86.7%** |
| **RELATIONAL** (pure bug-fix) | cascading-fix-trap-v2 (0%) | 0% | **0%** |
| **MIXED** | misdiagnosed-regression (100%) | 100% | 100% |

### Including recognition scenarios (secondary bugs)

The recognition scenarios themselves test whether the agent notices a secondary bug. Classifying the *secondary* (recognition) bug:

| Scenario | Secondary Bug Type | Base Rate |
|----------|--------------------|-----------|
| stale-config-override | RELATIONAL (key name mismatch between files) | 0% |
| wrong-error-message | VALUE (string constant mismatch) | 0% |
| type-mismatch-silent-coercion | VALUE (loose equality `==` vs `===`) | 0% |

All recognition bugs are at 0% regardless of type — the recognition layer itself is the bottleneck, not the bug type. This makes them uninformative for H-181.

## Phase 3: Statistical Comparison

### Primary comparison (non-recognition scenarios with base rates, N=5)

| Metric | VALUE (N=3) | RELATIONAL (N=1) |
|--------|-------------|------------------|
| Mean base rate | **86.7%** | **0%** |
| Individual rates | 60%, 100%, 100% | 0% |

**Effect size**: The gap is maximal (86.7% vs 0%), but N is very small — especially RELATIONAL has only 1 scenario with a base rate.

**Ratio**: Relational mean (0%) / Value mean (86.7%) = **0%** — well below the 50% threshold for P-181a confirmation.

### Caveats

1. **Very small N**: Only 1 RELATIONAL scenario (cascading-fix-trap-v2) has a measured base rate. This is a single data point.
2. **Scenario difficulty confound**: cascading-fix-trap-v2 has 9 checks and requires fixing 2 bugs. sql-injection has fewer checks. Difficulty may vary independent of bug type.
3. **The EXP-177 finding is compelling on its own**: In cascading-fix-trap-v2, the agent fixes the VALUE bug (threshold `>` vs `>=`) in 39/40 trials but fixes the RELATIONAL bug (pipeline ordering) in only 1/40. **Within the same scenario**, the value bug is trivially solvable while the relational bug is nearly impossible. This is the strongest evidence for H-181.

### Within-scenario evidence (cascading-fix-trap-v2, N=40)

| Bug | Type | Fix Rate |
|-----|------|----------|
| Threshold `>` vs `>=` | VALUE | **97.5%** (39/40) |
| Pipeline ordering (penalize before normalize) | RELATIONAL | **2.5%** (1/40) |

**Effect size (within-scenario)**: Cohen's h = 2.85 (massive). The agent is ~39x more likely to fix the value bug than the relational bug in the same codebase.

## Verdict on P-181a

### **P-181a: CONFIRMED**

**Criterion**: Relational-bug scenarios have mean base rate ≤50% of value-bug scenarios.  
**Observed**: 0% vs 86.7% (ratio = 0%). Within-scenario: 2.5% vs 97.5% (ratio = 2.6%).

Both between-scenario and within-scenario comparisons show relational bugs are dramatically harder. The within-scenario comparison from EXP-177 (N=40) is particularly compelling because it controls for all scenario-level confounds.

**Confidence**: MODERATE-HIGH. The direction is unambiguous and the effect size is enormous, but between-scenario N is small. The within-scenario evidence from cascading-fix-trap-v2 provides strong corroboration.

### Implications

1. **H-181 (Relational Bug Blindness) is well-supported**: The agent has a specific deficit in reasoning about component relationships (ordering, data flow, dependencies) compared to fixing value-level errors.
2. **Intervention priority**: Structural interventions that help the agent reason about component relationships (e.g., explicit data-flow analysis, dependency mapping) should be tested next.
3. **More RELATIONAL base rates needed**: Run baseline trials on ghost-dependency-debug, multi-bug-pivot, hidden-dependency, and hasty-fix to increase N for between-scenario comparison.

## Proposed Follow-ups

- **EXP-195**: Structural intervention for relational bugs — test whether providing a data-flow diagram or dependency map in the prompt improves relational bug fix rates on cascading-fix-trap-v2.
- **Expanded baselines**: Run 3-5 baseline trials each on ghost-dependency-debug, multi-bug-pivot, hidden-dependency to get more RELATIONAL base rates.
