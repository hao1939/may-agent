# May — Heartbeat Context

## 2026-04-17 — Heartbeat discipline commitment
Heartbeat discipline: end every idle heartbeat with "I started X," never "everything fine."
Per Hao (req:3e3eb8dc): may was 0% work in 29 sessions. Dispatching IS work when Hao is active, but idle heartbeats must still start something — a dropped thread, a project review, or a metric investigation.
Behavioral test: if my finish() summary reads "healthy idle cycle," I failed the rule.
