# Scout Runtime Quality and Metrics Refinement

**Status:** Implemented historical rationale; the normative contract is
`../scout-knowledge-library-process.md`.

**Scope:** Scout knowledge-library observation, source reconciliation, schedules,
and metrics

**Does not change:** the task types, generic reconciler, Condition model, database
schema, app/agent boundary, or library layout

## Summary

Scout's basic architecture is correct:

```text
schedule / action / comment / metric
  -> one stable maintain task
  -> one Scout-owned workflow
  -> converged / waiting / attention
  -> optional finite achieve work
```

The current refinement is about trust and efficiency, not a new architecture.
The task tree is mechanically healthy, but three behaviors are still weaker
than the design intends:

1. library health repeatedly wakes Scout for facts that were already reviewed;
2. XHS produces reviewable source evidence while arXiv, HN, and GitHub can
   converge with only a successful session ID; and
3. the enabled schedules can request more agent sessions than the declared
   daily planning envelope.

Metrics currently provide useful observation, but several measure filesystem
activity rather than Scout outcomes. They must remain advisory signals rather
than acceptance authorities or work generators.

This proposal fixes those boundaries with the components already present. It
adds no controller, task type, registry, mode, database table, or history store.

## Current evidence

This is a dated, non-normative snapshot. The decisions below do not depend on
these exact counts remaining current.

At the reviewed 2026-07-20 snapshot:

- the seven standing Scout tasks were converged;
- the task projection reported no integrity failures or active tasks;
- all 21 Scout app tests passed;
- no Scout metric alert was open; and
- the latest source and maintenance reconciliations were using their intended
  workflows.

The same snapshot also showed:

- library-health signals for oversized notes and future dates repeating across
  nine packets after Scout had already recorded review decisions;
- non-XHS source results admitted with `session:<id>` as their only durable
  evidence;
- 71 `scout.explore` events in the preceding 24 hours; and
- substantial cutover/guard noise in recent reconciliation history, so the
  last 24 hours are not a valid steady-state performance baseline.

The proposal therefore distinguishes a clean current task state from a fully
trustworthy operating loop.

## Decisions

### 1. Keep the current task model

Retain the existing standing responsibilities:

```text
explore-arxiv
explore-hn
explore-xhs
explore-github
daily-digest
library-maintenance
runtime/library-health-observer
```

They remain stable `maintain` tasks. A schedule wakes the same identity and
does not change its desired generation. Independently closable cleanup remains
finite `achieve` work.

`library-maintenance` remains the single Scout integration owner. Do not add a
health agent, metric agent, learning agent, task-specific controller, or second
planner.

### 2. Make library health a fact observer only

`library-health` should answer:

> What is observably unusual in the current Scout-owned library?

It should not answer:

> Is a task progressing, was old work accepted, or should a task be created?

Those are reconciler and Scout judgments.

Remove task-progress policy from the observer:

- do not classify task-tree entries as `active-task-not-moving`;
- do not map health kinds to hard-coded finite task IDs;
- do not use the presence or absence of a live finite task as signal closure;
- do not scan free-form task summaries as library truth; and
- do not use `tree.json` as historical evidence.

The observer may still write its existing bounded JSONL packet and compare the
current packet with recent packets. That is observation state already in use,
not a new registry.

Each packet should contain raw facts with a conventional identity:

```text
fact key    = kind + subject
fingerprint = canonical serialization of the bounded fact
```

Canonical serialization means stable field ordering, canonical relative paths,
and exact scalar values. It is not fuzzy text normalization or semantic
classification.

A fact records its key, fingerprint, observed value, and observation time. The
packet also records whether the observer requested a wake and the deterministic
reason. The observer derives repeat and trend information from this existing
bounded history; it does not add a registry or store owner decisions.

An owner wake should occur only when:

- the fact key was not present in the previous packet;
- its value became materially worse according to a deterministic comparator
  for that fact kind; or
- the fact remains present when that fact kind's bounded review interval
  expires.

The review interval and worsening comparator are conventions in the observer,
not per-task configuration. A fact closes when current domain truth no longer
produces it. Task presence, task prose, and an owner's previous disposition are
not closure conditions.

An unchanged observation may remain in the packet without becoming a fresh
owner wake on every run.

#### Future dates

Future-date detection should inspect current domain truth:

- filenames under the canonical knowledge and report roots;
- explicit truth fields such as `date`, `last_updated`, or generated report
  dates; and
- the human landing page and index only where they declare current truth.

It must not scan `.state/tasks/tree.json` or other free-form execution history.
Predictions and quoted historical filenames are not automatically date-trust
failures.

#### Oversized notes

Line count is a fact, not automatically a defect. Report a note when it first
crosses the threshold or grows materially after review. An unchanged tolerated
note should not page the planner every six hours.

#### Unsourced backlog

Measure direction as well as size. Record the current count, previous count,
delta, and number of unchanged observation windows. Wake Scout for a threshold
crossing, meaningful growth, or a bounded review deadline. The observer reports
the trend; Scout decides whether the work is progressing or needs action.

### 3. Give every source the same result boundary

XHS is the reference behavior, not a special permanent exception.

The initial implementation labels XHS observations as workflow-owned and the
other three as structured agent-reported provenance. This closes the
session-ID-only acceptance gap without pretending that an agent-reported check
is deterministic acquisition. Small workflow-owned source fetches may replace
those three labels independently when their interfaces and value justify it.

All four source lanes should produce the same structured source result:

```ts
{
  summary: string;
  source: {
    name: "arxiv" | "hn" | "xhs" | "github";
    queryOrFeed: string;
    checkedAt: string;
    fingerprint?: string;
    itemIdsOrUrls: string[];
  };
  outputs: string[];
}
```

“Receipt” remains reserved for May's canonical task receipt. The source result
is workflow output that becomes bounded task evidence.

The source observation is provenance, not an agent opinion. The workflow
prepares it from deterministic acquisition where a source exposes a simple API,
passes it to the agent, and assembles the final receipt from the observation and
the agent's summary and outputs. The workflow converts the receipt into durable
task evidence; it does not trust the agent to recreate source provenance.

The workflow admits convergence only when:

- the source was actually checked using current evidence;
- every reported output exists after the run and its resolved real path is
  inside an allowed Scout root; and
- the result is either a source-grounded change or an evidence-backed no-op.

A successful agent session by itself is not evidence that the source task was
satisfied.

The stable task acceptance should say explicitly:

> The current source is checked without simulated data; useful findings update
> an existing note or a source-grounded finding, otherwise the workflow records
> an evidence-backed no-op.

Minimum source evidence includes the source identity, query or feed identity,
check time, current retrieval fingerprint where practical, and stable item IDs
or URLs where the source provides them. IDs and URLs are bounded, deduplicated,
and stripped of credential-bearing query parameters before becoming task
evidence. A changed result reports at least one admitted output. A no-op reports
no outputs and explains why the current source observation produced no useful
change.

Do not require a new adapter framework. Add small deterministic acquisition or
fingerprint code inside `scout-explore` only where a source already provides a
simple API. XHS remains the first complete example.

### 4. Avoid LLM work when the source has not changed

Before dispatching Scout, a source workflow may compare a bounded current
source fingerprint with the most recent accepted fingerprint queried from the
existing project reconciliation events before `runAgent`. Do not add a
fingerprint state file. If prior evidence is not available or trustworthy, skip
this optimization and run Scout normally.

If the source is unchanged, return an evidence-backed no-op without starting an
agent session. The precheck must be source-specific code inside the Scout
workflow, not a generic runtime feature.

This is an optimization, not a new task phase. The maintain task still
converges normally.

### 5. Make schedule demand fit the declared planning envelope

The current schedules can request approximately 78 source sessions per day:

```text
HN       24
GitHub   24
XHS      24
arXiv     6
```

This already exceeds `sessionsPerDay: 50` before owner reviews, digest work,
retries, or health-driven maintenance. The runtime currently treats that value
as planning and observation metadata; it does not enforce it as a hard quota.
`maxConcurrent` remains the enforced execution guard. Hard daily quota
enforcement is outside this proposal.

Use this initial review baseline:

| Responsibility                       | Proposed interval |  Maximum daily wakes |
| ------------------------------------ | ----------------: | -------------------: |
| HN exploration                       |           2 hours |                   12 |
| GitHub exploration                   |           2 hours |                   12 |
| XHS exploration                      |           4 hours |                    6 |
| arXiv exploration                    |           4 hours |                    6 |
| Combined owner and experience review |          24 hours |                    1 |
| Daily digest                         |          24 hours |                    1 |
| Library health                       |           6 hours | 4 deterministic runs |

This gives at most 38 routine agent-bearing wakes before preflight no-ops and
keeps planning headroom for useful health work, retry, and manual actions. It
does not guarantee that actual sessions remain below 50; observe actual use and
handle hard quota enforcement separately if it becomes necessary.

After a clean observation window, tune each source independently using accepted
findings, evidence-backed no-ops, failures, and session cost. Do not tune from
the migration-polluted 24-hour window.

### 6. Keep metrics advisory and narrow their meaning

Metrics are infrastructure observations. They may eventually emit a deduplicated
semantic signal that wakes the existing `library-maintenance` task, but all
Scout content metrics remain watch-only during the initial observation window.
They do not:

- accept a task;
- mutate task state;
- require Scout to edit content;
- prove knowledge quality; or
- automatically create achieve work.

Keep the planner rule: never bulk-edit merely to improve a metric.

#### Metric disposition

| Metric                                | Decision                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `scout.knowledge-practice-loaded`     | Keep as deployment health; route failure to app/runtime repair rather than Scout content work.                                  |
| `scout.knowledge-preamble-coverage`   | Limit to canonical Scout knowledge and keep watch-only initially. Any later wake must represent a new, deduplicated regression. |
| `scout.sourced-artifacts-24h`         | Replace with `scout.accepted-source-outputs-24h`, a descriptive count of outputs admitted by accepted source reconciliations.   |
| `scout.downstream-reference-files-7d` | Retire. Textual mentions do not prove downstream use; add no replacement until real consumption can be observed.                |

The accepted-output metric does not treat evidence-backed no-ops as failures.
Its meaning differs from the old mtime-and-URL measure, so mark the semantic
cutover and do not compare values across it.

Update the metric project association from the legacy
`scout-second-brain-learning` project to `scout-knowledge-lib.app`, the ID used
by the `projects` table. Event selectors continue to use the app event ID
`scout-knowledge-lib`.

Do not add a broad set of quality metrics. Reconciliation metadata already
answers whether workflows run, converge, wait, fail, or repeatedly no-op.

### 7. Keep periodic experience review separate

The draft `scout-maintain-achieve-experience-loop.md` defines how Scout can
periodically learn from bounded reconciliation metadata in SQLite. This
proposal does not duplicate that mechanism.

The app already has one enabled daily owner review with
`reason: "experience-review"`. Keep that schedule; do not add another review
loop. During the initial observation window it may choose ordinary maintenance
or an evidence-backed no-op, but it should not recommend schedule or workflow
changes from reconciliation history. After health signals and source results
have been trustworthy for seven days, the companion proposal governs whether
it may recommend schedule tuning or one finite workflow-improvement task. It
must not rewrite a maintain task's desired specification during execution.

This proposal owns source and health schedule changes only. The companion
experience-loop proposal remains the authority for owner-review learning
behavior.

The companion packet readiness rule is deterministic: unavailable, truncated,
or incorrectly scoped history is not included as learning evidence. The owner
review continues with current project state only. This proposal does not add a
second readiness mechanism.

### 8. Bring the design document up to date

Update `scout-knowledge-library-process.md` after implementation:

- replace the stale “cutover pending” status;
- describe current-source evidence and evidence-backed no-op acceptance for all
  source lanes;
- state that library health observes domain facts and does not judge task
  progress;
- clarify that missing workflows remain visible in `attention` until repaired,
  rather than silently changing the workflow or guessing from prose; and
- describe metrics as optional wake signals, never acceptance authorities.

## Implementation plan

### Phase 1 — Stop the noisy health loop

- Remove task-progress classification and hard-coded finite task coverage from
  `library-health`.
- Remove task-tree free-text from future-date scanning.
- Compare raw fact fingerprints with recent packets and wake only for new,
  materially worse, or review-due facts.
- Make unsourced backlog report counts and trends without judging progress.
- Add deterministic tests for unchanged observations, worsening observations,
  intentional forecast text, actual future-dated truth fields, and packet
  bounds.

### Phase 2 — Unify source evidence

- Apply the structured source-observation schema to arXiv, HN, and GitHub.
- Apply output existence and resolved-root admission to every source.
- Require current source evidence for a change and for a no-op.
- Update standing task acceptance text.
- Add tests showing that a successful unstructured session, relative output,
  missing output, out-of-root output, and unsupported no-op are rejected.

### Phase 3 — Fit schedules and metrics to reality

- Apply the proposed initial intervals.
- Add cheap source fingerprints where practical.
- Narrow the preamble metric to canonical Scout knowledge.
- Replace the sourced-artifact metric with an accepted-output observation and
  mark the semantic cutover.
- Retire the downstream textual-reference metric.
- Correct Scout metric project ownership metadata.
- Remove immediate Scout content-metric wakes during the observation window.

### Phase 4 — Observe before further automation

Run for at least seven clean days and review:

- source wakes versus actual agent sessions;
- evidence-backed no-op rate by source;
- admitted source-grounded outputs by source;
- source failures and waiting Conditions;
- health packets versus owner wakes;
- repeat health facts that did or did not worsen; and
- total Scout sessions against the daily planning envelope.

Keep the existing daily owner review running. Only after this window may the
companion experience-review design recommend process or schedule changes.

## Acceptance criteria

This refinement is complete when:

1. an unchanged library-health fact does not wake Scout before its bounded
   review interval;
2. runtime task history cannot create a future-date library signal;
3. every source reconciliation has reviewable current-source evidence;
4. every source change reports outputs that exist and resolve inside an allowed
   Scout root;
5. every no-op explains why current evidence produced no useful change;
6. routine scheduled demand fits below the declared daily planning envelope and
   actual session use is observable;
7. metrics are scoped to the current Scout project, semantic cutovers are
   explicit, and metrics cannot accept work;
8. the task tree remains limited to the existing standing responsibilities plus
   justified finite achieve work; and
9. the design document matches the implemented behavior.

## Non-goals

This proposal does not introduce:

- a new app mode or agent profile;
- a dedicated health, metric, or learning agent;
- another task type or public result state;
- a task-specific reconciler;
- a metric-driven task generator;
- a second task-history store;
- a generic source-adapter framework or artifact ledger;
- hard daily session-quota enforcement;
- automatic conversion of repeated achieve work into maintain work; or
- a Web UI change.

## Review recommendation

Approve the boundary changes as one design, then implement them in the phased
order above. Phases 1 and 2 establish trustworthy facts and receipts. Schedule,
metric, and experience tuning must build on those boundaries rather than infer
quality from sessions, file activity, or repeated task prose.
