# Cooperation and observation recovery — September 30, 2026

The ordinary Task mechanisms handled delegation, a silently ineffective observer,
and a request for human input. No Host change or separate recovery process was
needed. The trial also exposed an Evaluation connection-setting gap and limits
in the evaluator's judgment.

## Live cooperation

Host `dc6395dbccd0c1d7d2e95356859d9a9aec952734` (v5.2.0, PR #270) and App
definition `6236ca31afce0e30a81202c31f68d9622a807935` were active.

Bob received May Task `goal/app_3e85bb7e-1d6d-4bae-8ccf-65d22e81da00` and
discovered the sample contract. His typed dependency admitted
`sample:review/appdep_24762fbf9e0f5d75ab312f54`. Both owners saved ordinary waits.
The supervisor supplied the document only after the child wait was accepted.
Observation event `6490658` resumed the reviewer, which correctly identified two
false claims among four and retained all three reviewed documents. Return event
`6490687` resumed Bob through the original caller relationship.

Bob independently checked the child findings and all three artifact hashes and
bytes, then converged at **11:37:15 UTC**. He recommended no implementation change
for this path. Each owner used two attempts; there was no manual Task wake or
replacement Task. File creation to the child's receiving attempt took 29.1
seconds in this run; this is not a latency guarantee.

Bob also corrected the child's execution account: the supervisor supplied the
file; the observer supplied availability evidence. A missing optional feedback
file, unavailable `rg` and a 120-second recursive search timeout were recovered
errors. They did not prevent delivery, but the execution was not error-free.

The existing periodic evaluator selected the child without a review request from
the supervisor. Its DeepSeek report confirmed the substantive outcome and caller
return. It nevertheless repeated the misleading file-producer attribution and
called all observed calls productive, overlooking the timed-out search. Its
process projection was bounded and truncated. This report is useful evidence,
not sufficient proof of efficiency or accurate assistance attribution; Bob's
independent check supplied the correction.

## Isolated recovery

The isolated source changed only the readable-file fact from `available: true`
to `readable: true`. The observer could report healthy inspection while the
saved Condition remained unknown. This deliberately tests a contract defect
without encoding a special recovery branch.

Task `sample:review/app_fd955a64-84a4-4fb2-ba51-cbaece22372d` was admitted once.
It accepted a 60-second wait at **11:31:47.049 UTC**. The supervisor supplied
the file at **11:32:38.111 UTC**. The existing controller started the next owner
attempt at **11:32:50.867 UTC**, with reason
`condition-review-checkpoint-missed`; the Condition had never become true.

The reviewer found and retained the source, completed all three claim checks,
and converged at **11:33:46.850 UTC**. It reported the absent matching observation
and left its root cause unproven. This was owner recovery on the original Task,
before any isolated restart or source activation. The input explicitly requested
a short reconsideration interval and investigation; this tests informed use of
the mechanism, not unguided discovery. The source defect remained deliberately
unrepaired. One failed TypeScript command was corrected within the attempt.

## Evaluation connection fix

Evaluation already allowed a separate control socket, but session, transcript
and attempt HTTP reads were fixed to `localhost:8080`. That can combine one
installation's Tasks with another installation's reporting endpoint. Existing
identity checks rejected the mismatched evidence rather than certifying it.

Both readers now use one App helper and optional `MAY_REPORT_BASE_URL`; the
default remains `http://localhost:8080`. Configure it together with
`MAY_CONTROL_SOCKET` and the report root. Host APIs, identity checks, timeouts,
read limits, selection, allowance and recovery are unchanged. There is no
fallback to another Host on failure.

The isolated setup initially omitted its socket setting and had an unavailable
optional model profile. Those were supervisor setup mistakes. The selector
failed repeatedly and its owner reviews did not fix the configuration; the
supervisor supplied the correction. The source fix was activated through normal
reload request `224`, completion `225`, at isolated revision
`34882b83c30b5e76727f55a3d276ef7345ee1405`. A restart was required for environment
settings; one premature start correctly rejected the still-owned socket.

After correction, the actual Evaluation reader found **2 of 2** exact process
attempts, versus **0 of 2** in the earlier report. Field truncation remains
explicit. The supervisor requested an exact reassessment after activation;
that is assisted review selection, separate from the earlier automatic sample.
The reassessment finished at **11:41:33.737 UTC**, using both process traces. It
distinguished successful recovery from recovered tool errors, but kept the
claimed observer mismatch unverified because relevant contract/Condition tool
results and the larger design artifact were truncated. The record improved
process coverage without pretending to prove the missing detail.
The App check passed syntax, type checking, formatting and **228 tests**. A real
HTTP-server test exercises all three read paths and verifies that endpoint errors
remain errors.

## Human action and final checks

The separate isolated Task
`sample:review/app_11fdb9d2-df80-467a-a41c-8d234681fc99` saved a document wait,
then resumed through the same deadline mechanism. After checking continued
absence, it changed the Condition owner to `human:requester` with an exact
document request at **11:40:19.959 UTC**. Public `tasks.list` with
`humanActionOnly: true` returned that request. Telegram was disabled; actual
Telegram delivery is not tested here.

The supervisor then supplied the exact requested document, with no manual Task
wake or detector repair. The next deadline resumed the original owner, which
completed the review at **11:42:21.585 UTC**, correctly rejected the planted
approval claim and cleared the Condition. The next human-action query returned
zero items. This verifies the human-request round trip in the public Task view.

The fix and trial documentation were merged locally and activated from
`1665fad2fd5f857a64418bf506dc08e73667c79a`: reload request `6490769` links successful
completion `6490772`. All three active reader source files match the integrated
bytes. A post-activation read through the production default endpoint returned
both exact live attempts. The isolated daemon exited cleanly after its work
settled; its records remain in place. Production services stayed healthy. This
rollout note is a later documentation-only addition.

## Evidence and scope

Raw receipts remain under
`/app/.state/review-pilots/sample-cooperation-recovery-20260930/`:

- `bob-accepted.json`, `child-final.json`, `team-child-wait.json`,
  `team-document-created.json`: live accepted results and the source transition.
- `bob-evidence/18a7c85c35e45c73076aebe2a8b96edd7996ea66d54eb8f8d09b0ab3a60e7107.md`:
  Bob's verified report, including precise event, attempt and artifact links.
- `isolated-final.json`, `isolated-recovery-check.json`,
  `isolated-document-created.json`: original recovery and its controller trigger.
- `isolated-reader-proof.json`, `isolated-reload-event.json`,
  `isolated/.state/evaluation/reports/`: connection/read proofs and retained reports.
- `human-after-deadline.json`, `human-todo-after.json`,
  `human-document-created.json`, `human-final-check.json`,
  `human-todo-cleared.json`: human-action evidence, supplied material and closure.
- `isolated-recheck-final.json`, `isolated-report-integrity.json`: reassessment
  result and verified publication hashes.
- `evaluation-check.log`: full App checks.
- `live-reload-completion.json`, `live-active-source-proof.json`,
  `live-reader-proof.json`: successful activation, source and default-endpoint
  checks.

The live independent report remains in
`/app/.state/evaluation/reports/task-outcomes/evaluator-deepseek/sample/task-outcome-v2/`
as `review-appdep_24762fbf9e0f5d75ab312f54-ba09e4fa1b7628e7.{json,md}` with its
publication marker. The [reusable scenario](../scenarios/observation-recovery.md)
defines what future trials should check.

The tested controller kept working throughout the original recovery. These
results do not establish recovery from a dead controller, reliable automatic
source repair, universal model judgment, or a cost improvement. The next useful
review is the evaluator's missed assistance/efficiency distinctions and its own
ineffective configuration reviews, using these retained examples through the
existing App improvement process.
