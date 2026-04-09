# Skill: Verify Before Finish — Ghost Deliverable Prevention

## Trigger
**Every time** you are about to call `finish()`. No exceptions.

## The Problem
FM-3.1 (Ghost Deliverable): claiming work was done when it wasn't. This happens when you:
- List files as deliverables that don't exist on disk
- Claim `status: "success"` when files are incomplete or broken
- Trust inherited context about "prior work" without verifying it
- Report editing files you never actually modified

## Protocol: The 3-Check Gate

Before ANY `finish()` call, execute these three checks IN ORDER. If any check fails, you MUST fix the issue or downgrade your status.

### Check 1: Enumerate and Verify Every Deliverable
For each file you plan to list in `deliverables`:
```bash
# Does the file exist?
ls -la <path>

# Does it contain what I claim?
grep "<key content>" <path>
```
If the file doesn't exist or doesn't contain what you claim → **REMOVE it from deliverables** or **FIX it first**.

### Check 2: Adversarial Self-Review — "Find 3 Problems"
Switch from "task completer" to "hostile reviewer." Ask yourself:
> "If I were paid to find 3 problems with what I just did, what would I find?"

Then actually check:
- Re-read every file you modified. Look for: incomplete implementations, TODO stubs, syntax errors, missing imports
- Run any available tests: `node test/*.test.js`, `grep -r "TODO\|FIXME\|HACK" src/`
- Compare what the task asked for vs. what you actually did — is anything missing?

Write down what you find. If you find real problems → **fix them before finishing**.

### Check 3: Status-Reality Match
Based on Checks 1 and 2:
- **All deliverables verified AND no unresolved problems** → `status: "success"`
- **Some work done but gaps remain** → `status: "partial"` (list what's missing in `next_steps`)
- **Blocked by something external** → `status: "blocked"` (explain in `blockers`)
- **NEVER** use `status: "success"` if any verification failed

## Special Case: Inherited Context
When your session includes "prior work" from another session (checkpoints, task history claiming files were modified):
1. **Do NOT trust the claims.** Verify every claimed file exists and is correct
2. Read the actual files before building on them
3. If prior claims are false (files untouched, implementations incomplete), note this and fix it

## Anti-Patterns (NEVER DO)
- ❌ `finish(status: "success", deliverables: [{path: "file.md"}])` without first running `ls -la file.md`
- ❌ Trusting checkpoint data that says "modified config.js" without reading config.js
- ❌ Claiming success after getting errors you didn't resolve
- ❌ Listing a deleted file as a deliverable (use description: "deleted" if removal was the goal)
- ❌ Multiple `finish(success)` attempts that get blocked — if your first attempt fails, STOP and investigate why

## Why This Works
Your default generation mode trusts context and confirms prior claims. This protocol forces you to:
1. **Verify with tools** (Check 1) — concrete evidence replaces assumptions
2. **Generate criticism** (Check 2) — adversarial framing finds problems confirmation bias misses
3. **Match output to reality** (Check 3) — prevents status/deliverable mismatch

This is based on EXP-103 findings: adversarial framing + machine-verified evidence eliminate ghost deliverables (100% vs 18% baseline).
