---
id: master-worker-context-sharing
owner: master
status: waiting
type: continuous
priority: P2
workflow: master-worker-context-sharing-iteration
iteration: 6
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
Blocked: 5 consecutive iterations without milestone progress. Approach needs rethinking.
## Next Action
## Next Action
Phase 5: Live validation. Query the session DB on devbox for the most recent master agent session AFTER commit 6e584d1. Check whether the system message contains AGENTS.md content (e.g. "Delegation Protocol" or "originator_kind"). If yes, document in `outputs/live-validation.md`. If no, trace why loadAgent isn't picking it up for master. Use `ssh_exec` for all checks.

## Next Action
## Next Action
Phase 4: Wire AGENTS.md loading into the LLM agent runtime. Modify `src/core/runtime/llm-agent/runtime.ts` so that when assembling the system message, it checks for an `AGENTS.md` file in the agent's directory and prepends its content. This makes the delegation protocol actually affect master's behavior. Use `ssh_exec` for all file reads/writes (worker sandbox doesn't persist). Write a test confirming the loading works.

## Next Action
## Next Action
Phase 3 validation: Verify commit 27e25a754 landed, then check if any post-commit master sessions show improved delegation (originator fields in worker prompts). If no sessions yet, run a live smoke test. Output findings to `outputs/delegation-quality-baseline.md`.

## Next Action
## Next Action
Phase 3: Improve AGENTS.md with delegation schema. Read current AGENTS.md, then add: (1) destructive-request safety rules, (2) `originator_kind` and `originator_task` fields spec for worker prompts, (3) multi-turn correction handling guidance. Write the updated AGENTS.md and commit. Also save a copy to `outputs/agents-md-v2.md`.

## Plan
### Phase 1 — Transport (highest evidence, lowest risk)
- [x] Wire `cc-stream-parser.ts` into `agents/master/tools/cc-worker.ts`
- [x] Wire `codex-stream-parser.ts` into `agents/master/tools/codex-worker.ts`
- [x] Enforce `timeout >= 60` at the tool boundary
- [x] Verify offline: parser test suites stay green and both worker wrappers build successfully
- [x] Run one deliberate master delegation smoke session, then audit its raw session log for structured worker envelopes and intent preservation.

### Phase 2 — Investigate codex production failure
- [x] Check recent sessions for codex_worker failures; if none found, mark Phase 2 clear
- [x] Document findings in outputs/codex-investigation.md

### Phase 3 — Schema-organised AGENTS.md (Layer 4)
- [x] Land the new AGENTS.md and commit (de0298a)
- [x] Validate: audit post-commit sessions for improved delegation quality → found AGENTS.md is NOT loaded

### Phase 4 — Wire AGENTS.md into runtime (the actual fix)
- [x] Read runtime.ts systemMessage assembly (~line 820)
- [x] Add code to read `agents/{name}/AGENTS.md` and prepend to systemMessage (commit 6e584d1)
- [x] Write unit test confirming AGENTS.md content appears in system prompt
- [x] Verify build passes (bun build clean)
- [x] Commit and confirm on devbox

### Phase 5 — Live validation
- [ ] Check recent master session DB records for AGENTS.md content in system prompt
- [ ] If not appearing, trace the loadAgent call path for master
- [ ] Run a master delegation session and confirm originator fields appear in worker prompts
- [ ] Watch 5 sessions for improvement

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

### 2026-05-18 — Phase 1 hardening review

Project-level review found the project should remain waiting, not close: Phase 1 transport is shipped but lacks the required live 5-session validation window. Hardened the master worker wrappers so caller-supplied short timeouts are raised to 60s and surfaced in the returned envelope, and so Node close signals such as SIGTERM map to the parser's `timed_out` status instead of a generic error. Also updated `agents/master/AGENTS.md` so master no longer treats this waiting project as active implementation work.

Remaining Phase 1 exit criterion: audit the next 5 real master sessions that use `cc_worker` or `codex_worker` and confirm returns are structured envelopes rather than `[exit N]` raw noise. Do not start Phase 2/3 until that evidence exists.

### 2026-05-18 — Activated for live validation

Hao approved moving the project forward. Status changed from `waiting` to `active` so the owner can run a real validation iteration. The next iteration should not redesign the protocol yet; it should create or select one real master delegation session, inspect the raw session log, and record whether Phase 1 transport returns structured worker envelopes with no `[exit N]` raw-noise fallback.

Success for the next iteration: one audited master session with explicit evidence for worker prompt quality, timeout behavior, envelope status, tool-output visibility, and whether master used the worker findings.

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
- outputs/delegation-quality-baseline.md
- outputs/codex-investigation.md
- outputs/layer1-edge-cases.md
- outputs/AGENTS-new-draft.md
- outputs/agents-md-v2.md

## Context
- cc-worker.ts and codex-worker.ts return structured envelopes (commit 08e44231d) — Phase 1 working
- `agents/master/AGENTS.md` exists on devbox with delegation protocol schema
- Commit 6e584d1 on devbox wires AGENTS.md loading into `file-registry/runtime.ts` `loadAgent()` — prepends to systemMessage
- Build verified clean with bun on devbox
- Test file: `tests/unit/core/runtime/file-registry/agents-md-loading.test.ts`
- Worker sandbox doesn't persist to devbox — use ssh_exec for file mutations
- Devbox bun path: `/home/hayua/.bun/bin/bun`; no `node` in PATH

## Next Action
## Next Action
Investigate codex_worker production health (Phase 2). Read the delegation audit and recent master sessions for codex calls. If codex has `status=no_output` failures, diagnose root cause (config, env, network). If codex is healthy, document Phase 2 as clear and begin Phase 3 AGENTS.md work. Output to `outputs/codex-investigation.md`.
