# Reddit Source Contract Review — 2026-09-24

## 2026-09-30 cadence decision: reduce to daily until body access is validated

**Recommendation:** the Scout App owner should reduce the automatic Reddit
schedule from every four hours to once daily, while preserving the standing
`explore-reddit` responsibility and its current unauthenticated, read-only access
boundary. This is the smallest proportionate adjustment: it retains a regular
recovery check but stops paying six times per day for a body-retrieval path that
has now failed across the complete newest accepted-attempt page. This report does
not change the schedule or prepare a workflow candidate.

The latest accepted attempt remains a correct immediate no-op. Evaluation
publication evidence hash
`45488ede388d7ed9646a2466a5a697fad8f7ffed73bebb7583eb2e820f0077ac`
(intake `wr_1790783257367_pnt4`) assessed attempt
`r_2_66b7b4e9-ebc9-4a35-a17e-149a308ff326` as truthful and
acceptance-conformant: the current search Atom feed returned HTTP 200, candidate
`t3_1wu3488` was stable, its exact public permalink returned HTTP 403, feed
metadata was not promoted to a body claim, no files changed, and no independent
obligation was discarded. The evaluator's later live probe corroborated the
same access pattern, while correctly limiting the exact 12:11 feed state to the
workflow's recorded evidence.

Owner-level cadence judgment requires the population, not just that valid
no-op. The eight newest accepted attempts cover eight distinct candidates and
about 28 hours of four-hourly starts:

| Candidate | Accepted-attempt duration | Search feed | Selected body | Publication |
|---|---:|---|---|---|
| `t3_1wu3488` | 75.178 s | HTTP 200 | HTTP 403 | no change |
| `t3_1wtyqub` | 76.283 s | HTTP 200 | HTTP 403 | no change |
| `t3_1wtuysu` | 62.469 s | HTTP 200 | HTTP 403 | no change |
| `t3_1wtq7ck` | 62.730 s | HTTP 200 | HTTP 403 | no change |
| `t3_1wtkiky` | 86.312 s | HTTP 200 | HTTP 403 | no change |
| `t3_1wtdkte` | 70.056 s | HTTP 200 | HTTP 403 | no change |
| `t3_1wt871l` | 108.943 s | HTTP 200 | HTTP 403 | no change |
| `t3_1wt4015` | 84.415 s | HTTP 200 | HTTP 403 | no change |

Together these accepted attempts consumed about **626.386 seconds** of owner
attempt runtime (about 10 minutes 26 seconds; mean 78.298 seconds, range
62.469–108.943) and yielded **zero publications**. This is not a monetary-cost
estimate: provider tokens, money, nested-workflow billing, and the yield of
history older than this eight-attempt page remain unknown. The page also cannot
show that every Reddit post representation is blocked or that any inaccessible
candidate would have been useful. It does show that the current selected-body
path has no practical research yield at the present cadence.

### Option judgment, ownership, and triggers

- **Keep four-hour cadence:** rejected for now. It maximizes recovery-detection
  frequency but repeats a demonstrated zero-yield body path six times per day.
- **Daily cadence:** recommended to the **Scout App owner**. It reduces recurring
  attempt work by roughly five scheduled opportunities per day while retaining
  one lawful recovery observation. Exact savings are not forecast because
  per-run provider usage and future runtime are unmeasured.
- **Readable public path:** still the preferred recovery direction, but requires
  a later authorized change. The bounded 2026-09-28 diagnostic below showed one
  selected post's public RSS representation returning attributable body content
  before two subsequent requests hit HTTP 429. That supports post-specific
  RSS/Atom as a lawful validation target, not as universally available body
  access and not as authority to implement it now.
- **Authentication, bypass, unauthorized scraping, source substitution, or
  metadata-as-body:** rejected. They add unsupported authority or weaken the
  evidence boundary.

Revisit the daily limit early if a separately authorized validation demonstrates
that selected-post RSS/Atom returns attributable body content under the bounded
request budget, with stable post identity, metadata/body separation, and honest
stop-on-403/429 behavior. Otherwise review after seven daily accepted attempts.
Restore a faster cadence only if that review shows repeatable readable bodies or
material publication yield; pause or retire the lane only through a separate
owner decision if daily checks remain body-blocked. Risks of the daily cadence
are later detection of a recovered body path and missed short-lived posts; its
benefit is a sixfold reduction in scheduled opportunities while the current
path is predictably metadata-only.

## 2026-09-29 reassessment: one feed-resident alternate after a 403

**Decision:** clarify the candidate-selection policy; do not change the standing
`explore-reddit` Task, cadence, credentials, or access boundary in this
investigation. The smallest justified rule is:

> Select one promising candidate as today. If its body retrieval reaches an HTTP
> 403 or another authoritative access boundary, do not retry or bypass it. From
> the already-fetched search Atom response, assess at most one different entry
> only when that response itself contains attributable post-body content for the
> entry. Feed title, timestamp, and snippet-only metadata remain insufficient.
> Make no additional Reddit request for this alternate, and otherwise finish an
> evidence-backed no-op.

This is a documentation-level clarification of the bounded research policy, not
an implementation or production change. It complements rather than replaces the
post-specific RSS recommendation below: a separately authorized workflow change
could choose RSS as the selected candidate's detail representation, while the
one-alternate rule prevents a single blocked candidate from discarding already
retrieved, body-level evidence elsewhere in the feed.

### Current canonical evidence

The current `explore-reddit` Task remains the healthy generation-2 standing
identity. Its latest accepted result is a valid no-op: the search Atom feed
returned HTTP 200 with 25 entries at `2026-09-29T00:06:41.771Z`, selected post
`t3_1wsupff` returned HTTP 403 at its public URL, feed metadata was not promoted
to body evidence, and no publication was made. Evaluation publication
`325d4973e1f5d6997a344b95ed33953d4f7ba0dc4c415d7edf71b511195bb292`
and intake run `wr_1790646131752_xxxv` judged that latest attempt healthy and
raised the recurrence only for owner investigation.

The canonical eight-attempt page supports this bounded count, not the
evaluator's broader `6 of 8` wording:

| Newest-to-oldest position | Outcome |
|---|---|
| 1–4 | Four consecutive selected-post body HTTP 403 no-ops |
| 5 | Readable candidate; one qualified finding published |
| 6–8 | Readable candidates; evidence-backed no-ops after comparison with stronger existing coverage |

Thus the observed page contains **4/8 selected-candidate 403 outcomes**, all four
consecutive and newest. It also contains four readable candidates, one of which
produced a qualified finding. That is evidence that readable Reddit bodies can
still yield useful work, but it is not evidence that any particular alternate
in the four blocked feeds would have been useful.

The four blocked attempts lasted approximately 109.3, 79.0, 89.3, and 71.7
seconds from accepted-attempt start to finish: about **349.3 seconds total**.
That operational cost is noticeable but modest in isolation and does not alone
justify code or a cadence change. The more material concern is avoidable
coverage loss: each run stopped after one selected candidate even though its
already-fetched 25-entry feed could potentially contain another entry with a
full attributable body.

### Why the present rule loses avoidable coverage

The active workflow contract says to start with the public Atom feed, preserve
stable IDs, reject metadata as body evidence, and return a no-op on an access
boundary. Its general result guidance also says to “pick one promising candidate
early.” It neither authorizes nor requires an alternate after that candidate is
blocked. The recent agents therefore correctly stopped; the no-bypass behavior
is an intentional source-safety boundary. The single-candidate stopping rule is
not itself a safety requirement and can discard body text already obtained in
the feed.

The proposed clarification preserves every safety property: one initial feed,
one selected-candidate retrieval attempt, no retry, no source substitution, no
credential use, no inference from titles, and immediate no-op when no alternate
has feed-resident body content. It changes only which already-retrieved evidence
may be assessed.

### Benefit, cost, and uncertainty

- **Coverage benefit:** potentially recovers one body-level assessment in a run
  that would otherwise stop at the first 403. The observed page's `1/4` useful
  result among readable selected candidates is a rough opportunity indicator,
  not a forecast for alternates; alternate-body availability and usefulness
  were not measured.
- **Extra source requests and rate-limit risk:** zero under the exact rule above,
  because the alternate must be readable from the existing Atom response. This
  is safer than requesting a second post URL after a 403 and avoids the HTTP 429
  sequence observed in the 2026-09-28 post-RSS diagnostic.
- **Runtime:** one additional library comparison and body assessment only when a
  qualifying alternate exists. No direct timing for that incremental branch is
  available. It is bounded to one entry and should be measured if implemented;
  the current four blocked runs' 349.3 seconds are baseline context, not an
  estimate of incremental cost.
- **Maintenance:** small but nonzero—clarify the Reddit contract and add focused
  tests for one alternate maximum, feed-body qualification, zero extra request,
  and stop-on-boundary behavior. No parser or new service is justified by this
  recommendation.
- **Provider tokens and monetary cost:** unknown and unmeasured.

**Rejected alternatives:** no change preserves a demonstrated single-candidate
coverage loss; trying a second post URL adds a request and rate-limit exposure;
a broad multi-candidate loop risks runtime and selection drift; authentication,
source substitution, bypass, and treating feed metadata as body evidence remain
unsupported. The clarification should be separately reviewed and tested before
any application; this report does not apply or activate it.

## 2026-09-28 reassessment: fallback omitted, one current success

The three accepted scans at `12:06`, `16:04`, and `20:06` UTC did **not**
invoke the already-established post-specific RSS/Atom fallback. Their execution
traces show exactly two Reddit requests each: one successful search Atom request
and then either the selected post's JSON endpoint or ordinary public post URL.
No selected-post `.rss` URL appears in any of the three traces. All three runs
were nevertheless correct evidence-backed no-ops under the workflow text they
received, because that text required RSS-first discovery but did not tell the
agent to try post-specific RSS before stopping at a detail-retrieval boundary.

A bounded read-only check at `2026-09-28T21:09:53Z` requested the three selected
posts' public `.rss` representations in chronological order, with a descriptive
User-Agent, 10-second connection timeout, and 30-second total timeout. The first
request, for `t3_1wscfpx`, returned HTTP 200 in 0.475 seconds with one attributable
Atom entry, 5,039 bytes, and 2,592 characters of normalized content. Its SHA-256
was `8e8a1468d8c23b14b9c8850164e461e1fd4b5b076f15969bd0382a0a48ee38f4`.
The response also reported `x-ratelimit-remaining: 0.0` and a six-second reset.
The immediately following requests for `t3_1wsi4g7` and `t3_1wsp16r` returned
HTTP 429 with empty bodies in 0.376 and 0.384 seconds. Those two outcomes measure
the bounded sequence's rate-limit boundary; they do not show that either post's
RSS representation is intrinsically unreadable.

This confirms the narrow result anticipated below: post-specific RSS is still a
working permitted body path for at least one of the three current posts, but the
current workflow omitted it. The smallest justified correction is to clarify the
existing Reddit execution contract: after selecting a post, try its public
post-specific RSS/Atom representation before JSON or the ordinary page, count
that request within the same bounded request budget, and stop on a rate-limit or
other access boundary. Preserve stable `t3_...` identity and keep post/comment
content distinct from search-feed metadata. This report does not apply that
workflow change.

In the inspected three-scan window, selected-post body evidence was lost in
`3/3` accepted scans even though the first current fallback check recovered the
body for `1/1` post attempted before the rate limit. Each accepted scan took
approximately 79–109 seconds end to end and made two Reddit requests; the
fallback clarification need not increase the normal request count if it replaces
rather than follows the currently blocked detail request. This diagnosis added
three public requests totaling 1.235 seconds and 5,039 downloaded bytes.
Provider/token cost remains unknown because it was not measured.

**Updated option judgment:** no change would knowingly preserve the omission;
cadence reduction would lower repetition but not repair per-scan coverage; the
previous pause recommendation is no longer the smallest response because a
current permitted path succeeded; authentication and a new retrieval service
remain unsupported. Clarifying/restoring the existing post-RSS fallback is the
smallest isolated candidate, subject to a separately authorized workflow edit,
focused tests, and one production-independent validation. Until such a change is
approved and verified, the standing scan and its independent obligations remain
unchanged.

## Original 2026-09-24 decision (superseded by the reassessment above)

**Recommendation to the App owner at that time:** temporarily pause the automatic four-hour
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
