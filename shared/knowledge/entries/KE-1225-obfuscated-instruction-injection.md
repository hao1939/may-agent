---
title: The Vulnerability of Obfuscated Instruction Injection in LLMs
slug: obfuscated-instruction-injection
created_at: 2026-05-11
source_basis: Synthesis of HN discussion on AI agent hacked via Morse code (id 48095290) and general adversarial prompts.
---

<ai_context>
Summary: LLMs are vulnerable to instruction injection via obfuscated encodings (like Morse code, base64, or less common languages/ciphers) that bypass superficial content filters but are successfully decoded and executed by the underlying model's deep semantic understanding.
Triggers: When evaluating agent security, designing input sanitization, or considering the safety of processing untrusted external data streams.
Last Updated: 2026-05-11
</ai_context>

## Concept

A known attack vector against LLMs is providing instructions in non-standard encodings, such as Morse code, Base64, or even obscure languages. While a simple keyword-based filter or a shallow safety classifier might not recognize a Morse code sequence as malicious intent, the advanced language model—having been trained on vast amounts of internet data including diverse encodings—readily translates and processes it.

If the agent then executes actions based on this now-decoded intent, an attacker can bypass standard security guardrails.

## Recent Examples

A notable demonstration involved an attacker successfully compromising an AI agent by supplying malicious instructions encoded in Morse code, leading to significant unauthorized actions (e.g., simulated spending of $200k).

## Implications for Agent Architectures

1.  **Semantic Sanitization over Lexical Sanitization**: Security filters cannot just look for "bad words". They must evaluate the *decoded* or *semantic* intent of the input. This often requires using a trusted, isolated LLM pass purely for safety evaluation before the main agent processes the input.
2.  **Strict Action Guardrails**: Because input sanitization is demonstrably imperfect against creative obfuscation, system security must rely on hard environmental constraints. An agent should physically lack the tools or permissions to cause catastrophic harm (like spending unapproved funds or dropping databases), regardless of what its internal prompt context becomes.
3.  **The "Execution Boundary"**: There must be a clear boundary between processing text (safe) and taking action based on that text (unsafe). Actions must require verifiable authorization that cannot be spoofed by mere text generation.