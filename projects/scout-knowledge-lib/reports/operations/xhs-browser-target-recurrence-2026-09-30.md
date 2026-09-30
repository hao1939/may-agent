# XHS browser-target recurrence review — 2026-09-30

## Decision

Recommend a **single conditional, target-aware recovery before researcher dispatch**, not a fresh tab on every scan and not continued manual recovery as the normal path. When the existing `prepare`/status observation reports readable note identities but the immediately following search returns zero usable items—or CDP fails on `Runtime.enable`—the workflow should record the selected target identity, open one fresh XHS tab, rerun status and search once, and then stop with the existing honest blocked/no-op behavior if that retry fails. This is a candidate scope and verification plan only; this review did not implement, apply, activate, deploy, change credentials, or mutate `explore-xhs`.

## Evidence reviewed

- Evaluation intake `wr_1790739712976_0nd0` and its exact subject evidence hash `b7eac49f2e6c2c578867046a3994e5439029c3e8820c10216aa8e448a074ffe2`. The intake classified the result as `investigate`, not approval. It verified the latest recovery but explicitly did not establish long-run health.
- Current accepted evidence for `scout-knowledge-lib/explore-xhs`, generation 2, including the eight newest attempts and their workflow/session identities.
- Current released `scout-explore.ts`, `xhs-browse.mjs`, `xhs-cdp-config.mjs`, `xhs-credential.ts`, and `xhs-source.ts`, plus target-selection tests.
- Exact workflow receipts for the three recovered scan cycles and the two preliminary attempts in the 08:00 incident.

## Frequency: cycles are not attempts

The latest six **completed scan cycles** were the successful cycles checked at approximately 2026-09-29 04:07, 08:41, 12:07, 16:07, 20:08, and 2026-09-30 00:06 UTC. Three required a fresh-tab recovery:

| Completed cycle | Outcome | Recovery evidence |
|---|---|---|
| 04:07 | 25 items | none |
| 08:41 | 26 items, finding published | fresh tab after one incomplete and one waiting attempt in the same incident |
| 12:07 | 27 items, finding published | none |
| 16:07 | 27 items, finding published | fresh tab after 33-visible/zero-usable failure |
| 20:08 | 27 items | none |
| 00:06 | 26 items | fresh tab after 27-visible/zero-usable failure |

Thus the bounded recurrence is **3/6 completed cycles (50%)**, not five incidents. The 08:00 cycle accounts for three accepted attempts: incomplete `r_2_870b356d`, waiting `r_2_7af8e564`, and recovered success `r_2_fe88df27`. The later 16:00 and 00:00 cycles each recovered within one owner attempt by rerunning the workflow after opening a fresh tab.

## Practical impact and bounded cost

- The 00:00 owner attempt ran 132.2 seconds; its failed workflow took 6.8 seconds and the successful rerun took 56.0 seconds.
- The 16:00 owner attempt ran 185.4 seconds; its failed workflow took 12.7 seconds and the successful rerun took 76.1 seconds.
- The 08:00 incident elapsed 36 minutes 53 seconds from the first attempt start to recovered success finish. This includes an intentional backoff gap of about 29 minutes 55 seconds, so it is not active compute time. Its three owner-attempt durations were about 57.6, 60.8, and 212.0 seconds.
- For comparison, the successful no-recovery owner attempts at 04:00, 12:00, and 20:00 were about 98.5, 104.9, and 113.2 seconds.

The latest six cycles ultimately delivered source coverage: the three affected cycles recovered 26–27 usable items, and two produced published findings. User impact was therefore delay and extra reconciliation effort rather than demonstrated permanent coverage loss. The 08:00 incident did temporarily leave the standing scan incomplete/waiting until backoff recovery. Provider/model monetary cost and token cost are not recorded and remain unknown. Session durations are only bounded proxies; nested workflow/helper sessions overlap and must not be summed as wall-clock latency or billed usage.

## Most likely cause and evidence gap

The released browser adapter selects the highest-priority XHS page target and preserves Chrome `/json/list` order among equal-priority explore/search targets. `prepare` opens a tab only when no XHS tab exists; it does not replace or validate alternate existing targets. Status and search run as separate processes, each independently reselecting a target. A target can therefore satisfy the coarse status check (stable note links or sections remain in its DOM) yet return zero title-bearing items after search navigation. Opening a fresh tab repeatedly restores 26–27 usable items.

This makes **stale or unhealthy selected-target state** the best-supported explanation, and it is stronger than an authentication explanation: every affected receipt says `login-wall:false`, and fresh tabs recovered without credential changes. It is not proven. Current evidence does not retain the selected CDP target ID, `/json/list` ordering, DOM readiness transition, navigation events, console/network failures, or a before/after comparison on the same target. The 08:41 failure was `Runtime.enable` timeout rather than the exact visible/zero mismatch, so the population may include more than one CDP target-health symptom. XHS client-side rendering or navigation timing remains a viable alternative.

## Option comparison

| Option | Benefit | Risk / cost | Judgment |
|---|---|---|---|
| Do nothing | Zero implementation and maintenance cost | Accepts a 3/6 bounded recurrence, repeated owner reasoning, and possible backoff delay | Too weak for the observed frequency |
| Retain current on-demand fresh-tab recovery | Proven to recover all three observed affected cycles; no credential work | Recovery is agent-driven and inconsistent; one incident needed three attempts and ~37 minutes elapsed | Safe fallback, but not the best steady state |
| Bounded target-aware preflight/conditional retry | Automates only the already-proven remedy before researcher dispatch; caps tab creation and retry work; adds diagnostic identity | Small code/test burden; one extra status/search only on a precise failure; must avoid hiding persistent failures | **Recommended smallest response** |
| Proactive fresh tab on every cycle | Likely avoids selecting old equal-rank targets | Adds tab churn and source navigation every cycle, may accumulate tabs or disturb a useful authenticated page, and is unnecessary in 3/6 observed cycles | Disproportionate without stronger evidence |

## Exact candidate scope

If separately authorized, confine a candidate to the XHS preparation/search boundary:

1. Return a credential-safe selected-target identifier or hash in status/search evidence; never expose tokens or cookies.
2. Preserve the existing first status and search calls.
3. On only (a) `Runtime.enable`/target-connect failure, or (b) positive visible-note count followed by zero usable search items, create one fresh `https://www.xiaohongshu.com/explore` target and retry status plus the same search once.
4. Admit success only from the retry's real items. If it fails, retain both target-scoped observations and the existing blocked/incomplete behavior; do not loop, request credentials without a login wall, or mutate the standing Task.
5. Close only the newly created recovery tab after the workflow has captured source links, if closure can be proven not to affect detail reads; otherwise mark it explicitly for bounded later cleanup rather than closing an unowned tab.

## Verification plan

- Unit tests: equal-priority old/new targets; selected-target evidence is credential-safe; fresh target is created only for the two exact predicates; at most one retry; both failures remain visible; login-wall behavior is unchanged.
- Frozen workflow tests: healthy search performs no additional target creation; 27-visible/zero-usable then 26-item retry succeeds; `Runtime.enable` timeout then healthy fresh target succeeds; retry failure blocks honestly.
- Live canary: run only through the existing `explore-xhs` responsibility and compare at least six subsequent scheduled cycles. Record cycle identity separately from attempts, selected target hashes, whether recovery fired, item count, owner-attempt elapsed time, and any unfinished scan. Do not claim improvement from one success.
- Acceptance threshold: no regression in healthy cycles, no unbounded retries or credential exposure, every conditional recovery produces attributable real items or an explicit failure, and the fresh-target rate/unfinished-cycle rate is lower or at least better diagnosed over the bounded canary.

## Limitations

This is an operational diagnosis based on current Task evidence and released source code, not a live reproduction or browser/network trace. The six-cycle window is small and contiguous, so 50% is a bounded observed frequency, not an estimated long-run rate. No provider billing, model tokens, browser resource consumption, or maintenance-hours measurement was available.
