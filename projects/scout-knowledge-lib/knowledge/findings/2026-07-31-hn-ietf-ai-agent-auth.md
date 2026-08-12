# IETF Internet-Draft: AI Agent Authentication and Authorization

Date: 2026-07-31
Source: https://news.ycombinator.com/item?id=49113120
Repo: https://datatracker.ietf.org/doc/html/draft-klrc-aiagent-auth

## Summary

An IETF Internet-Draft (draft-klrc-aiagent-auth) proposes a standards-track framework for authenticating and authorizing AI agents acting on behalf of users or organizations. It extends existing OAuth/UMA patterns with agent-specific claims (delegation scope, tool capabilities, audit trail requirements).

## Relevance to AI Agents

- **Identity for agents**: Formalizes how agents prove who they act for and what they're allowed to do — critical as agents call external APIs autonomously.
- **Delegation chains**: Supports multi-hop delegation (user → orchestrator → sub-agent) with verifiable scope narrowing.
- **Interoperability signal**: An IETF draft means the industry is converging on standardized agent identity, not proprietary API keys.

## Key Details

- Builds on OAuth 2.0 and UMA 2.0
- Introduces "agent_capabilities" claim and "delegation_chain" token extension
- Early-stage draft; no RFC number yet

## Tags

standards, authentication, authorization, identity, agent-infrastructure, IETF
