# JustRL: 极简RL训练的里程碑论文

**论文**: JustRL: Scaling a 1.5B LLM with a Simple RL Recipe  
**团队**: 清华大学、UIUC、上海AI Lab (Bingxiang He, Zekai Qu, Zhiyuan Liu等)  
**arXiv**: 2512.16649 (8次档案引用)  
**日期**: December 18, 2025

---

## 核心主张

> **"Is this complexity necessary?"**  
> RL领域不断增加复杂性（多阶段训练、动态超参数、课程学习），但JustRL证明：**单阶段训练+固定超参数即可达到SOTA**。

### 核心成果

| 模型 | 平均准确率 | 对比基线 | 计算效率 |
|-----|-----------|---------|---------|
| JustRL-DeepSeek-1.5B | 54.87% | > ProRL-V2 (53.08%) | 2× less compute |
| JustRL-Nemotron-1.5B | 64.32% | > QuestA (63.81%) | 2.4× less compute |

---

## 极简配方 (The Simple Recipe)

### 我们保持简单

| 维度 | 典型复杂方法 | JustRL方法 |
|-----|-------------|-----------|
| 训练阶段 | 多阶段渐进 (3-8 stages) | **单阶段连续训练** |
| 超参数 | 动态调度、自适应温度 | **固定超参数** |
| 数据策略 | 离线难度过滤、在线动态采样 | **标准数据集，无过滤** |
| 长度控制 | 显式长度惩罚项 | **简单设置max context=16K** |
| Prompt工程 | 调优训练Prompt | **简单后缀Prompt** |

### 唯一使用的技术

- **"Clip higher"**: 长时域RL的稳定性实践
- **GRPO + 二元结果奖励** (veRL默认实现)
- **轻量级规则验证器** (DAPO)

### 超参数配置 (两模型共用，无需调优)

```
Advantage Estimator: GRPO
Use KL Loss: No
Use Entropy Regularization: No
Train Batch Size: 256
Max Prompt Length: 1k
Max Response Length: 15k
Clip Ratio Range: [0.8, 1.28]
Learning Rate: 1e-6 (constant)
Temperature: 1.0
Rollout N: 8
```

---

## 反直觉发现：添加"标准技巧"损害性能

### 消融实验结果 (AIME 2024)

| 配置 | 性能 | 熵(探索度) |
|-----|------|----------|
| **JustRL基线** | **55%** | **1.2-1.4 (健康)** |
| + 长度惩罚 (Overlong Penalty) | 50% (-5%) | ~0.5-0.6 (坍塌) |
| + 长度惩罚 + 鲁棒验证器 | 45% (-10%) | ~0.5-0.6 (坍塌) |

### 关键洞察

**长度惩罚的问题**:  
- 假设：显式惩罚冗长响应会提高效率  
- 实际：**坍塌探索**，熵从1.2-1.4降至0.5-0.6  
- 原因：惩罚压力与学习目标冲突，迫使模型在探索有效策略前就收敛到短响应

**鲁棒验证器的问题**:  
- 假设：减少假阴性会提供更干净的学习信号  
- 实际：性能进一步下降  
- 可能解释：
  1. 严格验证器创造更丰富的学习信号谱（减少"完美"分数）
  2. 严格验证器迫使模型发展更精确的内部计算

> **"The accumulated 'best practices' may be fighting each other rather than the fundamental challenges of RL"**

---

## 训练动态分析

### 健康训练的标志

| 指标 | JustRL表现 | 典型RL问题 |
|-----|-----------|-----------|
| **熵** | 稳定振荡1.0-1.6 | 向上漂移(探索坍塌)或向下漂移(过早收敛) |
| **平均奖励** | 平滑单调提升(-0.6 → +0.4) | 平台期、突然下降 |
| **响应长度** | 自然压缩(8000→4000-5000 tokens) | 长度爆炸 |

### 自然长度收敛

无需显式长度惩罚，模型自发从~8000 tokens压缩到4000-5000 tokens：
- **机制**: 有机压缩比显式惩罚更鲁棒
- **风险**: 显式惩罚可能创造对抗压力，模型学会"游戏"系统

---

## 与复杂方法对比

### RL技术演进趋势 (Table 1)

| 方法 | EC | THP | TTP | RKL | LC | AT | RR | DS | ST |
|-----|---|---|---|---|---|---|---|---|---|
| STILL-3-1.5B | ✗ | ✔ | ✔ | ✔ | ✗ | ✗ | ✗ | ✗ | ✗ |
| DeepScaleR | ✔ | ✗ | ✗ | ✗ | ✔ | ✗ | ✗ | ✗ | ✔ |
| ProRL-V2 | ✔ | ✔ | ✗ | ✔ | ✔ | ✗ | ✗ | ✔ | ✔ |
| POLARIS | ✔ | ✔ | ✗ | ✗ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **JustRL** | **✔** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** |

- **EC**=Entropy Control, **THP**=Tune Hyperparameters, **TTP**=Tune Training Prompt
- **RKL**=Reset KL Reference, **LC**=Length Control, **AT**=Adaptive Temperature
- **RR**=Rollout Rescue, **DS**=Dynamic Sampling, **ST**=Split Training Stages

---

## OpenClaw架构启示

### 1. 方法论对齐

| JustRL洞察 | OpenClaw映射 |
|-----------|-------------|
| 先建立简单基线，再添加复杂性 | 与当前开发哲学一致 |
| 复杂性可能解决自找的问题 | 警惕过度工程化 |
| 固定超参数跨模型有效 | 标准化训练配置的价值 |

### 2. Error Log机制的验证

JustRL发现**严格验证器优于鲁棒验证器**，因为：
- 更丰富的学习信号谱
- 迫使更精确的内部计算

这与Error Log的设计哲学一致：**方向性批评（非完美验证）提供更强学习信号**。

### 3. 反模式警示

⚠️ **需避免的"标准技巧"**:
- 显式长度惩罚（除非明确需要短输出）
- 过度追求"鲁棒"验证（可能稀释学习信号）
- 多阶段训练管道（增加复杂性，可能不带来收益）

---

## 社区资源

- **论文**: https://arxiv.org/abs/2512.16649
- **代码**: https://github.com/thunlp/JustRL
- **模型**: https://huggingface.co/collections/hbx/justrl

---

## 引用

```bibtex
@article{he2025justrl,
  title={JustRL: Scaling a 1.5B LLM with a Simple RL Recipe},
  author={He, Bingxiang and Qu, Zekai and Liu, Zeyuan and Chen, Yinghao and Zuo, Yuxin and Qian, Cheng and Zhang, Kaiyan and Chen, Weize and Xiao, Chaojun and Cui, Ganqu and Ding, Ning and Liu, Zhiyuan},
  journal={arXiv preprint arXiv:2512.16649},
  year={2025}
}
```

---

*归档时间: 2026-04-17 | L3 Flag: #835*
