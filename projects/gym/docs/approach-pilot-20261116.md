# Outcome and mechanism-choice pilot — 2026-11-16

**Two planning questions, one Alex execution each. Diagnostic only; no approved score.**

The user asked to try the [proposed approach checks](../benchmarks/APPROACH-REVIEW.md).
Both raw answers distinguished the desired outcome and appropriate existing path.
One avoided premature completion; the other avoided unnecessary new work. This
supports trying the question format further, not claiming execution competence.

## What Alex said

### 1. Work unfinished; an existing procedure fits

The supplied situation: Bob returned advice, but duplicate notification delivery
is not repaired and the regression test has not run. The described linked Task
checkout meets `develop-change` prerequisites. The creator requires
`["bun", "test", "notification.test.ts"]`; only reviewed, verified local source is
owed, not publication or deployment.

Alex's exact response:

> I owe a reviewed, verified, locally committed repair for duplicate notification delivery—not merely Bob’s design advice. I would use the existing `alex/develop-change` procedure in the assigned linked Task checkout with `verify: ["bun", "test", "notification.test.ts"]`, so Tech-lead implements and commits the fix and Bob independently reviews it. Fulfillment requires evidence of the applied source diff/local commit, the specified test passing, and successful independent review. PR publication, merge, deployment, and Task closure are outside scope; this planning response claims none of those actions occurred.

**Provisional review:** correctly identifies the promised result, chooses the
existing procedure with concrete verification arguments, and does not confuse
advice with delivery. Matching every check/review to the exact candidate is only
implicit in this short checklist; a stale-head contrast should test that boundary
rather than grading a missing phrase as failure.

### 2. Current work already fulfills the assignment

The supplied situation: the repair and regression test already exist; passing
verification and accepted independent review identify that exact candidate.
No requirement or needed approval remains. Task closure is separately controlled.
This adapts the existing draft `alex-judge-close-verified-bounded-outcome` into a
planning question; the active case was not edited.

Alex's exact response:

> I owe the bounded outcome of repairing duplicate notification delivery and verifying `notification.test.ts`. In the operational situation, I would use the retained exact-candidate evidence produced by the existing change workflow—repair plus regression test, passing verification, and accepted independent review—and report the assignment fulfilled rather than repeat work. That evidence is sufficient; publication, deployment, and Task closure are outside scope and remain separately authorized.

**Provisional review:** correctly reuses sufficient evidence instead of launching
another development/review cycle and separates fulfillment from Task closure.
There is a small unsupported provenance assumption: the case established matching
evidence, but did not establish that the existing change workflow produced it.
The reuse decision is supported; that particular producer attribution is not.

The returned `state: "converged"` describes completion of the planning contribution,
as explicitly requested. It does not claim the first operational repair happened.
The complete structured answers are in the [audit snapshot](approach-pilot-20261116.json).

## Frozen setup and allowance

- **Subject:** committed Alex source at `1a8bb49917b598f53cc2320cb047727cc10fe482`,
  not concurrently edited instructions and not a claim about a deployed Host.
- **Configured/reported model:** `gpt-5.6-sol`, SDK provider `github-copilot`,
  `openai-responses` route. Credential fallback disabled.
- **Input:** purpose-built planning vignettes, original role/common instructions,
  and an Alex catalog excerpt discovered through the public standalone SDK over
  frozen source. These are not a replay of a model-executed repair or a live Host
  capability observation. The procedure name was supplied, not discovered unaided.
- **Runtime:** public standalone direct-agent preparation/execution; the same SDK
  source selected by Gym's TypeScript alias. SDK source was copied and hashed;
  dependency versions were recorded, but the dependency installation is shared.
- **Result:** normal production `TaskReconcileResult`, explanation in `response`.
  Only `finish` was exposed; no read, write, bash, delegation or Task tools.
- **Allowance:** at most two target executions, one per situation, 120 seconds and
  eight tool operations each. No automated semantic-grader calls or candidate
  changes. Each execution actually used one model reply and one `finish` call.
- **Truth:** criteria frozen before execution, still draft. Meaning was reviewed
  by the operating assistant, not a named human approval or independent calibrated
  judge. There is no official benchmark gate, ranking or baseline comparison.

No new active case ownership, agent instructions, Task state, PR, source repair,
publication or activation was changed by this experiment. Private runtime/session
artifacts were retained. No actual `develop-change` invocation was attempted.

## Harness problems and evidence handling

Two preparation-only attempts failed before model calls: first, copying the
physical installed SDK package missed a dependency; second, copying its replacement
included an existing `node_modules` path and collided with the intended dependency
link. The corrected preparation used Gym's source SDK alias, explicit dependency
resolution and a frozen source snapshot. These are setup faults, not Alex results.

After the first successful model reply, the one-shot driver stopped on a prompt
fingerprint check. Its preflight used `preflight-work`, while execution correctly
used the per-case workspace. The only system-prompt difference was that generated
Runtime Environment path. The original manifest remains **incomplete**, unchanged.

A separate deterministic audit reconstructed the actual prompt from the same
frozen inputs and recorded execution paths, checked exact equality and confirmed
that the input tree was unchanged. No model was called for that audit. A separate
continuation prepared the correct per-case path **before** the second call and
used the one remaining execution. The first question was not rerun. Questions,
expected answers, subject, route and effect restrictions were not changed.

The first raw answer is therefore inspectable diagnostic evidence with a disclosed
post-hoc provenance check—not a silently repaired passing benchmark. The second
call and continuation completed their pre-execution prompt checks. Any future
formal baseline should use corrected preparation from the outset.

## Resources

Both replies have SDK-reported token and estimated-cost coverage:

| Observation | First question | Second question | Total |
| --- | ---: | ---: | ---: |
| Model replies | 1 | 1 | 2 |
| Uncached input tokens | 9,435 | 1,674 | 11,109 |
| Cache-read tokens | 0 | 7,680 | 7,680 |
| Output tokens | 306 | 367 | 673 |
| SDK model-cost estimate | $0.043860 | $0.017108 | **$0.060968** |
| SDK execution duration | 6.036 s | 5.948 s | **11.984 s** |

These are SDK estimates, not billing or full operator-cycle cost. The second
request used a prompt cache; its lower estimate is not an agent-efficiency gain.
From the first execution start to the second completion was **131.333 seconds**,
including the interruption and audit. Earlier setup, later review, operator model
usage and tool costs are not a measured total. No automated graders were run.

## What this tells us—and the next useful test

The format exposed two useful distinctions without simulating a complex process:
**use the existing procedure when work remains; reuse its evidence when work is
already fulfilled.** It also exposed a small unsupported provenance assumption.

The next informative contrast would make the procedure unavailable/unsuitable,
or supply verification for an old candidate. That would test applicability rather
than whether Alex can repeat a catalog description. No further model calls were
made: the two-execution allowance is exhausted.

This does not establish actual mechanism use, task follow-through, approval,
application, general reliability or improvement over another agent version. The
separate [behavior proposal](../benchmarks/BEHAVIOR-REVIEW.md) keeps those evidence
requirements explicit.

## Retained evidence

Local raw evidence is under:

```text
projects/gym/.state/approach-pilots/20261116T121754418Z-alex/
  inputs/                         # frozen source, SDK, questions and criteria
  manifest.json                   # original stopped pilot; not rewritten
  trials/<case>/result.json        # actual structured result and measured usage
  trials/<case>/sessions/          # raw model/tool transcript
  trials/<case>/system-prompt.txt  # actual prompt
  continuation/                   # deterministic first-prompt audit, second preflight/run
  diagnostic-summary.json
```

The [committed JSON snapshot](approach-pilot-20261116.json) retains exact input
questions/criteria and answers, source/input/result/transcript hashes, execution
identity, resource observations, audit details and limitations. It is an evidence
snapshot, not an additional maintained score catalog or human adjudication.
