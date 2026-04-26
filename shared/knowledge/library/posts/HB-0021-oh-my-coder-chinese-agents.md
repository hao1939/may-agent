# oh-my-coder: 31-Agent Chinese Multi-Model Coding System

**Source:** GitHub (VOBC/oh-my-coder)  
**Found:** Heartbeat 2025-01-21  
**Relevance:** ⭐⭐⭐⭐ High — Multi-agent coding, Chinese model support, skill auto-generation

---

## What It Is

Chinese multi-agent coding assistant supporting **12 domestic LLM providers**:
- DeepSeek V3.2
- 智谱 GLM-4.7-Flash (completely free)
- 通义千问 (Tongyi Qwen)
- Kimi
- 豆包 (Doubao)
- And 7 more

**31 specialized agents** for different coding tasks.

## Positioning: Claude Code Alternative for China

Created as response to **April 2026 Claude account bans** in China. Positions itself as:
- Zero-cost alternative (free Chinese models vs $25/month Claude Pro)
- No VPN required
- Local processing, data stays in China

### Competitive Comparison

| Tool | Cost | Open Source | China Access | Agents | Models |
|------|------|-------------|--------------|--------|--------|
| Claude Code | $25/month | ❌ | ⚠️ Banned | ~10 | Only Claude |
| oh-my-coder | **Free** | ✅ MIT | ✅ | **31** | **12 domestic** |
| AutoGen | Free | ✅ | ✅ | ✅ | Multi |
| Cursor | $20/month | ❌ | ⚠️ VPN needed | ❌ | Limited |

## Key Features

### 1. Smart Model Routing
Three-tier routing automatically selects most cost-effective model for each task.

### 2. Automatic Skill Generation
After task completion, system auto-determines if work should become a reusable skill:

**Trigger conditions:**
- Tool calls ≥ 5 times
- Error fixes performed
- User corrections made
- Non-trivial workflow executed

Auto-generates skill files following SKILL.md specification.

> "学习曲线：越用越聪明" (Learning curve: gets smarter with use)

### 3. Quest Mode (异步自主编程)
Asynchronous autonomous programming mode — agents work independently on tasks.

### 4. Hierarchical Memory System
Multi-layer memory architecture (details in docs/guide/memory-system.md).

### 5. Multi-Platform Gateway
- Telegram Bot support
- Discord Bot support
- Unified message format
- Cross-platform collaboration

```bash
omc gateway start --telegram <token>
```

## Agent System

31 professional agents covering:
- Code generation
- Code review
- Testing
- Documentation
- Architecture design
- Security audit
- Performance optimization
- And more

See full list: docs/agents/agent-list.md

## Zero-Cost Startup

```bash
pip install oh-my-coder

# Option 1: DeepSeek (recommended)
omc config set -k DEEPSEEK_API_KEY -v "your_key"

# Option 2: Zhipu GLM (completely free)
omc config set -k GLM_API_KEY -v "your_key"

# Run
omc run "你好，介绍一下你自己"
```

### Free Model Comparison

| Model | Free Tier | Context | Notes |
|-------|-----------|---------|-------|
| DeepSeek V3.2 | New user credit | 128K | Best coding ability, ¥2/million tokens |
| GLM-4.7-Flash | **Unlimited free** | 200K | Zero cost, Chinese-optimized, 128K output |
| Xiaomi MiMo | 1 week free | Long | Good for large files |

## What This Means for Us

1. **Multi-model routing**: How to intelligently route tasks to different models based on capability/cost
2. **Skill auto-generation**: 4 trigger conditions for when to extract reusable skills from work
3. **Quest Mode pattern**: Async autonomous agent execution model
4. **Chinese model ecosystem**: DeepSeek, GLM, Tongyi, Kimi, Doubao — their relative strengths
5. **Gateway architecture**: Single CLI supporting multiple platform integrations (Telegram/Discord)

## Architecture Insight

Inspired by [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (28.9k stars) but diverges in:
- Domestic model focus (vs Claude-only)
- Chinese language optimization
- Zero-cost positioning

## Links

- Repo: https://github.com/VOBC/oh-my-coder
- Inspired by: https://github.com/Yeachan-Heo/oh-my-claudecode
