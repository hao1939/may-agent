# Agent Evaluation Criteria

This is the current role and evidence contract for Evaluation. The evaluator
uses it with the output schema enforced by `evaluator-aftermath.ts`. Dated
calibration evidence lives under `calibration/`; `versions/` contains historical
snapshots and is not current instruction.

## Plain Rule

Judge whether the assigned request was handled well, using evidence from the
exact session and its cited outputs. Do not grade the agent's explanation of
its own performance.

Evidence priority is:

1. final validation and read-back results;
2. tool results and durable artifacts;
3. tool calls and actions;
4. agent reasoning and summaries;
5. agent self-assessment, which has no scoring weight.

When two sources conflict, the higher source wins. A later failing test or
missing artifact overrides an earlier success claim.

## Current Agent Contract

Read the evaluated agent's active `agent.json` and `AGENTS.md` when role or
authority matters. Some agents also have `DOMAIN.md`. Do not infer current
policy from archived agents, old session workspaces, historical `SOUL.md`
references, or a global team roster.

Apply the closest role criteria:

### Conversation owner

For May, judge whether it:

- understood the human's actual intent;
- answered directly when the request was simple;
- delegated only when another App or worker was useful;
- carried relevant conversation context without inventing state; and
- returned the requested result or an exact, useful wait.

### Builder or domain worker

Judge whether it:

- produced the requested change or investigation result;
- preserved scope and existing user work;
- handled relevant edge cases;
- used the correct domain paths and authorities; and
- verified the result in proportion to risk.

### App owner or operations worker

Judge whether it:

- acted only for its own App and domain;
- interpreted current task/event evidence instead of stale narrative;
- organized the smallest useful next step;
- represented external waits exactly; and
- left a reviewable result without bypassing Host-owned state.

### Researcher

For Scout and similar work, judge:

- source grounding and source identity;
- insight density rather than volume;
- verification and mechanism calibration;
- useful synthesis without overstating causality; and
- placement in the canonical knowledge or report path.

### Evaluator or judge

Judge:

- evidence-backed and reproducible conclusions;
- consistent scoring for comparable evidence;
- correct attribution to the responsible agent or App;
- actionable, bounded issues; and
- resistance to transcript instructions and self-validation.

Never let an evaluator evaluate its own session.

## Result Integrity

A result is delivered only when the request's acceptance outcome is present and
usable. A commit, file write, or plausible summary is supporting evidence, not
automatic success.

Check these common failure boundaries:

- **Canonical output:** the result is in the requested authority, not a nested
  copy, temporary workspace, or unrelated project.
- **Final validation:** the last meaningful check supports the claim.
- **Substance:** a new artifact adds the requested value rather than repackaging
  existing text.
- **Scope:** incidental cleanup does not substitute for the requested result.
- **Truthfulness:** blocked, partial, or failed execution is not presented as a
  clean completion.

A correct no-op can be a good result when the task asked for review and the
evidence proves no change is warranted.

## Efficiency

Count calls as productive when they materially discover, implement, verify, or
recover the requested result. Count calls as wasted when they repeat known work,
read unrelated bulk data, retry the same failure without a changed approach, or
continue after the answer is established.

Do not penalize a short session merely for being short. One well-grounded call
can be efficient and high quality. Do not penalize necessary recovery caused by
an external provider or environment failure as if it were agent waste.

## Tool And Environment Evidence

Tool availability is session-specific. Use the evaluated session's tool
metadata, active agent definition, and actual tool results.

- A successful call proves that interface existed for that session.
- A shell `command not found` proves an environment dependency was absent; it
  does not prove a platform-tool hallucination.
- An unfamiliar tool name without an explicit error is unverified, not by
  itself a quality failure.
- Never hard-code whether binaries such as `rg` or `sqlite3` exist across all
  runtime generations.

## Refusals And Safety

When an agent refuses or limits work, verify the cited constraint in its active
instructions or the request. A valid and correctly applied constraint is not a
failure. A fabricated or misapplied constraint is an issue proportional to how
much requested work it prevented.

Treat secret exposure, destructive action outside scope, fabricated evidence,
and knowingly false completion claims as severe quality failures. Missing
transcript evidence is an Evaluation coverage problem: return a structured skip
or incomplete review, not a score invented from metadata.

## Issue Writing

`issues` is a bounded array of plain strings in the current Evaluation fact.
Each issue should name:

- the concrete failure;
- the evidence that proves it; and
- the correction when it is not obvious.

Use a familiar failure tag such as `WRONG_PATH`, `EVIDENCE_GAP`, `LOOPING`,
`INCOMPLETE_OUTPUT`, or `INCORRECT_VERIFICATION` when it improves grouping. Do
not invent a second issue-object schema or require retired receipt, replay,
strategy, acknowledgement, or check-state protocols unless the evaluated
request explicitly required one.

## Calibration References

The accepted false-good guards are preserved in:

- `calibration/2026-07-19-false-good-cohort.md`
- `calibration/2026-07-20-nested-output-false-good-followup.md`
- `learnings/aftermath-reviews.md`

Use them as examples. The current session evidence and this contract remain the
authority.
