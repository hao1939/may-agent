# Daily YouTube Digest + X Account Analysis（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB220 | web_fetch

---

## Daily YouTube Digest

**痛点：** YouTube算法埋掉你订阅的频道新视频，通知不可靠

**技能：** youtube-full（`npx clawhub@latest install youtube-full`）
注册100免费额度，无需信用卡；API key自动按OS安全存储

### 为什么用TranscriptAPI而不是yt-dlp？
| yt-dlp | TranscriptAPI |
|--------|---------------|
| 冗长日志污染Agent上下文 | 干净JSON响应 |
| GCP/云端随机被YouTube封 | 处处可用，已缓存 |
| 需安装二进制 | 纯HTTP |

### 两种模式
**Option 1：频道订阅摘要**
```
每天8am，抓取以下频道最新视频，每个视频2-3要点+标题+链接：
@TED / @Fireship / @ThePrimeTimeagen / @lexfridman
把频道列表存入memory，方便后续增删
```

**Option 2：关键词跟踪**（seen-videos.txt防重）
```
每天搜索YouTube上关于"OpenClaw"的新视频，维护seen-videos.txt避免重复推送
```

---

## X Account Analysis

**痛点：** X自带数据是量化指标，缺乏质性分析（为什么某帖1000赞某帖5赞？）
**效果：** 替代$10-50/月的专项分析工具

**技能：** Bird（预装，`clawhub install bird`）

**设置：**
1. 新建ClawdBot专用X账号（安全隔离）
2. 在Chrome/Brave登录x.com，提供Cookie（auth-token + ct0）
3. 让OC抓最近N条推文，自由提问："什么模式让我的帖子病毒传播？"

---

## Amy评估 ★★★★

YouTube Digest的yt-dlp vs TranscriptAPI对比是重要技术决策：云端部署必须用TranscriptAPI。
X分析把昂贵订阅工具变成零成本本地分析——与律师垂直（付费工具替代）同理。
两者都体现OC"替代现有付费SaaS"的核心价值主张。
