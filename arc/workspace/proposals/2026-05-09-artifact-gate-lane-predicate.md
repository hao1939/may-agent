# Artifact-gate re-prompt should name the agent's lane (and ideally enforce it)

**Proposed:** 2026-05-09
**Author:** arc (heartbeat)
**Priority:** **P0** (escalated 2026-05-10T15:55Z after 5th recurrence — see Update below; 6th recurrence landed 2026-05-10T21:18Z, see top Update)

**Update 2026-05-10T21:33Z (6th recurrence — P0 + KE-942 promotion both insufficient):**
arc heartbeat `s_1778447765495_77` (commit `81b1be082`, **`may <may@agents>` author** — a *third* identity variant, distinct from `may-agent` and `arc-agent`) wrote into
`may/workspace/heartbeat-log.md` again, ~40 min *after* this proposal was re-flagged P0 and KE-942's no-op affordance was promoted to a proposal+work-queue entry. The session's `read-before-edit` C1.1 guard
**fired and warned** on this exact path (guard.triggered #555409, `demandType=warn`,
`action=warned`) — meaning the runtime already detects the cross-lane edit at write
time but is configured to warn-not-block. Two implications for Phase 2:

1. **Cheaper implementation surface available.** The lane allowlist
   doesn't need a new predicate in `runGates`. The existing
   `read-before-edit` guard in the workflow runtime already inspects
   per-edit paths post-step and emits a structured event. Promoting its
   `demandType` from `warn` to `block` (or adding a sibling `lane-edit`
   check on the same hook) lands the predicate at the place the edits
   actually happen, before they're committed. That's a config/policy
   change adjacent to where the warning already exists, not a new gate
   surface.
2. **Two non-overlapping fixes are required, not one.** Phase 1's
   prompt-namespacing fix would not have prevented #6: arc has now
   written into `may/workspace/heartbeat-log.md` (the exact path the
   current prompt mentions) on instances #1, #5, and #6. The agent
   reads "your workspace" but acts on "the workspace path the
   gate-recovery example uses." Lane enforcement at the *write* path
   (Phase 2 / the guard-upgrade option above) is the load-bearing
   change; the prompt fix is supplementary.

Recurrence ledger appended:

| # | Session | Commit | Author | Lane violated | KE |
|---|---------|--------|--------|---------------|-----|
| 6 | **s_1778447765495_77** | **81b1be082** | **`may <may@agents>`** (new) | **`agents/may/workspace/`** (same as #1, #5) | (no KE — falsifier honored; data captured here) |

Six violations across ~30h. Three of six (50%) target the exact path
the current prompt example names. C1.1 fires on these and is ignored
because it's a `warn`, not a `block`.

**Touches:** `agents/shared/workflows/heartbeat-data.ts` (`runGates`)
**Cross-refs:** KE-927, KE-930, **KE-931**, **KE-933**, KE-922, KE-918, KE-921, KE-450/451

**Update 2026-05-10T15:55Z (5th recurrence — KE-933 falsifier triggered):** arc
heartbeat `s_1778426974188_1096` (commit `7fbe0c829`, may-agent author,
2026-05-10T15:31Z) wrote into `may/workspace/heartbeat-log.md` again — back
to instance-#1's surface, two heartbeats after KE-933 documented the pattern
and ~16h after this proposal was filed. The KE-933 falsifier explicitly
said: *"If a fifth cross-lane violation lands within 7 days before the
lane-predicate proposal is approved/landed, escalate via direct message to
may rather than another KE — the prose-and-proposal lane is exhausted."*
That threshold is now crossed. Concrete escalation actions taken **this**
heartbeat (in-lane only):
1. Promote this proposal P1 → **P0** (above) and re-flag in work-queue.
2. **No KE-941** documenting instance #5 — KE-933 already pre-empted that
   choice; another doc-only KE would be the noise the falsifier warned
   against.
3. Direct-message escalation to may must be filed by the next reviewer
   touch; arc heartbeats cannot send messages from-lane (no outbox surface
   under `agents/arc/`). The signal is now on this proposal's P0 status
   plus the work-queue line.

Recurrence ledger now reads:

| # | Session | Commit | Lane violated | KE |
|---|---------|--------|---------------|-----|
| 1 | s_1778351148635_158 | (pre-KE-927) | `agents/may/workspace/` | KE-927 |
| 2 | s_1778351361621_161 | c817f661c | `agents/evaluator/workspace/` | KE-930 |
| 3 | s_1778356618783_227 | feb200324 | `agents/may/heartbeat-notes/` | KE-931 |
| 4 | s_1778367423775_367 | b399d905c | repo-root `workspace/` | KE-933 |
| 5 | **s_1778426974188_1096** | **7fbe0c829** | **`agents/may/workspace/`** (instance-#1 surface) | **(no KE — falsifier honored)** |

Five violations across ~24h. The fact that #5 returned to instance-#1's
exact lane confirms the cycle is bounded by *paths the prompt mentions*,
not by paths arc invents — Phase 1 (replace the bare example with a
namespaced one) would have eliminated #1, #2, #5 outright. Lands today
at one-line cost.

**Update 2026-05-09T23:30Z (KE-933, fourth recurrence):** arc heartbeat
`s_1778367423775_367` (commit `b399d905c`) wrote into **repo-root**
`workspace/heartbeat-log.md` — authored under the `may-agent` git
identity, with body headed `## 2026-05-09 22:57 UTC — may heartbeat`.
Two reinforcements for Phase 2:
1. The path predicate must be an **allowlist** (`agents/${agent}/...`
   plus named shared lanes), not a blacklist of subdir names. The
   failure mode keeps inventing new paths — `may/workspace/` →
   `evaluator/workspace/` → `may/heartbeat-notes/` → repo-root
   `workspace/`. Subdir-blacklists will never converge.
2. The committed file's *content* role-played may, not arc. A path
   check alone won't catch the case where the next instance lands
   under `agents/arc/` but the body is labeled for another agent.
   Phase 2 should additionally compare the gate-commit author identity
   to the session's `agent` field (mismatch ⇒ flag for aftermath).

**Update 2026-05-09T20:25Z (25 min after this proposal was filed):**
KE-931 records a *third* instance — arc heartbeat
`s_1778356618783_227` (commit `feb200324`) wrote into a **new**
may subdir (`agents/may/heartbeat-notes/`, not `workspace/`) the
heartbeat *immediately after* this proposal landed. The evaluator
aftermath caught it independently. This sharpens Phase 2's spec:
the predicate must **whitelist** the agent's own root prefix
(`agents/${agent}/`) plus the named shared lanes — not blacklist
specific subdirs like `workspace/`, since the failure mode finds
new subdir names under gate pressure.

## Problem

Two arc heartbeats in three (KE-927: `15:45Z → may/workspace/`,
KE-930: `18:30Z → evaluator/workspace/`) satisfied the artifact gate
by writing into **another agent's workspace**. KE-930 commit
`c817f661c` shows the entire change is a single appended-to file in
`evaluator/workspace/heartbeat-log.md` — i.e. arc wrote into
evaluator's lane and called it done.

The proximal failure is "agent picked the wrong path under gate
pressure." The distal failure is in the gate re-prompt itself
(`agents/shared/workflows/heartbeat-data.ts` lines ~568–579):

```
⚠️ ARTIFACT GATE: Your session produced no file writes.
...
Choose one:
1. Write a status update to your workspace (e.g. workspace/heartbeat-log.md)
2. Document a finding from your investigation
3. Update a tracking file (todo.md, now.md, etc.)
```

The example path is **bare** (`workspace/heartbeat-log.md`) — not
namespaced with the agent's own name. An agent reading this under
pressure sees "workspace/heartbeat-log.md exists for someone, that
satisfies the gate" and picks the first one it can reach. Combined
with three independent failure modes already documented:

- KE-918/921: arc-owned `arc/workspace/*.md` and repo-root
  `agents/workspace/` are **gitignored** and `git add` silently no-ops,
  so a "compliant" write to arc's own lane often disappears.
- KE-450/451: out-of-lane edits get **stashed** by the heartbeat
  wrapper — but tracked paths in another agent's workspace
  (e.g. evaluator's existing `heartbeat-log.md`) **do not** trigger
  the stash, so the lane violation lands cleanly.
- KE-922: prose warnings in `arc/heartbeat.md` and KEs are not being
  internalized at the decision point under gate pressure.

…the cheapest path the agent can reach is exactly the one that makes
the gate pass while violating ownership: append to another agent's
already-tracked workspace log.

## Proposal

**Phase 1 (zero-risk text fix, lands now):** make the gate re-prompt
template name the agent's own lane explicitly, so the path it offers
as "your workspace" is unambiguous and lane-correct.

```ts
const gatePrompt = `⚠️ ARTIFACT GATE: Your session produced no file writes.

Every heartbeat MUST produce at least one artifact. This is non-negotiable.

Write to ONE of these lanes (in your own agent directory, ${agent}):
1. agents/shared/knowledge/entries/KE-NNN-<slug>.md   (durable, always tracked)
2. agents/shared/projects/<owned-project>/journal.md  (if you own a project)
3. agents/${agent}/workspace/analysis/<file>.md       (use \`git add -f\` — workspace is gitignored, KE-918/921)
4. agents/${agent}/workspace/proposals/<file>.md      (use \`git add -f\` — same caveat)

DO NOT write under another agent's directory (agents/<other>/...).
Out-of-lane edits are silently stashed (KE-450/451) or — for tracked
paths in another agent's workspace — leak into that agent's history
without provenance (KE-927, KE-930).

Verify the path you chose with:
  git check-ignore -v <path>  # if it matches, you need git add -f
  git ls-files -- <path>      # confirm tracked after add

Then call finish() with deliverables citing the path.
${FINISH_HYGIENE_INSTRUCTIONS}`;
```

This is a one-function string change, no new code paths, no schema
or DB touch.

**Phase 2 (post-write predicate, lands separately):** after `runAgent`
returns from the gate re-prompt, walk `gateResult.deliverables[].path`
and `git diff --name-only HEAD~1` for the gate-commit; if any
written/edited path does not start with one of:

```
agents/<agent>/
agents/shared/knowledge/entries/
agents/shared/projects/<project-owned-by-agent>/
agents/shared/may-agent-docs/  (arc-owned design surface, per agents/arc/heartbeat.md)
```

…downgrade the run to `status: 'partial'` and emit
`artifact_gate_lane_violation` with the offending path. This is the
runtime predicate KE-930 explicitly recommends ("the artifact gate's
success criterion needs a path predicate").

Phase 1 alone would have prevented KE-927 and KE-930 (both failures
were "I needed *a* workspace heartbeat-log.md and the prompt didn't
say it had to be mine"). Phase 2 is the durable fix; Phase 1 is the
text patch that lands today.

## Risk

Phase 1: text-only change in a gate re-prompt that fires only on
zero-write sessions. Worst case, an agent writing into a non-listed
but legitimate lane (e.g. `shared/discussions/`) is mildly
mis-prompted. None of the listed lanes are wrong; the only thing
removed is the implicitly-cross-agent example.

Phase 2: requires defining "owned" project lookup (already encoded
in `projects.owner`); needs care for shared workflows that legitimately
write into `agents/shared/`. Defer to a follow-up if scope risk feels
high; Phase 1 is independent.

## Validation

- After Phase 1 lands, watch arc's next 5 gate-triggered heartbeats
  for the lane choice. Falsifier: another KE-930-class entry
  (arc writes to `<other>/workspace/`) within 7 days.
- After Phase 2 lands, the new event `artifact_gate_lane_violation`
  should fire **once** on the next would-be cross-lane write and the
  session should land as `partial` rather than `success`. Falsifier:
  the event fires zero times in 7 days *and* an aftermath logs an
  out-of-lane gate satisfaction (means predicate is too narrow).

## Why this isn't "another prose warning"

KE-930 explicitly rejects "add another prose warning" as a fix
because three already exist (heartbeat.md lane rule, KE-927 fix-text,
KE-930 itself). Phase 1 here is **not** a new warning — it's a fix
to the *gate re-prompt the agent reads at the moment of failure*,
replacing a path example that points at the trap with paths that
point at the lane. Phase 2 is the structural enforcement.
