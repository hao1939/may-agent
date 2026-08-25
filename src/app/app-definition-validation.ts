import type { AppDefinition, AppInput, EventSelector, TSchema } from "@may-agent/sdk";
import { Check } from "typebox/value";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function positiveInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function positiveFinite(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validSelector(value: unknown): value is EventSelector {
  if (nonEmpty(value)) return true;
  const selector = record(value);
  return Boolean(selector && nonEmpty(selector.type));
}

function validInput(value: unknown): value is AppInput {
  const input = record(value);
  return Boolean(input && nonEmpty(input.kind) && Object.prototype.hasOwnProperty.call(input, "data"));
}

function validEvent(value: unknown): boolean {
  const event = record(value);
  return Boolean(event && nonEmpty(event.type) && record(event.data));
}

function duplicateIds(values: unknown[], label: string, errors: string[]): void {
  const ids = new Set<string>();
  for (const [index, value] of values.entries()) {
    const item = record(value);
    const id = item?.id;
    if (!nonEmpty(id)) {
      errors.push(`${label} at index ${index} requires a non-empty id`);
      continue;
    }
    if (ids.has(id)) errors.push(`${label} id is duplicated: ${id}`);
    ids.add(id);
  }
}

/** Validate the complete canonical declaration without executing App code. */
export function validateAppDefinition(definition: unknown): string[] {
  const errors: string[] = [];
  const app = record(definition);
  if (!app) return ["App definition must be an object"];
  const appId = nonEmpty(app.id) ? app.id : "<unknown>";

  if (!nonEmpty(app.id)) errors.push("App id must be a non-empty string");
  if (app.version !== 1) errors.push(`App ${appId} must declare version 1`);
  const agent = nonEmpty(app.agent) ? app.agent.trim() : undefined;
  const legacyOwner = nonEmpty(app.owner) ? app.owner.trim() : undefined;
  if (!agent && !legacyOwner) errors.push(`App ${appId} agent must be a non-empty string`);
  if (app.agent !== undefined && !agent) errors.push(`App ${appId} agent must be a non-empty string`);
  if (app.owner !== undefined && !legacyOwner) errors.push(`App ${appId} legacy owner must be a non-empty string`);
  if (agent && legacyOwner && agent !== legacyOwner) {
    errors.push(`App ${appId} declares conflicting agent and legacy owner values`);
  }
  if (!record(app.inputSchema)) errors.push(`App ${appId} inputSchema must be an object schema`);
  if (app.task !== undefined && typeof app.task !== "function") {
    errors.push(`App ${appId} task must be a function`);
  }
  if (typeof app.task === "function" && !record(app.tasks)) {
    errors.push(`App ${appId} task requires a tasks policy`);
  }

  if (app.inbox !== undefined) {
    errors.push(`App ${appId} inbox is retired; the Host owns request scheduling`);
  }

  if (app.subscriptions !== undefined) {
    if (!Array.isArray(app.subscriptions)) errors.push(`App ${appId} subscriptions must be an array`);
    else {
      duplicateIds(app.subscriptions, `App ${appId} subscription`, errors);
      for (const value of app.subscriptions) {
        const subscription = record(value);
        if (!subscription) continue;
        if (!validSelector(subscription.event)) {
          errors.push(`App ${appId} subscription ${String(subscription.id)} requires a valid event selector`);
        }
        if (typeof subscription.toInput !== "function") {
          errors.push(`App ${appId} subscription ${String(subscription.id)} requires toInput`);
        }
      }
    }
  }

  if (app.observations !== undefined) {
    if (!Array.isArray(app.observations) || app.observations.some((entry) => !validSelector(entry))) {
      errors.push(`App ${appId} observations must contain valid event selectors`);
    }
  }

  if (app.schedules !== undefined) {
    if (!Array.isArray(app.schedules)) errors.push(`App ${appId} schedules must be an array`);
    else {
      duplicateIds(app.schedules, `App ${appId} schedule`, errors);
      for (const value of app.schedules) {
        const schedule = record(value);
        if (!schedule) continue;
        if (!positiveFinite(schedule.intervalMs)) {
          errors.push(`App ${appId} schedule ${String(schedule.id)} intervalMs must be positive`);
        }
        const hasInput = Object.prototype.hasOwnProperty.call(schedule, "input");
        const hasEvent = Object.prototype.hasOwnProperty.call(schedule, "event");
        if (hasInput === hasEvent) {
          errors.push(`App ${appId} schedule ${String(schedule.id)} requires exactly one App input or event`);
        } else if (hasInput && !validInput(schedule.input)) {
          errors.push(`App ${appId} schedule ${String(schedule.id)} requires a valid App input`);
        } else if (hasInput && record(app.inputSchema)) {
          try {
            if (!Check(app.inputSchema as TSchema, schedule.input)) {
              errors.push(`App ${appId} schedule ${String(schedule.id)} input does not match inputSchema`);
            }
          } catch {
            errors.push(`App ${appId} schedule ${String(schedule.id)} inputSchema could not be evaluated`);
          }
        } else if (hasEvent && !validEvent(schedule.event)) {
          errors.push(`App ${appId} schedule ${String(schedule.id)} requires a valid event`);
        }
        if (schedule.catchUp !== undefined && schedule.catchUp !== "none" && schedule.catchUp !== "latest") {
          errors.push(`App ${appId} schedule ${String(schedule.id)} catchUp must be none or latest`);
        }
        if (hasEvent && schedule.catchUp !== undefined) {
          errors.push(`App ${appId} event schedule ${String(schedule.id)} cannot configure inbox catch-up`);
        }
      }
    }
  }

  if (app.observers !== undefined) {
    if (!Array.isArray(app.observers)) errors.push(`App ${appId} observers must be an array`);
    else {
      duplicateIds(app.observers, `App ${appId} observer`, errors);
      for (const value of app.observers) {
        const observer = record(value);
        if (!observer) continue;
        if (!positiveFinite(observer.intervalMs)) {
          errors.push(`App ${appId} observer ${String(observer.id)} intervalMs must be positive`);
        }
        if (typeof observer.run !== "function") {
          errors.push(`App ${appId} observer ${String(observer.id)} requires run`);
        }
      }
    }
  }

  if (app.actions !== undefined) {
    const actions = record(app.actions);
    if (!actions) errors.push(`App ${appId} actions must be an object`);
    else {
      for (const [id, value] of Object.entries(actions)) {
        const action = record(value);
        if (!nonEmpty(id)) errors.push(`App ${appId} action id must be non-empty`);
        if (!action) {
          errors.push(`App ${appId} action ${id} must be an object`);
          continue;
        }
        if (!nonEmpty(action.description)) errors.push(`App ${appId} action ${id} requires a description`);
        if (!record(action.inputSchema)) errors.push(`App ${appId} action ${id} requires an input schema`);
        if (typeof action.toInput !== "function") {
          errors.push(`App ${appId} action ${id} requires toInput`);
        }
        if (typeof action.toEvent === "function") {
          errors.push(`App ${appId} action ${id} cannot use retired toEvent`);
        }
      }
    }
  }

  if (app.workspace !== undefined) {
    const workspace = record(app.workspace);
    if (!workspace) errors.push(`App ${appId} workspace must be an object`);
    else {
      if (workspace.kind !== "git" && workspace.kind !== "local") {
        errors.push(`App ${appId} workspace kind must be git or local`);
      }
      if (!nonEmpty(workspace.localPath)) errors.push(`App ${appId} workspace localPath must be non-empty`);
    }
  }

  if (app.tasks !== undefined) {
    const tasks = record(app.tasks);
    if (!tasks) errors.push(`App ${appId} tasks must be an object`);
    else {
      if (tasks.maxConcurrent !== undefined && !positiveInteger(tasks.maxConcurrent)) {
        errors.push(`App ${appId} task maxConcurrent must be a positive safe integer`);
      }
      if (tasks.subscriptions !== undefined) {
        if (!Array.isArray(tasks.subscriptions) || tasks.subscriptions.some((entry) => !validSelector(entry))) {
          errors.push(`App ${appId} task subscriptions must contain valid event selectors`);
        }
        if (typeof tasks.resolve !== "function") {
          errors.push(`App ${appId} task subscriptions require resolve`);
        }
      }
      if (tasks.resolve !== undefined && typeof tasks.resolve !== "function") {
        errors.push(`App ${appId} task resolve must be a function`);
      }
      if (tasks.validateAction !== undefined && typeof tasks.validateAction !== "function") {
        errors.push(`App ${appId} task validateAction must be a function`);
      }
    }
  }

  if (app.requests !== undefined) {
    const requests = record(app.requests);
    if (!requests) errors.push(`App ${appId} requests must be an object`);
    else {
      if (requests.mode !== "agent") errors.push(`App ${appId} requests mode must be agent`);
      if (requests.conversationId !== undefined && !nonEmpty(requests.conversationId)) {
        errors.push(`App ${appId} requests conversationId must be a non-empty string`);
      }
    }
  }

  if (app.requests !== undefined && app.task !== undefined) {
    errors.push(`App ${appId} cannot resolve the same inbox through both direct requests and Tasks`);
  }

  return errors;
}

export function assertValidAppDefinition(definition: unknown): asserts definition is AppDefinition {
  const errors = validateAppDefinition(definition);
  if (errors.length > 0) throw new Error(errors.join("; "));
}
