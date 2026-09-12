# Agent-operated improvement

This opt-in experiment asks whether an agent can discover, author, activate and
verify a scoped change to another agent without human-operated intermediate
steps. It reuses the existing execution and definition-reload mechanisms. It is
not a production improvement service, new learning controller or Gym campaign.

## Run

```sh
# Temporary daemon and source/tool preflight; no model calls.
bun scripts/poc/agent-operated-improvement.ts
bunx --no-install tsc --noEmit -p scripts/poc/tsconfig.agent-operated.json
bun test scripts/poc/agent-operated-improvement.test.ts scripts/poc/conversation-adoption.test.ts

# Requires separate explicit authority and working model configuration.
bun scripts/poc/agent-operated-improvement.ts --live
```

The live trial gives an improver an outcome and standing authority over synthetic
May guidance, not filenames or a command sequence. It can discover files, read
accepted policy, edit only May's identity/skills, request scoped Git commits and
real daemon reloads, and test the active target. Policy truth and the evaluator's
withheld cases cannot be edited through its tools. There is no shell, permission
change, dependency installation or production deployment capability.

The first improver-requested reload receives a synthetic **not-submitted**
failure: no event was sent and the old source remains active. A later request
uses the real reload path and follows the exact request's completion. This tests
handling an explicitly safe-to-retry failure, not an ambiguous external effect.
Saving and committing source are checked separately from actual activation.
The final Git HEAD must equal the active source; the retained diff and recovery
check name that same commit. A clean but unactivated later commit cannot pass.
Any pending reload observation makes the trial inconclusive before grading;
the fixture does not add a drain/retry coordinator. Every withheld check must
use that final commit, and source/activation are inspected again after grading.
The recovery check requires a failure tool result, a reload requested in a
later assistant message, and that call's successful activation of the final
source. Calls planned together do not count. Ordered call IDs, message indices
and reload results are retained in `checks.reloadRecovery`; this establishes
available feedback before the next action, not the agent's private reasoning.

The improver chooses the change and its own questions. Four later withheld cases
check production equality, staging overflow, unknown scope and unrelated writing.
Read the actual answers, citations, source diff and tool evidence as well as the
numeric assertions; a passing finish call is not proof of a useful improvement.

## Bounds and evidence

- At most 12 bounded executions per live trial: baseline, improver, up to six
  improver-selected target probes and four withheld checks.
- Improver deadline: 300 seconds; each fresh target: 60 seconds. Nested target
  probes have their own deadline; this does not prove immediate cooperative
  cancellation of those model calls. Git operations receive cancellation.
- Uses `gpt-5.6-sol` with fallback removed; actual model identities are recorded.
- Target preparation uses the active immutable definition. It does not test
  existing persistent sessions or durable Task adoption.
- Target reads are limited to that snapshot, and it cannot edit guidance or
  policy. Its answer-only `finish` rejects file deliverables before the standard
  tool can check their existence, regardless of path or completion status.
  The schema permits only omitted/empty deliverables; the execution guard also
  rejects nonempty inputs. Preflight covers existing/missing files, mutable source,
  private evidence, absolute paths and traversal with identical rejection results.
  Ordinary answers still finish successfully. Standard `finish` can append
  reported lessons to private fixture evidence. The no-model preflight checks that this append happens,
  the target cannot read it and a fresh target prompt does not load it. Calling
  the whole execution "read-only" was too broad; evidence is not active guidance.
- Probe results return the answer, revision, status, tool-error count, timing and a detail path;
  prompts and tool traces remain readable on demand.
- Invalid executions are retained and stop the harness; no automatic harness
  reruns hide failures. The runner retains its normal bounded finish recovery.

The script prints and retains an exact temporary artifact directory. `setup.json`
records Host/harness identity and limits; `results.json` records answers, active
source, checks, model identities, tool calls and reported usage. The temporary
daemon is closed in `finally`; the portable test also owns the subprocess group.
Treat raw artifacts as private: review and sanitize selected evidence before
sharing. Path substitution is not a general secret-redaction guarantee.

## Observations, September 12, 2026

Two earlier isolated trials completed 22 model executions. Each improver
independently edited one guidance file, committed/reloaded it and verified the
active source without human-operated intermediate steps. Both encountered the
injected rejection, but the old flattened evidence did not preserve assistant
turn boundaries: those runs cannot establish that retry was chosen after
receiving the failure. Review identified and corrected that assertion gap.
All ten improver-selected probes and eight withheld checks matched expectations.
Changes added 10 and 12 lines respectively, preserving the existing identity.

The second trial replaced full inline probe traces with compact answers and
evidence references. Its five probe responses totaled 3,506 bytes versus 26,952
in the first trial. The agent used the detailed baseline reference when needed.
Reported improver tokens were 103,853 versus 164,343, including cache reads;
different model choices/questions and baseline exploration prevent a general
speed or cost claim. Neither trial established novel strategy learning or
production reliability; both supplied accepted policy that baseline May lacked.

Two setup defects were retained: an untracked empty fixture directory prevented
reload, and a missing completion capability prevented target preparation. Neither
started a model execution. The corrected preflight covers both boundaries.

The second trial's harness SHA-256 was
`c215133f60174b5b4987b9508cd4b32825cc03d79d5fb36b22f5b6ac934d49b7`.
Those trials preceded rebasing this source onto main after #159–#161 merged.
The publication harness now adds ordered recovery evidence and its regressions,
plus a focused abort-during-reload-delay regression. Earlier model evidence
does not prove the strengthened recovery check or exact publication revision.

A review follow-up at `820d16d1` completed ten more model executions and four
correct withheld answers. Its ordered trace establishes failure delivery at
message 26, a new reload request at 27 and matching activation at 28 (zero-based
indices). However, the authored guidance also named an evidence file outside
the target's readable snapshot. Embedded policy supplied correct answers, but
the three capacity probes and three capacity holdouts incurred 13 failed reads.
Probe results reported the access limitation, but the improver left the reference.
This is a useful mechanism result with a guidance-quality defect, not a clean
overall improvement claim. That run is retained without rewriting its output.

The refined trial clarifies the target's existing read scope in the probe tool
description and exposes tool-error counts beside compact results. These are
capability facts and evidence, not a prescribed edit or retry policy. No target
permissions are broadened, and error counts do not automatically reject an
otherwise useful result; the agent must judge their meaning.

That trial at `13ecb2f5` completed ten model executions with four correct
withheld answers. The agent authored a 12-line addition without the inaccessible
reference. Its four chosen probes and four holdouts had **zero tool errors**.
Failure delivery, later retry and matching activation appear at message indices
25, 26 and 27. The unchanged baseline still made 19 failed discovery reads;
this experiment did not solve baseline lookup inefficiency. No human operated
intermediate steps in either follow-up.

The final model-tested harness SHA-256 is
`160dac2b88dff50bcc66f4684720fde8ba32f42874369fdf3cae855dcad08b7a`.
These follow-ups add 20 model executions and eight correct withheld answers.
The refined result supports clear capability descriptions and visible failure
evidence. One run per variant cannot establish causation, a general speedup or
reliability; keep the earlier guidance defect alongside the successful result.

Publication review also added a no-model regression for a clean commit made
after activation. It must fail the final-source check until that commit is
activated. This assertion hardening was not a new model-backed trial; the
earlier live harness hashes above remain the source of those observations.

A later boundary review found that standard `finish` could reveal whether
model-supplied file paths existed outside the target snapshot. The target now
rejects file deliverables entirely; it only produces answers. This is fixture
hardening with no-model coverage, not a new model trial or a production sandbox.

The governing proposal and detailed sanitized evidence are in the separately
maintained App tree: `docs/proposals/agent-behavior-and-capability-extension.md`
and `docs/proposals/agent-operated-improvement-poc-20260912.md`, recorded at App
workspace commits `daee27686b` (initial evidence) and `8e30112868` (review
follow-ups). This file documents the portable experiment only;
it does not replace App policy or authorize installation changes.
