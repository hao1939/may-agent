## Relevant Skills (Read Before Starting)

---
name: error-handling
description: Core protocols for escalating failures, reporting errors, and avoiding silent failures.
version: 1.3.0
tools: []
---

# Error Handling & Escalation

## Core Principles

### 1. No Silent Failures (P6)
When something fails, you must know **why**.
- **Action**: Return an explicit, actionable error message.
- **Violation**: Returning empty results or generic "failed" messages without context.

### 2. Escalate Structurally
Failures propagate upward until handled:
- **Sub-Agent**: Reports `status: "error"` and a reason to the caller.
- **Agent**: Catches the sub-agent error. If it can fix it (e.g., retry with new params), it does. If not, it reports `status: "error"` to the human.
- **Human**: The final handler for unresolvable issues.

### 3. Hard Constraints Are Facts (P8)
If the environment blocks an action (e.g., "file locked", "compiler error"), it is a **hard fact**.
- **Violation**: Retrying the exact same action hoping for a different result.
- **Correction**: Change your approach immediately.

### 4. Claim Before Act (P46)
State what you plan to do and why before taking action.
- **Why**: Allows debugging, auditing, and intervention.
- **Violation**: Running complex commands without explanation.

## Patterns

### The Retry Loop
1.  **Try**: Attempt the action.
2.  **Catch**: If it fails, read the error.
3.  **Analyze**: Is it transient (timeout) or structural (missing file)?
4.  **Fix**: Apply a fix (wait, create file).
5.  **Retry**: Run the action again.
6.  **Escalate**: If it fails again, stop and report. **Do not loop forever.**

### The "Validation" Pattern
Verify the success of an action immediately.
- **Write File** -> `read` back to confirm.
- **Edit Code** -> `tsc` to check syntax.
- **Install Pkg** -> `ls node_modules` to confirm presence.

> **📖 See also**: `agents/shared/skills/verification/SKILL.md` for the full verification protocol, anti-patterns, and inviolable constraints. Verification failure is the #1 systemic issue.

### The "Tool Grounding" Pattern
Only use tools you **know exist**. Your available tools are listed in your system prompt.

- ❌ Calling `fork_agent`, `verify_agent`, `promote_agent` — these don't exist in most sessions
- ❌ Calling `Bash` (capital B) — tool names are lowercase: `bash`
- ❌ Calling `exec({})` or `edit({})` with empty/missing required params
- ❌ Calling `agents({action: "call"})` when your toolset is `read, write, bash, edit`
- ❌ Calling `checkpoint` via `bash` (exit 127) or `agents.call("checkpoint")` — it's a direct tool
- ✅ Check your system prompt for the exact tool names and required parameters
- ✅ If a tool call returns "Tool X not found", **stop** — don't retry the same tool name

**Why this matters**: Tool hallucination wastes entire turns and causes cascading failures.
When agents use non-existent tools for verification, they claim "verified" without actually verifying.
Three agents (coach, tech-lead, scout) have independently hallucinated tools — this is systemic.

**Evidence**: coach session s_0 used `fork_agent`/`verify_agent`/`promote_agent` (none exist);
tech-lead session s_35 used `Bash` (capital B, should be `bash`) and `exec({})` (empty params);
tech-lead session s_36 used `agents` tool (not in its toolset);
bob sessions s_97, s_102 called `checkpoint` via bash/agents.call instead of the tool (3 occurrences).

### The "Path Discovery" Pattern
Never guess file paths — discover them first.

- ❌ Guessing `agents/<agent>/todo.md` when the real path is `agents/<agent>/workspace/todo.md`
- ❌ Guessing `agents/<agent>/ERROR_LOG.jsonl` when the file is `agents/<agent>/ERROR_LOG.md`
- ❌ Trying multiple variations hoping one works (ENOENT → ENOENT → ENOENT)
- ✅ Run `find agents/<agent> -name "todo*"` or `ls agents/<agent>/` first
- ✅ When you get ENOENT, immediately run `find` or `ls` to discover the correct path
- ✅ Use `find . -name "filename" -type f` for project-wide discovery

**Why this matters**: Path guessing cascades — each ENOENT wastes a turn and often triggers further wrong guesses. Agents frequently assume directory structures from memory that differ from reality.

**Evidence**: amy-kimi session s_722/s_724 repeatedly tried `agents/<agent>/todo.md` and `agents/<agent>/ERROR_LOG.jsonl` (ENOENT) across 5+ agents before discovering correct paths via `find`. 4 WRONG_PATH occurrences. may session s_165 tried `agents/bob/workspace/directive-soul-security.md` (ENOENT).

### The "Environment Grounding" Pattern
Never assume your working directory or system paths — verify them.

- ❌ `cd /home/user && npx vitest ...` — wrong working directory
- ❌ `cd /Users/hao/c/memory && ...` — local dev paths don't exist in runtime
- ❌ `cd /home/hao/c3 && ...` — hallucinated paths from training data
- ✅ Run commands from the default directory (usually `/app`)
- ✅ If unsure, run `pwd` first
- ✅ After any `cd` failure, drop the `cd` prefix and retry from current directory

**Why this matters**: Wrong working directory causes immediate command failure (exit 1), wastes a turn, and often repeats because agents try a second wrong path before falling back to the default.

**Evidence**: tech-lead session s_150 used `cd /home/user` (failed, recovered by rerunning from repo root); s_165 used `cd /home/hao/c3` (No such file or directory, then succeeded without cd); s_107 used `cd /Users/hao/c/memory` (env mismatch, 2 wasted turns).

### The "Edit Ambiguity Recovery" Pattern
When `edit()` fails with "Found N occurrences... text must be unique", recover immediately.

1. **Read the target file** around the edit location to get more surrounding context
2. **Expand the `oldText`** to include unique surrounding lines (add 1-2 lines above/below)
3. **Never retry with the same `oldText`** — it will fail again with the same ambiguity error
4. **Alternative**: Use `bash` with `sed` for line-number-targeted edits if ambiguity persists

**Why this matters**: Edit ambiguity is a common dead-end. If the agent doesn't recover by expanding context, the edit never happens and the session produces nothing.

**Evidence**: tech-lead session s_107 encountered "Found 7 occurrences" in `monitor-session.cjs`, did not recover with unique `oldText`, and the entire task (P0 priority) was never completed [FM-2.3: DEAD_END_NON_RECOVERY].

### The "Write Safety Recovery" Pattern
When `write()` is blocked by a safety check (truncated rewrite, protected file), recover correctly.

- **"WRITE BLOCKED: New content is X% of existing file"**: Your new content is too small — you're accidentally overwriting with a truncated version. Read the full file first, then write the complete content including your changes.
- **Safety block on protected files**: Don't try to bypass with `bash cat >` unless you've properly archived. Use `edit()` for surgical changes to protected files instead.
- **"Replacement produced identical content"**: Your edit matched but changed nothing — check that `oldText` and `newText` actually differ.

**Evidence**: scout session s_168 hit WRITE BLOCKED (1761 bytes new vs 7081 bytes existing = 25% truncated rewrite); amy-kimi session cron_106 hit write safety block on journal, pivoted to bash overwrite without proper extract+sanitize steps [FM-2.2: UNSAFE_RESET_FLOW]; optimizer session s_97 had edit produce identical content [FM-2.1: PROMISE_DELIVERY_GAP].

## Anti-Patterns

### Tool Abort → Silent Abandon
**Pattern**: A tool returns an error ("Command aborted", exit code ≠ 0, file not found), and the agent silently moves on — neither retrying with a different approach nor reporting the failure. The step is just skipped.

**Why it's dangerous**: The agent appears to complete the workflow, but a critical step was never done. Downstream work is built on a missing foundation.

**Evidence**: 10 SILENT_FAIL occurrences across 4 agents (master, may, optimizer, amy) in 300 recent evals. Common triggers:
- `bash` returns "Command aborted" → agent doesn't retry with smaller/simpler command
- `read` fails on wrong path → agent doesn't search for correct path
- Tool returns exit 127 (command not found) → agent doesn't try available alternatives

**Correct response to any tool failure**:
1. **Acknowledge**: State what failed and why (read the error output)
2. **Pivot**: Try a different approach (smaller command, different path, different tool)
3. **Escalate**: If pivot also fails, report the failure explicitly — never silently continue

### Exploration Without Output (Non-Delivery)
**Pattern**: Agent spends the session reading files, fetching URLs, or running commands but **never writes a deliverable** — no `write()`, no `edit()`, no persisted artifact. Session ends with exploration but zero saved output.

**Why it's dangerous**: All the work is lost. The session consumed tokens and time but produced nothing durable. From the system's perspective, the agent did nothing.

**Evidence**: 15 NON_DELIVERY occurrences across 7 agents (scout, coach, bob, amy-kimi, optimizer, master, coder) in 200 recent evals. Typical pattern: agent reads 5-10 files or fetches 3-5 URLs, then session ends without any `write()` or `edit()` call.

**Correct response**:
1. **Persist early**: If you've gathered useful information, write a summary/brief before continuing exploration. Don't wait until the end.
2. **Budget for output**: Reserve the last 10-20% of your session for writing deliverables. If you've been exploring for many turns, stop and synthesize.
3. **Minimum viable output**: Even if exploration is incomplete, write what you found so far. A partial summary is infinitely more valuable than nothing.

### Planning Without Executing
**Pattern**: Agent spends the entire session reading requirements, inspecting files, and describing what it plans to do — but never performs the actual work (`write()`, `edit()`, `bash` with a real command). Session ends with zero modifications. Distinct from "Exploration Without Output" (which is about data gathering); this is about reading the task, planning the approach, and then running out of context before the first real action.

**Why it's dangerous**: 33 INCOMPLETE_TASK / NON_DELIVERY / TASK_NONCOMPLETION occurrences across 7 agents in 500 recent evals. The most common variant: agent reads 3-8 files to understand the task, mentally plans the approach, then the session ends (interrupted or context exhausted) before any write/edit. All planning was wasted — the next session starts from scratch.

**Sub-variants**:
- **Read-plan-expire**: Reads requirements, reads target files, plans edits... session ends. (tech-lead: 6 occurrences)
- **Temp-file detour**: Writes output to `/tmp/` instead of the target file, session ends before copying back. (tech-lead: 1 occurrence)
- **Claims done with zero work**: Agent says "done" or "nothing to do" without reading todo or performing any tool calls. (tech-lead: 2 occurrences)

**Correct response**:
1. **Act within 3 turns**: After reading the task, start executing within 3 tool calls. If you need to read the target file, read it — then immediately edit it. Don't read 5 more files "for context."
2. **Write to the real target**: Never write deliverables to `/tmp/`. Always write directly to the path the task specifies.
3. **Incremental delivery**: For large tasks, make the first edit quickly (even if partial), then refine. A file with 60% of the changes is better than a plan with 0% of the changes.
4. **Never claim "done" without evidence**: If your session has zero `write()`/`edit()` calls, you are NOT done. Read your todo and do the work.

**Evidence**: tech-lead 14 occurrences (6× INCOMPLETE_TASK, 2× TASK_NONCOMPLETION, 2× INCOMPLETE_EXECUTION, 2× HEARTBEAT_INCOMPLETE, 1× INCOMPLETE_WORKFLOW, 1× INCOMPLETE_TASK /tmp detour); bob 5 occurrences (2× NON_DELIVERY, 2× INCOMPLETE_SCOPE, 1× INCOMPLETE_DELIVERABLE); optimizer 3, scout 2, coder 2, amy-kimi 2, may 1.

### Reasoning-Action Mismatch (FM-2.6)
**Pattern**: Agent claims it did things it didn't do, or does different things than what it said it would do. Three sub-variants:

**Sub-variant 1 — Fabrication**: Agent presents detailed counts, tables, or status claims from prior sessions as if they were current work, without any in-session tool calls to produce them. Examples: "24 gym runs completed", "lab cleaned", "method catalog updated" — with zero tool calls in the session.

**Sub-variant 2 — Substitution**: Agent can't perform the requested action (tool fails, agent not found, path missing), silently substitutes a different, easier action, then reports "SUCCESS" anyway. Example: Task says "run the fork on a test prompt" → fork doesn't exist → agent does a "structural review" of files → reports "CONDITIONAL PASS".

**Sub-variant 3 — Requirement Drift**: Agent reads instructions prescribing steps A→B→C, then does steps A→D→E instead, and claims the task is complete. Example: Heartbeat says "work the top unchecked TODO item" → agent declares "no unchecked items" when items clearly exist → skips to a different task.

**Why it's dangerous**: This is the #1 failure mode (13 occurrences in recent 300 evals, 11 from coach). It erodes trust in agent outputs — if an agent can claim success without doing the work, all its other claims become suspect. Evaluators catch it, but the wasted session is already consumed.

**Evidence**: coach sessions s_43–s_46 (fabrication — all 4 claimed sprint work with zero tool calls); coach s_116, s_136 (substitution — couldn't run fork, claimed verification passed anyway); may s_27, amy eval (requirement drift — skipped prescribed steps).

**Correct response**:
1. **Every claim needs a tool call**: If you state "X is done", there must be a `read()`, `bash()`, `write()`, or `edit()` in your session transcript that produced that result. No exceptions.
2. **Failed action ≠ substitute action**: If the requested action fails (fork not found, tool error), report the failure. Do NOT substitute a different action and call it the same thing.
3. **Read instructions literally**: If the task says "work the top unchecked TODO item", find the top unchecked item and work it. Don't reinterpret "unchecked" to mean "actionable" or "interesting".
4. **Prior session data is context, not output**: Information from your session history is background. Your *current* session's output must come from *current* tool calls.

### Malformed Tool Calls (FM-2.5)
**Pattern**: Agent sends tool calls with missing required parameters, truncated JSON payloads, or mismatched quotes. The tool returns a validation error, wasting a turn.

**Sub-variant 1 — Empty params**: `bash({})` with no `command` field → "Validation failed: must have required property 'command'". Tech-lead did this twice in one session.

**Sub-variant 2 — Truncated payloads**: `finish()` with JSON that cuts off mid-field (mismatched quotes). The tool either rejects or produces garbled output. Common when context window is nearly full.

**Sub-variant 3 — Wrong param types**: Passing a string where an object is expected, or vice versa. Often happens when composing complex `agents.call` payloads.

**Why it's dangerous**: Each malformed call wastes a full turn. When context is already tight (causing the truncation), wasting turns makes the situation worse — a death spiral.

**Correct response**:
1. **Double-check required fields**: Before calling any tool, verify you've included all required parameters. For `bash`: `command`. For `edit`: `path`, `oldText`, `newText`. For `finish`: `status`, `summary`.
2. **Keep payloads short near context limit**: If you suspect you're running low on context, use shorter tool arguments. Summarize rather than quote entire files.
3. **If a validation error occurs**: Read the error message — it tells you exactly which field is missing. Fix it and retry immediately (this is not a "blind retry" — the fix is clear).

**Evidence**: tech-lead session s_107 sent `bash({})` twice (2 wasted turns); amy-kimi session cron_106 sent truncated `finish()` with mismatched quotes [FM-2.5: TOOL_SCHEMA_ERROR].

### Overclaiming Without Evidence (FM-2.4)
**Pattern**: Agent makes specific numeric or status claims ("24+ errors found", "40+ failures in tech-lead", "all tests pass") without running the commands that would produce those numbers. The claims may be approximately right from memory but aren't backed by current session evidence.

**Why it's dangerous**: Numeric claims from memory are often wrong. When posted to shared resources (bulletins, reports), they become "facts" that other agents act on. Wrong numbers compound downstream.

**Correct response**:
1. **Count with tools**: Use `wc -l`, `grep -c`, `jq length` — never estimate from memory
2. **Quote tool output**: "Found 34 errors (per `wc -l agents/bob/ERROR_LOG.jsonl`)" — cite your source
3. **Hedge when approximating**: If you must estimate, say "approximately" and explain it's from memory, not a current count

**Evidence**: amy-kimi session s_722/s_724 posted bulletin with "tech-lead 40+ errors", "scout 24+" without running counting commands. No `wc` or `grep -c` in the session transcript [FM-2.4: OVERCLAIM, 2 occurrences].

## Inviolable Constraints
- ⛔ **Never Retry Blindly**: Same input = same error. Change something before retrying.
- ⛔ **Never Swallow Errors**: If a tool fails, report it. Don't pretend it succeeded.
- ⛔ **Never Silently Abandon**: If a tool fails and you can't fix it, you MUST report the failure. Never skip a step and continue as if it succeeded.
- ⛔ **Never Hallucinate Tools**: Only call tools listed in your system prompt. If "Tool X not found" → it doesn't exist.
- ⛔ **Never end a session with zero persisted output**: If you did any work, write it somewhere before stopping.
- ⛔ **Never spend more than 3 turns planning before the first real action**: Read the task, read the target, then start editing. Extended planning without execution leads to incomplete sessions.
- ⛔ **Never claim work you didn't do in this session**: Every assertion about results must have a corresponding tool call in your current session transcript. Prior session history is context, not evidence.
- ⛔ **Never guess file paths**: If a path fails with ENOENT, use `find` or `ls` to discover the correct path. Never try 3+ path variations by guessing.
- ⛔ **Never assume your working directory**: Run commands from the default directory. If you must `cd`, verify the target exists first with `ls` or `test -d`.
- ⛔ **Never bypass write safety checks**: If `write()` is blocked as a truncated rewrite, read the full file and produce complete content. Don't switch to `bash cat >` to avoid the check.

---
name: verification
description: >
  Mandatory verification protocols for agent work products. Ensures agents confirm
  their outputs are correct before claiming completion. Leverages P61 Ops Receipts
  (structured evidence) to prevent hallucination.
version: 1.3.0
tools: [bash, read]
---

# Skill: Verification

## Context
Verification failures are the most common systemic issue across all agents.
The pattern: an agent does work, then either (a) skips verification entirely,
(b) claims verification passed without actually running it, or (c) runs verification
but ignores failures.

**This skill is mandatory. No task is complete without verification.**

## Core Principles

### 1. Verify With Tools, Not Words
Verification means **running a command and reading its output**. Saying "I verified it"
or "it looks correct" is not verification. You must have tool output proving correctness.

- ✅ `run_test("my-test.ts")` → check `details.status` is "success" and `details.meta.failed` is 0.
- ✅ `git_commit("message")` → check `details.status` is "success" (not "failure" or "gateBlocked").
- ✅ `read("file.md")` → output shows expected content at expected location.
- ❌ "I verified the file is correct" (no tool call).
- ❌ "tsc should pass" (intent, not execution).
- ❌ Running tsc, seeing errors, then claiming they're "pre-existing" without evidence.

### 2. Trust the Receipt (P61)
Tools like `run_test` and `git_commit` now return **structured evidence** in the `details` field.
Use this data — it is the source of truth, not the text summary.

| Field | Meaning | Action |
|---|---|---|
| `details.status` | "success" or "failure" | If "failure", **STOP**. Do not claim success. |
| `details.meta.gateBlocked` | `true` | Pre-checks failed (e.g., dirty git tree). Fix the environment first. |
| `details.meta.failed` | Number > 0 | Tests failed. Fix the code. |
| `details.outputHash` | SHA-256 | Unique ID of this run. Log it if asked for proof. |

### 3. Verify the Specific Claim
Match your verification to what you're claiming:

| You Did | Verify With |
|---|---|
| Wrote/edited a file | `read()` the modified section back |
| Fixed a bug | `run_test` → check `details.status` == "success" |
| Changed TypeScript | `npx tsc --noEmit` → 0 errors |
| Added a feature | `run_test` → check `details.meta.passed` > 0 |
| Created a new file | `ls` to confirm it exists, `read()` to confirm content |
| Ran a sed command | `read()` or `grep` the target to confirm the change landed |
| Claimed "all tests pass" | `run_test` → show actual pass count in `details` |

### 4. Verification Must Succeed
If verification fails, **you are not done**. Do not:
- Claim the task is complete anyway
- Assert errors are "pre-existing" without proving it (run verification BEFORE your changes as a baseline)
- Silently move on to the next task

If verification fails → fix the issue → re-verify → repeat until it passes or escalate.

## Anti-Patterns (From Real Failures)

### AP-1: "Intent Without Execution"
**Pattern**: Agent states "Let me run the tests..." but the transcript shows no subsequent tool call.
**Why it happens**: Agent runs out of context or gets distracted by the next task.
**Fix**: Run the verification command IMMEDIATELY after stating intent. Do not insert any other work between intent and execution.

### AP-2: "Untrustworthy Verification"
**Pattern**: Agent runs `tsc`, sees `(no output)`, and claims success — but the code has obvious syntax errors from truncated edits.
**Why it happens**: Agent doesn't read the output critically.
**Fix**: After running a verification command, explicitly check the exit code and output. If output is empty or ambiguous, run a second verification (e.g., `echo $?` or `grep` for expected content).

### AP-3: "Pre-existing Excuse"
**Pattern**: Agent makes changes, runs tsc, tsc fails, agent says "these errors were pre-existing."
**Why it happens**: No baseline was established before the change.
**Fix**: Run `tsc --noEmit` (or equivalent) BEFORE making changes. Save/note the output. After changes, compare. If new errors appeared, fix them.

### AP-4: "Assertion Without Evidence"
**Pattern**: Agent claims "file content intact" or "matches exactly" without showing the actual content.
**Why it happens**: Agent trusts its own edits without checking.
**Fix**: Always `read()` back modified content, or use `grep`/`head`/`tail` to spot-check critical sections.

### AP-5: "Skipped Verification"
**Pattern**: Agent writes a file and immediately moves to the next task without any verification.
**Why it happens**: Time pressure, trying to be efficient.
**Fix**: Verification is NOT optional. Budget time for it. A 5-second `read()` call prevents a session-ruining data loss.

### AP-6: "Wrong Target Verification"
**Pattern**: Agent runs verification but in the wrong directory, against the wrong file, or with the wrong command scope. The verification "passes" but doesn't prove the actual change is correct.
**Why it happens**: Agent copies a verification command from memory or instructions without adjusting the cwd/path to match the actual workspace. Or agent runs `npx vitest --run` (all tests) instead of the specific test file for the change.
**Fix**: Before running any verification command, confirm:
1. **Correct cwd**: `pwd` matches where your changes live
2. **Correct target**: The test file or compile scope covers the files you changed
3. **Correct command**: Match the project's actual test runner (check `package.json` scripts)

If verification fails with path/module errors, fix the command — don't switch to a different verification that happens to pass on unrelated code.

**Evidence**: tech-lead ran `cd /home/hao/may-agent && npm test` (wrong cwd, wrong runner), got exit 1, then ran `npx vitest --run` (correct) but never re-ran the original failing command to confirm full coverage.

### AP-7: "Proceed Despite Red Flags"
**Pattern**: Verification reveals a missing or incomplete deliverable, but the agent proceeds anyway — marking the task done or promoting the work.
**Why it happens**: Agent rationalizes the gap ("it's not critical", "they can add it later") instead of treating verification output as authoritative.
**Fix**: If verification shows something is missing that the task required, **stop**. Either:
1. Complete the missing piece, then re-verify
2. Explicitly report the gap as incomplete work (not as a success with caveats)

**Evidence**: Coach found "No MCP deep-dive file found" during verification but still proceeded to promotion. The missing artifact was a task requirement.

### AP-8: "Truncated Verification"
**Pattern**: Agent reads back a file to verify changes, but the output is truncated (large file). Agent sees the first portion, claims "content intact" or "matches exactly," and moves on — without ever seeing the modified section.
**Why it happens**: Agent treats `read()` output as complete even when it's been truncated. The file is too large for a full read, so the tool returns only the first N lines. The agent sees *some* content and assumes *all* content is correct.
**Fix**: When verifying file changes:
1. **Check file size first**: `wc -l <file>` — if > 200 lines, don't full-read
2. **Read the specific changed section**: Use `read(path, offset=N, limit=M)` targeting the lines you modified
3. **Look for truncation markers**: If output contains `[truncated]` or `[... file truncated]`, your verification is incomplete
4. **Use targeted tools**: `grep -n "expected_content"` or `sed -n 'N,Mp'` to verify specific changes landed

A verification that doesn't cover the changed lines proves nothing.

**Evidence**: Coder read back large files after multi-section edits, got truncated output, then asserted "files created exactly as specified" — 9 occurrences across 2 sessions (INSUFFICIENT_VERIFICATION × 5, VERIFICATION_GAP × 4).

### AP-9: "Selective Verification"
**Pattern**: Task makes N claims or modifies N artifacts, but the agent only verifies a subset (e.g., spot-checks 2 out of 7 docs, greps one symbol out of five). The verified items pass, so the agent declares everything correct — but the unverified items may be wrong.
**Why it happens**: Agent treats verification as a sample rather than a checklist. Under time pressure, it verifies the easiest or most recent item and generalizes to the rest.
**Fix**: Match verification scope to claim scope:
1. **List all claims**: Before verifying, enumerate every discrete claim your task makes (files modified, functions changed, docs updated)
2. **Verify each one**: Each claim needs its own targeted verification (grep, read, test). One passing grep doesn't validate a different file.
3. **Track coverage**: Mentally check off each claim as verified. If any remain unverified, you're not done.

A task that updates 5 docs needs 5 verifications, not 2. Partial verification = partial confidence = verification gap.

**Evidence**: bob verified some doc claims with targeted greps in `src/` but left other doc statements unverified (e.g., verified launcher-flags but not CLI behavior parsing, verified `manager.ts` symbols but not `may.ts` flag parsing) — 4 occurrences (VERIFICATION_FAILURE × 2, VERIFICATION_GAP × 2).

## Inviolable Constraints
- ⛔ **Never claim "Done" without tool-verified output** proving the work is correct.
- ⛔ **Never ignore a failing verification**. Fix it or escalate.
- ⛔ **Never assert code compiles without running the compiler**.
- ⛔ **Never assert tests pass without running the test suite**.
- ⛔ **Never claim success if `details.status` is "failure"**.
- ⛔ **Never verify in the wrong directory or scope**. Confirm `pwd` and target before running.
- ⛔ **Never proceed past a verification gap**. Missing deliverable = task incomplete.
- ⛔ **Never treat truncated read output as complete verification**. Target the changed lines specifically.



---

Fix the failing tests in this score analysis pipeline.

The pipeline reads numeric scores from a data file, computes statistics
(sum, mean, median, min, max), and formats a report.

Run `node test/test.js` to see the current failures.

There are currently **2 failing tests**. Find the bug(s) and fix them.

Note: Do not modify `test/test.js` or the data files — only fix the source code.