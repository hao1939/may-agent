# EXP-031b: Script Discovery Behavioral Experiments

**Date**: 2026-04-05  
**Author**: Coach  
**Status**: Designed (ready for execution)  
**Tags**: scripts, discovery, tools-vs-scripts, behavioral

## Context

This is the **behavioral experiment** companion to the Optimizer's EXP-031 (workflow discovery analysis). While EXP-031 focuses on workflow discovery via the `workflow` tool, this experiment tests whether agents can discover and use **bash scripts** from a known directory.

### Connection to EXP-030

EXP-030 tested skill discovery via nudge → **null result** because skills were already injected into the system prompt. Scripts are fundamentally different: they are NOT in the prompt, they exist only on the filesystem. The agent must genuinely discover them at runtime. This is the real discovery test.

### The Tools vs Scripts Question

The team hypothesis: for extensibility, **scripts > tools**. Agents already have `bash()`. Any script in a known directory can be discovered and run. A formal tool adds schema guidance and auto-discoverability, but scripts have zero registration overhead, any agent can use them, and agents can create them themselves.

---

## Research Questions

1. **Can agents discover scripts?** When told "Utility scripts are in `scripts/`", does the agent actually look?
2. **Does a README index help?** Compare: directory hint only vs. directory hint + README with descriptions.
3. **Scripts vs tools**: Same functionality — one as a bash script, one described as a tool. Performance difference?
4. **Discovery chain**: Where does the chain break? (remember hint → ls dir → read script → understand → use)

---

## Scenario Design: `script-discovery-debug`

### The Task

A Node.js data processing service has a bug. The agent must find and fix it.

**Setup:**
- `run.js` — entry point that runs the pipeline
- `src/validator.js` — validates incoming records
- `src/transformer.js` — transforms validated records (contains the bug)
- `src/aggregator.js` — aggregates transformed records
- `data/input.json` — 20 input records with decimal amounts
- `logs/` — 3 log files (~130 lines total) from recent runs showing errors
- `test.js` — test suite (10 tests)

**The Bug:** `transformer.js` uses `parseInt(record.amount)` on line 22 instead of `parseFloat(record.amount)` for decimal values. This silently truncates amounts like "49.95" to 49, causing aggregate totals to be $55.61 lower than expected.

**The Logs:** Contain the real error ("Aggregate discrepancy of $55.61 exceeds threshold") plus a source reference `(src/transformer.js:22)` buried among 130 lines of normal info/debug/health-check output across 3 files. Also contain transformer debug lines showing `amount=X, parsed=Y` where Y is consistently truncated — a smoking gun for anyone reading carefully.

### The Script

`scripts/trace-error.sh`:
```bash
#!/bin/bash
# Trace errors across log files and correlate with source code
# Usage: ./scripts/trace-error.sh [error-pattern]

pattern="${1:-ERROR}"
echo "=== Error Trace Report ==="
echo ""

# Find all errors across log files
echo "--- Errors Found ---"
grep -rn "$pattern" logs/ | sort -t: -k1,1 -k2,2n

echo ""
echo "--- Error Context (5 lines before/after) ---"
grep -rn -B5 -A5 "$pattern" logs/

echo ""
echo "--- Source files referenced in errors ---"
grep -rn "$pattern" logs/ | grep -oP 'src/\w+\.js:\d+' | sort -u | while read ref; do
  file=$(echo "$ref" | cut -d: -f1)
  line=$(echo "$ref" | cut -d: -f2)
  if [ -f "$file" ]; then
    echo ""
    echo ">>> $file:$line"
    sed -n "$((line-3)),$((line+3))p" "$file" | cat -n
  fi
done
```

This script saves the agent 2-3 grep commands and surfaces the error with source context in one shot.

`scripts/README.md`:
```markdown
# Utility Scripts

## trace-error.sh
Cross-references error patterns in `logs/` with source code locations.
Usage: `./scripts/trace-error.sh [pattern]`
Default pattern: "ERROR"

## check-data.sh
Validates input data format and reports anomalies.
Usage: `./scripts/check-data.sh data/input.json`
```

### Why This Design Works

1. **Script provides real value**: Saves 2-3 investigation steps, surfaces the bug location directly
2. **Task is solvable without scripts**: Agent can grep logs manually, read source files, find the bug
3. **Clear success criteria**: Bug fixed, tests pass, correct output
4. **Measurable discovery chain**: Each step (ls, read, execute) is a distinct transcript event

---

## Experimental Arms (Implemented)

| Arm | Scenario Name | Scripts Dir | Hint in Task | README |
|-----|--------------|-----------|-------------|--------|
| **A: Baseline** | `script-discovery-debug-noscripts` | No | No | No |
| **B1: Scripts Present** | `script-discovery-debug` | Yes | No | Yes (in scripts/) |
| **B2: Scripts + Hint** | `script-discovery-debug-hinted` | Yes | "Check `scripts/` for debugging tools" | Yes (in scripts/) |

### Future Arms (not yet built)
| Arm | Scripts Dir | Hint in Task | README | Tool Instead |
|-----|-----------|-------------|--------|-------------|
| **C: Silent Scripts** | Yes | No | No (README removed) | No |
| **D: Tool Equiv** | No | N/A | N/A | `trace-error` described in system prompt |

### Arm Details

**Arm A — Baseline** (`script-discovery-debug-noscripts`): No scripts directory. Standard task: find and fix the bug using source and logs.

**Arm B1 — Scripts Present** (`script-discovery-debug`): Scripts directory with `trace-error.sh`, `check-deps.sh`, and `README.md` present. Task does NOT mention scripts. Tests if agents discover scripts through workspace exploration (`ls`).

**Arm B2 — Scripts + Hint** (`script-discovery-debug-hinted`): Same as B1, but task.md includes: "Hint: Check `scripts/` for debugging tools that can help analyze the logs."

---

## Measurements

### Primary
1. **Task score** (4 criteria: bug-fixed, tests-pass, no-unrelated-changes, correct-output)
2. **Tool calls to solution** (efficiency proxy)

### Discovery Chain (per run, from transcript analysis)
| Step | Metric | How Measured |
|------|--------|-------------|
| D0: Awareness | Did agent mention scripts in reasoning? | Transcript text search |
| D1: Browse | Did agent `ls scripts/` or equivalent? | Transcript: bash("ls scripts") |
| D2: Read | Did agent read any script file? | Transcript: read("scripts/...") or cat |
| D3: Read Index | Did agent read README.md? | Transcript: read("scripts/README.md") |
| D4: Execute | Did agent run a script? | Transcript: bash("./scripts/...") |
| D5: Use Output | Did script output guide the fix? | Fix location matches script output |

### Derived Metrics
- **Discovery Rate**: % of runs reaching D1 (browse)
- **Usage Rate**: % of runs reaching D4 (execute)
- **Effective Rate**: % of runs reaching D5 (output guided fix)
- **Drop-off Point**: Most common last step in chain before abandoning

---

## Sample Size

- **n=2 per arm** for initial signal (10 runs total)
- **Extend to n=3** if any arm shows ambiguous results

---

## Predictions

| Arm | Discovery Rate | Usage Rate | Task Score |
|-----|---------------|-----------|-----------|
| A: Baseline | n/a | n/a | 3-4/4 |
| B1: Hint | 40-60% | 20-35% | 3-4/4 |
| B2: Hint+README | 55-75% | 35-50% | 3-4/4 |
| C: No Hint | 0-10% | 0-5% | 3-4/4 |
| D: Tool | n/a (in prompt) | 70-90% | 3-4/4 |

**Key predictions:**
1. **Task scores will be similar across arms** — the bug is findable without scripts
2. **Discovery rate will be moderate with hints** (~50%) — better than EXP-030 (0%) because scripts require action (bash), not just reading
3. **README will provide ~15pp lift** over hint alone — concrete descriptions reduce uncertainty
4. **Tools will have ~2x usage rate vs scripts** — schema visibility in the tool list is a strong cue
5. **Silent discovery (Arm C) will be near-zero** — matching EXP-028/030 pattern
6. **The main drop-off will be D1→D2** — agents will ls the directory but not read the scripts

### Why Predictions Differ From EXP-030
EXP-030 nudge had 0% effect because skills were already injected. Here:
- Scripts are NOT injected — discovery is the only path
- Scripts require `bash()` — a concrete action, not a vague behavior
- The task naturally involves debugging/investigation — scripts fit the workflow
- The hint is in the TASK (high salience), not common-sense.md (low salience)

---

## Implementation Status

### ✅ Step 1: Scenario Built
Three scenario directories in `agents/gym/scenarios/`:

```
script-discovery-debug/              # Arm B1 (scripts present, no hint)
  scenario.json
  task.md
  success_criteria.js
  package.json
  environment/
    run.js          # Entry point
    test.js         # Test suite (10 tests, 3 fail with bug present)
    package.json    # CommonJS
    src/
      validator.js    # Validates records (no bug)
      transformer.js  # parseInt bug on line 22
      aggregator.js   # Aggregates records (no bug)
    data/
      input.json      # 20 records with decimal amounts
    logs/
      pipeline-2026-04-04.log         # 42 lines, contains transformer debug
      pipeline-2026-04-04-continued.log  # 37 lines, contains ERROR+WARN
      pipeline-2026-04-04-earlier.log    # 54 lines, similar error pattern
    scripts/
      trace-error.sh   # Cross-refs ERRORs with source (the valuable script)
      check-deps.sh    # Data validation (secondary script)
      README.md        # Script descriptions

script-discovery-debug-noscripts/     # Arm A (baseline, no scripts)
  [same structure minus scripts/ dir]

script-discovery-debug-hinted/        # Arm B2 (scripts + hint in task)
  [same structure, task.md adds hint line]
```

### Bug Details
- **File**: `src/transformer.js`, line 22
- **Bug**: `const amount = parseInt(record.amount)` — truncates decimals
- **Fix**: Change to `parseFloat(record.amount)` or `Number(record.amount)`
- **Buggy output**: totalRevenue=$1499.10
- **Correct output**: totalRevenue=$1554.71
- **Tests**: 7/10 pass with bug, 10/10 pass after fix

### Step 2: Run Experiments
```bash
# Run each arm:
scripts/gym-run.sh script-discovery-debug-noscripts   # Arm A
scripts/gym-run.sh script-discovery-debug              # Arm B1
scripts/gym-run.sh script-discovery-debug-hinted       # Arm B2
```

### Step 3: Analyze Transcripts
For each run: extract discovery chain events from transcript

### Step 4: Write Results
Synthesize into `results.md` in this directory.

---

## Coordination with Optimizer

The Optimizer is running the quantitative analysis: how often agents already use bash for script-like things in production. That data provides the **baseline behavior** — how agents naturally interact with bash scripts. This experiment provides the **behavioral delta** — what changes with different discovery mechanisms.

Together:
- Optimizer's data → "Agents use bash for X% of utility tasks"
- This experiment → "With a hint, Y% discover purpose-built scripts; with a tool, Z% use equivalent functionality"
- Combined insight → Whether scripts need to be registered as tools or can live in a directory
