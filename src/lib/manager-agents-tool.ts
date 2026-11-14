import { ExecutionDeferredError, type AppRead } from "@may-agent/sdk";
import { Type, type Static } from "typebox";
/**
 * Agents tool — bounded calls, helper follow-up, inspection and cancellation.
 *
 * Takes manager dependencies as parameters to avoid circular imports.
 */

import type { AgentMessage, AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";
import type { RegisteredAgent } from "./manager-utils.js";
import type { SessionInfo, SubagentDefinition, TaskResult } from "./types.js";
import type { PersistedSession, TaskBinding } from "./persistence.js";
import { getDb } from "./db/connection.js";
import { agentExecutionResult, deferredExecutionResult, workflowExecutionResult } from "./execution-handoff.js";
import type { ExecutionScope } from "./execution-scope.js";
import { readIdentity } from "./instance-identity.js";
import type { RuntimeCtx } from "./runtime-ctx.js";
import type { TaskExecutionContext } from "./task-execution-context.js";
import {
  resolveCallable,
  type PreparedCatalog,
} from "../../packages/sdk/src/workflow-kernel.js";
import { buildWorkflowCatalog } from "./workflow-catalog.js";
import { createWorkflowRunner } from "./workflow-tool.js";
import type { WorkflowEvent } from "./workflow.js";
import type { EventTrace } from "../app/core/events/bus.js";
import { join } from "node:path";

// ── Manager interface ──────────────────────────────────────────────────
// Instead of importing the full SubagentManager class (circular dependency),
// we define only the methods/properties the agents tool needs.

export interface AgentsToolManagerDeps {
  agents: ReadonlyMap<string, RegisteredAgent>;
  getAgentDefinition(name: string, callerSessionId?: string): SubagentDefinition | undefined;
  activeSessions: ReadonlyMap<
    string,
    {
      definition?: SubagentDefinition;
      parentSessionId?: string;
      originSessionId?: string;
      workflowRunId?: string;
      projectId?: string;
      requestId?: string;
      trace?: EventTrace;
      taskBinding?: TaskBinding;
      taskContext?: TaskExecutionContext;
      executionScope?: ExecutionScope;
    }
  >;
  callAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string; workflowRunId?: string; projectId?: string; source?: string; trace?: EventTrace; parseSkillCommand?: boolean; signal?: AbortSignal },
  ): Promise<TaskResult & { messages: AgentMessage[] }>;
  runAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string; originSessionId?: string; source?: string; requestId?: string; workflowRunId?: string; projectId?: string; trace?: EventTrace; parseSkillCommand?: boolean; signal?: AbortSignal },
  ): string;
  status(): SessionInfo[];
  progress(sessionId: string, limit?: number): AgentMessage[];
  hasActiveSession(sessionId: string): boolean;
  cancel(sessionId: string): void;
  followUpHelper(sessionId: string, text: string, callerSessionId?: string): void;
  getSessionSummary(sessionId: string): { task: string; summary: string; status: string };
  getWorkflowSteps(workflowRunId: string): Array<{ step: string; sessionId: string; summary: string }>;
  registry: {
    persistDir: string;
    getSession(sessionId: string): PersistedSession | null;
  };
}
export interface CreateAgentsToolOptions {
  /** Returns the current caller's session ID for parent→child linking. */
  getCallerSessionId?: () => string | undefined;
  /** Returns the current caller's agent name. */
  getCallerAgentName?: () => string | undefined;
  /** Agent names that cannot be called directly. Returns error with hint. */
  callDeny?: { agents: string[]; hint: string };
  validateControl?: (sessionId: string, callerSessionId?: string) => void;
  /** Optional runtime context for executing code procedures via action: "call". */
  runtimeCtx?: RuntimeCtx;
  /** Optional App read factory for code procedures invoked via action: "call". */
  createRead?: (taskContext?: TaskExecutionContext) => AppRead;
  onWorkflowEvent?: (event: WorkflowEvent) => void;
}

// ── Main export ────────────────────────────────────────────────────────

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

const AgentsToolParams = Type.Object({
  action: StringEnum(
    ["call", "fork", "follow-up", "context", "list", "peek", "cancel", "sessions"] as const,
    {
      description: [
        "'call': run an agent synchronously and get the result (blocks your session until the agent finishes). Creates a child session in your call tree. Returns id, kind, status, summary and output/facts; inspect evidence before accepting the contribution.",
        "'fork': start a bounded helper owned by your live execution. Returns sessionId. Inspect its result before finishing; unfinished helpers stop with you. Durable work belongs to a Task.",
        "'context': query session context — parent's summary, origin session, workflow steps. Use when you need more context than your task provides.",
        "'list': show all available agents with descriptions and any running sessions.",
        "'peek': view recent messages from a running session (requires sessionId).",
        "'follow-up': send a correction or additional context to your running helper using its returned sessionId and content. Queued for consideration; does not create new work or prove the correction was applied. Durable requirement changes belong in Task input; existing Task feedback already reaches active helpers.",
        "'cancel': request cancellation through the owning runtime (requires sessionId).",
        "'sessions': query persisted execution sessions (optionally filter by agent or status).",
        "Durable cross-App work belongs to an App Task request. To update a helper, use 'follow-up' with its sessionId, not its agent name.",
      ].join(" "),
    },
  ),
  agent: Type.Optional(
    Type.String({
      description:
        "Target agent or code procedure name (e.g. 'reviewer' or 'may/evaluation-report-intake'). Required for 'call' and 'fork'. Optional for 'sessions' (filters by agent). Use 'list' first to see available targets if unsure.",
    }),
  ),
  task: Type.Optional(
    Type.String({
      description:
        "Task description for prompt agents ('call' or 'fork'). Give the outcome, constraints, and relevant file references; the receiver chooses its method. The agent runs to completion and returns a summary (call) or session id (fork).",
    }),
  ),
  input: Type.Optional(
    Type.Unknown({
      description:
        "Structured input payload for code procedures on 'call' (or string prompt input).",
    }),
  ),
  sessionId: Type.Optional(
    Type.String({ description: "Session ID for 'peek', 'follow-up' or 'cancel'. Use the exact ID returned by 'fork' for helper follow-up." }),
  ),
  content: Type.Optional(Type.String({ description: "Correction or additional context for 'follow-up'. Does not expand the helper's authority." })),
  limit: Type.Optional(
    Type.Number({
      description:
        "Max items to return. For 'peek': messages (default: 20). For 'sessions': records (default: 50). Increase to see more.",
    }),
  ),
  filter: Type.Optional(
    StringEnum(["active", "stale", "failed", "all"] as const, {
      description:
        "Filter for 'sessions' action. 'active': running. 'stale': running for >2h. 'failed': terminal errors. 'all': everything. Default: 'active'.",
    }),
  ),
  context_files: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "For 'call'/'fork': file paths the receiver must read for context. Appended as references, not contents. A full SKILL.md path readable in the receiver's environment works even outside its skill catalog.",
    }),
  ),
  success_criteria: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "For 'call'/'fork': bullet points describing how to verify the task is done correctly. Appended to the delegated session task.",
    }),
  ),
  scope: Type.Optional(
    StringEnum(["parent", "origin", "root", "workflow"] as const, {
      description:
        "For 'context': what to query. 'parent' (default): caller's session summary. 'origin': the session that forked this tree. 'root': top of the call tree. 'workflow': all completed workflow steps.",
    }),
  ),
});

type AgentsToolParamsType = Static<typeof AgentsToolParams>;

function appendContextFiles(task: string, contextFiles?: string[], successCriteria?: string[]): string {
  const parts = [task];

  if (contextFiles && contextFiles.length > 0) {
    parts.push(
      "",
      "Context files the receiving agent must read before acting:",
      ...contextFiles.map((file) => `- ${file}`),
    );
  }

  if (successCriteria && successCriteria.length > 0) {
    parts.push(
      "",
      "Success criteria (verify each before finishing):",
      ...successCriteria.map((c) => `- ${c}`),
    );
  }

  return parts.join("\n");
}

/**
 * Create the 'agents' tool for inter-agent cooperation.
 *
 * Takes a manager-shaped dependency object (not the full SubagentManager)
 * to avoid circular imports and keep the module testable.
 */
export function createAgentsTool(manager: AgentsToolManagerDeps, opts?: CreateAgentsToolOptions): AgentTool {
  const getCallerSessionId = opts?.getCallerSessionId;
  const getCallerAgentName = opts?.getCallerAgentName;
  const callDeny = opts?.callDeny;

  const callerDefinition = (caller?: string, sessionId = getCallerSessionId?.()) =>
    (sessionId ? manager.activeSessions.get(sessionId)?.definition : undefined) ??
    (caller ? manager.getAgentDefinition(caller, sessionId) : undefined);

  const getCallerLineage = (sessionId?: string): { workflowRunId?: string; projectId?: string; trace?: EventTrace } => {
    if (!sessionId) return {};
    const active = manager.activeSessions.get(sessionId);
    const persisted = manager.registry.getSession(sessionId);
    return {
      workflowRunId: active?.workflowRunId ?? persisted?.workflowRunId,
      projectId: active?.projectId ?? persisted?.projectId,
      trace: active?.trace,
    };
  };

  const isBreakGlassCaller = (sessionId?: string): boolean => {
    if (!sessionId) return false;
    const active = manager.activeSessions.get(sessionId);
    const persisted = manager.registry.getSession(sessionId);
    const requestId = active?.requestId ?? persisted?.requestId;
    return typeof requestId === "string" && requestId.startsWith("may-break-glass:");
  };

  const appBoundaryError = (caller: string | undefined, target: string, sessionId?: string): string | null => {
    const targetDefinition = manager.getAgentDefinition(target, sessionId);
    if (!targetDefinition?.appLocal) return null;
    const definition = callerDefinition(caller, sessionId);
    if (definition?.appLocal && definition.projectId && definition.projectId === targetDefinition.projectId) {
      return null;
    }
    if (isBreakGlassCaller(sessionId)) return null;
    const project = targetDefinition.projectId ?? "the owning project";
    return `Agent "${target}" is app-local to "${project}". Send the desired outcome and proof to that app instead of selecting its internal agent. A linked May break-glass attempt may cross this boundary when the normal owner path cannot fulfill the human outcome.`;
  };

  const resolveCodeProcedure = async (
    caller: string | undefined,
    target: string,
    sessionId?: string,
    signal?: AbortSignal,
  ): Promise<
    | { kind: "none" }
    | { kind: "error"; error: string }
    | {
        kind: "procedure";
        owner: string;
        name: string;
        workflowDir: string;
        catalog: Awaited<ReturnType<typeof buildWorkflowCatalog>>;
      }
  > => {
    const slashIndex = target.indexOf("/");
    if (slashIndex !== -1) {
      const owner = target.slice(0, slashIndex).trim();
      const name = target.slice(slashIndex + 1).trim();
      if (!owner || !name || name.includes("/")) {
        return { kind: "error", error: `Invalid qualified target "${target}" (expected "<owner>/<name>")` };
      }
      const boundary = appBoundaryError(caller, owner, sessionId);
      if (boundary) return { kind: "error", error: boundary };
      const ownerDef = manager.getAgentDefinition(owner, sessionId);
      if (!ownerDef?.agentDir) {
        return { kind: "error", error: `Procedure owner "${owner}" not registered. Use 'list' to see available targets.` };
      }
      const workflowDir = join(ownerDef.agentDir, "workflows");
      const wfCatalog = await buildWorkflowCatalog(workflowDir, signal);
      const snapshot: PreparedCatalog<SubagentDefinition> = {
        proceduresByOwner: new Map([[owner, wfCatalog.workflows]]),
        diagnostics: wfCatalog.diagnostics,
      };
      try {
        const resolved = resolveCallable(caller ?? owner, target, snapshot);
        if (resolved.kind === "code") {
          return { kind: "procedure", owner, name: resolved.name, workflowDir, catalog: wfCatalog };
        }
      } catch (err) {
        return { kind: "error", error: err instanceof Error ? err.message : String(err) };
      }
      return { kind: "none" };
    }

    const callerDef = callerDefinition(caller, sessionId);
    if (callerDef?.agentDir) {
      const workflowDir = join(callerDef.agentDir, "workflows");
      const wfCatalog = await buildWorkflowCatalog(workflowDir, signal);
      const snapshot: PreparedCatalog<SubagentDefinition> = {
        proceduresByOwner: new Map([[callerDef.name, wfCatalog.workflows]]),
        diagnostics: wfCatalog.diagnostics,
      };
      try {
        const resolved = resolveCallable(callerDef.name, target, snapshot);
        if (resolved.kind === "code") {
          return {
            kind: "procedure",
            owner: callerDef.name,
            name: resolved.name,
            workflowDir,
            catalog: wfCatalog,
          };
        }
      } catch {
        // Not a local code procedure; fall through to prompt agent lookup.
      }
    }
    return { kind: "none" };
  };

  return {
    name: "agents",
    label: "Agents",
    description:
      "Cooperate with other agents and procedures. Use 'list' for discovery, 'call' to await a result, 'fork' for a bounded helper, 'follow-up' to correct that helper, 'peek'/'cancel' to inspect or stop it, and 'sessions' for execution history. Durable cross-App work uses App Task requests; helper updates use the exact sessionId.",
    parameters: AgentsToolParams,
    execute: async (_toolCallId, _params, signal) => {
      const params = _params as AgentsToolParamsType;
      try {
        switch (params.action) {
          case "call": {
            const hasInput = Object.hasOwn(params, "input") && params.input !== undefined;
            if (!params.agent || (!params.task && !hasInput)) {
              return textResult(JSON.stringify({ error: "'call' requires 'agent' and 'task' (or 'input' for code procedures)" }));
            }
            const callerAgentCall = getCallerAgentName?.();
            const parentSid = getCallerSessionId?.();
            // Guard: reject if target matches a tool in caller's toolset
            if (callerAgentCall) {
              const definition = callerDefinition(callerAgentCall, parentSid);
              if (definition) {
                const toolNames = definition.tools.map((t) => t.name);
                if (toolNames.includes(params.agent)) {
                  return textResult(
                    JSON.stringify({
                      error: `"${params.agent}" is a tool, not an agent. Call it directly as: ${params.agent}({ ... }) — do NOT use agents.call("${params.agent}", ...).`,
                    }),
                  );
                }
              }
            }

            const codeLookup = await resolveCodeProcedure(callerAgentCall, params.agent, parentSid, signal);
            if (codeLookup.kind === "error") {
              return textResult(JSON.stringify({ error: codeLookup.error }));
            }
            if (codeLookup.kind === "procedure") {
              if (!parentSid || !manager.activeSessions.has(parentSid)) {
                throw new Error("Procedure call requires its live caller session");
              }
              const session = manager.activeSessions.get(parentSid);
              if (session?.taskBinding && !session.taskContext) {
                throw new Error("Current Task execution context is unavailable");
              }
              const context = session?.taskContext;
              const lineage = getCallerLineage(parentSid);
              const rawInput = hasInput ? params.input : params.task!;
              const taskText = typeof rawInput === "string" ? rawInput : JSON.stringify(rawInput);
              const runner = createWorkflowRunner({
                manager: manager as any,
                workflowDir: codeLookup.workflowDir,
                persistDir: manager.registry.persistDir,
                agentName: codeLookup.owner,
                runtimeCtx: opts?.runtimeCtx,
                ...context,
                taskContext: context,
                read: opts?.createRead ? opts.createRead(context) : undefined,
                callerSessionId: parentSid,
                projectId: lineage.projectId,
                trace: lineage.trace,
                onEvent: opts?.onWorkflowEvent,
                signal:
                  signal && session?.executionScope
                    ? AbortSignal.any([signal, session.executionScope.signal])
                    : (signal ?? session?.executionScope?.signal),
                executionTimeoutMs: session?.executionScope
                  ? session.executionScope.deadlineAt - Date.now()
                  : undefined,
                ...(hasInput ? { workflowInput: params.input } : {}),
              });
              const wfResult = await runner.run(codeLookup.name, taskText, codeLookup.catalog);
              return textResult(
                JSON.stringify({ ...wfResult, ...workflowExecutionResult(wfResult) }, null, 2),
              );
            }

            if (hasInput && typeof params.input !== "string" && !params.task) {
              return textResult(
                JSON.stringify({
                  error: `Prompt agent "${params.agent}" requires a string 'task' prompt, not structured 'input'.`,
                }),
              );
            }
            const promptTaskText = params.task ?? String(params.input);

            if (!manager.getAgentDefinition(params.agent, parentSid)) {
              return textResult(
                JSON.stringify({
                  error: `Agent "${params.agent}" not registered. Use 'list' to see available agents.`,
                }),
              );
            }
            const boundaryError = appBoundaryError(callerAgentCall, params.agent, parentSid);
            if (boundaryError) return textResult(JSON.stringify({ error: boundaryError }));
            if (!isBreakGlassCaller(parentSid) && callDeny && callDeny.agents.includes(params.agent)) {
              return textResult(JSON.stringify({ error: `Cannot call "${params.agent}" directly. ${callDeny.hint}` }));
            }
            const lineage = getCallerLineage(parentSid);

            if (!parentSid || !manager.activeSessions.has(parentSid)) {
              throw new Error("Agent call requires its live caller session");
            }

            // Sync call: blocks until done
            const task = appendContextFiles(promptTaskText, params.context_files, params.success_criteria);
            const result = await manager.callAgent(params.agent, task, {
              parentSessionId: parentSid,
              workflowRunId: lineage.workflowRunId,
              projectId: lineage.projectId,
              source: "agents.call",
              trace: lineage.trace,
              parseSkillCommand: false,
              signal,
            });

            // Keep diagnostic references, not additional copies of the transcript
            // or payload now exposed through the shared summary/output/facts.
            const {
              messages: _messages, lastAssistantText: _text, finishResult: _finish,
              structuredResult: _structured, ...diagnostics
            } = result;
            return textResult(JSON.stringify({ ...diagnostics, ...agentExecutionResult(result) }, null, 2));
          }

          case "fork": {
            if (!params.agent || !params.task) {
              return textResult(JSON.stringify({ error: "'fork' requires 'agent' and 'task'" }));
            }
            const callerAgentRun = getCallerAgentName?.();
            const parentSidRun = getCallerSessionId?.();
            const codeForkCheck = await resolveCodeProcedure(callerAgentRun, params.agent, parentSidRun, signal);
            if (codeForkCheck.kind === "procedure" || params.agent.includes("/")) {
              return textResult(
                JSON.stringify({
                  error: `Cannot 'fork' code procedure "${params.agent}"; use action: 'call' for synchronous code procedures.`,
                }),
              );
            }
            const forkTask = appendContextFiles(params.task, params.context_files, params.success_criteria);
            // Guard: reject if target matches a tool in caller's toolset
            if (callerAgentRun) {
              const definition = callerDefinition(callerAgentRun, parentSidRun);
              if (definition) {
                const toolNames = definition.tools.map((t) => t.name);
                if (toolNames.includes(params.agent)) {
                  return textResult(
                    JSON.stringify({
                      error: `"${params.agent}" is a tool, not an agent. Call it directly as: ${params.agent}({ ... }) — do NOT use agents.fork("${params.agent}", ...).`,
                    }),
                  );
                }
              }
            }
            if (!manager.getAgentDefinition(params.agent, parentSidRun)) {
              return textResult(
                JSON.stringify({
                  error: `Agent "${params.agent}" not registered. Use 'list' to see available agents.`,
                }),
              );
            }
            const boundaryError = appBoundaryError(callerAgentRun, params.agent, parentSidRun);
            if (boundaryError) return textResult(JSON.stringify({ error: boundaryError }));
            if (!isBreakGlassCaller(parentSidRun) && callDeny && callDeny.agents.includes(params.agent)) {
              return textResult(JSON.stringify({ error: `Cannot fork "${params.agent}" directly. ${callDeny.hint}` }));
            }
            const lineage = getCallerLineage(parentSidRun);

            // Return immediately; the live caller still owns helper cleanup.
            const sessionId = manager.runAgent(params.agent, forkTask, {
              parentSessionId: parentSidRun,
              originSessionId: parentSidRun,
              workflowRunId: lineage.workflowRunId,
              projectId: lineage.projectId,
              source: "agents.fork",
              trace: lineage.trace,
              parseSkillCommand: false,
              signal,
            });

            return textResult(
              JSON.stringify({
                status: "started",
                sessionId,
                agent: params.agent,
                hint: `Use agents({ action: 'peek', sessionId: '${sessionId}' }) to inspect progress, or action: 'follow-up' with this sessionId and content to correct the helper. Inspect current evidence before cancelling; reading and recovering a tool error can be useful progress.`,
              }),
            );
          }

          case "list": {
            const callerName = getCallerAgentName?.();
            const callerSid = getCallerSessionId?.();
            const callerDef = callerDefinition(callerName, callerSid);
            const agents = Array.from(manager.agents.values()).map((a) => ({
              name: a.definition.name,
              description: a.definition.description,
              domain: a.definition.domain,
              ...(a.definition.appLocal ? { project: a.definition.projectId } : {}),
            }));
            const procedures: Array<{ name: string; owner: string; description: string }> = [];
            for (const a of manager.agents.values()) {
              if (
                a.definition.appLocal &&
                (!callerDef?.appLocal || callerDef.projectId !== a.definition.projectId) &&
                !isBreakGlassCaller(callerSid)
              ) {
                continue;
              }
              if (!a.definition.agentDir) continue;
              const catalog = await buildWorkflowCatalog(join(a.definition.agentDir, "workflows"));
              for (const wf of catalog.workflows.values()) {
                procedures.push({
                  name: a.definition.name === callerName ? wf.name : `${a.definition.name}/${wf.name}`,
                  owner: a.definition.name,
                  description: wf.description,
                });
              }
            }
            const sessions = manager.status().map((s) => ({
              sessionId: s.sessionId,
              agent: s.agent,
              task: s.task.slice(0, 100),
              status: s.status,
              runtime: s.runtime,
            }));
            return textResult(
              JSON.stringify(
                {
                  agents,
                  ...(procedures.length > 0 ? { procedures } : {}),
                  runningSessions: sessions,
                },
                null,
                2,
              ),
            );
          }

          case "peek": {
            if (!params.sessionId) {
              return textResult(JSON.stringify({ error: "'peek' requires 'sessionId'" }));
            }
            if (params.sessionId.includes("/")) {
              return textResult(
                JSON.stringify({
                  error: `Cannot 'peek' code procedure "${params.sessionId}"; use action: 'call' for synchronous code procedures.`,
                }),
              );
            }
            try {
              const messages = manager.progress(params.sessionId, params.limit ?? 20);
              const simplified = messages.map((m) => ({
                role: m.role,
                content: "content" in m ? m.content : "output" in m ? m.output : "summary" in m ? m.summary : undefined,
              }));
              return textResult(JSON.stringify(simplified, null, 2));
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              return textResult(JSON.stringify({ error: msg }));
            }
          }
          case "follow-up": {
            if (!params.sessionId || !params.content?.trim()) {
              return textResult(JSON.stringify({ error: "'follow-up' requires 'sessionId' and non-empty 'content'" }));
            }
            if (params.sessionId.includes("/")) {
              return textResult(
                JSON.stringify({
                  error: `Cannot 'follow-up' code procedure "${params.sessionId}"; use action: 'call' for synchronous code procedures.`,
                }),
              );
            }
            manager.followUpHelper(params.sessionId, params.content, getCallerSessionId?.());
            return textResult(JSON.stringify({
              accepted: true,
              sessionId: params.sessionId,
              delivery: "queued for the running helper; inspect its result to confirm consideration",
            }));
          }

          case "cancel": {
            if (!params.sessionId) return textResult(JSON.stringify({ error: "'cancel' requires 'sessionId'" }));
            if (!opts?.validateControl) throw new Error("Session control is not configured");
            opts.validateControl(params.sessionId, getCallerSessionId?.());
            if (manager.hasActiveSession(params.sessionId)) {
              manager.cancel(params.sessionId);
              return textResult(JSON.stringify({ accepted: true, sessionId: params.sessionId, method: "local" }));
            }
            const meta = manager.registry.getSession(params.sessionId);
            const identity = meta?.detached && meta.instance
              ? readIdentity(manager.registry.persistDir, meta.instance) : null;
            if (!identity?.socket) throw new Error("No reachable execution owner for this session");
            const { sendSocketCommand } = await import("@may-agent/control/client");
            const receipt = await sendSocketCommand(identity.socket, {
              type: "publish",
              event: {
                type: "session.cancel.requested",
                target: { sessionId: params.sessionId },
                data: { reason: "agent tool requested cancellation" },
                idempotencyKey: `agents-tool-cancel:${params.sessionId}`,
              },
            });
            return textResult(JSON.stringify({ accepted: true, sessionId: params.sessionId, method: "socket", receipt }));
          }

          case "context": {
            const callerSid = getCallerSessionId?.();
            if (!callerSid) {
              return textResult(
                JSON.stringify({ error: "No session context available (not running inside a session)" }),
              );
            }

            const scope = params.scope ?? "parent";
            const callerSession = manager.activeSessions.get(callerSid);

            if (scope === "parent") {
              const parentSid = callerSession?.parentSessionId;
              if (!parentSid) {
                return textResult(
                  JSON.stringify({
                    error: "No parent session (this is a root session). Try scope: 'origin' for forked sessions.",
                  }),
                );
              }
              const summary = manager.getSessionSummary(parentSid);
              return textResult(JSON.stringify({ scope: "parent", sessionId: parentSid, ...summary }, null, 2));
            }

            if (scope === "origin") {
              // Walk up to root, then check originSessionId
              let rootSid = callerSid;
              let current = callerSession;
              while (current?.parentSessionId) {
                rootSid = current.parentSessionId;
                current = manager.activeSessions.get(rootSid);
              }
              const originSid = current?.originSessionId;
              if (!originSid) {
                return textResult(
                  JSON.stringify({ error: "No origin session (this tree was not forked). Try scope: 'parent'." }),
                );
              }
              const summary = manager.getSessionSummary(originSid);
              return textResult(JSON.stringify({ scope: "origin", sessionId: originSid, ...summary }, null, 2));
            }

            if (scope === "root") {
              let rootSid = callerSid;
              let current = callerSession;
              while (current?.parentSessionId) {
                rootSid = current.parentSessionId;
                current = manager.activeSessions.get(rootSid);
              }
              const summary = manager.getSessionSummary(rootSid);
              return textResult(JSON.stringify({ scope: "root", sessionId: rootSid, ...summary }, null, 2));
            }

            if (scope === "workflow") {
              const wfRunId = callerSession?.workflowRunId;
              if (!wfRunId) {
                return textResult(JSON.stringify({ error: "Not inside a workflow. Try scope: 'parent'." }));
              }
              const steps = manager.getWorkflowSteps(wfRunId);
              return textResult(JSON.stringify({ scope: "workflow", workflowRunId: wfRunId, steps }, null, 2));
            }

            return textResult(JSON.stringify({ error: `Unknown scope: ${scope}` }));
          }

          case "sessions": {
            try {
              const persistDir = manager.registry.persistDir;
              const filter = params.filter ?? "active";
              const limit = params.limit ?? 50;
              const db = getDb(persistDir);

              // Query canonical session state.
              let whereClause = "";
              const queryParams: Array<string | number> = [];

              switch (filter) {
                case "active":
                  whereClause = "WHERE status = 'running'";
                  if (params.agent) { whereClause += " AND agent = ?"; queryParams.push(params.agent); }
                  break;
                case "stale":
                  whereClause = "WHERE status = 'running' AND startedAt < ?";
                  queryParams.push(Date.now() - 2 * 60 * 60 * 1000);
                  if (params.agent) { whereClause += " AND agent = ?"; queryParams.push(params.agent); }
                  break;
                case "failed":
                  whereClause = "WHERE status = 'error'";
                  if (params.agent) { whereClause += " AND agent = ?"; queryParams.push(params.agent); }
                  break;
                case "all":
                default:
                  if (params.agent) { whereClause = "WHERE agent = ?"; queryParams.push(params.agent); }
                  break;
              }

              const sessions = db
                .prepare(`SELECT sessionId, agent, task, status, kind, startedAt, endedAt, error FROM sessions ${whereClause} ORDER BY startedAt DESC LIMIT ?`)
                .all(...queryParams, limit) as Array<{
                  sessionId: string;
                  agent: string;
                  task: string;
                  status: string;
                  kind: string | null;
                  startedAt: number;
                  endedAt: number | null;
                  error: string | null;
                }>;

              const formatted = sessions.map((s) => ({
                id: s.sessionId,
                agent: s.agent,
                task: (s.task || "").slice(0, 120),
                status: s.status,
                kind: s.kind,
                age: `${Math.round((Date.now() - s.startedAt) / 60000)}m`,
                error: s.error?.slice(0, 80),
              }));

              return textResult(JSON.stringify({ filter, count: formatted.length, sessions: formatted }, null, 2));
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              return textResult(JSON.stringify({ error: `status query failed: ${msg}` }));
            }
          }

          default:
            return textResult(JSON.stringify({ error: `Unknown action: ${(params as any).action}` }));
        }
      } catch (err: unknown) {
        if (err instanceof ExecutionDeferredError) return textResult(JSON.stringify(deferredExecutionResult(err)));
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(JSON.stringify({ error: msg }));
      }
    },
  };
}
