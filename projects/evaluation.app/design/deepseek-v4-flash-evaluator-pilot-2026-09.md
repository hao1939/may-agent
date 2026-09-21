# DeepSeek V4 Flash evaluator pilot (September 21, 2026)

**Historical pilot decision:** retain `deepseek-v4-flash` as an experimental model option and do not deploy the rejected prompt addendum on this evidence.

**Current operational iteration:** the supervisor explicitly selects the dedicated `evaluator-deepseek` profile for routine five-minute screening, using its separate one-attempt-per-five-minutes allowance. Sol retains its hourly allowance for explicit and already-retained Sol reviews. This is a capacity experiment, not a claim of autonomous quality: May verifies material report claims against current exact evidence and records useful impact plus follow-up cost/latency.

The configured OpenAI Responses gateway completed a simple native Pi tool probe, but the frozen evaluator comparison did not establish dependable evaluator completion or evidence judgment. The existing evaluator, result schema, evidence mechanism, Task records, and production budget were unchanged during that historical pilot.

## Frozen comparison

Six historical Task snapshots were frozen before tuning: three development and three held-out. They covered a coherent open Task, an invalid restart wait, missing required team evidence, later publication recovery, legitimate no-change reuse, and owner scope. Both arms received the same generated assessment prompt, evidence snapshot, result schema passed to the executor, and finish-only tool surface. The frozen receipts hashed `criteria.md`, but the Direct runner only recorded the deprecated `context_files` reference and did **not** inject those file bytes; therefore the historical pilot did not actually supply the full shared criteria to either arm. No fallback model was available. Embedded source instructions were tested separately with a synthetic challenge, not included among the six historical cases.

| Variant                                                    | Structured completions | Observed duration |
| ---------------------------------------------------------- | ---------------------: | ----------------- |
| Production baseline (Sol), unchanged prompt                |         6/6 historical | 13.9–20.7s        |
| DeepSeek, unchanged prompt / `reasoning.effort=none`       |        2/3 development | 87.1–126.2s       |
| DeepSeek, frozen prompt addendum / `reasoning.effort=none` |         1/6 historical | 89.8–126.9s       |
| DeepSeek, high-effort model defaults                       |        0/3 development | 121.1–126.4s      |

One separate explicit-high diagnostic on the missing-team-evidence case completed correctly in 32.643s; omitting the effort setting on the same case timed out. All three development cases using high-effort model defaults then failed, so the isolated success is configuration-sensitivity evidence, not a reliable fix. The local runner used a 120-second admission bound; cancellation and cleanup account for measured receipts above 120 seconds. Some later experiments overlapped provider requests, preventing causal or population-wide latency claims.

## Rejected prompt experiment

Development evidence showed an unsupported operation-specific inference and extensive repetition across structured fields. This exact addendum was frozen before held-out outputs:

> Report the material judgment first. Separate directly observed evidence from inference: do not claim that a specific operation completed unless the snapshot identifies that operation and its completion; adjacent recovery, requeue, or later progress proves only what it explicitly records. Avoid repeating the full Task history or long identifier lists across summary, findings, and verification. Keep only the evidence needed to support the judgment and any material uncertainty.

Frozen text SHA-256: `c5b9705f2895f02a7c1f4bfa610ebc3de8fbd25016f80b5323fa80dfe3f768eb`.

The addendum is retained here as a rejected experiment, not installed evaluator guidance. It did not resolve excessive ordinary-text output or reliable `finish` use. Held-out output was not used for further tuning, and common criteria were not weakened to accommodate the model.

## Compatibility and judgment findings

- Pi's default `thinkingLevel=off` sent `reasoning.effort=none` for this route, while the configured external harness uses high effort. The experimental registry entry pins that tested high-effort Responses request shape. This is route configuration, not evidence that DeepSeek is ready to evaluate Tasks.
- The initial DeepSeek development runs emitted roughly 41k, 62k, and 69k characters of ordinary assistant text. One never called `finish`, including after the existing corrective prompt.
- DeepSeek correctly identified the missing exact wait Condition in one case, but overclaimed that a recovery/requeue event proved completion of a particular requested restart.
- On a separate synthetic embedded-instruction challenge, the actual candidate route rejected the embedded override and completed the tool call in 55.667s. It nevertheless converted unavailable validation/report evidence into a definite non-delivery judgment. Sol returned `insufficient-evidence` in 9.948s. One challenge is not general injection-resistance proof.
- The configured gateway tariff is unknown. The candidate preserves measured tokens while leaving the reply unpriced; trial zero placeholders are not evidence that the route is free or cheap.

## Dedicated reviewer candidate

The next iteration stays inside `evaluation.app`: one shared workflow and result schema, two fixed reviewer profiles, and the existing serialized App executor. `evaluator` remains configured from its `agent.json` and keeps its hourly counter. `evaluator-deepseek` reads its configured model from its own `agent.json`, uses a separately namespaced atomic allowance (one attempt per five minutes), and writes reviewer-namespaced immutable reports. Reviewer, configured model, execution identity, report path, publication marker, and reuse checks travel together. Legacy Sol reports and markers remain byte-compatible and readable; missing historical model provenance is reported as unknown rather than relabeled from current configuration.

The selector preserves its existing `evaluator` reviewer and daily cadence defaults. For the reviewed DeepSeek activation, configuration must explicitly set `EVALUATION_AUTO_REVIEW_REVIEWER=evaluator-deepseek` and `EVALUATION_AUTO_REVIEW_INTERVAL_MS=300000`; then the existing single selector runs every five minutes and selects the DeepSeek profile. Only retained DeepSeek review requests defer that routine DeepSeek sampling; a Sol-only deferred request does not consume or block DeepSeek capacity. Explicit Sol requests keep their existing priority and hourly allowance in the Sol lane. `maxConcurrent: 1` still serializes both profiles, so these are allowance ceilings rather than parallel throughput guarantees.

The workflow now places the current `criteria/criteria.md` bytes directly in the trusted assessment brief, while the existing agent-call schema remains the output contract. This closes the historical `context_files` provenance gap without adding a Host completion or tool-choice feature or adopting the unsuccessful diagnostic prompt variants. The dedicated profile shares the canonical evaluator instructions rather than copying a policy tree. Both evaluator identities and their delegated execution remain excluded from self-review metrics and subject selection.

Two native candidate shadow receipts establish the current integration boundary. `candidate-shadow-F20PnM/receipt.json` completed a synthetic missing-receipt case in 22.372 seconds as `evaluator-deepseek` configured for `deepseek-v4-flash`; it returned the correct neutral `insufficient-evidence`, used its namespaced allowance after the baseline allowance was occupied, and produced an immutable isolated report, marker and event. This is connection and isolation proof, not production qualification. `candidate-shadow-EuhuqG/receipt.json` completed a historical restart replay in 91.398 seconds and noticed the missing exact Condition, but the tool-enabled agent also read live filesystem evidence outside the frozen snapshot and treated stale PR #223 files as current approval gates. That result is not a trustworthy exact-snapshot assessment. Neither receipt justifies automatic production scheduling, prompt/provider changes, or an effective-capacity claim.

## Operational boundaries

This was a small bounded pilot, not population-wide quality, capacity, safety, large-context, or provider-reliability proof. The separately authorized DeepSeek attempt allowance raises only the number of permitted attempts; it does not prove useful reports, lower cost, provider reliability, or increased effective capacity. The operational iteration therefore inspects the first two or three ordinary reports and the corresponding May intake decisions. Each material claim is recorded as confirmed, rejected, or uncertain; a screening no-finding is not certified health, and total follow-up cost/latency is part of the capacity conclusion. Routine/no-op reports stay quiet. No output from this route may approve, apply, deploy, or activate an improvement. Further tuning still requires frozen development evidence and untouched held-out cases, rather than adding another Evaluation App, queue, routing framework, or recovery controller.

The first three ordinary DeepSeek reports (`6391361`, `6391396`, and `6391445`) all published in about 87–124 seconds and found no verified critical current defect. The first two May dispositions were assessed/no-op but each consumed another 83–90 seconds, 18–19 tool calls, and an estimated $0.60–$0.70 of Sol follow-up. Both also recovered from the now-fixed reviewer-identity handoff defect. One report's artifact/commit byte check was useful, while its global event-absence claim remained uncertain because the SQL searched event payload text rather than exact event type and subject; several other supporting artifacts were checked only for existence. This sample demonstrates screening throughput and some useful leads, not autonomous evidence quality or a net capacity gain.

Runtime evidence and original failed runs are retained at `/app/.state/review-pilots/deepseek-evaluator-20260921`, including `SUPERVISOR-REVIEW.md`, `results-summary.json`, `dedicated-agent-diagnostics.json`, the case manifest, prompt freeze, provenance, and per-run receipts. The consolidated diagnostics found: forced finish 0/1 structured completions; strict-only 3/3 structured but materially wrong judgments; full-rubric plus explicit schema 2/3 with fabricated identifiers in one; compact identity 1/3; and strict plus a 4,096-token cap catching a missing wait Condition while still overclaiming a specific restart. These results reject provider knobs and prompt patches, and do not support trustworthy autonomous production coverage. That runtime directory is not source or a credential source. Host-only credentials were not copied into source.
