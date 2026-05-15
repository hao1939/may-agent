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

**Evidence**: tech-lead ran `cd /app && npm test` (wrong cwd, wrong runner), got exit 1, then ran `npx vitest --run` (correct) but never re-ran the original failing command to confirm full coverage.

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
