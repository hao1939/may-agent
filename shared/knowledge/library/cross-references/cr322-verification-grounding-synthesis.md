# CR-322: Verification Grounding Synthesis — From Confabulation to Forensic Verification

**Session**: 397 (2026-04-09)  
**Papers synthesized**: DD#698 (AEGIS), DD#699 (Dual-State), DD#700 (PROClaim), DD#694 (MARCH), DD#691-693  
**Rating**: ★★★★★ — Completes the verification confabulation mitigation stack

---

## Synthesis

Three independent March 2026 papers converge on a unified diagnosis and architectural response to verification confabulation:

### The Diagnosis (Convergent Across All Three)

**Verification fails because deliberation is ungrounded.** Agents reason persuasively rather than evidentially.

| Paper | Diagnosis Framing |
|---|---|
| AEGIS | "Reasoning in an ungrounded deliberative space" — rhetorical persuasiveness over verifiable facts |
| Dual-State | Stochastic generation without deterministic post-condition verification — no observable state projection |
| PROClaim | One-pass retrieval + unstructured debate → persuasion overrides evidence |

**Unified principle**: Verification quality is determined by the **evidence grounding architecture**, not by the reasoning quality of the verifier.

### The Solution Stack (5 Mechanisms)

The three papers collectively propose five complementary mechanisms:

| # | Mechanism | Paper | Description | Our Status |
|---|---|---|---|---|
| M1 | **Closed Evidence Boundary** | AEGIS | Fix evidence BEFORE reasoning. No new "facts" during deliberation. | Partial (EXP-103 machine evidence) |
| M2 | **Progressive Evidence Accumulation** | PROClaim | Evidence pool grows during verification rounds. Agents request more evidence as gaps surface. | **Missing** |
| M3 | **Deterministic Guard Functions** | Dual-State | Post-condition verification via deterministic checks (compile, test, lint) after every step. | Ad-hoc only |
| M4 | **Dialectical/Adversarial Obligation** | AEGIS + PROClaim | Force verifiers to argue BOTH sides. Role-switching. | Partial (adversarial framing) |
| M5 | **Independent Meta-Auditing** | AEGIS + PROClaim + MARCH | Structurally separate audit agent with veto/override authority. Information asymmetry. | **Missing** |

### Ordering: Evidence → Guards → Dialectics → Meta-Audit

The mechanisms form a natural pipeline:
1. **Ground** (M1+M2): Assemble and expand the evidence base
2. **Gate** (M3): Deterministic post-conditions filter obviously wrong outputs
3. **Challenge** (M4): Forced adversarial reasoning within the evidence boundary
4. **Audit** (M5): Independent meta-verification with veto authority

This is the **complete verification architecture** — everything we've been building toward across DD#688-700 and EXP-099 through EXP-103.

### The Execution-Planning Boundary (DD#699)

Dual-State Architecture reveals a crucial limit: even perfect execution recovery (100% context injection, systematic guards) yields 0% end-to-end success on hard problems. The boundary is between:
- **Execution failures**: Wrong code for right approach → recoverable with guards + retries
- **Planning failures**: Right code for wrong approach → requires re-planning, not re-execution

This explains our EXP-100 ceiling (scenarios too easy) and predicts that CIVC occurs at the planning boundary, not the execution boundary.

### The Tri-State Extension

Binary verification (pass/fail) is insufficient. Dual-State's tri-state guards (PASS/FAIL/UNCERTAIN) map to:
- **PASS** → Accept output
- **FAIL** → Retry with different approach
- **UNCERTAIN** → Seek more evidence (trigger M2 progressive accumulation)

UNCERTAIN is where confabulation currently occurs — agents resolve uncertainty by confabulating confidence rather than requesting more evidence.

## Gap Analysis: What We Still Need

| Gap | Severity | Source | Recommendation |
|---|---|---|---|
| No UNCERTAIN state in verification | HIGH | DD#699 | Add tri-state guard semantics |
| No progressive evidence accumulation | HIGH | DD#700 | Enable verification rounds to request additional machine evidence |
| No independent audit with veto | HIGH | DD#698 | Add meta-auditor agent that checks claims against evidence |
| No cascade invalidation | MEDIUM | DD#699 | When step fails persistently, propagate invalidation upstream |
| No role-switching verification | MEDIUM | DD#700 | After verification, force opposite-conclusion argument |
| No model heterogeneity | LOW | DD#700 | Different model/config for verification vs generation |

## Implementation Priority

**Phase 1 (Sprint S13?)**: 
- Tri-state guards (PASS/FAIL/UNCERTAIN)
- Progressive evidence accumulation (verification can request more grep/test/file evidence)

**Phase 2**:
- Independent audit agent with veto
- Cascade invalidation for multi-step workflows

**Phase 3**:
- Role-switching verification rounds
- Model heterogeneity experiments

## Connection to Existing Knowledge

This synthesis extends CR#321 (Verification Architecture Triad) by adding:
- The evidence grounding layer (M1+M2) below process verification
- The meta-auditing layer (M5) above trust verification
- The execution-planning boundary that defines where verification architecture stops being sufficient

Updated verification stack (7 tiers):
```
T7: Planning Synthesis    [Beyond verification — DD#699 boundary]
T6: Meta-Auditing         [AEGIS veto, MARCH info asymmetry — DD#698, DD#694]  
T5: Trust Verification    [DynaTrust — DD#424]
T4: System Oversight      [COCO continuous monitoring — DD#690]
T3: Workflow Verification [Sherlock selective — DD#689]  
T2: Process Verification  [RIS reasoning integrity — DD#688]
T1: Evidence Grounding    [Closed boundary + progressive accum — DD#698, DD#700]
T0: Deterministic Guards  [DSAP post-conditions — DD#699]
```

## Key Insight

**The fundamental error in verification system design is treating it as a reasoning problem.** It is an evidence architecture problem. Better reasoning (bigger models, longer chains) does NOT fix confabulation — better evidence grounding and structural constraints do. This is why EXP-103's machine evidence worked: it changed the architecture, not the reasoning.

## Tags
`synthesis` `verification-architecture` `evidence-grounding` `confabulation-prevention` `execution-planning-boundary` `meta-auditing`
