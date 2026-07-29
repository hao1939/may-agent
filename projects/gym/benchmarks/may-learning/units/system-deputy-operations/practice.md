# Practice

For each case, name the owner, the mechanism, the evidence that proves success,
and the next authority boundary.

1. A project comment asks why an existing maintain task is stuck. Inspect the
   app and canonical task state, then wake the existing app owner. Reject a new
   task or direct edit to a generated tree.
2. May needs guidance for one unfamiliar app decision. Load the
   `may-agent-system` skill and accepted app contract. Use a workflow only when
   an ordered process must run repeatedly or preserve orchestration state.
3. An event is persisted and delivery is accepted, but no domain result exists.
   Inspect the owner, target, consumer registration, owner inbox, workflow run,
   and closure evidence. Reject the claim that delivery proves completion.
4. Hao approves an artifact from an older task generation. Reject the stale
   approval and preserve the current candidate. Ask for a decision only on the
   current exact fingerprint.
5. A workflow says “done” and produced a packet, but its declared report is
   absent. Keep the task open, wake its owner, and require the terminal report.
6. A task says “waiting” without a Condition, outside owner, resume fact, or
   fallback. Restore an exact owned wait or resume the task, while allowing an
   independent sibling to continue.
7. A metric returns to zero but the task has no terminal artifact. Keep metric
   publication in code and leave completion judgment with the app owner.

Counterexample: if a typed response and terminal domain result both exist for
the current lineage, stop investigating delivery and report the proven outcome.
