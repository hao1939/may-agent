---
id: master-worker-context-sharing
owner: master
status: waiting
type: continuous
priority: P1
workflow: project
iteration: 1
stop_reason: The core delegation wiring is complete. Master (an LLM agent) calls cc_worker/codex_worker tools, which now spawn CLI subagents and return structured envelopes with status, tool outputs, files touched
resume_condition: Human/May reviews the commit and confirms the delegation behavior meets expectations, or identifies gaps.
---

# Project: Master ⇄ cc_worker ⇄ codex_worker Context Sharing

## Goal

Make master delegate to its CLI worker subagents (Claude Code, Codex) such that
**user intent, structured context, and tool outputs all survive the round-trip**
in both directions. Today they don't: master strips intent on the way down, and
worker tools strip data on the way back. Fix the failure surface incrementally,
keep watching, and let real session evidence drive the next move.

## Signals

Behavioural signals (measured from master sessions, see audit script):

- `master.envelope.concept-coverage` — fraction of user-message keywords appearing
  in any worker prompt within the same session.
  - Baseline (8 sessions): mean 38%, range 19–83%.
  - Target: ≥60% mean across last 20 sessions.
- `master.envelope.shell-style-prompts` — fraction of worker prompts that look
  like bare shell commands ("cat …", "Run: …", numbered shell lists).
  - Baseline: 4/8 sessions had ≥1; ~50% of all prompts in failing sessions.
  - Target: ≤10% of prompts.
- `master.envelope.short-timeouts` — count of worker calls with `timeout < 60`
  (already forbidden by master's own AGENTS.md).
  - Baseline: 6/8 sessions; some calls at `timeout: 10`.
  - Target: 0.
- `worker.transport.opaque-returns` — fraction of worker calls returning either
  `[exit 143]` raw stream noise or <200B narration without tool data.
  - Baseline (cc_worker): 10/12 in the aks-rp-e2e session.
  - Baseline (codex_worker): **48/48 historical calls — codex has never
    returned anything but `[stderr] Reading additional input from stdin...`**.
  - Target: every return carries either `status=completed` with parsed
    sections, or an explicit `status=timed_out|error|no_output` envelope with
    diagnosis.

Provenance signals (qualitative, watched in journal):

- Did master forward the user's literal task to the worker?
- Did the worker's tool outputs reach master's context?
- Did master cite worker findings in its reply, or paraphrase them away?

## Current State
Waiting: The core delegation wiring is complete. Master (an LLM agent) calls cc_worker/codex_worker tools, which now spawn CLI subagents and return structured 
## Plan

Incremental and reversible. Each step lands one thing, then we watch
real master sessions before deciding the next move.

### Phase 1 — Transport (highest evidence, lowest risk)
- [ ] Wire `cc-stream-parser.ts` into `agents/master/tools/cc-worker.ts`. Use
      `formatEnvelope()` for the returned text. Keep the parser as a pure
      function so it stays testable.
- [ ] Wire `codex-stream-parser.ts` into `agents/master/tools/codex-worker.ts`
      the same way.
- [ ] Enforce `timeout >= 60` at the tool boundary; if caller passes lower,
      bump to 60 and log a warning in the envelope.
- [ ] Verify offline: re-run `scripts/spike-cc-parser-verdict.ts`; both
      parser test suites must stay green.
- [ ] Land. Watch the next 5 real master sessions for `worker.transport.
      opaque-returns` rate.

### Phase 2 — Investigate codex production failure
Triggered by Phase 1's surfaced diagnosis.
- [ ] Read the `status=no_output` notice from a real Phase-1 codex call and
      check the suggested causes in order (config.toml, env vars, network to
      `host.docker.internal:4000`).
- [ ] If still failing, instrument with `RUST_LOG=debug` or equivalent and
      capture one stderr-rich run.
- [ ] Document root cause in journal. Fix at the runtime layer (not the
      parser).

### Phase 3 — Schema-organised AGENTS.md (Layer 4)
- [ ] Re-add destructive-request safety rules dropped in `/tmp/AGENTS-new.md`.
- [ ] Spec `originator_kind: "human" | "handler" | "parent_agent"` and what
      `originator_task` means for each.
- [ ] Spec multi-turn correction handling (probably: keep originator stable,
      add `corrections: string[]`).
- [ ] Land the new AGENTS.md.
- [ ] Watch 10 sessions for `master.envelope.shell-style-prompts` and
      `master.envelope.short-timeouts`. If both drop, schema is working.

### Phase 4 — Structured envelope (Layer 1) — soft introduction
- [ ] Extend `cc_worker` and `codex_worker` parameters to accept structured
      fields (`originator_task`, `context.pinned_files`, `ask.deliverable`,
      `return.sections`) **alongside** the existing `prompt` string. No
      validation yet; both shapes work.
- [ ] When structured fields are present, the wrapper assembles the worker
      prompt from them. When only `prompt` is present, legacy mode + emit
      metric `master.envelope.legacy-fallback`.
- [ ] Watch the legacy-fallback rate. If it stays high, master isn't using
      the new shape — investigate before tightening.

### Phase 5 — Validation gate (Layer 1 enforcement)
Only after Phase 4 shows master *is* using the structured shape.
- [ ] Add a soft gate: reject calls with empty `originator_task` (when
      `originator_kind != handler` permits it) or `ask.deliverable`. Start
      loose; tighten by data.
- [ ] Watch false-positive rate. If a working call gets rejected, loosen.

### Phase 6 — Session recap (Layer 5)
- [ ] On every worker return, include `session_recap` — the worker's own
      ~200-word summary of accumulated context. Surfaces silent drift.
- [ ] Watch whether master uses the recap to decide `new_session: true`.

### Future (do not start until earlier phases hold)
- Layer 3 (identity cards in tool descriptions) — depends on Phase 4
  delivering routing decisions worth informing.
- Layer 6 (isolated cross-review) — depends on Phase 4 delivering structured
  outputs that can be cleanly forwarded.

## Validation

Phase-level exit checks (each phase must hold before the next starts):

- **Phase 1**: across the next 5 master sessions, no return is `[exit N]`-only
  noise; every return either parses cleanly or carries an explicit `status=
  timed_out|error|no_output` envelope with diagnosis.
- **Phase 2**: at least one real codex call returns `status=completed` with
  agent_message + tool outputs, OR root cause documented and triaged with an
  owner.
- **Phase 3**: across the next 10 sessions, `short-timeouts` count drops to 0
  and `shell-style-prompts` rate drops below 25%.
- **Phase 4**: ≥3 sessions show `originator_task` populated with verbatim user
  text, surfaced via the legacy-fallback metric.
- **Phase 5**: validation gate rejects ≤1 working call per 20 (≤5%
  false-positive).

Project-level success: `master.envelope.concept-coverage` ≥60% mean across the
last 20 sessions, and any master session whose worker calls all `status=
completed` succeeds at its task without a user correction.

## Journal

### 2026-05-11 — Project created
Created by hao + assistant after deep-diving session `s_1778488255398_0`
("let's setup the aks-rp-e2e project together"). That session exposed the
three problems above. Applied diagnosis-first: ran an 8-session audit before
proposing a design; built and offline-validated both parsers before shipping.

Key prior conversation artefacts (in `/tmp/`, to be folded into the project
journal as phases land):
- `AGENTS-new.md` — schema-organised AGENTS.md draft (Phase 3 input).
- `layer4-stress-test.md` — trace of 7 tasks, surfaced 1 regression and 2
  ambiguity gaps to fix in Phase 3.
- `layer1-edge-cases.md` — 10 envelope edge cases + resolutions (Phase 4
  input).

Honest scope notes:
- I (assistant) scored my own design partly on a worked example I also wrote
  — that's training-on-test-set. Phase 3's exit criterion uses *unseen*
  sessions, not my traces, to avoid this bias.
- Layer 2 (transport) is the only layer with strong empirical backing right
  now. Other layers are theoretically grounded but should be considered
  hypotheses until session data confirms.

## References

**Specs / docs:**
- `docs/design/master-worker.md` — retired but architecturally on-target.
- `docs/projects.md` — project file convention used here.

**Knowledge entries:**
- `agents/shared/knowledge/entries/KE-345-handoff-information-loss-48pct.md`
- `agents/shared/knowledge/entries/KE-120-cooperation-calibration-context-triad-multi-agent-structural-requirements.md`
- `agents/shared/knowledge/entries/KE-282-identity-aware-delegation-protocol-design.md`
- `agents/shared/knowledge/entries/KE-377-context-structure-beats-content.md`
- `agents/shared/knowledge/entries/KE-103-context-stripping-paradox.md`
- `agents/shared/knowledge/entries/KE-1027-context-precision-over-length.md`
- `agents/shared/knowledge/entries/KE-207-tool-illusion-error-migration-context-pollution.md`

**Experiments:**
- `agents/shared/knowledge/experiments/EXP-203/` — structured handoff template.
- `agents/shared/knowledge/experiments/EXP-212/` — schema-organised context (58–93% violation reduction).
- `agents/shared/knowledge/experiments/EXP-039/` — informationally isolated verification.

**Code (in this repo):**
- `agents/master/AGENTS.md` — current master identity (the one that failed).
- `agents/master/tools/cc-worker.ts` — cc wrapper, broken parser.
- `agents/master/tools/codex-worker.ts` — codex wrapper, broken parser.
- `agents/master/tools/cc-stream-parser.ts` — new pure parser (verified).
- `agents/master/tools/codex-stream-parser.ts` — new pure parser (verified).
- `agents/master/tools/__tests__/cc-parser.test.ts` — 6/6 pass.
- `agents/master/tools/__tests__/codex-parser.test.ts` — 7/7 pass.
- `scripts/spike-cc-parser-replay.ts`, `scripts/spike-cc-parser-verdict.ts` —
  empirical validation harness.

**Source session (the one that started this):**
- `.state/sessions/history/s_1778488255398_0/` — task: "let's setup the
  aks-rp-e2e project together".


## Artifacts
- outputs/layer4-stress-test.md
- outputs/parser-wiring-plan.md
- outputs/layer1-edge-cases.md
- outputs/AGENTS-new-draft.md


## Context
- cc-worker.ts and codex-worker.ts now return structured envelopes via formatEnvelope/formatCodexEnvelope (commit 08e44231d)
- Master is an LLM agent (opus) that consumes worker results as text tool outputs — no programmatic parsing of return values
- Parser tests exist in agents/master/tools/__tests__/ but no integration tests for full delegation flow
- May agent has its own copies of both workers at agents/may/tools/
