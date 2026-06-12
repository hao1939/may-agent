<ai_context>
Scout knowledge file: Multi-Agent Coordination Frameworks Overview (2026)
</ai_context>

# Multi-Agent Coordination Frameworks Overview (2026)

## Trending Repositories (GitHub)

1.  **LobeHub (lobehub/lobehub)**
    *   **Description:** Focuses on treating agents as the unit of work interaction, emphasizing team design and collaborative harness spaces.
    *   **Trend:** Shifting from single chatbot interfaces to multi-agent collaborative workspaces.

2.  **Deer-Flow (bytedance/deer-flow)**
    *   **Description:** A long-horizon SuperAgent harness by ByteDance. Features sandboxes, memories, tools, skills, subagents, and a message gateway. Built for tasks taking minutes to hours.
    *   **Insight:** Highlights the need for robust infrastructure (sandboxes, message gateways) for long-running, multi-step tasks.

3.  **CowAgent (zhayujie/CowAgent)**
    *   **Description:** WeChat-centric super AI assistant framework. Emphasizes active thinking, task planning, OS access, skill creation/execution, and long-term memory.
    *   **Insight:** Extremely popular in the Chinese ecosystem due to its integrations (WeChat, DingTalk, Feishu) and support for local/Chinese models (DeepSeek, Qwen, GLM).

4.  **LibreChat (danny-avila/LibreChat)**
    *   **Description:** Feature-rich clone/alternative supporting MCP, Agents, and massive model variety.
    *   **Trend:** Unification of diverse model backends and agent protocols (like MCP) under single UI surfaces.

5.  **OpenAI Agents Python (openai/openai-agents-python)**
    *   **Description:** OpenAI's lightweight framework for multi-agent workflows.
    *   **Insight:** Official tooling from major players validating the multi-agent orchestration pattern.

## Key Takeaways for SOUL Architecture
*   **Message Gateways & Sandboxes:** Seen in `deer-flow`, complex tasks require isolated execution environments and robust inter-agent message routing.
*   **Extensibility via Protocols:** Adoption of MCP (Model Context Protocol) is increasing for standardizing tool/resource access across diverse agent frameworks.
*   **Long-Term Memory + Active Planning:** Systems are moving past reactive query-response into proactive planning and persistent context accumulation.
