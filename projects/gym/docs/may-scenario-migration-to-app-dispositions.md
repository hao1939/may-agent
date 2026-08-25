# May scenario migration to Task reconciliation

**Status:** Implemented corpus boundary; seven representative plain-language
development cases approved 2026-08-25; remaining draft and transfer truth still
awaits human review.

## Contract

May owns the Conversation. A Host request remembers which human turn May still
owes an answer; it is correlation, not a Task. Apps own durable domain Tasks.
One May attempt returns the production `TaskReconcileResult` shape as its
validated decision contract; the type name does not create a May Task:

- `converged` with `response` — answer, clarify, reject, or close the request;
- `waiting` with exactly one typed App dependency and no `response` — ask one
  accountable App to own the next durable outcome.

`summary` records useful request state; it is not a delivery receipt or a
second human response. May never mutates another App's Task or chooses its
workflow, schedule, retry policy, session, or wake path. Runtime persists and
recovers the request, dependency, attempts, and accepted result. The
destination App attaches durable work to its own Task.

Plain language is the default across responses, questions, summaries,
dependency descriptions, progress, failures, and design explanations. Exact
IDs, schema fields, quoted evidence, and necessary technical terms remain
precise. This quality is judged by meaning with calibrated semantic controls,
not by a word blacklist.

## Audit result

The previous corpus contained 17 May suites and 79 unique scenarios. All 79
required `alignment-decision.json`; none exercised the real
`TaskReconcileResult`
boundary. Seventeen also encoded removed inbox actions such as `accept`,
`closeout`, or `handle/route/deliver`.

Historical scenario definitions and run evidence remain unchanged. Their
autonomous tracks are disabled. They may still be run explicitly for historical
comparison, but they cannot authorize a new May candidate.

## Disposition of all 79 scenarios

| Previous suite | Count | Disposition under the simplified design |
| --- | ---: | --- |
| `may-admission-review-closure` | 3 | Retire the removed admission-review lifecycle. Preserve human-authority and terminal-proof meaning in direct answers or typed App-dependency cases. |
| `may-alignment` | 16 | Keep as historical general-judgment regression evidence. Do not use its nine-field artifact to train App management. Migrate useful intent/proof pairs only when a real disposition case needs them. |
| `may-cli-worker-learning*` | 6 | Move CLI lifecycle and packetization decisions to the accountable App/worker owner. May may request a durable App outcome but does not manage an asynchronous CLI worker. |
| `may-conversation-follow-through*` | 6 | Replace with persisted May request, exact App dependency, restart closeout, concurrent-request, and approval cases using the real Task result. |
| `may-deputy-learning*` | 17 | Split: keep owner/proof judgment, use typed dependencies for App routing, and move task/workflow/schedule/session choices into App tests. |
| `may-human-inbox-deputy*` | 16 | Remove the parallel `handle/route/deliver` vocabulary. Map useful meanings to a direct response or typed App dependency; channel delivery remains Infra evidence. |
| `may-learning-transfer` | 2 | Keep as historical initiative judgment; cover App behavior through new transfer cases. |
| `may-practical-judgment*` | 8 | Keep as historical general-judgment regression evidence; not an App-management contract. |
| `may-signals-and-context*` | 5 | Keep as historical diagnosis evidence; metrics and context do not add May lifecycle states. |

The exact previous scenarios reviewed were:

- Admission review: `may-learn-admission-review-disposition-before-runtime-repair`, `may-learn-admission-review-complete-gate-before-debugging`, `may-learn-admission-review-material-human-authority-deliver`.
- Alignment: `may-align-stability-before-novelty`, `may-align-proof-before-adopt`, `may-align-recurring-systemic-fix`, `may-align-local-guidance-wins`, `may-align-local-guidance-paraphrase`, `may-align-design-critical-review`, `may-align-concise-status`, `may-align-concise-status-explicit`, `may-align-infer-safe-cleanup`, `may-align-remove-specified-cleanup`, `may-align-learn-new-guidance`, `may-align-proof-before-adopt-explicit`, `may-align-block-cleanup-on-diff`, `may-align-durable-submission-path`, `may-align-closure-before-cleanup`, `may-align-trust-completed-artifacts`.
- CLI workers: `may-learn-seek-cli-opinion-when-material`, `may-learn-packetize-independent-cli-review`, `may-learn-handle-cli-timeout-and-retry`, `may-learn-reconcile-cli-disagreement`, `may-learn-resume-cli-continuation-not-independent`, `may-learn-own-decision-after-cli-opinions`.
- Conversation: `multi-session/may-conversation-follow-through-core`, `may-conversation-clarify-approval-choice-replay`, `may-conversation-clarify-approval-choice-paraphrase`, `may-conversation-submit-explicit-approval-choice-control`, `multi-session/may-conversation-follow-through-transfer`, `may-conversation-admit-long-running-reply`.
- Deputy operations: `may-learn-reject-stale-app-approval`, `may-learn-select-skill-or-workflow`, `may-learn-understand-telegram-reply-intent`, `may-learn-require-terminal-proof-before-completion`, `may-learn-repair-ownerless-wait`, `may-learn-keep-completion-judgment-with-owner`, `may-learn-keep-domain-work-with-project-owner`, `may-learn-keep-repair-in-owner-task`, `may-learn-choose-durable-execution-owner`, `may-learn-separate-agent-capability-from-app-autonomy`, `may-learn-reconcile-stable-task-resource`, `may-learn-route-project-app-request`, `may-learn-diagnose-unconsumed-event`, `may-learn-replan-stalled-human-task`, `may-learn-recover-codex-intake-timeout`, `may-learn-resolve-session-design-conflict`, `may-learn-treat-repetition-as-automation-evidence`.
- Human inbox: `may-learn-inbox-handle-recovered-timeout`, `may-learn-inbox-route-product-failure`, `may-learn-inbox-return-vague-cleanup`, `may-learn-inbox-deliver-gym-decision`, `may-learn-inbox-reject-secret-request`, `may-learn-inbox-suppress-duplicate-pr`, `may-learn-inbox-deliver-useful-digest`, `may-learn-inbox-break-glass-broken-owner`, `may-learn-inbox-reject-convenience-break-glass`, `may-learn-inbox-transfer-handle-recovered-urgent`, `may-learn-inbox-handle-self-suppressing-recovery`, `may-learn-inbox-transfer-deliver-human-authority`, `may-learn-inbox-transfer-deliver-material-change`, `may-learn-inbox-transfer-sanitize-digest`, `may-learn-inbox-transfer-handle-bounded-cleanup`, `may-learn-inbox-transfer-deliver-balanced-decision`.
- General transfer and judgment: `may-learn-proof-before-config-rollout`, `may-learn-infer-bounded-maintenance`, `may-practical-understand-before-action`, `may-practical-evidence-over-story`, `may-practical-actions-over-promises`, `may-practical-goal-over-plan`, `may-practical-simple-first`, `may-practical-transfer-urgent-ambiguity`, `may-practical-transfer-complete-plan-broken-goal`, `may-practical-transfer-automation-without-proof`, `may-signal-investigate-metric-before-action`, `may-context-debug-agent-input-first`, `may-context-discover-dont-dump`, `may-signal-transfer-green-score-bad-outcome`, `may-context-transfer-misleading-tool-success`.

## Replacement coverage

The new `app-outcome-management` unit has eleven visible development cases and
five withheld transfer cases. It covers direct answers, focused clarification,
one-shot delegation, recurring outcomes, plain technical explanation, May
capability improvement, Host operations, ownership gaps, terminal review,
missing proof, stopping standing work, paraphrase transfer, restart recovery,
concurrent requests, exact approval, and secret handling.

The scorer admits the actual `task-result.json` through the production SDK,
checks May's request decision and typed dependency, rejects cross-App Task
mutation and App-internal workflow/schedule/retry/session/wake choices, and
verifies required scenario meaning. Representative communication cases add
calibrated semantic judges for plain-language quality. Hao approved the seven
visible communication cases on 2026-08-25 for bounded training. Other
development cases remain `draft`, and transfer truth remains withheld until
separate exact review. Promotion cannot use unapproved cases.
