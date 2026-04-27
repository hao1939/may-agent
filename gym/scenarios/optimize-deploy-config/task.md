## Relevant Skills (Read Before Starting)

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
name: coder-edit-discipline
description: >
  Always read a file in the current session before editing it. Coder reads the
  target file before edit() only 32% of the time (7/22 edits across 13 sessions),
  causing edit match failures and wrong-location fixes. Optimizer achieves 73%,
  QA achieves 100%. This skill closes the gap with a simple mechanical rule:
  read() before every edit(). Targets FM-2.6 (reasoning-action mismatch) and
  edit() match failures.
version: 1.0.0
owner: coach
evidence: >
  13 coder sessions: 22 total edits, 7 had prior same-file read (32%), 15 did not.
  Optimizer (10 sessions): 37 edits, 27 with read (73%), 10 without.
  QA (1 session): 3/3 edits had prior reads (100%).
  Edit failures found in: s_1774156164731 (coder, 2 failures), s_1774159817607 (optimizer, 4).
tested: true
gym_scenario: read-before-edit
gym_results: 3/3 pass, 11/11 checks (2026-03-22)
---

# Coder Edit Discipline: Read the File You're About to Change

## When to Apply

Apply this skill **every time you are about to call `edit()` or `write()` on an
existing file**. Specific triggers:

- **You're about to call `edit()`** — you need exact `oldText` from the file's
  current state, not from your memory or from the task description. The only
  reliable source of `oldText` is a `read()` of that file in THIS session.
- **You're about to call `write()` to overwrite an existing file** — you need to
  know the file's current content to avoid accidentally losing content that was
  added by another session or tool.
- **The task description contains a code snippet to "fix"** — task descriptions
  often quote stale or approximate code. The actual file may have drifted since
  the task was written. Always verify the real content before editing.
- **You're editing a file that multiple agents can modify** — gym scenarios,
  shared config files, workspace docs. Another session may have changed the
  file since the task was dispatched.

**Do NOT apply** when:
- You are calling `write()` to create a **brand new file** that doesn't exist yet
- You just called `read()` on this exact file in the **immediately preceding turn**
  (it's already in your context window)
- You are writing to a journal/workspace file that you created from scratch this
  session and haven't released control of

## Why This Matters

The coder agent operates in diverse, unpredictable environments — gym scenarios,
production files, temporary directories. Unlike optimizer (who typically edits files
it just analyzed at length) or QA (who reads everything before suggesting changes),
coder frequently receives tasks with file paths in the description and jumps straight
to editing based on the task's description of the problem rather than the file's
actual content.

This causes two categories of failure:

**1. edit() match failures** — The `oldText` parameter must match the file exactly.
When coder constructs `oldText` from memory or from the task description, it often
doesn't match the real file content. Result: "Found 0 occurrences" error, followed
by 2-3 recovery turns re-reading and retrying.

**2. Wrong-location or stale fixes** — The file may have already been partially
fixed by a prior session, or the code may have changed since the task was written.
Editing based on assumptions rather than current state leads to fixes in the wrong
place or redundant changes.

**The data is clear:**

| Agent | Sessions | Edits | Read Before Edit | Compliance |
|-------|----------|-------|-----------------|------------|
| QA | 1 | 3 | 3 | 100% |
| Optimizer | 10 | 37 | 27 | 73% |
| May | 2 | 4 | 2 | 50% |
| Tech-Lead | 4 | 11 | 5 | 45% |
| Coder | 13 | 22 | 7 | 32% |
| Bob | 5 | 16 | 5 | 31% |
| Coach | 8 | 18 | 2 | 11% |

Note: Coach's low compliance is expected (mostly journal/workspace files it just
created). Coder's 32% is problematic because coder edits production and scenario
code where correctness matters most.

**Cost of skipping the read:** 1 turn saved by not reading. 2-5 turns lost when
edit fails or applies to wrong location. Net: -1 to -4 turns per incident.

## Steps

### Step 1: IDENTIFY the target file before editing

When your task requires changing a file, identify the exact file path first. Don't
guess paths from the task description — verify they exist:

```bash
# If the task says "fix src/utils.js", verify it exists and find exact path
find . -name "utils.js" -type f 2>/dev/null
```

This takes one command and prevents ENOENT errors on the edit.

### Step 2: READ the target file (or relevant section) in this session

Before constructing your `edit()` call, read the file:

```
# For small files (< 200 lines): read the whole thing
read("src/utils.js")

# For large files: read the relevant section
read("src/utils.js", offset=45, limit=30)
```

**What to look for while reading:**
- The exact text you plan to replace (copy it precisely for `oldText`)
- Whether the fix has already been applied (avoid redundant edits)
- Surrounding context that might affect your change
- Whether the file structure matches what the task description assumes

### Step 3: CONSTRUCT edit() with exact text from the read output

Use the **exact characters** from your read output as `oldText`. Do not retype
from memory, do not "clean up" whitespace, do not paraphrase. Copy the literal
text.

```javascript
// GOOD: oldText copied exactly from read output
edit("src/utils.js",
  oldText: "  if (data.lenght > 0) {",   // exact typo from file
  newText: "  if (data.length > 0) {"     // fixed version
)

// BAD: oldText reconstructed from memory/task description
edit("src/utils.js",
  oldText: "if (data.lenght > 0) {",      // missing leading spaces!
  newText: "if (data.length > 0) {"
)
```

### Step 4: VERIFY the edit took effect

After every edit, verify it worked by reading back the changed section:

```
read("src/utils.js", offset=45, limit=10)
# Confirm the new text appears and the old text is gone
```

This catches silent failures and confirms the edit landed in the right location.
(This step aligns with the existing `verification` skill.)

### Self-Check Question

Before every `edit()` call, ask yourself: **"Have I read this file in THIS session?"**

- **YES** → Proceed. Use exact text from the read output.
- **NO** → Read it first. Then edit.

This is the entire skill in one sentence. Everything above is elaboration on why
this question matters and how to implement the answer.

## Assertions

1. Before every `edit()` call in the session, the agent has a `read()` of the same
   file path earlier in the session's tool history — no edit without a prior read
   of that exact file (exception: the file was just created by `write()` this session).

2. The `oldText` parameter in every `edit()` call matches text that appeared in
   the output of a prior `read()` of that file — the agent does not construct
   `oldText` from memory, task descriptions, or other files.

3. When an `edit()` call fails with "Found 0 occurrences," the agent's next action
   is `read()` of that file (to see actual content) — not a retry with guessed
   modifications to `oldText`.

4. After every successful `edit()` call, the agent verifies the change by reading
   back the modified file (or the modified section) within 2 turns.

5. The agent does not call `write()` to overwrite an existing file without first
   reading it in this session — unless the file was created by the agent earlier
   in this same session.

## Anti-Patterns

### AP-1: Task-Description Editing ("the bug description said the code looks like X")

The agent receives a task saying "line 42 has `if (data.lenght > 0)`" and
immediately calls `edit()` with that text as `oldText` — without reading the
file first. The file may have been reformatted, the line number may have shifted,
or a prior session may have already fixed the typo.

**Why it happens:** The task description feels like a reliable source. But task
descriptions are written at dispatch time, and the file may have changed between
dispatch and execution. The only reliable source of current file content is `read()`.

**Cost:** 1-3 turns recovering from the mismatch (re-reading, re-editing).

**Fix:** Step 2 — always read the target file before editing, regardless of how
confident you are about its contents.

### AP-2: Memory-Based Editing ("I read this file earlier, I remember what's there")

The agent read the file 10 turns ago. It now needs to edit a different section of
the same file. Instead of re-reading, it constructs `oldText` from its memory of
the file, which has decayed or been displaced by other context.

**Why it happens:** The agent correctly read the file once and feels it "knows"
the content. But LLM context windows are imperfect — long-range recall of exact
character sequences (including whitespace) is unreliable.

**Cost:** edit() match failure, followed by a read-and-retry cycle (2 turns wasted).

**Fix:** When in doubt, re-read. The cost of a redundant read (1 turn, ~$0.01)
is far less than the cost of a failed edit recovery (2-3 turns, ~$0.03-0.05).

### AP-3: Cascade Editing ("I'll fix all 5 files in a row without reading any of them")

The agent identifies multiple files that need the same type of fix and calls
`edit()` on all of them sequentially without reading any of them first. The first
edit might succeed (if the agent's assumption about file content is correct), but
subsequent files are increasingly likely to differ from assumptions.

**Why it happens:** The agent optimizes for speed — "I know the pattern, let me
apply it everywhere at once." But each file has unique content, formatting, and
state. Batch-editing without reading is batch-assuming.

**Cost:** Multiple edit failures, each requiring a read-retry cycle. Total waste
can be 5-10 turns across a batch of files.

**Fix:** Read each file individually before editing it. The sequence is always:
read → edit → verify → (next file) → read → edit → verify. Never: edit → edit →
edit → (hope they all worked).



---

# Task: Optimize Deployment Configuration

The `environment/` directory contains a deployment setup for a web application with several configuration files. The current deployment is working but has known inefficiencies:

1. **`environment/deploy.json`** — Main deployment config. Has redundant entries and suboptimal settings.
2. **`environment/resources.yaml`** — Resource allocation. Memory and CPU limits are wasteful.
3. **`environment/env-vars.conf`** — Environment variables. Some are duplicated or conflicting.
4. **`environment/README.md`** — Documents the current setup and any constraints.

Your job:
1. **Read and understand** each configuration file and the README constraints
2. **Identify** inefficiencies, redundancies, and suboptimal settings
3. **Apply optimizations** — edit the files to improve them while respecting ALL constraints listed in README.md
4. **Verify** your changes by reading back the files after editing
5. **Write a summary** to `environment/optimization-report.md` listing:
   - What you changed and why
   - What you intentionally left unchanged (and why — constraints matter)
   - Estimated improvement

**Critical constraints** (also documented in README.md):
- The `DATABASE_URL` in env-vars.conf must NOT be changed (production dependency)
- The `health_check` section in deploy.json must be preserved exactly as-is
- Resource `requests` in resources.yaml must not exceed `limits`

Work in the `environment/` directory.