# Screenpipe – Persistent Agent Memory from Screen & Audio Recording

Date: 2026-07-23
Source: https://news.ycombinator.com/item?id=49024620
Repo: https://github.com/screenpipe/screenpipe

## Summary

Screenpipe (YC S26) continuously records a user's screen and audio locally, indexing everything into a local SQLite database. It exposes an API (port 3030) that AI agents can query to retrieve context about what the user has seen, said, or heard. The system uses OS accessibility trees + event-driven screenshots rather than brute-force OCR on every frame, reducing CPU to <1%.

## Key Design Choices

- **Event-driven capture**: listens for app switches, clicks, typing pauses, scrolling rather than continuous frame capture
- **Accessibility tree pairing**: pairs screenshots with OS accessibility data at same timestamp; OCR only when structured data unavailable
- **Local-first storage**: SQLite + mp4 + markdown files, all on-device
- **Agent interface**: local API with MCP support, skills system, and chat integration (Claude, ChatGPT, Hermes, Openclaw)
- **Privacy**: local PII redaction model (Apple MLX / Windows DirectML), app/window/URL filtering, recording schedules
- **Stack**: Rust core, MLX/ONNX for local models, <400 MB RAM target

## Agent Use Cases

1. Contextual augmentation: "gather all context about task X" for agent grounding
2. Activity retrieval: reconstruct work sessions from recordings
3. Persistent wiki maintenance: hourly organize activities into Obsidian vault
4. Event-driven automation: e.g., LinkedIn profile visit → CRM update
5. Automation discovery: analyze team recordings for repetitive patterns

## Relevance to AI-Agent Architecture

Screenpipe addresses a core agent bottleneck: grounding agents in what the user is actually doing across applications, without requiring per-app integrations. The "screen as universal API" approach contrasts with MCP/tool-calling which requires explicit per-tool wiring. The incremental personal-wiki pattern (inspired by Karpathy's LLM-maintained wiki) is notable for agent memory architectures.

## Tags

agent-memory, screen-context, local-first, accessibility-tree, personal-knowledge-base, automation-discovery

## 2026-08-25 update — separate temporal presence from semantic novelty

HN: https://news.ycombinator.com/item?id=49429095  
Repo: https://github.com/dragthelake/ambient-context  
Inspected commit: https://github.com/dragthelake/ambient-context/tree/496c5e6c6510251552b0649274538088e33a38ce

Ambient Context is a useful minimal counterpoint to Screenpipe. Instead of retaining screenshots, audio, or a query service, it polls the focused macOS Accessibility tree every five seconds, waits for a ten-second dwell, and appends blocks to one plain-Markdown file per day. Each block retains its time range and, when available, a document path or URL that lets a later agent reopen the authoritative source. The implementation writes an `AGENTS.md` beside the capture files so the representation explains itself to consumers.

The more reusable design signal is how its writer separates **temporal presence** from **semantic novelty**. A day-wide hash set admits each body line only once, including across restarts, but `append_block` still writes a timestamped heading and source reference when every line in a later block is a duplicate. This keeps a cheap activity timeline without repeatedly charging the same interface text to an LLM. It also creates a strict interpretation rule: body-line frequency is not evidence of dwell time or recurrence. Consumers must use block headings for presence and body text for first-seen content. Memory formats that deduplicate observations should expose those axes separately rather than silently collapsing both into one stream.

### Coverage and privacy boundaries

This representation trades coverage for inspectability. The README explicitly says Chromium/Electron trees can initially be thin and GPU-rendered terminals can expose little or no text; an HN commenter independently reports needing app-specific profiles with a similar Accessibility-first approach. A useful deployment artifact would therefore be a versioned per-application coverage census, not a blanket claim that the screen has been recorded.

The local privacy controls are real but bounded: Swift traversal skips secure text fields and refuses capture while the screen is locked; Rust drops named password-manager apps and window titles containing private-browsing markers, then regex-scrubs several credential and card-number shapes before writing. Those are denylist and pattern controls, not complete sensitive-content classification. The resulting Markdown remains a durable plaintext surveillance record readable by any process or agent with folder access. Local-first memory still needs explicit retention, reader authorization, and deletion policy.

### Evidence limit

This is source and implementation evidence from an early, unsigned macOS-only project, not a retrieval-quality, privacy, or resource benchmark. The repository's comment says cross-block repetition was 73% on one measured real day, but it publishes no corpus or evaluation protocol for that figure. Treat the two-channel encoding and coverage-census idea as testable architecture patterns, not established performance claims.
