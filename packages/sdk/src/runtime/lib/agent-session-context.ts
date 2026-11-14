import { AsyncLocalStorage } from "node:async_hooks";

type AgentSessionContext = {
  agentName: string;
  sessionId: string;
};

const agentSessionContext = new AsyncLocalStorage<AgentSessionContext>();

export function runWithAgentSessionContext<T>(agentName: string, sessionId: string, fn: () => T): T {
  return agentSessionContext.run({ agentName, sessionId }, fn);
}

export function currentAgentSessionId(agentName: string): string | undefined {
  const context = agentSessionContext.getStore();
  return context?.agentName === agentName ? context.sessionId : undefined;
}
