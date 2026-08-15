# Evaluation App Runtime Canary Worker

This manual-only App is the child and coalescing target for the App-owned
runtime migration canary. It has no schedules, subscriptions, task capability,
or production ingress. Test traffic reaches it only through typed App input or
a delegation disposition from `evaluation-canary`.

Its sole canonical definition is `app.ts`, loaded by the shared App loader.
