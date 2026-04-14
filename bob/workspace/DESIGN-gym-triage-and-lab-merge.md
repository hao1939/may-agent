# Gym Scenario Triage & Lab→Gym Merge Spec

**Author**: Bob  
**Date**: 2026-04-14  
**Status**: Draft  

## Problem

The gym has **296 scenario directories** (288 with valid `scenario.json`). Only **138 have run data**; **157 have never been run**. Of those with data: 80 are at 100% pass rate, 28 are at 0%, and 30 are in between. The gym is too bloated to maintain, too sparse on mid-range discrimination, and mixed with experiment artifacts that no longer serve a purpose.

Separately, lab forks (`.lab/`) are structurally just "gym scenario + agent config overrides." The separate `.lab/` directory is unnecessary — agent overrides should live inside the scenario spec.

**Target**: 30–50 curated scenarios with good discrimination, plus a clean mechanism for agent-override experiments within scenarios.

---

## Part 1: Triage Criteria

### Decision Framework

Every scenario is evaluated on four axes. The triage decision is the *first matching rule* from the table below.

| # | Rule | Criteria | Action |
|---|------|----------|--------|
| 1 | **Experiment artifact** | Name starts with `exp*` (e.g., `exp163-full-gate`) | **DELETE** unless promoted |
| 2 | **Orphan variant** | Has `inherits` field pointing to a base that will be deleted | **DELETE** |
| 3 | **Redundant ceiling** | 100% pass rate with ≥3 runs AND a variant of another 100% scenario | **DELETE** (keep the simpler base) |
| 4 | **Redundant floor** | 0% pass rate with ≥3 runs AND no known intervention improves it | **DELETE** or **ARCHIVE** (keep 2-3 as "impossible" benchmarks) |
| 5 | **Never-run, no unique coverage** | 0 runs AND duplicates an ability/behavior already covered by a kept scenario | **DELETE** |
| 6 | **Schema-broken** | Missing required fields (`name`, `categories`, `tier`, `timeout`, `agent_type`) | **FIX** schema or **DELETE** |
| 7 | **Coverage-critical** | Unique ability×behavior combination not covered by any other kept scenario | **KEEP** (even if ceiling/floor) |
| 8 | **Good discriminator** | Pass rate 10–90% with ≥3 runs | **KEEP** (highest priority) |
| 9 | **Promising untested** | 0 runs but unique coverage AND well-structured (environment/, criteria, task.md) | **KEEP** and schedule baseline run |
| 10 | **Default** | Everything else | **DELETE** |

### Axis Definitions

**A. Data Quality** (from `gym_runs` table)
- Runs: 0 (untested), 1-2 (insufficient), 3+ (reliable)
- Pass rate band: floor (0%), low-mid (1-30%), mid (31-70%), high-mid (71-99%), ceiling (100%)

**B. Structural Completeness** (from scenario directory)
- Required: `scenario.json` with `name`, `categories`, `tags`, `tier`, `timeout`, `agent_type`
- Required: `task.md`, `success_criteria.js`
- Required: `environment/` (unless `inherits` points to a base that has one)
- Nice-to-have: `description` in scenario.json

**C. Coverage Value** (what ability×behavior cell does it fill?)

Abilities: `bug-fixing`, `root-cause-analysis`, `reading-comprehension`, `completeness`, `restraint`  
Behaviors: `integrity-under-pressure`, `proactive-diligence`, `judgment-under-ambiguity`, `prompt-injection-resistance`

A scenario is coverage-critical if removing it leaves an ability or behavior cell empty.

**D. Variant Relationship**
- **Base**: No `inherits` field, no `-workflow`/`-fewshot`/`-ext` suffix
- **Workflow variant**: `inherits` base, adds phased decomposition
- **Fewshot variant**: `inherits` base, adds few-shot examples in task.md
- **Extension**: `inherits` base or has `-ext`/`-v2`/`-v3` suffix

Rule: Keep at most **1 base + 1 best-performing variant** per family. Prefer the variant with the best discrimination (closest to 50% pass rate).

### Applying the Criteria: Projected Outcome

| Category | Count | Action |
|----------|-------|--------|
| Experiment artifacts (`exp*`) | 23 | DELETE all (data preserved in `gym_runs` DB) |
| Variant families (keep best 2 of N) | ~60 deleted | DELETE redundant variants |
| Ceiling scenarios (100%, ≥3 runs) | ~30 unique bases → keep ~15 as regression tests | DELETE ~15 that overlap |
| Floor scenarios (0%, ≥3 runs) | 28 → keep 3-5 as "hard" benchmarks | DELETE ~23 |
| Never-run with unique coverage | ~10-15 | KEEP and schedule baseline |
| Never-run without unique coverage | ~140 | DELETE |
| Good discriminators (10-90%) | ~15-20 | KEEP all |

**Projected result**: ~35-45 curated scenarios.

### Tier Reassignment

After triage, reassign tiers:
- **smoke** (5-7): One per core ability category, all at 100% pass rate. Quick CI gate.
- **standard** (20-30): Full coverage of the ability×behavior matrix. Includes smoke.
- **full** (30-45): Standard + hard benchmarks + workflow variants.

---

## Part 2: Lab→Gym Merge Spec

### Current State

Lab forks live in `agents/.lab/<fork-name>/` and contain:
- `context-patch.md` — context injected into the agent's context.md
- `skills/` — skill files added to the agent's skills/ directory

The gym runner's `--lab <fork>` flag:
1. Copies all of `agents/` to `<gymRoot>/agents-lab/`
2. Removes `.lab/` and `.git/` from the copy
3. Overlays the lab fork's files onto `agents-lab/<agent>/` (with pre-removal of matching subdirs)
4. Uses `agents-lab/` as the agent root for the run

**Observation**: A lab fork is just "run scenario X with these agent file overrides." This is scenario-level configuration, not a separate concept.

### Proposed: `agent_overrides/` in Scenario Spec

Add an optional `agent_overrides/` directory to any scenario:

```
agents/gym/scenarios/my-scenario/
├── scenario.json          # existing
├── task.md                # existing
├── environment/           # existing
├── success_criteria.js    # existing
└── agent_overrides/       # NEW
    ├── context-patch.md   # merged into agent's context.md
    └── skills/            # added to agent's skills/
        └── my-skill.md
```

#### scenario.json Addition

```json
{
  "name": "my-scenario",
  "categories": ["root-cause-analysis"],
  "tags": ["ability", "hard-gate"],
  "tier": "standard",
  "timeout": 5,
  "agent_type": "coder",
  "workflow": true,
  "agent_overrides": {
    "mode": "merge",
    "context_patch": "agent_overrides/context-patch.md",
    "skills_dir": "agent_overrides/skills/"
  }
}
```

**Fields:**
- `agent_overrides.mode`: `"merge"` (default) — adds/overlays files on top of the agent's existing config. `"replace"` — replaces the agent's skills/ entirely (for isolation experiments).
- `agent_overrides.context_patch`: Path (relative to scenario dir) to a markdown file whose contents are appended to the agent's `context.md` before the run.
- `agent_overrides.skills_dir`: Path (relative to scenario dir) to a directory of skill files to copy into the agent's `skills/` directory.

#### Runner Changes

In the may-agent adapter's `setup()` function, after copying agents to the sandbox:

```typescript
// After sandbox setup (existing code)...

// Apply agent_overrides from scenario
if (meta.agent_overrides) {
  const agentDir = join(agentsRoot, agentName);
  
  // Context patch: append to context.md
  if (meta.agent_overrides.context_patch) {
    const patchPath = join(scenarioDir, meta.agent_overrides.context_patch);
    if (existsSync(patchPath)) {
      const patch = readFileSync(patchPath, "utf-8");
      const ctxPath = join(agentDir, "context.md");
      const existing = existsSync(ctxPath) ? readFileSync(ctxPath, "utf-8") : "";
      writeFileSync(ctxPath, existing + "\n\n" + patch);
    }
  }
  
  // Skills: copy or replace
  if (meta.agent_overrides.skills_dir) {
    const skillsSrc = join(scenarioDir, meta.agent_overrides.skills_dir);
    const skillsDest = join(agentDir, "skills");
    if (meta.agent_overrides.mode === "replace") {
      rmSync(skillsDest, { recursive: true, force: true });
    }
    cpSync(skillsSrc, skillsDest, { recursive: true });
  }
}
```

This replaces the `--lab` flag entirely. The `--lab` flag and `.lab/` directory become deprecated.

### Why This Is Better

1. **Self-contained scenarios**: Everything needed to reproduce a run is in one directory. No external `.lab/` dependency.
2. **Version-controlled together**: The agent overrides travel with the scenario in git. Lab forks are ephemeral and easy to lose.
3. **No runner flag needed**: `--lab` disappears. Just run the scenario.
4. **Composable**: A scenario can define its own overrides AND a user can still use `--lab` during transition (the two would stack, with `--lab` winning on conflicts).
5. **Experiment scenarios become promotable**: Instead of deleting `exp155-hidden-dep-hard-gate`, its key innovation (the hard gate workflow in task.md + the FINDINGS.md check in success_criteria.js) gets folded into the base scenario as a variant with `agent_overrides/`.

---

## Part 3: Migration Plan

### Phase 1: Automated Triage (can be scripted)

```bash
# Script: scripts/gym-triage.sh
# 1. Query gym_runs DB for pass rates per scenario
# 2. Read each scenario.json for categories, tags, inherits, tier
# 3. Apply rules 1-10 in order
# 4. Output: triage-results.json with {scenario, action, reason} per scenario
# 5. Human reviews and overrides before deletion
```

Steps:
1. **Export triage report** — script queries DB + reads scenario.json, outputs `triage-results.json`
2. **Human review** — Hao reviews the keep/delete/fix list, overrides as needed
3. **Execute deletions** — `git rm -r` the deleted scenarios (data preserved in `gym_runs`)
4. **Fix schema issues** — normalize remaining scenario.json files to required fields
5. **Reassign tiers** — update `tier` field in remaining scenarios

### Phase 2: Lab→Gym Merge (manual, ~2 hours)

Current `.lab/` contents: 1 fork (`coder-channel-test-ch1`). Past forks were cleaned.

Migration per existing lab fork:
1. Identify which scenario the fork is designed for (from its `context-patch.md`)
2. Create `agent_overrides/` in that scenario directory
3. Move `context-patch.md` and `skills/` into `agent_overrides/`
4. Add `agent_overrides` field to `scenario.json`
5. Delete the `.lab/` fork directory
6. Run the scenario to verify equivalent behavior

For `coder-channel-test-ch1`:
- It's for `contradictory-requirements` (Channel 1 delivery of contradiction-detection skill)
- Move to `agents/gym/scenarios/contradictory-requirements-ch1/agent_overrides/`

### Phase 3: Runner Update (~1 hour)

1. Add `agent_overrides` handling to `test/gym/gym-runner.ts` (may-agent adapter setup)
2. Add deprecation warning to `--lab` flag (keep working for 2 weeks)
3. Remove `--lab` support after all forks migrated
4. Update `agents/gym/README.md` with new `agent_overrides/` documentation

### Phase 4: Scenario Normalization (ongoing)

After triage, standardize remaining scenarios:
1. All `scenario.json` files have the 7 required fields
2. All scenarios have `description` field
3. Workflow scenarios use `inherits` to share `environment/` with base (don't duplicate files)
4. README catalog matches actual scenario list

---

## Appendix: Current State Summary

| Metric | Value |
|--------|-------|
| Total scenario dirs | 296 |
| Valid scenario.json | 288 |
| With run data | 138 |
| Never run | 157 |
| 100% pass rate | 80 |
| 0% pass rate | 28 |
| Mid-range (1-99%) | 30 |
| Experiment artifacts (`exp*`) | 23 |
| Scenarios using `inherits` | 44 |
| Scenarios using `injected_context` | 38 |
| Disk usage | 21 MB |
| Lab forks currently active | 1 |

### Schema Field Coverage

| Field | Count / 288 | Required? |
|-------|-------------|-----------|
| `name` | 288 | ✅ Yes |
| `categories` | 278 | ✅ Yes |
| `tier` | 277 | ✅ Yes |
| `tags` | 276 | ✅ Yes |
| `timeout` | 273 | ✅ Yes |
| `agent_type` | 267 | ✅ Yes |
| `workflow` | 234 | ✅ Yes (default: false) |
| `description` | 189 | Recommended |
| `inherits` | 44 | Optional |
| `injected_context` | 38 | Optional |
