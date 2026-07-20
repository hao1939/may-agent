# Scout Design Integrity and Cleanup

**Status:** Draft for review

**Reviewed:** 2026-07-20

**Scope:** Scout app design, agent instructions, task/workflow behavior, library
layout, and alignment with May's accepted Agent App and Task Resource Engine
contracts

## Verdict

The core architecture is aligned with May:

```text
Scout agent                        independently runnable judgment
Scout-owned workflows              reusable source and maintenance processes
scout-knowledge-lib.app            optional autonomous attachment
one generic task controller        task mechanics and recovery
stable maintain tasks              recurring responsibilities
finite achieve tasks               independently closable improvements
Conditions and watchers            external facts such as XHS credentials
```

No new controller, agent, task type, mode, registry, database table, history
store, or adapter framework is needed.

The design is not yet fully clear or internally integral. The main problems are
authority drift and stale surfaces around the correct architecture:

1. the documented target layout contradicts both Scout's current instructions
   and the real library shape;
2. automatic `workflow-blocked` owner events are turned into a second
   maintenance task, creating a failed recovery loop beside May's existing task
   attention state;
3. Scout's direct context still requires missing legacy resources and direct
   database context despite the intended agent/infra boundary;
4. the daily digest can treat a header-only file as content and can overwrite a
   same-day archive on retry;
5. implemented proposals still read as active implementation plans and contain
   gates that the code does not enforce; and
6. the active app package contains large undocumented supporting-agent trees
   that are not used by the Scout app.

The right closeout is a cleanup, not another architecture.

## Evidence

### May alignment

The current app follows May's accepted contracts in the important places:

- `app.ts` owns event correlation, schedules, actions, and deterministic
  observation;
- all task workflows live under `agents/scout/workflows/`;
- `tasks.resolve` is pure and returns stable task intent;
- `.state/tasks/state.json` is canonical and `tree.json` is a read projection;
- named workflow failure remains `attention`; the task controller does not
  guess from task prose;
- XHS uses an exact credential Condition and an external watcher; and
- history is prepared by the workflow before `runAgent`, rather than fetched by
  the generation loop.

The primary Scout design should link the current May documents directly:

- `docs/2a-design/agent-app.md`;
- `docs/2a-design/task-resource-engine.md`; and
- `docs/2a-design/workflows.md`.

Its current link to
`docs/3-proposals/task-reconciliation-integrity-refinement.md` is broken; that
document now exists only as an archived decision.

### Layout contradiction

`scout-knowledge-library-layout.md` proposes:

```text
knowledge/topics/<topic>/...
knowledge/findings/YYYY/MM/<source>/...
```

The current contract and library use:

```text
knowledge/*.md
knowledge/findings/YYYY-MM-DD-<topic>.md
```

At review time the domain workspace contains:

- 121 top-level knowledge Markdown files;
- 735 flat finding files;
- 9 nested finding files;
- no `knowledge/topics/` tree; and
- 45 reports already placed in report subdirectories.

Scout's `AGENTS.md` explicitly instructs flat dated findings. `library-health`
measures oversized top-level canonical notes and does not enforce the proposed
topic/month/source taxonomy. The target layout is therefore not a gradual
implementation plan; it is a competing design.

### Runtime recovery loop

At the reviewed live snapshot:

- `explore-github` was in `attention` after
  `Scout exploration returned invalid current-source evidence`; and
- `library-maintenance` was also in `attention` after trying an `unblock-task`
  action that the task engine correctly rejected because the source task was in
  `attention`, not blocked on a Condition.

The sequence is:

```text
scout-explore blocks
  -> May records explore-github attention
  -> workflow tool emits project.owner.requested(reason=workflow-blocked)
  -> Scout app maps every project.owner.requested to library-maintenance
  -> planner tries to repair task mechanics
  -> action admission rejects the invalid repair
  -> library-maintenance also enters attention
```

May already made the original failure visible. The second task adds no recovery
authority and obscures the original problem.

### Agent-context drift

The active Scout instructions contain several stale or conflicting rules:

- `AGENTS.md` says `gemini-3.1-pro`; `agent.json` selects `opus`;
- exploration is described as hourly although source intervals differ;
- `context.md` requires a shared-output manifest that does not exist;
- it says `Source:` is required for the retired sourced-artifacts metric;
- it instructs Scout to query infrastructure metrics through `query_db`;
- it tells a source-specific run to use other sources when its assigned source
  is unavailable, weakening lane identity; and
- migration labels such as “Scout Second Brain,” “V3 project,” and “old
  heartbeat-owned library” remain in current prompts.

The verification-evidence and read-after-write rules are still current May
runtime rules. Keep those rules, but remove their obsolete migration labels.

### Proposal and status drift

The two refinement documents contain valuable rationale, but they are no
longer clean current specifications:

- the experience document says “implementation in progress” although its
  packet and daily schedule exist;
- both documents retain future-tense implementation plans;
- the runtime refinement says the initial review must wait seven clean days,
  while the enabled planner currently permits one improvement task whenever a
  complete packet is available; and
- the main design says “implemented baseline” without distinguishing source
  implementation, loaded runtime revision, and healthy live observation.

The live task projection also still showed old task acceptance text at review
time, demonstrating why code status and live-runtime status must be separate.

### Unused app-local agents

The app package contains:

- active `amy`: 1,173 tracked files, about 9 MB; and
- disabled `amy-kimi`: 43 tracked files.

Neither is referenced by `app.ts`, Scout workflows, tasks, or the current
design. May legitimately supports app-local supporting agents, but an active
supporting agent needs an explicit role. Historical knowledge must not be
deleted merely to make the directory smaller, so this requires a separate
usage and preservation decision.

## Decisions

### 1. Use one current design authority

Make `scout-knowledge-library-process.md` the single normative Scout runtime
design.

Keep `scout-knowledge-library-layout.md` only after reducing it to the layout
that Scout actually uses. Once the experience and runtime-refinement proposals
are verified in live operation, mark them implemented historical rationale and
move them out of the active design path according to the repository's normal
documentation policy.

Retire `discussion.md` as a current surface. It is a dated operational log with
obsolete project status, old digest paths, and already-resolved audit findings.
Preserve any unique evidence in a dated report before removal.

Use explicit status fields:

```text
design status:       accepted / draft
source status:       implemented and tested
runtime status:      loaded / not verified
live health:         healthy / attention with named tasks
```

Do not use “implemented” as a synonym for all four.

### 2. Adopt the current minimal library layout

Use the existing readable shape as the contract:

```text
knowledge/
  README.md
  INDEX.md
  <canonical-or-companion-topic>.md
  findings/
    YYYY-MM-DD-<topic>.md
  inbox/                       # existing imported material only
  insights/                    # existing specialized companions

reports/
  health/
  migration/
  merge/
  triage/
  operations/
```

Do not bulk-move canonical notes into `topics/` or 735 findings into a
year/month/source taxonomy. Those moves create reference work without improving
source grounding or retrieval.

Keep only placement rules that have current value:

- search before creating;
- update a canonical note when one exists;
- otherwise write one flat dated finding;
- keep maintenance decisions in a report category; and
- prevent nested project roots and root-level report backlog.

Align `AGENTS.md`, `knowledge/README.md`, `library-health`, and the layout
document to this one shape.

### 3. Keep runtime failures in their original task

Do not turn infrastructure-generated `workflow-blocked` or task-recovery owner
events into `library-maintenance` work.

Allow `library-maintenance` only for intentional domain review reasons, such as:

- daily `experience-review`;
- `library-health-signal`;
- manual library review and repair-index actions;
- translated project comments; and
- an explicit human owner request.

Remove the generic `project.tick` translation unless a known Scout producer and
non-duplicated purpose are documented. The daily owner-review schedule already
owns periodic review.

Workflow failure remains visible on the source task. A later source event,
targeted wake after a fix, or repaired workflow reload retries that task through
the generic controller. The planner must not manipulate task phases or simulate
recovery with `unblock-task`.

This preserves May's simple rule: the failed resource tells the truth about its
own execution.

### 4. Restore the intended agent/infra boundary

Keep Scout independently useful with source tools and filesystem context. The
agent itself should not require task, event, metric, or database context APIs.

For Scout:

- remove `query_db` from the default agent tool list;
- remove direct metric/database instructions from `AGENTS.md` and `context.md`;
- let app workflows prepare bounded task, metric, alert, or reconciliation
  context before `runAgent` when a hosted workflow needs it;
- remove the missing shared-manifest startup command;
- keep source-access instructions, source-grounding rules, verification
  evidence, date sanity, and read-after-write rules; and
- define the model only in `agent.json`, not duplicated in Markdown.

For a source-specific run, failure to access that source must not be replaced by
research from another source. Record the exact failure or supported no-op for
the assigned lane.

### 5. Remove the dormant heartbeat surface

The disabled `scout-heartbeat` schedule, `scout.heartbeat` resolver branch,
`cross-source-synthesis` standing identity, workflow, and heartbeat Markdown
form a dormant second operating model. There is no current action that wakes
it, and the runtime refinement names seven standing responsibilities without
it.

Remove this surface for now. Cross-source synthesis remains Scout judgment and
can happen through an intentional owner review or a finite task. Add a reusable
synthesis workflow again only after a real repeated trigger and result contract
are demonstrated.

This is simpler than keeping a disabled 30-minute legacy schedule as
documentation of a possibility.

### 6. State source evidence honestly

Keep the current three mechanical claims separate:

1. XHS source acquisition is workflow-observed.
2. arXiv, HN, and GitHub source observations are structured but agent-reported.
3. output admission proves that a reported file exists and resolves inside an
   allowed root.

Output admission does not prove that a pre-existing file changed in that run,
and the workflow does not deterministically verify semantic source grounding.
Those are Scout/workflow-contract judgments under May's acceptance model.

Do not add an artifact ledger or broad filesystem snapshot to claim more. Add a
small deterministic source fetch only when repeated failures show that stronger
provenance is worth its source-specific code.

Make invalid-source failures diagnostic without exposing secrets. Evidence
should name the invalid field (`name`, `checkedAt`, `queryOrFeed`, or item list)
instead of only saying `invalid current-source evidence`.

### 7. Make experience-review policy enforceable or advisory

Remove the unenforced “wait seven clean days” gate and the stale
“implementation in progress” status. Readiness already provides the useful
deterministic safety boundary: incomplete history is not learning evidence.

Keep schedule tuning and workflow changes as Scout judgment. Enforce only the
mechanical part that code can know: an experience review may create at most one
new finite task. Do not add semantic clustering or a learning registry.

### 8. Make daily digest retry-safe enough

Add focused digest tests and fix two deterministic errors:

- a file containing only the generated heading is an empty accumulator; and
- a retry on the same date must never overwrite an existing archive.

Document delivery as at-least-once unless the event system supplies an explicit
idempotency key. Do not invent a second delivery database. A unique archive
name or explicit same-day no-overwrite rule is sufficient for file integrity.

### 9. Keep durable pages free of volatile runtime status

`knowledge/README.md` currently names live task IDs, mutable backlog counts, and
an XHS credential pause that no longer matches the task tree. Keep the landing
page durable: purpose, navigation, authoring rules, and stable cleanup policy.

Put current task/credential state in the task projection, UI, or a dated report.
Remove the obsolete `future_dated_tree_json_accepted` explanation and volatile
inventory counts from the large `INDEX.md` preamble now that the observer no
longer scans task history.

### 10. Decide the supporting-agent boundary separately

Do not delete or bulk-move Amy's historical material as part of this cleanup.
First inspect actual recent use and unique knowledge.

Then choose one explicit outcome:

- document Amy as a supporting XHS agent and invoke it from an owned workflow;
- package Amy as its own app/capability if it is independently useful; or
- disable the active agent and preserve unique knowledge outside active agent
  preparation.

Keeping an undocumented active agent with 1,173 files is not the simple middle
ground.

## Implementation order

### Phase 1 — Restore truthful execution

1. Filter infrastructure-generated workflow failure/recovery owner requests out
   of `library-maintenance`.
2. Add field-specific source-result rejection evidence and verify the GitHub
   lane can converge or fail clearly.
3. Fix and test header-only and same-day digest behavior.
4. Reload the app, wake the affected tasks once, and confirm neither failure
   creates a second maintenance failure.

### Phase 2 — Establish one clear contract

1. Fix the main design's May links and status vocabulary.
2. Replace the aspirational taxonomy with the current minimal layout.
3. Align `AGENTS.md`, `context.md`, the planner prompt, task README, and durable
   library landing pages.
4. Mark implemented proposals as historical rationale instead of active plans.
5. retire `discussion.md` after preserving any unique evidence.

### Phase 3 — Remove dormant complexity

1. Remove the disabled heartbeat schedule, resolver branch, workflow, and
   heartbeat instructions.
2. Remove the redundant direct database-context dependency from Scout.
3. Retire or rename `scout.knowledge-practice-loaded`; it currently checks for
   strings in an instruction file, not whether Scout actually loaded or ran.
   Existing agent-config health already detects invalid agent configuration.

### Phase 4 — Make the supporting-agent decision

Review Amy and Amy-Kimi usage and preservation separately. This phase is not a
prerequisite for fixing Scout runtime integrity.

## Acceptance criteria

The cleanup is complete when:

1. the main Scout design links current May authorities and has separate source,
   runtime, and live-health status;
2. one layout convention is shared by the design, agent instructions, current
   library, planner, and observer;
3. a source workflow failure leaves only the source task in `attention` and
   does not automatically fail `library-maintenance`;
4. direct Scout research does not require DB, metrics, task, or event APIs;
5. source-specific work cannot substitute a different source;
6. the dormant heartbeat task surface is absent;
7. source evidence claims match what code actually proves;
8. incomplete experience packets remain advisory-free and a review creates at
   most one new finite task;
9. digest no-op and same-day retry tests pass without archive overwrite;
10. durable navigation pages contain no live credential/task status; and
11. the live task projection is healthy after one representative wake per
    standing responsibility.

## Non-goals

This cleanup does not:

- redesign May's task engine;
- introduce another agent or planner;
- create a layout migration project;
- bulk-move or delete knowledge;
- add an artifact ledger or source-adapter framework;
- make metrics task acceptance authorities;
- infer semantic task similarity in code; or
- delete Amy's historical knowledge without a separate reviewed disposition.

## Recommendation

Approve Phases 1 and 2 as the closeout. They fix actual integrity failures and
make the mental model smaller. Review Phase 3 immediately afterward; the
dormant heartbeat and direct database context are legacy capabilities, not
requirements of the current Scout app. Keep the supporting-agent disposition
separate so cleanup does not become an unsafe content migration.
