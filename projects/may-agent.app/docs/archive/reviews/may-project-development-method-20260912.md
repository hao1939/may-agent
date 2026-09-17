# How we review, design, and implement May

**Status:** Dated research, September 12, 2026. The proposed application is in
[a recurring project review task](../../proposals/may-project-review-loop-20260912.md).
This record supplies observations and their sources; it adds no standing
instructions or execution authority.

**Subsequent evidence:** Hao authorized a bounded local pilot. The
[pilot record](may-project-review-pilot-20260912.md) preserves its separate
sandbox/container execution, failures, correction and results. The source
observations below describe the research snapshot before that trial.

## Finding

The most useful method is already visible in the work: understand the whole
model, identify an unmet outcome, question the cost of its contract, try the
smallest sufficient change, and revise it against real behavior and review.
The agent should carry that work forward across wakes. Producing another
proposal is useful only when a decision still needs one.

The [accepted philosophy](../../1-principles/design-philosophy.md) already owns
the general rules. The research adds concrete examples of applying them,
recurring mistakes to avoid, and a check of the machinery available to host
this method. It does not need another philosophy catalog.

## Sources and limits

This is a deliberately selected sample around architecture, simplification,
Task unification, agent adoption, and script retirement, rather than a census
of every session and PR.

| Source | Coverage | What it establishes |
| --- | --- | --- |
| Current design | Principles; system boundary; Task engine; skills and learning; workflow practices; current adoption and cleanup proposals | Documented intent and recorded experiments; implementation/status claims still need a revision and a check |
| Direct Codex user messages | Three sessions, 472 messages at extraction; 49 selected messages matched back to their rollouts | Direct requests and corrections, qualified by their task context |
| Selected surrounding turns | Adjacent assistant responses inspected for recovery, error handling, discussion, and compatibility decisions | Context for the correction; assistant summaries and compaction records are not additional human instructions |
| GitHub | 23 PRs; 12 issue comments, 89 submitted reviews, 91 inline comments | Concrete review practice and candidate changes; account attribution alone cannot distinguish a human from an agent acting through that account |
| Source and local runtime | App mapping, schedules, owner guidance/workflow, focused mapping tests, one retained Task row and a read-only daemon status request | Available source mechanisms and a bounded runtime observation; no proof of an operating scheduled development loop |

GitHub was sampled at **2026-09-12 14:51:41–14:51:48 UTC**. PRs inspected were
#96, #97, #112, #127, #129, #138, #140, #143, #145, #150, #153, #154, #155,
#158, #159, #161, #164, #167, #168, #171, #172, #173, and #174. At that snapshot,
15 were merged, four open, and four closed. Later status must be fetched again.

The local Host checkout was `8026aff97585edd7f728fa4ce360fdde71bc740a` (#164).
The App lives in the separate workspace repository, which has concurrent work.
The local checkout, GitHub candidates, remote main, and deployed code are
different facts. For example, #172 was already merged remotely while that
local Host checkout still preceded it. A stale proposal or checkout can
therefore produce an already-fixed finding.

Session references below use a stable session ID and the ordinal among its
entries in the local Codex history. Timestamps are UTC. Raw transcripts and
operational data remain local; only relevant excerpts are retained here.

| Key | Session | Scope at extraction |
| --- | --- | --- |
| A | `01a0705f-4d52-7293-827d-e99212f0865d` | September 5–8 and later continuation; 253 messages; Herdr and May-operated PR hygiene. Transfer lessons require context. |
| B | `01a08511-e459-7f53-8938-0e4d20a9ce45` | September 9–12; 211 messages; May architecture, philosophy, simplification and implementation. |
| C | `01a095d3-d5b7-7b61-9763-47ace07f2c28` | September 12; eight messages; scripts, reusable work, codebase cleanup and this research. |

The earlier [philosophy history](design-philosophy-history-20260909.md) remains
a useful historical synthesis. Its older Git excerpts were not independently
recovered again for this review.

## Preferences supported by direct corrections

These are contextual decision rules, not personality traits. An explicit
current instruction can refine them. They neither grant permission nor create
extra approval gates.

| Observation and direct source | Implication for a reviewing agent | Qualification |
| --- | --- | --- |
| “all we do is for the project's goal, we need to define it well” — B31, Sep 9 14:18; value/cost in B30, lifetime/risk in B34 | State the user benefit and sufficient outcome before choosing cleanup. Include upkeep, lost capability and human attention in cost. | Fewer lines or more automation is not itself the goal. |
| “which is the minimal component required?” — B6; removal should degrade capability while preserving remaining correctness — B8, Sep 9 08:03 | Review boundaries before files. Keep a small dependable core and removable capabilities. | Removing a capability still requires accounting for its consumers, data and accepted work. |
| “we may [be] in the wrong way” when a fix becomes complex — B29, Sep 9 14:12 | Reconsider the guarantee before adding another recovery path or coordinator. | Simplicity does not permit silently weakening an accepted requirement. Explain the new behavior and change its owning contract. |
| “we can accept redo over recovery if it's simple and the cost is acceptable” — B25, Sep 9 11:25 | Prefer affordable repeatable work to exact step recovery. | Expensive or irreversible work can justify a stronger mechanism. |
| “code execute and llm judge” — B40; simpler error hook correction — B46, Sep 9 15:52 | Code should execute dependable mechanics; agents interpret facts and choose work. | Do not turn every uncertain policy into a runtime state machine or every local operation into an event. |
| “because i want to review the code” — B116, Sep 10 18:07 | Organization, naming and small coherent diffs have value when they make reasoning easier. | File movement alone may not reduce complexity. |
| “one mental model” — B139; external owner closes — B143; failure is not closure — B153, Sep 11 | Use the unified Task model; a failed attempt does not abandon the responsibility. | Old `complete`/child-wait instructions must be read against the current contract. |
| “check whether agent can understand and take use of the mechanism” — B147, Sep 11 05:35 | Verify agent use in a real path, with later independent checks. | A helper test or hand-operated PoC proves less than agent adoption. |
| “which proved and which is pending?” — B170; review comments, fix and retry PoC — B188, Sep 12 | Keep limits visible and iterate on observed behavior. | A passing local trial is not evidence of deployment or general reliability. |
| “we can accept breaking changes” with solid design/scenarios — B173; compatibility need not be expensive — B203, Sep 12 | Prefer a supported unified path when compatibility costs more than it serves. | These are scoped simplification decisions, not permission to discard persistent data or unrelated consumers. |
| Refine PR “not only the code, but also title and description” — B181, Sep 12 09:02 | Keep the final review artifact aligned with the final diff, tests and remaining work. | Do not make reviewers reconstruct the implementation from conversation history. |
| Preserve PoC learning in design docs; separately examine reusable scripts — C2–C6, Sep 12 13:41–13:49 | Retire experiments after preserving their findings; maintain reusable checks where they belong. | Moving every script into an archive is not knowledge preservation or maintenance. |

Two further corrections shape task operation:

- **Own the whole responsibility.** A78 (Sep 7 09:20) rejected one Task per PR
  in favor of one hygiene task owning those PRs. A91 asked reconciliation to
  read current durable data. A120 (Sep 8 07:04) said waiting for one fact must
  not block other wakes. Those arose in cross-project hygiene work; the current
  Host Operations mapping independently supports grouped ownership.
- **Stay collaborative and use judgment.** B74 (Sep 10 04:29) keeps discussion
  interactive. B104 authorizes implementation and PR creation for its specific
  plan; B111 separately asks #132/#133 to wait for human review. These are
  compatible scoped instructions. A98's ADO-specific publication/testing order
  is not a universal GitHub process. B205 prefers the simpler word “fact.”

The most revealing corrections were responses to overreach: treating recovery
as sacred, expanding a simple error hook into a reliability architecture,
keeping compatibility without a valued consumer, or making the human manage
work that already had an owner. An aligned agent should notice those patterns
in its own proposal before asking the user to correct them again.

## What actual PR reviews teach

The following are review observations, not fresh re-executions of historical
tests. Their linked discussions record the findings, changes and claimed
validation. Posts attributed to the repository account may be agent-authored.

### Change the contract when the stronger one is unnecessary

In [#97](https://github.com/hao1939/may-agent/pull/97#discussion_r3967697366),
the accepted answer was an ownership contract: definition sources must not
mutate returned declarations. The implementation explicitly promised shallow
freezing, not deep immutability or a sandbox. No clone framework was added.

In [#154](https://github.com/hao1939/may-agent/pull/154#issuecomment-5641137812),
a larger recovery action budget became unnecessary after #158 moved unfinished
Tasks onto ordinary retry with persisted backoff. Closing the candidate was
progress: the underlying need was met with less special machinery.

In [#172](https://github.com/hao1939/may-agent/pull/172#discussion_r3996443197),
database-read-only inspection allowed normal SQLite WAL reader sidecars. A
private raw-file snapshot would have introduced a race and a stronger contract
than needed. The [deployment follow-up](https://github.com/hao1939/may-agent/pull/172#issuecomment-5646472290)
likewise described a preflight honestly rather than inventing a lease across
SQLite, files and an external restart.

**Lesson:** Ask whether the behavior is sufficient and its limitation clear.
Do not repair a guarantee that the project has chosen not to offer.

### Accept concrete defects, test the boundary that failed

[#145's rollback review](https://github.com/hao1939/may-agent/pull/145#discussion_r3985584738)
found accepted old descriptors paired with a rejected new adapter. The
[response](https://github.com/hao1939/may-agent/pull/145#discussion_r3985644027)
recorded a reproduction and restored previous options with the descriptors.
That is a real publication/rollback contract, not hypothetical hardening.

[#158](https://github.com/hao1939/may-agent/pull/158#discussion_r3995297361)
required closure to preserve the accepted outcome. [#164](https://github.com/hao1939/may-agent/pull/164#discussion_r3995992949)
required an atomic migration test while retiring old coordination. A clean
new path was insufficient without retained-state behavior.

**Lesson:** Choose tests from the possible user-visible failure. For storage,
rollback and migration, exercise the real boundary. For ordinary reversible
edits, do not manufacture a costly test program.

### A reviewer can be wrong, partly right, or right for the wrong reason

[#174](https://github.com/hao1939/may-agent/pull/174#discussion_r3996447219)
alleged double escaping of a tool name. The
[response and browser assertion](https://github.com/hao1939/may-agent/pull/174#discussion_r3996451601)
showed the prefix and body were escaped separately. The proposed removal would
have reintroduced HTML interpretation. The extra visible-text assertion was
useful even though the diagnosis was wrong.

In [#167](https://github.com/hao1939/may-agent/pull/167#discussion_r3996242128),
the fixture deserved correction, but the claim that typechecking would catch it
was inaccurate because tests were excluded from that check.

**Lesson:** Decompose a review into its claimed defect, evidence and suggested
remedy. Verify each; fix the valid part and explain rejected claims. Comment
counts, approvals and reviewer confidence do not replace judgment.

### The description and the claimed result are part of the deliverable

[#129](https://github.com/hao1939/may-agent/pull/129#discussion_r3980833411)
needed its PR description updated after combined changes. [#161](https://github.com/hao1939/may-agent/pull/161#discussion_r3995354319)
challenged claims of behavior adoption that exceeded what finish reports
proved. [#174](https://github.com/hao1939/may-agent/pull/174#discussion_r3996451653)
also updated root documentation after the default UI output changed.

**Lesson:** Code, documentation and claimed validation must describe the same
candidate. “Written,” “tested,” “merged,” “loaded” and “used successfully” are
separate observations.

## What May already has, and what is missing

| Inspected source | Finding | Consequence |
| --- | --- | --- |
| [Host Operations App](../../../app.ts) | `owner-review` ordinarily maps to `runtime/platform-owner-review`, assigned to `tech-lead`, with an ongoing platform outcome. Explicit independent goals can map separately. | Reuse this Task; separate findings and PRs do not inherently need Tasks. |
| Same App schedules | Eight-hour `platform-review` and 24-hour `owner-heartbeat` both emit `project.tick`. Comments, owner requests, ready work and selected metric events also route to owner review. | An additional scheduler is unnecessary for a pilot. The value of both timers can be reassessed from use. |
| [Mapping tests](../../../app.test.ts) | Two focused tests passed: repeated item-level inputs retain one goal; an explicit independent goal reuses its key. 16 assertions; 11 tests filtered. | This verifies source mapping, not scheduled execution or agent behavior. |
| [Owner workflow](../../../agents/tech-lead/workflows/platform-owner-review.ts) | A packet-building workflow exists, but ordinary owner-review mapping does not select a workflow. | Do not fix this file and assume the live task now follows it. Trace the actual executor first. |
| [Owner guidance](../../../agents/tech-lead/AGENTS.md) and shared `project-loop-driver`, `system-investigation`, `verification` skills | Useful project judgment and verification guidance already exists. Some shared wording still mentions immutable completed Tasks, `needs-owner`, or `app.dependency.completed`. | Align only the guidance used by this path with the current Task contract. Avoid another duplicate all-purpose skill. |
| [Skill contract](../../2a-design/skills.md) and [learning loop](../../2a-design/practice-learning-loop.md) | Saved source, selected guidance, activation and later useful behavior are distinct. Existing sessions retain definition snapshots. | Validate discovery and a fresh execution, then later behavior; file presence is insufficient. |
| [Workflow practices review](../../proposals/workflow-practices-review.md) | Candidate isolation and integration have their own remaining gaps. | Do not assume `verified-coder` automatically supplies a safe end-to-end implementation path. |

A read-only lookup found the retained owner-review Task pending, last updated
September 10 at 06:32 UTC, with no current attempt. A daemon status request at
September 12 14:57 UTC succeeded. Neither observation identifies the loaded
App revision or demonstrates that the source schedules currently execute this
review task. The proposal therefore includes an admission-to-result check,
rather than claiming an installed review loop.

The App's ordinary Task intent carries only `{ scope: "may-agent-platform" }`.
Input details need to be available through the admitted-input/current-fact
path; a prose instruction placed in `owner-review.data` is not, by itself,
proof that the executor reads it. This is an important pilot check.

## Research conclusion and open questions

The strongest hypothesis is that a small improvement to **existing owner
judgment, context access and follow-through** will help more than another
controller. The recurring task should review its own failed assumptions as
well as the codebase, and should be able to conclude that no change is worth
making.

Still unproved: whether the installed owner gets this context, chooses the
method without repeated human steering, resumes candidates across waits,
handles new comments while CI is pending, and reduces supervision at an
acceptable cost. At this research snapshot there was no measured baseline;
the subsequent pilot's single-case comparison showed no initial advantage
from explicitly pointing to the method.

The [proposal](../../proposals/may-project-review-loop-20260912.md) turns those
uncertainties into a bounded pilot. Historical cases supply evaluation examples;
they should not all become new permanent rules, runtime fields, or CI tests.
