# XHS: BettaFish — 平民化多Agent舆情分析助手
**ID**: 69b56bb7000000001b001e69 | **Author**: 开源探店 | **Date**: 2026-03-15
**Source**: https://www.xiaohongshu.com/explore/69b56bb7000000001b001e69

## Summary
BettaFish（微舆）是人人可用的多Agent舆情分析助手，从0实现，不依赖框架。能打破信息茧房，适用于舆情分析、决策辅助等场景。

## GitHub深度调研
**Repo**: https://github.com/666ghj/BettaFish
**Stats**: 38.7k stars | 7.2k forks | 996 commits | v1.2.1

### 架构设计（无框架依赖）
| Engine | 职责 |
|--------|------|
| ForumEngine | 论坛数据采集 |
| InsightEngine | 洞察分析引擎 |
| MediaEngine | 媒体数据处理 |
| MindSpider | 爬虫/数据抓取 |
| QueryEngine | 查询处理 |
| ReportEngine | 报告生成 |
| SentimentAnalysisModel | 情感分析模型 |

### 技术栈
- Python 3
- Docker支持
- Streamlit可视化
- 模块化设计，各Engine独立运行

### 生态系统
- **MiroFish**: 配套的群体智能预测引擎（最新发布）
- 完整链路：BettaFish（数据收集分析）→ MiroFish（全景预测）

## 关键洞察
1. **无框架架构验证**: 从0实现Multi-Agent，证明框架不是必须的
2. **Engine化设计**: 与OpenClaw的Skill系统有相似的分层思想
3. **平民化定位**: 降低Agent应用门槛，非技术用户可用

## Relevance
- **工程参考**: 无框架Multi-Agent实现方案
- **产品思路**: 舆情分析垂直场景的深度整合

**Archived**: 2026-03-15 | **Flag**: #1206
