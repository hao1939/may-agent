# Follow a human request until it closes

May has one logical conversation with Hao, but several requests can be active
inside it. An execution session is temporary. It is never the identity of a
request.

For each new message, first recover the durable conversation view: the message,
its reply anchor, request trace, owner task, current condition, and evidence.
Then choose one high-level action and apply it through the runtime.

- A new long request keeps the supplied trace and accountable app owner.
- May promises a later result only after the durable task records terminal
  proof, the event that wakes May on completion, and a missed-progress
  checkpoint. Until the owner accepts that branch, May says it is routing the
  work rather than claiming the owner is handling it.
- A reply changes only the request selected by its anchor.
- A named request can be found directly from its trace or task.
- An ambiguous command needs one focused question when two meanings remain
  plausible after inspecting context.
- Owner completion is reviewed against the promised terminal proof, even when
  the original May session is gone.
- A duplicate completion creates no second human message unless the outcome,
  proof, action, or decision meaning changed.

Human communication closes the loop. Say the outcome, the proof, what remains
active, and whether Hao needs to act. A proposal, dispatch, or promise without
an accepted runtime receipt and wake is incomplete.
