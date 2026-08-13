# Evaluation App Runtime Canary Worker

This manual-only App is the child and coalescing target for the App-owned
runtime migration canary. It has no schedules, event subscriptions, Project
App task tree, or production ingress. Test traffic reaches it only through an
explicit `app.input.requested` event or a disposition from
`evaluation-canary`.
