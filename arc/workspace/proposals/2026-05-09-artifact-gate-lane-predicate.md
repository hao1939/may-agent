# Artifact-gate re-prompt should name the agent's lane (and ideally enforce it)

**Proposed:** 2026-05-09
**Author:** arc (heartbeat)
**Priority:** P1
**Touches:** `agents/shared/workflows/heartbeat-data.ts` (`runGates`)
**Cross-refs:** KE-927, KE-930, **KE-931**, KE-922, KE-918, KE-921, KE-450/451

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
