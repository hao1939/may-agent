# Guards As Signals

**Status**: Guard trigger event emission and first metrics slice implemented.

Guards are detection signals first. Blocking is only one intervention mode.

Default meaning:

```
mechanical detector fired -> emit unreviewed signal -> optional intervention -> later review
```

Not:

```
regex matched -> proof the agent was wrong -> hard block
```

Every guard trigger should be observable. The important event is that the
system detected a possible weakness, risk, missing context, misleading workflow
prompt, tool-surface confusion, or near-miss. A guard trigger is not solid
evidence by itself. It may be a true positive, false positive, noisy detector,
useful intervention, or harmful interruption.

Guard output therefore enters the learning system as an unreviewed signal. The
evaluator or owner must compare the guard event with the raw session log, tool
request/output, project context, and final result before assigning blame or
changing behavior.

## Modes

| Mode | Behavior | Use when |
|---|---|---|
| `observe` | Emit a guard event only. Do not interrupt the agent. | New guard, uncertain detector, behavior research, false-positive risk. |
| `warn` | Emit event and inject warning/context into the current session or next workflow step. | Likely issue but agent may self-correct. |
| `repair` | Emit event and inject/run a recovery step. | Mechanically recoverable issue such as missing verification. |
| `block` | Stop the action/session/workflow and emit event. | High-confidence, high-impact risk. |
| `escalate` | Stop or pause and route to owner/human. | Security, destructive action, repeated unresolved failure, unclear risk. |

Use `block` sparingly. Good blocking cases include secret leakage, destructive
commands, cross-owner writes without permission, committing unrelated work,
irreversible DB/filesystem mutation, or a known violation with high confidence
and high cost.

## Default Guard Handler

Following convention over configuration, every guard should get default
observability without each guard author wiring custom logging.

Default path:

```
guard fires
  -> emit guard.triggered
  -> default guard handler records metrics/projection
  -> optional intervention happens in guard runtime
  -> evaluator/May/owner can review patterns later
```

The guard runtime detects and intervenes. The default handler observes and
measures. Agents/evaluator judge and improve the system.

## Standard Event

```ts
type GuardTriggeredEvent = {
  type: "guard.triggered";
  guard: string;
  demandType: "warn" | "block" | "run_step";
  action: "warned" | "blocked" | "injected" | "skipped_duplicate" | "skipped_invalid" | "skipped_limit";
  source: "workflow";
  owner: string;
  sessionId?: string;
  workflowRunId?: string;
  projectId?: string;
  parentSessionId?: string;
  step?: string;
  reason: string;
  sourceEventType: string;
  injectedStepLabel?: string;
  injectedAgent?: string;
};
```

Target invariant: every guard trigger emits `guard.triggered`.

## Two-Tier Guard Architecture

Guards operate at two levels, both emitting `guard.triggered` events:

### Tier 1: Workflow Guards (`shared/guards/*.ts`)

Loaded by `shared/guards/loader.ts`. Fire on workflow step transitions
(`step_done`, `step_started`, etc.). Each guard exports
`guard: WorkflowGuard` with a `handle()` method. Returns demands
(`warn`, `block`, `run_step`). Events use `source: "workflow"` and the
guard's own name in the `guard` field.

Active workflow guards (as of 2026-06-06):
`auto-test`, `build-check`, `cost-limit`, `finish-guard`,
`hallucinated-path`, `knowledge-entry-overwrite`, `milestone-quality`,
`no-secret-leak`, `rbe-primer`, `read-before-edit`, `vae-primer`.
(`verify-after-write` is disabled.)

### Tier 2: Tool-Level Guards (`src/lib/tools/*.ts`)

Composed by `compose-guards.ts` and wired into the `beforeToolCall` hook
in `manager.ts`. Fire on **every tool invocation**, not workflow
transitions. Events use `source: "tool"` and `guard: "beforeToolCall"`
(not the individual guard name — the specific guard is identifiable only
from the `reason` field text).

Active tool-level guards (as of 2026-06-05, from `manager.ts buildGuards()`):
- **empty-args-guard**: Catches empty/missing argument objects.
- **tool-schema-guard**: Catches common tool parameter misuse patterns
  (e.g., C1.1 Edit-Without-Read, C7.1 Hallucinated Path).
- **path-hallucination-guard**: Detects references to non-existent paths
  in bash commands. Fires `PATH_HALLUCINATION` signals.
- **completeness-guard**: Agent-specific completeness checks.
- **finish-guard**: Validates evidence in `finish(success)` calls.
- **commit-guard**: Warns/blocks at `finish()` when agent has uncommitted
  changes or is about to commit files outside its lane. Fires
  `uncommitted files` and `finish() uncommitted` signals.
- **read-dedup-guard**: Warns/blocks when an agent reads the same file
  repeatedly within a session. Fires `READ_DEDUP` signals.
- **session-read-guard**: Warns against reading raw `session.jsonl` files
  (30–300KB). Fires `SESSION_READ`, `SESSION_BASH_CAT`, `SESSION_BASH_GREP`
  signals depending on the access method.
- **scrape-dedup-guard**: Deduplicates repeated web scraping of the same URL.

**Not in `beforeToolCall` but active via tool internals:**
- **cross-edit-guard**: Prevents agents from modifying other agents'
  protected files. Wired directly into `edit.ts` and `write.ts` tool
  implementations (not via `composeGuards`).

**Defined but not wired in:**
- **verification-depth-guard**: Validates meaningful post-write
  verification in `finish(success)` sessions. File exists but
  `createVerificationDepthGuard()` is not called from `buildGuards()`.

**Volume note:** Tool-level guards generate the majority of guard events
because they fire per tool call. Guard noise composition shifts over
time — see KE-1252 (alert fatigue), KE-1362 (monoculture pattern),
KE-1564 (composition shift), KE-1567 (uncommitted-files rebound,
falsified KE-1564).

### Composition history (2026-06-06 through 2026-06-10)

Guard composition oscillates between monoculture (one signal >95%) and
diversity (5+ active signals) depending on which agents are active.
Neither KE-1362 (monoculture) nor its falsification (KE-1626) is
durably correct — the system switches between regimes. Volume has
ranged from ~1,150 to ~2,030/day across snapshots taken 2026-06-06
through 2026-06-10.

**Threshold calibration (2026-06-10):** `guard.triggered-count-24h`
and `guard.warned-count-24h` thresholds were raised from 2,000 to
**2,500** by may (commit 483ca44d8). Rationale: ~91% of guard triggers
are ambient uncommitted-files warnings from shared-worktree concurrency,
making the structural noise floor ~1,800/day; threshold 2,000 triggered
on normal activity. The new threshold provides headroom for normal load
variation while still catching genuine behavioral deterioration.

Key structural observations from the full snapshot history:
- Combined commit-guard (uncommitted-files + finish()-uncommitted) is
  the largest category at 44–54% when diverse.
- SESSION_BASH_CAT is 100% evaluator — the sole agent catting
  session.jsonl files. It can dominate during evaluator-heavy windows.
- READ_DEDUP source has shifted: evaluator (re-reading periodic-tasks,
  project files) and aks-explorer (re-reading project.md) trade off.
- PATH_HALLUCINATION is primarily aks-explorer (`/home/` paths).
- Monoculture episodes (e.g., SESSION_BASH_CAT at 98.7%)
  last <16h before reverting to diverse baseline.

**Latest snapshot 2026-06-10 ~10:20Z** (24h window, ~1,838 tool-level):

| Signal | Count | Share |
|--------|------:|------:|
| commit-guard (combined) | 924 | 50.3% |
| READ_DEDUP | 277 | 15.1% |
| SESSION_BASH_CAT | 276 | 15.0% |
| PATH_HALLUCINATION | 163 | 8.9% |
| SESSION_READ | 158 | 8.6% |
| SESSION_BASH_GREP | 43 | 2.3% |

Workflow guards: read-before-edit 98, hallucinated-path 87.
Total: ~1,838 tool + ~185 workflow ≈ **2,023/day** (under new 2,500 threshold).

Guard volume by agent (24h): evaluator 1,010 (50%), aks-explorer 800
(40%), arc 66, scout 52, dev 47, may 41, tech-lead 2.

Notable patterns from 2026-06-10:
- **PATH_HALLUCINATION remains elevated** (163, all aks-explorer `/home/` paths).
- **Workflow guards elevated** (185), split between read-before-edit (98)
  and hallucinated-path (87) — both concentrated on aks-explorer.
- commit-guard share stable at ~50% (structural floor from shared-worktree
  dirty files). This is ambient noise, not behavioral deterioration.
- Volume is under the new 2,500 threshold with ~20% headroom.

### Known issue: guard name conflation

Tool-level guards all emit `guard: "beforeToolCall"` instead of their
specific name. To distinguish them, query the `reason` field:
```sql
-- Find session-read-guard triggers specifically
SELECT COUNT(*) FROM events
WHERE event_type = 'guard.triggered'
  AND json_extract(data, '$.guard') = 'beforeToolCall'
  AND json_extract(data, '$.reason') LIKE 'SESSION_READ%';
```

## Ownership

Default owner resolution:

1. explicit event owner,
2. project owner,
3. triggering agent,
4. guard id prefix if it matches an agent,
5. `may` fallback.

## Review Outcome

When a guard signal is reviewed, record the judgment in the session eval trail
or a guard review artifact. Keep the raw guard event linked. Useful outcomes:

| Outcome | Meaning | Learning action |
|---|---|---|
| `true_positive` | The guard caught a real issue or near-miss. | Route normal owner finding if actionable. |
| `false_positive` | The guard fired on valid behavior. | Route to the guard/workflow owner to calibrate. |
| `noisy` | The signal is too weak or repetitive to act on directly. | Keep aggregate metric; avoid owner spam. |
| `useful_intervention` | The guard helped the agent recover. | Consider moving the lesson into workflow/context. |
| `harmful_intervention` | The guard blocked or distracted useful work. | Downgrade mode, narrow detector, or retire. |
| `unknown` | Not enough context to judge. | Preserve evidence; do not train from it yet. |

Only reviewed, actionable guard outcomes should become `learning.feedback`. Raw
`guard.triggered` rows and raw guard metrics can request review, but they
should not directly train agents or accuse owners.

## Metrics

Start small:

- `guard.triggered-count-24h`
- `guard.warned-count-24h`
- `guard.blocked-count-15m`
- `guard.repeat-trigger-count-24h` — **⚠ non-functional** (reads 0).
  Wired to `action='skipped_duplicate'`, an action value the guard
  runtime never emits. The actual repeat-trigger signal (N≥3
  `guard.triggered` events sharing the same `sessionId` in 24h) is
  invisible to this metric. See KE-1246 for root cause and proposed fix.

Later metrics can be added only when necessary, for example
`guard.recovered-after-warning-rate` or `guard.false-positive-rate`.

## Review Questions

Most guard triggers should feed later review:

- Which guard fires most?
- Did the agent self-correct after a warning?
- Which workflow creates repeated guard warnings?
- Is the guard too strict?
- Is this a prompt/context weakness?
- Should this be a workflow step instead of a guard?

This keeps guards aligned with the event/metric model: a guard trigger is a
signal; agents/evaluator/May judge; metrics track trend; workflows repair the
process when evidence justifies it.
