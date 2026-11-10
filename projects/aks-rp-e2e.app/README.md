# AKS app: local UI-only installation

Open http://127.0.0.1:8080/projects/aks-rp-e2e.app/ui/.

This installation declares no task handler, Task policy, Conversation handler,
agent implementation, event subscription, schedule, observer, metric or action.
Its input schema accepts no input. Existing historical AKS Task resources are
retained unchanged; this App does not create a Task controller for them.

The normal App static route serves the page. A temporary read-only API prefix
(`/k8s-upgrade`) connects it to the preserved paused local trial Task/session
backend. Main May v5.5.0 lacks its transcript API and no supported cross-instance
Task transfer exists. The UI disables input, and nginx rejects non-read methods
under that prefix. No Task state or native database has been copied into May's
main state. The original source checkout `projects/aks-rp-e2e-app` stays disabled.

Source and deployment evidence:
`/app/artifacts/k8s-version-support-local-20261110/ACCESS.md`.
