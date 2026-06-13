# Iteration 1 — workflow bridge null-event guard

## Goal
Stop the recurring `evaluator-aftermath requires a sessionId` escalation loop so event-driven aftermath reviews either receive a concrete `session.completed` trigger or do not dispatch.

## Live evidence
- Runtime `events` still shows the current failure shape: recent `session.completed` rows are immediately followed by `handler.workflow_dispatched` rows for `workflow='evaluator-aftermath'` with `status='escalated'`, plus matching `escalation.created` payloads whose `context.trigger` is `null`.
- Sample sequence from the live DB during this iteration:
  - `session.completed` for `s_1778932438174_3` (`workflow:dev-heartbeat`) at `1778932446987`
  - `handler.workflow_dispatched` for `evaluator-aftermath` with `status='escalated'` at `1778932447022`
  - `escalation.created` with `reason='evaluator-aftermath requires a sessionId'` and `context.trigger:null` at `1778932447018`
- The fallback `session-aftermath-scan` path still constructs its own trigger JSON with `data.sessionId`, so evaluation coverage remains live even while the event path is noisy.

## Change made
Patched `shared/lib/workflow-handler.ts` so the generic workflow bridge now **skips dispatch** when `includeEvent: true` is configured but the handler was invoked without an event payload. Instead of launching a workflow with a task missing `## Trigger Event`, it emits a structured `handler.skipped` event with reason `includeEvent requested but no event payload received`.

This directly addresses the null-trigger loop for `agents/may/cron.json` entry `evaluator-aftermath`, which already sets `includeEvent: true`.

## Regression coverage
Added `shared/tests/workflow-handler.test.ts` covering:
1. normal dispatch with appended trigger event,
2. skip-without-dispatch when `includeEvent` is set and the event payload is absent,
3. existing `shouldRun` skip behavior with `handler.skipped` evidence.

## Verification
- `bun test shared/tests/workflow-handler.test.ts` → `3 pass, 0 fail`
- `bun test shared/tests/workflow-handler.test.ts shared/tests/error-log.test.ts` → `13 pass, 0 fail`

## Remaining blocker
I did **not** commit because `/app` already has unrelated dirty paths owned by other work:
- `projects/aks-rp-e2e/journal.md`
- `projects/aks-rp-e2e/project.md`
- `projects/platform/discussion.md`
- `projects/platform/outputs/iter20-ui-feature-design.md`
- `projects/platform/project.md`
- `projects/platform/ui/index.html`
- `shared/may-agent-docs/INDEX.md`
- `shared/workflows/project.ts`
- `.copilot/`
- `hn-ai-agents-research.md`
- `scripts/fetch-session.mjs`
- `shared/may-agent-docs/2a-design/session-audit.md`

Because success requires a clean app worktree after commit, this iteration should be treated as **partial** until those unrelated changes are isolated or cleared and the patch can be staged/committed cleanly.
