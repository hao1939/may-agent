# Proposal: Model-Surface Ratchet, Schema Deduplication, and Prompt Hygiene

**Supports:** [Purpose and value](../1-principles/purpose.md) and [Context is discovered, not dumped](../1-principles/core-principles.md#context-is-discovered-not-dumped). Cuts per-step model input cost and instruction dilution across all hosted agents while mechanically preventing prompt, schema, and skill drift.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first), [Code vs Data](../1-principles/code-vs-data.md), [Evidence-First Process](../1-principles/evidence-first.md), and lessons from DeepSeek's [`dsh-superagent-prototype`](https://github.com/deepseek-ai/dsh-superagent-prototype) (`tests/model-surface.spec.ts`, `tests/docs.spec.ts`, and `000-philosophy.md`).

**Status:** Implemented in initial slices (2026-11-11): Host/SDK schema deduplication and tool surface budgets are proposed in [Host PR #452](https://github.com/hao1939/may-agent/pull/452); prompt hygiene, skill extraction, zero-omission skill catalog tuning, Rejected Mechanisms documentation, and `scripts/check-model-surface.ts` are integrated in `/app`. Remaining items: `TaskIntent` SOP checklist trimming in App mappers and Gym A/B transfer runs.

---

## 1. Executive Summary and Hypothesis

While May's Tier-1 principles state *"Context is discovered, not dumped"* and *"Simple first"*, an empirical measurement of the live agent preparation pipeline (`prepareAgents` + `prepareAgentExecution`) shows severe **sedimentary accretion** across both **tool JSON schemas** and **always-loaded prompts**:

- **Every single model step of `may` starts with `131,733` characters (~33k–38k tokens) of static system prompt + tool definitions** before a single byte of Conversation or Task input is added (**2.23x** DeepSeek orchestrator's `59,000`-char ceiling and **3.25x** DeepSeek worker's `40,500`-char ceiling).
- Even minimal 4-tool specialists like `gym` start every model call with **`77,503` characters (~20k tokens)** because **two tools alone—`finish` (`33,701` chars) and `tasks` (`14,225` chars)—consume `47,926` characters** on *every* Task agent.
- `may`'s 23-entry skill catalog silently overflows `DEFAULT_CATALOG_CHARS` (`8,000`), **dropping `task-execution-guide`, `system-investigation`, and `verification`** from `may`'s prompt on every run.
- Active prompts and skills already contain concrete path and contract drift (non-existent `generated/agent-feedback`, App-relative `design/*.md` paths under `Project root: /app`, and retired `tasks.resolve` / Conversation `followUp` instructions).

**Hypothesis:** Deduplicating `taskAgentResultSchema`, moving situational runbooks out of `may/AGENTS.md` into on-demand skills, pruning Host-enforced prose lectures, and enforcing a CI `check:model-surface` ratchet will **reduce static per-step prompt + schema size by ~45–52%** (`may`: `131.7k -> <=64k` chars; specialists: `78k–95k -> <=48k–58k` chars), restore 100% skill-catalog visibility, and preserve or improve Gym behavioral scores.

---

## 2. Empirical Baseline (Measured 2026-11-11)

Measured directly via `prepareAgents` + `prepareAgentExecution(..., { requireFinish: true, outputSchema: taskAgentResultSchema, toolPolicy: "app-agent-full" })` against `/app`:

### 2.1 Static Surface per Model Step Across Active Agents

| Agent | Agent Dir | `common-sense.md` | `AGENTS.md` | Skill Catalog | System Prompt Total | Tool Count | Tool Schemas JSON | **Total Static Surface** | Omitted Skills |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| **`may`** | `projects/may.app/agents/may` | 14,593 | **45,276** | 7,649 | **70,409** | 12 | **61,324** | **131,733** | **3 omitted** (`system-investigation`, `task-execution-guide`, `verification`) |
| **`alex`** | `projects/alex.app/agents/alex` | 14,593 | 10,594 | 6,728 | 34,714 | 11 | 60,645 | **95,359** | 0 |
| **`evaluator`** | `projects/alex.app/agents/evaluator` | 14,593 | 13,683 | 6,728 | 37,760 | 7 | 53,176 | **90,936** | 0 |
| **`scout`** | `projects/scout-knowledge-lib.app/agents/scout` | 14,593 | 11,490 | 6,728 | 35,641 | 7 | 53,560 | **89,201** | 0 |
| **`bob`** | `projects/alex.app/agents/bob` | 14,593 | 6,473 | 6,728 | 30,542 | 7 | 56,159 | **86,701** | 0 |
| **`tech-lead`** | `projects/alex.app/agents/tech-lead` | 14,593 | 3,199 | 6,728 | 27,266 | 6 | 52,421 | **79,687** | 0 |
| **`judge`** | `projects/alex.app/agents/judge` | 14,593 | 2,357 | 6,728 | 26,420 | 6 | 52,421 | **78,841** | 0 |
| **`gym`** | `projects/alex.app/agents/gym` | 14,593 | 3,323 | 6,728 | 27,375 | 4 | 50,128 | **77,503** | 0 |

*(Reference comparison: `dsh-superagent-prototype`'s CI `BUDGET` in `tests/model-surface.spec.ts` caps **combined** system prompt + tool definitions at **`59,000` chars** for `orchestrator` and **`40,500` chars** for `worker`.)*

### 2.2 Where the `61,324` Tool-Schema Characters Go (`may`)

| Tool | Description Chars | JSON Schema Chars | Total Chars | Share of All Tools |
| --- | ---: | ---: | ---: | ---: |
| **`finish`** (`workflow-finish` + `taskAgentResultSchema`) | 560 | **33,093** | **33,701** | **55.0%** |
| **`tasks`** (`app-task-read-tool.ts`) | 2,050 | **12,128** | **14,225** | **23.2%** |
| `agents` | 303 | 3,386 | 3,737 | 6.1% |
| `run_cli_agent` | 224 | 1,693 | 1,972 | 3.2% |
| All other 8 tools combined (`edit`, `bash`, `workflow`, `read`, `write`, `query_db`, `ssh_exec`, `system_status`) | 2,821 | 4,463 | 7,676 | 12.5% |

**Why `finish` is `33,701` chars:** In [`packages/sdk/src/task-contract.ts`](../../../may-agent/packages/sdk/src/task-contract.ts), `taskAgentResultSchema` (`29,104` chars total, including `14,167` chars of prose `description` strings) is authored as a 4-branch `Type.Union` (`converged`, `waiting`, `waiting` with `report: true`, and `incomplete`). Three of those branches spread `...resultFields` inline (`27,542` chars inside `anyOf`), causing TypeBox to serialize **three complete copies** of `communicationSchema`, `conditionSchema`, `taskActionSchema`, `requests`, and `inputKeys`—and `tasks` (`app-task-read-tool.ts`) serializes those mutation schemas **a fourth time**.

### 2.3 Where `may/AGENTS.md`'s `45,276` Characters Go

| Section in [`projects/may.app/agents/may/AGENTS.md`](../../../may.app/agents/may/AGENTS.md) | Lines | Chars | Share | Loaded When Needed? |
| --- | ---: | ---: | ---: | --- |
| `## Learning from Evaluation reports` | 223 | **15,579** | **34.4%** | **No** — metric/eval runbook loaded on every chat turn |
| `## Communication` | 128 | **8,292** | **18.3%** | Always needed, but ~60% duplicates schema & skill text |
| `## Authority and evidence` | 67 | **4,791** | **10.6%** | Always needed, but repeats Host-enforced fences |
| `## GitHub pull-request ownership and waits` (incl. `## May Task` block) | 75 | **4,608** | **10.2%** | **No** — PR wait recipe loaded even when no PR exists |
| `## Shared research links` + `## Research-adoption recommendations` | 67 | **4,432** | **9.8%** | **No** — Scout/Bob workflow runbooks loaded on every turn |
| `## Returning delegated work` + `## Local team work` + `## Following execution failures` + intro | 122 | **7,575** | **16.7%** | Core deputy role, overlaps `system-deputy-decisions` |

### 2.4 Concrete Drift & Defects Found in Current Active Surface

1. **Silent omission of canonical skills for `may`:** `may` discovers 23 skills (`7,649` chars before hitting `DEFAULT_CATALOG_CHARS = 8,000`), causing `formatBoundedSkillCatalog` to drop the last 3 alphabetical shared skills: **`system-investigation`**, **`task-execution-guide`**, and **`verification`**.
2. **Phantom session-start file check in [`shared/common-sense.md`](../../../../shared/common-sense.md):** Tells every agent *"If `projects/alex.app/generated/agent-feedback/<you>.md` exists, read it at session start"*, but `/app/projects/alex.app/generated/agent-feedback` does not exist—encouraging wasted startup `read`/`bash` probes on every session. Also still states *"standalone Task support is planned, not an available API."*
3. **Broken relative paths in [`projects/may.app/agents/may/AGENTS.md`](../../../may.app/agents/may/AGENTS.md):** References `design/github-pull-request-observation.md`, `design/research-adoption.md`, `design/evaluation-improvement-loop.md`, and `design/operator-application.md` without the `projects/may.app/` prefix, even though `<runtime_environment>` declares `Project root: /app` and *"All paths are relative to project root."*
4. **Retired contract instructions in active prompts/skills:**
   - [`projects/may.app/agents/may/AGENTS.md`](../../../may.app/agents/may/AGENTS.md) (`## Learning from Evaluation reports`) still instructs supplying `conversation: { topic, requestUpdates, requestId?, task? }` and returning a separate Conversation result with follow-up target rules retired in the Task-owned contract.
   - [`shared/skills/control-plane-operation/SKILL.md`](../../../../shared/skills/control-plane-operation/SKILL.md) and [`projects/may.app/agents/may/skills/may-agent-system/SKILL.md`](../../../may.app/agents/may/skills/may-agent-system/SKILL.md) still reference retired `task subscription` and `tasks.resolve`.

---

## 3. Proposed Design Changes

### Change 1 — Deduplicate `taskAgentResultSchema` and Trim Tool Schema Essays (Host/SDK)

- **Mechanism:**
  1. Refactor `taskAgentResultSchema` in [`packages/sdk/src/task-contract.ts`](../../../may-agent/packages/sdk/src/task-contract.ts) from a 4-branch `Type.Union` that copies `...resultFields` 3 times into **one flat `Type.Object`** (`state: Type.Union([Literal("converged"), Literal("waiting"), Literal("incomplete")])` + single definitions of `summary`, `facts`, `response`, `result`, `inputKeys`, `communication`, `conditions`, `requests`, `actions`, `continue`, `report`, `reviewAt`).
  2. Enforce state-specific field exclusions (`incomplete` cannot carry `conditions`/`requests`/`actions`/`continue`; `report: true` with `waiting` requires non-empty `facts`; etc.) inside `admitTaskResultForSchema`—which `createWorkflowFinishTool` **already executes on every `finish()` call** and returns actionable `finish() error:` messages for!
  3. Compress schema `description` fields from multi-paragraph lectures (`14,167` chars) to crisp 1-sentence field contracts: if `admitTaskResultForSchema` or `tasks` validation already rejects invalid combinations with an exact message, do not spend 250 words per property explaining Host internals.
- **Expected impact:** Cuts `finish` + `tasks` from **`47,926` chars -> ~`20,000` chars**, saving **~27,000 chars (~7,000 tokens) on every model step of every agent** (`may`, `alex`, `scout`, `bob`, `tech-lead`, `evaluator`, `judge`, `gym`) with identical runtime validation.

### Change 2 — Decompose `may/AGENTS.md` Using Progressive Disclosure + DeepSeek's Prompt Rules (`may.app` + `shared/`)

Apply two rules borrowed from `dsh-superagent-prototype`:
- **Rule A ("If code enforces it with a clear error, delete the prompt lecture"):** Remove multi-paragraph prose restating generation fences, legacy Condition format migrations, and retired Conversation `followUp` rules already enforced by the Task reconciler.
- **Rule B ("Situational runbooks belong in skills, not base `AGENTS.md`"):** Keep `may/AGENTS.md` strictly focused on always-relevant deputy identity, authority, delegation vs. direct action, and communication (~12,000–14,000 chars, down from `45,276` chars):
  1. Extract `## Learning from Evaluation reports` (`15,579` chars, updated to remove retired `conversation` wrapper instructions) into `projects/may.app/agents/may/skills/evaluation-and-metric-intake/SKILL.md`, leaving a 4-line routing pointer in `may/AGENTS.md`.
  2. Extract `## GitHub pull-request ownership and waits` (`4,608` chars, fixing `projects/may.app/design/github-pull-request-observation.md` paths) into `projects/may.app/agents/may/skills/github-pr-waits/SKILL.md`, keeping only the 4-line `## May Task` PR-body tag requirement in `may/AGENTS.md`.
  3. Extract `## Shared research links` + `## Research-adoption recommendations` (`4,432` chars, fixing `projects/may.app/design/research-adoption.md` paths) into `projects/may.app/agents/may/skills/research-curation-and-adoption/SKILL.md`, keeping a 3-line default rule ("bare shared paper/repo link -> echo 1-sentence plan & delegate `assess-source` to Scout") in `may/AGENTS.md`.
  4. Adopt DeepSeek's **"Select information, do not compress the work report"** rule in `## Communication`, cutting repetitive `Request`/`Topic` paragraphs down by ~50%.
  5. Clean [`shared/common-sense.md`](../../../../shared/common-sense.md): remove the non-existent `projects/alex.app/generated/agent-feedback/<you>.md` startup instruction and trim duplicated Task/workflow explanations (~`14,593` -> ~`9,500` chars).

### Change 3 — Eliminate Silent Skill Catalog Truncation (`shared/skills` + Host `skills.ts`)

- **Mechanism:**
  1. Tighten verbose `description` frontmatter in `shared/skills/*/SKILL.md` (currently up to 377 chars each) to crisp <=140-char trigger descriptions so all 26+ skills (including the 3 extracted May skills above) fit comfortably inside `<available_skills>` (~`5,500` chars total, well under `8,000`), restoring **`task-execution-guide`**, **`system-investigation`**, and **`verification`** to `may`'s visible catalog.
  2. Sort `formatBoundedSkillCatalog` with `app-agent` skills first, then `agent`, then `shared`—and treat `omitted.length > 0` as a **CI failure** in `check:model-surface` rather than a silent runtime truncation.

### Change 4 — Stop the `TaskIntent` SOP "Telephone Game" (`alex.app` & `may.app`)

- **Mechanism:** Audit `app.ts` input-to-Task mappers ([`projects/may.app/app.ts`](../../../may.app/app.ts), [`projects/alex.app/app.ts`](../../../alex.app/app.ts), [`projects/scout-knowledge-lib.app/app.ts`](../../../scout-knowledge-lib.app/app.ts)):
  - Keep `TaskIntent.outcome` and `TaskIntent.acceptance` concise and specific to **what outcome satisfies this exact Task** + **exact source/event pointers**.
  - Move standing 8-bullet procedural checklists (e.g., `runtimePatternAuditAcceptance` tool-usage lectures in `alex.app/app.ts` and `evaluationWorkInput` prose in `may.app/app.ts`) into the owning workflow or specialist skill.

### Change 5 — Add Mechanical `check:model-surface` & Rejected-Concepts Guardrails (`scripts/` + `docs/`)

Modeled directly on DeepSeek's `tests/model-surface.spec.ts` and `tests/docs.spec.ts`:

1. Add `scripts/check-model-surface.ts` to `bun run check:may-design` (`package.json`) that boots `prepareAgents` + `prepareAgentExecution` for every active App/global agent and enforces:
   - **Ratcheted character budgets** per agent (`systemPromptChars`, `toolsSchemaChars`, and `totalSurfaceChars`), e.g. post-cleanup ceilings:
     - `may`: `totalSurface <= 68,000` (down from `131,733`)
     - `alex`, `evaluator`, `scout`, `bob`, `tech-lead`, `judge`, `gym`: `totalSurface <= 58,000` (down from `77,503–95,359`)
   - **Zero omitted skills:** `omittedSkills.length === 0` across every loaded agent.
   - **Path & tool referential integrity:** Every `/app/...` or `projects/...` file path and every tool/skill name cited in active `AGENTS.md`, `SKILL.md`, and `shared/common-sense.md` resolves on disk / in the agent's registered toolset.
   - **Banned retired vocabulary:** Immediate CI failure if active prompts, skills, or tool descriptions mention `tasks.resolve`, `task subscription`, `cron.json`, `agents.resume`, `workflow` `action: "resume"`, or legacy `mode: "agent"` Conversation wrappers.
2. Add a compact **Rejected and Retired Mechanisms** table to [`system-model.md`](../2a-design/system-model.md) (recording *no standalone session auto-resume, no crash workflow step-replay, no Host `cron.json` handlers, no dedicated Conversation executor, no worker self-closure*) so future improvement loops do not re-propose retired concepts.

---

## 4. Verification Plan (Evidence-First)

Per [Evidence-First Process](../1-principles/evidence-first.md), structural size reduction alone is not proof of behavioral quality:

1. **Deterministic contract checks:**
   - All existing `taskAgentResultSchema` / `admitTaskResultForSchema` unit & integration tests in `projects/may-agent` must pass unchanged (`converged`, `waiting`, `waiting` + `report: true`, `incomplete`, invalid combinations, and `finish()` error recovery).
   - `bun run check:may-design` (including the new `check-model-surface.ts`) and `bun run test:deployment` pass with 0 errors and 0 omitted skills.
2. **Behavioral A/B check in Gym ([`projects/gym`](../../../gym)):**
   - Run focused May Conversation follow-through, PR/evaluation routing, and specialist Task scenarios comparing baseline (`131.7k` surface) vs. candidate (`~64k` surface), recording pass rate, unnecessary tool calls (e.g., eliminated `generated/agent-feedback` / broken `design/*.md` probes), and input token delta per turn.

---

## 5. Phased Implementation Slices

| Slice | Scope | Expected Surface Reduction | Risk |
| --- | --- | --- | --- |
| **Slice 1 (Quickest universal win)** | Deduplicate `taskAgentResultSchema` (`task-contract.ts`) + tighten verbose schema descriptions | **-22k to -27k chars on EVERY agent** (`may` `131.7k -> ~106k`; `gym` `77.5k -> ~52k`) | Low — `admitTaskResultForSchema` already enforces state rules |
| **Slice 2 (Prompt & skill hygiene + bug fixes)** | Fix broken paths/retired terms in `common-sense.md`, `may/AGENTS.md`, and `SKILL.md`; trim skill frontmatter so 0 skills are omitted; extract 3 situational runbooks from `may/AGENTS.md` into skills | **`may` `~106k -> ~64k` chars**; **0 omitted skills** (restores `task-execution-guide` & `verification`) | Low–Medium — verify skill selection via Gym scenarios |
| **Slice 3 (CI ratchet & doc guardrails)** | Add `scripts/check-model-surface.ts` into `check:may-design` + add Rejected Mechanisms table in `system-model.md` + trim `TaskIntent` SOP checklists in `may.app` / `alex.app` | Locks in **~45–52% reduction** permanently | Low — read-only CI gate |

---

## 6. Review Questions

1. **Slice 1 (`taskAgentResultSchema` deduplication):** Approve collapsing the 4-branch `anyOf` copy of `resultFields` into a single object schema while keeping all per-`state` semantic checks in `admitTaskResultForSchema`?
2. **Slice 2 (`may/AGENTS.md` decomposition):** Approve extracting the 3 situational runbooks (*Evaluation/metric intake*, *GitHub PR waits*, *Research link curation & Bob adoption*) from always-loaded `may/AGENTS.md` into `may`-local `SKILL.md` packages?
3. **Slice 3 (`check:model-surface` budgets):** Are `<=68,000` chars for `may` and `<=58,000` chars for specialists good initial hard CI ceilings (ratcheting down as we shrink further)?
