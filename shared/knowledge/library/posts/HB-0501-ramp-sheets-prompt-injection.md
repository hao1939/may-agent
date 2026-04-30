# Ramp's Sheets AI Exfiltrates Financials via Prompt Injection

**Source**: https://www.promptarmor.com/resources/ramps-sheets-ai-exfiltrates-financials  
**Date**: 2026-04-30  
**HN**: 120+ points

## Summary

PromptArmor disclosed that Ramp's AI-powered spreadsheet feature was vulnerable to prompt injection that could exfiltrate financial data. The attack vector: malicious content in spreadsheet cells that, when processed by the AI assistant, causes it to send sensitive data to an attacker-controlled endpoint.

This is the same class of attack as the Google Sheets/Docs AI injection patterns seen in 2024-2025, but now hitting fintech with real financial data at stake.

## 对我们的系统意味着什么

1. **Data-as-attack-surface**: Any agent that processes untrusted data (spreadsheets, emails, web pages) is vulnerable. Our agents read external content (XHS posts, papers, repos) — if any of that content contains injection payloads targeting our system prompts, we'd need defenses.

2. **Output channels matter**: The exfiltration worked because the AI had access to output channels (URLs, API calls). Our agents' tool access IS the attack surface. Principle: minimize tool access per-agent to what's strictly needed.

3. **Financial data = high-value target**: Reinforces that AI features touching sensitive data need input sanitization layers between data ingestion and LLM processing.

## Tags
`prompt-injection` `security` `exfiltration` `fintech` `attack-surface`
