# May Deputy Learning Curriculum

**Status:** Active curriculum (2026-08-04)

## Outcome

Gym trains and certifies May as Hao's system deputy: able to make bounded
decisions, discover the right system knowledge, use May-agent mechanisms
correctly, investigate unfamiliar failures, and bring Hao evidence-backed
proposals only at genuine authority boundaries.

This is not model fine-tuning. A session becomes durable learning only through
the mechanism that matches the observed cause.

| Learning need                                   | Durable mechanism                                 |
| ----------------------------------------------- | ------------------------------------------------- |
| Stable deputy identity and authority posture    | concise `AGENTS.md`                               |
| Situational method or detailed system knowledge | `may-agent-system` skill and accepted design docs |
| Changing environment fact                       | owned context or knowledge                        |
| Repeated ordered process                        | agent-owned TypeScript workflow                   |
| Deterministic capability                        | tool or SDK command                               |
| Mechanical high-confidence risk                 | calibrated guard                                  |

Gym measures whether those mechanisms improve behavior. It does not put
withheld benchmark answers into May's prompt.

## Competency model

May needs six connected capabilities:

1. **Authority judgment** — distinguish act, propose, wait, and escalate.
2. **System model** — understand owners, apps, tasks, Conditions, sessions,
   skills, workflows, tools, guards, metrics, and escalation.
3. **Discovery** — recognize missing context and load the relevant skill,
   accepted contract, task state, trace, schema, or evidence.
4. **Operation** — choose the smallest correct mechanism while preserving
   ownership, task, event, and closure boundaries.
5. **Investigation** — compare hypotheses, inspect actual inputs, isolate the
   responsible layer, and prove the repair.
6. **Human-attention stewardship** — resolve or route owner-owned work and send
   Hao one decision-ready packet only when his authority is required.

May acts at Hao's decision level. It owns the intended outcome, priority,
accountable owner, next move, proof standard, authority boundary, and follow-up
to closure. It uses the owning app, workflow, or specialist for implementation
detail.

High level does not mean passive. A successful deputy creates forward motion,
checks the result, and replans when the proof is insufficient.

## Four assessment tiers

### Tier 1 — Critical decisions

Use paired yes/no or act/propose/wait/escalate decisions. Require a short
reason, confidence, and authority boundary. Counterfactual pairs prevent keyword
guessing. One unsafe critical authority violation is a hard failure.

### Tier 2 — System knowledge and mechanism selection

Ask May to choose among plausible neighboring mechanisms and justify the choice
from a canonical source. Cover event versus state, owner versus worker, direct
agent versus skill/workflow/tool/guard, task versus session, Condition versus
escalation, and delivery versus domain completion.

### Tier 3 — Operational scenarios

Use sandboxed May-agent fixtures with realistic app files, tasks, events,
traces, metrics, catalogs, and tools. Score the emitted actions and artifacts,
not prose similarity. A scenario should prove that May can operate the system,
not merely describe it.

### Tier 4 — Diagnostic scenarios

Provide incomplete or conflicting evidence with no hidden exact procedure. May
must gather evidence, compare hypotheses, identify the responsible layer,
propose the smallest repair, name a bounded proof, state uncertainty, and
separate what it will do from what requires approval.

More than one sound investigation path may pass. The evaluator scores causal
quality and evidence, not reproduction of a secret command sequence.

## Sources and truth boundaries

Accepted May-agent principles and design documents are the source of system
truth. Curriculum records reference those sources rather than copying the whole
architecture.

Keep four layers separate:

| Layer             | Purpose                                   | Authority                     | Candidate visibility     |
| ----------------- | ----------------------------------------- | ----------------------------- | ------------------------ |
| System sources    | Accepted operating truth                  | May-agent design owners       | Discoverable by May      |
| Operational skill | Compact method and source routing         | May owner                     | Visible only when loaded |
| Curriculum        | Lessons, examples, guided practice        | Gym curriculum owner          | Visible during learning  |
| Assessment        | Blind requests, fixtures, labels, scoring | Gym plus human truth approval | Request and fixture only |

Learning content has three visibility partitions:

- **Lesson and practice:** explanation, examples, feedback, and guided use.
- **Development assessment:** blind variants used to build a candidate.
- **Release assessment:** withheld transfer variants mounted only after the
  candidate is frozen.

Candidate builders may receive competency IDs, source documents, lessons,
practice evidence, and development outputs. They must not receive release
requests, fixtures, expected answers, scorer tokens, or earlier release
outputs. Enforce this through the candidate workspace, not prose alone.

## Resource convention

The implemented convention is:

```text
competency -> unit -> track
```

- A **competency** is a stable capability and its canonical source references.
- A **unit** groups the lesson, practice, reviewed evidence, development
  benchmark, and withheld release benchmark for one cohesive learning area.
- A **track** binds one unit to its development and withheld release
  benchmarks. `autonomous-training.json` selects the approved development cases
  and trial count used by autonomous assessment.

Use “unit” consistently. Do not introduce a second “module” abstraction.

```text
projects/gym/benchmarks/may-learning/
├── competencies/
│   ├── index.json
│   └── <competency-id>.json
├── units/
│   └── <unit-id>/
│       ├── unit.json
│       ├── lesson.md
│       ├── practice.md
│       ├── evidence.jsonl
│       └── guided-practice.json          optional
├── tracks/
│   └── <track-id>.json
├── registry.json
└── autonomous-training.json

projects/gym/benchmarks/<development-benchmark>/
projects/gym/benchmarks/<release-benchmark>/
projects/gym/scenarios/<scenario-id>/
```

`registry.json` lists units. `autonomous-training.json` lists the development
tracks that `improve/may` drains. Benchmark suites and labels remain normal Gym
resources; the learning catalog references them rather than inventing another
runner.

### Competencies

A competency has a permanent ID, objective, criticality, dimensions, tiers,
prerequisites, and accepted source anchors. If its meaning changes, create a new
ID. A source revision marks affected cases for review; it does not silently
rewrite approved benchmark truth.

Every assessment case names one or more competencies. Reports may aggregate by
competency, tier, unit, track, and scoring dimension without creating a mutable
student-profile database. Immutable run evidence remains authoritative.

### Units

A unit contains one cohesive learning area. It may reference several related
competencies and scenarios, but it owns only its lessons, practice, and reviewed
evidence—not system truth or benchmark execution.

Evidence rows point to immutable session or evaluation artifacts. They record
the observed behavior, outcome evidence, competency, evaluator confidence, and
human disposition. Positive and negative labels are evidence, not automatic
teaching authority.

### Tracks

A track binds one unit to one development benchmark and one withheld release
benchmark. `autonomous-training.json` is the autonomous assessment boundary: it
names each enabled track's development benchmark, approved scenarios, and trial
count. Every approved development case in that benchmark must appear there;
loading fails when an approved case is silently omitted.

Tracks may be assessed independently and in bounded parallel. They do not own
task lifecycle, candidate promotion, or a second training controller.

## Learning intake

Reviewed sessions, successful runs, failures, and direct human corrections
first become candidate evidence. Gym then:

1. keeps only explicit, repeated, independently validated, or high-impact
   reusable signals;
2. compares them with accepted design and existing coverage;
3. assigns the responsible layer and competency;
4. absorbs semantically duplicate evidence into existing coverage;
5. proposes the smallest new lesson and positive, negative, or contradiction
   controls only when meaning is materially new;
6. asks Hao to approve new human-owned benchmark truth; and
7. adds approved development cases to autonomous training.

Weak inference, ordinary requests, runtime-only failures, invalid evidence, and
already-covered meaning do not create benchmark proposals. A draft case counts
as coverage so repeated incidents strengthen one candidate instead of creating
duplicates.

`draft` has one meaning: the case is waiting for a human truth decision.
`approved` means the case may enter an executable suite and learning unit.
Derive the pending queue from benchmark label files with
`bun run review:pending`; do not add proposal-status storage. Rejected or
absorbed drafts leave executable manifests, while their source review and
useful evidence remain available for future comparison.

### Codex source intake

The standing Codex intake reviews only Hao-authored turns after its durable
checkpoint. It scans bounded batches, advances over discarded weak material,
and stores hashes, source pointers, and plain-language candidates. Raw turns
remain in Codex storage.

Extraction, consolidation, and design review must all succeed before the
checkpoint advances. Once caught up, an unchanged wake performs a cheap scan.

### Telegram field review

The standing field review examines completed May conversations and correlated
action evidence. It judges fulfillment, not fluent wording or self-reported
success. For proactive attention, it also judges whether May should handle,
route, return, reject, or deliver the request.

Positive evidence is stored quietly. Only a strong actionable failure enters
the existing incident and proposal path. Raw conversation text remains in the
May-agent runtime store; Gym preserves source pointers and a bounded account of
intent, handling, outcome evidence, and the reusable lesson.

## Learning and certification cycle

Use the existing `improve/may` maintain resource and improvement workflow. Do
not create another learning task tree.

```text
reviewed evidence and accepted competencies
  -> blind development assessment
  -> responsible-layer classification
  -> smallest durable learning mechanism
  -> guided practice when defined
  -> one isolated candidate
  -> frozen development verification
  -> withheld release assessment
  -> existing-behavior regression
  -> exact decision packet for Hao
  -> approved promotion
  -> later field validation
  -> keep, revise, or retire
```

Practice and assessment are different. Feedback is allowed during guided
practice and forbidden during blind development and release evaluation. A
candidate that improves only visible questions does not pass.

Guided practice uses the real safe tool when tool use is the competency. It
captures requested, started, terminal, artifact-review, reflection, and
changed-hypothesis retry evidence. Simulation may cover unsafe failure modes,
but it does not replace basic real-tool proof.

A good session may become a positive exemplar only after its outcome is
verified. Prefer contrastive success/failure pairs and paraphrased regressions
that expose the causal difference without copying the transcript.

## Skill design

Keep May's normal prompt lean:

- `AGENTS.md` contains deputy identity, authority posture, and a compact trigger
  to discover system context.
- `may-agent-system/SKILL.md` contains the operating method and routes situations
  to accepted sources.
- Detailed variants remain in accepted docs or one direct skill reference.
- Deterministic helpers become tools or scripts only when repeated code
  justifies them.
- Stable ordered teaching and evaluation phases stay in the Gym workflow.

Do not place benchmark questions, expected answers, learner scores, or task
state in the skill. If May knew the method but skipped a stable sequence, prefer
a workflow. If a tool, fixture, scorer, or runtime caused the failure, repair
that layer instead of adding another prompt rule.

## Scoring and release

Operational and diagnostic cases score independent dimensions:

| Dimension            | Evidence                                               |
| -------------------- | ------------------------------------------------------ |
| Intent and authority | act, propose, wait, or escalate decision               |
| System model         | correct primitive, owner, and state authority          |
| Discovery            | relevant skill, source, state, or evidence loaded      |
| Execution            | valid bounded actions and artifacts                    |
| Evidence             | claims supported by reads, controls, tests, or traces  |
| Closure integrity    | terminal proof and correct follow-up                   |
| Communication        | decision, evidence, uncertainty, and approval boundary |

Use deterministic checks for objective structure and safety. Use calibrated
semantic review for open judgment. A semantic judge cannot override a
deterministic safety violation. Preserve raw outputs, invalid trials, and
evaluator or human disagreement.

Responsible-layer classification keeps the same boundary. Passing structural
checks proves only that structure; it does not prove clear or correct semantic
content. A semantic failure belongs to May unless the evidence identifies a
specific defect in the rubric, calibration controls, judge, or evaluator.
Equivalent wording rejected only by a literal token check is a scorer defect;
ordinary disagreement with a calibrated semantic result is not.

A release candidate must:

- have human-approved truth;
- improve its frozen development baseline;
- pass withheld transfer cases;
- preserve existing approved behavior;
- contain no invalid release trial;
- use one matching framework revision; and
- preserve exact artifact and evidence fingerprints.

Thresholds are release policy, not authority. Calibrate them from observed
human review rather than optimizing a permanent score.

## Human decision packet

Hao receives one compact proposal containing:

1. the competency gap and why it matters;
2. baseline and candidate results;
3. critical errors and important behavior preserved;
4. the exact durable artifact and why that mechanism was chosen;
5. discovery and execution evidence;
6. invalid trials and evaluator uncertainty;
7. regression results and cost proxies;
8. artifact and evidence fingerprints; and
9. the approval boundary and rollback.

Present benchmark truth in plain language. The decision is to approve the exact
artifact, reject it, or request a bounded revision. Hao is not asked to
interpret scorer tokens or initiate work Gym can safely perform.

## Extension rules

To add a learning area:

1. Identify an accepted source contract.
2. Add or reuse stable competencies.
3. Add one unit with concise lesson and practice material.
4. Add development and withheld release variants.
5. Add only the minimum deterministic checks and semantic rubric required.
6. Human-review new critical truth and release labels.
7. Register the unit and approved autonomous-training track.
8. Run the focused canary before broader certification.

Validation fails on missing or duplicate IDs, broken source anchors, mixed
visibility partitions, missing human approval, missing competency coverage,
omitted approved development cases, or withheld truth in a candidate-visible
packet.

Adding a unit should require resources and manifests, not a new workflow,
controller, database, or task hierarchy.

## App Task-result migration

The canonical May boundary is now evaluated directly:

```text
human request -> May Task result -> exact App dependency result -> May Task result
```

The `app-outcome-management` unit tests the production
`TaskReconcileResult`, not a May-specific disposition lifecycle:

- a direct answer or focused clarification is `converged` with `response`;
- clarification is used only for irreducible ambiguity and states May's likely
  interpretation, safe assumptions, recommendation, and smallest remaining
  human decision instead of requesting discoverable facts or App-owned
  implementation choices;
- durable work is `waiting` with one stable typed App dependency;
- May turns loose human language into an outcome, scope, material constraints,
  acceptance proof, and authority boundaries before selecting the accountable
  installed App;
- the destination App chooses its Task, workflow, executor, schedule, retry,
  and session mechanics; and
- an exact dependency result is reviewed before the Conversation Task
  converges or requests one bounded follow-up dependency.
- a focused Task is treated as exact context: May may answer about it, continue
  it with typed feedback, or leave it untouched when the human starts another
  topic.
- plain language is May's default across answers, questions, progress,
  summaries, typed App requests, failures, and design explanations; exact IDs,
  schema fields, quoted evidence, and necessary technical terms stay precise,
  and a necessary term is explained simply when introduced.
- typed App requests keep the smallest complete outcome, material constraints,
  and proof; they omit narration about May's later work and generic permission
  warnings that do not change the destination App's work.

For approved May App cases, Gym gives `finish()` the production
`taskAgentResultSchema` and materializes its accepted result as
`task-result.json`; the model does not have to remember or hand-write the
wire shape. The scorer then admits that artifact through the production SDK
contract and checks only the scenario-specific meaning and
ownership boundary. Model scenarios evaluate judgment; a separate thin Runtime
canary owns restart, concurrency, dependency correlation, and exact event-wake
proof. Static prose fixtures must not claim those runtime behaviors were
exercised.

Representative communication cases use calibrated semantic controls. They
judge whether the complete Task result is clear and useful by meaning; Gym does
not enforce plain language with a keyword blacklist.

Gym is the accountable installed App for requests to improve May's behavior.
May makes such a request actionable and returns an `improve-may` dependency;
Gym's existing stable `improve/may` Task receives the request as trigger-event
evidence and chooses the curriculum, scenarios, evaluation, and improvement
mechanics. Request-specific evidence does not mutate that stable desired state.

Legacy May tracks remain reproducible evidence but are disabled in
`autonomous-training.json`. Enabled configuration is not approval: autonomous
curriculum loading selects only scenarios whose labels contain approved status,
reviewer, and timestamp. A track with no approved cases contributes no work.
New critical truth remains draft until Hao approves the exact expected cases.
