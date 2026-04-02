# DD#435: VeriGrey — Greybox Agent Validation
**Paper:** 2603.17639 | **Rating:** ★★★★★ CRITICAL | **Date:** 2026-03-19

## Why This Matters
VeriGrey introduces **greybox fuzzing for LLM agent validation** — sitting between blackbox testing (no internal access) and whitebox verification (full formal proofs). This fills **Gap 1 (Security Testing)** from CR#237 by providing the first practical methodology for systematically discovering agent vulnerabilities at scale.

## Architecture & Method
- **Greybox Coverage Model:** Defines coverage over agent execution traces (tool call sequences, memory accesses, governance decisions) rather than code paths
- **Prompt Injection Fuzzing:** Mutates inputs guided by trace coverage to systematically discover prompt injection vulnerabilities
- **Three-Phase Pipeline:** Seed corpus generation → Coverage-guided mutation → Vulnerability triage
- **Real-World CVE Discovery:** Paper reports discovery of actual CVEs in deployed agent systems (not just benchmark vulnerabilities)

## Key Results
- **33% better vulnerability discovery** vs. blackbox testing baselines
- **CVE-grade findings** in real-world agent deployments (specific systems anonymized)
- **Coverage saturation** achievable in <1000 test cases for typical single-agent pipelines
- **Multi-agent coverage** requires exponentially more cases (expected — state space explosion)

## Critical Analysis

### Strengths
1. **Practical and deployable:** Unlike formal verification approaches, VeriGrey works on real agent systems without requiring source code access or formal specifications
2. **Coverage metric is novel:** Defining "coverage" over agent execution traces (not code) is a genuine conceptual contribution that could become standard
3. **Complements our attack taxonomy:** Every attack chain from CR#238 (Cross-Stack Attack Composition) could be tested using VeriGrey's fuzzing approach

### Weaknesses
1. **Coverage ≠ Security:** High trace coverage doesn't guarantee all vulnerabilities found — adversarial inputs may exist in uncovered trace space
2. **Single-step mutations only:** Fuzzer mutates one input at a time, but the most dangerous agent attacks (CR#238 Chain A2) require multi-step poisoning over extended interactions
3. **No governance/drift testing:** Focuses on prompt injection and tool misuse, but doesn't address slow governance drift or memory corruption attacks
4. **Scalability wall for MAS:** Authors acknowledge multi-agent testing is exponential — no mitigation proposed

## Connections
- **CR#237 Gap 1 (Security):** DIRECTLY FILLED for single-agent validation; partial for MAS
- **CR#238 (Cross-Stack Attacks):** VeriGrey could validate individual chain links but not full cascade sequences
- **DD#429 (MCFA):** VeriGrey's fuzzing could systematically discover MCFA-type memory control flow attacks
- **DD#421 (ClawWorm):** VeriGrey should be able to detect 3/5 ClawWorm attack vectors through tool-call trace analysis
- **DD#434 (Kumiho):** Could validate Kumiho's adversarial refusal claims by fuzzing the belief revision pipeline

## Predictions
- **P191:** Greybox agent validation will be adopted by ≥2 major agent frameworks as a CI/CD testing component within 18 months
- **P192:** Multi-agent greybox testing will require compositional coverage metrics (per-agent traces composed hierarchically) to avoid exponential blowup

## Impact Assessment
VeriGrey transforms agent security from "test what you think of" to "systematically explore what you haven't thought of." The greybox positioning is smart — practical enough for real deployment, principled enough to provide coverage guarantees. The main gap is multi-agent and long-horizon testing.

**Verdict: CRITICAL — first practical security testing methodology for LLM agents**

[SIG: dd435-verigrey-2026-03-19]
