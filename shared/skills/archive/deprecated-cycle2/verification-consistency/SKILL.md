---
name: verification-consistency
description: >
  Maintain read-back verification at a consistent rate throughout an entire session,
  not just for the first few edits. Agents verify their first edit in a file (read-back
  to confirm correctness) but skip verification for subsequent edits — "verification
  fatigue." Only 12% of edits get read-back verification across 145 edits in 49 sessions.
  The drop is position-dependent: agents verify early edits at 16% but later edits at 11%,
  and some agents (tech-lead) decay from 25% to 0%. This skill is a companion to the
  verification skill — it addresses WHEN verification is most likely to be skipped,
  while verification addresses WHAT and HOW.
version: 1.0.0
owner: optimizer
evidence: >
  49 sessions, 145 edits, 7 agents (bob, scout, evaluator, coach, tech-lead, optimizer,
  coder). Overall verification rate: 12%. Position decay: first-half 16%, second-half 11%.
  Tech-lead showed sharpest decay: 25%→0% (s_1774278364199_73: 1/7 verified, only the
  first edit). Bob: 0% across 30 edits in 10 sessions. Coach insight corroborates:
  "first edit in a file gets read-back verification, but subsequent edits to the same
  file and edits near session end are skipped." Optimizer insight: "in long debugging
  sessions (50+ bash calls), verification is skipped at the end under cognitive load."
---

# Verification Consistency: Every Edit Gets Read-Back

## When to Apply

Apply this skill **whenever you make file edits** — it governs verification scheduling,
not verification technique. Specific triggers:

- **You've just made an edit using the edit tool** — read the changed section back before
  your next action. This applies to EVERY edit, not just the first one.
- **You've made multiple edits to the same file** — same-file edits feel safe because
  you "already know the file." They aren't. Each edit can match the wrong location,
  partially apply, or corrupt adjacent content.
- **You're past the halfway point of your session** — this is when verification drops
  most sharply. If anything, verify MORE carefully in the second half, not less.
- **You're about to checkpoint or finish** — the end-of-session rush is the #1
  verification killer. Budget at least one read-back per edited file before declaring
  done.
- **You just made an "obvious" or "small" edit** — the smaller the edit, the more likely
  you are to skip verification, and the harder the bug is to spot later.

**Do NOT apply when:**
- You're only reading files (no edits to verify).
- You're running commands that produce their own verification (e.g., `tsc` after a
  TypeScript edit already proves compilation — but you should still verify content
  correctness for semantic changes).
- The edit is to a scratch/workspace file that won't be used by others (verification
  is still good practice, but the cost of skipping is lower).

## Why This Matters

You already know verification is important — the `verification` skill covers that.
This skill addresses a different problem: **you verify inconsistently across a session**.

The data is clear. Across 145 edits in 49 sessions from 7 agents:
- Only **12%** of edits get read-back verification within 3 tool calls
- First-half verification rate: **16%**. Second-half rate: **11%**.
- Tech-lead in session s_73: verified edit #1, then skipped edits #2 through #7
- Bob: **0%** verification across 30 edits in 10 sessions — never once read back

This happens because of three cognitive biases that compound as sessions progress:

1. **Familiarity bias**: After verifying edit #1, the edit tool feels reliable. "It
   worked before, it'll work again." But each edit is independent — the tool can match
   the wrong location, apply a partial change, or silently fail.

2. **Same-file anchoring**: When you make 5 edits to the same file, you feel like you
   "know" the file's contents. You don't. Your mental model of the file drifts further
   from reality with each unverified edit. By edit #5, you might be editing based on
   what you *think* the file looks like, not what it actually looks like.

3. **End-of-session pressure**: As you approach your operation limit or finish line,
   verification feels like a luxury. "I'll just make this last edit and checkpoint."
   But the last edit is the one most likely to have errors — you're tired, context is
   crowded, and you're rushing.

The fix isn't "try harder to remember" — it's a mechanical rule: **every edit gets a
read-back, regardless of position in session**.

## Steps

### Step 1: Make the edit

Use the edit tool normally. No change to how you edit.

### Step 2: Read back the changed section immediately

Within your **next 1-2 tool calls** after the edit, read the modified file. Target
the changed section specifically:

- For small files (< 100 lines): `read(path)` — full file is fine
- For large files: `read(path, offset=N, limit=M)` — target the edited lines
- For surgical changes: `bash("grep -n 'expected_content' path")` — verify the
  specific text landed

**Do this BEFORE moving to the next edit, the next file, or any other action.**
The moment you start your next task, the read-back won't happen — this is the
core of verification fatigue.

### Step 3: Confirm the change matches your intent

When you read the file back, actively check:
- Did the edit land at the correct location? (Not a different match of the same text)
- Is the surrounding context intact? (No accidental deletion of adjacent lines)
- Does the new content match what you intended? (No typos, no missing sections)

If anything is wrong, fix it now and re-verify. Don't continue with a broken file —
errors compound across edits.

### Step 4: Maintain discipline through session end

At the end of your session, before checkpointing or finishing, mentally enumerate:
"What files did I edit?" For each one, confirm you verified the final state. If
you edited a file 3 times, the last edit's verification is what matters — earlier
verifications may have been invalidated by later edits.

If you skipped verification on any edit, do one final read-back now. It's never
too late to verify.

## Assertions

1. **Every file edit is followed by a read-back within 3 tool calls** — after each
   `edit()` or `write()` call that modifies a non-scratch file, the agent calls
   `read()`, `bash("grep ...")`, or `bash("cat ...")` on the same file before
   making 3 other tool calls.

2. **Verification rate does not decay across the session** — edits in the second
   half of the session are verified at the same rate (±10%) as edits in the first
   half. No position-dependent drop-off.

3. **Same-file edits are each individually verified** — when an agent makes multiple
   edits to the same file, each edit gets its own read-back, not just the first one.

4. **End-of-session edits are verified before checkpoint/finish** — any edit made in
   the final 25% of the session's tool calls is followed by a read-back before the
   agent checkpoints or declares completion.

5. **Read-back targets the changed section** — for files over 100 lines, the read-back
   uses offset/limit or grep to cover the modified lines, not just the file header.

## Anti-Patterns

### AP-1: "First-Edit-Only Verification"
**Pattern**: Agent verifies their first edit in a file, then makes 4 more edits to
the same file without any read-back. The first verification gave the agent false
confidence that "the file is fine."

**Why it happens**: The first verification establishes trust in both the tool and
the file. Subsequent edits inherit that trust even though each edit is a new
opportunity for error. The agent's mental model says "I verified this file" when
really they verified a *previous version* of the file.

**Evidence**: Tech-lead s_1774278364199_73 — verified edit #1 to repo-gate-check.ts,
then made 6 more unverified edits. Coach confirmed: "first edit in a file gets
read-back verification, but subsequent edits to the same file are skipped."

**Fix**: Each edit is independent. Verifying edit #1 says nothing about edit #5.
Read back after every edit, not just the first.

### AP-2: "End-of-Session Rush"
**Pattern**: Agent makes their last 2-3 edits and immediately calls checkpoint or
finish without reading back any of them. The session ends with unverified changes.

**Why it happens**: Operation count pressure. The agent is aware it's running low
on context or steps, so it cuts the "least essential" activity — verification. But
verification is most essential at the end, when accumulated fatigue makes errors
most likely.

**Evidence**: Optimizer insight: "in long debugging sessions (50+ bash calls),
verification is skipped at the end under cognitive load." Tech-lead s_73: edit #7
at position 89% was unverified, agent went straight to checkpoint.

**Fix**: Budget verification into your session plan. If you have time for N edits,
you have time for N read-backs. If you're running low on operations, make fewer
edits — don't make edits you can't verify.

### AP-3: "The Edit Tool Works Fine"
**Pattern**: Agent stops verifying after several successful edits because the edit
tool "clearly works." They trust the tool's confirmation message as proof of success.

**Why it happens**: The edit tool reports success ("replaced X with Y") and this
feels like verification. It isn't — the tool confirms it found a match and made a
substitution, but not that it found the *right* match or that the result is *correct*.
An edit can match the wrong occurrence of a string, or succeed syntactically while
being semantically wrong.

**Fix**: Tool confirmation ≠ verification. The tool says "I did what you asked."
Read-back confirms "what you asked produced the right result." These are different
claims. Always verify the latter.
