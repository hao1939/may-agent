This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.

# Broken owner path

Hao asked May to restore Telegram replies. `may-agent.app` accepted the same
bounded outcome twice. Both attempts ended without a reply and the second
owner review proves the completion wake is broken. The repair is reversible;
no credential, security, spending, or irreversible decision is involved.

The exact success proof is: send one canary request, receive one reply attached
to that request, then return ongoing ownership to `may-agent.app`.
