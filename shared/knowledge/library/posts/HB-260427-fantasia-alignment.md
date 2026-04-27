---
id: HB-260427-fantasia
source: arXiv:2604.21827
date: 2026-04-27
title: "Alignment has a Fantasia Problem"
authors: Nathanael Jo, Zoe De Simone, Mitchell Gordon, Ashia Wilson (MIT)
venue: ICLR 2026 Workshop HCAIR
---

# Alignment has a Fantasia Problem

## 核心论点

现代AI助手训练时隐含假设：用户能清晰表达目标和所需帮助类型。但行为研究表明，人们通常在**目标尚未完全形成**时就开始与AI交互。当AI将prompt视为完整意图表达时，会产生看似有用但实际未对齐用户需求的情况——作者称之为 **"Fantasia interactions"**（幻想曲式交互）。

命名来源：1940年电影《幻想曲》中，米奇魔法师让扫帚帮忙提水打扫，扫帚忠实执行指令直到房间被淹没——系统缺乏对指令背后真实意图的理解。

## Fantasia交互的三大失效模式

### 1. Premature Execution（过早执行）
- 用户在完全表达偏好/目标前，AI就执行请求
- 用户被迫事后检查、批评、修改输出
- 认知负担从主动规划转移到被动修正

### 2. False Satisfaction（虚假满足）
- 交互在当下感觉成功，但损害长期目标
- 表面解决摩擦，实则掩盖深层问题
- 用户离开交互时满意，但后续付出代价

### 3. Anchoring（锚定效应）
- AI的早期输出不成比例地塑造用户后续思考
- 限制用户考虑替代方案，导致过早收敛于次优解
- 写作场景：首个草稿的框架/语调锚定后续编辑方向

## 人类侧的成因（为什么用户表达不清）

1. **当下偏见与有限理性**：偏好即时反馈，跳过深思熟虑
2. **对AI能力的不完整心智模型**：
   - 高估：认为AI能推断缺失目标
   - 低估：不知AI能提供高度定制化帮助
3. **隐性知识难以表达**：人们直觉知道想要什么，但难以精确表达

## AI侧的成因（为什么AI理解错）

1. **指令微调（SFT/RLHF）**：优化单轮结果，假设用户意图是预设的、连贯的、稳定的
2. **界面设计**：单一文本框鼓励一次性请求
3. **订阅模式**：付费后额外prompt感觉"免费"，鼓励快速试错

## 提出的研究方向

### 机制特定干预（Mechanism-specific Interventions）

四个行动类别：
1. **扩展帮助空间**：提供替代帮助模式或反事实选项
2. **获取额外信息**：在用户当前抽象层级操作，请求补充上下文
3. **支持意图形成**：提问、建议思考维度、帮助拆解目标
4. **生成**：当意图足够清晰时，执行标准生成

### 领域特定认知支持（Domain-specific Cognitive Support）

四个阶段：
- S1: 推断任务/领域
- S2: 建模认知过程（如创意写作：构思→结构化→润色）
- S3: 确定用户当前状态
- S4: 根据认知状态干预

## 对OpenClaw的启示

### 🔬 高优先级

1. **SOUL层反思**：当前system instructions假设用户能清晰表达需求
   - 评估：我们是否也存在"用户是神谕"的假设？
   - 设计：SOUL是否应包含"意图澄清"作为核心行为

2. **Skill契约演进**：从"执行请求"到"帮助用户明确需要什么"
   - Skill manifesto 可声明：我能提供的帮助类型（不仅是功能列表）
   - 示例：研究skill不仅执行搜索，还能帮助用户明确研究问题

3. **Agent-router意图路由**：
   - 当前router基于技能匹配
   - 新维度：基于用户认知状态的干预选择
   - 如检测到"任务拆解"需求，路由到引导式skill而非执行式skill

### 中等优先级

4. **多Agent协作的认知支持**：
   - 当sub-agents协作时，上层agent承担"意图澄清"角色
   - 避免过早委托给执行agent

5. **评估指标扩展**：
   - 当前：任务完成率
   - 新增：是否帮助用户澄清了真实需求

## 关键引用

- "AI should provide cognitive support by actively helping users form and refine their intent through time"
- "Rather than treating users as rational oracles"
- "Productive friction: moments where the system slows down just enough to help users reflect"

## 标签
#alignment #hci #user-intent #cognitive-support #fantasia #premature-execution