# Evaluator reader integration and local rollout review

## Decision requested

Approve one scope: fast-forward `/app` main from `706a1a134ee44790fa0299900ff29eb0799c8f87` to the final commit on `fix/evaluator-evidence-judgment`, reload the committed App definitions onto the local May-agent, and obtain one ordinary post-rollout Evaluation report. Do not approve any remote merge, Host-binary deploy, benchmark change, chronology fix, or helper-finish fix.

## Pinned candidate and evidence

Integration merge `6ea1bbfb4c91cc8282bdc778f8a64322173ac9af` combines current main with reviewed reader commit `bb147eafe7a67cff35af419d4203525d18697f7b`. The reader implementation, focused tests, and reader design text are byte-unchanged from `bb147eafe7`; only current-main history and the documentation corrections in the later review commit are added.

The existing bundle `/app/.state/review-pilots/evaluator-evidence-judgment-20260930/revised-reader-bundle.json` has SHA-256 `8df679c36ff04c17daac35bcd58cf9a2177d5dd31aa2256b303a1ff8892ecce4` and binds these immutable receipts:

- focused check: `1b2b9ad2b6ba037cb89c2f9db7a3a49c5fdd14b46052a3b8ff8412582d0feac2` — 237 tests, 1,255 assertions, syntax/typecheck/format passed;
- unchanged-message live probe: `7c6892cd14c01e52b9110febb1c06d1e4d37e44b1d5b1cbdeb3189ef9e79318e` — one extra raw read in 36 ms;
- predecessor model comparison bundle: `5197e45e8d4deb2b418088a6e8224069f69e1a7ef089f6cc1a65c7c975763113`;
- run manifest: `c547f3935654add5f80cfa3b6e7d0480f6d83ba053db599f7f04e3bd10c17ebb`.

The model comparison and final live probe are separate evidence. The first sampled reviewer behavior; the second verified revised reader output without changing the compared message evidence.

## Value, limits, and rollout assessment

The candidate recovers a bounded diagnostic tail from up to three strongly correlated failed results under one shared five-second client deadline. Both candidate repeats saw the retained 120-second timeout that both baselines missed. It remains only an evidence-fidelity improvement: one repeat reversed chronology, controls do not establish broad reliability, and the separate repeated-finish behavior is untouched.

The reload stages a committed snapshot of all six installed App directories plus global agents and shared definitions, then atomically activates that snapshot. It is not Evaluation-only. Current live definitions are from `1665fad2fd5f857a64418bf506dc08e73667c79a`; current `/app` main is `706a1a134ee44790fa0299900ff29eb0799c8f87`, so activation also rolls forward unrelated committed May, May-agent documentation/guidance, Sample, and Scout-definition differences already present on main. The integration merge adds those exact current-main bytes and no additional unrelated source. `/app/codex-resume` is untracked and is neither committed nor copied into a release.

## Operator runbook after approval

1. Recheck `/app` HEAD is `706a1a134ee44790fa0299900ff29eb0799c8f87`, tracked status is clean, and `codex-resume` remains untracked. Fast-forward main to the exact final candidate commit shown in the approval card; do not reset, clean, or touch `codex-resume`.
2. Verify the three reader source/test paths at the integrated commit match `bb147eafe7`, then emit:
   ```sh
   /usr/local/bin/may-agent --emit runtime.reload.requested '{"reason":"approved evaluator reader integration and local App rollout","expectedSourceCommit":"<FINAL_COMMIT>"}'
   ```
3. Read the correlated reload completion and `/app/.state/releases/app-definitions/current/release.json`; require `sourceCommit` to equal `<FINAL_COMMIT>` and all six installed Apps to be present. A failed or mismatched reload leaves the prior release active.
4. Admit one ordinary `review-task-outcome` request for a fresh completed non-Evaluation Task, retain its exact Task/generation/evidence identity, and require a newly published, integrity-readable Evaluation JSON/Markdown report from the loaded commit. Judge the report as a smoke check, not proof of broad quality.

Rollback is a reviewed fast-forward/revert back to `706a1a134ee44790fa0299900ff29eb0799c8f87` followed by the same pinned reload process; do not move the active release symlink by hand.
