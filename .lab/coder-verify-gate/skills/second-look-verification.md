# Second-Look Verification (Pre-Completion)

> Source: EXP-229 — tested on 4 judgment scenarios, +100pp on activation-gap type failures

## When to Use
Before calling `finish()` on ANY implementation task, answer these 4 questions.

## Checklist

### 1. Existing Data & State
> Does my change affect data, files, or state that existed BEFORE my changes?

- Modified a data format → check existing persisted data still works
- Changed an API → test with existing callers, not just new ones

### 2. Untested Code Paths
> Are there code paths that interact with my changes but tests DON'T cover?

- Read the source code (not just tests) to find functions that use what you changed
- Tests passing ≠ everything works

### 3. Verify Stated Assumptions
> What did the context TELL me was true? Have I confirmed it?

- "X is already done" → check the filesystem/code to verify
- Summary says "the cause was Y" → read the raw evidence (logs, source)

### 4. Live Activation Check
> Is the RUNNING system actually using my changes?

- Built + deployed ≠ activated. Check the running process.
- Config changed ≠ service reloaded. Confirm end-to-end.

## If any question reveals a gap → investigate and fix before finishing.
