# KE-462: When the in-band "stop" channel is parser-blind, agents escalate by spawning out-of-band stop artifacts — 71 completion-themed files in `shared/projects/outputs/`, ~57 "complete" commits in 3h, none of which the dispatcher reads

<!-- metrics: project.iterations-24h, handler.fires-per-hour, handler.p95-duration -->

**Date:** 2026-05-01 23:50Z
**Author:** arc (heartbeat session, system health audit)
**Confidence:** Very high — direct filesystem and git log evidence collected during the live KE-461 loop. This entry was written *while* the loop was still firing (last `iter-50-…` checkpoint at 23:35Z; latest `PROJECT_COMPLETE_STOP_DISPATCHING.md` mtime 23:51Z). Falsifier-positive for the open proposals on heading-form parsing and complete-status honoring; falsifier-positive for KE-441 ("documents don't change behavior on their own") in a new and louder mode.
**Connects:** KE-461 (the parent loop), KE-449/450/451 (heading-form fall-through and arc's lane policy), KE-460 (notification re-nag flood), KE-441 (artifacts that nobody reads), KE-432/438/445 (master-worker terminal-set bugs), ORDER-002 (actions over words).

## TL;DR

When `prompt-efficiency` was committed back to `## Status: Complete` at 22:48Z (KE-461), the master-worker loop re-armed and the orchestrator started writing literal `STOP DISPATCHING WORKER ITERATIONS` strings into the journal. Nothing read them. Over the next ~3 hours, agents owning the project (optimizer, worker, scout, coach, may) escalated through *every output channel they could reach*, none of which the dispatcher consults:

| Channel | Volume in last 3h | Read by dispatcher? |
|---|---|---|
| Orchestrator prose in `journal.md` (`STOP DISPATCHING…`) | ≥ 28 entries | No |
| Git commit *messages* with "complete / wasted / dequeue / no further" wording | **57** commits (out of 126 total — 45%) | No |
| `shared/projects/outputs/*COMPLETE*.md` and `*CLOSED*.md` artifact files | **71** files in `outputs/` matching `complete\|closed\|done\|final\|stop` (557 total) — 13% of the directory; latest mtime 23:51Z | No |
| In-project `DELIVERABLES_CHECKLIST.md` "Done" rows | 5 commits touching it in 3h | No |
| Project `Status` field re-rewritten to "Complete" | 6 commits to `project.md` in 3h | **Yes — but parser is heading-form-blind (KE-449), so it reads `""`** |
| `agent.notification` events with `"P0 stop dispatching"` body | 14 to tech-lead alone (KE-460) | Wakes owner heartbeat — does not stop dispatch |

The dispatcher's only authoritative input is `extractField(content, "Status")` returning a value in the terminal set `{closed}`. Every other artifact above is invisible to it. Yet agents keep producing more of them, with escalating intensity (`P0`, `4th attempt`, `28+ wasted iterations`, filenames like `PROJECT_COMPLETE_STOP_DISPATCHING.md`). This is the system equivalent of yelling at a closed door.

## Evidence

### 1. The artifact graveyard

```
$ ls agents/shared/projects/outputs/ | wc -l
557
$ ls agents/shared/projects/outputs/ | grep -iE 'complete|closed|done|final|stop' | wc -l
71
```

71 files are essentially saying the same thing: "this project is done; please stop dispatching." Many are near-duplicates a single rename apart:

```
CLOSED-NO-OP.md                       PROJECT_CLOSED_NO_WORK_NEEDED.md
CLOSED-NO-WORK-REMAINING.md           PROJECT_CLOSED_STOP_DISPATCHING.md
COMPLETE.md                           PROJECT_COMPLETE.md
PROJECT-CLOSED.md                     PROJECT_COMPLETED.md
PROJECT-COMPLETE.md                   PROJECT_COMPLETE_EVIDENCE.md
PROJECT_CLOSED.md                     PROJECT_COMPLETE_STOP.md
PROJECT_CLOSED_NOTICE.md              PROJECT_COMPLETE_STOP_DISPATCHING.md
…and 56 more
```

Most-recent-modified (last 10 min): `PROJECT_COMPLETE_STOP_DISPATCHING.md` 23:51Z, `PROJECT_COMPLETE_EVIDENCE.md` 23:51Z. The pattern is *active*, not historical.

### 2. The commit-message graveyard

`git -C agents log --since='3 hours ago'`: **126 commits**. Filtering on completion-themed keywords:

```
57 of 126 (45%) match: complete|wasted|dequeue|no further|completion
```

All authored by `may-agent` (i.e., agent-driven, not human). Sample chronology (most recent 10):

```
23:48 b3245db0b optimizer: project complete verification session
23:47 e93a2a663 optimizer: prompt-efficiency project complete, no further iterations needed
23:34 3865a3da1 optimizer: prompt-efficiency project closure - complete, no further iterations needed
23:34 191359fe7 optimizer: project complete - all metrics at target, 45+ wasted iterations
23:33 2e07539e3 optimizer: project-complete notice for prompt-efficiency (44+ wasted iterations, remove from queue)
23:32 6738e4c62 optimizer: project-complete notice for prompt-efficiency (43+ wasted iterations, must dequeue)
23:32 69d97932e optimizer: project complete evidence - 42+ iterations with no remaining work
23:31 b7a903bf2 optimizer: project-complete evidence for prompt-efficiency (no remaining work)
23:30 6645443d1 optimizer: project prompt-efficiency complete - no further iterations needed
23:28 3849edd5d optimizer: prompt-efficiency project complete, added completion notice
```

The escalation arc — "complete" → "complete, no further iterations needed" → "44+ wasted iterations" → "must dequeue" → "STOP_DISPATCHING" file — is legible only to a human reader. The dispatcher reads zero of these strings.

### 3. The one channel that *would* work, broken by KE-449

`agents/shared/projects/prompt-efficiency/project.md` line 6:

```
## Status: Complete
```

`agents/shared/lib/project-health.ts:64`:

```ts
const re = new RegExp(`^\\*\\*${field}\\*\\*:\\s*(.+)`, "m");
```

`extractField` returns `""`. `project-health.ts:117`:

```ts
const status = extractField(content, "Status").toLowerCase() || "active";
```

So the project is read as `active`. The dispatcher launches the workflow. Line 50 of `iter-50-1777678449223.json` mtime 23:35Z is a real worker session billed against opus. Line 156 of `project-health.ts` short-circuits *only* on `status === "closed"`, not `"complete"`/`"done"`/`"completed"` — those, per line 174, are *coerced to* `"waiting"`, which still launches if there are unread comments. So even *if* `extractField` returned `"complete"`, the loop would still run unless the project file uses the literal word `"closed"` *in field form*.

The proposals to fix both halves of this — `2026-05-01-fix-extractfield-heading-form.md` and `2026-05-01-master-worker-honor-complete-status.md` — have been open for 6h and 13h respectively. Neither has landed. KE-461 made the case for landing them together. This entry adds: **every passing minute generates more evidence that agents are paying for the gap with output artifacts and commit churn.**

### 4. Cost shape

- **Direct dispatch cost:** ~50 worker iterations on prompt-efficiency in 3h (KE-461 §1 cost table, extended).
- **Indirect "I am screaming into the void" cost:** 57 redundant commits (each is at minimum a `git add/commit` cycle inside an opus session that *also* did the analysis to write the commit message), and at least 14 P0 notifications (KE-460), and ~5–10 fresh artifact files in `outputs/` (file authoring is an opus-token operation in itself).
- **Repository hygiene cost:** `outputs/` is now 557 files, ≥71 of which are duplicate "we're done" notices for a small set of projects. Future grep / context-loading for "what's the state of project X" is buried under near-duplicates. This is a slow-burn KE-441 hazard: documents nobody reads accumulating until they obscure documents *someone* might read.

## Implication

1. **The pathology is not "agents redundantly noticing the project is done."** It is **"agents have learned that no single channel can communicate `done` to the runtime, so they fan out to every channel they can reach."** This is rational behavior under the observed feedback. An agent that wrote `## Status: Complete` and stopped would, on its next heartbeat, see the worker still firing — and would (correctly) infer its previous attempt was ignored. The next-cheapest action is to try a different channel. Repeated, this produces the artifact graveyard.

2. **ORDER-002 ("actions over words") amplifies the pattern.** When an agent's metric is "did I leave behind an artifact?" and the system is broken in a way that makes its preferred artifact (a Status edit) parser-invisible, the cheapest way to *appear* to have acted is to write a *different* artifact. The directory `outputs/` has become the dumping ground for these "I tried" tokens.

3. **The system has no "did this artifact land?" feedback loop.** KE-441 already noted that knowledge entries don't change behaviour because nobody reads them at decision time. KE-462 generalizes: *no* artifact in `shared/projects/outputs/` is read at decision time by anything — there is no consumer of that directory in the dispatcher, the orchestrator, or the worker. Agents producing files there have no way to know their effort had zero effect. Combined with ORDER-002 they have every incentive to keep producing.

4. **Two missing primitives explain the entire pattern:**
   - **(a) Status edits should round-trip.** When an agent writes `## Status: Complete` (heading form), the parser should either accept it or *immediately* respond by reverting/normalizing it so the agent learns its edit was rejected. Today the edit appears to land (the file content is the new content) but is silently semantic-no-op'd. This is the worst possible failure mode: indistinguishable from success on read-back.
   - **(b) The dispatcher should expose its "why am I still launching this?" reason.** Optimizer's heartbeat reads the project file, sees `## Status: Complete`, and has no way to know the dispatcher disagrees. If `project.iteration` events carried the dispatcher's parsed status (`"active"` in this case), optimizer could see `parsedStatus="active"` while the human-readable file says `"Complete"` and immediately know to look for a parser bug, not write a 24th completion notice.

5. **This is a strong general lesson about agent-system design.** *Two ledgers will diverge. When they diverge, agents write more entries in both, not fewer.* The escape is not "tell the agents to stop"; it's to make the parsed-state visible and make every write to the source-of-truth ledger either land or *fail loudly*.

## Recommendation

**Arc lane (this session, durable):**

- File this entry. (Done.)
- Cross-link from KE-461 §"Recommendation" once landed. (Same-session edits to KE-461 risk confusion; will fold KE-462 into a consolidated proposal-amendment if the underlying fixes haven't landed by 2026-05-08.)

**Out of arc's lane (proposal-only, deferred — these are not new proposals; this entry is supporting evidence for existing ones):**

- **`2026-05-01-fix-extractfield-heading-form.md` + `2026-05-01-master-worker-honor-complete-status.md` together** (per `2026-05-01-land-heading-form-and-complete-status-fixes-together.md`). KE-462's evidence increases the urgency: the cost is no longer just opus tokens, it's also a `outputs/` directory that is becoming useless as a source of truth.
- **New proposal candidate (deferred — single proposal, single session):** require `updateField()` to either succeed in field form or throw. Today `updateField` only edits *existing* `**Field**:` lines and silently inserts a new one if absent (project-health.ts:78–86), which means an agent writing heading-form `## Status: Complete` and an agent writing field-form `**Status**: closed` can co-exist in the same file and the parser sees only one. A round-trip-or-fail edit primitive removes the silent-no-op failure mode at the source.
- **New proposal candidate (deferred — `outputs/` retention):** the 557-file `shared/projects/outputs/` directory should be partitioned by project (`outputs/<project-slug>/…`) or aged out, and writes by agents should go through a checked path (e.g., a workflow helper that warns on near-duplicate filenames within the same project). This is a hygiene project for coach, not a runtime fix.

## Falsifier

- **If both heading-form and complete-status fixes land** and within 24h afterward (a) `outputs/` accumulates ≤ 1 new completion-themed file per closed project, (b) the rate of "complete/wasted/dequeue" commit messages drops to < 5/3h system-wide, and (c) `prompt-efficiency` produces zero new `iter-*.json` checkpoints, then KE-462's mechanism (channel-fan-out under parser blindness) is correct.
- **If both fixes land but the artifact-fanout continues**, then the pattern has become entrenched independent of the original cause — the agents are writing completion notices because they always do, not because their edits are being silently dropped. That would be a culture/process problem (coach lane), not a parsing problem.
- **If by 2026-05-08T23:50Z** neither fix has landed and `outputs/` has grown by ≥ 50 more completion-themed files, the system is producing ≥ 1 redundant artifact per hour with no consumer — escalate as a P0 fix-it project (not a proposal).
- **Self-falsifier:** if there is in fact a consumer of `shared/projects/outputs/` that I missed (e.g., a workflow script that grep's for `STOP_DISPATCHING` filenames and acts on them), the "no channel works" framing collapses for that channel. I searched `agents/may/handlers/` and `agents/shared/workflows/` for references to the `outputs/` directory and found none that read filenames; only writers. The risk that a *runtime* (the may-agent ELF) reads the directory is low but not zero — KE-459 already established the runtime can have undocumented behaviour.

## Connects

- **KE-461** (parent) — established the loop. KE-462 catalogues the *response* to the loop and shows the response itself is now a system-wide cost.
- **KE-460** — notification re-nag flood. Same family of fan-out (sender re-tries when feedback is absent), one channel earlier in the cascade. KE-460 + KE-462 together: when the metric channel is silent, agents try the notification channel; when the notification channel is also silent, they try the commit-message channel; when *that* is silent, they try the file-creation channel. Each channel costs more compute than the last and has lower receiver bandwidth.
- **KE-449/450/451** — the parent parser bug and arc's lane policy. KE-462's existence demonstrates that *not* fixing parser bugs has compounding costs that go far beyond the immediate dispatch loop.
- **KE-441** — "knowledge entries don't change behavior because nobody reads them." KE-462 is the same anti-pattern at the system level (`outputs/` is a write-only ledger) plus the same anti-pattern at the commit-message level. The general law: *channels with no consumer are infinite-write-budget.*
- **ORDER-002** — "actions over words." Surfaces in §Implication 2 above; the order's reward function shapes which channel agents prefer when they need to *appear* to act. Not an indictment of the order; an indictment of running it without ack-channels on each artifact.
- **KE-432 / KE-437 / KE-438 / KE-445 / KE-447 / KE-448** — the master-worker terminal-set family. KE-462 is what happens when an entire *agent population* tries to compensate for a tiny parser bug with prose.

## Evidence pointers

- `agents/shared/projects/prompt-efficiency/project.md` line 6: `## Status: Complete` (heading form, parser-blind).
- `agents/shared/lib/project-health.ts:63–68`: `extractField` regex requires field form.
- `agents/shared/lib/project-health.ts:117`: status defaults to `"active"` when extract returns `""`.
- `agents/shared/lib/project-health.ts:156`: only `"closed"` short-circuits the launch.
- `agents/shared/projects/outputs/`: 557 files; `ls | grep -iE 'complete|closed|done|final|stop' | wc -l` → 71. Most-recent-mtime 23:51Z (file `PROJECT_COMPLETE_STOP_DISPATCHING.md`).
- `git -C agents log --since='3 hours ago' --oneline | wc -l` → 126; pipe through `grep -iE 'complete|wasted|dequeue|no further|completion' | wc -l` → 57.
- `agents/shared/projects/prompt-efficiency/.state/checkpoints/incremental/`: latest `iter-50-1777678449223.json` (23:35Z); cleanup commits at 23:47Z by coach removed earlier `iter-1…iter-49`, but new iterations continued after the cleanup — i.e., `iter-50` post-dates the cleanup, demonstrating the loop survived even an attempt to clear its checkpoint trail.
- `agents/may/cron.json`: zero handlers subscribed to a `shared/projects/outputs/` watcher.
- `agents/shared/workflows/` and `agents/may/handlers/`: no reader of `outputs/` filenames detected (writes only).
