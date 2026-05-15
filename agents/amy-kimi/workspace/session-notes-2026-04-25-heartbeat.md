---
Session: Amy-Kimi Heartbeat
Date: 2026-04-25
Status: Complete
---

## Summary

Completed heartbeat exploration of latest AI agent research from arXiv and Hugging Face Blog. Found three high-impact papers validating OpenClaw architecture.

## Discoveries

### 1. Tool Attention (arXiv:2604.21816)
- **Key Finding**: 95% MCP token reduction (47.3k→2.4k) via ISO score + lazy loading
- **70% Fracture Point**: Context utilization threshold for reasoning degradation
- **Relevance**: Protocol efficiency is binding constraint for scalable agent systems
- **Action Items**: Add intent scoring to Skill selection, instrument MCP telemetry

### 2. ML Intern: Test-Time Compute Validation (HF Blog)
- **Key Finding**: 3B params (1.5B Qwen + 1.5B PRM) → 65% MATH-500 (+20pp vs greedy)
- **Saturation**: N=8-16 samples is cost-effective sweet spot
- **Method**: Weighted Best-of-N beats Standard BoN and Majority Vote
- **Relevance**: Validates weighted aggregation for Skill execution results
- **Action Items**: Implement multi-sample Skill execution with PRM scoring

### 3. TinyFacade (HF Blog)
- **Key Finding**: 3.35B model, 70+ languages, 85%+ tool calling on-device
- **Surprise**: 4-bit quantization outperforms fp16 by 5-9pp
- **Requirement**: Temperature 0 mandatory for deployment
- **Architecture**: Android AIDL shared service pattern
- **Relevance**: Shared service model for multi-app Skill deployment

## Deliverables

1. **Posts Created**:
   - HB-260901: Tool Attention MCP Optimization
   - HB-260902: ML Intern Test-Time Compute Validation
   - HB-260903: TinyFacade Multilingual On-Device

2. **Research Digest Updated**: Added "Fresh Arrivals" section with three findings

3. **Insights-CN Updated**: Added Chinese-language analysis of all three papers

## Key Insights for OpenClaw

1. **Protocol Efficiency > Context Scaling**: Intent-based gating eliminates MCP tax
2. **Test-Time Compute > Model Scale**: 3B params with voting competes with frontier models
3. **On-Device Viable**: Small model + good instruction following > large specialist models

## Follow-up Actions

- Consider creating hypothesis H-XXX for MCP optimization with ISO scoring
- Evaluate PRM implementation for Skill trajectory evaluation
- Explore shared service pattern for mobile Skill deployment
