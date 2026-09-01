# Running Scout work through Herdr Supervisor

Scout's May-agent app and Herdr Supervisor solve different parts of the
operation. The app currently owns schedules, event routing, workflow handlers,
task reconciliation, Conditions, delivery, and runtime packets. Herdr owns the
worker process and pane. The Supervisor adds a portable outcome contract,
evidence-based review, recovery of the same Codex session, and human escalation.

Do not import `.state/tasks/state.json` as a second Herdr task graph. Migrate a
bounded outcome, not the app's scheduler tick, attempt history, or generated
task projection.

## Current application map

The exact source and runtime authorities are:

| Concern                                               | Current authority                                                                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| App declaration, schedules, actions, and task routing | `projects/scout-knowledge-lib.app/app.ts`                                                                                                            |
| App identity and broad product goal                   | `projects/scout-knowledge-lib.app/project.json`                                                                                                      |
| Scout operating and layout rules                      | `projects/scout-knowledge-lib.app/design/scout-knowledge-library-process.md` and `design/scout-knowledge-library-layout.md`                          |
| Initial structural groups                             | `projects/scout-knowledge-lib.app/tasks/seed.json`                                                                                                   |
| Task-resource explanation                             | `projects/scout-knowledge-lib.app/tasks/README.md`                                                                                                   |
| Mutable May-agent task authority                      | `projects/scout-knowledge-lib.app/.state/tasks/state.json`                                                                                           |
| Generated task projection; never mutation input       | `projects/scout-knowledge-lib.app/.state/tasks/tree.json`                                                                                            |
| Exact external Conditions and reverse routes          | `projects/scout-knowledge-lib.app/.state/tasks/state.json` and `.state/tasks/condition-routes.json`                                                  |
| Active worker identity and output rules               | `projects/scout-knowledge-lib.app/agents/scout/agent.json`, `AGENTS.md`, and `context.md`                                                            |
| Research, digest, planning, and health handlers       | `projects/scout-knowledge-lib.app/agents/scout/workflows/scout-explore.ts`, `scout-daily-digest.ts`, `knowledge-planner.ts`, and `library-health.ts` |
| XHS credential observation                            | `projects/scout-knowledge-lib.app/watchers/xhs-credential.ts` and `agents/scout/tools/xhs-credential.ts`                                             |
| Durable product data                                  | `projects/scout-knowledge-lib/knowledge/` and `projects/scout-knowledge-lib/reports/`                                                                |

`app.ts` currently declares one Scout owner, a concurrency limit of one, seven
schedules (including the daily owner review), and these seven stable `maintain`
responsibilities:

- `explore-arxiv`, `explore-hn`, `explore-xhs`, and `explore-github` use
  `scout-explore`;
- `daily-digest` uses `scout-daily-digest`;
- `runtime/library-health-observer` uses `library-health`; and
- `library-maintenance` uses `knowledge-planner`.

The current runtime projection may be paused or contain old evidence. Read
`.state/tasks/state.json` for current May-agent state, but do not copy that
state, its attempts, or its phases into a Herdr contract.

## Migration classification

| Existing responsibility                                                                      | Herdr classification                                                         | Contract boundary and proof                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One current structural health assessment                                                     | Migrate now; safest pilot                                                    | Finite, read-only goal. Run the focused tests and `scripts/library-health-readonly.ts`; report facts and prove no state or domain writes.                                                                                             |
| One explicit index repair, deduplication, rollup, or layout repair                           | Good migration candidate                                                     | One bounded library outcome. Proof is the reviewed diff, link/reference checks, focused validation, and an evidence-backed no-op when no safe edit is justified.                                                                      |
| One arXiv, HN, or GitHub exploration                                                         | Migrate conditionally                                                        | Make the goal one current source check, not permanent exploration. Proof includes the real query/feed, check time, stable item IDs or URLs, deduplication search, exact outputs, or a grounded no-op. Network availability is a risk. |
| One XHS exploration                                                                          | Migrate only when the credential Condition is ready                          | Preserve `credential.state / credential:xhs / state=ready` as an exact wait. Never simulate XHS or substitute another source. Credential scope and browser placement are risks.                                                       |
| One digest delivery                                                                          | Migrate only with an explicit recipient and delivery authority               | Proof requires the archive path and delivery receipt, or verified empty input. A local file alone does not prove delivery. External side effects make this unsuitable for the first pilot.                                            |
| Standing owner review or ongoing source cadence                                              | Keep in May-agent unless the human explicitly wants an indefinite Herdr loop | A schedule tick has no durable finish line. If migrated, write a standing learn-and-improve objective that is never auto-accepted after one run.                                                                                      |
| `project`, `ongoing-research`, and `library-operations` groups                               | Do not migrate                                                               | They organize the May task projection and are not executable outcomes.                                                                                                                                                                |
| May attempts, receipts, event IDs, metric samples, task phases, and `.state/tasks/tree.json` | Do not migrate                                                               | They are runtime evidence or projections, not user objectives. Herdr keeps its own execution checkpoint and audit.                                                                                                                    |
| XHS credential acquisition by itself                                                         | Usually do not make it a Scout goal                                          | It is an external fact needed by `explore-xhs`, not research work. Create a separate goal only when credential setup is itself the human-requested outcome and authority is explicit.                                                 |

Dependencies belong in contract prose and acceptance evidence, not a shadow
task graph. For example, an XHS source goal waits on the exact credential fact;
a code change may require its focused tests before review; a pull request or
pipeline is one evidence stream inside the same goal, not the goal itself.

## Herdr mapping

For each migrated outcome:

1. Put the portable objective, context, acceptance criteria, and constraints in
   `goal.json`. A native Codex Goal is thread-scoped and should have a measurable
   outcome, verification surface, and constraints; see the
   [official Codex Goals guide](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex).
2. Start the worker from `/app` only as a discovery root. The contract must
   require an isolated, goal-owned worktree before any test, generator,
   formatter, installer, or edit. Scout's tracked absolute `/app/...` paths
   describe the deployed workspace; they do not grant permission to edit the
   dirty starting checkout.
3. Keep one worker per goal. The current Supervisor does not implement reviewer
   pairs or a worker dependency tree. A worker may own several worktrees when a
   baseline or destructive test needs isolation.
4. Let Codex perform the normal work-check-continue loop. The Supervisor reviews
   on meaningful Herdr events or its bounded review deadline and chooses leave,
   steer, ask the human, or accept.
5. Accept only when evidence covers the whole contract. A final message,
   passing command, pull request, or pipeline is evidence, not automatic
   completion.

Evidence should match the outcome:

- code: exact final diff, relevant tests, formatting/type checks, and resolved
  review findings at the candidate revision;
- content: source IDs or URLs, search-before-create evidence, exact changed
  paths, and a read-back of every changed file;
- no-op: the current source or library observation and the reason no useful,
  non-duplicate change is justified;
- delivery: the archived artifact plus a receipt from the intended channel;
- wait: the failed operation, execution location, effective identity or
  authority, target, observed error, exact changing condition, and the smallest
  action that can satisfy it.

## Safe first pilot

The portable contract is
`herdr/goals/library-health-pilot.goal.json`. It maps the finite form of
`runtime/library-health-observer` into a read-only supervised assessment. It
does not run the hosted workflow because that workflow intentionally appends a
packet and emits an event.

Ask the Supervisor to start that contract from `/app`. In the standard
container flow:

```sh
git clone https://github.com/hao1939/herdr-supervisor.git
cd herdr-supervisor
HERDR_WORKSPACE=/path/to/monorepo docker compose up -d --build
docker compose exec herdr herdr
```

Open a Herdr pane, run `pi`, and ask it to start the goal defined by
`/app/projects/scout-knowledge-lib.app/herdr/goals/library-health-pilot.goal.json`
with `/app` as the starting directory. Use `/supervised` to inspect the durable
binding. `ANTHROPIC_API_KEY` is needed by Pi and `OPENAI_API_KEY` by Codex in the
container; keep both outside the repository. `GITHUB_TOKEN` and
`AZURE_DEVOPS_EXT_PAT` are needed only for their corresponding external watches.

The worker should create an isolated worktree, then run:

```sh
cd /app/worktrees/<goal-owned-worktree>/projects/scout-knowledge-lib.app
bun test agents/scout/workflows/library-health.test.ts scripts/library-health-readonly.test.ts
bun scripts/library-health-readonly.ts \
  --app-dir "$PWD" \
  --project-dir "$PWD/../scout-knowledge-lib"
```

It should compare `git status --short` and the presence of `.state/` before and
after the command. Reported facts may justify a later finite repair goal; they
do not authorize an edit in this pilot.

## Normal operation and recovery

- Use one finite goal for one reviewable change or current source check. Copy
  only the portable `goal.json` to run it afresh elsewhere; do not copy Herdr's
  local checkpoint or audit as new execution state.
- Refine an active outcome through the Supervisor so it atomically updates the
  canonical contract and tells the same worker to reread it. Do not send a
  durable requirement only as transient steering.
- Reattach to a container with `docker compose exec herdr herdr`, then run
  `/supervised`. Herdr restores panes; the Supervisor resumes the exact saved
  Codex session and native Goal rather than starting a replacement worker.
- Preserve the Compose project/volume namespace, workspace mount, credentials,
  and model access when replacing the container. Authentication on another
  host or container does not refresh this one.
- For GitHub pull requests and Azure DevOps builds, record the exact external
  resource. A changed revision wakes review; unchanged reads stay quiet. For
  other waits, record the condition and a bounded reconsideration time. The
  worker must not sleep or poll.
- If a pane occupant or native session identity no longer matches, recovery
  fails closed. Report the exact identity boundary and seek human action only
  after exact-session recovery and safe alternatives are exhausted.
- Stop supervision only by explicit operator choice. Accept only after the
  Supervisor independently checks every criterion against current evidence.

Herdr Supervisor's container and local setup are maintained in
`projects/herdr-supervisor/README.md`. Its durable contract/checkpoint/audit
boundary is described in `projects/herdr-supervisor/docs/design.md`.
