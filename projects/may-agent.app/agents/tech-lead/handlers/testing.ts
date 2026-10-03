/** Test-only adapter for host-private handlers.
 *
 * The Runtime owns SQLite and query implementations. Handler tests
 * compose those host services directly instead of restoring them to the
 * public Agent App SDK.
 */

import { createQueryService } from "../../../../may-agent/src/lib/query-service.js";
import { closeDb, getDb } from "../../../../may-agent/src/lib/requests.js";

export function createHostTestRuntime(options: {
  root: string;
  persist?: string;
  agents?: string;
  shared?: string;
  projects?: string;
  emit?: (
    type: string,
    data?: Record<string, unknown>,
    envelope?: Record<string, unknown>,
  ) => void;
}) {
  const persist = options.persist ?? options.root;
  const agents = options.agents ?? `${options.root}/agents`;
  const shared = options.shared ?? `${options.root}/shared`;
  const projects = options.projects ?? `${options.root}/projects`;
  const db = getDb(persist);
  const emit = options.emit ?? (() => undefined);
  const sdk = {
    emit,
    getDb: () => db,
    query: createQueryService({ getDb: () => db }),
    log: () => undefined,
    message: () => undefined,
    paths: {
      root: options.root,
      persist,
      agents,
      shared,
      projects,
    },
  };
  return {
    root: options.root,
    persist,
    agents,
    shared,
    projects,
    db,
    sdk,
    close: () => closeDb(persist),
  };
}
