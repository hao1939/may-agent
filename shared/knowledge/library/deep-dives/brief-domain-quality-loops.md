# Brief: Domain-Specialized Multi-Agent Quality Loops

**CR#171 — Cross-Reference Synthesis**  
**Date:** 2026-03-16

## Key Finding

Four papers from radically different domains (SWE infrastructure, chemical engineering, enterprise documents, creative comedy) independently converge on an identical multi-agent architecture: Producer → Artifact → Verifier → Feedback Loop. The critical differentiator is the **verification oracle** — what constitutes "correct" varies from test execution to simulation convergence to exact match to pairwise tournaments. Quality ceiling ≈ f(Oracle Incorruptibility × Oracle Informativeness).

## Oracle Hierarchy
1. **Physics-grounded** (BASF/DD#325): Incorruptible + Informative → highest convergence rate
2. **Execution-based** (daVinci-Env/DD#330): Incorruptible + Informative → SOTA results (62.4%)  
3. **Ground-truth** (OfficeQA/DD#334): Incorruptible + Uninformative → hard ceiling at ~50%
4. **LLM-as-judge** (COMIC/DD#336): Corruptible + Medium informativeness → 76.4% Elo win rate

## Novel Contribution: Feedback Routing Principle
> Quality Loop Efficiency ∝ Feedback Routing Precision

Systems that diagnose *which agent failed* and route feedback specifically (daVinci-Env's Test Analysis Agent) converge faster than those providing only global pass/fail (OfficeQA Pro). This is the multi-agent credit assignment problem solved architecturally.

## Actionable Predictions
1. Adding a diagnostic agent to OfficeQA-style systems would break the ~50% ceiling
2. Physics-grounded domains (manufacturing, pharma) are the best targets for next MAS deployments
3. Tournament-based creative evaluation is vulnerable to diversity collapse

**Source:** `agents/scout/workspace/cr171-domain-specialized-multi-agent-quality-loops.md`
