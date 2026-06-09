/**
 * HMAC tool receipt helpers and a small tool wrapper compatibility layer.
 */

import { createHmac, randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import { sessionDir } from "./persistence.js";
import type { BeforeToolCallContext, BeforeToolCallResult } from "./tools/compose-guards.js";

const RUNTIME_RECEIPT_SECRET = randomUUID();

export const COST_SIGNAL_DURATION_MS = 2000;
export const COST_SIGNAL_BYTES = 10000;

export function signToolOutput(output: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const hmac = createHmac("sha256", RUNTIME_RECEIPT_SECRET)
    .update(output + timestamp)
    .digest("hex")
    .slice(0, 8);
  return `${output}\n[SIG: ${timestamp}:${hmac}]`;
}

export function verifyToolOutput(content: string, signature: string): boolean {
  const sepIdx = signature.indexOf(":");
  if (sepIdx === -1) return false;
  const timestamp = signature.slice(0, sepIdx);
  const hash = signature.slice(sepIdx + 1);
  if (!timestamp || !hash) return false;
  const expected = createHmac("sha256", RUNTIME_RECEIPT_SECRET)
    .update(content + timestamp)
    .digest("hex")
    .slice(0, 8);
  return expected === hash;
}

export function createVerifyReceiptTool(): AgentTool {
  return {
    name: "verify_receipt",
    label: "Verify Receipt",
    description: "Verify that a tool output is authentic and not hallucinated. Returns VALID or INVALID.",
    parameters: Type.Object({
      content: Type.String({
        description: "The exact content of the tool output before the [SIG: ...] line.",
      }),
      signature: Type.String({ description: "The timestamp:hash signature string." }),
    }),
    execute: async (_toolCallId, params) => {
      const { content, signature } = params as { content: string; signature: string };
      const text = verifyToolOutput(content, signature) ? "VALID" : "INVALID";
      return { content: [{ type: "text", text }], details: text };
    },
  };
}

export interface ReceiptWrapContext {
  activeSessions: Map<string, any>;
  persistDir?: string;
  sessionDir?: string;
  agentName?: string;
  beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;
}

export function wrapToolsWithReceipts(tools: AgentTool[], sessionId: string, ctx: ReceiptWrapContext): AgentTool[] {
  const getSession = () => ctx.activeSessions.get(sessionId);

  return tools.map((tool) => ({
    ...tool,
    execute: async (
      toolCallId: string,
      params: any,
      signal?: AbortSignal,
      onUpdate?: any,
    ): Promise<AgentToolResult<any>> => {
      let guardWarning: string | undefined;

      if (ctx.beforeToolCall) {
        const session = getSession();
        const guardCtx: BeforeToolCallContext = {
          toolCall: { name: tool.name, id: toolCallId },
          args: params ?? {},
          context: { messages: session?.agent?.state?.messages ?? [] },
        };
        const guardResult = await ctx.beforeToolCall(guardCtx, signal);
        if (guardResult?.block) {
          const blockedText = guardResult.reason;
          const signed = signToolOutput(blockedText);
          const sigTag = signed.slice(blockedText.length);

          if (guardResult.redirect && session?.agent?.steer) {
            session.agent.steer({
              role: "user",
              content: [{
                type: "text",
                text:
                  `Guard redirect: The "${guardResult.redirect.workflow}" workflow is recommended.\n\n` +
                  `Reason: ${guardResult.reason}\n\n` +
                  `Run: workflow("${guardResult.redirect.workflow}", "${guardResult.redirect.task}")`,
              }],
              timestamp: Date.now(),
              source: "system",
            } as any);
          }

          return {
            content: [
              { type: "text", text: `<tool_output name="${tool.name}">` },
              { type: "text", text: blockedText },
              { type: "text", text: sigTag },
              { type: "text", text: "</tool_output>" },
            ],
            details: undefined,
          };
        }

        if (guardResult?.steer && session?.agent?.steer) {
          session.agent.steer({
            role: "user",
            content: [{ type: "text", text: guardResult.steer }],
            timestamp: Date.now(),
            source: "system",
          } as any);
        }
        if (guardResult) guardWarning = guardResult.reason;
      }

      const startedAt = Date.now();
      const result = await tool.execute(toolCallId, params, signal, onUpdate);
      const durationMs = Date.now() - startedAt;
      const outputText = result.content.map((block: any) => (block?.type === "text" ? block.text : "")).join("");
      const signed = signToolOutput(outputText);
      const sigTag = signed.slice(outputText.length);
      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);

      try {
        const receiptDir = ctx.sessionDir ?? (ctx.persistDir ? sessionDir(ctx.persistDir, sessionId) : undefined);
        if (receiptDir) {
          appendFileSync(
            join(receiptDir, "receipts.jsonl"),
            JSON.stringify({
              toolName: tool.name,
              toolCallId,
              signature: sigMatch?.[1] ?? "",
              timestamp: new Date().toISOString(),
            }) + "\n",
            "utf-8",
          );
        }
      } catch {
        // Receipt logs are best-effort; never fail a tool because audit logging failed.
      }

      const outputBytes = outputText.length;
      const costSignal = durationMs > COST_SIGNAL_DURATION_MS || outputBytes > COST_SIGNAL_BYTES
        ? `\n\n<system_note>[COST: ${durationMs}ms, ${(outputBytes / 1024).toFixed(1)}KB]</system_note>`
        : "";
      const evidenceAttr = ["read", "bash", "agents"].includes(tool.name) ? ` evidence="true"` : "";
      const content = [
        { type: "text" as const, text: `<tool_output name="${tool.name}"${evidenceAttr}>` },
        ...result.content,
        { type: "text" as const, text: sigTag },
      ];
      if (costSignal) content.push({ type: "text", text: costSignal });
      if (guardWarning) content.push({ type: "text", text: `\n\n${guardWarning}` });
      content.push({ type: "text", text: "</tool_output>" });

      return { ...result, content };
    },
  }));
}
