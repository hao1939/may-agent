# Reddit Source Contract Review — 2026-09-24

## Decision

**Recommendation to the App owner:** temporarily pause the automatic four-hour
Reddit cadence, while preserving the standing `explore-reddit` responsibility,
and authorize a bounded source-contract change that tries Reddit's public,
post-specific RSS/Atom representation before declaring body verification
blocked. Resume scheduled scans only after that public path has a documented
evidence rule and a bounded validation proves it can expose attributable post
content. Do not seek authenticated access first.

**Next owner action:** approve or reject that contract direction and the temporary
schedule hold. If approved, commission one bounded design/validation change with
acceptance that it (1) remains read-only and unauthenticated, (2) preserves the
stable `t3_...` ID, (3) distinguishes post body and comments from feed metadata,
(4) records exact HTTP boundaries with bounded timeouts, and (5) falls back to
an evidence-backed no-op without substitution or bypass. This review did not
change the schedule, standing Task, workflow, credentials, or source behavior.

## Why the current pattern is representative

The Evaluation publication for evidence
`5f83d6ec5a63e58f5252025ac4c00271a79d49d5abd1f78ea969975116b71199`
was fresh for generation 2 at `2026-09-24T08:21:02.421Z`. It independently
reproduced HTTP 403 for the latest candidate JSON endpoint and found matching
workflow/session receipts. The current canonical Task read still reports that
accepted result: public search RSS discovered `t3_1wovfwo`, its exact JSON
endpoint returned HTTP 403, and the run correctly published no change.

The accepted-evidence page shows seven consecutive JSON-verification failures,
all handled as evidence-backed no-ops:

| Accepted observation (UTC) | Candidate |
|---|---|
| 2026-09-23 08:11 | `t3_1wnzr3g` |
| 2026-09-23 12:12 | `t3_1wo3u72` |
| 2026-09-23 16:07 | `t3_1woa1s8` |
| 2026-09-23 20:10 | `t3_1woftgj` |
| 2026-09-24 00:17 | `t3_1womd96` |
| 2026-09-24 04:08 | `t3_1woq2ch` |
| 2026-09-24 08:11 | `t3_1wovfwo` |

This is representative of the **current JSON verification path**, not proof that
all public Reddit representations are unavailable. The immediately preceding
accepted attempt, at `2026-09-23T04:12Z`, integrated a useful Reddit finding.
A prior source-lane report also records a bounded public post-RSS request for
`t3_1v8a3sh` returning HTTP 200 with the post and six comments while JSON
remained HTTP 403. That endpoint-specific evidence is why indefinite source
retirement or authentication-first remediation would be premature.

## Per-run correctness versus owner-level utility

Each no-op is valid under the active contract: discovery begins with public
search RSS; feed title and timestamp alone do not support body claims; exact
retrieval boundaries must be recorded; login, bypass, mutation, and substitute
sources are forbidden. The latest run followed those rules.

Owner-level utility is different. The App currently schedules Reddit every
`14,400,000` ms (four hours). Seven consecutive cycles over roughly one day
produced no integratable content because the selected body verifier was blocked.
The evaluator found the three newest attempts compact (about one to two minutes
and 11–15 operations each), but did not establish a complete cost record for
all seven. The evidence therefore supports persistent low marginal utility and
repeated operational work, not a precise total-cost claim.

## Options

| Option | Expected benefit | Cost | Operational risk | Evidence limit |
|---|---|---|---|---|
| Do nothing | No design or rollout work; preserves frequent recovery detection. | Continues up to six scheduled attempts per day on the same blocked verifier. | Low access-control risk, but recurring low-value work and noisy no-op history. | Seven failures cover about one day; they do not prove a permanent block. |
| Reduce cadence | Cuts repeated work while retaining periodic recovery detection. | Requires an owner-approved schedule change; still pays for the same blocked path. | A recovery or valuable thread may be detected later. | No evidence here identifies an optimal interval. |
| Pause automatic scans | Stops known low-yield scheduled work immediately while keeping responsibility intact. | Requires explicit owner authority and a clear resume criterion. | Reddit changes can be missed while paused; an indefinite pause could silently become retirement. | Appropriate only as a temporary hold tied to contract validation. |
| Support public post-specific RSS/Atom verification | Could restore attributable body/comment evidence without credentials; prior local evidence shows this worked for one stable post while JSON was blocked. | Requires a bounded contract, parser/evidence rules, tests, and validation against current posts. | Feed variants may be incomplete, rate-limited, malformed, or unavailable; comments remain community evidence rather than empirical confirmation. | One documented successful post-RSS case does not establish universal availability. |
| Support an authenticated official API | Could provide a stable documented body endpoint if Reddit approves the use and network path. | Credential provisioning, secret handling, API registration, terms review, rate-limit handling, and ongoing maintenance. | Higher security/compliance burden; authentication must not be treated as permission to mutate content. | No current evidence proves credentials are available, authorized, or sufficient to resolve this network boundary. |

## Boundaries and provenance

- Governing intake: workflow `wr_1790238077381_c3sb`; stable handoff key
  `3cb041739b7e1afe4fa43402aef842bd6048a19b3cb0b09902094bc43b153023`.
- Evaluation publication:
  `task-outcomes/evaluator-deepseek/scout-knowledge-lib/task-outcome-v2/explore-reddit-5f83d6ec5a63e58f.md`.
- Current Task evidence: canonical `scout-knowledge-lib/explore-reddit`,
  generation 2, read on 2026-09-24.
- Active contract: read-only public Reddit access, RSS-first discovery,
  descriptive User-Agent, bounded connection and total timeouts, stable post
  IDs, and no login, bypass, substitution, or mutation.
- Public-path precedent:
  [`../research/xhs-seed-first-memory-lanes-2026-09-01.md`](../research/xhs-seed-first-memory-lanes-2026-09-01.md),
  section “What each lane can actually do” and cycle 3 evidence.

No fresh Reddit request was made for this review, so it does not claim current
post-RSS availability or access recovery.
