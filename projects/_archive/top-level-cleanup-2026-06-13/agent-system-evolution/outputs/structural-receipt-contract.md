# Structural Receipt Harness Contract

Version: 1.0  
Status: Defined  
Owner: agent-system-evolution  
Validation tracker: projects/evaluator-receipt-coverage/project.md

---

## Problem Statement

Successful agent sessions close with `finish({ status: 'success' })` but persist zero verifiable evidence of what was accomplished. Evaluators must rely on finish-language (self-reported claims) rather than structural proof. 20/20 recent successful non-evaluator sessions contained 0 `[SIG:...]` tags in their persisted transcripts.

---

## Minimal Receipt Shape

A **structural receipt** is a JSON object attached to the `finish()` call payload that provides machine-verifiable evidence of session outcomes.

```typescript
interface StructuralReceipt {
  /** Evidence items proving the session outcome */
  verification_evidence: VerificationItem[];
}

interface VerificationItem {
  /** What tool/action produced this evidence */
  source: 'tool_output' | 'db_query' | 'file_read' | 'test_run' | 'bash';
  /** One-line summary of what was verified */
  claim: string;
  /** Reference to the step/tool-call that produced the evidence */
  ref: string;  // e.g. "step:14", "tool_call:abc123"
  /** Optional: hash or snapshot of the relevant output */
  snapshot?: string;
}
```

### Minimum viable receipt

A successful session MUST include at least **one** `VerificationItem` with a non-empty `claim` and `ref`. Sessions with zero items fail the receipt check.

---

## Persistence Surface

Receipts must be persisted in a location accessible to the evaluator after session close.

| Option | Location | Notes |
|--------|----------|-------|
| **A (preferred)** | `finish()` payload field `verification_evidence` | Already partially supported; needs runtime to persist it alongside session record |
| B | Appended to `session.jsonl` as a tagged event | Requires runtime emit |
| C | Separate receipt file in session history dir | Requires runtime write |

**Platform contract**: The runtime MUST persist the `verification_evidence` array from `finish({ status: 'success' })` calls into the canonical session record (DB row or history file) so that post-hoc evaluators can read it without replaying the session.

---

## Evaluator Validation Signal

The evaluator uses receipts as a **calibration input**, not a hard gate:

1. **Receipt present + claims verifiable** → supports `good` rating; no discount.
2. **Receipt present + claims contradicted by context** → flag `INVALID_RECEIPT`; likely `needs_improvement`.
3. **Receipt absent on success session** → apply `MISSING_RECEIPT` discount; success claim treated as unsupported.
4. **Receipt absent on non-success session** → no penalty (receipts only required for success).

Metric: `evaluation.receipt_coverage` — fraction of evaluated success sessions that contain ≥1 receipt item.

---

## Platform Acceptance Criteria

For the platform/runtime team to accept this contract:

- [ ] **AC-1**: `finish()` calls with `status: 'success'` persist `verification_evidence` array into the canonical session store (DB `sessions` table or `session.jsonl`).
- [ ] **AC-2**: Persisted evidence is queryable: `SELECT verification_evidence FROM sessions WHERE id = ?` returns the JSON array (or equivalent file read from history).
- [ ] **AC-3**: Sessions closed with `status: 'success'` and empty/missing `verification_evidence` are tagged with a `missing_receipt` flag in the session record.
- [ ] **AC-4**: No breaking change to existing `finish()` callers — `verification_evidence` is optional; its absence triggers tagging (AC-3) but does not block session close.

---

## Agent-Side Harness Requirements

For agents emitting receipts:

1. Before calling `finish({ status: 'success' })`, collect at least one concrete evidence reference from prior tool outputs in the session.
2. Include that evidence in the `verification_evidence` field of the finish call.
3. Evidence should reference actual tool outputs (file reads, test results, DB queries) rather than restating the task goal.

---

## Rollout Plan

1. **Phase 0 (now)**: Contract defined. Agents already have `verification_evidence` in `finish()` schema — begin populating it in all success finishes.
2. **Phase 1 (platform)**: Runtime persists the field. Evaluator receipt-coverage audits begin showing >0 baseline.
3. **Phase 2 (calibration)**: Evaluator adjusts scoring weight based on receipt presence/quality. Target: 80%+ receipt coverage on success sessions within 2 weeks of Phase 1.

---

## Validation

This contract is validated when:
- `projects/evaluator-receipt-coverage/project.md` periodic audits show receipt coverage rising above 0/5 baseline.
- At least 3 consecutive 5-session audits show ≥3/5 coverage.
- Evaluator scoring demonstrates measurable differentiation between receipted and non-receipted success sessions.
