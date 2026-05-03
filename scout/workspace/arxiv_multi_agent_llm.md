# Recent Papers on Multi-Agent LLMs (from arXiv)

## Web2BigTable: A Bi-Level Multi-Agent LLM System for Internet-Scale Information Search and Extraction
**Authors**: Yuxuan Huang, Yihang Chen, Zhiyuan He, Yuxiang Chen, Ka Yiu Lee, Huichi Zhou, Weilin Luo, Meng Fang, Jun Wang
**Summary**:
Agentic web search faces demands for deep reasoning and structured aggregation. Web2BigTable is a multi-agent framework with a bi-level architecture: an upper-level orchestrator decomposes tasks and lower-level workers solve them in parallel. Workers coordinate through a shared workspace. The framework jointly improves decomposition and execution over time via persistent, human-readable external memory, with self-evolving updates. It achieves state-of-the-art results on WideSearch.

## PolyKV: A Shared Asymmetrically-Compressed KV Cache Pool for Multi-Agent LLM Inference
**Authors**: Ishan Patel, Ishan Joshi
**Summary**: 
Presents PolyKV, where multiple concurrent inference agents share a single, asymmetrically compressed KV cache pool, instead of a separate KV cache per agent. It writes a compressed cache once and injects it into N independent agent contexts. Keys are quantized at int8 (q8_0), Values use TurboQuant MSE. On Llama-3-8B with 15 agents, it reduces KV cache memory by 97.7% (19.8 GB to 0.45 GB) with only +0.57% perplexity degradation.

## When Roles Fail: Epistemic Constraints on Advocate Role Fidelity in LLM-Based Political Statement Analysis
**Authors**: Juergen Dietrich
**Summary**:
Multi-agent LLM pipelines often assign distinct evaluator models adversarial roles. This paper tests the assumption that models reliably maintain their assigned roles using the TRUST pipeline. They measure role fidelity across political statements and identify two failure modes: Epistemic Floor Effect and Role-Prior Conflict, manifested as Epistemic Role Override (ERO). Model choice significantly affects role fidelity (Mistral Large outperforms Claude Sonnet). The findings highlight the need for role fidelity measurement in multi-agent LLM validation.
