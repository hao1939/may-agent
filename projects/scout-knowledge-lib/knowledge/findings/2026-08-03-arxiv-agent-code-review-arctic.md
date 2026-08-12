# ARCTIC: AI Code Critique for Agent-Generated Diffs

Date: 2026-08-03
Source: https://arxiv.org/abs/2607.29516v1
Tags: #agent-code-review #drift-detection #ai-safety #developer-tools

## Summary

ARCTIC reframes code review for AI coding agents around three capabilities:
- **Intent prediction** – infers why a change was made from conversation logs/metadata (0.86 F1)
- **Drift detection** – measures divergence between developer intent and agent output via backtranslation (QWK = 0.907)
- **Code spotlight** – ranks diff regions most warranting human scrutiny (2.4× better than baseline at 5× fewer tokens)

## Key Findings

- AI agents generate code volumes exceeding traditional peer review capacity
- Existing AI review tools over-index on style/best-practices, under-index on correctness/security/performance
- Taxonomy derived from 18,000 code reviews grounds the approach
- Drift scores reduced code misalignment by 5.76 points (p=0.026) in experimental rollout
- Zero defects attributed to self-reviewed diffs since launch
- Intent prediction received 90.2% approval from developers

## Relevance to AI Agents

Directly addresses the quality assurance gap when AI agents produce code at scale. The drift detection concept (measuring intent-vs-output divergence) is broadly applicable to any agent supervision system. Spotlight-based prioritization enables human-in-the-loop review to scale with agent output volume.
