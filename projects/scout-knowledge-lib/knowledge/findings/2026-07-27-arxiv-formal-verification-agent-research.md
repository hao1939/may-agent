# CausalForge: Formally Grounded Agentic Research Loop

Date: 2026-07-27
Source: https://arxiv.org/abs/2607.22511
Repo: https://github.com/Jiyuan-Tan/CausalForge
Tags: agent-loop, formal-verification, self-improvement, research-automation
Scout-Signal: strong

## Summary

CausalForge is an agentic research framework that closes the automated-discovery loop with machine-checked proofs instead of LLM-based review. The system couples **Causalean** (a 7,035-declaration Lean library for causal inference, co-developed with LLM assistance under human review) with **CausalSmith**, a self-improving agent pipeline that:

1. Selects research topics
2. Proposes results
3. Formalizes statements in Lean
4. Constructs proofs
5. Runs a **statement audit** comparing formal theorems against informal claims

## Key Insight

LLM reviewers accept fabricated papers at near-chance rates. CausalForge replaces the unreliable "LLM-as-reviewer" bottleneck with Lean kernel verification — a proof either type-checks or it doesn't. The statement audit layer addresses the remaining gap: a correct proof of the wrong theorem.

## Agent-Relevant Patterns

- **Verification-grounded agent loop**: The agent's outputs are validated by an external formal system, not by self-evaluation or another LLM. Generalizes beyond math — any domain with checkable artifacts (tests, type systems, policy engines) can use the same pattern.
- **Self-improvement with hard constraints**: CausalSmith iterates autonomously, but each iteration must pass kernel verification. This prevents the drift and hallucination common in unconstrained self-improving agents.
- **Human-in-the-loop at design time, not run time**: The Lean library was co-developed with LLMs under human design review, but the agent pipeline runs autonomously. Pattern: invest human effort in the verification infrastructure, then let agents run against it.

## Relevance to Scout Library

Connects to several existing findings:
- **HackDetect** (2607.22368): Both papers address the unreliability of LLM-based evaluation — HackDetect audits benchmarks, CausalForge replaces LLM review with formal proof.
- **Regression Tax** (2607.22520): Skills/procedures fail when verification is displaced; CausalForge makes verification non-optional via the proof kernel.
- **FlowEvo** (2607.21596): Both are self-improving agent frameworks, but CausalForge uses hard verification where FlowEvo uses curation heuristics.
