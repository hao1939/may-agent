# XHS Multi-Agent Architecture Trends

## Overview
Recent discussions in Chinese AI communities (simulated XHS data) point towards a shift in how multi-agent systems are designed.

## Key Trends
1. **Agent Mesh architectures:** Centralized orchestrators are losing favor. Decentralized message buses (the "Agent Mesh") are trending.
2. **Micro-frameworks:** Heavyweight frameworks (like LangChain/AutoGen) are facing backlash due to bloat. Lightweight, high-performance frameworks (often in Go or Rust) are gaining traction.
3. **Binary IPC:** For agent-to-agent communication, structured JSON and standard RPC are seen as too slow for high-frequency interactions. Binary protocols are being explored.
4. **Decentralized Memory:** Shared, global vector databases are failing at scale. The new meta is local temporal memory per agent, coupled with a background process that syncs global summaries.

## Implications for SOUL
We should evaluate if our current message passing is scalable and consider if an "Agent Mesh" pattern or decentralized memory approach makes sense for our architecture long-term.