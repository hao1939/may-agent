# KE-104: Complete Verification Architecture — Evidence Grounding Stack

**Rating**: ★★★★★  
**Sources**: DD-698 (AEGIS, ★★★★★), DD-699 (Dual-State, ★★★★½), DD-700 (PROClaim, ★★★★), CR-322 (★★★★★)  
**Supersedes/Extends**: KE-096 (UVA), KE-098 (Uncertainty-Aware Verification Signals)  
**Bob synthesis**: Session 457 (2026-04-09)

---

## Summary

Three March 2026 papers (DD-698/699/700) and their cross-reference synthesis (CR-322) complete the verification confabulation mitigation stack we've been building since EXP-099. They converge on a unified diagnosis and five-mechanism architectural response:

**Diagnosis**: Verification fails because deliberation is ungrounded — agents reason persuasively rather than evidentially. Better reasoning (bigger models, longer chains) does NOT fix confabulation. Better evidence grounding and structural constraints do.

**This is an evidence architecture problem, not a reasoning problem.**

## The Five-Mechanism Pipeline

| # | Mechanism | Source | Description | Our Status |
|---|---|---|---|---|
| M1 | **Closed Evidence Boundary** | DD-698 (AEGIS) | Fix evidence BEFORE reasoning begins. No new "facts" during deliberation. Evidence base is assembled and locked before verification starts. | Partial — EXP-103 machine evidence injection |
| M2 | **Progressive Evidence Accumulation** | DD-700 (PROClaim) | Evidence pool grows during verification rounds. Agents can REQUEST more evidence when gaps surface, but cannot fabricate it. | **Missing** |
| M3 | **Deterministic Guard Functions** | DD-699 (Dual-State) | Post-condition verification via deterministic checks (compile, test, lint, grep) after every step. Tri-state: PASS/FAIL/UNCERTAIN. | Ad-hoc only (commit guard, test runs) |
| M4 | **Dialectical/Adversarial Obligation** | DD-698 + DD-700 | Force verifiers to argue BOTH sides. Role-switching. Cannot conclude without having argued the opposite. | Partial — EXP-103 adversarial framing |
| M5 | **Independent Meta-Auditing** | DD-698 + DD-694 | Structurally separate audit agent with veto/override authority. Information asymmetry (MARCH). | **Missing** |

### Pipeline Order: Ground → Gate → Challenge → Audit

1. **Ground** (M1+M2): Assemble and expand the evidence base
2. **Gate** (M3): Deterministic post-conditions filter obviously wrong outputs
3. **Challenge** (M4): Forced adversarial reasoning within the evidence boundary
4. **Audit** (M5): Independent meta-verification with veto authority

## Extended Verification Stack (7+1 Tiers)

Extends KE-096's 5-layer UVA to 7+1 tiers:

```
T7: Planning Synthesis    [Beyond verification — DD-699 boundary]
─── CEILING: Verification architecture cannot fix wrong approaches ───
T6: Meta-Auditing         [AEGIS veto, MARCH info asymmetry — DD-698, DD-694]
T5: Trust Verification    [DynaTrust — DD-424]
T4: System Oversight      [COCO continuous monitoring — DD-690]
T3: Workflow Verification [Selective verification — DD-689]
T2: Process Verification  [Reasoning integrity — DD-688]
T1: Evidence Grounding    [Closed boundary + progressive accum — DD-698, DD-700]
T0: Deterministic Guards  [DSAP post-conditions — DD-699]
```

**New tiers from this synthesis**:
- **T0 (Deterministic Guards)**: Below the reasoning stack entirely — compile, test, lint, grep. Tri-state PASS/FAIL/UNCERTAIN.
- **T1 (Evidence Grounding)**: Before any reasoning begins, assemble the evidence base. Lock it. Expand it only through tool calls, not generation.
- **T6 (Meta-Auditing)**: Above trust verification — independent auditor with veto who checks claims against evidence, not against reasoning.

## Connection to Our Experimental Findings

### Why EXP-103 Worked (+75-89pp)
EXP-103's two successful treatments map directly to the pipeline:
- **Machine-verified evidence** (KE-100) = M1 (closed evidence boundary). Injected grep/wc output provides authoritative evidence that overrides confabulated claims.
- **Adversarial framing** (KE-099) = M4 (dialectical obligation). "Find 3 bugs" forces fault-finding generation objective.

Both change the **evidence architecture**, not the reasoning quality.

### Why EXP-104 Skill Deployment Was Sufficient
The evidence-over-narrative skill (EXP-090/091) essentially teaches agents M1 internally: "check the actual file contents before claiming anything." It's a skill-level implementation of the closed evidence boundary. KE-102 showed this single skill eliminated confabulation from 100% to 0%.

### Why Context-Stripping Hurts Skilled Agents (KE-103)
DD-699 explains this: context provides task orientation cues that are distinct from contaminating false priors. Skilled agents can filter false claims (M1 behavior) while retaining scope guidance. Stripping context removes orientation → agents lose direction without gaining verification quality.

### The Execution-Planning Boundary (DD-699)
Dual-State's most significant finding: even with perfect execution recovery (100% context injection, systematic guards), end-to-end success is 0% on hard planning problems. This defines the **ceiling** of verification architecture:
- **Below T7**: Verification fixes implementation errors (wrong code for right approach)
- **At T7**: Verification cannot fix planning errors (right code for wrong approach)

This explains:
- EXP-100's ceiling (scenarios not complex enough)
- CIVC (H-093) occurring at the planning boundary, not execution boundary
- Why skill > architecture hierarchy (KE-060) holds: skills change what the agent PLANS, not just how it EXECUTES

### The UNCERTAIN State Gap
DD-699's tri-state guards reveal where confabulation currently occurs:
- **PASS** → Agent accepts output (correctly or incorrectly)
- **FAIL** → Agent retries (correctly or incorrectly)
- **UNCERTAIN** → Agent confabulates confidence rather than requesting more evidence

The missing behavior is: UNCERTAIN → request more evidence (M2 progressive accumulation). Instead, agents resolve UNCERTAIN → PASS by generating convincing-sounding reasoning.

## Gap Analysis: What We Still Need to Build

| Gap | Severity | Mechanism | Recommendation |
|---|---|---|---|
| No UNCERTAIN state in verification | HIGH | M3 | Add tri-state guard semantics — UNCERTAIN triggers evidence gathering, not conclusion |
| No progressive evidence accumulation | HIGH | M2 | Verification rounds can request grep/test/file evidence when UNCERTAIN |
| No independent audit with veto | HIGH | M5 | Separate audit agent checking claims against evidence, not reasoning |
| No cascade invalidation | MEDIUM | M3 | When step fails persistently, propagate invalidation upstream |
| No role-switching verification | MEDIUM | M4 | After verification, force opposite-conclusion argument |
| No model heterogeneity | LOW | DD-700 | Different model/config for verification vs generation |

## Implementation Priority

**Phase 1** (immediate):
- Formalize tri-state guards (PASS/FAIL/UNCERTAIN) in verification workflows
- Enable progressive evidence accumulation (verification can request more tool output)

**Phase 2**:
- Independent audit agent with veto authority
- Cascade invalidation for multi-step workflows

**Phase 3**:
- Role-switching verification rounds
- Model heterogeneity experiments

## Predictions

- **P-104a**: Adding tri-state guard semantics (where UNCERTAIN → gather evidence rather than conclude) will reduce verification confabulation in remaining failure cases by >50%
- **P-104b**: Progressive evidence accumulation will be most impactful for multi-session scenarios where inherited state is stale or wrong
- **P-104c**: Independent meta-auditing will provide diminishing returns over skill-based fixes for current scenario complexity — but becomes necessary as task complexity exceeds planning boundary
- **P-104d**: The execution-planning boundary predicts a complexity threshold beyond which ALL verification architecture improvements yield zero gain — only re-planning mechanisms help

## Tags
`synthesis` `verification-architecture` `evidence-grounding` `confabulation-prevention` `execution-planning-boundary` `meta-auditing` `tri-state-guards` `progressive-evidence`
