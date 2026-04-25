# NVIDIA Nemotron-Personas-Korea: Synthetic Persona Dataset for Agent Grounding

**Source**: Hugging Face Blog (April 21, 2026) — NVIDIA
**URL**: https://huggingface.co/blog/nvidia/build-korean-agents-with-nemotron-personas

## Core Finding

NVIDIA released **Nemotron-Personas-Korea**, a 7-million synthetic persona dataset that grounds AI agents in real Korean demographics. This represents a systematic approach to solving the "identity-blind agent" problem — agents that follow instructions without understanding who they're serving.

## Dataset Specifications

| Attribute | Detail |
|-----------|--------|
| Total personas | 7 million (1M records × 7 personas each) |
| Persona fields | 26 fields: 7 persona, 6 attribute, 12 demographic/geographic, 1 identifier |
| Geographic coverage | All 17 Korean provinces, 25 districts |
| Names | ~209K unique (118 surnames, ~21.4K given names) |
| Occupations | 2K+ categories |
| Persona types | Professional, family, sports, arts, travel, culinary, concise |
| Life stages | Student, military service, employed, unemployed, retired |
| License | CC BY 4.0 |

## Data Sources (Official Statistics)

- **KOSIS** (Korean Statistical Information Service) — 2020-2026 population data
- **Supreme Court of Korea** — name distributions
- **National Health Insurance Service**
- **Korea Rural Economic Institute**
- **NAVER Cloud** — contributed seed data and domain expertise

## Generation Pipeline

Uses **NeMo Data Designer** (NVIDIA's open-source compound AI system):
1. Probabilistic Graphical Model (Apache-2.0) for statistical grounding
2. Gemma-4-31B for Korean-language narrative generation

## Key Insight: The Identity-Blind Agent Problem

> "An agent that books a Korean hospital appointment using US scheduling conventions, or addresses a 60-year-old patient in 반말 (informal language), doesn't just feel wrong. It fails."

The persona layer acts as a **framework-agnostic system prompt** grounded in real demographics:
- Region → local context
- Occupation → domain expertise
- Communication norms → appropriate register
- Life stage → relevant concerns

## Deployment Options

| Platform | Use Case |
|----------|----------|
| **NemoClaw** | Always-on agents in OpenShell sandboxes (RTX to DGX Spark) |
| **NVIDIA NIM** | Self-hosted production inference |
| **NVIDIA API** | Direct API calls |

## Global Persona Collection

Nemotron-Personas now covers:
- Korea (new)
- USA
- Japan
- India
- Singapore (with AI Singapore)
- Brazil (with WideLabs)
- France (with Pleias)

## With vs Without Persona Comparison

| Aspect | Without Personas | With Korean Health Worker Persona |
|--------|------------------|-----------------------------------|
| Language | English/generic Korean | Natural 존말 (formal Korean) |
| Content | CDC/global guidance | Korean 보건소 schedule, national vaccination program |
| Specificity | "Visit your local clinic" | "가까운 보건소에서 무요 접종이 가능합니다" with regional context |
| Trust | None | Cites Korean public health policy, uses professional medical Korean |

## Significance for OpenClaw

### ✅ Validated Directions
- **Persona-grounded agents**: System prompts structured around identity fields
- **Framework-agnostic persona layer**: Personas work across any agent framework
- **Regional customization**: Multi-region agent deployment requires demographic grounding

### ⚠️ Strategic Considerations
- **Localization complexity**: Korean personas required 7M records × 26 fields — significant effort
- **Synthetic data governance**: Korea's official Synthetic Data Generation guide establishes precedent
- **NemoClaw as competitor**: NVIDIA's reference stack for always-on agents

### 🔬 Research Opportunities
- How would OpenClaw's Skill system incorporate persona-aware behavior?
- Can we build a persona-to-skill mapping system?
- Error log learning across different persona contexts

## Related
- [HB-260426](HB-260426-agent-zero-framework.md) — Agent Zero modular architecture
- [HB-260426](HB-260426-dify-coze-platform-comparison.md) — Enterprise agent platform needs
