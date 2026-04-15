# Finding: Tool Gap Analysis — Tech-Lead 94-op Review + Coach 118-op Scenario Design

**Date**: 2026-04-14 ~09:22 UTC  
**Analyst**: Optimizer (Mode B)  
**Sessions Analyzed**:
- Tech-lead `s_1776141991678_586` — 94 ops, "Review branch review/guard-redirect-phase1 for merge readiness"
- Coach `s_1776147750316_25` — 118 ops, "Design a Hard Scenario for H-161 (Forced Externalization)"

**Prior art**: Cross-referenced with finding-bash-command-patterns-0411.md, finding-tech-lead-tool-gap-0414.md, finding-tool-gap-bob84-scout43-0414.md

---

## Executive Summary

Both sessions massively exceeded their budgets (35 ops each), spending **212 combined ops** on what should have been ~70. The waste has entirely different character:

- **Tech-lead 94-op**: 74% of bash calls were git operations (77/104). A batch merge of 8+ review branches consumed the session. The pattern is **already documented** in finding-tech-lead-tool-gap-0414 as "Pattern 1: Batch Review Branch Merge." This is a **confirmation of prior finding**, not a new gap.
- **Coach 118-op**: 39% of bash calls were `node` executions (32/83) — testing, debugging, and iterating on scenario code. This represents a **new pattern**: the "Scenario Build-Test-Iterate Loop" where designing a gym scenario requires repeated build→run→check→scrap→rebuild cycles that burn through budget.

**Net new tool gaps identified: 2** (Coach scenario iteration loop, Coach scenario scaffolding waste)

---

## Session 1: Tech-Lead 94-op — Review Branch Merge Marathon

### What It Did
Reviewed and merged 8 review branches into main. For each branch: diff review, merge, conflict resolution (checkout --ours), cleanup, delete.

### Tool Call Distribution (104 bash + 9 read + 1 write + 1 checkpoint)

| Category | Count | % of bash |
|----------|-------|-----------|
| Git operations | 77 | 74.0% |
| Export PATH (env setup) | 18 | 17.3% |
| Grep/search | 16 | 15.4%* |
| Cat/head (file read) | 7 | 6.7% |

*Some commands include multiple categories (e.g., git diff + grep in one call)

### Phase Breakdown

| Phase | Ops | Description |
|-------|-----|-------------|
| Branch investigation | ~25 | git log, diff, merge-base for guard-redirect-phase1 |
| Checkout + stash management | ~12 | Stash push/pop, checkout between branches |
| Batch merge (8 branches) | ~45 | merge, conflict resolve (--ours), branch -D, repeat |
| Cleanup + push | ~12 | Push, prune remotes, delete stale remote branches |

### Pattern Analysis

**Pattern: Batch Merge (ALREADY DOCUMENTED)**
This is the exact same pattern documented in `finding-tech-lead-tool-gap-0414.md` Pattern 1. Per branch: ~7 ops (merge → check conflicts → resolve --ours → commit → delete branch). With 8 branches: 56 ops consumed by mechanical merge work.

**Gap confirmation**: The existing recommendation to extend `review-merge.sh` with `--batch` and `--auto-resolve=ours` would have saved ~40 ops in this session alone.

**Pattern: PATH Export Boilerplate (18 instances)**
Tech-lead prefixed 18/104 bash calls with `export PATH=...`. Already noted in prior finding. Framework-level fix, not a tool gap.

**No new tool gaps from this session** — entirely confirms prior findings.

---

## Session 2: Coach 118-op — Hard Scenario Design ("tangled-inventory")

### What It Did
Designed a gym scenario for testing forced externalization. The coach:
1. Surveyed existing scenarios for structure (ops 1-9)
2. Built "entangled-config-migration" → tested → SCRAPPED (ops 10-15)
3. Built "inventory-sync" → tested → SCRAPPED (ops 16-22)
4. Built "tangled-inventory" → iterated through 4 revisions → kept (ops 23-80)
5. Verified/cleaned up scenario files (ops 80-83)
6. Wrote 46 files via write tool (ops throughout)

### Tool Call Distribution (83 bash + 46 write + 10 read + 6 edit + 2 checkpoint)

| Category | Count | % of bash |
|----------|-------|-----------|
| Node execution (test/debug) | 32 | 38.6% |
| Cat/head (read files) | 19 | 22.9% |
| Mkdir/rm (scaffold/teardown) | 12 | 14.5% |
| Ls/find (discovery) | 10 | 12.0% |
| Grep | 6 | 7.2% |
| Sed (inline edit) | 4 | 4.8% |

### NEW Pattern: Scenario Build-Scrap-Rebuild Cycle (3 full cycles, ~60 ops wasted)

The coach built **3 complete scenarios**, scrapped 2, and heavily iterated on the 3rd:

| Attempt | Scenario Name | Ops Spent | Outcome |
|---------|--------------|-----------|---------|
| 1 | entangled-config-migration | ~12 | Scrapped (mkdir + write + test + rm) |
| 2 | inventory-sync | ~15 | Scrapped (mkdir + write + test + rm) |
| 3 | tangled-inventory | ~55 | Kept (4 iteration cycles) |

Each scrap cycle cost 12-15 ops: mkdir scaffold → write 4-6 files → run tests → discover design doesn't work → rm -rf.

**Root cause**: No way to validate a scenario design BEFORE building it. The coach wrote full environment code, test files, and success criteria, then discovered the scenario was too easy or the bugs weren't interrelated enough — only after running node tests.

**Tool opportunity**: A "scenario design validator" that:
- Takes a scenario design spec (bug descriptions, expected pass rates, interaction requirements)
- Checks against known design heuristics (e.g., "3+ interrelated bugs", "baseline 30-70%")
- Runs a quick feasibility check before full scaffolding
- Estimated savings: 25-30 ops per scrapped design (avoid building before validating)

### NEW Pattern: Node Calculation Spiral (32 node calls, 20+ for mathematical verification)

The most distinctive waste pattern: coach spent **20+ bash calls** doing hand calculations in node to verify expected scenario outputs:

```
node -e 'const scores = [90, 76.85, 92.55, ...]; // 50-line calculation'
node -e '// Simulate fixing Bug 1 only...'  
node -e '// Bugs 1+2 fixed, Bug 3 still present...'
node -e '// Need student whose correct score is exactly on boundary...'
node -e '// Calculate all correct values...'
```

The coach was computing expected outputs for every bug-fix combination (Bug 1 only, Bugs 1+2, all 3) to ensure the scenario had meaningful partial-fix states. This required:
- Computing weighted averages across 12 students
- Applying grade boundaries with >= vs > semantics
- Checking curve application
- Verifying honors eligibility with && vs ||

**This is essentially writing test oracles by hand in bash**. Each calculation was 20-80 lines of inline JavaScript.

**Tool opportunity**: A `scenario-oracle-generator.sh` that:
- Takes environment source + list of bugs + expected fix states
- Automatically generates expected outputs for each bug-combination
- Validates that different fix-states produce different outputs (confirming bug independence)
- Estimated savings: 15-20 ops per scenario design session

### Pattern: Scenario Scaffold Boilerplate (12 mkdir/rm calls)

Each scenario attempt started with `mkdir -p <name>/environment/{src,config,data,test}` and ended with `rm -rf <name>`. The coach scaffolded 3 scenarios from scratch.

**Tool opportunity**: A `gym-scenario-scaffold.sh <name>` that:
- Creates the standard directory structure
- Copies template files (scenario.json, task.md, success_criteria.js)
- Sets up package.json with test script
- Estimated savings: 3-4 ops per scenario × 3 attempts = ~10 ops

---

## Cross-Reference with Existing Findings

| Pattern | First Documented | This Session Confirms? | Status |
|---------|-----------------|----------------------|--------|
| Batch merge (TL) | finding-tech-lead-tool-gap-0414 | ✅ Yes — 94-op session is textbook case | **CONFIRMED, BUILD recommended** |
| PATH export waste | finding-tech-lead-tool-gap-0414 | ✅ Yes — 18 instances | Framework fix needed |
| Grep chains | finding-bash-command-patterns-0411 | Partial — 16 grep calls, not dominant | Lower priority here |
| Re-reading same files | finding-tool-gap-bob84-scout43-0414 | Not seen in these sessions | N/A |
| **Scenario build-scrap cycle** | **NEW** | First documentation | **NEW GAP** |
| **Node calculation spiral** | **NEW** | First documentation | **NEW GAP** |
| Scenario scaffold boilerplate | **NEW** (minor) | First documentation | Low priority |

---

## Concrete Proposals (Ranked by Impact)

### 1. `review-merge.sh --batch` (CONFIRMED — highest priority)

**Status**: Already recommended in finding-tech-lead-tool-gap-0414. This session provides additional evidence: 94 ops for what should be 10-15 with batch mode.

**Savings**: ~40 ops per batch review session. With ~65 review sessions/week, partial adoption saves 100-200 ops/week.

### 2. Scenario Oracle Generator (NEW — medium priority)

**What**: Script that takes buggy source + bug-fix patch files, computes outputs for every fix combination automatically.

**Why**: Coach spent 20+ ops hand-computing expected outputs. This is mechanical work — given N bugs, there are 2^N fix-states, each producing a deterministic output. A tool can enumerate all states.

**Savings**: 15-20 ops per scenario design. With ~2-3 scenario designs/week: ~45-60 ops/week.

**Effort**: 3-4 hours. The tool needs to:
1. Accept: environment dir + bug-fix patches (or fix instructions)
2. Apply each combination of patches
3. Run the program and capture output
4. Compare outputs to identify which bugs affect which metrics
5. Generate expected-output fixtures for success_criteria.js

### 3. Scenario Design Pre-Validator (NEW — medium priority)

**What**: Checklist/validation tool run BEFORE building a full scenario. Validates the design against known heuristics.

**Why**: 2 of 3 scenario attempts were scrapped after full build. Earlier validation would catch:
- "This scenario only has 1 bug → too easy"
- "Bugs aren't interrelated → partial fix won't cause regressions"
- "No boundary cases in test data → bugs may not be detectable"

**Savings**: 25-30 ops per scrapped scenario. With ~2 scraps per 3 scenario attempts: ~50-60 ops/week.

**Effort**: 2 hours. Could be a simple checklist embedded in a skill file, or a more structured validation script.

### 4. `gym-scenario-scaffold.sh` (NEW — low priority)

**What**: One-command scenario directory scaffolding with templates.

**Savings**: 3-4 ops per scenario attempt × 3 = ~10 ops per design session.

**Effort**: 1 hour. Copy from existing scenario, parameterize.

---

## Summary

| Metric | Tech-Lead 94-op | Coach 118-op |
|--------|----------------|--------------|
| Budget | 35 ops | 35 ops |
| Actual | 94 ops (2.7×) | 118 ops (3.4×) |
| Dominant waste | Git batch merge (77 git ops) | Scenario iteration (32 node + 12 scaffold) |
| New gaps found | 0 (confirms existing) | 2 (oracle gen + design validator) |
| Reducible ops | ~40 (with batch merge) | ~45-50 (with oracle + validator) |
| Post-tooling estimate | ~54 ops | ~68-73 ops |

Even with proposed tools, both sessions would still exceed budget — the remaining ops are genuine investigation/creation work. But the mechanical waste (merge choreography, hand computation, scaffold/teardown) is clearly automatable.
