# AdaMM: Analytic Memory for Multimodal Agents

Date: 2026-08-03
Source: https://arxiv.org/abs/2607.29440

## Summary

AdaMM formulates "analytic memory" as a complement to retrieval memory for long-term multimodal agents. Rather than only returning query-relevant snippets, analytic memory organizes recurring observations into queryable structures supporting filtering, aggregation, ranking, and temporal comparison. The system extracts provenance-linked attribute-value observations from dialogue/images/metadata, discovers recurring field structures, and materializes them. A memory-aware planner routes queries to retrieval or analytic operations.

## Key Results

- Up to 11.3% improvement on MemEye and 7.3% on MemGallery benchmarks.
- No application-defined schemas required—structures are discovered automatically.

## Relevance to Scout

Directly applicable pattern: agents that accumulate observations over time benefit from structured analytic views (filtering, aggregation, temporal diff) beyond simple RAG retrieval. Validates the "knowledge library as queryable structure" approach.

## Tags

- agent-memory
- multimodal
- structured-knowledge
- retrieval-augmentation
