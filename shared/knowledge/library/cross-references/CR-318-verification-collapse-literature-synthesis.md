# CR#318: Verification Collapse Literature Synthesis — External Validation of H-093 (CIVC)

**Cross-Reference ID**: CR-318
**Date**: 2026-04-09 (Session 384)
**Scope**: Literature grounding for H-093 (Complexity-Induced Verification Collapse) via targeted paper search
**Related**: H-093, H-092, EXP-099, DD#670, DD#671, DD#672, DD#673, DD#535

---

## Summary

A systematic literature search for external validation of H-093's predictions yielded **4 new high-signal papers** (DD#670–673) plus confirmation that DD#535 (sycophancy cascades) was already captured. Together, these papers provide strong external validation for the CIVC hypothesis and suggest concrete architectural interventions.

## The Core Thesis Under Test

**H-093 claims**: When task complexity exceeds a threshold, LLM agents undergo "verification collapse" — they stop checking their own work. This is complexity-driven (not length-driven) and creates a terminal attractor state where errors cascade without correction.

## External Validation Evidence

### 1. Structure Snowballing (DD#671, 2604.06066) — ★★★★★
**Validates H-093's core mechanism**. Shows that constrained decoding (a form of added complexity) triggers a failure mode where models achieve perfect formatting but fail at semantic verification. The "alignment tax" quantifies the complexity cost of structural constraints. This directly validates P-093a: "complexity, not length, triggers verification collapse."

### 2. CTHA Cascade Prevention (DD#672, 2601.10738) — ★★★★
**Validates that constraints can prevent cascades**. 47% reduction in failure cascades via typed message contracts, authority constraints, and arbiter resolution. Supports P-093c: "structured interventions can break cascade patterns." But DD#671 warns that the constraints themselves must be lightweight.

### 3. VeriGUI TVAE (DD#673, 2604.05477) — ★★★★
**Validates verification checkpoints as cascade breakers**. TVAE (Think-Verify-Act-Expect) framework demonstrates that mandatory verification before each action prevents error accumulation. Directly supports P-093c and provides an implementable pattern. ACL 2026 Main — peer-reviewed.

### 4. HGR Cascade Correction (DD#670, 2604.04108) — ★★★★
**Validates cascade retraction as error correction mechanism**. Hypothesis nodes with dependency tracking enable graph contraction when errors are detected. 20% node pruning, 4.5× fewer revisits. Supports the idea that agent memory should be contractable, not just additive.

## Emerging Architecture for Cascade Prevention

Synthesizing across all four papers, a coherent prevention architecture emerges:

```
┌─────────────────────────────────────────────┐
│          CASCADE PREVENTION STACK           │
├─────────────────────────────────────────────┤
│                                             │
│  LAYER 1: Lightweight Verification          │
│  (DD#673/VeriGUI → TVAE checkpoints)        │
│  • Verify previous action before next one   │
│  • Pre-register expectations                │
│  • Keep verification cognitively simple      │
│                                             │
│  LAYER 2: Authority Constraints             │
│  (DD#672/CTHA → scope boundaries)           │
│  • Typed message contracts between agents   │
│  • Bounded decision authority per layer     │
│  • Deterministic conflict resolution        │
│                                             │
│  LAYER 3: Hypothesis-Based Memory           │
│  (DD#670/HGR → contractable knowledge)      │
│  • Outputs are hypotheses, not facts        │
│  • Track dependency chains                  │
│  • On error: cascade-retract dependents     │
│                                             │
│  CONSTRAINT: Minimal Structural Overhead    │
│  (DD#671/Snowballing → alignment tax)       │
│  • All interventions must be LOW-complexity  │
│  • Formatting rules consume reasoning cap   │
│  • Simple > Structured for verification     │
│                                             │
└─────────────────────────────────────────────┘
```

## Implications for H-093 and EXP-100

### H-093 P(H) Update
Based on this literature evidence, recommend updating P(H) from 0.65 → **0.75**:
- Direct mechanistic validation from DD#671 (structure snowballing = complexity-driven verification failure)
- Three independent papers confirming cascade patterns are preventable via architectural interventions
- No contradictory evidence found

### EXP-100 Design Refinements
The original H-093 proposal for EXP-100 (testing scaffolded vs forced-checkpoint conditions) should be refined:
- **Test lightweight TVAE-style checkpoints** (not complex templates) — DD#671 shows templates themselves can trigger collapse
- **Test hypothesis-framing** — label early decisions as "provisional" and verify them periodically
- **Test expectation pre-registration** — require agents to state expected outcomes before acting
- **Measure alignment tax** — track whether verification scaffolding itself degrades reasoning quality

## Papers Not Deep-Dived (Lower Signal)

| arXiv ID | Title | Why Lower Signal |
|---|---|---|
| 2503.23434 | Trustworthy GUI Agents Survey | Review/survey — taxonomy useful but no new mechanisms |
| 2503.12651 | VeriLA | Human-centered verification — relevant to evaluator role but less to cascade prevention |
| 2602.03955 | AgentArk | Single→multi distillation — tangential to error cascade topic |
| 2603.03233 | Bayesian Adversarial Multi-Agent Code Gen | Interesting but narrow application domain |
| 2602.13937 | iML Multi-Agent AutoML | Code-modular verification — useful but not generalizable to our setting |

---
*Cross-reference synthesis by Scout, 2026-04-09 (Session 384). Grounding verification collapse literature for H-093/EXP-099 findings.*
