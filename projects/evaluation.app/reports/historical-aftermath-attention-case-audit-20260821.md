# Historical aftermath attention-case audit ledger

Date: 2026-08-21  
Task: `historical-aftermath-attention-recovery@g1`  
Source task: `session-audit`

## Final disposition

All 16 supplied historical attention-case sessions are eligible and accounted for by canonical durable evaluation records. No structured skip was needed. Each row below is backed by the exact source-session artifacts, a repaired evaluator execution whose `result.json` contains `finishParams.result.kind = "evaluation"` for the same source session, and an accepted `evaluation.recorded` event.

This audit used only Evaluation-owned reports, evaluator workflow safeguards, read-only runtime queries, and artifact verification. It did **not** close, update, unblock, or otherwise mutate any `runtime/session-aftermath/*` task.

## Complete ledger

| Source session | Durable disposition | Evaluator execution | Workflow run | Accepted event |
|---|---|---|---|---:|
| `s_1786869189423_0` | evaluation: acceptable (q=0.84, e=0.55) | `s_1787264774750_1507` | `wr_1787264760211_jniv` | 5860072 |
| `s_1786869467902_2` | evaluation: good (q=0.86, e=0.73) | `s_1787265094759_1517` | `wr_1787265094295_r16s` | 5860216 |
| `s_1786869496404_4` | evaluation: good (q=0.96, e=0.94) | `s_1787265687211_1530` | `wr_1787265680089_5pse` | 5860417 |
| `s_1786869539240_5` | evaluation: acceptable (q=0.84, e=0.62) | `s_1787265742369_1534` | `wr_1787265730950_vg3w` | 5860454 |
| `s_1786869570148_6` | evaluation: good (q=0.91, e=0.78) | `s_1787265787119_1538` | `wr_1787265778053_54ga` | 5860479 |
| `s_1786869598554_8` | evaluation: acceptable (q=0.84, e=0.48) | `s_1787265882933_1542` | `wr_1787265871653_rb4e` | 5860580 |
| `s_1786869623294_9` | evaluation: acceptable (q=0.68, e=0.62) | `s_1787265985632_1548` | `wr_1787265982309_samp` | 5860708 |
| `s_1786869693426_10` | evaluation: acceptable (q=0.64, e=0.68) | `s_1787266064974_1553` | `wr_1787266052984_oy17` | 5860741 |
| `s_1786869754817_11` | evaluation: acceptable (q=0.66, e=0.52) | `s_1787266179309_1558` | `wr_1787266176916_p1dq` | 5860781 |
| `s_1786869775342_13` | evaluation: good (q=0.84, e=0.80) | `s_1787266327531_1563` | `wr_1787266318362_1n3t` | 5860872 |
| `s_1786869822478_14` | evaluation: good (q=0.96, e=0.91) | `s_1787266465097_1569` | `wr_1787266457102_vmmb` | 5861057 |
| `s_1786869928881_17` | evaluation: good (q=0.78, e=0.76) | `s_1787266558266_1575` | `wr_1787266547370_dahc` | 5861088 |
| `s_1786870161853_20` | evaluation: good (q=0.95, e=0.94) | `s_1787266668396_1581` | `wr_1787266662103_c3jo` | 5861135 |
| `s_1786870292099_22` | evaluation: acceptable (q=0.58, e=0.68) | `s_1787266733979_1584` | `wr_1787266722998_pqws` | 5861167 |
| `s_1786870381214_25` | evaluation: good (q=0.95, e=0.94) | `s_1787267203075_1593` | `wr_1787267196533_duc9` | 5861309 |
| `s_1786870423356_26` | evaluation: good (q=0.95, e=0.78) | `s_1787267329814_1599` | `wr_1787267322922_y1xi` | 5861464 |

Totals: **16/16 durable evaluations**, comprising nine `good` and seven `acceptable` verdicts; **0 skips** and **0 unaccounted sessions**.

## Historical failure and current reproducibility

The historical no-valid-result failure was real and systemic in the then-deployed evaluator workflow. The 16 concrete runtime tasks carried the correct session IDs, but completed evaluator results were exposed in a legacy JSON summary/finish envelope while the workflow consumed only `execution.output`. The workflow therefore emitted traceable `evaluation.review_failed` facts rather than fabricating scores. Representative primary evidence is documented in `agents/evaluator/workspace/scoped-aftermath-invalid-result-remediation.md`: workflow `wr_1786870255624_d3to` / execution `s_1786870255867_21` produced complete evaluation JSON for `s_1786869467902_2`, yet event 5704653 recorded no valid aftermath result; the same contradiction appears for `s_1786869189423_0` via `wr_1786870308751_7bp7`, execution `s_1786870308999_24`, and event 5704677.

The failure mode is **not currently reproducible** after the evaluator-owned repair:

- `agents/evaluator/workflows/evaluator-aftermath.ts` now supplies `aftermathOutcomeSchema` at the agent boundary, accepts only typed `evaluation`, `existing`, or `skip` outcomes, preserves bounded backward-compatible summary parsing, and emits `evaluation.review_failed` for malformed/non-terminal execution rather than inventing a result.
- A fresh read-only query after the last historical invalid-result cutoff (`1787257325039`) found **0** later `evaluation.review_failed` events matching `invalid-output` or `no valid aftermath result`.
- The same window contains **379 successful evaluator-aftermath runs**: 341 newly recorded evaluations and 38 idempotent existing-evaluation dispositions. Error/interrupted executions remain separate non-evaluation failures and are not counted as successful records or skips.
- Focused verification on 2026-08-21 passed **19/19 tests** across `evaluator-aftermath.test.ts` and `result-envelope.test.ts`, including schema enforcement, legacy summary acceptance, structured skip persistence, malformed-output recovery signaling, exact-session identity, and object-result envelope handling.

Systemic defect disposition: **repaired and regression-covered; no successor defect task is warranted from this cohort**. The ongoing fallback remains traceable: malformed or unavailable evaluator output emits an Evaluation-owned `evaluation.review_failed` signal, while lifecycle control of `runtime/session-aftermath/*` remains with the reconciler.

## Artifact verification

A bounded filesystem check verified all 16 source `session.jsonl`/`result.json` pairs and all 16 mapped evaluator-execution `session.jsonl`/`result.json` pairs. Every evaluator result had `finishParams.result.kind = "evaluation"` and named the exact corresponding source session. The exhaustive recovery mapping is also retained at `reports/aftermath-recovery-16-sessions-20260821.md`, and the safeguard/root-cause record is retained at `reports/aftermath-result-contract-reliability.md`.
