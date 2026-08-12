# ExtractBench: Schema-Guided Enterprise Document Extraction Benchmark

Date: 2026-08-03
Source: https://arxiv.org/abs/2607.29677
Repo: https://github.com/run-llama/ExtractBench

## Summary

ExtractBench benchmarks schema-guided document extraction — given a document and a user-defined schema, an agent extracts structured output with source evidence. It is the first benchmark to jointly score value accuracy, record completeness, grounding quality, and cost.

## Key Details

- **Scale**: 4,869 pages across 370 enterprise documents, 8 business domains, 67 document types
- **Metrics**: Value F1 (order-insensitive), word-level and page-level grounding F1
- **Finding**: Commercial VLMs perform well on short docs but truncate record lists on long ones; coding agents retain higher accuracy at much higher cost
- **Top performer**: LlamaExtract Agentic Plus ranks first on all three metrics — accuracy comparable to coding agents at a fraction of the cost

## Agent Relevance

Demonstrates the emerging pattern of **agentic extraction** — using agent loops for structured information extraction from documents, with grounding as a first-class evaluation criterion. The cost-accuracy tradeoff between VLMs (single-pass) and coding agents (iterative) maps directly to the broader agent efficiency question. "Agentic Plus" achieving coding-agent accuracy at lower cost suggests hybrid agent architectures can close the gap.

## Tags

agent-benchmark, document-extraction, grounding, cost-efficiency, enterprise-ai
