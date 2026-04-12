---
name: investigate-and-fix
description: >
  Single-agent pattern for diagnosing and fixing issues in code or configuration.
  Covers the full cycle: understand context → reproduce/confirm issue → identify root cause →
  implement fix → verify fix → report. This is the most frequently used pattern across
  tech-lead, optimizer, and coder agents — observed in 70%+ of their sessions.
version: 1.1.0
tools: [read, bash, edit, write, finish]
agents: [tech-lead, optimizer, coder]
tested: true
gym_scenarios: [investigate-fix-pattern, investigate-fix-pattern-fewshot]
gym_results: "EXP-019: Text injection 0/4 reproduce-first (zero delta). Workflow 2/2 (0%→100%). EXP-091: Few-shot 3/3 reproduce-first (0%→100%), 5/5 process. Control 0/3 reproduce-first, 4/5 process."
verdict: disproven (text) / proven (workflow, few-shot)
---

# Skill: Investigate and Fix

## When to Use
You have a reported issue, failing test, error log, or suspicious behavior and need to
find the root cause and fix it. This pattern applies whether you received a bug report,
found an anomaly during monitoring, or are responding to a failing CI check.

## The Pattern (5 Steps)

### Step 1: Understand Context (DO NOT SKIP)
Before touching any code, gather context:

```
read(heartbeat/task)     → What am I asked to fix?
read(relevant-source)    → What does the current code look like?
bash("grep -rn 'error_pattern' src/")  → Where does the symptom appear?
```

**Key discipline**: Read at least 2 files before making any edit. Agents who jump
straight to editing based on the task description alone fix the wrong thing 40% of
the time (observed across 30 sessions, 2026-03-19).

### Step 2: Reproduce / Confirm the Issue
Verify the issue exists before fixing it:

```
bash("node test.js")           → See the actual failure
bash("cat error.log | tail")   → See the actual error message
read(file, offset=N)           → See the actual broken state
```

**Why this matters**: 3 out of 10 "bug reports" turn out to be already-fixed or
misdiagnosed. Reproducing first saves wasted effort.

### Step 3: Identify Root Cause
Trace from symptom to cause. Common techniques:

- **Grep for the error string** in source code
- **Read the function** that produces the error
- **Check recent changes**: `bash("git log --oneline -10 <file>")`
- **Read tests** to understand expected behavior
- **Check imports/dependencies** for version or path issues

**Anti-pattern**: Guessing the cause without reading the code. Even if you're 90%
sure, read the source to confirm. Wrong guesses waste 5-15 minutes of context.

### Step 4: Implement the Fix
Make the minimal change that addresses the root cause:

```
edit(file, oldText, newText)   → Surgical fix
bash("npx tsc --noEmit")      → Check compilation
```

**Key principles**:
- **Minimal diff**: Change only what's broken. Don't refactor adjacent code.
- **One fix per edit**: If there are 2 bugs, make 2 separate edits.
- **Check compilation immediately** after each edit — don't batch.

### Step 5: Verify the Fix (MANDATORY)
This is where most agents fail. Verification requires **tool output proving correctness**:

```
bash("node test.js")           → All tests pass (check exit code + output)
read(file, offset=N)           → Read back edited lines to confirm content
bash("npx tsc --noEmit")      → Zero type errors
```

**Verification checklist**:
- [ ] Read back the edited file (at least the changed lines)
- [ ] Run the relevant test suite
- [ ] Confirm zero new compilation errors
- [ ] If the fix is behavioral, run a manual test

**Anti-pattern**: Claiming "done" based on the edit alone. An edit that compiles but
doesn't fix the issue is worse than no edit — it gives false confidence.

## Worked Example: Debugging an API Endpoint Crash

An engineer was asked to fix a `/api/products/:id` endpoint that returned 500 errors for some product IDs. The error was `TypeError: Cannot read properties of undefined (reading 'price')`.

**Step 1 — Reproduce first (before touching any code):**
```
$ node test.js
  ✅ standard product returns correctly
  ❌ imported product with nested pricing fails: Cannot read properties of undefined (reading 'price')
  ❌ product with missing price crashes
  ✅ invalid product ID returns 404
2 passed, 2 failed out of 4 tests
```
The engineer ran tests FIRST to see the actual failure pattern. This revealed that 2 products failed (not just 1), pointing toward the data layer.

**Step 2 — Read the data layer (not just the API handler):**
The engineer read `products-db.js` and found product #2 used `pricing.amount` instead of `price` — an imported format. This was the ROOT CAUSE, not just a null check issue. Without reading the data file, the fix would have been incomplete.

**Step 3 — Fix with full understanding:**
Updated the handler to handle all three cases: standard `price`, imported `pricing.amount`, and null/missing. One surgical edit addressing the real root cause.

**Step 4 — Verify:**
```
$ node test.js
4 passed, 0 failed out of 4 tests
```

**Key insight**: Running tests before editing revealed the failure pattern that pointed to the data layer. Without reproduce-first, the engineer would have guessed "null check" and missed the imported format entirely.

## Evidence From Real Sessions

### Pattern Match: Tech-lead fixing convention-check handler (s_1773924664831_95)
1. Read implementation-plan.md, Bob's spec, Bob's directive (context)
2. Read existing handler code, DB schema, cron config (current state)
3. Checkpoint understanding before implementing
4. Add DB schema → Create handler → Update cron.json (3 surgical changes)
5. Verify: node -e TypeScript check, verify cron.json, check handler loading
Result: Working handler deployed.

### Pattern Match: Optimizer fixing gym stale binary (s_1773908xxxxx)
1. Read gym test output (symptom: tests failing)
2. Check binary dates vs code dates (reproduction)
3. Found bundle/may-agent was March 17, missing new presets (root cause)
4. Rebuild binary, add staleness check to run scripts (fix)
5. Run gym scenarios, verify pass rates (verification)
Result: Coder passes 5/5 cascading-error, 4/4 judgment-security-legit.

### Anti-pattern: Coach Step 4 wandering (s_1773899695055_13, cost $6.49)
1. Read task description ✓
2. Attempted to investigate but made 63 bash calls ✗
3. Wandered through file system without targeted search ✗
4. 2.1M input tokens consumed for a mechanical task ✗
Root cause: No Step 3 (targeted root-cause search). Random exploration is not investigation.

## Assertions (for gym testing)

A session using this skill correctly will:
1. **Read before edit**: At least 2 read/bash calls before the first edit/write
2. **Reproduce first**: Evidence of the bug/issue in tool output before the fix
3. **Verify after fix**: At least 1 read or bash call after the last edit
4. **Minimal diff**: Total edits ≤ 3 for a single-issue fix
5. **Report accurately**: finish() status matches actual verification results

## ⚠️ Task-Type Restriction

Do NOT use this few-shot skill on **discovery, exploration, or creative-inference tasks**
(e.g., knowledge integration, open-ended research, novel pattern discovery).
KE-133 showed a **-67pp effect** (p=0.030) — template-following displaces the open
exploration these tasks require. Only apply this skill to well-defined debugging/fixing tasks.

## Inviolable Constraints
- ⛔ Never edit a file you haven't read first
- ⛔ Never claim a fix works without running verification
- ⛔ Never make > 5 edits for a single bug (scope creep signal)
- ⛔ Never ignore a failing verification — fix or escalate
