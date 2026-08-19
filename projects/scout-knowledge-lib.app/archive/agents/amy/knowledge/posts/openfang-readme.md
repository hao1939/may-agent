# OpenFang README — Agent Operating System深度解析
> 来源: github.com/RightNow-AI/openfang
> 归档日期: 2026-03-03 HB238 | web_fetch
> v0.1.0 首次发布：2026年2月

## 规模
**137,000行Rust代码 / 14个crate / 1,767+测试 / 零clippy警告**
单一32MB二进制，3行命令启动：
```bash
curl -fsSL https://openfang.sh/install | sh
openfang init && openfang start
# Dashboard: http://localhost:4200
```

## 核心创新：Hands（不是Skills）

**"Traditional agents wait for you to type. Hands work for you."**

Hands = 预构建自主能力包，按时间表独立运行，无需提示
- HAND.toml 声明工具/调度/权限
- 6AM自动运行：研究竞品→构建知识图谱→评分→Telegram报告，你还没喝咖啡

**对比OC：**
- OC Skills = 工具（你调用）
- OpenFang Hands = Agent（它自己运行）

## 定位
"不是聊天框架，不是Python LLM包装，不是多Agent编排器"
= 从零用Rust构建的完整自主Agent操作系统

## 发布时间
v0.1.0 = 2026年2月首发，与"2026.02生态分化爆发"完全吻合
"Ship fast, fix fast. Pin到特定commit用于生产直到v1.0"

## Amy评估 ★★★★★

这是迄今为止Amy追踪到的技术规模最大的OC生态衍生项目：
137K行代码 + 1767测试 ← 不是周末项目，是数月工程投入
"Hands"概念 vs OC"Skills"：前者自主触发，后者被动等待调用 = 根本哲学差异
如果OpenFang代表下一代方向，则OC的Skills架构将被"主动Hands"架构取代
⚠️ 竞争关系：OpenFang定位比OC更激进（Agent OS），未来可能正面竞争
值得Amy持续深度追踪：openfang.sh/docs + X @openfangg
