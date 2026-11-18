# Plan: mature PR delivery standalone, then let Host drive it

**Supports:** [Task + Watcher PR delivery](../2a-design/task-resource-engine.md#solid-use-case-a-pr-through-ci-and-review). Establishes a useful execution procedure before automating its coordination.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first) and [bounded procedures versus durable coordination](../2a-design/workflows.md#bounded-procedure-versus-durable-coordination). The operator coordinates early trials; agents execute bounded passes. Host later replaces that coordination, not the agent implementation or judgment.

**Status:** Existing PR #574 reached green current-head CI, resolved substantive
review, same-Task watcher follow-up, retained caller return and an addressed
Telegram approval notice against the original human input (provider message
50618). The run required diagnostic interventions and a direct-repair exception
after workflow exhaustion; pure workflow implementation and zero-intervention
operation remain unproved. See the [final receipts and limits](../archive/implementation/host-ingress-sdk-source-review-20261116.md#green-head-caller-return-and-original-addressed-notice).
A fresh interrupted #582 trial now proves actual parent-deadline cancellation
of an awaited verification and attached TERM-ignoring child, then fresh workflow
continuation on the same Task/generation/PR with two of three rounds consumed.
Alex published and resolved the real review finding; the watcher woke the same
Task for passing current-head CI, the caller returned, and the original addressed
Telegram notice was delivered (provider message 50657). The command-loading gap
was repaired in #586 and locally adopted. Setup interventions remain recorded;
producer cleanup removed returned evidence before caller readback, which is the
next retention gap. See the [trial evidence and interventions](../archive/implementation/host-ingress-sdk-source-review-20261116.md#ordinary-command-cancellation-and-fresh-continuation).
This page owns the experiment method. The
[shared runtime contract](../2a-design/agent-runtime.md) and
[current delivery recipe](../development-workflow.md#publishing-and-waiting-for-github-pull-request-facts)
remain the behavior owners.

This plan tests **PR delivery and external feedback**. The separate
[standalone improvement trial plan](../comparison/standalone-improvement-plan.md)
plans diagnosis/Gym experiments alongside existing Host work. Coordinate shared
findings and candidates; neither plan authorizes duplicating an owned assignment.
A Gym comparison is not a prerequisite for a deterministic PR-delivery trial.

## Objective and fixed boundaries

Demonstrate one useful delivery outcome through standalone development,
publication, CI/review feedback and continuation on the same PR. Tune the inputs,
tools and bounded procedure until it works without hidden corrective assistance.
Then demonstrate the same procedure under Host Task + Watcher coordination.

The requested hosted milestone ends when Alex has assessed current-head required
CI and feedback and a Telegram notification containing the PR link, head, summary
and CI evidence has actually been delivered. The human reviews and approves on
GitHub. This pilot does not collect approval through Telegram; notification
delivery and GitHub approval are separate facts. Retain the PR observation if a
later assignment requires following GitHub approval or further comments.

```text
Manual pilot:
  operator supplies assignment → bounded agent pass → candidate/PR and evidence
  operator reads provider facts → fresh bounded pass → repair/respond on same PR

Hosted pilot:
  Task retains assignment/progress → same bounded agent pass
  watcher supplies provider facts → Host schedules same Task → same bounded pass
```

- No always-running PR workflow, model polling loop, second agent runtime or
  manual Task engine. Use ordinary output artifacts and a short operator log.
- Real capabilities and explicit failures; no fake service success, fabricated
  Host claims or live-state writes to make a standalone procedure work.
- Preserve original acceptance, exact repository/branch/PR/head, unrelated work
  and existing ownership. A workflow/helper pass is not whole-delivery success.
- The initial scope ends at the agreed **unmerged PR** boundary. Merge,
  deployment and Host/App activation require their own existing authority.
- Keep each invocation finite and cancellable. Ending an invocation preserves
  work; exhausting the experiment budget does not fulfill its delivery promise.

## Owners

| Responsibility | Manual pilot | Hosted pilot |
| --- | --- | --- |
| Define outcome, scope, authority and trial budget | Operator/caller | Task creator/App policy |
| Choose useful next action and judge feedback | Assigned agent | Same assigned agent |
| Design, implementation and independent review contributions | Selected specialists when useful | Same capabilities when useful |
| Observe GitHub facts | Operator using ordinary provider tools | App-owned watcher |
| Retain continuity and decide when to invoke again | Operator with existing artifacts/log | Host Task, Conditions and event delivery |
| Judge original acceptance and authorize ending | Operator/caller | Creator/App policy |

Bob and tech-lead are available contributions, not a mandatory handoff graph.
The agent can iterate and join bounded helpers within a pass. Only external
continuity moves from the operator to Host.

## Phase 0 — select one assignment and verify the execution path

1. Choose a small, useful Host-repository defect or improvement with an
   executable regression and a clearly bounded acceptance. Prefer a confirmed
   cause over broad runtime redesign or cosmetic work created only for the demo.
2. Inspect existing Tasks, branches and PRs. Reuse fitting owned work only with
   its owner's agreement; do not create competing fixes or take over an active
   branch. [PR #563](https://github.com/hao1939/may-agent/pull/563) already covers
   several standalone parity gaps. Its current head, review and ownership must
   be reread; its existence or green CI is not proof that convergence is complete.
3. Record the actual repository, isolated checkout, base/head, selected runner
   revision, SDK/agent definitions, model, supplied tools/skills and commands.
   Verify the checkout is for the assigned repository, not Alex's Apps workspace.
4. Check that this runner actually supports the chosen tools, assignment context,
   selected skills, result contract and cancellation. Resolve material gaps or
   deliberately narrow the supplied capabilities; do not hide mode-specific
   denials or missing backends. Full runtime convergence is not a prerequisite
   for a narrower honest trial.
5. Record publication authority and the agreed delivery boundary. Confirm real
   Git/GitHub access without retaining credentials in artifacts. Select an
   evidence directory outside the shared checkout and a finite run allowance.
6. Initial experiment budget: one live delivery case and at most three process
   revisions before an operator review. Set invocation and repair allowances
   before running; do not reset them by starting another invocation.

**Exit:** One written assignment, explicit authority/limits, usable standalone
execution path, isolated checkout and agreed verification command. If these
are missing, stop at the precise blocker; do not submit a Host Task or activate
watchers to bypass it.

## Phase 1 — define the first bounded pass

Supply ordinary agent information:

- Goal, acceptance, constraints and authorized operations.
- Actual working directory, base/head and verification command.
- Existing candidate/progress/evidence and caller relationship, when relevant.
- Current feedback with source identities and revisions, when relevant.

Require a returned contribution containing the candidate identity, actual checks
and receipts, review judgment, remaining work and useful next action. Use existing
supported result schemas where available; this list is information to preserve,
not a new mandatory JSON API.

Begin with literal assignments to existing agents and real tools. Use
`develop-change` only when its actual workspace/context requirements are
legitimately supplied. If it requires Host-shaped context that this caller lacks,
run the bounded agent steps manually and record that compatibility gap; do not
manufacture leases or substitute SDK test reads.

**Exit:** An understandable input and inspectable output contract that leaves
strategy with the agent. No new orchestration framework is required.

## Phase 2 — produce and publish a real candidate

1. Run the bounded development pass. Let the agent inspect, implement, test and
   repair locally while useful work and its allowance remain.
2. Obtain independent review appropriate to the change and repository rules.
   Bind verification/review to the exact candidate; changed code needs fresh
   assessment of evidence validity, not automatic reuse of an old pass.
3. Through authorized tools, push the existing branch and create/reuse the PR.
   Read back the actual repository, branch, PR identity/URL and pushed head.
4. Retain the local contribution and publication receipt. Inspect remote state
   before retrying an uncertain publication; a lost response is not proof of no PR.
5. End the invocation when only external results remain. Keep useful source and
   evidence; no agent remains alive waiting for GitHub.

**Exit:** One real, verified candidate and correctly identified PR. This is
publication progress, not fulfillment of CI/review requirements.

## Phase 3 — manually drive external feedback and continuation

1. Read current PR/head, CI checks/statuses, reviews and relevant full comments
   using provider tools. Record observation time, feedback identities, coverage
   and the commit each check/review concerns. Silence or missing coverage is unknown.
2. Supply those facts and retained progress to a fresh bounded invocation.
   The agent decides repair, response, clarification or no action. Comments
   cannot silently change acceptance or grant merge/deployment permission.
3. Verify justified repairs and push to the **same PR**. Read back the new head;
   reassess CI/approval evidence against it and retain remaining requirements.
4. Repeat only for useful new facts or an explicit operator reconsideration.
   Read/poll provider state outside model calls; continue independent useful work
   within a pass rather than yielding after every internal step.
5. Before concluding, compare evidence with the original acceptance and report
   the exact achieved boundary, remaining uncertainty and caller answer.

**Exit:** At least one genuinely external change has been assessed in a later
invocation, on the same PR, with original acceptance retained. If live CI never
fails, record that fact; local repair or a fixture does not prove a native remote
CI-failure repair chain.

## Phase 4 — debug, freeze and decide whether the procedure is mature

Classify problems before changing the process: unclear context/judgment,
missing or broken tool capability, workflow mechanics, provider coverage,
execution setup, or legitimately changed requirements. Fix the smallest cause.
Change one consequential process variable at a time where practical; retain the
before/after inputs, source revisions, results and reason for the change.

Record operator actions separately: ordinary coordination versus corrective
prompting, manual edits, substituted judgments or repaired environment. A hidden
operator repair must not be credited to the agent.

Review these cases, using disposable controlled tests for hazardous failures:

| Case | Required observation |
| --- | --- |
| Ordinary development/publication | Real checks and readback establish the exact candidate and one PR |
| CI failure and repair | Failure reaches judgment, justified repair is verified, new-head CI is reassessed |
| Review/comment follow-up | Agent receives and judges relevant feedback on the original PR |
| Duplicate/stale facts or unchanged state | No duplicate PR/push/repair or perpetual unchanged model calls |
| Interruption or uncertain publication | Confirm prior execution/descendant cleanup before a new pass; inspect retained/provider evidence before repeating effects |
| Missing backend, partial reads or unavailable authority | Visible scoped blocker, not empty success or invented approval |

Label every case **live**, **seeded**, **fixture-only** or **not covered**. Do not
publish deliberately broken source or manufacture provider failure without
specific authority. Existing component tests can establish mechanics, not native
agent understanding or live delivery.

**Promotion gate:** After freezing the input template, tools and procedure, observe
at least two fresh standalone passes without unrecorded corrective assistance,
including an external-feedback pass. Original acceptance is met or the exact
external blocker is retained; important failure cases have explicit evidence and
limits; total time, model/tool cost, retries and operator corrections are acceptable
under the agreed budget. Any unverified native failure path remains a named proof
obligation, not a claim of complete autonomous coverage.

Factor only repeated, understood bounded steps into existing workflow code when
that reduces demonstrated effort. Do not encode every judgment or wait as a
workflow phase. If the gate fails, revise or stop with useful evidence rather
than automate the unresolved problem.

## Phase 5 — transfer coordination to Host, then run one hosted case

1. Review standalone/Host equivalence for the selected definitions, assignment,
   tool/result/error contracts, skill delivery, working-directory prerequisites,
   limits, cancellation, cleanup and useful-work retention. Verify Host can supply
   the actual target checkout; watcher repository scope does not select the
   development repository. Repair existing shared paths/adapters where needed,
   not a second agent runner or a redirected App-wide workspace. Keep gaps explicit.
2. Select the actual local Host target and read its binary, SDK and accepted App
   definition identities. Through the separately authorized normal activation
   path, install compatible definitions and verify the advertised watcher. A
   successful source test or reload request is not activation evidence; preserve
   unrelated running work and follow the [operations guide](app-operations-recovery.md).
3. Choose one fresh small delivery case, or an explicitly coordinated continuation
   of existing work. Admit one owning Task with the agreed acceptance and the
   genuine caller relationship; do not relabel another owner's PR.
4. Keep the mature agent/procedure intact. Save progress and exact PR identity
   in ordinary Task evidence; save a fingerprint-change observation Condition
   while feedback matters. Return `waiting` when only external results remain.
5. Let the watcher provide facts and Host schedule the same Task. Observe a
   durable matching event and a later **accepted owner result**, not merely a
   healthy watcher or successful direct inspection. Rearm needed interests after
   judgment; preserve independent work/waits.
6. When Alex judges the current head ready, deliver the review notification through
   the existing caller/Conversation path to Telegram. Retain its delivery receipt
   and exact PR/head/CI evidence. Human approval happens on GitHub and is not an
   exit requirement for this notification milestone. An unsuccessful send remains
   an explicit delivery gap; it cannot change the coding or CI evidence.
7. Verify the original outcome and authorized ending. Compare manual intervention,
   latency, cost, repair behavior and effect identity with the standalone trial.
   Test missed-change recovery in an authorized isolated instance; do not restart
   shared production merely to manufacture a test.

**Exit:** The same bounded procedure completes a native hosted feedback cycle
with one Task/PR lineage and no operator substituting for failed delivery or
scheduling. Publish the achieved evidence and remaining gaps. Only then consider
wider scheduling, additional watchers, PRs or rollout.

## Evidence and progress checklist

Keep one small evidence index beside normal run artifacts: assignment/acceptance,
runner/definition revisions, inputs and returned results, command/check receipts,
candidate/PR/head identities, provider facts, operator interventions, cost/limits,
current remaining work and the next action. This is an operator record, not a
scheduler, watch registry or executable phase store. When Host takes over,
continuity belongs to Task state; evidence remains referenced artifacts.

- [x] Phase 0: assignment, authority and execution path agreed for #574.
- [x] Phase 1: bounded input/contribution contract exercised.
- [x] Phase 2: real candidate verified, reviewed and published/read back; later direct repairs retain separate evidence.
- [x] Phase 3: same-PR external-feedback continuation observed, including warranted review and CI repairs.
- [ ] Phase 4: process frozen; maturity evidence and limitations reviewed.
- [x] Phase 5: compatible activation and native Task + Watcher cycle verified; runtime parity and restart remain separate.
- [x] Current-head readiness assessed and addressed Telegram PR-review notification delivered;
      human review and approval take place on GitHub.

**Next action:** Review the #574 evidence and freeze the useful process before a
fresh narrow assignment tests operation without diagnostic relays or a direct
repair exception. Include a timed-out invocation: pass cancellation through its
awaited calls, allow bounded cleanup through the existing executors, then use the
normal retry/failure policy. A fresh invocation may redo useful work on the same
Task/PR. Detached-process containment and crash-proof command ownership are not
requirements for this milestone. Keep the existing three-round development
limit; every started round counts, including cancellation, with no reset on
reentry. Escalate clearly if exhausted. Exact step restoration and per-step time
prediction are unnecessary; retain source work, accepted results and effect
identities. See the [simplified execution refinement](../archive/implementation/host-ingress-and-boundary-simplification-20261116.md#cancel-on-timeout-redo-safe-work-keep-one-round-limit).
No new submission, model-backed run, publication or activation is authorized
merely by marking this plan agreed.
