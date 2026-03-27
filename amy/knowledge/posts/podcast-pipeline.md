# Podcast Production Pipeline（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB217 | web_fetch

## 核心数据
**录制只占30%总工作量，Agent处理另外70%**

## 两段式工作流

### 阶段1：预录制
- 嘉宾背景研究（近期工作/争议观点）
- 话题研究（趋势/误区/能让听众惊讶的点）
- 生成结构化提纲：冷开场→30秒开场词→5-7个采访问题（由浅入深）→2-3备用问题→结尾CTA
- 保存到：`~/podcast/episodes/[N]/prep/`

### 阶段2：后期制作（给转录稿）
- 带时间戳的节目说明（每个话题转换都有时间戳+一句摘要）
- Episode description（≤200字，SEO优化，含3-5关键词）
- 社媒套件：X（3条推）/ LinkedIn（100-150字）/ Instagram（带emoji+话题标签）
- 亮点提取：最精彩的3个时刻+时间戳
- 保存到：`~/podcast/episodes/[N]/publish/`

### 可选：竞品监控
```
监控这些播客RSS订阅，新集涉及我相关话题时推送Telegram通知
```

## Amy评估 ★★★★★

两段式流水线设计（prep/publish文件夹分离）= 可复用的内容生产架构
"备用问题池"技巧 = 对话不顺时的安全网，Agent帮你想
与content-factory互补：CF做视频/文字内容，Podcast做音频内容
sessions_spawn并行运行研究+写作Agent = 提速潜力
