/**
 * Reserved internal command surface.
 *
 * App authors express mutations through dispositions, task actions, and
 * events. The former generic owner-inbox review/expiry commands were removed
 * with that alternate work authority.
 */
export type CommandAPI = Record<never, never>;

export type CommandServiceOptions = Record<string, never>;

export function createCommandService(_opts: CommandServiceOptions = {}): CommandAPI {
  return {};
}

export function createUnavailableCommandService(_reason: string): CommandAPI {
  return {};
}
