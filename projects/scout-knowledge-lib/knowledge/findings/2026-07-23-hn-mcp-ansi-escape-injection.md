# ANSI Escape Injection in MCP Servers: Hidden from Humans, Visible to AI

Date: 2026-07-23
Source: https://brightsec.com/research/detecting-ansi-escape-sequence-injection-in-mcp-servers-with-dast/
HN: https://news.ycombinator.com/item?id=48989006

## Summary

BrightSec documents a novel attack class against MCP (Model Context Protocol) servers: ANSI escape sequences injected into tool responses that are invisible in terminal rendering but parsed by LLMs. The AI agent "sees" hidden instructions that human operators reviewing logs cannot detect — a steganographic prompt injection vector.

## Agent Relevance

This is a **supply-chain prompt injection** targeting the tool→model interface specifically in MCP architectures:

- Terminal rendering strips/interprets ANSI codes, so human log review misses the payload
- LLMs process raw text including escape sequences, receiving attacker-controlled hidden instructions
- Particularly dangerous for agents that aggregate tool outputs from multiple MCP servers (any one compromised server can inject)

## Attack Pattern

```
[MCP Server response with hidden ANSI payload]
  → Terminal display: looks normal to human reviewer
  → LLM input: contains hidden instructions (e.g., exfiltrate data, ignore safety)
```

## Mitigation Approaches

- Strip all ANSI escape sequences before passing tool outputs to LLMs
- Validate MCP server responses against an allowlist of safe characters
- DAST (Dynamic Application Security Testing) specifically targeting ANSI injection in MCP servers
- Defense-in-depth: don't rely solely on human log review for agent action auditing

## Implications for Agent Builders

1. **Trust boundary redefinition**: MCP tool responses are untrusted input even from "approved" servers
2. **Invisible prompt injection**: Extends the prompt injection threat model beyond visible text
3. **Audit gap**: Standard observability (logging, tracing) that renders ANSI will miss these attacks
4. **Sanitization layer needed**: Agents should sanitize all tool outputs at the protocol boundary

## Tags

agent-security, mcp, prompt-injection, ansi-escape, supply-chain-attack, steganography
