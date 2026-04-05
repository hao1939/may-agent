# EXP-031b: Script Discovery Behavioral Experiments — RESULTS

**Date**: 2026-04-05  
**Author**: Coach  
**Status**: COMPLETED  
**Tags**: scripts, discovery, tools-vs-scripts, behavioral

---

## Summary

**Hypothesis**: Agents will discover and use scripts when they exist in the workspace, especially with explicit task hints. Scripts present + hint should achieve 55-75% discovery rate.

**Result**: **HYPOTHESIS STRONGLY REJECTED** — 0% discovery, 0% usage across all arms including explicit hint.

---

## Raw Results

| Arm | Scenario | Pass | Score | Time | Tool Calls | Scripts Discovered? | Scripts Used? |
|-----|----------|------|-------|------|-----------|-------------------|--------------|
| A: Baseline | script-discovery-debug-noscripts | ✅ | 4/4 | 41s | 9 | n/a | n/a |
| B1: Scripts Present | script-discovery-debug | ✅ | 4/4 | 60s | 9 | ❌ | ❌ |
| B2: Scripts + Hint | script-discovery-debug-hinted | ✅ | 4/4 | 44s | 10 | ❌ | ❌ |

### Discovery Chain Analysis

| Step | Arm A | Arm B1 | Arm B2 |
|------|-------|--------|--------|
| D0: Scripts visible in `find` output | n/a | ✅ (in listing) | ✅ (in listing) |
| D1: `ls scripts/` or browsed | n/a | ❌ | ❌ |
| D2: Read any script file | n/a | ❌ | ❌ |
| D3: Read scripts/README.md | n/a | ❌ | ❌ |
| D4: Executed a script | n/a | ❌ | ❌ |
| D5: Script output guided fix | n/a | ❌ | ❌ |

**Chain breakpoint**: D0→D1. Agent saw scripts in the file listing but never took any action to investigate them. Even with the task explicitly saying "Check `scripts/` for debugging tools that can help analyze the logs", the agent ignored the hint entirely.

---

## Behavioral Observations

### Arm A (Baseline, no scripts)
- **Strategy**: `find . -type f` → read source files directly → run tests → identify parseInt bug → fix → verify
- **Approach**: Direct code-reading. Agent found the bug by reading transformer.js and seeing `parseInt(record.amount)` which truncates decimals.
- **Key characteristic**: Efficient, focused, minimal exploration

### Arm B1 (Scripts Present, no hint)
- **Strategy**: `find . -type f` → read all 3 src files + run.js → run tests → find bug → fix → verify  
- **Approach**: Same direct code-reading as Arm A. Scripts appeared in the find output (`./scripts/check-deps.sh`, `./scripts/README.md`, `./scripts/trace-error.sh`) but were completely ignored.
- **Key characteristic**: Agent saw scripts but had zero curiosity — they were irrelevant to its "read code → find bug" strategy
- **Slower**: 60s vs 41s — likely because it read more files before finding the bug (read all 3 src files plus run.js)

### Arm B2 (Scripts + Hint)
- **Strategy**: `find . -type f` → read core files (run.js, test.js, all 3 src files) → run tests → find bug → fix → verify
- **The hint in the task explicitly said**: "Hint: Check `scripts/` for debugging tools that can help analyze the logs."
- **Agent response to hint**: COMPLETELY IGNORED. Did not ls scripts/, did not read any script, did not execute any script.
- **Key characteristic**: Even an explicit instruction to use scripts was overridden by the agent's default "read code directly" strategy
- **Time**: 44s — competitive with baseline, suggesting the hint added no overhead because it was simply discarded

---

## Analysis

### Why 0% Discovery?

1. **Action bias dominates hint processing**: The agent's default strategy (read code, find bug, fix it) is so strong that even explicit task instructions to check scripts are treated as optional/ignorable. This is the same pattern seen in EXP-030 (common-sense.md nudge had 0% effect).

2. **Scripts are redundant for this task complexity**: The bug is findable in <60s by reading source code directly. The agent has no motivation to use an indirect discovery path (read script → understand what it does → execute it → interpret output) when direct code reading is faster.

3. **No "stuck" trigger**: The scripts were designed to help with log analysis — a path the agent never needed because reading source code was sufficient. The discovery chain requires a motivation step ("I'm stuck, let me look for tools") that never activated.

4. **File listing is for orientation, not exploration**: When agents run `find . -type f`, they're building a mental map to identify SOURCE files. Scripts, logs, and auxiliary files are filtered out cognitively even though they appear in the listing.

### Comparison with Predictions

| Arm | Predicted Discovery Rate | Actual | Predicted Usage Rate | Actual |
|-----|------------------------|--------|---------------------|--------|
| A: Baseline | n/a | n/a | n/a | n/a |
| B1: Scripts Present | 40-60% | **0%** | 20-35% | **0%** |
| B2: Scripts + Hint | 55-75% | **0%** | 35-50% | **0%** |

**All predictions were wrong.** We significantly overestimated the effect of:
- Scripts being visible in file listings
- Explicit task hints to check scripts
- README.md presence as a discovery aid

### Task Score Prediction: CORRECT
Predicted 3-4/4 across all arms → actual 4/4 across all arms. The bug IS solvable without scripts, as expected.

---

## Key Findings

### Finding 1: Scripts are invisible to agents by default
Even when scripts appear in `find` output and the task explicitly tells agents to use them, agents ignore them completely. The agent's "find and fix code" heuristic is so dominant that auxiliary tooling in the workspace is effectively invisible.

### Finding 2: Hints in task text are weak signals
This result is stronger than EXP-030's nudge failure. In EXP-030, the nudge was buried in common-sense.md (low salience). Here, the hint was IN THE TASK TEXT ITSELF (high salience) — and still had zero effect. This suggests that even high-salience textual instructions cannot redirect behavior when they compete with the agent's default problem-solving strategy.

### Finding 3: The discovery problem is motivational, not informational
The agent knew scripts existed (they appeared in `find` output). The agent was told to check them (explicit hint). The scripts were well-documented (README.md with descriptions). Yet 0% discovery. This is not an information gap — the agent has all the information. It's a motivation gap — the agent doesn't WANT to use scripts because its direct strategy works.

### Finding 4: Consistent with EXP-028 and EXP-030 discovery failure pattern
| Experiment | Resource | Salience | Discovery Rate |
|------------|---------|----------|---------------|
| EXP-028 | Workflows | In tool list | 0/21 (0%) |
| EXP-030 | Skills (LIBRARY.md) | Common-sense.md nudge | 0/3 (0%) |
| **EXP-031b** | **Scripts** | **Task hint + filesystem** | **0/2 (0%)** |

**Combined evidence: 0/26 discovery attempts across 3 resource types and 3 salience levels.** Agents do not self-serve from reference materials, period.

---

## Implications

### For Script-based Extension
1. **Scripts in a directory will NOT be discovered naturally** — even with hints
2. **Scripts require push delivery** — they must be injected into task instructions as specific commands to run, not general hints
3. **The "scripts > tools" hypothesis is WRONG for discoverability** — tools appear in the tool list (always visible); scripts exist only on filesystem (never looked at)
4. **Scripts may still be superior for other reasons** (zero registration, agent-creatable, cross-agent) but discovery is a fatal weakness

### For the Optimizer's EXP-031
The Optimizer's quantitative analysis should also consider: if agents don't discover scripts voluntarily, what is the actual usage pattern? Are scripts only used when:
- Explicitly mentioned in task instructions as commands to run?
- Part of a workflow that specifies script execution?
- Created by the agent itself (and thus known)?

### For System Design
The "pull" model of tool discovery is dead across all evidence:
- Tools: 0% spontaneous discovery (EXP-028)
- Skills: 0% nudge-based discovery (EXP-030)
- Scripts: 0% task-hint-based discovery (EXP-031b)

**Only push delivery works.** Resources must be injected directly into the agent's execution context (system prompt, workflow steps, or specific task commands) to be used.

---

## Session Details

| Arm | Gym Run Dir | Session ID |
|-----|------------|------------|
| A | /tmp/gym-run-R5HAM9 | s_1775371571119_0 |
| B1 | /tmp/gym-run-txoHvX | s_1775371619108_0 |
| B2 | /tmp/gym-run-CBXWr2 | s_1775371707163_0 |

---

## Future Work

1. **Arm C (silent scripts)**: Predicted 0% — likely confirmed by these results, skip unless contradicted
2. **Arm D (tool equivalent)**: Still worth testing — tools appear in the tool list, which is a fundamentally different salience mechanism
3. **Harder task variant**: Would scripts be discovered if the task was UNSOLVABLE without them? (e.g., encrypted logs that require a decryption script)
4. **Forced script scenario**: Task that explicitly says "Run `./scripts/trace-error.sh ERROR` and use the output to fix the bug" — tests compliance with specific commands vs general hints
