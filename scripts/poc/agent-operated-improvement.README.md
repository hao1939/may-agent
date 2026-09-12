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

The improver chooses the change and its own questions. Four later withheld cases
check production equality, staging overflow, unknown scope and unrelated writing.
Read the actual answers, citations, source diff and tool evidence as well as the
numeric assertions; a passing finish call is not proof of a useful improvement.

## Bounds and evidence

- At most 12 bounded executions per live trial: baseline, improver, up to six
  improver-selected target probes and four withheld checks.
- Improver deadline: 300 seconds; each fresh target: 60 seconds. Nested read-only
  probes have their own deadline; this does not prove immediate cooperative
  cancellation of those model calls. Git operations receive cancellation.
- Uses `gpt-5.6-sol` with fallback removed; actual model identities are recorded.
- Target preparation uses the active immutable definition. It does not test
  existing persistent sessions or durable Task adoption.
- Probe results return the answer, revision, status, timing and a detail path;
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

Two isolated trials completed 22 model executions. Each improver independently
edited one guidance file, committed/reloaded it, handled the injected rejection
and verified the active source without human-operated intermediate steps.
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

The final live-trial harness SHA-256 was
`c215133f60174b5b4987b9508cd4b32825cc03d79d5fb36b22f5b6ac934d49b7`.
Those trials preceded rebasing this source onto main after #159–#161 merged.
Portable checks are repeated on the publication branch; earlier model evidence
is not an exact-publication-head live-run claim.

The governing proposal and detailed sanitized evidence are in the separately
maintained App tree: `docs/proposals/agent-behavior-and-capability-extension.md`
and `docs/proposals/agent-operated-improvement-poc-20260912.md`, recorded at App
workspace commit `daee27686b`. This file documents the portable experiment only;
it does not replace App policy or authorize installation changes.
