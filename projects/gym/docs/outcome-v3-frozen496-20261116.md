# Outcome-completion v3 — frozen Alex 496 baseline

**Five native passes, zero failures, zero invalid evaluations.** Both configured
judges accepted every final candidate and classified all 30 controls according to
their approved keys in the case-specific packets. In particular, both accepted B2 under the approved contextual-reference
clarification. This is a valid judgment baseline for the frozen setup below,
not proof of operational delivery or an improvement to Alex.

## Exact scope and source

- Run: `outcome-completion-test-20261116T160023Z-62955f54`; original completed native manifest retained unchanged.
- Harness/cases: `22cf5fdb132101d2d10ce2d55b4904ef829382fb`; approved outcome-completion v3.
- Subject: **Alex at `49668e6cd3e08a6d771e5aa4cdd52c3e72cb9077`**, the same committed definition
  used for the incomplete v2 attempt. Instruction SHA-256:
  `ebed3238ff7da91d1ad71ea1cc7cfdcee805c845449a3fe208160adeea59205e`.
- The original Alex App definitions and shared instructions were copied into an
  isolated checkout. Subject, shared files and copied SDK source hashes were
  checked unchanged after execution. Each of the five actually staged target
  agent trees also matches the retained v2 staged subject byte-for-byte under the
  recorded tree fingerprint. Dependency installation remains shared.
- Target: `gpt-5.6-sol`, with a run-local **finish-only permission overlay**;
  its other configuration and instruction files were not edited.
- Judges: `gpt-6-astra` and `gpt-5.6-sol`; actual tools **`read`, `finish`**.
  All ten packets include the exact frozen assignment and omit control labels.
- All five cases ran once. B ran first, followed by unfinished repair, style-only,
  unavailable procedure and stale-candidate evidence. Membership was unchanged;
  execution order and the **two-minute target / three-minute judge** allowances
  are part of this setup. No automatic trial reruns or model fallback.

[Machine report](outcome-v3-frozen496-20261116.json) retains exact final answers, both B2 judgments,
usage, protocol feedback, scope hashes and the separate existing-run audit.
Native evidence: `projects/gym/.state/benchmarks/outcome-completion-test-20261116T160023Z-62955f54/`.
It was byte-checked against the execution directory before runtime-audit sidecars
were added. Source/runtime remain under `/tmp/gym-v3-frozen496/source/`.

## Observations

| Case | Final state | Judgment observed |
| --- | --- | --- |
| Current candidate already sufficiently verified | `converged` | Reused unchanged N17 repair/test/review evidence; no redundant cycle; kept Task closure separate. Both judges accepted B2. |
| Helper gave advice; required procedure fits | `waiting` | Repair remains owed; selected installed `develop-change` with the exact check and candidate-matched acceptance evidence. |
| Low-value style-only review | `converged` | Stopped optional polish on acceptance/marginal-value grounds. Its pass is narrow; see limitations below. |
| Procedure unavailable and standalone alternative authorized | `waiting` | Selected bounded Tech-lead implementation/check/commit plus Bob review, retaining acceptance and avoiding a replacement coordinator. |
| Check/review belong to the older candidate | `incomplete` | Refused to certify N18 from N17 receipts; selected current-candidate verification/review while preserving existing work. |

## Recovery and unscored claims must not be hidden

Two initial `finish` payloads—unfinished repair and unavailable procedure—used
`waiting` with `response`. The SDK rejected them with:

> waiting cannot include response; put operational progress in summary

Alex corrected each after SDK feedback, within the **same target execution**.
Thus this is five passing final artifacts, not five first-try-valid outputs.
Targets used **seven replies and seven finish attempts**. These recoveries are
included in usage, not omitted retries. All target tool calls were `finish`;
no agent, workflow or coding dispatch occurred. The role of schema exposure versus
agent understanding in these initial format errors was not separately measured.

The style answer again named `check:ci` and proposed a closing declaration.
The supplied snapshot says required verification is complete, but does not
supply that exact command receipt or Task-closure authority. The unchanged
style rubric does not validate those extra claims. Its machine pass is **not
proof of accurate command attribution or authorized closure**. No Task was
actually closed. Do not silently broaden the pass or retrospectively alter its
rubric or verdict.

All operational capabilities, candidate identities and receipts were supplied
judgment context. No source repair, actual regression check, independent repair
review, integration, deployment or other operational delivery occurred.

## Separate the concurrent different-profile run

During preflight, another retained v3 run was found:
`outcome-completion-test-20261116T154647Z-811047b3`. Its completed manifest,
five calibrated passes and native tool policies were checked without model calls.
However, its installed subject instruction hash is
`0aef351d20e568ba51c10e981326e323ae9184d7e13de50de47987de82e30b08`,
not the explicitly authorized original subject; it also uses a four-minute
subject allowance. It was not substituted for this run, overwritten, pooled,
or treated as the requested same-profile baseline.

The v2 attempt remains incomplete and unchanged. Earlier pilots used different
assignment-state meanings. Neither is promoted or rescored by this result.
This run is not automatically selected in the shared agent evaluation plan;
any future comparison must match the subject, frozen measurement and setup,
not merely its benchmark name or the word “baseline”.

## Resources and limits

Post-run non-model checks passed the native frozen-input integrity check on the
retained copy and 26 focused owner/semantic tests. Native files and the completed
manifest were retained byte-identically; no result was rescored or relabeled.

- Executions: **5 target + 10 judges = 15**, within the commissioned cap.
- Replies: **7 target + 25 judges = 32**.
- Execution-phase wall time: **222.839 seconds**. Judge executions overlap;
  summed per-execution durations are not elapsed time.
- SDK estimated model cost: **$0.146366 target +
  $1.424968 judges = $1.571333**.
- Normalized token receipts: 45,146 input, 145,636 cache-read,
  36,229 cache-write and 26,550 output.
- SDK estimates are not billing or operator costs; cache reuse is not evidence
  of agent efficiency. Setup-only symlink-copy preparation was corrected before
  any model execution; no model trial was repeated.

One trial per case and successful calibration do not establish reliability,
safety, autonomy, universal judge accuracy or savings. No Alex changes are
justified solely by this five-case judgment pass; actual authorized work needs
its own observable delivery and boundary evidence.
