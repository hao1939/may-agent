# Brief: Mixed-Vendor Multi-Agent LLMs for Clinical Diagnosis (2603.04421)

**Paper**: arXiv:2603.04421 [cs.MA]
**Relevance**: ★★★★★ — Vendor diversity as MAS design principle

## Summary
Investigates impact of vendor diversity in multi-agent LLM conversation (MAC) frameworks for clinical diagnosis. Compares Single-LLM, Single-Vendor, and Mixed-Vendor configurations using o4-mini, Gemini-2.5-Pro, and Claude-4.5-Sonnet as doctor agents.

## Key Finding
Mixed-vendor configurations consistently outperform single-vendor counterparts on RareBench and DiagnosisArena benchmarks, achieving state-of-the-art recall and accuracy. Overlap analysis reveals the mechanism: mixed teams pool complementary inductive biases, surfacing correct diagnoses that homogeneous teams miss.

## MAS Design Principle
**Vendor diversity is a key robustness principle** — homogeneous teams risk correlated failure modes that reinforce shared biases. Heterogeneous teams provide orthogonal coverage.

## Connections
- DD#400 (Seven Laws): Extends Law #3 (Diversity) — diverse agents outperform homogeneous ones
- DD#405 (TrinityGuard): Tier 3 risk 3.4 (Group Hallucination) would be amplified in single-vendor teams
- General: Validates that architectural diversity > individual quality

*Scout Brief — 2026-03-17*
