# HB-260425: Nemotron-Personas-Korea — Synthetic Personas for Regionalized Agents

**Source**: Hugging Face Blog / NVIDIA (Apr 21, 2026)  
**Authors**: Will Jennings, Hyunwoo Kim, Jinho Lee, et al.  
**URL**: https://huggingface.co/blog/nvidia/build-korean-agents-with-nemotron-personas  
**Type**: Dataset Release / Regionalization Framework  
**Rating**: ★★★★☆

## Core Insight

> "Persona is operating context, not decoration. 人格决定Agent如何理解需求、选择表达、调用知识。"

大多数Agent是"身份盲"的——它们执行指令时不了解服务对象是谁。用美国医疗工作流程预约韩国医院、或对60岁患者使用반말（非敬语）的Agent，不只是感觉不对，而是会失败。

## Dataset: Nemotron-Personas-Korea

| Attribute | Detail |
|-----------|--------|
| Total Personas | 700万 (100万记录 × 7 personas/记录) |
| Persona Fields | 26个字段: 7个人格字段 + 6个属性字段 + 12个人口统计/地理上下文字段 + 1个唯一标识符 |
| Geographic Coverage | 韩国全部17个省、25个区 |
| Names | ~20.9万个唯一姓名 (118姓氏 + ~2.14万个名字) |
| Occupations | 2,000+类别，反映科技、制造、公共部门等 |
| Persona Types | 专业型、家庭型、运动型、艺术型、旅行型、美食型、简洁型 |
| Life Stages | 学生、兵役、在职、失业、退休 |
| Language | 自然韩语 |
| License | CC BY 4.0 |

## Data Sources (官方统计 grounding)

- **KOSIS** (韩国统计信息服务): 2020-2026人口统计数据
- **韩国最高法院**: 姓名分布数据
- **国民健康保险公团**: 医疗相关统计
- **韩国农村经济研究院**: 农村人口统计
- **NAVER Cloud**: 领域专家种子数据

## Generation Pipeline

使用 **NeMo Data Designer** (NVIDIA开源合成数据复合AI系统):

1. **Probabilistic Graphical Model** (Apache-2.0): 统计grounding
2. **Gemma-4-31B**: 韩语叙事生成

## Compliance

- **零PII**: 所有persona完全合成，不含真实个人信息
- **PIPA合规**: 遵循韩国《个人信息保护法》
- **官方指南**: 遵循韩国PIPC发布的《合成数据生成指南》

## Usage: From Persona to Deployed Agent

```python
# 1. 加载persona到system prompt
persona = load_persona_from_nemotron_korea(
    region="Seoul",
    occupation="Software Engineer",
    age_range="25-34"
)

# 2. 部署到任何Agent框架
agent.deploy(
    framework="any",  # 框架无关
    persona=persona,
    sandbox="NVIDIA OpenShell"
)
```

## Framework-Agnostic Design

可与任何Agent框架配合使用:
- **NemoClaw**: NVIDIA开源参考栈
- **NVIDIA OpenShell**: 从RTX PC到DGX Spark的sandbox环境

## Nemotron-Personas Collection

| Country/Region | Partner |
|----------------|---------|
| USA | NVIDIA |
| Japan | - |
| India | - |
| Singapore | AI Singapore |
| Brazil | WideLabs |
| France | Pleias |
| **Korea** | **NAVER Cloud** |

多语言Agent可在同一pipeline中混合不同国家的persona。

## 对 OpenClaw 的意义

- ✅ 展示结构化人格数据 → system prompt的转换模式
- ✅ 框架无关设计：人格层独立于底层Agent
- ⚠️ 当前缺乏explicit persona/identity系统
- ⚠️ 中文区域化可参考：官方统计 + 合成数据 = 可扩展方案

## Research Directions

1. **中文Persona数据集**: 参考韩国模式，基于中国统计局数据构建
2. **动态Persona切换**: 根据对话上下文自动调整persona
3. **Persona一致性评估**: 如何验证Agent行为符合persona设定

## Related
- [HB-260425-vakra-ibm-agent-benchmark.md](HB-260425-vakra-ibm-agent-benchmark.md) — 企业级Agent评估
- [HB-260425-skillclaw-auto-evolve-skill.md](HB-260425-skillclaw-auto-evolve-skill.md) — Skill演化

## Tags
#persona #regionalization #synthetic-data #korea #nvidia #nemotron #grounding
