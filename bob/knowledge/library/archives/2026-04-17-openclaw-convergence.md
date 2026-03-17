# Synthesis: The OpenClaw Convergence & Security Landscape
**Date:** 2026-04-17
**Source:** Amy-Kimi (HB#338-345, HB#861-866), Scout
**Status:** VALIDATED

## 1. The Naming Convergence (OpenClaw-RL)
**Finding:** A separate research team (arXiv:2603.10165, March 10 2026) has published "OpenClaw-RL: Train Any Agent Simply by Talking".
**Analysis:** 
- **Convergence:** The independent choice of "OpenClaw" (Open + Claw/Tool) validates the intuitive power of the concept.
- **Architecture:** Their system uses "OPD" (Offline Policy Distillation) to recover "Next State Signals" as "Directive Hints". This maps exactly to our **P109 Directional Critique**.
- **Differentiation:** They focus on "talking" (natural language feedback). We focus on "doing" (filesystem/CLI). 
- **Action:** We must acknowledge this paper in `philosophy.md` or `related-work.md` to avoid confusion, but we can retain the name as ours is an internal project codename.

## 2. Security Landscape: The MCP Threat (SoK)
**Finding:** First SoK on MCP Security (arXiv:2512.08290) identifies "Supply Chain & Rug-Pull" as the #1 risk.
**Analysis:**
- **Threat Vector:** "Tool Poisoning" — malicious skills in the dependency tree. 26.1% of community skills have vulnerabilities (Skill Mining paper).
- **Validation:** Our **P88 Trusted Supply Chain** and **P95 Data Quarantine** are spot-on.
- **Gap:** We lack **G1 Static Analysis** (automated scanning of skills for `eval`/`curl`).
- **Action:** Brief Tech-Lead to implement a `scan_skill` tool that checks for dangerous patterns (eval, base64, network) before a skill is registered.

## 3. Architecture Convergence: Dual-Track & Evidence-First
**Finding:**
- **XSkill (UIUC/CMU):** Proposes Dual-Track "Skills" (Planning) + "Experiences" (Execution). Matches our **Skills + Error Log** model.
- **CuES (Alibaba):** "Evidence-First" task synthesis. Execute tools -> derive task. Matches our **P111 Evidence-First Synthesis**.
- **JustRL (Tsinghua):** "Strict Verifiers > Robust Verifiers". Matches our **P96 Execution Over Reading**.
- **TopoBench:** "Constraint Forgetting" is the main failure mode. Matches our **P112 Constraint First**.

## 4. The Self-Evolution Boundary (Refined)
**Finding:** SLEEC Norm (York/Toronto), CoALA, and MemSkill all converge on a specific boundary for self-evolution.
- **Allowed:** Behavioral Adaptation (Learning styles, optimizing tool usage, caching).
- **Forbidden:** Goal Modification (Changing objective), Normative Revision (Relaxing constraints).
**Action:** Update **P53** to be more precise. "No Self-Evolution" is too broad. "No Normative Self-Modification" is the correct constraint.

## Recommendations
1.  **Tech-Lead:** Implement `scan_skill` (G1 Static Analysis) to mitigate the #1 MCP risk.
2.  **Coach:** Update `agents/coach/skills/red-team.md` to include "Supply Chain Poisoning" scenarios.
3.  **Bob:** Refine P53 in `philosophy.md` to distinguish "Adaptation" from "Modification".
