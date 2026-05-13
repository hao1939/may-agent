# Remote SSH Path Guard False Positive

## Summary

A dev forked AKS RP e2e session (`s_1778678318230_146`) was blocked by the bash path guard on a command containing `/home/hayua/rp/bin`, even though the task explicitly instructed running `cd /home/hayua/rp && ...` on `devbox`. The active project workflow already warns workers to use remote tools for remote paths, but direct `agents.fork` work does not necessarily provide `ssh_exec`/`cc_worker`, and the runtime bash guard appears to classify remote SSH command strings as local path hallucinations.

## Evidence

- `events` query found guard.triggered for owner `dev`, session `s_1778678318230_146`, reason `PATH_HALLUCINATION`, detected `/home/hayua/rp/bin`, timestamp `1778678345308`.
- The paired `message.created` / `session.start` task from May instructed: `SSH to devbox`, then run `cd /home/hayua/rp && ./bin/e2ev3 -test.run PAFThrottling ...`; this is a remote absolute path, not a local `/app` path.
- `sessions` query still shows `s_1778678318230_146` as `running` with `opCount=0` about 30 minutes after start, suggesting the fork was wedged or unable to recover after the first guard block.
- `agents/shared/workflows/project.ts` already contains remote-work convention text for project workers, including: use `ssh_exec` / `cc_worker` for remote paths and do not treat a local path-guard warning as proof that remote access is unavailable.
- `agents/shared/guards/hallucinated-path.ts` is a workflow guard that only warns on step_done and documents the same `/home/` pattern; the blocking text came from the tool-level bash guard, so the fix likely belongs in the runtime bash guard or in direct fork prompt/tool routing, not this workflow guard alone.

## Root Cause Hypothesis

The local bash path guard does not distinguish `ssh devbox 'cd /home/...'` remote command strings from local `cd /home/...` commands. In direct fork sessions that only have local bash, the worker is simultaneously instructed to SSH to a remote host and forbidden from referencing the remote absolute path in the shell command.

## Impact

This blocks the active `aks-rp-e2e` PAFThrottling validation path and creates false `PATH_HALLUCINATION` guard noise for legitimate remote work. The project workflow has prompt mitigations, but May's direct fork still hit the guard, so prompt-only mitigation is insufficient.

## Recommended Fix

1. Inspect the tool-level bash path guard implementation (outside the visible `agents/shared/guards/hallucinated-path.ts` workflow guard if necessary).
2. Allow `/home/...`, `/Users/...`, `/root/...`, and `~/...` patterns when they occur inside the remote command argument of an explicit SSH invocation such as `ssh devbox '...'` or `ssh <host> "..."`.
3. Keep blocking local commands such as `cd /home/...` without an SSH prefix.
4. Add tests for both cases:
   - local `cd /home/hayua/rp` blocks;
   - `ssh devbox 'cd /home/hayua/rp && ./bin/e2ev3 ...'` is allowed or routed to a remote-tool guidance warning rather than blocked.

## Validation Path

After the guard change, re-run a minimal safe command shape such as `ssh devbox 'pwd'` or a dry-run command that contains `/home/hayua/rp` inside the remote quotes. Then retry the AKS RP PAFThrottling session and confirm it can reach remote execution rather than failing at local path classification.
