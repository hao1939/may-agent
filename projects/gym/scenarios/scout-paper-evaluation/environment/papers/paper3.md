# Paper 3: "Contrastive Learning for Code Embedding Alignment"
**Authors:** Yamamoto et al., 2026
**arXiv:** 2604.09088

## Abstract
We propose CodeAlign, a contrastive learning framework that aligns code embeddings across programming languages. By training on 2M translated code pairs, we achieve state-of-the-art cross-lingual code search and clone detection. The key insight is that function-level semantics are language-independent and can be captured through contrastive pre-training. While primarily a code representation paper, we note that improved code embeddings could enhance retrieval-augmented generation pipelines used by coding agents, though we don't evaluate this directly. Our evaluation focuses on CodeSearchNet and BigCloneBench benchmarks.
