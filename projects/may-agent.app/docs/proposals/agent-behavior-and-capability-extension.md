# Teaching agents: from a correction to dependable behavior

**Design status:** Proposed for review, September 12, 2026.
**Implementation status:** Isolated trials support guidance adoption, method
discovery and dependable workflow execution through existing Host capabilities.
The [agent-operated trial](agent-operated-improvement-poc-20260912.md) focuses on
the remaining usability question: can an agent discover, author, activate and
verify another agent's improvement without human-operated intermediate steps?
The linked reports retain successes and unsuccessful trials. The
[ordinary-Task follow-up](task-improvement-poc-20260912.md) also demonstrates
wait/resume and owner withdrawal for an improver. Its target still runs as a
fresh direct execution; this is not installed or general reliability evidence.
Section 6 links the earlier evidence; section 7 separates this mechanism work
from production integration and the optional Gym learning path.

No production guidance, permissions or deployment changed. This document
itself authorizes no model calls, production activation or deployment.

## Outcome and recommendation

Let a human teach May through ordinary conversation, then see that teaching
applied in later relevant work without repeating it. Give agents useful
abilities through the same normal work path, without changing the core for
every new behavior.

Use the conventions May already has:

> Instructions define the role. Skills teach methods. Tools perform operations.
> Workflows coordinate dependable procedures. Code brings back evidence; agents
> judge what it means. The existing Task preserves ongoing responsibility.

The intended deliverable is a proved adoption path, not merely an installed skill
or workflow. May understands the correction, preserves its intended scope,
activates authorized guidance, and uses it in a later ordinary request. The
human need not choose files or remember capability names. This changes the
context and procedures available to the model, not the model's trained weights.

The human supplies the desired outcome and authorized scope; **the agent operates
the mechanism**. For example: "Help May answer our capacity questions correctly
using the accepted policy." The agent discovers the evidence and available
capabilities, chooses a small change, tries it, activates it when authorized,
and checks later behavior. The human should not have to select files, run an
evaluation, relay tool results, or issue each reload command.

We are proving those usable mechanisms, not requiring a production Gym campaign
or a new automated learning controller. Once the mechanisms work, an ordinary
agent can use them to investigate and improve itself or another authorized
target. Improving another agent does not grant control over its owner or tools.
Existing work records retain evidence; a repeated improvement process can remain
agent-directed unless a demonstrated stable procedure deserves a workflow.

The local trial proved the execution side under controlled conditions: a loaded
rule or discoverable skill affected later ordinary reviews without a reminder;
an unreferenced memory file did not. The baseline already retained the supplied
defect. Equal finding quality does not disqualify a workflow: stable execution
and agent judgment are different benefits. Use guidance to change judgment;
use a small tested workflow when required sequencing must be dependable.
Human-to-guidance authoring and later adoption now work in the isolated real
Conversation path, including a fresh conversation. Production authority,
the installed catalog and background Task adoption remain unverified.

This applies the accepted [contract-and-convention principle](../1-principles/core-principles.md#convention-over-configuration).
The owning contracts remain [agent conventions](../2b-manual/agent-convention.md),
[skills](../2a-design/skills.md), [workflows](../2a-design/workflows.md),
[Host/App boundaries](../2a-design/system-boundary.md), and
[execution feedback](../2a-design/events.md#execution-feedback-and-agent-wakes).
It does not introduce a competing lifecycle to the
[One Task proposal](conversation-input-unification.md).

## 1. Teach through normal conversation

For example, the human says:

> When reviewing PRs, focus on important problems. Don't keep changing things
> just to satisfy cosmetic comments.

May should understand the intended behavior, not merely save the sentence.
A useful interpretation is to assess comments by correctness, reliability and
user impact, explain optional suggestions, and retain important findings. It
must not generalize this into ignoring review comments or skipping verification.

Distinguish the scope before making a standing change:

- **This review:** use the correction in the current Conversation/Task input;
  no permanent guidance update is needed.
- **This project:** revise the project's existing review guidance.
- **Future reviews generally:** revise the appropriate reusable method or May's
  stable instructions, not every agent's global prompt.

May chooses the narrowest suitable home and briefly states the interpretation.
Preserve the named project and duration in the rule itself; do not generalize
a scoped preference when editing a reusable skill. Make editable source and
immutable execution snapshots distinct in the owning guidance.
Ask only when the ambiguity materially changes scope, risk or authority. If
permanent scope is unclear, apply the instruction narrowly now rather than
silently making a universal rule. Explicit wording such as "from now on" can
authorize the requested standing preference within the human's authority; it
does not authorize unrelated code changes, new permissions or deployment.

Immediate use and durable adoption are separate. May can say "I'll follow that
in this review" while a standing update remains pending. Claim "active for
future reviews" only after checking the actual activation. Explain a remaining
approval or capability gap plainly; do not present internal stages as a new
status system the human must manage.

Corrections to a standing preference replace the relevant existing guidance,
not append contradictory rules. "Only for this review" remains temporary;
"stop using that preference" follows the same scoped edit and activation path.
Keep personal preferences in appropriate private installation guidance; do not
copy conversation logs or private details into public skills or repositories.

## 2. Choose the smallest useful extension

| Need | Mechanism and normal home | What it does not do |
| --- | --- | --- |
| Shared working principles | `shared/common-sense.md` | Hold every domain procedure |
| One agent's role and stable behavior | Its `AGENTS.md` | Grant permissions or own Task state |
| A reusable judgment method | `skills/<name>/SKILL.md` | Guarantee sequencing or install tools |
| Domain facts and detailed references | `knowledge/INDEX.md` and referenced documents | Become automatically loaded instructions |
| A deterministic operation | Existing tool/helper, or agent-local `tools/*.ts` | Decide whether the outcome is sufficient |
| A stable multi-step procedure | Agent-local `workflows/<name>.ts` | Own a scheduler, background queue, or durable wait |
| Different reasoning capacity | Existing model configuration or a bounded agent call | Create another durable owner merely for expertise |
| Later external feedback | Existing observer and declared Task route | Turn provider text into trusted instructions |

Use the same agent-local shape inside an App. Keep shared guidance genuinely
shared; keep domain knowledge and procedures with the responsible App/agent.
Preserve the current scope and precedence rules instead of adding inheritance.

These are complementary choices, not a maturity ladder. A method may remain a
skill permanently. A known correctness-critical procedure may deserve code
immediately. A workflow need not have a companion skill if its description and
input contract are already sufficient.

May can still investigate, edit, verify, and answer directly within authorized
scope. Using a tool or workflow does not by itself require delegation. Another
agent supplies bounded expertise; another App is appropriate when responsibility
or authority genuinely belongs there.

### Choose by need, delivery and lifetime

The [method matrix](extension-methods-poc-20260912.md#which-method-fits-which-case)
records suitable cases, activation, retention, limits and observed agent use for
each method. For a proposed change, answer these in its existing guidance or
review, without adding another manifest:

1. What is missing: current input, a fact, a method, an operation, a dependable
   sequence, different judgment, or delivery of later feedback?
2. When will the intended execution actually receive it: next input/read,
   explicit selection, successful reload and new preparation, or deployment?
3. Is it for this work only or standing guidance? Where is the authoritative
   source, how is it discovered, and how can it be amended or withdrawn?
4. What proves useful use, rather than just installation, execution or a report?

Keep four facts separate: **available → delivered → used → useful**. A candidate
can fail at any link. Inspect that link before adding more instructions or code.
The agent can normally choose a suitable method from clear purpose/reference
descriptions, but that is not a guaranteed protocol or an authority boundary.

### A small authoring convention, not another manifest

Guidance for an ability should explain, in plain language:

- when it is useful, and when it should not be used;
- which facts it needs and where to find them;
- the method and the decisions left to the agent;
- the tools or workflows it relies on, including prerequisites;
- the evidence needed to support its result; and
- what to report when information, capability, or authority is missing.

These can be ordinary sections in `SKILL.md`. Long details belong in references;
deterministic helpers remain ordinary code. Do not require a new capability
package, dependency solver, activation registry, or skill-specific work record.
An extension can consist of guidance alone or one small tool.

For a short stable preference, the existing loaded instruction is sufficient.
For a substantial situational method, use the existing skill and its description.
The PoC does not justify creating a skill for every sentence, loading all skill
bodies, or storing the same preference in both places. Availability and relevance
must earn the extra context/read cost.

Keep one authoritative home for each rule. Shared instructions supply defaults;
the agent supplies its role; skills supply situational methods. Host-generated
context supplies actual capabilities and execution/result contracts, not a
second copy of conversational preferences or domain strategy. Instructions at
any scope cannot override runtime authority or the human's authorized scope.

An ordinary request such as "review this change" should be enough. The agent
uses descriptions to choose the method; the human need not remember a skill or
workflow name. Explicit selection remains an optional way to remove ambiguity.
Code validates the selected name and input, but does not add a second semantic
classifier to decide which method the human meant.

Return a compact result with its revision, outcome, limitation and an evidence
reference. Keep detailed prompts and tool traces available on demand instead
of repeatedly putting them into the caller's context. The first agent-operated
trial succeeded but exposed that unnecessary payload cost in its fixture tools.
This is an ordinary tool-result convention, not a new evidence service.
Include a small indication of failed tool calls even when the final execution
completed. The review-follow-up PoC produced correct capacity answers while
repeatedly trying an inaccessible policy reference. The teacher's readable
evidence is not automatically visible to the target. Describe that boundary,
keep references usable in the target's execution, and cite the source actually
available there. Counts are investigation signals, not automatic acceptance
rules; details remain available for the agent to judge.

## 3. Workflows are first-class callable abilities

A workflow packages a stable procedure that the agent can use. It is more than
advice, but less than another controller for the whole goal.

Its main purpose is to make the **process stable**: required steps happen in
the right order, inputs and results are checked, failures remain visible, and
recovery follows explicit limits. It need not discover more bugs than a capable
agent or be faster to justify its place. Code can also contain mistakes: this
benefit comes from a correct, tested procedure, not from naming a file a workflow.

There are two valid ways to choose one:

- **Agent choice:** the agent selects a useful procedure for the current work.
- **App requirement:** an existing App execution/acceptance contract requires a
  particular procedure for an operation. A prompt saying "mandatory" is not
  enforcement; the relevant code boundary must enforce that requirement.

Inside the workflow, code controls stable ordering, checks, bounded retries,
and the return contract. Agents handle uncertain diagnosis, tradeoffs, and
proposals. A workflow may call an agent with a selected skill through the
existing SDK. Do not turn contextual judgment into a growing tree of hardcoded
cases, or add multiple agents where one judgment is sufficient.

For a PR review, an evidence workflow can collect the exact revision, check
results and available logs. The agent receives a useful evidence packet, judges
the findings using review guidance, and returns its assessment. The caller/App
still judges whether the requested outcome was satisfied.

If the caller already has the facts, supply them once as clearly identified
evidence and leave original sources available when needed. Do not also direct
the agent to repeat the collection. The local trial needed a clearer packet
prompt, not another tool, to remove redundant reads. Keep revision/source identity,
collection gaps and failures visible; a collected packet is not automatically
fresh, complete or sufficient for approval.

Choose a workflow when repeated setup wastes meaningful effort or omitted and
misordered steps cause meaningful mistakes, and the procedure is stable enough
to test. Keep direct agent work when exploration determines most next steps.
Start with a small evidence-gathering procedure before automating an entire
repair-and-release process. Adoption should remove repeated work the agent
already needs to do, rather than add a mandatory ceremony. A skill may explain
when to use the workflow; usable purpose/input descriptions let the agent
choose it during an ordinary request. The human need not name either one.

The first three-file collector tested packaging and discovery, not enough of
this stability contract. Its equal findings and discovery cost did not justify
a conclusion against workflows. The follow-up tests a pinned revision, required
source accounting, a defined bounded read retry, response validation and a final
revision check through the existing runner. Direct work receives the same rules.

Keep two decisions separate: the agent may choose a useful method, but once a
workflow is invoked its internal checks are not optional. Where bypass would
violate an actual operation precondition, enforce that condition at the existing
App/action boundary. Do not rely on the model choosing the workflow every time,
and do not make an unrelated conversation follow the procedure.

For this example, the smallest dependable flow is:

```text
pin current revision
  -> collect required sources for that revision
  -> validate completeness and recheck revision
  -> coherent packet OR explicit limitation, preserving available evidence
  -> agent judges the findings and next action
```

`done` means the collector satisfied its contract; even a complete packet can
contain failed CI or a real defect. `blocked` means it cannot certify the packet,
not that useful partial evidence should be discarded or the Task must close.
The agent may recollect after a head change. A later mutation must still verify
its own current-revision precondition; collection cannot freeze an external PR.

### Execution and waiting

A workflow runs within the existing bounded execution contract. It inherits
the applicable scope, cancellation and deadline; nested calls do not reset those
limits. A local repair loop can continue while authorized and useful within
that bound. Repeated failure without new evidence is not a reason to loop.

The baseline runner fenced late results and SDK effects but did not supply its
cancellation signal to imported helpers. The follow-up reproduced a helper
starting a final read after cancellation. The isolated candidate adds
`ctx.signal`, shared with cooperative helpers and inherited by nested runs.
The updated HTTP fixture observes request cancellation and no final read.
Helpers must pass the signal to I/O and check it before another operation;
the Host cannot preempt arbitrary JavaScript or undo a committed effect.
Effectful helpers still need current authority, revision and idempotency checks.

Keep logs, child results, errors and verification evidence with the workflow
run. A successful run records the procedure's result; it does not by itself
prove the agent's judgment or the enclosing Task's outcome. No new
skill/workflow success ledger is needed.

The baseline inspection omitted returned helper packets. The candidate retains
the workflow's returned output or blocker evidence in its existing run artifact,
with a size bound, best-effort secret redaction and explicit unavailability.
There is no new store or metrics dependency. This captures what the workflow
returns, not every helper response or evidence lost before cancellation. Large
data should be referenced through existing artifacts. The SDK/source change is
published in Host PR #159 but unmerged; live adoption remains unverified.

For a later pipeline result, human reply, or other durable wait, end the run.
The owning Task preserves the obligation and accepted wait through existing
contracts. Observer facts or other admitted input can then wake the same Task
for another attempt. A generic `blocked` workflow return does not itself create
a wait, subscription, or handoff.

## 4. How a change takes effect

```text
Human correction or reviewed finding
  -> understand the intended behavior and scope
  -> save the smallest authorized guidance/code change
  -> validate and activate through the existing change path
  -> supply it to a later relevant execution
  -> agent applies it in ordinary work
  -> inspect whether the behavior actually improved
```

These are facts to verify with existing source, activation and execution
records, not a new adoption state machine. Understanding is not saving;
saving is not activation; catalog visibility is not use; use is not improvement.

### Save and activate

Revise the existing rule or method rather than create a duplicate skill for
every correction. A standing instruction must have a reliable path into the
relevant execution: concise always-needed guidance in the existing instruction
layer, or a situational method with a clear discovery/retrieval path. A note
left in `context.md` or a knowledge folder is not a promise of future use.

Reuse the [definition release and reload path](../2a-design/runtime.md): prepare
the authorized committed source, validate it, activate the complete definition
generation and check the active revision. Editing or committing a file alone
does not activate it. Failed validation/publication leaves the prior generation
active; May reports the failure without claiming the new behavior is enabled.
No new deployment daemon, release ledger or per-skill subscription is needed.

Restart restores the activated source; it does not publish newer checkout edits.
The same snapshot rule applies to released knowledge, local tools and workflows.
In contrast, mutable operational facts can change on their next actual read
without reload. Preserve their source and freshness; do not confuse an updated
observation with approved standing policy. Source reload cannot replace the
running Host binary or install new dependencies.

Definition-only updates should use the supported reload, not require the human
to restart the whole system. A change that needs Host code or additional
permissions follows its separate existing authority and deployment path; it
cannot be disguised as a remembered preference.

### Receive and use during ordinary work

At the start of relevant work, the agent receives current role guidance and a
bounded description of applicable abilities, then reads detailed methods as
needed. Use descriptions that match human requests, including when a method is
not appropriate. Keep the model responsible for selection; do not add a second
semantic classifier or require a human activation command.

Use bounded catalogs and on-demand reads. Do not put full skill bodies, workflow
source or all knowledge into every prompt. When entries exceed the catalog
budget, expose the omission and a way to inspect the remaining entries through
existing reads/discovery. First shorten overlapping descriptions; do not solve
overflow by adding an unbounded prompt or a search service.

Workflow discovery should explain purpose and usable inputs. Retain the existing
workflow tool/runner rather than adding a parallel invocation interface. Only
enable it for an agent when there is a useful scoped procedure to expose.

An explicit skill selected at a supported human or delegation boundary must
reach execution as that selection, not merely as text buried in a larger prompt.
Only trusted user/caller selection has this meaning; do not scan external logs,
review comments or provider payloads for activation commands. Model-selected
reading remains advisory and is not guaranteed explicit activation.

Expose the effective instructions/source revision, advertised or omitted skills,
available tools/workflows and selected skill evidence through existing
inspection and execution records. Start with the information needed to explain
the first trial; this is not a new dashboard or registry requirement.

### Existing work and later executions

Recommend one predictable update rule: a prepared execution keeps its definition
snapshot. A later newly prepared execution uses the active definition after a
successful reload. "New execution" does not mean every internal model call in
an existing attempt. Do not hot-swap its system prompt, toolset or code.

Human corrections to current work still enter through normal steering or Task
feedback and can guide the next decision; source snapshots do not freeze human
input. Use existing Stop/cancellation for urgent intervention. Neither a prompt
update nor cancellation can undo an external effect that already happened.

Keep the same Task and Conversation history when preparing the next execution.
The human should not need to close the chat or create a replacement Task to
receive updated guidance. Legacy persistent sessions that keep an old definition
need an explicit supported execution transition or an honest pending status;
reload alone must not be described as refreshing them. This revises the skill
document's promise of latest-definition explicit activation in an existing
session, without adding mid-execution refresh.

Do not wake every idle Task when a skill changes. Waiting Tasks adopt it on their
next legitimate execution. If the human wants a change applied to current work
now, use the existing exact Task feedback/control path. Preserve accepted waits,
outcomes, and committed effects; adopting guidance is not authority to replay
operations or reopen completed work.

Situational use is not automatic forgetting. Skill bodies, answers and temporary
instructions may remain in retained history; a source rollback does not erase
them. Make a current correction clear through the existing input path. Use fresh
execution controls to test durable adoption separately from transcript influence.

### Improvement uses the ordinary Task lifecycle

Host #158 is merged in source (`f5d5a535`, September 12, 2026); this does not
establish deployment. Use that common lifecycle rather than a separate learning
job, campaign controller, or Task for each edit and probe.

A small correction can finish inside the current Conversation Task. Improvement
that needs independent follow-through gets one ordinary App-owned Task. The
agent chooses what to edit, how to test it, and whether feedback warrants repair.
Code preserves the assignment, scoped effects, evidence, waits and returned
result. A workflow is useful only when repeatable mechanical ordering earns it.

The durable evidence should identify the objective and scope, candidate revision,
any required exact approval, observed activation, actual target execution revision
and its result. Reuse the Task's result/evidence and owned source artifacts;
do not add an improvement status database. Inspect committed effects after
reopening instead of blindly repeating them. A restart does not renew authority
or reset an agreed spending allowance.

Keep these facts distinct:

```text
candidate saved -> active source -> target execution used it -> useful result
```

Compare the final candidate revision with the active revision, not merely with
an earlier successful reload. A later clean commit can still be inactive. Keep
that mismatch visible rather than claiming the final guidance was verified.

An external wait releases execution and preserves the same Task. Its observation
resumes work; a timer or successful reload is not itself proof of adoption.
`converged` accepts an outcome and leaves the Task open. The assigning owner
decides closure or withdrawal. A worker's `stopped` report is an unsuccessful
attempt, not cancellation of the assignment. Unfinished work retains the normal
retry policy; a bounded improvement budget must be enforced at the applicable
operation boundary, not expressed by pretending `stopped` closes the Task.

The [unified-Task improvement experiment](task-improvement-poc-20260912.md)
examines this composition. It also checks **effective** tool capabilities after
Task preparation: the runtime rebuilds standard coding tools for the Task
workspace. A differently scoped source capability must keep its own adapter
identity and restrictions. Registration alone does not prove the executed
capability has the intended scope.

The same follow-up now uses the real managed tool/finish path in no-model
checks and retains actual prompt, returned-payload and source-revision evidence.
Live review caught an overstrict fixture validator: readiness facts must match,
but the schema's optional explanation may differ. A described action is not an
executed action. It also caught a relative-read base outside the allowed snapshot;
align the normal read context with the allowed source rather than widening access.
These are small capability/fixture corrections, not reasons for another lifecycle.

### Native workers

Native CLI workers have their own discovery and permission behavior. Pass the
relevant method, references, scope and expected evidence explicitly when using
them. Do not assume that May's loaded skill, tools or instructions transfer, or
that a symlink proves the worker read a skill. Use existing bounded delegation;
do not mirror every runtime's configuration into another compatibility layer.

## 5. Match review effort to the change

Explicit teaching and experimental learning have different evidence needs:

- **Clear, low-risk human preference:** recommend an ordinary scoped guidance
  edit, proportionate checks and verified activation. Do not require a Gym
  experiment or another approval of the same unambiguous preference merely
  because it changes behavior.
- **Agent-inferred lesson:** keep it as evidence until reviewed. One failure
  or evaluator opinion does not authorize a permanent behavioral change. Reuse
  the existing learning comparison and exact-artifact approval path.
- **Executable procedure or authority-sensitive change:** use normal code
  review, verification and applicable authorization. A conversational preference
  does not waive these boundaries.

The lightweight preference path is a proposed policy clarification, not a claim
that arbitrary production edits are already permitted. Agree its boundary and
update the owning [practice-learning contract](../2a-design/practice-learning-loop.md)
before implementation if needed. Preserve exact approval for Gym-promoted
artifacts and any separately required production/owner approval. Prefer the
existing source change path over a new mutable preference database.

### Preserve the trust boundary

Standing authority should describe the target, allowed kinds of edits, activation
scope and resource budget. Within that scope, the agent need not ask for the
same permission at every step. It must still preserve accepted policy/evaluation
truth, inspect the exact changed source and report uncertainty. New permissions,
executable changes or production deployment follow their separate controls.
The agent-operated trial uses standing authority only in its temporary fixture;
it does not change the installed Gym exact-artifact approval contract.

Skills and knowledge guide judgment; they cannot install dependencies, supply
credentials, expand tool access, approve a mutation, or bypass another App's
controls. External observations are evidence, not instructions or authority.

Local TypeScript tools/workflows are trusted executable code, not sandboxed
documents. Review them as code; importing them may execute module-level code.
Skill discovery must not execute bundled scripts. Scripts run only through the
available execution capabilities and their actual restrictions.

Tool availability varies with execution policy. Report missing or filtered
capabilities clearly; do not advertise a tool that this attempt cannot use or
automatically broaden access to satisfy a skill. If an operation requires
read-only isolation, an "investigate" label or instruction is not sufficient.
Use an enforcing boundary or report that the guarantee is unavailable.

Removing an optional capability removes that ability, not the existing work
record. Affected work remains visible and cannot claim success from missing
feedback. Reuse existing recovery and wait review, without extension-owned
queues, retry workers or subscription bookkeeping.

## 6. Evidence from the current source

### Agent-operated improvement

The [focused trial](agent-operated-improvement-poc-20260912.md) supplies an
objective and synthetic standing authority, not an edit recipe. The improver
chooses the guidance change, invokes real source activation, handles an explicit
pre-admission failure, tests the active target and reports its result. Later
withheld cases check that claim. Fixture adapters expose existing execution and
reload capabilities; they are not an installed general improvement service.
Review tightened the recovery claim: require the exact failure result before
a later assistant retry request and its matching activation. The first two
trials lacked ordered evidence; a fresh follow-up establishes that sequence.
This checks what feedback was available before action, not private reasoning.

This tests **operability**, not whether agents can invent a better strategy from
arbitrary failures. Small successful examples do not establish a fleet-wide
reliability rate. The report records setup failures, costs and remaining limits.

### Method choice, lifetime and cross-agent teaching

The [method investigation](extension-methods-poc-20260912.md) distinguishes
source mechanics from agent behavior. A referenced policy and a discoverable
skill worked; an unreferenced document and a skill omitted by the bounded catalog
did not supply the policy. Explicit selection or an exact path restored use.
Do not interpret a model's honest missing-information answer as a reasoning
defect when the needed context was never delivered.

A separate agent authored and read back an isolated guidance candidate. Fresh
target executions used it, respected unknown scope and unrelated work, and
followed a revised policy. Rollback and reactivation changed later behavior.
This demonstrates scoped teaching with supplied authoritative knowledge, not
autonomous invention of better strategies or independent production promotion.
The harness supplied feedback and activated source; no installed App loop ran.

One invalid attempt failed before model work because the improver's manually
constructed definition omitted the provider credential binding. The correction
reused prior evidence and completed only unfinished cases. The failure remains
counted. Report extraction also separated carried-history tools/usage from the
new turn. Evaluation must diagnose its own setup and attribution before asking
an agent to repair behavior.

### Natural teaching and procedure selection

The [next-phase report](conversation-adoption-poc-20260912.md) records fourteen
real-daemon conversation turns, five pilot executions and twelve procedure
comparisons. May authored and activated a scoped rule, used it later, amended
and withdrew it, kept temporary scope, ignored hostile evidence and reported
failed activation honestly. The pilots exposed unclear source locations and
lost project scope; the report retains those failures.

The agent selected the optional workflow in two of six exposures. Direct
reads also followed the procedure. Both paths initially confused empty GitHub
commit-status contexts with pending checks, and the nominally clean fixture
lacked an explicit behavior contract. Clarifying the contract and provider
guidance corrected those examples without changing the collector. This
supports owner-scoped knowledge and dependable procedures as distinct needs,
not broader workflow enforcement or an unmeasured quality/speed claim.

### Focused execution trial

On Host `49272b5ac545aa2c4b7ab887c10183f5a76a8bd0`, the
[September 12 PoC](agent-adoption-poc-20260912.md) ran 31 model-backed executions
and offline source/runner boundary checks. The report preserves the comparison,
the prompt correction made during the trial, and sanitized answers/tool usage.

Loaded instructions and a discoverable skill adopted the review format in all
four relevant executions per arm; baseline and memory-only arms did not. All
retained the supplied defect. Unrelated writing stayed ordinary; temporary
guidance did not persist into a fresh baseline execution; an amended activated
rule replaced the original format. These are small controlled observations,
not general reliability rates, improved bug discovery, or deployed May proof.

A remaining review weakness was unsupported certainty about missing test
coverage. The supplied evidence established a defect and passing CI, not why
the checks missed it. Keep facts and inferred causes separate in the existing
review method; do not turn each example into another mandatory rule or workflow.

The follow-up [stability report](workflow-stability-poc-20260912.md) separately
examines required-step coverage, partial failure, revision changes, retry limits,
cancellation and retained evidence. It supersedes the first trial's overly broad
workflow recommendation, while retaining the original measurements unchanged.

### Earlier source investigation

The investigation compared Host `f614edbb` with local `origin/main` at `a8f65188`;
the inspected agent preparation, skill and loader files did not differ. Focused
checks used existing worktree revision `ed1192c1`, with the tested files unchanged
from that baseline. These are source observations, not deployed-runtime claims.

| Finding | Evidence and consequence |
| --- | --- |
| Ownership guidance conflicts | Workspace `shared/common-sense.md` calls agents domain owners; `agents/may/AGENTS.md` describes replaceable execution with App-owned outcomes. Align these before adding rules. |
| Catalog overflow is already observable | Local discovery of `agents/may` plus `shared/skills` found 21 valid skills; the 7,906-character prompt catalog omitted `verification`. Explicit access still worked. Paths/snapshots can change the exact count. |
| Behavior also lives in Host prompts | `src/app/conversations/turn-agent.ts` combines conversational choices and presentation guidance with the result contract. Keep mechanical protocol while moving duplicated policy to its owning capability, coordinated with the lifecycle work. |
| Explicit activation depends on the entry path | `prepareAgentExecution` activated a leading `$verification`; the same text inside a wrapped request did not activate it. The model may still read it. Follow the actual conversation adapter when fixing this gap. |
| Reload documentation overstates freshness | `SubagentManager.send()` resolves skills from `session.definition`; registration replaces the registry entry, not that captured definition. Prefer a documented snapshot over new live-refresh machinery. |
| Remembered does not necessarily mean supplied | The finish tool describes `context_updates` as future-session context, but normal `resolveSystemPrompt()` loads common sense, identity and the skill catalog, not `context.md`. Do not rely on a memory claim without proving the retrieval path. |
| Workflow support is not universal enablement | The workflow tool lists/runs scoped entries and workflow agent calls carry `skill`. The inspected local May config has no `workflow` preset or workflow directory. This is not itself a defect without a needed procedure. |
| Restriction labels need honest interpretation | The CLI runner reports normalization of requested sandbox modes to trusted full-access execution. Skill text must not imply an enforcing read-only boundary. |

Implementation references: [prompt and tool preparation](../../../may-agent/src/lib/agent-execution.ts),
[skill discovery](../../../may-agent/src/lib/skills.ts),
[session management](../../../may-agent/src/lib/manager.ts),
[workflow invocation](../../../may-agent/src/lib/workflow-tool.ts), and
[CLI execution](../../../may-agent/src/lib/cli-agent.ts).

The investigation ran 20 focused tests successfully in the existing isolated
checkout, covering skills, execution preparation and local tool discovery. The
canonical checkout first failed dependency resolution for the skill library;
that environment was not changed. Synthetic preparation/discovery probes made
no provider calls. These checks do not establish improved model behavior.

## 7. Implementation scope

The current deliverable is the agent-operated mechanism, now demonstrated in
the [bounded PoC](agent-operated-improvement-poc-20260912.md). One installed
adoption path is a separate next step. The earlier Gym integration candidates
below remain useful work, but completing that campaign is not a gate on this
mechanism or a process the human must operate.

The [feedback/adoption integration candidate](feedback-adoption-integration-20260912.md)
now fixes the feedback location and false source-promotion completion locally.
Four additional model checks used the real projection: later reads saw saved,
updated and cleared feedback without definition reload. Gym keeps source-only
promotion at existing owner attention; exact activation and subsequent Task
adoption still need integration. The candidate is not deployed, and the report
retains three pre-existing Evaluation heartbeat-test failures. Its ordinary-Task
follow-up records five model executions: an immediate-wake arm used old source
after reload, while the three fresh-dispatch checks used the expected source.
The same Task and generation survived. Adoption means the actual execution
used the change; a reload receipt alone does not prove that.

The linked-Gym no-model follow-up uses the existing App dependency return path
to bring exact source evidence back to the same improvement Task. It exposes
and fixes a source-event replay-key defect while preserving completed-copy
evidence. The production verifier still refuses source-only completion; owner
acceptance of relevant behavior evidence remains the next integration boundary.

The isolated teaching slice is complete; production adoption is not. Review
the focused [runtime PR #159](https://github.com/hao1939/may-agent/pull/159) and
[portable trial PR #160](https://github.com/hao1939/may-agent/pull/160). Keep the
experimental collector local unless a real App procedure justifies it.

### Source-contract correction before adoption

Follow-up inspection at Host `49272b5a` traced `finish()` through result
extraction, daemon subscribers and prompt preparation. The default daemon does
not attach the legacy context updater. `context_updates` is report evidence,
not an active preference; even a written `context.md` is not normally injected.
`completed_items` and `new_items` likewise do not perform their advertised
automatic Request mutations. Lesson storage is a best-effort local append with
no automatic future-session retrieval.

[Host PR #161](https://github.com/hao1939/may-agent/pull/161), candidate
`a31a957d`, corrects those model-visible promises without adding a new mechanism
or changing stored fields. Its focused regression checks cover successful and
unavailable lesson storage, report-only guidance and normal prompt assembly.
The existing session-lifecycle test already proves old-session explicit skill
activation stays pinned while newly prepared sessions use the replacement.
The persisted handoff also labels suggested follow-ups honestly; the optional
legacy context writer remains supported without promising automatic retrieval.
Together, 74 focused tests pass. Full local CI passes with 2,766 tests, three
installation-only skips and no failures; exact-head hosted Quality and Container
pass in [run 34677317802](https://github.com/hao1939/may-agent/actions/runs/34677317802).
Both initial review comments are resolved. Copilot approved the exact head with
zero new findings; the PR is ready for maintainer review, not merged or deployed.
No model call or installed guidance change was made for this correction.

The owning [skill contract](../2a-design/skills.md#discovery-lifecycle) now
describes execution snapshots rather than promising live freshness. It also
records the Console/Telegram selector-forwarding gap. The
[agent convention](../2b-manual/agent-convention.md#reporting-is-not-adoption)
distinguishes reporting, source edits, activation and later use. These are
truthful-contract corrections, not production adoption or a new learning policy.

### First: prove an agent can operate the mechanism

Give the agent a bounded improvement objective and standing authority over a
temporary target, but no edit locations or step-by-step recipe in the request.
Normal capability descriptions and discoverable conventions are appropriate;
hiding the interface would test guessing, not usability.

Use accepted read-only evidence, a target with an observed gap, and a small set
of later cases withheld from the improver. Require evidence that it:

- discovers the relevant source and facts without a human naming the files;
- chooses and authors a scoped durable change;
- distinguishes source edits, committed source and actual activation;
- uses a truthful failure result to recover or explain the remaining blocker;
- tests the active target itself and preserves unrelated behavior; and
- reports what changed, what was checked and what remains uncertain.

Code confines effects and returns actual results. The agent decides what to
change and whether its observations justify another try. Keep invalid experiment
runs separate from target failures; do not teach workarounds for a broken harness.
Independent withheld checks assess the agent's claim but are not a controller
that secretly repairs or activates its candidate.

### Then: expose the proved path in one authorized installation

Remove contradictory ownership guidance and duplicate policy for the selected
path. Keep Host execution/result requirements intact. Agree the lightweight
preference boundary and update the owning skill, agent-convention and learning
documents for the selected path; do not silently redefine accepted contracts.

The temporary daemon now proves May can interpret, author and activate the
correction naturally. For an authorized installation, supply its existing
source-change/operations capability and the clear source/scope conventions
tested in that trial. Do not install the fixture adapter as a new preference
API. Keep the human's later request ordinary, include a fresh conversation,
and inspect source and activation evidence rather than relying on "remembered."

For the agent-inferred learning path, first connect existing pieces rather than
introduce another controller. Evaluation currently prefers agent-local
`last-eval.md`, while shared guidance points elsewhere; normal preparation does
not inject either feedback body. Align one owned feedback/reference path and
verify actual consumption. Gym's approved-overlay branch verifies and copies
the candidate, but does not itself commit/reload/check active source. Keep
“source applied” distinct from “active,” then verify a fresh ordinary execution.
The [learning contract](../2a-design/practice-learning-loop.md#remaining-adoption-gaps)
records these gaps and the retained exact-artifact approval boundary.

When a task genuinely needs benchmark-based strategy comparison, reuse Gym's
bounded comparison rather than duplicating it. Gym is not required for ordinary
guidance edits or for proving agent usability. Use the existing Task
for responsibility, evidence and waits. Test targeted examples, separate input
combinations, previous behavior and non-applicable requests. Feedback can add
newly approved scope without implying the old candidate failed. Revise only
when valid evidence justifies it; invalid harness/provider/evaluator runs must
not train a permanent workaround into the target. Current automatic intake is
May-only; the isolated cross-agent result does not silently expand that scope.

### Verify the remaining installed boundaries

Make the method discoverable in the actual bounded catalog, not only the
six-skill synthetic catalog; preserve explicit skill selection where supported. Verify
actual tool policy and selected source.
If inspection is insufficient, extend the existing inspection result rather
than creating another subsystem. Retain the tested failed-activation,
temporary-only, amendment/withdrawal and unrelated-work boundaries. Prove
that a later execution can use the new definition without losing the existing
Conversation or Task identity. Do not enable workflows across the fleet.

### A focused dependable procedure

Both collectors exist only in the isolated PoC. Select one real bounded process
whose necessary sequence and failure behavior are clear. Known correctness
requirements can justify that procedure before repeated incidents occur. Reuse
existing helpers and already available packets. Preserve exact revisions and
explicit unavailable/partial results, validate input, and leave judgment with
the agent. The synthetic provider's revision-labelled comments are a simplified
contract, not a ready-made mapping to every real PR provider.

For any renewed workflow trial, compare direct agent work, skill-guided work,
and skill plus workflow using the same model, task scope and evidence.
Include a useful review finding, a clean
change, missing access, stale/incomplete evidence, and an unrelated request
where the method should not activate. Repeat ambiguous cases rather than
treating one good response as proof.

Evaluate required-step coverage and ordering, evidence consistency, honest partial
results, bounded retry, cancellation and recovery first. Also check finding quality,
unsupported claims, time, usage and maintenance cost. Equal findings are not a
workflow failure; an absence of observed agent mistakes is not proof that a
prompt enforces the procedure. Choose the smallest mechanism that provides the
needed guarantees at reasonable cost, without claiming an unmeasured failure-rate
improvement.

Test deterministic behavior with fake agent/provider results: invalid inputs,
failed collection, cancellation, evidence linkage and removed capability. When
the trial uses background continuation, also prove that a later fact reaches
the same Task and does not repeat a committed effect. Keep this proportional
to the actual first procedure rather than testing a hypothetical framework.

Use existing evaluation and execution records for comparison. Skill-load counts
are usage evidence, not success metrics. Do not let evaluation automatically
rewrite production guidance. Follow the agreed review boundary in section 5.
A separately authorized live trial is required before
claiming the real user experience improved.

## Review decisions and stopping point

The proposed decisions are:

1. Let humans teach through conversation; distinguish temporary instructions,
   standing scoped preferences and inferred lessons. Adopt the proportionate
   review path in section 5 rather than sending every correction through Gym.
2. Reuse existing files, activation, discovery and execution records; add no
   extension framework, preference registry or adoption lifecycle.
3. Treat workflows as optional callable procedures, with agent judgment inside
   them where useful; use App enforcement only for an actual required protocol.
4. Keep fixed execution snapshots and immediate human feedback distinct. New
   executions adopt activated guidance without replacing Tasks or conversations.
5. Prove agents can operate the correction-to-later-behavior path under bounded
   authority, without human-operated intermediate steps. Keep only the guidance
   and procedures whose benefit is demonstrated.

The mechanism slice is finished when an agent discovers, authors, activates and
verifies a scoped improvement without human-operated intermediate steps, and
independent later checks support its claim. It handles a bounded failure honestly
and preserves unrelated work. Existing evidence for temporary scope and source
lifetime remains applicable; a new trial must state which boundaries it actually
exercises. Production integration, durable Task continuity and any retained
workflow have their own evidence needs. Finishing a full Gym campaign is not an
acceptance requirement for this slice.

Core redesign, general automatic learning, new UI pages, fine-tuning, fleet-wide
enablement and production deployment are outside this proposal.
