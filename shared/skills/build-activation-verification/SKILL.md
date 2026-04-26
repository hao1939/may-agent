---
name: build-activation-verification
version: 1.0.0
description: >
  After building a binary, verify the running process is actually using it before
  claiming deployment. Agents repeatedly build binaries, update symlinks, and declare
  "deployed" — but the daemon process (PID 52) continues running the old binary because
  no restart occurred. This creates a growing gap between committed code and active code:
  features pile up as "blocked on binary rebuild" even though the binary was built sessions
  ago. The root cause is that agents treat "binary built + symlink updated" as the end of
  deployment, when it's actually only the halfway point.
owner: optimizer
evidence: >
  5+ optimizer sessions (s_1774427621514_149, s_1774422220561_132, and periodic-task
  entries from 2026-03-25) show the same pattern: build binary, update symlink, note
  "PID 52 still running old binary," finish session claiming deployment. As of
  2026-03-25T10:04 UTC, the running process uses binary b9ef77e (built March 24) while
  binaries 37b8fbb and 1d58bd5 were both built and symlinked but never activated.
  optimizer/workspace/todo.md has 3+ items marked "blocked on binary rebuild" that have
  had binaries built but not activated. tech-lead session s_1774423848682_134 committed a
  zombie cleanup fix that remained inactive for 6+ hours despite a binary being built for it.
---

# Build Activation Verification: Don't Declare Deployed Until It's Running

## When to Apply

Apply this skill **after any binary build or code deployment step**. Specific triggers:

1. **You just ran `npm run build`** (or equivalent) and produced a new binary — you must
   verify the running process will use it before moving on.
2. **You just updated a symlink** (`bundle/may-agent → may-agent-<hash>`) — the symlink
   change means nothing until the process restarts and loads the new binary.
3. **You're about to call `finish()` or `checkpoint()` after a build** — this is the
   moment where the gap is created. If you claim "deployed" without activation, you've
   added to the pile of inactive code.
4. **You see a todo item saying "blocked on binary rebuild"** — check whether a binary
   was already built for it. The block might be "needs activation," not "needs build."

**Do NOT apply when:**
- You're making code changes that don't require a binary rebuild (e.g., editing config
  files, markdown, or workspace files that are read directly from disk).
- You're only committing code without building — the build step hasn't happened yet.

## Why This Matters

Building a binary and updating a symlink feels like deployment. It isn't. The system
runs a long-lived daemon process (PID 52) that loaded its binary at startup. Updating
the symlink on disk doesn't affect the running process — it still executes the old binary
from memory. Only a process restart makes the new binary active.

This creates a compounding problem:

1. **Session N**: Agent commits fix, builds binary, updates symlink, declares "deployed."
2. **Session N+1**: Agent notices the fix isn't active, notes "needs process restart."
3. **Session N+2**: Agent builds ANOTHER binary (with more changes), same symlink dance.
4. **Session N+3**: Now 2 binaries behind. Todo items pile up as "blocked on binary rebuild"
   even though binaries exist.

As of March 25, the system was **2 binaries behind HEAD** — PID 52 running `b9ef77e`
while `37b8fbb` and `1d58bd5` were both built and symlinked. Three todo items sat
"blocked on binary rebuild" for features whose binaries had already been built hours ago.
The block wasn't "needs build" — it was "needs activation," and no agent had a protocol
for that.

## Steps

### Step 1: Build the binary

Run the build command as normal (`npm run build`, etc.). Note the output binary name/hash.

### Step 2: Update the symlink

Point the symlink to the new binary. Verify the symlink target:

```bash
ls -la bundle/may-agent
# Should show: may-agent -> may-agent-<new-hash>
```

### Step 3: Check what the running process is using

This is the step agents skip. Determine what binary the currently running daemon loaded:

```bash
# Check the process's binary
ls -la /proc/$(pgrep -f may-agent | head -1)/exe 2>/dev/null
# Or check the process start time vs. binary creation time
stat bundle/may-agent-<new-hash> | grep Modify
ps -p $(pgrep -f may-agent | head -1) -o lstart=
```

If the running process is still using the old binary, **the deployment is not complete**.

### Step 4: Escalate or activate

If the running process doesn't match the new binary:

1. **Try to trigger a restart** if you have the capability (check if there's a restart
   mechanism, signal handler, or documented process).
2. **If you cannot restart**: Send an escalation message to the agent or person who can.
   Be specific: "Binary `may-agent-<hash>` built and symlinked at <time>. Running process
   PID <N> still uses `<old-hash>`. Process restart needed to activate."
3. **Record the activation gap** in your workspace/todo.md or equivalent:
   ```
   - [ ] ACTIVATION PENDING: may-agent-<hash> built <time>, not yet active (PID <N> on <old-hash>)
   ```

### Step 5: Adjust your finish() claims

When calling `finish()` or `checkpoint()`, accurately describe the deployment state:

- ✅ **Accurate**: "Built binary may-agent-abc123 and updated symlink. NOT YET ACTIVE — PID 52
  still running old binary def456. Escalated restart request to tech-lead."
- ❌ **Inaccurate**: "Deployed fix for zombie sessions. Binary rebuilt and symlinked."

The word "deployed" implies the code is running in production. Use "built" or "built but
not activated" when the process hasn't restarted.

### Step 6: Track pending activations across sessions

Before building a NEW binary, check if there are already-built binaries waiting for
activation. Building another binary on top of inactive ones doesn't solve the activation
problem — it just adds another layer.

```bash
# Check: does the symlink already point to a binary newer than what's running?
ls -la bundle/may-agent
# If symlink already points to an unactivated binary, the problem is activation, not building.
```

## Assertions

1. **Running process is checked after build** — after any binary build + symlink update,
   the agent runs at least one command to determine what binary the active process is using
   (e.g., checking `/proc/PID/exe`, process start time, or equivalent).

2. **Finish claims match activation state** — if the running process was not restarted with
   the new binary, the agent's `finish()` summary does NOT use the word "deployed" without
   a qualifier like "built but not activated" or "pending restart."

3. **Activation gap is escalated or tracked** — when the agent confirms the new binary is not
   active, they either (a) trigger a restart, (b) send an escalation message, or (c) record
   a specific pending-activation item in their workspace. They do not simply note it and
   move on without action.

4. **Existing pending builds are checked before new builds** — before starting a new binary
   build, the agent checks whether there's already an unactivated binary waiting. If so,
   the priority is activation, not another build.

5. **No "blocked on binary rebuild" for already-built binaries** — todo items are not marked
   "blocked on binary rebuild" when a binary containing the fix has already been built. The
   correct status is "blocked on activation / process restart."

## Anti-Patterns

### AP-1: "Symlink Equals Deployment"
**Pattern**: Agent builds binary, updates symlink, declares "deployed" in finish() summary.
The running process still uses the old binary. Features that should be live are not.

**Why it happens**: Updating the symlink is the last step the agent can perform autonomously.
It feels like the final step because it's the last thing they *do*. But it's not the last
thing that needs to *happen* — the process must restart. The agent confuses "I finished my
part" with "the deployment is complete."

**Evidence**: optimizer session s_1774427621514_149 — built `may-agent-1d58bd5`, updated
symlink, checkpoint said "Binary rebuilt... symlink updated" alongside "PID 52 still running
b9ef77e." The zombie session fix remained inactive for 6+ hours.

**Fix**: Treat symlink update as step 2 of 4, not the finish line. The deployment is complete
when the running process uses the new binary, not when the symlink points to it.

### AP-2: "Passive Observation Without Action"
**Pattern**: Agent notices "PID 52 still running old binary" and logs it as an observation in
their periodic tasks or checkpoint, but takes no action — no escalation, no restart attempt,
no tracked activation item.

**Why it happens**: The agent correctly identifies the gap but treats it as a status report
rather than an action item. "Noting a problem" feels productive but doesn't move the system
toward resolution. Over multiple sessions, the same observation gets logged repeatedly without
anyone acting on it.

**Evidence**: optimizer periodic-tasks.md contains 3+ entries noting "PID 52 still running
b9ef77e — needs process restart" across different check cycles, each time as an observation
with no escalation or action taken.

**Fix**: An observation without an action is a missed opportunity. Every time you note an
activation gap, pair it with an action: escalate, attempt restart, or create a tracked item
with a specific owner.

### AP-3: "Rebuild Over Activate"
**Pattern**: Agent encounters a todo item "blocked on binary rebuild," builds a new binary
(because the old one is stale or new commits exist), but doesn't check whether the *previous*
binary build was ever activated. The system accumulates built-but-inactive binaries.

**Why it happens**: Building is within the agent's control and feels productive. Activating
requires coordination (process restart) which is harder. The agent gravitates toward what
they can do (build) rather than what needs to be done (activate).

**Evidence**: As of 2026-03-25, `bundle/` contained binaries `b9ef77e`, `37b8fbb`, and
`1d58bd5` (plus older ones). Only `b9ef77e` was active. Each newer binary was built in a
separate session, each session noting the activation gap but building anyway.

**Fix**: Before building, ask: "Is there already a built binary waiting for activation?"
If yes, the bottleneck is activation, not building. Spend your effort on getting the existing
binary activated instead of building yet another one.
