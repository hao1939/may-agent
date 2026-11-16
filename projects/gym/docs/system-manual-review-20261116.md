# Manual system-wide improvement review — 2026-11-16

One manual pass ran on the existing standing Alex Task. It selected a real
reporting defect, prepared an isolated local candidate and returned to the
original daily deadline. It did **not** finish a verified delivery: the final
candidate lacks an independent pass, and the incident's review allowance is
exhausted. The trial exposed a concrete gap between selecting an incident and
giving the development workflow that incident's requirements.

## Admission and outcome

| Item | Observed value |
| --- | --- |
| Standing Task | `alex/input/app_82bccb7e-cdab-4ea4-875b-7d99945fec93` |
| Manual admission | event `6727206`, request `app_eff47470-1678-45a8-86ec-41a347eb03d9` |
| Accepted attempt | `r_1_734ce87d-3e9a-4bcd-93a9-8bbee5aef414` |
| Elapsed | 14:28:49.529–14:33:39.466 UTC, about 4 minutes 50 seconds |
| Final standing state | waiting, generation 1, resourceVersion 18 |
| Preserved review deadline | November 17, 2026 at 09:00 UTC, `1794906000000` |
| Incident | `alex/report-executed-checks-accurately-20261116` |
| Counters | 1 active incident; 1 development invocation; 3 review/repair rounds; 0 benchmark runs; 0 production changes |
| Model estimate | $2.6781239 across 4 completed sessions; billed and operator costs unknown |

The manual request explicitly authorized an early review. It used the existing
system-wide policy and Task rather than creating a second review Task or timer.
All three retained inputs now wait on the same original deadline. Their App
requests remain handling with that standing responsibility; the finite manual
observation is recorded in its accepted result and checkpoint. This does not
test an automatic deadline wake, a later day's no-change or recurring recovery.

Alex recorded five subject input records and three supporting records. It
considered recovered Scout work, reused the completed cumulative-round repair,
and chose the direct reporting defect over another investigation. All five
agent plans were available as frozen snapshots; no benchmark or score promotion
was needed for selection.

## Selected defect and local candidate

The earlier [hosted trial](../../alex.app/docs/comparison/alex-review-rounds-hosted-20261116.md)
showed summaries claiming `check:ci` passed when only the explicitly selected
focused Bun tests ran. Alex found an instruction requiring that literal claim
after three rounds, regardless of the actual check result.

Final candidate `8644005b33933c15fd02d419b2c7ca1affd3336a`, based on
`a4ae6a8abee54f737ed5e6007e0da10bb6f52fc6`, changes one bullet in
`projects/alex.app/agents/alex/AGENTS.md`. It requires actual pass/fail/skip/no-run
reporting, permits a verified-pass claim only with supporting receipts, and names
`check:ci` only when that exact command ran. It preserves the three-round rule
and concise response limit.

The candidate remains in
`/app/worktrees/alex/input-app_82bccb7e-cdab-4ea4-875b-7d99945fec93-c74d8eb75b`.
The shared production guidance is unchanged. The final worktree is clean and its
net diff contains only that guidance file. Raw patch, text and commit history
are retained outside the worktree.

Alex ran Python assertions about the final instruction text, a Git whitespace
check and a one-file scope check successfully. These establish source-text and
scope properties, not changed model behavior or a full functional test pass.
Bob's independent review rejected the first reporting candidate because it
still required claiming failed checks passed. Alex addressed that feedback;
the final revision has **no fresh independent pass**.

## Gaps exposed

1. **The selected incident did not reach the workflow as its requirement.**
   Alex passed the precise reporting repair in the `agents` call's task text,
   but `develop-change` accepts only `{verify}` and constructs specialist prompts
   from the standing Task's original May outcome, acceptance and constraints.
   The public workflow record preserves that mismatch. Bob's design therefore
   treated the work as a general review and chose no source change. A later
   failing check sent Tech-lead toward an unrelated link repair.

2. **The verification environment was incomplete.**
   The actual workflow command `bun run check:may-design` exited 1 on an existing
   link to `projects/may-agent/test/README.md`. Tech-lead changed that link locally,
   after which the same command failed on the missing SDK under
   `projects/may-agent`. It also attempted `bun run check:ci`; that failed with
   `Script not found`. No `check:ci` suite completed. The implementation then
   returned an invalid structured judgment. Alex reverted the unrelated link
   commit before preparing the intended guidance change.

3. **The remaining allowance did not reach a reviewed final candidate.**
   Workflow `wr_1794839394501_idct` reserved two rounds and returned incomplete.
   Alex counted its direct Bob review as the third round and stopped further
   automated review. Three rounds are recorded at the incident level, while
   only two have workflow reservation receipts; the extra direct review is
   owner-accounted. This does not establish automatic enforcement across all
   execution methods or across separate incidents on one standing Task.

4. **Structured evidence still needs tighter command identity.**
   The checkpoint's `verification.argv` supplies a descriptive placeholder for
   the Python source rather than the exact executed `python3 -c` argument. The
   operator archive retains the exact shell command, output and raw transcript
   line. Alex's summary also says `check:ci` did not run; more precisely, its
   script invocation was attempted and failed because the script was absent.
   Alex recovered one rejected waiting result that incorrectly included
   `response`, without operator correction.

The useful next process change is to carry a concrete selected incident's
requirements and acceptance into development, with a working verification
environment. Choose the simplest existing Task/contribution mechanism that
preserves the standing owner and cumulative incident counts. Do not repair this
handoff by repeating the workflow on the same exhausted incident or creating a
fresh review Task to renew allowance.

## Evidence, cost and next boundary

Audit root: `/app/.state/gym-system-manual-review-20261116-01/`.
`before.json`, `admission.json`, `after.json` and `verification.json` bind the
manual request, accepted outcome, counters and unchanged deadline.
`alex-evidence/manual-review-20261116T1433Z.json` is Alex's checkpoint.
`public/` retains the exact attempt, four sessions, workflow and scoped usage.
`retained/` contains the development archive, candidate and exact shell commands;
`retained-manifest.json` binds those copies.

The post-settlement context-usage report covers one Alex session, workflow Bob
and Tech-lead sessions, and one direct Bob review. Its window is
14:28:44.709–14:34:03.831 UTC, with no group/run truncation or live session tail.
The model estimate is **$2.6781239**, separate from the preceding activation
trial; billing, operator cost and any efficiency gain remain unknown. No
operator steering message was sent to Alex after admission. Operator preflight
had a rejected discovery command and an oversized preservation inventory; both
were corrected before admission and are recorded separately.

The independent audit verified all 98 captured shared-file hashes, unchanged
Host identity, active release and enabled Apps, exact final candidate scope,
checkpoint hash, failed broad check and missing final independent pass. The
current Alex plan references this result while retaining its benchmark history
and unselected baselines.

The incident now needs an explicit owner disposition of the retained candidate
within the consumed allowance. Further automated review/repair needs a deliberate
allowance decision; a new day does not grant it. Integration or activation also
requires separate authority. The standing daily review remains armed for
November 17 at 09:00 UTC and must carry this incident and its counters forward.
