# Prevent repeated execution and unnecessary reviews

**Supports:** [May metric follow-through](metric-condition-follow-through.md) and [system observability](../../may-agent.app/docs/2a-design/metrics.md). Reduce the cost of delivering useful outcomes while keeping unfinished work accountable.

**Choice basis:** [Value and cost](../../may-agent.app/docs/1-principles/design-philosophy.md#value-and-cost); [agent decisions and infra execution](../../may-agent.app/docs/1-principles/code-vs-data.md); [safe retry ownership](../../may-agent.app/docs/2a-design/system-boundary.md#retry-and-recovery-ownership).

**Design status:** Proposed efficiency follow-up and retained October 2 audit.
**Implementation status (2026-10-03):** Mixed; use the disposition below. No deployment or new usage comparison was performed in this review.

## Current disposition

| Slice | Source status and remaining evidence |
| --- | --- |
| Terminal helper completion | Host [#281](https://github.com/hao1939/may-agent/pull/281) is merged. Retain the acceptance cases below as regression requirements; do not reimplement the original defect. |
| Review clock | Apps `95e142b3d0` and current `metric-review.ts` use the immutable report completion time (`payload.createdAt`) plus the interval. Reused publication keeps that time. No new `reviewedAt` field is needed. A long publication delay can legitimately leave the next review due. |
| Meaningful reconsideration | Conditions and retained investigation identity exist. Better choice of wake predicates and measured review eligibility remain App policy and trial work. |
| Context size | Host [#288](https://github.com/hao1939/may-agent/pull/288) fixes a separate full-history Codex resume cost. It does not prove that optional Conversation reference enrichment is bounded or cheaper. Assess that path separately. |
| Continuing detection | Invocation anomaly counters and an independently delivered review need an implementation inventory and connected trial. A proposed metric is not evidence that monitoring is installed. |

The remaining sections retain the audit baseline and original implementation
plan. “Today” in that narrative means the October 2 audit, not the source state
after these fixes. Source integration, installed behavior and measured benefit
remain separate evidence.

## Proposed outcome

May should stop a completed invocation, retain unresolved work without repeatedly reasoning about unchanged evidence, and make unusually costly execution visible to an accountable owner.

The agent decides what work is useful and what change should invite another judgment. App code validates and records that decision. Host executes the existing completion, Condition, observation and delivery contracts.

Verify the integrated completion and review-clock repairs, then assess tighter review policy, bounded context and reusable consumption monitoring. Keep the current Task and investigation identities; no additional scheduler or issue registry is required.

This document proposes implementation and verification work. It does not claim that the fixes are deployed.

## Evidence and confidence

The audit covers October 1 00:00 through approximately October 2 00:24, Shanghai time. Cost figures below are recorded model estimates, not provider bills.

| Finding | Evidence | Confidence |
|---|---|---|
| Ordinary helpers can continue after valid completion | Two sessions called `finish` 183 and 218 times; approximately $380 of estimated usage followed their first finishes. Saved metadata has `requireFinish: false`. | Confirmed in traces and a local reproduction using the real runner |
| Metric review deadlines can already be overdue | 111 of 113 retained completed DeepSeek metric reviews had a past `nextReviewAt` at completion. | Confirmed in retained results and deployed App source |
| Existing waits repeatedly invite unchanged judgment | The AKS investigation had 348 attempts, including 167 triggered by missed Condition checkpoints. Other investigations repeatedly wait for any newer metric sample. | Wake mechanisms confirmed; individual reviews require judgment before calling them waste |
| Reference expansion makes routine context large | One preparation expanded eight referenced Tasks into approximately 126 KB of JSON. | Confirmed in saved preparation and context-builder source |
| Result status misses execution anomalies | Both large finish loops ended with an aborted model response but were retained as `done` because they had a valid result. | Confirmed; retaining a valid result is still desirable |

The full investigation at `/app/.state/token-audit-20261001/DEEP-DIVE.md` contains source locations, session IDs, limitations and reproduction results. Those supporting artifacts are local and ignored by Git; this proposal retains the review-critical findings independently.

## Responsibilities and invariants

| Responsibility | Owner |
|---|---|
| Decide whether to work, wait, seek help or change approach | Agent, within the App's policy and authority |
| Validate decisions, choose review eligibility and coordinate related concerns | May and Evaluation Apps |
| Stop an invocation after valid completion; preserve inputs and result receipts | Host execution layer |
| Sample resources, evaluate declared Conditions and deliver events/checkpoints | Existing Host observers and Task machinery |
| Record usage and execution anomalies | Host |
| Interpret costly recurrence and select an intervention | Owning App; Evaluation supplies independent assessment |

An **invocation** is one admitted call to an agent. A durable session can contain later invocations. Finishing a helper completes its contribution; it does not settle the parent Task or its unanswered requirements.

Preserve these invariants:

- A valid finish ends its invocation; a rejected finish remains correctable.
- New requirements and pending inputs remain durable and accountable. Compaction or a helper finish cannot check them off.
- Late observations remain history for closed Tasks. An authorized explicit continuation can reopen the same Task with its new requirements.
- A Condition match invites judgment; it does not prove recovery or fulfill the original request.
- Useful retries remain permitted. Usage and recurrence can trigger owner review; they do not themselves authorize cancellation or impose a retry cap.
- Result validity and execution efficiency remain separate facts.

These follow the existing [system boundary](../../may-agent.app/docs/2a-design/system-boundary.md), [Task contract](../../may-agent.app/docs/2a-design/task-resource-engine.md), [metrics contract](../../may-agent.app/docs/2a-design/metrics.md) and [failure follow-up process](failure-follow-up-proposal-20260919.md).

## 1. Unify terminal completion

Today the base `finish` tool validates and records the result but returns an ordinary tool result. The workflow wrapper adds `terminate: true`; ordinary helpers without a required output schema bypass that wrapper.

Move terminal completion into the shared base finish contract. Keep caller-specific schema and semantic validation in the existing wrapper. A valid result with any supported completion status ends the invocation; validation errors do not.

Apply this behavior through ordinary `agents.call`, workflow calls, managed execution and direct execution. A persistent session remains available for a later admitted invocation.

The current runner also checks tool batches and queued steering after a turn. A terminal flag alone must not be assumed to cover every path: its batch logic currently requires every tool result to be terminal. Use the existing runner stop-after-turn hook where needed to honor a validated terminal receipt before another model request. Preserve completed tool results and durable pending inputs. Define and test mixed batches explicitly so a finish cannot silently authorize later tool effects or lose an unexecuted obligation.

The decisive receipt is successful tool validation/execution, not the presence of the word `finish` in model output. Do not stop on rejected arguments. Do not change a valid result into failure merely because cancellation arrived during shutdown.

**Acceptance:**

- A plain helper and a schema-backed helper each make exactly one scripted model request when that request returns a valid finish.
- Invalid-then-corrected completion takes the corrective request and stops immediately afterward.
- Refreshing the same Task, an internal ready event and a queued follow-up cannot prolong a finished helper contribution; relevant input remains available for reconciliation.
- Direct, managed, persistent-session and mixed-tool-batch cases preserve their result and input contracts.

Five local reproduction cases already demonstrate the plain/helper difference and an in-memory base-tool correction. They are evidence for this proposal, not a production implementation. Existing wrapper tests pass and need integration coverage for ordinary helpers.

## 2. Separate evidence time from review time

Today `nextReviewAt` is computed from the observation cutoff. An hourly cutoff plus a five-minute interval can be in the past before the reviewer starts.

Keep the existing evidence cutoff and immutable evidence hashes. Use the retained immutable report completion time (already `payload.createdAt` in current source) and derive:

```text
nextReviewAt = retainedReport.createdAt + reviewInterval
```

For the first change, reuse the configured interval so the clock correction can be assessed independently of cadence tuning. Reviewer budget eligibility remains a separate existing control; a budget allowance is not proof that another review is useful.

Capture that time once for the completed review and retain it through publication recovery. Replaying a retained report must neither invoke the model again nor keep moving the deadline forward. Do not rewrite historical evidence or reports. Older reports remain readable; no second clock field is required.

**Acceptance:** old evidence and queue delay still produce a future review deadline; immediate periodic reselection is skipped; publication retry preserves the completed judgment and time; explicit new requirements retain their supported admission path.

## 3. Use existing Conditions for meaningful reconsideration

An agent should be able to explain its wait in plain language: “I am waiting for approval,” “I need one sample after deployment,” or “Reconsider if this gets worse.” App code saves the corresponding ordinary Conditions and review checkpoint. Host performs the observation.

| Situation | Useful wake condition |
|---|---|
| A source correction awaits approval | The existing approval/dependency event, with a deliberate follow-up checkpoint |
| A producer is missing | Producer recovery or the first supported fresh measurement, with coordinated checkpoints for related metrics |
| A known breach remains under investigation | Supported recovery/deterioration predicates and the investigation's review checkpoint |
| A change was just applied and needs verification | A fresh sample newer than the verified application baseline |
| The user supplies new requirements | Normal input to the existing Task; the agent reconciles all current obligations |

The existing metric observer already exposes value, freshness and measurement time. Prefer those predicates over “any newer sample” when ordinary new samples cannot change the decision. A long fallback interval does not slow a Condition that matches every sample.

For a shared investigation, coordinate related checkpoint timing. Preserve distinct per-metric evidence and obligations while avoiding dozens of staggered short timers that each request the same judgment. Do not deduplicate away a metric's independent recovery or approval requirement.

Evaluation should first respect the corrected review deadline and retained investigation. Before spending another model call, use bounded code-owned facts to recognize the same covered concern: current alert episode, coverage/freshness, responsible owner, definition and accepted review policy. Routine timestamp changes alone do not invalidate that policy. Explicit requests, changed coverage, new episodes, supported material changes and due checkpoints remain review opportunities.

Start with the existing result, evidence and Condition fields. Do not introduce a universal semantic fingerprint or a second policy store. Complex rate/trend interpretation remains agent judgment at an eligible review. A comparison that cannot establish coverage must retain the uncertainty and a due reconsideration path.

Keep publication integrity and exact evidence hashes intact. Improve eligibility before expensive assessment; do not silently drop published findings or skip May's required integrity checks. Likewise, one review should not commission another follow-up merely to restate an unchanged wait already covered by the same investigation.

**Acceptance:** replay a sequence of unchanged samples and repeated producer errors without new agent work before the chosen checkpoint. Then prove that approval, recovery, deterioration, missing coverage, an explicit requirement and the due checkpoint each reach the responsible owner. A bounded agent trial must demonstrate useful Condition selection; guidance text alone is insufficient evidence.

## 4. Bound optional context after enrichment

Conversation references currently expand into full Task observations after the recent-conversation budget is applied.

Default referenced Tasks to identity, a compact current summary and an exact read handle. Fetch detailed evidence when the task is explicitly in focus or the agent requests it. Apply the presentation budget after optional enrichment, using explicit omission markers and links to retained detail.

Treat required current input, acceptance criteria and obligation identities separately from optional historical context. If required detail cannot fit, retain a readable artifact and clearly identify what must be read before deciding. Do not silently truncate requirements or imply that observing input settles it.

**Acceptance:** eight references stay within the configured optional-context budget; the current assignment remains accountable; a targeted read returns complete detail. Compare preparation bytes and provider-reported cache categories before and after. Do not promise a cache-hit improvement without measurements from the actual gateway.

## 5. Detect recurrence through existing metrics

Extend the existing execution-usage record with objective lifecycle observations. Record them during execution, including while a loop is still running; detection must not depend on the invocation eventually ending. Reuse the current persistence/update cadence without a transcript-scanning service.

Proposed facts, scoped to an invocation rather than a lifetime session:

- First validated finish and count of validated finishes.
- Model requests started after terminal completion.
- Existing input/cache/output token counts, elapsed time and correlated App/Task/attempt identity.

A subsequent admitted invocation starts a new accounting scope. Keep valid output even when an anomaly is present. Exact field names and any existing equivalent counters should be resolved during the implementation inventory; avoid duplicate counters.

The first App metric can be simple: **one model request after accepted terminal completion is a breach**. Link the affected invocation and current owner to the existing concern/Task mechanism. Repeated observations update that concern rather than creating an investigation for each sample.

Then use existing rolling per-Task consumption to identify expensive unchanged waits. Present actual fulfilled inputs, accepted deliverables and relevant dependency/Condition changes alongside usage. Resource versions, fresh timestamps and rewritten summaries alone are not progress. High usage is a reason to inspect, not an automatic waste verdict. Select attention thresholds from measured workload and keep them in App policy.

The detector follows the same review discipline as other metrics: retain coverage gaps, coalesce an existing unresolved concern, and reassess on useful change or a deliberate deadline. Suspected Evaluation defects should use the established independent owner-review path.

**Acceptance:** the two recorded finish loops produce an actionable concern before completion; duplicate samples reuse it; genuine later invocations do not breach; a productive expensive run is presented for judgment without automatic cancellation. Unknown pricing remains unknown.

## Delivery plan

| Slice | Scope | Evidence before adoption |
|---|---|---|
| A — Host completion | Shared terminal semantics and converged execution paths | Real-runner integration tests, including late input and mixed batches; bounded ordinary-helper trial |
| B — Evaluation clock | Completion-based next-review time and idempotent publication recovery | Old-cutoff/delayed-review fixtures and observed future deadlines |
| C — App reconsideration | Condition selection and coordinated review eligibility | Retained-trace replay, meaningful-change fixtures and bounded agent trial |
| D — Host context | Compact optional references and final presentation budget | Context composition checks, targeted-read correctness and measured size comparison |
| E — Continuing detection | Invocation facts and App metrics/owner follow-up | Live-invocation anomaly detection, correlation/deduplication checks and a controlled trial |

A and B address the confirmed bugs and should be reviewed first. Keep each slice independently reviewable and use the existing candidate, review and deployment process. During rollout, compare the same Task/trigger populations over at least a full chosen review interval; raw lower token totals alone do not prove preserved functionality.

Retained old Conditions will not change merely because new guidance is installed. During slice C, have the owning App reconcile the identified investigations through normal Task operations and revise only the relevant waits. Preserve approval packets, unrelated requirements and historical evidence. Do not edit runtime database rows directly.

Rollback restores the prior code/policy revision without deleting Tasks, inputs or evidence. Added accounting/result fields must tolerate older readers. App policy reversals use ordinary reconciliation to restore affected waits.

## Related recovery and independent oversight proposal

The later October 2 investigation confirmed the container Codex sandbox failure and reproduced two additional defects: stale context after resume and an immediate stale-result loop with a bounded event backlog. It also identified gaps in owner escalation and independent coverage of Evaluation's own operational work.

The [recovery and independent oversight proposal](../../may-agent.app/docs/proposals/reliable-recovery-and-independent-oversight-20261002.md) owns those fixes and their connected verification. It reuses the existing caller feedback, metric and Condition paths. This token-efficiency proposal continues to own completion, review scheduling, reconsideration and optional context budgets. Neither document claims deployment, and no global retry limit is proposed.

## Decisions for reviewers

1. Is terminal completion consistently owned by Host, including ordinary helpers and persistent sessions, while Task fulfillment remains with the caller/App?
2. Does the App policy express meaningful reconsideration through current Conditions and retained results without introducing bookkeeping for the agent?
3. Do the replay/trial criteria cover both avoided repeated work and the new information that must still reach the owner?
4. Is the proposed order appropriate: fix completion and the review clock, then improve reconsideration/context and install continuing detection?

Review disposition: retain A/B as integrated-source regression requirements. C–E remain proposed follow-up; prioritize them using measured outcome, review cost and coverage evidence.
