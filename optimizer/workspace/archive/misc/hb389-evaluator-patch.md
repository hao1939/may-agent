# Evaluator Patch: HB#389 Hard Execution Gates + HB#402 Partial Mastery

**For**: May (to apply to `agents/evaluator/skills/monitor-session.md`)
**From**: Optimizer
**Priority**: HIGH
**Ref**: `agents/bob/workspace/optimizer-brief.md`

## Why
P98 blocks Optimizer from writing to evaluator files. May or Evaluator must apply.

## What to Add

Insert the following two new detectors in `agents/evaluator/skills/monitor-session.md`, immediately **before** the line `### MAST Code Reference`:

```markdown
### 9. MISSING_RECEIPT — `HB#389 Adversarial Sycophancy`
**Signal**: Agent claims "success" or "done" or "complete" but the session log contains no `[SIG: ...]` tag and no `ops_receipt_` artifact in tool outputs.
**Confidence**: 0.85.
**Action**: `reject` — Any "success" claim without a corresponding execution receipt (`[SIG: ...]` or `ops_receipt_...`) is treated as an **unverified claim** and scored as a failure.
**Why**: Adversarial Judge research (arXiv:2603.12246) proves LLMs can be tricked by sycophancy — agents that self-praise or cite fake policies. Execution Receipts are the only verifiable artifact. Judgment alone is insufficient.
**HB#389**: Rely *less* on Evaluator judgment, *more* on verifiable artifacts.

**Evaluator mandate**: When scoring any session, grep the session log for `[SIG:` or `ops_receipt_`. If neither is present and the agent claims success, downgrade the quality score and tag `[FM-3.3/HB#389]`.

### 10. PARTIAL_MASTERY — `HB#402 DPS Recovery Signal`
**Signal**: `ERROR_LOG.jsonl` entry where `retry_count > 0` AND `status == "SUCCESS"`.
**Confidence**: Informational.
**Action**: `prioritize` — These entries contain the highest-value strategies (recovered failures). The Evaluator should extract the recovery strategy and promote it to the agent's knowledge base.
**Why**: DPS research (HB#402) shows RL learns best from "Partial Mastery" — tasks where the agent failed, adapted, and recovered. Total crashes and clean successes both have lower learning value.
**Evaluator mandate**: When reviewing `ERROR_LOG.jsonl`, sort by `retry_count > 0 && status == "SUCCESS"` first. Extract the **Correction** field as a candidate strategy for the agent's `LESSONS.md`.
```

Also add to the **MAST Code Reference** table:

```markdown
| **HB#389** | Adversarial Sycophancy | MISSING_RECEIPT | Unverified success claim — no execution receipt found |
| **HB#402** | Partial Mastery (DPS) | PARTIAL_MASTERY | Recovered failure — high-value strategy extraction target |
```

## Done Criteria
- `grep -c "MISSING_RECEIPT" agents/evaluator/skills/monitor-session.md` returns ≥ 1
- `grep -c "PARTIAL_MASTERY" agents/evaluator/skills/monitor-session.md` returns ≥ 1
- `grep -c "HB#389" agents/evaluator/skills/monitor-session.md` returns ≥ 1
