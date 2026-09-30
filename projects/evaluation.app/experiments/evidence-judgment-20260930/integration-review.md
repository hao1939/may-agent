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

The reload stages the committed source contents of six `.app` directories, plus global agents and shared definitions, then atomically activates that snapshot. Source directories are not the same as active Apps: the unfiltered live list contains five Apps—Evaluation, Gym, May, Sample, and Scout Knowledge Library—while `may-agent.app` is paused. The rollout must preserve those five active Apps; it must not require all six source directories to become active.

Current live definitions are from `1665fad2fd5f857a64418bf506dc08e73667c79a`; current `/app` main is `706a1a134ee44790fa0299900ff29eb0799c8f87`. The exact live-source delta to current main contains May Request-continuation guidance and May-agent/Sample documentation only; there is no Scout definition delta. Those documentation files are copied into the release snapshot but do not themselves introduce new runtime behavior. The integration merge adds those exact current-main bytes and no other unrelated source. `/app/codex-resume` is untracked and is neither committed nor copied into a release.

## Operator runbook after approval

1. Recheck `/app` HEAD is `706a1a134ee44790fa0299900ff29eb0799c8f87`, tracked status is clean, and `codex-resume` remains untracked. Fast-forward main to the exact final candidate commit shown in the approval card; do not reset, clean, or touch `codex-resume`.
2. Verify the three reader source/test paths at the integrated commit match `bb147eafe7`, then emit:
   ```sh
   /usr/local/bin/may-agent --emit runtime.reload.requested '{"reason":"approved evaluator reader integration and local App rollout","expectedSourceCommit":"<FINAL_COMMIT>"}'
   ```
3. Read the correlated reload completion and `/app/.state/releases/app-definitions/current/release.json`; require `sourceCommit` to equal `<FINAL_COMMIT>` and preserve the existing five active Apps: Evaluation, Gym, May, Sample, and Scout Knowledge Library. A failed activation retains or restores the prior active generation.
4. After reload, read the current generation and evidence hash of the original Sample Task `review/appdep_24762fbf9e0f5d75ab312f54`. Admit one ordinary review of that exact Task and correlate its execution and resulting report. Require immutable JSON/Markdown report read-back, preservation of the original timeout diagnostic and useful outcome, and explicit disclosure of any judgment error. Do not create an artificial replacement Task or broad model benchmark. The report's current `sourceRevision=unavailable:not-exposed-to-workflow` is not a rollout failure; prove the loaded source with the correlated reload receipt and current release instead.

If rollback is needed, create a normal reviewed revert of this approved change while preserving unrelated work, commit that revert, and reload the new pinned commit. Do not attempt to fast-forward to the ancestor and do not move the active release symlink by hand. A reload activation failure itself retains or restores the prior active generation.
