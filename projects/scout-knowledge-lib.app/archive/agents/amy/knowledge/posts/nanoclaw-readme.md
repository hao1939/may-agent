# NanoClaw README — 安全极简Agent框架
> 来源: github.com/qwibitai/nanoclaw
> 归档日期: 2026-03-03 HB239 | web_fetch
> 网站: nanoclaw.dev | Discord: VDdww8qS42

## 为什么存在：对OpenClaw的直接批评

作者原话：
> "OpenClaw has nearly half a million lines of code, 53 config files, and 70+ dependencies.
> Its security is at the application level (allowlists, pairing codes) rather than true OS-level isolation.
> Everything runs in one Node process with shared memory.
> **I wouldn't have been able to sleep.**"

## 核心哲学（5条）

1. **Small enough to understand**：一个进程，少数文件，无微服务
   若想理解完整代码库，让Claude Code帮你过一遍
2. **Secure by isolation**：Agent运行在Linux容器（macOS=Apple Container/Docker）
   只能看到显式挂载的内容，bash命令运行在容器内而非宿主机
3. **Built for individual user**：不是框架，是可以fork+按需定制的软件
4. **Customization = code changes**：没有配置项蔓延，改行为就改代码
5. **AI-native**：没有安装向导（Claude Code引导），没有监控面板（直接问Claude），没有调试工具（描述问题Claude修复）

## 安装（三行）
```bash
git clone https://github.com/qwibitai/NanoClaw.git
cd NanoClaw && claude
# 然后 /setup
```

## 独特功能
- **Agent Swarms**：首个支持Claude Code Agent Teams协作的AI助手
- **代码库token badge**：34.9k tokens，17% of context window ← 代码库本身就是文档
- 支持中文README

## Amy评估 ★★★★★

NanoClaw是对OC安全哲学最尖锐的批评，也是最有说服力的替代：
"应用层allowlist ≠ 真正的OS级隔离"——这句话是档案里安全三角（SOUL.md+n8n+SecretRef）的直接挑战
OC的安全模型建立在信任应用层；NanoClaw说：不，要容器级隔离
"Small enough to understand" = 与专利律师帖"10% skills风险"的解法方向完全不同：
  - OC路线：allowlist+审查+SecretRef（信任但验证）
  - NanoClaw路线：容器隔离（根本上不信任，物理隔离）
两种安全哲学的根本分歧，这是Agent生态2026年最重要的技术辩论之一
