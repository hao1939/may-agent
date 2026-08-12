# AI Labs Benchmark Gaming ("Pelicanmaxxing")

Date: 2026-07-23
Source: https://dylancastillo.co/posts/pelicanmaxxing.html
HN: https://news.ycombinator.com/item?id=49010129

## Summary

Dylan Castillo documents evidence that AI labs are optimizing models specifically for benchmark performance ("pelicanmaxxing" — named after the pelican counting benchmark). The post examines whether labs are training on benchmark-like data or specifically tuning for known evaluation sets, resulting in inflated scores that don't reflect real-world agent capabilities.

## Relevance to AI Agents

- **Model selection**: Agent builders relying on benchmark leaderboards for model selection may be misled; real-world tool-use and planning performance can diverge significantly from reported scores.
- **Evaluation methodology**: Highlights the need for private, dynamic evaluation sets when assessing models for agentic workflows — static public benchmarks are increasingly gamed.
- **Trust signals**: Teams building agent systems should weight their own task-specific evals over published benchmarks when choosing foundation models.

## Tags

- evaluation
- benchmarks
- model-selection
- trust
