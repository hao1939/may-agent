# Design Brief: GUS Integration — TabAgent (The Deterministic Classifier Law)

**Source**: Scout Discovery (arXiv:2602.16429 - TabAgent)
**Author**: Bob (Architect)
**Date**: 2026-03-16

## 1. The Insight
Production agents use expensive, slow LLM calls for **Closed-Set Decisions** (Routing, Gating, Selection, Verification).
**TabAgent** proves that these generative bottlenecks can be replaced by lightweight **Tabular Classifiers** (trained on execution traces) with **95% latency reduction** and **85-91% cost reduction**, with NO loss in task success.

## 2. The Principle: Hybrid Execution (Extended)
We already have P17 (Hybrid Execution: Code for Certainty). TabAgent extends this: **"Classifiers for Selection."**
If an agent is choosing from a fixed set of options (e.g., "Which tool to use?", "Is this task done?", "Route to A or B?"), an LLM is the wrong tool. A classifier (or a very small model constrained to JSON) is the right tool.

## 3. Proposed GUS Entries

### Law 88: The Generative Bottleneck Law
**"Don't Generate a Choice; Classify It."**
Using a generative model for a discriminative task (Selection, Routing, Verification) is computationally inefficient (100x cost) and reliability-negative (hallucination risk).
- **Evidence**: TabAgent (arXiv:2602.16429) shows 95% latency drop / 90% cost drop by replacing LLM routers with classifiers.
- **Implication**: Identify "Router" and "Verifier" steps in agent loops. Move them off the main LLM. Use `grep`, Regex, or specialized small-model classifiers.

### Mechanism 77: The Discriminative Fast-Path
**"The Fast Path is a Classifier."**
For high-frequency decisions (e.g., "Is this a safety violation?", "Which agent handles this?"), implement a **Discriminative Fast-Path** that bypasses the main agent.
- **Implementation**: The Harness (`manager.ts`) runs the classifier. Only if the classifier is uncertain (low confidence) do we wake the LLM.
- **Result**: "Sleep-by-Default" architecture where the LLM only wakes for *novel* or *ambiguous* situations.

## 4. Recommendations
1. **Audit Routers**: Review `manager.ts` and `may.ts`. Are we using an LLM to route messages that could be routed by regex or a simple classifier?
2. **Hard-Code Verification**: P96 (Execution Over Reading) is a special case of this. We use `tsc` (a classifier) instead of "Is this code correct?" (generation).
3. **Tabularize History**: Start logging "Input -> Router Decision" pairs to potentially train a future classifier (or just find regex patterns).
