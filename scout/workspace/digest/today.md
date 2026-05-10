### Anthropic Hacking Harness for Agents
**Source**: https://www.xiaohongshu.com/search_result/69dcc6870000000023022db9?xsec_token=ABOPAVxSvLgmo8F7i96McT9aGHcHRB9WMLv3PhS0pQFk0=&xsec_source=
**Summary**: Anthropic has introduced a new harness specifically targeting Agent-based systems, shifting the current paradigm.
**Implication**: Harness environments need robust integrations if we want our agents to interact seamlessly with newer Claude evaluations.
**KB**: KE-101 (new)

### Harness-Driven Substantive Evaluation
**Source**: Synthesis of Anthropic Agent Harness and XHS Evaluation Trends
**Summary**: External trends confirm that sandboxes are for procedural checks, while specialized "Harnesses" are required for substantive evaluation. 
**Implication**: Our current monolithic evaluator tries to judge substantive success from static transcripts, leading to false positives (like the ongoing `scout.good-session-rate-24h` crisis). We need to shift towards interactive harnesses in `agents/gym/scenarios/` for true outcome evaluation.
**KB**: KE-1044 (new)

### GitHub Trending AI Agents & Tools
**Source**: GitHub API (ai-agent, llm-agent, autonomous-agent)
**Summary**: Langflow leads with ~147k stars, followed closely by Hermes-agent (~142k). There's also a highly-starred compilation of system prompts for major AI coding tools (Cursor, Devin, Windsurf, etc.) with ~137k stars, and a collection of runnable AI Agent/RAG apps (awesome-llm-apps). Gemini-cli is also popular for terminal usage.
**Implication**: The community is heavily focused on low-code/no-code workflow builders (Langflow) and practical, deployable examples (awesome-llm-apps). The repository compiling system prompts for top coding agents is particularly valuable for understanding how commercial agents are instructed and structured.
**KB**: KE-1045 (new)

### The Convergence of Agent Tooling and Developer Prompts
**Source**: Synthesis of Anthropic Agent Harness (KE-1044) and Commercial Coding Prompts (KE-1045)
**Summary**: There is a clear convergence between *evaluation environments* (Anthropic's Harness) and *agent instructions* (commercial system prompts). The most effective agents are heavily instructed on how to use their specific environmental tools, while the most effective evaluations are built as specialized environments (harnesses) rather than generalized linting.
**Implication**: For the May-agent ecosystem, we cannot decouple the agent's system prompt from its evaluation environment. If we adopt substantive harnesses (KE-1044) to fix our evaluation metrics, we must simultaneously update the relevant agent system instructions (like dev's AGENTS.md) to explicitly train them on how to operate within those specific harnesses. The prompt and the harness are two sides of the same capability coin.
**KB**: KE-1046 (new)
