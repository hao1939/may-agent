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

### Tier 2: Tool-Level Guards (`projects/may-agent/src/lib/tools/*.ts`)

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

**Threshold calibration history:**
- **2026-06-10:** Raised from 2,000 to 2,500 by may (commit 483ca44d8).
  Rationale: ~91% of guard triggers are ambient uncommitted-files warnings,
  structural noise floor ~1,800/day.
- **2026-06-14:** Raised from 3,500 to **4,500** (commit ac70bb0ab).
  Rationale: structural noise floor rose to ~3,100–3,300/day with session
  volume growth (~1,800 sessions/day). 95.8% of triggers are ambient
  uncommitted-files warnings (commit-guard). Guard SNR remains inverted:
  ~136 real signals/day vs ~3,100+ ambient noise.
- **2026-06-15:** Threshold 4,500 **breached** at ~4,512 triggers/day,
  <24h after the raise. 5th breach confirms KE-1998 F1: static thresholds
  cannot track the growing noise floor. Headroom life: 4d→3d→1d→<1d.
  Further threshold raises are no longer viable. Root-cause fix required
  (see KE-1999, KE-2000 Repair Spec #3).

Key structural observations from the full snapshot history:
- Combined commit-guard (uncommitted-files + finish()-uncommitted) is
  the largest category at 44–54% when diverse.
- SESSION_BASH_CAT is 100% evaluator — the sole agent catting
  session.jsonl files. It can dominate during evaluator-heavy windows.
- READ_DEDUP source has shifted: evaluator (re-reading periodic-tasks,
  project files) and aks-explorer (re-reading project.md) trade off.
- PATH_HALLUCINATION is primarily aks-explorer (`/home/` and `/root/` paths).
- Monoculture episodes (e.g., SESSION_BASH_CAT at 98.7%)
  last <16h before reverting to diverse baseline.

**Latest snapshot 2026-06-13 ~16:30Z** (24h window, ~3,200 total):

| Signal | Count | Share |
|--------|------:|------:|
| commit-ambient (uncommitted files) | 991 | 31.0% |
| commit-finish (finish() uncommitted) | 823 | 25.7% |
| SESSION_BASH_CAT | 383 | 12.0% |
| SESSION_READ | 287 | 9.0% |
| READ_DEDUP | 285 | 8.9% |
| Edit-Without-Read (C1.1 + workflow) | 100 | 3.1% |
| SESSION_BASH_GREP | 39 | 1.2% |
| PATH_HALLUCINATION | 6 | 0.2% |

Total: ~3,200/day (threshold breach continues, **structural floor > threshold**).

Stable vs prior snapshot (2026-06-13 ~14:30Z):
- **Guard count flat** (~3,260 → ~3,200, within noise). Structural
  breach persists across eight+ consecutive snapshots.
- **Composition stable**: commit-guard combined ~57%, session-read-guard
  combined ~22%, READ_DEDUP ~9%. No monoculture regime.
- **Per-agent**: aks-explorer 45%, evaluator 43%, arc 6%, scout 3%,
  may 2%, dev 2%. Distribution unchanged.
- **Notable**: READ_DEDUP dropped from ~18% to ~9% since prior snapshot.
  PATH_HALLUCINATION also dropped (46 → 6), suggesting aks-explorer's
  `/home/` path usage may have been addressed.
- The breach remains structural — ~57% is ambient commit-guard noise from
  shared-worktree concurrency and cannot decrease without guard or threshold
  calibration. (**Resolved**: threshold raised to 3,500; see calibration
  history above.)

**Snapshot 2026-06-14 ~22:00Z** (24h window, 3,234 total):

| Signal | Count | Share |
|--------|------:|------:|
| commit-ambient (uncommitted files) | 922 | 28.5% |
| commit-finish (finish() uncommitted) | 942 | 29.1% |
| SESSION_BASH_CAT | 381 | 11.8% |
| SESSION_READ | 262 | 8.1% |
| READ_DEDUP | 498 | 15.4% |
| PATH_HALLUCINATION (tool-level) | 61 | 1.9% |
| SESSION_BASH_GREP | 44 | 1.4% |

Tier 1 guards: read-before-edit 82, finish-guard 30 (blocked), hallucinated-path 10.

Per-agent: evaluator 1,318 (40.8%), aks-explorer 1,292 (40.0%),
scout 231 (7.1%), may 172 (5.3%), arc 166 (5.1%), dev 45 (1.4%),
tech-lead 6 (0.2%).

vs prior: Composition shifted — commit-guard combined dropped from 57%
to 57.6% (flat), but READ_DEDUP surged from 9% to 15.4%. PATH_HALLUCINATION
rebounded from 6 to 61 (all aks-explorer `/home/hayua` paths), falsifying
the "may have been addressed" note above. Finish-guard (Tier 1) grew
from 8 to 30 — all may sessions, all resolved. Total count stable at ~3,200.
Structural breach continues. (**Update 2026-06-14**: Threshold was raised
to 3,500 in metrics-snapshot.ts, resolving the breach. Current ~3,200/day
sits comfortably below the new threshold.)

**Snapshot 2026-06-15 ~05:30Z** (6h window, 1,402 total; 24h ~4,385):

Monoculture regime: 98.1% of triggers are `beforeToolCall` commit-guard
"uncommitted files exist" warnings. 100% of these fire on files the
guard itself identifies as "not matching this session's deliverables."

| Signal | 6h Count | Share |
|--------|-------:|------:|
| commit-guard (tool.finish) | 952 | 67.9% |
| commit-guard (tool.bash) | 230 | 16.4% |
| commit-guard (tool.read) | 193 | 13.8% |
| read-before-edit (tier 1) | 26 | 1.9% |
| hallucinated-path (tier 1) | 1 | 0.1% |

Rate: 232 triggers/hour. Threshold 4,500 breaching <1 day after the
3,500→4,500 raise (commit ac70bb0ab). **KE-1998 F1 confirmed**: static
thresholds cannot track the noise floor growth. Threshold calibration
history shows decreasing headroom life: 4d → 3d → 1d → <1d.

Root-cause fix required: scope commit-guard to session-relevant files
only (the "Alternative (deferred)" from the 2026-06-15 threshold
proposal). See KE-1999.

**Snapshot 2026-06-15 ~05:40Z** (6h window, 1,453 total; 24h 4,512):

**Threshold breached.** `guard.triggered-count-24h` = 4,512 (threshold
4,500). KE-1999 F1 confirmed: the 5th ratchet lasted <24h. All
`beforeToolCall` triggers (1,418/1,453, 97.6%) are the same commit-guard
ambient warning about unrelated dirty files.

| Signal | 6h Count | Share |
|--------|-------:|------:|
| commit-guard (tool.finish) | 979 | 67.4% |
| commit-guard (tool.bash) | 229 | 15.8% |
| commit-guard (tool.read) | 210 | 14.5% |
| read-before-edit (tier 1) | 34 | 2.3% |
| hallucinated-path (tier 1) | 1 | 0.1% |

Per-agent (6h): evaluator 921 (63.4%), aks-explorer 347 (23.9%),
may 92 (6.3%), scout 55 (3.8%), arc 26 (1.8%), dev 12 (0.8%).

**Status**: Static threshold calibration is exhausted. Raising to 5000+
would buy <24h based on the accelerating pattern. The root-cause fix
(scope commit-guard to session-relevant files) is the only viable path.
See KE-1999, KE-2000 Repair Spec #3. The guard already identifies the
files as "not matching this session's deliverables" — the fix is to
suppress the event emission for that case, not just the agent-facing
warning.

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
