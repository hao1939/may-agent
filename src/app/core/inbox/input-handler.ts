import type { AppDefinition, AppInputContext, AppResult } from "@may-agent/sdk";
import type { AppInboxClaim } from "../state/app-inbox-store.js";

/** Selected execution supplied by composition; inbox ownership stays with the Host. */
export type AppInputHandler = (input: {
  app: Readonly<AppDefinition>;
  claim: AppInboxClaim;
  request: Readonly<AppInputContext>;
  execution: { signal: AbortSignal; sessionStarted: (sessionId: string) => void };
  authorize: () => void;
  complete: (result: AppResult) => string | undefined;
  getApp: (appId: string) => Readonly<AppDefinition>;
  refreshInput: () => Promise<AppInputContext>;
}) => Promise<string | undefined>;
