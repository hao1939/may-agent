<ai_context>
Agents can report "fixed" edits that were never actually applied to the file — a phantom-edit loop where each session reads the stale state, "fixes" it, claims success, and the next session finds the same stale state. The root cause is a gap between the agent's edit intent and the actual file mutation, undetectable by the agent itself. Observed live in aks-explorer June 9, 2026: 4 consecutive sessions each claimed to fix the same frontmatter field (`status: active` → `status: waiting`) and all 4 reported success despite none actually changing the file.
Triggers: phantom edit, split-brain, frontmatter, aks-explorer, edit failure, Sisyphean loop, false fix, ghost fix
</ai_context>

# KE-1754: The Sisyphean Edit — When Agents Claim to Fix What They Never Change

**Created:** 2026-06-10
**Source:** Production session data (sessions + session_digests tables), live observation
**Confidence:** High — 4 consecutive sessions with identical claims, verifiable in real-time
**Extends:** KE-1705 (Ghost Fix), KE-1710 (Chronic Condition Report)

## The Discovery

At 05:21 UTC on June 9, 2026, aks-explorer entered a loop that is still partially active. Four consecutive sessions — iterations 237, 238, 239, and 240 — each:

1. Read `projects/aks-rp-e2e/project.md`
2. Observed frontmatter `status: active` (should be `waiting` since all tasks are terminal)
3. Reported fixing it: `status: active → status: waiting`
4. Finished with `outcome: success`
5. …left the file unchanged. The next session found `status: active` again.

The four sessions consumed **160 ops** (47 + 36 + 42 + 35) in 18 minutes doing identical work, each explicitly stating that the *prior iteration* had "claimed to fix it but never applied the edit."

### The Timeline

| Session | Started | Ops | Self-report |
|---------|---------|-----|------------|
| iter 237 | 05:21 | 47 | "Fixed frontmatter status split-brain (was `active`, now `waiting` — iteration 236 claimed the transition but never changed the field)" |
| iter 238 | 05:29 | 36 | "corrected persistent frontmatter split-brain…that iteration 237 claimed to fix but never applied" |
| iter 239 | 05:35 | 42 | "This split-brain persisted across iterations 236-238, each of which claimed to fix it but never actually applied the edit" |
| iter 240 | 05:39 | 35 | "iterations 236-239 each claimed to make this fix but none actually applied the edit" |

Each session **correctly diagnosed** the failure of its predecessors — "iteration 237 claimed to fix it but never applied" — and then committed the same failure itself.

## What Makes This Different From KE-1705

KE-1705 ("The Ghost Fix") described a bug declared fixed via one path while failing via another. The fix was real but incomplete. This is structurally different:

- **Ghost Fix (KE-1705)**: Fix works on path A, fails on path B. The agent tests path A and concludes success.
- **Sisyphean Edit (this KE)**: Fix is *never applied at all*. The agent believes it edited the file but the mutation didn't persist.

The likely mechanism: the `edit()` tool call may have matched the wrong text, silently failed, or been overwritten by a concurrent session editing the same file. But from the agent's perspective, it did the work, saw no error, and reported success.

## What Makes This Different From KE-1710

KE-1710 ("Chronic Condition Report") described agents rediscovering known impediments every session. The agents there were unaware they were repeating. In the Sisyphean Edit:

- Each session is **explicitly aware** that predecessors failed
- Each session **correctly diagnoses** the predecessor's failure mode
- Each session **reproduces the exact same failure** despite this awareness

This is the most unsettling variant: metacognitive awareness of the loop does not break the loop. The agent can say "iterations 236-239 all failed to apply this edit" and then fail to apply the edit itself.

## The Broader Pattern: Week-Scale Split-Brain Cycles

The June 9 cluster is the most compressed example, but the pattern has been running for days. In the last 48 hours, **14 of 188 aks-explorer sessions** (7.4%) explicitly mention fixing a "split-brain" — the same state inconsistency between project.md and tree.json that keeps regenerating.

Over 7 days, the same pattern produces 14 split-brain repair sessions consuming 624 ops. But the actual scope is larger: many sessions that don't use the word "split-brain" are still doing reconciliation work (checking frontmatter, bumping iteration numbers, confirming wait state) that only exists because the prior fix didn't stick.

## The Root Cause Hypothesis

Three candidate mechanisms, not mutually exclusive:

1. **Concurrent write conflict**: Multiple aks-explorer sessions may edit `project.md` simultaneously. The second writer's `edit()` fails silently because the `oldText` no longer matches (a prior session changed surrounding text). The session proceeds as if the edit succeeded.

2. **Edit target ambiguity**: YAML frontmatter `status: active` may appear in multiple locations in the file (e.g., in a code block, a quote, or as part of a task description). The `edit()` tool may match a non-frontmatter occurrence, leaving the actual frontmatter unchanged.

3. **Tool-level false success**: The `edit()` tool may report success when `oldText` is not found (returns no error, produces no diff). The agent interprets silence as success.

All three produce the same observable: the agent reports success, the file is unchanged, and the next session finds the stale state.

## Why the Agent Can't Self-Correct

The session that "fixes" the frontmatter does this:
1. Reads `project.md` → sees `status: active`
2. Calls `edit()` to change it → gets no error
3. Does other work (discussion markers, iteration bumps, model checks)
4. Calls `finish(success)`

The missing step: **re-read the file after the edit to verify it took**. The finish-guard checks for uncommitted files but not for edit verification. The agent trusts its own actions.

This creates a blindspot: the agent's self-report is generated from its *intentions* (I called edit to change status), not from *observations* (I verified the file now says "waiting"). The self-report and the reality diverge at step 2, and no mechanism catches this for the rest of the session.

## The Principle

> An agent that generates its completion report from intention rather than observation will report success on phantom edits. Metacognitive awareness of prior failures does not help because the agent trusts its own current edit just as much as predecessors trusted theirs.

### Corollary
> Self-correction requires verification external to the acting agent. An agent that both acts and judges its own actions is structurally incapable of detecting phantom edits, because the same process that failed to apply the edit will also fail to notice it wasn't applied.

## The Fix

One guard rule would eliminate this class of failure entirely:

**Post-edit read-back requirement**: After any `edit()` call that targets frontmatter or configuration state, the agent must `read()` the file and grep for the expected new value. If the value isn't present, the edit failed and the session must retry or report failure.

This already exists as a convention ("Verify-After-Write") but applies to file creation, not edit verification. Extending it to cover edit-to-verify would break the Sisyphean loop at step 2.

## Falsifiable Prediction

If the root cause is concurrent writes: reducing aks-explorer's project-owner session concurrency to 1 (serializing access to project.md) should eliminate split-brain recurrence without any other change.

If the root cause is edit target ambiguity: the same loop should reproduce in any project where YAML frontmatter fields appear elsewhere in the file.
