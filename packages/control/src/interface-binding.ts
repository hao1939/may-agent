/** Installation-selected identities. Agent identity and App address are independent. */
export interface InterfaceBinding {
  agent: string;
  appId?: string;
  conversationId?: string;
}

export function interfaceBinding(
  env: Record<string, string | undefined> = process.env,
  agentOverride?: string,
): InterfaceBinding {
  const agent = agentOverride?.trim() || env.AGENT?.trim() || env.DAEMON_AGENT?.trim() || "host";
  const appId = env.CONVERSATION_APP?.trim();
  const conversationId = env.CONVERSATION_ID?.trim();
  if (conversationId && !appId) throw new Error("CONVERSATION_ID requires CONVERSATION_APP");
  return { agent, ...(appId ? { appId, conversationId: conversationId || `${appId}:primary` } : {}) };
}
