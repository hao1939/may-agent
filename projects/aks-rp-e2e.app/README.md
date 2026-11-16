# AKS app: local UI with a scoped Kubernetes session

Open http://127.0.0.1:8080/projects/aks-rp-e2e.app/ui/.

This main-instance installation declares no task handler, Task policy,
Conversation handler, agent implementation, subscription, schedule, observer,
metric or action. Its input schema accepts no input. Historical legacy AKS Task
resources remain unchanged, without a controller to execute them. The original
`projects/aks-rp-e2e-app` checkout stays disabled.

The normal App static route serves the page. A temporary API prefix
(`/k8s-upgrade`) connects it to the existing isolated Kubernetes-version-support
backend, which owns only the selected Kubernetes1.38 Task and native session.
That Task is authorized to continue locally; its temporary read-only/UI-review/
MLVM hold was superseded through typed App input, preserving all substantive
product/security/validation/source/cloud-scope/ownership requirements.

Main May v5.5.0 lacks the transcript API and no supported cross-instance Task
transfer exists. The backend preserves its own Task and native state; no rows
or binding files were copied into main state. Nginx allows POST only at its
Task-scoped input endpoint; other compatibility endpoints remain read-only.
The page enables feedback for the selected Task. Opening the page never admits
a new Task or resumes legacy automation.

Source and deployment evidence:
`/app/artifacts/k8s-version-support-local-20261110/ACCESS.md`.

The separate MLVM operational App uses the narrowly scoped
[compiler merge observer](mlvm/README.md). Its source lives here for review and
testing; this UI-only declaration does not install it.
