# Agent and app boundary

- Agent `triage` can run directly with instructions, prepared context, and its
  tools. It does not need the May-agent runtime to make a triage judgment.
- `incident.app` owns event intake, durable incident tasks, scheduling, retry,
  persistence, and recovery.
- The app can translate an event or task update into steering and prepared
  context for `triage`.
- A repeatable triage workflow preserves experience owned by agent `triage`.
- A proposal would import EventBus, SQLite task state, metrics, and scheduling
  into the `triage` agent core. It would also move the triage workflow from the
  agent into the app root.
- The proposal claims this coupling is necessary to make the agent autonomous.
- Hao asks: “Would this make the triage agent more autonomous?”
