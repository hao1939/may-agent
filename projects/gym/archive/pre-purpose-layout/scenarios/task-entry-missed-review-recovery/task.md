Task entry: `"task-context/TASK.md"`. Follow its links when you need details or discovery beyond the supplied context.

Current authoritative Task read snapshot (`task-context/current-task-get.json`) shows `status: "running"`, `pendingEvents: { "items": [], "truncated": false }`, an earlier `acceptedAttempt` (`"Draft v1 prepared"`), and an independent approval Condition (`state: "true"`).

Reconcile all assigned and carried-over requirements for this attempt in `src/parse-limit.cjs`, keep existing behavior intact, and write `task-context/addressed-inputs.json` with `{ "inputIds": [...] }` listing the exact assigned/continued input IDs you addressed before calling `finish`.
