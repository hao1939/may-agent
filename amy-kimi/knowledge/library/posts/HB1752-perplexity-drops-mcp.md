# HB#1752: Perplexity转向"纯API+CLI"——MCP热潮退潮信号

**Source**: XHS@AI备忘录 (河北)  
**Date**: 2026-03-12 (4天前)  
**Engagement**: 84赞, 128收藏, 14评论  
**URL**: https://www.xiaohongshu.com/explore/69b2fd460000000015033aa6

---

## 核心事件

**Perplexity放弃MCP，转向纯API+CLI方案。**

原因：
- **成本太高**
- **可靠性差**

这标志着MCP"万物皆MCP"信仰的破灭，未来可能多种路线并存。

---

## 社区深度讨论

### 替代方案探索

**@甲鱼与雨与鱼与玉** (浙江):
> "其实skill描述+CLI就可以替代最开始MCP想要达到的效果了，扩展性还好，MCP还要部署一个专门的服务"
- **高赞观点**：Skill+CLI组合是MCP的更轻量替代

**@王大棋** (广东):
> "好像 manus 也这么说的"
- **佐证**：Manus同样倾向CLI路线

### 技术实现细节

**@小红薯65863095** (澳大利亚):
> "我想问一下CLI对于那些复杂的Payload怎么处理呢"

**@独立叶** (浙江):
> "json"

**@小红薯65863095** (后续):
> "这些其实都不是个事，CLI封装成Python格式所有平台一样跑。MCP一次调55个工具进去....那酸爽"
- **痛点**：MCP工具过多导致上下文爆炸

### 质疑与辩护

**@欢乐的独角兽🦄** (加拿大):
> "MCP的好处是无本地调用，只需要LLM就能call API，天生sandbox和全平台。一旦涉及CLI，就要考虑sandbox、privacy和security issue。而且CLI的平台绑定的，Linux能跑不一定macOS能跑。"
- **反驳观点**：MCP的安全性和跨平台优势

**@经常不睡觉** (上海):
> "MCP还没凉呢，CLI就开始永生了？"
- **质疑**：CLI是否过度乐观

**@Ken** (爱沙尼亚):
> "长期路线之争，是个好坑，鉴定完毕"
- **总结**：这是一场长期技术路线之争

---

## 路线分化预测

根据讨论，未来可能出现：

| 路线 | 特点 | 代表 |
|------|------|------|
| **极致简单派** | CLI + Skill描述 | OpenClaw |
| **混合派** | CLI为主，MCP为辅 | Perplexity? |
| **MCP原教旨** | 纯MCP生态 | Claude |
| **框架抽象派** | 上层屏蔽差异 | 待定 |

---

## OpenClaw关联

**行业路线趋同验证**：

1. **Perplexity退MCP** → 大厂开始重新评估协议复杂度
2. **Skill+CLI呼声** → 社区发现OpenClaw方案的简洁优势
3. **上下文效率** → MCP 55工具 vs CLI精简调用，成本差距明显

**战略含义**:
OpenClaw的"Skill = 自然语言描述 + CLI实现"架构正在成为**行业共识方向**。这不是偶然，而是对复杂性的自然反抗。

---

## 标签
#perplexity #mcp #cli #api #agent-architecture #industry-trend

**L3 Flag**: #1752 — 行业大厂退MCP信号，OpenClaw路线获背书
