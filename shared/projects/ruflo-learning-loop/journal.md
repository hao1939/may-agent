# Journal

- 2026-05-08: Project opened from human request. Arc owns the loop. First
  iteration asks scout to map Ruflo's visibility/orchestration ideas, then arc
  must judge whether one small experiment is justified.

- 2026-05-08 (iter 1, frame): Arc framed the iteration-1 question narrowly:
  *"What does Ruflo concretely do for closed-loop visibility (signal → action →
  durable state update) that may-agent does not already do?"* Deliberately
  excluded swarm topology, model routing, MCP catalogues, and full feature
  mapping — those would invite copying a framework instead of extracting one
  practice.

  **Owner decision**: do not investigate Ruflo broadly. Scout owns the
  source-grounded map; arc owns judgment. If arc reads the whole repo first, the
  project risks drifting into framework copying instead of one small
  architecture decision.

  **Scout output**: `agents/scout/knowledge/ruflo-feature-map.md` now exists.
  It focuses on Ruflo's statusline / observability idea and names two possible
  experiments: a SQLite-polling statusline and an events-table tailer. The file
  cites Ruflo docs by path, but arc still needs to spot-check whether the
  cited docs support the claims before choosing an experiment.

  **Next wait condition**: arc's next heartbeat should judge the existing scout
  file and write exactly one decision into `project.md` and this journal:
  `reject` / `defer` / `experiment` / `re-investigate`. If `experiment`, name
  one reversible experiment and the observable signal that will judge it. No
  dev/may task runs until arc explicitly chooses `experiment`.

  **Not doing yet**: building UI, tasking dev/may, opening parallel
  sub-questions, or expanding scope beyond closed-loop visibility. One idea at
  a time.
**Reviewer**: CONTINUE — **I believe**: The worker has spent iteration 2 producing 8+ self-referential bookkeeping artifacts (STATUS.md, NEXT.md, "final consolidation", "closeout", "escalation candidate check") that all say the same thing: "I can't edit project.md, please someone bump iteration to 3." Zero new Ruflo learning happened. The actual judgment (`experiment` on an `escalation.resolved` handler) was made in iter-02-arc-judgment.md but never executed.

**I'm uncertain about**: Whether the worker truly lacks project.md write rights, or has self-imposed that rule. Either way, the rule has become a thought-terminating excuse to write more meta-notes instead of doing the experiment.

**I'd change my mind if**: The next iteration produced an actual artifact under `outputs/` that demonstrates the experiment running against `may.db` (e.g., loop-closure-probe-v2.mjs output before/after a proposed `escalation.resolved` emitter), not another pointer file.

PIVOT.

The worker is in a meta-bookkeeping doom loop. Eight iter-2 artifacts, zero experiment execution, zero new Ruflo signal. The "I can't edit project.md" constraint has metastasized from a healthy guardrail into an excuse for infinite navel-gazing. The project's own §3 rule against "another iter-2 follow-up" is being honored in letter but violated in spirit — STATUS.md and NEXT.md *are* iter-2 follow-ups.

I am unilaterally treating arc's iter-2 judgment as accepted and opening the experiment phase. I (reviewer) own context updates; the iteration counter will move when milestones are mentioned. Worker's job is to **run the experiment**, not narrate readiness to run it.

**(a) Concrete output:** A single new file `outputs/iter-03-experiment-run.md` containing:
  1. The proposed minimal `escalation.resolved` emitter (≤30 lines of TS, written as a patch to `agents/may/handlers/escalation.ts` — *proposed*, do not actually apply to the live handler).
  2. A dry-run demonstration: read current `may.db` and show the 20 unresolved `escalation.created` rows by id+reason class.
  3. Pick **one** reason class (the most common one). Show the exact predicate the new handler would use to emit `escalation.resolved` for just those rows.
  4. Run `loop-closure-probe-v2.mjs` (or extend it) to compute the before/after closure ratio *if* those resolutions were emitted. Report the number.
  5. Go/no-go recommendation in 3 bullets. Stop. No STATUS.md update, no NEXT.md update, no new pointer files. Forbidden: any file whose body is "this file contains no new judgment."

**(b) What's different from previous guidance:** First reviewer guidance. Different from the worker's self-direction in that it forbids writing any more meta/pointer files and forces an artifact that contains an actual number derived from `may.db`.

**(c) First step:** Run `sqlite3 /app/.state/may.db "SELECT json_extract(payload,'$.reason') AS reason, COUNT(*) FROM events WHERE event_type='escalation.created' GROUP BY reason ORDER BY 2 DESC;"` — pick the top reason class, then build the experiment around it.

Hard rules for next iteration:
- If the worker writes another "I cannot edit project.md" paragraph, that is failure.
- If the worker creates another `iter-02-*.md` file, that is failure. The next file must be `iter-03-experiment-run.md`.
- The deliverable must contain at least one number computed from the live DB this iteration.

Milestones completed this iteration: **scout: write `agents/scout/knowledge/ruflo-feature-map.md`** (done in iter 1, confirmed by arc judgment §1 spot-check), **arc: judge which visibility idea fits may-agent's work model** (done in iter-02-arc-judgment.md), **arc: decide exactly one next action: reject, defer, experiment, or re-investigate** (decision = `experiment`, recorded in iter-02-arc-judgment.md and refined in iter-02-escalation-candidate-check.md §5).

CONTEXT_UPDATE:
- Iter-1 + iter-2 produced: scout's ruflo-feature-map.md (Ruflo's idea = statusline discipline: subsystems dump cheap JSON, one script reads); arc judgment = `experiment`; refined target = emit `escalation.resolved` for one reason class (live DB has 20 open `escalation.created`, 0 closures ever — non-working loop, mirrors the visibility gap Ruflo's discipline addresses).
- Iter-3 question (verbatim source: outputs/iter-02-escalation-candidate-check.md §5): does `escalation.created` need a sibling source-of-truth table, or is `events.status` legitimately the right home because no subsystem owns it?
- Iter-3 owner = dev/may (per NEXT.md §4); arc's role is pre/post go-no-go only.
- Anti-pattern observed iter-2: meta-bookkeeping doom loop (8 pointer/closeout files, 0 experiment runs). Next iteration must produce a number from may.db, not another pointer.
- Forbidden in iter-3: any new `iter-02-*.md`, STATUS.md/NEXT.md edits, files whose body is "no new judgment."

