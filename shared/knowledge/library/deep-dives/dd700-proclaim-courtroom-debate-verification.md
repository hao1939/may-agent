# DD-700: PROClaim — Courtroom-Style Multi-Agent Debate with Progressive RAG for Claim Verification

**Paper**: Chowdhury et al. (2026). "Courtroom-Style Multi-Agent Debate with Progressive RAG and Role-Switching for Controversial Claim Verification"  
**arXiv**: 2603.28488 (March 2026)  
**Rating**: ★★★★  
**Scout session**: 397 (2026-04-09)  
**Focus**: Structured adversarial deliberation with specialized roles, progressive evidence retrieval, model heterogeneity for bias mitigation

---

## Core Insight

Standard multi-agent debate suffers from two limitations: (1) one-pass retrieval provides a fixed, possibly insufficient evidence base, and (2) unstructured debate dynamics allow persuasion to override evidence. PROClaim reformulates verification as a **courtroom trial** — structured adversarial deliberation with specialized roles, progressive evidence expansion, and heterogeneous judges.

The key finding: **structural deliberation + model heterogeneity** together mitigate systematic biases. Progressive RAG drives the largest gains (+7.5pp), but structural roles add meaningful additional improvement (+2.5pp).

## Architecture

### Role Specialization

PROClaim assigns formal courtroom roles:
- **Plaintiff**: Argues the claim is TRUE — must construct positive evidence chain
- **Defense**: Argues the claim is FALSE — must construct counterevidence
- **Judge(s)**: Heterogeneous multi-judge panel evaluates arguments against evidence

### Progressive RAG (P-RAG)

Unlike standard RAG (one retrieval pass), P-RAG:
1. Initial retrieval provides baseline evidence
2. During debate, agents can REQUEST ADDITIONAL EVIDENCE based on gaps identified in arguments
3. Evidence pool dynamically expands and refines throughout deliberation
4. Each round surfaces new facts that previous rounds missed

### Additional Mechanisms

- **Role-switching**: After initial rounds, Plaintiff and Defense SWITCH SIDES — forced to argue the opposing position. Tests whether arguments survive perspective reversal.
- **Evidence negotiation**: Agents must agree on which evidence items are accepted as factual
- **Self-reflection**: Agents evaluate strength of their own arguments
- **Heterogeneous multi-judge**: Multiple judge models (different LLMs) aggregate verdicts — diversity prevents systematic bias

## Results

- **81.7% accuracy** on Check-COVID benchmark (zero-shot)
- **+10.0pp** over standard multi-agent debate
- **P-RAG drives +7.5pp** — progressive evidence retrieval is the single biggest improvement
- Structural roles add **+2.5pp** beyond P-RAG
- Model heterogeneity further improves calibration

## Connection to Our System

### Validates Adversarial Framing (EXP-103)

PROClaim's courtroom structure is a more elaborate version of our adversarial framing ("find 3 bugs"):
- Our approach: Give verifier an adversarial stance
- PROClaim: Formalize adversarial stance as institutional role (Plaintiff/Defense)
- PROClaim adds: **Role-switching** — our adversarial frames are fixed, not reversed

### Progressive Evidence ≈ Evidence Accumulation

P-RAG's progressive evidence expansion maps to a gap in our verification:
- Our machine evidence injection (EXP-103) is **one-shot**: we inject grep/wc evidence once
- PROClaim suggests **iterative evidence accumulation**: let verification rounds surface new evidence needs
- Each verification round should be able to REQUEST additional machine evidence

### Model Heterogeneity for Bias Mitigation

Multiple different judge models prevent systematic bias. For our system:
- Our verifier is always the same model as the coder (currently)
- Using a different model (or temperature/prompt variation) for verification could break self-confirmation
- Maps to MARCH's (DD#694) information asymmetry — different mechanism, same goal

### Role-Switching as Anti-Confabulation

PROClaim's role-switching (argue the opposite side) is the most interesting mechanism for us:
- After the verifier says "code is correct," force it to argue "code has bugs"
- After the adversarial framer says "here are 3 bugs," force it to argue "these aren't real bugs"
- **Bidirectional adversarial framing** — prevents both false positive and false negative confabulation

## Comparison with AEGIS (DD#698)

| Feature | AEGIS | PROClaim |
|---|---|---|
| Evidence grounding | Closed boundary (fixed before debate) | Progressive expansion (grows during debate) |
| Adversarial mechanism | Single agent argues both sides | Separate agents with role-switching |
| Meta-verification | Independent Audit with veto | Heterogeneous multi-judge |
| Domain | Code vulnerability detection | Claim verification (general) |
| Evidence type | Structural (CPG) | Textual (RAG) |

**Complementary approaches**: AEGIS grounds evidence structurally; PROClaim expands evidence dynamically. Both combat verification confabulation through different structural mechanisms.

## Actionable Recommendations

### HIGH Priority
1. **Implement progressive evidence accumulation**: Let verification rounds request additional machine evidence (not just one-shot injection). When verifier identifies uncertainty, auto-gather relevant files/tests.

### MEDIUM Priority
2. **Role-switching verification**: After initial verification, force the verifier to argue the opposite conclusion. If it can easily argue both sides, the verification is low-confidence.
3. **Model heterogeneity for verification**: Use a different model (or different prompt/temperature) for the verification agent vs the coding agent.

### LOW Priority
4. **Multi-judge aggregation**: Run verification through multiple independent evaluators and aggregate. Cost-intensive but highest-robustness approach.

## Predictions

- **P-700a**: Progressive evidence accumulation (iterative machine evidence) will outperform one-shot injection by ≥10% on complex verification tasks
- **P-700b**: Role-switching (argue opposite conclusion) will identify low-confidence verifications that would otherwise confabulate
- **P-700c**: Model heterogeneity between coder and verifier will reduce verification confabulation independently of framing effects

## Cross-References

- **DD#698** (AEGIS): Complementary — closed vs progressive evidence boundaries
- **DD#694** (MARCH): Both use structural separation to break confirmation bias. MARCH via information asymmetry, PROClaim via role specialization + switching.
- **DD#691** (Failing to Falsify): Role-switching operationalizes falsification obligation
- **DD#692** (Exploiting Confirmation Bias): Multi-judge heterogeneity prevents the framing attack that exploits single-model bias
- **DD#690** (COCO): Heterogeneous cross-validation concept appears in both
- **EXP-103**: Validates adversarial framing; PROClaim extends with progressive evidence and role-switching

## Tags
`verification` `adversarial-debate` `progressive-evidence` `role-switching` `model-heterogeneity` `claim-verification` `bias-mitigation`
