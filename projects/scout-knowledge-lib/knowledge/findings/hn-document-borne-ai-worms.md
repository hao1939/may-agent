# Document-Borne AI Worms Self-Propagate Through Copilot for Word

Date: 2026-07-29
Source: https://enklypesalt.com/posts/context-collapse-part3-ai-worming-through-word/
HN: https://news.ycombinator.com/item?id=49096188

## Summary

Research demonstrating that AI worms can propagate autonomously through
Microsoft Copilot for Word by embedding adversarial prompts in shared documents.
When a user opens an infected document with Copilot active, the agent executes
the embedded instructions and can propagate the payload into other documents the
user creates or edits — creating a self-replicating chain without user action.

## Relevance to AI Agents

- **Agent security**: Shows that document-grounded agents (RAG over shared files)
  create a new attack surface — prompt injection becomes self-propagating malware.
- **Trust boundary failure**: The agent treats document content as instructions,
  collapsing the data/control plane distinction.
- **Contrast with Codex Security**: OpenAI's codex-security framework addresses
  code-generation policy; this attack targets the *input context* of productivity
  agents — a complementary threat vector.

## Tags

agent-security, prompt-injection, worm, copilot, rag-poisoning
