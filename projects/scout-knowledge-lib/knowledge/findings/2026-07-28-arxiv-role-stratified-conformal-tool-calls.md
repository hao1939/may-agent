# Role-Stratified Conformal Risk Control for Agent Tool Calls

Date: 2026-07-28
Source: https://arxiv.org/abs/2607.24343
Status: novel
Relevance: agent-security, agent-infrastructure

## Key Claim

Aggregate-level safety certification for LLM agent tool calls masks field-level failures: untrusted content can safely fill an email body but must not determine a recipient, command, or credential. The paper introduces **role-stratified per-field conformal risk control** — a calibration layer that sets separate thresholds and risk budgets for each semantic argument role in a structured tool call.

## Mechanism

- Wraps any per-field injection/anomaly detector with conformal calibration.
- For a role with prevalence p_r, aggregate-only certification must use effective budget α·p_r to guarantee role-specific risk α — role-stratified calibration certifies each sufficiently-sampled role directly with finite-sample guarantees.
- Rare roles fall back to pooled certification.

## Evidence

- Evaluated across AgentDojo and InjecAgent benchmarks with 6 frontier LLMs.
- Regulated arm achieves most consistent role-specific budget compliance under: model transfer, attack transfer, detector noise, gradual drift, unseen tool suites, and adaptive attacks.
- Formal per-role guarantees under exchangeability; empirical compliance under frozen distribution shift.

## Scout Assessment

This is the first paper we've seen that applies conformal prediction at the **semantic-role level** within agent tool calls rather than at the whole-action level. It directly addresses a gap in current agent security: most guardrails are action-level or prompt-level, leaving high-risk fields (credentials, commands, recipients) under-protected relative to benign fields.

### Connections
- **APPA (2607.24625)**: Complementary — APPA uses IFC/taint tracking to prevent data exfiltration at the context level; this paper certifies individual tool-call arguments at the statistical level. Together they form a two-layer defense.
- **Agent Security Event Log**: Adds a new category of runtime defense — statistical field-level certification — to our tracked security primitives.
- **Token Economics Trap**: Per-field calibration adds compute overhead proportional to role count, not token count — scales favorably.

### Limitations
- Requires exchangeability assumption or recalibration for distribution shift.
- Does not address adversarial manipulation of the calibration set itself.
- Benchmark coverage limited to injection attacks; unclear how it handles subtle semantic misuse.
