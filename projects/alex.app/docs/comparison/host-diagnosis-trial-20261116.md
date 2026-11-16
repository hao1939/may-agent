# Definition activation and hosted diagnosis — November 16, 2026

## Outcome

The verified Alex definitions are active. A representative diagnosis-only Task
then ran through the installed Host, called the existing diagnosis workflow on
retained real Scout evidence, and ended with Alex's accepted **no_change** decision.
The specialist proposed a change; Alex inspected the actual artifacts and
declined it. No Scout candidate was prepared or applied.

This closes the definition gap identified by the
[readiness rehearsal](host-handover-rehearsal-20261116.md) and demonstrates one
bounded hosted diagnosis with owner disposition. It does not complete the wider
Host-driven implementation/recovery milestone or demonstrate natural-work gains.

## Exact source activation

The operator staged the production definition-release mechanism against reviewed
Apps commit `dfacd2adc4ec8c2523bccf35248757bc86af8b53`, then validated it against
the installed Host/SDK `7d9b61be`:

- 91 focused tests passed, zero failed, covering diagnosis, Alex admission,
  Alex/May watchers and their shared provider implementation.
- App design checks passed with zero errors and warnings.
- All five staged App definitions loaded against the installed SDK. Existing
  installation selection remained Alex, May and Scout; this did not enable the
  disabled sample or AKS Apps.

The Host publishes a coherent source bundle. Besides the diagnosis and Alex
instructions, this commit contains the previously integrated shared GitHub
watcher change, so its regressions were included before reload. Unrelated
uncommitted source and documentation edits were excluded by the explicit commit
pin and preserved in the shared checkout.

The ordinary `runtime.reload.requested` event carried that expected source commit.
Its correlated `runtime.reload.finished` event (`6725553`) reported success, and
the active bundle became
`dfacd2adc4ec8c2523bccf35248757bc86af8b53-definitions-v6`. Seven selected files,
including diagnosis, Alex instructions, development procedure and shared watcher
sources, matched the prepared SHA-256 identities. The active source link and new
admission worker selected that same bundle. Daemon PID and start time were
unchanged; no binary restart occurred.

## Real retained-run rehearsal

The input was the immutable captured run
`scout-judgment-test-20261115T014758Z-081141db` used in the first standalone trial.
The assignment explicitly preserved historical truth limitations and the earlier
operator warnings about invented source paths and token attribution. No operator
correction was sent after admission; this was not an unassisted judgment trial.

- Admission event: `6725555`.
- Task: `alex/input/app_ecb06646-453a-401b-a3bd-242f3848b74d`, generation 1.
- Workflow: `diagnose-improvement`, run `wr_1794813249171_enw6`, invoked once
  without `candidateName`.
- Accepted attempt: `r_1_3523e9a7-7570-48ed-9792-216da09e83a5`.

The workflow correctly extracted successful execution from both authoritative
trial results. Gym's advisory proposal still classified the historical scoring
failure as actionable, named the incorrect `agents/scout/AGENTS.md` path, and
inferred a need for concision from approximately 31k aggregate tokens.

Alex read the actual saved Task artifact and transcript. They already preserved
the authoritative note, the rejected numbered finding path and the update-in-place
decision. The failed historical concept-group check required `scan-042`/`duplicate`
wording; that alone did not establish a harmful Scout decision. Alex therefore
selected **no_change**, corrected the source identity to
`projects/scout-knowledge-lib.app/agents/scout/AGENTS.md`, and rejected aggregate
tokens as proof of Scout-controlled verbosity waste.

The Host retained that distinction between specialist `actionable` and owner
`no_change` in its accepted result. The request completed, the finite Task closed,
and its unchanged worktree was released and removed. Captured input hashes still
matched afterward. The two model sessions took approximately 59.6 seconds in the
Task attempt and reported 226,558 tokens, including repeated context, with a
direct cost estimate of $0.49396. Actual billing is unverified.

## Remaining work and direction

For this case, Alex's next action is a concrete human truth judgment: whether the
existing rejected path and explicit instruction not to create the numbered
finding suffice, or whether the exact duplicate wording is necessary. A Scout
candidate is unsupported until an actual behavioral requirement and defect are
established. The diagnosis assignment is complete; it creates no automatic wait,
new approval claim or implementation obligation.

The repeated specialist source-path and token-attribution errors remain process
evidence for a future bounded scope. Owner inspection prevented an unsupported
change in this rehearsal, but its supplied warnings and cost do not demonstrate
less human correction or cheaper delivery. Keep the north star on reliable user
outcomes; use adjudicated evidence or a different confirmed friction point for
the next experiment.

Automatic Host restoration of development checkpoints, uncertain tool effects
and transfer to fresh natural work remain unverified. Earlier disposable restart
checks and manual checkpoint controls retain their narrower claims.

## Evidence

The [retained session index](/root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-5/README.md)
links prepared source, compatibility/test checks, reload input and correlated
result, active hashes, real-run input identities, hosted admission, raw specialist
proposal, actual workflow result, accepted owner decision and usage summary.
Operations followed the
[control-plane operation skill](/app/shared/skills/control-plane-operation/SKILL.md).
