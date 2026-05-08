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
