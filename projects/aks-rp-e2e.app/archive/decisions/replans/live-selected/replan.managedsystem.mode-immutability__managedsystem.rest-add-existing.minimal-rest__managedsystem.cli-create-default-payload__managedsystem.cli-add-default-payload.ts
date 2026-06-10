/*
Generated AKS RP E2E combined probe.

This file is generated from model/knowledge-map/views/path-summary.json and
specs/*.json. It defaults to dry-run so review/e2e verification never
mutates cloud resources.
*/

const plan = {
  "id": "replan.managedsystem.mode-immutability__managedsystem.rest-add-existing.minimal-rest__managedsystem.cli-create-default-payload__managedsystem.cli-add-default-payload",
  "selectedPathIds": [
    "path.managedsystem.mode-immutability",
    "path.managedsystem.rest-add-existing.minimal-rest",
    "path.managedsystem.cli-create-default-payload",
    "path.managedsystem.cli-add-default-payload"
  ],
  "groups": [
    {
      "id": "group.01",
      "compatibleGroupKey": "managedsystem.add-existing-minimal-rest.single-cluster",
      "selectedPathIds": [
        "path.managedsystem.rest-add-existing.minimal-rest",
        "path.managedsystem.mode-immutability"
      ],
      "operations": [
        {
          "id": "operation.add-managedsystem-pool",
          "specId": "spec.managedsystem.rest-add-existing.minimal-rest",
          "featurePathIds": [
            "path.managedsystem.rest-add-existing.minimal-rest"
          ],
          "surface": "arm-rest",
          "method": "PUT",
          "pathTemplate": "/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.ContainerService/managedClusters/{clusterName}/agentPools/{poolName}?api-version={apiVersion}",
          "body": {
            "properties": {
              "mode": "ManagedSystem"
            }
          },
          "intent": "Send the proven minimal mode-only request shape."
        },
        {
          "id": "operation.get-managedsystem-pool",
          "specId": "spec.managedsystem.rest-add-existing.minimal-rest",
          "featurePathIds": [
            "path.managedsystem.rest-add-existing.minimal-rest"
          ],
          "surface": "arm-rest",
          "method": "GET",
          "pathTemplate": "/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.ContainerService/managedClusters/{clusterName}/agentPools/{poolName}?api-version={apiVersion}",
          "intent": "Read the pool back for persisted ManagedSystem state."
        },
        {
          "id": "operation.patch-mode-system",
          "specId": "spec.managedsystem.mode-immutability",
          "featurePathIds": [
            "path.managedsystem.mode-immutability"
          ],
          "surface": "arm-rest",
          "method": "PUT",
          "pathTemplate": "/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.ContainerService/managedClusters/{clusterName}/agentPools/{poolName}?api-version={apiVersion}",
          "body": {
            "properties": {
              "mode": "System"
            }
          },
          "intent": "Try to mutate an existing ManagedSystem pool back to System."
        }
      ],
      "assertions": [
        {
          "id": "assert.rp-request-accepted",
          "specId": "spec.managedsystem.rest-add-existing.minimal-rest",
          "featurePathIds": [
            "path.managedsystem.rest-add-existing.minimal-rest"
          ],
          "behavior": "rp.request.accepted",
          "expected": "true",
          "verdictImpact": "claim"
        },
        {
          "id": "assert.managedsystem-ready",
          "specId": "spec.managedsystem.rest-add-existing.minimal-rest",
          "featurePathIds": [
            "path.managedsystem.rest-add-existing.minimal-rest"
          ],
          "behavior": "agentPool.managedsystem.ready",
          "expected": "true",
          "verdictImpact": "claim"
        },
        {
          "id": "assert.azure-managed-nodes",
          "specId": "spec.managedsystem.rest-add-existing.minimal-rest",
          "featurePathIds": [
            "path.managedsystem.rest-add-existing.minimal-rest"
          ],
          "behavior": "agentPool.managedsystem.azureManagedNodes",
          "expected": "true",
          "verdictImpact": "claim"
        },
        {
          "id": "assert.mode-mutation-rejected",
          "specId": "spec.managedsystem.mode-immutability",
          "featurePathIds": [
            "path.managedsystem.mode-immutability"
          ],
          "behavior": "rp.request.accepted",
          "expected": "false",
          "verdictImpact": "claim"
        },
        {
          "id": "assert.mode-change-rejected",
          "specId": "spec.managedsystem.mode-immutability",
          "featurePathIds": [
            "path.managedsystem.mode-immutability"
          ],
          "behavior": "agentPool.mode.changeRejected",
          "expected": "true",
          "verdictImpact": "claim"
        }
      ],
      "cleanup": [
        {
          "id": "cleanup.resource-group",
          "specId": "spec.managedsystem.rest-add-existing.minimal-rest",
          "featurePathIds": [
            "path.managedsystem.rest-add-existing.minimal-rest"
          ],
          "surface": "az-cli",
          "intent": "Delete the resource group after all compatible ManagedSystem checks finish."
        }
      ]
    },
    {
      "id": "group.02",
      "compatibleGroupKey": "managedsystem.cli-default-payload.then-minimal-rest.single-resource-group",
      "selectedPathIds": [
        "path.managedsystem.cli-create-default-payload",
        "path.managedsystem.cli-add-default-payload"
      ],
      "operations": [
        {
          "id": "operation.cli-create-managedsystem-default-payload",
          "specId": "spec.managedsystem.cli-create-default-payload",
          "featurePathIds": [
            "path.managedsystem.cli-create-default-payload"
          ],
          "surface": "az-cli-preview",
          "method": "az aks create",
          "intent": "Exercise the preview CLI create request construction that currently sends ordinary node-pool defaults."
        },
        {
          "id": "operation.cli-add-managedsystem-default-payload",
          "specId": "spec.managedsystem.cli-add-default-payload",
          "featurePathIds": [
            "path.managedsystem.cli-add-default-payload"
          ],
          "surface": "az-cli-preview",
          "method": "az aks nodepool add",
          "intent": "Exercise the preview CLI nodepool add request construction that currently sends ordinary/default node-pool fields."
        }
      ],
      "assertions": [
        {
          "id": "assert.cli-create-request-rejected",
          "specId": "spec.managedsystem.cli-create-default-payload",
          "featurePathIds": [
            "path.managedsystem.cli-create-default-payload"
          ],
          "behavior": "rp.request.accepted",
          "expected": "false",
          "verdictImpact": "claim"
        },
        {
          "id": "assert.cli-create-rejected-fields-present",
          "specId": "spec.managedsystem.cli-create-default-payload",
          "featurePathIds": [
            "path.managedsystem.cli-create-default-payload"
          ],
          "behavior": "agentPool.managedsystem.ready",
          "expected": "false",
          "verdictImpact": "claim"
        },
        {
          "id": "assert.cli-add-request-rejected",
          "specId": "spec.managedsystem.cli-add-default-payload",
          "featurePathIds": [
            "path.managedsystem.cli-add-default-payload"
          ],
          "behavior": "rp.request.accepted",
          "expected": "false",
          "verdictImpact": "claim"
        },
        {
          "id": "assert.cli-add-rejected-fields-present",
          "specId": "spec.managedsystem.cli-add-default-payload",
          "featurePathIds": [
            "path.managedsystem.cli-add-default-payload"
          ],
          "behavior": "agentPool.managedsystem.ready",
          "expected": "false",
          "verdictImpact": "claim"
        }
      ],
      "cleanup": [
        {
          "id": "cleanup.resource-group-if-needed",
          "specId": "spec.managedsystem.cli-create-default-payload",
          "featurePathIds": [
            "path.managedsystem.cli-create-default-payload"
          ],
          "surface": "az-cli",
          "intent": "Delete the resource group if the create path unexpectedly starts or creates a cluster."
        }
      ]
    }
  ],
  "metrics": {
    "selectedScenarioCount": 2,
    "behaviorAssertionCount": 9,
    "baselineClusterCrudCount": 4,
    "replannedClusterCrudCount": 2,
    "clusterCrudSaved": 2,
    "expectationDensity": 4.5,
    "diagnosticCleanGroupCount": 1
  }
} as const;
const dryRun = process.env.AKS_RP_E2E_DRY_RUN !== "0";
const runId = process.env.AKS_RP_E2E_RUN_ID || `replan-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z")}`;
const suffix = runId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-8) || "replan";
const values: Record<string, string> = {
  subscriptionId: process.env.AKS_RP_E2E_SUBSCRIPTION_ID || "26fe00f8-9173-4872-9134-bb1d2e00343a",
  resourceGroup: process.env.AKS_RP_E2E_RESOURCE_GROUP || `msreplan-${suffix}`,
  clusterName: process.env.AKS_RP_E2E_CLUSTER || `msrp${suffix}`.slice(0, 20),
  poolName: process.env.AKS_RP_E2E_MANAGEDSYSTEM_POOL || "msyspool",
  apiVersion: process.env.AKS_RP_E2E_API_VERSION || "2025-04-02-preview",
  location: process.env.AKS_RP_E2E_LOCATION || "eastus2",
  nodeVmSize: process.env.AKS_RP_E2E_NODE_VM_SIZE || "Standard_D4d_v5",
};

type CommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  endedAt: string;
};

function runCommand(args: string[], options: { allowFailure?: boolean; input?: string } = {}): CommandResult {
  const startedAt = new Date().toISOString();
  console.log(`[run] ${args.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg)).join(" ")}`);
  const result = Bun.spawnSync({
    cmd: args,
    stdin: options.input ? new TextEncoder().encode(options.input) : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });
  const endedAt = new Date().toISOString();
  const stdout = new TextDecoder().decode(result.stdout);
  const stderr = new TextDecoder().decode(result.stderr);
  const record = {
    command: args.join(" "),
    exitCode: result.exitCode,
    stdout,
    stderr,
    startedAt,
    endedAt,
  };
  if (stdout.trim()) console.log(stdout.trim().slice(0, 1600));
  if (stderr.trim()) console.error(stderr.trim().slice(0, 1600));
  if (result.exitCode !== 0 && !options.allowFailure) {
    throw new Error(`Command failed (${result.exitCode}): ${args.join(" ")}`);
  }
  return record;
}

function renderPath(template: string | undefined) {
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] || "");
}

function poolPath() {
  return `/subscriptions/${values.subscriptionId}/resourceGroups/${values.resourceGroup}/providers/Microsoft.ContainerService/managedClusters/${values.clusterName}/agentPools/${values.poolName}?api-version=${values.apiVersion}`;
}

async function armRequest(operation: { method?: string; pathTemplate?: string; body?: unknown; id: string }) {
  const method = operation.method || "GET";
  const path = renderPath(operation.pathTemplate);
  if (dryRun) {
    console.log(`[dry-run] ${method} ${path} operation=${operation.id}`);
    if (operation.body) console.log(JSON.stringify(operation.body));
    return { operationId: operation.id, exitCode: 0, dryRun: true };
  }
  const args = [
    "az",
    "rest",
    "--resource",
    "https://management.azure.com/",
    "--method",
    method.toLowerCase(),
    "--url",
    `https://management.azure.com${path}`,
    "-o",
    "json",
  ];
  if (operation.body) args.push("--body", JSON.stringify(operation.body));
  return { operationId: operation.id, ...runCommand(args, { allowFailure: operation.id === "operation.patch-mode-system" || operation.id === "operation.get-after-delete" }) };
}

async function waitForPoolSucceeded() {
  if (dryRun) {
    console.log("[dry-run] wait for ManagedSystem pool provisioningState=Succeeded");
    return;
  }
  const deadline = Date.now() + 25 * 60 * 1000;
  while (Date.now() < deadline) {
    const result = runCommand([
      "az",
      "rest",
      "--resource",
      "https://management.azure.com/",
      "--method",
      "get",
      "--url",
      `https://management.azure.com${poolPath()}`,
      "-o",
      "json",
    ], { allowFailure: true });
    if (result.exitCode === 0) {
      const body = JSON.parse(result.stdout || "{}");
      const state = body.properties?.provisioningState;
      console.log(`[wait] pool provisioningState=${state || "unknown"}`);
      if (state === "Succeeded") return;
      if (state === "Failed") throw new Error("ManagedSystem pool provisioning failed.");
    }
    await Bun.sleep(30000);
  }
  throw new Error("Timed out waiting for ManagedSystem pool provisioningState=Succeeded.");
}

async function waitForPoolGone() {
  if (dryRun) {
    console.log("[dry-run] wait for ManagedSystem pool NotFound after delete");
    return;
  }
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const result = runCommand([
      "az",
      "rest",
      "--resource",
      "https://management.azure.com/",
      "--method",
      "get",
      "--url",
      `https://management.azure.com${poolPath()}`,
      "-o",
      "json",
    ], { allowFailure: true });
    if (result.exitCode !== 0) {
      console.log("[wait] pool get failed after delete; treating as gone");
      return;
    }
    const body = JSON.parse(result.stdout || "{}");
    console.log(`[wait] pool provisioningState=${body.properties?.provisioningState || "unknown"}`);
    await Bun.sleep(30000);
  }
  throw new Error("Timed out waiting for ManagedSystem pool deletion.");
}

function setupCluster() {
  if (dryRun) {
    console.log(`[dry-run] az group create -g ${values.resourceGroup} --location ${values.location}`);
    console.log(`[dry-run] az aks create -g ${values.resourceGroup} -n ${values.clusterName} --location ${values.location} --node-count 1 --enable-managed-identity --generate-ssh-keys`);
    return;
  }
  runCommand(["az", "account", "set", "--subscription", values.subscriptionId]);
  runCommand(["az", "group", "create", "-g", values.resourceGroup, "--location", values.location, "-o", "json"]);
  runCommand([
    "az",
    "aks",
    "create",
    "-g",
    values.resourceGroup,
    "-n",
    values.clusterName,
    "--location",
    values.location,
    "--node-count",
    "1",
    "--node-vm-size",
    values.nodeVmSize,
    "--enable-managed-identity",
    "--generate-ssh-keys",
    "-o",
    "json",
  ]);
}

function cleanupCluster() {
  if (dryRun) {
    console.log(`[dry-run] az group delete -g ${values.resourceGroup} --yes --no-wait`);
    return;
  }
  runCommand(["az", "group", "delete", "-g", values.resourceGroup, "--yes", "--no-wait"], { allowFailure: true });
}

async function main() {
  console.log(`plan=${plan.id}`);
  console.log(`runId=${runId} dryRun=${dryRun}`);
  console.log(`resourceGroup=${values.resourceGroup} cluster=${values.clusterName} location=${values.location}`);
  console.log(`clusterCrud baseline=${plan.metrics.baselineClusterCrudCount} replanned=${plan.metrics.replannedClusterCrudCount} saved=${plan.metrics.clusterCrudSaved}`);
  const startedAt = new Date();
  const operationResults: Array<{ operationId: string; exitCode: number; stderr?: string; dryRun?: boolean }> = [];
  try {
    setupCluster();
    for (const group of plan.groups) {
      console.log(`group=${group.id} paths=${group.selectedPathIds.join(",")}`);
      for (const operation of group.operations) {
        if (operation.surface === "arm-rest") {
          const result = await armRequest(operation);
          operationResults.push(result);
          if (operation.id === "operation.add-managedsystem-pool") await waitForPoolSucceeded();
          if (operation.id === "operation.delete-managedsystem-pool") await waitForPoolGone();
        }
        else console.log(`${dryRun ? "[dry-run]" : "[manual]"} ${operation.surface} ${operation.id}: ${operation.intent}`);
      }
      for (const assertion of group.assertions) {
        console.log(`[assertion] ${assertion.id} behavior=${assertion.behavior} expected=${assertion.expected} impact=${assertion.verdictImpact} paths=${assertion.featurePathIds.join(",")}`);
      }
      for (const cleanup of group.cleanup) {
        console.log(`[cleanup] ${cleanup.surface} ${cleanup.id}: ${cleanup.intent}`);
      }
    }
    const resultByOperation = new Map(operationResults.map((result) => [result.operationId, result]));
    const checks = [
      ["add accepted", resultByOperation.get("operation.add-managedsystem-pool")?.exitCode === 0],
      ["get after add accepted", resultByOperation.get("operation.get-managedsystem-pool")?.exitCode === 0],
      ["mode mutation rejected", resultByOperation.get("operation.patch-mode-system")?.exitCode !== 0 && !/in progress .* node pool operation/i.test(resultByOperation.get("operation.patch-mode-system")?.stderr || "")],
      ["delete accepted", resultByOperation.get("operation.delete-managedsystem-pool")?.exitCode === 0],
      ["get after delete rejected", resultByOperation.get("operation.get-after-delete")?.exitCode !== 0],
    ] as const;
    for (const [name, ok] of checks) console.log(`[check] ${ok ? "PASS" : "FAIL"} ${name}`);
    if (!dryRun && checks.some(([, ok]) => !ok)) {
      throw new Error("One or more replanned live checks failed.");
    }
  } finally {
    cleanupCluster();
    const elapsedMinutes = Math.round(((Date.now() - startedAt.getTime()) / 60000) * 100) / 100;
    console.log(`elapsedMinutes=${elapsedMinutes}`);
    if (!dryRun) {
      console.log(`estimatedBaselineMinutes=${Math.round(plan.metrics.baselineClusterCrudCount * elapsedMinutes * 100) / 100}`);
      console.log(`estimatedSavedMinutes=${Math.round(plan.metrics.clusterCrudSaved * elapsedMinutes * 100) / 100}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
