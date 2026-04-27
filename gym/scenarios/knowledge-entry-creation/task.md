## Relevant Skills (Read Before Starting)

---
name: budget-before-act
description: >
  Turn-budget awareness and delivery assurance. Before starting work, agents estimate
  how many turns each requirement costs, scope down if over budget, create deliverable
  skeletons early, and checkpoint progress at 50% and 75% marks. Targets FM-3.1
  (premature termination / non-delivery) — the #1 uncovered failure mode at 31
  occurrences across all agents.
version: 1.0.0
owner: optimizer
---

# Budget-Before-Act: Estimate Turns, Guarantee Delivery

## When to Apply

Apply this skill **at the start of every task that requires producing a deliverable**
(file, code change, analysis report, brief, plan). Specific triggers:

- **Multi-requirement tasks** ("analyze X, implement Y, verify Z") — these are the
  most likely to exceed turn budget. The more requirements, the more critical budgeting
  becomes.
- **Implementation tasks** ("write code", "create file", "update config") — these
  require both reading and writing phases, and agents commonly spend too long reading.
- **Tasks with unfamiliar codebases** — exploration can consume unlimited turns if
  not bounded. Set a hard exploration cap.
- **Any task where you don't know how many turns you have left** — if you can't
  estimate your remaining budget, assume you're at 50% and act accordingly.

**Do NOT apply** to pure-analysis tasks where the deliverable IS the thinking
(e.g., "what do you think about X?" in a conversation), or to tasks that are
explicitly open-ended exploration with no required output.

## Why This Matters

Premature termination (FM-3.1) is the most costly failure mode that has no
dedicated skill. Data from all agents shows **31 FM-3.1 occurrences** — sessions
where the primary deliverable was never produced. The breakdown:

| Agent | FM-3.1 Count | % of Total |
|-------|-------------|-----------|
| optimizer | 12 | 39% |
| tech-lead | 8 | 26% |
| bob | 4 | 13% |
| may | 3 | 10% |
| coach | 2 | 6% |
| amy-kimi | 2 | 6% |

The root cause is consistent: agents treat turns as unlimited, dive deep into
analysis/exploration, and discover too late that they've consumed their budget
without writing output. The fix is simple: budget upfront, write early, checkpoint
at milestones.

**Key insight from the data**: Sessions rated highest are NOT the ones that explore
most thoroughly — they're the ones that produce deliverables. A partial deliverable
with honest `status: "partial"` beats a complete analysis with no output file.

## Steps

### Step 1: BUDGET — Estimate turn cost per requirement (Turn 1)

In your **first response** after receiving the task, before any tool calls,
estimate the turn cost:

```
Task breakdown:
- Read/understand context: ~3 turns
- Implement change A: ~4 turns
- Implement change B: ~3 turns
- Verify both changes: ~2 turns
- Write up / finish: ~1 turn
Total estimated: ~13 turns
Budget available: ~20 turns
→ Feasible. Proceeding with full scope.
```

**If estimated turns exceed 80% of your budget**, scope down immediately:

```
Total estimated: ~25 turns
Budget available: ~20 turns
→ Over budget. Scoping down:
  - MUST: Implement change A (highest priority per task)
  - SHOULD: Implement change B (if turns remain after A)
  - DEFER: Verify with full test suite (report as partial)
```

**Rules of thumb for turn estimation**:
- Reading one file + understanding: 1 turn
- Reading multiple files for context: 2-3 turns
- Writing/editing one file with verification: 2-3 turns
- Running tests + interpreting results: 1-2 turns
- Each failed attempt + recovery: 2 turns (assume at least 1 failure)
- Finish/cleanup: 1 turn

**Do NOT skip this step.** The #1 predictor of FM-3.1 is diving into work
without estimating whether the work fits in the session. Even a rough estimate
("this is a 10-turn task, I have ~20 turns, so I'm fine") prevents most
non-delivery failures.

### Step 2: DELIVERABLE-FIRST — Create output skeleton early (Turns 2-4)

After initial reading (max 3 turns of exploration), create your deliverable
file with a skeleton structure. Don't wait until you have all the information —
write the structure first, fill in details as you go.

**For code changes:**
```
// Create the file/function with TODO comments for each section
function newFeature() {
  // TODO: Read config from X
  // TODO: Process data
  // TODO: Write output
  return placeholder;
}
```

**For analysis/reports:**
```markdown
# Analysis of X
## Finding 1: [placeholder — will fill after reading Y]
## Finding 2: [placeholder — will fill after reading Z]
## Recommendation: [placeholder]
```

**For briefs/plans:**
```markdown
# Brief: Task Name
## Problem: [1-sentence summary]
## Approach: [placeholder]
## Deliverables: [list from task requirements]
```

**Why skeleton-first works**: Even if the session ends unexpectedly, the skeleton
file exists and communicates structure/intent to the next session. A skeleton
with placeholders is infinitely more useful than no file at all.

### Step 3: CHECKPOINT at 50% — Verify partial deliverable exists (Mid-session)

At approximately the halfway point of your session (or after ~10 turns if you
don't know your total), pause and check:

**Checkpoint checklist:**
1. ✅ Does the deliverable file exist? (If not: STOP exploring, write it NOW)
2. ✅ Does it contain real content, not just placeholders? (If not: fill in
   what you know NOW)
3. ✅ Have you addressed the highest-priority requirement? (If not: skip to it)
4. ✅ Are you on track to finish within budget? (If not: scope down NOW)

**If the deliverable doesn't exist at 50%**: This is a RED ALERT. You've spent
half your session without producing output. Immediately:
- Stop all exploration/analysis
- Write the deliverable with what you know so far
- Mark incomplete sections as `[TODO: needs X]`
- Then continue working to fill in the TODOs

**This is the most important step in the skill.** Data shows that 80%+ of
FM-3.1 failures could have been caught by a mid-session checkpoint. The agents
had enough information to write *something* — they just kept exploring instead
of writing.

### Step 4: VERIFY DELIVERY at 75% — Ensure output is coherent (Late session)

At approximately 75% of your turns, verify the deliverable:

1. **Read back your output file** — does it make sense as a standalone document?
2. **Check task requirements** — did you address the primary ask? If not, address
   it now, even if briefly.
3. **Check for placeholders** — replace any remaining `[TODO]` with either real
   content or honest `[Not completed: reason]` notes.
4. **Plan your finish** — allocate your remaining turns: what MUST be done vs.
   what's nice-to-have?

**At this point, you should NOT start any new multi-turn exploration.** Your
remaining turns are for refinement, verification, and clean finish only.

### Step 5: FINISH HONESTLY — Declare what's done and what's not (Final turn)

When finishing your session:

- **If everything is complete**: `finish(status: "success")` with specific
  deliverables listed.
- **If partially complete**: `finish(status: "partial")` with explicit list of
  what's done and what remains. **This is correct behavior, not failure.**
- **If blocked**: `finish(status: "blocked")` with clear description of the
  blocker and what was attempted.

**Never claim "success" if requirements were silently dropped.** The evaluator
catches this (FM-3.1 sub-pattern: "Announced completion without actual delivery")
and it scores worse than honestly reporting partial completion.

## Assertions

1. The agent estimates turn budget in the first response, before any tool calls —
   a rough plan with turn-count estimates appears in the first assistant message.
2. The deliverable file/artifact exists by turn 4 or by 25% of the session,
   whichever comes later — even if it's a skeleton with placeholders.
3. At the mid-session point (~50% of turns), the agent has written real content
   (not just placeholders) to the deliverable — if not, exploration stops and
   writing begins immediately.
4. The agent does not start new multi-turn exploration after 75% of turns are
   consumed — remaining turns are used for refinement, verification, and finish.
5. The agent's finish declaration (`finish()` call or final message) accurately
   reflects what was delivered — no silent omissions of unaddressed requirements.

## Anti-Patterns

### AP-1: Bottomless Exploration (read everything, write nothing)
The agent reads 10+ files, analyzes the codebase thoroughly, understands the
problem deeply — and then runs out of turns before writing any output. The
exploration was valuable but produced zero deliverable.

**Why it happens**: Reading feels productive. Each file read teaches something
useful. But without a turn budget, there's always "one more file to check."
The agent never transitions from reading to writing because there's no trigger
to make that transition.

**Fix**: Apply Step 1 (budget) to cap exploration turns. Apply Step 2
(deliverable-first) to force early writing. The rule: exploration cannot exceed
30% of your turn budget. After that cap, you MUST write, even if your
understanding feels incomplete.

### AP-2: Scope Creep Without Scoping Down
The agent discovers the task is more complex than initially estimated (more
files to change, deeper dependencies, unexpected test failures). Instead of
scoping down to fit the budget, the agent tries to do everything and delivers
nothing.

**Why it happens**: The agent treats all requirements as equally mandatory.
But the task description usually has implicit priorities — the first/main
requirement is highest priority, and later requirements are "also do X if
possible." Without explicit scoping, the agent spreads effort too thin.

**Fix**: Apply Step 1 (budget) with the MUST/SHOULD/DEFER framework. When
discovered complexity exceeds the budget, immediately re-scope: identify the
one highest-priority deliverable and ensure IT gets done, then work on lower
priorities if turns remain.

### AP-3: Optimistic Non-Checkpointing
The agent assumes it will have enough turns and doesn't check progress at
milestones. It works steadily until suddenly the session ends or turns run out,
with work-in-progress scattered across the context window but not persisted to
any file.

**Why it happens**: The agent doesn't track its own turn count and has no
internal trigger to pause and assess progress. Each turn feels like there's
"plenty of time left."

**Fix**: Apply Step 3 (50% checkpoint) as a hard rule. After approximately
half your turns, you MUST pause and verify the deliverable exists with real
content. This is not optional — it's the single most effective intervention
against FM-3.1.

### AP-4: Silent Requirement Dropping
The agent completes 3 of 4 requirements, silently drops the 4th, and reports
"success." The dropped requirement is discovered later (by evaluator or by
the next session that depends on it), causing rework.

**Why it happens**: The agent runs low on turns, realizes it can't do
everything, and quietly skips the lowest-priority item without reporting it.
This feels like "being efficient" but is actually dishonest delivery.

**Fix**: Apply Step 5 (finish honestly). If any requirement was not addressed,
report `status: "partial"` with a clear note of what remains. A partial
completion that's honestly reported is always better than a "success" with
hidden gaps.

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

# Skill: Task Compliance

**Trigger**: Any task with numbered steps, referenced files, or "create/follow template" instructions.

## Protocol

### Step 1: Resource Enumeration
Before doing ANY work, scan the task description and list every file, directory, or resource mentioned. Write the list explicitly.

### Step 2: Read All Referenced Resources
Read EVERY file and explore EVERY directory mentioned in the task. Do not skip any. If the task mentions a directory, `ls` it and read representative files. If it mentions a template, read the template fully before proceeding.

**Anti-pattern**: Reading only the first mentioned file and starting work immediately. You MUST read ALL referenced resources before producing output.

### Step 3: Create vs Modify Distinction
When the task says "create X following/using template Y":
- **DO**: Create a NEW file at path X, populated with content inspired by template Y
- **DON'T**: Edit or modify template Y directly

When the task says "modify X" or "update X":
- **DO**: Edit the existing file X

**Anti-pattern**: Treating "create following template" as "edit the template". Templates are read-only references.

### Step 4: Verify Completeness
Before finishing, re-read the task and check each numbered step or requirement. Confirm you completed ALL of them, not just the ones that seemed most important.

## Assertions
- [ ] Every referenced file/directory was read before producing output
- [ ] Template files were not modified (if task said "create following template")
- [ ] All numbered steps in the task were addressed
Create a new knowledge entry from experiment results.

You have experiment results in `data/experiment-results.md`. Create a knowledge entry following the project's format.

1. **Read** `data/experiment-results.md` to understand the finding
2. **Read** `knowledge/entries/KE-TEMPLATE.md` to understand the format
3. **Create** `knowledge/entries/KE-042.md` following the template structure, populated with the experiment findings
4. **Verify** the new file exists and contains all required sections

Required sections: Title, Summary, Evidence, Recommendation, Tags