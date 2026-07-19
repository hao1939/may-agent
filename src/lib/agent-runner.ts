import { Agent } from "@earendil-works/pi-agent-core";

export type AgentRunnerConfig = ConstructorParameters<typeof Agent>[0];
export type AgentRuntimeListener = Parameters<Agent["subscribe"]>[0];

/**
 * Infrastructure-neutral handle for one model/tool loop.
 *
 * This module deliberately knows nothing about sessions, files, SQLite,
 * EventBus, projects, tasks, metrics, scheduling, or recovery. Callers may
 * subscribe to the Pi runtime observations and add those concerns outside the
 * agent execution boundary.
 */
export interface AgentRun {
  readonly state: Agent["state"];
  prompt: Agent["prompt"];
  followUp: Agent["followUp"];
  continue: Agent["continue"];
  waitForIdle: Agent["waitForIdle"];
  steer: Agent["steer"];
  cancel(): void;
  subscribe(listener: AgentRuntimeListener): ReturnType<Agent["subscribe"]>;
}

class PiAgentRun implements AgentRun {
  readonly prompt: Agent["prompt"];
  readonly followUp: Agent["followUp"];
  readonly continue: Agent["continue"];
  readonly waitForIdle: Agent["waitForIdle"];
  readonly steer: Agent["steer"];

  constructor(private readonly agent: Agent) {
    this.prompt = agent.prompt.bind(agent) as Agent["prompt"];
    this.followUp = agent.followUp.bind(agent) as Agent["followUp"];
    this.continue = agent.continue.bind(agent) as Agent["continue"];
    this.waitForIdle = agent.waitForIdle.bind(agent) as Agent["waitForIdle"];
    this.steer = agent.steer.bind(agent) as Agent["steer"];
  }

  get state(): Agent["state"] {
    return this.agent.state;
  }

  cancel(): void {
    this.agent.abort();
  }

  subscribe(listener: AgentRuntimeListener): ReturnType<Agent["subscribe"]> {
    return this.agent.subscribe(listener);
  }
}

export function createAgentRun(config: AgentRunnerConfig): AgentRun {
  return new PiAgentRun(new Agent(config));
}
