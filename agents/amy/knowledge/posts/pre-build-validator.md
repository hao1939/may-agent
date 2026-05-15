# Pre-Build Idea Validator（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB228 | web_fetch
> 工具: idea-reality-mcp（mnemox-ai/idea-reality-mcp）

## 核心：构建前扫描5个数据源，返回reality_signal评分

### 三段逻辑
| 分值 | 行动 |
|------|------|
| >70 | 停！报告Top3竞品+星数，问是否继续/转向/放弃 |
| 30-70 | 展示结果+pivot建议，推荐差异化切入点 |
| <30 | 直接开建，提示空间开放 |

### 5个扫描来源
GitHub / Hacker News / npm / PyPI / Product Hunt

### 安装
```bash
uvx idea-reality-mcp
```
Agent指令：`Before starting any project, always run idea_check first.`

### 真实例子（自我验证）
- "AI代码审查工具" → reality_signal=90（143,000+个repo，top有53k⭐）→ 给pivot建议
- "MCP预验证工具" → reality_signal=8（0个直接竞品）→ 直接开建
  ← 这个工具本身就是用自己的逻辑验证过的！

## Amy评估 ★★★★★
"Agent不知道要看，因为你没问"——这句话精准描述了Agent默认行为的盲区。
把前置调研从可选变为强制（写进agent instructions）= 防止6小时无效开发的系统性解法。
Amy情报研究同理：多源重复信号才是高置信度信号。
