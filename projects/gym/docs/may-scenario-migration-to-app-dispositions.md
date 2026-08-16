# May scenario migration to the simplified App contract

**Status:** Implemented corpus boundary; new truth awaits human review.

## Contract

May owns the conversation. Apps own durable work. A May owner pass returns only:

- `complete` — answer, clarify, reject, or close with the exact human response;
- `delegate` — send one typed outcome to one accountable App.

May never attaches a task or chooses the destination App's workflow, schedule,
retry policy, session, or wake path. The Host persists and recovers the request,
child dependency, attempts, result, and delivery.

## Audit result

The previous corpus contained 17 May suites and 79 unique scenarios. All 79
required `alignment-decision.json`; none exercised the real `complete | delegate`
boundary. Seventeen also encoded removed inbox actions such as `accept`,
`closeout`, or `handle/route/deliver`.

Historical scenario definitions and run evidence remain unchanged. Their
autonomous tracks are disabled. They may still be run explicitly for historical
comparison, but they cannot authorize a new May candidate.

## Disposition of all 79 scenarios

| Previous suite | Count | Disposition under the simplified design |
| --- | ---: | --- |
| `may-admission-review-closure` | 3 | Retire the removed admission-review lifecycle. Preserve human-authority and terminal-proof meaning in direct `complete`/`delegate` cases. |
| `may-alignment` | 16 | Keep as historical general-judgment regression evidence. Do not use its nine-field artifact to train App management. Migrate useful intent/proof pairs only when a real disposition case needs them. |
| `may-cli-worker-learning*` | 6 | Move CLI lifecycle and packetization decisions to the accountable App/worker owner. May may request a durable App outcome but does not manage an asynchronous CLI worker. |
| `may-conversation-follow-through*` | 6 | Replace with persisted May request, exact child dependency, restart closeout, concurrent-request, and approval cases using the real disposition. |
| `may-deputy-learning*` | 17 | Split: keep owner/proof judgment, replace App routing with `delegate`, and move task/workflow/schedule/session choices into App tests. |
| `may-human-inbox-deputy*` | 16 | Remove the parallel `handle/route/deliver` vocabulary. Map useful meanings to `complete` or `delegate`; Host delivery remains separate evidence. |
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

The new `app-outcome-management` unit has eight visible development cases and
five withheld transfer cases. It covers direct answers, focused clarification,
one-shot delegation, recurring outcomes, ownership gaps, terminal review,
missing proof, stopping standing work, paraphrase transfer, restart recovery,
concurrent requests, exact approval, and secret handling.

The scorer validates the actual `may-disposition.json`, rejects `task`, rejects
invented lifecycle fields, checks the complete and delegated schemas, checks
the destination App and input kind, and recursively rejects App-internal task,
workflow, schedule, retry, session, and wake fields. A reference disposition
proves that every proposed case is satisfiable. New labels remain `draft` until
Hao reviews their exact expected behavior. Promotion cannot use them before
that approval.
