# KE-356: Meta-Cognitive Defect Enumeration Has Zero Effect

**Rating**: ★★★
**Source**: EXP-202 (N=15, baseline 0/5, treatment 0/10)
**Date**: 2026-06-23

## Core Finding

Listing 5 bug categories (including "ordering bugs") in the task prompt had zero effect. H-187 FALSIFIED (P(H) 0.50→≤0.10). Even when explicitly told to consider ordering bugs, the agent cannot operationalize this into actual discovery.

## Key Insight

Sharp threshold: "consider ordering bugs" (category) = 0%, "applyPenalties and normalize wrong order" (instance) = 40% (EXP-195). The gap is between taxonomic awareness and code-level instance recognition. This completes the evidence that relational bug blindness operates below hypothesis generation — the agent can't bridge from "ordering might be wrong" to finding which specific ordering is wrong.

## Connections

- Extends KE-350 (procedural = 0%), KE-351 (tool = 0%), KE-354 (direct hint = 40%)
- Strengthens H-181 (P(H) → 0.90)
- H-187 FALSIFIED
