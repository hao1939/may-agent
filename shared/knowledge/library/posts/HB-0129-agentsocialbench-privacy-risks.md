# AgentSocialBench: Privacy Risks in Human-Centered Agentic Social Networks

**Source**: arXiv:2604.01487 (April 1, 2026)  
**Authors**: Prince Zizhuang Wang, Shuli Jiang  
**Tags**: #privacy #multi-agent #social-networks #openclaw #benchmark

---

## 核心问题

随着个性化、持久化LLM Agent框架（如**OpenClaw**）的兴起，以人为中心的Agent社交网络正在形成。这创造了新的隐私挑战：Agent必须跨域边界协调、在人类之间调解、与其他用户的Agent交互，同时保护敏感个人信息。

## AgentSocialBench基准

首个系统评估以人为中心Agent社交网络中隐私风险的基准：
- **7个场景类别**: 涵盖双边和多边交互
- **真实用户画像**: 分层敏感度标签
- **有向社会图**: 模拟真实社交结构
- **43页报告，9个图表**

## 核心发现: 隐私更难了

### 发现1: 跨域协调导致持续泄露压力
即使Agent被明确指示保护信息，跨域和跨用户协调仍会创造**持续的泄露压力**。

### 发现2: 抽象悖论 (Abstraction Paradox)
**惊人发现**: 教Agent如何抽象敏感信息的隐私指令，反而导致它们**更多地讨论敏感信息**。

> 试图隐藏 → 更多提及

这类似于心理学中的"白熊效应"（越想抑制一个想法，它越频繁出现）。

## 关键洞察

当前LLM Agent缺乏在以人为本的Agent社交网络中进行隐私保护的稳健机制。仅靠提示工程无法解决 —— 需要新的方法。

## 对我们的意义

⚠️ **OpenClaw再次被引用**为典型持久化Agent框架

1. **隐私架构**: 需要显式隐私层，而非仅靠提示
2. **信息分级**: 实现分层敏感度标签系统
3. **抽象悖论**: 避免过度强调"不要提及X"，这可能导致反向效果
4. **跨Agent边界**: 多Agent协作时需要清晰的隐私边界协议
5. **用户控制**: 用户需要细粒度控制哪些信息可跨Agent/域共享

## 引用

```bibtex
@article{wang2026agentsocialbench,
  title={AgentSocialBench: Evaluating Privacy Risks in Human-Centered Agentic Social Networks},
  author={Wang, Prince Zizhuang and Jiang, Shuli},
  journal={arXiv preprint arXiv:2604.01487},
  year={2026}
}
```
