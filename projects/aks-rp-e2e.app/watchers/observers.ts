import { resolve } from "node:path";
import type { AppObserver, ObserverContext } from "@may-agent/sdk";
import { observeAksPipelines } from "./aks-pipeline.js";
import { observeAksPullRequests } from "./aks-pull-request.js";
import type { AksObserverContext, AksObserverEvent } from "./context.js";
import { observeRepoRefChanges } from "./repo-ref.js";
import { observeScenarioTestInventory } from "./scenario-test-inventory.js";
import { observeWorkspaceIntegrityChanges } from "./workspace-integrity.js";

type ScopedObserverContext = ObserverContext & {
  workspace: {
    appRoot: string;
    projectRoot: string;
  };
};

type AksCollector = (context: AksObserverContext) => Promise<unknown>;

function scopedWorkspace(
  context: ObserverContext,
): ScopedObserverContext["workspace"] {
  const workspace = (context as Partial<ScopedObserverContext>).workspace;
  if (!workspace?.appRoot || !workspace.projectRoot) {
    throw new Error(
      "AKS observers require scoped App and project workspace roots",
    );
  }
  return workspace;
}

export function aksObserverPath(
  context: ObserverContext,
  path: string,
): string {
  const workspace = scopedWorkspace(context);
  const normalized = path.trim() || ".";
  if (normalized === "../aks-rp-e2e") return workspace.projectRoot;
  if (normalized.startsWith("../aks-rp-e2e/")) {
    return resolve(
      workspace.projectRoot,
      normalized.slice("../aks-rp-e2e/".length),
    );
  }
  return resolve(workspace.appRoot, normalized);
}

async function collectFacts(
  context: ObserverContext,
  collector: AksCollector,
): Promise<AksObserverEvent[]> {
  const facts: AksObserverEvent[] = [];
  await collector({
    appPath: (path) => aksObserverPath(context, path),
    emit(event) {
      facts.push(event);
    },
    noop(reason) {
      return { observed: false, reason };
    },
  });
  return facts;
}

function observer(
  id: string,
  intervalMs: number,
  collector: AksCollector,
): AppObserver {
  return {
    id,
    intervalMs,
    run: (context) => collectFacts(context, collector),
  };
}

export const aksObservers: AppObserver[] = [
  observer("pipeline", 60_000, observeAksPipelines),
  observer("pull-request", 300_000, observeAksPullRequests),
  observer("workspace-integrity", 3_600_000, observeWorkspaceIntegrityChanges),
  observer("scenario-test-inventory", 1_800_000, observeScenarioTestInventory),
  observer("repo-ref", 600_000, observeRepoRefChanges),
];
