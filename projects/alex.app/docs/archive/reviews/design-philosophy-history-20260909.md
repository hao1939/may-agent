# Design Philosophy History

**Historical context:** [Design Philosophy](../../1-principles/design-philosophy.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Historical evidence and interpretation, recorded September 9, 2026.

Current guidance lives in [Design Philosophy](../../1-principles/design-philosophy.md)
and [Core Principles](../../1-principles/core-principles.md). This record explains
their sources. Historical instructions, role names, and APIs below are not
current contracts.

## How to read the evidence

Current explicit human guidance takes priority. Recorded short human messages
are stronger evidence than agent summaries. Some long messages in the human
input archive identify themselves as relayed external reviews; they are
submitted guidance, not independently verified verbatim speech by Hao.
Quotes in the early philosophy are historical attributions: the original
conversations behind those quotes were not independently recovered here.

An architectural decision establishes the project's design at that time; it
does not establish that every sentence is a timeless human preference.
Imported research and agent-added scorecards have still weaker authority.

## Recovered documents

These commits belong to the outer workspace repository, not the separate Host
repository in `projects/may-agent`.

| Commit | Original path | Evidence |
| --- | --- | --- |
| `42cd59259b` (March 3) | `shared/philosophy.md` | Introduces a dedicated record of human values, separate from architecture and team structure. |
| `0c75cb90ae` (March 4) | `shared/philosophy.md` | Forty principles, attributed quotes, and provenance tags for direct, inferred, and imported ideas. |
| `0c75cb90ae` | `shared/meta-loop.md`, `shared/system-design.md` | Self-improvement uses ordinary execution; evaluation measures, owners judge, and optimization changes the appropriate layer. |
| `385e43b60d` (March 15) | `shared/philosophy.md` | Complete 1,182-line expanded version, still recoverable from Git. |
| `39fafc4893` (March 17) | `shared/philosophy.md` | Committed condensation to 296 lines. |
| `930ae206c4` (March 17) | `shared/knowledge/philosophy-changelog.md`, `shared/knowledge/philosophy-archive-draft-568.md` | Changelog dates condensation March 16 and says direct quotes were removed. Its claim that the original was lost is incorrect: Git retains it. The draft preserves the detailed Skill Over Agent explanation. |
| `f2b9914681` (April 1) | `shared/philosophy.md` → `shared/archive/legacy/philosophy.md` | Unchanged rename during shared-directory cleanup. |
| `4486c340c8` (April 2) | `shared/archive/legacy/philosophy.md` | Deletion in bulk archive cleanup; the parent commit retains the final 323-line copy. |
| `c7b9246bf5` (April 20) | `shared/may-agent-docs/design/core-principles.md` | Architecture-specific principles: events, accountability, discovered context, evidence, conventions, and simplicity. |
| `c0a5dac08e` (May 6) | `shared/projects/hao-alignment/preferences.md` | Adds the learning loop, proof before adoption, follow-through, and critical review to an inferred preference model. Later archived under `projects/_archive/top-level-cleanup-2026-06-13/hao-alignment/`. |

For example, recover the original sources from the workspace root:

```sh
git show 0c75cb90ae:shared/philosophy.md
git show 385e43b60d:shared/philosophy.md
git show '4486c340c8^:shared/archive/legacy/philosophy.md'
```

Keeping this provenance avoids restoring a large, partly superseded catalog
into the active reading path. Archive deletion alone does not show that the
underlying values were rejected.

## Human philosophy anchors

The March 4 philosophy attributes the following explanations to Hao:

| Theme | Recorded wording | Section in that revision |
| --- | --- | --- |
| Requirements | “Don't just imp for design, imp for requirements!” | §5 |
| Shorter execution chains | “the more steps the more chance of failure the less robust the less efficient” | §1 |
| Exploration and hardening | “For exploring or testing it's ok to let the llm try various tools and finally figure it out, but once it's done we need to optimize it to be efficient and stable” | §7 |
| Suitability | “we do need to investigate theory, we take the good ideas their experience their brilliant insights, but need to fit in our own minds and one thing important 'suitable' for our case and current situation” | §17 |
| Recovery | “how should we properly tracking so everyone knows where to start after crashing or recovering from hanging?” | §8 |
| Trigger versus work | “heartbeat is a wake up, not how we do job. we keep working on it until finish” | §31 |
| Useful redundancy | “redundant is allowed and sometimes encouraged, as long as they align with each other. single source is easy to damage by one mistake or accident” | §34 |
| Independent opinions | “disagreement is also allowed if they serve as an alternative opinion. The agent system is about common sense but not god truth” | §35 |
| Focus | “keep tracking of the big picture but focus on a small problem each time” | §38 |

The preserved 568-line draft, §52, adds the attributed explanation that a skill
is simpler and easier to share, while an agent combines skills and context.
It identifies uncertainty, parallelism, and different model perspectives as
reasons to delegate. The March 14 submitted review explicitly calls Skill Over
Agent one of the most important principles.

The recorded human-input source is `.state/human-inputs.jsonl` at the workspace
root. Timestamps below identify records independently of file ordering. Dates
use UTC. The selected excerpts preserve intent without copying full sessions.

| Timestamp | Source kind | Relevant evidence |
| --- | --- | --- |
| `1773472999366` (March 14) | Submitted philosophy review | Rejects imported theory that does not fit the project; asks to cut duplicates and keep operational guidance concise. |
| `1773473507838` (March 14) | Direct message | Creative agents must learn to try and verify ideas before applying them. |
| `1773498650880` (March 14) | Direct message | Optimizer should turn proven experience into stable, reusable workflows, tools, skills, or JavaScript. |
| `1773499908095` (March 14) | Relayed strategic review | “The system exists so that Hao says what he wants, and it gets done with decreasing supervision over time.” Measures command-to-satisfactory-result effort. |
| `1773501041687` (March 14) | Relayed correction | Verification of improvements is essential; unverified advice is insufficient. |
| `1773514833571` (March 14) | Relayed lesson investigation | Measure behavior before and after lessons; promote effective fixes into structure and remove stale instructions. |
| `1773574607529` (March 15) | Direct follow-up | Stop copying knowledge without a purpose or reader; investigate the system-wide cause of duplication. |
| `1773947943752` (March 19) | Direct message | Learn from experience while keeping focus; forgetting less useful information is acceptable. |
| `1776430223121` (April 17) | Submitted common-sense correction | “Measure product, not process”; keep evidence, simplicity, and focused work while cutting redundant prose. |
| `1776834845280` (April 22) | Direct message | Reproduce → explore/brainstorm → try/verify → adopt → keep tracking; recurring problems need sustained learning. |
| `1777483591652`, `1777490614987` (April 29) | Repeated direct message | Meeting a metric prompts review of the goal, dimensions, alternatives, and regression monitoring. |

## Technical decision anchors

### Simple first and fix the cause

The March 14 philosophy review rejects cryptographic receipts, mathematical
taxonomies, and role frameworks that the project does not need. The same day's
corrections retain a way to verify agent improvement as essential. Simplicity
means choosing sufficient machinery for the actual problem, not rejecting
infrastructure categorically.

The relayed March 15 activity-tracking review (`1773575416624`) asks to use
existing lifecycle events, avoid a new polling daemon or audit system, and
begin with an append-only file inspectable through ordinary tools. Its old
file/API proposal is historical; the reasoning favors reusing an existing
mechanism before creating another subsystem.

The March 30 budget directive (`1774856301751`) and April 15 follow-up
(`1776249197042`) identify arbitrary turn/tool-call caps as a cause of unfinished
work. They retain observation and appropriate runtime controls. This supports
eliminating wasted work and fixing execution structure, rather than treating a
smaller operation count as proof of quality.

### Event-driven, with durable state and bounded recovery

The April 5 direct message (`1775379532301`) says evaluation can react to the
session-end event instead of waiting for a 30-minute cron; startup recovery
can cover crash-interrupted sessions. The motivating properties are timely
reaction, less repeated discovery, and an explicit recovery path.

The April 20 architecture document overshot this into “Everything is an event”
and “Events must be consumed,” with owner fallback routing. These are
superseded specifics. August's simple-event decision (`54c6cf48dd`) converged
on a small publication/read/subscription interface. Current
[Events](../../2a-design/events.md) permits record-only facts and requires an
explicit admission route for promised work. Private calls and transactions
still protect local invariants.

### Stable core and extensible external capabilities

In the September 9 design conversation Hao explicitly asked for a stable,
less-changing core, replaceable/removable external components, and an event
system connecting them. The agreed criterion was:

> “Removal should degrade capability, while preserving the remaining system’s correctness.”

Earlier decisions support this direction: August 17 simplified Host/App
responsibilities (`8303a9b310`); August 23 defined replaceable Task executors
(`d4d97f3d3a`). Changing how an attempt executes must preserve durable work
identity and result authority.

The [stable-core proposal](../../proposals/task-runtime-organization.md) makes
two separate tests explicit: extension should not rewrite core rules; absence
should preserve accepted obligations. It also distinguishes the Host/App
responsibility split from core/adapter replaceability. Full implementation
separation remains tracked there; this historical record does not assert it is
complete.

### Convention over configuration, explicit ownership

The August 15 [composition decision](../decisions/convention-based-service-composition.md)
retains ordinary typed module composition while rejecting another public
service loader, string-keyed locator, and partial reload mechanism. Conventions
locate definitions and supply defaults; validated declarations supply identity,
ownership, and behavior. A generic extension framework is not a prerequisite
for extensibility.

The April 29 direct message (`1777484737211`) says “Let the infra do its job.”
The April 15 relayed workflow review (`1776251730960`) argues for using an
existing owner-review step rather than adding polling, an approval ledger,
and a new coordination protocol. Its universal persistent-task prescription
is superseded by current bounded-turn/Task rules; reuse of the responsible
layer remains the useful reasoning.

### Correctness, observation, and judgment are different responsibilities

Direct March 14 input (`1773497798264`) rejects a broad bash guard as harmful
to creativity. March 27's submitted directive (`1774586998168`) identifies
false positives and added complexity. May 11 input (`1778481018435`) asks that
unrelated dirty files produce a warning rather than block another session's
completion. Other inputs permit narrow helpers and mechanical checks.

This supports evaluating the actual invariant, scope, and false positives.
It does not establish a timeless rule that every guard must block or every
guard must be removed. Current [Mechanism Selection](../../1-principles/code-vs-data.md)
distinguishes deterministic correctness checks from behavioral detection and
contextual judgment.

### Recovery is a cost tradeoff

After reviewing the reconstructed philosophy on September 9, Hao clarified:

> “we can accept redo over recovery if it's simple and the cost is acceptable.”

This qualifies the early emphasis on crash recovery. Preserve enough state for
correctness and accepted obligations; do not infer a requirement to preserve
every intermediate computation or resume an exact session. Cheap, safe redo
can be preferable to checkpointing and restoration. Compare expected rework
cost with implementation and ongoing maintenance, and add progress retention
only when it earns its complexity. The clarification is direct guidance from
the current design conversation, not a conclusion inferred from older commits.

## Lessons from Herdr Supervisor

Hao explicitly requested these lessons during the September 9 philosophy
review. The sources below belong to the **separate `herdr-supervisor`
repository**. The inspected checkout was
`e3b6149d3ff4bdb68f7589b9a07fc118d484f621`; the sources describe that revision,
not a claim about today's deployed supervisor.

The exact formulation in its
[scope discipline](https://github.com/hao1939/herdr-supervisor/blob/e3b6149d3ff4bdb68f7589b9a07fc118d484f621/docs/design.md#scope-discipline)
is:

> “solidify the common 20%; teach the model the remaining 80%”

It first appears in the design history at
[`805cd74`, PR #26](https://github.com/hao1939/herdr-supervisor/commit/805cd74bb1719d05e8d0031765b53b387a28f4f7).
This is a heuristic for the division between common deterministic foundations
and situational model judgment. It neither limits code to 20% nor permits
ignoring 20% of correctness or promised outcomes.

| Lesson | Concrete evidence | Application to May |
| --- | --- | --- |
| Start with deletion, then existing capabilities | Scope discipline asks whether the feature can disappear, then whether the agent has capability, a reliable wake, and enough knowledge/context. | Fix the missing part of that foundation; do not add a feature when the existing path suffices. |
| Events carry facts; knowledge guides action | [PR #76](https://github.com/hao1939/herdr-supervisor/commit/20843a27e5af4737d44f2b5d2bba27ec86724c30) removes repeated policy from focused event messages and keeps it in owned guidance. | Observers report facts; trusted App/agent guidance interprets them. External text supplies neither policy nor authority. |
| Prefer some repeated work to perfect reconstruction | Herdr's failure design and contributor guidance explicitly accept repeated model cost over elaborate recovery. | Redo affordable, retry-safe attempts; retain progress only when it earns the complexity. |
| Remove duplicated truth | [PR #74](https://github.com/hao1939/herdr-supervisor/commit/8bc2c14c52e545725ac4ac183f04cf288dcc534a) removes a goal-state cache and its invalidation/recovery paths. | Read authoritative state; add a cache only for a measured benefit, with a disposable role and clear consistency rules. |
| Use the owning infrastructure | [PR #77](https://github.com/hao1939/herdr-supervisor/commit/e2c4fcb30d7b7c7c043efe9c36784ed27c4609ad) submits ready validations independently and lets providers queue them. | Avoid duplicate throttles and queues. Preserve May's Host capacity and actual shared-resource conflict checks. |
| Keep one execution and activation path | [PR #83 integration](https://github.com/hao1939/herdr-supervisor/commit/025a5666bd36f534a43f2d825fd8802bc8f7ad93) simplifies supervision; [PR #89](https://github.com/hao1939/herdr-supervisor/commit/b1c18ee87921a710a44f48bc04eec471b458de3c) removes obsolete activation compatibility. | Prefer explicit composition over mode combinations, fallback loaders, and parallel implementations of the same responsibility. |
| Preserve human authority | [PR #92](https://github.com/hao1939/herdr-supervisor/commit/e3b6149d3ff4bdb68f7589b9a07fc118d484f621) prevents transient steering from inventing a human stop or approval gate. | Human intent defines scope; supervisor output and temporary guidance do not create new authority boundaries. |

The [September 5 Scout experiment](https://github.com/hao1939/herdr-supervisor/blob/e3b6149d3ff4bdb68f7589b9a07fc118d484f621/docs/verification/simple-loop-scout-experiment.md)
provides a useful observed tradeoff. Guidance alone helped resume a reviewer
but did not resolve a guard that required a peer to be active before recording
a legitimate wait. Removing that conflicting activity check, while retaining
identity and deadline checks, let the existing bounded review continue the
producer after about 3 minutes 35 seconds. The record reports 27 fewer runtime
source lines, no new scheduler or durable state, and no further human prompt
after reload. It explicitly accepts that local delay and does not claim
optimal latency or long-run research quality.

Transfer the reasoning, not Herdr's entire architecture. Its ban on a second
task/workflow system does not retire May's existing Tasks and workflows. Its
one-decision supervisory fence is not a one-tool-call limit on workers.
The shared lesson is to use the smallest reliable foundation, retain judgment
where it works, and justify added machinery with measured benefit.

## From technical preferences to tradeoff rules

After the recovery correction and Herdr comparison, Hao asked whether these
principles would guide tradeoffs and requested more fundamental rules. The
resulting [decision order](../../1-principles/design-philosophy.md#how-to-decide-a-tradeoff)
is a synthesis for review, not an attributed historical quote or a new set of
fixed preference weights. It combines requirements and suitability, acceptable
redo cost, Herdr's full cost of additional mechanisms, and experiment-first
learning. Preference for reversible trials and local change is an inference
from those practices, not a separately recovered human directive.

Hao then clarified that a growing complex fix can indicate the wrong approach:

> “simplicty and straightforward solution won, and we can give up some contracts in realities”

This corrects the initial synthesis, which treated existing contracts as too
fixed. A guarantee must justify its practical value, even if it is already
documented, implemented, or tested. Reconsidering scope, weakening a guarantee,
or removing a feature can be the right technical solution. Accepted limitations
should be explicit and affected consumers should follow the revised contract.
Simplicity is a reason to revisit the requirement, not merely a tie-breaker
between implementations that preserve every earlier guarantee.

Hao then stated the governing question directly:

> “we should always aks: what's the value and what's the cost? does it deserve the cost?”

The permanent philosophy puts this question first. It applies to keeping and
fixing existing behavior as well as adding new behavior. Comparing against a
simpler alternative and including ongoing maintenance and displaced work makes
the question useful for practical decisions.

Hao then established what gives that value meaning:

> “all we do is for the project's goal, we need to define it well”

The philosophy now puts goal definition before tradeoff rules. The working
May goal combines the earlier intent-to-result direction with the current
emphasis on acceptable total cost and understandable, steerable work. Its
wording and suggested evidence are a synthesis for review, not a recovered
verbatim goal or a claim that the system already achieves it. The distinction
between a standing purpose and bounded milestones prevents continuous
improvement from becoming an unlimited mandate for more machinery.

Hao next asked how robustness fits that decision:

> “most of the time simplicity align with robust, sometime there is extra cost”

The resulting guidance treats adequate robustness as part of the goal's
sufficient outcome. Simpler structures often remove failure modes; additional
protection earns its cost through avoided disruption. Extra compute or storage
can also improve robustness without adding complicated control logic. This is
a practical synthesis, not a claim that simpler code always fails less or that
every possible failure deserves another safeguard.

Hao then asked whether a choice can represent both value and cost:

> “it may be benefit to clarify which is value and which is cost? maybe something is both value and cost?”

The clarification describes benefits and sacrifices relative to an alternative,
rather than assigning features or properties permanently to either side. A
checkpoint, for example, avoids discarded work but adds state and maintenance.
Treating saved cost as a benefit is useful, provided the same saving is counted
once. These definitions clarify the comparison without adding a scoring model.

Hao then made the time horizon and tolerance for mistakes explicit:

> “for core/fundamental features, which is high usage frequency, the long terms cost is important”
>
> “for trial/experiment features, we are not sure it would survive, so the short term value is perfered.”
>
> “something is which can afford to be wrong, so we pay more weight on the value, vice versa.”

The decision rules now distinguish likely lifetime and repeated use from the
consequences of being wrong. Long-lived foundations deserve attention to
cumulative costs; uncertain trials favor immediate value and learning. Cheap,
reversible mistakes allow more emphasis on upside, while costly mistakes call
for stronger evidence and protection. Reassessment when a trial gains regular
use, explicit downside bounds, and avoiding duplicate risk accounting are
practical applications of that guidance, not fixed numerical weights.

## Corrections to earlier summaries

| Earlier interpretation | What the evidence supports |
| --- | --- |
| New feature means new agent | Reuse a skill or smaller mechanism; a specialist earns its place through context, judgment, isolation, or parallelism. |
| All knowledge must have one copy | Mutable state needs a clear authority; useful aligned summaries/backups can coexist. Unread copies remain waste. |
| Every event needs work and an owner fallback | Facts can be recorded only; promised work requires explicit admission. |
| External means optional plugin or separate service | It means outside stable correctness responsibilities; a deployment may require a replaceable capability. |
| Strong guards are always preferred | Scope, deterministic guarantees, evidence, and false positives determine the appropriate mechanism. |
| Recovery must preserve every step | Preserve correctness; redo affordable, retry-safe work. Precise resumption is justified by its cost benefit. |
| Existing contracts always outrank simplicity | Reconsider self-imposed guarantees whose complexity exceeds their practical value; simplify the contract and implementation together. |
| Consult peers means at least two reviewers every time | The numerical quota was added by an agent preference model, not established by the cited human quote. |
| Never coast means no task can finish | Sustained improvement is an ongoing responsibility; finite work and real waits still need truthful status. |
| The last philosophy version is most authoritative | Principles marked for removal in the March 14 review, including P62, P100, and P113, remain in the final archive. Later editing did not reliably preserve the corrections. |

The archived Hao alignment model is a useful source index, but its numerical
weights and automatic escalation rules are agent inventions. Some dates also
conflict with the recorded input timestamps. Preserve the evidence and
reasoning, then reassess the interpretation against current human guidance.
