# Nemotron-Personas-Korea: 用合成人格 grounding 韩国 AI Agent

**来源**: Hugging Face Blog / NVIDIA (Apr 21, 2026)  
**链接**: https://huggingface.co/blog/nvidia/build-korean-agents-with-nemotron-personas  
**类型**: Synthetic Data / Agent Persona / Regionalization  
**HB ID**: HB-260425-nemotron-personas-korea

## 核心发现

大多数 AI Agent 的基模主要用英文网页数据训练，缺失韩语敬语结构、区域职业模式和文化语境。NVIDIA 发布 **Nemotron-Personas-Korea** 数据集，提供 600 万基于韩国官方统计的**完全合成人格**，解决 Agent 的"身份盲"问题。

### 数据集规格

| 属性 | 详情 |
|------|------|
| 总人格数 | 700 万 (100万记录 × 7 人格/记录) |
| 字段 | 26 个：7 人格字段 + 6 属性字段 + 12 人口地理字段 + 1 ID |
| 地理覆盖 | 韩国 17 个省，25 个区 |
| 姓名 | ~20.9 万唯一姓名（118 姓，~2.14 万名） |
| 职业 | 2000+ 类别（科技、制造、公共部门等） |
| 人格类型 | 职业、家庭、体育、艺术、旅行、美食、简洁版 |
| 人生阶段 | 学生、兵役、在职、失业、退休 |
| 语言 | 自然韩语 |

### 数据来源（官方统计）

- **KOSIS** (韩国统计信息服务): 2020-2026 人口数据
- **韩国最高法院**: 姓名分布
- **国民健康保险公团**: 医疗领域 seed 数据
- **韩国农村经济研究院**: 农业领域 seed 数据
- **NAVER Cloud**: 贡献 seed 数据和领域专业知识

### 生成方法

使用 **NeMo Data Designer** (NVIDIA 开源 compound AI 系统):
- **Probabilistic Graphical Model** (Apache-2.0): 统计 grounding
- **Gemma-4-31B**: 韩语叙事生成

### 核心洞察：为什么需要区域化人格？

**问题示例**:
- 用美国医疗预约流程为韩国用户预约医院
- 对 60 岁患者使用 반말（非敬语/平语）而非 존댓말（敬语）

**解决方案**: 将人格加载到 system prompt，Agent 继承该人格的区域、职业、沟通规范和领域专长。

### 使用示例：韩国公共卫生 Agent

```python
# 筛选医疗相关职业
# "보건"=公共健康, "간호"=护理, "의료"=医疗, "의사"=医生
health_personas = dataset.filter(
    lambda x: "보건" in x["occupation"] or 
              "간호" in x["occupation"] or 
              "의료" in x["occupation"]
)

# 构建 system prompt
system_prompt = f"""당신은 한국의 공중보건 상담 AI 에이전트입니다.

[신원] # Identity
- 이름: {persona['name']} # 姓名
- 지역: {persona['region']} # 区域
- 직업: {persona['occupation']} # 职业
- 전문분야: {persona['skills']} # 专长

[행동 지침] # Behavior guidelines
- 한국어 존댓말을 사용하여 응답하세요。 # 使用敬语
- 지역 보건소 및 공공 의료 체계에 대한 안내를 제공하세요。
- 한국 공중보건 정책과 절차를 기반으로 정확한 정보를 제공하세요。
- 문화적 맥락을 고려하여 상담하세요。 # 考虑文化语境
"""
```

### 框架无关性

人格层可与任何 Agent 框架配合使用：
- **NemoClaw**: NVIDIA 开源 always-on Agent 参考栈
- **NVIDIA NIM**: 生产推理服务
- **直接 API 调用**: 任何支持 system prompt 的框架

### Nemotron-Personas 全球系列

| 地区 | 合作伙伴 | 状态 |
|------|----------|------|
| USA | NVIDIA | 已发布 |
| Japan | NVIDIA | 已发布 |
| India | NVIDIA | 已发布 |
| Singapore | AI Singapore | 已发布 |
| Brazil | WideLabs | 已发布 |
| France | Pleias | 已发布 |
| **Korea** | NAVER Cloud | **最新发布** |

可混合多地区人格构建多语言 Agent。

### 合规设计

- **零 PII**: 所有人格基于统计生成，不含真实个人信息
- **PIPA 合规**: 遵循韩国《个人信息保护法》
- **官方指南**: 遵循韩国个人信息保护委员会发布的《合成数据生成指南》

## 对 OpenClaw 的意义

- ✅ **区域化 Agent 范例**: 展示如何用合成数据实现 Agent 的本地化/区域化
- ✅ **人格即 System Prompt**: 结构化人格数据 → 自然语言 system prompt 的转换模式
- ✅ **框架无关设计**: 人格层独立于底层 Agent 框架，可移植
- ⚠️ **缺乏人格层**: 当前 OpenClaw 无 explicit persona/identity 系统
- ⚠️ **多语言支持**: 中文区域化可参考此模式，用官方统计数据 grounding

## 关键洞察

> "Most agents today are identity-blind. They follow instructions without any grounding in who they're serving."

人格不是装饰，而是**操作上下文**（operating context）——它决定了 Agent 如何理解用户需求、选择表达方式、调用领域知识。

合成数据 + 官方统计 grounding = 可扩展的区域化方案，避免真实数据隐私问题。

---
*Scraped by amy-kimi on 2026-04-25*
