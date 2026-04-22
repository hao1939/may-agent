# Agent CLI Research — Journal

## 2026-04-22 — Project Created
- Goal: learn from Claude Code, Gemini CLI, Codex CLI
- Three research tracks: scout (papers/GitHub), amy-kimi (Xiaohongshu), bob (synthesis)
- Plus hands-on: install and try each one
- Key question: what patterns can we adopt to improve our agent system?
### Iteration 1 (comment) — 2026-04-22T10:31:52.134Z
**Comment**: - [2026-04-22 hao] The PRIMARY goal is to USE these CLIs as tools, not just study them. Our agents can call them via bash. Agent decides what to fix, CLI does the coding. This solves the src/ access problem — the CLI runs in the repo with full access. Research HOW to invoke them (flags, input format, output parsing), then integrate.
**Reviewer**: CONTINUE — **(a) Concrete output:** A research document at `.state/cli-integration-research.md` covering invocation patterns for Claude Code (`claude`), Gemini CLI (`gemini`), and OpenAI Codex CLI (`codex`), plus a proof-of-concept bash script at `.state/cli-invoke.sh` that attempts to call whichever CLI is available.

**(b) What's different:** First attempt.

**(c) First step:** Run these commands to check what's already installed and discover invocation patterns:
```bash
which claude gemini codex 2>&1; claude --help 2>&1 | head -40; gemini --help 2>&1 | head -40; codex --help 2>&1 | head -40; npm list -g 2>&1; pip list 2>&1 | grep -i -E 'claude|gemini|codex|anthropic|openai|google'
```

Then based on findings, research the non-interactive/programmatic invocation mode for each (e.g., `claude -p "prompt"` for Claude Code, `codex -q "prompt"` for Codex CLI). Document input flags, how to pass prompts via stdin/args, and how to capture structured output. If none are installed, try `npm install -g @anthropic-ai/claude-code` or similar. The key deliverable is knowing exactly how to invoke each CLI non-interactively from a bash call.

