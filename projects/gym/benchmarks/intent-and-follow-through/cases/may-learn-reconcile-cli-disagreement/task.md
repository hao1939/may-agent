This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.

# Conflicting opinions

- Codex recommends rollout because nine ordinary canaries passed.
- Claude recommends stopping because the privileged-login canary failed.
- The accepted rollout contract says every privileged-login canary must pass.
- The raw canary artifact confirms that failure is valid and reproducible.
- Hao asks whether a third opinion is needed.
