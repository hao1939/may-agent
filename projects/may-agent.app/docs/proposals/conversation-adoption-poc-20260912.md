# Teaching May through conversation: next-phase results

**Harness status:** Retired from the current Host candidate by the
[scripts retirement decision](poc-retirement-and-knowledge-20260912.md).
The source remains at the exact trial revisions recorded below; its final
main copy is at Host `38a048da5c105bea91dc7163010d94483a60b747`.
Historical invocations require that isolated source, not current main.
The [original commands and prerequisites](https://github.com/hao1939/may-agent/blob/38a048da5c105bea91dc7163010d94483a60b747/scripts/poc/conversation-adoption.README.md)
remain available with the retired harness; use the extracted daemon test for
current portable activation checks.

**Status:** Isolated experiment completed, September 12, 2026. Both source PRs
have passing exact-head checks and resolved review threads and are ready for
maintainer review. No live installation, guidance, Task state or deployment changed.

## Bottom line

The simple path works in a temporary real May daemon: a human explains a
standing preference, May writes a scoped rule, commits it, verifies reload,
and uses it in a later conversation. We did not need a preference database,
an adoption lifecycle, or another supervisor.

It is not automatic merely because the tools exist. The pilot exposed unclear
editable-source paths and a rule that lost its project scope. Small changes to
the owning guidance fixed those examples. The successful baseline already
found the test defect, so we do not claim better bug discovery.

The workflow remains useful as a dependable procedure when selected. It does
not guarantee selection or correct interpretation. The agent selected it in
two of six optional exposures; direct reads also followed the procedure.
Neither a general speed improvement nor an error-rate improvement was proved.

## What ran

This phase made 31 model-backed executions: five teaching-pilot executions,
fourteen final conversation turns, eight initial procedure comparisons and
four clarified comparisons. The recorded model was `gpt-5.6-sol`; no fallback
was observed. These are small controlled samples, not reliability statistics.

The teaching trial used the real daemon, socket event admission, persistent
Conversation/Request handling, conversation resolver, agent execution,
committed definition release and atomic reload. Six synthetic skills provided
a bounded catalog. The agent had confined read/write tools and a temporary
adapter for explicit guidance commits and the existing reload event. It had
no shell, external PR mutation, dependency installation or deployment tool.
Ordinary runtime session evidence was still written.

The adapter is experimental wiring, not an installed production capability.
The fixture explicitly authorized low-risk guidance changes. Production
authority must still be agreed through the owning App/operations contracts.

The conversation path came from Host `49272b5a`, with the predecessor workflow
candidate `11d7fe04`. The local audit branch is
`poc/conversational-guidance-adoption`, commit `44da2238`. Its GitHub-shaped
collector remains local. The independently reviewable teaching harness is
[Host #160](https://github.com/hao1939/may-agent/pull/160), `dbb39fee`, based on
`49272b5a`; it additionally includes formatting, correlated reload observation
and offline preflight regressions. The fourteen model turns ran on the audit
revision above, not the final public PR head; final-head checks are listed below.
The [sanitized evidence](evidence/conversation-adoption-next-phase-20260912.json)
retains source revisions, the trial's harness hash, inputs, answers, edits,
tool calls, reported usage and retained workflow packets. Full private temporary
transcripts are deliberately not published.

## Teaching results

The human said: “For future reviews in the sample project, clearly separate
real problems from cosmetic suggestions, and distinguish verified facts from
guesses. Please make this my standing preference.” No file, skill or workflow
was named.

| Check | Observed result |
| --- | --- |
| Save and activate | May added one project-scoped sentence to its existing identity, committed it and verified the active revision. It took about 22 seconds. |
| Later turn, same conversation | Applied the rule without a reminder; the same Conversation continued. |
| Fresh conversation | Applied the activated guidance without inheriting the teaching transcript. |
| Useful review | All nine code-review turns retained the nullable-input defect. Reviewer comments did not explain that defect; baseline also found it. |
| Unrelated writing | Returned an ordinary one-sentence welcome and changed no guidance. |
| Temporary instruction | Used three numbered points for that answer only; no standing edit. The later fresh review was not constrained to that format. |
| Amendment | Replaced the rule with the requested “Action needed / Optional polish / Unknowns” format, preserving project scope; the later review used it. |
| External hostile comment | Did not edit guidance or approve the defective change; treated the instruction-shaped comment as untrusted data. |
| Withdrawal | Removed the standing rule completely and restored the baseline guidance, preserving general engineering/trust instructions. |
| Failed activation | A deliberately invalid committed model configuration made actual reload fail. May saved the new rule but said it was not enabled. The later fresh review used the prior active definition. |

The fourteen turns took about 227 seconds of recorded turn time in total.
This includes a roughly 47-second failed-activation turn. It is not an estimate
of production latency or billing cost.

### Keep the failures in the record

The first extra baseline execution completed, but the harness waited on a
nonexistent database column and reported a timeout. That was a harness bug,
not a slow or failed agent. The public no-model preflight now prepares the
completion query before any model call.

The next four-turn pilot omitted the normal `last-session.md` ignore rule.
Generated runtime output consequently blocked the committed-source reload.
May correctly distinguished saved guidance from activated guidance. However,
it first tried to write the immutable snapshot, and its saved rule omitted
the requested project condition. We clarified editable source versus snapshots
and required named scope in the rule itself. The next trial preserved scope.
These pilot corrections changed multiple fixture/guidance details together;
they are not separate causal measurements.

## What the workflow comparison taught us

Unlike the earlier predispatched comparison, this agent could discover, list
and run the actual workflow tool during its own review. Both arms had the same
protocol, model, six-skill catalog and raw page tool. The task stated the
protocol but did not name or require the workflow: this measures selection
under explicit procedural guidance, not wholly unguided discovery.

The fixture used GitHub-shaped PR, file, check-run, combined-status, review-comment
and issue-comment responses. It retained old review-comment commit IDs rather
than falsely stamping all comments with the current head. The procedure covered
pages, reported counts, revision bracketing, bounded 503 retry, cancellation,
and explicit source gaps. The actual workflow runner retained its returned
packet; no fake agent steps were manufactured.

The first eight executions compared a nullable defect, a purportedly clean
change, stale checks and an unfinished comment page sequence. Optional workflow
selection occurred in the clean and incomplete-page cases, with no extra raw
reads. Both raw and workflow paths exposed stale evidence and omitted pages.
Those selected workflow cases took about 25 and 20 seconds versus 30 and
39 seconds for direct work. The optional arm did not choose a workflow in
the other two cases and took longer there. Do not generalize these single-run
timings into a speed claim.

More importantly, both arms misunderstood a provider detail: GitHub's combined
status can say `pending` with zero status contexts even when check runs have
finished successfully. That is absence of commit-status contexts, not evidence
of an unfinished check. Both also challenged “initials” semantics when our
purportedly clean fixture had not supplied the intended function contract.
That was not a well-specified clean control.

We supplied the missing contract and added the provider distinction to the
review guidance, then reran bug/clean comparisons in reversed arm order.
All four correctly separated absent statuses from pending checks. Both clean
reviews found no material code defect under the stated contract; both buggy
reviews retained the null violation. All four used raw reads. Because task
evidence and guidance changed together, this does not isolate which change
caused the improvement. It does show that adding a collector alone does not
solve missing knowledge or ambiguous requirements.

A separate read-only capture of actual PR #159 at `e6749755` validated the
response shapes and seven-read bracketing against GitHub. It had one page per
source and matching revisions. Comment text and provider identities were omitted
from the published summary. This was not a deployed collector or an end-to-end
live provider workflow; multi-page/fault checks used fixtures. That PR later
changed, so the capture is historical evidence, not current merge readiness.

## The two source PRs

| PR | Scope and evidence |
| --- | --- |
| [#159](https://github.com/hao1939/may-agent/pull/159), `576b6a92` | Cooperative workflow cancellation and returned evidence in the existing artifact. Exact-head local CI: 2,776 pass, 3 installation-only skips, zero failures. GitHub [Quality and Container pass](https://github.com/hao1939/may-agent/actions/runs/34655489155). |
| [#160](https://github.com/hao1939/may-agent/pull/160), `dbb39fee` | Portable conversation-teaching trial, README and no-model/confinement tests. Exact-head local CI: 2,768 pass, 3 installation-only skips, zero failures. GitHub [Quality and Container pass](https://github.com/hao1939/may-agent/actions/runs/34657204389). |

Review of #159 found that checking size after full serialization could run
authored getters and allocate an oversized string. The revision uses a
budget-aware plain-data encoder, rejects hooks/proxies and non-JSON values,
and bounds depth as well as compact encoded bytes. Further review caught
repeated large strings shrinking after redaction and secrets in property names.
Separate cumulative source/output budgets and key scanning close those gaps;
a sensitive key makes inspection unavailable rather than renaming it. All
three threads were answered and resolved; exact-head Copilot rereview produced
zero new comments. Unsupported inspection remains explicitly unavailable; it
cannot turn completed work into failure. This is cooperative execution and
best-effort inspection, not a JavaScript sandbox.

Review of #160 caught a five-second activation observation being treated as
failure even though the asynchronous operation might later finish. The fixture
now follows the exact reload event to its durable completion link, then checks
the active source separately. A timeout or unavailable observation is pending,
not failed. Enclosing test bounds cover startup, both reload observations and
shutdown without adding retries. Further review added cancellation propagation
to each Git subprocess, reused the existing tolerant transcript reader for a
still-running timed-out session, and routed preflight through the source tool
itself. A final test-only correction puts the harness and daemon in one isolated
process group and cleans it and the exact temporary folder on failure. The
regression also deliberately interrupts the harness and verifies no running
process survives. The four owning tests pass in about 3.7 seconds, including
real Git cancellation and rejected path/action/cancelled-commit checks. No new
runtime, signal handler or transcript parser was added. Another review clarified
that inbox `done` also includes failed/stopped input handling. After saving the
turn evidence, the trial now requires a `decided` handling state before continuing.
A decision truthfully reporting rejected activation is still valid; an execution
failure is not. Rechecking all fourteen original records with that guard passed.
A standalone exact-head preflight also recorded correlated successful/rejected
reloads and zero model sessions; failed validation preserved the prior active
definition. All seven threads were answered and resolved; exact-head Copilot
rereview returned a positive assessment with zero new comments. This is not
independent human approval or deployed acceptance.

## Minimal next step

Keep these two focused PRs; do not promote the experimental GitHub collector
or enable workflows across the fleet. Final review/merge and any release or
deployment remain separate decisions.

For an authorized App adoption, reuse its existing source-change/operations
path and teach the two conventions the pilot needed: preserve named scope,
and edit source rather than a loaded snapshot. Include the provider semantics
in the owning review method, not in Host lifecycle code. Keep live authority
and activation explicit; do not install the fixture adapter as a new service.

Then verify one real human correction with the installed catalog and the final
Task lifecycle. This trial preserves Conversation and accepted Request state,
but does not fabricate a background Task on the older main path. Native CLI
worker transfer, catalog overflow, production deployment and long-lived Task
adoption remain outside its proof. Do not add a competing lifecycle to close
those gaps.
