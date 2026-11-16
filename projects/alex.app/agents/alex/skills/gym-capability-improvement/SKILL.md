---
name: gym-capability-improvement
description: Scientific loop for improving agent prompts, skills, and code workflows using Gym (`run`, `test`, `verify`, `report`, and `--target codex` reference runs).
---

# Gym Capability Improvement Skill

Use this skill whenever you are asked to **improve an existing agent, skill, or code workflow** (or graduate a capability across the **Stage 1 Prompt → Stage 2 Skill → Stage 3 Code Workflow** progression) and prove the improvement with frozen A/B evidence.

---

## 1. The Knowledge Maturity Progression (Choosing What to Change)

Before editing anything, classify the failure or efficiency bottleneck from the baseline `result.json` and `transcript.jsonl`:

| Observed Symptom in Gym | Stage to Modify | Concrete Action |
| :--- | :--- | :--- |
| **1. Unnecessary Skill / File Reads (Token & Op Bloat)**<br>e.g., Agent reads a 600-line `SKILL.md` on every simple turn (`2+ turns`, `3+ ops`, `30k+ tokens`). | **Stage 1 → 2 Boundary (`AGENTS.md` vs `SKILL.md`)** | Move a compact fast-path rule (5–8 lines) into `AGENTS.md` for the common case so the agent only loads the heavy `SKILL.md` when deep domain playbooks are needed. |
| **2. Missing Domain Heuristics**<br>e.g., Agent fails a coding/debugging trap or domain decision, while `--target codex` passes (or human ground truth specifies the missing rule). | **Stage 2 Skill (`skills/<name>/SKILL.md`)** | Run `bun run gym run <scenario> --target codex` to inspect Codex's `transcript.jsonl` heuristic, or read `expected.json`, and codify the decision checklist into `SKILL.md`. |
| **3. Multi-Turn Exploration Overhead or Deterministically Enforceable Invariants**<br>e.g., Agent spends 4–6 turns reading known state files (`system-state.md`, `git status`), or occasionally forgets a deterministic schema/safety invariant (`async: true`, `preference_updates: []`, `needs_clarification: true` on non-empty diff). | **Stage 3 Code Workflow (`workflows/<name>.ts`)** | Graduate or evolve the capability into a TypeScript workflow that pre-reads local evidence in code, classifies deterministic regimes, calls the agent once with `tools: "readonly"` + `schema`, and normalizes output invariants before writing the artifact. |

---

## 2. Critical Engineering Rules for Stage 3 Code Workflows (Learned from Live Gym Runs)

When authoring or improving a Stage 3 workflow (`workflows/<name>.ts`) that is evaluated in Gym:

1. **Resolve Workspace Root Safely:**
   Always resolve files against `ctx.workspace?.root ?? ctx.workspace?.projectRoot ?? process.cwd()` so both `runDirectWorkflow` and `runWorkflowTest` find scenario files in `workDir`.
2. **Strip Conflicting File-Write Instructions Before `tools: "readonly"` Calls:**
   Many Gym `task.md` prompts end with `"Write <file>.json ... Then call finish()"`. If your workflow calls a child agent with `tools: "readonly"` and `schema` (and writes `<file>.json` itself in TypeScript), **strip the `"Write <file>.json..."` sentence from the child prompt** and explicitly tell the child agent:
   > *"The workflow runner will write `<file>.json` from your `finish(status: "done", result: ...)` payload. Do NOT call `write`, and ALWAYS call `finish` with `status: "done"` (never `status: "blocked"`)."*
   *(Without this, the model sees `write` is denied in readonly mode and calls `finish(status: "blocked")`, producing an `invalid` Gym trial!)*
3. **Separate Regime Classification (Code) from Nuanced Phrasing (LLM):**
   Do **not** hardcode one single prompt instruction (e.g., *"Always remove the superseded item"*) inside a workflow. Instead, write a pure TypeScript classifier (`classifyRegime(requestText, stateContent)`) that detects distinct deterministic regimes (e.g., `block_non_empty_diff`, `block_missing_closure_path`, `clarify_destructive_ambiguity`, `archive_superseded`, `remove_superseded`), injects regime-specific guidance into `ctx.call()`, and enforces regime invariants (`needs_clarification`, `async: true`, `delegations: []` when blocked) in a post-call `normalizeDecision()` function.

---

## 3. The 4-Step Scientific Improvement Protocol

Never edit production files under `projects/<app>.app/agents/` directly during experimentation. Always follow this 4-step loop:

### Step 1: Inspect & Run the Frozen Baseline (`gym show` + `gym test`)
```bash
# Inspect what the scenario(s) test and expect
bun run gym show <scenario>

# Freeze the baseline across the target scenario suite (include both target and control scenarios!)
bun run gym test \
  --benchmark <benchmark> \
  --scenario <case-1> \
  --scenario <case-2> \
  --target <agent-or-owner/workflow> \
  --trials 1 \
  [--objective quality|duration_ms|total_tokens|ops] \
  [--min-reduction-percent 15]
```
*(Optional: If diagnosing a hard coding/reasoning failure, run `bun run gym run <scenario> --target codex` to see how Codex solves it and inspect its `transcript.jsonl`.)*

### Step 2: Prepare `.lab/<candidate>` and Iterate Rapidly with `gym run` + `bun test`
1. Seed `/app/agents/.lab/<candidate>/` with the target agent's current `agent.json`, `AGENTS.md`, `skills/`, and/or `workflows/<name>.ts`.
2. Edit only the candidate files inside `/app/agents/.lab/<candidate>/`.
3. Test fast on single failing cases (`~4–10s` per run):
   ```bash
   bun run gym run <scenario> --target <agent-or-owner/workflow> --lab <candidate> --timeout 3m
   ```

### Step 3: Run Frozen A/B Verification (`gym verify` + `gym report`)
Once single-scenario runs pass, run `gym verify` against the frozen baseline from Step 1:
```bash
bun run gym verify \
  --baseline <BASELINE_RUN_PATH> \
  --candidate <candidate> \
  --trials 1

bun run gym report <VERIFY_RUN_PATH>
```
Check the report:
* `Gate: pass`
* `No per-scenario quality regressions: true`
* `No invalid runs: true`
* Measured benefit target met (more passing trials, or token/op/duration reduction).

### Step 4: Promote & Lock In with `runWorkflowTest` (`*.test.ts`)
Only after `Gate: pass`:
1. Copy the proven `.lab/<candidate>` changes into `projects/<app>.app/agents/<owner>/`.
2. Add or update deterministic `runWorkflowTest` unit tests (`workflows/<name>.test.ts`) covering each regime/branch in `<50ms` with zero LLM cost.
3. Clean up `/app/agents/.lab/<candidate>`.
