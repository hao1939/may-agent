# Shared execution iteration — 2026-09-17

Status: implemented, locally activated and tested; no merge or remote rollout claimed.

The common contract is in `may-agent.app/docs/2a-design/workflows.md`. One Task
owns the outcome. Agents choose methods; workflows compose bounded operations.
Awaiting a result does not suspend event admission. Shared managed execution
forwards durable Task feedback, carries exact scope and cancels nested helpers.
Only Task settlement accepts results and consumes input.

The Host candidate binds model-facing workflow tools per exact caller session,
accepts structured input, propagates Task context through helper calls and uses
the shared managed-agent boundary for feedback. Conversation invocations receive
the same context. A procedure requiring a Task worktree cannot run in a shared
Conversation workspace. Ordinary Git-backed Tasks allocate their worktree before
agent execution. Historical Task workflow runs recover through their owning Task,
not through the model tool's legacy resume action.

May now owns its profile and team workflow inside `may.app`. Public inputs are
message and goal; May selects a procedure rather than a development input routing
to tech-lead. Bob and tech-lead remain specialists. Changed input preserves saved
reports, prompts fresh judgment and permits exact verification reuse when the
requirements, command and candidate still match. Workspace/file layout redesign,
scoped naming and Bob's missing search tools remain separate.

Portable checks have exercised concurrent same-name callers, structured input,
exact Task reads, feedback during a helper call, cancellation and listener cleanup.
Provider responses in those tests are synthetic. App checks exercise real Git and
commands with synthetic specialist judgments.

## Local iterations

Executable App definitions: `88f3c4ee0a0826fb94841f7a3eff9ff8832cc919`.
Initial Host: `a370feed`; corrected Host: `ea770799`.

1. An ordinary goal selected May, who chose `develop-change` and called Bob,
   tech-lead and Bob again under the same Task. The candidate was committed and
   reviewed. A saved correction was missed by live delivery but recovered in a
   later attempt. The experiment also supplied inaccessible source paths; Bob
   disclosed that limit. A misrouted test Conversation request was withdrawn.
2. With the common addressing fix and accessible source copies, a targeted
   message reached tech-lead during its active step. Its report incorporated
   “A delivered update is not an accepted result.” Bob passed the candidate;
   May read the report and evidence and independently checked the correction.
   Candidate `d5aeb5503c088dc6b4775ea24a675d50d0d6e637` changes only the requested
   report. Pending input caused a later May pass, which reused the completed
   work. Only one workflow run was needed.
3. A separate goal was cancelled while May awaited Bob. Both agents stopped
   within approximately 1.1 seconds of the accepted cancellation. The public
   Task view stayed cancelled with no later replacement execution. The other
   report Task continued normally.
4. An informational follow-up asked for the saved report path, commit and
   correction. May reused the exact candidate and evidence references, with
   zero additional workflow runs or specialist calls.

Independent inspection checked the report, clean worktree, single-file commit,
exact correction and SHA-256 references. The report is coherent and candid about
what source reading and its simple verification do not prove. May's final answer
accurately names the saved artifact and commit without claiming merge or deploy.

Host CI passed 3,080 tests (3 installation-only skips); App checks passed 50
(1 optional integration skip), and common design checks passed. See the
[common review](../../may-agent.app/docs/archive/reviews/shared-execution-20260917.md)
for the shared implementation and test boundaries. Exact local receipts and
inspection are retained in `.state/review-pilots/may-shared-execution-20260917/`.

## Remaining experience limits

Live delivery improves responsiveness; it does not automatically acknowledge
input. Another Task pass can still be needed, as observed here. That pass reused
evidence, but it adds model latency. The trials directed May to use the team and
do not prove general method selection on arbitrary human requests. Bob's
read-only preset still lacks listing/search, causing unnecessary guessed reads.
These are useful next evaluation targets; neither justifies a second workflow
scheduler or deletion of earlier evidence. Live Host-restart recovery was not
retested in this iteration. Workspace/file convention remains deferred.
