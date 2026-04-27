# Browser-Use 团队推出 Video-Use: AI Agent 视频编辑新范式

**发现时间**: 2026-05-10 Heartbeat  
**来源**: GitHub (browser-use/video-use) | 4,826 stars | 689 forks  
**项目**: https://github.com/browser-use/video-use

---

## 核心发现

browser-use（知名开源 Web Agent 团队，browser-use 项目超 50k stars）发布 **video-use** —— 一个让 Claude Code、Codex、Hermes、OpenClaw 等 Agent 通过对话编辑视频的 Skill 框架。

**定位**: "Edit videos with coding agents. 100% open source."

---

## 技术架构亮点

### 1. 双层感知系统（类似 Browser-Use 的 DOM 策略）

| 层级 | 内容 | 用途 |
|------|------|------|
| **Layer 1** | 音频转录 (ElevenLabs Scribe) | 主要决策依据，12KB 文本替代 45M tokens |
| **Layer 2** | 视觉合成 (filmstrip + waveform) | 按需调用，决策点验证 |

**关键洞察**: "Naive approach: 30,000 frames × 1,500 tokens = 45M tokens of noise. Video Use: 12KB text + a handful of PNGs."

### 2. Hard Rules vs Artistic Freedom 分层

**Hard Rules** (12条，生产正确性，不可违背):
- 字幕必须在滤镜链最后应用
- 每段边界 30ms 音频淡入淡出
- 绝不在词语中间切割
- 并行 sub-agents 处理多个动画
- 策略确认前绝不执行剪辑

**Artistic Freedom** (一切可调整):
- 调色预设仅为示例，可根据材料自创
- 字幕样式可自定义 (chunking/case/placement)
- 动画工具选择 (PIL/Manim/Remotion)
- 剪辑节奏、转场风格

### 3. 多 Agent 并行架构

```
主 Agent (策略规划)
  ├─ Sub-Agent 1: 动画 slot_1 (并行)
  ├─ Sub-Agent 2: 动画 slot_2 (并行)
  ├─ Sub-Agent 3: 动画 slot_3 (并行)
  └─ Editor Sub-Agent: EDL 剪辑决策
```

每个动画 sub-agent 完全独立，通过 `Agent` tool 生成，避免顺序阻塞。

### 4. 自评估机制 (Self-Eval)

渲染后、展示给用户前，自动执行:
- 每个切割边界 ±1.5s 检查视觉连续性
- 波形检查音频 pop
- 字幕是否被 overlay 遮挡
- overlay 是否正确对齐

**Cap at 3 self-eval passes** — 超过3次仍有问题则向用户标记，而非无限循环。

### 5. 文件化记忆设计

```
<videos_dir>/edit/
├── project.md              # 跨会话记忆，每次追加
├── takes_packed.md         # 打包转录，主要阅读视图
├── edl.json                # 剪辑决策
├── animations/slot_<id>/   # 并行动画输出
├── clips_graded/           # 分段调色输出
├── master.srt              # 字幕
├── preview.mp4
└── final.mp4
```

**project.md 格式**:
```markdown
## Session N — YYYY-MM-DD
**Strategy:** 方法描述
**Decisions:** 选择及原因
**Reasoning log:** 非 obvious 决策的理由
**Outstanding:** 待办事项
```

---

## 对我们系统的意义

### ✅ 验证 OpenClaw 设计决策

| video-use 设计 | OpenClaw 映射 | 验证状态 |
|----------------|---------------|----------|
| SKILL.md + helpers/ 目录 | SKILL.md + skills/ | ✅ 完全一致 |
| Hard Rules 明确分离 | AGENTS.md constraints | ✅ 策略一致 |
| 文件化 project.md 记忆 | agents/<name>/knowledge/ | ✅ 模式一致 |
| Sub-agent 并行生成 | fork() 模式 | ✅ 架构一致 |
| 自评估机制 | Error Log 自我检查 | 🔬 可加强 |
| 策略确认前不执行 | `read_by` / 人工确认 | ✅ 安全机制一致 |

### 🔬 值得借鉴的新模式

1. **双层感知**: 文本为主、视觉为辅的策略可应用到 UI 自动化（DOM 为主、截图为辅）

2. **Hard Rules 显式化**: 将系统约束从 implicit 变为 explicit checklist，可考虑在 AGENTS.md 中增加 "Non-Negotiables" 章节

3. **Editor Sub-Agent Brief**: 结构化 brief 模板，值得参考用于 complex task delegation:
   - INPUTS 明确输入
   - Common archetypes 提供模式库
   - RULES 约束行为
   - OUTPUT 格式规范

4. **动画并行生成**: sub-agent 独立 slot 目录 + 最终合并的模式，可用于多文件生成场景

5. **自评估上限**: 3-pass 上限防止无限循环，可应用到 Error Log 的自我修正机制

### 🎯 Skill 成熟度信号

video-use 的 SKILL.md 展现了高度成熟的 Agent Skill 设计:
- 长达 400+ 行的详细规范
- 工作示例 vs 硬性规则分离
- 多工具链集成 (ffmpeg/PIL/Manim/Remotion)
- 完整的错误预防清单

这表明 **Agent Skill 正在从简单工具调用演进为复杂领域工作流编排**。

---

## 相关资源

- GitHub: https://github.com/browser-use/video-use
- 主项目 browser-use: https://github.com/browser-use/browser-use (50k+ stars)
- 支持 Agent: Claude Code, Codex, Hermes, OpenClaw
