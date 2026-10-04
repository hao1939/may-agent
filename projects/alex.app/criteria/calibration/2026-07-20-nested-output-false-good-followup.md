# 2026-07-20 Nested-Output False-Good Follow-up

## Decision

Tightened `evaluator-aftermath` heuristic v12 to pre-review flag nested project output paths (`projects/<project>/projects/<project>/...`) as evaluator issues. This addresses the newest false-good cluster where sessions were initially routed `good` / `success_candidate` solely because they had file-write plus verification/project signals, but independent review found the claimed durable outputs landed outside canonical project roots.

## Evidence window

- Metric at task start: `evaluator.false-good-rate-sample.current = 0.1682`, target `0.05`, threshold `0.6`.
- Recent false-good sample: the 20 newest `evaluation.false_good` rows include a scout-heavy cluster, with repeated `originalVerdict=good`, `heuristicVerdict=good`, and independent `reviewedVerdict=needs_improvement` or `acceptable`.
- Representative event rows:
  - `3629729`: `s_1784521675052_41`, scout, `good -> needs_improvement`.
  - `3629779`: `s_1784521670854_40`, scout, `good -> needs_improvement`.
  - `3629850`: `s_1784521781861_46`, scout, `good -> needs_improvement`.
  - `3629873`: `s_1784521831018_48`, scout, `good -> needs_improvement`.
  - `3636723`: `s_1784537256769_191`, scout, `good -> acceptable`.

## Pattern

The route heuristic was still too permissive for canonical-output failures. For `s_1784521675052_41`, aftermath review found:

- The route was `success_candidate` / `good` because signals included `file write/edit`, `verification command`, `project-linked session`, and `workflow-linked session`.
- Claimed canonical deliverables under `/app/projects/scout-knowledge-lib/...` and `/app/projects/scout-knowledge-lib.app/...` were absent.
- The actual content existed under duplicated nested roots such as `/app/projects/scout-knowledge-lib/projects/scout-knowledge-lib/knowledge/findings/2026-07-20-github-scan.md` and `/app/projects/scout-knowledge-lib/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md`.
- The review correctly scored this as `needs_improvement`, but only after the initial `good` route had already contributed a false-good event.

## Change

`agents/evaluator/workflows/evaluator-aftermath.ts` now:

1. Increments `HEURISTIC_VERSION` from 11 to 12.
2. Adds `isNestedProjectOutputPath()` to detect normalized paths matching `projects/<project>/projects/<project>/...`.
3. Adds a `transcriptIssues()` check that records `nested project output path(s): ...` when assistant tool-call paths show nested project writes/edits.

Because `classifyVerdict()` marks sessions with transcript issues as `needs_improvement`, this prevents obvious nested-output canonicality failures from being pre-routed as clean `good` / `success_candidate` before review.

## Second calibration: shell redirection writes

A bounded follow-up audit of the newest false-good events found the metric is not only lagging on the nested-output pattern; it also exposed a separate evaluator-side routing blind spot. Event `3636723` (`s_1784537256769_191`, Scout, `good -> acceptable`) used absolute canonical paths, so the v12 nested-path detector did not apply. Its review was overturned because Scout produced a useful GitHub finding but missed prior same-day topical scan #531 and did not read back the final finding/digest. Primary transcript evidence shows the finding was written with `write()`, but the digest was updated with a shell heredoc append (`cat >> /app/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md`) and then Scout finished without reading either final artifact. Before this follow-up, `transcriptOutputSignals()` only treated explicit `write`/`edit` tool calls as material writes, so shell-created/appended artifacts were underweighted unless another explicit material-write signal happened to exist.

`agents/evaluator/workflows/evaluator-aftermath.ts` now increments `HEURISTIC_VERSION` to 13 and treats parsed shell write/redirection paths as a `shell file write` output signal. That signal is included in the `success_candidate` material-output set, forcing sessions whose only durable artifact mutation is `bash` redirection/`tee` to receive reviewer scrutiny rather than being classified as routine-good. This complements v12: canonical-path shell writes may be valid, but they are still material outputs whose quality, dedupe, and read-back verification need review.

## Post-change metric check

Live trend confirmation is still lagging because the metric has not recomputed over enough v13 aftermath rows in this bounded attempt. Current runtime evidence shows `evaluator.false-good-rate-sample.current = 0.1703` (target `0.05`, threshold `0.6`) and the newest sampled false-good rows still mostly have heuristic v11/v12 lineage (`evaluations` over the last 24h: 985 `good` rows at heuristic v11, only one `good` at v12 before this change). The justified leading indicator is coverage: v12 pre-flags nested project paths, and v13 now routes shell-only artifact writes to `success_candidate`; continue watching the metric after fresh v13 evaluations rather than lowering the threshold now.
