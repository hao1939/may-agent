# Audit disposition: 16 historical invalid evaluator-aftermath results

Date: 2026-08-21  
Task: `audit-invalid-aftermath-results@g1`

## Disposition

**Reconciler-compatible no-op.** The supplied 16-case cohort is fully recovered: all 16 exact source sessions currently have canonical durable `evaluations` rows, and all 16 recovery `evaluator-aftermath` workflow runs are `done`. No structured skip was required. This audit did not close, update, unblock, or recreate any `runtime/session-aftermath/*` task.

## Trace ledger

The first workflow/execution pair in each row is the historical blocked attempt. The recovery workflow is the successful canonical replay documented in `reports/aftermath-recovery-16-sessions-20260821.md`.

| Source session | Historical invalid workflow | Historical evaluator execution | Recovery workflow | Current durable result |
|---|---|---|---|---|
| `s_1786869189423_0` | `wr_1786870308751_7bp7` | `s_1786870308999_24` | `wr_1787264760211_jniv` | acceptable, q=0.84, e=0.55 |
| `s_1786869467902_2` | `wr_1786870255624_d3to` | `s_1786870255867_21` | `wr_1787265094295_r16s` | good, q=0.86, e=0.73 |
| `s_1786869496404_4` | `wr_1786871139076_45w8` | `s_1786871139294_10` | `wr_1787265680089_5pse` | good, q=0.96, e=0.94 |
| `s_1786869539240_5` | `wr_1786871415796_ie85` | `s_1786871416025_17` | `wr_1787265730950_vg3w` | acceptable, q=0.84, e=0.62 |
| `s_1786869570148_6` | `wr_1786871479836_qv2g` | `s_1786871480087_20` | `wr_1787265778053_54ga` | good, q=0.91, e=0.78 |
| `s_1786869598554_8` | `wr_1786871537527_fbjy` | `s_1786871538390_22` | `wr_1787265871653_rb4e` | acceptable, q=0.84, e=0.48 |
| `s_1786869623294_9` | `wr_1786872436713_q01s` | `s_1786872436914_6` | `wr_1787265982309_samp` | acceptable, q=0.68, e=0.62 |
| `s_1786869693426_10` | `wr_1786871718697_0o4c` | `s_1786871719021_28` | `wr_1787266052984_oy17` | acceptable, q=0.64, e=0.68 |
| `s_1786869754817_11` | `wr_1786872089841_axe5` | `s_1786872090046_8` | `wr_1787266176916_p1dq` | acceptable, q=0.66, e=0.52 |
| `s_1786869775342_13` | `wr_1786871951881_qfz3` | `s_1786871952144_4` | `wr_1787266318362_1n3t` | good, q=0.84, e=0.80 |
| `s_1786869822478_14` | `wr_1786872749442_nak0` | `s_1786872750249_15` | `wr_1787266457102_vmmb` | good, q=0.96, e=0.91 |
| `s_1786869928881_17` | `wr_1786872980197_l4pd` | `s_1786872981285_24` | `wr_1787266547370_dahc` | good, q=0.78, e=0.76 |
| `s_1786870161853_20` | `wr_1786873154924_sfzm` | `s_1786873157262_27` | `wr_1787266662103_c3jo` | good, q=0.95, e=0.94 |
| `s_1786870292099_22` | `wr_1786873424021_jj4x` | `s_1786873424390_34` | `wr_1787266722998_pqws` | acceptable, q=0.58, e=0.68 |
| `s_1786870381214_25` | `wr_1786873375771_sr4r` | `s_1786873376237_32` | `wr_1787267196533_duc9` | good, q=0.95, e=0.94 |
| `s_1786870423356_26` | `wr_1786870597380_cnkw` | `s_1786870598417_27` | `wr_1787267322922_y1xi` | good, q=0.95, e=0.78 |

Current totals: **16/16 durable evaluations**, **16/16 successful recovery workflow runs**, nine `good`, seven `acceptable`, zero skips, zero unaccounted cases.

## Root-cause grouping

The invalid-result cause is **shared, not case-specific**.

1. Each historical workflow run above is `blocked` with the same terminal reason shape: `Evaluator execution <session> returned no valid aftermath result.`
2. The historical evaluator sessions were themselves terminal and had assembled complete `kind: "evaluation"` JSON in the legacy finish-summary envelope. Primary examples remain at `/app/.state/sessions/s_1786870255867_21/result.json` and `/app/.state/sessions/s_1786870308999_24/result.json`.
3. The then-deployed workflow consumed `execution.output` but the runtime exposed these results through the legacy summary/finish envelope. The mismatch caused `parseAftermathOutcome` to reject the result and correctly block rather than fabricate a score.
4. No per-target scoring, provider, missing-source-session, or eligibility fault is needed to explain any of the 16 cases. The cohort is one result-transport/envelope defect.

The detailed primary-source analysis is retained in `agents/evaluator/workspace/scoped-aftermath-invalid-result-remediation.md`; the safeguard and regression record is `reports/aftermath-result-contract-reliability.md`.

## Recovery recommendation

The stable recovery rule is:

- dispatch or replay the exact `evaluator-aftermath` workflow for the exact source `sessionId`;
- require its schema-backed `finish().result` to be one of `evaluation`, `existing`, or `skip`;
- let the workflow persist `evaluation.recorded` and let the task reconciler consume the immutable workflow receipt;
- on malformed/non-terminal evaluator output, emit `evaluation.review_failed` and leave the runtime child visibly blocked for reconciler-owned handling;
- **never directly close, update, unblock, or recreate `runtime/session-aftermath/*` tasks from owner review.**

For this cohort, that recovery has already completed. A further replay is unnecessary because the durable evaluation rows exist; if an owning reconciler observes the old blocked receipt again, the idempotent workflow path should return `kind=existing`. Therefore the justified owner action is **no task mutation and no successor remediation task**.

## Verification evidence

- Read-only runtime query returned exactly 16 historical invalid workflow runs for the 16 source IDs, each with its exact workflow and evaluator-execution identity.
- Read-only `evaluations` query returned all 16 source IDs with the verdicts and scores above.
- Read-only recovery-run query returned all 16 listed recovery workflows as `done`, each with `Recorded aftermath evaluation for <exact-session>...`.
- `bun test agents/evaluator/workflows/evaluator-aftermath.test.ts agents/evaluator/workflows/result-envelope.test.ts` passed 19/19 tests (62 expectations), covering strict result transport, legacy summary compatibility, exact-session identity, structured skips, idempotent existing results, and traceable malformed-output handling.
