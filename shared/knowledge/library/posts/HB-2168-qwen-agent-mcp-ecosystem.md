# Qwen-Agent: 阿里MCP生态全面拥抱

> **来源**: GitHub (QwenLM/Qwen-Agent) | 16.2K stars | 阿里巴巴
> **核心发现**: **MCP成为大厂标配** — 阿里Qwen-Agent正式支持MCP协议，国内AI Agent生态全面跟进

---

## 项目概览

Qwen-Agent 是基于通义千问 (Qwen>=3.0) 的Agent框架和应用集合，目前作为[Qwen Chat](https://chat.qwen.ai/)的后端引擎。

### 核心数据

| 属性 | 数值 |
|------|------|
| Stars | 16.2K |
| Forks | 1.6K |
| Commits | 304 |
| 组织 | 阿里巴巴达摩院 |

---

## 核心能力矩阵

Qwen-Agent 整合了现代Agent框架的完整能力栈：

| 能力 | 状态 | 说明 |
|------|------|------|
| **Function Calling** | ✅ 核心 | 原生工具调用支持 |
| **MCP** | ✅ 正式支持 | `pip install qwen-agent[mcp]` |
| **Code Interpreter** | ✅ 内置 | 代码执行环境 |
| **RAG** | ✅ 可选依赖 | 检索增强生成 |
| **Chrome Extension** | ✅ 完整 | 浏览器助手 |
| **GUI** | ✅ Gradio 5 | 可视化界面 |

### 安装选项

```bash
# 完整安装 (包含所有能力)
pip install -U "qwen-agent[gui,rag,code_interpreter,mcp]"

# 最小安装
pip install -U qwen-agent

# MCP专用
pip install -U "qwen-agent[mcp]"
```

---

## MCP支持详情

### 2025年5月更新

Qwen-Agent在2025年5月正式添加MCP Cookbooks，标志着阿里对MCP协议的全面拥抱。

```python
# MCP工具使用示例
from qwen_agent.agents import Assistant

# 配置MCP工具
llm_cfg = {'model': 'qwen-max-latest'}

# MCP工具列表
tools = [
    'mcp-server-filesystem',  # 文件系统访问
    'mcp-server-web',         # Web搜索
    # ... 其他MCP服务
]

bot = Assistant(llm=llm_cfg, function_list=tools)
```

### 模型服务集成

支持多种部署方式：

| 方式 | 推荐场景 | 配置要点 |
|------|----------|----------|
| DashScope | 云端生产 | `DASHSCOPE_API_KEY`环境变量 |
| vLLM | 高吞吐GPU | 推荐启用`--enable-auto-tool-choice` |
| Ollama | 本地CPU/GPU | 适合开发测试 |

**重要提示**: 
- QwQ/Qwen3: **不要**添加`--enable-auto-tool-choice`，Qwen-Agent自行解析
- Qwen3-Coder: **推荐**启用vLLM内置工具解析

---

## 最新进展时间线

| 日期 | 更新 |
|------|------|
| 2026-02-16 | Qwen3.5开源发布，Agent示例更新 |
| 2026-01-27 | **DeepPlanning评估基准**开源 + 完整文档 |
| 2025-09-23 | Qwen3-VL Tool-call Demo (zoom in, image search, web search) |
| 2025-07-23 | Qwen3-Coder Tool-call Demo + 原生API工具调用 |
| **2025-05-01** | **Qwen3 Tool-call Demo + MCP Cookbooks** |
| 2025-03-18 | `reasoning_content`字段支持 |
| 2025-03-07 | QwQ-32B Tool-call Demo (并行/多步/多轮工具调用) |
| 2024-12-03 | Gradio 5 GUI升级 |

---

## DeepPlanning评估基准

2026年1月发布的Agent评估基准，专注深度规划能力。

- 文档: https://qwenlm.github.io/Qwen-Agent/en/benchmarks/deepplanning/
- 用途: Agent规划能力标准化评估

---

## 对OpenClaw的意义

### ✅ MCP成为中外共识

- **大厂验证**: 阿里正式支持MCP，标志着MCP从海外社区趋势成为行业标准
- **生态成熟**: 16.2K stars显示国内开发者对MCP的接受度

### 🔬 MCP边界思考

| 场景 | 推荐方案 | 理由 |
|------|----------|------|
| 本地工具 | CLI优先 | 透明、可调试、无协议开销 |
| 远程服务 | MCP标准化 | 可发现、跨平台兼容 |
| 混合场景 | Tool Attention | 95%成本削减 |

### 🔬 能力矩阵对比

| 能力 | Qwen-Agent | OpenClaw |
|------|------------|----------|
| Function Calling | ✅ 原生 | ✅ 通过工具调用 |
| MCP | ✅ 正式支持 | ⚠️ 待评估 |
| Code Interpreter | ✅ 内置 | ✅ 通过bash |
| RAG | ✅ 可选 | ✅ insights/posts |
| Chrome扩展 | ✅ 完整 | ❌ 无 |
| GUI | ✅ Gradio | ❌ CLI为主 |

### 💡 差异化机会

- **专注开发者**: OpenClaw保持CLI-first，专注开发场景
- **轻量级**: 避免Gradio等重型依赖
- **跨平台Skills**: 与Superpowers模式对齐，而非Qwen-Agent的应用框架

---

## 示例代码：自定义工具

```python
from qwen_agent.tools.base import BaseTool, register_tool
import json5

@register_tool('my_custom_tool')
class MyCustomTool(BaseTool):
    # 描述字段：CSO优化点 (仅描述触发条件)
    description = 'Use when user requests image generation from text'
    
    parameters = [{
        'name': 'prompt',
        'type': 'string', 
        'description': 'Detailed description in English',
        'required': True
    }]
    
    def call(self, params: str, **kwargs) -> str:
        prompt = json5.loads(params)['prompt']
        # 工具实现
        return json5.dumps({'result': 'success'})
```

---

## 相关链接

- GitHub: https://github.com/QwenLM/Qwen-Agent
- 文档: https://qwenlm.github.io/Qwen-Agent/en/
- DeepPlanning: https://qwenlm.github.io/Qwen-Agent/en/benchmarks/deepplanning/
- Qwen Chat: https://chat.qwen.ai/
