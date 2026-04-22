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

### Iteration 2 — 2026-04-22T10:33:19.459Z
**Worker**: Now I have all the info needed. Let me create the deliverables.
**Reviewer**: CONTINUE — The worker said "Now I have all the info needed. Let me create the deliverables" but I need to verify what actually exists.

**(a) Concrete output:** `.state/cli-integration-research.md` with full research findings, and `.state/cli-invoke.sh` proof-of-concept script.

**(b) What's different:** Previous iteration may not have produced files. This time, start by checking what exists, then fill gaps.

**(c) First step:** Run:
```bash
ls -la .state/cli-integration-research.md .state/cli-invoke.sh 2>&1; cat .state/cli-integration-research.md 2>&1 | head -80; which claude gemini codex 2>&1; claude --help 2>&1 | head -30; gemini --help 2>&1 | head -30; codex --help 2>&1 | head -30
```

If the research doc doesn't exist or is incomplete, create it covering: (1) Claude Code: `claude -p "prompt"` for non-interactive, `--output-format json` for structured output, `--allowedTools` for permissions; (2) Gemini CLI: `gemini -p "prompt"` or similar; (3) Codex CLI: `codex -q "prompt"`. For each, document: install command, non-interactive invocation, how to pipe prompts, output format. Then write `cli-invoke.sh` that detects which CLI is available and runs a simple test prompt. If a CLI is installed, actually run it on a trivial task like "echo hello world in python" to prove integration works — that would complete the **Research** and **Install** milestones.

### Iteration 3 — 2026-04-22T10:34:33.980Z
**Worker**: Now update the Codex invocation in the script:
**Reviewer**: CONTINUE — **(a) Concrete output:** `.state/cli-integration-research.md` and `.state/cli-invoke.sh` — both fully written with real content.

**(b) What's different:** Previous iterations the worker kept saying "let me create" but may not have finished. This time: single atomic step — check what exists, then produce everything in one shot. No multi-step planning.

**(c) First step:** Run this single command block to check current state and act:
```bash
cat .state/cli-integration-research.md 2>&1 | wc -l; cat .state/cli-invoke.sh 2>&1 | wc -l; which claude gemini codex 2>&1; claude -p "say hello" --output-format json 2>&1 | head -20
```

If the files don't exist or are empty, create them NOW in the same step. The research doc should cover what we already know from iteration 1 discovery (`claude` is installed, use `claude -p "prompt"` with `--output-format json`). Then actually invoke `claude -p "Write a Python function that returns the sum of two numbers" --output-format json 2>&1 | head -50` to prove it works. That single successful invocation completes **Research** and **Install** milestones. Capture the output in the research doc as evidence.

### Iteration 4 — 2026-04-22T10:37:37.241Z
**Worker**: No API keys configured. Let me update the research doc with this finding and update the invoke script to fix the root issue.
**Reviewer**: BLOCKED — The worker has confirmed across multiple iterations that no API keys are configured for any of the CLIs (Claude Code, Gemini CLI, OpenAI Codex). These are external paid services requiring authentication credentials that cannot be generated by the worker.

**Specific blockers:**
- `ANTHROPIC_API_KEY` not set → `claude` CLI cannot make API calls
- `GOOGLE_API_KEY` / `GEMINI_API_KEY` not set → `gemini` CLI cannot function
- `OPENAI_API_KEY` not set → `codex` CLI cannot function

No amount of iteration will resolve this without a human providing at least one valid API key as an environment variable.

