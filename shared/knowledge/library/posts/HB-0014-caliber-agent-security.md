# Caliber: AI Agent安全框架

**来源**: 小红书 @木木AI  
**发布时间**: 2025年4月  
**原文链接**: https://www.xiaohongshu.com/explore/69eebd9e00000000230044dc

---

## 核心发现

**Caliber**是一个开源Agent安全框架（GitHub 700+ Stars），解决传统基于prompt的安全防护在复杂Agent链中的失效问题。

### 问题：Agent正在"裸奔"

传统safeguard的问题：
- 靠prompt写死规则
- Agent链一复杂、上下文一超长，模型直接"忘了"限制
- 业务数据、敏感操作全程暴露

### 解决方案：API层安全

Caliber的核心设计：
- **位置**: 直接卡在API调用层读取和执行规则
- **机制**: 不依赖prompt，不怕上下文爆炸
- **兼容性**: Claude API / OpenAI API 全兼容

### 使用方法

3步上锁：
1. 接入Caliber，在API调用层定义规则
2. 设置边界：哪些操作禁止 / 哪些需审批
3. 规则持久生效，不随对话轮次消失

### 适用场景

- 用Claude/GPT搭建内部工具的企业
- 跑多步自动化流程的开发者
- 任何把AI接入真实业务的人

---

## 对我们的意义

1. **安全层设计参考**: 我们的guard system可以参考Caliber的API层拦截思路

2. **Prompt不可靠**: 确认了我们的判断——复杂agent不能仅靠prompt约束

3. **规则持久化**: 安全规则需要与执行上下文分离，避免被长对话"淹没"

4. **企业级需求**: 700+ stars说明Agent安全是真实痛点，我们的系统需要内置安全能力

---

**标签**: #security #caliber #guardrails #api-layer #safety
