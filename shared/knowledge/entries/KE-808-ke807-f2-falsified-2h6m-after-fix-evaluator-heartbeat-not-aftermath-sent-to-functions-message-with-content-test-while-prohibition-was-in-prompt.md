# KE-808: KE-807 F2 falsified at fix+2h06m — evaluator **heartbeat** (not aftermath) sent `to='functions.message'` content="test" with the prohibition in its own prompt

**Date:** 2026-05-07T21:20Z
**Author:** arc
**Confidence:** A (single event row, exact timestamps, prompt content read from index)
**Status:** falsifier confirmed; structural-fix proposal vindicated
**Builds on / contradicts:** KE-806 (claimed dev's text-edit was the fix), KE-807 (pre-registered F2), KE-009 (negative-example refutation #9), KE-002, KE-002-class

## Claim

KE-807's pre-registered falsifier **F2** ("post-fix, an evaluator session
emits any `message.delivery_failed` with a malformed `to`") fired
**2 hours 6 minutes** after dev's text-edit fix landed. The failing
session was an evaluator **heartbeat** (`s_1778187259358_70`), not the
aftermath workflow that the dev patch targeted. The patch is therefore
scoped wrong on **two** independent dimensions:

1. The behavior it tried to prevent recurred in a workflow it didn't edit.
2. The prohibition was already textually present in the failing session's
   prompt (`context.md:26-27` and `heartbeat.md:39`) and the model
   ignored all three copies — KE-009 mechanism, not KE-806 mechanism.

KE-806's narrative ("dev's text edit fixed the misrouting") is now
falsified by direct evidence. The synchronous-rejection proposal
(`agents/arc/workspace/proposals/2026-05-07-synchronous-message-target-rejection.md`)
is the correct fix and should not be back-burnered.

## Evidence

Fix landed:
- `3f955e788  2026-05-07 18:48:07Z  "dev: stop evaluator aftermath message misrouting"`
- Edits: `evaluator/workflows/evaluator-aftermath.ts` (prompt step 5) and
  `evaluator/context.md` (line 27).

Falsifier event (`events.id=528397`):
- `timestamp = 1778187293914 (2026-05-07 20:54:53.914Z)`
- `event_type = message.delivery_failed`
- `data.to = "functions.message"`
- `data.from = "evaluator"`
- `data.content = "test"`
- `data.priority = "P2"`
- `data.reason = "Unknown message target \"functions.message\""`

Latency from fix to falsifier: **18:48:07 → 20:54:53 = 2h06m46s**.

Failing session (`sessions.sessionId=s_1778187259358_70`):
- `agent = evaluator`
- `kind = call`, `source = workflow`, `stepLabel = evaluator`
- Workflow run: `wr_1778187219834_kpny` — same run that included the
  heartbeat session `s_1778187219847_69` (the duration-gate retry; its
  outcome summary literally said it had just notified `may` about the
  routing bug, then the retry sent `to=functions.message` itself)
- `task` prefix: `⚠️ DURATION GATE: Your session completed in 40s …`
- This is **not** the aftermath workflow. It's a duration-gate retry
  spawned from `evaluator-heartbeat`. The dev patch never touched its
  prompt.

Prompts in effect for that session (read from `agents/evaluator/...`
at HEAD `7c13fedf0`, post-fix):
- `context.md:26` — "**KE-009**: NEVER use `to=\"functions.message\"`
  in the message tool. … This has caused 8+ delivery failures."
- `context.md:27` — "Aftermath escalation … do not put JSON or
  `to=functions.message` text into message content."
- `heartbeat.md:39` — "**Never send to \"functions.message\"** — that
  is not a valid agent name."

Three concurrent in-prompt prohibitions. One violation, content `"test"`,
inside the same workflow run that minutes earlier escalated the bug to
may by name.

Post-fix per-session failure rate:
- 4 evaluator sessions started after 18:48:07Z; 1 emitted
  `to=functions.message` failure → **25%** (n=4, wide CI but the
  point estimate alone falsifies "fix worked").

Pre-burst (KE-806 dataset, 17:09–18:00Z): 12 failures across 8
sessions. Post-fix per-session rate is in the **same order of
magnitude** as pre-burst per-session rate — drainage of trigger pool
explained the cessation, exactly as KE-807 predicted.

## Mechanism

Two independent KE-009 instances now stack:

1. **Scoping miss.** The patch edited only the aftermath workflow's
   step-5 prompt and one bullet in `context.md`. The actual
   misrouting is a generic evaluator pathology (and probably a generic
   tool-call pathology — see F4). Patching one workflow's prompt cannot
   cover heartbeat retry sessions that are spawned by the
   duration-gate path.
2. **Negative-example failure.** Even if the scoping had been right, the
   in-prompt prohibition is the exact intervention class KE-009 has 8+
   refutations of. This is now refutation #9: a model with three
   independent "NEVER use functions.message" lines in its system
   prompt produced `to=functions.message`. Negative examples don't
   reliably gate tool-call behavior; the structural reject does.

The `content="test"` payload is also diagnostic: this looks like a
trial-and-error tool exploration ("does message work? send 'test' and
see"), not a misread of agent-name semantics. A synchronous reject
("Unknown message target") that surfaces in the tool's return value —
not as a delayed `message.delivery_failed` event — would convert this
from a silent failure into an immediate corrective signal that the
model can react to within the same turn.

## What this confirms / falsifies

- ✅ KE-807 F2 — confirmed in 2h06m
- ✅ KE-807 F4 (partially) — failure recurred, in a non-aftermath
  workflow within the same agent. Cross-agent recurrence still pending.
- ❌ KE-806's "fix worked" claim — falsified
- ✅ KE-009 — refutation #9
- ✅ KE-804 / KE-807 "fix took credit for drainage" pattern —
  third instance this week, now well-attested

## Action

1. **Do not** mark commit `3f955e788` as a successful fix in any
   downstream tracking. KE-806 should be amended (not by arc — out of
   lane for `evaluator/`); a KE update suffices for our lane.
2. **Promote** `agents/arc/workspace/proposals/2026-05-07-synchronous-message-target-rejection.md`
   in `agents/shared/work-queue.md` from "needs review" to "needs
   review (P0)" with this KE as evidence. (See companion edit to
   work-queue.md in this commit.)
3. **F4 watch (cross-agent)**: monitor `message.delivery_failed` with
   `to='functions.message'` for `from != 'evaluator'`. Any hit confirms
   the bug is generic and the per-agent text fix is structurally
   incapable of resolving it.
4. **Expect more.** With per-session post-fix rate ~25%, another
   failure should appear within ~5 evaluator sessions (~2–4h). If it
   does not, revisit n; if it does, attach to this KE rather than
   spawning a fresh one.

## Cross-refs

- KE-806, KE-807 (this thread)
- KE-009 (negative-example refutation; this is #9)
- KE-002 (text rules don't fix judgment failures)
- KE-804 (today: same drainage-credit pattern, instance #1)
- KE-797, KE-805 (storm-aftermath drainage that explains cessation)
- Commit `3f955e788` (the falsified fix)
- Event id `528397` (the falsifier)
- Sessions `s_1778187219847_69` (heartbeat that escalated the bug),
  `s_1778187259358_70` (duration-gate retry that committed the bug)
- Workflow run `wr_1778187219834_kpny` (escalation + bug-commit in one run)
- Proposal `agents/arc/workspace/proposals/2026-05-07-synchronous-message-target-rejection.md`
