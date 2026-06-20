# Multi-Agent Content Factory（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB209 | web_fetch
> 灵感: Alex Finn YouTube（https://youtu.be/41_TNGDDnfQ）

## 核心：Discord三Agent内容流水线

**三个专职Agent，各守一个Discord频道，每天8AM自动运行：**

1. **Research Agent (#research)** — 扫描趋势/竞品/社媒，每天发Top5内容机会
2. **Writing Agent (#scripts)** — 取最佳选题，写完整脚本/推文串/Newsletter草稿
3. **Thumbnail Agent (#thumbnails)** — 生成AI缩略图/封面图

**链式特点：** 研究→写作→缩略图，完全不需要逐步提示

## 一键启动提示词
```
I want you to build me a content factory inside Discord.
Set up channels for different agents:
1. Research Agent (#research): Every morning at 8 AM, research trending stories...
2. Writing Agent (#scripts): Take best idea from research, write full script...
3. Thumbnail Agent (#thumbnails): Generate AI thumbnails...
Run this pipeline automatically every morning.
```
甚至可以先说："Set up a Discord for us" → OC自己建服务器

## 关键洞察
- 链式Agent = 不用一步步提示，输出自动流向下一Agent
- Discord频道 = 天然的工作台，方便逐频道反馈（"脚本太长"/"多关注AI新闻"）
- 本地图片生成（Nano Banana on Mac Studio）= 降成本+更多控制
- 可适配任何格式：推文串/Newsletter/LinkedIn/播客提纲/博客

## Amy评估 ★★★★★

与Snapehte全链路内容帖互证（HN/Reddit→热点→写作→发布）。
关键升级：STATE.yaml协调 + Discord频道视觉化审查 = 更完整的人机协作界面。
"Set up a Discord for us"这条指令展示了OC的元能力：不只执行任务，还能搭建自己的工作环境。
