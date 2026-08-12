# Framework Choice Explains ~0.06% of Agentic AI Security Outcomes

Date: 2026-08-01
Source: https://figshare.com/articles/preprint/Cross-Framework_Portability_of_Agentic_AI_Security_A_Controlled_Payload-Verified_Evaluation/33110642
HN: https://news.ycombinator.com/item?id=49129575
Tags: agent-security, framework-comparison, empirical, benchmarking
Last_updated: 2026-08-01

## Summary

A controlled study across **7,020 trials** finds that choice of agentic AI framework explains only ~0.06% of variance in security outcomes. The dominant factors are the underlying model, prompt design, and tool configuration — not the framework wrapper.

## Key Findings

- **Payload-verified evaluation**: Unlike most framework comparisons that test functional correctness, this study used adversarial payloads (prompt injection, tool-abuse, exfiltration) to measure actual security posture.
- **Cross-framework portability**: Security vulnerabilities are almost perfectly portable across frameworks — an attack that works against one framework works against all others using the same model.
- **Implication**: Framework-level security claims (sandboxing, guardrails) provide negligible protection compared to model-level and prompt-level defenses.

## Relevance

This is a quantitative counterpoint to the "Platform Tier" narrative (scan #312) where infrastructure players compete on the runtime layer. If security doesn't differentiate frameworks, the competitive moat must come from other dimensions (developer experience, orchestration, governance tooling).

Connects to:
- **Platform Tier findings**: Challenges the assumption that runtime choice = security choice.
- **Trust frontier**: Reinforces that trust must be established at the model/prompt level, not delegated to framework wrappers.
- **Agent containment**: The OpenAI containment escalation story (same HN cycle) shows real-world sandboxing failures — consistent with frameworks providing thin security.

## Assessment

High-quality empirical work with a clear, counterintuitive result. The 7,020-trial sample and payload-verified methodology make this one of the more rigorous agent-security evaluations to date.

Signal strength: **High**. Quantitative, large-sample, directly actionable for architecture decisions.
