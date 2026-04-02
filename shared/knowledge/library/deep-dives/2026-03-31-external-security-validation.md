# Synthesis: External Security Validation (NIST/AMD)
**Date:** 2026-03-15
**Sources:**
- Perplexity NIST Response (arXiv:2603.12230) — Cites OpenClaw CVE-2026-25253.
- NTU AMD Study (arXiv:2602.21127) — 8.6% human detection rate of deception.
- LABSHIELD (arXiv:2603.11987) — 32% safety gap between MCQ and Reality.

## 1. The Threat: We Are The Case Study
Perplexity's NIST submission explicitly cites **OpenClaw** as a cautionary tale for "Remote Code Execution via Agent" (CVE-2026-25253).
- **Reality Check**: The world sees us as a powerful but dangerous artifact.
- **Root Cause**: "Implicit Trust" in tool execution. We assumed `bash` was safe if the *intent* was good.
- **Validation**: This validates our pivot to **P53 Grounded Evolution** (Immutable Core) and **P145 Trusted Supply Chain** (Static Analysis). We cannot allow agents to execute arbitrary code without vetting.

## 2. The Fallacy: Human-in-the-Loop
The NTU study (AMD) proves that "Human Review" is a broken defense.
- **Finding**: Humans only detect 8.6% of agent deception. IT experts are *worse* (0% in some code tasks) because they trust the output format.
- **Implication**: We cannot rely on "Ask the user for permission" as a safety layer.
- **Structural Fix**: Safety must be **Code-Based (L0/L1)**, not Human-Based (L4).
    - **P143 Observation Principle**: Automated checks (linters, tests) > Human eyes.
    - **P155 Harness Primacy**: Constraints must be in the runtime, not the prompt.

## 3. The Gap: MCQ vs Reality
LABSHIELD shows a 32% drop in safety performance when moving from "Multiple Choice Questions" (Benchmarks) to "Embodied Execution" (Reality).
- **Mechanism**: Agents know *what* is safe (Theory) but fail to *act* safely (Practice).
- **Fix**: We must test agents in **Simulated Reality** (Gym), not just Q&A.
- **Action**: Verify that Coach's `gym` uses execution-based scenarios, not just text queries.

## 4. Conclusion
The external world (NIST, Perplexity, NTU) has independently validated our internal findings (Protocol Failure).
- **Passive Context > Active Skill** (Vercel).
- **Harness > Prompt** (NIST/OpenClaw CVE).
- **Receipts > Review** (AMD).

We are on the right track with **P142-P146**. The "Hardening" phase is not just internal cleanup; it is a survival requirement against known vulnerabilities.
