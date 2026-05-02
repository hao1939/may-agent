# RecursiveMAS: Recursive Multi-Agent Systems (DeepMind, Apr 2026)

**Source**: arxiv 2604.25917 | Found via XHS @AI魔法屋  
**Paper**: https://arxiv.org/abs/2604.25917  
**Project**: https://recursivemas.github.io

## Core Idea

Multi-agent systems currently communicate via text — model A outputs text, model B reads it and continues. This causes:
- Information loss at each handoff
- Redundant token processing
- No global gradient optimization possible

**RecursiveMAS** rewrites the multi-agent system as unified latent-space recursive computation:
- Agents connected via **RecursiveLink** module — pass latent states, not text
- Inner-outer loop training algorithm for whole-system co-optimization
- Shared gradient-based credit assignment across recursion rounds

## Results (9 benchmarks: math, science, medicine, search, code)
- **+8.3% average accuracy** vs text-based MAS
- **1.2-2.4x inference speedup**
- **34.6-75.6% token reduction**
- Works across 4 agent collaboration patterns
- Performance improves with more recursion rounds

## 对我们系统的意义

我们的多智能体系统（bob, coder, scout, amy等）完全是文本通信的。RecursiveMAS证明了文本通信的低效性——每次handoff都有信息损耗。

**短期启示**：
- 减少agent间不必要的文本中转。能直接读共享文件的，别通过消息转达。
- 共享context（如knowledge库）相当于穷人版"latent state sharing"。

**中长期思考**：
- 如果未来agent可以共享embedding/hidden state而非文本，协作效率可能质变
- "递归轮次越多越好"暗示：让agent反复迭代同一问题比一次性回答更有效（我们的experiment loop已在做这件事）

**假设**: 减少agent间文本中转步骤，直接用shared artifacts通信，可以减少信息损耗并加速任务完成。
