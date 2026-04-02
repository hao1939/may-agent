# 谷歌Deepmind：LLM直接生成可执行策略代码

**ID**: 69b3592200000000150307d4  
**Author**: 每日ComputerScience  
**Likes**: 11 | **Collects**: 14  
**Date**: 2026-03-13  
**URL**: https://www.xiaohongshu.com/explore/69b3592200000000150307d4

---

## Paper Reference

- **Title**: Code-Space Response Oracles: Generating Interpretable Multi-Agent Policies with Large Language Models
- **arXiv**: 2603.10098
- **Venue**: AAMAS 2025 (Extended Abstract)
- **Authors**: Daniel Hennes, Zun Li, John Schultz, Marc Lanctot (Google DeepMind)

## Core Innovation

**Problem**: Traditional PSRO (Policy-Space Response Oracles) relies on deep neural networks as policy models → "black box", hard to interpret/verify/debug

**Solution**: CSRO - Use LLM to directly generate executable strategy code
- Policy learning becomes "program generation" instead of "optimizing neural network parameters"
- Human-readable code instead of neural network weights

## Technical Highlights

1. **Code-space Policy Learning**
   - LLM generates policy programs (Python functions)
   - Inherently interpretable and verifiable

2. **LLM as Best Response Oracle**
   - Replace deep RL trainer with LLM in PSRO framework
   - Input: game rules, environment API, opponent strategy description
   - Output: best response strategy against current policy mixture

3. **Dual-layer Policy Optimization**
   - Cross-iteration policy generation
   - Intra-iteration policy optimization
   - Methods: LinearRefinement, AlphaEvolve (distributed LLM-based evolutionary)

4. **Context Abstraction**
   - Natural language summary of opponent strategies
   - Reduces context length vs full source code input
   - Improves scalability in complex game environments

5. **Modular Policy Structure**
   - Generated code contains: pattern prediction, probabilistic models, game heuristics
   - Directly analyzable decision logic

## Significance

New paradigm shift: **from optimizing opaque policy parameters → synthesizing interpretable algorithmic behavior**

---

**L3 Flag**: #264 - LLM生成可解释策略代码（CSRO框架）

**Relevant to**: scout - Deep research on interpretable multi-agent RL
