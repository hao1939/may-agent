# Karpathy autoresearch: AI Agent自主进行LLM研究

**Source**: GitHub (karpathy/autoresearch)  
**Stars**: 76.6k  
**Author**: Andrej Karpathy  
**Tweet**: https://x.com/karpathy/status/2029701092347630069  

---

## 核心概念

**autoresearch** 是Karpathy的最新实验：让AI Agent在单GPU上**自主运行LLM训练研究**， overnight迭代数百次实验，人类只通过`program.md`进行元编程。

> "有一天，前沿AI研究曾是肉脑计算机在吃饭、睡觉、娱乐和偶尔用声波互联进行'组会'仪式之间完成的。那个时代早已过去。研究现在完全是自主AI Agent群在天空中的计算集群巨型结构上运行的领域。"
> — @karpathy, March 2026

---

## 项目架构

### 极简三文件设计

```
autoresearch/
├── prepare.py     # 固定常量，一次性数据准备（不修改）
├── train.py       # Agent编辑的文件（架构/超参数/优化器）
└── program.md     # 人类编辑的Agent指令（元编程入口）
```

### 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│                    autoresearch 循环                         │
├─────────────────────────────────────────────────────────────┤
│  1. Agent读取 program.md 和当前 train.py                    │
│                      ↓                                      │
│  2. Agent修改 train.py（架构/超参/优化器都可以改）           │
│                      ↓                                      │
│  3. 训练运行5分钟（固定时间预算，与计算细节无关）              │
│                      ↓                                      │
│  4. 评估 val_bpb（验证bits per byte，越低越好）              │
│                      ↓                                      │
│  5. 如果改善则保留，否则丢弃                                  │
│                      ↓                                      │
│  6. 重复循环（overnight数百次迭代）                          │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计决策

| 设计 | 理由 |
|------|------|
| **固定5分钟训练** | 公平比较不同架构，与计算速度无关 |
| **val_bpb指标** | 与词表大小无关，架构修改可公平对比 |
| **只改train.py** | 聚焦核心训练逻辑，保持实验可控 |
| **program.md元编程** | 人类不直接改代码，而是通过指令引导Agent |

---

## 技术细节

### 训练配置
- **基础**: nanochat简化版单GPU实现
- **优化器**: Muon + AdamW
- **模型**: GPT架构（可修改）
- **评估**: validation bits per byte (val_bpb)

### Agent循环
```python
# 伪代码表示
for iteration in range(overnight):
    # Agent基于program.md和当前代码提出修改
    edit = agent.propose_edit(program_md, train_py)
    
    # 应用修改
    apply_edit(train_py, edit)
    
    # 训练5分钟
    result = train_for_5_minutes()
    
    # 评估
    if result.val_bpb < best_val_bpb:
        best_val_bpb = result.val_bpb
        keep_edit()
        log_success(iteration, edit, result)
    else:
        revert_edit()
        log_failure(iteration, edit, result)
```

---

## 对OpenClaw的意义

### ✅ 研究自动化范式

1. **元编程模式**: 人类通过文档(program.md)指导Agent，而非直接编码
2. **自治实验循环**: 提出假设→执行→评估→保留/丢弃的闭环
3. **固定预算评估**: 时间/资源预算约束下的公平比较

### 🔬 Skill进化启发

| autoresearch机制 | OpenClaw Skill进化应用 |
|-----------------|----------------------|
| program.md元编程 | Skill改进的指令模板 |
| train.py编辑 | Skill代码生成/修改 |
| 5分钟训练预算 | Skill执行成本约束 |
| val_bpb评估 | Skill质量评估指标 |
| 保留/丢弃机制 | Skill版本管理 |

### ⚠️ 关键洞察

- **AI研究自动化**: 从"人写代码"到"人写指令，Agent执行"
- **实验规模**: overnight数百次实验vs人类几天一次
- **可扩展性**: 可添加更多Agent到研究组织
- **代码进化**: 寻找"研究组织代码"实现最快进展

---

## 与现有工作的关系

- **Anthropic AAR**: 9个Claude agent并行研究，autoresearch是单Agent自主迭代
- **SkillClaw**: 同样关注自动进化，autoresearch更激进（完全自主）
- **AgenticQwen**: 关注模型训练，autoresearch关注研究过程自动化

---

## 快速开始

### 环境要求
- 单张NVIDIA GPU (H100测试)
- Python环境

### 运行
```bash
# 克隆仓库
git clone https://github.com/karpathy/autoresearch.git
cd autoresearch

# 准备数据（一次性）
python prepare.py

# 配置你的Agent指向program.md
# 让Agent开始自主研究
```

### program.md示例结构
```markdown
# Research Program

## Goal
Optimize nanochat GPT implementation for best val_bpb

## Constraints
- Only edit train.py
- 5-minute training budget per experiment
- val_bpb is the only metric

## Current Best
val_bpb: X.XXX (achieved with: [description])

## Directions to Explore
1. Architecture modifications
2. Optimizer changes
3. Hyperparameter tuning
```

---

## 社区资源

- **Dummy's Guide**: https://x.com/hooeem/status/2030720614752039185
- **Karpathy Tweet**: https://x.com/karpathy/status/2029701092347630069
- **后续Tweet**: https://x.com/karpathy/status/2031135152349524125

---

## 标签

#karpathy #autonomous-research #llm-training #ai-research #self-improving #meta-programming #nanochat #overnight-experiments
