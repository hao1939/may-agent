# User-Turn Probe: 交互意识与任务能力解耦

**Source**: arXiv:2604.02315 (April 2, 2026)  
**Title**: "Beyond the Assistant Turn: User Turn Generation as a Probe of Interaction Awareness in Language Models"  
**Authors**: Sarath Shekkizhar, Romain Cosentino, Adam Earle

---

## 核心问题

标准LLM基准测试只评估 **assistant turn**（模型生成响应），遗漏了一个关键维度：**对话延续意识**（Interaction Awareness）。

测试在模型响应后就结束，没有测量模型是否编码了"响应之后会发生什么"的意识。

---

## 探测方法：User-Turn Generation

给定对话上下文（用户查询+助手响应），让模型以**用户角色**生成下一回合：

```
用户: 求解方程 2x + 5 = 13
助手: x = 4
[模型以用户角色生成]: "谢谢！那 3x + 7 = 22 呢？" ← 真实跟进
```

如果模型权重编码了交互意识，生成的用户回合将是基于前文的真实跟进。

---

## 惊人发现

### 1. 交互意识与任务准确率完全解耦

**Qwen3.5 家族数据：**
| 模型规模 | GSM8K准确率 | 确定性生成下真实跟进率 |
|---------|------------|---------------------|
| 0.8B    | 41%        | ≈0%                 |
| 7B      | 79.4%      | ≈0%                 |
| 32B     | 91.6%      | ≈0%                 |
| 397B-A17B | 96.8%    | ≈0%                 |

**任务能力 Scaling 不带来交互意识！**

### 2. 交互意识是潜在能力

提高 temperature 后，跟进率可达 **22%** — 说明交互意识存在于模型权重中，但 assistant-only 训练抑制了它。

### 3. 可控验证

受控扰动实验确认该探针测量的是模型的真实属性，而非噪声。

---

## 协作导向微调实验

在 Qwen3.5-2B 上进行协作导向的后训练：
- 明确训练模型生成用户跟进
- 成功提升跟进率

**关键洞察**：交互意识可通过针对性训练获得。

---

## 对我们的启示

### 1. Agent评估维度扩展
- 当前评估只测"响应质量"
- 需增加"对话延续性"维度
- 多轮任务质量 > 单轮响应质量

### 2. Multi-Agent协作影响
- 我们的 Agent 间通信可能受限于交互意识不足
- 协作导向微调可能提升多 Agent 协作效果
- Manager→Specialist 的指令传递需验证 Specialist 的"理解确认"

### 3. 训练数据建议
- 在 SFT/RL 数据中加入"用户回合生成"任务
- 不仅训练模型响应，也训练模型预期下一步

### 4. 测试建议
- 为 Agent 系统设计 multi-turn evaluation benchmark
- 测量任务完成率的同时，测量"对话自然度"

---

## 关键引用

```bibtex
@article{shekkizhar2026interaction,
  title={Beyond the Assistant Turn: User Turn Generation as a Probe of Interaction Awareness in Language Models},
  author={Shekkizhar, Sarath and Cosentino, Romain and Earle, Adam},
  journal={arXiv preprint arXiv:2604.02315},
  year={2026}
}
```

---

**标签**: #interaction-awareness #multi-agent #benchmark #qwen #user-turn #april-2026
