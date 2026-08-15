# Practice

For each case, name the owner, the mechanism, the evidence that proves success,
and the next authority boundary.

1. A project outcome is stuck. Send the desired outcome, current evidence, and
   terminal proof to the owning app. Let the app choose its task and wake path;
   follow its owner disposition and result instead of selecting internals.
2. May needs guidance for one unfamiliar app decision. Load the
   `may-agent-system` skill and accepted app contract. Use a workflow only when
   an ordered process must run repeatedly or preserve orchestration state.
3. An event is persisted and delivery is accepted, but no domain result exists.
   Classify it as addressed work or a fact, inspect the selected App inbox,
   subscription, exact task wake, or observation route, and then inspect the
   correlated result and closure evidence. Reject the claim that persistence or
   delivery proves completion.
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
8. Someone proposes moving a project runner into `.app` so May can control it.
   Keep the runner and domain behavior in the portable project; use the app to
   steer the existing owner task and follow its evidence.
9. An owner reports a merge conflict and a failed test. Keep repair and
   verification inside the same task, while an independent sibling continues.
10. May needs a coding artifact and a later runtime restart. Start a tracked
    worker job, have the owner review its artifact, and use the supervisor path
    only after the exact change is approved.
11. Someone proposes importing the event bus, task database, and scheduler into
    an agent core so it can be autonomous. Keep the agent independently usable,
    let the app organize durable work, and keep repeatable workflow experience
    with its owning agent.
12. An app creates timestamped maintain tasks, refills itself from task result
    events, waits on internal task phase, repeats empty reviews, reuses a
    completed ID, and prioritizes passed work. Restore one stable resource,
    runtime-owned mechanics, direct children, external-only Conditions,
    immutable receipts, and the unresolved frontier; require live proof of the
    resulting wake loop.

Counterexample: if a typed response and terminal domain result both exist for
the current lineage, stop investigating delivery and report the proven outcome.
