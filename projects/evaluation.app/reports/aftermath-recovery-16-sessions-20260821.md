# Aftermath recovery completion — 16 invalid-result backlog sessions

Date: 2026-08-21
Carrier: `recover-invalid-aftermath-backlog@g1`

## Disposition

All 16 packet-listed source sessions now have canonical durable evaluation rows and accepted `evaluation.recorded` facts produced by repaired `evaluator-aftermath` executions. No structured skip was necessary. This recovery report does not close, update, unblock, or otherwise mutate any `runtime/*` task.

## Evidence contract

For every row below:

- source evidence is preserved at `/app/.state/sessions/<source-session>/session.jsonl` and `result.json`;
- evaluator execution evidence is preserved at `/app/.state/sessions/<evaluator-execution>/session.jsonl` and `result.json`;
- the evaluator `result.json` uses the repaired structured result shape `kind: evaluation` with a scoring-contract `evaluation` payload for the exact source session;
- the canonical durable fact is the `evaluations` row keyed by the source session plus the listed accepted `evaluation.recorded` event.

A bounded runtime query on 2026-08-21 returned `targets=16`, `durable_evaluations=16`, and `recorded_events=16`, with durable evaluation creation timestamps spanning `1787264935462..1787267528188`. A filesystem verification found all 32 source/evaluator session artifact pairs present.

## Complete mapping

| Source session | Agent | Evaluator execution | Workflow run | Durable event | Verdict | Quality | Efficiency |
|---|---|---|---|---:|---|---:|---:|
| `s_1786869189423_0` | app-ops | `s_1787264774750_1507` | `wr_1787264760211_jniv` | 5860072 | acceptable | 0.84 | 0.55 |
| `s_1786869467902_2` | may | `s_1787265094759_1517` | `wr_1787265094295_r16s` | 5860216 | good | 0.86 | 0.73 |
| `s_1786869496404_4` | aks-explorer | `s_1787265687211_1530` | `wr_1787265680089_5pse` | 5860417 | good | 0.96 | 0.94 |
| `s_1786869539240_5` | may | `s_1787265742369_1534` | `wr_1787265730950_vg3w` | 5860454 | acceptable | 0.84 | 0.62 |
| `s_1786869570148_6` | scout | `s_1787265787119_1538` | `wr_1787265778053_54ga` | 5860479 | good | 0.91 | 0.78 |
| `s_1786869598554_8` | may | `s_1787265882933_1542` | `wr_1787265871653_rb4e` | 5860580 | acceptable | 0.84 | 0.48 |
| `s_1786869623294_9` | app-ops | `s_1787265985632_1548` | `wr_1787265982309_samp` | 5860708 | acceptable | 0.68 | 0.62 |
| `s_1786869693426_10` | may | `s_1787266064974_1553` | `wr_1787266052984_oy17` | 5860741 | acceptable | 0.64 | 0.68 |
| `s_1786869754817_11` | may | `s_1787266179309_1558` | `wr_1787266176916_p1dq` | 5860781 | acceptable | 0.66 | 0.52 |
| `s_1786869775342_13` | gym | `s_1787266327531_1563` | `wr_1787266318362_1n3t` | 5860872 | good | 0.84 | 0.80 |
| `s_1786869822478_14` | aks-explorer | `s_1787266465097_1569` | `wr_1787266457102_vmmb` | 5861057 | good | 0.96 | 0.91 |
| `s_1786869928881_17` | app-ops | `s_1787266558266_1575` | `wr_1787266547370_dahc` | 5861088 | good | 0.78 | 0.76 |
| `s_1786870161853_20` | aks-explorer | `s_1787266668396_1581` | `wr_1787266662103_c3jo` | 5861135 | good | 0.95 | 0.94 |
| `s_1786870292099_22` | app-ops | `s_1787266733979_1584` | `wr_1787266722998_pqws` | 5861167 | acceptable | 0.58 | 0.68 |
| `s_1786870381214_25` | gym | `s_1787267203075_1593` | `wr_1787267196533_duc9` | 5861309 | good | 0.95 | 0.94 |
| `s_1786870423356_26` | aks-explorer | `s_1787267329814_1599` | `wr_1787267322922_y1xi` | 5861464 | good | 0.95 | 0.78 |

## Acceptance reconciliation

1. **Outcome coverage:** 16/16 source sessions have a canonical durable `evaluations` record; none remain ineligible.
2. **Traceability:** every mapping links source-session artifacts, a completed evaluator execution and workflow run, and an `evaluation.recorded` event whose `session_id` is the exact source session.
3. **Runtime-task isolation:** this recovery used read-only runtime queries and an evaluation-owned report only; it proposed no task action against any `runtime/*` ID.
4. **Completion map:** the table above is exhaustive for the supplied packet and records every durable outcome.
