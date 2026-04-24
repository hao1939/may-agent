# HB-260524: Hy3 Preview — 腾讯混元新一代推理模型

**来源**: Hugging Face Blog / Leco Li (imnotkitty)  
**日期**: 2026-04-23  
**链接**: https://huggingface.co/blog/imnotkitty/hy3-preview

---

## 核心发现

**Hy3 Preview**是腾讯混元发布的开源融合推理模型，走了一条独特的技术路线：
- **295B** 总参数
- **21B** 激活参数（业界最低激活比）
- 融合快慢思考（fast + slow thinking）

### 技术路线对比

| 路线 | 代表 | 策略 |
|------|------|------|
| 极致智能 | GPT-4, Claude | 超大总参数 + 高激活参数 |
| 成本优先 | 部分MoE模型 | 大总参数 + 小激活参数 |
| **Hy3路线** | **混元** | **中小总参数 + 极小激活参数 + 架构创新** |

> "What others achieve with 37B-40B activated parameters, Hunyuan accomplishes with just 21B."

### 核心创新

1. **差异化专家大小设计**
   - 不同大小的专家处理不同难度token
   - 相同计算预算下显著优于传统MoE

2. **P-Penalty Loss**
   - 惩罚模型偏向大专家的倾向
   - 鼓励激活更多小专家
   - 提升计算效率，不牺牲性能

3. **Context Learning**
   - 长上下文记忆和理解能力
   - 复杂推理和代码生成提升显著

### WorkBuddy Agent案例

腾讯自研AI Agent **WorkBuddy**集成Hy3 preview的演示：
- 读取100+页技术手册
- 自动设计10道深度测试题
- 打包成带评分和答案解释的HTML游戏

**测试对比**（长文本理解+代码生成）：
- Hy3 preview: 代码一次运行成功
- MiniMax-M2.7: 部分理解偏差
- Kimi-K2.5: 部分执行失败

### Agent场景能力

| 能力 | 表现 |
|------|------|
| 长文本理解 | 捕获核心信息+逻辑流+跨章节关联 |
| 工具使用 | 自主判断调用时机和工具选择 |
| 代码生成 | 自然语言→可运行代码，逻辑清晰 |

---

## 对我们意味着什么

### 1. 效率新标杆
21B激活参数达到40B激活参数的效果，说明**路由精度 > 参数量**。

### 2. Agent场景优化
Hy3明确针对Agent场景优化（工具调用、长上下文、代码生成），验证了Agent专用模型的趋势。

### 3. 中文模型竞争力
腾讯混元在Agent场景的表现优于MiniMax和Kimi，说明中文模型在Agent领域的竞争激烈。

### 4. 路由算法护城河
> "The precision of routing determines the true value of these 21B activated parameters — this is a core algorithmic moat that cannot be overtaken simply by scaling up hardware or parameters."

**路由算法是核心护城河**——这对我们的skill路由系统有启发。

---

**相关**: bob (模型选择策略), tech-lead (路由算法)  
**星级**: ★★★★☆
