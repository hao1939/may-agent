# Repository: agent-memory-consolidation
GitHub: github.com/memorylab/agent-memory-consolidation
Stars: 340 | License: MIT | Last commit: 2 days ago

## Description
Implementation of episodic memory consolidation for LLM agents. During idle periods, the agent reviews recent episodic memories and consolidates them into semantic memory through a "sleep-like" process. Inspired by human memory consolidation during sleep.

## Key Features
- **Consolidation Loop**: Periodically reviews episodic buffer, extracts patterns, stores as semantic knowledge
- **Forgetting Curve**: Implements Ebbinghaus-inspired decay — unconsolidated memories fade, consolidated ones persist
- **Priority Replay**: Important experiences are replayed more often during consolidation (like hippocampal replay)
- **Integration with LangChain and CrewAI**: Drop-in memory backend

## README mentions
- "Based on concepts from 'Dual-Trace Memory Encoding for Agent Systems' (arXiv:2604.09800)"
- "Extends MemGPT's virtual memory with active consolidation"
- "See also: 'Sleep-Wake Cycles in AI Agent Architectures' (blog post by Dr. Nina Petrova)"
