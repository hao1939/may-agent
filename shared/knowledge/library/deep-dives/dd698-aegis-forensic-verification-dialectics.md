# DD-698: AEGIS — Forensic Verification via Dialectics and Meta-Auditing

**Paper**: Fang et al. (2026). "AEGIS: From Clues to Verdicts — Graph-Guided Deep Vulnerability Reasoning via Dialectics and Meta-Auditing"  
**arXiv**: 2603.20637 (March 2026)  
**Rating**: ★★★★★  
**Scout session**: 397 (2026-04-09)  
**Focus**: Adversarial verification architecture with closed evidence boundaries and independent audit veto

---

## Core Insight

AEGIS identifies the root cause of verification failure in multi-agent debate systems: **reasoning in an ungrounded deliberative space** — agents argue persuasively but without bounded, hypothesis-specific evidence. This produces "rhetorical persuasiveness rather than verifiable facts." The solution: shift from open-ended debate to **forensic verification over a closed factual substrate**.

This is the most directly relevant external paper to our EXP-103 findings (adversarial framing + machine evidence eliminates verification confabulation).

## Architecture

### Three-Phase Pipeline: "From Clue to Verdict"

1. **Clue Identification**: Identify suspicious anomalies (not assertions — empirical signals)
2. **Evidence Boundary Construction**: For each clue, dynamically reconstruct per-variable dependency chains via on-demand slicing over a repository-level Code Property Graph (CPG). This creates a **closed evidence boundary** — the set of facts available for reasoning is fixed and verifiable.
3. **Dialectical Verification + Meta-Auditing**:
   - **Verifier Agent**: Constructs competing arguments FOR and AGAINST exploitability within the closed evidence boundary
   - **Audit Agent**: Independent meta-auditor that scrutinizes EVERY claim against the trace evidence. Has **veto power** to prevent hallucinated verdicts.

### Key Design Principles

- **Closed factual substrate**: The evidence boundary is constructed BEFORE reasoning, not during. Agents cannot introduce new "facts" during deliberation.
- **Dialectical obligation**: The Verifier must argue BOTH sides — forced adversarial framing at the individual level, not just agent-level opposition.
- **Independent audit with veto**: The Audit Agent is structurally separate and has absolute authority to reject claims not grounded in evidence.
- **Graph-guided evidence**: Using CPG (Code Property Graph) ensures evidence is structural/topological, not narrative.

## Results

- **New state-of-the-art on PrimeVul**: 122 Pair-wise Correct Predictions (first to surpass 100)
- **54.40% FP reduction** vs leading baselines
- **$0.09/sample** — economically viable without task-specific training
- Zero-shot — no fine-tuning needed

## Connection to Our System

### Direct Validation of EXP-103

AEGIS independently arrives at the SAME two mechanisms that eliminated verification confabulation in EXP-103:

| AEGIS Mechanism | Our EXP-103 Finding | Principle |
|---|---|---|
| Closed evidence boundary (CPG) | Machine-verified evidence injection (grep/wc output) | Ground deliberation in verifiable artifacts |
| Dialectical obligation (argue both sides) | Adversarial framing ("find 3 bugs") | Force falsification before confirmation |
| Independent Audit with veto | (Not yet implemented) | Meta-verification layer |

**The Audit Agent with veto power is the mechanism we're missing.** Our current system has adversarial framing + machine evidence but no independent meta-auditor that can structurally reject ungrounded claims.

### Maps to Verification Architecture (CR#321)

AEGIS fills the gap identified in CR#321 — verification orchestration across tiers:
- **Process verification** (DD#688): AEGIS uses structured reasoning evaluation
- **Workflow verification** (DD#689 Sherlock): AEGIS's clue→evidence→verdict pipeline is a workflow
- **System verification** (DD#690 COCO): The Audit Agent operates as continuous oversight
- **Trust layer** (DD#694 MARCH): Information asymmetry between Verifier and Audit Agent

### Connects to Bob's Laws (KE-101)
- **Law 2 (structural interventions)**: Closed evidence boundary is structural, not instructional
- **Law 3 (attention zero-sum)**: Evidence boundary CONSTRAINS attention — prevents diffuse reasoning
- **Frontier 1 (verification without confabulation)**: AEGIS is the most complete external solution

## Actionable Recommendations

### HIGH Priority
1. **Add independent audit/veto to our verification pipeline**: An agent that reviews verification claims against structural evidence (file contents, test outputs) with authority to reject
2. **Pre-construct evidence boundaries**: Before asking an agent to verify, assemble the closed factual substrate (relevant file contents, test results, grep outputs) so reasoning is grounded

### MEDIUM Priority  
3. **Force dialectical obligation**: Require verifiers to argue BOTH for and against correctness, not just evaluate
4. **Structural evidence over narrative**: Prioritize machine-readable artifacts (ASTs, dependency graphs) over natural language descriptions

### LOW Priority
5. **Cost analysis**: AEGIS achieves SOTA at $0.09/sample without training — our verification interventions should target similar economics

## Key Quote

> "The resulting conclusions are driven by rhetorical persuasiveness rather than verifiable facts."

This is the single most important sentence for understanding why verification confabulation occurs — and why structural grounding (not better prompting) is the solution.

## Predictions

- **P-698a**: Adding an independent audit agent with veto power to our verification pipeline will reduce verification confabulation by ≥50% compared to adversarial framing alone
- **P-698b**: Pre-constructing evidence boundaries (assembling relevant file contents before verification) will be more effective than letting the verifier gather its own evidence
- **P-698c**: Forcing dialectical obligation (argue both sides) will be more effective than simple adversarial framing ("find bugs")

## Cross-References

- **DD#694** (MARCH): Both use information asymmetry to break self-confirmation. AEGIS adds closed evidence boundary and meta-auditing.
- **DD#691** (Failing to Falsify): AEGIS operationalizes falsification obligation via dialectics
- **DD#692** (Exploiting Confirmation Bias): AEGIS's closed evidence boundary prevents the metadata framing attack
- **DD#688** (Process Verification): AEGIS's clue→verdict pipeline is process-level verification with structural grounding
- **DD#689** (Sherlock): Both constrain verification scope — Sherlock via counterfactual analysis, AEGIS via evidence boundaries
- **CR#321** (Verification Architecture Triad): AEGIS fills the cross-tier orchestration gap
- **EXP-103**: Direct external validation. AEGIS provides the theoretical framework for why adversarial framing + machine evidence works.

## Tags
`verification` `adversarial-architecture` `information-asymmetry` `meta-auditing` `forensic-verification` `code-analysis` `confabulation-prevention`
