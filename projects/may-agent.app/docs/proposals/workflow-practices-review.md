# Workflow practices review

**Status:** In progress. This is a review and rollout checklist, not a claim
that all installed workflows follow the new practice.

## Outcome

Apply the useful lessons from the multi-worker experiment: isolated edits,
focused changes, verification of the actual candidate, clear PR ownership,
independent progress during external waits, and truthful integration status.
Keep read-only workflows and runtime observations lightweight. Prefer shared
agent guidance and existing Git/Host capabilities to another framework.

The operating contract is in
[workflow authoring](../2b-manual/workflow-authoring.md#repository-changes-and-integration).
Shared prompt guidance lives in `shared/common-sense.md` at the installation
root. Source inspected: installation baseline `26562145a4`, Host `v0.2.0`.
The separate `.disabled` change is Host PR #116; it does not repair workflows.

## Findings from the first pass

1. **Shared instructions contradict the current model.** They prescribe a
   retired `project` workflow, fire-and-forget forks, committing from `/app`,
   and continuing even after finite acceptance is met. Corrected in this
   branch. This affects all agent calls that load the shared prompt.
2. **Scout's source workflow writes and admits canonical paths.**
   `scout-explore.ts` builds prompts from `workspace.projectRoot` and
   `workspace.appRoot`, admits files only there, and checks for duplicates and
   overwritten primary sources after the agent has written. Simply telling
   the agent to use a different worktree would either reject its outputs or
   leave verification looking at the wrong files. Fix these as one boundary.
3. **Scout maintenance has the same shared-write contract.**
   `knowledge-planner.ts` grants editing canonical notes, reports and the daily
   digest. Its agent instructions also require those absolute paths. No branch,
   commit, review or integration evidence is required for a maintenance claim.
4. **The daily digest is shared runtime output, not source code.**
   `scout-daily-digest.ts` reads, emits, renames and resets `today.md`; source
   workers append there too. Review loss during concurrent append and retry
   between emission and reset. Do not solve this by putting one shared daily
   accumulator in independent Git worktrees. Its "sent" wording also needs
   checking against what event publication actually proves.
5. **Library health should remain an observer.** `library-health.ts` reads the
   canonical library and records packets/metrics; it must not acquire an edit
   worktree just to inspect the library. Revisit the accepted-output metric
   when source work begins returning candidate files and commits: candidate
   creation is not integration into the canonical library.
6. **Verification must check the editor's checkout and terminal result.**
   `verified-coder.ts` runs its command at `workspace.root`, but does not put
   that explicit path in the coder prompt. It checks only `status === error`
   before proceeding, so blocked/interrupted calls can reach verification.
   A passing command alone cannot prove the requested change happened.
   This branch now supplies the explicit checkout on every attempt and stops
   before verification for every non-done agent result. Temporary-directory
   tests cover both boundaries; worktree allocation and integration remain open.

The Host already has task-generation worktree preparation, retained branch
identity and integration-aware cleanup (`src/app/adapters/workspaces/git.ts`).
It does not automatically merge a change. Current App declarations use local
workspaces; enabling Git mode needs real end-to-end proof, not just a flag.
In particular, the Scout domain directory belongs to the containing workspace
repository, while the Host project has its own Git repository. Preserve the
correct relative project path when allocating a checkout of either repository.

## One-by-one inventory

There are 24 top-level workflow entry modules under current App agent folders.
May uses direct conversational/Task handling and has no workflow module.
Archived workflows, test fixtures and `coach/workflows/gym-helpers.ts` are not
additional entrypoints. Helpers still belong to their callers' reviews.

Paths below are relative to `projects/<App>.app/agents/<agent>/workflows/`.
"Reviewed" means the boundary was inspected, not that its fixes are complete.

| App / agent | File | State / next check |
| --- | --- | --- |
| Scout / scout | `scout-explore.ts` | Reviewed; isolated writes, exact output admission, candidate vs integrated result |
| Scout / scout | `knowledge-planner.ts` | Reviewed; same write/verification boundary, preserve no-op path |
| Scout / scout | `scout-daily-digest.ts` | Reviewed; runtime output ownership, concurrent append and replay |
| Scout / scout | `library-health.ts` | Reviewed; retain observation-only behavior, truthful output metric |
| Host Operations / tech-lead | `verified-coder.ts` | Checkout prompt and terminal gate fixed; allocation/integration proof still open |
| Host Operations / tech-lead | `platform-owner-review.ts` | Queued; ownership, task steering, repair and deployment authority |
| Host Operations / tech-lead | `session-recovery.ts` | Queued; exact identity, safe redo, no duplicate effects |
| Host Operations / optimizer | `investigate-and-fix.ts` | Queued; candidate isolation, verification and integration |
| Host Operations / coach | `growth.ts` | Queued; bounded call and completion meaning |
| Host Operations / coach | `growth-cycle.ts` | Queued; lab/candidate isolation and promotion |
| Host Operations / coach | `training-sprint.ts` | Queued; trial evidence, focused patch and review |
| Gym / gym | `codex-learning-intake.ts` | Queued; evidence intake vs production mutation |
| Gym / gym | `learning-evidence-intake.ts` | Queued; authoritative evidence and replay |
| Gym / gym | `evaluation-intake.ts` | Queued; input ownership and duplicate admission |
| Gym / gym | `incident-intake.ts` | Queued; preserve source identity and existing work |
| Gym / gym | `review-and-propose.ts` | Queued; proposals vs applied changes |
| Gym / gym | `regression-run.ts` | Queued; immutable candidates, verification and side effects |
| Gym / gym | `improve-agent.ts` | Queued; overlays, benchmark truth, promotion and cleanup |
| Evaluation / evaluator | `evaluator-heartbeat.ts` | Queued; observation vs task creation |
| Evaluation / evaluator | `evaluator-deep-eval.ts` | Queued; bounded read-only review |
| Evaluation / evaluator | `evaluator-aftermath.ts` | Queued; findings and owner follow-through |
| Evaluation / evaluator | `project-health-evaluator.ts` | Queued; generated reports vs canonical source edits |
| Evaluation / evaluator | `evaluation-feedback-projection.ts` | Queued; generated feedback ownership and replay |
| Evaluation / evaluator | `executor-trial.ts` | Queued; isolated trial scope and evidence |

## Small rollout steps

1. Correct shared guidance and the authoring contract; do not claim this alone
   changes deterministic workflow behavior.
2. Make one Scout source cycle use an isolated candidate end to end, including
   path mapping, verification, branch evidence and integration. Use temporary
   Git fixtures first, then one authorized local live cycle. Keep no-op research
   cheap. Align the Scout agent's path instructions at the same time.
3. Apply that proven path to Scout maintenance. Separately check digest/runtime
   output behavior; do not introduce a second state service for it.
4. Review and refine every queued module in the table, in small commits. For
   each, decide: retain unchanged, improve guidance, fix a deterministic gap,
   or retire with evidence. Disabled Apps stay disabled during this work.

For each repaired workflow, record tests and a representative execution,
whether canonical files stayed untouched during the attempt, the exact
candidate revision verified, and what finally reached the target branch.
Preserve dirty/unmerged work on failure. Do not use a blanket auto-merge policy,
one global PR slot, extra goal per PR, or broad branch cleanup.

## First-step verification

- 80 tests passed across the May/Scout App contracts, Scout's four workflows,
  and `verified-coder`, using the current Host SDK. The new verification tests
  use temporary directories and stub agent results, not live model calls.
- Design-document integrity and `git diff --check` passed.
- No App was enabled, no live Task ran, and no deployment was performed for
  this workflow review. Scout worktree integration remains unproved.
