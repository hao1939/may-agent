# HB-0082: CLI-Anything - 让任意软件变为Agent原生工具

**Source:** 小红书搜索发现 → GitHub  
**Date:** 2026-04-05  
**Status:**  actively maintained (28.3k ⭐)

## 项目概述

**CLI-Anything** 是香港大学数据科学实验室 (HKUDS) 的开源项目，目标是让任意软件都能被 AI Agent 调用。通过为各种软件生成 agent-native 的 CLI 封装，打通 AI Agent 与现有软件生态之间的鸿沟。

- **GitHub:** https://github.com/HKUDS/CLI-Anything
- **CLI-Hub:** https://clianything.cc/
- **Stars:** 28.3k
- **Forks:** 2.7k
- **Tests:** 1,839 passing
- **License:** MIT

## 核心理念

> "Today's Software Serves Humans. Tomorrow's Users will be Agents."
> 
> 今天的软件为人类服务。明天的用户将是 Agent。

CLI-Anything 桥接 AI Agent 与世界软件之间的差距，让任何具有 GUI 或 API 的软件都能获得 agent-native CLI。

## 当前支持的软件 (16+ Demos)

| 类别 | 软件 |
|------|------|
| 创意工具 | Blender, GIMP, Krita, Inkscape, ComfyUI |
| 视频/音频 | OBS Studio, Kdenlive, Shotcut, Audacity, MuseScore |
| 开发工具 | iTerm2, WireMock, CloudCompare |
| 办公效率 | LibreOffice, Zotero, Draw.io, Mubu |
| 其他 | Ollama, Novita, NotebookLM, Slay the Spire II |

## 使用方法

安装 CLI-Anything Hub 技能后，Agent 可以：

```bash
# 通过 OpenClaw
openclaw skills install cli-anything-hub

# 通过 nanobot  
nanobot skills install cli-anything-hub
```

然后提示 Agent: "Find appropriate CLI software in CLI-Hub and complete the task: ..."

Agent 会自主发现、安装并使用合适的 CLI 工具完成任务。

## 技术实现

每个软件封装包含：
- `agent-harness/` 目录 - 定义 agent 可调用的接口
- `SKILL.txt` - 技能描述文件
- JSON + Human 双模式输出

## 贡献机制

- 欢迎为任何应用贡献封装 (desktop apps, dev tools, cloud services, SaaS APIs)
- 使用 PR 模板提交
- CLI-Hub 即时更新

## 对我们的意义

1. **技能扩展思路**: 通过 CLI 封装将外部工具纳入 agent 能力范围
2. **标准化接口**: 展示了一种将现有软件标准化的方法
3. **生态整合**: 如何通过技能系统整合第三方工具生态
4. **社区驱动**: 开源社区贡献模式的参考

## 与 OpenHarness 的关系

CLI-Anything 与 OpenHarness (4.5k ⭐) 同属 HKUDS Agent 基础设施套件：
- **OpenHarness** - Agent 核心运行时 (循环、记忆、协调)
- **CLI-Anything** - 外部工具接入层

两者结合形成完整的 Agent 能力扩展体系。
