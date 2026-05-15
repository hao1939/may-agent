---
name: baseline-before-change
version: 1.0.0
description: >
  Establish a verifiable baseline of the current state before making changes.
  Without a baseline, post-change verification is meaningless — you can't tell
  whether failures are caused by your changes or were pre-existing. This skill
  closes the most common gap in verification: the "pre-existing excuse" (AP-3).
owner: optimizer
tools: [bash, read]
---

# Skill: Baseline Before Change

## When to Apply

Apply this skill whenever you are about to **modify code, configuration, or
infrastructure** and plan to verify the result afterward. Specifically:

1. **You will run a compiler, linter, or test suite after your changes** — you
   need to know what the output looked like *before* your changes to distinguish
   new failures from pre-existing ones.
2. **You are editing a file that other agents also modify** — concurrent changes
   mean the file may have drifted from what you expect. A baseline read confirms
   the actual current state.
3. **You plan to claim "these errors are pre-existing"** — this claim is only
   valid if you have tool output from *before* your changes showing the same errors.

Do NOT apply this skill for:
- Pure analysis/read-only sessions (no changes to verify against)
- Creating brand-new files from scratch (no pre-existing state)
- Trivial one-line changes where the verification is a simple read-back

## Why This Matters

The verification skill (v1.3.0) ensures agents verify *after* changes. But
verification without a baseline is like measuring temperature without knowing
what it was before — you know the current number but can't tell if it went up
or down.

**Real evidence**: In 15 sessions evaluated on 2026-03-19, two sessions (coder
s_1773951888028_59 and tech-lead s_1773951669206_56) claimed test failures were
"pre-existing" without having run the tests before their changes. This is the
AP-3 anti-pattern from the verification skill — and the root cause is that no
baseline was captured.

A baseline takes 5-15 seconds of tool calls. Skipping it risks an entire session
of wasted effort when you can't distinguish your breakage from the environment's.

## Steps

### Step 1: Capture the Baseline

Before making any changes, run the same verification commands you plan to run
afterward. Record the results.

```
# Example for TypeScript projects:
bun run typecheck 2>&1 | tail -20
# Note: X errors found (or clean)

# Example for test suites:
bun run test 2>&1 | tail -30
# Note: N passed, M failed, K skipped

# Example for file state:
wc -l <target-file>
head -5 <target-file>
tail -5 <target-file>
```

**Key**: Use the *exact same command* you will use for post-change verification.
Different flags, different directories, or different scopes make the comparison
meaningless.

### Step 2: Note the Baseline State

Explicitly state the baseline in your reasoning before proceeding:

- "Baseline: `tsc --noEmit` shows 0 errors"
- "Baseline: `bun run test` shows 14 passed, 2 failed (test-x, test-y)"
- "Baseline: file has 247 lines, last line is `export default config`"

This creates an auditable record. If you later need to claim something is
pre-existing, you have the evidence.

### Step 3: Make Your Changes

Proceed with your edits, writes, and modifications as normal.

### Step 4: Run Post-Change Verification

Run the *exact same commands* from Step 1.

### Step 5: Compare Against Baseline

Explicitly compare the post-change results to the baseline:

- **New failures** (not in baseline): These are yours. Fix them before finishing.
- **Same failures** (in baseline): These are genuinely pre-existing. You may
  proceed, but cite the baseline evidence when reporting.
- **Fewer failures** (baseline had more): Your changes fixed something. Note it.
- **Different failures** (baseline had X, now has Y): Your changes may have
  masked one issue and introduced another. Investigate.

## Assertions

1. **Baseline tool call exists**: Before the first `edit()` or `write()` to a
   target file, the session transcript contains at least one `bash()` or `read()`
   call that captures the pre-change state of the verification target (compiler
   output, test results, or file content).

2. **Same command used pre and post**: The verification command run after changes
   matches the command run before changes (same tool, same path/flags, same scope).

3. **Pre-existing claims cite baseline**: Any claim that a failure is "pre-existing"
   or "not caused by my changes" is accompanied by a reference to specific baseline
   output showing that same failure existed before changes.

4. **New failures are addressed**: If post-change verification shows failures not
   present in the baseline, the agent either fixes them or explicitly reports them
   as incomplete work — not as pre-existing.

5. **Baseline is captured before first edit**: The baseline capture (Step 1) occurs
   before any `edit()` or `write()` call that modifies the target codebase. A
   baseline taken after partial changes is not a true baseline.

## Anti-Patterns

### AP-1: "Post-Hoc Baseline"
**Pattern**: Agent makes changes, runs `tsc`, sees errors, *then* reverts or checks
git history to establish what errors existed before — after the fact.

**Why it fails**: Reverting may be incomplete, git history may not reflect the exact
state, and the effort spent investigating retroactively is always more than the 5
seconds a proactive baseline would have taken. The agent also faces confirmation bias:
having already made changes, they're motivated to prove the errors are pre-existing.

**Fix**: Capture the baseline *first*. It's a 5-second habit that prevents minutes
of retroactive investigation.

### AP-2: "Scope Mismatch Baseline"
**Pattern**: Agent runs `tsc --noEmit` as baseline but then verifies with
`bun run test`, or baselines in directory A but makes changes in directory B.
The baseline and verification don't cover the same scope, making comparison invalid.

**Fix**: Write down the exact verification command before starting. Use that same
command for both baseline (Step 1) and post-change verification (Step 4). If you
realize mid-task that you need a different verification command, re-run it as a
new baseline before continuing.

### AP-3: "Baseline Skipped for Speed"
**Pattern**: Agent reasons "I'll just be quick" or "this is a small change, no need
for a baseline" — then the small change breaks something and the agent can't tell
if it's their fault.

**Why it happens**: Baselines feel redundant when you're confident. But confidence
isn't evidence. The 5-second cost of a baseline is trivial compared to the minutes
spent debugging ambiguous failures.

**Fix**: Make baselining automatic for any session that will run verification. The
rule is simple: if you plan to run `tsc` or `Bun test runner` after changes, run it before
changes too.

---

## State-Check-Before-Action (merged)

Before any state-mutating operation (edit, write, destructive bash), verify
that preconditions hold using read-only tool calls. This prevents the #1 source
of wasted tool calls: edit() match failures from stale mental models.

### Triggers
- Before `edit()`: read the file first if you haven't in this session
- Before `write()`: confirm the path exists/doesn't exist
- Before destructive `bash` (`rm`, `mv`, `sed -i`): verify path/state
- Before referencing any path not seen in this session's tool output
