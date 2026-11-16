# Host ingress and SDK source review — 2026-11-16

**Supports:** [Host/App boundary](../../2a-design/system-boundary.md#ingress-task-process-and-bounded-execution). Retains the source evidence behind promoted contracts while keeping incomplete integration visible.

**Status:** Source review, not deployment evidence. Reviewed Host `main` at
`cb1304161187a51e62e8a3a5a64ef3b772501c3b`. Established rules are promoted into
the owning [SDK](../../2a-design/sdk.md), [shared runtime](../../2a-design/agent-runtime.md),
[events](../../2a-design/events.md), [storage](../../2a-design/storage.md),
[App](../../2a-design/agent-app.md) and [Conversation](../../2a-design/conversation-execution.md)
contracts. The [active follow-up](../../proposals/host-ingress-and-boundary-simplification-20261116.md)
owns remaining work. An older local checkout and an installed artifact can have
different behavior from these merged sources. The [local repair](#local-correctness-and-compatibility-repair)
records later changes and checks against #572.

## Merged source and limits

| PR | Merge revision | Completed source | Limit |
| --- | --- | --- | --- |
| [#563](https://github.com/hao1939/may-agent/pull/563) | `d4ee090960` | Standalone skill, context/service, snapshot and workspace rules converge on shared preparation. | Does not establish unchanged Host `run()` supervision. |
| [#568](https://github.com/hao1939/may-agent/pull/568) | `684e8c731055869b74e960e2f8a2272e6d4b1a8d` | Removes addressed-agent `message.created` and special escalation routing; retires event-pair lifecycle/restart tracking and its retention dependency. | Event journaling still has delivery bookkeeping; child SQLite writers remain. |
| [#569](https://github.com/hao1939/may-agent/pull/569) | `a32a2ad1a69e79d0d8459e64388db6ab3277e21f` | One external human Task read path, raw-JSON project action removal, Task-message endpoint used by Kanban. | Saved-project identity remains; generation is checked before, not transactionally at, attachment. |
| [#566](https://github.com/hao1939/may-agent/pull/566) | `8b2fd7da2a58372ec1e641c26d297571331dfe1e` | Root/App authoring split, direct domain input, finish vocabulary, legacy read normalization, bounded helper/provider lifecycle and a result-settlement component. | The shared-run Host draft and companion Apps/Gym were not integrated by this merge. |
| [#570](https://github.com/hao1939/may-agent/pull/570) | `cb1304161187a51e62e8a3a5a64ef3b772501c3b` | Removes parallel Conversation-Task change discovery and supervision review routing; retains exact inbox-backed result refresh/recovery. | No full retained-relationship migration, Conversation execution-Task retirement or completion Hook cutover. |

## Execution and settlement findings

At the reviewed source, `translateHostedExecutionResult` is referenced by its
tests but has no production executor caller. `managed-agent.ts` still imports
the Task finish schema and prepares Task-specific instructions. The attempt
process still constructs `DbWriter`. SDK component completion therefore does
not satisfy hosted payload parity, parent-only SQLite or connected auto-closure.

The published #566 head `9e18150c7d0e0ddbb8d1237c69482a5c37bc5c70`
repaired the previously failing deadline/cleanup behavior. It also sends done
envelopes through normal Task admission before granting finite-done provenance,
retains arrays above 32 facts as exact JSON evidence, rejects oversized domain
output, validates persisted summaries and makes unused finish path context
optional. Historical false/null facts and blocked-only evidence stay readable.
The original failed CI and intermediate repair receipts are retained in the PR;
a later pass does not erase those observations.

The PR reports a clean full local/hosted run of 3,431 passing tests, no failures
and two optional installed-definition skips. GitHub Quality and Container passed
on its final published head and on merged `8b2fd7da2a`. At this documentation
review, both checks also passed on `cb13041611`. These are Host/component checks,
not proof that installed Apps or the unconnected shared-run executor work.
No full Host suite or model-backed invocation was rerun for this documentation
promotion.

Root SDK purity is partial: root deferral types carry Task/root identities and
`ExecutionResult.cliCalls` reaches a `taskId`. A snapshot that only checks exported
symbol names cannot certify the intended Task-blind execution contract. Current
workspace authoring still uses `task`, not the proposed `isolated` spelling.

Finite-done closure currently excludes Conversation and Task-created/delegated
work and retains same-App creator, accepted-result, wait/input and attempt fences.
The existing component is not a universal rule that every helper returning done
closes a durable Task. Standing-duty eligibility and connected App behavior still
need explicit treatment before retiring mechanical closure procedures.

## Ingress, read and Conversation findings

The Task input HTTP handler serializes `expectedGeneration` into message context
and checks the Task before publishing. The existing-Task attachment created by
`AppInboxHost` does not carry an equivalent trusted transactional fence through
recovery. Accepted retry identity must be preserved while repairing that race.

The simplified `projects.js` still fetches both `/api/apps` and `/api/projects`
and renders saved projects. Project comments already publish `app.input.requested`;
they do not emit `project.comment.created` at this reviewed revision. App identity,
legacy project reads and canonical human ingress remain separate follow-up.

#570 removes change discovery used by Topic-only links and retained
`conversation-follow-up:` admissions. `refreshTaskResults()` and
`recoverTaskResults()` select exact inbox-backed waits, not every retained Topic
subscription. Topic hydration now reads only `conversation_topic_tasks`, losing
references previously derived from legacy admissions. Source review confirms
those coverage differences; the PR review records pending legacy/Topic delivery,
closure and historical-reference findings. No installed lost-result incident is
claimed. The stale Telegram fixture option was removed, and the final source
retains contribution-only legacy input reading; those fixes do not supply the
missing return migration.

## Paired source verification

A read-only paired check used the current Apps working tree and the frozen SDK
at `9e18150c7d`; that SDK tree matches merged `cb13041611`. It reported
**127 diagnostics across 24 workflows**: moved root exports, Task-aware context
properties and associated build/type errors. This is a working-tree measurement,
not a compatible immutable App release. No current integrated App revision or
activation receipt is established by it.

The normal `bun run check:may-design` baseline passed against the older local
Host `d4ee090960`: design integrity, executable examples, 24-workflow App checks
and nine-agent model-surface checks. Its sole warning was an existing unclassified
root `.cache` directory. That pass and the failed newer-SDK pairing answer
different questions. Reproduce the paired check with
`MAY_AGENT_RUNTIME_ROOT=<exact-new-Host-checkout> bun scripts/check-canonical-agent-app.ts --final-runtime`;
the default local checkout is not automatically the merged Host.

The earlier domain-worker prototype at App `497facfa84` was paired with SDK
`6bc5bbb967` and reported 103 focused passing tests. Later App work has changed
the current procedure. That prototype does not establish current App input
translation, wake-up, `priorEvidence` reconstruction, whole-App compatibility or
Host execution. Preserve its domain acceptance and continuation lessons when
integrating a current pair.

## Local correctness and compatibility repair

The follow-up Host branch `fix/host-boundary-integration-20261116` is based on
`f70f55ab5e3c881838b13419554a4cd3e4276f68` (#572). That merged baseline also includes
#571's preservation of blank public execution facts. #572 intentionally removes
snapshot file pinning and standalone `workspace: "task"` Git-checkout preflight;
this repair retains those changes. The earlier #563 snapshot/preflight entry is
historical, not the current standalone guarantee.

The Host patch persists `targetTaskGeneration` from HTTP/Event admission to the
inbox and validates it inside Task attachment's transaction. Already accepted
admissions replay before current-generation checks. Exact HTTP confirmation
covers old and new envelopes. No generation is guessed for historical rows.
Regressions cover delayed attachment across a fresh database connection,
requirements revision, closure, conflicting replay, and HTTP replay after a
generation change, including an old accepted publication.

The patch also restores retained Topic/legacy handoff delivery using existing
receipts, in a separate compatibility reader. Live notifications and periodic
recovery are both wired; the retired supervision command stays retired.
Regressions include an actual legacy handoff without a Topic subscription,
contribution-only worker authority, historical Topic hydration, restart, closure,
late links, grouped overflow, duplicate delivery, Stop and open Requests.
The delivery receipt index is retained because this reader still needs it.

The companion App branch `fix/app-sdk-context-adoption-20261116` is based on
`29bf16eb71d793721641cc05b329e8cd887f4f2d`. It moves App/Task symbols and legacy
Host-aware context to `/app`; bounded procedures use root `AgentContext`.
The paired check against the Host repair reports **0 diagnostics across 24
workflows**. Legacy `develop-change` still requires App capabilities: its Host
fixture exercises requirements/check selection, while standalone verifies a
blocked result before effects. The old test expectation that standalone injects
a Task envelope was obsolete. This patch does not claim a domain-only development
worker, automatic blocked continuation, hosted payload parity or deployment.

The companion also migrates Gym's direct and embedded scoring imports, removes
obsolete standalone Task-envelope options and uses the public `done`/`output`
finish vocabulary in helper prompts and recovery fixtures. The real Gym adapter
now verifies that retained Task-aware development blocks before specialist calls
or source edits, cleans up, and earns no scenario success credit. Successful
bounded execution and the Host development/verification loop retain their own
regressions. A stale metric fixture's `callAgent` override is updated to `call`;
its accepted decisions, restart recovery and retained Request tests pass. May
also retires the obsolete `event.pair-orphan-count` source through normal App
definition activation: #568 removed its table. The migration preserves snapshots,
resolves old alerts and leaves the metric with no collector or threshold.

Verification of these local, unmerged changes:

| Check | Result |
| --- | --- |
| Host `bun run ci`, four shards | 3,444 pass, 0 fail; two optional installed-definition skips. Includes type, lint and SDK boundary checks and real browser tests. |
| App default health suite | 1,099 pass, 0 fail across 75 files, with the installation markers and PDF-reader dependency described below. |
| App root `bun run typecheck` | Passed against the selected Host source SDK. |
| Paired canonical App check, `--final-runtime` | 0 diagnostics across 24 workflows. |
| `bun run check:may-design` | Design integrity and executable examples pass; 24 workflows and 9 agent model surfaces pass. |
| Gym `bun run check` | Typecheck/build, 337 Bun tests and six Node scoring tests pass; 121 active cases have zero structural errors; 508 archived runnable scenarios have zero errors and 580 legacy metadata warnings; all 1,488 offline benchmark-review checks pass. |
| Focused metric acceptance and recovery | 22 pass, 0 fail, including accepted effort disposition and restart. |
| Reliability collection and metric retirement | 25 pass, 0 fail; retirement preserves 98 historical metric series and removes their collectors. |
| Scout finish guidance and source assessment | 67 pass, 0 fail; includes actual fixture PDF extraction with the provisioned reader dependency supplied through `PYTHONPATH`. |
| Shared integration and tools | 87 pass, 0 fail across 12 files; includes installed exhausted-Task recovery to its original owner and public SDK file-write policy checks. |

The companion uses the same ignored `.disabled` markers as the shared installation
(Alex, May and Scout active), and the provisioned PDF-reader dependency through
`PYTHONPATH`. The installed recovery fixture disables unrelated observers when
no observer context is supplied. File-policy tests use public SDK runtime exports
instead of retired Host-private files.

The Host gate used Bun 1.3.14/Node 24.21.0 and four test shards. Its Docker CLI
wrapper supports isolated Compose configuration tests; no daemon operation or
runtime rollout was performed. Neither model-backed experiments nor current
installation behavior were measured. Neither branch changes a running
installation.

## Host responsibility clarification

The follow-up design clarification assigns domain judgment and conclusions to
the agent/App contract. Host owns reliable execution, admission, faithful
records, supported effect safety, recovery and delivery. Result admission
commits the declared judgment; process exit, committed result, caller delivery
and fulfillment of a wider Request remain separate facts. The
[owning matrix](../../2a-design/system-boundary.md#responsibilities-through-a-task)
and [attempt contract](../../2a-design/task-attempts.md#agent-judgment-and-infra-admission)
retain these accepted rules. The active proposal owns incomplete wiring and its
acceptance scenarios, without adding a review agent or another lifecycle.

At Host `f70f55ab5e3c881838b13419554a4cd3e4276f68`,
`src/app/composition/workers/task-attempt-process.ts` exposes optional parent
`timeoutMs` in the attempt/recovery factories and applies the timeout in
`waitForChild`. `src/app/app-runtime.ts` constructs both executors with only
`bus` and `definitionSource`. Worker-local bounds therefore do not establish
parent containment of a synchronous/non-cooperative child. The local correctness
repair leaves that production wiring unchanged. The proposal now carries it as
an explicit integration gap alongside shared invocation and caller settlement.

This clarification changes documentation only. Earlier test totals describe the
local source repairs above; they do not prove the unimplemented supervision or
connected-worker requirements. Domain progress judgments and human escalation
remain with their declared owners; Host routes evidence and enforces the
existing controls and limits.

## Local paired activation and native delivery trial

The user subsequently authorized testing in the local May instance, replacing its
binary and preparing fix PRs. That changes the authority for this trial; the
source-only results above remain historical observations.

The integrated Host revision is `f822e8a6c6eacbf7dfb40d7e6bb9ed0f5e64d7b0`,
including latest-main `56c52db022` and the local boundary repair. Draft
[PR #577](https://github.com/hao1939/may-agent/pull/577) has successful Quality and
Container checks on that head. Fresh local full CI reports **3,423 pass, zero
failures and two optional installed-definition skips**, including real browser
coverage. Test totals differ from the earlier baseline and are not additive.

Companion Apps commits `ba611667f3` and `cb07caf34061` include scoped SDK adoption,
an explicit saved `developmentCheckout` selector for the retained development
workflow, and the GitHub-review/Telegram-notification boundary. Full default App
tests report **1,110 pass, zero failures**; root typecheck, design examples and the
paired final-runtime check pass with **25 workflows**. The selector has real-Git
coverage; native specialist use is still an experiment obligation.

Paired local activation succeeded. The deployed Host artifact and loaded binary
SHA-256 match `d67d19121563d8436a29d638c1cd0e4cdc8d79d8df1549e9875cc475d8205ea7`;
startup identifies Apps `cb07caf3406157483ada6919ba6e6c1c7c5b0bc4`. Installed
capability discovery advertises Alex's GitHub PR watcher with CI/comment coverage.
The preceding old-binary App reload failed safely with a bare “Bundle failed”
diagnostic; its failure did not certify activation. Improving that diagnostic is
the bounded useful coding assignment for the native trial.

The native trial completed through the existing Task/workflow/watcher/Condition
and retained caller-return path. May admitted one assignment and delegated one
Alex Task. The first publication reported a database lock and an exact retry
lost its reply; readback confirmed one durable input. Recovery work delayed
startup about eleven minutes; one supported exact-Task continuation was sent.
No duplicate assignment, direct state mutation or renewed workflow allowance
was used.

Alex invoked the installed `develop-change` with the explicit Host checkout.
Bob provided design/review and tech-lead implemented a two-file fix at
`b5fd2c920cd9c2c283434062382ec1ac5ac65c3e`, using **one of three cumulative rounds**.
Ten targeted tests and `check:ci` passed. Alex published/read back stacked
[PR #579](https://github.com/hao1939/may-agent/pull/579), retaining its original
Task owner block, branch, head and base above #577.

The first accepted result waited on a fingerprint-change Condition. The exact
resource observer supplied real CI-running facts; Host woke the same Task, and
Alex accepted another waiting result rearming from that fingerprint. The normal
15-minute live watcher then supplied both Quality and Container successful on
the published head. A third accepted Alex result returned the ready PR to May.
May's caller started about two seconds later, saved the GitHub-review notice and
fulfilled the original Request. Telegram returned a provider message ID for the
single-chunk notification. Alex admission to Telegram took about **26 minutes**;
CI completion to the next watcher observation took about **six minutes**.

This proves a real CI transition and same-Task continuation, not a live repair
cycle or human-comment response: no repair-required failure or new comment
occurred. May corrected a rejected communication shape within its invocation.
The result did not require a Telegram approval or merge/deployment of the fix.

Limits observed in this run remain explicit:

- One operator continuation followed the recovery queue delay; zero-intervention
  operation under that backlog is not established.
- Alex's accepted coding result is converged/idle with no Conditions; the Task
  remains nonterminal. Its closure recommendation did not execute creator closure.
  The caller Request is fulfilled; these are independent facts.
- The notification used the existing default-destination Conversation mirror.
  Its provider message row proves the send. The addressed-message durable
  delivery ledger and uncertain-send/restart behavior were not exercised.

The named completion-Hook API and Conversation-wrapper cutover remain absent.
This trial uses the existing retained caller-result path. Parent supervision now
has conservative production ceilings (attempt: two hours plus one minute;
recovery: ten minutes); per-execution policy resolution and all non-cooperative
cleanup/recovery cases remain separate gaps. No PR was merged and the diagnostic
change has no deployment authority.

## Historical performance observations

The original proposal reported these local measurements before the boundary
changes. They are retained as motivation, not a fresh benchmark or a guarantee
for the reviewed source; no new controlled performance run accompanies this
promotion.

| Measure | Standalone | Historical Host path |
| --- | --- | --- |
| Code procedure | 10 ms | 211 ms in-process / 917 ms worker |
| One-turn prompt agent | 143 ms | 1,343 ms worker |
| First-turn request | 6,106 bytes | 30,800 bytes |
| Finish schema | 1,930 bytes | 9,877 bytes |
| Unrequested Task tool | 0 bytes | 10,869 bytes |

The original sample also observed a `database is locked` error. A later #566
metric test observed contention and subsequent clean runs passed; neither
observation establishes a cause. Removing the event-pair tracker does not prove
that child writers are gone or that unrelated SQLite contention is impossible.
Measure equivalent pinned inputs, tools, definitions and caller options when
accepting hosted parity. Raw benchmark reproduction artifacts were not refreshed
as part of this source review.
