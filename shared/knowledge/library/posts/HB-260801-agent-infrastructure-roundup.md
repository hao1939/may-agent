# HB-260801: Agent Infrastructure Roundup — Test-Time Compute, Trace Assets, MoE Routing

> **Source**: Hugging Face Blog (Apr 20-23, 2026) + arXiv
> **Date**: 2026-08-01 Session
> **Evidence**: ★★★★★ (Multiple sources, code available, quantitative results)

---

## 🔥 Finding 1: ML Intern — Test-Time Compute Scaling验证

**来源**: [HF Blog — ML Intern Takes Our Post-Training Internship Test](https://huggingface.co/blog/cmpatino/ml-intern-takehome)  
**核心发现**: 仅**3B总参数** (1.5B Qwen生成器 + 1.5B Skywork PRM) 达到 **65% MATH-500** (vs 贪婪解码45%)

### 方法: Weighted Best-of-N
1. 对每个问题采样N个独立解
2. 用PRM为每个解打分（取最后一步预测作为奖励）
3. 按最终答案分组，累加PRM分数
4. 选择总分最高的答案组

### 关键结果

| 方法 | 准确率 | 提升 |
|------|-------|------|
| Greedy (N=1) | 45% | — |
| Majority Vote (N=16) | 60% | +15pp |
| Standard Best-of-N (N=16) | 55% | +10pp |
| **Weighted Best-of-N (N=16)** | **65%** | **+20pp** |

### 饱和点: N=8-16
- N=8: 63.6%
- N=16: 65% ← 性能饱和，继续增加收益递减

### 关键洞察
**Weighted > Standard**: 标准BoN选单解最高分，易被单个高分错误解欺骗。Weighted对同一正确答案在多解中出现时累加证据，更鲁棒。

---

## 🔥 Finding 2: Save the Traces — 对话痕迹作为新文件抽象

**来源**: [HF Blog — Save the traces!](https://huggingface.co/blog/pcuenq/save-the-traces)  
**核心洞察**: "No matter how advanced your 'memory' solutions are, conversation traces are the new 'file' abstraction"

### 备份方案
```bash
for f in .claude .codex .cursor .pi; do 
  uvx hf sync ~/${f} hf://buckets/pcuenq/traces/$(hostname -s)/${f}
done
```

### 使用价值
1. **避免vendor lock-in** — 跨服务迁移
2. **跨设备恢复** — 继续中断的项目
3. **对话总结** — Agent协助整合多轮对话
4. **Skill提取** — 从重复任务中提取可复用技能
5. **训练数据捐赠** — 支持开源模型改进

---

## 🔥 Finding 3: Hy3 Preview — 路由精度作为算法护城河

**来源**: [HF Blog — Hy3 preview](https://huggingface.co/blog/imnotkitty/hy3-preview)  
**模型规格**: 295B总参数 / 21B激活参数 (~7.1%激活率) — 业界最低

### 关键创新
1. **差异化专家尺寸**: 不同难度token路由到不同容量专家
2. **P-Penalty Loss**: 惩罚偏向大专家，鼓励激活小专家
3. **Context Learning**: 深度搜索+工具调用+复杂推理

### 核心洞察
> "别人用37B-40B激活参数做到的，我们用21B就能做到。**路由精度是核心算法护城河**，无法通过简单堆砌硬件或参数超越"

### 产品集成
- **WorkBuddy Agent**: 100页手册→10题HTML测验游戏，首次运行零bug
- **腾讯元宝**: 深度搜索+实时信息检索+复杂推理

---

## 🔥 Finding 4: TinyFacade — 端侧多语言Tool Calling突破

**来源**: [HF Blog — Multilingual Tool Calling in 70+ Languages](https://huggingface.co/blog/Bronsn/tiny-facade)  
**核心发现**: **3.35B TinyAya-Earth**零工具调用训练，却击败Aya Expanse 8B（专门训练）

### 惊人结果
| 语言 | TinyAya-Earth (3.35B) | Aya Expanse (8B) | 差距 |
|------|----------------------|-----------------|------|
| Luganda | 85.9% | 64.0% | +22pp |
| Swahili | 79.5% | 62.6% | +17pp |
| English | 88.7% | 81.6% | +7pp |

### 意外发现
- **4-bit量化 > fp16**: 性能提升5-9pp — 更小文件，更高准确率
- **Temperature必须为0**: 每增加0.3损失5-10pp，单调递减无恢复
- **书写系统 > 地理区域**: 拉丁/CJK/天城文等书写系统是更强的准确率预测指标

### 架构模式: Android AIDL共享服务
- 2.14GB模型加载一次，多App复用
- 避免每个App捆绑2GB+
- 5个动作原语: HTTP, file, system, intent, content resolver

---

## 对 OpenClaw 的综合意义

### ✅ 架构验证
| 发现 | 验证点 |
|------|-------|
| Weighted Best-of-N | Skill结果加权聚合 > 单选 |
| Save the Traces | 追踪所有会话的设计方向正确 |
| Hy3路由精度 | 简单/复杂任务→不同Skill深度的差异化路由策略 |
| TinyFacade | Skill模板质量 > 模型规模；共享服务模式可行 |

### ⚠️ 战略议题
1. **Test-Time Compute**: N=8-16采样预算可作为Skill执行默认配置
2. **Missing PRM**: 缺乏用于代码/工具调用轨迹评估的过程奖励模型
3. **Trace提取**: 对话→Skill的自动提取管道缺失
4. **路由精度度量**: 如何量化Skill选择准确性？
5. **量化策略重评估**: Tool calling场景4-bit可能提升性能

### 🔬 研究机会
- **Answer标准化**: 需实现Skill结果的标准化比较机制(SymPy等)
- **ISO评分**: Tool Attention的Intent Schema Overlap机制可引入Skill选择
- **温度策略**: Tool calling必须temperature=0的政策验证

---

## 相关链接
- [HB-260802](HB-260802-ml-intern-test-time-compute.md) — ML Intern深度分析
- [HB-260803](HB-260803-save-traces-analysis.md) — Trace资产化分析
- [HB-260804](HB-260804-hy3-routing-precision.md) — Hy3路由精度分析
- [HB-260805](HB-260805-tiny-facade-on-device.md) — TinyFacade端侧部署分析
