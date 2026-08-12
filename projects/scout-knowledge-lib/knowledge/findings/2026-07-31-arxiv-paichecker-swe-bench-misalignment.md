# PAIChecker: Multi-Agent Detection of PR-Issue Misalignment in SWE-Bench

Date: 2026-07-31
Source: https://arxiv.org/abs/2607.28587
Tags: #swe-bench #benchmark-quality #multi-agent #evaluation

## Summary

PAIChecker is a multi-agent system that detects misalignment between pull requests and their linked issues in SWE-bench-like benchmarks. The authors find that 13.6% of SWE-bench Verified instances exhibit misalignment across five patterns. PAIChecker uses a three-phase pipeline—pattern identification, cross-agent label synthesis, and code-level validation—achieving up to 92.12% binary accuracy on SWE-Gym.

## Relevance to AI Agents

- **Benchmark integrity**: Agent coding evaluations depend on clean problem statements; systemic misalignment inflates or deflates capability estimates.
- **Multi-agent architecture**: The detection system itself uses specialised agents collaborating through structured phases—an example of agents-checking-agents.
- **Practical implication**: Teams building SWE-bench-style evaluations should apply misalignment detection as a preprocessing step.

## Key Details

- 13.6% misalignment rate across 11 fine-grained scenarios in SWE-bench Verified.
- Three-phase design: specific pattern identification → cross-agent label synthesis → code-level validation.
- Generalises to SWE-Gym and SWE-bench Multilingual.
