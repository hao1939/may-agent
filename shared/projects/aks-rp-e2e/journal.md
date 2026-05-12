# Journal: aks-rp-e2e

This is the curated project journal. The original append-only workflow log is
preserved in `journal.raw.md` because it contains useful audit evidence, but it
is noisy: a workflow bug repeatedly restarted local iteration numbering from
1, so raw headings like `Iteration 1`, `Iteration 2`, and `Iteration 3` are
workflow-run-local labels, not a monotonic project sequence.

## Current State

The documentation goal is complete. The project is waiting because actual e2e
execution depends on a healthy standalone deployment on the devbox.

Completed:
- `outputs/e2ev3-architecture.md` documents the e2ev3 framework and was
  verified against the live repo.
- `outputs/standalone-setup.md` documents the standalone setup and runner flow.
- `outputs/doc-verification.md` records live-repo verification and the SIG count
  correction.
- Supporting artifacts cover authoring, troubleshooting, scenario inventory,
  readiness checks, run scripts, and deploy-failure analysis.

Blocked:
- `e2e.local-run-success` needs a live standalone environment.
- `e2e.sample-test-written` needs either a confirmed live environment or a new
  explicit goal to write a sample without running it.
- Latest deploy analysis says localdeploy failed with infrastructure/auth
  issues: OOM/image pull, expired git auth, SP ID conflict, missing input/config
  problems. See `outputs/deploy-failure-analysis.md`.

Resume when:
- Human confirms standalone is deployed and provides the build version, or
- Human closes the project as documentation-only, or
- Human defines a new concrete follow-up goal.

## Key Timeline

### 2026-05-11 12:30-12:43 UTC - Core Documentation Produced

Master was asked to push iteration 2 and document the e2ev3 framework plus
standalone setup.

Outputs:
- `outputs/e2ev3-architecture.md`
- `outputs/standalone-setup.md`
- `outputs/doc-verification.md`

Evidence:
- Commit `216ce87c7`: initial architecture and standalone setup docs.
- Commit `667c2735f`: verified docs against live repo and corrected SIG count
  from 27 to 24.

Conclusion:
- The original documentation milestones were satisfied.

### 2026-05-11 12:47 UTC - Goal Expanded To Running One Case

Hao asked: "please try to run one e2ev3 case to make sure everything is up."

This expanded the work from documentation to execution validation.

Result:
- A test launch reached the point where the binary authenticated and constructed
  work, but standalone infrastructure was not available.
- `outputs/e2e-run-attempt.md` records the first run attempt and blocker.

### 2026-05-11 Afternoon - Supporting Documentation Added

Workers produced useful supporting docs while standalone was unavailable:
- `outputs/writing-e2e-tests.md`
- `outputs/e2e-quickref.md`
- `outputs/README.md`
- `outputs/scenario-catalog.md`
- `outputs/troubleshooting.md`
- `outputs/standalone-readiness-check.sh`
- `outputs/project-status.md`
- `outputs/unblock-runbook.md`

Conclusion:
- These artifacts are useful, but several iterations were redundant because the
  workflow kept re-entering the project and reusing low iteration numbers.

### 2026-05-11 19:40 UTC - Devbox Progress

The worker installed Go on devbox and initiated standalone deployment via
`aksbuilder_localdeploy.sh`.

Updated:
- `outputs/standalone-setup.md`

Conclusion:
- The project moved from pure documentation toward execution, but the deploy
  still had to finish before e2e tests could run.

### 2026-05-11 Night To 2026-05-12 - Deploy/Execution Attempts

Workers repeatedly checked deploy state and prepared run/validation scripts:
- `outputs/test-execution-playbook.md`
- `outputs/iteration-status.md`
- `outputs/first-e2e-run.sh`
- `outputs/run-e2e.sh`
- `outputs/post-deploy-validation.sh`
- `outputs/deploy-status.md`
- `outputs/iteration3-status.md`
- `outputs/final-status.md`

Most of this was follow-up around the same blocker: standalone was not healthy
yet, and several SSH commands were impeded by path-hallucination guards treating
remote `/home/hayua/rp` or `~/...` paths as local paths.

### 2026-05-12 - Deploy Failure Root Causes Captured

`outputs/deploy-failure-analysis.md` was updated with concrete localdeploy
failure causes and recovery steps.

Current blocker:
- Human/devbox intervention is needed before another e2e execution attempt is
  productive.

## Workflow Issue Found

The raw journal and `discussion.md` show repeated iteration labels such as
`Iteration 1`, `Iteration 2`, `Iteration 3`, and repeated read markers
`---read @iter1---`.

Root cause:
- The project workflow previously trusted `project.md` as the only iteration
  source.
- During the transition to YAML frontmatter, some runs parsed `iteration:` but
  did not reliably update it, so subsequent workflow runs restarted at low
  iteration numbers.
- Normal worker iterations also appended discussion read markers even when no
  new discussion was processed.

Fix landed:
- Commit `92b5048c0` makes project iteration recovery durable by using the max
  of `project.md` iteration and `journal.md` latest iteration.
- Commit `be74e09d3` routes project comments through the comment-iteration path
  and removes redundant discussion injection into worker prompts.

Reading rule:
- Treat raw `Iteration N` headings before the fix as workflow-run-local labels.
- Use timestamps and artifact names to understand sequence.
- Use this curated journal for project status; use `journal.raw.md` only when
  auditing exact workflow behavior.

## Canonical Artifacts

Primary:
- `outputs/e2ev3-architecture.md`
- `outputs/standalone-setup.md`
- `outputs/doc-verification.md`
- `outputs/e2e-run-attempt.md`
- `outputs/deploy-failure-analysis.md`

Useful support:
- `outputs/writing-e2e-tests.md`
- `outputs/scenario-catalog.md`
- `outputs/e2e-quickref.md`
- `outputs/troubleshooting.md`
- `outputs/standalone-readiness-check.sh`
- `outputs/run-e2e.sh`
- `outputs/post-deploy-validation.sh`
- `outputs/final-status.md`

Raw evidence:
- `journal.raw.md`
- `discussion.md`
