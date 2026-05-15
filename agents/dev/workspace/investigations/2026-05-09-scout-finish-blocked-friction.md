# Scout finish-blocked friction investigation

Date: 2026-05-09
Owner: dev

## Question

Scout's operational-friction rate was about 80%, with many sessions carrying the evaluator issue `finish blocked by uncommitted changes`. The task was to determine whether Scout had bad git hygiene instructions or a systematic file-write workflow problem, then patch Scout's workflow.

## Evidence

### Config / prompt state before patch

- `agents/scout/AGENTS.md` told Scout where to write durable/shared outputs, but had no explicit pre-finish git hygiene sequence.
- `agents/scout/heartbeat.md` similarly described creative outputs but did not tell Scout to run `git status`, stage exact deliverables, commit, and verify before finish.
- `agents/scout/workflows/scout-heartbeat.ts` built a rich prompt with metrics, alerts, inbox, projects, and guidance, but no finish-hygiene block.
- `agents/scout/workflows/scout-explore.ts` passed the raw cron task directly to `ctx.runAgent(agent, task)`, so explore sessions received no workflow-level closeout instructions.

### Recent session pattern

Read-only DB query for Scout evaluations in the last 24h with `finish blocked by uncommitted changes` showed:

| source | raw_n | good_n | non_good_n |
|---|---:|---:|---:|
| workflow:scout-heartbeat | 49 | 3 | 46 |
| workflow:scout-explore | 24 | 21 | 3 |
| workflow:goal-driver | 1 | 0 | 1 |

A broader Scout evaluation count showed 74/130 recent Scout evaluations had the finish-block issue (`rate=0.5692`).

Sampled transcripts showed the same pattern:

- `s_1778365507431_334` (scout-explore): Scout appended to `scout/workspace/digest/today.md`, called `finish(success)`, was blocked, then followed the guard-provided `git add -f -- 'scout/workspace/digest/today.md' && git commit ...` command. It then hit a second verification-depth block for not reading after shell write.
- `s_1778367112016_356` (scout-heartbeat): Scout edited KE-1026, called `finish(success)` before commit/readback, then committed only after the finish guard rejected it, then hit the read-back guard.
- `s_1778363468347_311` (scout-explore): Scout wrote XHS/digest/KE files, called `finish(success)` before commit, then committed and retried, then hit the read-back guard.

The issue is not that Scout cannot recover. Most sampled sessions eventually finish successfully after the guard tells them exactly what to do. The friction is that Scout's workflows did not tell it to do the commit/readback/status sequence before the first finish attempt.

## Related project context

`agents/shared/projects/finish-blocked-hygiene-reduction/project.md` and iteration 5 concluded that strict unresolved dirty exits are low/zero after evaluator fixes, but raw finish-block friction remains frequent and is led by Scout workflows. The project had stopped short of source-specific Scout prompt patching because earlier samples ended cleanly; this investigation focuses on reducing the raw friction attempts.

## Fix implemented

Patched Scout's two source workflows:

1. `agents/scout/workflows/scout-heartbeat.ts`
   - Added a workflow prompt section: `## Finish Hygiene (required before finish(success))`.
   - It instructs Scout to verify changed files, run `git status --short`, stage exact intentional paths only, use `git add -f` for ignored Scout workspace deliverables, commit with a descriptive `scout:` message, re-run status, ignore runtime/log/unrelated files, and cite read-back/commit/status evidence in `finish(success)`.

2. `agents/scout/workflows/scout-explore.ts`
   - Wrapped the cron task in a new prompt containing the same source-specific finish-hygiene block.
   - Changed `ctx.runAgent(agent, task)` to `ctx.runAgent(agent, prompt)` so explore sessions actually receive the hygiene instructions.

## Verification

- Read back both modified workflow files after editing.
- Ran `cd /app/agents && bun --check scout/workflows/scout-heartbeat.ts scout/workflows/scout-explore.ts`; syntax check passed with no output.
- `git diff` showed only the intended Scout workflow prompt changes.

## Expected impact

The fix targets raw operational friction by moving guard instructions earlier in the workflow. It should reduce first-attempt `finish()` blocks for Scout sessions that modify digest/workspace/shared knowledge files, without loosening the finish guard or encouraging broad staging of unrelated dirty runtime files.
