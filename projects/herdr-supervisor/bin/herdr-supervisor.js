#!/usr/bin/env node
import { HerdrClient } from "../src/herdr-client.js";
import { loadState, updateState } from "../src/store.js";
import { findAgent, formatWorker, liveWorker, registerBinding, removeBinding } from "../src/supervision.js";

function usage(error) {
  if (error) console.error(`Error: ${error}\n`);
  console.error(`Usage:
  herdr-supervisor workers
  herdr-supervisor register <pane> --goal <goal> [--accept <criterion>]...
  herdr-supervisor status
  herdr-supervisor remove <pane>`);
  process.exitCode = 2;
}

function option(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) values.push(args[++index]);
  }
  return values;
}

const [command, paneId, ...args] = process.argv.slice(2);
const client = new HerdrClient();

try {
  if (command === "workers") {
    const snapshot = await client.snapshot();
    if (!snapshot.agents.length) console.log("No observable workers.");
    for (const agent of snapshot.agents) {
      console.log(`${agent.pane_id} · ${agent.agent} · ${agent.agent_status} · ${agent.foreground_cwd || agent.cwd || "unknown directory"}`);
    }
  } else if (command === "register") {
    const goal = option(args, "--goal")[0];
    if (!paneId || !goal) usage("register requires a pane and --goal");
    else {
      const snapshot = await client.snapshot();
      const agent = findAgent(snapshot, paneId);
      if (!agent) throw new Error(`no observable agent in ${paneId}`);
      let binding;
      await updateState((state) => {
        binding = registerBinding(state, agent, goal, option(args, "--accept"));
        return state;
      });
      console.log(`Supervising ${binding.agentSession.agent} in ${binding.paneId}.\nGoal: ${binding.goal}`);
    }
  } else if (command === "status") {
    const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
    if (!state.workers.length) console.log("No supervised workers.");
    else console.log(state.workers.map((binding) => formatWorker(liveWorker(binding, snapshot))).join("\n\n"));
  } else if (command === "remove") {
    if (!paneId) usage("remove requires a pane");
    else {
      let removed = false;
      await updateState((state) => {
        removed = removeBinding(state, paneId);
        return state;
      });
      console.log(removed ? `Stopped supervising ${paneId}.` : `${paneId} was not supervised.`);
    }
  } else {
    usage();
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
