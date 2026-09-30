# Observation recovery

Purpose: test owner continuation when an observer runs successfully but fails to
produce the promised fact. This extends [basic cooperation](basic-cooperation.md).

Use an isolated installation with its own source, state, socket and report root.
Disable external messaging. When Evaluation is present, configure
`MAY_CONTROL_SOCKET` and `MAY_REPORT_BASE_URL` for that same installation.
Establish that an exact Task attempt and its session are readable there before
interpreting an evaluation report. Keep deliberate defects out of production.

1. In the isolated document observer, return a different field from the promised
   `available` field for a readable document. Keep ordinary inspection running.
2. Admit one ordinary review while its document is absent. Ask the owner to
   prepare and save a bounded review deadline using the installed contract.
3. Supply only the document after the wait has been accepted. Observe the saved
   Condition, actual observer evidence and the controller's next owner attempt.
   Do not publish a ready event, retry the Task or edit Task storage.
4. Check whether the owner reads the now-available source, completes safe work,
   retains evidence and reports the observation mismatch without claiming its
   root cause or repair. Recovery must use the original Task and ordinary wake.
5. Let Evaluation assess the exact outcome and inspect its report. Distinguish
   restored task progress, the remaining detector defect and missing coverage.
   Evaluation itself requires independent supervision.
6. In a separate review, leave the requested document absent through the first
   reconsideration. Check that the owner investigates before requesting human
   input, and that the exact request appears through `tasks.list` with
   `humanActionOnly: true`. Supply the document and check that owner completion
   removes the request. Keep Telegram disabled for the trial.

Retain initial admission, source-change receipts, accepted waits, controller
trigger, owner results, public `/todo` projection and evaluation reports. Record
all setup corrections and operator assistance. An explicit reassessment can
test a fixed evidence reader, but is not proof of automatic selection. Stop the
isolated processes when the trial ends; retain the records in place.

This establishes bounded recovery on the tested installation. It does not prove
recovery when the controller itself stops, automatic source repair, or a latency
guarantee. Reuse the existing review and improvement process for real defects.
