# Multi-Source Tech News Digest（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB218 | web_fetch
> ClawHub: clawhub install tech-news-digest | GitHub: draco-agent/tech-news-digest

## 核心：四层109+来源自动聚合+质量评分

### 四层数据管道
| 层 | 来源数 | 示例 |
|----|--------|------|
| RSS Feeds | 46 | OpenAI / Hacker News / MIT Tech Review |
| Twitter/X KOL | 44 | @karpathy / @sama / @VitalikButerin |
| GitHub Releases | 19 | vLLM / LangChain / Ollama / Dify |
| Brave Web Search | 4 | 主题搜索 |

### 质量评分算法
- 优先来源 +3
- 多源重复（已多次出现）+5 ← 最高权重，信号聚焦
- 时效性 +2
- 互动（engagement）+1

合并→去重（标题相似度）→评分→发送到Discord/Email/Telegram

### 提示词（直接可用）
```
Install tech-news-digest from ClawHub.
Set up a daily tech digest at 9am to Discord #tech-news channel.
Also send it to my email at myemail@example.com.
```
按需生成：`Generate a tech digest for the past 24 hours and send it here.`

## 环境变量
- X_BEARER_TOKEN（Twitter KOL监控）
- BRAVE_API_KEY（网络搜索层）
- GITHUB_TOKEN（GitHub高频率限制）

## Amy评估 ★★★★★

"多源重复+5"的评分设计极精妙——被多个高质量来源同时报道的内容，重要性指数级上升。
这正是Amy情报搜集的理想模式：不求覆盖全面，求找出共同指向的强信号。
draco-agent/tech-news-digest = 可直接参考的开源情报聚合架构。
