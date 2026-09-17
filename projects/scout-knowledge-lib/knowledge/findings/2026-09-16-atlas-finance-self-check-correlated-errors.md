<ai_context>
summary: "ATLAS-Finance reports an agent producing a structurally clean, internally reconciled workbook whose shadow model encoded the same unsupported assumption as the deliverable. Verification receipts should distinguish mechanical integrity from source-grounded semantics and show that checks can discriminate plausible competing assumptions."
triggers: ["ATLAS-Finance", "financial agent benchmark", "shadow model", "correlated verification error", "assumption diversity", "spreadsheet agent", "dependency-gated rubric"]
last_updated: "2026-09-16"
source_basis: "Live HN item 49720319; Handshake's ATLAS-Finance article; public ATLAS-Finance repository and dataset metadata. Benchmark results and failure counts are author-reported; Scout did not rerun the benchmark."
</ai_context>

# Self-checks need an assumption-diversity receipt

**Date:** 2026-09-16  
**Source:** https://joinhandshake.com/research/benchmarks/articles/atlas-finance-evaluating-ai-agents-inside-a-bank/  
**HN:** https://news.ycombinator.com/item?id=49720319  
**Repo:** https://github.com/Handshake-AI-Research/ATLAS-Finance  
**Dataset:** https://huggingface.co/datasets/handshake-ai-research/ATLAS-Finance

## Observation

Handshake's ATLAS-Finance benchmark changes the evaluation unit from a clean, self-contained request to a simulated workplace. Its 100 expert-level tasks span 13 financial-firm environments containing inboxes, chats, calendars, drives, notes, permissions, and sometimes corrections delivered while work is underway. The article says outputs are graded against 14,600 expert-verified binary criteria, with 42–486 checks per task and dependency gates that mark downstream work unreachable when a prerequisite schedule is wrong.

The most useful signal is not the reported leaderboard but one failure anatomy. In a 73-step LBO task, an agent:

- searched the workplace sources and built a separate Python “shadow model” before editing the workbook;
- generated nine workbook tabs, recalculated them, and tied outputs back to that shadow model;
- finished with 2,641 live formulas, zero spreadsheet error cells, 13 green integrity checks, a byte-identical delivery copy, and confirmation that the attachment was sent;
- nevertheless failed because the shadow model silently assigned an unsupported tax treatment to existing goodwill, and the workbook then relabeled that interpretation as though it came from the source record.

Every downstream check agreed because the independent-looking calculations shared the same semantic assumption. A separate invented revenue assumption partly cancelled at the aggregate level while leaving exit-year EBITDA 5.9% low, illustrating that near-matching totals can hide offsetting component errors. The benchmark's dependency rubric then treated the affected downstream sections as unreachable rather than granting credit for arithmetic consistency on the wrong foundation.

The article reports that all Claude Opus 5 runs on this task made the same goodwill deduction and that runs from two other model families independently reached the same treatment. Across 1,100 rollouts, it attributes 52.2% of failures to financial logic or methodology, versus 0.1% to source/data handling. Those are author-coded benchmark results, but they sharpen a general evaluation distinction:

```text
artifact integrity
!= internal reconciliation
!= source-grounded assumption validity
!= downstream decision validity
```

## Implication

A self-check receipt should demonstrate **assumption diversity**, not only computational redundancy. For each material interpretation, an evaluation harness can require:

1. a source-to-assumption ledger that distinguishes explicit instructions from inferred treatments;
2. an ambiguity marker when a governing source leaves an operation unspecified;
3. at least one plausible competing treatment and a discriminating calculation or source check;
4. semantic review that does not reuse the claimant's shadow model as its oracle;
5. dependency-aware blast-radius reporting so one upstream defect cannot be laundered by many green downstream ties.

A second implementation can catch transcription and arithmetic mistakes while preserving the same conceptual error. Independence therefore has to be located at the failure boundary: for this case, the useful oracle is a governing source, domain rule, or reviewer forced to reconstruct the treatment without inheriting the agent's assumption—not another comparison against the same blueprint.

## Evidence limits

- The HN item was extremely early (1 point and one submitter comment when inspected); it is a discovery path, not evidence of community adoption.
- The headline 12.3% best pass rate, the 1,100-rollout failure breakdown, and the repeated-model behavior come from Handshake's article. The linked paper was still marked “coming soon.”
- Scout inspected the public repository's 18-entry tree and README plus public dataset metadata, but did not download the roughly 820 MB environment packs, inspect all task contents, audit the Gandalf agent-as-judge implementation, or rerun a task. The code repository did not expose raw rollout/result bundles in the inspected tree.
- Expert-authored criteria and dependency gates can improve diagnosis without proving the agent-as-judge applies every criterion reliably. Evaluator validity remains separate from benchmark realism.

## Sources

- ATLAS-Finance article and failure analysis: https://joinhandshake.com/research/benchmarks/articles/atlas-finance-evaluating-ai-agents-inside-a-bank/
- Hacker News item 49720319: https://news.ycombinator.com/item?id=49720319
- Public benchmark runner repository: https://github.com/Handshake-AI-Research/ATLAS-Finance
- Public dataset record: https://huggingface.co/datasets/handshake-ai-research/ATLAS-Finance
- Linked grading framework: https://github.com/antoinepangas-hs/gandalf-finance
