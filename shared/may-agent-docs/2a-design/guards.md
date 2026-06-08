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

As of **2026-06-06** (24h window): uncommitted-files warnings were
dominant at ~49% (880 of 1,790), with SESSION_BASH_CAT ~18%,
PATH_HALLUCINATION ~10%, SESSION_READ ~10%, READ_DEDUP ~3%.

**Update 2026-06-06** (24h window, ~1,939 tool-level triggers): guard
composition previously collapsed to a single signal. **Correction
2026-06-06** (24h window, ~1,858 tool-level triggers): composition has
**diversified again** — uncommitted-files warnings are ~50% (934),
SESSION_BASH_CAT ~18% (333), PATH_HALLUCINATION ~12% (221),
SESSION_READ ~11% (201), READ_DEDUP ~2% (35). The `hallucinated-path`
and `read-before-edit` workflow guards also fire (109 and 20 triggers
in 24h), using `source: "workflow"`. Total guard events: ~1,858 tool +
~129 workflow ≈ ~1,987/day. The monoculture pattern (KE-1362) has
reversed — all five tool-level guard types are active again. The prior
"100% single signal" observation was either a transient state or a
measurement artifact. Total count remains near the 2,000/day threshold
noise. This is structural — every session that calls `finish()` with
dirty worktree files triggers it, regardless of whether those files are
the agent's own deliverables.

**Update 2026-06-08** (24h window, ~1,611 tool-level triggers):
composition remains stable — uncommitted-files ~53% (849),
SESSION_BASH_CAT ~19% (300), SESSION_READ ~13% (211),
PATH_HALLUCINATION ~8% (130), READ_DEDUP ~6% (95),
SESSION_BASH_GREP ~2% (26). Workflow guards: hallucinated-path 53,
read-before-edit 7. Total: ~1,672/day. Diversity is persistent, not
transient — the monoculture pattern (KE-1362) is definitively falsified
across 3+ days of measurement (KE-1626).

**Update 2026-06-08 04:16Z** (24h window, ~1,863 tool-level triggers):
composition shift — uncommitted-files dropped from ~53% to **32.2%**
(600) while finish()-uncommitted rose to **21.8%** (406). These two
are the same commit-guard firing at different phases (worktree scan vs
finish() call), so combined commit-guard share = 54%, steady. Other
signals: SESSION_BASH_CAT **17.8%** (332), SESSION_READ **13.4%**
(250), PATH_HALLUCINATION **6.5%** (121), READ_DEDUP **6.1%** (114),
SESSION_BASH_GREP **2.1%** (40). Workflow guards: hallucinated-path 42,
read-before-edit 9. Total: ~1,863 tool + ~51 workflow ≈ ~1,914/day.
Diversity continues stable across 4+ days. Notable: SESSION_BASH_CAT is
100% evaluator sessions — the evaluator is the sole agent catting
session.jsonl files. SESSION_READ (250 events) is also evaluator-only.
PATH_HALLUCINATION is primarily aks-explorer (100/121).

**Update 2026-06-09 06:19Z** (24h window, ~1,881 tool-level triggers):
composition stable — uncommitted-files **32.1%** (604),
finish()-uncommitted **21.6%** (406), SESSION_BASH_CAT **17.6%** (332),
SESSION_READ **13.4%** (252), PATH_HALLUCINATION **6.3%** (118),
READ_DEDUP **2.3%** (44), SESSION_BASH_GREP **1.9%** (35),
other **4.8%** (90). Workflow guards: hallucinated-path 39,
read-before-edit 10. Total: ~1,881 tool + ~49 workflow ≈ **1,930/day**.
Composition unchanged from prior measurement — diversity is a durable
structural property, not transient. Guard volume approaching 2,000/day
threshold.

**Update 2026-06-11 20:18Z** (24h window, ~1,391 tool-level triggers):
volume dropped ~26% (1,391 vs 1,881). Composition shares stable:
uncommitted-files **32.6%** (453), finish()-uncommitted **23.4%** (325),
SESSION_BASH_CAT **19.1%** (265), SESSION_READ **13.2%** (183),
READ_DEDUP **6.8%** (95 — tripled from 2.3%), PATH_HALLUCINATION **3.3%**
(46 — halved from 6.3%), SESSION_BASH_GREP **1.7%** (24). Workflow guards:
read-before-edit 16, hallucinated-path 0 (likely moved to tool-level).
Total: ~1,391 tool + ~16 workflow ≈ **1,407/day**. Key shift:
PATH_HALLUCINATION dropped by half (118 → 46), likely from aks-explorer
running fewer sessions with `/home/` path references. READ_DEDUP tripled
(44 → 95), concentrated in evaluator sessions re-reading `tasks/tree.json`.
SESSION_BASH_CAT is 100% evaluator (239 sessions hit in 24h). Overall
volume well under 2,000/day threshold — no alert risk.

**Update 2026-06-12 ~02:30Z** (24h window, 1,380 total triggers):
**Monoculture has returned.** SESSION_BASH_CAT is now **98.7%** of all
guard triggers (1,362 of 1,380). The remaining 1.3% is read-before-edit
(18). All other signal types — uncommitted-files, finish()-uncommitted,
SESSION_READ, PATH_HALLUCINATION, READ_DEDUP, SESSION_BASH_GREP — are
**zero** in the 24h window. This is the starkest composition shift since
tracking began. SESSION_BASH_CAT is 100% evaluator sessions (229
unique sessions triggered). The diverse composition observed from
2026-06-06 through 2026-06-11 has collapsed into a single-signal
monoculture. Volume down 2% (1,380 vs 1,407). Possible causes:
(1) commit-guard and path-hallucination-guard may have been changed or
disabled, (2) aks-explorer's reduced activity removes PATH_HALLUCINATION,
(3) evaluator's session.jsonl catting overwhelms all other signals.
KE-1362 (monoculture pattern) was re-confirmed 2026-06-12 — but see
update below.

**Update 2026-06-12 ~18:00Z** (24h window, ~1,129 tool-level triggers):
diversity has **returned again**. uncommitted-files **50.7%** (573),
SESSION_BASH_CAT **17.9%** (202), READ_DEDUP **13.3%** (150),
SESSION_READ **11.4%** (129), PATH_HALLUCINATION **3.5%** (40),
SESSION_BASH_GREP **1.5%** (17). Workflow guards: read-before-edit 18.
Total: ~1,129 tool + ~18 workflow ≈ **1,147/day**. The 2026-06-12
monoculture (SESSION_BASH_CAT 98.7%) lasted <16 hours before
reverting to the diverse baseline. The guard composition is **oscillating**
between monoculture and diversity depending on which agents are active
and how many evaluator sessions run relative to other agents' sessions.
Neither KE-1362 (monoculture) nor its falsification (KE-1626) is
durably correct — the system switches between regimes. Volume is
well below the 2,000/day threshold.

**Update 2026-06-08 15:27Z** (24h window, 1,272 tool-level triggers):
**READ_DEDUP is now the #1 single signal** — overtook both
uncommitted-files and SESSION_BASH_CAT. READ_DEDUP **23.6%** (304),
uncommitted-files **22.6%** (291), finish()-uncommitted **22.3%** (288),
SESSION_BASH_CAT **14.7%** (189), SESSION_READ **11.6%** (150),
PATH_HALLUCINATION **1.9%** (25), SESSION_BASH_GREP **1.9%** (25).
Combined commit-guard (uncommitted + finish-uncommitted) = 45%.
Workflow guards: read-before-edit 12, hallucinated-path 5.
Total: 1,272 tool + 17 workflow = **1,289/day** (lowest measured).
Key structural shift: **aks-explorer** is the primary READ_DEDUP
source — 201 of 304 events (66%) across 34 sessions, averaging 5.9
triggers/session, all from re-reading `projects/aks-rp-e2e/project.md`.
The prior observation (2026-06-11) that READ_DEDUP was "concentrated
in evaluator sessions re-reading tasks/tree.json" is now stale.
Diversity continues — no monoculture regime in this window.

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
