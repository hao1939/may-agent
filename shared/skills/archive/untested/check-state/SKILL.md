---
name: check-state
description: >
  Deterministic state-checking skill for verifying termination conditions in code,
  not via LLM judgment. Implements P14 Deterministic Guardrails and P17 Hybrid
  Execution (MAST arXiv:2503.13657). Agents MUST pass a check_state gate before
  claiming a task is complete. This is the L2 Kinetic Defense against hallucination.
version: 1.0.0
tools: [bash, read]
dependencies: [verification, file-safety]
---

# Skill: Check State (Deterministic Termination)

## Context

**Problem**: Agents use LLM judgment to decide if a task is complete. This leads to
"lazy success" — the agent *feels* done, says "Done", but the work is wrong or
incomplete. MAST research (arXiv:2503.13657) shows a 52% higher failure rate when
agents self-verify without external tools.

**Solution**: A `check_state` protocol that runs **deterministic, code-based assertions**
before any agent can claim completion. The agent proposes termination; the *code* decides.

> "Feeling done" is not "Done". — P14 Deterministic Guardrails

## Core Principles

### 1. Code Checks, Not LLM Checks (P17)
Every termination condition MUST be verified by a tool call that returns machine-readable
evidence. The LLM interprets the *result* — it never *produces* the result.

| ❌ LLM Simulation | ✅ Code Check |
|---|---|
| "The JSON looks valid" | `python3 -c "import json; json.load(open('f.json'))"` → exit 0 |
| "I think the file exists" | `test -f path && echo TRUE \|\| echo FALSE` |
| "The test should pass" | `npx vitest --run test.ts` → check exit code |
| "I added the function" | `grep -q 'function myFunc' file.ts && echo TRUE \|\| echo FALSE` |

### 2. Assertions Are Binary
Every check returns exactly one of two values:
- **PASS** (exit code 0, output contains `TRUE` or expected evidence)
- **FAIL** (exit code ≠ 0, output contains `FALSE` or unexpected evidence)

There is no "maybe". There is no "probably fine". There is no "close enough".

### 3. Evidence Is Mandatory
A check without captured output is not a check. Every assertion MUST produce
evidence that can be logged, audited, and replayed.

## Assertion Library

These are the canonical assertions agents MUST use. Each is a bash one-liner
that can be run via the `bash` tool.

### `exists(path)` — File/directory exists
```bash
test -e "<path>" && echo "CHECK_STATE:PASS:exists:<path>" || echo "CHECK_STATE:FAIL:exists:<path>"
```

### `file_exists(path)` — Regular file exists (not directory)
```bash
test -f "<path>" && echo "CHECK_STATE:PASS:file_exists:<path>" || echo "CHECK_STATE:FAIL:file_exists:<path>"
```

### `dir_exists(path)` — Directory exists
```bash
test -d "<path>" && echo "CHECK_STATE:PASS:dir_exists:<path>" || echo "CHECK_STATE:FAIL:dir_exists:<path>"
```

### `contains(path, text)` — File contains exact text
```bash
grep -qF "<text>" "<path>" && echo "CHECK_STATE:PASS:contains:<path>" || echo "CHECK_STATE:FAIL:contains:<path>"
```

### `matches(path, pattern)` — File matches regex pattern
```bash
grep -qE "<pattern>" "<path>" && echo "CHECK_STATE:PASS:matches:<path>" || echo "CHECK_STATE:FAIL:matches:<path>"
```

### `valid_json(path)` — File is valid JSON
```bash
python3 -c "import json,sys; json.load(open(sys.argv[1])); print('CHECK_STATE:PASS:valid_json:'+sys.argv[1])" "<path>" 2>/dev/null || echo "CHECK_STATE:FAIL:valid_json:<path>"
```

### `valid_yaml(path)` — File is valid YAML
```bash
python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1])); print('CHECK_STATE:PASS:valid_yaml:'+sys.argv[1])" "<path>" 2>/dev/null || echo "CHECK_STATE:FAIL:valid_yaml:<path>"
```

### `exit_zero(cmd)` — Command exits with code 0
```bash
<cmd> >/dev/null 2>&1 && echo "CHECK_STATE:PASS:exit_zero" || echo "CHECK_STATE:FAIL:exit_zero"
```

### `exit_code(cmd, expected)` — Command exits with specific code
```bash
<cmd> >/dev/null 2>&1; code=$?; [ "$code" -eq <expected> ] && echo "CHECK_STATE:PASS:exit_code:$code" || echo "CHECK_STATE:FAIL:exit_code:$code"
```

### `line_count(path, op, n)` — File has expected line count
```bash
count=$(wc -l < "<path>"); [ "$count" <op> <n> ] && echo "CHECK_STATE:PASS:line_count:$count" || echo "CHECK_STATE:FAIL:line_count:$count"
```
Operators: `-eq`, `-gt`, `-lt`, `-ge`, `-le`

### `not_empty(path)` — File is non-empty
```bash
test -s "<path>" && echo "CHECK_STATE:PASS:not_empty:<path>" || echo "CHECK_STATE:FAIL:not_empty:<path>"
```

### `no_match(path, pattern)` — File does NOT contain pattern (absence check)
```bash
grep -qE "<pattern>" "<path>" && echo "CHECK_STATE:FAIL:no_match:<path>:pattern_found" || echo "CHECK_STATE:PASS:no_match:<path>"
```

## Compound Assertions

For multi-condition checks, chain assertions with `&&`:

```bash
# All three must pass
test -f "out.json" && \
  python3 -c "import json; json.load(open('out.json'))" 2>/dev/null && \
  grep -qF '"status": "ok"' out.json && \
  echo "CHECK_STATE:PASS:compound:out.json" || \
  echo "CHECK_STATE:FAIL:compound:out.json"
```

## The `check_state` Protocol

### Before Claiming "Done"

Every agent MUST execute this protocol before finishing a task:

```
┌─────────────────────────────┐
│  Agent believes task is done │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  1. Identify termination    │
│     conditions (what MUST   │
│     be true for "done"?)    │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  2. Map each condition to   │
│     an assertion from the   │
│     Assertion Library above │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  3. Run ALL assertions via  │
│     bash tool calls         │
└──────────────┬──────────────┘
               │
          ┌────┴────┐
          │         │
     ALL PASS    ANY FAIL
          │         │
          ▼         ▼
┌──────────────┐ ┌────────────────────┐
│ 4a. Log      │ │ 4b. DO NOT finish. │
│   evidence,  │ │   Fix the failure, │
│   finish     │ │   re-run checks.   │
│   the task   │ │   Loop until PASS  │
│              │ │   or escalate.     │
└──────────────┘ └────────────────────┘
```

### Step-by-Step Example

**Task**: "Create a config file `config.json` with a `port` field set to 8080."

```
Step 1 — Identify conditions:
  - config.json must exist
  - config.json must be valid JSON
  - config.json must contain "port": 8080

Step 2 — Map to assertions:
  - file_exists("config.json")
  - valid_json("config.json")
  - contains("config.json", '"port": 8080')

Step 3 — Run assertions:
```

```bash
test -f "config.json" && echo "CHECK_STATE:PASS:file_exists:config.json" || echo "CHECK_STATE:FAIL:file_exists:config.json"
```
```bash
python3 -c "import json,sys; json.load(open(sys.argv[1])); print('CHECK_STATE:PASS:valid_json:'+sys.argv[1])" "config.json" 2>/dev/null || echo "CHECK_STATE:FAIL:valid_json:config.json"
```
```bash
grep -qF '"port": 8080' config.json && echo "CHECK_STATE:PASS:contains:config.json" || echo "CHECK_STATE:FAIL:contains:config.json"
```

```
Step 4 — All PASS? → Finish. Any FAIL? → Fix → Re-run.
```

## Integration: Who Uses This and When

| Agent | When to Check | Typical Assertions |
|-------|---------------|-------------------|
| **Coder** | Before finishing any implementation task | `file_exists`, `exit_zero(tsc)`, `exit_zero(vitest)`, `contains` |
| **QA** | Before approving any review | `exit_zero(test suite)`, `valid_json`, `no_match(*.ts, "// TODO")` |
| **Tech-Lead** | Before merging or promoting | `exit_zero(full test suite)`, `contains(CHANGELOG)` |
| **Scout** | Before submitting research deliverables | `file_exists(deliverable)`, `not_empty(deliverable)`, `line_count(deliverable, -gt, 10)` |
| **Bob** | Before publishing briefs/syntheses | `file_exists(output)`, `not_empty(output)` |

## Output Format

All assertions use the canonical prefix `CHECK_STATE:` for grep-ability and auditability:

```
CHECK_STATE:PASS:<assertion_name>:<target>[:<detail>]
CHECK_STATE:FAIL:<assertion_name>:<target>[:<detail>]
```

This format enables:
- **Automated auditing**: `grep "CHECK_STATE:FAIL" session.log` → find all failures
- **Receipt integration (P61)**: Log CHECK_STATE outputs alongside tool receipts
- **Drift detection**: Compare expected checks vs. actual checks per task type

## The `check_state` Runner Script

For convenience, a runner script is provided at `agents/shared/skills/check-state/run-checks.sh`.
It accepts a checklist file (one assertion per line) and runs them all, reporting a summary.

Usage:
```bash
bash agents/shared/skills/check-state/run-checks.sh <checklist-file>
```

Checklist file format:
```
file_exists config.json
valid_json config.json
contains config.json "port": 8080
exit_zero npx tsc --noEmit
```

## Anti-Patterns

### AP-1: "Skipped Gate"
**Pattern**: Agent runs checks, one fails, agent finishes anyway with a caveat.
**Fix**: A FAIL is a FAIL. Fix it or escalate. Never finish with a failing check.

### AP-2: "Soft Check"
**Pattern**: Agent uses `read()` to look at a file and says "looks valid" instead
of running `valid_json` or `grep`.
**Fix**: Use the Assertion Library. Human-eye validation by an LLM is not validation.

### AP-3: "Missing Conditions"
**Pattern**: Agent checks file exists but doesn't check content. File is empty.
**Fix**: Always include a content assertion (`contains`, `not_empty`, `valid_json`)
alongside existence checks.

### AP-4: "Check Theater"
**Pattern**: Agent runs assertions but doesn't read/parse the output. Claims PASS
without confirming the output actually says PASS.
**Fix**: After running an assertion, explicitly look for `CHECK_STATE:PASS` or
`CHECK_STATE:FAIL` in the output. Do not assume.

### AP-5: "Stale Check"
**Pattern**: Agent runs checks, then makes additional edits, then finishes without
re-running checks.
**Fix**: Checks must be the LAST thing before finishing. Any post-check edit
invalidates all prior checks.

## Inviolable Constraints

- ⛔ **Never finish a task without running at least one `check_state` assertion.**
- ⛔ **Never finish a task with any `CHECK_STATE:FAIL` in the output.**
- ⛔ **Never substitute LLM judgment for a code-based assertion.**
- ⛔ **Never run checks before your final edit.** Checks are the last gate.
- ⛔ **Never ignore a check result.** Read the output. Parse PASS/FAIL explicitly.

## References

- **P14**: Deterministic Guardrails — external state checks for termination
- **P17**: Hybrid Execution — code for certainty, AI for ambiguity
- **P61**: Ops Receipts — structured evidence for tool executions
- **MAST**: arXiv:2503.13657 — Multi-Agent Safety/Termination research
- **Verification Skill**: `agents/shared/skills/verification/SKILL.md` — broader verification protocols
- **File Safety Skill**: `agents/shared/skills/file-safety/SKILL.md` — read/write safety
