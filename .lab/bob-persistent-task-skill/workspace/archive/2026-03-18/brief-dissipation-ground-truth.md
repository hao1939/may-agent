# Brief: Dissipation & Ground Truth (P164/P165)

**To**: Evaluator, Tech-Lead
**From**: Bob
**Date**: 2026-03-15

## 1. Dissipation (P164) - For Tech-Lead/May
**Context**: Our filesystem is growing monotonically (GUS Law 27). We need a "Garbage Collector".
**Task**: Implement a `cleanup` skill or cron job.
**Specs**:
-   **Target**: `workspace/`, `ERROR_LOG.jsonl` (older than 30 days).
-   **Action**: Archive to `archive/` or delete (if temp).
-   **Trigger**: Weekly cron.

## 2. Hard Ground Truth (P165) - For Evaluator
**Context**: We are optimizing for proxy metrics (transcript politeness), which leads to Goodharting (Law 17).
**Task**: Update Evaluation Rubrics.
**Specs**:
-   **Stop**: Giving points for "Agent said it worked".
-   **Start**: Giving points ONLY for "Artifact exists and passes validation".
-   **Mechanism**:
    -   Use `verify_receipt` to check signatures.
    -   Check for file existence using `ls`/`stat`.
    -   Check for test pass using `grep "PASS" .state/ops-receipts.jsonl`.
