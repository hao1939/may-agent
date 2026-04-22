/**
 * Shared type definitions for the evaluation system.
 *
 * These types are owned by agents/ — they define the evaluation domain model.
 * Infrastructure (src/) should NOT import from here.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

// ── Failure chain types ────────────────────────────────────────────────

/** A single step in a failure chain: a tool call and its result. */
export interface FailureStep {
  tool: string;
  args: string; // compact JSON of arguments
  result: string; // first 200 chars of result text
  isError: boolean;
}

/** A causal failure chain: trigger error → recovery attempts → eventual resolution. */
export interface FailureChain {
  trigger: FailureStep; // the tool call that started the chain
  recovery: FailureStep[]; // subsequent attempts to recover
  resolution: FailureStep | null; // the call that finally succeeded (null if never resolved)
  wastedCalls: number; // number of calls wasted in this chain
  rootCause: string; // short description of why the chain started
}

// ── Evaluation result types ────────────────────────────────────────────

/** Aggregated token usage and cost for a session. */
export interface UsageSummary {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number; // total cost in dollars
  turns: number; // number of assistant messages
}

/** Per-agent scores within a task evaluation. */
export interface AgentScores {
  agent: string;
  sessionId: string;
  efficiency: number;
  quality: number;
  productive_calls: number;
  wasted_calls: number;
  verdict: "good" | "acceptable" | "needs_improvement";
  issues: string[];
}

/** Result of evaluating a complete task tree (multiple agent sessions). */
export interface TaskEvaluationResult {
  /** Per-agent scores indexed by sessionId (not agent name, to handle duplicate agent names). */
  agents: Record<string, AgentScores>;
  /** Overall task result. */
  overall: {
    efficiency: number;
    quality: number;
    verdict: "good" | "acceptable" | "needs_improvement";
    result_delivered: boolean;
  };
  /** Total usage across all sessions in the tree. */
  usage: UsageSummary;
  /** Lessons scoped to specific agents. */
  lessons: string | null;
  /** Per-agent failure chains. */
  failureChains: Record<string, FailureChain[]>;
  /** Session IDs that were evaluated. */
  sessionIds: string[];
  /** Raw evaluator response. */
  raw: string;
}

/** Info about a child session to be evaluated. */
export interface ChildSessionInfo {
  sessionId: string;
  agent: string;
  task: string;
  status: string;
  messages: AgentMessage[];
}

/** Summary of an agent's score history. */
export interface AgentScoreSummary {
  avgEfficiency: number;
  avgQuality: number;
  count: number;
  verdicts: Record<string, number>;
  trend: "improving" | "declining" | "stable";
}
