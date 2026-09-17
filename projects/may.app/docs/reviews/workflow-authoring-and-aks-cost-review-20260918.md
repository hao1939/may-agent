# Workflow authoring, AKS reliability, and September 12 token usage

Reviewed September 18, 2026 (Asia/Shanghai). Review and read-only investigation;
no workflow activation, deployment, cloud test, model experiment or provider write.

**Recommendation: keep the reconciliation model and improve three boundaries:
what deserves judgment, what evidence reaches the agent, and what survives a
failed or superseded attempt.** AKS already has substantial reliable mechanics.
It needs consolidation and narrower judgment, not May's entire team graph or
another orchestration framework.

## Sources and version boundaries

| Source | Reviewed revision / meaning |
| --- | --- |
| Shared design and May App | `/app` at `cc428bdd0d`, including September 17–18 guidance |
| Host main | `dd548cab`, complete App-input handoff |
| Latest shared-execution Host candidate | `4bdd5384`, ahead of main; contribution and failure-evidence refinements |
| AKS main | `033780f64b4a6964c92a031ac55765d4d1082eb7` |
| Previous local AKS fixes | `66856c182c3e2c19127c7d43ad521b9b71bd2198`, paired with Host `70379db7382479f5fd80b3c8408e2e1a86854ed0`; not pushed or deployed |
| MLVM observed this review | Existing container healthy, image `aks-v3.0.1-6935b325`; this is not the latest local Host/App candidate |
| September 12 usage | Frozen audit of retained MLVM trial sessions, day in Asia/Shanghai; not local Codex monitoring usage |

The prior local fixes cover creator revisions, saving corrections during execution,
pipeline observation recovery, publication acknowledgment, workflow/workspace
admission and failed Git fetches. Their recorded gates passed: Host 3,103 tests
with three installation-specific skips; App 1,146 tests plus two workflow-input
checks. Those are **previous verification results**, not fresh live proof in this
review. See [the comparison](aks-rp-e2e-review-comparison-20260916.md) and the AKS
candidate's `design/workflow-reliability-fixes.md`.

Current guidance:

- [Workflow design](../../../may-agent.app/docs/2a-design/workflows.md)
- [Authoring manual](../../../may-agent.app/docs/2b-manual/workflow-authoring.md)
- [May development procedure](../development-workflow.md)
- [Shared execution trials](../shared-execution-iteration-20260917.md)
- [Context-cost proposal](../../../may-agent.app/docs/proposals/focused-session-continuation.md)

## How to write a workflow using May as an example

Start with one sentence describing its contribution and what proves it. For May's
`develop-change`, that contribution is a local committed change, checked and
reviewed at the exact commit. It does not also own PR creation, ADO, merge or
deployment. The caller still judges whether the contribution fulfills the Task.

The normal process is:

```text
Task wakes -> read current requirements, facts and retained work
           -> reuse what is still valid
           -> do the missing bounded work and check it
           -> save evidence and return a contribution
           -> owning Task reconciles the remaining outcome
```

An agent can call a tool synchronously within that work. A long pipeline or human
wait belongs to existing Task Conditions/dependencies; return control while it
runs. Running and having outstanding waits are independent. A test event, human
correction or periodic recovery wake all lead to the same current-state check.
They need not each have another workflow graph.

| Authoring decision | May example | Apply to AKS |
| --- | --- | --- |
| Declare the contribution | A verified local candidate, with typed design/implementation/review decisions | A preparation plan, an evidence assessment, or a provider operation's observed result; distinguish these from whole-PR readiness |
| Separate judgment from mechanics | Bob judges; tech-lead edits; code runs verification and checks the reviewed commit | Agent diagnoses coverage/failures; App code checks identities, scope, provider observations and authorized effects |
| Give the specialist its assignment | Shared Task context plus the current contribution | Ask about affected runs/findings; keep the broader outcome discoverable |
| Reuse valid work | Design, checks and review are tied to requirements and candidate | Reuse preparation, check receipts and provider runs when their actual inputs still match |
| Repair locally when useful | A small repair loop inside one attempt | Feed a failed check back to the same worker; return partial work when a new decision or external prerequisite is needed |
| React at a checkpoint | May checks current requirements around calls and verification | Check after substantial work and before provider effects; preserve superseded source/evidence for the next pass |
| Retain incomplete evidence | May saves helper receipts before validating their status | Keep helper output, logs, candidate and next unresolved decision even when execution fails |
| Recover durably | The Task starts another reconciliation | Reobserve exact existing PR/run identities; do not create replacement work because a response was lost |

Use a required App procedure where effects must follow a fixed policy. Otherwise
let the agent choose an appropriate method. May's three-round limit is a local
choice, not a system standard. Inner repair iterations share the attempt's
allowance; the model decides whether repair, redesign, clarification or return is
useful. Code need not ask the model to track elapsed-time counters.

May demonstrates the contract, but it is not a finished efficiency template:

- A new event batch invalidates design/review in `develop-change.ts:277`, even if
  the change is informational. Reuse is conservative, not semantically precise.
- Every specialist can receive up to 16K characters of events, 12K of tracked
  paths and 48K of diff, alongside Task context. The diff is read before it is
  sliced and the command has a 2 MiB output limit. This needs large-repository
  testing before reuse as a general context builder.
- Its shared cancellation-aware command helper is useful, but the fixed
  120-second command timeout is not automatically appropriate for AKS tests.
- The current live trials show useful handoffs and correction recovery, not that
  two specialists beat one agent on cost or that every request needs a team.
- Live feedback does not automatically acknowledge incorporated input. A later
  owner pass may still be needed; that is a known shared-contract limit.

Relevant May implementation: `agents/may/workflows/develop-change.ts:230–384`
and `agents/may/workflows/lib/repository.ts:19–129` in `projects/may.app`.

## What works in AKS

The overall split is useful: standing workflows discover and supervise; source
workflows repair in isolated worktrees; observers collect provider facts; the
Host owns durable recovery. AKS does not need an additional Bob stage before
every repair.

- Master already excludes ordinary elapsed-time counters and timeline-only
  passes from its judgment key. Hygiene uses per-child judgment keys and skips
  unchanged no-action decisions. These are valuable existing code paths.
- Existing PR readiness retains preparation against source, target, review and
  input identity, supports local repair iterations, and releases workers for ADO.
- Exact-head proof, review, coverage and cleanup checks prevent a green pipeline
  or a published PR from being mistaken for readiness.
- Provider discovery and source-bound receipts recover ambiguous writes; stable
  repair identities discourage one new Task per observed failure.
- Test Health keeps source/target cohorts distinct, exposes missing observations
  as unknown, pages evidence, and can discover a new issue while repairs wait.
- The previous fixes improve eventual recovery without adding a second queue or
  locking requirement edits behind execution state.

These mechanisms support real work. The question is whether each further model
call advances a useful decision at a reasonable cost.

## What remains weak and how to improve it

AKS code paths below are relative to `agents/owner/workflows/` unless stated
otherwise. Recommendations concern the local fixes candidate as well as main
where the same path remains.

### 1. One small change can cause a broad reassessment

Master hashes the combined owner evidence, feedback, telemetry and run evidence
(`master-validation.ts:1318–1369`). Its compact context still maps every run,
owner, Task and PR (`:294–399`). With hundreds of active owners, a changed key is
common even when only one conclusion needs attention. Per-record shortening does
not bound the total prompt. This remains in the local fixes candidate.

**Change:** keep complete evidence in the existing store. Provide the previous
conclusions, changed records and a complete paged index. Ask the agent which
conclusions need revision. Preserve a periodic overview and all unresolved
findings so selective reading cannot silently lose ownership. Start by changing
context only; evaluate judgment-frequency changes separately. No generic semantic
filter in the Host and no automatic inference that an omitted finding is resolved.

### 2. Some evidence keys track representation rather than evidence

`artifactFacts` (`master-validation.ts:1048`) hashes paths, sizes and modification
times, not file contents. A direct probe of the actual candidate function showed:

- Touching unchanged JSON changes its fingerprint.
- Changing equal-length JSON while restoring the timestamp keeps its fingerprint.

This can buy unnecessary judgment or miss changed evidence. It is a reproduced
key defect; this review has **not** attributed a measured fraction of September
12 calls to it. The same implementation exists in the two hash-verified historical
Master bundles inspected below. Reuse content digests from collection, or compute them once when
materializing evidence. Keep collection time as freshness metadata.

Test Health also includes `observedAt`, query/window text and other complete
observation fields in its key (`test-health.ts:336`). An hourly refresh therefore
requests judgment even when rows/source remain unchanged. That is partly the
current discovery policy, not necessarily a defect. Separate the reason to
refresh the portfolio from the identity of unchanged source evidence; retain
meaningful changes when rows enter or leave the time window.

### 3. Recovery still loses useful distinctions at the helper boundary

`lib/agent-output.ts:6` throws for every non-`done` result. This helped stop old
provider failures becoming permanently cached domain blockers. Under the newer
shared contribution contract, however, a legitimate `blocked`/partial helper
result can contain the design decision or missing prerequisite the caller needs.
A direct probe returned `blocked` with a saved report and got a generic exception.

**Change:** retain the complete helper receipt first. Let the owning workflow
interpret a completed negative judgment or blocked contribution. Propagate actual
execution failure/cancellation through normal Host recovery, carrying partial
evidence where available. Do not count partial work as accepted preparation.
Adopt this together with the matching shared-result SDK; it is a migration gap,
not proof that every old session with `blocked` used the newer semantics.

Some older publication branches separately turn unsuccessful sessions into
`ctx.blocked` (`non-spec-main-publication.ts:1827,1984`). Consolidate the boundary
when those paths are migrated; do not introduce error-message classifiers or
another retry scheduler. May's receipt-before-validation order is the useful
pattern to copy.

### 4. Current requirements and cancellation need consistent checkpoints

The PR repair loop captures Task input once (`existing-pr-readiness.ts:963`),
then can make several calls and checks. It rechecks PR/provider facts extensively,
but a current Task-generation check is explicit in the special abandonment path
(`:1365`) and absent from the ordinary post-preparation push path (`:1944`).
`runLocalPreparationChecks` uses synchronous child processes without `ctx.signal`
(`:491`). Several helper calls still have separate 10/15-minute and operation caps.

**Change:** use the shared attempt signal for cooperative commands, save receipts,
and check current requirements at ordinary step/effect boundaries. Reuse one small
App check in relevant effect paths. A superseded candidate can remain useful
evidence but must be reconsidered before more effects. Keep exact provider/source
fences too: a Task check alone does not establish that a remote PR is unchanged.
Prefer inherited attempt limits unless a particular command needs a justified
limit. Do not simply increase every timeout.

This is source-level evidence of uneven checkpoints, not a reproduced remote
unauthorized push. It does not require locking spec writes, immediately killing
an active agent on every update, or promising atomicity across Git and ADO.

### 5. Discovery can create demand faster than completion capacity

Test Health deliberately continues investigating the catalog. Its per-observation
attempted-spec list prevents one simple repeated selection, but does not make an
unlimited standing discovery objective inexpensive. Hygiene's worker slots govern
execution capacity; they do not by themselves govern how much new repair scope
Test Health creates.

**Change:** express discovery priorities and acceptable effort in the existing
parent goal/App input. Let the owner balance another investigation against current
review, validation and human capacity. Retain useful unassigned findings in the
existing assessment. Code can enforce an agreed admission/attempt limit; the agent
judges which work deserves it. Reaching a discovery allowance should not stop
existing repair, cleanup or external-result reconciliation. Lowering concurrency
alone mostly delays the same work and bill.

### 6. Agent guidance contains too much procedural history

Preparation prompts repeat provider sequencing, several validation-route
exceptions, dependency setup incidents, source-scope rules and prior instructions.
The owner prompt also covers unrelated normalization and publication procedures.
Current Test Health documentation still says not to rewrite busy Tasks, contrary
to the newly fixed independent spec/status contract.

**Change:** keep durable principles and the assigned decision in the prompt. Move
route-specific knowledge into discoverable App guidance, with code supplying the
actual capabilities and failed-check evidence. Keep one typed plan and one
mechanical validation path; tell the agent why a plan was rejected rather than
requiring it to memorize every recovery route. Correct superseded prescriptive
docs; retain historical experiment records as history. Do not remove exact-source
or cleanup checks merely to reduce line count.

## September 12: the measured cost problem

The audited window is **September 12, 00:00–24:00 Asia/Shanghai**, equivalent to
September 11 16:00–September 12 16:00 UTC. The frozen dataset cutoff is September
14, 13:41:47 Shanghai. It covers the separate MLVM AKS trial, using `aks-explorer`,
`gpt-5.6-sol`, and provider label `github-copilot` through the Pi SDK.

| Activity | Recorded tokens | Share | Agent invocations | Model replies |
| --- | ---: | ---: | ---: | ---: |
| PR preparation | 1,875,636,709 | 42.6% | 1,491 | 21,018 |
| Source repair | 901,205,480 | 20.5% | 220 | 10,223 |
| Master assessment | 811,275,285 | 18.4% | 1,120 | 2,800 |
| Test Health discovery | 714,784,655 | 16.2% | 629 | 4,809 |
| PR live-test assessment | 88,697,056 | 2.0% | 239 | 1,177 |
| Other reconciliation | 14,157,543 | 0.3% | 83 | 252 |
| **Total** | **4,405,756,728** | **100%** | **3,782** | **40,279** |

Of that total, 3,338,833,520 were cache reads, 344,341,028 cache writes,
693,859,309 ordinary input and 28,722,871 output. **99.35% was input exposure**;
76.3% of input was cache reads. Reasoning is already included in reported output.
These are recorded token counts, not an invoice or uncached-token price estimate.
Do not add a second Pi CLI total or local Codex monitoring counters to this cohort.

The main findings from the retained audit are:

- **Master repeatedly processed a near-million-character brief.** Median initial
  model input was 289,149 tokens; median invocation spacing was 65 seconds. Owner
  records accounted for 48.1% of serialized field characters, runs 29.9%, and Task
  inventory 8.3%. Owner evidence had 1,098 distinct hashes across 1,120 calls: the
  code could see changed facts almost constantly while the overall outcome stayed
  unhealthy. This supports broad reassessment as a cause; it does not identify the
  exact historical trigger field for every call.
- **Repeated conclusions were expensive.** 208 Master invocations repeated the
  entire previous structured result and used 134.4M tokens; 424 repeated the
  findings array and used 282.0M. These groups overlap and must not be added.
  Identical results are candidates for improvement, not automatic proof of waste:
  changed evidence can legitimately confirm the same conclusion.
- **PR preparation repeatedly carried review history.** 202 PRs produced 1,491
  preparation invocations. The largest one used 20.37M tokens over 70 replies and
  ended at 15 minutes. Its 531K-character prompt included 121 review threads;
  27 had explicit resolved dispositions. Missing status on other threads cannot
  be treated as proof that they were unresolved. That PR had 27 preparation
  invocations totaling 98.2M, including real repair work.
- **Discovery was sustained work, not just retry churn.** Test Health had 629
  invocations and 488 distinct, non-normalized next-investigation values. Source
  repair had only about 6.4K median starting tokens but many coding/tool turns.
  These categories need useful-outcome measures, not indiscriminate call removal.
- **Failures are secondary to the total.** 48 failed/interrupted invocations cost
  99.85M tokens, 2.27% of the day. They include 37 empty Test Health completions
  and seven PR preparation timeouts. Fix completion/recovery boundaries, but a
  retry cap cannot solve the much larger normally completed workload.

A retained lossless PR-context replay reduced new follow-up characters by 57.6%,
but retaining all updates caused about 3.03 times the prompt exposure without
compaction. Neither is a measured token saving. **Try concise fresh context before
adopting persistent transcripts.** The existing context-preparation hook can host
a policy; the hook itself does not save tokens or decide relevant domain evidence.

## Smallest implementation and evaluation sequence

The Host supplies execution, identity, recovery and measurements. App workflows
own domain procedures and evidence meaning, even when written in TypeScript.
Agent guidance teaches investigation and judgment. The proposed changes fit
those existing responsibilities; none requires a new core workflow framework.

1. **Integrate the existing correctness fixes with the chosen Host/SDK.** Verify
   actual installed observer wiring, not only helper tests. Add focused coverage
   for a blocked contribution, retained partial evidence, cancellation and a
   requirement change during preparation. Reuse normal settlement/recovery.
2. **Trial a smaller Master brief.** Keep the model, evidence, calls and acceptance
   constant first. Compare baseline, agent guidance, App context preparation, and
   both. Use existing evidence files and reads; add a reader only for a demonstrated
   retrieval gap. Check all required facts remain reachable.
3. **Improve relevant-change keys and PR preparation context.** Replace file-time
   identity, explain why existing preparation was invalidated, and supply changed
   review findings with links to the full history. Evaluate fewer global judgments
   separately from cheaper judgments so savings are not double counted.
4. **Tune discovery scope against completed outcomes.** Trial a bounded goal with
   real review/validation constraints. Keep unresolved findings and existing waits
   visible. Retire redundant route prose only after the normal path is explicit.

Use the existing usage collector and dashboard rather than another monitoring
service. The latest Host candidate already records per-invocation model/preparer,
Task/workflow identity, ordinary input, cache reads/writes, output, replies, tools,
duration and measurement completeness (`src/lib/execution-usage.ts` and
`src/app/adapters/reporting/context-usage.ts`). It excludes child usage from parent
counters. Check installed availability before relying on it on MLVM.
Its window selects invocations by start time; the historical daily audit selects
model replies in the day. Use a consistent cohort when comparing variants,
especially for attempts crossing midnight.

Add only the missing App decision facts through ordinary results: assessment
reason, changed-evidence reference, reused work, investigated findings and actual
disposition. Dashboard views should relate usage to the workflow phase and exact
Task, then show cost per useful finding, verified candidate or ready PR. An agent
invocation returning `done` is not that outcome. Keep cumulative totals available
when paged/grouped views are truncated; show missing measurements as unknown.

Acceptance fixtures should include unchanged facts, new/reopened findings, changed
source and ownership, missing artifacts, a spec update during work, interrupted
helpers, and lost/duplicated completion events. Compare full-sequence tokens,
latency, repeated reads and preserved decisions. The roughly 20K-token Master
starting brief remains an experimental target, not a hard truncation rule or
promised saving. The new variant must detect required failures and preserve
coverage, ownership and cleanup obligations before any rollout.

## Evidence retained for this review

The saved investigation is under the local private usage-report directory:
`/home/hao/codex-usage/2026-09-13/investigations/2026-09-12-mlvm-may/`.
Its `findings.md`, `findings-data.json`, `counter-analysis.json`,
`retained-session-audit.json` and session-continuation comparison provide the
historical analysis. The original audit reconciled all 3,782 sessions with SDK
records and inspected detailed prompt/tool metadata for 50 deterministic samples.

This review independently recomputed the aggregate and activity arithmetic across
all 3,782 unique saved session counters. After Azure login was refreshed, four
selected retained MLVM sessions were reread: the largest preparation, largest
Master, largest Test Health, and the cited routine-progress Master example.
All four raw usage totals and prompt hashes match the frozen audit. The hash
comparison uses the original audit's JSON-serialized-string encoding; comparing
raw string bytes initially mismatched and was corrected in the review helper.
No transcripts or credentials
were copied into this repository. Private check results and input hashes are under
`/app/.state/workflow-guidance-review-20260918/`.

The current source probes call the real `artifactFacts`, `masterObservationKey`
and `completedAgentOutput` helpers with temporary/synthetic inputs. They establish
those narrow behaviors, not an end-to-end provider incident or measured savings.
For the two sampled Master invocations, the retained workflow bundles also match
their recorded `entryContentHash` (`f25719c4…` and `63f110b1…`). Both include all
owner evidence in the assessment key and the timestamp-based artifact fingerprint.
This connects those mechanisms to actual September 12 execution, rather than only
to today's source. It does not prove the exact trigger for every historical call
or establish full-day deployment provenance. Current source and September 13
excerpts alone are not evidence of every September 12 invocation's implementation.
